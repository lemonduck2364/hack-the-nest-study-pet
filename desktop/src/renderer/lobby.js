'use strict';

const lobby = window.petLobby;
const entry = document.querySelector('#entry');
const room = document.querySelector('#room');
const hostButton = document.querySelector('#host');
const joinButton = document.querySelector('#join');
const inviteInput = document.querySelector('#invite');
const homeButton = document.querySelector('#home');
const copyButton = document.querySelector('#copy');
const roomStatus = document.querySelector('#room-status');
const progress = document.querySelector('#progress');
const error = document.querySelector('#error');
const announcement = document.querySelector('#announcement');

const seats = Array.from(document.querySelectorAll('.seat'), (node) => ({
  node,
  art: node.querySelector('.pet-art'),
  speech: node.querySelector('.speech'),
  empty: node.querySelector('.empty-seat'),
  sparkle: node.querySelector('.sparkle'),
  label: node.querySelector('.pet-label'),
  pet: null,
  pose: 'idle'
}));

function loadArt(src) {
  const image = new Image();
  image.addEventListener('load', () => seats.forEach(drawPet));
  image.src = src;
  return image;
}

const pixelAtlas = window.PixelPandaAtlas;
function pixelCrop(frame) {
  return [frame % pixelAtlas.columns * pixelAtlas.width, Math.floor(frame / pixelAtlas.columns) * pixelAtlas.height,
    pixelAtlas.width, pixelAtlas.height];
}

const artwork = {
  dafeiyu: {
    name: 'Dafeiyu',
    image: loadArt('assets/dafeiyu/idle-poster.png'),
    idle: [213, 63, 213, 267]
  },
  'red-panda': {
    name: 'Red Panda',
    image: loadArt('assets/red-panda/andrew-original.png'),
    idle: [785, 68, 561, 645],
    wave: [62, 8, 600, 708]
  },
  'pixel-panda': {
    name: 'Pixel Panda',
    image: loadArt(pixelAtlas.source),
    idle: pixelCrop(pixelAtlas.tracks.idle[0][0]),
    wave: pixelCrop(pixelAtlas.tracks.wave[3][0]),
    pixelated: true
  }
};

function appearanceFor(pet) {
  return Object.hasOwn(artwork, pet.appearance) ? artwork[pet.appearance] : artwork.dafeiyu;
}

function drawPet(seat) {
  const { art, pet, pose } = seat;
  const context = art.getContext('2d');
  context.clearRect(0, 0, art.width, art.height);
  if (!pet) return;

  const character = appearanceFor(pet);
  context.imageSmoothingEnabled = !character.pixelated;
  art.style.imageRendering = character.pixelated ? 'pixelated' : 'auto';
  const [x, y, width, height] = character[pose] || character.idle;
  if (!character.image.naturalWidth) return;

  const scale = Math.min((art.width - 4) / width, (art.height - 4) / height);
  const drawWidth = width * scale;
  const drawHeight = height * scale;
  context.drawImage(character.image, x, y, width, height,
    (art.width - drawWidth) / 2, art.height - drawHeight, drawWidth, drawHeight);
}

function updateSeat(seat, pet, selfId) {
  const appearanceChanged = seat.pet?.id !== pet?.id || seat.pet?.appearance !== pet?.appearance;
  seat.pet = pet;
  seat.art.hidden = !pet;
  seat.empty.hidden = Boolean(pet);
  if (pet) {
    const name = appearanceFor(pet).name;
    seat.label.textContent = pet.id === selfId ? `${name} · You` : name;
  } else {
    seat.label.textContent = 'Open spot';
  }
  if (appearanceChanged) drawPet(seat);
}

const playedGreetings = new Set();
let activeGreeting = null;
let greetingTimers = [];

function resetGreeting() {
  greetingTimers.forEach(clearTimeout);
  greetingTimers = [];
  activeGreeting = null;
  announcement.textContent = '';
  for (const seat of seats) {
    seat.node.classList.remove('hop', 'flourish');
    seat.speech.hidden = true;
    seat.sparkle.hidden = true;
    if (seat.pose !== 'idle') {
      seat.pose = 'idle';
      drawPet(seat);
    }
  }
}

function speak(seat, line, effect) {
  seat.speech.textContent = line;
  seat.speech.hidden = false;
  seat.pose = 'wave';
  drawPet(seat);
  seat.node.classList.add(effect);
  seat.sparkle.hidden = effect !== 'flourish';
  announcement.textContent = `${appearanceFor(seat.pet).name}: ${line}`;
}

function updateGreeting(greeting) {
  if (activeGreeting === greeting?.id) return;
  if (activeGreeting !== null) resetGreeting();
  if (!greeting || playedGreetings.has(greeting.id)) return;

  const first = seats.find((seat) => seat.pet?.id === greeting.firstId);
  const second = seats.find((seat) => seat.pet?.id === greeting.secondId);
  if (!first || !second) return;

  activeGreeting = greeting.id;
  playedGreetings.add(greeting.id);
  speak(first, 'Hi, friend!', 'hop');
  greetingTimers = [
    setTimeout(() => speak(second, 'Hi! Come sit with me.', 'flourish'), 1150),
    setTimeout(resetGreeting, 4900)
  ];
}

let state = null;
let revision = 0;
let copied = false;
let pending = false;

function showError(message) {
  error.textContent = message || '';
  error.hidden = !message;
}

function updateEntryControls() {
  const joining = pending || state?.phase === 'joining';
  hostButton.disabled = joining;
  joinButton.disabled = joining;
  inviteInput.disabled = joining;
  progress.hidden = !joining;
  progress.textContent = joining ? 'Opening room…' : '';
}

function updateRoomStatus() {
  if (copied) roomStatus.textContent = 'Invite copied.';
  else roomStatus.textContent = state.pets.length < 2 ? 'Waiting for a friend…' : 'Your friend is here.';
}

function render(snapshot) {
  if (!snapshot) return;
  const wasInRoom = state?.phase === 'room';
  const inRoom = snapshot.phase === 'room';
  if (snapshot.invite !== state?.invite || snapshot.pets.length !== state?.pets.length) copied = false;
  state = snapshot;
  entry.hidden = inRoom;
  room.hidden = !inRoom;
  updateEntryControls();
  showError(snapshot.error);

  if (!inRoom) {
    resetGreeting();
    return;
  }

  copyButton.disabled = !snapshot.invite;
  updateRoomStatus();
  const pets = snapshot.pets;
  seats.forEach((seat, index) => updateSeat(seat, pets.find((pet) => pet.seat === index) || null, snapshot.selfId));
  updateGreeting(snapshot.greeting);
  if (!wasInRoom) (copyButton.disabled ? homeButton : copyButton).focus();
}

async function openRoom(action) {
  if (pending || state?.phase === 'joining') return;
  pending = true;
  showError('');
  updateEntryControls();
  const startedAt = revision;
  try {
    const snapshot = await action();
    if (revision === startedAt) render(snapshot);
  } catch {
    showError('Could not open this room. Try again.');
  } finally {
    pending = false;
    updateEntryControls();
  }
}

hostButton.addEventListener('click', () => openRoom(() => lobby.host()));
document.querySelector('#join-form').addEventListener('submit', (event) => {
  event.preventDefault();
  const invite = inviteInput.value.trim();
  if (invite) openRoom(() => lobby.join(invite));
  else showError('Enter an invite code to join.');
});
homeButton.addEventListener('click', async () => {
  try { await lobby.goHome(); }
  catch { showError('Could not go home. Try again.'); }
});
copyButton.addEventListener('click', async () => {
  const expectedInvite = state?.invite;
  try {
    const success = await lobby.copyInvite();
    if (state?.phase !== 'room' || expectedInvite !== state.invite) return;
    if (!success) throw new Error('Invite unavailable');
    copied = true;
    showError('');
    updateRoomStatus();
  } catch {
    showError('Could not copy the invite. Try again.');
  }
});

lobby.onState((snapshot) => {
  revision += 1;
  render(snapshot);
});
lobby.snapshot().then((snapshot) => {
  if (revision === 0) render(snapshot);
}).catch(() => showError('Could not open the Pet Lobby.'));
