"use client";

import { useEffect, useRef, useState } from "react";
import type { Pet } from "@/types/db";
import { type Brain, learnFromChat, remember } from "@/lib/brain";
import { type ChatTurn, askChat } from "@/lib/askPet";
import { type Question, learnAnswer, opener } from "@/lib/openers";
import Win98Window from "./Win98Window";

interface Props {
  pet: Pet;
  brain: Brain;
  setBrain: (update: (b: Brain) => Brain) => void;
  asleep: boolean;
}

// How long you can stay quiet before the pet starts talking to you.
const QUIET_MS = [20_000, 40_000];

export default function PetChat({ pet, brain, setBrain, asleep }: Props) {
  const [lines, setLines] = useState<ChatTurn[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const question = useRef<Question>(null);
  // Latest props for the idle timer, so it doesn't restart on every stat tick.
  const latest = useRef({ pet, brain, asleep, sending });
  latest.current = { pet, brain, asleep, sending };

  // After a quiet spell, the pet says something (often a question) on its own.
  useEffect(() => {
    const wait = QUIET_MS[0] + Math.random() * (QUIET_MS[1] - QUIET_MS[0]);
    const id = setTimeout(() => {
      const { pet: p, brain: b, asleep: zzz, sending: busy } = latest.current;
      const o = busy ? null : opener(p, b, zzz);
      if (!o) return setLines((l) => [...l]); // nothing to say; re-arm the timer
      question.current = o.question;
      setLines((l) => [...l, { from: "pet", text: o.text }]);
    }, wait);
    return () => clearTimeout(id);
  }, [lines]);

  const send = async () => {
    const text = draft.trim();
    if (!text || sending) return;
    const history = [...lines, { from: "you" as const, text }];
    // Learn from the message first (name, likes, kind or mean words) so the reply can use it.
    const learned = learnAnswer(learnFromChat(brain, text), question.current, text);
    question.current = null;
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
        {lines.length === 0 && <p className="text-gray-500">{pet.name} can only just talk. Teach it! Tell it your name, what you like, or facts like &ldquo;pizza is yummy&rdquo;.</p>}
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
