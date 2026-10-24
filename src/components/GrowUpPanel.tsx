"use client";

import type { Pet } from "@/types/db";
import { type Brain, SKILLS, STAGES, canAgeUp, skillLevel, skillProgress, skillsMissing } from "@/lib/brain";
import Win98Window from "./Win98Window";

interface Props {
  pet: Pet;
  brain: Brain;
  onAgeUp: () => void;
}

// Age and skills, kept apart from the needs bars. Like a Sims child, the bug has
// to level its skills before it can grow into the next stage.
export default function GrowUpPanel({ pet, brain, onAgeUp }: Props) {
  const stage = STAGES[brain.stage];
  const next = STAGES[brain.stage + 1];
  const missing = skillsMissing(brain);

  return (
    <Win98Window title={`${pet.name} - Growing up`} className="w-[480px]">
      <div className="flex items-center gap-2">
        <b className="w-24">
          {stage.icon} {stage.name}
        </b>
        <span className="w-8">Age</span>
        <div className="sunken-panel h-4 flex-1 bg-white" title={`${Math.floor(brain.age)}%`}>
          <div className="h-full bg-[#800080]" style={{ width: `${next ? brain.age : 100}%` }} />
        </div>
        {next && (
          <button className="!min-w-0" disabled={!canAgeUp(brain)} onClick={onAgeUp}>
            🎂 Age up
          </button>
        )}
      </div>
      <p className="!my-1 text-gray-700">
        {!next
          ? "Fully grown!"
          : brain.age < 100
            ? `Growing into a ${next.name}... (time and chatting fill the age bar)`
            : missing.length
              ? `Ready to grow, but needs ${missing.map((s) => s.name).join(", ")} at level ${stage.needs} first.`
              : `Ready to grow into a ${next.name}!`}
      </p>
      <div className="grid grid-cols-2 gap-x-3 gap-y-1">
        {SKILLS.map((s) => {
          const lv = skillLevel(brain, s.key);
          const short = next && lv < stage.needs;
          return (
            <div key={s.key} className="flex items-center gap-1" title={`Train it: ${s.how}`}>
              <span className="w-24">
                {s.icon} {s.name}
              </span>
              <div className="sunken-panel h-3 flex-1 bg-white">
                <div className="h-full bg-[#008080]" style={{ width: `${skillProgress(brain, s.key)}%` }} />
              </div>
              <span className={`w-10 text-right ${short ? "text-[#c00000]" : ""}`}>Lv {lv}</span>
            </div>
          );
        })}
      </div>
    </Win98Window>
  );
}
