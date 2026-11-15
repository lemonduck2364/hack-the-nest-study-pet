'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { adjacentBounds, bubbleBounds, pointInside } = require('../src/window-layout.cjs');
const area = { x:0, y:25, width:1440, height:875 };
test('chat invitation prefers the left of the visible character', () => {
  const pet = {x:1000,y:500,width:220,height:240};
  const result = adjacentBounds(pet,{width:218,height:92},area);
  assert.ok(result.x + result.width < pet.x + 50);
  assert.equal(result.y,630);
});
test('left-edge pet opens adjacent panel on the right; bottom remains visible', () => {
  const result = adjacentBounds({x:0,y:740,width:220,height:240},{width:364,height:492},area);
  assert.equal(result.x,182);
  assert.ok(result.y >= area.y);
  assert.ok(result.y + result.height <= area.y + area.height - 8);
});
test('negative monitor coordinates stay in the same work area', () => {
  const workArea = {x:-1920,y:-200,width:1920,height:1080};
  const result = adjacentBounds({x:-400,y:600,width:220,height:240},{width:364,height:492},workArea);
  assert.ok(result.x >= workArea.x + 8 && result.x + result.width <=0);
  assert.ok(result.y >= workArea.y + 8 && result.y + result.height <=880);
});
test('hint travel padding admits only the local margin', () => {
  const rect={x:10,y:10,width:100,height:50};
  assert.ok(pointInside({x:6,y:20},rect,5));
  assert.equal(pointInside({x:4,y:20},rect,5),false);
});

test('compact replies sit centered above the head with a gap', () => {
  const pet={x:1000,y:500,width:220,height:240};
  const bubble=bubbleBounds(pet,{width:200,height:190},area);
  assert.equal(bubble.side,'center');
  assert.equal(bubble.x+bubble.width/2,pet.x+105);
  assert.equal(bubble.y+bubble.height,pet.y+58);
});
test('reserved headroom keeps the tallest bubble above the face at the top edge', () => {
  const {fitPetBounds}=require('../src/window-layout.cjs');
  const pet=fitPetBounds({x:0,y:25,width:220,height:240},area,140);
  const bubble=bubbleBounds(pet,{width:200,height:190},area);
  assert.ok(bubble.x>=area.x && bubble.y>=area.y+8);
  assert.ok(bubble.y+bubble.height<=pet.y+58);
});
test('jump reaction raises the overhead bubble without covering the higher head pose', () => {
  const {fitPetBounds}=require('../src/window-layout.cjs');
  const pet=fitPetBounds({x:200,y:area.y,width:220,height:240},area,164);
  const jump=bubbleBounds(pet,{width:200,height:190},area,{x:105,y:43});
  assert.equal(jump.x+jump.width/2,pet.x+105);
  assert.ok(jump.y>=area.y+8);
  assert.equal(jump.y+jump.height,pet.y+43-6);
});
