'use strict';

const bridge = window.desktopPet;
const geometry = window.PetGaze;
const sprites = window.RedPandaSprites;
const player = window.PetSpritePlayer.createSpritePlayer(sprites.clips);
const pet = document.getElementById('pet');
const canvas = document.getElementById('character');
const context = canvas.getContext('2d', { willReadFrequently: true });
const atlas = new Image();
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const gate = geometry.createAttentionGate();

let life = { activity: 'idle', play: 'bounce', gazeEnabled: true };
let gesture, pointerInside = false, lastPointer = null;
let spriteReady = false, spriteFailed = false, alphaPixels = null;
let lastCaption = '', lastCaptionKind = '';
let attention = false, gaze = { x: 0, y: 0 };
let lastFrame, lastPose = '', lastEyes = '', lastClip = '';

function report(kind, extra = {}) {
  if (life.debug) bridge.diagnostic({ kind, clip: player.frame().clip, ...extra });
}

function updateHitTest(x, y) {
  const rect = canvas.getBoundingClientRect();
  const px = Math.floor((x - rect.x) / rect.width * sprites.width);
  const py = Math.floor((y - rect.y) / rect.height * sprites.height);
  const next = Boolean(alphaPixels && px >= 0 && py >= 0 && px < sprites.width && py < sprites.height
    && alphaPixels[(py * sprites.width + px) * 4 + 3] > 0);
  if (next !== pointerInside) {
    pointerInside = next;
    bridge.setPointerInside(next);
  }
}

const captions = {
  idle: 'hmm… what shall I do?',
  rest: 'getting a little sleepy…',
  sleep: 'a little nap…'
};
const playCaptions = {
  bounce: 'one more turn of my cube…',
  peek: 'tap, tap, tap…',
  ball: 'playing with my little kitty'
};

function renderCaption() {
  const text = spriteFailed ? 'Animation unavailable' : attention ? 'oh, what’s that?'
    : life.activity === 'play' ? playCaptions[life.play] : captions[life.activity];
  const kind = !attention && (life.activity === 'play' || life.activity === 'sleep') ? 'action' : 'thought';
  if (text !== lastCaption || kind !== lastCaptionKind) {
    lastCaption = text;
    lastCaptionKind = kind;
    bridge.setCaption({ kind, text });
  }
}

function setAttention(next) {
  if (attention === next) return;
  attention = next;
  report(next ? 'attention-on' : 'attention-off');
  renderCaption();
}

function renderLife(next) {
  if (!next || !['idle', 'play', 'rest', 'sleep'].includes(next.activity)) return;
  life = next;
  player.setLife(next);
  if (next.activity === 'sleep' || !next.gazeEnabled) setAttention(gate.update(Infinity, false, 0));
  renderCaption();
}

function frameGeometry() {
  const rect = canvas.getBoundingClientRect();
  const sx = rect.width / sprites.width, sy = rect.height / sprites.height;
  const bounds = geometry.characterBounds, anchor = geometry.faceAnchor;
  return {
    bounds: { x: rect.x + bounds.x * sx, y: rect.y + bounds.y * sy, width: bounds.width * sx, height: bounds.height * sy },
    focus: { x: rect.x + anchor.x * sx, y: rect.y + anchor.y * sy }
  };
}

function drawTile(index, y = 0) {
  const sx = index % sprites.columns * sprites.width;
  const sy = Math.floor(index / sprites.columns) * sprites.height;
  context.drawImage(atlas, sx, sy, sprites.width, sprites.height, 0, y, sprites.width, sprites.height);
}

function drawFrame({ pose, clip }) {
  if (!spriteReady) return;
  if (lastClip !== clip) {
    report('sprite-clip');
    lastClip = clip;
  }
  const tile = sprites.poses[pose];
  const direction = attention && tile.eyes !== undefined ? geometry.eyeDirection(gaze) : 'center';
  if (pose === lastPose && direction === lastEyes) return;
  context.clearRect(0, 0, sprites.width, sprites.height);
  drawTile(tile.index);
  if (direction !== 'center') drawTile(sprites.poses['eyes_' + direction].index, tile.eyes);
  if (pose !== lastPose) {
    alphaPixels = context.getImageData(0, 0, sprites.width, sprites.height).data;
    if (!lastPose) {
      let opaque = 0;
      for (let i = 3; i < alphaPixels.length; i += 4) if (alphaPixels[i]) opaque++;
      report('sprite-alpha', { opaque, transparent: sprites.width * sprites.height - opaque });
    }
  }
  // The floating sleep letters are decoration. Sample the pet before drawing them.
  if (tile.effect !== undefined) drawTile(tile.effect);
  lastPose = pose;
  lastEyes = direction;
}

function animate(now) {
  const dt = Math.min(50, Math.max(0, now - (lastFrame ?? now)));
  if (!gesture) player.advance(dt);
  const frame = player.frame(reducedMotion.matches);
  const { bounds, focus } = frameGeometry();
  const allowed = spriteReady && life.gazeEnabled && life.activity !== 'sleep'
    && !frame.clip.startsWith('sleep');
  if (!gesture || !allowed) {
    setAttention(gate.update(geometry.normalizedDistance(lastPointer, bounds, focus), allowed, dt));
    const target = geometry.gazeTarget(lastPointer, bounds, attention, focus);
    const ease = reducedMotion.matches ? 1 : 1 - Math.exp(-dt / 90);
    gaze.x += (target.x - gaze.x) * ease;
    gaze.y += (target.y - gaze.y) * ease;
  }
  drawFrame(frame);
  if (lastPointer && !gesture) updateHitTest(lastPointer.x, lastPointer.y);
  lastFrame = now;
  requestAnimationFrame(animate);
}

atlas.addEventListener('load', () => {
  spriteReady = true;
  report('sprite-ready');
});
atlas.addEventListener('error', () => {
  spriteFailed = true;
  report('sprite-error');
  renderCaption();
});
atlas.src = 'assets/red-panda/sprites.png';
context.imageSmoothingEnabled = false;

bridge.onLife(renderLife);
bridge.onCursor(point => {
  if (Number.isFinite(point?.x) && Number.isFinite(point?.y)) lastPointer = point;
});
bridge.initialState().then(state => {
  renderLife(state);
  if (spriteReady) report('sprite-ready');
});
document.addEventListener('mousemove', event => {
  lastPointer = { x: event.clientX, y: event.clientY };
  if (!gesture) updateHitTest(lastPointer.x, lastPointer.y);
});
document.addEventListener('mouseleave', () => {
  // Global samples keep the nearby gaze alive outside this tiny window.
  if (!gesture && pointerInside) {
    pointerInside = false;
    bridge.setPointerInside(false);
  }
});

function interact() {
  player.greet();
  bridge.interact();
}

requestAnimationFrame(animate);
pet.addEventListener('pointerdown', event => {
  if (event.button !== 0 || gesture) return;
  event.preventDefault();
  pet.setPointerCapture(event.pointerId);
  gesture = { id: event.pointerId, x: event.screenX, y: event.screenY, dragging: false };
});
pet.addEventListener('pointermove', event => {
  if (!gesture || event.pointerId !== gesture.id) return;
  if (!gesture.dragging && Math.hypot(event.screenX - gesture.x, event.screenY - gesture.y) >= 6) {
    gesture.dragging = true;
    bridge.beginDrag(gesture.x, gesture.y);
    document.body.classList.add('dragging');
  }
  if (gesture.dragging) bridge.moveDrag(event.screenX, event.screenY);
});
function release(event, cancelled = false) {
  if (!gesture || event.pointerId !== gesture.id) return;
  const wasDragging = gesture.dragging;
  gesture = null;
  document.body.classList.remove('dragging');
  bridge.endDrag();
  if (!wasDragging && !cancelled) interact();
  lastPointer = { x: event.clientX, y: event.clientY };
  updateHitTest(event.clientX, event.clientY);
}
pet.addEventListener('pointerup', event => release(event));
pet.addEventListener('pointercancel', event => release(event, true));
pet.addEventListener('lostpointercapture', event => release(event, true));
pet.addEventListener('contextmenu', event => { event.preventDefault(); bridge.showMenu(); });
pet.addEventListener('click', event => { if (event.detail === 0) interact(); });
window.addEventListener('blur', () => {
  if (gesture) {
    gesture = null;
    document.body.classList.remove('dragging');
    bridge.endDrag();
  }
  if (pointerInside) {
    pointerInside = false;
    bridge.setPointerInside(false);
  }
});
