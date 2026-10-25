export const TRANSLATION_SCHEMA = "isl-landmarks-v1" as const;
export type FeatureFrame = {
  timestamp: number;
  points: [number, number, number][];
  mask: boolean[];
};
export type SequenceRequest = {
  schema_version: typeof TRANSLATION_SCHEMA;
  session_id: string;
  sequence_id: number;
  timestamps_ms: number[];
  landmarks: [number, number, number][][];
  validity_mask: boolean[][];
  is_final: boolean;
};
export type TranslationResult = {
  sequence_id: number;
  status: "interim" | "final" | "insufficient_tracking" | "unknown";
  translation: string;
  glosses: string[];
  is_final: boolean;
  confidence: null;
};
export type TranslationModelInfo = {
  ready: boolean;
  reason: string | null;
  schema_version: string;
  model_version: string | null;
  preprocessing: string;
  max_frames: number;
  max_utterance_ms: number;
  sample_hz: number;
  input_modality: string;
};
