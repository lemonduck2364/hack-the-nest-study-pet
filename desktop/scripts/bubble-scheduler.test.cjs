'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createBubbleScheduler, readingMs, FADE_MS, MAX_SPEECH_MS } = require('../src/bubble-scheduler.cjs');
function setup() {
  let time=0, id=0;
  const timers=new Map(), scheduled=[], events=[];
  const schedule=(fn,delay)=>{const key=++id;timers.set(key,{fn,at:time+delay});scheduled.push(fn);return key;};
  const bubble=createBubbleScheduler({now:()=>time,setTimer:schedule,clearTimer:key=>timers.delete(key),onChange:value=>events.push(value)});
  function tick(ms) {
    const end=time+ms;
    while(true) {
      const next=[...timers].filter(([,t])=>t.at<=end).sort((a,b)=>a[1].at-b[1].at)[0];
      if(!next)break;
      const [key,timer]=next;time=timer.at;timers.delete(key);timer.fn();
    }
    time=end;
  }
  return {bubble,tick,scheduled,events};
}
test('unchanged thoughts do not refresh dwell and expired content stays hidden',()=>{
  const {bubble,tick}=setup();
  bubble.caption({kind:'thought',text:'a quiet moment'});
  const serial=bubble.snapshot().serial;
  tick(4000);assert.equal(bubble.caption({kind:'thought',text:'a quiet moment'}),false);
  tick(1500);assert.equal(bubble.snapshot().phase,'fading');
  tick(FADE_MS);assert.equal(bubble.snapshot().phase,'hidden');
  assert.equal(bubble.caption({kind:'thought',text:'a quiet moment'}),false);
  assert.equal(bubble.snapshot().serial,serial);
  tick(60000);assert.equal(bubble.snapshot().phase,'hidden');
});
test('actions have finite dwell and a real new caption can appear afterwards',()=>{
  const {bubble,tick}=setup();bubble.caption({kind:'action',text:'playing'});
  tick(4500);assert.equal(bubble.snapshot().phase,'fading');tick(FADE_MS);
  assert.equal(bubble.snapshot().phase,'hidden');
  bubble.caption({kind:'action',text:'resting'});assert.equal(bubble.snapshot().phase,'visible');
  assert.equal(bubble.snapshot().text,'resting');
});
test('speech expires, releases priority and resumes the latest thought exactly once',()=>{
  const {bubble,tick}=setup();bubble.caption({kind:'thought',text:'old'});bubble.speak('hello',true);
  bubble.caption({kind:'action',text:'intermediate'});bubble.caption({kind:'thought',text:'latest'});
  tick(3000);assert.equal(bubble.snapshot().kind,'speech');assert.equal(bubble.snapshot().phase,'fading');
  tick(FADE_MS);assert.equal(bubble.snapshot().text,'latest');assert.equal(bubble.snapshot().phase,'visible');
  tick(5500+FADE_MS);assert.equal(bubble.snapshot().phase,'hidden');
  tick(60000);assert.equal(bubble.snapshot().phase,'hidden');
});
test('stale expiry and fade callbacks cannot hide a newer bubble',()=>{
  const {bubble,tick,scheduled}=setup();bubble.speak('first',true);
  const oldExpiry=scheduled.at(-1);tick(3000);const oldFade=scheduled.at(-1);
  bubble.speak('second',true);const next=bubble.snapshot();
  oldExpiry();oldFade();assert.deepEqual(bubble.snapshot(),next);
  tick(3000+FADE_MS);assert.equal(bubble.snapshot().phase,'hidden');
});
test('page interaction grants reading time with a hard lifetime; old-page timers are inert',()=>{
  const {bubble,tick,scheduled}=setup();bubble.speak('x'.repeat(100),true);
  const serial=bubble.snapshot().serial, oldTimer=scheduled.at(-1);
  tick(5000);assert.equal(bubble.pageChanged(serial,1,200),true);
  oldTimer();assert.equal(bubble.snapshot().phase,'visible');
  assert.equal(bubble.pageChanged(serial-1,2,200),false);
  assert.equal(bubble.pageChanged(serial,1,200),false);
  tick(10000);assert.equal(bubble.snapshot().phase,'visible');
  bubble.pageChanged(serial,2,300);tick(10000);bubble.pageChanged(serial,3,300);
  tick(MAX_SPEECH_MS-25000);assert.equal(bubble.snapshot().phase,'fading');
  assert.equal(bubble.pageChanged(serial,4,300),false);
  tick(FADE_MS);assert.equal(bubble.snapshot().phase,'hidden');
});
test('tap greetings do not interrupt a reply, but dismissal and subsequent new speech work',()=>{
  const {bubble,tick}=setup();bubble.speak('a reply',true);
  const serial=bubble.snapshot().serial;
  assert.equal(bubble.speak('oh hello',false),false);
  assert.equal(bubble.dismiss(serial-1),false);
  assert.equal(bubble.dismiss(serial),true);tick(FADE_MS);
  assert.equal(bubble.snapshot().phase,'hidden');
  assert.equal(bubble.speak('oh hello',false),true);
  assert.equal(bubble.pageChanged(bubble.snapshot().serial,1,300),false,'a greeting cannot extend its two-second dwell');
  tick(1999);assert.equal(bubble.snapshot().phase,'visible');
  tick(1);assert.equal(bubble.snapshot().phase,'fading');
  tick(FADE_MS);assert.equal(bubble.snapshot().phase,'hidden');
});
test('phase versions make late initial snapshots distinguishable from newer fade events',()=>{
  const {bubble,tick}=setup();bubble.speak('hello',true);
  const first=bubble.snapshot();tick(3000);const fading=bubble.snapshot();tick(FADE_MS);const hidden=bubble.snapshot();
  assert.equal(first.serial,fading.serial);assert.equal(fading.serial,hidden.serial);
  assert.ok(first.version<fading.version&&fading.version<hidden.version);
});
test('a caption received during speech fade is the one resumed; caption fade can be replaced safely',()=>{
  const {bubble,tick,scheduled}=setup();
  bubble.caption({kind:'thought',text:'before'});bubble.speak('hello',true);tick(3000);
  bubble.caption({kind:'action',text:'after speech'});tick(FADE_MS);
  assert.equal(bubble.snapshot().text,'after speech');
  tick(4500);const oldFade=scheduled.at(-1);
  bubble.caption({kind:'thought',text:'new thought'});oldFade();
  assert.equal(bubble.snapshot().text,'new thought');assert.equal(bubble.snapshot().phase,'visible');
  tick(5500+FADE_MS);assert.equal(bubble.snapshot().phase,'hidden');
});

test('model reply reading time scales from three to twelve seconds',()=>{
  assert.equal(readingMs(9),3000);
  assert.ok(readingMs(100)>readingMs(9));
  assert.ok(readingMs(200)>readingMs(100));
  assert.equal(readingMs(4000),12000);
  for(const text of ['hi', 'x'.repeat(100), 'x'.repeat(4000)]){
    const {bubble,tick}=setup();bubble.speak(text,true);
    tick(readingMs(text.length)-1);assert.equal(bubble.snapshot().phase,'visible');
    tick(1);assert.equal(bubble.snapshot().phase,'fading');
    tick(FADE_MS);assert.equal(bubble.snapshot().phase,'hidden');
  }
});
