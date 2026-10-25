"use client";

import { useState } from "react";
import { loadHideHelp, saveHideHelp } from "@/lib/storage";
import Win98Window from "./Win98Window";

// The "How to play" window shown after logging in (and from the Start menu).
export default function HowToPlay({ onClose }: { onClose: () => void }) {
  const [hide, setHide] = useState(loadHideHelp);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <Win98Window title="How to play - README.TXT" className="max-h-[90vh] w-[520px] overflow-y-auto" onClose={onClose}>
        <h4 className="!mt-0 text-base font-bold">🐛 Welcome to Millennium Bug!</h4>
        <p>
          Your pet is a <b>millennium bug</b> that survived the year 2000. Look after it, teach it to talk, and watch it grow
          up. Forget about it and it starts to <b>glitch</b>.
        </p>

        <fieldset className="my-2">
          <legend>Keep your bug happy</legend>
          <ul className="list-disc pl-5">
            <li>
              <b>Living room:</b> click your bug to give it love.
            </li>
            <li>
              <b>Kitchen:</b> drag food onto it when it&rsquo;s hungry.
            </li>
            <li>
              <b>Bathroom:</b> scrub it with the soap to keep it clean.
            </li>
            <li>
              <b>Bedroom:</b> turn the lamp off so it can sleep.
            </li>
            <li>
              <b>Playroom:</b> throw the ball for fun, or play <b>Coin Catcher</b> and <b>Snake</b> to earn coins.
            </li>
            <li>
              <b>Lab:</b> potions heal your bug or give it energy.
            </li>
          </ul>
        </fieldset>

        <fieldset className="my-2">
          <legend>⚠️ The rules</legend>
          <ul className="list-disc pl-5">
            <li>The bars drop over time, even while you&rsquo;re away.</li>
            <li>
              If hunger, health or mood falls below 30, the <b>Glitch</b> bar climbs. Glitchy bugs scramble their words,
              break the clock and corrupt the screen.
            </li>
            <li>Keep every bar above 60 and the glitch heals quickly.</li>
            <li>Food and potions cost coins, so play the minigames to earn more.</li>
          </ul>
        </fieldset>

        <fieldset className="my-2">
          <legend>Grow it up</legend>
          <ul className="list-disc pl-5">
            <li>
              Chat with your bug in the AIM window. Tell it your name and teach it words, and it will remember them.
            </li>
            <li>
              It starts as a <b>Toddler</b> that can barely talk. Time and chatting fill its age bar, and once its skills
              level up it can grow into a Kid, Teen and Adult.
            </li>
            <li>
              Use the <b>Shop</b> for hats, glasses and wallpapers. Drag a hat or glasses to move it on your bug.
            </li>
            <li>
              Use <b>Edit look</b> to draw your own bug, and <b>Lobby</b> to meet other people&rsquo;s bugs online.
            </li>
          </ul>
        </fieldset>

        <div className="field-row mt-3 justify-between">
          <span>
            <input
              id="hide-help"
              type="checkbox"
              checked={hide}
              onChange={(e) => {
                setHide(e.target.checked);
                saveHideHelp(e.target.checked);
              }}
            />
            <label htmlFor="hide-help">Don&rsquo;t show this again</label>
          </span>
          <button onClick={onClose}>OK, let&rsquo;s play!</button>
        </div>
      </Win98Window>
    </div>
  );
}
