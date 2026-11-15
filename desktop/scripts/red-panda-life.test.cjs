'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createLife } = require('../src/life.cjs');
const { redPanda, activityClip } = require('../src/renderer/character-pack.js');
const { publicPetState } = require('../src/pet-persona.cjs');

test('red panda shows its daily poses through the unassisted life cycle', () => {
  const life = createLife(() => .5);
  const visible = new Set();
  const playClips = new Set();
  for (let tick = 0; tick < 240; tick++) {
    const state = life.tick(1);
    const clip = activityClip(redPanda, state);
    assert.ok(redPanda.sprites[redPanda.clips[clip].sprite]);
    visible.add(clip);
    if (state.activity === 'play') playClips.add(clip);
  }
  assert.deepEqual(visible, new Set(['reading', 'tea', 'quiet-rest', 'sleep']));
  assert.deepEqual(playClips, new Set(['reading', 'tea', 'quiet-rest']));
});

test('red panda captions and chat context describe the visible daily poses', () => {
  const cases = [
    [{ activity: 'idle' }, /reading a book/, /page/],
    [{ activity: 'play', action: 'eat' }, /cup of tea/, /tea break/],
    [{ activity: 'play', action: 'violin' }, /eyes closed/, /quiet moment/],
    [{ activity: 'rest' }, /eyes closed/, /quiet moment/],
    [{ activity: 'sleep' }, /curled up asleep/, /curled up for a nap/]
  ];
  for (const [state, moment, caption] of cases) {
    const clip = activityClip(redPanda, state);
    assert.match(redPanda.captions[clip].text, caption);
    assert.match(publicPetState({ ...state, characterId: redPanda.id }).currentMoment, moment);
  }
});
