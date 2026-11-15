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
    id: 'dafeiyu', kind: 'video', width: 640, height: 360,
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
  const redPanda = {
    id: 'red-panda', kind: 'sprite', width: 640, height: 360,
    atlas: 'assets/red-panda/andrew-original.png', initial: 'reading',
    bounds: { x: 203.886047, y: 63, width: 232.227907, height: 267 },
    face: { x: 320.75, y: 172.25 },
    defaultEyeRegions: [{ x: 290, y: 164, width: 18, height: 19, maxX: 3, maxY: 2 }, { x: 333, y: 161, width: 19, height: 20, maxX: 3, maxY: 2 }],
    restingGaze: { x: 0, y: .55 },
    attentionEaseMs: 220,
    display: { ...dafeiyu.display }, bubbleAnchor: { x: 110, y: 64 },
    anchors: { face: { x: .502, y: .499 }, composer: { x: .5, y: .77 } },
    sprites: {
      wave: { crop: [62, 8, 600, 708], destination: [206.864407, 63, 226.271186, 267] },
      book: { crop: [785, 68, 561, 645], destination: [203.886047, 63, 232.227907, 267] },
      tea: { crop: [1478, 7, 626, 713], destination: [202.789621, 63, 234.420757, 267] }
    },
    clips: {
      reading: { sprite: 'book', restingEyes: true },
      tea: { sprite: 'tea' },
      greeting: { sprite: 'wave' },
      'rest-book': { sprite: 'book', restingEyes: true, fallback: true },
      'sleep-book': { sprite: 'book', restingEyes: true, fallback: true },
      'attention-look': { sprite: 'book', look: true }
    },
    activities: { idle: 'reading', rest: 'rest-book', sleep: 'sleep-book', play: { eat: 'tea', default: 'reading' } },
    sleep: { loop: 'sleep-book' },
    selfActions: {
      reading: { clip: 'reading', description: 'quietly reading a book', caption: 'just one more page…' },
      tea: { clip: 'tea', description: 'enjoying a warm cup of tea', caption: 'a warm little tea break' }
    },
    actionDescriptions: { idle: 'quietly reading a book', rest: 'resting quietly with a book', sleep: 'resting quietly with a book',
      play: { eat: 'enjoying a warm cup of tea', default: 'quietly reading a book' } },
    captions: {
      reading: { kind: 'action', text: 'just one more page…' },
      tea: { kind: 'action', text: 'a warm little tea break' },
      greeting: { kind: 'thought', text: 'oh, hello!' },
      'rest-book': { kind: 'action', text: 'resting with my book…' },
      'sleep-book': { kind: 'action', text: 'a quiet rest with my book…' },
      'attention-look': { kind: 'thought', text: 'hmm? hello there…' }
    },
    reactions: [{ clip: 'attention-look', still: true, sustained: true }]
  };
  const registry = { dafeiyu, 'red-panda': redPanda };
  function resolvePack(id) { return Object.hasOwn(registry, id) ? registry[id] : dafeiyu; }
  function activityClip(pack, state) {
    const mapping = pack.activities[state.activity] || pack.initial;
    return typeof mapping === 'string' ? mapping : mapping[state.action ?? state.play] || mapping.default;
  }
  function nextClip(pack, active, desired) {
    const sleep = pack.sleep;
    if (!active) return pack.initial;
    if (!sleep?.enter || !sleep?.exit) return desired;
    if (active === sleep.enter) return desired === sleep.loop ? sleep.loop : sleep.exit;
    if (active === sleep.loop) return desired === sleep.loop ? sleep.loop : sleep.exit;
    if (active === sleep.exit) return desired === sleep.loop ? sleep.enter : desired;
    return desired === sleep.loop ? sleep.enter : desired;
  }
  function actionDescription(pack, state) {
    const description = pack.actionDescriptions?.[state.activity];
    return typeof description === 'string' ? description : description?.[state.action ?? state.play] || description?.default || 'spending a quiet moment';
  }
  const api = { dafeiyu, redPanda, registry, packs: registry, resolvePack, activityClip, nextClip, actionDescription };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.PetCharacterPacks = api;
})(globalThis);
