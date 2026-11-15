'use strict';
(function (root) {
  // Original atlas poses share a ground anchor. This adapter presents still art
  // through the same actor contract as video without inventing animation frames.
  function createPlayer({ pack, present, makeImage = () => new Image(), makeCanvas = () => document.createElement('canvas'),
    report = () => {}, now = () => Date.now() }) {
    const image = makeImage(), canvas = makeCanvas(), context = canvas.getContext('2d');
    canvas.width = pack.width; canvas.height = pack.height;
    let desired = pack.initial, active = null, reaction = null, ready = false, failed = false, disposed = false;
    let frozen = false, staticMode = false, revision = 0, startedAt = null, renderedPose = null;
    const sleepClips = new Set(Object.values(pack.sleep || {}));
    function paint(clip) {
      const definition = pack.clips[clip];
      if (!ready || failed || disposed || !definition?.sprite) return false;
      try {
        const pose = pack.sprites[definition.sprite];
        if (renderedPose !== definition.sprite) {
          context.clearRect(0, 0, pack.width, pack.height);
          context.drawImage(image, ...pose.crop, ...pose.destination);
          renderedPose = definition.sprite; canvas.currentTime = ++revision;
        }
        if (!present(canvas, clip)) { failed = true; report('video-error', clip); return false; }
        return true;
      } catch { failed = true; report('video-error', clip); return false; }
    }
    function commit() {
      if (reaction || desired === active || (frozen && !staticMode) || !paint(desired)) return false;
      active = desired;
      report('clip-visible', active);
      return true;
    }
    image.onload = () => { if (disposed) return; ready = true; report('video-ready', desired); commit(); };
    image.onerror = () => { if (disposed) return; failed = true; report('video-error', desired); };
    return {
      start() { if (!disposed && startedAt === null) { startedAt = now(); image.src = pack.atlas; } },
      request(clip) { if (disposed || !pack.clips[clip]) return; desired = clip; commit(); },
      react({ clip }) {
        if (disposed || frozen || !active || sleepClips.has(active) || reaction || !pack.clips[clip]?.look || !paint(clip)) return false;
        reaction = clip;
        report('attention-on', clip);
        return true;
      },
      cancelReaction() {
        if (!reaction || disposed) return;
        report('attention-off', reaction);
        reaction = null;
        if (!commit()) paint(active);
      },
      freeze(value, allowStaticTransitions = false) {
        frozen = Boolean(value); staticMode = frozen && allowStaticTransitions;
        if (!frozen || staticMode) commit();
      },
      draw() {
        if (disposed) return;
        if (!ready && startedAt !== null && now() - startedAt > 5000) failed = true;
        if (frozen && !staticMode) return;
        if (reaction) paint(reaction);
        else if (!active) commit();
      },
      current() { const clip = reaction || active; return clip && { clip, time: 0 }; },
      inspect() { return { active: active || undefined, reaction: reaction || undefined, blocked: failed, ready, boundary: true }; },
      dispose() { disposed = true; reaction = active = null; image.onload = image.onerror = null; image.src = ''; }
    };
  }
  const api = { createPlayer };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.PetSprite = api;
})(globalThis);
