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
  const pandaActions = {
    reading: { clip: 'reading', description: 'quietly reading a book', caption: 'just one more page…' },
    tea: { clip: 'tea', description: 'holding a warm cup of tea', caption: 'a warm little tea break' },
    rest: { clip: 'quiet-rest', description: 'sitting quietly with her eyes closed', caption: 'a quiet moment…' }
  };
  // Translate the shared life engine's action slots into poses this skin can show.
  const pandaPlay = {
    cube: pandaActions.reading, cat: pandaActions.tea, 'work-laptop': pandaActions.reading,
    'work-files': pandaActions.reading, eat: pandaActions.tea, 'clean-table': pandaActions.rest,
    stretch: pandaActions.rest, violin: pandaActions.rest, 'brush-teeth': pandaActions.tea,
    default: pandaActions.reading
  };
  const redPanda = {
    id: 'red-panda', kind: 'sprite', width: 640, height: 360,
    atlas: 'assets/red-panda/life-atlas.png', initial: 'reading',
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
      tea: { crop: [1478, 7, 626, 713], destination: [202.789621, 63, 234.420757, 267] },
      quiet: { crop: [0, 724, 541, 688], destination: [215.023983, 63, 209.952035, 267] },
      curled: { crop: [541, 724, 738, 508], destination: [176.797965, 132.854651, 286.404070, 197.145349] }
    },
    clips: {
      reading: { sprite: 'book', restingEyes: true },
      tea: { sprite: 'tea' },
      'quiet-rest': { sprite: 'quiet', face: { x: 309, y: 172 } },
      sleep: { sprite: 'curled', bubbleAnchor: { x: 110, y: 101 } },
      'attention-look': {
        sprite: 'wave', look: true, face: { x: 306.5, y: 148 },
        eyeRegions: [
          { x: 273, y: 133, width: 25, height: 22, maxX: 3, maxY: 2.5, flatCore: .4 },
          { x: 314, y: 141, width: 26, height: 22, maxX: 3, maxY: 2.5, flatCore: .4 }
        ]
      }
    },
    activities: {
      idle: 'reading', rest: 'quiet-rest', sleep: 'sleep',
      play: Object.fromEntries(Object.entries(pandaPlay).map(([id, action]) => [id, action.clip]))
    },
    sleep: { loop: 'sleep' },
    selfActions: pandaActions,
    actionDescriptions: {
      idle: pandaActions.reading.description, rest: pandaActions.rest.description, sleep: 'curled up asleep on her tail',
      play: Object.fromEntries(Object.entries(pandaPlay).map(([id, action]) => [id, action.description]))
    },
    captions: {
      ...Object.fromEntries(Object.values(pandaActions).map(action => [action.clip, { kind: 'action', text: action.caption }])),
      sleep: { kind: 'action', text: 'curled up for a nap…' },
      'attention-look': { kind: 'thought', text: 'hmm? hello there…' }
    },
    reactions: [{ clip: 'attention-look', still: true, sustained: true }]
  };
  const atlas = typeof module !== 'undefined' && module.exports
    ? require('./assets/pixel-panda/frames.js') : root.PixelPandaAtlas;
  const pixelActions = {
    cube: { clip: 'cube', description: 'turning a little puzzle cube', caption: 'one more turn…' },
    cat: { clip: 'cat', description: 'playing with a tiny kitten', caption: 'a little company for my kitty' },
    laptop: { clip: 'laptop', description: 'typing on her little laptop', caption: 'tap tap… just doing my own thing' }
  };
  const pixelPlay = {
    cube: pixelActions.cube, cat: pixelActions.cat, 'work-laptop': pixelActions.laptop,
    'work-files': pixelActions.laptop, eat: pixelActions.cat, 'clean-table': pixelActions.cube,
    stretch: pixelActions.cat, violin: pixelActions.cube, 'brush-teeth': pixelActions.laptop,
    default: pixelActions.cube
  };
  const pixelGroups = {
    idle: { loop: 'idle' },
    rest: { loop: 'rest' },
    cube: { enter: 'cubeEnter', loop: 'cube', exit: 'cubeExit' },
    cat: { enter: 'catEnter', loop: 'cat', exit: 'catExit' },
    laptop: { enter: 'laptopEnter', loop: 'laptop', exit: 'laptopExit' },
    sleep: { enter: 'sleepEnter', loop: 'sleep', exit: 'sleepExit' }
  };
  const pixelCaptions = {
    idle: { kind: 'thought', text: 'hmm… what shall I do?' },
    rest: { kind: 'thought', text: 'getting a little sleepy…' },
    sleepEnter: { kind: 'action', text: 'settling down for a nap…' },
    sleep: { kind: 'action', text: 'a little nap…' },
    sleepExit: { kind: 'thought', text: 'feeling a bit more rested…' },
    'attention-look': { kind: 'thought', text: 'oh, hi there…' }
  };
  for (const action of Object.values(pixelActions)) {
    const clips = Object.values(pixelGroups[action.clip]);
    for (const clip of clips) pixelCaptions[clip] = { kind: 'action', text: action.caption };
  }
  const pixelClips = {};
  for (const [group, phases] of Object.entries(pixelGroups)) {
    for (const [phase, clip] of Object.entries(phases)) {
      const source = clip === 'laptop' ? 'laptopTyping' : clip;
      pixelClips[clip] = { group, phase, frames: atlas.tracks[source] };
    }
  }
  pixelClips.sleep.bubbleAnchor = { x: 112, y: 91 };
  pixelClips['attention-look'] = { directional: true };
  const pixelPanda = {
    id: 'pixel-panda', kind: 'atlas', width: 640, height: 360, atlas,
    placement: { left: 202, top: 93, scale: 3 },
    // The source gaze cels only alter eyes. Missing center-row center uses
    // the original open-eyed pose rather than moving the entire face.
    gazeFrames: [[55, 56, 57], [54, 53, 58], [61, 60, 59]],
    bounds: { x: 244, y: 105, width: 153, height: 225 },
    face: { x: 334, y: 195 },
    display: { ...dafeiyu.display },
    bubbleAnchor: { x: 117, y: 58 },
    attentionEaseMs: 115,
    initial: 'idle',
    clips: pixelClips,
    groups: pixelGroups,
    reactions: [{ clip: 'attention-look', sustained: true }],
    activities: {
      idle: 'idle', rest: 'rest', sleep: 'sleep',
      play: Object.fromEntries(Object.entries(pixelPlay).map(([id, action]) => [id, action.clip]))
    },
    sleep: pixelGroups.sleep,
    captions: pixelCaptions,
    selfActions: pixelActions,
    actionDescriptions: {
      idle: 'quietly standing and looking around',
      rest: 'getting sleepy', sleep: 'curled up for a nap',
      play: Object.fromEntries(Object.entries(pixelPlay).map(([id, action]) => [id, action.description]))
    }
  };
  const registry = { dafeiyu, 'red-panda': redPanda, 'pixel-panda': pixelPanda };
  const appearanceOptions = [
    { id: 'dafeiyu', label: 'Dafeiyu' },
    { id: 'red-panda', label: 'Red panda' },
    { id: 'pixel-panda', label: 'Pixel panda' }
  ];
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
  const api = { dafeiyu, redPanda, pixelPanda, appearanceOptions, registry, packs: registry, resolvePack, activityClip, nextClip, actionDescription };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.PetCharacterPacks = api;
})(globalThis);
