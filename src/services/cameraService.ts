export async function openCamera(deviceId?: string) {
  if (!window.isSecureContext)
    throw new Error(
      "Camera access requires HTTPS or localhost. Open the secure website to continue.",
    );
  if (!navigator.mediaDevices?.getUserMedia)
    throw new Error(
      "This browser does not support webcam access. Try recent Chrome or Edge.",
    );
  return navigator.mediaDevices.getUserMedia({
    audio: false,
    video: {
      width: { ideal: 960 },
      height: { ideal: 720 },
      ...(deviceId
        ? { deviceId: { exact: deviceId } }
        : { facingMode: "user" }),
    },
  });
}
export function stopStream(stream: MediaStream | null) {
  stream?.getTracks().forEach((t) => t.stop());
}
export function cameraError(e: unknown) {
  const name = e instanceof DOMException ? e.name : "";
  return (
    (
      {
        NotAllowedError:
          "Camera permission was denied. Allow camera access in your browser’s site settings, then try again.",
        NotFoundError: "No camera found. Connect a webcam and try again.",
        NotReadableError:
          "Your camera is unavailable or in use by another app. Close other camera apps and retry.",
        OverconstrainedError:
          "That camera is no longer available. Choose another camera.",
      } as Record<string, string>
    )[name] ||
    (e instanceof Error ? e.message : "Unable to start. Please try again.")
  );
}
