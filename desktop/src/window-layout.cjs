'use strict';
function fitPetBounds(bounds, workArea, topInset = 0) {
  const top = workArea.y + Math.min(topInset, Math.max(0, workArea.height - bounds.height));
  return {
    ...bounds,
    x: Math.round(Math.max(workArea.x, Math.min(bounds.x, workArea.x + Math.max(0, workArea.width - bounds.width)))),
    y: Math.round(Math.max(top, Math.min(bounds.y, workArea.y + Math.max(0, workArea.height - bounds.height))))
  };
}
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
function bubbleBounds(pet, size, workArea, anchor = { x: 105, y: 64 }) {
  const x = pet.x + anchor.x - size.width / 2;
  return {
    x: Math.round(Math.max(workArea.x + 8, Math.min(x, workArea.x + workArea.width - size.width - 8))),
    y: Math.round(Math.max(workArea.y + 8, Math.min(pet.y + anchor.y - 6 - size.height, workArea.y + workArea.height - size.height - 8))),
    ...size, side: 'center'
  };
}
module.exports = { adjacentBounds, bubbleBounds, pointInside, fitPetBounds };
