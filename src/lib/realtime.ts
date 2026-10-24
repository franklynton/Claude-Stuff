import type { LobbyEvent, LobbyPet } from "@/types/lobby";
import { getSupabase } from "./supabase/client";

// Joins the shared lobby. With Supabase configured this is the `lobby` Realtime
// channel (presence for who's here and where, broadcast for chat and visits).
// Without it, a BroadcastChannel stands in, so tabs on the same computer can
// still see each other for testing.

export interface LobbyRoom {
  online: boolean; // true = Supabase (everyone), false = this computer only
  update: (me: LobbyPet) => void;
  send: (event: LobbyEvent) => void;
  leave: () => void;
}

type OnPeers = (peers: LobbyPet[]) => void;
type OnEvent = (event: LobbyEvent) => void;

export function joinLobby(me: LobbyPet, onPeers: OnPeers, onEvent: OnEvent): LobbyRoom {
  const supabase = getSupabase();
  if (!supabase) return joinLocal(me, onPeers, onEvent);

  const channel = supabase.channel("lobby", { config: { presence: { key: me.id } } });
  channel
    .on("presence", { event: "sync" }, () => {
      const state = channel.presenceState<LobbyPet>();
      onPeers(Object.values(state).map((entries) => entries[0]).filter((p) => p.id !== me.id));
    })
    .on("broadcast", { event: "lobby" }, ({ payload }) => onEvent(payload as LobbyEvent))
    .subscribe((status) => {
      if (status === "SUBSCRIBED") channel.track(me);
    });

  return {
    online: true,
    update: (pet) => channel.track(pet),
    send: (event) => channel.send({ type: "broadcast", event: "lobby", payload: event }),
    leave: () => supabase.removeChannel(channel),
  };
}

// Players drop out if they haven't been heard from for this long (local mode only).
const STALE_MS = 6000;

function joinLocal(me: LobbyPet, onPeers: OnPeers, onEvent: OnEvent): LobbyRoom {
  const bc = new BroadcastChannel("millennium-bug-lobby");
  const peers = new Map<string, { pet: LobbyPet; seen: number }>();
  let current = me;
  const emit = () => onPeers([...peers.values()].map((p) => p.pet));

  bc.onmessage = ({ data }) => {
    if (data.kind === "presence") {
      const isNew = !peers.has(data.pet.id);
      peers.set(data.pet.id, { pet: data.pet, seen: Date.now() });
      if (isNew) bc.postMessage({ kind: "presence", pet: current }); // say hi back to newcomers
      emit();
    } else if (data.kind === "leave") {
      peers.delete(data.id);
      emit();
    } else if (data.kind === "event") {
      onEvent(data.event);
    }
  };

  // Heartbeat, and forget tabs that were closed without saying goodbye.
  const timer = setInterval(() => {
    bc.postMessage({ kind: "presence", pet: current });
    for (const [id, p] of peers) if (Date.now() - p.seen > STALE_MS) peers.delete(id);
    emit();
  }, 2000);
  bc.postMessage({ kind: "presence", pet: current });

  return {
    online: false,
    update: (pet) => {
      current = pet;
      bc.postMessage({ kind: "presence", pet });
    },
    send: (event) => bc.postMessage({ kind: "event", event }),
    leave: () => {
      clearInterval(timer);
      bc.postMessage({ kind: "leave", id: current.id });
      bc.close();
    },
  };
}
