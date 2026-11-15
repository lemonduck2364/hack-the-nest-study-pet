# Third-party character assets — local test

## Team-provided red panda artwork

`src/renderer/assets/red-panda/andrew-original.png` is an unchanged copy of
`sprite pet_2.png`, supplied by Evan as Andrew/team artwork. Its provenance,
SHA-256 digest, dimensions and runtime crop metadata are retained in that
directory. It contains three static poses: wave, book and tea. No explicit
license document accompanied it, so no open-source license or public
redistribution grant is asserted. The CC BY-NC-SA terms below describe the
separate upstream 大肥魚 assets, not this team-provided image.

## Upstream 大肥魚 assets

The unmodified transparent WebM clips in `src/renderer/assets/dafeiyu/`
come from [PC2005-cloud/dsh-pet](https://github.com/PC2005-cloud/dsh-pet),
pinned to commit `572cf0ff68e7ffbe76afe4ba5fd8ae99ec7e0733`.
Original paths, source URLs, sizes and SHA-256 digests are recorded in that
directory's `manifest.json`. Only filenames were changed; no upstream code
or executable is included.

Character: community-created DeepSeek 「大肥鱼」／whale-tail maid; unofficial,
not an official DeepSeek character. The original 「溟月」 character is credited
by upstream to [上善无形](https://space.bilibili.com/4456176); the DeepSeek maid
variant is credited to [ZipZipPipe](https://space.bilibili.com/4168597).
Animation assets and generation workflow are supplied by PC2005-cloud/dsh-pet.

The current upstream README distinguishes its MIT **code** license from the
character assets and points to **CC BY-NC-SA 4.0** for the character:
[license](https://creativecommons.org/licenses/by-nc-sa/4.0/),
[upstream character declaration](https://www.bilibili.com/opus/1247156596114456581).
The exact upstream README license section is retained alongside the clips as
`UPSTREAM_ASSET_LICENSE.md`. These assets are not relabeled as MIT.

These files are temporary assets for Evan's expressly requested closed,
noncommercial local test. No public release or commercial permission is
asserted. Any later distributed character adaptations must retain the
applicable attribution, noncommercial and share-alike terms. Andrew's original
art can replace this entire asset set independently of the pet life runtime.

The clips contain pre-rendered faces, not a Live2D rig or separate pupil layers.
Moving the video is not independent eye tracking.

For the local cursor-attention experiment, the renderer decodes the original
idle clip's first frame and deforms only two eye-interior regions at runtime.
This same-character attention pose is a project-authored presentation adaptation;
the original WebM files remain byte-for-byte unchanged. The source attribution
and CC BY-NC-SA terms above also accompany this experiment. It is not a supplied
upstream eye rig, and the other video frames do not gain independent eye layers.

The current motion renderer supersedes the static attention-pose experiment: it
warps calibrated eye interiors on the current activity frame while that clip
continues playing. `idle-poster.png` is a transparent decoded original idle
frame; `eye-tracks.js` is project-generated per-frame calibration with closed/
uncertain eyes gated off. These derived assets retain the source attribution
and CC BY-NC-SA terms above. This is not a supplied rig or a general-purpose
face tracker. Original WebM bytes remain unchanged.

The expanded local activity set uses additional original clips from the same
pinned commit and license: laptop typing, reading/sorting paper sheets,
juggling, eating noodles, cloth-wiping gestures, stretching, violin playing,
and tooth brushing, alongside the original cube and cat activities. The
manifest records their original paths, SHA-256 and upstream Git blob hashes,
observed visual content, duration, and full-frame transparency/crop audits.
Candidate clips for naps, leaves, flute, toy cars, and cursor reactions were
also inspected; downloading a candidate does not mean it is active. No claim
is made that these assets contain a blanket, book-reading, broom sweeping,
or a cursor pounce/fall animation. Wide candidate effects are flagged in the
manifest rather than silently assumed to fit the current desktop viewport.

The eye calibration and poster files above are retained from the earlier
experiment; their presence does not require eye deformation during normal
activities. All newly downloaded WebM bytes are unchanged upstream assets.
