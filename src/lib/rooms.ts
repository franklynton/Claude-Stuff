import type { Effect } from "./pet";

// The rooms of the pet's house and what you can do in each, like Pou.
// TODO: swap the emoji for the art team's item sprites in /public/items.

export type RoomKey = "living" | "kitchen" | "bathroom" | "bedroom" | "playroom" | "lab";

export interface Item {
  id: string;
  name: string;
  icon: string;
  price: number; // coins
  level: number; // level needed to use it
  effect: Effect;
}

export const ROOMS: { key: RoomKey; name: string; hint: string; wall: string; floor: string }[] = [
  { key: "living", name: "Living room", hint: "Click your bug to give it some love.", wall: "#ffe0a0", floor: "#a0522d" },
  { key: "kitchen", name: "Kitchen", hint: "Drag food onto your bug to feed it.", wall: "#c0ffc0", floor: "#e0e0e0" },
  { key: "bathroom", name: "Bathroom", hint: "Drag the soap over your bug to scrub it clean.", wall: "#a0e0ff", floor: "#ffffff" },
  { key: "bedroom", name: "Bedroom", hint: "Turn the lamp off to let your bug sleep.", wall: "#c0a0ff", floor: "#604080" },
  { key: "playroom", name: "Playroom", hint: "Throw the ball, or play Coin Catcher or Snake to earn coins.", wall: "#ffc0e0", floor: "#40a040" },
  { key: "lab", name: "Lab", hint: "Drag a potion onto your bug.", wall: "#d0d0d0", floor: "#808080" },
];

export const FOODS: Item[] = [
  { id: "apple", name: "Apple", icon: "🍎", price: 3, level: 1, effect: { hunger: 15, health: 3 } },
  { id: "noodles", name: "Pot noodle", icon: "🍜", price: 6, level: 1, effect: { hunger: 30 } },
  { id: "pizza", name: "Pizza", icon: "🍕", price: 10, level: 2, effect: { hunger: 40, health: -3 } },
  { id: "donut", name: "Donut", icon: "🍩", price: 5, level: 1, effect: { hunger: 20, fun: 5, health: -2 } },
  { id: "cola", name: "Cola", icon: "🥤", price: 4, level: 1, effect: { hunger: 10, sleep: 10 } },
];

export const POTIONS: Item[] = [
  { id: "health", name: "Health potion", icon: "❤️‍🩹", price: 20, level: 1, effect: { health: 35 } },
  { id: "energy", name: "Energy potion", icon: "⚡", price: 15, level: 2, effect: { sleep: 30, fun: -5 } },
];

// Effect of one scrub stroke with the soap, one pat in the living room, and one ball throw.
export const SCRUB: Effect = { cleanliness: 2 };
export const PAT: Effect = { love: 4 };
export const BALL: Effect = { fun: 12, sleep: -3, cleanliness: -2 };
