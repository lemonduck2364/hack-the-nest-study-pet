'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createChatService } = require('../src/chat-service.cjs');
const KEY = 'unit-test-key-never-a-real-credential';
const response = (reply = 'I’m playing with my little cube.', extra = {}) => new Response(JSON.stringify({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: reply }] } }], ...extra }), { status: 200, headers: { 'Content-Type': 'application/json' } });
const service = options => createChatService({ env: {}, ...options });
function deferred() { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; }
function connect(chat) { assert.equal(chat.configure({ provider: 'gemini', apiKey: KEY }).ok, true); }

test('no key means no request; configure exposes status without credentials', async () => {
  let calls = 0;
  const chat = service({ fetchImpl: () => { calls++; throw new Error(KEY); } });
  assert.equal((await chat.send('Hello')).code, 'missing_key');
  assert.equal(chat.getStatus().ready, false);
  for (const apiKey of ['', 'your-key-here', 'short', 'bad\nheader', 'x'.repeat(513)]) {
    assert.equal(chat.configure({ provider: 'gemini', apiKey }).ok, false);
  }
  assert.equal(chat.configure({ provider: 'untrusted', apiKey: KEY }).ok, false);
  connect(chat);
  assert.equal(chat.getStatus().ready, true);
  assert.equal(calls, 0);
  assert.equal(JSON.stringify(chat.getStatus()).includes(KEY), false);
  assert.equal(chat.getStatus().remaining, 30);
});

test('valid request uses fixed endpoint, bounded context, safe pet state and text-only reply', async () => {
  let request;
  const chat = service({ getPetState: () => ({ activity: 'play', play: 'ball', energy: 71.4, secret: KEY, screenText: 'never share' }), fetchImpl: async (url, options) => {
    request = { url, options };
    return new Response(JSON.stringify({ candidates: [{ finishReason: 'STOP', content: { parts: [{ thought: true, text: 'hidden reasoning' }, { text: 'Hi, ' }, { text: 'I found a kitty!' }] } }] }));
  } });
  connect(chat);
  assert.deepEqual(await chat.send('  Hey there  '), { ok: true, reply: 'Hi, I found a kitty!' });
  assert.equal(request.url, 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent');
  assert.equal(request.options.redirect, 'error');
  assert.equal(request.options.headers['x-goog-api-key'], KEY);
  const body = JSON.parse(request.options.body);
  assert.equal(body.generationConfig.maxOutputTokens, 512);
  assert.equal(body.generationConfig.thinkingConfig.thinkingLevel, 'MINIMAL');
  assert.equal(request.options.body.includes(KEY), false);
  assert.equal(request.options.body.includes('never share'), false);
  assert.ok(body.systemInstruction.parts[1].text.includes('playing with a little cat'));
  assert.equal(body.contents[0].parts[0].text, 'Hey there');
  assert.deepEqual(chat.getTranscript(), [{ role: 'user', text: 'Hey there' }, { role: 'assistant', text: 'Hi, I found a kitty!' }]);
  const copy = chat.getTranscript(); copy[0].text = 'tampered';
  assert.equal(chat.getTranscript()[0].text, 'Hey there');
});

test('invalid input and duplicate pending sends cannot spend extra requests', async () => {
  let calls = 0;
  const pending = deferred();
  const chat = service({ fetchImpl: () => { calls++; return pending.promise; } });
  connect(chat);
  for (const invalid of [null, {}, '', '  ', 'x'.repeat(1001)]) assert.equal((await chat.send(invalid)).code, 'invalid');
  const first = chat.send('Hello');
  assert.equal(chat.getStatus().busy, true);
  assert.equal((await chat.send('Again')).code, 'busy');
  assert.equal(chat.configure({ provider: 'gemini', apiKey: 'another-test-key' }).code, 'busy');
  assert.equal(calls, 1);
  pending.resolve(response());
  assert.equal((await first).ok, true);
  assert.equal(chat.getStatus().busy, false);
});

test('provider errors and thrown network details never reach the UI', async () => {
  for (const [status, code] of [[400, 'request'], [401, 'auth'], [403, 'auth'], [404, 'request'], [429, 'quota'], [500, 'unavailable']]) {
    const chat = service({ fetchImpl: async () => new Response(JSON.stringify({ error: `secret=${KEY} https://evil.invalid/?key=${KEY}` }), { status }) });
    connect(chat);
    const result = await chat.send('Hello');
    assert.equal(result.code, code);
    assert.equal(JSON.stringify(result).includes(KEY), false);
    assert.deepEqual(chat.getTranscript(), []);
    assert.equal(chat.getStatus().remaining, 29);
  }
  const chat = service({ fetchImpl: async () => { throw new Error(KEY); } });
  connect(chat);
  assert.equal((await chat.send('Hi')).code, 'unavailable');
});

test('timeout aborts request without retry and releases the single-flight lock', async () => {
  let signal, calls = 0;
  const chat = service({ timeoutMs: 10, fetchImpl: async (_url, options) => { calls++; signal = options.signal; return new Promise(() => {}); } });
  connect(chat);
  assert.equal((await chat.send('Hi')).code, 'timeout');
  assert.equal(signal.aborted, true);
  assert.equal(calls, 1);
  assert.equal(chat.getStatus().busy, false);
  assert.deepEqual(chat.getTranscript(), []);
});

test('timeout also bounds response body reading', async () => {
  let cancelled = false;
  const body = new ReadableStream({ start(controller) { controller.enqueue(new TextEncoder().encode('{')); }, cancel() { cancelled = true; } });
  const chat = service({ timeoutMs: 10, fetchImpl: async () => new Response(body) }); connect(chat);
  assert.equal((await chat.send('Hi')).code, 'timeout');
  assert.equal(cancelled, true);
});

test('clear aborts old work, allows new send, and late response cannot repopulate history', async () => {
  const old = deferred(); let count = 0, firstSignal;
  const chat = service({ fetchImpl: (_url, options) => { count++; if (count === 1) { firstSignal = options.signal; return old.promise; } return Promise.resolve(response('New reply')); } });
  connect(chat);
  const first = chat.send('Old message');
  chat.clear();
  assert.equal(firstSignal.aborted, true);
  assert.equal(chat.getStatus().ready, true);
  const second = chat.send('New message');
  assert.equal((await first).code, 'cancelled');
  assert.equal((await second).reply, 'New reply');
  old.resolve(response('Old reply')); await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(chat.getTranscript(), [{ role: 'user', text: 'New message' }, { role: 'assistant', text: 'New reply' }]);
  assert.equal(chat.getStatus().remaining, 28);
});

test('history stays bounded; clearing or configuring does not reset session request budget', async () => {
  let lastBody, calls = 0;
  const chat = service({ fetchImpl: async (_url, options) => { calls++; lastBody = JSON.parse(options.body); return response('A little reply'); } });
  connect(chat);
  for (let i = 0; i < 30; i++) assert.equal((await chat.send(`Hello ${i}`)).ok, true);
  assert.equal(lastBody.contents.length, 13);
  assert.equal(lastBody.contents[0].parts[0].text, 'Hello 23');
  assert.equal(chat.getTranscript().length, 60);
  chat.clear(); connect(chat);
  assert.equal((await chat.send('More')).code, 'limit');
  assert.equal(calls, 30);
  assert.equal(chat.getStatus().remaining, 0);
});

test('malformed, blocked, thought-only and oversize content produce no fabricated reply', async () => {
  const bad = [
    () => new Response('not JSON'),
    () => new Response('x'.repeat(65537)),
    () => response('blocked', { promptFeedback: { blockReason: 'SAFETY' } }),
    () => new Response(JSON.stringify({ candidates: [{ content: { parts: [{ thought: true, text: 'Reasoning only' }] } }] })),
    () => response('x'.repeat(4001)),
    () => response(''),
  ];
  for (const makeResponse of bad) {
    const chat = service({ fetchImpl: async () => makeResponse() }); connect(chat);
    const result = await chat.send('Hi');
    assert.equal(result.ok, false);
    assert.equal(result.reply, undefined);
    assert.deepEqual(chat.getTranscript(), []);
  }
});

test('environment key is recognized without exposing or saving it', async () => {
  const chat = createChatService({ env: { GEMINI_API_KEY: KEY }, fetchImpl: async () => response('Hello') });
  assert.equal(chat.getStatus().ready, true);
  assert.equal((await chat.send('Hi')).ok, true);
  assert.equal(JSON.stringify(chat.getStatus()).includes(KEY), false);
});
