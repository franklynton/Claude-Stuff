"use client";

import type { RefObject } from "react";
import type { Pet } from "@/types/db";
import { findItem } from "@/lib/progress";
import { headSpot } from "@/lib/pet";
import BouncyBall from "./BouncyBall";
import PetSprite from "./PetSprite";

export interface Particle {
  id: number;
  icon: string;
  x: number; // % across the pet
}

interface Props {
  pet: Pet;
  petRef: RefObject<HTMLDivElement | null>;
  wall: string;
  floor: string;
  wallpaper: string | null;
  hat: string | null;
  glasses: string | null;
  dark: boolean; // bedroom lamp off
  hopping: boolean;
  particles: Particle[];
  balls?: number[]; // ids of thrown balls still bouncing
  onPetClick?: () => void;
}

// Fixed spots for dirt so it doesn't jump around between renders (% of the sprite box).
const DIRT = [
  [30, 45], [62, 60], [45, 75], [70, 38], [25, 68], [55, 50], [38, 30], [66, 78],
];

// The room with the pet in it, plus everything drawn on top of the pet:
// hat and glasses, dirt and flies, Zzz while asleep, and floating hearts or bubbles.
export default function PetStage(props: Props) {
  const { pet, petRef, wall, floor, wallpaper, hat, glasses, dark, hopping, particles, balls = [], onPetClick } = props;
  const dirt = pet.cleanliness < 60 ? Math.ceil((60 - pet.cleanliness) / 7.5) : 0;
  const flies = pet.cleanliness < 25;
  const sad = pet.mood < 30 || pet.health < 30;
  // Hats and glasses are sized and placed on this bug's head (sprite drawn at 10px per pixel).
  const S = 10;
  const head = headSpot(pet.pixel_data);
  const headX = (head.x + 0.5) * S;
  const hatSize = Math.max(32, head.width * S * 0.95);
  const glassesSize = Math.max(28, head.width * S * 0.85);

  return (
    <div className="relative h-[260px] overflow-hidden" style={{ background: floor }}>
      <div className="absolute inset-x-0 top-0 h-[65%]" style={{ background: findItem(wallpaper)?.css ?? wall }} />
      <div className="absolute inset-x-0 top-[65%] h-1 bg-black/30" />

      <div
        ref={petRef}
        className={`absolute bottom-6 left-1/2 -translate-x-1/2 ${onPetClick ? "cursor-pointer" : ""} ${hopping ? "animate-hop" : ""}`}
        onClick={onPetClick}
        style={{ filter: sad ? "saturate(0.4)" : undefined }}
      >
        {/* The bug and its outfit bob together so the hat stays on. */}
        <div className="animate-idle relative">
          <PetSprite pixels={pet.pixel_data} glitch={pet.glitch_level} scale={S} idle={false} />
          {hat && (
            <span
              className="pointer-events-none absolute -translate-x-1/2 leading-none"
              style={{ left: headX, top: head.top * S - hatSize * 0.8, fontSize: hatSize }}
            >
              {findItem(hat)?.icon}
            </span>
          )}
          {glasses && (
            <span
              className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 leading-none"
              style={{ left: headX, top: (head.eyes + 0.5) * S, fontSize: glassesSize }}
            >
              {findItem(glasses)?.icon}
            </span>
          )}
        </div>
        {DIRT.slice(0, dirt).map(([x, y], i) => (
          <span
            key={i}
            className="pointer-events-none absolute h-3 w-3 rounded-full bg-[#5a3a1a]/80"
            style={{ left: `${x}%`, top: `${y}%` }}
          />
        ))}
        {flies && (
          <>
            <span className="animate-fly pointer-events-none absolute -left-4 top-2 text-xl">🪰</span>
            <span className="animate-fly-2 pointer-events-none absolute -right-4 top-10 text-xl">🪰</span>
          </>
        )}
        {particles.map((p) => (
          <span
            key={p.id}
            className="animate-float-up pointer-events-none absolute top-1/3 text-2xl"
            style={{ left: `${p.x}%` }}
          >
            {p.icon}
          </span>
        ))}
      </div>

      {balls.map((id) => (
        <BouncyBall key={id} />
      ))}

      {dark && (
        <div className="pointer-events-none absolute inset-0 bg-[#000020]/75">
          <span className="animate-zzz absolute left-[58%] top-[30%] text-2xl font-bold text-white">Z z z</span>
        </div>
      )}
    </div>
  );
}
