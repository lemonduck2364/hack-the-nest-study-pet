'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
function harness(overrides={}) {
  const elements=new Map();
  const element=()=>({value:'',hidden:false,events:{},textContent:'',
    addEventListener(name,fn){this.events[name]=fn;},focus(){},getBoundingClientRect(){return {height:96};}});
  const document={getElementById(id){if(!elements.has(id))elements.set(id,element());return elements.get(id);},addEventListener(){}};
  let publish,clear,closed=0;
  const fresh={status:{ready:true,busy:false,remaining:29}};
  const api={onChatState(fn){publish=fn;},onChatOpened(){},onConversationCleared(fn){clear=fn;},
    chatState(){return Promise.resolve(fresh);},sendChat(){return Promise.resolve({ok:true,reply:'hi'});},
    closeChat(){closed++;},resizeComposer(){},openConnection(){},...overrides};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../src/renderer/chat.js'),'utf8'),{window:{desktopPet:api},document});
  return {elements,publish:(v)=>publish(v),clear:()=>clear(),closed:()=>closed,fresh};
}
test('clear while a final status snapshot is pending cannot restore stale busy state',async()=>{
  let calls=0,resolveOld;
  const stale=new Promise(resolve=>{resolveOld=resolve;});
  const fresh={status:{ready:true,busy:false,remaining:29}};
  const h=harness({chatState(){return ++calls===1?Promise.resolve(fresh):stale;}});
  await new Promise(setImmediate);
  h.elements.get('message').value='hello';
  const sent=h.elements.get('composer').events.submit({preventDefault(){}});
  await new Promise(setImmediate);assert.equal(calls,2);
  h.clear();h.elements.get('message').value='new thought';h.publish(fresh);
  resolveOld({status:{ready:true,busy:true,remaining:28}});await sent;
  assert.equal(h.elements.get('waiting').hidden,true);
  assert.equal(h.elements.get('send').disabled,false);
});
test('a late reply does not hide a new draft the user has started',async()=>{
  let finish;const pending=new Promise(resolve=>{finish=resolve;});
  const h=harness({sendChat(){return pending;}});await new Promise(setImmediate);
  h.elements.get('message').value='first thought';
  const sent=h.elements.get('composer').events.submit({preventDefault(){}});
  h.elements.get('message').value='a second thought';
  finish({ok:true,reply:'hello'});await sent;
  assert.equal(h.closed(),0);assert.equal(h.elements.get('message').value,'a second thought');
});
test('completed original draft closes the tiny composer, with no transcript rendering',async()=>{
  const h=harness();await new Promise(setImmediate);h.elements.get('message').value='hello';
  await h.elements.get('composer').events.submit({preventDefault(){}});
  assert.equal(h.closed(),1);assert.equal(h.elements.get('message').value,'');
  assert.equal(h.elements.has('messages'),false);
});
test('an exhausted session explains the unavailable send arrow without a quota dashboard',async()=>{
  const h=harness();await new Promise(setImmediate);
  h.publish({status:{ready:true,busy:false,remaining:0}});
  assert.equal(h.elements.get('send').disabled,true);
  assert.match(h.elements.get('chat-error').textContent,/reopen the pet/);
  h.clear();
  assert.match(h.elements.get('chat-error').textContent,/reopen the pet/);
  assert.equal(h.elements.get('send').disabled,true);
});
