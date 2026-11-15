# Study Pet prototype

One browser-based pet per browser profile and site origin. The yard plays immediately. The prototype uses local storage and needs no keys, dependencies, or backend.

## Run and deploy

Run `python3 -m http.server 8000 --bind 127.0.0.1` in this directory, then open http://127.0.0.1:8000. To deploy, serve `index.html`, `style.css`, and `pet.js` together from any static web host. A different origin starts with a fresh pet.

## Demo

1. Leave the yard alone. The pet collects a twig, adds a roof, speaks first, and settles at home.
2. Bring the cursor near the pet, click to chat, then drag and release it.
3. Say “I’m starting work.” Teach “I like quiet company while I work,” reload, and say “I’m starting work” again. The pet walks over and settles. Say “take a break” to resume its routine.
4. Visit the Lobby and return using the header button. The pet ID, shelter, and memory remain the same.

## Implementation

`pet.js` holds movement and behavior in `tick`, storage in `save` and `remember`, and replaceable scripted dialogue in `generateReply`. The twig sequence and supported chat phrases are scripted. Energy and personality affect idle behavior, energy affects cursor play, and saved memories determine where the pet naps and how it responds to the work cue.

## Lobby interface

The desktop dispatches a `visitRequested` browser event with `detail: { petId }`. The integration confirms with `window.studyPet.confirmLocation(petId, "lobby")` or `window.studyPet.confirmLocation(petId, "desktop")`. Replace the button's local confirmation with Evan’s integration. The prototype starts at home on each launch. Owner conversations and learned preferences are outside the Lobby payload.

## AI chat

Install the certificate dependency with `python3 -m pip install -r requirements.txt`, then run `python3 server.py` instead of the static server. Create a key in [Google AI Studio](https://aistudio.google.com/api-keys) and put it in
`.env` as `GEMINI_API_KEY`. Changes to the key are read on the next request.
The default model is `gemini-3.1-flash-lite`, configurable with `GEMINI_MODEL`.

The server sends the latest message, up to six recent exchanges, and the pet's
personality, energy, activity, and memories to Gemini's GenerateContent API.
Conversation history lives in browser memory until reload. Learned preferences
remain in local storage. Edit souls.md to change the model's personality.
Only the supported local commands change behavior or saved preferences.
Generated replies do not automatically add memories or invoke tools.
Missing keys and network errors show an explicitly labeled scripted fallback.

The Python server serves only the three public web assets. It keeps .env private
and binds to localhost. AI chat requires this backend; static hosting supports
only the original offline behavior. Public hosting requires authentication and
request limits before exposing the paid API.
