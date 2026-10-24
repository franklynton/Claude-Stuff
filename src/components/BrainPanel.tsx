"use client";

import { useState } from "react";
import type { Pet } from "@/types/db";
import { type Brain, TRAITS, selfDescription, topLikes } from "@/lib/brain";
import { askReflect } from "@/lib/askPet";
import Win98Window from "./Win98Window";

const COUNT_LABELS: Record<string, string> = {
  fed: "Fed",
  pat: "Patted",
  scrub: "Scrubbed",
  ball: "Ball games",
  game: "Byte Catcher",
  sleep: "Naps",
  chat: "Messages",
  neglect: "Times neglected",
};

interface Props {
  pet: Pet;
  brain: Brain;
  setBrain: (update: (b: Brain) => Brain) => void;
  onClose: () => void;
}

// Shows what the pet has learned: trait sliders, likes, memories and how it sees itself.
export default function BrainPanel({ pet, brain, setBrain, onClose }: Props) {
  const [thinking, setThinking] = useState(false);
  const loves = topLikes(brain, 1, 5);
  const hates = topLikes(brain, -1, 5);

  const reflect = async () => {
    setThinking(true);
    try {
      const reflection = await askReflect(pet, brain);
      setBrain((b) => ({ ...b, reflection }));
    } finally {
      setThinking(false);
    }
  };

  return (
    <Win98Window title={`${pet.name}'s brain.exe`} className="w-[360px]" onClose={onClose}>
      <fieldset>
        <legend>How {pet.name} sees itself</legend>
        <p className="!my-0 italic">&ldquo;{brain.reflection ?? selfDescription(brain, pet)}&rdquo;</p>
        <button className="mt-2" onClick={reflect} disabled={thinking}>
          {thinking ? "Thinking..." : "🪞 Reflect (rewrite with AI)"}
        </button>
      </fieldset>

      <fieldset className="mt-2">
        <legend>Personality (changes with how you treat it)</legend>
        <div className="flex flex-col gap-1">
          {TRAITS.map((t) => {
            const v = brain.traits[t.key];
            return (
              <div key={t.key} className="flex items-center gap-2">
                <span className="w-20 text-right">{t.low}</span>
                <div className="sunken-panel relative h-3 flex-1 bg-white">
                  <div className="absolute inset-y-0 left-1/2 w-px bg-gray-400" />
                  <div
                    className="absolute inset-y-0 w-2 bg-[#000080]"
                    style={{ left: `calc(${(v + 100) / 2}% - 4px)` }}
                    title={`${Math.round(v)}`}
                  />
                </div>
                <span className="w-20">{t.high}</span>
              </div>
            );
          })}
        </div>
      </fieldset>

      <fieldset className="mt-2">
        <legend>Likes and dislikes</legend>
        <p className="!my-0">❤️ {loves.length ? loves.join(", ") : "Nothing yet"}</p>
        <p className="!my-0">💔 {hates.length ? hates.join(", ") : "Nothing yet"}</p>
      </fieldset>

      <fieldset className="mt-2">
        <legend>Memories</legend>
        <ul className="sunken-panel !m-0 h-28 list-none overflow-y-auto bg-white p-1">
          {brain.memories.length === 0 && <li className="text-gray-500">No memories yet. Care for it and chat!</li>}
          {[...brain.memories].reverse().map((m, i) => (
            <li key={i}>
              <span className="text-gray-500">{new Date(m.at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}</span>{" "}
              {m.text}
            </li>
          ))}
        </ul>
        <p className="!mb-0 !mt-1 text-gray-700">
          {Object.entries(brain.counts)
            .filter(([k]) => COUNT_LABELS[k])
            .map(([k, v]) => `${COUNT_LABELS[k]} ${v}×`)
            .join(" · ") || "Nothing has happened yet."}
        </p>
      </fieldset>
    </Win98Window>
  );
}
