// lib/scanner.ts
// The Soul Altar's camera: the rules behind components/BarcodeScanner.tsx,
// kept pure so they can be tested without a camera.
//
// Why it's more than ZXing's defaults: those asked for a 640x480 picture from
// whichever back lens the phone offered. Many Samsungs hand over a wide-angle
// lens that can't focus close, at a size too small to read the bars, so the
// camera "worked" but never read a code. And phones with no close-up lens
// can't focus near enough for small barcodes: zooming lets you hold the phone
// further back, where it can focus, with the bars still big.

// Which camera and zoom you last used. Kept per device, not in the save.
export const CAMERA_KEY = "codex_creatures_camera_v1";

export const ZOOM_STEPS = [1, 2, 3] as const;  // the zoom chip cycles through these
export const SCAN_EVERY_MS = 120;              // pause between reads (each read can take a while)
export const DECODE_MAX_WIDTH = 1280;          // frames are shrunk to this before ZXing reads them
export const VIEW_ASPECT = 4 / 3;              // the camera window on screen, width / height

// A sharp picture: ask for 1080p (phones give what they can).
export const VIDEO_SIZE = { width: { ideal: 1920 }, height: { ideal: 1080 } } as const;

// Shop barcodes (EAN, UPC) and the other 1D kinds on packaging and tickets.
// Names as the browser's built-in BarcodeDetector uses them.
export const BARCODE_FORMATS = ["ean_13", "ean_8", "upc_a", "upc_e", "code_128", "code_39", "code_93", "itf", "codabar"];

// The digits a read gives, if it's a barcode the altar takes (6 to 20 digits).
export function scannedDigits(text: string): string | null {
  const digits = text.replace(/\D/g, "");
  return digits.length >= 6 && digits.length <= 20 ? digits : null;
}

export type Camera = { deviceId: string; label: string };

// Android labels its cameras "camera2 0, facing back", "camera2 2, facing back"…
// The lowest-numbered back one is the main lens: the one that focuses close.
const ANDROID_LABEL = /camera2 (\d+).*facing back/i;

// The back cameras, front ones left out (unless that's all there is).
export function backCameras(cams: Camera[]): Camera[] {
  const back = cams.filter((c) => !/front|user|facing front/i.test(c.label));
  return back.length ? back : cams;
}

// Which camera to open: the one you picked last time, if it's still there;
// else Android's main back lens; else none (leave it to the browser, which
// picks well on iPhones).
export function pickCamera(cams: Camera[], saved?: string | null): string | undefined {
  if (saved && cams.some((c) => c.deviceId === saved)) return saved;
  let best: { id: string; n: number } | undefined;
  for (const c of cams) {
    const m = ANDROID_LABEL.exec(c.label);
    if (m && (!best || Number(m[1]) < best.n)) best = { id: c.deviceId, n: Number(m[1]) };
  }
  return best?.id;
}

// The next camera along, for the 📷 chip.
export function nextCamera(cams: Camera[], current: string | undefined): string | undefined {
  if (!cams.length) return undefined;
  const i = cams.findIndex((c) => c.deviceId === current);
  return cams[(i + 1) % cams.length].deviceId;
}

export function nextZoom(zoom: number): number {
  const i = ZOOM_STEPS.findIndex((z) => z === zoom);
  return ZOOM_STEPS[(i + 1) % ZOOM_STEPS.length];
}

// The part of the camera frame to read: what the window shows (the frame
// cropped to VIEW_ASPECT, centred), shrunk by the zoom when the camera can't
// zoom itself. `out` is the size to draw it at for reading.
export function cropRect(videoW: number, videoH: number, zoom: number, aspect = VIEW_ASPECT, maxW = DECODE_MAX_WIDTH) {
  let sw = videoW, sh = videoW / aspect;
  if (sh > videoH) { sh = videoH; sw = videoH * aspect; }
  sw /= zoom; sh /= zoom;
  const scale = Math.min(1, maxW / sw);
  return {
    sx: Math.round((videoW - sw) / 2), sy: Math.round((videoH - sh) / 2),
    sw: Math.round(sw), sh: Math.round(sh),
    outW: Math.round(sw * scale), outH: Math.round(sh * scale),
  };
}

// The zoom to ask a camera for that can zoom itself, kept in its range.
export function hardwareZoom(zoom: number, range: { min: number; max: number }): number {
  return Math.min(range.max, Math.max(range.min, zoom));
}

type Store = Pick<Storage, "getItem" | "setItem">;
export type CameraPrefs = { deviceId?: string; zoom: number };

export function readCameraPrefs(store: Store): CameraPrefs {
  try {
    const p = JSON.parse(store.getItem(CAMERA_KEY) ?? "{}");
    const zoom = ZOOM_STEPS.includes(p.zoom) ? p.zoom : 1;
    return { deviceId: typeof p.deviceId === "string" ? p.deviceId : undefined, zoom };
  } catch { return { zoom: 1 }; }
}

export function writeCameraPrefs(store: Store, prefs: CameraPrefs) {
  try { store.setItem(CAMERA_KEY, JSON.stringify(prefs)); } catch { /* storage full or blocked */ }
}
