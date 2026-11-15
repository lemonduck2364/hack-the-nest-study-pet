'use strict';
const api = window.desktopPet;
const field = document.getElementById('api-key');
let busy = false, configured = false, requestBusy = false;
function error(text='') { const box=document.getElementById('error'); box.textContent=text; box.hidden=!text; }
function controls() { document.getElementById('connect').disabled=busy||requestBusy||!field.value.trim(); }
function render(next) {
  if (!next?.status) return;
  configured=next.status.ready; requestBusy=next.status.busy;
  document.getElementById('connection-status').textContent=configured?'Key set for this session.':'No key set yet.'; controls();
}
api.onChatState(render); api.chatState().then(render);
api.onConnectionOpened(() => { field.focus(); });
field.addEventListener('input',controls);
document.getElementById('close').addEventListener('click',()=>api.closeConnection());
document.getElementById('key-help').addEventListener('click',()=>api.keyHelp());
document.getElementById('clear').addEventListener('click',()=>{ api.clearChat(); error(); });
document.getElementById('connect').addEventListener('click',async()=>{
  const apiKey=field.value.trim(); if(!apiKey||busy||requestBusy)return;
  field.value='';busy=true;error();controls();
  try { const result=await api.configureChat({provider:'gemini',apiKey}); if(result.ok) api.closeConnection(); else error(result.error||'Could not set this key.'); }
  catch { error('Could not set this key. Please try again.'); }
  finally{busy=false;controls();}
});
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!event.isComposing)api.closeConnection();});controls();
