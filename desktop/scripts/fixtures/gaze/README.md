# Gaze regression fixtures

Derived from PC2005-cloud/dsh-pet visual assets, pinned upstream commit `572cf0ff68e7ffbe76afe4ba5fd8ae99ec7e0733`: https://github.com/PC2005-cloud/dsh-pet/tree/572cf0ff68e7ffbe76afe4ba5fd8ae99ec7e0733

- `play-cube.rgba.deflate`: source `dsh-pet/assets/webm/原地专心玩魔方.webm`, frame 48, time 2s at 24fps. Original WebM SHA-256: `ad54da175ba86b19a84b73b3169fb418b2df016560bb274283f200aca351e712`.
- `play-cat.rgba.deflate`: source `dsh-pet/assets/webm/撸猫.webm`, frame 96, time 4s at 24fps. Original WebM SHA-256: `068d84e944dfce17de1c5a2ee2a4bc391e2848dad88a7df4877ebf23cf38bcec`.

Each fixture is zlib-compressed 640×360 RGBA, decoded using libvpx-vp9 without visual modification. The original character attribution and **CC BY-NC-SA 4.0** visual-asset license remain applicable, including noncommercial use and ShareAlike obligations. See `src/renderer/assets/dafeiyu/UPSTREAM_ASSET_LICENSE.md` and `manifest.json` for the upstream notice and full asset provenance. These are derived test images, not independently licensed code.

Used to verify that ordinary action frames remain pixel-identical near the cursor, and that only the separate attention pose can deform its original eye regions.

`idle-0.rgba.deflate` is the same pinned idle.webm frame0 (0s), SHA-256 `deb965d05a85dacf5ff4a20faa757846f0d11679598c3ec578a5571487660395`, under the same attribution/license. The latest tests require normal action frames to remain unmodified and allow eye deformation only on this dedicated attention pose.
