"use client";

import { useEffect, useRef, useState } from "react";
import { playSound } from "@/lib/sound";
import Win98Window from "./Win98Window";

const COLS = 15;
const ROWS = 13;
const CELL = 22; // px per square
const W = COLS * CELL;
const H = ROWS * CELL;
const TICK_MS = 130; // one step of the snake

type Point = { x: number; y: number };
const DIRS: Record<string, Point> = {
  ArrowUp: { x: 0, y: -1 },
  ArrowDown: { x: 0, y: 1 },
  ArrowLeft: { x: -1, y: 0 },
  ArrowRight: { x: 1, y: 0 },
  w: { x: 0, y: -1 },
  s: { x: 0, y: 1 },
  a: { x: -1, y: 0 },
  d: { x: 1, y: 0 },
};

interface Props {
  onFinish: (score: number) => void; // pays out coins and XP
  onClose: () => void;
}

const centre = (p: Point) => ({ x: p.x * CELL + CELL / 2, y: p.y * CELL + CELL / 2 });

// A free square for the next apple (not under the snake).
function placeApple(snake: Point[]): Point {
  for (;;) {
    const p = { x: Math.floor(Math.random() * COLS), y: Math.floor(Math.random() * ROWS) };
    if (!snake.some((s) => s.x === p.x && s.y === p.y)) return p;
  }
}

function draw(ctx: CanvasRenderingContext2D, snake: Point[], apple: Point, dir: Point) {
  // Checkerboard grass
  for (let y = 0; y < ROWS; y++)
    for (let x = 0; x < COLS; x++) {
      ctx.fillStyle = (x + y) % 2 ? "#a2d149" : "#aad751";
      ctx.fillRect(x * CELL, y * CELL, CELL, CELL);
    }

  // Apple: red ball, stem and leaf
  const a = centre(apple);
  ctx.fillStyle = "#e7471d";
  ctx.beginPath();
  ctx.arc(a.x, a.y + 1, CELL * 0.38, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#ffffff55";
  ctx.beginPath();
  ctx.arc(a.x - 3, a.y - 2, 2.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#6b4226";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(a.x, a.y - 6);
  ctx.lineTo(a.x + 1, a.y - 10);
  ctx.stroke();
  ctx.fillStyle = "#4caf50";
  ctx.beginPath();
  ctx.ellipse(a.x + 5, a.y - 9, 4, 2, -0.4, 0, Math.PI * 2);
  ctx.fill();

  // Body: one thick rounded line through every segment's centre, tail to head
  ctx.strokeStyle = "#4e7cf6";
  ctx.lineWidth = CELL * 0.72;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  snake.forEach((s, i) => {
    const c = centre(s);
    if (i === 0) ctx.moveTo(c.x, c.y);
    else ctx.lineTo(c.x, c.y);
  });
  if (snake.length === 1) ctx.lineTo(centre(snake[0]).x + 0.1, centre(snake[0]).y);
  ctx.stroke();

  // Eyes on the head, looking where it's going
  const h = centre(snake[snake.length - 1]);
  const side = { x: -dir.y, y: dir.x };
  for (const s of [-1, 1]) {
    const ex = h.x + dir.x * 3 + side.x * s * 5;
    const ey = h.y + dir.y * 3 + side.y * s * 5;
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(ex, ey, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#1a2a6c";
    ctx.beginPath();
    ctx.arc(ex + dir.x * 1.5, ey + dir.y * 1.5, 2, 0, Math.PI * 2);
    ctx.fill();
  }
}

// Classic Snake: steer with the arrow keys (or WASD), eat apples to grow, don't hit
// the walls or yourself. Each apple is worth a coin.
export default function Snake({ onFinish, onClose }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [state, setState] = useState<"ready" | "playing" | "over">("ready");
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(0);

  // Draw the starting board behind the "ready" screen.
  useEffect(() => {
    const ctx = canvasRef.current?.getContext("2d");
    if (ctx && state === "ready") draw(ctx, [{ x: 2, y: 6 }, { x: 3, y: 6 }, { x: 4, y: 6 }], { x: 10, y: 6 }, { x: 1, y: 0 });
  }, [state]);

  useEffect(() => {
    if (state !== "playing") return;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;

    // The snake is stored tail first, head last.
    let snake: Point[] = [{ x: 2, y: 6 }, { x: 3, y: 6 }, { x: 4, y: 6 }];
    let dir = { x: 1, y: 0 };
    const turns: Point[] = []; // queued key presses, so quick double turns aren't lost
    let apple = { x: 10, y: 6 };
    let eaten = 0;
    draw(ctx, snake, apple, dir);

    const onKey = (e: KeyboardEvent) => {
      const next = DIRS[e.key];
      if (!next) return;
      e.preventDefault(); // don't scroll the page
      const prev = turns[turns.length - 1] ?? dir;
      // Ignore turning straight back into yourself, and repeats.
      if (next.x === -prev.x && next.y === -prev.y) return;
      if (next.x === prev.x && next.y === prev.y) return;
      if (turns.length < 3) turns.push(next);
    };
    window.addEventListener("keydown", onKey);

    const id = setInterval(() => {
      dir = turns.shift() ?? dir;
      const head = snake[snake.length - 1];
      const next = { x: head.x + dir.x, y: head.y + dir.y };
      const ate = next.x === apple.x && next.y === apple.y;
      // The tail moves out of the way this step unless the snake is growing.
      const body = ate ? snake : snake.slice(1);
      const crashed =
        next.x < 0 || next.y < 0 || next.x >= COLS || next.y >= ROWS || body.some((s) => s.x === next.x && s.y === next.y);
      if (crashed) {
        clearInterval(id);
        setState("over");
        setBest((b) => Math.max(b, eaten));
        playSound("minigame_end");
        onFinish(eaten);
        return;
      }
      snake = [...body, next];
      if (ate) {
        eaten++;
        setScore(eaten);
        playSound("munch", { volume: 0.6 });
        if (snake.length === COLS * ROWS) return clearInterval(id); // board full: you win
        apple = placeApple(snake);
      }
      draw(ctx, snake, apple, dir);
    }, TICK_MS);

    return () => {
      clearInterval(id);
      window.removeEventListener("keydown", onKey);
    };
    // onFinish is called once at the end; re-running for a new callback would restart the game.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <Win98Window title="Snake.exe" className="w-[354px]" onClose={onClose}>
      <div className="snake-frame">
        <div className="mb-1 flex items-center justify-between px-1 text-white">
          <span className="text-base">🍎 {score}</span>
          <span>🏆 {best}</span>
        </div>
        <div className="relative">
          <canvas ref={canvasRef} width={W} height={H} className="block w-full" />
          {state !== "playing" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/40 p-4 text-center text-white">
              {state === "over" ? (
                <p className="font-bold">
                  Game over! You ate {score} 🍎 and earned 🪙 {score} coins.
                </p>
              ) : (
                <>
                  <div className="snake-keys">
                    <span className="col-start-2">▲</span>
                    <span className="col-start-1">◀</span>
                    <span>▼</span>
                    <span>▶</span>
                  </div>
                  <p className="font-bold">Use the arrow keys (or WASD). Eat apples, don&rsquo;t hit the walls or your tail!</p>
                </>
              )}
              <button
                onClick={() => {
                  setScore(0);
                  setState("playing");
                  playSound("minigame_start");
                }}
              >
                {state === "over" ? "Play again" : "Start"}
              </button>
            </div>
          )}
        </div>
      </div>
    </Win98Window>
  );
}
