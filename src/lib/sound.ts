// src/lib/sound.ts
// All game audio goes through here. Uses the Web Audio API so we can change
// the pitch of each pet-voice blip. Files live in /public/sounds.

export type SoundName =
  | "blip_happy" | "blip_sad" | "blip_hungry" | "blip_glitch"
  | "feed" | "munch" | "pet" | "hungry_grumble" | "sad" | "love" | "sleep" | "sleep_loop"
  | "glitch_small" | "glitch_big" | "modem" | "error" | "y2k_crash" | "freak_mode"
  | "boot" | "click" | "friend_online" | "message" | "friend_request"
  | "coin" | "purchase" | "minigame_start" | "minigame_end"
  | "crt_hum" | "hdd_clicks"
  // added after mapping the live app
  | "hatch" | "scrub" | "clean" | "lamp" | "wake" | "ball_throw" | "potion"
  | "catch_bit" | "bomb" | "denied" | "equip" | "level_up" | "birthday" | "skill_up"
  | "attention" | "thinking" | "pixel" | "erase" | "window_open" | "window_close"
  | "trash" | "warning";

const MP3: SoundName[] = ["boot", "modem", "freak_mode", "crt_hum", "hdd_clicks", "sleep_loop"];
const url = (n: SoundName) => `/sounds/${n}.${MP3.includes(n) ? "mp3" : "wav"}`;

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let muted = false;
const buffers = new Map<SoundName, Promise<AudioBuffer | null>>();
const loops = new Map<SoundName, AudioBufferSourceNode>();

// Browsers only allow audio after a user click. Call this from the first click
// (e.g. the "Click to boot" splash). Safe to call again.
export async function unlockAudio() {
  if (typeof window === "undefined") return;
  if (!ctx) {
    ctx = new AudioContext();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 1;
    master.connect(ctx.destination);
  }
  if (ctx.state !== "running") await ctx.resume();
}

function load(n: SoundName) {
  if (!buffers.has(n)) {
    buffers.set(
      n,
      fetch(url(n))
        .then((r) => r.arrayBuffer())
        .then((b) => ctx!.decodeAudioData(b))
        .catch(() => {
          console.warn(`TODO: missing sound /sounds/${n}`);
          return null;
        }),
    );
  }
  return buffers.get(n)!;
}

// Preload everything so the first play of each sound has no delay.
export async function preloadSounds(names: SoundName[]) {
  await unlockAudio();
  await Promise.all(names.map(load));
}

// Play a one-shot sound. rate > 1 = higher and faster.
export async function playSound(n: SoundName, opts: { volume?: number; rate?: number } = {}) {
  await unlockAudio();
  if (!ctx || !master) return;
  const buf = await load(n);
  if (!buf) return;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.playbackRate.value = opts.rate ?? 1;
  const g = ctx.createGain();
  g.gain.value = opts.volume ?? 1;
  src.connect(g).connect(master);
  src.start();
}

// Looping sounds (freak mode, ambience). Starting an already-playing loop does nothing.
export async function startLoop(n: SoundName, volume = 1) {
  await unlockAudio();
  if (!ctx || !master || loops.has(n)) return;
  const buf = await load(n);
  if (!buf || loops.has(n)) return;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.loop = true;
  const g = ctx.createGain();
  g.gain.value = volume;
  src.connect(g).connect(master);
  src.start();
  loops.set(n, src);
}

export function stopLoop(n: SoundName) {
  loops.get(n)?.stop();
  loops.delete(n);
}

export function stopAllLoops() {
  loops.forEach((src) => src.stop());
  loops.clear();
}

export function setMuted(m: boolean) {
  muted = m;
  if (master) master.gain.value = m ? 0 : 1;
}
export const isMuted = () => muted;

// ---------- pet voice ----------

type PetState = { hunger: number; mood: number; glitch_level: number };

// Which blip to use. Glitch wins, then hunger, then mood.
// In this app hunger is a fullness bar (100 = full), and the game treats < 30 as starving.
export function voiceFor(p: PetState): SoundName {
  if (p.glitch_level >= 60) return "blip_glitch";
  if (p.hunger < 30) return "blip_hungry";
  if (p.mood < 35) return "blip_sad";
  return "blip_happy";
}

// Call once per character as the pet's reply types out. Only every other
// letter beeps, with a small random pitch change so it doesn't sound robotic.
export function playBlip(char: string, index: number, p: PetState) {
  if (!/[a-z0-9]/i.test(char) || index % 2) return;
  const voice = voiceFor(p);
  // Low glitch still stutters now and then; high glitch jumps pitch a lot.
  const glitchy = p.glitch_level > 20 && Math.random() * 100 < p.glitch_level / 2;
  const rate = glitchy ? 0.6 + Math.random() * 1.0 : 0.9 + Math.random() * 0.25;
  playSound(glitchy ? "blip_glitch" : voice, { volume: 0.6, rate });
}

// Delay between typed letters (ms). Sad pets talk slower.
export function typingDelay(p: PetState) {
  return voiceFor(p) === "blip_sad" ? 110 : 60;
}
