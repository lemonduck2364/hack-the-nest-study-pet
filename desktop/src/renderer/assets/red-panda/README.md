# Andrew's red panda — original static poses

`andrew-original.png` is an exact byte copy of the team-provided
`sprite pet_2.png` supplied by Evan. The image is 2172 × 724 RGBA pixels,
with three 724-pixel cells: waving, holding a book, and offering tea.
`manifest.json` records the original filename, file size and SHA-256 digest.

There are **three still poses**, not three animation sequences. The supplied
image has no authored page turn, look-up sequence, blink sequence, or sleeping
pose. Runtime breathing, gaze deformation or pose transitions must be described
as procedural presentation, not as animations supplied by Andrew.

`geometry.json` describes runtime source rectangles and aspect-preserving
placement on the existing 640 × 360 presentation canvas. All three visible
poses fit between y=63 and y=330. Their bounds are horizontally centered at
x=320; natural joint positions differ between the sitting and standing poses.

Source rectangles use alpha >16 to exclude faint almost-transparent pixels in
the margins. No pixels in the original file were edited, erased or recolored;
cropping and scaling happen only when drawing to Canvas. At the normal
330 × 185.625 display size, the meaningful character height is about 138 DIP.

The book pose's two eye-interior regions were inspected against the original
image. Their declared displacement limits are measured in the 640 × 360 frame,
not display pixels. Tea has closed eyes, so that pose must not be treated as
having open pupils. The eye metadata is a local calibration, not a general rig.

No explicit license document accompanied the image. It is attributed here as
Andrew/team-provided artwork according to Evan's description; no open-source
license or public redistribution permission is invented. The integration is
for the requested local project work.
