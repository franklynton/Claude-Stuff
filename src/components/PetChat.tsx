"use client";

import { useState } from "react";
import type { Pet } from "@/types/db";
import { type Brain, learnFromChat, remember } from "@/lib/brain";
import { type ChatTurn, askChat } from "@/lib/askPet";
import Win98Window from "./Win98Window";

interface Props {
  pet: Pet;
  brain: Brain;
  setBrain: (update: (b: Brain) => Brain) => void;
}

export default function PetChat({ pet, brain, setBrain }: Props) {
  const [lines, setLines] = useState<ChatTurn[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);

  const send = async () => {
    const text = draft.trim();
    if (!text || sending) return;
    const history = [...lines, { from: "you" as const, text }];
    // Learn from the message first (name, likes, kind or mean words) so the reply can use it.
    const learned = learnFromChat(brain, text);
    setBrain(() => learned);
    setLines(history);
    setDraft("");
    setSending(true);
    try {
      const { reply, memory } = await askChat(pet, learned, history);
      setLines((l) => [...l, { from: "pet", text: reply }]);
      if (memory) setBrain((b) => remember(b, memory));
    } catch {
      setLines((l) => [...l, { from: "pet", text: "ERROR 404: brain not found" }]);
    } finally {
      setSending(false);
    }
  };

  return (
    <Win98Window title={`Chat with ${pet.name} - AIM`} className="w-[360px]">
      <div className="sunken-panel h-64 overflow-y-auto bg-white p-2">
        {lines.length === 0 && <p className="text-gray-500">Say hi to {pet.name}! Tell it your name, what you like, or how cute it is.</p>}
        {lines.map((line, i) => (
          <p key={i} className="my-1">
            <b className={line.from === "you" ? "text-[#c00000]" : "text-[#000080]"}>
              {line.from === "you" ? brain.ownerName ?? "You" : pet.name}:
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
