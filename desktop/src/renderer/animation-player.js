'use strict';
(function (root) {
  // Both videos are decode buffers. The visible canvas changes only after a
  // candidate has supplied a usable frame; loading never clears that canvas.
  function createPlayer({ pack, nextClip, makeVideo, present, report = () => {}, now = () => Date.now() }) {
    let active = null, pending = null, desired = pack.initial, frozen = false, staticMode = false, boundary = true;
    let sequence = 0, disposed = false;
    let reaction = null, reactionPending = null;
    const failed = new Set();
    const buffers = [makeVideo(), makeVideo()];
    const reactionVideo = makeVideo();
    function finishReaction() {
      if (!reaction && !reactionPending) return;
      reactionVideo.pause(); reaction = null; reactionPending = null;
      if (active) {
        active.progressAt = now();
        present(active.video, active.clip);
        if (!frozen) { if (boundary) advance(); else play(active); }
      }
    }
    function rejectReaction(slot) {
      if (slot !== reaction && slot !== reactionPending) return;
      failed.add(slot.clip); report('video-error', slot.clip); finishReaction();
    }
    function requestReaction({ clip, from = 0, to = 4, rate = 1, still = false, duration = 5, sustained = false }) {
      if (disposed || !active || frozen || reaction || reactionPending || failed.has(clip) || !pack.clips[clip]) return false;
      const speed = Math.max(.75, Math.min(1.5, Number(rate) || 1));
      const start = Math.max(0, Number(from) || 0);
      const end = Math.max(start + 2 * speed, Math.min(start + 5 * speed, Number(to) || start + 4));
      const slot = { video: reactionVideo, clip, from: start, to: end, rate: speed, still: Boolean(still),
        duration: still && sustained && pack.clips[clip].look ? Infinity : Math.max(2, Math.min(5, Number(duration) || 5)),
        loaded: false, startedAt: now(), progressAt: now(), lastTime: -1 };
      reactionPending = slot;
      function ready() {
        if (reactionPending !== slot || frozen || !slot.loaded || reactionVideo.readyState < 2
          || reactionVideo.seeking || Math.abs(reactionVideo.currentTime - start) > .08) return;
        if (!present(reactionVideo, clip)) { rejectReaction(slot); return; }
        active.video.pause(); reactionPending = null; reaction = slot; slot.startedAt = slot.progressAt = now();
        report('clip-visible', clip);
        const playback = slot.still ? undefined : reactionVideo.play();
        playback?.catch(error => { if (error?.name !== 'AbortError') rejectReaction(slot); });
      }
      reactionVideo.pause(); reactionVideo.playbackRate = speed;
      reactionVideo.onloadeddata = () => {
        if (reactionPending !== slot) return;
        slot.loaded = true;
        if (start > .001) reactionVideo.currentTime = start; else ready();
      };
      reactionVideo.onseeked = ready;
      reactionVideo.onerror = () => rejectReaction(slot);
      reactionVideo.onended = () => { if (reaction === slot) finishReaction(); };
      reactionVideo.decodedTime = undefined; reactionVideo.src = pack.clips[clip].source; reactionVideo.load();
      return true;
    }
    function play(slot) {
      if (disposed || !slot || frozen || slot.still) return;
      const result = slot.video.play();
      if (result?.catch) result.catch(error => {
        if (error?.name !== 'AbortError') { if (reaction === slot) rejectReaction(slot); else if (active === slot) fail(slot); }
      });
    }
    function fail(slot) {
      if (slot !== pending && slot !== active) return;
      failed.add(slot.clip); report('video-error', slot.clip);
      if (slot === pending) pending = null;
      if (slot === active) { slot.video.pause(); boundary = true; }
      // A failed replacement cannot erase the visible/current animation.
      if (active && slot !== active && boundary && !frozen) restart();
      if (slot === active && slot.clip !== pack.initial) queue(pack.initial);
    }
    function queue(clip) {
      if (!pack.clips[clip] || failed.has(clip) || pending?.clip === clip) return;
      const video = buffers.find(item => item !== active?.video);
      video.pause();
      const slot = { video, clip, token: ++sequence, ready: false, startedAt: now(), progressAt: now(), lastTime: -1 };
      pending = slot;
      video.onloadeddata = () => {
        if (pending !== slot) return;
        slot.ready = true; report('video-ready', clip);
        if (boundary || !active || staticMode) commit();
      };
      video.onerror = () => fail(slot);
      video.onended = () => { if (active === slot) { boundary = true; if (!reaction) advance(); } };
      video.decodedTime = undefined; video.src = pack.clips[clip].source; video.load();
    }
    function prepare() {
      const next = nextClip(pack, active?.clip, desired);
      // A failed new target still supersedes an older queued action. Otherwise
      // a quick Wake → Nap could accidentally publish that obsolete action.
      if (pending && pending.clip !== next) { pending.video.pause(); pending = null; }
      if (next !== active?.clip) queue(next);
      else if (pending) { pending.video.pause(); pending = null; }
    }
    function commit() {
      if (reaction || !pending?.ready || (frozen && active && !staticMode) || (!boundary && active && !staticMode)) return false;
      const candidate = pending;
      if (!present(candidate.video, candidate.clip)) { fail(candidate); return false; }
      active?.video.pause(); active = candidate; pending = null; boundary = false;
      active.progressAt = now();
      report('clip-visible', active.clip); play(active); prepare(); return true;
    }
    function restart() {
      if (!active) return;
      active.video.currentTime = 0; boundary = false; play(active);
    }
    function advance() {
      prepare();
      if (!commit() && active && !pending && !failed.has(active.clip)) restart();
    }
    return {
      start() { if (!disposed) prepare(); },
      request(clip, { immediate = false } = {}) {
        if (disposed || !pack.clips[clip]) return;
        const changed = desired !== clip; desired = clip;
        if (immediate && changed) boundary = true;
        prepare(); if (boundary || staticMode) commit();
      },
      react: requestReaction,
      cancelReaction: finishReaction,
      freeze(value, allowStaticTransitions = false) {
        if (disposed) return;
        const wasFrozen = frozen;
        frozen = Boolean(value);
        staticMode = frozen && allowStaticTransitions;
        if (active && wasFrozen !== frozen) active.progressAt = now();
        if (frozen) { active?.video.pause(); reaction?.video.pause(); }
        else if (reaction) play(reaction);
        else if (boundary) advance();
        else play(active);
      },
      draw() {
        if (disposed) return;
        if (reactionPending && now() - reactionPending.startedAt > 5000) rejectReaction(reactionPending);
        if (reaction) {
          if ((!reaction.still && reaction.video.currentTime >= reaction.to) || now() - reaction.startedAt >= reaction.duration * 1000) finishReaction();
          else if (!frozen && reaction.video.readyState >= 2 && !reaction.video.seeking) {
            if (reaction.video.currentTime !== reaction.lastTime) { reaction.lastTime = reaction.video.currentTime; reaction.progressAt = now(); }
            else if (!reaction.still && now() - reaction.progressAt > 1500) { rejectReaction(reaction); return; }
            if (reaction) present(reaction.video, reaction.clip);
          }
          if (reaction) return;
        }
        if (pending && !pending.ready && now() - pending.startedAt > 8000) fail(pending);
        if (active && !frozen && !boundary && !failed.has(active.clip)) {
          if (active.video.currentTime !== active.lastTime) { active.lastTime = active.video.currentTime; active.progressAt = now(); }
          else if (now() - active.progressAt > 8000) fail(active);
        }
        if (!active || frozen || active.video.readyState < 2 || active.video.seeking) return;
        // A failed/empty draw simply leaves the last successful pixels visible.
        present(active.video, active.clip);
      },
      current() { const shown = reaction || active; return shown && { clip: shown.clip, time: shown.video.currentTime }; },
      inspect() { return { active: active?.clip, pending: pending?.clip, ready: pending?.ready, boundary,
        reaction: reaction?.clip, reactionPending: reactionPending?.clip,
        blocked: failed.has(desired) || failed.has(nextClip(pack, active?.clip, desired)) }; },
      dispose() {
        disposed = true; active = pending = reaction = reactionPending = null;
        for (const video of [...buffers, reactionVideo]) {
          video.pause(); video.disposeFrameCallbacks?.();
          video.onloadeddata = video.onseeked = video.onerror = video.onended = null;
          video.removeAttribute?.('src'); video.load(); video.remove?.();
        }
      }
    };
  }
  const api = { createPlayer };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.PetAnimation = api;
})(globalThis);
