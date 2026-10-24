"use client";

import { playSound } from "@/lib/sound";
import { useRef, useState } from "react";
import type { Pet } from "@/types/db";
import type { BrainEvent } from "@/lib/brain";
import type { Effect } from "@/lib/pet";
import { type Progress, levelOf } from "@/lib/progress";
import { BALL, FOODS, type Item, PAT, POTIONS, ROOMS, type RoomKey, SCRUB } from "@/lib/rooms";
import DragItem from "./DragItem";
import PetStage, { type Particle } from "./PetStage";

interface Props {
  pet: Pet;
  progress: Progress;
  asleep: boolean;
  setAsleep: (asleep: boolean) => void;
  // Applies a care effect; returns false if the player can't afford it.
  apply: (effect: Effect, opts?: { cost?: number; xp?: number; event?: BrainEvent }) => boolean;
  onPlayGame: () => void;
}

// The pet's house: tabs for each room, the room scene, and that room's items.
export default function House({ pet, progress, asleep, setAsleep, apply, onPlayGame }: Props) {
  const lastScrub = useRef(0);
  const [roomKey, setRoomKey] = useState<RoomKey>("living");
  const [particles, setParticles] = useState<Particle[]>([]);
  const [hopping, setHopping] = useState(false);
  const [notice, setNotice] = useState("");
  const petRef = useRef<HTMLDivElement>(null);
  const nextId = useRef(0);
  const room = ROOMS.find((r) => r.key === roomKey)!;
  const level = levelOf(progress.xp);

  const burst = (icon: string, count = 1) => {
    const added = Array.from({ length: count }, () => ({ id: nextId.current++, icon, x: 20 + Math.random() * 60 }));
    setParticles((p) => [...p, ...added]);
    setTimeout(() => setParticles((p) => p.filter((x) => !added.includes(x))), 1000);
  };

  const hop = () => {
    setHopping(true);
    setTimeout(() => setHopping(false), 500);
  };

  const giveItem = (item: Item, icon: string, event: BrainEvent) => {
    if (!apply(item.effect, { cost: item.price, xp: 3, event })) {
      playSound("denied");
      setNotice(`Not enough coins for ${item.name}. Play Byte Catcher in the Playroom to earn more!`);
      return;
    }
    setNotice("");
    if (event.type === "potion") playSound("potion");
    else playSound("feed").then(() => setTimeout(() => playSound("munch"), 300));
    burst(icon, 2);
    hop();
  };

  const goTo = (key: RoomKey) => {
    if (asleep) setAsleep(false); // leaving the bedroom wakes it up
    setNotice("");
    setRoomKey(key);
  };

  return (
    <div>
      <menu role="tablist" className="flex-wrap">
        {ROOMS.map((r) => (
          <li role="tab" key={r.key} aria-selected={r.key === roomKey}>
            <a href="#" onClick={(e) => (e.preventDefault(), goTo(r.key))}>
              {r.name}
            </a>
          </li>
        ))}
      </menu>
      <div className="window" role="tabpanel">
        <PetStage
          pet={pet}
          petRef={petRef}
          wall={room.wall}
          floor={room.floor}
          wallpaper={progress.wallpaper}
          hat={progress.hat}
          glasses={progress.glasses}
          dark={asleep}
          hopping={hopping}
          particles={particles}
          onPetClick={
            roomKey === "living"
              ? () => {
                  apply(PAT, { xp: 1, event: { type: "pat" } });
                  playSound(pet.love >= 90 ? "love" : "pet");
                  burst("💖");
                }
              : undefined
          }
        />
        <div className="window-body !m-1">
          <p className="!my-1 text-gray-700">{notice || room.hint}</p>
          <div className="flex min-h-[64px] flex-wrap items-stretch gap-1">
            {roomKey === "kitchen" &&
              FOODS.map((f) => (
                <DragItem
                  key={f.id}
                  icon={f.icon}
                  label={f.name}
                  sublabel={level < f.level ? `🔒 Lv ${f.level}` : `🪙 ${f.price}`}
                  disabled={level < f.level}
                  targetRef={petRef}
                  onDrop={() => giveItem(f, "😋", { type: "fed", item: f.name.toLowerCase() })}
                />
              ))}
            {roomKey === "lab" &&
              POTIONS.map((p) => (
                <DragItem
                  key={p.id}
                  icon={p.icon}
                  label={p.name}
                  sublabel={level < p.level ? `🔒 Lv ${p.level}` : `🪙 ${p.price}`}
                  disabled={level < p.level}
                  targetRef={petRef}
                  onDrop={() => giveItem(p, "✨", { type: "potion", item: p.name.toLowerCase() })}
                />
              ))}
            {roomKey === "bathroom" && (
              <DragItem
                icon="🧼"
                label="Soap"
                sublabel="rub it on"
                targetRef={petRef}
                onRub={() => {
                  apply(SCRUB, { xp: pet.cleanliness < 100 ? 1 : 0, event: { type: "scrub" } });
                  // onRub fires every 80ms; only bubble every half second
                  if (Date.now() - lastScrub.current > 500) {
                    lastScrub.current = Date.now();
                    playSound("scrub", { volume: 0.6 });
                  }
                  burst("🫧");
                }}
              />
            )}
            {roomKey === "bedroom" && (
              <button className="flex !min-w-0 flex-col items-center !px-3" onClick={() => {
                  playSound("lamp");
                  setAsleep(!asleep);
                }}>
                <span className="text-2xl leading-none">{asleep ? "🌙" : "💡"}</span>
                <span>{asleep ? "Lamp on (wake up)" : "Lamp off (sleep)"}</span>
              </button>
            )}
            {roomKey === "playroom" && (
              <>
                <button
                  className="flex !min-w-0 flex-col items-center !px-3"
                  onClick={() => {
                    apply(BALL, { xp: 2, event: { type: "ball" } });
                    playSound("ball_throw");
                    burst("⚽");
                    hop();
                  }}
                  disabled={pet.sleep < 5}
                >
                  <span className="text-2xl leading-none">⚽</span>
                  <span>Throw ball</span>
                </button>
                <button className="flex !min-w-0 flex-col items-center !px-3" onClick={onPlayGame}>
                  <span className="text-2xl leading-none">🕹️</span>
                  <span>Byte Catcher</span>
                  <span className="text-[10px] text-gray-700">earn coins</span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
