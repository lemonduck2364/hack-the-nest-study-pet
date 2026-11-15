'use strict';
// Shared geometry and whole-pixel gaze directions.
(function (root) {
  const characterBounds = { x: 14, y: 4, width: 51, height: 75 };
  const faceAnchor = { x: 44, y: 33 };
  function normalizedDistance(pointer, bounds, focus) {
    if (!pointer || !bounds || ![pointer.x, pointer.y, bounds.x, bounds.y, bounds.width, bounds.height].every(Number.isFinite)
      || bounds.width <= 0 || bounds.height <= 0) return Infinity;
    const center = focus || { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height * .47 };
    return Math.hypot(pointer.x - center.x, pointer.y - center.y) / bounds.width;
  }
  function gazeTarget(pointer, bounds, active = true, focus) {
    const zero = { x: 0, y: 0, nearby: false };
    const distanceRatio = normalizedDistance(pointer, bounds, focus);
    if (!active || distanceRatio >= 3) return zero;
    const center = focus || { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height * .47 };
    const dx = pointer.x - center.x, dy = pointer.y - center.y;
    const fade = Math.min(1, (3 - distanceRatio) / .75);
    const denominator = Math.max(bounds.width * .55, Math.hypot(dx, dy));
    return { x: dx / denominator * fade, y: dy / denominator * fade, nearby: true };
  }
  function createAttentionGate() {
    let active = false, pending = 0;
    return {
      update(ratio, allowed, milliseconds) {
        if (!allowed) { active = false; pending = 0; return false; }
        const wantsChange = active ? ratio > 3.35 : ratio <= 3;
        if (!wantsChange) pending = 0;
        else pending += Math.max(0, Math.min(50, Number(milliseconds) || 0));
        if (pending >= (active ? 200 : 150)) { active = !active; pending = 0; }
        return active;
      }
    };
  }
  function eyeDirection({ x, y }) {
    const horizontal = x < -.25 ? 'w' : x > .25 ? 'e' : '';
    const vertical = y < -.25 ? 'n' : y > .25 ? 's' : '';
    return vertical + horizontal || 'center';
  }
  const api = { gazeTarget, normalizedDistance, createAttentionGate, eyeDirection, characterBounds, faceAnchor };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.PetGaze = api;
})(globalThis);
