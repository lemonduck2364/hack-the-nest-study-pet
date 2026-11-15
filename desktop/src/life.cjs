'use strict';
// No Electron or wall-clock dependencies: one authoritative, bounded life simulation.
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
function createLife(random = Math.random) {
  let state = { activity: 'idle', play: 'bounce', energy: 80, age: 0, duration: 4, manualNap: false, held: false, wakeGrace: 0 };
  const choose = () => clamp(Number(random()) || 0, 0, 0.999999);
  function enter(activity) {
    state.activity = activity;
    state.age = 0;
    state.duration = activity === 'play' ? 9 + choose() * 6 : activity === 'idle' ? 4 + choose() * 3 : 6;
    if (activity === 'play') state.play = ['bounce', 'peek', 'ball'][Math.floor(choose() * 3)];
  }
  function snapshot() { return { ...state }; }
  return {
    snapshot,
    tick(seconds) {
      if (state.held || !Number.isFinite(seconds) || seconds <= 0) return snapshot();
      // Do not replay hours of missed activity after sleep/resume or a blocked event loop.
      const dt = Math.min(seconds, 1);
      state.age += dt;
      state.wakeGrace = Math.max(0, state.wakeGrace - dt);
      const rate = { idle: -0.35, play: -2, rest: 0.6, sleep: 3 }[state.activity];
      state.energy = clamp(state.energy + rate * dt, 0, 100);
      if (state.manualNap) return snapshot();
      if (state.activity === 'sleep') {
        if (state.energy >= 82 && state.age >= 8) enter('idle');
      } else if (state.activity === 'rest') {
        if (state.age >= 6) enter('sleep');
      } else if (state.energy <= 24 && state.wakeGrace === 0) enter('rest');
      else if (state.age >= state.duration) enter(state.activity === 'play' ? 'idle' : 'play');
      return snapshot();
    },
    nap() { state.manualNap = true; state.wakeGrace = 0; enter('sleep'); return snapshot(); },
    wake() { state.manualNap = false; state.wakeGrace = 8; enter('idle'); return snapshot(); },
    interact() {
      if (state.activity === 'sleep' || state.activity === 'rest') this.wake();
      return snapshot();
    },
    setHeld(held) { state.held = Boolean(held); return snapshot(); }
  };
}
module.exports = { createLife };
