'use strict';
const bridge = window.desktopPet;
const geometry = window.PetGaze;
const packs = window.PetCharacterPacks;
const pack = packs.dafeiyu;
const pet = document.getElementById('pet');
const canvas = document.getElementById('character-frame');
const context = canvas.getContext('2d');
const scratch = document.createElement('canvas');
scratch.width = canvas.width = pack.width; scratch.height = canvas.height = pack.height;
const scratchContext = scratch.getContext('2d', { willReadFrequently: true });
const alphaCanvas = document.createElement('canvas');
alphaCanvas.width = 160; alphaCanvas.height = 90;
const alphaContext = alphaCanvas.getContext('2d', { willReadFrequently: true });
Object.assign(canvas.style, Object.fromEntries(Object.entries(pack.display).map(([key, value]) => [key, `${value}px`])));
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const reactionGate = window.PetCursorReaction.createReactionGate();
let life = { activity: 'idle', play: 'cube', energy: 80, gazeEnabled: true };
let gesture, lastPointer = null, pointerInside = false, alphaPixels = null;
let lastCaption = '', lastCaptionKind = '';
let lastCaptionAnchor = '';
let lookGaze = { x: 0, y: 0 };
let lastFrame = 0, visibleClip = '', visibleTime = 0, hasVideoFrame = false;
let motionPending = false;
let lastRaw = null, lastRawTime = -1, lastRawClip = '';
const reportedAlpha = new Set();
function report(kind, clip = visibleClip || pack.initial, extra = {}) {
  if (life.debug) bridge.diagnostic({ kind, clip, ...extra });
}
function readAlpha() {
  alphaContext.clearRect(0, 0, 160, 90);
  alphaContext.drawImage(canvas, 0, 0, 160, 90);
  alphaPixels = alphaContext.getImageData(0, 0, 160, 90).data;
}
function present(source, clip) {
  try {
    const playbackTime = source.currentTime ?? 0;
    // Background decode buffers may not receive every compositor callback.
    // Never let a stale callback freeze the canvas or select an old eye pose.
    const time = Number.isFinite(source.decodedTime) && Math.abs(source.decodedTime - playbackTime) <= .08
      ? source.decodedTime : playbackTime;
    if (!lastRaw || playbackTime !== lastRawTime || clip !== lastRawClip) {
      scratchContext.clearRect(0, 0, pack.width, pack.height);
      scratchContext.drawImage(source, 0, 0, pack.width, pack.height);
      const frame = scratchContext.getImageData(0, 0, pack.width, pack.height);
      let opaque = 0;
      for (let index = 3; index < frame.data.length; index += 64) if (frame.data[index] > 32) opaque++;
      if (opaque < 20) return false;
      lastRaw = frame; lastRawTime = playbackTime; lastRawClip = clip;
    }
    // Ordinary activities and authored reaction clips are shown unchanged.
    // Cursor interaction switches modes; it never deforms eyes on an action.
    if (clip !== visibleClip) {
      const display = pack.clips[clip]?.display || pack.display;
      Object.assign(canvas.style, Object.fromEntries(Object.entries(display).map(([key, value]) => [key, `${value}px`])));
    }
    if (pack.clips[clip]?.look) {
      // Only the dedicated front-facing attention pose follows eyes.
      // Normal action clips never pass through this deformation path.
      const looking = new ImageData(new Uint8ClampedArray(lastRaw.data), pack.width, pack.height);
      geometry.warpEyes(lastRaw.data, looking.data, pack.width, pack.height, lookGaze, pack.defaultEyeRegions);
      context.putImageData(looking, 0, 0);
    } else context.putImageData(lastRaw, 0, 0);
    visibleClip = clip; visibleTime = time; hasVideoFrame = true;
    renderCaption();
    readAlpha();
    if (!reportedAlpha.has(clip)) {
      let opaque = 0, transparent = 0;
      for (let i = 3; i < alphaPixels.length; i += 4) { if (alphaPixels[i] > 32) opaque++; else transparent++; }
      report('video-alpha', clip, { opaque, transparent }); reportedAlpha.add(clip);
    }
    return true;
  } catch { return false; }
}
const player = window.PetAnimation.createPlayer({
  pack, nextClip: packs.nextClip, present, report,
  makeVideo() {
    const video = document.createElement('video');
    video.muted = true; video.playsInline = true; video.preload = 'auto';
    video.setAttribute('aria-hidden', 'true'); video.className = 'decode-buffer';
    if (video.requestVideoFrameCallback) {
      const decoded = (_now, metadata) => { video.decodedTime = metadata.mediaTime; video.requestVideoFrameCallback(decoded); };
      video.requestVideoFrameCallback(decoded);
    }
    document.body.appendChild(video); return video;
  }
});
const poster = new Image();
poster.onload = () => {
  if (hasVideoFrame) return;
  context.clearRect(0, 0, pack.width, pack.height); context.drawImage(poster, 0, 0, pack.width, pack.height); readAlpha();
};
poster.src = pack.poster;
function syncFreeze() {
  if (gesture || reducedMotion.matches) player.cancelReaction();
  player.freeze(Boolean(gesture) || reducedMotion.matches, !gesture && reducedMotion.matches);
}
function updateHitTest(x, y) {
  let next = Boolean(document.elementFromPoint(x, y)?.closest('#pet'));
  if (next) {
    const rect = canvas.getBoundingClientRect();
    const px = Math.floor((x - rect.x) / rect.width * 160), py = Math.floor((y - rect.y) / rect.height * 90);
    next = Boolean(alphaPixels && px >= 0 && py >= 0 && px < 160 && py < 90 && alphaPixels[(py * 160 + px) * 4 + 3] > 32);
  }
  if (next !== pointerInside) { pointerInside = next; bridge.setPointerInside(next); }
}
function renderCaption() {
  const caption = pack.captions?.[visibleClip || pack.initial] || { kind: 'thought', text: 'hmm…' };
  const resting = visibleClip === pack.initial && life.activity === 'rest';
  const text = resting ? 'getting a little sleepy…' : caption.text;
  const kind = resting ? 'thought' : caption.kind;
  const anchor = pack.clips[visibleClip]?.bubbleAnchor || pack.bubbleAnchor;
  const anchorKey = `${anchor.x},${anchor.y}`;
  if (text !== lastCaption || kind !== lastCaptionKind || anchorKey !== lastCaptionAnchor) {
    lastCaption = text; lastCaptionKind = kind; lastCaptionAnchor = anchorKey; bridge.setCaption({ kind, text, anchor });
  }
}
function renderLife(next) {
  if (!next || !['idle', 'play', 'rest', 'sleep'].includes(next.activity)) return;
  life = next; document.body.dataset.activity = next.activity;
  if (!next.gazeEnabled || next.cursorPlayAllowed === false || next.activity === 'sleep' || next.manualNap) player.cancelReaction();
  player.request(packs.activityClip(pack, next), { immediate: Boolean(next.manualNap) }); syncFreeze(); renderCaption();
}
function frameGeometry() {
  const rect = canvas.getBoundingClientRect(), sx = rect.width / pack.width, sy = rect.height / pack.height;
  const bounds = pack.bounds, face = pack.face;
  return { bounds: { x: rect.x + bounds.x * sx, y: rect.y + bounds.y * sy, width: bounds.width * sx, height: bounds.height * sy },
    focus: { x: rect.x + face.x * sx, y: rect.y + face.y * sy } };
}
function animate(now) {
  const dt = Math.min(50, Math.max(0, now - lastFrame));
  const { bounds, focus } = frameGeometry();
  const before = player.inspect();
  const sleeping = life.activity === 'sleep' || Boolean(life.manualNap) || [pack.sleep.enter, pack.sleep.loop, pack.sleep.exit].includes(before.active);
  const busy = Boolean(before.reaction || before.reactionPending);
  const lookTarget = geometry.gazeTarget(lastPointer, bounds, before.reaction === 'attention-look', focus);
  const ease = 1 - Math.exp(-dt / 90);
  lookGaze.x += (lookTarget.x - lookGaze.x) * ease; lookGaze.y += (lookTarget.y - lookGaze.y) * ease;
  const nearby = reactionGate.update({ ratio: geometry.normalizedDistance(lastPointer, bounds, focus),
    allowed: Boolean(before.active) && life.gazeEnabled && life.cursorPlayAllowed !== false, held: Boolean(gesture), sleeping,
    reducedMotion: reducedMotion.matches, milliseconds: dt });
  if (nearby && !busy) player.react(pack.reactions[0]);
  else if (!nearby && busy) player.cancelReaction();
  player.draw();
  const motion = player.inspect();
  const reacting = Boolean(motion.reaction || motion.reactionPending);
  const pending = reacting || (!motion.blocked && motion.active !== packs.activityClip(pack, life));
  if (pending !== motionPending) { motionPending = pending; bridge.setMotionPending?.(pending); }
  if (lastPointer && !gesture) updateHitTest(lastPointer.x, lastPointer.y);
  lastFrame = now; requestAnimationFrame(animate);
}
reducedMotion.addEventListener('change', syncFreeze);
bridge.onLife(renderLife);
bridge.onCursor(point => { if (Number.isFinite(point?.x) && Number.isFinite(point?.y)) lastPointer = point; });
bridge.initialState().then(renderLife);
document.addEventListener('mousemove', event => { lastPointer = { x: event.clientX, y: event.clientY }; if (!gesture) updateHitTest(lastPointer.x, lastPointer.y); });
document.addEventListener('mouseleave', () => {
  if (!gesture && pointerInside) { pointerInside = false; bridge.setPointerInside(false); }
});
syncFreeze(); player.start(); requestAnimationFrame(animate);
pet.addEventListener('pointerdown', event => {
  if (event.button !== 0 || gesture) return;
  event.preventDefault(); pet.setPointerCapture(event.pointerId);
  gesture = { id: event.pointerId, x: event.screenX, y: event.screenY, dragging: false };
  syncFreeze();
});
pet.addEventListener('pointermove', event => {
  if (!gesture || event.pointerId !== gesture.id) return;
  if (!gesture.dragging && Math.hypot(event.screenX - gesture.x, event.screenY - gesture.y) >= 6) {
    gesture.dragging = true; bridge.beginDrag(gesture.x, gesture.y); document.body.classList.add('dragging');
  }
  if (gesture.dragging) bridge.moveDrag(event.screenX, event.screenY);
});
function release(event, cancelled = false) {
  if (!gesture || event.pointerId !== gesture.id) return;
  const wasDragging = gesture.dragging; gesture = null;
  document.body.classList.remove('dragging'); bridge.endDrag(); syncFreeze();
  if (!wasDragging && !cancelled) bridge.interact();
  lastPointer = { x: event.clientX, y: event.clientY }; updateHitTest(event.clientX, event.clientY);
}
pet.addEventListener('pointerup', event => release(event));
pet.addEventListener('pointercancel', event => release(event, true));
pet.addEventListener('lostpointercapture', event => release(event, true));
pet.addEventListener('contextmenu', event => { event.preventDefault(); bridge.showMenu(); });
pet.addEventListener('click', event => { if (event.detail === 0) bridge.interact(); });
window.addEventListener('blur', () => {
  if (gesture) { gesture = null; document.body.classList.remove('dragging'); bridge.endDrag(); syncFreeze(); }
  if (pointerInside) { pointerInside = false; bridge.setPointerInside(false); }
});
