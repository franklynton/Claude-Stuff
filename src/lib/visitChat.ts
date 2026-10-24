import type { Brain } from "./brain";
import { topLikes } from "./brain";
import type { LobbyPet, VisitLine } from "@/types/lobby";

// Writes a short conversation between your bug and the bug you visit. The visitor
// writes it and broadcasts it, so both owners see the same chat (see CLAUDE.md).
// Pre-written lines for now; it can go through /api/chat once real AI is on.

const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];

function line(stage: number, toddler: string[], older: string[]) {
  return pick(stage === 0 ? toddler : older);
}

export function makeVisit(myName: string, myStage: number, brain: Brain, them: LobbyPet): VisitLine[] {
  const like = topLikes(brain, 1)[0];
  const t = them.name;
  return [
    { speaker: myName, text: line(myStage, [`Hi ${t}! Me ${myName}!`, `${t}! Fwiend?`], [`Yo ${t}! A/S/L? Jk, I'm ${myName} :)`, `Hey ${t}, wanna be buddies? Add me to your Top 8!`]) },
    { speaker: t, text: line(them.stage, ["Hi hi! Bzzt!", "Fwiend! Yay!"], [`OMG hi ${myName}! You're da bomb!`, "Sup! Did you also survive Y2K? Respect."]) },
    {
      speaker: myName,
      text: like
        ? line(myStage, [`Me like ${like}!`], [`Have you tried ${like}? It's totally all that.`])
        : line(myStage, ["Play? Play?"], ["Wanna race to the arcade? Loser has to listen to dial-up noises."]),
    },
    { speaker: t, text: line(them.stage, ["Yay! Bye bye!", "Hehe! Bzzt!"], ["Whatever, that's so fetch. BRB, gotta defrag. Bye!", "Sweet! Let's hang out again later. Peace out!"]) },
  ];
}
