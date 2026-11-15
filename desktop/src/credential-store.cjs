'use strict';

const defaultFS = require('node:fs/promises');
const { constants } = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');

const MAX_FILE_BYTES = 64 * 1024;
const messages = {
  invalid_key: 'Enter a valid API key.',
  unavailable: 'Secure credential storage is unavailable.',
  read_failed: 'The saved connection could not be read.',
  decrypt_failed: 'The saved connection could not be unlocked.',
  write_failed: 'The connection could not be saved securely.',
  remove_failed: 'The saved connection could not be removed.'
};
function failure(code) {
  const error = new Error(messages[code]);
  error.name = 'CredentialStoreError'; error.code = code;
  return error;
}
function normalizeGeminiKey(value) {
  if (typeof value !== 'string') return null;
  const key = value.trim();
  return key.length >= 8 && key.length <= 512 && /^[A-Za-z0-9_.-]+$/.test(key)
    && !/^(your[-_]?key|placeholder)/i.test(key) ? key : null;
}

// Call after Electron app.ready. Only OS-encrypted bytes reach the filesystem.
// The optional fs argument is a node:fs/promises-compatible adapter for testing.
function createCredentialStore({ directory, safeStorage, fs = defaultFS, platform = process.platform } = {}) {
  if (typeof directory !== 'string' || !path.isAbsolute(directory)) throw failure('unavailable');
  const filename = path.join(directory, 'gemini.enc');
  let queue = Promise.resolve();
  function serialize(operation) {
    const result = queue.then(operation);
    queue = result.catch(() => {});
    return result;
  }
  async function requireEncryption() {
    try {
      if (typeof safeStorage?.isAsyncEncryptionAvailable !== 'function'
        || typeof safeStorage.encryptStringAsync !== 'function'
        || typeof safeStorage.decryptStringAsync !== 'function'
        || !await safeStorage.isAsyncEncryptionAvailable()) throw failure('unavailable');
      // Do not opt into Electron's weak Linux basic_text fallback. Unknown or
      // undetectable Linux backends are also rejected; macOS is the first target.
      if (platform === 'linux') {
        const backend = safeStorage.getSelectedStorageBackend?.();
        if (!['gnome_libsecret', 'kwallet', 'kwallet5', 'kwallet6'].includes(backend)) throw failure('unavailable');
      }
    } catch { throw failure('unavailable'); }
  }
  async function existingDirectory() {
    try {
      const info = await fs.lstat(directory);
      if (!info.isDirectory() || info.isSymbolicLink()) throw new Error('Invalid directory');
      return true;
    } catch (error) {
      if (error?.code === 'ENOENT') return false;
      throw error;
    }
  }
  async function encryptedBytes() {
    let handle;
    try {
      if (!await existingDirectory()) return null;
      handle = await fs.open(filename, constants.O_RDONLY | (constants.O_NOFOLLOW || 0));
      const info = await handle.stat();
      if (!info.isFile() || info.size < 1 || info.size > MAX_FILE_BYTES) throw new Error('Invalid file');
      const buffer = Buffer.alloc(MAX_FILE_BYTES + 1);
      let length = 0;
      while (length < buffer.length) {
        const { bytesRead } = await handle.read(buffer, length, buffer.length - length, length);
        if (!bytesRead) break;
        length += bytesRead;
      }
      if (length !== info.size || length > MAX_FILE_BYTES) throw new Error('Invalid file');
      return buffer.subarray(0, length);
    } catch (error) {
      if (error?.code === 'ENOENT') return null;
      throw failure('read_failed');
    } finally { if (handle) await handle.close().catch(() => {}); }
  }
  async function saveKey(value) {
    const key = normalizeGeminiKey(value);
    if (!key) throw failure('invalid_key');
    await requireEncryption();
    let encrypted;
    try {
      encrypted = await safeStorage.encryptStringAsync(key);
      if (!Buffer.isBuffer(encrypted) || encrypted.length < 1 || encrypted.length > MAX_FILE_BYTES
        || encrypted.includes(Buffer.from(key, 'utf8'))) throw new Error('Invalid ciphertext');
    } catch { throw failure('write_failed'); }

    let temporary, handle, created = false;
    try {
      if (!await existingDirectory()) await fs.mkdir(directory, { recursive: true, mode: 0o700 });
      if (!await existingDirectory()) throw new Error('Missing directory');
      await fs.chmod(directory, 0o700);
      temporary = path.join(directory, `.gemini-${randomUUID()}.tmp`);
      handle = await fs.open(temporary, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | (constants.O_NOFOLLOW || 0), 0o600);
      created = true;
      await handle.chmod(0o600);
      await handle.writeFile(encrypted);
      await handle.sync();
      await handle.close(); handle = null;
      await fs.rename(temporary, filename);
      temporary = null;
    } catch { throw failure('write_failed'); }
    finally {
      if (handle) await handle.close().catch(() => {});
      if (temporary && created) await fs.unlink(temporary).catch(() => {});
    }
  }

  return {
    load() {
      return serialize(async () => {
        // Missing file is an ordinary first launch: do not touch OS key storage.
        const encrypted = await encryptedBytes();
        if (encrypted === null) return null;
        await requireEncryption();
        try {
          const decoded = await safeStorage.decryptStringAsync(encrypted);
          const key = normalizeGeminiKey(decoded?.result);
          if (!key) throw new Error('Invalid decrypted value');
          // Keep load read-only, including shouldReEncrypt:true. Explicit saves
          // use the current OS provider; a failed read never destroys the file.
          return key;
        } catch { throw failure('decrypt_failed'); }
      });
    },
    save(value) { return serialize(() => saveKey(value)); },
    remove() {
      return serialize(async () => {
        try {
          if (!await existingDirectory()) return;
          await fs.unlink(filename);
        } catch (error) { if (error?.code !== 'ENOENT') throw failure('remove_failed'); }
      });
    }
  };
}

module.exports = { createCredentialStore, normalizeGeminiKey };
