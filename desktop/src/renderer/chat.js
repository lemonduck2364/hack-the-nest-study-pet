'use strict';
const api = window.desktopPet;
const input = document.getElementById('message');
const errorBox = document.getElementById('chat-error');
let status = { ready:false, busy:false, remaining:30 };
let sending = false, composing = false, generation = 0, reconnect = false;
let visible=false, pointerInside=false, idleTimer, fadeTimer, idleToken=0, lastActivity=0, previousBusy=false;
let stateRevision=0, sendAttempt=0;
const IDLE_MS=5000, FADE_MS=260;
function cancelIdle() {
  clearTimeout(idleTimer);clearTimeout(fadeTimer);idleTimer=fadeTimer=undefined;idleToken++;
  if(visible)document.body.dataset.phase='visible';
}
function closeComposer() { visible=false;cancelIdle();document.body.dataset.phase='hidden';api.closeChat(); }
function scheduleIdle() {
  cancelIdle();
  if(!visible||pointerInside||composing||sending||status.busy)return;
  const token=idleToken;
  idleTimer=setTimeout(()=>{
    if(token!==idleToken||!visible||pointerInside||composing||sending||status.busy)return;
    document.body.dataset.phase='fading';
    fadeTimer=setTimeout(()=>{
      if(token===idleToken&&visible&&!pointerInside&&!composing&&!sending&&!status.busy)closeComposer();
    },FADE_MS);
  },Math.max(0,IDLE_MS-(Date.now()-lastActivity)));
}
function activity() { lastActivity=Date.now();scheduleIdle(); }
function resize() {
  const notice=document.getElementById('notice');
  const noticeHeight=notice.hidden?0:notice.getBoundingClientRect().height+6;
  api.resizeComposer(Math.ceil(document.getElementById('composer').getBoundingClientRect().height+10+noticeHeight));
}
function resizeInput() { input.rows=window.ComposerLines.visibleLines(input.value); resize(); }
function renderError(text = '') {
  errorBox.textContent = text;
  document.getElementById('connect-first').hidden = status.ready && !reconnect && !text;
  document.getElementById('connect-first').textContent = status.ready ? 'Connection' : 'Let’s connect first';
  document.getElementById('notice').hidden = !text && status.ready && !reconnect;
  resize();
}
function controls() {
  const busy = sending || status.busy;
  const send = document.getElementById('send');
  send.disabled = !status.ready || busy || !input.value.trim() || status.remaining <= 0;
  send.hidden = busy; document.getElementById('waiting').hidden = !busy;
  document.getElementById('composer').setAttribute('aria-busy',String(busy));
  if(busy)cancelIdle();
  else if(previousBusy){lastActivity=Date.now();scheduleIdle();}
  previousBusy=busy;
}
function render(next) {
  if (!next?.status) return;
  const wasReady = status.ready, issueResolved = Boolean(status.lastError && !next.status.lastError);
  status = next.status;
  if ((!wasReady && status.ready) || issueResolved) reconnect = false;
  controls();
  renderError(status.remaining <= 0 ? 'This run reached its 30-send limit. Please reopen the pet to continue.' : issueResolved ? '' : errorBox.textContent);
}
api.onChatState(next=>{stateRevision++;render(next);});
const initialRevision=stateRevision;
api.chatState().then(next=>{if(initialRevision===stateRevision)render(next);}).catch(()=>{});
api.onChatOpened(() => { visible=true;pointerInside=false;activity();input.focus();resizeInput(); });
api.onComposerPresence?.(presence=>{
  if(typeof presence?.inside!=='boolean'||presence.inside===pointerInside)return;
  pointerInside=presence.inside;
  activity();
});
api.onConversationCleared(() => {
  generation++; sending = false; reconnect = false;
  renderError(status.remaining <= 0 ? 'This run reached its 30-send limit. Please reopen the pet to continue.' : ''); controls();
});
document.getElementById('close-chat').addEventListener('click', closeComposer);
document.getElementById('connect-first').addEventListener('click', () => api.openConnection());
async function sendMessage(event) {
  event?.preventDefault();
  const text = input.value.trim();
  if (!text || sending || status.busy || !status.ready || status.remaining <= 0) return;
  const thisGeneration = generation;
  const thisAttempt=++sendAttempt;
  const originalDraft = input.value;
  sending = true; reconnect = false; renderError(); controls();
  try {
    const result = await api.sendChat(text);
    if (thisGeneration !== generation) return;
    if (result.ok) {
      if (input.value === originalDraft) { input.value = ''; resizeInput(); closeComposer(); }
    } else {
      reconnect = ['auth','missing_key','invalid_config'].includes(result.code);
      const messages = {
        auth:'Gemini rejected this key. Check Connection.', missing_key:'Connect Gemini to start chatting.',
        invalid_config:'Check the key in Connection.', limit:'This run reached its 30-send limit. Please reopen the pet to continue.',
        quota:'Gemini’s quota or rate limit was reached. Try later or check the project limits.',
        timeout:'Gemini took too long to reply. Your words are still here.',
        network:'Could not reach Gemini. Check your internet connection.',
        provider:'Gemini is temporarily unavailable. Please try later.',
        invalid_response:'Gemini returned an unreadable reply. Your words are still here.',
        empty:'Gemini returned no usable reply. Try a different message.',
        request:'Gemini could not accept this request. Check model access in Connection.',
        cancelled:'That reply was cancelled. Your words are still here.',
        busy:'A reply or connection change is already in progress.',
      };
      renderError(messages[result.code] || 'Chat could not send this message. Your words are still here.');
    }
  } catch { if (thisGeneration === generation) renderError('I couldn’t send that. Your words are still here.'); }
  finally {
    if (thisGeneration === generation) {
      sending = false;
      controls();
      const revision=stateRevision;
      try {
        const next = await api.chatState();
        if (thisGeneration === generation && thisAttempt===sendAttempt && revision===stateRevision) render(next);
      } catch { if (thisGeneration === generation && thisAttempt===sendAttempt) controls(); }
    }
  }
}
document.getElementById('composer').addEventListener('submit', sendMessage);
input.addEventListener('input', () => { activity();resizeInput();controls(); });
input.addEventListener('compositionstart', () => { composing = true;activity(); });
input.addEventListener('compositionend', () => { composing = false;activity(); });
input.addEventListener('keydown', event => {
  activity();
  if (event.key === 'Enter' && !event.shiftKey && !event.isComposing && !composing && event.keyCode !== 229) sendMessage(event);
});
document.addEventListener('keydown', event => { activity();if (event.key === 'Escape' && !event.isComposing) closeComposer(); });
controls(); resizeInput();
