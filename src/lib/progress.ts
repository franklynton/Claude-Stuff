// Coins, XP, levels and the things the player has bought. Kept separate from the
// pet's stats; will move to Supabase (profiles.coins and the pet's columns) later.

export interface Progress {
  coins: number;
  xp: number;
  owned: string[]; // shop item ids
  hat: string | null;
  glasses: string | null;
  wallpaper: string | null;
}

export const START_PROGRESS: Progress = { coins: 50, xp: 0, owned: [], hat: null, glasses: null, wallpaper: null };

export const XP_PER_LEVEL = 100;
export const levelOf = (xp: number) => Math.floor(xp / XP_PER_LEVEL) + 1;

export type ShopKind = "hat" | "glasses" | "wallpaper";

export interface ShopItem {
  id: string;
  kind: ShopKind;
  name: string;
  icon: string; // TODO: swap for the art team's sprites in /public/items
  price: number;
  level: number; // level needed to buy it
  css?: string; // wallpapers: CSS background drawn over the room's wall colour
}

export const SHOP: ShopItem[] = [
  { id: "cap", kind: "hat", name: "Baseball cap", icon: "🧢", price: 30, level: 1 },
  { id: "tophat", kind: "hat", name: "Top hat", icon: "🎩", price: 60, level: 2 },
  { id: "gradcap", kind: "hat", name: "Graduation cap", icon: "🎓", price: 90, level: 3 },
  { id: "crown", kind: "hat", name: "Crown", icon: "👑", price: 200, level: 5 },
  { id: "specs", kind: "glasses", name: "Specs", icon: "👓", price: 25, level: 1 },
  { id: "shades", kind: "glasses", name: "Shades", icon: "🕶️", price: 50, level: 2 },
  { id: "goggles", kind: "glasses", name: "Cyber goggles", icon: "🥽", price: 120, level: 4 },
  {
    id: "stars", kind: "wallpaper", name: "Starfield", icon: "✨", price: 40, level: 1,
    css: "radial-gradient(#fff 1px, transparent 1.5px) 0 0 / 18px 18px, #000040",
  },
  {
    id: "checker", kind: "wallpaper", name: "Checkerboard", icon: "🏁", price: 40, level: 2,
    css: "repeating-conic-gradient(#000 0 25%, #fff 0 50%) 0 0 / 24px 24px",
  },
  {
    id: "matrix", kind: "wallpaper", name: "Matrix", icon: "💾", price: 80, level: 3,
    css: "repeating-linear-gradient(90deg, #003000 0 6px, #00c000 6px 7px, #003000 7px 14px), #003000",
  },
  {
    id: "vaporwave", kind: "wallpaper", name: "Vaporwave", icon: "🌴", price: 150, level: 4,
    css: "linear-gradient(#ff71ce, #01cdfe 60%, #b967ff)",
  },
];

export const findItem = (id: string | null) => SHOP.find((i) => i.id === id);
