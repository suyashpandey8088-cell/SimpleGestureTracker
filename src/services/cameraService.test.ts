import { afterEach, describe, expect, it, vi } from "vitest";
import { cameraError, openCamera, stopStream } from "./cameraService";
afterEach(() => vi.unstubAllGlobals());
describe("camera lifecycle services", () => {
  it("rejects insecure contexts without requesting permission", async () => {
    vi.stubGlobal("window", { isSecureContext: false });
    await expect(openCamera()).rejects.toThrow("HTTPS");
  });
  it("explains unsupported browsers", async () => {
    vi.stubGlobal("window", { isSecureContext: true });
    vi.stubGlobal("navigator", {});
    await expect(openCamera()).rejects.toThrow("does not support");
  });
  it("requests video only and the chosen device", async () => {
    vi.stubGlobal("window", { isSecureContext: true });
    const getUserMedia = vi.fn().mockResolvedValue({});
    vi.stubGlobal("navigator", { mediaDevices: { getUserMedia } });
    await openCamera("device-2");
    expect(getUserMedia).toHaveBeenCalledWith({
      audio: false,
      video: {
        width: { ideal: 960 },
        height: { ideal: 720 },
        deviceId: { exact: "device-2" },
      },
    });
  });
  it("stops every track and safely handles no stream", () => {
    const a = vi.fn(),
      b = vi.fn();
    stopStream({
      getTracks: () => [{ stop: a }, { stop: b }],
    } as unknown as MediaStream);
    expect(a).toHaveBeenCalledOnce();
    expect(b).toHaveBeenCalledOnce();
    expect(() => stopStream(null)).not.toThrow();
  });
  it("provides actionable permission and unavailable-camera messages", () => {
    expect(
      cameraError(new DOMException("denied", "NotAllowedError")),
    ).toContain("site settings");
    expect(cameraError(new DOMException("none", "NotFoundError"))).toContain(
      "No camera",
    );
    expect(cameraError(new DOMException("busy", "NotReadableError"))).toContain(
      "another app",
    );
  });
});
