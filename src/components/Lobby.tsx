"use client";

import { useEffect, useRef, useState } from "react";
import type { Pet } from "@/types/db";
import type { LobbyEvent, LobbyPet, VisitLine } from "@/types/lobby";
import type { Brain } from "@/lib/brain";
import { type LobbyRoom, joinLobby } from "@/lib/realtime";
import { makeVisit } from "@/lib/visitChat";
import { playSound } from "@/lib/sound";
import { clockTime } from "@/lib/clock";
import PetSprite from "./PetSprite";
import Win98Window from "./Win98Window";

interface Props {
  pet: Pet;
  brain: Brain;
  onSocial: () => void; // chatting and visiting train the Social skill
  onClose: () => void;
}

const BUBBLE_MS = 4000;
const LINE_GAP_MS = 2200;

// The shared room: every online bug walks around here. Click the floor to walk,
// type to talk, click another bug to visit it.
export default function Lobby({ pet, brain, onSocial, onClose }: Props) {
  const [me, setMe] = useState<LobbyPet>(() => ({
    id: crypto.randomUUID(),
    name: pet.name,
    pixel_data: pet.pixel_data,
    x: 20 + Math.random() * 60,
    y: 40 + Math.random() * 40,
    stage: brain.stage,
  }));
  const [peers, setPeers] = useState<LobbyPet[]>([]);
  const [bubbles, setBubbles] = useState<Record<string, { text: string; until: number }>>({});
  const [log, setLog] = useState<(VisitLine & { at: number })[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [online, setOnline] = useState(false);
  const room = useRef<LobbyRoom | null>(null);
  const peersRef = useRef(peers);
  peersRef.current = peers;

  // Shows a speech bubble over a bug (by its id) and adds the line to the chat log.
  const speak = (id: string, speaker: string, text: string) => {
    setBubbles((b) => ({ ...b, [id]: { text, until: Date.now() + BUBBLE_MS } }));
    setLog((l) => [...l.slice(-30), { speaker, text, at: Date.now() }]);
  };

  // Plays a visit conversation line by line, the same way on both owners' screens.
  const playVisit = (from: string, to: string, lines: VisitLine[]) => {
    lines.forEach((l, i) =>
      setTimeout(() => speak(i % 2 === 0 ? from : to, l.speaker, l.text), i * LINE_GAP_MS),
    );
  };

  const handleEvent = (e: LobbyEvent) => {
    if (e.type === "say") {
      const p = peersRef.current.find((x) => x.id === e.from);
      speak(e.from, p?.name ?? "???", e.text);
      playSound("message", { volume: 0.5 });
    } else if (e.type === "visit") {
      if (e.to === me.id) playSound("friend_request");
      playVisit(e.from, e.to, e.lines);
    }
  };
  const handleEventRef = useRef(handleEvent);
  handleEventRef.current = handleEvent;

  // A chime when a bug we haven't seen yet walks in.
  const seen = useRef(new Set<string>());
  const onPeers = (list: LobbyPet[]) => {
    if (list.some((p) => !seen.current.has(p.id))) playSound("friend_online", { volume: 0.6 });
    list.forEach((p) => seen.current.add(p.id));
    setPeers(list);
  };

  useEffect(() => {
    playSound("modem", { volume: 0.4 });
    const r = joinLobby(me, onPeers, (e) => handleEventRef.current(e));
    room.current = r;
    setOnline(r.online);
    return () => r.leave();
    // Join once; later changes go through room.update below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Share my new position, look or stage with everyone.
  useEffect(() => {
    room.current?.update(me);
  }, [me]);
  useEffect(() => {
    setMe((m) => ({ ...m, name: pet.name, pixel_data: pet.pixel_data, stage: brain.stage }));
  }, [pet.name, pet.pixel_data, brain.stage]);

  // Clear old bubbles.
  useEffect(() => {
    const id = setInterval(() => setBubbles((b) => Object.fromEntries(Object.entries(b).filter(([, v]) => v.until > Date.now()))), 500);
    return () => clearInterval(id);
  }, []);

  const walkTo = (e: React.MouseEvent<HTMLDivElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - box.left) / box.width) * 100;
    const y = ((e.clientY - box.top) / box.height) * 100;
    setMe((m) => ({ ...m, x: Math.max(5, Math.min(95, x)), y: Math.max(30, Math.min(90, y)) }));
    setSelected(null);
  };

  const say = (e: React.FormEvent) => {
    e.preventDefault();
    const text = draft.trim();
    if (!text) return;
    speak(me.id, me.name, text);
    room.current?.send({ type: "say", from: me.id, text });
    setDraft("");
    onSocial();
  };

  const visit = (them: LobbyPet) => {
    // Walk over next to them, then chat.
    setMe((m) => ({ ...m, x: them.x > 50 ? them.x - 14 : them.x + 14, y: them.y }));
    const lines = makeVisit(me.name, me.stage, brain, them);
    room.current?.send({ type: "visit", from: me.id, to: them.id, lines });
    playVisit(me.id, them.id, lines);
    setSelected(null);
    onSocial();
  };

  const everyone = [me, ...peers];
  const target = peers.find((p) => p.id === selected);

  return (
    <Win98Window title="Club Bug 2000 - Lobby" className="w-[480px]" onClose={onClose}>
      <p className="!my-1">
        {online ? "🌐 Online" : "🖥️ Test mode: only other tabs on this computer (Supabase not set up yet)"} ·{" "}
        <b>{everyone.length}</b> bug{everyone.length === 1 ? "" : "s"} here
      </p>
      <div
        className="lobby-room relative h-[280px] cursor-pointer overflow-hidden"
        onClick={walkTo}
        role="presentation"
      >
        {everyone.map((p) => (
          <div
            key={p.id}
            className="lobby-bug absolute flex -translate-x-1/2 -translate-y-full flex-col items-center"
            style={{ left: `${p.x}%`, top: `${p.y}%`, zIndex: Math.round(p.y) }}
            onClick={(e) => {
              if (p.id === me.id) return;
              e.stopPropagation();
              setSelected(p.id);
            }}
          >
            {bubbles[p.id] && <div className="lobby-bubble">{bubbles[p.id].text}</div>}
            <PetSprite pixels={p.pixel_data} glitch={0} scale={3} />
            <span className={`lobby-name ${p.id === me.id ? "font-bold" : ""} ${p.id === selected ? "underline" : ""}`}>
              {p.name}
              {p.id === me.id ? " (you)" : ""}
            </span>
          </div>
        ))}
      </div>
      {target ? (
        <div className="field-row mt-1">
          <span className="flex-1">{target.name} is here.</span>
          <button onClick={() => visit(target)}>👋 Visit {target.name}</button>
          <button onClick={() => setSelected(null)}>Cancel</button>
        </div>
      ) : (
        <p className="!my-1 text-gray-700">Click the floor to walk. Click another bug to visit it.</p>
      )}
      <div className="sunken-panel mt-1 h-20 overflow-y-auto bg-white p-1">
        {log.length === 0 && <span className="text-gray-500">Lobby chat appears here.</span>}
        {log.map((l, i) => (
          <div key={i}>
            <span className="text-gray-500">({clockTime(l.at)})</span> <b>{l.speaker}:</b> {l.text}
          </div>
        ))}
      </div>
      <form className="field-row mt-1" onSubmit={say}>
        <input type="text" className="flex-1" maxLength={80} value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Say something to the lobby" />
        <button type="submit" disabled={!draft.trim()}>
          Say
        </button>
      </form>
    </Win98Window>
  );
}
