'use strict';
const api = window.desktopPet;
const input = document.getElementById('message');
const errorBox = document.getElementById('chat-error');
let status = { ready:false, busy:false, remaining:30 };
let sending = false, composing = false, generation = 0, reconnect = false;
function resize() { api.resizeComposer(Math.ceil(document.getElementById('composer').getBoundingClientRect().height + 10)); }
function renderError(text = '') {
  errorBox.textContent = text;
  document.getElementById('connect-first').hidden = status.ready && !reconnect;
  document.getElementById('notice').hidden = !text && status.ready && !reconnect;
  resize();
}
function controls() {
  const busy = sending || status.busy;
  const send = document.getElementById('send');
  send.disabled = !status.ready || busy || !input.value.trim() || status.remaining <= 0;
  send.hidden = busy; document.getElementById('waiting').hidden = !busy;
}
function render(next) {
  if (!next?.status) return;
  const wasReady = status.ready; status = next.status; if (!wasReady && status.ready) reconnect = false; controls(); renderError(status.remaining <= 0 ? 'Please reopen the pet to continue chatting.' : errorBox.textContent);
}
api.onChatState(render);
api.chatState().then(render);
api.onChatOpened(() => { input.focus(); resize(); });
api.onConversationCleared(() => {
  generation++; sending = false; reconnect = false;
  renderError(status.remaining <= 0 ? 'Please reopen the pet to continue chatting.' : ''); controls();
});
document.getElementById('close-chat').addEventListener('click', () => api.closeChat());
document.getElementById('connect-first').addEventListener('click', () => api.openConnection());
async function sendMessage(event) {
  event?.preventDefault();
  const text = input.value.trim();
  if (!text || sending || status.busy || !status.ready || status.remaining <= 0) return;
  const thisGeneration = generation;
  sending = true; reconnect = false; renderError(); controls();
  try {
    const result = await api.sendChat(text);
    if (thisGeneration !== generation) return;
    if (result.ok) {
      if (input.value.trim() === text) { input.value = ''; api.closeChat(); }
    } else {
      reconnect = ['auth','missing_key','invalid_config'].includes(result.code);
      renderError(reconnect ? 'A little connection trouble.' : ['limit','quota'].includes(result.code) ? 'Let’s try again a little later.' : 'Couldn’t send just now. Your words are still here.');
    }
  } catch { if (thisGeneration === generation) renderError('I couldn’t send that. Your words are still here.'); }
  finally {
    if (thisGeneration === generation) {
      sending = false;
      try { const next = await api.chatState(); if (thisGeneration === generation) render(next); }
      catch { if (thisGeneration === generation) controls(); }
    }
  }
}
document.getElementById('composer').addEventListener('submit', sendMessage);
input.addEventListener('input', controls);
input.addEventListener('compositionstart', () => { composing = true; });
input.addEventListener('compositionend', () => { composing = false; });
input.addEventListener('keydown', event => {
  if (event.key === 'Enter' && !event.shiftKey && !event.isComposing && !composing && event.keyCode !== 229) sendMessage(event);
});
document.addEventListener('keydown', event => { if (event.key === 'Escape' && !event.isComposing) api.closeChat(); });
controls();
