'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createSpritePlayer } = require('../src/renderer/sprite-player.js');
require('../src/renderer/assets/red-panda/sprites.js');
const { clips, poses } = globalThis.RedPandaSprites;

function advanceUntil(player, clip) {
  for (let i = 0; i < 120 && player.frame().clip !== clip; i++) player.advance(50);
  assert.equal(player.frame().clip, clip);
}

test('all sprite clips use authored poses and seated transitions meet their loops', () => {
  for (const clip of Object.values(clips)) {
    for (const { pose, ms } of clip) {
      assert.ok(Object.hasOwn(poses, pose), pose);
      assert.ok(Number.isInteger(ms) && ms >= 50);
    }
  }
  for (const name of ['cube', 'cat', 'sleep', 'laptop']) {
    assert.equal(clips[name + 'Enter'][0].pose, 'idle');
    assert.equal(clips[name + 'Enter'].at(-1).pose, clips[name][0].pose);
    assert.equal(clips[name + 'Exit'][0].pose, clips[name][0].pose);
    assert.equal(clips[name + 'Exit'].at(-1).pose, 'idle');
  }
});

test('laptop opens once, loops while playing, then closes before the next activity', () => {
  const player = createSpritePlayer(clips);
  player.setLife({ activity: 'play', play: 'peek' });
  assert.equal(player.frame().clip, 'laptopEnter');
  advanceUntil(player, 'laptop');
  assert.deepEqual(player.frame(), { clip: 'laptop', pose: 'typingUp' });
  for (let i = 0; i < 8; i++) {
    player.setLife({ activity: 'play', play: 'peek' });
    player.advance(50);
  }
  assert.equal(player.frame().clip, 'laptop');
  assert.equal(player.frame(true).pose, 'typingUp');
  player.setLife({ activity: 'sleep' });
  advanceUntil(player, 'laptopExit');
  advanceUntil(player, 'sleepEnter');
  advanceUntil(player, 'sleep');
});

test('waking a sleeping pet plays its exit and then the requested wave', () => {
  const player = createSpritePlayer(clips);
  player.setLife({ activity: 'sleep' });
  advanceUntil(player, 'sleep');
  player.greet();
  player.setLife({ activity: 'idle' });
  advanceUntil(player, 'sleepExit');
  advanceUntil(player, 'wave');
  advanceUntil(player, 'idle');
});

test('rapid changes honor the latest play choice after a transition', () => {
  const player = createSpritePlayer(clips);
  player.setLife({ activity: 'play', play: 'ball' });
  player.advance(50);
  player.setLife({ activity: 'sleep' });
  player.setLife({ activity: 'play', play: 'bounce' });
  advanceUntil(player, 'catExit');
  advanceUntil(player, 'cubeEnter');
  advanceUntil(player, 'cube');
});
