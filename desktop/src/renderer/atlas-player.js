'use strict';
(function (root) {
  // A timed RGBA atlas. Routes consume authored entrances/exits; attention
  // replaces just the eyes on the current pose and never changes its clock.
  function createPlayer({ pack, present, makeImage = () => new Image(),
    makeCanvas = () => document.createElement('canvas'), report = () => {},
    now = () => performance.now() }) {
    const image = makeImage();
    const canvas = makeCanvas();
    canvas.width = pack.width;
    canvas.height = pack.height;
    const context = canvas.getContext('2d');
    context.imageSmoothingEnabled = false;
    const { atlas, placement, groups, clips } = pack;
    let active, desired = pack.initial, index = 0, elapsed = 0, lastTick;
    let ready = false, blocked = false, disposed = false, frozen = false, staticMode = false;
    let startedAt, reaction, eyeFrame = 53, revision = 0, painted;
    const reportClip = () => report('clip-visible', active);

    function crop(frame) {
      return [frame % atlas.columns * atlas.width, Math.floor(frame / atlas.columns) * atlas.height];
    }
    function fail(clip) {
      blocked = true;
      report('video-error', clip);
    }
    function paint() {
      if (!ready || blocked || disposed || !active) return;
      const [frame] = clips[active].frames[index];
      const faceOffset = atlas.eyeOffsets[frame];
      const eyes = reaction && faceOffset != null && eyeFrame !== 53 ? eyeFrame : null;
      const visible = reaction || active;
      const key = `${frame}:${eyes}:${visible}`;
      if (key === painted) return;
      try {
        const [x, y] = crop(frame);
        const { left, top, scale } = placement;
        context.clearRect(0, 0, pack.width, pack.height);
        context.drawImage(image, x, y, atlas.width, atlas.height,
          left, top, atlas.width * scale, atlas.height * scale);
        if (eyes != null) {
          const [sourceX, sourceY] = crop(eyes);
          const [eyeX, eyeY, width, height] = atlas.eyePatch;
          context.drawImage(image, sourceX + eyeX, sourceY + eyeY, width, height,
            left + eyeX * scale, top + (eyeY + faceOffset) * scale, width * scale, height * scale);
        }
        canvas.currentTime = ++revision;
        if (present(canvas, visible)) painted = key;
        else fail(visible);
      } catch { fail(visible); }
    }
    function begin(clip) {
      active = clip;
      index = 0;
      elapsed = 0;
      paint();
      if (!blocked) reportClip();
    }
    function startGroup(group) {
      return groups[group].enter || groups[group].loop;
    }
    function advance() {
      const { group, phase, frames } = clips[active];
      const target = clips[desired].group;
      if (phase === 'loop' && group !== target) {
        begin(groups[group].exit || startGroup(target));
      } else if (index + 1 < frames.length) {
        index++;
      } else if (phase === 'enter') {
        begin(group === target ? groups[group].loop : groups[group].exit || startGroup(target));
      } else if (phase === 'exit') {
        begin(startGroup(target));
      } else {
        index = 0;
      }
    }
    function awake() {
      return active && clips[active].group !== 'sleep' && clips[desired].group !== 'sleep';
    }
    image.onload = () => {
      if (disposed || blocked) return;
      ready = true;
      report('video-ready', desired);
      begin(staticMode ? desired : startGroup(clips[desired].group));
    };
    image.onerror = () => { if (!disposed) fail(desired); };

    return {
      start() {
        if (disposed || startedAt !== undefined) return;
        startedAt = now();
        image.src = atlas.source;
      },
      request(clip, { immediate = false } = {}) {
        if (disposed || clips[clip]?.phase !== 'loop' || desired === clip) return;
        desired = clip;
        if (!awake()) this.cancelReaction();
        if (!ready || blocked || (frozen && !staticMode)) return;
        const current = clips[active];
        if (staticMode) {
          begin(desired);
        } else if (current.phase === 'loop' && current.group !== clips[desired].group
          && (immediate || !groups[current.group].exit)) {
          // No sitting exit is skipped. Shared standing poses need not hold an
          // entire idle or tired frame before starting the next authored entry.
          begin(groups[current.group].exit || startGroup(clips[desired].group));
        }
      },
      react({ clip }) {
        if (disposed || blocked || frozen || reaction || !awake() || !clips[clip]?.directional) return false;
        eyeFrame = 53;
        reaction = clip;
        report('attention-on', clip);
        paint();
        return true;
      },
      setGaze({ x, y }) {
        if (!reaction) return;
        // The source gaze track paints a 3-by-3 grid with a neutral center.
        const column = x < -.22 ? 0 : x > .22 ? 2 : 1;
        const row = y < -.30 ? 0 : y > .30 ? 2 : 1;
        eyeFrame = pack.gazeFrames[row][column];
      },
      cancelReaction() {
        if (!reaction) return;
        report('attention-off', reaction);
        reaction = undefined;
        paint();
      },
      freeze(value, allowStaticTransitions = false) {
        const wasFrozen = frozen;
        frozen = Boolean(value);
        staticMode = frozen && allowStaticTransitions;
        if (frozen !== wasFrozen) lastTick = undefined;
        if (frozen) this.cancelReaction();
        if (ready && staticMode && active !== desired) begin(desired);
      },
      draw() {
        if (disposed || blocked) return;
        const time = now();
        if (!ready && startedAt !== undefined && time - startedAt > 5000) fail(desired);
        if (!ready || !active || frozen) return;
        if (lastTick !== undefined) elapsed += Math.max(0, Math.min(100, time - lastTick));
        lastTick = time;
        const duration = clips[active].frames[index][1];
        if (elapsed >= duration) {
          elapsed -= duration;
          advance();
        }
        paint();
      },
      current() {
        return active && { clip: reaction || active, frame: clips[active].frames[index][0], time: elapsed / 1000 };
      },
      inspect() { return { active, reaction, blocked, ready }; },
      dispose() {
        disposed = true;
        image.onload = image.onerror = null;
        image.src = '';
      }
    };
  }
  const api = { createPlayer };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.PetAtlasPlayer = api;
})(globalThis);
