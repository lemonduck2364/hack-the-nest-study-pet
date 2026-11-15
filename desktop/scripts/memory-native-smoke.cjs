'use strict';

// Run this in two native Electron processes against a disposable test directory.
// Local responses exercise the chat adapter without using a real key or provider.
const { app, safeStorage } = require('electron');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { createCompanionMemory } = require('../src/companion-memory.cjs');
const { createChatService } = require('../src/chat-service.cjs');

const [mode, directory] = process.argv.slice(2);
const facts = ['I make mint tea for late reading', 'I like a quiet companion in the morning'];
const nextDrink = 'I switched to barley tea for late reading';
const text = facts.join('. ') + '.';
const reply = (words, edits = []) => new Response(JSON.stringify({
  candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify({ reply: words, edits }) }] } }],
}));

app.setName(require('../package.json').name);
app.whenReady().then(async () => {
  assert.ok(['seed', 'verify'].includes(mode));
  assert.ok(typeof directory === 'string'
    && path.dirname(path.resolve(directory)) === path.resolve(os.tmpdir())
    && path.basename(directory).startsWith('pet-memory-smoke-'));
  const memory = createCompanionMemory({ directory, safeStorage });
  await memory.restore();
  assert.equal(memory.snapshot().state, 'ready');
  const chatWith = (characterId, fetchImpl) => createChatService({
    env: { GEMINI_API_KEY: 'AQ.synthetic-pet-memory-smoke' },
    getMemory: () => memory,
    getPetState: () => ({ characterId }),
    fetchImpl,
  });

  if (mode === 'seed') {
    assert.deepEqual(memory.snapshot().entries, []);
    const chat = chatWith('red-panda', async () => reply('Cozy company sounds lovely.', facts.map(quote => ({ op: 'add', quote }))));
    assert.equal((await chat.send(text)).ok, true);
    assert.deepEqual(memory.snapshot().entries.map(({ quote }) => quote), facts);
    const filename = path.join(directory, 'memories.enc');
    const bytes = await fs.readFile(filename);
    assert.ok(facts.every(quote => !bytes.includes(Buffer.from(quote))));
    assert.equal((await fs.stat(filename)).mode & 0o777, 0o600);
    console.log('Native encrypted save passed for two synthetic memories.');
  } else {
    const entries = memory.snapshot().entries;
    assert.deepEqual(entries.map(({ quote }) => quote), facts);
    let calls = 0;
    const chat = chatWith('pixel-panda', async (_url, options) => {
      const body = JSON.parse(options.body);
      const context = body.systemInstruction.parts.map(({ text: part }) => part).join('\n');
      assert.ok(facts.every(quote => context.includes(quote)));
      assert.match(context, /"appearance":"pixel-panda"/);
      if (++calls === 1) {
        assert.equal(body.contents.length, 1, 'the reply uses saved memories, with no earlier chat turns');
        return reply('Mint tea for reading, and quiet company in the morning.');
      }
      return reply('Barley tea it is.', [{ op: 'replace', id: entries[0].id, quote: nextDrink }]);
    });
    assert.match((await chat.send('What are two things you remember about me?')).reply, /Mint tea.*quiet company/);
    assert.equal((await chat.send(nextDrink)).ok, true);
    const reopened = createCompanionMemory({ directory, safeStorage });
    await reopened.restore();
    assert.deepEqual(reopened.snapshot().entries.map(({ quote }) => quote), [facts[1], nextDrink]);
    console.log('Native cross-process restore, cross-appearance recall context, and memory correction passed.');
  }
  app.exit(0);
}).catch(error => {
  console.error('Native memory smoke failed: ' + (error?.code || error?.name || 'unknown error'));
  app.exit(1);
});
