"""Export the supplied RGBA Aseprite frames without their magenta preview layer."""
import json
from pathlib import Path
import struct
import zlib

ASSETS = Path(__file__).resolve().parents[1] / "src/renderer/assets/pixel-panda"
WIDTH, HEIGHT, COLS = 78, 82, 12
EYE_PATCH = (35, 31, 19, 6)


def unpack(fmt, data, offset):
    return struct.unpack_from("<" + fmt, data, offset)


def read_animation(path):
    data = path.read_bytes()
    _, magic, count, width, height, depth = unpack("IHHHHH", data, 0)
    if (magic, width, height, depth) != (0xa5e0, WIDTH, HEIGHT, 32):
        raise ValueError(f"Unexpected Aseprite canvas in {path.name}")

    layers = []
    previous_cels = []
    tags = {}
    frames = []
    durations = []
    offset = 128
    for frame_number in range(count):
        size, magic, chunks, duration, new_chunks = unpack("IHHH2xI", data, offset)
        if magic != 0xf1fa or duration <= 0:
            raise ValueError(f"Invalid frame {frame_number}")

        cels = {}
        cursor = offset + 16
        for _ in range(new_chunks or chunks):
            length, kind = unpack("IH", data, cursor)
            start = cursor + 6
            end = cursor + length
            if not (6 <= length and end <= offset + size):
                raise ValueError("Invalid chunk size")
            if kind == 0x2004:
                flags, layer_type, level, _, _, blend, opacity, name_len = unpack("HHHHHHB3xH", data, start)
                if layer_type != 0 or level or blend or opacity != 255:
                    raise ValueError("Expected normal, fully opaque image layers")
                name = data[start + 18:start + 18 + name_len].decode()
                layers.append(bool(flags & 1) and name != "Magenta key")
            elif kind == 0x2005:
                layer, x, y, opacity, cel_type, z_index = unpack("HhhBHh", data, start)
                if (x, y, opacity, z_index) != (0, 0, 255, 0):
                    raise ValueError("Expected full-resolution cels at the frame origin")
                if cel_type == 1:
                    linked = unpack("H", data, start + 16)[0]
                    cels[layer] = previous_cels[linked][layer]
                elif cel_type in (0, 2):
                    cel_size = unpack("HH", data, start + 16)
                    payload = data[start + 20:end]
                    pixels = zlib.decompress(payload) if cel_type == 2 else payload
                    if cel_size != (width, height) or len(pixels) != width * height * 4:
                        raise ValueError("Unexpected cel size")
                    cels[layer] = pixels
                else:
                    raise ValueError(f"Unsupported cel type {cel_type}")
            elif kind == 0x2018:
                tag_count = unpack("H", data, start)[0]
                tag_offset = start + 10
                for _ in range(tag_count):
                    first, last, direction, _, length = unpack("HHBH10xH", data, tag_offset)
                    tag_offset += 19
                    name = data[tag_offset:tag_offset + length].decode()
                    tag_offset += length
                    if direction or not 0 <= first <= last < count:
                        raise ValueError(f"Unsupported tag {name}")
                    tags[name] = (first, last)
            cursor = end
        previous_cels.append(cels)

        # These sources use pixel-art layers with binary transparency.
        frame = bytearray(width * height * 4)
        for layer, cel in sorted(cels.items()):
            if not layers[layer]:
                continue
            for pixel in range(0, len(cel), 4):
                alpha = cel[pixel + 3]
                if alpha == 255:
                    frame[pixel:pixel + 4] = cel[pixel:pixel + 4]
                elif alpha:
                    raise ValueError("Unexpected partial transparency")
        if not any(frame[3::4]):
            raise ValueError(f"Frame {frame_number} is blank")
        if any(frame[i:i + 4] == b"\xff\x00\xff\xff" for i in range(0, len(frame), 4)):
            raise ValueError(f"Preview key remains in frame {frame_number}")

        frames.append(frame)
        durations.append(duration)
        offset += size
    return frames, durations, tags


def png_chunk(kind, data):
    return (struct.pack(">I", len(data)) + kind + data + struct.pack(">I", zlib.crc32(kind + data)))


def write_atlas(frames):
    rows = (len(frames) + COLS - 1) // COLS
    blank = bytes(WIDTH * HEIGHT * 4)
    frames = frames + [blank] * (rows * COLS - len(frames))
    raw = bytearray()
    for row in range(rows):
        for y in range(HEIGHT):
            raw.append(0)
            for col in range(COLS):
                frame = frames[row * COLS + col]
                raw.extend(frame[y * WIDTH * 4:(y + 1) * WIDTH * 4])
    image = b"\x89PNG\r\n\x1a\n"
    image += png_chunk(b"IHDR", struct.pack(">IIBBBBB", COLS * WIDTH, rows * HEIGHT, 8, 6, 0, 0, 0))
    image += png_chunk(b"IDAT", zlib.compress(raw, 9))
    image += png_chunk(b"IEND", b"")
    (ASSETS / "atlas.png").write_bytes(image)


def eye_patch_at(frame, offset):
    x, y, width, height = EYE_PATCH
    return b"".join(
        frame[(row * WIDTH + x) * 4:(row * WIDTH + x + width) * 4]
        for row in range(y + offset, y + offset + height)
    )


def generate():
    frames = []
    tracks = {}
    for file, prefix in [("desktop-animations.aseprite", ""), ("laptop.aseprite", "laptop")]:
        poses, times, tags = read_animation(ASSETS / "source" / file)
        for name, (start, end) in tags.items():
            label = prefix + name
            tracks[label] = [[len(frames) + i, times[i]] for i in range(start, end + 1)]
        frames.extend(poses)
    # All authored stances, props, and curled poses already share the same ground.
    for i, frame in enumerate(frames):
        ground = max(pixel // WIDTH for pixel, alpha in enumerate(frame[3::4]) if alpha)
        if ground != 78:
            raise ValueError(f"Frame {i} moved from the shared ground line")
    neutral_eyes = eye_patch_at(frames[0], 0)
    offsets = [next((dy for dy in (0, 1, 3) if eye_patch_at(frame, dy) == neutral_eyes), None) for frame in frames]
    write_atlas(frames)

    track_rows = [f"    {name}: {json.dumps(keys)}" for name, keys in tracks.items()]
    details = ",\n".join(track_rows)
    module = f"""'use strict';
// Generated by desktop/scripts/build-pixel-panda.py from the supplied source animations.
(function (root) {{
  const tracks = {{
{details}
  }};
  const atlas = {{ source: 'assets/pixel-panda/atlas.png', width: {WIDTH}, height: {HEIGHT}, columns: {COLS}, count: {len(frames)}, tracks, eyePatch: {list(EYE_PATCH)}, eyeOffsets: {json.dumps(offsets)} }};
  if (typeof module !== 'undefined' && module.exports) module.exports = atlas;
  else root.PixelPandaAtlas = atlas;
}})(globalThis);
"""
    (ASSETS / "frames.js").write_text(module)
    print(f"Exported {len(frames)} transparent {WIDTH}×{HEIGHT} frames with authored timing.")


if __name__ == "__main__":
    generate()
