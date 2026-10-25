import type { PixelGrid } from "./db";

// Who a player is. This is all that travels over presence: it changes rarely, so
// presence diffs stay small and the player list is never churned by walking.
// `id` is stable for a browser tab (it survives a refresh or a dropped
// connection), so a reconnect comes back as the same bug rather than a second one.
// `userId` is the account, the same in every tab that account has open.
export interface LobbyPet {
  id: string;
  userId: string;
  name: string;
  pixel_data: PixelGrid;
  stage: number; // life stage index (0 toddler .. 3 adult)
}

// Where a player is walking to. This goes over broadcast, throttled. It is always
// an absolute target, never a delta, so a dropped message can only ever make a bug
// late - it can't leave it permanently offset.
export interface LobbyMove {
  id: string;
  x: number; // 0-100, % across the room
  y: number; // 0-100, % down the room
  speed: number; // % of the room per second, so both screens take the same time
}

export type VisitLine = { speaker: string; text: string };

// One-off messages sent to everyone in the lobby (broadcast).
export type LobbyEvent =
  | { type: "say"; from: string; text: string }
  | { type: "visit"; from: string; to: string; lines: VisitLine[] }
  // Pong: a challenge and the answer to it. `match` names the game's own channel.
  | { type: "pong-invite"; from: string; to: string; match: string }
  | { type: "pong-reply"; from: string; to: string; match: string; answer: PongAnswer };

export type PongAnswer = "accept" | "decline" | "busy" | "cancel";

// What the two Pong players send each other, on the game's own channel.
export type PongBody =
  | { t: "hello" } // I'm here: answer me
  | { t: "hey" } // I hear you (never answered, so the two can't ping-pong)
  | { t: "paddle"; y: number } // where my pet is
  | { t: "ball"; serve: boolean; x: number; y: number; vx: number; vy: number } // the ball leaves my end from here
  | { t: "miss" } // the ball got past my pet: a point to you
  | { t: "quit" };
export type PongMessage = PongBody & { from: string };
