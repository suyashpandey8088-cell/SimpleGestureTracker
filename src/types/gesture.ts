export type GestureId =
  "palm" | "up" | "down" | "fist" | "peace" | "point" | "ok" | "rock" | "three";
export type Point = { x: number; y: number; z: number };
export type Prediction = { id: GestureId; score: number };
export type HistoryEntry = Prediction & { time: number };
export type GestureDefinition = {
  id: GestureId;
  name: string;
  emoji: string;
  meaning: string;
  message: string;
  instruction: string;
};
