'use strict';
function adjacentBounds(pet, size, workArea) {
  const margin = 8;
  const anchor = { x: pet.x + 50, y: pet.y + 142, width: 120, height: 125 };
  const left = anchor.x - size.width - 12;
  const right = anchor.x + anchor.width + 12;
  const preferLeft = left >= workArea.x + margin;
  const maxX = workArea.x + Math.max(margin, workArea.width - size.width - margin);
  const maxY = workArea.y + Math.max(margin, workArea.height - size.height - margin);
  return {
    x: Math.round(Math.max(workArea.x + margin, Math.min(preferLeft ? left : right, maxX))),
    y: Math.round(Math.max(workArea.y + margin, Math.min(anchor.y - 12, maxY))),
    ...size
  };
}
function pointInside(point, rect, padding = 0) {
  return point.x >= rect.x - padding && point.x <= rect.x + rect.width + padding
    && point.y >= rect.y - padding && point.y <= rect.y + rect.height + padding;
}
function bubbleBounds(pet, size, workArea) {
  const left = pet.x + 54 - size.width;
  const side = left >= workArea.x + 8 ? 'left' : 'right';
  const x = side === 'left' ? left : pet.x + 170;
  return {
    x: Math.round(Math.max(workArea.x + 8, Math.min(x, workArea.x + workArea.width - size.width - 8))),
    y: Math.round(Math.max(workArea.y + 8, Math.min(pet.y + 105 - size.height, workArea.y + workArea.height - size.height - 8))),
    ...size, side
  };
}
module.exports = { adjacentBounds, bubbleBounds, pointInside };
