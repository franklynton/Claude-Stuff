"use client";

import { playSound } from "@/lib/sound";
import { useState } from "react";
import type { PixelGrid } from "@/types/db";
import { COLOURS, SHAPE_KEYS, type ShapeKey, makePixels } from "@/lib/pet";
import PetSprite from "./PetSprite";
import Win98Window from "./Win98Window";

// Classic 16-colour Windows palette, plus a few Y2K extras.
const PALETTE = [
  "#000000", "#808080", "#c0c0c0", "#ffffff",
  "#800000", "#ff0000", "#808000", "#ffff00",
  "#008000", "#00ff00", "#008080", "#00ffff",
  "#000080", "#0000ff", "#800080", "#ff00ff",
  "#ff71ce", "#01cdfe", "#b967ff", "#ff8000",
];

type Tool = "pencil" | "eraser" | "fill" | "picker";
const TOOLS: { tool: Tool; label: string }[] = [
  { tool: "pencil", label: "✏️ Pencil" },
  { tool: "eraser", label: "🧽 Eraser" },
  { tool: "fill", label: "🪣 Fill" },
  { tool: "picker", label: "💉 Picker" },
];

const copy = (g: PixelGrid) => g.map((row) => [...row]);

// Flood fill from (x, y), replacing every connected pixel of the same colour.
function floodFill(grid: PixelGrid, x: number, y: number, colour: string): PixelGrid {
  const target = grid[y][x];
  if (target === colour) return grid;
  const out = copy(grid);
  const stack = [[x, y]];
  while (stack.length) {
    const [cx, cy] = stack.pop()!;
    if (out[cy]?.[cx] !== target) continue;
    out[cy][cx] = colour;
    stack.push([cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]);
  }
  return out;
}

interface Props {
  initial: PixelGrid;
  onSave: (pixels: PixelGrid) => void;
  onCancel: () => void;
}

// A tiny MS Paint for drawing your bug: 16x16 pixels, with the preset bugs as starting points.
export default function PixelEditor({ initial, onSave, onCancel }: Props) {
  const [grid, setGrid] = useState<PixelGrid>(() => copy(initial));
  const [history, setHistory] = useState<PixelGrid[]>([]);
  const [colour, setColour] = useState("#00a800");
  const [tool, setTool] = useState<Tool>("pencil");
  const [mirror, setMirror] = useState(true);
  const [painting, setPainting] = useState(false);
  const size = grid.length;

  const commit = (next: PixelGrid) => {
    setHistory((h) => [...h.slice(-30), grid]);
    setGrid(next);
  };

  // Paints one pixel (and its mirror twin) without adding an undo step; used while dragging.
  const paint = (g: PixelGrid, x: number, y: number) => {
    const c = tool === "eraser" ? "" : colour;
    const out = copy(g);
    out[y][x] = c;
    if (mirror) out[y][size - 1 - x] = c;
    return out;
  };

  // A tick per changed pixel, so dragging over the same colour stays quiet.
  const tick = (x: number, y: number) => {
    if (grid[y][x] !== (tool === "eraser" ? "" : colour)) playSound(tool === "eraser" ? "erase" : "pixel", { volume: 0.5 });
  };

  const press = (x: number, y: number) => {
    if (tool === "picker") {
      if (grid[y][x]) setColour(grid[y][x]);
      setTool("pencil");
    } else if (tool === "fill") {
      commit(floodFill(grid, x, y, colour));
    } else {
      tick(x, y);
      commit(paint(grid, x, y));
      setPainting(true);
    }
  };

  const enter = (x: number, y: number) => {
    if (!painting) return;
    tick(x, y);
    setGrid((g) => paint(g, x, y));
  };

  const undo = () => {
    if (!history.length) return;
    setGrid(history[history.length - 1]);
    setHistory((h) => h.slice(0, -1));
  };

  return (
    <Win98Window title="Paint - my_bug.bmp" className="w-[560px]" onClose={onCancel}>
      <div className="flex flex-wrap gap-3" onPointerUp={() => setPainting(false)} onPointerLeave={() => setPainting(false)}>
        <div className="flex flex-col gap-1">
          {TOOLS.map((t) => (
            <button
              key={t.tool}
              className={`!min-w-[90px] text-left ${tool === t.tool ? "!shadow-[inset_1px_1px_#0a0a0a,inset_-1px_-1px_#fff]" : ""}`}
              aria-pressed={tool === t.tool}
              onClick={() => setTool(t.tool)}
            >
              {t.label}
            </button>
          ))}
          <button onClick={undo} disabled={!history.length}>
            ↶ Undo
          </button>
          <button onClick={() => commit(grid.map((row) => row.map(() => "")))}>🗑️ Clear</button>
          <div className="field-row mt-1">
            <input id="mirror" type="checkbox" checked={mirror} onChange={(e) => setMirror(e.target.checked)} />
            <label htmlFor="mirror">Mirror</label>
          </div>
        </div>

        {/* The canvas: one cell per pixel; the checkerboard shows transparent pixels. */}
        <div
          className="sunken-panel grid select-none"
          style={{
            gridTemplateColumns: `repeat(${size}, 18px)`,
            touchAction: "none",
            background: "repeating-conic-gradient(#ddd 0 25%, #fff 0 50%) 0 0 / 18px 18px",
          }}
        >
          {grid.map((row, y) =>
            row.map((c, x) => (
              <div
                key={`${x}-${y}`}
                className="h-[18px] w-[18px] border-[0.5px] border-black/10"
                style={{ background: c || undefined }}
                onPointerDown={(e) => {
                  e.preventDefault();
                  (e.target as HTMLElement).releasePointerCapture(e.pointerId);
                  press(x, y);
                }}
                onPointerEnter={() => enter(x, y)}
              />
            )),
          )}
        </div>

        <div className="flex flex-col items-center gap-2">
          <div className="bg-[#008080] p-2">
            <PetSprite pixels={grid} glitch={0} scale={5} />
          </div>
          <span>Preview</span>
        </div>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-1">
        {PALETTE.map((c) => (
          <button
            key={c}
            aria-label={c}
            title={c}
            className={`!h-5 !min-w-0 !w-5 !p-0 ${colour === c ? "outline outline-2 outline-black" : ""}`}
            style={{ background: c }}
            onClick={() => {
              setColour(c);
              if (tool === "eraser" || tool === "picker") setTool("pencil");
            }}
          />
        ))}
        <label htmlFor="custom-colour" className="ml-2">
          Custom:
        </label>
        <input id="custom-colour" type="color" value={colour} onChange={(e) => setColour(e.target.value)} className="h-6 w-8" />
      </div>

      <fieldset className="mt-2">
        <legend>Start from a default bug</legend>
        <div className="flex flex-wrap gap-1">
          {SHAPE_KEYS.map((shape: ShapeKey) =>
            COLOURS.slice(0, 3).map((col, i) => (
              <button key={`${shape}-${i}`} className="!min-w-0 !px-1" title={`${col.name} ${shape}`} onClick={() => commit(makePixels(shape, i))}>
                <PetSprite pixels={makePixels(shape, i)} glitch={0} scale={2} idle={false} />
              </button>
            )),
          )}
        </div>
      </fieldset>

      <section className="field-row mt-3 justify-end">
        <button onClick={onCancel}>Cancel</button>
        <button onClick={() => onSave(grid)} disabled={grid.every((row) => row.every((c) => !c))}>
          Save look
        </button>
      </section>
    </Win98Window>
  );
}
