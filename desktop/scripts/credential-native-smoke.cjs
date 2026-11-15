'use strict';
// Explicit native smoke check. Uses only a synthetic key in a dedicated temp
// directory; never opens the pet's saved credentials or calls a model provider.
const { app, safeStorage } = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const assert = require('node:assert/strict');
const { createCredentialStore } = require('../src/credential-store.cjs');
const [mode, directory] = process.argv.slice(2);
const synthetic = 'synthetic.desktop-pet.key-never-a-real-credential';
app.setName(require('../package.json').name);
app.whenReady().then(async () => {
  assert.ok(['save', 'restore-remove'].includes(mode));
  assert.ok(path.resolve(directory).startsWith(path.join(os.tmpdir(), 'pet-credential-smoke-')));
  const store = createCredentialStore({ directory, safeStorage });
  if (mode === 'save') {
    assert.equal(await store.load(), null);
    await store.save(synthetic);
    const ciphertext = await fs.readFile(path.join(directory, 'gemini.enc'));
    assert.equal(ciphertext.includes(Buffer.from(synthetic)), false);
    assert.equal((await fs.stat(path.join(directory, 'gemini.enc'))).mode & 0o777, 0o600);
    console.log('Native encrypted save passed (synthetic credential only).');
  } else {
    assert.equal(await store.load(), synthetic);
    await store.save(`${synthetic}-replacement`);
    assert.equal(await store.load(), `${synthetic}-replacement`);
    await store.remove();
    assert.equal(await store.load(), null);
    console.log('Native cross-process restore, replace and removal passed.');
  }
  app.exit(0);
}).catch(() => { console.error('Native credential smoke failed; no credential details logged.'); app.exit(1); });
