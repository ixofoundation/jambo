"""Build the PWA icons in public/icons/ from one square logo.

Usage (from the repo root):
    python -I scripts/make-pwa-icons.py [source.png]

The source defaults to public/images/yoma-dark-min-logo.png (250px). That is
small for a 512px icon; swap in a 1024px source when there is one and run this
again. Needs Pillow (pip install pillow).

- icon-*.png: the mark on the beige app background, filling most of the square.
  Used where the system shows the icon as is.
- maskable-*.png: the mark inside the middle 60%, so Android can crop the
  square to a circle, squircle or teardrop without cutting the logo
  (the safe zone is a centred circle of 80% of the width).
- apple-touch-icon.png: 180px, opaque, for iOS "Add to Home Screen".
"""

import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SOURCE = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "public/images/yoma-dark-min-logo.png"
OUT = ROOT / "public/icons"
BACKGROUND = (0xF7, 0xF5, 0xEB, 255)  # --bg-primary

# (file name, size in px, share of the square the mark fills)
ICONS = [
    ("icon-192.png", 192, 0.78),
    ("icon-512.png", 512, 0.78),
    ("maskable-192.png", 192, 0.60),
    ("maskable-512.png", 512, 0.60),
    ("apple-touch-icon.png", 180, 0.72),
]


def render(mark: Image.Image, size: int, share: float) -> Image.Image:
    canvas = Image.new("RGBA", (size, size), BACKGROUND)
    inner = round(size * share)
    scaled = mark.resize((inner, inner), Image.LANCZOS)
    offset = (size - inner) // 2
    canvas.alpha_composite(scaled, (offset, offset))
    return canvas.convert("RGB")


def main() -> None:
    mark = Image.open(SOURCE).convert("RGBA")
    if mark.width != mark.height:
        raise SystemExit(f"{SOURCE} is {mark.width}x{mark.height}; it must be square")
    OUT.mkdir(parents=True, exist_ok=True)
    for name, size, share in ICONS:
        render(mark, size, share).save(OUT / name, optimize=True)
        print(f"wrote public/icons/{name}")


if __name__ == "__main__":
    main()
