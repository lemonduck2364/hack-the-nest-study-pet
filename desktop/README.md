# Mac desktop pet — life, gaze and conversation

A standalone transparent Electron desktop companion. It now plays, tires, rests, sleeps, and recovers without user input. Life remains a local rule-based simulation. Session chat can connect to Gemini with a user-provided API key. Chat can keep a small set of everyday preferences across app restarts.

## Run

Open **Nest Pet.app** in Finder, or drag it to the Dock. See [the Mac build instructions](../README.md#build-the-app-from-source) to create the app bundle. The packaged version and development launcher share the same local app data. Quit from the pet menu before switching from a running development build.

For development, from the `desktop` folder:

```sh
npm ci
npm start
```

The installed Electron version is pinned to **45.3.2**. Node >=22.12 is needed for its npm dependency. Electron supplies the actual app runtime.

Click for a reaction; drag to move. Right-click the pet or use **◉** in the Mac menu bar for **Chat**, **Connection…**, **Nap / Wake**, **Eye tracking**, **Bring back**, and **Quit**. A manual nap lasts until explicitly woken; spontaneous naps end when energy recovers. Clicking a sleeping pet wakes it briefly without refilling its energy. Holding the pet pauses its life and animation. Position/energy reset on app restart.

## Quiet conversation beside the pet

Hover over the visible character and a single-line **What’s on my mind…** invitation appears beside her. It never takes focus. Clicking it opens a compact single-line text bar. Long single-line text scrolls horizontally rather than increasing its height. Only explicit line breaks (Shift + Enter or pasted newlines) add rows, up to five visible rows. Enter sends and IME composition does not send accidentally. Connection/error notices are separate pills outside the input border. On success the unchanged sent draft clears and the input hides; a new draft typed during the request stays open. Failure keeps the draft with a short nontechnical notice. When the pointer is outside and there has been no keyboard activity for 5s, the composer fades over 260ms and hides without clearing its draft. Pointer return, typing, IME composition and an in-flight request prevent/cancel this idle fade. A rotating ring indicates waiting, with accessible status text and a static reduced-motion version. Stale status snapshots cannot overwrite newer pushed state or a newer send.

The pet's visual language has no labels or energy bar:

- Fictional thoughts use a scalloped cloud with two detached thought dots.
- Addressed speech uses a rounded balloon with a pointed tail.
- Current activity uses a small unobtrusive ticket/pill.

Thoughts and activity descriptions are scripted. Short speech uses a fitted bubble. Long replies advance through short, single-line phrases with breaks at sentence endings, clauses, or words. The speech strip sizes to each phrase and has an inline dismiss button. It pauses during dragging. Thought and action bubbles keep their own shapes and fade after a few seconds. New replies replace older ones. Empty areas and bubble text pass clicks through to the desktop.

**Connection…** opens the separate setup panel. The normal composer contains no provider, quota, model, transcript, or status dashboard. Paste a Gemini key in the password field and choose **Save key**; a connected user can **Replace** it or **Remove saved key**. The field clears immediately and is never prefilled from storage. Saving does not validate provider access or make a model request; a successful reply verifies access. Keys are encrypted with Electron's asynchronous `safeStorage` API (macOS Keychain-backed encryption) before writing `credentials/gemini.enc` under the app's `userData` directory. The directory is 0700 and the encrypted file 0600; replacement uses a synced temporary file and atomic rename. Startup restores after `app.ready`. No plaintext fallback, key logging, or key getter exists. Failed save/remove leaves the previous connection intact; unreadable saved data is retained for explicit replacement/removal and an error appears in Connection. Both editable windows retain standard macOS Edit shortcuts and native Cut/Copy/Paste menus.

`GEMINI_API_KEY` remains an optional developer launch override: it takes precedence over a saved key and is session-only unless explicitly saved through settings. Disconnecting cannot edit the parent process environment, so an environment-supplied key returns on the next launch until that launch setting is removed. A packaged app will need a consistent signing identity for stable Keychain recognition across updates.

The persona instructs English-only replies even to non-English input, normally one short sentence and at most two (about 35 words); line breaks are collapsed into a single conversational turn. This is model guidance, not a language-classifier guarantee. Sending shares the typed message, bounded recent session dialogue, saved memories, and sanitized pet activity/energy with Gemini. The adapter uses `gemini-3.1-flash-lite`, one shared 25-second deadline, a 512 output-token limit, and at most 30 outbound requests per app session. It sends the last three conversation turns and all saved memory excerpts. A quick network failure or HTTP 503 can retry once within the same deadline and request limit. A timeout leaves the draft and a retry button. HTTP 429 waits for a new manual send. No fake pet response is produced on error. Small notices distinguish network failure, 25s timeout, provider unavailability, unreadable/empty response, provider quota/rate limit, and the separate local 30-request limit. Connection shows only a sanitized latest error code description and optional HTTP status; it never displays/logs raw provider bodies, request text or credentials. The earlier generic screenshot alone cannot identify its historical cause. The service's session history is internal context, not a transcript screen. **Forget this conversation** inside Connection clears it and cancels an active reply; generation guards prevent old replies reappearing. This does not reset the request allowance. App restart retains the encrypted saved key and saved memories. Draft and recent dialogue expire when the app quits.

## Memories

A normal chat turn can save an explicit, everyday detail such as “I usually drink jasmine tea when I read.” Gemini proposes up to two memory changes alongside the short reply in the same request. The app accepts only bounded excerpts from the latest user message. It stores up to 16 in a separate encrypted file, `companion-memory/memories.enc`, for both appearances. Gemini receives the current excerpts during later chats and can use a relevant one when it fits. Memory quality depends on the model recognizing the preference and recalling it in context.

Correct a detail in conversation or ask the pet to forget it. In **Connection… → Memories**, inspect saved excerpts, forget one, or use **Forget all memories**. Successful removal also drops recent dialogue so the removed details don't stay in the next request as conversation history. **Forget this conversation** only clears recent dialogue. Memory storage errors appear under **Memories**. If the memory file cannot be read, chat can still reply and the file is preserved until explicitly cleared.

## Lobby

**Visit Lobby** opens a small room window. One Mac chooses **Host Room** and shares the invite shown in the room. A second Mac on the same network pastes it and joins. A room supports two companions and plays a shared scripted greeting for each meeting. Close the window or choose **Go Home** to return to the original desktop pet. A lost host also returns the guest home.

The host listens when it creates a room, and closes the server when it leaves. Invites are intended for people sharing the local network. Room traffic carries a random pet ID, appearance, presence, and greeting state. Chat, Gemini credentials, and memory stay with the desktop companion.

## Three appearances, one companion

Use the flat pet-menu choices **Dafeiyu**, **Red panda**, and **Pixel panda** to change appearance. Red panda is the default for a fresh install. The choice is saved separately in `companion-settings/appearance.json`; it does not reset this session’s conversation, energy, manual nap or encrypted Gemini connection. All choices use the same app name and user-data directory. Missing or unreadable preferences use Red panda. A saved Dafeiyu selection persists.

Red panda rotates between reading, holding a cup of tea, sitting with her eyes closed, and curling up to sleep. When awake, a sustained nearby pointer switches her to a separate standing pose based on Andrew’s original wave art. Her eyes follow the pointer from that pose, and she returns to her activity when it moves away. The book, tea and wave poses come from Andrew’s unchanged PNG. Quiet sitting and curled sleep are AI-generated stills using that art as a reference. Poses share a ground anchor and switch directly. See [the asset notes](src/renderer/assets/red-panda/README.md) for provenance.

Pixel panda uses 82 transparent frames from the supplied Aseprite sources. The authored entrances, loops and exits preserve a common ground line for cube play, kitten play, laptop typing and naps. Nearby attention uses the source eye pixels over the current pose, so looking toward the cursor keeps the current action moving. Sleep ignores cursor attention and a held pet pauses. The Lobby shows the same skin and gives it a wave pose during the welcome.

Changing a skin disposes its old decoder handlers and frame callbacks so a late-loaded video cannot overwrite the new actor. The last valid visible picture remains during loading; failed decodes release the life guard. The chat model receives a description of the current appearance’s mapped activity.

## Motion, gaze and character packs

The pet now has one persistent visible canvas and two hidden video decode buffers. The next clip preloads and waits for the current clip to end; a new frame must be decoded and nonempty before replacing the visible canvas. Failed/slow replacements keep the last good picture. An attributed transparent idle poster covers initial loading. Stalled decoders release the life transition guard; renderer-process failures have bounded reload recovery without discarding main-process chat/key state.

Sleep routes through entrance → loop → exit. Life age/energy wait while the requested action is entering, so the pet cannot recover sleep energy before reaching its sleeping loop. Captions describe the displayed clip. Original source poses differ at some joins; these remain visible art limitations, not a seamless rig.

Normal self-action videos are now shown unmodified; the earlier forced eye warping during activities is retired at Evan's request. The ten self-action sets are sleep plus nine awake activities: cube, kitty, laptop, papers, noodles, cloth wiping, stretch, violin, and brushing teeth. A shuffled bag visits every awake action before repeating and avoids back-to-back repetitions across bag boundaries. The clips visibly contain their corresponding props; this build has no blanket-pulling or broom-sweeping animation.

While awake, a nearby cursor enters a separate attention pose and the eyes follow its position. Attention continues while the cursor stays nearby; leaving the range resumes the interrupted activity at its saved playback position. There is no special-action rotation or interaction cooldown. A short entry dwell and distance hysteresis prevent flicker at the range boundary. Sleep (including sleep transitions), dragging, reduced-motion mode, the Eye tracking toggle, and visible composer/settings suppress attention. Only the dedicated attention pose gently deforms its original eye regions; ordinary activity frames stay unmodified. The OS cursor is never moved or captured. Earlier jump/wave/tail assets remain installed but are not selected.

`character-pack.js` owns clip paths, activity mappings, descriptions, render dimensions, body/face anchors, poster and sleep routing. The same animation player is tested with a second synthetic pack. This proves the player/mapping contract, not a complete user-upload feature or a second visually validated character. Desktop window sizing/layout and character selection still need a broader import contract before arbitrary uploads. New packs need appropriate animation assets and their own attention calibration; personality/memory should remain independent of appearance.

All companion windows are children of one pet window. They no longer opt into all macOS Spaces/fullscreen; the intended behavior is one ordinary desktop/display, with no pet on another application's fullscreen Space. Bring back moves the group to the cursor's display. Display removal/metrics changes reflow the group; parent hide hides companions. Native Space/fullscreen behavior still needs user acceptance.

## Checks

```sh
npm run check
npm test
npm run smoke
```

Automated tests cover chat request limits/cancellation/errors, key handling, late-reply/draft and snapshot races, complete Unicode pagination, window placement, autonomous life, gaze thresholds and pixel-region preservation. The earlier actual-frame audit changed only eye pixels. `smoke` verifies installed Electron and asset readability in Node mode; none of these are GUI acceptance.


Optional normal-entry diagnostics:

```sh
PET_DEBUG=1 npm start
```

This prints activity transitions, renderer lifecycle, video readiness/errors, gaze readiness and attention transitions, and opaque/transparent sample counts. It does not print cursor coordinates. Diagnostics are off by default.

## Desktop acceptance

Appearance revision (2026-11-15): syntax, all **142 automated tests**, and Electron asset smoke pass. Coverage includes real preference-file restore beside Chromium's `Preferences` file on case-insensitive Macs, both renderer types, stale callbacks, hit masks, nap/energy preservation, and the existing chat/composer/bubble/key regressions. Separate native Electron processes passed synthetic dotted-key save/restore/replace/remove.

In the running app, Planner observed Red panda book/tea poses, switched both directions, dragged Dafeiyu, and preserved a manual nap across both appearances before waking. A real Gemini HTTP 503 kept the draft/send path available; manual retry succeeded. After switching from Red panda to Dafeiyu, a second real reply recalled the synthetic word “acorn” from the same session. This verifies session continuity, not durable memory. No user key was displayed or copied.

The native check exposed a macOS filename collision between an initially chosen `preferences/` directory and Chromium's existing `Preferences` file. The fixed path is `companion-settings/appearance.json`; a regression boots the real store twice. A final normal-entry restart restored the saved connection and rendered nonempty Red panda reading pixels from the persisted selection. The final GUI restart check was blocked by the Mac being locked; final gaze feel and the user's appearance acceptance remain pending. Existing fullscreen/Spaces behavior is covered by regressions and prior user acceptance, not a new multi-Space visual test.

Team test build: Evan confirmed that his saved Gemini key works after restart, the idle input fades and the waiting spinner appears. Automated tests also exercise repeated sends, stale chat-state updates, quota failures and timeouts. The [rehearsal checks](../README.md#test-the-latest-chat-update) are still to be run on Andrew's Mac.

Sustained attention revision: syntax checks, 85 automated tests and the Electron asset smoke check passed. It replaced brief special reactions with sustained awake-only attention, gave tap greetings a 2s lifetime, fit bubbles to text, and instructed short English-only model replies. Independent review passed 41 affected tests. Evan confirmed sustained left/right attention, resume on cursor exit, sleep suppression, the brief greeting and fitted bubble on his Mac. Earlier reports below apply only to their named prior revisions.

Latest regression revision: current-frame gaze now has an actual-size cube/cat pixel regression and a renderer test keeping gaze active while sleep is queued. Bubbles expire/fade/release life captions, including stale-event and no-resurrection tests. Composer tests cover explicit line count, late edited draft, Shift+Enter and IME; native Edit-menu assertions remain. Full 66 checks passed before the final additional regressions; final focused UI 25 and motion 28 tests passed. Normal startup logs showed a thought fade/hide followed by a visible play-cube activity. Latest visual acceptance is pending; earlier acceptance below does not override Evan's later gaze complaint.

Motion/Spaces revision: 52 automated tests, syntax checks and Electron asset smoke passed. Normal startup emitted a nonempty transparent idle frame and clip-visible diagnostics. CUA access to Electron was not approved this turn. Evan subsequently confirmed all three live checks: visible pet continues playing while watching the cursor, pet/bubbles stay out of fullscreen Spaces, and clicking after returning does not jump desktops. This is user-reported GUI acceptance, not an automated GUI observation. No screenshots or credentials were collected through another route.

Redesigned UI: Planner launched the normal app and visually checked the small rounded composer, activity ticket, thought cloud with both detached dots, and separate Connection panel. A clipped lower thought dot was corrected and rechecked. Automated/source review passed. Evan tested this redesigned UI and reported that a reply arrived and the direction feels right. Paging controls, hover/focus and drag edge cases still need separate acceptance. The earlier live API result below belongs to the previous UI.

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


### Credential persistence checks

`credential-store.test.cjs` uses synthetic encryption and temporary directories to test corruption, unavailable encryption, atomic failure, ordering, restore, replace and removal. `credential-native-smoke.cjs` can explicitly test native encryption with a synthetic credential only: create a dedicated temp directory whose name begins `pet-credential-smoke-`, then run Electron with that script in `save` and `restore-remove` modes against the same directory. Separate native Electron processes have passed encrypted save, cross-process restore, replacement and deletion on this Mac; this did not read the user's key or make a provider request.

References: [Electron safeStorage](https://www.electronjs.org/docs/latest/api/safe-storage), [Gemini troubleshooting](https://aistudio.google.com/docs/troubleshooting).

Latest follow-up verification:123 automated tests, syntax and asset smoke pass; independent review passed43 UI/service/window tests. Starting through the project launcher after quitting restored the user-saved connection (`credentialState=saved`, `ready=true`) without displaying the key. Evan subsequently confirmed that chatting works after restart without re-entering the key, and that the idle fade and waiting spinner work. This does not establish the historical intermittent error cause or guarantee provider availability.
