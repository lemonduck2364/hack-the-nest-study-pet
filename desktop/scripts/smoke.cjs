'use strict';
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const pkg = require('../package.json');
if (process.versions.electron !== pkg.devDependencies.electron) {
  throw new Error(`Expected pinned Electron ${pkg.devDependencies.electron}; got ${process.versions.electron || 'plain Node'}`);
}
for (const file of ['src/main.cjs', 'src/renderer/connection.html', 'src/renderer/connection.js', 'src/renderer/connection.css', 'src/renderer/bubble.html', 'src/renderer/bubble.js', 'src/renderer/bubble.css', 'src/renderer/bubble-pages.js', 'src/chat-service.cjs', 'src/window-layout.cjs', 'src/renderer/chat.html', 'src/renderer/chat.js', 'src/renderer/chat.css', 'src/renderer/hint.html', 'src/renderer/hint.js', 'src/renderer/hint.css', 'src/life.cjs', 'src/renderer/gaze.js', 'src/renderer/assets/red-panda/sprites.png', 'src/renderer/assets/red-panda/sprites.js', 'src/renderer/sprite-player.js', 'src/preload.cjs', 'src/renderer/index.html', 'src/renderer/pet.js', 'src/renderer/style.css']) {
  fs.accessSync(path.join(root, file), fs.constants.R_OK);
}
console.log(`Installed Electron ${process.versions.electron}, ${process.platform}/${process.arch}; entry assets readable.`);
console.log('No GUI launched. Transparency, hit testing, focus, dragging, Spaces, and Quit require desktop acceptance.');
