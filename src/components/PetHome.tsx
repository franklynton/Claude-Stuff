"use client";

import { useEffect, useState } from "react";
import type { Pet } from "@/types/db";
import { decay, feed, glitchText, newPet, play, type PersonalityKey } from "@/lib/pet";
import { clearPet, loadPet, savePet } from "@/lib/storage";
import HatchForm from "./HatchForm";
import PetChat from "./PetChat";
import PetSprite from "./PetSprite";
import StatBar from "./StatBar";
import Taskbar from "./Taskbar";
import Win98Window from "./Win98Window";

const TICK_MS = 1000;

export default function PetHome() {
  const [pet, setPet] = useState<Pet | null>(null);
  const [loaded, setLoaded] = useState(false);

  // Load after mount (localStorage isn't available during server rendering),
  // catching up on the time the tab was closed.
  useEffect(() => {
    const saved = loadPet();
    if (saved) setPet(decay(saved.pet, Date.now() - saved.savedAt));
    setLoaded(true);
  }, []);

  useEffect(() => {
    const id = setInterval(() => setPet((p) => (p ? decay(p, TICK_MS) : p)), TICK_MS);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (pet) savePet(pet);
  }, [pet]);

  const hatch = (name: string, personality: PersonalityKey) => setPet(newPet(name, personality));
  const reset = () => {
    if (!confirm("Delete this bug and start again?")) return;
    clearPet();
    setPet(null);
  };

  const glitch = pet?.glitch_level ?? 0;

  return (
    <div className={`desktop ${glitch > 70 ? "desktop-corrupt" : ""}`}>
      <div className="marquee-bar">
        <span>★ Welcome to MiLLeNNiuM BuG ★ Best viewed in Netscape Navigator 4.0 at 800x600 ★ Under construction ★</span>
      </div>

      <main className="flex flex-1 items-start justify-center gap-6 p-6">
        {!loaded ? null : !pet ? (
          <HatchForm onHatch={hatch} />
        ) : (
          <>
            <Win98Window title={glitchText(`${pet.name}.exe`, glitch)} className="w-[340px]">
              <div className="flex justify-center bg-[#008080] py-4">
                <PetSprite pixels={pet.pixel_data} glitch={glitch} />
              </div>
              <div className="mt-3 flex flex-col gap-1">
                <StatBar label="Hunger" value={pet.hunger} />
                <StatBar label="Mood" value={pet.mood} />
                <StatBar label="Glitch" value={pet.glitch_level} danger />
              </div>
              <section className="field-row mt-3 justify-center">
                <button onClick={() => setPet((p) => (p ? feed(p) : p))}>Feed</button>
                <button onClick={() => setPet((p) => (p ? play(p) : p))}>Play</button>
                <button onClick={reset}>Delete</button>
              </section>
            </Win98Window>
            <PetChat pet={pet} />
          </>
        )}
      </main>

      <Taskbar glitch={glitch} />
    </div>
  );
}
