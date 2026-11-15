'use strict';

// Run this smoke separately with permission to listen on the Mac's network sockets.
const assert = require('node:assert/strict');
const http = require('node:http');
const { randomUUID } = require('node:crypto');
const { test } = require('node:test');
const { joinLobby, startLobbyServer } = require('../src/lobby-network.cjs');

function makePet(appearance) {
  return { petId: randomUUID(), appearance };
}

test('a host shares its current LAN address after changing Wi-Fi', async (t) => {
  let wlan = '10.0.0.53';
  const room = await startLobbyServer({
    getInterfaces: () => wlan ? { en0: [{ address: wlan, internal: false }] } : {}
  });
  t.after(() => room.close());

  assert.match(room.invite, /^10\.0\.0\.53:/);
  const portAndCode = room.invite.split(':')[1];
  wlan = '192.168.1.20';
  assert.equal(room.invite, '192.168.1.20:' + portAndCode);
  wlan = null;
  assert.equal(room.invite, '');
  assert.match(room.localInvite, /^127\.0\.0\.1:/);
});

test('two clients see the same greeting, with authenticated two-seat presence', async (t) => {
  const room = await startLobbyServer();
  t.after(() => room.close());

  const guestInvite = room.invite || room.localInvite;
  assert.match(guestInvite, /^(?:\d{1,3}\.){3}\d{1,3}:\d+\/[a-f0-9]{12}$/);
  assert.match(room.localInvite, /^127\.0\.0\.1:\d+\/[a-f0-9]{12}$/);
  const hostPet = makePet('red-panda');
  const guestPet = makePet('dafeiyu');
  const anotherPet = makePet('red-panda');

  const [address, code] = room.localInvite.split('/');
  const wrongCode = code.slice(0, -1) + (code.endsWith('0') ? '1' : '0');
  await assert.rejects(joinLobby(address + '/' + wrongCode, anotherPet), /expired/);
  const unauthorizedPulse = await fetch('http://' + address + '/nest-pet/lobby/pulse', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: '0'.repeat(32) })
  });
  assert.equal(unauthorizedPulse.status, 403);
  await unauthorizedPulse.text();

  const oversizedJoin = await fetch('http://' + address + '/nest-pet/lobby/join', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, ...anotherPet, padding: 'x'.repeat(1024) })
  });
  assert.equal(oversizedJoin.status, 413);
  await oversizedJoin.text();

  const host = await joinLobby(room.localInvite, { ...hostPet, memories: ['private'] });
  assert.deepEqual(host.initialState, {
    pets: [{ id: hostPet.petId, appearance: 'red-panda', seat: 0 }],
    greeting: null
  });
  await assert.rejects(joinLobby(room.localInvite, { ...hostPet, petId: hostPet.petId.toUpperCase() }),
    /already visiting/);
  const guest = await joinLobby(guestInvite, guestPet);
  assert.deepEqual(await host.pulse(), guest.initialState);
  assert.deepEqual(await guest.pulse(), guest.initialState);
  assert.deepEqual(guest.initialState.pets, [
    { id: hostPet.petId, appearance: 'red-panda', seat: 0 },
    { id: guestPet.petId, appearance: 'dafeiyu', seat: 1 }
  ]);
  assert.equal(guest.initialState.greeting.firstId, hostPet.petId);
  assert.equal(guest.initialState.greeting.secondId, guestPet.petId);
  await assert.rejects(joinLobby(room.localInvite, anotherPet), /full/);

  const pendingPulse = guest.pulse();
  await Promise.allSettled([pendingPulse, guest.leave()]);
  assert.equal(await guest.leave(), undefined);
  assert.deepEqual(await host.pulse(), host.initialState);
  const replacement = await joinLobby(guestInvite, anotherPet);
  assert.notEqual(replacement.initialState.greeting.id, guest.initialState.greeting.id);
  await room.close();
  await assert.rejects(host.pulse(), /Could not connect/);
});

test('an abandoned seat expires while the remaining pet stays in the room', async (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: 1000 });
  const room = await startLobbyServer({ bindHost: '127.0.0.1' });
  t.after(() => room.close());
  const hostPet = makePet('red-panda');
  const guestPet = makePet('dafeiyu');
  const host = await joinLobby(room.localInvite, hostPet);
  const guest = await joinLobby(room.localInvite, guestPet);

  t.mock.timers.tick(4000);
  assert.equal((await host.pulse()).pets.length, 2);
  t.mock.timers.tick(4001);
  assert.deepEqual(await host.pulse(), host.initialState);
  await assert.rejects(guest.pulse(), /expired/);

  const rejoined = await joinLobby(room.localInvite, guestPet);
  assert.equal(rejoined.initialState.pets[1].id, guestPet.petId);
  assert.notEqual(rejoined.initialState.greeting.id, guest.initialState.greeting.id);
});

test('client rejects redirects and times out when a room does not finish responding', async (t) => {
  let redirected = false;
  const server = http.createServer((request, response) => {
    if (request.url === '/redirect-destination') redirected = true;
    if (request.url === '/nest-pet/lobby/join') {
      response.writeHead(307, { Location: '/redirect-destination' });
      response.end();
    }
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  t.after(() => {
    const closed = new Promise((resolve) => server.close(resolve));
    server.closeAllConnections();
    return closed;
  });

  const invite = '127.0.0.1:' + server.address().port + '/0123456789ab';
  await assert.rejects(joinLobby(invite, makePet('red-panda')), /Could not connect/);
  assert.equal(redirected, false);

  server.removeAllListeners('request');
  server.on('request', (_request, response) => {
    response.writeHead(200);
    response.write('{');
  });
  await assert.rejects(joinLobby(invite, makePet('red-panda')), /Could not reach the host/);
});
