'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { createCompanionMemory } = require('../src/companion-memory.cjs');
const { createChatService } = require('../src/chat-service.cjs');

const KEY = 'AQ.synthetic.memory-test';
const FIRST = 'I usually drink jasmine tea while I read';
const SECOND = 'I switched to peppermint tea when I read';
const response = turn => new Response(JSON.stringify({
  candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify(turn) }] } }],
}));

async function fixture(t) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'nest-companion-memory-'));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const key = crypto.randomBytes(32);
  const safeStorage = {
    async isAsyncEncryptionAvailable() { return true; },
    async encryptStringAsync(text) {
      const iv = crypto.randomBytes(12);
      const enc = crypto.createCipheriv('aes-256-gcm', key, iv);
      return Buffer.concat([iv, enc.update(text, 'utf8'), enc.final(), enc.getAuthTag()]);
    },
    async decryptStringAsync(bytes) {
      const dec = crypto.createDecipheriv('aes-256-gcm', key, bytes.subarray(0, 12));
      dec.setAuthTag(bytes.subarray(-16));
      return { result: Buffer.concat([dec.update(bytes.subarray(12, -16)), dec.final()]).toString('utf8') };
    },
  };
  return {
    directory,
    filename: path.join(directory, 'memories.enc'),
    options: { directory, safeStorage, platform: 'darwin' },
    async reopen() {
      const memory = createCompanionMemory(this.options);
      await memory.restore();
      return memory;
    },
  };
}

function session(memory, fetchImpl, characterId = 'red-panda') {
  return createChatService({
    getMemory: () => memory,
    getPetState: () => ({ characterId }),
    fetchImpl,
    env: { GEMINI_API_KEY: KEY },
  });
}

test('records a natural preference, encrypts it, recalls it in a fresh session with another appearance and updates it', async t => {
  const fixtureData = await fixture(t);
  const memory = await fixtureData.reopen();
  let calls = 0;
  const chat = session(memory, async (_url, request) => {
    calls++;
    const body = JSON.parse(request.body);
    assert.equal(body.generationConfig.responseMimeType, 'application/json');
    assert.equal(request.headers['x-goog-api-key'], KEY);
    return response({ reply: 'That sounds like a cozy ritual.', edits: [{ op: 'add', id: '', quote: FIRST }] });
  });
  assert.deepEqual(await chat.send(`${FIRST}. It helps me slow down.`), { ok: true, reply: 'That sounds like a cozy ritual.' });
  assert.equal(calls, 1);
  const encrypted = await fs.readFile(fixtureData.filename);
  assert.equal(encrypted.includes(Buffer.from('jasmine tea')), false);
  assert.equal((await fs.stat(fixtureData.filename)).mode & 0o777, 0o600);

  const reopened = await fixtureData.reopen();
  const [saved] = reopened.snapshot().entries;
  assert.equal(saved.quote, FIRST);
  let requests = 0;
  const newChat = session(reopened, async (_url, request) => {
    const body = JSON.parse(request.body);
    const context = body.systemInstruction.parts.map(part => part.text).join('\n');
    assert.match(context, /"appearance":"dafeiyu"/);
    assert.match(context, /jasmine tea/);
    if (++requests === 1) {
      assert.equal(body.contents.length, 1, 'past transcript is gone after reopening');
      return response({ reply: 'A cup of jasmine tea sounds like your kind of reading break.', edits: [] });
    }
    return response({ reply: 'Peppermint it is.', edits: [{ op: 'replace', id: saved.id, quote: SECOND }] });
  }, 'dafeiyu');
  assert.match((await newChat.send('What would go with a reading break?')).reply, /jasmine/);
  assert.equal((await newChat.send(SECOND)).ok, true);
  assert.deepEqual((await fixtureData.reopen()).snapshot().entries, [{ id: saved.id, quote: SECOND }]);
});

test('ignores fabricated, duplicate and credential-like snippets, and a cancelled reply cannot teach a memory', async t => {
  const data = await fixture(t);
  const memory = await data.reopen();
  const add = quote => ({ op: 'add', id: '', quote });
  await memory.apply([add('An invented fact'), add('My password is correcthorsebattery')], 'My password is correcthorsebattery');
  assert.deepEqual(memory.snapshot().entries, []);
  await memory.apply([add(FIRST), add(FIRST)], FIRST);
  assert.equal(memory.snapshot().entries.length, 1);
  let finish;
  const chat = session(memory, () => new Promise(resolve => { finish = resolve; }));
  const stale = chat.send(SECOND);
  chat.clear();
  finish(response({ reply: 'Okay.', edits: [add(SECOND)] }));
  assert.equal((await stale).code, 'cancelled');
  assert.deepEqual((await data.reopen()).snapshot().entries.map(entry => entry.quote), [FIRST]);
});

test('forgets a requested detail and clears stale conversation context, while failing safely on unreadable data', async t => {
  const data = await fixture(t);
  const memory = await data.reopen();
  await memory.apply([{ op: 'add', id: '', quote: FIRST }], FIRST);
  const [{ id }] = memory.snapshot().entries;
  const forget = 'Please forget my reading drink preference';
  let calls = 0;
  const chat = session(memory, async () => response({ reply: 'Okay.', edits: ++calls === 1 ? [] : [{ op: 'delete', id, quote: forget }] }));
  assert.equal((await chat.send('Hello')).ok, true);
  assert.equal((await chat.send(forget)).ok, true);
  assert.deepEqual(chat.getTranscript(), []);
  assert.deepEqual((await data.reopen()).snapshot().entries, []);

  const corrupt = Buffer.from('invalid encrypted data');
  await fs.writeFile(data.filename, corrupt);
  const unreadable = await data.reopen();
  assert.equal(unreadable.snapshot().state, 'unavailable');
  const degraded = session(unreadable, async (_url, request) => {
    const body = JSON.parse(request.body);
    assert.equal(body.generationConfig.responseMimeType, undefined);
    return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: 'Hi there.' }] } }] }));
  });
  assert.deepEqual(await degraded.send('Hello'), { ok: true, reply: 'Hi there.' });
  assert.deepEqual(await fs.readFile(data.filename), corrupt);
  assert.equal(await degraded.forgetMemory(null), true);
  assert.equal((await data.reopen()).snapshot().state, 'ready');
  assert.deepEqual(degraded.getTranscript(), []);
});

test('a provider error preserves saved memory and a later send can still reply', async t => {
  const data = await fixture(t);
  const memory = await data.reopen();
  await memory.apply([{ op: 'add', id: '', quote: FIRST }], FIRST);
  let calls = 0;
  const chat = session(memory, async () => ++calls === 1
    ? new Response('unavailable', { status: 503 })
    : response({ reply: 'Want a quiet tea break?', edits: [] }));
  assert.equal((await chat.send('Hi')).code, 'provider');
  assert.equal((await chat.send('Hi')).ok, true);
  assert.equal((await data.reopen()).snapshot().entries[0].quote, FIRST);
});
