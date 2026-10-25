import type { PixelGrid } from "@/types/db";

// Pong between two bugs in the lobby: the field, the rules and the ball maths.
// Both players' screens run exactly this, so the ball takes the same path on each.

export const W = 480;
export const H = 300;
export const SCALE = 3; // each pet's 16x16 drawing at 3x...
export const PET = 16 * SCALE; // ...is that player's paddle
export const MARGIN = 12; // gap between a pet and its end wall
export const BALL = 8;
export const WIN_SCORE = 5;
const SERVE_SPEED = 260; // px per second
const MAX_SPEED = 600;
const SPEED_UP = 1.07; // per hit
const MAX_ANGLE = (55 * Math.PI) / 180; // when the ball hits the very edge of a pet

export type Side = "left" | "right";

// The ball as it was last served or hit: where it was at time `t` (ms, this
// screen's clock) and its velocity in px per second. The rest follows from that.
export interface Ball {
  x: number;
  y: number;
  vx: number;
  vy: number;
  t: number;
}

const TOP = BALL / 2;
const SPAN = H - BALL; // how far the ball's centre can travel between the walls

// Where the ball is at time `now`: a straight line, bouncing off the top and bottom.
export function ballAt(b: Ball, now: number): Ball {
  const dt = (now - b.t) / 1000;
  let u = (b.y - TOP + b.vy * dt) % (2 * SPAN);
  if (u < 0) u += 2 * SPAN;
  const back = u > SPAN; // bounced off a wall and heading the other way
  return { x: b.x + b.vx * dt, y: TOP + (back ? 2 * SPAN - u : u), vx: b.vx, vy: back ? -b.vy : b.vy, t: now };
}

// A pet as a paddle: the x where the ball touches its face, and the rows actually
// drawn (relative to the pet's centre), so the ball bounces off the bug itself
// rather than the empty corners of its square.
export interface Paddle {
  face: number;
  top: number;
  bottom: number;
}

export function paddleFor(side: Side, pixels: PixelGrid): Paddle {
  let top = Infinity, bottom = -1, left = Infinity, right = -1;
  pixels.forEach((row, y) =>
    row.forEach((colour, x) => {
      if (!colour) return;
      top = Math.min(top, y);
      bottom = Math.max(bottom, y);
      left = Math.min(left, x);
      right = Math.max(right, x);
    }),
  );
  if (bottom < 0) [top, bottom, left, right] = [0, 15, 0, 15]; // a blank drawing: use the whole square
  const box = side === "left" ? MARGIN : W - MARGIN - PET;
  return {
    face: side === "left" ? box + (right + 1) * SCALE + BALL / 2 : box + left * SCALE - BALL / 2,
    top: top * SCALE - PET / 2,
    bottom: (bottom + 1) * SCALE - PET / 2,
  };
}

// When the ball will reach the pet at `side`, or null if it's heading the other way.
export function arrival(b: Ball, side: Side, p: Paddle): number | null {
  const toward = side === "left" ? b.vx < 0 : b.vx > 0;
  return toward ? b.t + ((p.face - b.x) / b.vx) * 1000 : null;
}

// Whether the ball, at height `y`, touches a pet whose centre is at `petY`.
export function touches(y: number, petY: number, p: Paddle): boolean {
  return y >= petY + p.top - BALL / 2 && y <= petY + p.bottom + BALL / 2;
}

// Sends the ball back off a pet: a little faster each time, and at a steeper angle
// the further from the pet's middle it hit.
export function bounce(at: Ball, side: Side, petY: number, p: Paddle): Ball {
  const middle = petY + (p.top + p.bottom) / 2;
  const reach = (p.bottom - p.top) / 2 + BALL / 2;
  const angle = Math.max(-1, Math.min(1, (at.y - middle) / reach)) * MAX_ANGLE;
  const speed = Math.min(MAX_SPEED, Math.hypot(at.vx, at.vy) * SPEED_UP);
  const away = side === "left" ? 1 : -1;
  return { x: p.face, y: at.y, vx: away * speed * Math.cos(angle), vy: speed * Math.sin(angle), t: at.t };
}

// A new ball from the middle of the field, heading for `toward` at a gentle angle.
export function serve(toward: Side, now: number): Ball {
  const angle = (Math.random() - 0.5) * (Math.PI / 4);
  const dir = toward === "right" ? 1 : -1;
  return { x: W / 2, y: H / 4 + Math.random() * (H / 2), vx: dir * SERVE_SPEED * Math.cos(angle), vy: SERVE_SPEED * Math.sin(angle), t: now };
}
