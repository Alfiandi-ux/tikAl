#!/usr/bin/env python3
"""Membuat ikon PNG untuk PWA dari desain gradien + panah unduh."""

from pathlib import Path

from PIL import Image, ImageDraw

OUT = Path(__file__).resolve().parent.parent / "static"
S = 1024
SS = 2
W = S * SS

CYAN = (37, 244, 238)
VIOLET = (111, 123, 255)
PINK = (254, 44, 85)


def lerp(a, b, t):
    return tuple(round(x + (y - x) * t) for x, y in zip(a, b))


def gradient(size):
    image = Image.new("RGB", (size, size))
    draw = ImageDraw.Draw(image)
    for i in range(size * 2):
        t = i / (size * 2 - 1)
        color = lerp(CYAN, VIOLET, t / 0.5) if t <= 0.5 else lerp(VIOLET, PINK, (t - 0.5) / 0.5)
        draw.line([(i, 0), (0, i)], fill=color, width=1)
    return image


def draw_glyph(image, scale=1.0):
    draw = ImageDraw.Draw(image)
    cx = W / 2
    unit = W * scale
    top = (W - unit) / 2

    width = max(2, round(unit * 0.085))
    stem_top = top + unit * 0.22
    stem_bottom = top + unit * 0.56

    tray_y = top + unit * 0.71

    # glyph putih
    draw.line([(cx, stem_top), (cx, stem_bottom)], fill="white", width=width)
    draw.line(
        [(cx - unit * 0.17, top + unit * 0.43), (cx, stem_bottom), (cx + unit * 0.17, top + unit * 0.43)],
        fill="white", width=width, joint="curve",
    )
    draw.line(
        [(cx - unit * 0.21, tray_y - unit * 0.07), (cx - unit * 0.21, tray_y),
         (cx + unit * 0.21, tray_y), (cx + unit * 0.21, tray_y - unit * 0.07)],
        fill="white", width=width, joint="curve",
    )


def rounded_icon(mask_radius_ratio=0.225, glyph_scale=1.0):
    image = gradient(W).convert("RGBA")
    draw_glyph(image, glyph_scale)

    mask = Image.new("L", (W, W), 0)
    ImageDraw.Draw(mask).rounded_rectangle(
        (0, 0, W - 1, W - 1), radius=round(W * mask_radius_ratio), fill=255
    )
    image.putalpha(mask)
    return image


def square_icon(glyph_scale=0.68):
    image = gradient(W).convert("RGBA")
    draw_glyph(image, glyph_scale)
    return image


def save(image, name, size):
    image.resize((size, size), Image.LANCZOS).save(OUT / name, "PNG", optimize=True)


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    base = rounded_icon()
    save(base, "icon-512.png", 512)
    save(base, "icon-192.png", 192)
    save(square_icon(), "icon-maskable-512.png", 512)
    save(square_icon(0.8), "icon-180.png", 180)
    print("Ikon dibuat di", OUT)


if __name__ == "__main__":
    main()
