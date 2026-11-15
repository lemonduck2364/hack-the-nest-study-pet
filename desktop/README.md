# Mac desktop pet — life, gaze and conversation

> **Team demo snapshot.** Reconstructed from the November 15 checkpoint before smooth animation transitions and interchangeable character packs. This is the Mac desktop build with live bubble chat, autonomous play and naps, and the original attention-pose gaze. Long-term memory and the public Lobby are planned. The temporary character art is for closed, noncommercial team review; see THIRD_PARTY_NOTICES.md.

A standalone transparent Electron desktop companion. It now plays, tires, rests, sleeps, and recovers without user input. Life remains a local rule-based simulation. Session chat can connect to Gemini with a user-provided API key. Learned long-term memory, persistent identity/state, Lobby, screen capture and autostart are not implemented.

## Run

From `study-pet/desktop`:

```sh
npm ci
npm start
```

The installed Electron version is pinned to **45.3.2**. Node >=22.12 is needed for its npm dependency. Electron supplies the actual app runtime.

Click for a reaction; drag to move. Right-click the pet or use **◉** in the Mac menu bar for **Chat**, **Connection…**, **Nap / Wake**, **Gaze**, **Bring back**, and **Quit**. A manual nap lasts until explicitly woken; spontaneous naps end when energy recovers. Clicking a sleeping pet wakes it briefly without refilling its energy. Holding the pet pauses its life and animation. Position/energy reset on app restart.

## Quiet conversation beside the pet

Hover over the visible character and a single-line **What’s on my mind…** invitation appears beside her. It never takes focus. Clicking it opens a small input box, not a chatbot dashboard. Enter sends, Shift + Enter adds a line, and IME composition does not send accidentally. On success the unchanged sent draft clears and the input hides; a new draft typed during the request stays open. Failure keeps the draft with a short nontechnical notice.

The pet's visual language has no labels or energy bar:

- Fictional thoughts use a scalloped cloud with two detached thought dots.
- Addressed speech uses a rounded balloon with a pointed tail.
- Current activity uses a small unobtrusive ticket/pill.

These are scripted thoughts and activity descriptions, not private model reasoning. Replies appear in the pet's own separate, nonfocusable speech bubble. Long replies paginate to the measured text area; arrows reveal every part, preserving all Chinese, emoji, whitespace and words. Replies are never silently truncated, never automatically paged, and stay until dismissed or replaced by another reply. Life updates cannot overwrite a reply being read. Text and empty areas remain mouse-pass-through; only page/dismiss controls intercept clicks. Bubbles prefer above-left of the character, flip at screen edges, and move with the pet.

**Connection…** in the pet menu opens the separate setup panel. The normal composer contains no provider, quota, model, transcript, or status dashboard. Set a Gemini key in the password field, then choose **Set key**. This only configures the local session; it does not validate the key or make a network request. The field clears immediately. The key stays only in main-process memory and is not saved, logged, or returned in status. `GEMINI_API_KEY` can alternatively be supplied at launch. A successful reply verifies provider access. Both editable windows retain standard macOS Edit shortcuts and native Cut/Copy/Paste menus.

Sending shares the typed message, bounded recent session dialogue, and sanitized pet activity/energy with Gemini. The adapter uses `gemini-3.1-flash-lite`, a 25-second timeout, 512 output-token limit, no automatic retries, and at most 30 outbound attempts per app session. No fake pet response is produced on error. The service's session history is internal context, not a transcript screen. **Forget this conversation** inside Connection clears it and cancels an active reply; generation guards prevent old replies reappearing. This does not reset the request allowance. App restart loses the key, draft and conversation; there is no durable memory or credential storage.

## Same-character gaze

The approved **大肥魚** remains the only character. It uses attributed transparent video assets for idle, playing with a cube/kitty, and sleeping. See `THIRD_PARTY_NOTICES.md` and the asset manifest.

When the cursor stays near for 150 ms, the same character turns into an attention presentation using the original idle video's first frame. Only the original pixels inside two calibrated eye regions are deformed toward the pointer; eyebrows, hair, face and body are not shifted. The eye mask fades to zero along its boundaries. This is a local 2D eye deformation on a held pose, **not a layered Live2D rig**. The source assets remain unchanged. When the cursor leaves, normal activity video resumes; sleep closes off attention immediately. Dragging freezes gaze in the held pose. Life and energy keep their existing state through attention transitions.

The flat **Gaze** checkbox turns this behavior on/off. There is no Appearance submenu or separate eye-tracking character. If gaze preparation fails, the same character's normal video remains. If animation fails but the original pose is available, that same pose stays visible with an animation-unavailable message; no replacement blob is shown.

The threshold uses three visible character widths (approximately 330 DIP at this presentation size), measured from the face, rather than the transparent video or window width. Exit uses 3.35 widths for 200 ms to avoid threshold flicker. Eye movement eases toward the pointer; each eye is limited to 3 native source pixels horizontally and 2 vertically. A brief crossfade changes between video and the original attention pose. Mouse hit testing uses the composited alpha of what is currently visible, so transparent margins remain click-through.

## Life and cursor behavior

A main-process state machine owns energy and activities. It begins idle for about four seconds, then alternates short play and idle periods. Play consumes energy; at low energy it settles for six seconds and sleeps until recovered. A full first cycle is approximately one to two minutes depending on the chosen play durations. Manual nap/wake and dragging override the cycle. Long delayed timer callbacks advance at most one second, preventing a burst of activity after Mac sleep/resume.

Cursor position is sampled locally at 15 Hz through Electron `screen.getCursorScreenPoint()`. Both cursor and window bounds are device-independent pixels (DIP); no multiplication by Retina scale factor is applied. Gaze distance is relative to the rendered pet width, with a smooth edge fade. Coordinates are neither saved nor sent over a network. Reduced-motion preference disables CSS movement and pauses video; life states still change. The small renderer opts out of background throttling so an unfocused desktop pet can animate.

## Checks

```sh
npm run check
npm test
npm run smoke
```

Thirty-four automated tests cover chat request limits/cancellation/errors, key handling, late-reply/draft and snapshot races, complete Unicode pagination, window placement, autonomous life, gaze thresholds and pixel-region preservation. The earlier actual-frame audit changed only eye pixels. `smoke` verifies installed Electron and asset readability in Node mode; none of these are GUI acceptance.


Optional normal-entry diagnostics:

```sh
PET_DEBUG=1 npm start
```

This prints activity transitions, renderer lifecycle, video readiness/errors, gaze readiness and attention transitions, and opaque/transparent sample counts. It does not print cursor coordinates. Diagnostics are off by default.

## Desktop acceptance

Latest chat result: Evan entered a key in the app and confirmed that paste works and a real model reply arrived. The Planner observed the no-key setup layout, then key-set status, without reading or saving the key. The first native copy/paste failure was fixed by restoring Electron's standard Edit menu and input context menus. This confirms the first live conversation path; hover-focus, screen-edge, IME and cancellation UI edge cases below still need separate acceptance. Twenty-six automated tests passed before this small native-menu fix; its syntax check and user paste check passed afterward.

Latest result: Evan confirmed the same-character gaze test (cursor left/right near the face, then away to resume activity) with “yes it's good.” The Planner also opened the flat menu and visually verified all four labels without truncation. Eleven automated tests passed; normal app diagnostics showed gaze preparation, attention entry, and attention stopping on natural sleep. Other platform and edge cases below remain separate checks.

Evan reported the previous shell's click/drag, manual sleep/wake, transparent-area click-through and uninterrupted typing working. The redesigned small composer, shaped bubbles and separate Connection panel require actual desktop acceptance; earlier UI acceptance does not prove this redesign:

- Hover while typing in another app: invitation must not steal focus. Move onto it and click; verify input opens only after that explicit action.
- Verify left-edge placement, closing/reopening with a draft, IME Enter, no-key state, masked key setup, failed replies, and Clear chat during an in-flight request. The first successful live reply is user-confirmed above; other paths are distinct checks.
- Observe a complete spontaneous play → tired rest → sleep → recovered activity cycle.
- Verify video transparency and silhouette click-through, including moving limbs and empty margins.
- Check drag during each activity; it pauses rather than continuing to play in your hand.
- Move the cursor around the same 大肥魚, verify eye motion in the attention pose, then move away and confirm normal play resumes. Test Gaze off/on, sleeping, and holding during attention.
- Verify manual nap stays asleep and wake works, including a low-energy pet.
- Check normal typing, app switching, UI Quit, single-instance behavior, Spaces/fullscreen, screen changes, and OS sleep/resume as needed. Windows and signed distribution builds remain untested.

## Boundaries

Only local scripts, styles and media load in renderers. Their CSP disables network connections and form navigation; window opening/navigation and permission requests are denied. Gemini requests happen only in the main-process service after Send. The API-key help action opens one fixed official URL. Node integration is off, context isolation and renderer sandboxing are on. The preload exposes only fixed pet operations. IPC checks the exact owning window for pet, hint and chat actions, and validates drag coordinates. Only Connection may configure a key or clear the conversation; only the composer may send. The transcript is kept inside the service and is not sent to renderers. Bubble actions are limited to its own window and stale serials are rejected. The alpha mask and gaze are presentation concerns; the renderer cannot overwrite life/energy directly.

Sources: [Electron screen/DIP](https://www.electronjs.org/docs/latest/api/screen), [BrowserWindow](https://www.electronjs.org/docs/latest/api/browser-window), [security](https://www.electronjs.org/docs/latest/tutorial/security).
