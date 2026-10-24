"use client";

import { useEffect, useState } from "react";

// Bottom taskbar with a clock. Once the pet is glitchy enough, the date "rolls
// over" to 1900, the Y2K bug the pet is named after.
export default function Taskbar({ glitch }: { glitch: number }) {
  const [now, setNow] = useState<Date | null>(null);

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
      <div className="status-bar-field taskbar-clock">
        {time} {date}
      </div>
    </footer>
  );
}
