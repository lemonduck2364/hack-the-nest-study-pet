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

test('reply bubble fits above-left of the pet without covering its face', () => {
  const pet={x:1000,y:500,width:220,height:240};
  const bubble=bubbleBounds(pet,{width:280,height:230},area);
  assert.equal(bubble.side,'left');
  assert.ok(bubble.x+bubble.width<=pet.x+54);
  assert.ok(bubble.y+bubble.height<=pet.y+105);
});
test('left-edge reply changes tail side and stays in the display', () => {
  const bubble=bubbleBounds({x:0,y:35},{width:280,height:230},area);
  assert.equal(bubble.side,'right');
  assert.ok(bubble.x>=170 && bubble.y>=area.y+8);
});
