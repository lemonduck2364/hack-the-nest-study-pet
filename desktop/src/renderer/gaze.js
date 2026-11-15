'use strict';
// Shared pure geometry and image deformation; no DOM, Electron or persistent data.
(function (root) {
  const eyeRegions = [
    { x: 270, y: 178, width: 26, height: 24, maxX: 3, maxY: 2 },
    { x: 321, y: 177, width: 28, height: 25, maxX: 3, maxY: 2 }
  ];
  const characterBounds = { x: 213, y: 63, width: 213, height: 267 };
  const faceAnchor = { x: 309, y: 190 };
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
  function warpEyes(source, destination, width, height, gaze, regions = eyeRegions) {
    if (source.length !== width * height * 4 || destination.length !== source.length) throw new Error('Unexpected frame size');
    const gx = Math.max(-1, Math.min(1, Number(gaze.x) || 0));
    const gy = Math.max(-1, Math.min(1, Number(gaze.y) || 0));
    for (const region of regions) {
      const { x, y, width: rw, height: rh, maxX, maxY } = region;
      for (let py = y; py < y + rh; py++) for (let px = x; px < x + rw; px++) {
        if (px < 0 || py < 0 || px >= width || py >= height) continue;
        const nx = (px - (x + (rw - 1) / 2)) / ((rw - 1) / 2);
        const ny = (py - (y + (rh - 1) / 2)) / ((rh - 1) / 2);
        // Compact elliptical mask, zero outside and along the edge: no eyebrows,
        // hair, mouth, silhouette or whole-face movement. Inverse sample originals.
        const weight = Math.max(0, 1 - nx * nx - ny * ny);
        const sx = Math.max(0, Math.min(width - 1, px - gx * maxX * weight));
        const sy = Math.max(0, Math.min(height - 1, py - gy * maxY * weight));
        const x0 = Math.floor(sx), y0 = Math.floor(sy);
        const x1 = Math.min(width - 1, x0 + 1), y1 = Math.min(height - 1, y0 + 1);
        const fx = sx - x0, fy = sy - y0;
        const dst = (py * width + px) * 4;
        for (let c = 0; c < 4; c++) {
          destination[dst + c] = source[(y0 * width + x0) * 4 + c] * (1-fx) * (1-fy)
            + source[(y0 * width + x1) * 4 + c] * fx * (1-fy)
            + source[(y1 * width + x0) * 4 + c] * (1-fx) * fy
            + source[(y1 * width + x1) * 4 + c] * fx * fy;
        }
      }
    }
    return destination;
  }
  const api = { gazeTarget, normalizedDistance, createAttentionGate, warpEyes, eyeRegions, characterBounds, faceAnchor };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.PetGaze = api;
})(globalThis);
