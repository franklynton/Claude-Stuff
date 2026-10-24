"use client";

import { useMemo, useState } from "react";
import type { PixelGrid } from "@/types/db";
import { COLOURS, SHAPE_KEYS, type ShapeKey, makePixels } from "@/lib/pet";
import PetSprite from "./PetSprite";
import PixelEditor from "./PixelEditor";
import Win98Window from "./Win98Window";

interface Props {
  onHatch: (name: string, pixels: PixelGrid) => void;
}

export default function HatchForm({ onHatch }: Props) {
  const [name, setName] = useState("");
  const [shape, setShape] = useState<ShapeKey>("beetle");
  const [colour, setColour] = useState(0);
  const [drawn, setDrawn] = useState<PixelGrid | null>(null); // set once you draw your own
  const [drawing, setDrawing] = useState(false);
  const preset = useMemo(() => makePixels(shape, colour), [shape, colour]);
  const pixels = drawn ?? preset;

  if (drawing) {
    return (
      <PixelEditor
        initial={pixels}
        onSave={(p) => {
          setDrawn(p);
          setDrawing(false);
        }}
        onCancel={() => setDrawing(false)}
      />
    );
  }

  return (
    <Win98Window title="New Bug Wizard" className="w-[420px]">
      <p>A millennium bug survived 31/12/1999 and crawled into your PC. Pick a default look or draw your own, then give it a name. Its personality is a surprise!</p>
      <div className="my-2 flex justify-center bg-[#008080] py-3">
        <PetSprite pixels={pixels} glitch={0} scale={8} />
      </div>
      <div className="mb-2 flex items-center justify-center gap-2">
        <button onClick={() => setDrawing(true)}>🎨 Draw my own</button>
        {drawn && <button onClick={() => setDrawn(null)}>Use a default bug</button>}
      </div>
      <fieldset>
        <legend>Shape</legend>
        <div className="flex gap-4">
          {SHAPE_KEYS.map((key) => (
            <div className="field-row" key={key}>
              <input id={`shape-${key}`} type="radio" name="shape" checked={!drawn && shape === key} onChange={() => (setShape(key), setDrawn(null))} />
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
              aria-pressed={!drawn && colour === i}
              className={`!h-6 !min-w-0 !w-6 !p-0 ${!drawn && colour === i ? "outline outline-2 outline-black" : ""}`}
              style={{ background: c.body }}
              onClick={() => (setColour(i), setDrawn(null))}
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
