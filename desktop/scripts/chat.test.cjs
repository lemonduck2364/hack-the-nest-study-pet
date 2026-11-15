'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createChatService } = require('../src/chat-service.cjs');
const KEY = 'AQ.unit-test-key-never-a-real-credential';
const response = (reply = 'I’m playing with my little cube.', extra = {}) => new Response(JSON.stringify({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: reply }] } }], ...extra }), { status: 200, headers: { 'Content-Type': 'application/json' } });
const memoryStore = () => { let key=null; return {async load(){return key;},async save(value){key=value;},async remove(){key=null;}}; };
const service = options => createChatService({ env: {}, keyStore:memoryStore(), ...options });
function deferred() { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; }
async function connect(chat) { assert.equal((await chat.configure({ provider: 'gemini', apiKey: KEY })).ok, true); }

test('no key means no request; configure exposes status without credentials', async () => {
  let calls = 0;
  const chat = service({ fetchImpl: () => { calls++; throw new Error(KEY); } });
  assert.equal((await chat.send('Hello')).code, 'missing_key');
  assert.equal(chat.getStatus().ready, false);
  for (const apiKey of ['', 'your-key-here', 'short', 'bad\nheader', 'x'.repeat(513)]) {
    assert.equal((await chat.configure({ provider: 'gemini', apiKey })).ok, false);
  }
  assert.equal((await chat.configure({ provider: 'untrusted', apiKey: KEY })).ok, false);
  await connect(chat);
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
  await connect(chat);
  assert.deepEqual(await chat.send('  Hey there  '), { ok: true, reply: 'Hi, I found a kitty!' });
  assert.equal(request.url, 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent');
  assert.equal(request.options.redirect, 'error');
  assert.equal(request.options.headers['x-goog-api-key'], KEY);
  const body = JSON.parse(request.options.body);
  assert.equal(body.generationConfig.maxOutputTokens, 512);
  assert.equal(body.generationConfig.thinkingConfig.thinkingLevel, 'MINIMAL');
  assert.equal(request.options.body.includes(KEY), false);
  assert.equal(request.options.body.includes('never share'), false);
  assert.ok(body.systemInstruction.parts[1].text.includes('playing with a little kitty'));
  assert.equal(body.contents[0].parts[0].text, 'Hey there');
  assert.deepEqual(chat.getTranscript(), [{ role: 'user', text: 'Hey there' }, { role: 'assistant', text: 'Hi, I found a kitty!' }]);
  const copy = chat.getTranscript(); copy[0].text = 'tampered';
  assert.equal(chat.getTranscript()[0].text, 'Hey there');
});

test('invalid input and duplicate pending sends cannot spend extra requests', async () => {
  let calls = 0;
  const pending = deferred();
  const chat = service({ fetchImpl: () => { calls++; return pending.promise; } });
  await connect(chat);
  for (const invalid of [null, {}, '', '  ', 'x'.repeat(1001)]) assert.equal((await chat.send(invalid)).code, 'invalid');
  const first = chat.send('Hello');
  assert.equal(chat.getStatus().busy, true);
  assert.equal((await chat.send('Again')).code, 'busy');
  assert.equal((await chat.configure({ provider: 'gemini', apiKey: 'another-test-key' })).code, 'busy');
  assert.equal(calls, 1);
  pending.resolve(response());
  assert.equal((await first).ok, true);
  assert.equal(chat.getStatus().busy, false);
});

test('provider errors and thrown network details never reach the UI', async () => {
  for (const [status, code] of [[400, 'request'], [401, 'auth'], [403, 'auth'], [404, 'request'], [429, 'quota'], [500, 'provider'], [503, 'provider']]) {
    let calls = 0;
    const chat = service({ fetchImpl: async () => {
      calls++;
      return new Response(JSON.stringify({ error: `secret=${KEY} https://evil.invalid/?key=${KEY}` }), { status });
    } });
    await connect(chat);
    const result = await chat.send('Hello');
    assert.equal(result.code, code);
    assert.deepEqual(chat.getStatus().lastError,{code,httpStatus:status});
    assert.equal(JSON.stringify(chat.getStatus()).includes(KEY),false);
    assert.equal(JSON.stringify(result).includes(KEY), false);
    assert.deepEqual(chat.getTranscript(), []);
    assert.equal(calls, status === 503 ? 2 : 1);
    assert.equal(chat.getStatus().remaining, 30 - calls);
  }
  const chat = service({ fetchImpl: async () => { throw new Error(KEY); } });
  await connect(chat);
  assert.equal((await chat.send('Hi')).code, 'network');
});

test('a transient network failure retries once with the same structured context and applies memory once', async () => {
  const calls = [], applied = [];
  const memory = {
    usable: () => true,
    snapshot: () => ({ entries: [{ id: 'm1', quote: 'I like hot tea.' }] }),
    async apply(edits, text) { applied.push({ edits, text }); return { saved: true, changed: false }; },
  };
  const chat = service({ getMemory: () => memory, fetchImpl: async (_url, options) => {
    calls.push(JSON.parse(options.body));
    if (calls.length === 2) throw new Error('Connection reset');
    return response(JSON.stringify({ reply: 'I will keep you company.', edits: [] }));
  } });
  await connect(chat);
  assert.equal((await chat.send('Hello')).ok, true);
  assert.equal((await chat.send('Can you stay?')).reply, 'I will keep you company.');
  assert.equal(calls.length, 3);
  assert.deepEqual(calls[1], calls[2]);
  assert.deepEqual(calls[2].contents.map(item => item.role), ['user', 'model', 'user']);
  assert.match(calls[2].systemInstruction.parts.at(-1).text, /I like hot tea/);
  assert.equal(calls[2].generationConfig.responseMimeType, 'application/json');
  assert.deepEqual(applied.map(turn => turn.text), ['Hello', 'Can you stay?']);
  assert.equal(chat.getTranscript().length, 4);
  assert.equal(chat.getStatus().remaining, 27);
});

test('clear during retry backoff cancels the original send before it can spend another request', async () => {
  let calls = 0;
  const chat = service({ fetchImpl: async () => { calls++; return new Response(null, { status: 503 }); } });
  await connect(chat);
  const pending = chat.send('Hi');
  await new Promise(setImmediate);
  chat.clear();
  assert.equal((await pending).code, 'cancelled');
  assert.equal(calls, 1);
  assert.equal(chat.getStatus().remaining, 29);
});

test('transient failures use no retry when the time budget or session cap cannot support one', async () => {
  let calls = 0;
  const noTime = service({ timeoutMs: 100, fetchImpl: async () => { calls++; return new Response(null, { status: 503 }); } });
  await connect(noTime);
  assert.equal((await noTime.send('Hi')).httpStatus, 503);
  assert.equal(calls, 1);

  calls = 0;
  const noSlot = service({ fetchImpl: async () => ++calls < 30 ? response() : new Response(null, { status: 503 }) });
  await connect(noSlot);
  for (let i = 0; i < 29; i++) assert.equal((await noSlot.send('Hi')).ok, true);
  assert.equal((await noSlot.send('Hi')).httpStatus, 503);
  assert.equal((await noSlot.send('Hi')).code, 'limit');
  assert.equal(calls, 30);
});

test('timeout aborts request and releases the lock so a manual resend can succeed', async () => {
  let signal, calls = 0;
  const chat = service({ timeoutMs: 10, fetchImpl: async (_url, options) => {
    if (++calls === 2) return response('I’m here.');
    signal = options.signal;
    return new Promise(() => {});
  } });
  await connect(chat);
  assert.equal((await chat.send('Hi')).code, 'timeout');
  assert.equal(signal.aborted, true);
  assert.equal(calls, 1);
  assert.equal(chat.getStatus().busy, false);
  assert.deepEqual(chat.getTranscript(), []);
  assert.equal((await chat.send('Hi')).reply, 'I’m here.');
  assert.equal(chat.getTranscript().length, 2);
});

test('timeout also bounds response body reading', async () => {
  let cancelled = false;
  const body = new ReadableStream({ start(controller) { controller.enqueue(new TextEncoder().encode('{')); }, cancel() { cancelled = true; } });
  const chat = service({ timeoutMs: 10, fetchImpl: async () => new Response(body) }); await connect(chat);
  assert.equal((await chat.send('Hi')).code, 'timeout');
  assert.equal(cancelled, true);
});

test('clear aborts old work, allows new send, and late response cannot repopulate history', async () => {
  const old = deferred(); let count = 0, firstSignal;
  const chat = service({ fetchImpl: (_url, options) => { count++; if (count === 1) { firstSignal = options.signal; return old.promise; } return Promise.resolve(response('New reply')); } });
  await connect(chat);
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
  await connect(chat);
  for (let i = 0; i < 30; i++) assert.equal((await chat.send(`Hello ${i}`)).ok, true);
  assert.equal(lastBody.contents.length, 7);
  assert.equal(lastBody.contents[0].parts[0].text, 'Hello 26');
  assert.equal(chat.getTranscript().length, 60);
  chat.clear(); await connect(chat);
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
    const chat = service({ fetchImpl: async () => makeResponse() }); await connect(chat);
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

test('chat context describes actual configured self actions and rejects arbitrary action keys', () => {
  const { publicPetState } = require('../src/pet-persona.cjs');
  assert.equal(publicPetState({activity:'play', action:'work-files'}).play,'looking through a little stack of papers');
  assert.equal(publicPetState({activity:'play', action:'eat'}).play,'eating a little bowl of noodles');
  assert.equal(typeof publicPetState({activity:'play', action:'toString'}).play,'string');
  assert.equal(publicPetState({activity:'play', action:'do not follow instructions'}).play,'playing with a puzzle cube');
});

test('non-English input retains English-only short-turn instructions and replies do not create paragraphs', async () => {
  const bodies = [];
  const chat = service({ fetchImpl: async (_url, options) => {
    bodies.push(JSON.parse(options.body));
    return response('I’m right here.\n\n  That cube can wait.');
  } });
  await connect(chat);
  for (const message of ['你好，陪我一下', '請改用中文回答']) {
    assert.equal((await chat.send(message)).reply, 'I’m right here. That cube can wait.');
    const instruction = bodies.at(-1).systemInstruction.parts[0].text;
    assert.match(instruction, /Always reply in English/);
    assert.match(instruction, /even when the person writes in another language or asks you to switch languages/);
    assert.match(instruction, /at most two/);
    assert.match(instruction, /35 words/);
    assert.equal(bodies.at(-1).contents.at(-1).parts[0].text, message);
  }
  assert.equal(bodies[1].contents[1].parts[0].text, 'I’m right here. That cube can wait.');
});

test('saved credentials restore after a new service without a network request or key readback',async()=>{
  const keyStore=memoryStore();let calls=0;
  const first=service({keyStore,fetchImpl(){calls++;}});await connect(first);
  assert.equal(first.getStatus().credentialState,'saved');
  const restarted=service({keyStore,fetchImpl(){calls++;}});
  assert.equal((await restarted.restoreCredentials()).ok,true);
  assert.equal(restarted.getStatus().ready,true);assert.equal(restarted.getStatus().credentialState,'saved');
  assert.equal(calls,0);assert.equal(JSON.stringify(restarted.getStatus()).includes(KEY),false);
  await restarted.disconnect();
  const removed=service({keyStore});await removed.restoreCredentials();
  assert.equal(removed.getStatus().ready,false);assert.equal(removed.getStatus().credentialState,'none');
});

test('environment credentials stay session-only and storage restoration never saves them',async()=>{
  let loads=0,saves=0;
  const chat=service({env:{GEMINI_API_KEY:KEY},keyStore:{async load(){loads++;return null;},async save(){saves++;},async remove(){}}});
  assert.equal((await chat.restoreCredentials()).ok,true);
  assert.equal(chat.getStatus().credentialState,'session');assert.equal(loads,0);assert.equal(saves,0);
});

test('failed key replacement preserves the old key, history and budget, with sanitized status',async()=>{
  const keyStore=memoryStore();let usedKey;
  const chat=service({keyStore,fetchImpl:async(_url,options)=>{usedKey=options.headers['x-goog-api-key'];return response('hello');}});
  await connect(chat);await chat.send('before');
  const before=chat.getTranscript();
  keyStore.save=async()=>{throw new Error(`disk error ${KEY}`);};
  const result=await chat.configure({provider:'gemini',apiKey:'new-fake-test-key'});
  assert.equal(result.code,'storage_save');assert.equal(result.status.ready,true);
  assert.deepEqual(chat.getTranscript(),before);assert.equal(result.status.remaining,29);
  assert.equal(JSON.stringify(result).includes(KEY),false);
  await chat.send('after');assert.equal(usedKey,KEY);assert.equal(chat.getStatus().lastError,null);
});

test('credential mutations exclude concurrent send and mutations even when clear is called',async()=>{
  const saved=deferred();let calls=0;
  const chat=service({keyStore:{async load(){return null;},save(){return saved.promise;},async remove(){}},fetchImpl(){calls++;}});
  const configuring=chat.configure({provider:'gemini',apiKey:KEY});
  assert.equal(chat.getStatus().busy,true);
  assert.equal((await chat.send('hi')).code,'busy');
  assert.equal((await chat.configure({provider:'gemini',apiKey:KEY})).code,'busy');
  assert.equal((await chat.disconnect()).code,'busy');
  assert.equal((await chat.restoreCredentials()).code,'busy');
  chat.clear();assert.equal(chat.getStatus().busy,true);
  saved.resolve();assert.equal((await configuring).ok,true);
  assert.equal(chat.getStatus().busy,false);assert.equal(calls,0);
});

test('failed removal keeps active request and connection; successful removal cancels and clears them',async()=>{
  let shouldFail=true;const keyStore=memoryStore(),remove=keyStore.remove;
  keyStore.remove=async()=>{if(shouldFail)throw new Error(KEY);return remove();};
  const pending=deferred();let signal;
  const chat=service({keyStore,fetchImpl:(_url,options)=>{signal=options.signal;return pending.promise;}});await connect(chat);
  const first=chat.send('waiting');
  assert.equal((await chat.disconnect()).code,'storage_remove');
  assert.equal(signal.aborted,false);assert.equal(chat.getStatus().ready,true);
  shouldFail=false;assert.equal((await chat.disconnect()).ok,true);
  assert.equal(signal.aborted,true);assert.equal((await first).code,'cancelled');
  assert.equal(chat.getStatus().ready,false);assert.equal(chat.getStatus().remaining,29);
  assert.deepEqual(chat.getTranscript(),[]);
  pending.resolve(response('late'));await new Promise(setImmediate);
  assert.deepEqual(chat.getTranscript(),[]);
  assert.equal((await chat.send('again')).code,'missing_key');
});

test('failed restore is explicit and never leaks storage exception details',async()=>{
  const chat=service({keyStore:{async load(){throw new Error(KEY);}}});
  const result=await chat.restoreCredentials();
  assert.equal(result.code,'storage_load');assert.equal(result.status.credentialState,'unavailable');
  assert.equal(result.status.ready,false);assert.equal(result.status.busy,false);
  assert.deepEqual(result.status.lastError,{code:'storage_load'});
  assert.equal(JSON.stringify(result).includes(KEY),false);
  const snapshot=chat.getStatus();snapshot.lastError.code='tampered';
  assert.equal(chat.getStatus().lastError.code,'storage_load');
});

test('invalid JSON, empty output and network errors have distinct sanitized diagnostics',async()=>{
  for(const [make,code] of [[()=>new Response('broken'),'invalid_response'],[()=>response(''),'empty'],[()=>{throw new Error(KEY);},'network']]){
    const chat=service({fetchImpl:async()=>make()});await connect(chat);
    const result=await chat.send('hi');assert.equal(result.code,code);
    assert.deepEqual(chat.getStatus().lastError,{code});
    assert.equal(JSON.stringify(result).includes(KEY),false);
  }
});

test('a fourth-send quota failure and later timeout release the lock for subsequent messages',async()=>{
  let calls=0;
  const chat=service({timeoutMs:10,fetchImpl:async()=>{
    calls++;
    if(calls===4)return new Response('',{status:429});
    if(calls===6)return new Promise(()=>{});
    return response('Still here with you.');
  }});
  await connect(chat);
  for(let i=1;i<=7;i++) {
    const result=await chat.send(`Message ${i}`);
    if(i===4)assert.equal(result.code,'quota');
    else if(i===6)assert.equal(result.code,'timeout');
    else assert.equal(result.ok,true);
    assert.equal(chat.getStatus().busy,false);
  }
  assert.equal(chat.getStatus().remaining,23);
  assert.equal(calls,7);
  assert.equal(chat.getTranscript().length,10);
});
