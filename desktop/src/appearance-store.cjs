'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { registry } = require('./renderer/character-pack.js');
const DEFAULT_CHARACTER_ID = 'red-panda';
function createAppearanceStore(directory) {
  const filename = path.join(directory, 'appearance.json');
  return {
    load() {
      try {
        if (fs.statSync(filename).size > 1024) return DEFAULT_CHARACTER_ID;
        const { characterId } = JSON.parse(fs.readFileSync(filename, 'utf8'));
        return Object.hasOwn(registry, characterId) ? characterId : DEFAULT_CHARACTER_ID;
      } catch { return DEFAULT_CHARACTER_ID; }
    },
    save(characterId) {
      if (!Object.hasOwn(registry, characterId)) throw new Error('Unknown appearance');
      fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
      const temporary = path.join(directory, `.appearance-${randomUUID()}.tmp`);
      try {
        fs.writeFileSync(temporary, JSON.stringify({ characterId }), { mode: 0o600, flag: 'wx' });
        fs.renameSync(temporary, filename);
      } finally { try { fs.unlinkSync(temporary); } catch {} }
    }
  };
}
module.exports = { createAppearanceStore, DEFAULT_CHARACTER_ID };
