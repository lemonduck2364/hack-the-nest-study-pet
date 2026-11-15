'use strict';

const { PET_PERSONA, publicPetState } = require('./pet-persona.cjs');
const MODEL = 'gemini-3.1-flash-lite';
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;
const MAX_ATTEMPTS = 30;
const MAX_RESPONSE_BYTES = 64 * 1024;
const errors = {
  invalid: 'Please write a message of 1–1,000 characters.',
  missing_key: 'Connect Gemini in settings to start chatting.',
  invalid_config: 'Choose Gemini and enter a valid API key.',
  busy: 'A reply is already on its way. Please wait a moment.',
  limit: 'This test session has reached its 30-message limit. Restart the pet to begin another session.',
  auth: 'Gemini could not accept this key. Please check your API key and project access.',
  quota: 'Gemini’s quota or rate limit was reached. Please try again later or check your project’s limits.',
  unavailable: 'The chat service is unavailable right now. Your pet can keep you company while you try again later.',
  timeout: 'The reply took too long. You can try sending your message again.',
  cancelled: 'This reply was cancelled.',
  empty: 'The pet could not finish that reply. Please try a different message.',
  request: 'Gemini could not accept this request. Please check the project’s model access.',
};
const failure = code => ({ ok: false, code, error: errors[code] || errors.unavailable });

function validKey(value) {
  return typeof value === 'string' && value.trim().length >= 8 && value.trim().length <= 512
    && /^[A-Za-z0-9_.-]+$/.test(value.trim()) && !/^(your[-_]?key|placeholder)/i.test(value.trim());
}

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

function createChatService({ getPetState = () => ({}), fetchImpl = globalThis.fetch, env = process.env, timeoutMs = 25000 } = {}) {
  let key = validKey(env.GEMINI_API_KEY) ? env.GEMINI_API_KEY.trim() : '';
  let attempts = 0, revision = 0, active = null;
  let transcript = [];
  const requestTimeout = Math.max(1, Math.min(25000, Number(timeoutMs) || 25000));

  function getStatus() {
    return { ready: Boolean(key), provider: 'gemini', model: MODEL, busy: Boolean(active), remaining: Math.max(0, MAX_ATTEMPTS - attempts) };
  }
  function configure(value) {
    if (active) return { ...failure('busy'), status: getStatus() };
    if (!value || value.provider !== 'gemini' || !validKey(value.apiKey)) return { ...failure('invalid_config'), status: getStatus() };
    key = value.apiKey.trim();
    return { ok: true, status: getStatus() };
  }
  function clear() {
    revision++;
    transcript = [];
    active?.controller.abort();
    active = null;
    return { ok: true, status: getStatus() };
  }
  async function send(input) {
    if (typeof input !== 'string' || !input.trim() || input.trim().length > 1000) return failure('invalid');
    if (active) return failure('busy');
    if (!key) return failure('missing_key');
    if (attempts >= MAX_ATTEMPTS) return failure('limit');
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
      const timeout = new Promise((_, reject) => {
        timer = setTimeout(() => { run.timedOut = true; run.controller.abort(); reject(new Error('Timed out')); }, requestTimeout);
      });
      const cancelled = new Promise((_, reject) => {
        onAbort = () => reject(new Error('Aborted'));
        run.controller.signal.addEventListener('abort', onAbort, { once: true });
      });
      attempts++;
      const request = (async () => {
        const response = await fetchImpl(ENDPOINT, {
          method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
          body: JSON.stringify(body), signal: run.controller.signal, redirect: 'error',
        });
        if (!response.ok) {
          // Never parse or return provider error bodies (they may contain credentials).
          response.body?.cancel?.().catch(() => {});
          return failure(response.status === 401 || response.status === 403 ? 'auth'
            : response.status === 429 ? 'quota' : response.status === 400 || response.status === 404 ? 'request' : 'unavailable');
        }
        if (run.controller.signal.aborted) return failure('cancelled');
        const data = await responseJSON(response, run.controller.signal);
        const candidate = Array.isArray(data?.candidates) ? data.candidates[0] : null;
        if (data?.promptFeedback?.blockReason || (candidate?.finishReason && !['STOP', 'MAX_TOKENS'].includes(candidate.finishReason))) return failure('empty');
        const parts = candidate?.content?.parts;
        const reply = (Array.isArray(parts) ? parts : []).filter(part => part && !part.thought && typeof part.text === 'string').map(part => part.text).join('').trim();
        if (!reply || reply.length > 4000) return failure('empty');
        return { ok: true, reply };
      })();
      const result = await Promise.race([request, timeout, cancelled]);
      if (run.revision !== revision || run.controller.signal.aborted) return failure('cancelled');
      if (result.ok) {
        transcript.push({ role: 'user', text }, { role: 'assistant', text: result.reply });
        transcript = transcript.slice(-60);
      }
      return result;
    } catch {
      return failure(run.timedOut ? 'timeout' : run.revision !== revision || run.controller.signal.aborted ? 'cancelled' : 'unavailable');
    } finally {
      clearTimeout(timer);
      if (onAbort) run.controller.signal.removeEventListener('abort', onAbort);
      if (active === run) active = null;
    }
  }
  return { getStatus, configure, send, clear, getTranscript: () => transcript.map(item => ({ ...item })) };
}

module.exports = { createChatService };
