'use strict';

const http = require('node:http');
const { isIPv4 } = require('node:net');
const { networkInterfaces } = require('node:os');
const { randomBytes, randomUUID } = require('node:crypto');

const ROOM_CODE = /^[a-f0-9]{12}$/i;
const MEMBER_TOKEN = /^[a-f0-9]{32}$/;
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const { registry } = require('./renderer/character-pack.js');
const LOOPBACK = '127.0.0.1';
const REQUEST_TIMEOUT_MS = 2000;
const STALE_MS = 8000;
const MAX_JSON_BYTES = 1024;
const ROUTES = {
  '/nest-pet/lobby/join': 'join',
  '/nest-pet/lobby/pulse': 'pulse',
  '/nest-pet/lobby/leave': 'leave'
};
const CONNECTION_ERROR = 'Could not connect to the Lobby. Check the invite and the host’s network.';

function privateIPv4(host) {
  if (!isIPv4(host)) return false;
  const [first, second] = host.split('.').map(Number);
  return first === 10 || (first === 172 && second >= 16 && second <= 31)
    || (first === 192 && second === 168);
}

function activeLobbyAddress() {
  const interfaces = Object.entries(networkInterfaces());
  // Prefer the Mac's Wi-Fi or Ethernet interfaces over virtual adapters.
  interfaces.sort(([first], [second]) => Number(/^en\d+$/.test(second)) - Number(/^en\d+$/.test(first)));
  for (const [, addresses] of interfaces) {
    const match = addresses.find(({ internal, address }) => !internal && privateIPv4(address));
    if (match) return match.address;
  }
  return LOOPBACK;
}

function parseInvite(invite) {
  const fields = typeof invite === 'string' && invite.length <= 64
    ? /^(\d{1,3}(?:\.\d{1,3}){3}):(\d{1,5})\/([a-f0-9]{12})$/i.exec(invite.trim())
    : null;
  if (fields) {
    const [, host, portText, code] = fields;
    const port = Number(portText);
    if ((host === LOOPBACK || privateIPv4(host)) && port > 0 && port <= 65535) {
      return { host, port, code: code.toLowerCase() };
    }
  }
  throw new Error('Enter a valid Lobby invite.');
}

function validPet(petId, appearance) {
  return typeof petId === 'string' && UUID.test(petId) && typeof appearance === 'string' && Object.hasOwn(registry, appearance);
}

async function readJson(stream) {
  const chunks = [];
  let bytes = 0;
  for await (const chunk of stream.iterator({ destroyOnReturn: false })) {
    bytes += chunk.length;
    if (bytes > MAX_JSON_BYTES) throw new Error('Lobby message is too large.');
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

function reply(response, status, body = null) {
  const payload = JSON.stringify(body);
  response.writeHead(status, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payload),
    'Cache-Control': 'no-store',
    Connection: 'close'
  });
  response.end(payload);
}

async function startLobbyServer({ bindHost = '0.0.0.0' } = {}) {
  if (bindHost !== '0.0.0.0' && bindHost !== LOOPBACK) throw new Error('Could not host a Lobby.');
  const code = randomBytes(6).toString('hex');
  const members = new Map();
  let greeting = null;

  function publicState() {
    const pets = [...members.values()]
      .map(({ id, appearance, seat }) => ({ id, appearance, seat }))
      .sort((first, second) => first.seat - second.seat);
    return { pets, greeting };
  }

  function removeMember(token) {
    members.delete(token);
    greeting = null;
  }

  const server = http.createServer({
    headersTimeout: 3000,
    requestTimeout: 3000,
    connectionsCheckingInterval: 1000,
    maxHeaderSize: 4096
  }, async (request, response) => {
    const address = request.socket.remoteAddress;
    if (address !== LOOPBACK && !privateIPv4(address)) return reply(response, 403);
    if (request.method !== 'POST' || !Object.hasOwn(ROUTES, request.url)) return reply(response, 404);
    if (request.headers['content-type'] !== 'application/json') return reply(response, 400);
    if (Number(request.headers['content-length']) > MAX_JSON_BYTES) return reply(response, 413);

    let body;
    try {
      body = await readJson(request);
    } catch {
      if (!response.destroyed) reply(response, 400);
      return;
    }

    const now = Date.now();
    // Reclaim abandoned seats before they can affect a join or a state update.
    for (const [token, member] of members) {
      if (now - member.lastSeen >= STALE_MS) removeMember(token);
    }

    const operation = ROUTES[request.url];
    if (operation === 'join') {
      if (body?.code !== code) return reply(response, 403);
      if (!validPet(body.petId, body.appearance)) return reply(response, 400);
      const id = body.petId.toLowerCase();
      const currentPets = publicState().pets;
      if (currentPets.some((pet) => pet.id === id)) return reply(response, 409);
      if (currentPets.length === 2) return reply(response, 409);
      const seat = currentPets[0]?.seat === 0 ? 1 : 0;
      const token = randomBytes(16).toString('hex');
      members.set(token, { id, appearance: body.appearance, seat, lastSeen: now });
      if (members.size === 2) {
        const [{ id: firstId }, { id: secondId }] = publicState().pets;
        greeting = { id: randomUUID(), firstId, secondId };
      }
      return reply(response, 200, { token, state: publicState() });
    }

    const token = body?.token;
    const member = members.get(token);
    if (!member) return reply(response, 403);
    if (operation === 'leave') {
      removeMember(token);
      return reply(response, 200);
    }
    member.lastSeen = now;
    return reply(response, 200, publicState());
  });

  try {
    await new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(0, bindHost, resolve);
    });
  } catch (cause) {
    throw new Error('Could not host a Lobby.', { cause });
  }

  const { port } = server.address();
  const host = bindHost === LOOPBACK ? LOOPBACK : activeLobbyAddress();
  let closing;
  return {
    invite: `${host}:${port}/${code}`,
    localInvite: `${LOOPBACK}:${port}/${code}`,
    close() {
      if (!closing) {
        members.clear();
        greeting = null;
        closing = new Promise((resolve) => server.close(resolve));
        server.closeAllConnections();
      }
      return closing;
    }
  };
}

function requestLobby(endpoint, operation, body) {
  const payload = JSON.stringify(body);
  return new Promise((resolve, reject) => {
    // Numeric IPv4 with Node HTTP keeps this on the requested LAN endpoint without proxies or redirects.
    const request = http.request({
      hostname: endpoint.host,
      port: endpoint.port,
      path: '/nest-pet/lobby/' + operation,
      method: 'POST',
      agent: false,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
        Connection: 'close'
      }
    }, async (response) => {
      if (response.statusCode !== 200) {
        response.destroy();
        const message = response.statusCode === 409
          ? 'The Lobby is full or this pet is already visiting.'
          : response.statusCode === 403
            ? 'This Lobby invite or visit has expired.'
            : CONNECTION_ERROR;
        reject(new Error(message));
        return;
      }
      try {
        resolve(await readJson(response));
      } catch {
        response.destroy();
        reject(new Error(CONNECTION_ERROR));
      }
    });
    request.once('error', () => reject(new Error(CONNECTION_ERROR)));
    request.end(payload);
  });
}

function decodeState(state, ownId) {
  if (!Array.isArray(state?.pets) || state.pets.length < 1 || state.pets.length > 2) {
    throw new Error(CONNECTION_ERROR);
  }
  const pets = state.pets.map((pet) => {
    if (!validPet(pet?.id, pet?.appearance) || (pet.seat !== 0 && pet.seat !== 1)) {
      throw new Error(CONNECTION_ERROR);
    }
    return { id: pet.id, appearance: pet.appearance, seat: pet.seat };
  });
  if (!pets.some((pet) => pet.id === ownId)) throw new Error(CONNECTION_ERROR);
  const { greeting } = state;
  if (pets.length === 1 && greeting === null) return { pets, greeting };
  if (pets.length !== 2 || pets[0].seat !== 0 || pets[1].seat !== 1 || pets[0].id === pets[1].id
      || typeof greeting?.id !== 'string' || !UUID.test(greeting.id)
      || greeting.firstId !== pets[0].id || greeting.secondId !== pets[1].id) {
    throw new Error(CONNECTION_ERROR);
  }
  return { pets, greeting: { id: greeting.id, firstId: greeting.firstId, secondId: greeting.secondId } };
}

async function joinLobby(invite, { petId, appearance } = {}) {
  const endpoint = parseInvite(invite);
  if (!validPet(petId, appearance)) throw new Error('This pet could not visit the Lobby.');
  const id = petId.toLowerCase();
  const joined = await requestLobby(endpoint, 'join', { code: endpoint.code, petId: id, appearance });
  const token = joined?.token;
  if (typeof token !== 'string' || !MEMBER_TOKEN.test(token)) throw new Error(CONNECTION_ERROR);
  const initialState = decodeState(joined.state, id);
  let leaving;
  return {
    initialState,
    async pulse() {
      if (leaving) throw new Error('This Lobby visit has ended.');
      return decodeState(await requestLobby(endpoint, 'pulse', { token }), id);
    },
    leave() {
      leaving ??= requestLobby(endpoint, 'leave', { token }).then(() => undefined);
      return leaving;
    }
  };
}

module.exports = { startLobbyServer, joinLobby };
