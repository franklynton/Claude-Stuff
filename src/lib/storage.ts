import type { Pet } from "@/types/db";
import { type Progress, START_PROGRESS } from "./progress";

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

const PROGRESS_KEY = "millennium-bug:progress";

export function loadProgress(): Progress {
  try {
    const raw = localStorage.getItem(PROGRESS_KEY);
    return raw ? { ...START_PROGRESS, ...JSON.parse(raw) } : START_PROGRESS;
  } catch {
    return START_PROGRESS;
  }
}

export function saveProgress(progress: Progress): void {
  try {
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress));
  } catch {}
}

export function clearPet(): void {
  try {
    localStorage.removeItem(KEY);
    localStorage.removeItem(PROGRESS_KEY);
  } catch {}
}
