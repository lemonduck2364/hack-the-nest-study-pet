'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createLife } = require('../src/life.cjs');
const { gazeTarget } = require('../src/renderer/gaze.js');
function advance(life, seconds) { for (let i = 0; i < seconds * 4; i++) life.tick(.25); return life.snapshot(); }
test('without input, plays, tires, rests, sleeps, recovers and plays again', () => {
  const life = createLife(() => .4);
  const transitions = [life.snapshot().activity];
  let sleptAt, recovered;
  for (let i = 0; i < 600; i++) {
    const state = life.tick(.25);
    assert.ok(state.energy >= 0 && state.energy <= 100);
    if (transitions.at(-1) !== state.activity) transitions.push(state.activity);
    if (state.activity === 'sleep' && sleptAt === undefined) sleptAt = state.energy;
    if (sleptAt !== undefined && state.activity === 'play') { recovered = state.energy; break; }
  }
  assert.ok(transitions.includes('rest'));
  assert.ok(transitions.includes('sleep'));
  assert.equal(transitions.at(-1), 'play');
  assert.ok(recovered > sleptAt + 40);
});
test('play variants all selected through supplied randomness', () => {
  for (const [value, expected] of [[0,'bounce'], [.4,'peek'], [.8,'ball']]) {
    const life = createLife(() => value);
    assert.equal(advance(life, 5).play, expected);
  }
});
test('manual nap stays asleep after recovery; wake retains energy and allows activity', () => {
  const life = createLife(() => 0);
  advance(life, 12); life.nap(); advance(life, 120);
  assert.equal(life.snapshot().activity, 'sleep');
  assert.equal(life.snapshot().energy, 100);
  life.wake(); advance(life, 5);
  assert.equal(life.snapshot().activity, 'play');
  assert.ok(life.snapshot().energy < 100);
});
test('interaction wakes tired pet briefly without creating energy; it can rest again', () => {
  const life = createLife(() => 0);
  while (life.snapshot().activity !== 'rest') life.tick(.25);
  const energy = life.snapshot().energy;
  life.interact(); assert.equal(life.snapshot().energy, energy);
  advance(life, 7); assert.notEqual(life.snapshot().activity, 'rest');
  advance(life, 2); assert.equal(life.snapshot().activity, 'rest');
});
test('holding pauses life; release resumes without catching up', () => {
  const life = createLife(); life.setHeld(true); const before = life.snapshot();
  advance(life, 60); assert.deepEqual(life.snapshot(), before);
  life.setHeld(false); advance(life, 1); assert.ok(life.snapshot().age > before.age);
});
test('suspend gaps are bounded and invalid elapsed values cannot poison state', () => {
  const life = createLife(); const before = life.snapshot();
  for (const bad of [NaN,Infinity,-2,0]) life.tick(bad);
  assert.deepEqual(life.snapshot(), before);
  life.tick(3600); assert.equal(life.snapshot().age, 1);
  assert.ok(life.snapshot().energy > 79);
});
test('gaze follows direction inside relative radius and recenters outside or asleep', () => {
  const bounds = { x: 50, y: 90, width: 118, height: 116 };
  const point = { x: 250, y: 100 }; // Outside 220px window, still near pet.
  const gaze = gazeTarget(point, bounds);
  assert.ok(gaze.nearby && gaze.x > 0 && gaze.y < 0);
  assert.deepEqual(gazeTarget({x:1000,y:100},bounds), {x:0,y:0,nearby:false});
  assert.deepEqual(gazeTarget(point,bounds,false), {x:0,y:0,nearby:false});
  const scaled = gazeTarget({x:point.x*2,y:point.y*2}, Object.fromEntries(Object.entries(bounds).map(([k,v])=>[k,v*2])));
  assert.deepEqual(scaled,gaze);
  const translated = gazeTarget({x:point.x-2000,y:point.y+500}, {...bounds,x:bounds.x-2000,y:bounds.y+500});
  assert.ok(Math.abs(translated.x-gaze.x)<1e-12 && Math.abs(translated.y-gaze.y)<1e-12);
});
test('gaze is bounded and invalid dimensions are safe', () => {
  const bounds = {x:0,y:0,width:118,height:116};
  for (let x=-400;x<=400;x+=10) for(let y=-400;y<=400;y+=10) {
    const p=gazeTarget({x,y},bounds); assert.ok(Math.hypot(p.x,p.y)<=1.000001);
  }
  assert.deepEqual(gazeTarget({x:NaN,y:0},bounds),{x:0,y:0,nearby:false});
  assert.deepEqual(gazeTarget({x:0,y:0},{...bounds,width:0}),{x:0,y:0,nearby:false});
});
test('attention hysteresis rejects threshold jitter and exits immediately when disabled', () => {
  const { createAttentionGate } = require('../src/renderer/gaze.js');
  const gate = createAttentionGate();
  assert.equal(gate.update(2.9,true,50),false);
  assert.equal(gate.update(3.1,true,50),false);
  for (let i=0;i<3;i++) gate.update(2.9,true,50);
  assert.equal(gate.update(3.1,true,50),true);
  assert.equal(gate.update(3.3,true,50),true);
  for (let i=0;i<3;i++) assert.equal(gate.update(3.4,true,50),true);
  assert.equal(gate.update(3.4,true,50),false);
  for(let i=0;i<3;i++) gate.update(1,true,50);
  assert.equal(gate.update(1,false,1),false);
});
test('attention radius uses visible character width and gaze originates at the eyes', () => {
  const { normalizedDistance, characterBounds, faceAnchor } = require('../src/renderer/gaze.js');
  const scale=2;
  const bounds=Object.fromEntries(Object.entries(characterBounds).map(([k,v])=>[k,v*scale]));
  const focus={x:faceAnchor.x*scale,y:faceAnchor.y*scale};
  assert.equal(bounds.width,102);
  assert.equal(normalizedDistance({x:focus.x+3*bounds.width,y:focus.y},bounds,focus),3);
  assert.ok(gazeTarget({x:focus.x,y:focus.y-50},bounds,true,focus).y<0);
});
test('pixel gaze maps to eight whole-pixel directions and a neutral dead zone', () => {
  const { eyeDirection } = require('../src/renderer/gaze.js');
  assert.equal(eyeDirection({ x: -.25, y: .25 }), 'center');
  assert.equal(eyeDirection({ x: .7, y: .1 }), 'e');
  assert.equal(eyeDirection({ x: -.7, y: -.4 }), 'nw');
  assert.equal(eyeDirection({ x: .3, y: .3 }), 'se');
});
