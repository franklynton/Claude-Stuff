"use client";

import { playSound } from "@/lib/sound";
import { useEffect, useRef, useState } from "react";
import type { PixelGrid } from "@/types/db";
import Win98Window from "./Win98Window";

const W = 320;
const H = 240;
const PET = 32; // pet size on screen (16x16 sprite at 2x)
const GAME_SECONDS = 20;

interface Drop {
  x: number;
  y: number;
  speed: number;
  bomb: boolean;
  label: string;
}

interface Props {
  pixels: PixelGrid;
  onFinish: (score: number) => void; // pays out coins and XP
  onClose: () => void;
}

// Minigame: move your bug with the mouse or arrow keys to catch falling bits (+1)
// and dodge Y2K bombs (-3). Score becomes coins.
export default function ByteCatcher({ pixels, onFinish, onClose }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [state, setState] = useState<"ready" | "playing" | "over">("ready");
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(GAME_SECONDS);

  useEffect(() => {
    if (state !== "playing") return;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;

    let petX = W / 2 - PET / 2;
    let drops: Drop[] = [];
    let points = 0;
    let last = performance.now();
    let spawnIn = 0;
    const end = last + GAME_SECONDS * 1000;
    const keys = new Set<string>();
    let frame = 0;

    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      e.preventDefault();
      if (e.type === "keydown") keys.add(e.key);
      else keys.delete(e.key);
    };
    const onMouse = (e: PointerEvent) => {
      const r = canvasRef.current!.getBoundingClientRect();
      petX = ((e.clientX - r.left) / r.width) * W - PET / 2;
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onKey);
    const canvas = canvasRef.current!;
    canvas.addEventListener("pointermove", onMouse);

    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (keys.has("ArrowLeft")) petX -= 220 * dt;
      if (keys.has("ArrowRight")) petX += 220 * dt;
      petX = Math.max(0, Math.min(W - PET, petX));

      spawnIn -= dt;
      if (spawnIn <= 0) {
        const bomb = Math.random() < 0.25;
        drops.push({
          x: 10 + Math.random() * (W - 20),
          y: -10,
          speed: 70 + Math.random() * 90,
          bomb,
          label: bomb ? "💣" : Math.random() < 0.5 ? "1" : "0",
        });
        spawnIn = 0.35 + Math.random() * 0.4;
      }

      const petTop = H - PET - 4;
      drops = drops.filter((d) => {
        d.y += d.speed * dt;
        const caught = d.y > petTop && d.y < petTop + PET && d.x > petX - 4 && d.x < petX + PET + 4;
        if (caught) {
          points = Math.max(0, points + (d.bomb ? -3 : 1));
          playSound(d.bomb ? "bomb" : "catch_bit", { volume: 0.6 });
        }
        return !caught && d.y < H + 10;
      });

      // draw: green-on-black terminal screen
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, W, H);
      ctx.font = "bold 16px monospace";
      ctx.textAlign = "center";
      for (const d of drops) {
        ctx.fillStyle = "#00ff40";
        ctx.fillText(d.label, d.x, d.y);
      }
      pixels.forEach((row, y) =>
        row.forEach((c, x) => {
          if (!c) return;
          ctx.fillStyle = c === "#000000" ? "#808080" : c; // grey outline so it shows on black
          ctx.fillRect(petX + x * 2, petTop + y * 2, 2, 2);
        }),
      );

      setScore(points);
      setTimeLeft(Math.max(0, Math.ceil((end - now) / 1000)));
      if (now >= end) {
        setState("over");
        playSound("minigame_end");
        onFinish(points);
        return;
      }
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onKey);
      canvas.removeEventListener("pointermove", onMouse);
    };
    // onFinish is called once at the end; re-running the loop for a new callback would restart the game.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, pixels]);

  return (
    <Win98Window title="ByteCatcher.exe" className="w-[344px]" onClose={onClose}>
      <div className="mb-1 flex justify-between">
        <span>Score: {score}</span>
        <span>Time: {timeLeft}s</span>
      </div>
      <div className="relative">
        <canvas ref={canvasRef} width={W} height={H} className="pixelated block w-full bg-black" />
        {state !== "playing" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/70 p-4 text-center text-[#00ff40]">
            {state === "over" ? (
              <p>
                GAME OVER! You caught {score} bits and earned 🪙 {score} coins.
              </p>
            ) : (
              <p>Catch the falling 1s and 0s. Dodge the 💣 Y2K bombs! Move with the mouse or arrow keys.</p>
            )}
            <button
              onClick={() => {
                setScore(0);
                setTimeLeft(GAME_SECONDS);
                setState("playing");
                playSound("minigame_start");
              }}
            >
              {state === "over" ? "Play again" : "Start"}
            </button>
          </div>
        )}
      </div>
    </Win98Window>
  );
}
