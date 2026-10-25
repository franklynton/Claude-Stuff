"use client";

import { playBlip, playSound, typingDelay } from "@/lib/sound";
import { useEffect, useRef, useState } from "react";
import type { Pet } from "@/types/db";
import { type Brain, learnFromChat, remember } from "@/lib/brain";
import { type ChatTurn, askChat } from "@/lib/askPet";
import { type Question, learnAnswer, opener } from "@/lib/openers";
import { clockTime } from "@/lib/clock";
import { canSpeak, setVoiceOn, speak, stopSpeaking, voiceOn } from "@/lib/voice";
import Win98Window from "./Win98Window";
import { useAutoScroll } from "@/lib/useAutoScroll";

interface Props {
  pet: Pet;
  brain: Brain;
  setBrain: (update: (b: Brain) => Brain) => void;
  asleep: boolean;
  action: { id: number; text: string } | null; // the last thing you did to it, e.g. "*pats you*"
}

// The pet's "voice": a blip per letter of the first part of its reply, pitched by its mood.
// Stops part-way if `signal` is aborted (signing out mid-reply).
function speakBlips(text: string, pet: Pet, signal?: AbortSignal) {
  [...text.slice(0, 24)].forEach((ch, i) =>
    setTimeout(() => !signal?.aborted && playBlip(ch, i, pet), i * typingDelay(pet)),
  );
}

// A chat line plus when it was sent (the time stays out of what's sent to the AI).
type Line = ChatTurn & { at: number };

// How long you can stay quiet before the pet starts talking to you.
const QUIET_MS = [20_000, 40_000];
// It waits for you to finish (a burst of pats is one reaction) and reacts at most this
// often, to stay well inside the AI rate limit.
const SETTLE_MS = 1500;
const REACT_GAP_MS = 8000;

export default function PetChat({ pet, brain, setBrain, asleep, action }: Props) {
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
  const latest = useRef({ pet, brain, asleep, sending, voice, lines });
  latest.current = { pet, brain, asleep, sending, voice, lines };

  // Signing out unmounts the chat, and that stops the pet mid-thought: a reply
  // it's still waiting for is cancelled, and nothing more is typed or read out.
  const thinking = useRef<AbortController>(null);
  useEffect(() => {
    const stop = new AbortController();
    thinking.current = stop;
    return () => {
      stop.abort();
      stopSpeaking();
    };
  }, []);

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

  // Messages and actions not answered yet. The pet waits until you pause, then
  // answers them all in one reply (one AI call), so you can send several in a row.
  const unanswered = useRef(0);
  const answerTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const answerSoon = (wait = SETTLE_MS) => {
    clearTimeout(answerTimer.current);
    answerTimer.current = setTimeout(answer, wait);
  };
  useEffect(() => () => clearTimeout(answerTimer.current), []);

  const answer = async () => {
    const { pet: p, brain: b, sending: busy, voice: talk, lines: history, asleep: zzz } = latest.current;
    if (!unanswered.current) return;
    if (busy) return answerSoon(); // after the reply in progress
    unanswered.current = 0;
    // A sleeping bug can't talk (and costs no AI call).
    if (zzz) return setLines((l) => [...l, { from: "pet", text: "Zzz... 💤", at: Date.now() }]);
    setSending(true);
    const signal = thinking.current?.signal;
    try {
      const { reply, memory } = await askChat(p, b, history.map(({ from, text }) => ({ from, text })), signal);
      if (signal?.aborted) return;
      setLines((l) => [...l, { from: "pet", text: reply, at: Date.now() }]);
      // Out loud if voice is on, otherwise the old beep-per-letter voice.
      if (talk) speak(reply, p, b.stage);
      else speakBlips(reply, p, signal);
      if (memory) setBrain((x) => remember(x, memory));
    } catch {
      setLines((l) => [...l, { from: "pet", text: "ERROR 404: brain not found", at: Date.now() }]);
    } finally {
      setSending(false);
      if (unanswered.current) answerSoon(); // you kept typing while it thought
    }
  };

  const send = () => {
    const text = draft.trim();
    if (!text) return;
    // Learn from the message first (name, likes, kind or mean words) so the reply can use it.
    const learned = learnAnswer(learnFromChat(brain, text), question.current, text);
    question.current = null;
    setBrain(() => learned);
    setLines((l) => [...l, { from: "you", text, at: Date.now() }]);
    setDraft("");
    playSound("message");
    unanswered.current++;
    answerSoon();
  };

  // What you do to it (feed, pat, wash, play) goes into the chat as an *action* line,
  // and the AI reacts using what the brain knows: what it asked for, loves and hates.
  // Actions are collected for a moment and spaced out to save AI calls.
  const pending = useRef<string[]>([]);
  const lastReaction = useRef(0);
  useEffect(() => {
    if (!action) return;
    if (!pending.current.includes(action.text)) pending.current.push(action.text);
    const timer = setTimeout(() => {
      if (latest.current.asleep || !pending.current.length) return void (pending.current = []);
      setLines((l) => [...l, { from: "you", text: pending.current.join(" "), at: Date.now() }]);
      pending.current = [];
      lastReaction.current = Date.now();
      unanswered.current++;
      answerSoon(100); // after the line above is in `latest`
    }, Math.max(SETTLE_MS, lastReaction.current + REACT_GAP_MS - Date.now()));
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only a new action restarts the wait
  }, [action]);

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
        <input type="text" className="flex-1" placeholder={asleep ? `${pet.name} is asleep...` : ""} value={draft} maxLength={200} onChange={(e) => setDraft(e.target.value)} />
        <button type="submit" disabled={!draft.trim()}>
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
