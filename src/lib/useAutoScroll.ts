import { useEffect, useRef } from "react";

// Keeps a scrolling chat box pinned to its newest message whenever `trigger` changes.
export function useAutoScroll<T extends HTMLElement>(trigger: unknown) {
  const ref = useRef<T>(null);
  useEffect(() => {
    const box = ref.current;
    if (box) box.scrollTop = box.scrollHeight;
  }, [trigger]);
  return ref;
}
