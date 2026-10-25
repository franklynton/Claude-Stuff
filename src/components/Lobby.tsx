"use client";

import { useEffect, useRef, useState } from "react";
import type { Pet } from "@/types/db";
import type { LobbyEvent, LobbyMove, LobbyPet, PongAnswer, VisitLine } from "@/types/lobby";
import type { Brain } from "@/lib/brain";
import { type LobbyRoom, joinLobby } from "@/lib/realtime";
import type { Side } from "@/lib/pong";
import { makeVisit } from "@/lib/visitChat";
import { playSound } from "@/lib/sound";
import { clockTime } from "@/lib/clock";
import PetSprite from "./PetSprite";
import Pong from "./Pong";
import Win98Window from "./Win98Window";
import { useAutoScroll } from "@/lib/useAutoScroll";

interface Props {
  pet: Pet;
  brain: Brain;
  userId: string; // the logged-in account
  onSocial: () => void; // chatting and visiting train the Social skill
  onPong: (points: number) => void; // a finished Pong game pays out like the other minigames
  onClose: () => void;
}

const BUBBLE_MS = 4000;
const LINE_GAP_MS = 2200;
const WALK_SPEED = 40; // % of the room per second, the same on every screen
const INVITE_MS = 20000; // a Pong challenge nobody answers is called off after this
const PONG = "🏓 Pong"; // speaker for Pong notes in the chat log

// Where a bug is headed, and how long the walk there takes (the CSS transition).
type Spot = { x: number; y: number; ms: number };
const NOWHERE: Spot = { x: 50, y: 60, ms: 0 }; // until we hear where a newcomer is

const walkMs = (from: Spot, x: number, y: number, speed: number) =>
  Math.round((Math.hypot(x - from.x, y - from.y) / speed) * 1000);

// A bug's id is the account plus this tab. sessionStorage survives a refresh but
// isn't shared with other tabs, so a refresh or reconnect comes back as the same
// bug, while two tabs of one account are two bugs that can't remove each other.
function lobbyId(userId: string) {
  const KEY = "y2k.lobbyTab";
  let tab = sessionStorage.getItem(KEY);
  if (!tab) {
    tab = crypto.randomUUID();
    sessionStorage.setItem(KEY, tab);
  }
  return `${userId}:${tab}`;
}

// The shared room: every online bug walks around here. Click the floor to walk,
// type to talk, click another bug to visit it or challenge it to Pong.
export default function Lobby({ pet, brain, userId, onSocial, onPong, onClose }: Props) {
  const [me, setMe] = useState<LobbyPet>(() => ({
    id: lobbyId(userId),
    userId,
    name: pet.name,
    pixel_data: pet.pixel_data,
    stage: brain.stage,
  }));
  const [spot, setSpot] = useState<Spot>(() => ({ x: 20 + Math.random() * 60, y: 40 + Math.random() * 40, ms: 0 }));
  // Everyone else's position, by id, from broadcast. Kept apart from `peers` (which
  // is rebuilt from presence) so a presence update never loses where someone is.
  const [spots, setSpots] = useState<Record<string, Spot>>({});
  const [peers, setPeers] = useState<LobbyPet[]>([]);
  const [bubbles, setBubbles] = useState<Record<string, { text: string; until: number }>>({});
  const [log, setLog] = useState<(VisitLine & { at: number })[]>([]);
  const logBox = useAutoScroll<HTMLDivElement>(log);
  const [selected, setSelected] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [online, setOnline] = useState(false);
  const room = useRef<LobbyRoom | null>(null);
  const peersRef = useRef(peers);
  peersRef.current = peers;
  // Pong: the challenge I've sent, one sent to me, and the game being played.
  const [outgoing, setOutgoing] = useState<{ match: string; to: string } | null>(null);
  const [incoming, setIncoming] = useState<{ match: string; from: string } | null>(null);
  const [game, setGame] = useState<{ match: string; them: LobbyPet; side: Side } | null>(null);

  // Shows a speech bubble over a bug (by its id) and adds the line to the chat log.
  const speak = (id: string, speaker: string, text: string) => {
    setBubbles((b) => ({ ...b, [id]: { text, until: Date.now() + BUBBLE_MS } }));
    setLog((l) => [...l.slice(-30), { speaker, text, at: Date.now() }]);
  };
  const note = (text: string) => setLog((l) => [...l.slice(-30), { speaker: PONG, text, at: Date.now() }]);
  const nameOf = (id: string) => peersRef.current.find((p) => p.id === id)?.name ?? "Someone";
  const reply = (to: string, match: string, answer: PongAnswer) =>
    room.current?.send({ type: "pong-reply", from: me.id, to, match, answer });

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
    } else if (e.type === "pong-invite" && e.to === me.id) {
      if (game || incoming) return reply(e.from, e.match, "busy");
      setIncoming({ match: e.match, from: e.from });
      playSound("friend_request");
    } else if (e.type === "pong-reply" && e.to === me.id) {
      if (e.answer === "cancel") return setIncoming((i) => (i?.match === e.match ? null : i));
      if (outgoing?.match !== e.match) return; // an old challenge
      setOutgoing(null);
      const them = peersRef.current.find((p) => p.id === e.from);
      if (e.answer === "accept" && them && !game) setGame({ match: e.match, them, side: "left" });
      else if (e.answer === "accept") reply(e.from, e.match, "cancel"); // too late: they left, or I'm already playing
      else note(`${nameOf(e.from)} ${e.answer === "busy" ? "is busy right now" : "said no"}.`);
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

  // Someone walked. Take the same time over it that their own screen does, so the
  // two screens agree on where they are all the way there, not just at the end.
  const onMove = (to: LobbyMove) =>
    setSpots((all) => {
      const from = all[to.id];
      const ms = from ? walkMs(from, to.x, to.y, to.speed > 0 ? to.speed : WALK_SPEED) : 0;
      return { ...all, [to.id]: { x: to.x, y: to.y, ms } };
    });

  useEffect(() => {
    playSound("modem", { volume: 0.4 });
    const r = joinLobby(me, { onPeers, onMove, onEvent: (e) => handleEventRef.current(e) });
    room.current = r;
    setOnline(r.online);
    r.move({ id: me.id, x: spot.x, y: spot.y, speed: WALK_SPEED }); // where we start
    return () => r.leave();
    // Join once; later changes go through room.update and room.move below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Share a new name, look or stage with everyone. Walking doesn't go through
  // here (presence); it goes through walk() (broadcast).
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

  // A Pong challenge is off once it's gone unanswered for a while (the other bug's
  // prompt is told to go too), or when either bug leaves the lobby.
  useEffect(() => {
    if (!outgoing) return;
    const id = setTimeout(() => {
      room.current?.send({ type: "pong-reply", from: me.id, to: outgoing.to, match: outgoing.match, answer: "cancel" });
      setOutgoing(null);
      setLog((l) => [...l.slice(-30), { speaker: PONG, text: "No answer, so the challenge is off.", at: Date.now() }]);
    }, INVITE_MS);
    return () => clearTimeout(id);
  }, [outgoing, me.id]);
  useEffect(() => {
    if (!incoming) return;
    const id = setTimeout(() => setIncoming(null), INVITE_MS);
    return () => clearTimeout(id);
  }, [incoming]);
  useEffect(() => {
    const here = (id: string) => peers.some((p) => p.id === id);
    setOutgoing((o) => (o && !here(o.to) ? null : o));
    setIncoming((i) => (i && !here(i.from) ? null : i));
  }, [peers]);

  const spotOf = (id: string) => (id === me.id ? spot : (spots[id] ?? NOWHERE));

  // Sends the absolute target, never a step, so a dropped message can't leave us
  // offset on anyone's screen: the next one puts us right.
  const walk = (x: number, y: number) => {
    setSpot((from) => ({ x, y, ms: walkMs(from, x, y, WALK_SPEED) }));
    room.current?.move({ id: me.id, x, y, speed: WALK_SPEED });
  };

  const walkTo = (e: React.MouseEvent<HTMLDivElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - box.left) / box.width) * 100;
    const y = ((e.clientY - box.top) / box.height) * 100;
    walk(Math.max(5, Math.min(95, x)), Math.max(30, Math.min(90, y)));
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
    const at = spotOf(them.id);
    walk(at.x > 50 ? at.x - 14 : at.x + 14, at.y);
    const lines = makeVisit(me.name, me.stage, brain, them);
    room.current?.send({ type: "visit", from: me.id, to: them.id, lines });
    playVisit(me.id, them.id, lines);
    setSelected(null);
    onSocial();
  };

  const challenge = (them: LobbyPet) => {
    const match = crypto.randomUUID();
    setOutgoing({ match, to: them.id });
    room.current?.send({ type: "pong-invite", from: me.id, to: them.id, match });
    setSelected(null);
  };
  const callOff = () => {
    if (outgoing) reply(outgoing.to, outgoing.match, "cancel");
    setOutgoing(null);
  };
  const answer = (yes: boolean) => {
    if (!incoming) return;
    const them = peers.find((p) => p.id === incoming.from);
    const play = yes && !!them; // they may have just left
    reply(incoming.from, incoming.match, play ? "accept" : "decline");
    if (play) {
      callOff(); // if I'd challenged someone myself
      setGame({ match: incoming.match, them, side: "right" });
    }
    setIncoming(null);
  };

  // A game played to the end: coins for my points, and the winner brags in the lobby.
  const pongOver = (mine: number, theirs: number) => {
    onPong(mine);
    onSocial();
    if (mine > theirs && game) {
      const text = `I beat ${game.them.name} ${mine}-${theirs} at Pong! 🏓`;
      speak(me.id, me.name, text);
      room.current?.send({ type: "say", from: me.id, text });
    }
  };

  const everyone = [me, ...peers];
  const target = peers.find((p) => p.id === selected);

  return (
    <>
      <Win98Window title="Club Bug 2000 - Lobby" className="w-[480px]" onClose={onClose}>
        <p className="!my-1">
          {online ? "🌐 Online" : "🖥️ Test mode: only other tabs on this computer (Supabase not set up yet)"} ·{" "}
          <b>{everyone.length}</b> bug{everyone.length === 1 ? "" : "s"} here
        </p>
        {/* isolate: the bugs' z-index (front-to-back order) stays inside the room, under pop-ups like Pong */}
        <div
          className="lobby-room relative isolate h-[280px] cursor-pointer overflow-hidden"
          onClick={walkTo}
          role="presentation"
        >
          {everyone.map((p) => {
            const at = spotOf(p.id);
            return (
              <div
                key={p.id}
                className="lobby-bug absolute flex -translate-x-1/2 -translate-y-full flex-col items-center"
                style={{ left: `${at.x}%`, top: `${at.y}%`, zIndex: Math.round(at.y), transitionDuration: `${at.ms}ms` }}
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
            );
          })}
        </div>
        {incoming && (
          <div className="field-row mt-1 border border-black bg-[#ffffe1] p-1">
            <span className="flex-1">
              🏓 <b>{nameOf(incoming.from)}</b> challenges you to Pong!
            </span>
            <button onClick={() => answer(true)}>Accept</button>
            <button onClick={() => answer(false)}>No thanks</button>
          </div>
        )}
        {outgoing ? (
          <div className="field-row mt-1">
            <span className="flex-1">🏓 Waiting for {nameOf(outgoing.to)} to accept...</span>
            <button onClick={callOff}>Cancel</button>
          </div>
        ) : target ? (
          <div className="field-row mt-1">
            <span className="flex-1">{target.name} is here.</span>
            <button onClick={() => visit(target)}>👋 Visit {target.name}</button>
            <button onClick={() => challenge(target)} disabled={!!game}>
              🏓 Play Pong
            </button>
            <button onClick={() => setSelected(null)}>Cancel</button>
          </div>
        ) : (
          <p className="!my-1 text-gray-700">Click the floor to walk. Click another bug to visit it or play Pong.</p>
        )}
        <div ref={logBox} className="sunken-panel mt-1 h-20 overflow-y-auto bg-white p-1">
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
      {game && (
        <Pong
          match={game.match}
          me={me}
          them={game.them}
          side={game.side}
          themHere={peers.some((p) => p.id === game.them.id)}
          onFinish={pongOver}
          onClose={() => setGame(null)}
        />
      )}
    </>
  );
}
