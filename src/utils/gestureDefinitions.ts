import type { GestureDefinition } from "../types/gesture";
export const gestures: GestureDefinition[] = [
  {
    id: "palm",
    name: "Open palm",
    emoji: "🖐️",
    meaning: "Hello / Stop",
    message: "Hello! 👋",
    instruction:
      "Face your palm toward the camera and extend all five fingers.",
  },
  {
    id: "up",
    name: "Thumbs up",
    emoji: "👍",
    meaning: "Approval",
    message: "Good job! 👍",
    instruction:
      "Close your fingers into your palm and point your thumb upward.",
  },
  {
    id: "down",
    name: "Thumbs down",
    emoji: "👎",
    meaning: "Disapproval",
    message: "Not approved 👎",
    instruction:
      "Close your fingers and point your extended thumb toward the floor.",
  },
  {
    id: "fist",
    name: "Closed fist",
    emoji: "✊",
    meaning: "Stop / Pause",
    message: "Stop ✊",
    instruction:
      "Curl all five fingers into a relaxed fist, facing the camera.",
  },
  {
    id: "peace",
    name: "Peace sign",
    emoji: "✌️",
    meaning: "Peace / Victory",
    message: "Peace ✌️",
    instruction:
      "Extend and separate your index and middle fingers. Fold the other fingers.",
  },
  {
    id: "point",
    name: "Pointing",
    emoji: "☝️",
    meaning: "Point / Select",
    message: "Pointing 👉",
    instruction:
      "Extend only your index finger. Keep your other fingers and thumb folded.",
  },
  {
    id: "ok",
    name: "OK sign",
    emoji: "👌",
    meaning: "Okay / Perfect",
    message: "Everything is OK 👌",
    instruction:
      "Touch your thumb tip to your index tip to form a circle. Extend the other three fingers.",
  },
  {
    id: "rock",
    name: "Rock sign",
    emoji: "🤘",
    meaning: "Rock on",
    message: "Rock on! 🤘",
    instruction:
      "Extend your index and little fingers. Fold your middle and ring fingers.",
  },
  {
    id: "three",
    name: "Three fingers",
    emoji: "🤟",
    meaning: "Three",
    message: "Number 3 ☝️",
    instruction:
      "Extend your index, middle, and ring fingers. Fold your thumb and little finger.",
  },
];
export const byId = Object.fromEntries(
  gestures.map((g) => [g.id, g]),
) as Record<string, GestureDefinition>;
