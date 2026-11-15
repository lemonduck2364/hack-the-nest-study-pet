'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createAppearanceStore } = require('../src/appearance-store.cjs');
test('appearance persists separately, supports three skins and ignores malformed or unknown preferences', t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nest-appearance-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const store = createAppearanceStore(dir);
  assert.equal(store.load(), 'red-panda');
  store.save('red-panda');
  assert.equal(createAppearanceStore(dir).load(), 'red-panda');
  assert.throws(() => store.save('../arbitrary-source'));
  assert.equal(store.load(), 'red-panda');
  assert.deepEqual(fs.readdirSync(dir), ['appearance.json']);
  store.save('dafeiyu');
  assert.equal(createAppearanceStore(dir).load(), 'dafeiyu');
  for (const content of ['{', JSON.stringify({characterId:'../other'}), 'x'.repeat(2048)]) {
    fs.writeFileSync(path.join(dir, 'appearance.json'), content);
    assert.equal(store.load(), 'red-panda');
  }
});

test('model context describes the selected skin actual supported moment instead of invented prop animations', () => {
  const { publicPetState } = require('../src/pet-persona.cjs');
  const reading = publicPetState({characterId:'red-panda', activity:'play', action:'cube', energy:45});
  assert.equal(reading.appearance, 'red-panda');
  assert.match(reading.play, /read|book/i);
  assert.doesNotMatch(reading.play, /cube|noodle/i);
  const tea = publicPetState({characterId:'red-panda',activity:'play',action:'eat'});
  assert.match(tea.play, /tea/i);
  assert.equal(publicPetState({characterId:'unknown',activity:'play',action:'cube'}).play, 'playing with a puzzle cube');
  assert.equal(typeof publicPetState({characterId:'red-panda',activity:'constructor',action:'toString'}).currentMoment, 'string');
});

test('a skin change updates visual context while keeping the same conversation and dotted-key connection', async () => {
  const { createChatService } = require('../src/chat-service.cjs');
  let characterId='dafeiyu';const bodies=[];
  const chat=createChatService({env:{GEMINI_API_KEY:'AQ.synthetic-appearance-test-key'},
    getPetState:()=>({characterId,activity:'play',action:'cube',energy:55}),
    fetchImpl:async(_url,options)=>{
      bodies.push(JSON.parse(options.body));
      return new Response(JSON.stringify({candidates:[{finishReason:'STOP',content:{parts:[{text:'A quiet moment together.'}]}}]}));
    }});
  assert.equal((await chat.send('I like quiet mornings.')).ok,true);
  characterId='red-panda';
  assert.equal((await chat.send('Still here?')).ok,true);
  assert.equal(bodies[1].contents[0].parts[0].text,'I like quiet mornings.');
  assert.equal(bodies[1].contents[1].parts[0].text,'A quiet moment together.');
  assert.match(bodies[1].systemInstruction.parts[1].text,/reading a book/);
  assert.equal(chat.getStatus().ready,true);
  assert.equal(chat.getStatus().remaining,28);
});
