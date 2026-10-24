import type { PixelGrid } from "./db";

// What each player shares in the lobby (presence). `id` is per browser tab, so
// two tabs with the same saved pet still show up as two bugs.
export interface LobbyPet {
  id: string;
  name: string;
  pixel_data: PixelGrid;
  x: number; // 0-100, % across the room
  y: number; // 0-100, % down the room
  stage: number; // life stage index (0 toddler .. 3 adult)
}

export type VisitLine = { speaker: string; text: string };

// One-off messages sent to everyone in the lobby (broadcast).
export type LobbyEvent =
  | { type: "say"; from: string; text: string }
  | { type: "visit"; from: string; to: string; lines: VisitLine[] };
