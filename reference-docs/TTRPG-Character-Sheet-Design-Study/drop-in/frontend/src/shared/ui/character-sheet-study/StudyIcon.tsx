import type { ReactElement } from "react";

export type StudyIconName =
  | "heart"
  | "mana"
  | "action"
  | "reaction"
  | "dice"
  | "search"
  | "star"
  | "status"
  | "minus"
  | "plus"
  | "close";

export function StudyIcon({ name, size = 18 }: { name: StudyIconName; size?: number }): ReactElement {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true
  };

  switch (name) {
    case "heart":
      return <svg {...common}><path d="M20.8 4.6a5.4 5.4 0 0 0-7.6 0L12 5.8l-1.2-1.2a5.4 5.4 0 1 0-7.6 7.6L12 21l8.8-8.8a5.4 5.4 0 0 0 0-7.6Z" /></svg>;
    case "mana":
      return <svg {...common}><path d="M12 2C8.2 7.2 5.5 10.2 5.5 14a6.5 6.5 0 0 0 13 0C18.5 10.2 15.8 7.2 12 2Z" /><path d="M9 15.5c.7 1.4 1.7 2.1 3 2.1" /></svg>;
    case "action":
      return <svg {...common}><path d="m13 2-8 12h7l-1 8 8-12h-7l1-8Z" /></svg>;
    case "reaction":
      return <svg {...common}><path d="M20 7v5h-5" /><path d="M4 17v-5h5" /><path d="M6.1 8.2A7 7 0 0 1 18.7 10" /><path d="M17.9 15.8A7 7 0 0 1 5.3 14" /></svg>;
    case "dice":
      return <svg {...common}><path d="m12 2 8.7 5v10L12 22l-8.7-5V7L12 2Z" /><path d="m3.3 7 8.7 5 8.7-5M12 12v10" /><circle cx="12" cy="7" r="1" fill="currentColor" stroke="none" /></svg>;
    case "search":
      return <svg {...common}><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></svg>;
    case "star":
      return <svg {...common}><path d="m12 2.8 2.8 5.7 6.3.9-4.6 4.4 1.1 6.3-5.6-3-5.6 3 1.1-6.3-4.6-4.4 6.3-.9L12 2.8Z" /></svg>;
    case "minus":
      return <svg {...common}><path d="M5 12h14" /></svg>;
    case "plus":
      return <svg {...common}><path d="M12 5v14M5 12h14" /></svg>;
    case "close":
      return <svg {...common}><path d="m6 6 12 12M18 6 6 18" /></svg>;
    case "status":
    default:
      return <svg {...common}><circle cx="12" cy="12" r="8" /><path d="M12 8v4l2.5 2.5" /></svg>;
  }
}
