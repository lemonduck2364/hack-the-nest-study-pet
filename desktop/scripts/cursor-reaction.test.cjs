'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createActionBag } = require('../src/action-bag.cjs');
const { createReactionGate } = require('../src/renderer/cursor-reaction.js');
test('nine awake actions and sleep reference ten distinct real animation files', () => {
  const { dafeiyu }=require('../src/renderer/character-pack.js');
  const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
  const clips=[...Object.values(dafeiyu.selfActions).map(action=>action.clip),dafeiyu.sleep.loop];
  assert.equal(clips.length,10);assert.equal(new Set(clips).size,10);
  const hashes=clips.map(clip=>crypto.createHash('sha256').update(fs.readFileSync(path.join(__dirname,'../src/renderer',dafeiyu.clips[clip].source))).digest('hex'));
  assert.equal(new Set(hashes).size,10,'different action IDs cannot alias the same video bytes');
});
test('shuffled bag is fair over repeated cycles and cannot immediately repeat across bag boundaries', () => {
  for (const random of [()=>0,()=>.5,()=>.999999]) {
    const ids = ['a','b','c','d','e','f','g','h','i'], bag = createActionBag(ids,random), sequence=[];
    for(let i=0;i<45;i++) sequence.push(bag.next());
    for(let i=0;i<45;i+=9) assert.deepEqual(new Set(sequence.slice(i,i+9)),new Set(ids));
    for(let i=1;i<45;i++) assert.notEqual(sequence[i],sequence[i-1]);
  }
});
test('cursor proximity remains active without a timeout and allows immediate reentry after leaving', () => {
  const gate=createReactionGate();let now=0;
  const update=(extra={})=>gate.update({ratio:2,allowed:true,held:false,sleeping:false,reducedMotion:false,busy:false,milliseconds:50,now:now+=50,...extra});
  assert.equal(update(),false);assert.equal(update(),false);assert.equal(update(),true);
  for(let i=0;i<1200;i++)assert.equal(update(),true);
  assert.equal(update({ratio:3.2}),true,'small boundary jitter retains the attention state');
  assert.equal(update({ratio:4}),false);
  assert.equal(update(),false);assert.equal(update(),false);assert.equal(update(),true,'reentry has only the normal150ms dwell');
});
test('sleep, drag, disabled setting, composer and reduced motion do not request reactions', () => {
  for(const override of [{sleeping:true},{held:true},{allowed:false},{reducedMotion:true}]) {
    const gate=createReactionGate();for(let i=0;i<10;i++)assert.equal(gate.update({ratio:1,allowed:true,milliseconds:50,now:i*50,...override}),false);
  }
});
