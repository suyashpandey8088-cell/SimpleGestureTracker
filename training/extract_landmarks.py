"""Extract raw camera-space features using the same Tasks models as the browser.

Downloads are explicit/user-managed. Does not fetch copyrighted videos.
python -m training.extract_landmarks video.mp4 features.npz --hand-model ... --pose-model ...
"""

import argparse
from pathlib import Path
import cv2
import mediapipe as mp
import numpy as np
from mediapipe.tasks import python
from mediapipe.tasks.python import vision


def extract(video, output, hand_model, pose_model):
    cap = cv2.VideoCapture(str(video))
    if not cap.isOpened():
        raise ValueError("Cannot decode video")
    fps = cap.get(cv2.CAP_PROP_FPS)
    if not np.isfinite(fps) or fps <= 0:
        raise ValueError("Video must have a valid frame rate")
    hand_options = vision.HandLandmarkerOptions(
        base_options=python.BaseOptions(model_asset_path=str(hand_model)),
        running_mode=vision.RunningMode.VIDEO,
        num_hands=2,
        min_hand_detection_confidence=0.6,
        min_hand_presence_confidence=0.6,
        min_tracking_confidence=0.6,
    )
    pose_options = vision.PoseLandmarkerOptions(
        base_options=python.BaseOptions(model_asset_path=str(pose_model)),
        running_mode=vision.RunningMode.VIDEO,
        num_poses=1,
        min_pose_detection_confidence=0.6,
        min_pose_presence_confidence=0.6,
        min_tracking_confidence=0.6,
    )
    frames = []
    masks = []
    timestamps = []
    index = 0
    last = -1
    try:
        with (
            vision.HandLandmarker.create_from_options(hand_options) as hands,
            vision.PoseLandmarker.create_from_options(pose_options) as pose,
        ):
            while True:
                ok, bgr = cap.read()
                if not ok:
                    break
                timestamp = round(index * 1000 / fps)
                index += 1
                if timestamp - last < 100:
                    continue
                last = timestamp
                h, w = bgr.shape[:2]
                aspect = w / h
                image = mp.Image(
                    image_format=mp.ImageFormat.SRGB,
                    data=cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB),
                )
                hr = hands.detect_for_video(image, timestamp)
                pr = pose.detect_for_video(image, timestamp)
                coords = np.zeros((75, 3), np.float32)
                valid = np.zeros(75, bool)
                scores = {}
                for points, categories in zip(hr.hand_landmarks, hr.handedness):
                    category = categories[0]
                    slot = 0 if category.category_name == "Left" else 21
                    if scores.get(slot, -1) >= category.score:
                        continue
                    scores[slot] = category.score
                    for k, p in enumerate(points):
                        coords[slot + k] = [p.x * aspect, p.y, p.z * aspect]
                        valid[slot + k] = True
                if pr.pose_landmarks:
                    for k, p in enumerate(pr.pose_landmarks[0]):
                        coords[42 + k] = [p.x * aspect, p.y, p.z * aspect]
                        valid[42 + k] = p.visibility >= 0.5
                frames.append(coords)
                masks.append(valid)
                timestamps.append(timestamp)
    finally:
        cap.release()
    if len(frames) < 3:
        raise ValueError("Too few decodable frames")
    Path(output).parent.mkdir(parents=True, exist_ok=True)
    np.savez_compressed(
        output,
        landmarks=np.array(frames),
        validity_mask=np.array(masks),
        timestamps_ms=np.array(timestamps),
        schema_version="isl-landmarks-v1",
    )


if __name__ == "__main__":
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("video")
    p.add_argument("output")
    p.add_argument("--hand-model", required=True)
    p.add_argument("--pose-model", required=True)
    a = p.parse_args()
    extract(a.video, a.output, a.hand_model, a.pose_model)
