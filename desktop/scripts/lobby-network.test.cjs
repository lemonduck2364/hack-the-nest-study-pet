'use strict';

const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { EventEmitter } = require('node:events');
const http = require('node:http');
const { test } = require('node:test');
const { joinLobby, startLobbyServer } = require('../src/lobby-network.cjs');

test('Lobby rejects addresses outside its exact private IPv4 invite format', async () => {
  const pet = { petId: randomUUID(), appearance: 'red-panda' };
  for (const invite of [
    'https://192.168.1.2:1234/0123456789ab',
    'example.test:1234/0123456789ab',
    '8.8.8.8:1234/0123456789ab',
    '172.32.0.1:1234/0123456789ab',
    '169.254.0.1:1234/0123456789ab',
    '127.0.0.2:1234/0123456789ab',
    '127.0.0.1:65536/0123456789ab',
    '127.0.0.1:0/0123456789ab',
    '127.0.0.1:1234/0123456789ab?x=1',
    '[::1]:1234/0123456789ab'
  ]) {
    await assert.rejects(joinLobby(invite, pet), /valid Lobby invite/, invite);
  }
});

test('Lobby checks pet identity and appearance before connecting', async () => {
  const invite = '127.0.0.1:1/0123456789ab';
  await assert.rejects(joinLobby(invite, { petId: 'abc', appearance: 'red-panda' }), /could not visit/);
  await assert.rejects(joinLobby(invite, { petId: randomUUID(), appearance: 'unknown' }), /could not visit/);
  await assert.rejects(startLobbyServer({ bindHost: '192.0.2.1' }), /Could not host/);
});

test('Join reports permission, reachability and closed-room errors separately', async (t) => {
  let code;
  t.mock.method(http, 'request', () => {
    const request = new EventEmitter();
    request.end = () => request.emit('error', Object.assign(new Error(), { code }));
    return request;
  });
  const invite = '192.168.1.2:5000/0123456789ab';
  const pet = { petId: randomUUID(), appearance: 'red-panda' };
  code = 'EPERM';
  await assert.rejects(joinLobby(invite, pet), /Local network access was blocked/);
  code = 'EHOSTUNREACH';
  await assert.rejects(joinLobby(invite, pet), /Could not reach the host/);
  code = 'ECONNREFUSED';
  await assert.rejects(joinLobby(invite, pet), /No room answered/);
});
