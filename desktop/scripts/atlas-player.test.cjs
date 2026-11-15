'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { pixelPanda, activityClip, actionDescription } = require('../src/renderer/character-pack.js');
const { createPlayer } = require('../src/renderer/atlas-player.js');

function fixture(initial) {
  let time = 0;
  let calls = [];
  const frames = [];
  const reports = [];
  const image = {};
  const canvas = { getContext: () => ({
    clearRect() { calls = []; },
    drawImage(_image, ...coords) { calls.push(coords); },
  }) };
  const player = createPlayer({
    pack: pixelPanda, makeImage: () => image, makeCanvas: () => canvas, now: () => time,
    present: (_, clip) => { frames.push({ clip, calls: [...calls] }); return true; },
    report: (kind, clip) => reports.push({ kind, clip }),
  });
  player.request(initial || pixelPanda.initial);
  player.start();
  image.onload();
  player.draw();
  function step(ms) {
    for (let left = ms; left > 0;) {
      const size = Math.min(left, 10);
      time += size;
      player.draw();
      left -= size;
    }
  }
  return { player, step, frames, reports, image };
}

test('pixel atlas consumes the authored action entrances and exits in order', () => {
  const { player, step, reports, frames } = fixture();
  player.request('cube');
  assert.equal(player.inspect().active, 'cubeEnter');
  step(410);
  assert.equal(player.inspect().active, 'cubeEnter');
  step(20);
  assert.equal(player.inspect().active, 'cube');
  // Requests can repeat while the desktop main process publishes life.
  player.request('cube');
  step(480);
  assert.equal(player.current().frame, 21);
  player.request('laptop');
  step(300);
  assert.equal(player.inspect().active, 'cubeExit');
  step(600);
  assert.equal(player.inspect().active, 'laptopEnter');
  step(1300);
  assert.equal(player.inspect().active, 'laptop');
  player.request('rest');
  step(1600);
  assert.equal(player.inspect().active, 'rest');
  player.request('sleep', { immediate: true });
  step(950);
  assert.equal(player.inspect().active, 'sleep');
  player.request('idle');
  step(1500);
  assert.equal(player.inspect().active, 'idle');
  assert.deepEqual(reports.filter(item => item.kind === 'clip-visible').map(item => item.clip),
    ['idle', 'cubeEnter', 'cube', 'cubeExit', 'laptopEnter', 'laptop', 'laptopExit', 'rest', 'sleepEnter', 'sleep', 'sleepExit', 'idle']);
  for (const { calls } of frames) {
    assert.deepEqual(calls[0].slice(4), [202, 93, 234, 246], 'every frame uses the same pixel scale and ground');
  }
});

test('rapid attention changes replace eyes on the active seated frame without restarting it', () => {
  const { player, step, frames, reports } = fixture('cat');
  step(750);
  assert.equal(player.inspect().active, 'cat');
  const firstFrame = player.current().frame;
  assert.equal(player.react({ clip: 'attention-look' }), true);
  player.setGaze({ x: -1, y: -1 });
  step(15);
  const left = frames.at(-1);
  assert.equal(left.clip, 'attention-look');
  assert.equal(left.calls.length, 2);
  assert.deepEqual(left.calls[1].slice(4), [307, 195, 57, 18], 'eye patch is aligned to the seated face');
  player.setGaze({ x: 1, y: 1 });
  step(15);
  assert.notDeepEqual(frames.at(-1).calls[1].slice(0, 2), left.calls[1].slice(0, 2));
  player.cancelReaction();
  assert.equal(player.current().frame, firstFrame);
  assert.equal(frames.at(-1).calls.length, 1, 'departing restores the exact active pose');
  assert.equal(player.react({ clip: 'attention-look' }), true);
  step(270);
  assert.notEqual(player.current().frame, firstFrame, 'underlying frames keep moving during long attention');
  assert.equal(reports.filter(item => item.kind === 'clip-visible' && item.clip === 'cat').length, 1);
  player.request('sleep', { immediate: true });
  assert.equal(player.inspect().reaction, undefined);
  assert.equal(player.react({ clip: 'attention-look' }), false);
  step(1800);
  assert.equal(player.inspect().active, 'sleep');
  assert.equal(player.react({ clip: 'attention-look' }), false);
});

test('drag freeze and reduced motion keep the last pose and never jump forward in time', () => {
  const { player, step } = fixture();
  step(260);
  player.freeze(true);
  const still = player.current();
  step(2000);
  assert.deepEqual(player.current(), still);
  player.freeze(false);
  step(20);
  assert.equal(player.current().frame, still.frame);
  player.freeze(true, true);
  player.request('sleep');
  assert.equal(player.inspect().active, 'sleep');
  const reduced = player.current();
  step(1500);
  assert.deepEqual(player.current(), reduced);
  player.freeze(false);
  player.request('idle');
  step(1350);
  assert.equal(player.inspect().active, 'idle');
});

test('pixel panda captions and model context describe assets present in the atlas', () => {
  const state = { activity: 'play', action: 'work-laptop' };
  assert.equal(activityClip(pixelPanda, state), 'laptop');
  assert.match(actionDescription(pixelPanda, state), /typing/);
  assert.match(pixelPanda.captions.laptop.text, /tap tap/);
  const { atlas } = pixelPanda;
  assert.equal(atlas.count, 82);
  for (const track of Object.values(atlas.tracks)) {
    assert.ok(track.every(([index, duration]) => index >= 0 && index < atlas.count && duration > 0));
  }
});
