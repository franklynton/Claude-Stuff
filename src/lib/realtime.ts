import type { RealtimeChannel } from "@supabase/supabase-js";
import type { LobbyEvent, LobbyMove, LobbyPet } from "@/types/lobby";
import { getSupabase } from "./supabase/client";

// Joins the shared lobby. With Supabase configured this is the `lobby` Realtime
// channel; without it, a BroadcastChannel stands in, so tabs on the same computer
// can still see each other for testing.
//
// Who is here comes from presence (identity only: id, name, pixel_data, stage).
// Where they are comes from broadcast (throttled, absolute targets). Keeping those
// apart matters: walking used to re-publish the whole presence payload on every
// step, and that churn is what dropped presence diffs and made bugs vanish.

export interface LobbyRoom {
  online: boolean; // true = Supabase (everyone), false = this computer only
  update: (me: LobbyPet) => void; // identity changed (new name, drawing, stage)
  move: (to: LobbyMove) => void; // walking somewhere
  send: (event: LobbyEvent) => void; // chat and visits
  leave: () => void;
}

export interface LobbyHandlers {
  onPeers: (peers: LobbyPet[]) => void;
  onMove: (move: LobbyMove) => void;
  onEvent: (event: LobbyEvent) => void;
}

const TOPIC = "lobby";
// At most one position per this long while walking, plus a final one once the
// clicks stop (see throttleMoves).
const MOVE_THROTTLE_MS = 100;
const RECONNECT_MS = 1500;

// Removing the previous `lobby` channel is async, and `supabase.channel()` hands
// back an existing channel for the same topic (ignoring our presence key) while
// `.on("presence", ...)` throws on one that has already joined. So each join waits
// for the previous one to finish leaving before making its own channel. Without
// this, closing and reopening the lobby - or React's double mount in dev - left
// this player attached to a dying channel, invisible to everyone else.
let channelFreed: Promise<unknown> = Promise.resolve();

export function joinLobby(me: LobbyPet, handlers: LobbyHandlers): LobbyRoom {
  const supabase = getSupabase();
  if (!supabase) return joinLocal(me, handlers);

  let identity = me;
  let channel: RealtimeChannel | null = null;
  let lastMove: LobbyMove | null = null; // re-sent on every (re)join
  const outbox: LobbyEvent[] = []; // chat sent before the channel existed
  let left = false;
  let retry: ReturnType<typeof setTimeout> | null = null;

  // Always rebuild the whole list from presence state. A missed join or leave then
  // can't leave a stale bug standing around or a real one missing.
  const syncPeers = () => {
    const state = channel?.presenceState<LobbyPet>() ?? {};
    handlers.onPeers(
      Object.values(state)
        // Several entries under one key means the same tab tracked twice (a
        // reconnect); the newest one wins, and neither removes the other.
        .map((entries) => entries[entries.length - 1])
        .filter((p) => p?.id && p.id !== identity.id)
        .map((p) => ({ id: p.id, userId: p.userId, name: p.name, pixel_data: p.pixel_data, stage: p.stage })),
    );
  };

  // Only while joined: the latest position is re-sent on every (re)join anyway.
  const post = (to: LobbyMove) => {
    if (channel?.state === "joined") channel.send({ type: "broadcast", event: "move", payload: to });
  };
  const moves = throttleMoves(post);

  // Tell everyone where we are: on joining, and whenever someone else joins (they
  // know nothing about our position, since presence no longer carries it).
  const announce = () => {
    if (lastMove) post(lastMove);
  };

  const connect = () => {
    channelFreed = channelFreed
      .catch(() => {})
      .then(() => {
        if (left) return;
        const ch = supabase.channel(TOPIC, { config: { presence: { key: identity.id } } });
        channel = ch;
        ch.on("presence", { event: "sync" }, syncPeers)
          .on("presence", { event: "join" }, () => {
            syncPeers();
            announce();
          })
          .on("presence", { event: "leave" }, syncPeers)
          .on("broadcast", { event: "move" }, ({ payload }) => {
            const to = payload as LobbyMove;
            if (to?.id && to.id !== identity.id) handlers.onMove(to);
          })
          .on("broadcast", { event: "lobby" }, ({ payload }) => handlers.onEvent(payload as LobbyEvent))
          .subscribe((status) => {
            if (channel !== ch) return; // a replaced channel still reporting in
            if (status === "SUBSCRIBED") {
              ch.track(identity);
              syncPeers();
              announce();
              outbox.splice(0).forEach((e) => ch.send({ type: "broadcast", event: "lobby", payload: e }));
            } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
              reconnect();
            }
          });
      })
      .catch(reconnect);
  };

  // Rejoin after an error or a dropped socket, re-tracking presence when we do -
  // otherwise this player stays gone from everyone else's lobby.
  const reconnect = () => {
    if (left || retry) return;
    retry = setTimeout(() => {
      retry = null;
      if (left) return;
      const old = channel;
      channel = null; // so the old channel's callbacks stop acting
      if (old) channelFreed = supabase.removeChannel(old);
      connect();
    }, RECONNECT_MS);
  };

  // A backgrounded tab's socket often dies quietly (its heartbeat timers get
  // throttled), so check on the way back. No channel means a join is on its way.
  const onVisible = () => {
    if (left || document.visibilityState !== "visible" || !channel) return;
    if (channel.state === "joined" && supabase.realtime.isConnected()) {
      channel.track(identity);
      announce();
    } else if (channel.state !== "joining") reconnect();
  };
  document.addEventListener("visibilitychange", onVisible);

  connect();

  return {
    online: true,
    update: (pet) => {
      identity = pet;
      if (channel?.state === "joined") channel.track(identity);
    },
    move: (to) => {
      lastMove = to;
      moves.push(to);
    },
    send: (event) => {
      if (channel) channel.send({ type: "broadcast", event: "lobby", payload: event });
      else outbox.push(event);
    },
    leave: () => {
      left = true;
      moves.cancel();
      if (retry) clearTimeout(retry);
      document.removeEventListener("visibilitychange", onVisible);
      const old = channel;
      channel = null;
      if (old) channelFreed = supabase.removeChannel(old);
    },
  };
}

// Sends the first position straight away, then at most one per MOVE_THROTTLE_MS,
// and always sends the last one after the movement stops - so a remote bug ends up
// exactly where its owner is, not somewhere from halfway through the clicking.
function throttleMoves(send: (to: LobbyMove) => void) {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let pending: LobbyMove | null = null;

  const wait = () => {
    timer = setTimeout(() => {
      timer = null;
      if (!pending) return;
      const next = pending;
      pending = null;
      send(next);
      wait();
    }, MOVE_THROTTLE_MS);
  };

  return {
    push: (to: LobbyMove) => {
      if (timer) {
        pending = to;
        return;
      }
      send(to);
      wait();
    },
    cancel: () => {
      if (timer) clearTimeout(timer);
      timer = null;
      pending = null;
    },
  };
}

// Players drop out if they haven't been heard from for this long (local mode only;
// with Supabase, only presence decides who has left). The heartbeat is identity
// only, so standing still never drops anyone.
const BEAT_MS = 2000;
const STALE_MS = 6000;

function joinLocal(me: LobbyPet, handlers: LobbyHandlers): LobbyRoom {
  const bc = new BroadcastChannel("millennium-bug-lobby");
  const peers = new Map<string, { pet: LobbyPet; seen: number }>();
  let identity = me;
  let lastMove: LobbyMove | null = null;
  const emit = () => handlers.onPeers([...peers.values()].map((p) => p.pet));

  bc.onmessage = ({ data }) => {
    if (data.kind === "presence") {
      // Two BroadcastChannels in the same document do hear each other, so a double
      // mount would otherwise show us a copy of ourselves.
      if (data.pet.id === identity.id) return;
      // A refreshed tab keeps its id, so it also counts as new when it says it just joined.
      const isNew = !peers.has(data.pet.id) || data.joined;
      peers.set(data.pet.id, { pet: data.pet, seen: Date.now() });
      if (isNew) {
        bc.postMessage({ kind: "presence", pet: identity }); // say hi back to newcomers
        if (lastMove) bc.postMessage({ kind: "move", move: lastMove }); // ...and where we are
      }
      emit();
    } else if (data.kind === "move") {
      if (data.move.id !== identity.id) handlers.onMove(data.move);
    } else if (data.kind === "leave") {
      peers.delete(data.id);
      emit();
    } else if (data.kind === "event") {
      handlers.onEvent(data.event);
    }
  };

  const moves = throttleMoves((to) => bc.postMessage({ kind: "move", move: to }));

  // Heartbeat, and forget tabs that were closed without saying goodbye.
  const timer = setInterval(() => {
    bc.postMessage({ kind: "presence", pet: identity });
    for (const [id, p] of peers) if (Date.now() - p.seen > STALE_MS) peers.delete(id);
    emit();
  }, BEAT_MS);
  bc.postMessage({ kind: "presence", pet: identity, joined: true });

  return {
    online: false,
    update: (pet) => {
      identity = pet;
      bc.postMessage({ kind: "presence", pet });
    },
    move: (to) => {
      lastMove = to;
      moves.push(to);
    },
    send: (event) => bc.postMessage({ kind: "event", event }),
    leave: () => {
      clearInterval(timer);
      moves.cancel();
      bc.postMessage({ kind: "leave", id: identity.id });
      bc.close();
    },
  };
}
