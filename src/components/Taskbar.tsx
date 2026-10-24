"use client";

import { setMuted } from "@/lib/sound";
import { useEffect, useState } from "react";

// Bottom taskbar with a clock. Once the pet is glitchy enough, the date "rolls
// over" to 1900, the Y2K bug the pet is named after.
export default function Taskbar({ glitch }: { glitch: number }) {
  const [now, setNow] = useState<Date | null>(null);
  const [muted, setMute] = useState(false);

  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const broken = glitch > 60;
  const date = now ? (broken ? "01/01/1900" : now.toLocaleDateString("en-GB")) : "";
  const time = now ? now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) : "";

  return (
    <footer className="taskbar">
      <button className="font-bold">Start</button>
      <button
        className="ml-auto mr-1 !min-w-0"
        title={muted ? "Sound off" : "Sound on"}
        onClick={() => {
          setMuted(!muted);
          setMute(!muted);
        }}
      >
        {muted ? "🔇" : "🔊"}
      </button>
      <div className="status-bar-field taskbar-clock">
        {time} {date}
      </div>
    </footer>
  );
}
