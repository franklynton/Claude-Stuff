"use client";

import { useState } from "react";
import type { Pet } from "@/types/db";
import Win98Window from "./Win98Window";

export interface ChatLine {
  from: "you" | "pet";
  text: string;
}

export default function PetChat({ pet }: { pet: Pet }) {
  const [lines, setLines] = useState<ChatLine[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);

  const send = async () => {
    const text = draft.trim();
    if (!text || sending) return;
    const history = [...lines, { from: "you" as const, text }];
    setLines(history);
    setDraft("");
    setSending(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: pet.name,
          personality: pet.personality,
          hunger: pet.hunger,
          mood: pet.mood,
          love: pet.love,
          cleanliness: pet.cleanliness,
          health: pet.health,
          fun: pet.fun,
          sleep: pet.sleep,
          glitch_level: pet.glitch_level,
          history: history.slice(-8), // keep requests small to save credits
        }),
      });
      const data = await res.json();
      setLines((l) => [...l, { from: "pet", text: data.reply ?? "*static noises*" }]);
    } catch {
      setLines((l) => [...l, { from: "pet", text: "ERROR 404: brain not found" }]);
    } finally {
      setSending(false);
    }
  };

  return (
    <Win98Window title={`Chat with ${pet.name} - AIM`} className="w-[360px]">
      <div className="sunken-panel h-64 overflow-y-auto bg-white p-2">
        {lines.length === 0 && <p className="text-gray-500">Say hi to {pet.name}!</p>}
        {lines.map((line, i) => (
          <p key={i} className="my-1">
            <b className={line.from === "you" ? "text-[#c00000]" : "text-[#000080]"}>
              {line.from === "you" ? "You" : pet.name}:
            </b>{" "}
            {line.text}
          </p>
        ))}
        {sending && <p className="text-gray-500">{pet.name} is typing...</p>}
      </div>
      <form
        className="field-row mt-2"
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
      >
        <input type="text" className="flex-1" value={draft} maxLength={200} onChange={(e) => setDraft(e.target.value)} />
        <button type="submit" disabled={sending || !draft.trim()}>
          Send
        </button>
      </form>
    </Win98Window>
  );
}
