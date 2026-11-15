'use strict';

(function (root) {
  const tracks = {
    idle: { loop: 'idle' },
    rest: { loop: 'rest' },
    wave: { enter: 'wave' },
    cube: { enter: 'cubeEnter', loop: 'cube', exit: 'cubeExit' },
    cat: { enter: 'catEnter', loop: 'cat', exit: 'catExit' },
    sleep: { enter: 'sleepEnter', loop: 'sleep', exit: 'sleepExit' },
    laptop: { enter: 'laptopEnter', loop: 'laptop', exit: 'laptopExit' }
  };
  const playTracks = { bounce: 'cube', peek: 'laptop', ball: 'cat' };

  function createSpritePlayer(clips) {
    let mode = 'idle', target = 'idle', phase = 'loop', clip = 'idle';
    let index = 0, elapsed = 0, pendingWave = false;

    function start(nextMode, nextPhase) {
      mode = nextMode;
      phase = nextPhase;
      clip = tracks[mode][phase];
      index = 0;
      elapsed = 0;
    }

    function requested() {
      return pendingWave && target === 'idle' ? 'wave' : target;
    }

    function enter(nextMode) {
      if (nextMode === 'wave') pendingWave = false;
      start(nextMode, tracks[nextMode].enter ? 'enter' : 'loop');
    }

    function syncStandingPose() {
      if (phase === 'loop' && !tracks[mode].exit && requested() !== mode) enter(requested());
    }

    function nextFrame() {
      index++;
      if (index < clips[clip].length) return;
      if (phase === 'exit' || mode === 'wave') enter(requested());
      else if (requested() !== mode) {
        if (tracks[mode].exit) start(mode, 'exit');
        else enter(requested());
      } else if (phase === 'enter') start(mode, 'loop');
      else index = 0;
    }

    return {
      setLife({ activity, play }) {
        target = activity === 'play' ? (playTracks[play] || 'cube') : activity;
        if (target !== 'idle' && target !== 'sleep' && target !== 'rest') pendingWave = false;
        syncStandingPose();
      },
      greet() {
        if (!['idle', 'rest', 'sleep'].includes(target) || mode === 'wave') return;
        pendingWave = true;
        syncStandingPose();
      },
      advance(milliseconds) {
        // A delayed renderer frame should not replay seconds of unseen motion.
        let remaining = Math.max(0, Math.min(50, milliseconds));
        while (remaining > 0) {
          const untilNext = clips[clip][index].ms - elapsed;
          if (remaining < untilNext) {
            elapsed += remaining;
            return;
          }
          remaining -= untilNext;
          elapsed = 0;
          nextFrame();
        }
      },
      frame(staticPose = false) {
        const pose = staticPose ? clips[tracks[mode].loop || 'idle'][0].pose : clips[clip][index].pose;
        return { clip, pose };
      }
    };
  }

  if (typeof module !== 'undefined' && module.exports) module.exports = { createSpritePlayer };
  else root.PetSpritePlayer = { createSpritePlayer };
})(globalThis);
