"use client";

import { useEffect, useRef, useState } from "react";

interface Props {
  username?: string;
  petName?: string;
  onSignOut: () => void;
}

// The red power button in the top-right corner. It opens a small Log Off box
// instead of signing out straight away, so a stray click can't do it.
export default function PowerMenu({ username, petName, onSignOut }: Props) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);

  const close = () => {
    setOpen(false);
    button.current?.focus();
  };

  // Clicking anywhere else, or pressing Escape, closes it.
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      button.current?.focus();
    };
    window.addEventListener("pointerdown", away);
    window.addEventListener("keydown", esc);
    return () => {
      window.removeEventListener("pointerdown", away);
      window.removeEventListener("keydown", esc);
    };
  }, [open]);

  return (
    <div ref={box} className="relative mx-1 py-0.5">
      <button
        ref={button}
        className="power-btn"
        title="Sign out"
        aria-label="Sign out"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <path d="M8 2v6" />
          <path d="M4.5 4.5a5 5 0 1 0 7 0" />
        </svg>
      </button>
      {open && (
        <div role="dialog" aria-label="Sign out" className="window absolute right-0 top-full z-[1000] mt-1 w-60">
          <div className="title-bar">
            <div className="title-bar-text">Log Off MiLLeNNiuM BuG</div>
          </div>
          <div className="window-body">
            {username && (
              <p>
                Signed in as <b>{username}</b>.
              </p>
            )}
            {petName && <p>{petName} will be paused until you sign back in.</p>}
            <section className="field-row justify-end">
              <button autoFocus onClick={onSignOut}>
                Sign out
              </button>
              <button onClick={close}>Cancel</button>
            </section>
          </div>
        </div>
      )}
    </div>
  );
}
