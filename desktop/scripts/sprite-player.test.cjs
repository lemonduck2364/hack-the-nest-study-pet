'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createPlayer } = require('../src/renderer/sprite-player.js');
const { redPanda, registry, resolvePack, activityClip, nextClip, actionDescription } = require('../src/renderer/character-pack.js');
const metadata = require('../src/renderer/assets/red-panda/geometry.json');
function harness({ usable = true } = {}) {
  let clock=0, image={}, canvas={getContext:()=>context};
  const draws=[],shown=[],errors=[];
  const context={clearRect(){},drawImage(...args){draws.push(args);}};
  const player=createPlayer({pack:redPanda,makeImage:()=>image,makeCanvas:()=>canvas,now:()=>clock,
    present(source,clip){if(usable)shown.push({source,clip});return usable;},report(kind,clip){errors.push({kind,clip});}});
  return {player,image,draws,shown,errors,ready(){image.onload();},advance(ms){clock+=ms;player.draw();}};
}
test('pack registry defaults safely and every activity maps to an actual selected-pack pose',()=>{
  assert.equal(resolvePack('missing'),registry.dafeiyu);assert.equal(resolvePack('red-panda'),redPanda);
  assert.equal(activityClip(redPanda,{activity:'play',action:'cube'}),'reading');
  assert.equal(activityClip(redPanda,{activity:'play',action:'eat'}),'tea');
  assert.notEqual(activityClip(redPanda,{activity:'rest'}),activityClip(redPanda,{activity:'sleep'}));
  assert.match(actionDescription(redPanda,{activity:'sleep'}),/book/);
  for(const pack of Object.values(registry))for(const active of Object.keys(pack.clips))for(const desired of Object.keys(pack.clips)) {
    assert.ok(pack.clips[nextClip(pack,active,desired)],`${pack.id}: ${active} → ${desired}`);
  }
});
test('original atlas crops match inspected metadata and all poses share head/ground anchors',()=>{
  for(const [id,pose] of Object.entries(redPanda.sprites)) {
    const original=metadata.poses[id];
    assert.deepEqual(pose.crop,Object.values(original.sourceRect));
    assert.deepEqual(pose.destination,Object.values(original.destinationRect));
    assert.equal(pose.destination[1],63);assert.equal(pose.destination[1]+pose.destination[3],330);
    assert.ok(Math.abs(pose.destination[0]+pose.destination[2]/2-320)<.000001);
  }
  assert.deepEqual(redPanda.defaultEyeRegions,metadata.poses.book.eyes.map(eye=>eye.frameRect));
});
test('sprite waits for decoded atlas and normalizes the exact book crop before presenting',()=>{
  const h=harness();h.player.start();h.player.draw();assert.equal(h.shown.length,0);
  h.ready();assert.equal(h.player.current().clip,'reading');
  assert.deepEqual(h.draws[0].slice(1),[...redPanda.sprites.book.crop,...redPanda.sprites.book.destination]);
  h.player.request('tea');assert.equal(h.player.current().clip,'tea');
  assert.deepEqual(h.draws.at(-1).slice(1),[...redPanda.sprites.tea.crop,...redPanda.sprites.tea.destination]);
});
test('sustained book attention keeps the body crop and resumes the prior pose without resetting it',()=>{
  const h=harness();h.player.start();h.ready();const initialDraws=h.draws.length;
  assert.equal(h.player.react(redPanda.reactions[0]),true);h.advance(60000);
  assert.equal(h.player.current().clip,'attention-look');assert.equal(h.draws.length,initialDraws,'same book body is not replaced');
  h.player.cancelReaction();assert.equal(h.player.current().clip,'reading');assert.equal(h.draws.length,initialDraws);
  h.player.request('tea');h.player.react(redPanda.reactions[0]);h.player.cancelReaction();
  assert.equal(h.player.current().clip,'tea','the interruption returns to the actual previous pose');
});
test('held state defers pose changes, reduced motion permits a new still, and sleep stays same-character fallback',()=>{
  const h=harness();h.player.start();h.ready();h.player.freeze(true);h.player.request('tea');h.player.draw();
  assert.equal(h.player.current().clip,'reading');assert.equal(h.player.react(redPanda.reactions[0]),false);
  h.player.freeze(false);assert.equal(h.player.current().clip,'tea');
  h.player.freeze(true,true);h.player.request('sleep-book');assert.equal(h.player.current().clip,'sleep-book');
  assert.equal(redPanda.clips['sleep-book'].sprite,'book');assert.equal(redPanda.clips['sleep-book'].fallback,true);
});
test('unusable presented frame and stalled atlas loading release the lifecycle guard',()=>{
  const rejected=harness({usable:false});rejected.player.start();rejected.ready();
  assert.equal(rejected.player.inspect().blocked,true);assert.equal(rejected.shown.length,0);
  const stalled=harness();stalled.player.start();stalled.advance(5001);
  assert.equal(stalled.player.inspect().blocked,true);assert.equal(stalled.shown.length,0);
});
test('dispose prevents late atlas callbacks and further draws from replacing the new character',()=>{
  const h=harness();h.player.start();const late=h.image.onload;h.player.dispose();late();h.player.draw();h.player.request('tea');
  assert.equal(h.shown.length,0);assert.equal(h.image.onload,null);assert.equal(h.image.onerror,null);
});
