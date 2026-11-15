'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createPlayer } = require('../src/renderer/animation-player.js');
const { dafeiyu, nextClip, activityClip, actionDescription } = require('../src/renderer/character-pack.js');
const { frameEyes } = require('../src/renderer/gaze.js');
function harness(pack = dafeiyu) {
  const videos = [], shown = [], diagnostics = [];
  let clock = 0;
  const player = createPlayer({ pack, nextClip, now: () => clock,
    makeVideo() {
      const video = { currentTime: 0, readyState: 0, paused: true, valid: true,
        pause() { this.paused = true; }, play() { this.paused = false; return Promise.resolve(); },
        load() { this.currentTime = 0; this.readyState = 0; },
        ready() { this.readyState = 2; this.onloadeddata(); }, end() { this.paused = true; this.onended(); } };
      videos.push(video); return video;
    },
    present(video, clip) { if (!video.valid) return false; shown.push(clip); return true; },
    report(kind, clip) { diagnostics.push({ kind, clip }); }
  });
  player.start();
  return { player, videos, shown, diagnostics, advance(ms) { clock += ms; player.draw(); } };
}
test('preloaded replacement waits for an exit boundary and never blanks the current frame', () => {
  const h = harness(); h.videos[0].ready();
  h.player.request('play-cat'); h.videos[1].ready();
  assert.deepEqual(h.shown, ['idle']); assert.equal(h.videos[0].paused, false);
  h.videos[0].end(); assert.deepEqual(h.shown, ['idle', 'play-cat']);
});
test('slow decode holds the last good frame until replacement is usable', () => {
  const h = harness(); h.videos[0].ready(); h.player.request('play-cube'); h.videos[0].end();
  assert.deepEqual(h.shown, ['idle']);
  h.videos[1].ready(); assert.equal(h.shown.at(-1), 'play-cube');
});
test('failed or empty replacement retains the visible pet and resumes its old clip', () => {
  const h = harness(); h.videos[0].ready(); h.player.request('play-cat'); h.videos[0].end();
  h.videos[1].valid = false; h.videos[1].ready();
  assert.deepEqual(h.shown, ['idle']); assert.equal(h.videos[0].paused, false);
  assert.equal(h.player.inspect().active, 'idle');
});
test('superseded preload callbacks cannot publish an obsolete activity', () => {
  const h = harness(); h.videos[0].ready(); h.player.request('play-cat');
  const stale = h.videos[1].onloadeddata;
  h.player.request('play-cube'); stale(); h.videos[0].end();
  assert.deepEqual(h.shown, ['idle']); h.videos[1].ready();
  assert.equal(h.shown.at(-1), 'play-cube');
});
test('drag freeze blocks a ready pending swap until released', () => {
  const h = harness(); h.videos[0].ready(); h.player.request('play-cat'); h.player.freeze(true);
  h.videos[0].end(); h.videos[1].ready(); assert.deepEqual(h.shown, ['idle']);
  h.player.freeze(false); assert.equal(h.shown.at(-1), 'play-cat');
});
test('sleep entrance and exit run in order, including a wake during the entrance', () => {
  assert.equal(nextClip(dafeiyu, 'idle', 'sleep-loop'), 'sleep-start');
  assert.equal(nextClip(dafeiyu, 'sleep-start', 'sleep-loop'), 'sleep-loop');
  assert.equal(nextClip(dafeiyu, 'sleep-loop', 'play-cat'), 'sleep-end');
  assert.equal(nextClip(dafeiyu, 'sleep-start', 'idle'), 'sleep-end');
  assert.equal(nextClip(dafeiyu, 'sleep-end', 'play-cat'), 'play-cat');
});
test('a second declarative pack uses the same player and state mapping', () => {
  const fixture = { initial: 'calm', clips: { calm: {source:'calm.webm'}, dance: {source:'dance.webm'} },
    activities: {idle:'calm', play:{default:'dance'}}, actionDescriptions:{play:{default:'dancing'}} };
  assert.equal(activityClip(fixture, {activity:'play',play:'unknown'}), 'dance');
  assert.equal(actionDescription(fixture, {activity:'play'}), 'dancing');
  const h = harness(fixture); h.videos[0].ready(); h.player.request('dance'); h.videos[1].ready(); h.videos[0].end();
  assert.deepEqual(h.shown, ['calm', 'dance']);
});
test('eye calibration is current-frame only and never bridges a blink or unknown interval', () => {
  const regions = [{ x:10,y:10,width:20,height:20,maxX:2,maxY:1 }];
  const track = [{time:0,open:true,regions}, {time:1/24,open:false}, {time:2/24,open:true,regions}];
  assert.equal(frameEyes(track,.02)?.regions,regions);
  assert.equal(frameEyes(track,.05),null);
  assert.equal(frameEyes(track,.1)?.regions,regions);
  assert.equal(frameEyes(track,.2),null);
});
test('a decoder that never becomes ready releases the motion guard and keeps the old pet', () => {
  const h = harness(); h.videos[0].ready(); h.player.request('play-cat');
  h.advance(8001);
  assert.equal(h.player.inspect().blocked, true);
  assert.equal(h.player.inspect().active, 'idle');
  assert.equal(h.shown.at(-1), 'idle');
});
test('stalled playback releases motion guard but intentional holding does not count as a stall', () => {
  const h = harness(); h.videos[0].ready(); h.player.draw();
  h.player.freeze(true); h.advance(20000);
  assert.equal(h.player.inspect().blocked, false);
  h.player.freeze(false); h.advance(8001);
  assert.equal(h.player.inspect().blocked, true);
});
test('reduced motion changes to a decoded still without playing or waiting forever for ended', () => {
  const h = harness(); h.player.freeze(true, true); h.videos[0].ready();
  h.player.request('play-cat'); h.videos[1].ready();
  assert.equal(h.player.inspect().active, 'play-cat');
  assert.equal(h.videos[1].paused, true);
});
test('a failed requested target still cancels a different obsolete ready preload', () => {
  const h = harness(); h.videos[0].ready();
  h.player.request('sleep-loop'); h.videos[1].onerror();
  h.player.request('play-cat'); h.videos[1].ready();
  h.player.request('sleep-loop'); h.videos[0].end();
  assert.equal(h.player.inspect().pending, undefined);
  assert.equal(h.player.inspect().blocked, true);
  assert.deepEqual(h.shown, ['idle']);
});
test('authored reaction preserves the original video buffer, exact time and prepared next activity', () => {
  const h = harness(); h.videos[0].ready(); h.videos[0].currentTime = 3.25;
  h.player.request('play-cat'); h.videos[1].ready();
  assert.equal(h.player.react({clip:'react-tail',from:0,to:2.8}),true); h.videos[2].ready();
  assert.equal(h.videos[0].paused,true); assert.equal(h.videos[0].currentTime,3.25);
  assert.equal(h.player.current().clip,'react-tail');
  h.videos[2].currentTime = 2.9; h.player.draw();
  assert.deepEqual(h.player.current(),{clip:'idle',time:3.25}); assert.equal(h.videos[0].paused,false);
  h.videos[0].end(); assert.equal(h.player.current().clip,'play-cat');
});
test('cancel or failed reaction cannot replace the paused activity or retain a pending reaction', () => {
  const h = harness(); h.videos[0].ready(); h.videos[0].currentTime = 4;
  h.player.react({clip:'react-tail'}); const staleReady = h.videos[2].onloadeddata;
  h.player.cancelReaction(); staleReady();
  assert.deepEqual(h.player.current(),{clip:'idle',time:4}); assert.equal(h.player.inspect().reactionPending,undefined);
  h.player.react({clip:'react-wave'}); h.videos[2].onerror();
  assert.deepEqual(h.player.current(),{clip:'idle',time:4}); assert.equal(h.player.inspect().reactionPending,undefined);
});
test('selected attention remains still beyond the old timeout and resumes the exact original phase only on exit', () => {
  const h = harness(); h.videos[0].ready(); h.videos[0].currentTime = 6.5;
  assert.equal(dafeiyu.reactions.length,1); assert.equal(dafeiyu.reactions[0].clip,'attention-look');
  h.player.react(dafeiyu.reactions[0]); h.videos[2].ready();
  assert.equal(h.videos[2].paused,true); h.advance(60000); assert.equal(h.player.current().clip,'attention-look');
  assert.equal(h.videos[0].paused,true); assert.equal(h.videos[0].currentTime,6.5);
  h.player.cancelReaction(); assert.deepEqual(h.player.current(),{clip:'idle',time:6.5}); assert.equal(h.videos[0].paused,false);
  assert.equal(h.player.react(dafeiyu.reactions[0]),true,'there is no player cooldown on reentry');
  h.videos[2].ready(); assert.equal(h.player.current().clip,'attention-look');
});
test('sustained attention still has bounded decode failure and restores normal playback', () => {
  const h=harness();h.videos[0].ready();h.videos[0].currentTime=2.25;
  h.player.react(dafeiyu.reactions[0]);h.advance(5001);
  assert.equal(h.player.inspect().reactionPending,undefined);assert.equal(h.player.inspect().reaction,undefined);
  assert.deepEqual(h.player.current(),{clip:'idle',time:2.25});assert.equal(h.videos[0].paused,false);
});
test('manual Nap cancels reaction and repeated state publication does not skip the sleep entrance', () => {
  const h = harness(); h.videos[0].ready(); h.player.react({clip:'react-tail'}); h.videos[2].ready();
  h.player.cancelReaction(); h.player.request('sleep-loop',{immediate:true}); h.videos[1].ready();
  assert.equal(h.player.current().clip,'sleep-start');
  h.player.request('sleep-loop',{immediate:true}); h.videos[0].ready();
  assert.equal(h.player.current().clip,'sleep-start'); h.videos[1].end();
  assert.equal(h.player.current().clip,'sleep-loop');
});
