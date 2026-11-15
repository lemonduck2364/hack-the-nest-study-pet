# Third-party character assets — local test

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
