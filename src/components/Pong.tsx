"use client";

import { useEffect, useRef, useState } from "react";
import type { PixelGrid } from "@/types/db";
import type { LobbyPet, PongBody, PongMessage } from "@/types/lobby";
import { joinMatch } from "@/lib/realtime";
import { playSound } from "@/lib/sound";
import {
  type Ball,
  BALL,
  H,
  MARGIN,
  PET,
  SCALE,
  type Side,
  W,
  WIN_SCORE,
  arrival,
  ballAt,
  bounce,
  paddleFor,
  serve,
  touches,
} from "@/lib/pong";
import Win98Window from "./Win98Window";

interface Props {
  match: string; // names the game's own channel
  me: LobbyPet;
  them: LobbyPet;
  side: Side; // my end of the field: whoever challenged plays on the left
  themHere: boolean; // false once they've left the lobby
  onFinish: (mine: number, theirs: number) => void; // a game played to the end
  onClose: () => void;
}

type Phase = "joining" | "countdown" | "playing" | "over";

const HELLO_MS = 400; // said again until the other player answers
const JOIN_TIMEOUT_MS = 15000;
const COUNTDOWN_MS = 3000;
// At most this often, where my pet is while it moves. It's only for drawing it on
// the other screen (which glides it between updates), and the free Supabase plan
// allows 100 messages a second for the whole project, so a game keeps to ~20.
const PADDLE_MS = 100;
const NEXT_SERVE_MS = 1000;
const WAIT_TIMEOUT_MS = 5000; // no word for this long while it's their turn: they've gone
const KEY_SPEED = 420; // px per second with the arrow keys

const clampY = (y: number) => Math.max(PET / 2, Math.min(H - PET / 2, y));

// A pet's pixels drawn once at paddle size, black outlines in grey so they show on the black field.
function petImage(pixels: PixelGrid) {
  const c = document.createElement("canvas");
  c.width = c.height = PET;
  const g = c.getContext("2d")!;
  pixels.forEach((row, y) =>
    row.forEach((colour, x) => {
      if (!colour) return;
      g.fillStyle = colour === "#000000" ? "#808080" : colour;
      g.fillRect(x * SCALE, y * SCALE, SCALE, SCALE);
    }),
  );
  return c;
}

// Pong against another bug from the lobby, each player's pet as their paddle.
//
// Both screens move the ball with the same maths (lib/pong.ts), so it takes the same
// path on each. Each player judges their own end: when the ball reaches your pet,
// your screen decides hit or miss - with no lag, since it's your pet - and tells the
// other player, whose screen holds the ball at your pet until it hears.
export default function Pong({ match, me, them, side, themHere, onFinish, onClose }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [phase, setPhase] = useState<Phase>("joining");
  const [score, setScore] = useState<[number, number]>([0, 0]); // left, right
  const [count, setCount] = useState(3);
  const [result, setResult] = useState("");
  const finished = useRef(onFinish);
  finished.current = onFinish;
  const stop = useRef<(why: string) => void>(() => {}); // ends the game early (set below)

  useEffect(() => {
    if (!themHere) stop.current(`${them.name} left the lobby.`);
  }, [themHere, them.name]);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    const theirs: Side = side === "left" ? "right" : "left";
    const pixels = side === "left" ? { left: me.pixel_data, right: them.pixel_data } : { left: them.pixel_data, right: me.pixel_data };
    const paddles = { left: paddleFor("left", pixels.left), right: paddleFor("right", pixels.right) };
    const images = { left: petImage(pixels.left), right: petImage(pixels.right) };
    const mine = (p: [number, number]) => p[side === "left" ? 0 : 1];
    const other = (p: [number, number]) => p[side === "left" ? 1 : 0];

    let state: Phase = "joining";
    let points: [number, number] = [0, 0];
    let myY = H / 2;
    let theirY = H / 2;
    let theirTarget = H / 2;
    let ball: (Ball & { out?: boolean }) | null = null; // out: got past a pet, flying off the field
    let heard = false; // I've heard them
    let heardMe = false; // they've heard me
    let countdownEnds = 0;
    let serveAt = 0; // when I serve next (0: it's not my serve)
    let waitingSince = 0;
    let sentY = -1;
    let sentAt = 0;
    let helloAt = 0;
    const joinedAt = performance.now();
    let last = joinedAt;
    let frame = 0;
    const keys = new Set<"up" | "down">();

    const send = (body: PongBody) => room.send({ ...body, from: me.id });
    const go = (next: Phase) => {
      state = next;
      setPhase(next);
    };

    const finish = (text: string, played = false) => {
      if (state === "over") return;
      go("over");
      setResult(text);
      playSound("minigame_end");
      if (played) finished.current(mine(points), other(points));
    };
    stop.current = finish;

    const point = (to: Side, now: number) => {
      points = to === "left" ? [points[0] + 1, points[1]] : [points[0], points[1] + 1];
      setScore(points);
      playSound(to === side ? "coin" : "denied", { volume: 0.6 });
      if (mine(points) >= WIN_SCORE) finish(`🏆 You win ${mine(points)}-${other(points)}!`, true);
      else if (other(points) >= WIN_SCORE) finish(`${them.name} wins ${other(points)}-${mine(points)}.`, true);
      else if (to !== side) serveAt = now + NEXT_SERVE_MS; // whoever lost the point serves next
    };

    const serveBall = (now: number) => {
      ball = serve(theirs, now);
      send({ t: "ball", serve: true, x: ball.x, y: ball.y, vx: ball.vx, vy: ball.vy });
    };

    const onMessage = (m: PongMessage) => {
      if (m.from !== them.id || state === "over") return;
      const now = performance.now();
      if (m.t === "hello") {
        send({ t: "hey" });
        if (!heard) send({ t: "hello" }); // so they answer me straight away
      } else heardMe = true; // a "hey", or they've started: either way they can hear me
      heard = true;
      if (heardMe && state === "joining") {
        countdownEnds = now + COUNTDOWN_MS;
        go("countdown");
        playSound("minigame_start");
      }
      if (m.t === "paddle") {
        theirTarget = m.y;
      } else if (m.t === "ball") {
        ball = { x: m.x, y: m.y, vx: m.vx, vy: m.vy, t: now };
        if (state !== "playing") go("playing");
        if (!m.serve) playSound("catch_bit", { volume: 0.5 });
      } else if (m.t === "miss") {
        // It got past their pet: let it fly on from where it's been held.
        if (ball) {
          const reached = arrival(ball, theirs, paddles[theirs]);
          ball = { ...ballAt(ball, reached !== null && reached < now ? reached : now), t: now, out: true };
        }
        point(side, now);
      } else if (m.t === "quit") {
        finish(`${them.name} left the game.`);
      }
    };
    const room = joinMatch(match, onMessage);

    const draw = (b: Ball | null) => {
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = "#404040"; // the net
      for (let y = 6; y < H; y += 18) ctx.fillRect(W / 2 - 1, y, 2, 10);
      const y = side === "left" ? { left: myY, right: theirY } : { left: theirY, right: myY };
      ctx.drawImage(images.left, MARGIN, Math.round(y.left - PET / 2));
      ctx.drawImage(images.right, W - MARGIN - PET, Math.round(y.right - PET / 2));
      if (b) {
        ctx.fillStyle = "#fff";
        ctx.fillRect(Math.round(b.x - BALL / 2), Math.round(b.y - BALL / 2), BALL, BALL);
      }
    };

    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (keys.has("up")) myY -= KEY_SPEED * dt;
      if (keys.has("down")) myY += KEY_SPEED * dt;
      myY = clampY(myY);
      theirY += (theirTarget - theirY) * Math.min(1, dt * 15); // glide between their updates

      if (state === "joining") {
        if (now - joinedAt > JOIN_TIMEOUT_MS) finish(`${them.name} didn't join.`);
        else if (now - helloAt > HELLO_MS) {
          send({ t: "hello" });
          helloAt = now;
        }
      } else if (state === "countdown") {
        setCount(Math.ceil((countdownEnds - now) / 1000));
        if (now >= countdownEnds) {
          go("playing");
          if (side === "left") serveBall(now); // the challenger serves first
        }
      }
      if ((state === "countdown" || state === "playing") && Math.abs(myY - sentY) >= 1 && now - sentAt > PADDLE_MS) {
        send({ t: "paddle", y: Math.round(myY) });
        sentY = myY;
        sentAt = now;
      }
      if (state === "playing" && serveAt && now >= serveAt) {
        serveAt = 0;
        serveBall(now);
      }

      let shown = ball && ballAt(ball, now);
      let waiting = state === "playing" && !ball && !serveAt; // for their serve
      if (state === "playing" && ball && !ball.out) {
        const atMine = arrival(ball, side, paddles[side]);
        const atTheirs = arrival(ball, theirs, paddles[theirs]);
        if (atMine !== null && now >= atMine) {
          // It's reached my pet, so my screen decides.
          const at = ballAt(ball, atMine);
          if (touches(at.y, myY, paddles[side])) {
            ball = bounce(at, side, myY, paddles[side]);
            send({ t: "ball", serve: false, x: ball.x, y: ball.y, vx: ball.vx, vy: ball.vy });
            playSound("catch_bit", { volume: 0.5 });
          } else {
            ball = { ...at, out: true };
            send({ t: "miss" });
            point(theirs, now);
          }
          shown = ballAt(ball, now);
        } else if (atTheirs !== null && now >= atTheirs) {
          // It's reached their pet: hold it there until their screen says hit or miss.
          shown = ballAt(ball, atTheirs);
          waiting = true;
        }
      }
      if (ball?.out && shown && (shown.x < -BALL || shown.x > W + BALL)) ball = shown = null;
      waitingSince = waiting ? waitingSince || now : 0;
      if (waitingSince && now - waitingSince > WAIT_TIMEOUT_MS) finish(`Lost touch with ${them.name}.`);

      draw(shown);
      frame = requestAnimationFrame(loop);
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return; // typing in a chat box
      const k = e.key.toLowerCase();
      const dir = k === "arrowup" || k === "w" ? "up" : k === "arrowdown" || k === "s" ? "down" : null;
      if (!dir) return;
      e.preventDefault();
      if (e.type === "keydown") keys.add(dir);
      else keys.delete(dir);
    };
    const onPointer = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      myY = clampY(((e.clientY - r.top) / r.height) * H);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onKey);
    window.addEventListener("pointermove", onPointer);
    frame = requestAnimationFrame(loop);

    return () => {
      if (state === "countdown" || state === "playing") send({ t: "quit" });
      state = "over";
      cancelAnimationFrame(frame);
      room.leave();
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onKey);
      window.removeEventListener("pointermove", onPointer);
    };
    // One game per mount: the players, sides and channel are fixed for the whole game.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [leftPet, rightPet] = side === "left" ? [me, them] : [them, me];
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <Win98Window title="Pong.exe" className="w-[504px]" onClose={onClose}>
        <div className="mb-1 flex justify-between font-bold">
          <span>
            {leftPet.name}
            {side === "left" && " (you)"}: {score[0]}
          </span>
          <span>
            {rightPet.name}
            {side === "right" && " (you)"}: {score[1]}
          </span>
        </div>
        <div className="relative">
          <canvas ref={canvasRef} width={W} height={H} aria-label="Pong" className="pixelated block w-full touch-none bg-black" />
          {phase !== "playing" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/60 p-4 text-center text-[#00ff40]">
              {phase === "joining" && <p>Waiting for {them.name} to join...</p>}
              {phase === "countdown" && <p className="text-4xl font-bold">{count}</p>}
              {phase === "over" && (
                <>
                  <p className="text-lg">{result}</p>
                  <button onClick={onClose}>Close</button>
                </>
              )}
            </div>
          )}
        </div>
        <p className="!mb-0 !mt-1">Move your bug with the mouse or the ↑ ↓ keys. First to {WIN_SCORE} wins.</p>
      </Win98Window>
    </div>
  );
}
