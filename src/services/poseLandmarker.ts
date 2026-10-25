import { FilesetResolver, PoseLandmarker } from "@mediapipe/tasks-vision";
export async function createPoseLandmarker() {
  const files = await FilesetResolver.forVisionTasks("/wasm");
  return PoseLandmarker.createFromOptions(files, {
    baseOptions: {
      modelAssetPath:
        "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task",
    },
    runningMode: "VIDEO",
    numPoses: 1,
    minPoseDetectionConfidence: 0.6,
    minPosePresenceConfidence: 0.6,
    minTrackingConfidence: 0.6,
  });
}
