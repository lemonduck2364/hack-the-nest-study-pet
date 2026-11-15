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
  assert.match(actionDescription(redPanda,{activity:'sleep'}),/asleep/);
  for(const pack of Object.values(registry))for(const active of Object.keys(pack.clips))for(const desired of Object.keys(pack.clips)) {
    assert.ok(pack.clips[nextClip(pack,active,desired)],`${pack.id}: ${active} → ${desired}`);
  }
});
test('original atlas crops match inspected metadata and all poses share the ground anchor',()=>{
  for(const [id,original] of Object.entries(metadata.poses)) {
    const pose=redPanda.sprites[id];
    assert.deepEqual(pose.crop,Object.values(original.sourceRect));
    assert.deepEqual(pose.destination,Object.values(original.destinationRect));
  }
  for(const pose of Object.values(redPanda.sprites)) {
    assert.ok(Math.abs(pose.destination[1]+pose.destination[3]-330)<.000001);
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
test('sustained standing attention pauses either autonomous pose and restores its original crop',()=>{
  const h=harness();h.player.start();h.ready();
  const expectedCrop=pose=>[...pose.crop,...pose.destination];
  for(const clip of ['reading','tea']) {
    h.player.request(clip);
    assert.equal(h.player.react(redPanda.reactions[0]),true);h.advance(60000);
    assert.equal(h.player.current().clip,'attention-look');
    assert.equal(h.player.inspect().active,clip);
    assert.deepEqual(h.draws.at(-1).slice(1),expectedCrop(redPanda.sprites.wave));
    h.player.cancelReaction();assert.equal(h.player.current().clip,clip);
    assert.deepEqual(h.draws.at(-1).slice(1),expectedCrop(redPanda.sprites[redPanda.clips[clip].sprite]));
  }
});
test('held state defers pose changes, reduced motion permits a new still, and sleep disallows attention',()=>{
  const h=harness();h.player.start();h.ready();h.player.freeze(true);h.player.request('tea');h.player.draw();
  assert.equal(h.player.current().clip,'reading');assert.equal(h.player.react(redPanda.reactions[0]),false);
  h.player.freeze(false);assert.equal(h.player.current().clip,'tea');
  h.player.freeze(true,true);h.player.request(redPanda.sleep.loop);assert.equal(h.player.current().clip,redPanda.sleep.loop);
  h.player.freeze(false);assert.equal(h.player.react(redPanda.reactions[0]),false);
  assert.equal(h.player.current().clip,redPanda.sleep.loop);
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
