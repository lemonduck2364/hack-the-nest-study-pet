'use strict';
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const pkg = require('../package.json');
if (process.versions.electron !== pkg.devDependencies.electron) {
  throw new Error(`Expected pinned Electron ${pkg.devDependencies.electron}; got ${process.versions.electron || 'plain Node'}`);
}
for (const file of ['src/lobby-network.cjs', 'src/lobby-controller.cjs', 'src/lobby-preload.cjs', 'src/renderer/lobby.html', 'src/renderer/lobby.css', 'src/renderer/lobby.js', 'src/companion-memory.cjs', 'src/appearance-store.cjs', 'src/renderer/atlas-player.js', 'src/renderer/assets/pixel-panda/frames.js', 'src/renderer/assets/pixel-panda/atlas.png', 'src/renderer/sprite-player.js', 'src/renderer/assets/red-panda/andrew-original.png', 'src/renderer/assets/red-panda/life-atlas.png', 'src/credential-store.cjs', 'src/bubble-scheduler.cjs', 'src/renderer/composer-lines.js', 'src/renderer/character-pack.js', 'src/renderer/animation-player.js', 'src/renderer/assets/dafeiyu/eye-tracks.js', 'src/renderer/assets/dafeiyu/idle-poster.png', 'src/renderer/assets/dafeiyu/sleep-start.webm', 'src/renderer/assets/dafeiyu/sleep-end.webm', 'src/main.cjs', 'src/renderer/connection.html', 'src/renderer/connection.js', 'src/renderer/connection.css', 'src/renderer/bubble.html', 'src/renderer/bubble.js', 'src/renderer/bubble.css', 'src/renderer/bubble-pages.js', 'src/chat-service.cjs', 'src/window-layout.cjs', 'src/renderer/chat.html', 'src/renderer/chat.js', 'src/renderer/chat.css', 'src/renderer/hint.html', 'src/renderer/hint.js', 'src/renderer/hint.css', 'src/life.cjs', 'src/renderer/gaze.js', 'src/renderer/assets/dafeiyu/idle.webm', 'src/renderer/assets/dafeiyu/play-cube.webm', 'src/renderer/assets/dafeiyu/play-cat.webm', 'src/renderer/assets/dafeiyu/sleep-loop.webm', 'src/preload.cjs', 'src/renderer/index.html', 'src/renderer/pet.js', 'src/renderer/style.css']) {
  fs.accessSync(path.join(root, file), fs.constants.R_OK);
}
const { dafeiyu } = require('../src/renderer/character-pack.js');
for (const clip of Object.values(dafeiyu.clips)) fs.accessSync(path.join(root, 'src/renderer', clip.source), fs.constants.R_OK);
for (const file of ['src/action-bag.cjs', 'src/renderer/cursor-reaction.js']) fs.accessSync(path.join(root, file), fs.constants.R_OK);
console.log(`Installed Electron ${process.versions.electron}, ${process.platform}/${process.arch}; entry assets readable.`);
console.log('No GUI launched. Transparency, hit testing, focus, dragging, Spaces, and Quit require desktop acceptance.');
