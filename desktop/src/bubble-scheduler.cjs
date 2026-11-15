'use strict';

const FADE_MS = 260;
const MAX_SPEECH_MS = 30000;
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
function readingMs(characters) { return clamp(1800 + characters * 42, 3000, 12000); }

// Timers and time are injected so transport/recovery cannot silently replay content.
function createBubbleScheduler({ now = Date.now, setTimer = setTimeout, clearTimer = clearTimeout, onChange = () => {} } = {}) {
  let serial = 0, version = 0, timer, timerToken = 0, latestCaption = null;
  let active = { kind: 'thought', text: '', serial, version, phase: 'hidden', persistent: false };
  let deadline = 0, hardDeadline = 0, page = 0;
  function snapshot() { return { ...active }; }
  function emit() { active.version = ++version; onChange(snapshot()); }
  function cancelTimer() { clearTimer(timer); timer = undefined; timerToken++; }
  function after(delay, callback) {
    cancelTimer();
    const token = timerToken;
    timer = setTimer(() => { if (token === timerToken) { timer = undefined; callback(); } }, Math.max(0, delay));
  }
  function finish() {
    const wasSpeech = active.kind === 'speech';
    active.phase = 'hidden'; emit();
    if (wasSpeech && latestCaption) show(latestCaption, false);
  }
  function expire() {
    if (active.phase !== 'visible') return;
    active.phase = 'fading'; emit(); after(FADE_MS, finish);
  }
  function show(content, reply) {
    cancelTimer();
    active = { ...content, serial: ++serial, version, phase: 'visible', persistent: Boolean(reply) };
    page = 0;
    const started = now();
    hardDeadline = started + MAX_SPEECH_MS;
    const dwell = content.kind === 'speech' ? (reply ? readingMs(Array.from(content.text).length) : 2000)
      : content.kind === 'action' ? 4500 : 5500;
    deadline = started + dwell;
    emit(); after(dwell, expire);
  }
  return {
    snapshot,
    caption(content) {
      if (!content || !['thought', 'action'].includes(content.kind) || typeof content.text !== 'string') return false;
      if (latestCaption?.kind === content.kind && latestCaption.text === content.text) return false;
      latestCaption = { kind: content.kind, text: content.text };
      if (active.kind !== 'speech' || active.phase === 'hidden') show(latestCaption, false);
      return true;
    },
    speak(text, reply = false) {
      if (typeof text !== 'string' || !text.trim()) return false;
      if (active.kind === 'speech' && active.phase !== 'hidden' && active.persistent && !reply) return false;
      show({ kind: 'speech', text }, reply); return true;
    },
    pageChanged(id, index, characters) {
      if (id !== active.serial || active.phase !== 'visible' || active.kind !== 'speech' || !active.persistent
        || !Number.isInteger(index) || index < 0 || index > 3999 || index === page
        || !Number.isInteger(characters) || characters < 0 || characters > 4000) return false;
      page = index;
      // Page clicks give reading room, but cannot keep speech on screen indefinitely.
      deadline = Math.min(hardDeadline, Math.max(deadline, now() + readingMs(characters)));
      after(deadline - now(), expire); return true;
    },
    dismiss(id) {
      if (id !== undefined && id !== active.serial) return false;
      if (active.kind !== 'speech' || active.phase !== 'visible') return false;
      expire(); return true;
    },
    dispose() { cancelTimer(); active.phase = 'hidden'; },
  };
}
module.exports = { createBubbleScheduler, readingMs, FADE_MS, MAX_SPEECH_MS };
