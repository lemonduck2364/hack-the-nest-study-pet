# Mac desktop pet — life, gaze and conversation

A standalone transparent Electron desktop companion. It now plays, tires, rests, sleeps, and recovers without user input. Life remains a local rule-based simulation. Session chat can connect to Gemini with a user-provided API key. Learned long-term memory, persistent identity/state, Lobby, screen capture and autostart are not implemented.

## Run

Follow the [Mac setup instructions on the repo homepage](../README.md#run-the-demo-on-your-mac). After the first setup, double-click `Open Desktop Pet.command` at the root of the downloaded project. It uses the same app name and saved-key location as `npm start`. If already running, the single-instance guard brings back that pet. Quit from the pet menu before a deliberate restart. The launcher Terminal remains attached to the running pet.

Alternatively, from the `desktop` folder:

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

These are scripted thoughts and activity descriptions, not private model reasoning. Replies appear in the pet's own separate, nonfocusable speech bubble. Long replies paginate to the measured text area; arrows reveal every part, preserving the displayed text and emoji. Pagination preserves the reply text and does not auto-advance. All output is temporary: action captions last about 4.5s, thoughts 5.5s; a tap greeting lasts about 2s; model speech receives a 3–12s text-length reading window and then fades over 260ms. Page navigation grants more reading time within a 30s maximum lifetime per reply. New replies supersede old ones; stale timers/page events cannot hide or prolong a newer reply. After speech fades, the latest life caption is shown once and then also expires. Repeated identical captions do not restart timers, and dragging/reopening cannot resurrect expired text. Text and empty areas remain mouse-pass-through; only page/dismiss controls intercept clicks. All bubbles fit their current text and sit centered above the head in a transparent 200px window (visible body at most 180px). Speech uses five short lines per page; centered tails/dots point down. Placement reserves headroom. Fade, finite reading time and paging remain active.

**Connection…** opens the separate setup panel. The normal composer contains no provider, quota, model, transcript, or status dashboard. Paste a Gemini key in the password field and choose **Save key**; a connected user can **Replace** it or **Remove saved key**. The field clears immediately and is never prefilled from storage. Saving does not validate provider access or make a model request; a successful reply verifies access. Keys are encrypted with Electron's asynchronous `safeStorage` API (macOS Keychain-backed encryption) before writing `credentials/gemini.enc` under the app's `userData` directory. The directory is 0700 and the encrypted file 0600; replacement uses a synced temporary file and atomic rename. Startup restores after `app.ready`. No plaintext fallback, key logging, or key getter exists. Failed save/remove leaves the previous connection intact; unreadable saved data is retained for explicit replacement/removal and an error appears in Connection. Both editable windows retain standard macOS Edit shortcuts and native Cut/Copy/Paste menus.

`GEMINI_API_KEY` remains an optional developer launch override: it takes precedence over a saved key and is session-only unless explicitly saved through settings. Disconnecting cannot edit the parent process environment, so an environment-supplied key returns on the next launch until that launch setting is removed. A packaged app will need a consistent signing identity for stable Keychain recognition across updates.

The persona instructs English-only replies even to non-English input, normally one short sentence and at most two (about 35 words); line breaks are collapsed into a single conversational turn. This is model guidance, not a language-classifier guarantee. Sending shares the typed message, bounded recent session dialogue, and sanitized pet activity/energy with Gemini. The adapter uses `gemini-3.1-flash-lite`, a 25-second timeout, 512 output-token limit, no automatic retries, and at most 30 outbound attempts per app session. No fake pet response is produced on error. Small notices distinguish network failure, 25s timeout, provider unavailability, unreadable/empty response, provider quota/rate limit, and the separate local 30-send test cap. Connection shows only a sanitized latest error code description and optional HTTP status; it never displays/logs raw provider bodies, request text or credentials. The earlier generic screenshot alone cannot identify its historical cause. The service's session history is internal context, not a transcript screen. **Forget this conversation** inside Connection clears it and cancels an active reply; generation guards prevent old replies reappearing. This does not reset the request allowance. App restart retains the encrypted saved key but loses draft and conversation; durable companion memory is still unimplemented.

## Two appearances, one companion

Use the flat pet-menu choices **Dafeiyu** and **Red panda** to change appearance. Dafeiyu remains the default. The choice is saved separately in `companion-settings/appearance.json`; it does not reset this session’s conversation, energy, manual nap or encrypted Gemini connection. Both choices use the same app name and user-data directory. Unknown/corrupt appearance preferences safely fall back to Dafeiyu.

Red panda uses Andrew’s original transparent 2172×724 PNG unchanged. Runtime crops align the authored book, tea and wave poses at one ground/head anchor without stretching them. Phase 1 displays quiet reading by default and tea for the eating activity. Cursor proximity gently redirects the book pose’s eyes; leaving returns them to reading. Sleeping remains undisturbed. Missing activity animations and sleep use the same-character book/rest pose. Wave is available in the pack but is not selected automatically in this first quiet-reading pass. These are static poses with procedural eye easing, not authored frame animations, page turns or a full sleeping rig. The original Dafeiyu video animations remain available.

Changing a skin disposes its old decoder handlers and frame callbacks so a late-loaded video cannot overwrite the new actor. The last valid visible picture remains during loading; failed decodes release the life guard. Model context describes the current appearance’s supported moment (book or tea), so it does not claim a cube or noodles that the panda art does not show. Long-term conversation memory is intentionally outside this phase.

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
