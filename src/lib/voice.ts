// The pet's spoken voice, using the browser's built-in text-to-speech (no API, no cost).
import { isMuted } from "./sound";

type PetState = { mood: number; glitch_level: number };

const VOICE_KEY = "millennium-bug:voice";

export const canSpeak = () => typeof window !== "undefined" && "speechSynthesis" in window;

export function voiceOn() {
  try {
    return localStorage.getItem(VOICE_KEY) !== "off";
  } catch {
    return true;
  }
}

export function setVoiceOn(on: boolean) {
  try {
    localStorage.setItem(VOICE_KEY, on ? "on" : "off");
  } catch {}
  if (!on) stopSpeaking();
}

export function stopSpeaking() {
  if (canSpeak()) window.speechSynthesis.cancel();
}

// Pick an English voice once the browser has loaded its list.
function englishVoice() {
  const voices = window.speechSynthesis.getVoices();
  return voices.find((v) => v.lang.startsWith("en-GB")) ?? voices.find((v) => v.lang.startsWith("en"));
}

// Read a line out loud. Younger bugs squeak higher; sad bugs talk slower and lower;
// glitchy bugs wobble in pitch and speed.
export function speak(text: string, pet: PetState, stage = 0) {
  if (!canSpeak() || isMuted() || !voiceOn()) return;
  // Drop emoji and *actions* so it doesn't read them out.
  const clean = text
    .replace(/\*[^*]*\*/g, "")
    .replace(/[\p{Extended_Pictographic}\u{FE0F}\u{200D}]/gu, "")
    .trim();
  if (!clean) return;

  const say = new SpeechSynthesisUtterance(clean);
  const voice = englishVoice();
  if (voice) say.voice = voice;
  const glitchy = pet.glitch_level >= 60;
  say.pitch = glitchy ? 0.3 + Math.random() * 1.7 : Math.min(2, 1.9 - stage * 0.2 - (pet.mood < 35 ? 0.3 : 0));
  say.rate = glitchy ? 0.7 + Math.random() * 0.8 : pet.mood < 35 ? 0.85 : 1.1;
  stopSpeaking(); // don't talk over the last line
  window.speechSynthesis.speak(say);
}
