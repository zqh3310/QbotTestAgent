#!/usr/bin/env python3
"""Generate deterministic, meaningful PNG fixtures for QBot visual cases."""

from pathlib import Path
import sys

from PIL import Image, ImageDraw, ImageFont


def font(size: int):
    candidates = (
        "/System/Library/Fonts/Supplemental/Arial.ttf",
        "/System/Library/Fonts/Helvetica.ttc",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    )
    for candidate in candidates:
        try:
            return ImageFont.truetype(candidate, size=size)
        except OSError:
            pass
    return ImageFont.load_default()


def dashboard(output: Path):
    image = Image.new("RGB", (1200, 720), "#f8fafc")
    draw = ImageDraw.Draw(image)
    draw.text((55, 35), "QBot Campaign Dashboard", fill="#0f172a", font=font(40))
    metrics = [("REGISTRATIONS", "100", "#2563eb"), ("ARRIVALS", "70", "#16a34a"), ("ORDERS", "12", "#f97316")]
    for index, (label, value, color) in enumerate(metrics):
        x = 55 + index * 370
        draw.rounded_rectangle((x, 115, x + 320, 280), radius=22, fill="white", outline=color, width=5)
        draw.text((x + 28, 145), label, fill="#475569", font=font(23))
        draw.text((x + 28, 190), value, fill=color, font=font(56))
    draw.text((55, 335), "FUNNEL", fill="#334155", font=font(27))
    bars = [("Registration", 100, "#2563eb"), ("Arrival", 70, "#16a34a"), ("Order", 12, "#f97316")]
    for index, (label, value, color) in enumerate(bars):
        y = 390 + index * 85
        draw.text((55, y + 8), label, fill="#334155", font=font(24))
        draw.rounded_rectangle((235, y, 235 + value * 8, y + 48), radius=12, fill=color)
        draw.text((250 + value * 8, y + 8), str(value), fill="#0f172a", font=font(24))
    draw.text((55, 665), "Expected insight: arrival rate 70%, order/arrival rate 17.1%", fill="#475569", font=font(22))
    image.save(output, format="PNG", optimize=True)


def flow(output: Path):
    image = Image.new("RGB", (1200, 720), "#fffdf7")
    draw = ImageDraw.Draw(image)
    draw.text((55, 35), "QBot Release Flow", fill="#111827", font=font(40))
    nodes = [("INPUT", "PRD + data", "#dbeafe"), ("ANALYZE", "risks + cases", "#dcfce7"), ("DELIVER", "report + evidence", "#ffedd5")]
    for index, (title, body, color) in enumerate(nodes):
        x = 55 + index * 385
        draw.rounded_rectangle((x, 230, x + 300, 430), radius=28, fill=color, outline="#334155", width=4)
        draw.text((x + 30, 275), title, fill="#0f172a", font=font(32))
        draw.text((x + 30, 340), body, fill="#475569", font=font(22))
        if index < 2:
            draw.line((x + 310, 330, x + 365, 330), fill="#7c3aed", width=10)
            draw.polygon([(x + 365, 310), (x + 395, 330), (x + 365, 350)], fill="#7c3aed")
    draw.text((55, 575), "Gate: evidence must be reviewable before release", fill="#b91c1c", font=font(29))
    image.save(output, format="PNG", optimize=True)


def risk_matrix(output: Path):
    image = Image.new("RGB", (1200, 720), "#f8fafc")
    draw = ImageDraw.Draw(image)
    draw.text((55, 35), "Release Risk Matrix", fill="#0f172a", font=font(40))
    left, top, cell = 220, 145, 150
    colors = [["#dcfce7", "#fef9c3", "#fed7aa"], ["#fef9c3", "#fed7aa", "#fecaca"], ["#fed7aa", "#fecaca", "#ef4444"]]
    for row in range(3):
        for col in range(3):
            draw.rectangle((left + col * cell, top + row * cell, left + (col + 1) * cell, top + (row + 1) * cell), fill=colors[row][col], outline="#64748b", width=3)
    draw.text((65, 325), "IMPACT", fill="#334155", font=font(27))
    draw.text((390, 620), "PROBABILITY", fill="#334155", font=font(27))
    points = [("P0 data loss", 2, 2, "#7f1d1d"), ("P1 timeout", 1, 2, "#9a3412"), ("P2 copy", 0, 0, "#166534")]
    for label, col, row, color in points:
        x = left + col * cell + 18
        y = top + row * cell + 35
        draw.ellipse((x, y, x + 28, y + 28), fill=color)
        draw.text((x + 38, y - 2), label, fill="#111827", font=font(18))
    image.save(output, format="PNG", optimize=True)


def main():
    if len(sys.argv) != 2:
        raise SystemExit("usage: generate-qa-image-fixtures.py OUTPUT_DIR")
    output_dir = Path(sys.argv[1]).expanduser().resolve()
    output_dir.mkdir(parents=True, exist_ok=True)
    dashboard(output_dir / "qbot-image-test.png")
    flow(output_dir / "qbot-image-flow.png")
    risk_matrix(output_dir / "qbot-image-risk.png")
    for name in ("qbot-image-test.png", "qbot-image-flow.png", "qbot-image-risk.png"):
        path = output_dir / name
        print(f"{name}\t{path.stat().st_size}")


if __name__ == "__main__":
    main()
