'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const packs=require('../src/renderer/character-pack.js');
const geometry=require('../src/renderer/gaze.js');
const gates=require('../src/renderer/cursor-reaction.js');
function harness() {
  const actors=[],images=[],frames=[],captions=[],holds=[],hits=[];
  let life,cursor,tick,clock=0,source,resolveInitial,visibleMarker=0;
  const ctx={clearRect(){},drawImage(value){source=value;},getImageData(_x,_y,w,h){
    const data=new Uint8ClampedArray(w*h*4).fill(255);if(w===640){data[0]=source?.marker||0;data[1]=0;}
    else if(visibleMarker===22)data[(48*160+80)*4+3]=0;return {data};
  },putImageData(value){visibleMarker=value.data[0];frames.push(visibleMarker);}};
  const elements={pet:{addEventListener(){},setPointerCapture(){}},'character-frame':{style:{},getContext:()=>ctx,getBoundingClientRect:()=>({x:-55,y:31,width:330,height:185.625})}};
  function create(config) {
    const actor={config,disposed:false,desired:config.pack.initial,reaction:null,active:undefined,freezes:[],requests:[],
      start(){},request(clip){this.desired=clip;this.requests.push(clip);},freeze(value){this.freezes.push(value);},
      react({clip}){this.reaction=clip;return true;},cancelReaction(){this.reaction=null;},draw(){},
      inspect(){return {active:this.active,reaction:this.reaction,blocked:false};},current(){return this.active&&{clip:this.active,time:0};},
      dispose(){this.disposed=true;},paint(marker,clip=this.desired){const result=config.present({currentTime:0,marker},clip);if(result)this.active=clip;return result;}};
    actors.push(actor);return actor;
  }
  const bridge={diagnostic(){},setCaption(value){captions.push(value);},setMotionPending(value){holds.push(value);},setPointerInside(value){hits.push(value);},
    onLife(fn){life=fn;},onCursor(fn){cursor=fn;},initialState:()=>new Promise(resolve=>{resolveInitial=resolve;})};
  const world={desktopPet:bridge,PetGaze:geometry,PetCharacterPacks:packs,PetCursorReaction:gates,
    PetAnimation:{createPlayer:create},PetSprite:{createPlayer:create},matchMedia:()=>({matches:false,addEventListener(){}}),addEventListener(){}};
  const sandbox={window:world,document:{getElementById:id=>elements[id],createElement:()=>({getContext:()=>ctx}),addEventListener(){},elementFromPoint:()=>({closest:()=>true}),
    body:{dataset:{},appendChild(){},classList:{add(){},remove(){}}}},Image:class{constructor(){images.push(this);}},
    ImageData:class{constructor(data){this.data=data;}},Uint8ClampedArray,Promise,requestAnimationFrame(fn){tick=fn;}};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../src/renderer/pet.js'),'utf8'),sandbox);
  return {actors,images,frames,captions,holds,hits,publish(state){life({activity:'play',action:'cube',gazeEnabled:true,...state});},
    move(point){cursor(point);},step(count=1){for(let i=0;i<count;i++){clock+=50;tick(clock);}},resolveInitial};
}
test('switch disposes old actor, retains the visible frame until ready, rejects late old callbacks and uses selected anchors',()=>{
  const h=harness(),old=h.actors[0];h.publish({characterId:'dafeiyu'});old.paint(11,'idle');const poster=h.images[0];
  h.publish({characterId:'red-panda'});const panda=h.actors[1];
  assert.equal(old.disposed,true);assert.equal(panda.config.pack.id,'red-panda');assert.deepEqual(h.frames,[11]);
  assert.equal(old.paint(99,'play-cat'),false);assert.deepEqual(h.frames,[11]);
  panda.paint(22,'reading');poster.onload();assert.equal(h.frames.at(-1),22);
  assert.deepEqual(h.captions.at(-1).anchor,packs.redPanda.bubbleAnchor);
  h.publish({characterId:'dafeiyu'});assert.equal(panda.disposed,true);assert.equal(panda.paint(88,'reading'),false);
  h.actors[2].paint(33,'idle');assert.equal(h.frames.at(-1),33);
});
test('switch refreshes the alpha hit mask from the newly displayed character instead of the previous body',()=>{
  const h=harness();h.publish({characterId:'dafeiyu'});h.actors[0].paint(11,'idle');h.move({x:110,y:130});h.step();
  assert.equal(h.hits.at(-1),true);
  h.publish({characterId:'red-panda'});h.actors[1].paint(22,'reading');h.step();
  assert.equal(h.hits.at(-1),false,'the same cursor point is transparent in the replacement-frame mask');
});
test('initial red-panda state never starts the old poster and a stale initial snapshot cannot reverse a live skin choice',async()=>{
  const h=harness();assert.equal(h.images.length,0,'no default poster is fetched before authoritative state');
  h.publish({characterId:'red-panda'});h.actors[1].paint(22,'reading');
  h.resolveInitial({activity:'idle',characterId:'dafeiyu',gazeEnabled:true});await Promise.resolve();
  assert.equal(h.actors.length,2);assert.equal(h.actors[1].disposed,false);assert.equal(h.images.length,0);assert.equal(h.frames.at(-1),22);
});
test('switching skin preserves authoritative held state instead of playing the replacement actor',()=>{
  const h=harness();h.publish({characterId:'red-panda',held:true});
  assert.equal(h.actors[1].freezes.at(-1),true);
  h.actors[1].paint(22,'reading');h.move({x:110,y:130});h.step(20);assert.equal(h.actors[1].reaction,null);
});
test('switch while asleep preserves the authoritative life snapshot, maps same-character fallback and never starts attention',()=>{
  const h=harness();h.actors[0].paint(11,'idle');
  const state={characterId:'red-panda',activity:'sleep',manualNap:true,energy:17,age:9,action:'eat',gazeEnabled:true};
  const saved=structuredClone(state);h.publish(state);const panda=h.actors[1];
  assert.equal(panda.desired,'sleep-book');panda.paint(22);h.move({x:110,y:130});h.step(20);
  assert.equal(panda.reaction,null);assert.deepEqual(state,saved);
  assert.match(h.captions.at(-1).text,/book/);
});
test('awake resting book can enter attention; shared composer guard cancels it',()=>{
  const h=harness();h.publish({characterId:'red-panda',activity:'rest'});const panda=h.actors[1];panda.paint(22,'rest-book');
  h.move({x:110,y:130});h.step(4);assert.equal(panda.reaction,'attention-look');
  h.publish({characterId:'red-panda',activity:'rest',cursorPlayAllowed:false});assert.equal(panda.reaction,null);
  h.step(10);assert.equal(panda.reaction,null);assert.equal(h.actors.length,2);
});
