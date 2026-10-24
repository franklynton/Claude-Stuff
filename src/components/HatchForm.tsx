"use client";

import { useState } from "react";
import { PERSONALITIES, type PersonalityKey } from "@/lib/pet";
import Win98Window from "./Win98Window";

interface Props {
  onHatch: (name: string, personality: PersonalityKey) => void;
}

export default function HatchForm({ onHatch }: Props) {
  const [name, setName] = useState("");
  const [personality, setPersonality] = useState<PersonalityKey>("cheerful");

  return (
    <Win98Window title="New Bug Wizard" className="w-[380px]">
      <p>A millennium bug survived 31/12/1999 and crawled into your PC. Give it a name.</p>
      <div className="field-row-stacked">
        <label htmlFor="pet-name">Name</label>
        <input id="pet-name" type="text" maxLength={16} value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <fieldset className="mt-2">
        <legend>Personality</legend>
        {(Object.keys(PERSONALITIES) as PersonalityKey[]).map((key) => (
          <div className="field-row" key={key}>
            <input
              id={`p-${key}`}
              type="radio"
              name="personality"
              checked={personality === key}
              onChange={() => setPersonality(key)}
            />
            <label htmlFor={`p-${key}`} className="capitalize">
              {key}
            </label>
          </div>
        ))}
      </fieldset>
      <section className="field-row mt-3 justify-end">
        <button disabled={!name.trim()} onClick={() => onHatch(name.trim(), personality)}>
          Hatch &gt;
        </button>
      </section>
    </Win98Window>
  );
}
