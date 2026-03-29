from __future__ import annotations

import os
import subprocess
import textwrap
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parent.parent
LAUNCHER = ROOT / "scripts" / "trasgo-launch.cjs"
OUTPUT = ROOT / "demos" / "trasgo-evolved-cli-demo.gif"
WIDTH = 1280
HEIGHT = 720
PADDING = 44
LINE_HEIGHT = 28


def load_font(size: int) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    candidates = [
        Path("C:/Windows/Fonts/consola.ttf"),
        Path("C:/Windows/Fonts/lucon.ttf"),
        Path("C:/Windows/Fonts/CascadiaMono.ttf"),
    ]
    for candidate in candidates:
        if candidate.exists():
            return ImageFont.truetype(str(candidate), size=size)
    return ImageFont.load_default()


FONT = load_font(22)
TITLE_FONT = load_font(36)


def run_cli(args: list[str]) -> str:
  env = os.environ.copy()
  env["TRASGO_LOGO"] = "none"
  command = ["node", str(LAUNCHER), *args]
  result = subprocess.run(
      command,
      cwd=ROOT,
      capture_output=True,
      text=True,
      encoding="utf-8",
      env=env,
      check=True,
  )
  return (result.stdout or "").strip()


def normalize_output(raw: str, max_lines: int = 14) -> list[str]:
    lines: list[str] = []
    for original in raw.splitlines():
        line = original.rstrip()
        if not line:
            lines.append("")
            continue
        wrapped = textwrap.wrap(line, width=80, break_long_words=False, break_on_hyphens=False)
        lines.extend(wrapped or [""])
    return lines[:max_lines]


def draw_grid(draw: ImageDraw.ImageDraw) -> None:
    for x in range(0, WIDTH, 48):
        draw.line((x, 0, x, HEIGHT), fill="#0f2134", width=1)
    for y in range(0, HEIGHT, 48):
        draw.line((0, y, WIDTH, y), fill="#0f2134", width=1)


def draw_pill(draw: ImageDraw.ImageDraw, x: int, y: int, label: str, fill: str) -> None:
    width = 18 + int(len(label) * 11.5)
    draw.rounded_rectangle((x, y, x + width, y + 32), radius=16, fill=fill)
    draw.text((x + 12, y + 7), label, font=FONT, fill="#061018")


def make_frame(title: str, command: str, output_lines: list[str], typed_chars: int, visible_lines: int) -> Image.Image:
    image = Image.new("RGB", (WIDTH, HEIGHT), "#081018")
    draw = ImageDraw.Draw(image)

    draw_grid(draw)
    draw.rounded_rectangle((20, 20, WIDTH - 20, HEIGHT - 20), radius=28, outline="#3b4f66", width=2, fill="#0c1724")
    draw.text((PADDING, PADDING), title, font=TITLE_FONT, fill="#f8c84d")
    draw.text((PADDING, PADDING + 56), "Trasgo observatory // ctx_context // compression // functional gain", font=FONT, fill="#85d7ff")
    draw_pill(draw, WIDTH - 410, PADDING + 8, "scientific demo", "#8af7b5")
    draw_pill(draw, WIDTH - 250, PADDING + 8, "post-GenZ", "#f8c84d")

    terminal_top = PADDING + 110
    draw.rounded_rectangle((PADDING, terminal_top, WIDTH - PADDING, HEIGHT - PADDING), radius=18, fill="#07111b", outline="#24364a", width=2)
    draw.text((PADDING + 20, terminal_top + 20), f"$ {command[:typed_chars]}", font=FONT, fill="#8af7b5")

    y = terminal_top + 64
    for line in output_lines[:visible_lines]:
        draw.text((PADDING + 20, y), line, font=FONT, fill="#dce7f3")
        y += LINE_HEIGHT

    footer = "demo asset generated from live CLI output"
    draw.text((PADDING + 20, HEIGHT - PADDING - 34), footer, font=FONT, fill="#7f93a6")
    return image


def build_frames() -> list[Image.Image]:
    scenes = [
        {
            "title": "Intent Layer",
            "command": "trasgo show me the runtimes",
            "args": ["show", "me", "the", "runtimes"],
        },
        {
            "title": "Demo Workflow 01",
            "command": "trasgo run the factory copilot demo",
            "args": ["run", "the", "factory", "copilot", "demo"],
        },
        {
            "title": "Demo Workflow 02",
            "command": "trasgo run the revenue guard demo",
            "args": ["run", "the", "revenue", "guard", "demo"],
        },
    ]

    frames: list[Image.Image] = []
    for scene in scenes:
        output = normalize_output(run_cli(scene["args"]))
        command = scene["command"]
        for typed_chars in range(1, len(command) + 1, 4):
            frames.append(make_frame(scene["title"], command, output, typed_chars, 0))
        frames.append(make_frame(scene["title"], command, output, len(command), 0))
        for visible_lines in range(1, len(output) + 1):
            frames.append(make_frame(scene["title"], command, output, len(command), visible_lines))
        for _ in range(8):
            frames.append(make_frame(scene["title"], command, output, len(command), len(output)))
    return frames


def main() -> None:
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    frames = build_frames()
    first, rest = frames[0], frames[1:]
    first.save(
        OUTPUT,
        save_all=True,
        append_images=rest,
        duration=110,
        loop=0,
        optimize=False,
    )
    print(OUTPUT)


if __name__ == "__main__":
    main()
