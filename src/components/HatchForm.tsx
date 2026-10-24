"use client";

import { useMemo, useState } from "react";
import type { PixelGrid } from "@/types/db";
import { COLOURS, SHAPE_KEYS, type ShapeKey, makePixels } from "@/lib/pet";
import PetSprite from "./PetSprite";
import Win98Window from "./Win98Window";

interface Props {
  onHatch: (name: string, pixels: PixelGrid) => void;
}

export default function HatchForm({ onHatch }: Props) {
  const [name, setName] = useState("");
  const [shape, setShape] = useState<ShapeKey>("beetle");
  const [colour, setColour] = useState(0);
  const pixels = useMemo(() => makePixels(shape, colour), [shape, colour]);

  return (
    <Win98Window title="New Bug Wizard" className="w-[420px]">
      <p>A millennium bug survived 31/12/1999 and crawled into your PC. Choose how it looks and give it a name. Its personality is a surprise!</p>
      <div className="my-2 flex justify-center bg-[#008080] py-3">
        <PetSprite pixels={pixels} glitch={0} scale={8} />
      </div>
      <fieldset>
        <legend>Shape</legend>
        <div className="flex gap-4">
          {SHAPE_KEYS.map((key) => (
            <div className="field-row" key={key}>
              <input id={`shape-${key}`} type="radio" name="shape" checked={shape === key} onChange={() => setShape(key)} />
              <label htmlFor={`shape-${key}`} className="capitalize">
                {key}
              </label>
            </div>
          ))}
        </div>
      </fieldset>
      <fieldset className="mt-2">
        <legend>Colour</legend>
        <div className="flex flex-wrap gap-1">
          {COLOURS.map((c, i) => (
            <button
              key={c.name}
              aria-label={c.name}
              title={c.name}
              aria-pressed={colour === i}
              className={`!h-6 !min-w-0 !w-6 !p-0 ${colour === i ? "outline outline-2 outline-black" : ""}`}
              style={{ background: c.body }}
              onClick={() => setColour(i)}
            />
          ))}
        </div>
      </fieldset>
      <div className="field-row-stacked mt-2">
        <label htmlFor="pet-name">Name</label>
        <input id="pet-name" type="text" maxLength={16} value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <section className="field-row mt-3 justify-end">
        <button disabled={!name.trim()} onClick={() => onHatch(name.trim(), pixels)}>
          Hatch &gt;
        </button>
      </section>
    </Win98Window>
  );
}
