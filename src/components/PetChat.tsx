"use client";

import { playBlip, playSound, typingDelay } from "@/lib/sound";
import { useEffect, useRef, useState } from "react";
import type { Pet } from "@/types/db";
import { type Brain, learnFromChat, remember } from "@/lib/brain";
import { type ChatTurn, askChat } from "@/lib/askPet";
import { type Question, learnAnswer, opener } from "@/lib/openers";
import { clockTime } from "@/lib/clock";
import { canSpeak, setVoiceOn, speak, voiceOn } from "@/lib/voice";
import Win98Window from "./Win98Window";
import { useAutoScroll } from "@/lib/useAutoScroll";

interface Props {
  pet: Pet;
  brain: Brain;
  setBrain: (update: (b: Brain) => Brain) => void;
  asleep: boolean;
}

// The pet's "voice": a blip per letter of the first part of its reply, pitched by its mood.
function speakBlips(text: string, pet: Pet) {
  [...text.slice(0, 24)].forEach((ch, i) => setTimeout(() => playBlip(ch, i, pet), i * typingDelay(pet)));
}

// A chat line plus when it was sent (the time stays out of what's sent to the AI).
type Line = ChatTurn & { at: number };

// How long you can stay quiet before the pet starts talking to you.
const QUIET_MS = [20_000, 40_000];

export default function PetChat({ pet, brain, setBrain, asleep }: Props) {
  const [lines, setLines] = useState<Line[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const chatBox = useAutoScroll<HTMLDivElement>(`${lines.length}-${sending}`); // also shows "is typing..."
  const question = useRef<Question>(null);
  // Voice support and setting are read after mount, so server and browser render the same.
  const [canTalk, setCanTalk] = useState(false);
  const [voice, setVoice] = useState(false);
  useEffect(() => {
    setCanTalk(canSpeak());
    setVoice(canSpeak() && voiceOn());
  }, []);
  // Latest props for the idle timer, so it doesn't restart on every stat tick.
  const latest = useRef({ pet, brain, asleep, sending, voice });
  latest.current = { pet, brain, asleep, sending, voice };

  // After a quiet spell, the pet says something (often a question) on its own.
  useEffect(() => {
    const wait = QUIET_MS[0] + Math.random() * (QUIET_MS[1] - QUIET_MS[0]);
    const id = setTimeout(() => {
      const { pet: p, brain: b, asleep: zzz, sending: busy, voice: talk } = latest.current;
      const o = busy ? null : opener(p, b, zzz);
      if (!o) return setLines((l) => [...l]); // nothing to say; re-arm the timer
      question.current = o.question;
      setLines((l) => [...l, { from: "pet", text: o.text, at: Date.now() }]);
      playSound("attention");
      if (talk) speak(o.text, p, b.stage);
    }, wait);
    return () => clearTimeout(id);
  }, [lines]);

  const send = async () => {
    const text = draft.trim();
    if (!text || sending) return;
    const history = [...lines, { from: "you" as const, text, at: Date.now() }];
    // Learn from the message first (name, likes, kind or mean words) so the reply can use it.
    const learned = learnAnswer(learnFromChat(brain, text), question.current, text);
    question.current = null;
    setBrain(() => learned);
    setLines(history);
    setDraft("");
    setSending(true);
    playSound("message");
    try {
      const { reply, memory } = await askChat(pet, learned, history.map(({ from, text }) => ({ from, text })));
      setLines((l) => [...l, { from: "pet", text: reply, at: Date.now() }]);
      // Out loud if voice is on, otherwise the old beep-per-letter voice.
      if (voice) speak(reply, pet, learned.stage);
      else speakBlips(reply, pet);
      if (memory) setBrain((b) => remember(b, memory));
    } catch {
      setLines((l) => [...l, { from: "pet", text: "ERROR 404: brain not found", at: Date.now() }]);
    } finally {
      setSending(false);
    }
  };

  return (
    <Win98Window title={`Chat with ${pet.name} - AIM`} className="w-[360px]">
      <div ref={chatBox} className="sunken-panel h-64 overflow-y-auto bg-white p-2">
        {lines.length === 0 && <p className="text-gray-500">{pet.name} can only just talk. Teach it! Tell it your name, what you like, or facts like &ldquo;pizza is yummy&rdquo;.</p>}
        {lines.map((line, i) => (
          <p key={i} className="my-1">
            <span className="text-gray-500">({clockTime(line.at)})</span>{" "}
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
        {canTalk && (
          <button
            type="button"
            title="Read replies out loud"
            onClick={() => {
              setVoiceOn(!voice);
              setVoice(!voice);
            }}
          >
            {voice ? "🔊 Voice" : "🔇 Voice"}
          </button>
        )}
      </form>
    </Win98Window>
  );
}
