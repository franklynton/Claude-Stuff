"use client";

import { type ReactNode, useRef, useState } from "react";

interface Props {
  title: string;
  children: ReactNode;
  className?: string;
  onClose?: () => void;
}

// The last-clicked window goes on top. Kept under the pop-ups (z-50), so it wraps.
let topZ = 1;
const TOP_BAR = 30; // the marquee bar with the power button stays uncovered
const bringToFront = () => (topZ = topZ >= 40 ? 1 : topZ + 1);

// A Windows 98 window frame using 98.css classes. Drag it by the title bar and
// resize it from the bottom-right corner. Only the close button does anything,
// and only with onClose.
export default function Win98Window({ title, children, className = "", onClose }: Props) {
  // Offset from where the page layout put it. Uses left/top rather than a transform,
  // because a transform would break the `fixed` drag icons inside (food, soap).
  const [at, setAt] = useState({ x: 0, y: 0 });
  const [z, setZ] = useState(0);
  const drag = useRef<{ px: number; py: number; x: number; y: number; top: number } | null>(null);

  return (
    <div
      className={`window win98-movable ${className}`}
      style={{ position: "relative", left: at.x, top: at.y, zIndex: z || undefined }}
      onPointerDownCapture={() => setZ(bringToFront())}
    >
      <div
        className="title-bar cursor-move touch-none select-none"
        onPointerDown={(e) => {
          if ((e.target as HTMLElement).closest("button")) return; // the title-bar buttons
          e.currentTarget.setPointerCapture(e.pointerId);
          const top = e.currentTarget.parentElement!.getBoundingClientRect().top;
          drag.current = { px: e.clientX, py: e.clientY, ...at, top };
        }}
        onPointerMove={(e) => {
          const d = drag.current;
          // Never up over the top bar, so the title bar (and the power button) can't be lost.
          if (d) setAt({ x: d.x + e.clientX - d.px, y: d.y + Math.max(e.clientY - d.py, TOP_BAR - d.top) });
        }}
        onPointerUp={() => (drag.current = null)}
        onPointerCancel={() => (drag.current = null)}
      >
        <div className="title-bar-text">{title}</div>
        <div className="title-bar-controls">
          <button aria-label="Minimize" />
          <button aria-label="Maximize" />
          <button aria-label="Close" onClick={onClose} />
        </div>
      </div>
      <div className="window-body">{children}</div>
    </div>
  );
}
