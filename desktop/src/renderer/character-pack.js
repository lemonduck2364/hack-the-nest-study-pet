'use strict';
(function (root) {
  const selfActions = {
    cube: { clip: 'play-cube', description: 'playing with a puzzle cube', caption: 'one more turn of my cube…' },
    cat: { clip: 'play-cat', description: 'playing with a little kitty', caption: 'a little company for my kitty' },
    'work-laptop': { clip: 'work-laptop', description: 'tapping away on her own little laptop', caption: 'tap tap… just doing my own thing' },
    'work-files': { clip: 'work-files', description: 'looking through a little stack of papers', caption: 'what’s on this page?' },
    eat: { clip: 'eat-lunch', description: 'eating a little bowl of noodles', caption: 'a little lunch break' },
    'clean-table': { clip: 'clean-table', description: 'wiping with a small cloth', caption: 'a tiny bit of tidying' },
    stretch: { clip: 'stretch', description: 'taking a slow stretch', caption: 'streeetch…' },
    violin: { clip: 'violin', description: 'playing a little tune on a violin', caption: 'a little tune for myself' },
    'brush-teeth': { clip: 'brush-teeth', description: 'brushing her teeth', caption: 'getting fresh and tidy' }
  };
  const reactionClips = ['react-jump-grab', 'react-tail', 'react-wave'];
  const dafeiyu = {
    id: 'dafeiyu', width: 640, height: 360,
    bounds: { x: 213, y: 63, width: 213, height: 267 }, face: { x: 309, y: 190 },
    defaultEyeRegions: [{ x: 270, y: 178, width: 26, height: 24, maxX: 3, maxY: 2 }, { x: 321, y: 177, width: 28, height: 25, maxX: 3, maxY: 2 }],
    selfActions,
    reactions: [{ clip: 'attention-look', still: true, sustained: true }],
    display: { left: -55, top: -12, width: 330, height: 185.625 },
    anchors: { face: { x: .497, y: .538 }, composer: { x: .5, y: .77 } },
    bubbleAnchor: { x: 105, y: 64 },
    poster: 'assets/dafeiyu/idle-poster.png', initial: 'idle',
    activities: { idle: 'idle', rest: 'idle', sleep: 'sleep-loop', play: { ...Object.fromEntries(Object.entries(selfActions).map(([id, action]) => [id, action.clip])), ball: 'play-cat', default: 'play-cube' } },
    sleep: { enter: 'sleep-start', loop: 'sleep-loop', exit: 'sleep-end' },
    actionDescriptions: { idle: 'quietly looking around', rest: 'getting sleepy', sleep: 'taking a nap', play: { ...Object.fromEntries(Object.entries(selfActions).map(([id, action]) => [id, action.description])), ball: 'playing with a little kitty', default: 'playing with a puzzle cube' } },
    captions: {
      'attention-look': { kind: 'thought', text: 'hmm? what’s that?' },
      ...Object.fromEntries(Object.values(selfActions).map(action => [action.clip, { kind: 'action', text: action.caption }])),
      'react-jump-grab': { kind: 'thought', text: 'oh! what’s that?' },
      'react-tail': { kind: 'thought', text: 'caught my attention…' },
      'react-wave': { kind: 'thought', text: 'oh, hello there!' },
      idle: { kind: 'thought', text: 'hmm… what shall I do?' },
      'play-cat': { kind: 'action', text: 'playing with my little kitty' },
      'play-cube': { kind: 'action', text: 'one more turn of my cube…' },
      'sleep-start': { kind: 'action', text: 'settling down for a nap…' },
      'sleep-loop': { kind: 'action', text: 'a little nap…' },
      'sleep-end': { kind: 'thought', text: 'just a little stretch…' }
    },
    clips: Object.fromEntries(['idle', ...Object.values(selfActions).map(action => action.clip), ...reactionClips, 'sleep-start', 'sleep-loop', 'sleep-end']
      .map(id => [id, { source: `assets/dafeiyu/${id}.webm` }])),
    eyeTracks: root.DafeiyuEyeTracks || {}
  };
  dafeiyu.clips['react-jump-grab'].display = { left: -40, top: 0, width: 300, height: 168.75 };
  dafeiyu.clips['react-jump-grab'].bubbleAnchor = { x: 105, y: 43 };
  dafeiyu.clips['attention-look'] = { source: 'assets/dafeiyu/idle.webm', look: true };
  function activityClip(pack, state) {
    const mapping = pack.activities[state.activity] || pack.initial;
    return typeof mapping === 'string' ? mapping : mapping[state.action ?? state.play] || mapping.default;
  }
  function nextClip(pack, active, desired) {
    const sleep = pack.sleep;
    if (!active) return pack.initial;
    if (!sleep) return desired;
    if (active === sleep.enter) return desired === sleep.loop ? sleep.loop : sleep.exit;
    if (active === sleep.loop) return desired === sleep.loop ? sleep.loop : sleep.exit;
    if (active === sleep.exit) return desired === sleep.loop ? sleep.enter : desired;
    return desired === sleep.loop ? sleep.enter : desired;
  }
  function actionDescription(pack, state) {
    const description = pack.actionDescriptions?.[state.activity];
    return typeof description === 'string' ? description : description?.[state.action ?? state.play] || description?.default || 'spending a quiet moment';
  }
  const api = { dafeiyu, activityClip, nextClip, actionDescription };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.PetCharacterPacks = api;
})(globalThis);
