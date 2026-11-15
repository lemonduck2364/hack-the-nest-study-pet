'use strict';
const api = window.desktopPet;
const field = document.getElementById('api-key');
let busy = false, configured = false, requestBusy = false, credentialState = 'none';
const failureDescriptions = {
  quota:'Gemini quota or rate limit reached', limit:'This run reached its 30-send limit',
  auth:'Gemini rejected the key or project access', network:'Could not reach Gemini over the network',
  timeout:'Gemini did not reply within 25 seconds', provider:'Gemini was temporarily unavailable',
  invalid_response:'Gemini returned an unreadable reply', empty:'Gemini returned no usable reply',
  request:'Gemini rejected the request or model access', missing_key:'No Gemini key was connected',
  storage_save:'The replacement key could not be saved securely', storage_load:'The saved key could not be unlocked',
  storage_remove:'The saved key could not be removed', unavailable:'Chat was unavailable',
};
function error(text='') { const box=document.getElementById('error'); box.textContent=text; box.hidden=!text; }
function controls() {
  document.getElementById('connect').disabled=busy||requestBusy||!field.value.trim();
  document.getElementById('remove').disabled=busy||requestBusy||(!configured&&credentialState!=='unavailable'&&credentialState!=='saved');
  // Forgetting a conversation also cancels its pending reply.
  document.getElementById('clear').disabled=busy;
}
function render(next) {
  if (!next?.status) return;
  const status=next.status;
  configured=status.ready; requestBusy=status.busy; credentialState=status.credentialState||'none';
  const labels={saved:'Key saved securely on this Mac.',session:'Using a key for this run only.',none:'No saved key.',unavailable:'Saved-key storage needs attention.'};
  document.getElementById('connection-status').textContent=labels[credentialState]||labels.none;
  document.getElementById('key-label').textContent=configured?'Replace API key':'API key';
  document.getElementById('connect').textContent=configured?'Replace':'Save key';
  document.getElementById('remove').textContent=credentialState==='session'?'Disconnect key':'Remove saved key';
  const detail=document.getElementById('last-failure'), last=status.lastError;
  detail.textContent=last?`Last issue: ${failureDescriptions[last.code]||'Chat could not complete the request'}${Number.isInteger(last.httpStatus)?` (HTTP ${last.httpStatus})`:''}.`:'';
  detail.hidden=!last; controls();
  if (next.memory) renderMemory(next.memory);
}

const memoryList = document.getElementById('memory-list');
const memoryStatus = document.getElementById('memory-status');
const forgetAll = document.getElementById('forget-all');
let shownMemory, forgetting = false, confirmAll = false;
function renderMemory(memory) {
  shownMemory = memory;
  const disabled = requestBusy || forgetting;
  memoryStatus.textContent = memory.state === 'unavailable'
    ? 'Saved memories could not be accessed or changed.'
    : memory.entries.length ? '' : 'Nothing saved yet.';
  memoryList.replaceChildren();
  for (const entry of memory.entries) {
    const row = document.createElement('li');
    const quote = document.createElement('span');
    quote.textContent = entry.quote;
    const forget = document.createElement('button');
    forget.type = 'button';
    forget.textContent = 'Forget';
    forget.setAttribute('aria-label', `Forget: ${entry.quote}`);
    forget.disabled = disabled;
    forget.addEventListener('click', () => removeMemory(entry.id));
    row.append(quote, forget);
    memoryList.append(row);
  }
  forgetAll.disabled = disabled || (!memory.entries.length && memory.state !== 'unavailable');
  forgetAll.textContent = confirmAll ? 'Confirm forget all' : 'Forget all memories';
}
async function removeMemory(id) {
  if (forgetting || requestBusy || !shownMemory) return;
  forgetting = true;
  confirmAll = false;
  error();
  renderMemory(shownMemory);
  let ok = false;
  try { ok = (await api.forgetMemory(id)).ok; } catch {}
  forgetting = false;
  renderMemory(shownMemory);
  if (!ok) memoryStatus.textContent = 'Could not forget that memory. Please try again.';
}
forgetAll.addEventListener('click', () => {
  if (confirmAll) return removeMemory(null);
  confirmAll = true;
  renderMemory(shownMemory);
});

api.onChatState(render); api.chatState().then(render);
api.onConnectionOpened(() => { field.value='';error();controls();confirmAll=false;if(shownMemory)renderMemory(shownMemory);field.focus(); });
field.addEventListener('input',controls);
document.getElementById('close').addEventListener('click',()=>{field.value='';api.closeConnection();});
document.getElementById('key-help').addEventListener('click',()=>api.keyHelp());
document.getElementById('clear').addEventListener('click',()=>{ api.clearChat(); error(); });
document.getElementById('connect').addEventListener('click',async()=>{
  const apiKey=field.value.trim(); if(!apiKey||busy||requestBusy)return;
  field.value='';busy=true;error();controls();
  try {
    const result=await api.configureChat({provider:'gemini',apiKey});
    if(result.status)render({status:result.status});
    if(result.ok)api.closeConnection();else error(result.error||'Could not securely save this key. The previous connection was kept.');
  } catch { error('Could not save this key. Please try again.'); }
  finally{busy=false;controls();}
});
document.getElementById('remove').addEventListener('click',async()=>{
  if(busy||requestBusy)return;
  field.value='';busy=true;error();controls();
  try {
    const result=await api.disconnectChat();
    if(result.status)render({status:result.status});
    if(!result.ok)error(result.error||'Could not remove this key. The connection was kept.');
  } catch { error('Could not remove this key. Please try again.'); }
  finally{busy=false;controls();}
});
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!event.isComposing){field.value='';api.closeConnection();}});controls();
