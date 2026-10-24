"use client";

import { useEffect, useRef, useState } from "react";
import type { Pet, PixelGrid } from "@/types/db";
import { type Effect, care, decay, glitchText, newPet, personalityName } from "@/lib/pet";
import { type Progress, START_PROGRESS, SHOP, type ShopKind, XP_PER_LEVEL, levelOf } from "@/lib/progress";
import { clearPet, loadPet, loadProgress, savePet, saveProgress } from "@/lib/storage";
import ByteCatcher from "./ByteCatcher";
import HatchForm from "./HatchForm";
import House from "./House";
import PetChat from "./PetChat";
import PixelEditor from "./PixelEditor";
import Shop from "./Shop";
import StatBar from "./StatBar";
import Taskbar from "./Taskbar";
import Win98Window from "./Win98Window";

const TICK_MS = 1000;

export default function PetHome() {
  const [pet, setPet] = useState<Pet | null>(null);
  const [progress, setProgress] = useState<Progress>(START_PROGRESS);
  const [loaded, setLoaded] = useState(false);
  const [asleep, setAsleep] = useState(false);
  const [shopOpen, setShopOpen] = useState(false);
  const [gameOpen, setGameOpen] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [toast, setToast] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const asleepRef = useRef(asleep);
  asleepRef.current = asleep;

  // Load after mount (localStorage isn't available during server rendering),
  // catching up on the time the tab was closed.
  useEffect(() => {
    const saved = loadPet();
    if (saved) setPet(decay(saved.pet, Date.now() - saved.savedAt));
    setProgress(loadProgress());
    setLoaded(true);
  }, []);

  useEffect(() => {
    const id = setInterval(() => setPet((p) => (p ? decay(p, TICK_MS, asleepRef.current) : p)), TICK_MS);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (pet) savePet(pet);
  }, [pet]);

  useEffect(() => {
    if (loaded) saveProgress(progress);
  }, [progress, loaded]);

  const showToast = (text: string) => {
    setToast(text);
    setTimeout(() => setToast(""), 3000);
  };

  // Adds coins and XP, and announces a level-up.
  const reward = (coins: number, xp: number) => {
    setProgress((p) => {
      const before = levelOf(p.xp);
      const after = levelOf(p.xp + xp);
      if (after > before) showToast(`LEVEL UP! You're now level ${after}. New items unlocked!`);
      return { ...p, coins: p.coins + coins, xp: p.xp + xp };
    });
  };

  const apply = (effect: Effect, opts: { cost?: number; xp?: number } = {}) => {
    const cost = opts.cost ?? 0;
    if (cost > progress.coins) return false;
    setPet((p) => (p ? care(p, effect) : p));
    reward(-cost, opts.xp ?? 0);
    return true;
  };

  const buy = (id: string) => {
    const item = SHOP.find((i) => i.id === id);
    if (!item || progress.coins < item.price) return;
    setProgress((p) => ({ ...p, coins: p.coins - item.price, owned: [...p.owned, id], [item.kind]: id }));
  };
  const wear = (kind: ShopKind, id: string | null) => setProgress((p) => ({ ...p, [kind]: id }));

  const hatch = (name: string, pixels: PixelGrid) => {
    setPet(newPet(name, pixels));
    setProgress(START_PROGRESS);
  };
  const reset = () => {
    clearPet();
    setPet(null);
    setConfirmDelete(false);
    setShopOpen(false);
    setGameOpen(false);
    setEditorOpen(false);
  };

  const glitch = pet?.glitch_level ?? 0;
  const level = levelOf(progress.xp);

  return (
    <div className={`desktop ${glitch > 70 ? "desktop-corrupt" : ""}`}>
      <div className="marquee-bar">
        <span>★ Welcome to MiLLeNNiuM BuG ★ Best viewed in Netscape Navigator 4.0 at 800x600 ★ Under construction ★</span>
      </div>

      <main className="flex flex-1 flex-wrap items-start justify-center gap-6 p-6">
        {!loaded ? null : !pet ? (
          <HatchForm onHatch={hatch} />
        ) : (
          <>
            <Win98Window title={glitchText(`${pet.name}.exe`, glitch)} className="w-[480px]">
              <div className="mb-2 flex items-center gap-2">
                <span>
                  <b>Lv {level}</b>
                </span>
                <div className="sunken-panel h-3 w-20 bg-white" title={`${progress.xp % XP_PER_LEVEL}/${XP_PER_LEVEL} XP`}>
                  <div className="h-full bg-[#008000]" style={{ width: `${progress.xp % XP_PER_LEVEL}%` }} />
                </div>
                <span>🪙 {progress.coins}</span>
                <span className="flex-1 text-right">
                  <b className="capitalize">{personalityName(pet)}</b>
                </span>
                <button className="!min-w-0" onClick={() => setEditorOpen((o) => !o)}>
                  🎨 Edit look
                </button>
                <button className="!min-w-0" onClick={() => setShopOpen((o) => !o)}>
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
                setAsleep={setAsleep}
                apply={apply}
                onPlayGame={() => setGameOpen(true)}
              />
              <section className="field-row mt-2 justify-end">
                {confirmDelete ? (
                  <>
                    <span>Delete {pet.name} forever?</span>
                    <button onClick={reset}>Yes, delete</button>
                    <button onClick={() => setConfirmDelete(false)}>No</button>
                  </>
                ) : (
                  <button onClick={() => setConfirmDelete(true)}>Delete</button>
                )}
              </section>
            </Win98Window>
            <div className="flex flex-col gap-4">
              {editorOpen && (
                <PixelEditor
                  initial={pet.pixel_data}
                  onSave={(pixel_data) => {
                    setPet((p) => (p ? { ...p, pixel_data } : p));
                    setEditorOpen(false);
                  }}
                  onCancel={() => setEditorOpen(false)}
                />
              )}
              {gameOpen && (
                <ByteCatcher
                  pixels={pet.pixel_data}
                  onFinish={(score) => {
                    reward(score, score * 2);
                    setPet((p) => (p ? care(p, { fun: 20, sleep: -5 }) : p));
                  }}
                  onClose={() => setGameOpen(false)}
                />
              )}
              {shopOpen && <Shop progress={progress} onBuy={buy} onWear={wear} onClose={() => setShopOpen(false)} />}
              <PetChat pet={pet} />
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

      <Taskbar glitch={glitch} />
    </div>
  );
}
