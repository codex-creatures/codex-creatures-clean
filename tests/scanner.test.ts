import { describe, it, expect } from "vitest";
import {
  CAMERA_KEY, backCameras, cropRect, hardwareZoom, nextCamera, nextZoom, pickCamera,
  readCameraPrefs, scannedDigits, writeCameraPrefs,
} from "../lib/scanner";

const samsung = [
  { deviceId: "f", label: "camera2 1, facing front" },
  { deviceId: "wide", label: "camera2 2, facing back" },
  { deviceId: "main", label: "camera2 0, facing back" },
  { deviceId: "tele", label: "camera2 3, facing back" },
];
const iphone = [
  { deviceId: "a", label: "Front Camera" },
  { deviceId: "b", label: "Back Triple Camera" },
  { deviceId: "c", label: "Back Ultra Wide Camera" },
];

function memStore() {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { m.set(k, v); } };
}

describe("scanner", () => {
  it("takes 6 to 20 digits, ignoring anything else in the read", () => {
    expect(scannedDigits("5012345678900")).toBe("5012345678900");
    expect(scannedDigits("ABC-123456")).toBe("123456");
    expect(scannedDigits("12345")).toBeNull();
    expect(scannedDigits("1".repeat(21))).toBeNull();
  });

  it("leaves out front cameras", () => {
    expect(backCameras(samsung).map((c) => c.deviceId)).toEqual(["wide", "main", "tele"]);
    expect(backCameras(iphone).map((c) => c.deviceId)).toEqual(["b", "c"]);
    expect(backCameras([{ deviceId: "x", label: "Front Camera" }])).toHaveLength(1);
  });

  it("picks Android's main back lens, and leaves iPhones to the browser", () => {
    expect(pickCamera(backCameras(samsung))).toBe("main");
    expect(pickCamera(backCameras(iphone))).toBeUndefined();
  });

  it("keeps the camera you picked while it's there", () => {
    expect(pickCamera(samsung, "tele")).toBe("tele");
    expect(pickCamera(samsung, "gone")).toBe("main");
  });

  it("cycles cameras and zooms", () => {
    const back = backCameras(samsung);
    expect(nextCamera(back, "tele")).toBe("wide");
    expect(nextCamera(back, undefined)).toBe("wide");
    expect(nextZoom(1)).toBe(2);
    expect(nextZoom(3)).toBe(1);
  });

  it("reads what the window shows, zoomed and shrunk to read", () => {
    // A landscape 1920x1080 frame in a 4:3 window: the middle 1440x1080.
    expect(cropRect(1920, 1080, 1)).toEqual({ sx: 240, sy: 0, sw: 1440, sh: 1080, outW: 1280, outH: 960 });
    // 2x: the middle quarter of that, read at full size.
    expect(cropRect(1920, 1080, 2)).toEqual({ sx: 600, sy: 270, sw: 720, sh: 540, outW: 720, outH: 540 });
    // A portrait frame (phones held upright): a band across the middle.
    const r = cropRect(1080, 1920, 1);
    expect(r.sw).toBe(1080);
    expect(r.sh).toBe(810);
    expect(r.sy).toBe(555);
  });

  it("keeps a camera's own zoom in its range", () => {
    expect(hardwareZoom(3, { min: 1, max: 8 })).toBe(3);
    expect(hardwareZoom(3, { min: 1, max: 2 })).toBe(2);
    expect(hardwareZoom(1, { min: 1.5, max: 4 })).toBe(1.5);
  });

  it("remembers camera and zoom per device, and shrugs off junk", () => {
    const s = memStore();
    expect(readCameraPrefs(s)).toEqual({ deviceId: undefined, zoom: 1 });
    writeCameraPrefs(s, { deviceId: "main", zoom: 2 });
    expect(readCameraPrefs(s)).toEqual({ deviceId: "main", zoom: 2 });
    s.setItem(CAMERA_KEY, "{not json");
    expect(readCameraPrefs(s)).toEqual({ zoom: 1 });
    s.setItem(CAMERA_KEY, JSON.stringify({ zoom: 7 }));
    expect(readCameraPrefs(s).zoom).toBe(1);
  });
});
