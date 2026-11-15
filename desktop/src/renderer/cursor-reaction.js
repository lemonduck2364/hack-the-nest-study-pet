'use strict';
(function (root) {
  function createReactionGate() {
    let nearby = false, dwell = 0;
    return {
      update({ ratio, allowed, held, sleeping, reducedMotion, milliseconds }) {
        if (ratio > 3.35) { nearby = false; dwell = 0; }
        if (!allowed || held || sleeping || reducedMotion) { nearby = false; dwell = 0; return false; }
        if (!nearby) {
          dwell = ratio <= 3 ? dwell + Math.min(50, Math.max(0, milliseconds)) : 0;
          nearby = dwell >= 150;
        }
        return nearby;
      }
    };
  }
  const api = { createReactionGate };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.PetCursorReaction = api;
})(globalThis);
