import { FilesetResolver, HandLandmarker } from "@mediapipe/tasks-vision";
export async function createLandmarker() {
  const files = await FilesetResolver.forVisionTasks("/wasm");
  const options = {
    baseOptions: {
      modelAssetPath:
        "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
    },
    runningMode: "VIDEO" as const,
    numHands: 2,
    minHandDetectionConfidence: 0.6,
    minHandPresenceConfidence: 0.6,
    minTrackingConfidence: 0.6,
  };
  try {
    return await HandLandmarker.createFromOptions(files, options);
  } catch {
    throw new Error(
      "The hand-tracking model could not load. Check your internet connection, allow storage.googleapis.com, and try again.",
    );
  }
}
export const connections = [
  [0, 1],
  [1, 2],
  [2, 3],
  [3, 4],
  [0, 5],
  [5, 6],
  [6, 7],
  [7, 8],
  [5, 9],
  [9, 10],
  [10, 11],
  [11, 12],
  [9, 13],
  [13, 14],
  [14, 15],
  [15, 16],
  [13, 17],
  [0, 17],
  [17, 18],
  [18, 19],
  [19, 20],
];
