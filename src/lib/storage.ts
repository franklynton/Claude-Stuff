import type { Pet } from "@/types/db";

// Browser save until Supabase auth + the pets table are set up (priority 2).
const KEY = "millennium-bug:pet";

export function loadPet(): { pet: Pet; savedAt: number } | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const saved = JSON.parse(raw);
    // Pets saved before the extra stats existed start them at 80.
    saved.pet = { love: 80, cleanliness: 80, health: 100, fun: 80, sleep: 80, ...saved.pet };
    return saved;
  } catch {
    return null;
  }
}

export function savePet(pet: Pet): void {
  try {
    localStorage.setItem(KEY, JSON.stringify({ pet, savedAt: Date.now() }));
  } catch {
    // storage unavailable; the game still runs for this session
  }
}

export function clearPet(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {}
}
