"use client";

import { useEffect, useRef } from "react";
import { playSound } from "@/lib/sound";

const SIZE = 32; // px, matches text-3xl
const GRAVITY = 900; // px/s²
const BOUNCE = 0.75; // speed kept after hitting a wall or the floor
const FLOOR_GAP = 24; // the bug stands 24px above the bottom (bottom-6)

// A ball thrown from the bug that bounces around the room, then rolls to a stop.
// Moves by writing the transform each frame, so it doesn't re-render React.
export default function BouncyBall() {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = ref.current;
    const room = el?.parentElement;
    if (!el || !room) return;
    const w = room.clientWidth;
    const floor = room.clientHeight - FLOOR_GAP - SIZE;
    // Start at the bug (middle of the room) and fly up and to a random side.
    let x = w / 2 - SIZE / 2;
    let y = floor - 60;
    let vx = (Math.random() < 0.5 ? -1 : 1) * (220 + Math.random() * 180);
    let vy = -(450 + Math.random() * 200);
    let spin = 0;
    const born = performance.now();
    let last = born;
    let frame = 0;

    const step = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      vy += GRAVITY * dt;
      x += vx * dt;
      y += vy * dt;
      if (x < 0 || x > w - SIZE) {
        x = Math.max(0, Math.min(w - SIZE, x));
        vx = -vx * BOUNCE;
      }
      if (y < 0) {
        y = 0;
        vy = -vy * BOUNCE;
      }
      if (y > floor) {
        y = floor;
        if (vy > 120) playSound("click", { volume: Math.min(0.4, vy / 1500) });
        vy = -vy * BOUNCE;
        vx *= 0.92; // floor friction
      }
      spin += vx * dt * 3;
      el.style.transform = `translate(${x}px, ${y}px) rotate(${spin}deg)`;
      // Fade out over the last half second before House removes it (at 5s).
      el.style.opacity = String(Math.max(0, Math.min(1, (5000 - (now - born)) / 500)));
      frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <span ref={ref} className="pointer-events-none absolute left-0 top-0 z-10 text-3xl leading-none">
      ⚽
    </span>
  );
}
