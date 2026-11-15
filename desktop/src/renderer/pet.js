'use strict';
const bridge = window.desktopPet;
const geometry = window.PetGaze;
const pet = document.getElementById('pet');
let lastCaption = '';
let lastCaptionKind = '';
const video = document.getElementById('character-video');
const poseVideo = document.getElementById('attention-source');
const attentionCanvas = document.getElementById('attention-frame');
const attentionContext = attentionCanvas.getContext('2d', { willReadFrequently: true });
const alphaCanvas = document.createElement('canvas');
alphaCanvas.width = 160; alphaCanvas.height = 90;
const alphaContext = alphaCanvas.getContext('2d', { willReadFrequently: true });
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const gate = geometry.createAttentionGate();
let life = { activity: 'idle', play: 'bounce', energy: 80, gazeEnabled: true };
let gesture;
let pointerInside = false, lastPointer = null;
let videoSource = '', videoFailed = false, alphaReported = false;
let alphaPixels = null, alphaFrameAt = 0;
let poseSource = null, poseFrame = null, poseFailed = false;
let attention = false, attentionMix = 0, gaze = { x: 0, y: 0 };
let lastFrame = 0, lastDrawnGaze = { x: NaN, y: NaN };
function report(kind, clip = 'idle', extra = {}) {
  if (life.debug) bridge.diagnostic({ kind, clip, ...extra });
}
function currentClip() { return videoSource.split('/').pop()?.replace('.webm', '') || 'idle'; }
function updateHitTest(x, y) {
  const target = document.elementFromPoint(x, y);
  let next = Boolean(target?.closest('#pet'));
  if (next) {
    const rect = video.getBoundingClientRect();
    const px = Math.floor((x - rect.x) / rect.width * 160);
    const py = Math.floor((y - rect.y) / rect.height * 90);
    next = Boolean(alphaPixels && px >= 0 && py >= 0 && px < 160 && py < 90
      && alphaPixels[(py * 160 + px) * 4 + 3] > 32);
  }
  if (next !== pointerInside) { pointerInside = next; bridge.setPointerInside(next); }
}
const captions = { idle: 'hmm… what shall I do?', rest: 'getting a little sleepy…', sleep: 'a little nap…' };
function renderCaption() {
  const text = videoFailed ? 'Animation unavailable' : attention ? 'oh, what’s that?' : life.activity === 'play'
    ? (life.play === 'ball' ? 'playing with my little kitty' : 'one more turn of my cube…') : captions[life.activity];
  const kind = !attention && (life.activity === 'play' || life.activity === 'sleep') ? 'action' : 'thought';
  if (text !== lastCaption || kind !== lastCaptionKind) {
    lastCaption = text; lastCaptionKind = kind; bridge.setCaption({ kind, text });
  }
}
function renderLife(next) {
  if (!next || !['idle', 'play', 'rest', 'sleep'].includes(next.activity)) return;
  life = next;
  document.body.dataset.activity = next.activity;
  if (next.activity === 'sleep' || !next.gazeEnabled) {
    gate.update(Infinity, false, 0);
    setAttention(false);
    attentionMix = 0;
  }
  renderVideo(); renderCaption();
}
function failVideo() {
  if (videoFailed) return;
  videoFailed = true; video.pause();
  report('video-error', currentClip());
  renderCaption();
}
function renderVideo() {
  const file = life.activity === 'sleep' ? 'sleep-loop' : life.activity === 'play' ? (life.play === 'ball' ? 'play-cat' : 'play-cube') : 'idle';
  const source = `assets/dafeiyu/${file}.webm`;
  if (source !== videoSource) {
    videoSource = source; videoFailed = false; alphaReported = false; video.src = source;
  }
  if (videoFailed || reducedMotion.matches || gesture || attention) video.pause();
  else if (video.paused) video.play().catch(error => { if (error.name !== 'AbortError') failVideo(); });
}
function failPose() {
  if (poseFailed) return;
  poseFailed = true; poseSource = null; poseFrame = null;
  report('gaze-error'); setAttention(false); attentionMix = 0;
}
function preparePose() {
  if (poseSource || poseFailed || poseVideo.readyState < 2) return;
  // This separate video never plays: decode the original idle frame at t=0 once.
  if (poseVideo.currentTime > .001) { poseVideo.currentTime = 0; return; }
  try {
    attentionContext.clearRect(0, 0, 640, 360);
    attentionContext.drawImage(poseVideo, 0, 0, 640, 360);
    poseSource = attentionContext.getImageData(0, 0, 640, 360).data;
    poseFrame = attentionContext.createImageData(640, 360);
    poseFrame.data.set(poseSource);
    report('gaze-ready');
  } catch { failPose(); }
}
function setAttention(next) {
  if (attention === next) return;
  attention = next;
  report(next ? 'attention-on' : 'attention-off');
  renderVideo(); renderCaption();
}
function renderEyes() {
  if (!poseSource || (Math.abs(gaze.x - lastDrawnGaze.x) < .002 && Math.abs(gaze.y - lastDrawnGaze.y) < .002)) return;
  geometry.warpEyes(poseSource, poseFrame.data, 640, 360, gaze);
  for (const region of geometry.eyeRegions) attentionContext.putImageData(poseFrame, 0, 0, region.x, region.y, region.width, region.height);
  lastDrawnGaze = { ...gaze };
}
function frameGeometry() {
  const rect = video.getBoundingClientRect();
  const sx = rect.width / 640, sy = rect.height / 360;
  const bounds = geometry.characterBounds;
  return {
    bounds: { x: rect.x + bounds.x * sx, y: rect.y + bounds.y * sy, width: bounds.width * sx, height: bounds.height * sy },
    focus: { x: rect.x + geometry.faceAnchor.x * sx, y: rect.y + geometry.faceAnchor.y * sy }
  };
}
function updateAlpha(now) {
  if (now - alphaFrameAt < 66) return;
  try {
    alphaContext.clearRect(0, 0, 160, 90);
    if (video.readyState >= 2 && attentionMix < 1) {
      alphaContext.globalAlpha = 1 - attentionMix;
      alphaContext.drawImage(video, 0, 0, 160, 90);
    }
    if (poseSource && attentionMix > 0) {
      alphaContext.globalAlpha = attentionMix;
      alphaContext.drawImage(attentionCanvas, 0, 0, 160, 90);
    }
    alphaContext.globalAlpha = 1;
    alphaPixels = alphaContext.getImageData(0, 0, 160, 90).data;
    alphaFrameAt = now;
    if (!alphaReported && video.readyState >= 2 && attentionMix === 0) {
      let opaque = 0, transparent = 0;
      for (let i = 3; i < alphaPixels.length; i += 4) { if (alphaPixels[i] > 32) opaque++; else transparent++; }
      report('video-alpha', currentClip(), { opaque, transparent }); alphaReported = true;
    }
  } catch { alphaPixels = null; failVideo(); }
}
function animate(now) {
  const dt = Math.min(50, Math.max(0, now - lastFrame));
  const { bounds, focus } = frameGeometry();
  const allowed = Boolean(poseSource && !poseFailed && life.gazeEnabled && life.activity !== 'sleep' && !videoFailed);
  if (!gesture || !allowed) setAttention(gate.update(geometry.normalizedDistance(lastPointer, bounds, focus), allowed, dt));
  const target = geometry.gazeTarget(lastPointer, bounds, attention, focus);
  if (!gesture) {
    const ease = reducedMotion.matches ? 1 : 1 - Math.exp(-dt / 90);
    gaze.x += (target.x - gaze.x) * ease; gaze.y += (target.y - gaze.y) * ease;
  }
  const targetMix = videoFailed && poseSource ? 1 : attention ? 1 : 0;
  if (life.activity === 'sleep' && !videoFailed) attentionMix = 0;
  else attentionMix += Math.sign(targetMix - attentionMix) * Math.min(Math.abs(targetMix - attentionMix), reducedMotion.matches ? 1 : dt / 120);
  if (attentionMix > 0) renderEyes();
  attentionCanvas.style.opacity = String(attentionMix);
  video.style.opacity = String(1 - attentionMix);
  updateAlpha(now);
  if (lastPointer && !gesture) updateHitTest(lastPointer.x, lastPointer.y);
  lastFrame = now; requestAnimationFrame(animate);
}
video.addEventListener('loadeddata', () => { alphaFrameAt = 0; report('video-ready', currentClip()); renderVideo(); });
video.addEventListener('error', failVideo);
poseVideo.addEventListener('loadeddata', preparePose);
poseVideo.addEventListener('seeked', preparePose);
poseVideo.addEventListener('error', failPose);
preparePose();
reducedMotion.addEventListener('change', renderVideo);
bridge.onLife(renderLife);
bridge.onCursor(point => { if (Number.isFinite(point?.x) && Number.isFinite(point?.y)) lastPointer = point; });
bridge.initialState().then(state => { renderLife(state); if (poseSource) report('gaze-ready'); });
document.addEventListener('mousemove', event => {
  lastPointer = { x: event.clientX, y: event.clientY };
  if (!gesture) updateHitTest(lastPointer.x, lastPointer.y);
});
document.addEventListener('mouseleave', () => {
  // Global samples keep the nearby gaze alive outside this tiny window.
  if (!gesture && pointerInside) { pointerInside = false; bridge.setPointerInside(false); }
});
requestAnimationFrame(animate);
pet.addEventListener('pointerdown', event => {
  if (event.button !== 0 || gesture) return;
  event.preventDefault(); pet.setPointerCapture(event.pointerId);
  gesture = { id: event.pointerId, x: event.screenX, y: event.screenY, dragging: false };
  video.pause();
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
  document.body.classList.remove('dragging'); bridge.endDrag(); renderVideo();
  if (!wasDragging && !cancelled) bridge.interact();
  lastPointer = { x: event.clientX, y: event.clientY }; updateHitTest(event.clientX, event.clientY);
}
pet.addEventListener('pointerup', event => release(event));
pet.addEventListener('pointercancel', event => release(event, true));
pet.addEventListener('lostpointercapture', event => release(event, true));
pet.addEventListener('contextmenu', event => { event.preventDefault(); bridge.showMenu(); });
pet.addEventListener('click', event => { if (event.detail === 0) bridge.interact(); });
window.addEventListener('blur', () => {
  if (gesture) { gesture = null; document.body.classList.remove('dragging'); bridge.endDrag(); renderVideo(); }
  if (pointerInside) { pointerInside = false; bridge.setPointerInside(false); }
});
