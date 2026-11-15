'use strict';
const bridge = window.desktopPet;
const geometry = window.PetGaze;
const packs = window.PetCharacterPacks;
let pack = packs.redPanda;
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
let reactionGate = window.PetCursorReaction.createReactionGate();
let life = { activity: 'idle', play: 'cube', energy: 80, gazeEnabled: true };
let gesture, lastPointer = null, pointerInside = false, alphaPixels = null;
let lastCaption = '', lastCaptionKind = '';
let lastCaptionAnchor = '';
let lookGaze = { x: 0, y: 0 };
let lastFrame = 0, visibleClip = '', visibleTime = 0, hasVideoFrame = false;
let motionPending = false;
let lastRaw = null, lastRawTime = -1, lastRawClip = '';
const reportedAlpha = new Set();
let actorVersion = 0, player;
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
    const definition = pack.clips[clip];
    const playbackTime = source.currentTime ?? 0;
    // Background decode buffers may not receive every compositor callback.
    // Never let a stale callback freeze the canvas or select an old eye pose.
    const time = Number.isFinite(source.decodedTime) && Math.abs(source.decodedTime - playbackTime) <= .08
      ? source.decodedTime : playbackTime;
    if (!lastRaw || playbackTime !== lastRawTime || clip !== lastRawClip) {
      scratchContext.imageSmoothingEnabled = pack.kind !== 'atlas';
      scratchContext.clearRect(0, 0, pack.width, pack.height);
      scratchContext.drawImage(source, 0, 0, pack.width, pack.height);
      const frame = scratchContext.getImageData(0, 0, pack.width, pack.height);
      let opaque = 0;
      for (let index = 3; index < frame.data.length; index += 64) if (frame.data[index] > 32) opaque++;
      if (opaque < 20) return false;
      lastRaw = frame; lastRawTime = playbackTime; lastRawClip = clip;
    }
    if (clip !== visibleClip) {
      canvas.style.imageRendering = pack.kind === 'atlas' ? 'pixelated' : 'auto';
      const display = definition?.display || pack.display;
      Object.assign(canvas.style, Object.fromEntries(Object.entries(display).map(([key, value]) => [key, `${value}px`])));
    }
    if (definition?.look || definition?.restingEyes) {
      const looking = new ImageData(new Uint8ClampedArray(lastRaw.data), pack.width, pack.height);
      const gaze = definition.look ? lookGaze : pack.restingGaze;
      const regions = definition.eyeRegions || pack.defaultEyeRegions;
      geometry.warpEyes(lastRaw.data, looking.data, pack.width, pack.height, gaze, regions);
      if (pack.kind === 'sprite') {
        // The sprite's authored transparency controls desktop click-through.
        for (const { x, y, width, height } of regions) {
          for (let row = y; row < y + height; row++) {
            for (let column = x; column < x + width; column++) {
              const index = (row * pack.width + column) * 4 + 3;
              looking.data[index] = lastRaw.data[index];
            }
          }
        }
      }
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
function createActor() {
  const version = ++actorVersion;
  const configuration = {
    pack, nextClip: packs.nextClip,
    present: (source, clip) => version === actorVersion && present(source, clip),
    report: (kind, clip, extra) => { if (version === actorVersion) report(kind, clip, extra); },
    makeImage: () => new Image(),
    makeCanvas: () => document.createElement('canvas'),
    makeVideo() {
      const video = document.createElement('video');
      video.muted = true; video.playsInline = true; video.preload = 'auto';
      video.setAttribute('aria-hidden', 'true'); video.className = 'decode-buffer';
      let disposed = false, callback;
      if (video.requestVideoFrameCallback) {
        const decoded = (_now, metadata) => {
          if (disposed) return;
          video.decodedTime = metadata.mediaTime; callback = video.requestVideoFrameCallback(decoded);
        };
        callback = video.requestVideoFrameCallback(decoded);
      }
      video.disposeFrameCallbacks = () => { disposed = true; if (callback !== undefined) video.cancelVideoFrameCallback?.(callback); };
      document.body.appendChild(video); return video;
    }
  };
  const adapter = pack.kind === 'atlas' ? window.PetAtlasPlayer
    : pack.kind === 'sprite' ? window.PetSprite : window.PetAnimation;
  const actor = adapter.createPlayer(configuration);
  const start = actor.start.bind(actor);
  let started = false;
  actor.start = () => {
    if (started || version !== actorVersion) return;
    started = true;
    if (pack.poster) {
    const poster = new Image();
    poster.onload = () => {
      if (version !== actorVersion || hasVideoFrame) return;
      context.clearRect(0, 0, pack.width, pack.height); context.drawImage(poster, 0, 0, pack.width, pack.height); readAlpha();
    };
    poster.src = pack.poster;
    }
    start();
  };
  return actor;
}
function selectCharacter(id) {
  const selected = packs.resolvePack(id);
  if (selected.id === pack.id) return;
  player.dispose?.();
  pack = selected;
  lastRaw = null; lastRawTime = -1; lastRawClip = ''; visibleClip = ''; hasVideoFrame = false;
  reportedAlpha.clear(); lastCaption = lastCaptionKind = lastCaptionAnchor = '';
  lookGaze = { x: 0, y: 0 };
  reactionGate = window.PetCursorReaction.createReactionGate();
  player = createActor();
  syncFreeze(); player.request(packs.activityClip(pack, life), { immediate: Boolean(life.manualNap) }); player.start();
}
player = createActor();
function syncFreeze() {
  const held = Boolean(gesture || life.held);
  if (held || reducedMotion.matches) player.cancelReaction();
  player.freeze(held || reducedMotion.matches, !held && reducedMotion.matches);
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
  selectCharacter(next.characterId);
  if (!next.gazeEnabled || next.cursorPlayAllowed === false || next.activity === 'sleep' || next.manualNap) player.cancelReaction();
  player.request(packs.activityClip(pack, next), { immediate: Boolean(next.manualNap) }); syncFreeze(); player.start(); renderCaption();
}
function frameGeometry(clip) {
  const rect = canvas.getBoundingClientRect(), sx = rect.width / pack.width, sy = rect.height / pack.height;
  const bounds = pack.clips[clip]?.bounds || pack.bounds;
  const face = pack.clips[clip]?.face || pack.face;
  return { bounds: { x: rect.x + bounds.x * sx, y: rect.y + bounds.y * sy, width: bounds.width * sx, height: bounds.height * sy },
    focus: { x: rect.x + face.x * sx, y: rect.y + face.y * sy } };
}
function animate(now) {
  const dt = Math.min(50, Math.max(0, now - lastFrame));
  const proximity = frameGeometry();
  const before = player.inspect();
  const sleeping = life.activity === 'sleep' || Boolean(life.manualNap) || [pack.sleep?.enter, pack.sleep?.loop, pack.sleep?.exit].filter(Boolean).includes(before.active);
  const busy = Boolean(before.reaction || before.reactionPending);
  const looking = pack.clips[visibleClip]?.look || pack.clips[before.reaction]?.directional;
  const gazeFrame = looking ? frameGeometry(visibleClip) : proximity;
  const lookTarget = looking
    ? geometry.gazeTarget(lastPointer, gazeFrame.bounds, true, gazeFrame.focus) : { x: 0, y: 0 };
  const ease = reducedMotion.matches ? 1 : 1 - Math.exp(-dt / (pack.attentionEaseMs || 90));
  lookGaze.x += (lookTarget.x - lookGaze.x) * ease; lookGaze.y += (lookTarget.y - lookGaze.y) * ease;
  const nearby = reactionGate.update({ ratio: geometry.normalizedDistance(lastPointer, proximity.bounds, proximity.focus),
    allowed: Boolean(before.active) && life.gazeEnabled && life.cursorPlayAllowed !== false, held: Boolean(gesture || life.held), sleeping,
    reducedMotion: reducedMotion.matches, milliseconds: dt });
  if (nearby && !busy) player.react(pack.reactions[0]);
  else if (!nearby && busy) player.cancelReaction();
  player.setGaze?.(lookGaze);
  player.draw();
  const motion = player.inspect();
  const reacting = Boolean(motion.reaction || motion.reactionPending);
  const pending = reacting || (!motion.blocked && motion.active !== packs.activityClip(pack, life));
  if (pending !== motionPending) { motionPending = pending; bridge.setMotionPending?.(pending); }
  if (lastPointer && !gesture) updateHitTest(lastPointer.x, lastPointer.y);
  lastFrame = now; requestAnimationFrame(animate);
}
reducedMotion.addEventListener('change', syncFreeze);
let liveStateSeen = false;
bridge.onLife(state => { liveStateSeen = true; renderLife(state); });
bridge.onCursor(point => { if (Number.isFinite(point?.x) && Number.isFinite(point?.y)) lastPointer = point; });
bridge.initialState().then(state => { if (!liveStateSeen) renderLife(state); }).catch(() => { if (!liveStateSeen) player.start(); });
document.addEventListener('mousemove', event => { lastPointer = { x: event.clientX, y: event.clientY }; if (!gesture) updateHitTest(lastPointer.x, lastPointer.y); });
document.addEventListener('mouseleave', () => {
  if (!gesture && pointerInside) { pointerInside = false; bridge.setPointerInside(false); }
});
syncFreeze(); requestAnimationFrame(animate);
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
