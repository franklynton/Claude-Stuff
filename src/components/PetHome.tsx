"use client";

import {
  playSound,
  startLoop,
  stopAllLoops,
  stopLoop,
  unlockAudio,
} from "@/lib/sound";
import { useEffect, useRef, useState } from "react";
import type { Pet, PixelGrid } from "@/types/db";
import { type Effect, care, decay, glitchText, newPet } from "@/lib/pet";
import {
  type Progress,
  START_PROGRESS,
  SHOP,
  type ShopKind,
  XP_PER_LEVEL,
  levelOf,
} from "@/lib/progress";
import {
  type Brain,
  type BrainEvent,
  STAGES,
  ageUp,
  canAgeUp,
  drift,
  gainSkill,
  newBrain,
  observe,
  stageOf,
} from "@/lib/brain";
import {
  clearPause,
  clearPet,
  loadBrain,
  loadPause,
  loadPet,
  loadHideHelp,
  loadProgress,
  saveBrain,
  savePause,
  savePet,
  saveProgress,
} from "@/lib/storage";
import BrainPanel from "./BrainPanel";
import Lobby from "./Lobby";
import PowerMenu from "./PowerMenu";
import GrowUpPanel from "./GrowUpPanel";
import CoinCatcher from "./CoinCatcher";
import Snake from "./Snake";
import HatchForm from "./HatchForm";
import House from "./House";
import PetChat from "./PetChat";
import PixelEditor from "./PixelEditor";
import Shop from "./Shop";
import StatBar from "./StatBar";
import Taskbar from "./Taskbar";
import HowToPlay from "./HowToPlay";
import Win98Window from "./Win98Window";

const TICK_MS = 1000;

export default function PetHome({ userId, username, onLogOff }: { userId?: string; username?: string; onLogOff?: () => void }) {
  const [pet, setPet] = useState<Pet | null>(null);
  const [progress, setProgress] = useState<Progress>(START_PROGRESS);
  const [loaded, setLoaded] = useState(false);
  const [asleep, setAsleep] = useState(false);
  const [shopOpen, setShopOpen] = useState(false);
  const [gameOpen, setGameOpen] = useState(false);
  const [snakeOpen, setSnakeOpen] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [toast, setToast] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [brain, setBrainState] = useState<Brain | null>(null);
  const [brainOpen, setBrainOpen] = useState(false);
  const [lobbyOpen, setLobbyOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const asleepRef = useRef(asleep);
  asleepRef.current = asleep;

  // Load after mount (localStorage isn't available during server rendering).
  // A pet you signed out of was paused, so it carries on exactly where it was
  // (asleep too, if it was); if the tab was just closed, it catches up on that time.
  useEffect(() => {
    const saved = loadPet();
    const pause = loadPause();
    if (saved) {
      const restored = pause ? saved.pet : decay(saved.pet, Date.now() - saved.savedAt);
      setPet(restored);
      setBrainState({ ...newBrain(), ...loadBrain() }); // fills in fields older saves lack
      if (pause) {
        setAsleep(pause.asleep);
        savePet(restored); // restart the save clock before the pause goes, in case another tab loads it too
      }
    }
    clearPause();
    setProgress(loadProgress());
    setHelpOpen(!loadHideHelp()); // the How to play window, right after logging in
    setLoaded(true);
  }, []);

  useEffect(() => {
    const id = setInterval(
      () => setPet((p) => (p ? decay(p, TICK_MS, asleepRef.current) : p)),
      TICK_MS,
    );
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (pet) savePet(pet);
  }, [pet]);

  useEffect(() => {
    if (loaded) saveProgress(progress);
  }, [progress, loaded]);

  useEffect(() => {
    if (brain) saveBrain(brain);
  }, [brain]);

  // Browsers block audio until the first click, so the boot chime plays then.
  useEffect(() => {
    const boot = () => {
      unlockAudio().then(() => playSound("boot"));
      window.removeEventListener("pointerdown", boot);
    };
    window.addEventListener("pointerdown", boot);
    return () => window.removeEventListener("pointerdown", boot);
  }, []);

  // Warning sounds when a stat crosses a line (not on every tick).
  const prevPet = useRef<Pet | null>(null);
  useEffect(() => {
    const before = prevPet.current;
    prevPet.current = pet;
    if (!pet || !before || before.id !== pet.id) return;
    const crossedDown = (k: keyof Pet, line: number) =>
      (before[k] as number) >= line && (pet[k] as number) < line;
    const crossedUp = (line: number) =>
      before.glitch_level < line && pet.glitch_level >= line;
    if (crossedUp(100)) playSound("y2k_crash");
    else if (crossedUp(70)) playSound("error");
    else if (crossedUp(60)) playSound("glitch_big");
    else if (crossedUp(40)) playSound("glitch_small");
    else if (crossedDown("hunger", 30)) playSound("hungry_grumble");
    else if (
      crossedDown("health", 30) ||
      crossedDown("sleep", 30) ||
      crossedDown("cleanliness", 30)
    )
      playSound("warning");
    else if (crossedDown("love", 30) || crossedDown("mood", 30))
      playSound("sad");
    else if (before.cleanliness < 100 && pet.cleanliness >= 100)
      playSound("clean");
  }, [pet]);

  // Snoring while the lamp is off.
  const wasAsleep = useRef(false);
  useEffect(() => {
    if (asleep) {
      playSound("sleep");
      startLoop("sleep_loop", 0.5);
    } else if (wasAsleep.current) {
      stopLoop("sleep_loop");
      playSound("wake");
    }
    wasAsleep.current = asleep;
  }, [asleep]);

  // A chime when the brain records a new skill level.
  const memCount = useRef(0);
  useEffect(() => {
    const mems = brain?.memories ?? [];
    if (
      mems.length > memCount.current &&
      mems.at(-1)?.text.includes("skill went up")
    )
      playSound("skill_up");
    memCount.current = mems.length;
  }, [brain?.memories]);

  // Each tick, the brain notices neglect (and slowly forgets old habits).
  useEffect(() => {
    if (pet) setBrainState((b) => (b ? drift(b, pet) : b));
  }, [pet]);

  // The brain learns from what the player does to the pet.
  const learn = (event: BrainEvent) =>
    setBrainState((b) => (b && pet ? observe(b, event, pet) : b));
  const setBrain = (update: (b: Brain) => Brain) =>
    setBrainState((b) => (b ? update(b) : b));
  const setSleeping = (on: boolean) => {
    if (on && !asleep) learn({ type: "sleep" });
    setAsleep(on);
  };

  const showToast = (text: string) => {
    setToast(text);
    setTimeout(() => setToast(""), 3000);
  };

  // Adds coins and XP, and announces a level-up.
  const reward = (coins: number, xp: number) => {
    setProgress((p) => {
      const before = levelOf(p.xp);
      const after = levelOf(p.xp + xp);
      if (after > before) {
        showToast(`LEVEL UP! You're now level ${after}. New items unlocked!`);
        playSound("level_up");
      }
      return { ...p, coins: p.coins + coins, xp: p.xp + xp };
    });
  };

  const apply = (
    effect: Effect,
    opts: { cost?: number; xp?: number; event?: BrainEvent } = {},
  ) => {
    const cost = opts.cost ?? 0;
    if (cost > progress.coins) return false;
    setPet((p) => (p ? care(p, effect) : p));
    if (opts.event) learn(opts.event);
    reward(-cost, opts.xp ?? 0);
    return true;
  };

  const buy = (id: string) => {
    const item = SHOP.find((i) => i.id === id);
    if (!item || progress.coins < item.price) return playSound("denied");
    playSound("purchase");
    setProgress((p) => ({
      ...p,
      coins: p.coins - item.price,
      owned: [...p.owned, id],
      [item.kind]: id,
    }));
  };
  const wear = (kind: ShopKind, id: string | null) => {
    setProgress((p) => ({ ...p, [kind]: id }));
    if (id) {
      learn({ type: "dressup" });
      playSound("equip");
    }
  };
  const growUp = () => {
    if (!brain || !canAgeUp(brain)) return;
    setBrainState(ageUp(brain));
    playSound("birthday");
    showToast(
      `${pet?.name} grew into a ${STAGES[brain.stage + 1].name}! It can talk better now.`,
    );
  };

  const hatch = (name: string, pixels: PixelGrid) => {
    const born = newPet(name, pixels);
    setPet(born);
    setBrainState(newBrain());
    setProgress(START_PROGRESS);
    playSound("hatch");
  };
  const reset = () => {
    playSound("trash");
    stopAllLoops();
    clearPet();
    setPet(null);
    setBrainState(null);
    setBrainOpen(false);
    setLobbyOpen(false);
    setConfirmDelete(false);
    setShopOpen(false);
    setGameOpen(false);
    setSnakeOpen(false);
    setEditorOpen(false);
  };

  // Saves everything as it is right now and pauses the pet, so the time until the
  // next sign-in doesn't count (see the load above). Logging off then unmounts all
  // of this, which takes the pet out of the lobby and stops its brain and chat.
  const signOut = () => {
    if (pet) {
      savePet(pet);
      savePause({ asleep });
    }
    if (brain) saveBrain(brain);
    if (loaded) saveProgress(progress);
    stopAllLoops();
    playSound("window_close");
    onLogOff?.();
  };

  // Both minigames pay out the same way: a coin per point, XP, and a fun boost.
  const finishGame = (name: string) => (score: number) => {
    reward(score, score * 2);
    if (score > 0) setTimeout(() => playSound("coin"), 900);
    learn({ type: "game", score, name });
    setPet((p) => (p ? care(p, { fun: 20, sleep: -5 }) : p));
  };

  const glitch = pet?.glitch_level ?? 0;
  const level = levelOf(progress.xp);

  return (
    <div className={`desktop ${glitch > 70 ? "desktop-corrupt" : ""}`}>
      <div className="flex items-center bg-[#000080]">
        <div className="marquee-bar min-w-0 flex-1">
          <span>
            ★ Welcome to MiLLeNNiuM BuG ★ Best viewed in Netscape Navigator 4.0 at
            800x600 ★ Under construction ★
          </span>
        </div>
        {onLogOff && <PowerMenu username={username} petName={pet?.name} onSignOut={signOut} />}
      </div>

      <main className="flex flex-1 flex-wrap items-start justify-center gap-6 p-6">
        {!loaded ? null : !pet ? (
          <HatchForm onHatch={hatch} />
        ) : (
          <>
            <div className="flex flex-col gap-4">
              <Win98Window
                title={glitchText(`${pet.name}.exe`, glitch)}
                className="w-[480px]"
              >
                <div className="mb-2 flex flex-wrap items-center gap-2 whitespace-nowrap">
                  <span>
                    <b>Lv {level}</b>
                  </span>
                  <div
                    className="sunken-panel h-3 w-20 bg-white"
                    title={`${progress.xp % XP_PER_LEVEL}/${XP_PER_LEVEL} XP`}
                  >
                    <div
                      className="h-full bg-[#008000]"
                      style={{ width: `${progress.xp % XP_PER_LEVEL}%` }}
                    />
                  </div>
                  <span>🪙 {progress.coins}</span>
                  <span className="flex-1 text-right">
                    {brain && (
                      <b title={STAGES[stageOf(brain)].about}>
                        {STAGES[stageOf(brain)].icon}{" "}
                        {STAGES[stageOf(brain)].name}
                      </b>
                    )}
                  </span>
                  <button
                    className="!min-w-0"
                    onClick={() => setLobbyOpen((o) => !o)}
                  >
                    🌐 Lobby
                  </button>
                  <button
                    className="!min-w-0"
                    onClick={() => setBrainOpen((o) => !o)}
                  >
                    🧠 Brain
                  </button>
                  <button
                    className="!min-w-0"
                    onClick={() => setEditorOpen((o) => !o)}
                  >
                    🎨 Edit look
                  </button>
                  <button
                    className="!min-w-0"
                    onClick={() => setShopOpen((o) => !o)}
                  >
                    🛒 Shop
                  </button>
                </div>
                <div className="mb-2 grid grid-cols-2 gap-x-3 gap-y-1">
                  <StatBar label="Hunger" value={pet.hunger} />
                  <StatBar label="Love" value={pet.love} />
                  <StatBar label="Clean" value={pet.cleanliness} />
                  <StatBar label="Fun" value={pet.fun} />
                  <StatBar label="Sleep" value={pet.sleep} />
                  <StatBar label="Health" value={pet.health} />
                  <StatBar label="Mood" value={pet.mood} />
                  <StatBar label="Glitch" value={pet.glitch_level} danger />
                </div>
                <House
                  pet={pet}
                  progress={progress}
                  asleep={asleep}
                  setAsleep={setSleeping}
                  apply={apply}
                  onPlayGame={() => setGameOpen(true)}
                  onPlaySnake={() => setSnakeOpen(true)}
                  onNudge={(kind, n) => setProgress((p) => ({ ...p, nudge: { ...p.nudge, [kind]: n ?? undefined } }))}
                />
                <section className="field-row mt-2 justify-end">
                  {confirmDelete ? (
                    <>
                      <span>Delete {pet.name} forever?</span>
                      <button onClick={reset}>Yes, delete</button>
                      <button onClick={() => setConfirmDelete(false)}>
                        No
                      </button>
                    </>
                  ) : (
                    <button onClick={() => setConfirmDelete(true)}>
                      Delete
                    </button>
                  )}
                </section>
              </Win98Window>
              {brain && lobbyOpen && (
                <Lobby
                  pet={pet}
                  brain={brain}
                  userId={userId ?? "guest"}
                  onSocial={() => setBrain((b) => gainSkill(b, "social", 2))}
                  onClose={() => setLobbyOpen(false)}
                />
              )}
              {brain && (
                <GrowUpPanel pet={pet} brain={brain} onAgeUp={growUp} />
              )}
            </div>
            <div className="flex flex-col gap-4">
              {editorOpen && (
                <PixelEditor
                  initial={pet.pixel_data}
                  onSave={(pixel_data) => {
                    setPet((p) => (p ? { ...p, pixel_data } : p));
                    learn({ type: "redraw" });
                    playSound("equip");
                    setEditorOpen(false);
                  }}
                  onCancel={() => setEditorOpen(false)}
                />
              )}
              {gameOpen && (
                <CoinCatcher pixels={pet.pixel_data} onFinish={finishGame("Coin Catcher")} onClose={() => setGameOpen(false)} />
              )}
              {snakeOpen && <Snake onFinish={finishGame("Snake")} onClose={() => setSnakeOpen(false)} />}
              {shopOpen && (
                <Shop
                  progress={progress}
                  onBuy={buy}
                  onWear={wear}
                  onClose={() => setShopOpen(false)}
                />
              )}
              {brainOpen && brain && (
                <BrainPanel
                  pet={pet}
                  brain={brain}
                  setBrain={setBrain}
                  onClose={() => setBrainOpen(false)}
                />
              )}
              {brain && <PetChat pet={pet} brain={brain} setBrain={setBrain} asleep={asleep} />}
            </div>
          </>
        )}
      </main>

      {toast && (
        <div className="window fixed left-1/2 top-16 z-50 -translate-x-1/2">
          <div className="title-bar">
            <div className="title-bar-text">Congratulations!</div>
          </div>
          <div className="window-body">
            <p>🎉 {toast}</p>
          </div>
        </div>
      )}

      {helpOpen && <HowToPlay onClose={() => setHelpOpen(false)} />}

      <Taskbar glitch={glitch} username={username} onHelp={() => setHelpOpen(true)} onLogOff={onLogOff && signOut} />
    </div>
  );
}
