'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const ComposerLines=require('../src/renderer/composer-lines.js');
function harness(overrides={}) {
  const elements=new Map(),timers=new Map(),scheduled=[];let now=0,timerId=0;
  const setTimer=(fn,delay)=>{const id=++timerId;timers.set(id,{fn,at:now+delay});scheduled.push(fn);return id;};
  function tick(ms){const end=now+ms;while(true){const next=[...timers].filter(([,t])=>t.at<=end).sort((a,b)=>a[1].at-b[1].at)[0];if(!next)break;const [id,t]=next;now=t.at;timers.delete(id);t.fn();}now=end;}
  const element=()=>({value:'',hidden:false,events:{},textContent:'',attributes:{},setAttribute(name,value){this.attributes[name]=value;},
    addEventListener(name,fn){this.events[name]=fn;},focus(){},getBoundingClientRect(){return {height:96};}});
  const document={body:{dataset:{}},getElementById(id){if(!elements.has(id))elements.set(id,element());return elements.get(id);},addEventListener(){}};
  let publish,clear,opened,presence,closed=0;
  const fresh={status:{ready:true,busy:false,remaining:29}};
  const api={onChatState(fn){publish=fn;},onChatOpened(fn){opened=fn;},onComposerPresence(fn){presence=fn;},onConversationCleared(fn){clear=fn;},
    chatState(){return Promise.resolve(fresh);},sendChat(){return Promise.resolve({ok:true,reply:'hi'});},
    closeChat(){closed++;},resizeComposer(){},openConnection(){},...overrides};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../src/renderer/chat.js'),'utf8'),{window:{desktopPet:api,ComposerLines},document,Date:{now:()=>now},setTimeout:setTimer,clearTimeout:id=>timers.delete(id)});
  return {elements,document,tick,scheduled,opened:()=>opened(),presence:inside=>presence({inside}),publish:(v)=>publish(v),clear:()=>clear(),closed:()=>closed,fresh};
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
test('only explicit line breaks grow the input; long single lines stay compact',async()=>{
  const h=harness();await new Promise(setImmediate);const input=h.elements.get('message');
  assert.equal(input.rows,1);
  input.value='a very long sentence '.repeat(45);input.events.input();assert.equal(input.rows,1);
  input.value='first\nsecond\nthird';input.events.input();assert.equal(input.rows,3);
  input.value='line\n'.repeat(12);input.events.input();assert.equal(input.rows,5);
  input.value='one line again';input.events.input();assert.equal(input.rows,1);
  assert.equal(ComposerLines.visibleLines('a\r\nb\rc'),3);
});
test('successful send resets multiline height, but preserves a later multiline draft',async()=>{
  const h=harness();await new Promise(setImmediate);const input=h.elements.get('message');
  input.value='first\nsecond';input.events.input();assert.equal(input.rows,2);
  await h.elements.get('composer').events.submit({preventDefault(){}});assert.equal(input.rows,1);
  let finish;const pending=new Promise(resolve=>{finish=resolve;});
  const next=harness({sendChat(){return pending;}});await new Promise(setImmediate);
  const draft=next.elements.get('message');draft.value='old';
  const sent=next.elements.get('composer').events.submit({preventDefault(){}});
  draft.value='new\nmultiline';draft.events.input();finish({ok:true,reply:'hi'});await sent;
  assert.equal(draft.rows,2);assert.equal(draft.value,'new\nmultiline');assert.equal(next.closed(),0);
});
test('Shift+Enter and IME composition do not submit; ordinary Enter does',async()=>{
  let calls=0;const h=harness({sendChat(){calls++;return Promise.resolve({ok:true,reply:'hi'});}});await new Promise(setImmediate);
  const input=h.elements.get('message');input.value='hello';let prevented=0;
  const key=extra=>({key:'Enter',preventDefault(){prevented++;},...extra});
  input.events.keydown(key({shiftKey:true}));
  input.events.compositionstart();input.events.keydown(key({}));input.events.compositionend();
  input.events.keydown(key({isComposing:true}));input.events.keydown(key({keyCode:229}));
  assert.equal(calls,0);assert.equal(prevented,0);
  input.events.keydown(key({}));await new Promise(setImmediate);assert.equal(calls,1);assert.equal(prevented,1);
});

test('send failures explain quota, local budget, network, timeout and provider errors without losing drafts',async()=>{
  const cases={quota:/quota or rate limit/,limit:/30-send limit/,network:/internet connection/,timeout:/too long/,provider:/temporarily unavailable/,empty:/no usable reply/,invalid_response:/unreadable reply/};
  const messages=new Set();
  for(const [code,expected] of Object.entries(cases)){
    const h=harness({sendChat(){return Promise.resolve({ok:false,code});}});await new Promise(setImmediate);
    h.elements.get('message').value='please keep this draft';
    await h.elements.get('composer').events.submit({preventDefault(){}});
    const message=h.elements.get('chat-error').textContent;
    assert.match(message,expected);messages.add(message);
    assert.equal(h.elements.get('message').value,'please keep this draft');assert.equal(h.closed(),0);
    assert.equal(h.elements.get('connect-first').hidden,false);
    assert.equal(h.elements.get('connect-first').textContent,'Connection');
  }
  assert.equal(messages.size,Object.keys(cases).length);
});

test('replacing a rejected key clears its old connection warning without erasing the draft',async()=>{
  const h=harness();await new Promise(setImmediate);
  h.elements.get('message').value='still here';h.elements.get('chat-error').textContent='Gemini rejected this key.';
  h.publish({status:{ready:true,busy:false,remaining:29,lastError:{code:'auth',httpStatus:403}}});
  h.publish({status:{ready:true,busy:false,remaining:29,lastError:null}});
  assert.equal(h.elements.get('chat-error').textContent,'');assert.equal(h.elements.get('connect-first').hidden,true);
  assert.equal(h.elements.get('message').value,'still here');
});

test('blank composer fades after five seconds outside despite repeated presence samples',async()=>{
  const h=harness();await new Promise(setImmediate);h.opened();
  for(let i=0;i<49;i++){h.presence(false);h.tick(100);}
  assert.equal(h.document.body.dataset.phase,'visible');assert.equal(h.closed(),0);
  h.tick(100);assert.equal(h.document.body.dataset.phase,'fading');
  h.tick(259);assert.equal(h.closed(),0);
  h.tick(1);assert.equal(h.closed(),1);assert.equal(h.document.body.dataset.phase,'hidden');
});

test('idle hiding preserves a draft and old fade callbacks cannot hide a reopened composer',async()=>{
  const h=harness();await new Promise(setImmediate);h.opened();
  h.elements.get('message').value='a thought for later';h.elements.get('message').events.input();
  h.tick(5000);const oldFade=h.scheduled.at(-1);h.tick(260);
  assert.equal(h.elements.get('message').value,'a thought for later');
  h.opened();oldFade();
  assert.equal(h.document.body.dataset.phase,'visible');assert.equal(h.closed(),1);
  assert.equal(h.elements.get('message').value,'a thought for later');
});

test('pointer entry and typing cancel fade, while leaving starts a fresh idle interval',async()=>{
  const h=harness();await new Promise(setImmediate);h.opened();h.presence(true);h.tick(30000);
  assert.equal(h.closed(),0);assert.equal(h.document.body.dataset.phase,'visible');
  h.presence(false);h.tick(5000);assert.equal(h.document.body.dataset.phase,'fading');
  const oldFade=h.scheduled.at(-1);h.presence(true);oldFade();assert.equal(h.closed(),0);
  h.presence(false);h.tick(5000);
  h.elements.get('message').value='new';h.elements.get('message').events.input();
  assert.equal(h.document.body.dataset.phase,'visible');h.tick(4999);assert.equal(h.closed(),0);
  h.elements.get('message').events.keydown({key:'a'});h.tick(4999);assert.equal(h.closed(),0);
  h.tick(261);assert.equal(h.closed(),1);
});

test('IME composition and pending sends prevent idle hiding, then release the spinner and timer',async()=>{
  let finish;
  const h=harness({sendChat(){return new Promise(resolve=>{finish=resolve;});}});await new Promise(setImmediate);h.opened();
  const input=h.elements.get('message');input.events.compositionstart();h.tick(30000);assert.equal(h.closed(),0);
  input.events.compositionend();h.tick(4000);input.value='hello';
  const pending=h.elements.get('composer').events.submit({preventDefault(){}});
  assert.equal(h.elements.get('waiting').hidden,false);assert.equal(h.elements.get('composer').attributes['aria-busy'],'true');
  h.tick(60000);assert.equal(h.closed(),0);assert.equal(h.document.body.dataset.phase,'visible');
  finish({ok:false,code:'timeout'});await pending;
  assert.equal(h.elements.get('waiting').hidden,true);assert.equal(h.elements.get('composer').attributes['aria-busy'],'false');
  assert.equal(input.value,'hello');h.tick(4999);assert.equal(h.closed(),0);h.tick(261);assert.equal(h.closed(),1);
});

test('eight sequential Enter sends release UI locks across success, quota, IPC failure and timeout',async()=>{
  const outcomes=[{ok:true,reply:'one'},{ok:true,reply:'two'},{ok:false,code:'quota'},{ok:true,reply:'four'},'throw',{ok:false,code:'timeout'},{ok:true,reply:'seven'},{ok:true,reply:'eight'}];
  let calls=0;
  const h=harness({async sendChat(){const result=outcomes[calls++];if(result==='throw')throw new Error('transport');return result;}});await new Promise(setImmediate);
  for(let i=0;i<outcomes.length;i++){
    h.opened();const input=h.elements.get('message');input.value=`message ${i}`;input.events.input();
    input.events.keydown({key:'Enter',preventDefault(){}});
    assert.equal(h.elements.get('waiting').hidden,false);
    await new Promise(setImmediate);
    assert.equal(calls,i+1);assert.equal(h.elements.get('waiting').hidden,true);
    assert.equal(h.elements.get('composer').attributes['aria-busy'],'false');
    if(outcomes[i].ok)assert.equal(input.value,'');
    else{assert.equal(input.value,`message ${i}`);assert.equal(h.elements.get('send').disabled,false);}
  }
});

test('late final status cannot restore busy after a newer completed-state event',async()=>{
  let calls=0,resolveOld;
  const old=new Promise(resolve=>{resolveOld=resolve;});
  const current={status:{ready:true,busy:false,remaining:28}};
  const h=harness({chatState(){return ++calls===1?Promise.resolve(current):old;},sendChat(){return Promise.resolve({ok:false,code:'network'});}});await new Promise(setImmediate);
  h.elements.get('message').value='retry me';const sending=h.elements.get('composer').events.submit({preventDefault(){}});
  await new Promise(setImmediate);h.publish(current);
  resolveOld({status:{ready:true,busy:true,remaining:29}});await sending;
  assert.equal(h.elements.get('waiting').hidden,true);assert.equal(h.elements.get('send').disabled,false);
});
