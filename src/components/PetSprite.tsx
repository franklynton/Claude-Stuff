"use client";

import { useEffect, useRef } from "react";
import type { PixelGrid } from "@/types/db";

interface Props {
  pixels: PixelGrid;
  glitch: number;
  scale?: number;
  idle?: boolean; // bounce animation
}

const GLITCH_COLOURS = ["#ff00ff", "#00ffff", "#ffff00", "#000000"];

// Draws the 16x16 pixel grid on a canvas. When glitch_level is high, it redraws
// every few hundred ms with shifted rows and wrong colours.
export default function PetSprite({ pixels, glitch, scale = 12, idle = true }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  const size = pixels.length;

  useEffect(() => {
    const ctx = ref.current?.getContext("2d");
    if (!ctx) return;

    const draw = () => {
      ctx.clearRect(0, 0, size * scale, size * scale);
      const corrupt = glitch / 400; // chance per row/pixel of a glitch
      pixels.forEach((row, y) => {
        const shift = Math.random() < corrupt ? Math.round((Math.random() - 0.5) * 4) : 0;
        row.forEach((colour, x) => {
          if (!colour) return;
          ctx.fillStyle =
            Math.random() < corrupt / 2
              ? GLITCH_COLOURS[Math.floor(Math.random() * GLITCH_COLOURS.length)]
              : colour;
          ctx.fillRect((x + shift) * scale, y * scale, scale, scale);
        });
      });
    };

    draw();
    if (glitch < 40) return;
    const id = setInterval(draw, 300);
    return () => clearInterval(id);
  }, [pixels, glitch, scale, size]);

  return (
    <canvas
      ref={ref}
      width={size * scale}
      height={size * scale}
      className={`pixelated ${idle ? "animate-idle" : ""}`}
      aria-label="Your pet"
    />
  );
}
