"use client";

import { useState } from "react";
import { type Progress, SHOP, type ShopKind, levelOf } from "@/lib/progress";
import Win98Window from "./Win98Window";

const TABS: { kind: ShopKind; label: string }[] = [
  { kind: "hat", label: "Hats" },
  { kind: "glasses", label: "Glasses" },
  { kind: "wallpaper", label: "Wallpapers" },
];

interface Props {
  progress: Progress;
  onBuy: (id: string) => void;
  onWear: (kind: ShopKind, id: string | null) => void;
  onClose: () => void;
}

export default function Shop({ progress, onBuy, onWear, onClose }: Props) {
  const [tab, setTab] = useState<ShopKind>("hat");
  const level = levelOf(progress.xp);
  const worn = progress[tab];

  return (
    <Win98Window title="Bug Mart 2000 - Shop" className="w-[360px]" onClose={onClose}>
      <p>
        You have <b>🪙 {progress.coins}</b> coins. Level <b>{level}</b>.
      </p>
      <menu role="tablist" className="mt-2">
        {TABS.map((t) => (
          <li role="tab" key={t.kind} aria-selected={tab === t.kind}>
            <a href="#" onClick={(e) => (e.preventDefault(), setTab(t.kind))}>
              {t.label}
            </a>
          </li>
        ))}
      </menu>
      <div className="window" role="tabpanel">
        <div className="window-body flex flex-col gap-1">
          {SHOP.filter((i) => i.kind === tab).map((item) => {
            const owned = progress.owned.includes(item.id);
            const locked = level < item.level;
            return (
              <div key={item.id} className="flex items-center gap-2">
                <span className="w-8 text-center text-2xl">{item.icon}</span>
                <span className="flex-1">{item.name}</span>
                {owned ? (
                  <button className="!min-w-[90px]" onClick={() => onWear(tab, worn === item.id ? null : item.id)}>
                    {worn === item.id ? "Take off" : tab === "wallpaper" ? "Use" : "Wear"}
                  </button>
                ) : (
                  <button
                    className="!min-w-[90px]"
                    disabled={locked || progress.coins < item.price}
                    onClick={() => onBuy(item.id)}
                  >
                    {locked ? `🔒 Level ${item.level}` : `Buy 🪙${item.price}`}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </Win98Window>
  );
}
