// "16:02"-style time for chat messages, matching the taskbar clock.
export function clockTime(at: number): string {
  return new Date(at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}
