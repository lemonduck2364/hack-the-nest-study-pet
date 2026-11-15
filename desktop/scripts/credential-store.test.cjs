'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { createCredentialStore } = require('../src/credential-store.cjs');
const FIRST = 'synthetic-test-key-first-00001';
const SECOND = 'synthetic-test-key-second-0002';

function encryptor() {
  const secret = crypto.randomBytes(32), calls = { available: 0 };
  return {
    calls,
    async isAsyncEncryptionAvailable() { calls.available++; return true; },
    getSelectedStorageBackend: () => 'gnome_libsecret',
    async encryptStringAsync(value) {
      const iv = crypto.randomBytes(12), cipher = crypto.createCipheriv('aes-256-gcm', secret, iv);
      const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
      return Buffer.concat([iv, cipher.getAuthTag(), encrypted]);
    },
    async decryptStringAsync(buffer) {
      const decipher = crypto.createDecipheriv('aes-256-gcm', secret, buffer.subarray(0, 12));
      decipher.setAuthTag(buffer.subarray(12, 28));
      return { result: Buffer.concat([decipher.update(buffer.subarray(28)), decipher.final()]).toString('utf8'), shouldReEncrypt: false };
    }
  };
}
async function fixture(t, adapter = encryptor()) {
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'pet-credential-unit-'));
  t.after(() => fs.rm(temporary, { recursive: true, force: true }));
  const directory = path.join(temporary, 'credentials'), filename = path.join(directory, 'gemini.enc');
  const options = { directory, safeStorage: adapter, platform: 'darwin' };
  return { directory, filename, options, adapter, store: createCredentialStore(options) };
}
function sanitized(code, secret = FIRST) {
  return error => {
    assert.equal(error.name, 'CredentialStoreError'); assert.equal(error.code, code);
    assert.ok(!error.message.includes(secret)); assert.ok(!error.message.includes(os.tmpdir()));
    assert.equal(error.cause, undefined); return true;
  };
}
test('missing directory/file returns null without touching OS crypto; removing missing data succeeds', async t => {
  const h = await fixture(t); assert.equal(await h.store.load(), null);
  await h.store.remove(); await fs.mkdir(h.directory); assert.equal(await h.store.load(), null);
  assert.equal(h.adapter.calls.available, 0);
});
test('persists encrypted bytes with owner-only permissions, reopens and atomically replaces the key', async t => {
  const h = await fixture(t); await h.store.save(` ${FIRST} `);
  const firstBytes = await fs.readFile(h.filename);
  assert.equal(firstBytes.includes(Buffer.from(FIRST)), false);
  assert.equal((await fs.stat(h.directory)).mode & 0o777, 0o700);
  assert.equal((await fs.stat(h.filename)).mode & 0o777, 0o600);
  const reopened = createCredentialStore(h.options); assert.equal(await reopened.load(), FIRST);
  await reopened.save(SECOND); assert.equal(await h.store.load(), SECOND);
  assert.notDeepEqual(await fs.readFile(h.filename), firstBytes);
  assert.deepEqual(await fs.readdir(h.directory), ['gemini.enc']);
});
test('remove deletes only the saved encrypted credential and requires no available crypto', async t => {
  const h = await fixture(t); await h.store.save(FIRST); await fs.writeFile(path.join(h.directory, 'unrelated'), 'keep');
  h.adapter.isAsyncEncryptionAvailable = async () => { throw new Error(FIRST); };
  await h.store.remove(); await h.store.remove(); assert.equal(await h.store.load(), null);
  assert.deepEqual(await fs.readdir(h.directory), ['unrelated']);
});
test('corrupt ciphertext is retained and decryption errors reveal no raw details', async t => {
  const h = await fixture(t); await h.store.save(FIRST);
  const corrupt = Buffer.from('not-an-encrypted-credential'); await fs.writeFile(h.filename, corrupt);
  h.adapter.decryptStringAsync = async () => { throw new Error(`${FIRST} at ${h.filename}`); };
  await assert.rejects(h.store.load(), sanitized('decrypt_failed'));
  assert.deepEqual(await fs.readFile(h.filename), corrupt);
});
test('async decrypt result is validated and rotation hints do not silently rewrite on load', async t => {
  const h = await fixture(t); await h.store.save(FIRST); const original = await fs.readFile(h.filename);
  h.adapter.decryptStringAsync = async () => ({ result: FIRST, shouldReEncrypt: true });
  assert.equal(await h.store.load(), FIRST); assert.deepEqual(await fs.readFile(h.filename), original);
  for (const result of ['', 'x'.repeat(513), 'invalid key', null]) {
    h.adapter.decryptStringAsync = async () => ({ result, shouldReEncrypt: false });
    await assert.rejects(h.store.load(), sanitized('decrypt_failed'));
    assert.deepEqual(await fs.readFile(h.filename), original);
  }
});
test('oversized/empty encrypted files are rejected before crypto and kept intact', async t => {
  const h = await fixture(t); await fs.mkdir(h.directory);
  for (const length of [0, 65537]) {
    const original = Buffer.alloc(length, 42); await fs.writeFile(h.filename, original);
    await assert.rejects(h.store.load(), sanitized('read_failed'));
    assert.deepEqual(await fs.readFile(h.filename), original);
  }
  assert.equal(h.adapter.calls.available, 0);
});
test('read permission failures are sanitized and leave the saved ciphertext alone', async t => {
  const h = await fixture(t); await h.store.save(FIRST); const original = await fs.readFile(h.filename);
  const broken = createCredentialStore({ ...h.options, fs: { ...fs, open: async () => { throw Object.assign(new Error(FIRST), {code:'EACCES'}); } } });
  await assert.rejects(broken.load(), sanitized('read_failed')); assert.deepEqual(await fs.readFile(h.filename), original);
});
test('failed writes clean their temp file, retain the previous credential, and do not leak errors', async t => {
  const h = await fixture(t); await h.store.save(FIRST);
  const adapter = { ...fs, async open(filename, ...args) {
    const handle = await fs.open(filename, ...args);
    if (!filename.endsWith('.tmp')) return handle;
    return new Proxy(handle, { get(target, property) {
      if (property === 'writeFile') return async () => { throw new Error(`${SECOND} failed at ${filename}`); };
      const value = target[property]; return typeof value === 'function' ? value.bind(target) : value;
    } });
  } };
  const broken = createCredentialStore({ ...h.options, fs: adapter });
  await assert.rejects(broken.save(SECOND), sanitized('write_failed', SECOND));
  assert.equal(await h.store.load(), FIRST); assert.deepEqual(await fs.readdir(h.directory), ['gemini.enc']);
});
test('failed rename retains the previous key and removes the completed temporary ciphertext', async t => {
  const h = await fixture(t); await h.store.save(FIRST);
  const broken = createCredentialStore({ ...h.options, fs: { ...fs, rename: async () => { throw new Error(SECOND); } } });
  await assert.rejects(broken.save(SECOND), sanitized('write_failed', SECOND));
  assert.equal(await h.store.load(), FIRST); assert.deepEqual(await fs.readdir(h.directory), ['gemini.enc']);
});
test('unavailable encryption never falls back to plaintext and cannot destroy an existing saved key', async t => {
  const h = await fixture(t); h.adapter.isAsyncEncryptionAvailable = async () => false;
  await assert.rejects(h.store.save(FIRST), sanitized('unavailable'));
  await assert.rejects(fs.stat(h.directory), {code:'ENOENT'});
  h.adapter.isAsyncEncryptionAvailable = async () => true; await h.store.save(FIRST);
  const original = await fs.readFile(h.filename); h.adapter.isAsyncEncryptionAvailable = async () => false;
  await assert.rejects(h.store.load(), sanitized('unavailable')); assert.deepEqual(await fs.readFile(h.filename), original);
});
test('weak or unknown Linux backends are rejected before encryption/file creation', async t => {
  const h = await fixture(t);
  for (const backend of ['basic_text', 'unknown', undefined]) {
    h.adapter.getSelectedStorageBackend = () => backend;
    const store = createCredentialStore({ ...h.options, platform: 'linux' });
    await assert.rejects(store.save(FIRST), sanitized('unavailable'));
  }
  await assert.rejects(fs.stat(h.directory), {code:'ENOENT'});
});
test('invalid keys or unencrypted/nonbuffer crypto output never reach the filesystem', async t => {
  const h = await fixture(t);
  for (const key of ['', 'short', 'key with spaces', 'x'.repeat(513), null]) await assert.rejects(h.store.save(key), sanitized('invalid_key'));
  for (const result of [Buffer.from(FIRST), `encrypted-${FIRST}`, Buffer.alloc(0), Buffer.alloc(65537)]) {
    h.adapter.encryptStringAsync = async () => result;
    await assert.rejects(h.store.save(FIRST), sanitized('write_failed'));
  }
  await assert.rejects(fs.stat(h.directory), {code:'ENOENT'});
});
test('save/replace/remove are serialized so a delayed save cannot resurrect a removed key', async t => {
  const h = await fixture(t); const encrypt = h.adapter.encryptStringAsync;
  let release, entered;
  const waiting = new Promise(resolve => { release = resolve; });
  const started = new Promise(resolve => { entered = resolve; });
  h.adapter.encryptStringAsync = async key => { if (key === FIRST) { entered(); await waiting; } return encrypt(key); };
  const save = h.store.save(FIRST), replace = h.store.save(SECOND), remove = h.store.remove();
  await started; release(); await Promise.all([save, replace, remove]);
  assert.equal(await h.store.load(), null); assert.deepEqual(await fs.readdir(h.directory), []);
});
test('a failed remove preserves the encrypted file and does not poison subsequent operations', async t => {
  const h = await fixture(t); await h.store.save(FIRST); let fail = true;
  const store = createCredentialStore({ ...h.options, fs: { ...fs, async unlink(filename) { if (fail) throw new Error(FIRST); return fs.unlink(filename); } } });
  await assert.rejects(store.remove(), sanitized('remove_failed')); assert.equal(await store.load(), FIRST);
  fail = false; await store.remove(); assert.equal(await store.load(), null);
});
test('symlinked credential directories and files are not followed', async t => {
  const h = await fixture(t); const elsewhere = path.join(path.dirname(h.directory), 'elsewhere');
  await fs.mkdir(elsewhere); await fs.symlink(elsewhere, h.directory);
  await assert.rejects(h.store.save(FIRST), sanitized('write_failed'));
  await assert.rejects(h.store.load(), sanitized('read_failed'));
  assert.deepEqual(await fs.readdir(elsewhere), []);
  await fs.unlink(h.directory); await fs.mkdir(h.directory);
  const otherFile = path.join(elsewhere, 'other.enc'); await fs.writeFile(otherFile, 'keep'); await fs.symlink(otherFile, h.filename);
  await assert.rejects(h.store.load(), sanitized('read_failed')); assert.equal(await fs.readFile(otherFile, 'utf8'), 'keep');
});
