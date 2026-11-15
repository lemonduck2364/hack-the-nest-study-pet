'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const vm = require('node:vm');
const geometry = require('../src/renderer/gaze.js');
const packs = require('../src/renderer/character-pack.js');
const reactions = require('../src/renderer/cursor-reaction.js');
const fixture = clip => new Uint8ClampedArray(zlib.inflateSync(fs.readFileSync(path.join(__dirname, 'fixtures/gaze', `${clip}.rgba.deflate`))));
function harness(clip='play-cat', time=4, initiallyReady=true) {
  const raw=fixture(clip),look=fixture('idle-0'),freezes=[],requests=[];
  let cursor,receiveLife,tick,output,clock=0,shown=clip,pending,source,ready=initiallyReady,active=clip;
  const rectangle={x:-55,y:31,width:330,height:185.625};
  const context2d={clearRect(){},drawImage(value){source=value;},
    getImageData(_x,_y,width,height){return {data:width===640 ? (source.clip==='attention-look'?look:raw).slice() : new Uint8ClampedArray(width*height*4).fill(255)};},
    putImageData(image){output=image.data.slice();}};
  const element=()=>({style:{},getContext:()=>context2d,getBoundingClientRect:()=>rectangle,addEventListener(){}});
  const bridge={diagnostic(){},setCaption(){},setMotionPending(){},setPointerInside(){},
    onLife(fn){receiveLife=fn;},onCursor(fn){cursor=fn;},initialState:()=>new Promise(()=>{})};
  const world={desktopPet:bridge,PetGaze:geometry,PetCharacterPacks:packs,PetCursorReaction:reactions,
    matchMedia:()=>({matches:false,addEventListener(){}}),addEventListener(){},
    PetAnimation:{createPlayer(config){return {start(){},request(){},freeze(value){freezes.push(value);},
      react(request){requests.push(request);pending=request.clip;return true;},cancelReaction(){shown=clip;pending=undefined;},
      draw(){if(ready)config.present({currentTime:shown==='attention-look'?0:time,clip:shown},shown);},
      current:()=>({clip:shown,time:shown==='attention-look'?0:time}),
      inspect:()=>({active:ready?active:undefined,reaction:shown!==clip?shown:undefined,reactionPending:pending,blocked:false})};}}};
  const sandbox={window:world,document:{getElementById:()=>element(),createElement:()=>element(),addEventListener(){},elementFromPoint:()=>null,
    body:{dataset:{},appendChild(){},classList:{add(){},remove(){}}}},Image:class{},ImageData:class{constructor(data){this.data=data;}},
    Uint8ClampedArray,requestAnimationFrame(fn){tick=fn;},Promise};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../src/renderer/pet.js'),'utf8'),sandbox);
  return {raw,look,freezes,requests,move(point){cursor(point);},life(state){receiveLife({activity:'play',gazeEnabled:true,...state});},
    step(count=1){for(let i=0;i<count;i++){clock+=50;tick(clock);}return output;},
    decoded(){ready=true;},active(value){active=value;},startLook(){shown='attention-look';pending=undefined;},finish(){shown=clip;pending=undefined;}};
}
for(const [clip,time] of [['play-cube',2],['play-cat',4]])test(`${clip}: normal activity stays pixel-identical near either cursor side while a reaction preloads`,()=>{
  const h=harness(clip,time);h.life({});h.step();
  h.move({x:-20,y:130});assert.deepEqual(h.step(20),h.raw);
  h.move({x:230,y:130});assert.deepEqual(h.step(20),h.raw);
  assert.equal(h.requests.length,1);assert.equal(h.requests[0].clip,'attention-look');
  assert.ok(h.freezes.every(value=>value===false),'proximity does not pause until the separate reaction is ready');
});
test('attention keeps following nearby eyes, restores the original activity on exit, and immediately permits reentry',()=>{
  const h=harness();h.life({});h.step();h.move({x:-20,y:130});h.step(4);h.startLook();
  const left=h.step(20).slice();h.move({x:230,y:130});const right=h.step(20).slice();assert.notDeepEqual(left,right);
  const regions=packs.dafeiyu.defaultEyeRegions;
  for(let y=0;y<360;y++)for(let x=0;x<640;x++){
    if(!regions.some(r=>x>=r.x&&x<r.x+r.width&&y>=r.y&&y<r.y+r.height))for(let c=0;c<4;c++){
      const i=(y*640+x)*4+c;assert.equal(left[i],h.look[i]);assert.equal(right[i],h.look[i]);
    }
  }
  h.step(140);assert.equal(h.requests.length,1,'remaining nearby does not select a special reaction');
  h.move({x:1000,y:130});assert.deepEqual(h.step(),h.raw);
  h.move({x:230,y:130});h.step(3);assert.equal(h.requests.length,2);assert.equal(h.requests[1].clip,'attention-look');
});
test('visible sleep entrance, loop and exit suppress proximity even if the next desired state is awake',()=>{
  for(const clip of ['sleep-start','sleep-loop','sleep-end']){
    const h=harness();h.active(clip);h.life({activity:'idle'});h.move({x:-20,y:130});h.step(100);
    assert.equal(h.requests.length,0);
  }
});
test('manual sleep, disabled cursor play and an open composer cancel attention and do not retrigger',()=>{
  for(const state of [{activity:'sleep',manualNap:true},{gazeEnabled:false},{cursorPlayAllowed:false}]){
    const h=harness();h.life({});h.step();h.move({x:-20,y:130});h.step(4);h.startLook();h.step();
    h.life(state);assert.deepEqual(h.step(20),h.raw);assert.equal(h.requests.length,1);
  }
});
test('proximity waits for the first decoded activity, then enters attention after the normal dwell',()=>{
  const h=harness('play-cat',4,false);h.life({});h.move({x:-20,y:130});h.step(40);
  assert.equal(h.requests.length,0);
  h.decoded();h.step(3);
  assert.equal(h.requests.length,1);assert.equal(h.requests[0].clip,'attention-look');
});
