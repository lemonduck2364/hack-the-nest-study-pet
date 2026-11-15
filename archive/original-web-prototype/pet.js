const $ = id => document.getElementById(id);
const yard = $('yard'), pet = $('pet'), chat = $('chat'), message = $('message');
const namespace = 'study-pet-v1';
const newId = () => globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2);
let petId = newId();
let saved;
try {
  petId = localStorage.getItem(namespace) || petId;
  saved = JSON.parse(localStorage.getItem(namespace + ':' + petId));
} catch {}
const state = saved ?? {
  personality: { cheerful: true, curious: true }, energy: 75, memories: [], shelter: false
};
function save() {
  try {
    localStorage.setItem(namespace + ':' + petId, JSON.stringify(state));
    localStorage.setItem(namespace, petId);
  } catch {
    $('identity').textContent = 'Local storage unavailable';
  }
}
function remember(key, value) {
  const existing = state.memories.find(entry => entry.key === key);
  if (existing) existing.value = value;
  else state.memories = [...state.memories, { key, value }].slice(-10);
  save();
}
const recall = key => state.memories.find(entry => entry.key === key)?.value;
$('identity').textContent = 'Pet ' + petId.slice(0, 8);
save();

let petLocation = 'desktop', requested = null;
let x = yard.clientWidth * .38, y = 198;
let phase = state.shelter ? 'idle' : 'twig';
let carrying = false, gesture, pointer, chaseTarget, pauseUntil = 0;
let nextIdle = performance.now() + 3000, nextChase = 0, chaseUntil = 0;
let quiet = false, lastSpeech = -Infinity, speechToken = 0;
const ground = 198;
const homeX = () => Math.max(0, yard.clientWidth * .18 - 24);
const nearOwner = () => yard.clientWidth * .48;
const clamp = (n, max) => Math.min(Math.max(0, max), Math.max(0, n));
function paint() {
  x = clamp(x, yard.clientWidth - pet.offsetWidth);
  y = clamp(y, yard.clientHeight - pet.offsetHeight);
  pet.style.transform = `translate(${x}px,${y}px)`;
  $('home').classList.toggle('complete', state.shelter);
  $('home').setAttribute('aria-label', state.shelter ? 'Finished shelter' : 'Unfinished shelter');
  $('twig').hidden = carrying || state.shelter;
  pet.querySelector('.carried').hidden = !carrying;
}
let currentActivity;
function activity(text, face = '•ᴗ•') {
  if (currentActivity === text) return;
  currentActivity = text;
  $('status').textContent = text;
  pet.querySelector('.face').textContent = face;
}
function speak(text, proactive = false) {
  if (proactive && pendingReply) return;
  if (proactive && performance.now() - lastSpeech < 15000) {
    setTimeout(() => { if (petLocation === 'desktop' && !quiet) speak(text, true); },
      15000 - (performance.now() - lastSpeech) + 10);
    return;
  }
  lastSpeech = performance.now();
  $('speech').textContent = text;
  const token = ++speechToken;
  setTimeout(() => { if (token === speechToken) $('speech').textContent = ''; }, 15000);
}
function move(tx, ty, step) {
  tx = clamp(tx, yard.clientWidth - pet.offsetWidth);
  ty = clamp(ty, yard.clientHeight - pet.offsetHeight);
  const distance = Math.hypot(tx - x, ty - y);
  if (distance <= step) { x = tx; y = ty; return true; }
  x += (tx - x) * step / distance;
  y += (ty - y) * step / distance;
  return false;
}
let lastFrame = performance.now(), lastEnergy = lastFrame, wanderX = x, idleMode = 'Daydreaming';
function tick(now) {
  const step = Math.min(now - lastFrame, 64) * .13;
  lastFrame = now;
  if (petLocation === 'lobby') { requestAnimationFrame(tick); return; }
  if (gesture?.dragging) activity('Picked up', '•o•');
  else if (now < pauseUntil) activity('Settling down');
  else if (quiet) {
    const arrived = move(nearOwner(), ground, step);
    activity(arrived ? 'Keeping you company' : 'Coming over', arrived ? '˘ᴗ˘' : '•ᴗ•');
  } else if (now < chaseUntil) {
    move(chaseTarget.x - 24, chaseTarget.y - 21, step * 1.6);
    activity('Chasing the cursor', '•o•');
  } else if (phase === 'twig') {
    activity('Looking for a twig');
    if (move(yard.clientWidth * .78 - 24, ground, step)) {
      carrying = true;
      phase = 'roof';
    }
  } else if (phase === 'roof') {
    activity('Carrying a twig home');
    if (move(homeX(), ground, step)) {
      carrying = false;
      state.shelter = true;
      state.energy = Math.max(0, state.energy - 18);
      phase = 'idle';
      idleMode = 'Napping by the shelter';
      nextIdle = now + 6500;
      remember('napSpot', 'shelter');
      speak('I found a stick for my roof. Come see?', true);
    }
  } else {
    if (now > nextIdle) {
      idleMode = state.energy < 45 ? 'Napping by the shelter'
        : (state.personality.curious && Math.random() < .65 ? 'Wandering' : 'Daydreaming');
      wanderX = yard.clientWidth * (.2 + Math.random() * .6);
      nextIdle = now + 4200;
    }
    if (idleMode === 'Wandering') move(wanderX, ground, step * .55);
    if (idleMode.startsWith('Napping')) move(recall('napSpot') ? homeX() : nearOwner(), ground, step * .55);
    activity(idleMode, idleMode.startsWith('Napping') ? '˘ᴗ˘' : '•ᴗ•');
  }
  if (now - lastEnergy >= 5000) {
    const delta = /Napping|company/.test(currentActivity) ? 12 : -5;
    lastEnergy = now;
    state.energy = clamp(state.energy + delta, 100);
    save();
  }
  paint();
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);

yard.addEventListener('pointermove', event => {
  if (gesture || event.pointerType === 'touch' || quiet || location !== 'desktop') return;
  const box = yard.getBoundingClientRect();
  pointer = { x: event.clientX - box.left, y: event.clientY - box.top };
  const now = performance.now();
  if (now < chaseUntil) chaseTarget = pointer;
  else if (now > nextChase && Math.hypot(pointer.x - x - 24, pointer.y - y - 21) < 85) {
    nextChase = now + 4500;
    if (state.energy >= 47) { chaseTarget = pointer; chaseUntil = now + 900; }
    else { activity('Too sleepy to chase', '˘ᴗ˘'); pauseUntil = now + 350; }
  }
});
yard.addEventListener('pointerleave', () => { chaseUntil = 0; });
pet.addEventListener('pointerdown', event => {
  if (event.button !== 0 || gesture) return;
  pet.setPointerCapture(event.pointerId);
  gesture = { id: event.pointerId, startX: event.clientX, startY: event.clientY, x, y, dragging: false };
  chaseUntil = 0;
});
pet.addEventListener('pointermove', event => {
  if (gesture?.id !== event.pointerId) return;
  const dx = event.clientX - gesture.startX, dy = event.clientY - gesture.startY;
  if (Math.hypot(dx, dy) >= 7) gesture.dragging = true;
  if (gesture.dragging) {
    x = gesture.x + dx; y = gesture.y + dy;
    pet.classList.add('held');
    paint();
  }
});
function release(event, cancelled = false) {
  if (gesture?.id !== event.pointerId) return;
  const dragged = gesture.dragging;
  gesture = null;
  pet.classList.remove('held');
  if (dragged) pauseUntil = performance.now() + 600;
  else if (!cancelled) openChat();
}
pet.addEventListener('pointerup', release);
pet.addEventListener('pointercancel', event => release(event, true));
pet.addEventListener('lostpointercapture', event => release(event, true));
pet.addEventListener('click', event => { if (event.detail === 0) openChat(); });
function openChat() { chat.hidden = false; message.focus(); }

function applyLocalBehavior(input) {
  const phrase = input.toLowerCase().replace(/[’']/g, '').replace(/[.!?]/g, '').trim();
  if (phrase.includes('quiet company') && phrase.includes('work')) {
    remember('quietWork', true);
    return 'I’ll remember you like quiet company while you work.';
  }
  if (/starting (my )?work|time to work|start studying/.test(phrase)) {
    quiet = Boolean(recall('quietWork'));
    chaseUntil = 0;
    return quiet ? 'I’ll come sit with you.' : 'Have a good work session! I’ll be here doing my thing.';
  }
  if (/\btired\b/.test(phrase)) { quiet = true; return 'I’ll sit with you for a bit.'; }
  if (/\b(play|break|done)\b/.test(phrase)) { quiet = false; return 'Okay! Come find me in the yard.'; }
  if (/\b(shelter|twig|home)\b/.test(phrase)) {
    return state.shelter ? 'My roof is finished. It’s a good spot for a nap.' : 'I’m looking for a twig to finish my shelter.';
  }
  return state.energy < 45 ? 'I’m a little sleepy. Want to sit together?' :
    state.personality.cheerful ? 'Hi! I’m glad you came by.' : 'I’m here.';
}
let pendingReply = false;
const conversation = [];
async function generateReply(input, behaviorResult) {
  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(30000),
    body: JSON.stringify({
      message: input,
      history: conversation,
      context: { personality: state.personality, energy: state.energy,
        memories: state.memories, shelter: state.shelter, activity: currentActivity,
        quiet, behaviorResult }
    })
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'AI chat is unavailable.');
  if (typeof result.reply !== 'string' || !result.reply.trim()) throw new Error('Empty AI reply. Please try again.');
  conversation.push({ role: 'user', content: input }, { role: 'assistant', content: result.reply });
  conversation.splice(0, Math.max(0, conversation.length - 12));
  return result.reply;
}
fetch('/api/status').then(response => response.json()).then(result => {
  $('chat-status').textContent = result.ready ? 'Gemini key configured' : 'AI chat needs a Gemini key in .env';
}).catch(() => { $('chat-status').textContent = 'Start python3 server.py to enable AI chat.'; });
chat.addEventListener('submit', async event => {
  event.preventDefault();
  const input = message.value.trim();
  if (!input || pendingReply || petLocation !== 'desktop') return;
  pendingReply = true;
  const send = chat.querySelector('button');
  send.disabled = true;
  $('lobby').disabled = true;
  const behaviorResult = applyLocalBehavior(input);
  $('chat-status').textContent = 'Thinking…';
  try {
    const reply = await generateReply(input, behaviorResult);
    speak(reply);
    if (message.value.trim() === input) message.value = '';
    $('chat-status').textContent = 'AI reply';
  } catch (error) {
    $('chat-status').textContent = error.name === 'TimeoutError'
      ? 'The reply timed out. Please try again.' : error.message;
    speak(behaviorResult);
    $('chat-status').textContent += ' Showing a scripted response.';
  } finally {
    pendingReply = false;
    send.disabled = false;
    $('lobby').disabled = false;
  }
});

function visitRequested(id) {
  if (id !== petId || requested) return;
  requested = petLocation === 'desktop' ? 'lobby' : 'desktop';
  window.dispatchEvent(new CustomEvent('visitRequested', { detail: { petId } }));
}
function confirmLocation(id, destination) {
  if (id !== petId || !['desktop', 'lobby'].includes(destination)) return false;
  petLocation = destination;
  requested = null;
  const away = destination === 'lobby';
  pet.hidden = away;
  $('away').hidden = !away;
  $('lobby').textContent = away ? 'Return home' : 'Visit Lobby';
  if (away) {
    chat.hidden = true;
    $('speech').textContent = '';
    activity('Away from home');
  }
  chaseUntil = 0;
  return true;
}
window.studyPet = { petId, visitRequested, confirmLocation };
$('lobby').addEventListener('click', () => {
  visitRequested(petId);
  if (requested) confirmLocation(petId, requested);
});
