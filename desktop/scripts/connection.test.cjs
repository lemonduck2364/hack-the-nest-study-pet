'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
function harness(overrides={}){
  const elements=new Map();let publish,opened,closed=0;
  const document={getElementById(id){if(!elements.has(id))elements.set(id,{value:'',textContent:'',hidden:false,events:{},focus(){},addEventListener(name,fn){this.events[name]=fn;}});return elements.get(id);},addEventListener(){}};
  const api={onChatState(fn){publish=fn;},onConnectionOpened(fn){opened=fn;},chatState(){return Promise.resolve({status:{ready:true,busy:false,credentialState:'saved',lastError:null}});},closeConnection(){closed++;},keyHelp(){},clearChat(){},...overrides};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../src/renderer/connection.js'),'utf8'),{window:{desktopPet:api},document});
  return{elements,publish,opened,closed:()=>closed};
}
test('saved connection shows replace and remove controls without putting credentials in the field',async()=>{
  const h=harness();await new Promise(setImmediate);
  assert.match(h.elements.get('connection-status').textContent,/saved securely/);
  assert.equal(h.elements.get('api-key').value,'');assert.equal(h.elements.get('connect').textContent,'Replace');
  assert.equal(h.elements.get('remove').disabled,false);
  h.elements.get('api-key').value='unsent-fake-key';h.opened();assert.equal(h.elements.get('api-key').value,'');
});
test('replacement clears key input immediately and preserves connected UI on safe storage failure',async()=>{
  let finish,calls=0;
  const h=harness({configureChat(value){calls++;assert.equal(value.apiKey,'fake-unit-test-key');return new Promise(resolve=>{finish=resolve;});}});await new Promise(setImmediate);
  h.elements.get('api-key').value='fake-unit-test-key';h.elements.get('api-key').events.input();
  const replacing=h.elements.get('connect').events.click();
  assert.equal(h.elements.get('api-key').value,'');assert.equal(h.elements.get('remove').disabled,true);
  await h.elements.get('connect').events.click();assert.equal(calls,1);
  finish({ok:false,error:'Could not securely save this key.',status:{ready:true,busy:false,credentialState:'saved',lastError:{code:'storage_save'}}});await replacing;
  assert.equal(h.closed(),0);assert.equal(h.elements.get('connect').textContent,'Replace');
  assert.equal(h.elements.get('remove').disabled,false);assert.match(h.elements.get('error').textContent,/securely save/);
});
test('removal invokes disconnect once and successful removal exposes no-key state',async()=>{
  let finish,calls=0;
  const h=harness({disconnectChat(){calls++;return new Promise(resolve=>{finish=resolve;});}});await new Promise(setImmediate);
  const removing=h.elements.get('remove').events.click();await h.elements.get('remove').events.click();assert.equal(calls,1);
  finish({ok:true,status:{ready:false,busy:false,credentialState:'none',lastError:null}});await removing;
  assert.equal(h.elements.get('remove').disabled,true);assert.equal(h.elements.get('connect').textContent,'Save key');
  assert.equal(h.elements.get('connection-status').textContent,'No saved key.');
});
test('last issue is described using safe codes, without rendering arbitrary error text',async()=>{
  const h=harness();await new Promise(setImmediate);
  h.publish({status:{ready:true,busy:false,credentialState:'saved',lastError:{code:'quota',httpStatus:429,error:'SECRET'}}});
  assert.match(h.elements.get('last-failure').textContent,/quota or rate limit.*HTTP 429/);
  assert.equal(h.elements.get('last-failure').textContent.includes('SECRET'),false);
  h.publish({status:{ready:true,busy:false,credentialState:'saved',lastError:{code:'timeout'}}});
  assert.match(h.elements.get('last-failure').textContent,/25 seconds/);
  h.publish({status:{ready:true,busy:false,credentialState:'session',lastError:null}});
  assert.equal(h.elements.get('last-failure').hidden,true);assert.match(h.elements.get('connection-status').textContent,/run only/);
});

test('forget conversation remains usable while a Gemini reply is pending',async()=>{
  let cleared=0;
  const h=harness({clearChat(){cleared++;}});await new Promise(setImmediate);
  h.publish({status:{ready:true,busy:true,credentialState:'saved',lastError:null}});
  assert.equal(h.elements.get('connect').disabled,true);
  assert.equal(h.elements.get('clear').disabled,false);
  h.elements.get('clear').events.click();
  assert.equal(cleared,1);
});
