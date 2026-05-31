#!/usr/bin/env python3
"""Generate Plate app icons from the logo mark (green ground, white open ring, coral dot)."""
import math
from PIL import Image, ImageDraw

GREEN = (43, 182, 115, 255)   # #2BB673
WHITE = (255, 255, 255, 255)
CORAL = (255, 107, 87, 255)    # #FF6B57

SS = 4  # supersample factor


def draw_mark(size, bg=True, ring_scale=1.0, radius_frac=0.34):
    """Render the Plate mark at `size` px. ring_scale<1 shrinks for maskable safe zone."""
    S = size * SS
    img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    if bg:
        # full-bleed green ground (square; launchers round it themselves)
        d.rectangle([0, 0, S, S], fill=GREEN)

    cx = cy = S / 2
    r = radius_frac * S * ring_scale          # ring centerline radius
    w = 0.115 * S * ring_scale                 # stroke width
    gap_half = 32                              # half of the top gap, degrees

    # visible arc: clockwise from just past the gap, all the way round
    start = 270 + gap_half
    end = 270 - gap_half + 360
    box = [cx - r, cy - r, cx + r, cy + r]
    d.arc(box, start=start, end=end, fill=WHITE, width=int(round(w)))

    # rounded caps at both ends of the arc
    for a in (start, end):
        ex = cx + r * math.cos(math.radians(a))
        ey = cy + r * math.sin(math.radians(a))
        d.ellipse([ex - w / 2, ey - w / 2, ex + w / 2, ey + w / 2], fill=WHITE)

    # coral dot sitting in the gap at the top
    dot_r = 0.082 * S * ring_scale
    dx, dy = cx, cy - r
    d.ellipse([dx - dot_r, dy - dot_r, dx + dot_r, dy + dot_r], fill=CORAL)

    return img.resize((size, size), Image.LANCZOS)


def save(img, path):
    img.save(path)
    print("wrote", path)


# app icons (full-bleed green)
save(draw_mark(192), "icon-192.png")
save(draw_mark(512), "icon-512.png")
# maskable: shrink mark to ~72% so it survives aggressive masking
save(draw_mark(512, ring_scale=0.72, radius_frac=0.34), "icon-512-maskable.png")
# apple touch icon (180 is the canonical size; green ground, no transparency)
save(draw_mark(180), "apple-touch-icon.png")
# favicon
save(draw_mark(64), "favicon.png")
