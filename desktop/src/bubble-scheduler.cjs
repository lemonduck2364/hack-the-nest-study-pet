'use strict';

const FADE_MS = 260;
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
function readingMs(characters) { return clamp(1800 + characters * 42, 3000, 12000); }

// Timers and time are injected so transport/recovery cannot silently replay content.
function createBubbleScheduler({ now = Date.now, setTimer = setTimeout, clearTimer = clearTimeout, onChange = () => {} } = {}) {
  let serial = 0, version = 0, timer, timerToken = 0, latestCaption = null;
  let active = { kind: 'thought', text: '', serial, version, phase: 'hidden', persistent: false };
  let subtitlePages = null, subtitleRemaining = 0, subtitleDeadline = 0, suspended = false;
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
  function runSubtitle() {
    if (active.paused || suspended) { cancelTimer(); return; }
    subtitleDeadline = now() + subtitleRemaining;
    after(subtitleRemaining, () => {
      if (active.pageIndex + 1 < subtitlePages.length) showSubtitlePage(active.pageIndex + 1);
      else expire();
    });
  }
  function preserveSubtitleTime() {
    if (!active.paused && !suspended) subtitleRemaining = Math.max(0, subtitleDeadline - now());
  }
  function showSubtitlePage(index) {
    active.pageIndex = index;
    subtitleRemaining = readingMs(subtitlePages[index]);
    runSubtitle();
    emit();
  }
  function hasSubtitles(id) {
    return id === active.serial && active.phase === 'visible' && subtitlePages !== null;
  }
  function show(content, reply) {
    cancelTimer();
    active = { ...content, serial: ++serial, version, phase: 'visible', persistent: Boolean(reply) };
    subtitlePages = null;
    const dwell = content.kind === 'speech' ? (reply ? readingMs(Array.from(content.text).length) : 2000)
      : content.kind === 'action' ? 4500 : 5500;
    after(dwell, expire); emit();
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
    setSpeechPages(id, pageLengths) {
      if (id !== active.serial || active.phase !== 'visible' || !active.persistent || subtitlePages
        || !Array.isArray(pageLengths) || pageLengths.length < 2 || pageLengths.length > 4000
        || pageLengths.some(length => !Number.isInteger(length) || length < 1 || length > 4000)
        || pageLengths.reduce((sum, length) => sum + length, 0) !== Array.from(active.text).length) return false;
      subtitlePages = [...pageLengths];
      active.paused = false;
      showSubtitlePage(0);
      return true;
    },
    pageChanged(id, index) {
      if (!hasSubtitles(id) || !Number.isInteger(index) || index < 0 || index >= subtitlePages.length
        || Math.abs(active.pageIndex - index) !== 1) return false;
      showSubtitlePage(index);
      return true;
    },
    toggleSubtitlePause(id) {
      if (!hasSubtitles(id)) return false;
      preserveSubtitleTime();
      active.paused = !active.paused;
      runSubtitle();
      emit();
      return true;
    },
    setSuspended(nextSuspended) {
      if (suspended === nextSuspended) return;
      const showingSubtitles = hasSubtitles(active.serial);
      if (showingSubtitles) preserveSubtitleTime();
      suspended = nextSuspended;
      if (showingSubtitles) runSubtitle();
    },
    dismiss(id) {
      if (id !== undefined && id !== active.serial) return false;
      if (active.kind !== 'speech' || active.phase !== 'visible') return false;
      expire(); return true;
    },
    dispose() { cancelTimer(); active.phase = 'hidden'; },
  };
}
module.exports = { createBubbleScheduler, readingMs, FADE_MS };
