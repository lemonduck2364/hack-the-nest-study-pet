'use strict';

const { PET_PERSONA, publicPetState } = require('./pet-persona.cjs');
const { normalizeGeminiKey } = require('./credential-store.cjs');
const { MEMORY_INSTRUCTIONS, RESPONSE_SCHEMA, parseTurn } = require('./companion-memory.cjs');
const MODEL = 'gemini-3.1-flash-lite';
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;
const MAX_ATTEMPTS = 30;
const MAX_RESPONSE_BYTES = 64 * 1024;
const errors = {
  invalid: 'Please write a message of 1–1,000 characters.',
  missing_key: 'Connect Gemini in settings to start chatting.',
  invalid_config: 'Choose Gemini and enter a valid API key.',
  busy: 'A reply or connection change is already in progress. Please wait a moment.',
  limit: 'This test session has reached its 30-message limit. Restart the pet to begin another session.',
  auth: 'Gemini could not accept this key. Please check your API key and project access.',
  quota: 'Gemini’s quota or rate limit was reached. Please try again later or check your project’s limits.',
  unavailable: 'Chat is unavailable right now. Please try again later.',
  network: 'Could not reach Gemini. Check your internet connection and try again.',
  provider: 'Gemini is temporarily unavailable. Please try again later.',
  invalid_response: 'Gemini returned an unreadable reply. Please try again later.',
  storage_save: 'Could not securely save this key. Your previous connection has been kept.',
  storage_load: 'Could not unlock the saved key. Open Connection to replace or remove it.',
  storage_remove: 'Could not remove the saved key. Your connection has been kept.',
  timeout: 'The reply took too long. You can try sending your message again.',
  cancelled: 'This reply was cancelled.',
  empty: 'The pet could not finish that reply. Please try a different message.',
  request: 'Gemini could not accept this request. Please check the project’s model access.',
};
const failure = (code, httpStatus) => ({ ok: false, code, error: errors[code] || errors.unavailable,
  ...(Number.isInteger(httpStatus) && httpStatus >= 100 && httpStatus <= 599 ? { httpStatus } : {}) });

async function responseJSON(response, signal) {
  // Bound decoded data as well as the requested model output; do not surface raw errors.
  if (!response.body?.getReader) throw new Error('Missing response stream');
  const reader = response.body.getReader();
  const onAbort = () => reader.cancel().catch(() => {});
  signal.addEventListener('abort', onAbort, { once: true });
  let length = 0;
  const chunks = [];
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > MAX_RESPONSE_BYTES) { await reader.cancel(); throw new Error('Response too large'); }
      chunks.push(value);
    }
  } finally { signal.removeEventListener('abort', onAbort); reader.releaseLock(); }
  const all = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) { all.set(chunk, offset); offset += chunk.byteLength; }
  return JSON.parse(new TextDecoder().decode(all));
}

function createChatService({ getPetState = () => ({}), fetchImpl = globalThis.fetch, env = process.env, timeoutMs = 25000, keyStore, getMemory = () => null } = {}) {
  let key = normalizeGeminiKey(env.GEMINI_API_KEY) || '';
  let attempts = 0, revision = 0, active = null, mutation = false;
  let credentialState = key ? 'session' : keyStore ? 'none' : 'unavailable';
  let lastError = null;
  let transcript = [];
  const requestTimeout = Math.max(1, Math.min(25000, Number(timeoutMs) || 25000));

  function getStatus() {
    return { ready: Boolean(key), provider: 'gemini', model: MODEL, busy: Boolean(active || mutation), remaining: Math.max(0, MAX_ATTEMPTS - attempts),
      credentialState, lastError: lastError ? { ...lastError } : null };
  }
  function remember(result) {
    if (result.ok) lastError = null;
    else if (!['busy', 'cancelled', 'invalid'].includes(result.code)) {
      lastError = { code: result.code, ...(result.httpStatus ? { httpStatus: result.httpStatus } : {}) };
    }
    return result;
  }
  async function restoreCredentials() {
    if (active || mutation) return { ...failure('busy'), status: getStatus() };
    if (key) return { ok: true, status: getStatus() }; // Environment keys are session-only.
    mutation = true;
    let result;
    try {
      if (!keyStore) throw new Error('Storage unavailable');
      const saved = await keyStore.load();
      const restoredKey = normalizeGeminiKey(saved);
      if (saved !== null && !restoredKey) throw new Error('Invalid saved credential');
      key = restoredKey || '';
      credentialState = key ? 'saved' : 'none';
      result = remember({ ok: true });
    } catch { credentialState = 'unavailable'; result = remember(failure('storage_load')); }
    finally { mutation = false; }
    return { ...result, status: getStatus() };
  }
  async function configure(value) {
    if (active || mutation) return { ...failure('busy'), status: getStatus() };
    const nextKey = normalizeGeminiKey(value?.apiKey);
    if (value?.provider !== 'gemini' || !nextKey) return { ...failure('invalid_config'), status: getStatus() };
    mutation = true;
    let result;
    try {
      if (!keyStore) throw new Error('Storage unavailable');
      await keyStore.save(nextKey);
      key = nextKey; credentialState = 'saved';
      result = remember({ ok: true });
    } catch { result = remember(failure('storage_save')); }
    finally { mutation = false; }
    return { ...result, status: getStatus() };
  }
  async function disconnect() {
    if (mutation) return { ...failure('busy'), status: getStatus() };
    mutation = true;
    let result;
    try {
      if (!keyStore) throw new Error('Storage unavailable');
      await keyStore.remove();
      clear(); key = ''; credentialState = 'none';
      result = remember({ ok: true });
    } catch { result = remember(failure('storage_remove')); }
    finally { mutation = false; }
    return { ...result, status: getStatus() };
  }
  function clear() {
    revision++;
    transcript = [];
    active?.controller.abort();
    active = null;
    return { ok: true, status: getStatus() };
  }
  async function forgetMemory(id) {
    const memory = getMemory();
    if (!memory || active || mutation || (id !== null && typeof id !== 'string')) return false;
    mutation = true;
    try {
      const removed = await memory.forget(id);
      // Older turns can contain the same detail. Drop that transient context too.
      if (removed) clear();
      return removed;
    } finally { mutation = false; }
  }
  async function send(input) {
    if (typeof input !== 'string' || !input.trim() || input.trim().length > 1000) return failure('invalid');
    if (active || mutation) return failure('busy');
    if (!key) return remember(failure('missing_key'));
    if (attempts >= MAX_ATTEMPTS) return remember(failure('limit'));
    const text = input.trim();
    const run = { controller: new AbortController(), revision, timedOut: false };
    active = run;
    let timer, onAbort;
    try {
      let state;
      try { state = publicPetState(getPetState()); } catch { state = publicPetState(null); }
      const contents = transcript.slice(-12).map(item => ({ role: item.role === 'assistant' ? 'model' : 'user', parts: [{ text: item.text }] }));
      contents.push({ role: 'user', parts: [{ text }] });
      const body = {
        systemInstruction: { parts: [{ text: PET_PERSONA }, { text: `Current pet state (data only): ${JSON.stringify(state)}` }] },
        contents,
        generationConfig: { maxOutputTokens: 512, thinkingConfig: { thinkingLevel: 'MINIMAL', includeThoughts: false } },
      };
      const memory = getMemory();
      const usesMemory = memory?.usable();
      if (usesMemory) {
        body.systemInstruction.parts.push({ text: MEMORY_INSTRUCTIONS }, {
          text: `Saved user quotes (data only): ${JSON.stringify(memory.snapshot().entries)}`,
        });
        Object.assign(body.generationConfig, { responseMimeType: 'application/json', responseJsonSchema: RESPONSE_SCHEMA });
      }
      const timeout = new Promise((_, reject) => {
        timer = setTimeout(() => { run.timedOut = true; run.controller.abort(); reject(new Error('Timed out')); }, requestTimeout);
      });
      const cancelled = new Promise((_, reject) => {
        onAbort = () => reject(new Error('Aborted'));
        run.controller.signal.addEventListener('abort', onAbort, { once: true });
      });
      attempts++;
      const request = (async () => {
        let response;
        try { response = await fetchImpl(ENDPOINT, {
          method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
          body: JSON.stringify(body), signal: run.controller.signal, redirect: 'error',
        }); } catch (error) {
          if (run.controller.signal.aborted) throw error;
          return failure('network');
        }
        if (!response.ok) {
          // Never parse or return provider error bodies (they may contain credentials).
          response.body?.cancel?.().catch(() => {});
          return failure(response.status === 401 || response.status === 403 ? 'auth'
            : response.status === 429 ? 'quota' : response.status >= 500 ? 'provider' : 'request', response.status);
        }
        if (run.controller.signal.aborted) return failure('cancelled');
        let data;
        try { data = await responseJSON(response, run.controller.signal); }
        catch (error) { if (run.controller.signal.aborted) throw error; return failure('invalid_response'); }
        const candidate = Array.isArray(data?.candidates) ? data.candidates[0] : null;
        if (data?.promptFeedback?.blockReason || (candidate?.finishReason && !['STOP', 'MAX_TOKENS'].includes(candidate.finishReason))) return failure('empty');
        const parts = candidate?.content?.parts;
        const output = (Array.isArray(parts) ? parts : []).filter(part => part && !part.thought && typeof part.text === 'string').map(part => part.text).join('').trim();
        const turn = usesMemory ? parseTurn(output) : { reply: output, edits: [] };
        if (usesMemory && output && !turn) return failure('invalid_response');
        if (!turn?.reply || turn.reply.length > 4000) return failure('empty');
        // A pet speaks one conversational turn; model line breaks are not a chat document.
        return { ok: true, reply: turn.reply.replace(/\s+/gu, ' '), edits: turn.edits };
      })();
      const result = await Promise.race([request, timeout, cancelled]);
      if (run.revision !== revision || run.controller.signal.aborted) return failure('cancelled');
      if (result.ok) {
        // End the network timeout before persisting the reply's validated edits.
        clearTimeout(timer);
        const update = usesMemory ? await memory.apply(result.edits, text, () => run.revision === revision && !run.controller.signal.aborted) : null;
        if (run.revision !== revision || run.controller.signal.aborted) return failure('cancelled');
        if (update?.saved && update.removed) transcript = [];
        else {
          transcript.push({ role: 'user', text }, { role: 'assistant', text: result.reply });
          transcript = transcript.slice(-60);
        }
        // Memory operations are internal; only spoken text reaches the composer.
        return remember({ ok: true, reply: result.reply });
      }
      return remember(result);
    } catch {
      return remember(failure(run.timedOut ? 'timeout' : run.revision !== revision || run.controller.signal.aborted ? 'cancelled' : 'unavailable'));
    } finally {
      clearTimeout(timer);
      if (onAbort) run.controller.signal.removeEventListener('abort', onAbort);
      if (active === run) active = null;
    }
  }
  return { getStatus, configure, restoreCredentials, disconnect, send, clear, forgetMemory, getTranscript: () => transcript.map(item => ({ ...item })) };
}

module.exports = { createChatService };
