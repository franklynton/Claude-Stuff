"use client";

import { type RefObject, useRef, useState } from "react";

interface Props {
  icon: string;
  label: string;
  sublabel?: string;
  disabled?: boolean;
  targetRef: RefObject<HTMLElement | null>; // the pet; drops and rubs are tested against it
  onDrop?: () => void; // released over the pet
  onRub?: () => void; // dragged across the pet (called at most every 80ms)
}

// An item you drag with the mouse or a finger, like food or soap in Pou.
// Uses pointer events so it works the same with mouse and touch.
export default function DragItem({ icon, label, sublabel, disabled, targetRef, onDrop, onRub }: Props) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const lastRub = useRef(0);

  const overTarget = (x: number, y: number) => {
    const r = targetRef.current?.getBoundingClientRect();
    return !!r && x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
  };

  return (
    <>
      <button
        className="flex !min-w-0 flex-col items-center !px-2 !py-1"
        style={{ touchAction: "none" }}
        disabled={disabled}
        title={label}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          setPos({ x: e.clientX, y: e.clientY });
        }}
        onPointerMove={(e) => {
          if (!pos) return;
          setPos({ x: e.clientX, y: e.clientY });
          const now = Date.now();
          if (onRub && now - lastRub.current > 80 && overTarget(e.clientX, e.clientY)) {
            lastRub.current = now;
            onRub();
          }
        }}
        onPointerUp={(e) => {
          if (pos && onDrop && overTarget(e.clientX, e.clientY)) onDrop();
          setPos(null);
        }}
        onPointerCancel={() => setPos(null)}
      >
        <span className="text-2xl leading-none">{icon}</span>
        <span>{label}</span>
        {sublabel && <span className="text-[10px] text-gray-700">{sublabel}</span>}
      </button>
      {pos && (
        <span
          className="pointer-events-none fixed z-50 text-4xl"
          style={{ left: pos.x - 20, top: pos.y - 24 }}
          aria-hidden
        >
          {icon}
        </span>
      )}
    </>
  );
}
