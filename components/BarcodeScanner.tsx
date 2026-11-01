"use client";

import { useEffect, useRef, useState } from "react";
import { BrowserMultiFormatOneDReader } from "@zxing/browser";
import { DecodeHintType } from "@zxing/library";
import {
  BARCODE_FORMATS, SCAN_EVERY_MS, VIDEO_SIZE, VIEW_ASPECT, backCameras, cropRect, hardwareZoom,
  nextCamera, nextZoom, pickCamera, readCameraPrefs, scannedDigits, writeCameraPrefs, type Camera,
} from "@/lib/scanner";

// The Soul Altar's camera (rules in lib/scanner.ts). Opens the main back
// lens at 1080p with continuous focus, and reads with the browser's own
// barcode reader where there is one (Android Chrome: far better than ZXing),
// else ZXing. Under the picture: zoom (for phones that can't focus close:
// hold back and zoom in), the next camera, and the torch where there is one.
// Mounted while scanning; calls onCode once with the digits read.

type Detector = { detect: (src: CanvasImageSource) => Promise<{ rawValue: string }[]> };
type Caps = MediaTrackCapabilities & { zoom?: { min: number; max: number }; torch?: boolean; focusMode?: string[] };

async function nativeDetector(): Promise<Detector | null> {
  const BD = (globalThis as unknown as { BarcodeDetector?: { new (o: { formats: string[] }): Detector; getSupportedFormats(): Promise<string[]> } }).BarcodeDetector;
  if (!BD) return null;
  try {
    const have = await BD.getSupportedFormats();
    const formats = BARCODE_FORMATS.filter((f) => have.includes(f));
    return formats.length ? new BD({ formats }) : null;
  } catch { return null; }
}

function zxingReader() {
  const hints = new Map<DecodeHintType, unknown>([[DecodeHintType.TRY_HARDER, true]]);
  return new BrowserMultiFormatOneDReader(hints);
}

const CHIP: React.CSSProperties = { flex: 1, minHeight: 44 };

export default function BarcodeScanner({ onCode }: { onCode: (digits: string) => void }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  // Your last camera and zoom. (Only mounted once you tap Scan, so never on the server.)
  const [prefs] = useState(() => readCameraPrefs(window.localStorage));
  const [status, setStatus] = useState("Starting camera...");
  const [zoom, setZoom] = useState(prefs.zoom);
  const [cams, setCams] = useState<Camera[]>([]);
  const [camId, setCamId] = useState(prefs.deviceId ?? ""); // "": let the browser pick
  const [torch, setTorch] = useState<boolean | null>(null); // null: this camera has none
  const [ready, setReady] = useState(false);
  const [currentId, setCurrentId] = useState<string | undefined>(undefined); // the camera open now
  const hwZoom = useRef<{ min: number; max: number } | null>(null);
  const zoomRef = useRef(prefs.zoom);
  const digitalRef = useRef(1);
  const trackRef = useRef<MediaStreamTrack | null>(null);
  const onCodeRef = useRef(onCode);
  useEffect(() => { onCodeRef.current = onCode; }, [onCode]);
  const [digital, setDigital] = useState(1); // the zoom the camera can't do itself, done by cropping

  // Zoom: the camera's own where it has one (sharper), the rest by cropping.
  async function applyZoom(z: number) {
    const track = trackRef.current, range = hwZoom.current;
    let hw = 1;
    if (track && range) {
      hw = hardwareZoom(z, range);
      try { await track.applyConstraints({ advanced: [{ zoom: hw } as MediaTrackConstraintSet] }); } catch { hw = 1; }
    }
    digitalRef.current = z / hw;
    setDigital(z / hw);
  }

  // Open the camera (again when you switch), then read frames until a code turns up.
  useEffect(() => {
    let stopped = false, timer = 0;
    let stream: MediaStream | null = null;
    const open = async (deviceId?: string) => {
      const video: MediaTrackConstraints = { ...VIDEO_SIZE, ...(deviceId ? { deviceId: { exact: deviceId } } : { facingMode: { ideal: "environment" } }) };
      try { return await navigator.mediaDevices.getUserMedia({ video, audio: false }); }
      catch (e) {
        if (!deviceId || (e as Error).name === "NotAllowedError") throw e;
        return navigator.mediaDevices.getUserMedia({ video: { ...VIDEO_SIZE, facingMode: { ideal: "environment" } }, audio: false });
      }
    };

    (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) { setStatus("No camera here (the page needs https)."); return; }
        stream = await open(camId || undefined);
        if (stopped) return;
        // Labels show once the camera's allowed. First time on Android: switch
        // to the main back lens if the browser opened another one.
        const all = (await navigator.mediaDevices.enumerateDevices())
          .filter((d) => d.kind === "videoinput").map((d) => ({ deviceId: d.deviceId, label: d.label }));
        const list = backCameras(all);
        if (stopped) return;
        setCams(list);
        const current = stream.getVideoTracks()[0]?.getSettings().deviceId;
        if (!camId) {
          const best = pickCamera(list);
          if (best && best !== current) { stream.getTracks().forEach((t) => t.stop()); stream = null; setCamId(best); return; }
        }
        await start(stream, current);
      } catch (e) {
        if (stopped) return;
        const name = (e as Error).name;
        setStatus(name === "NotAllowedError" ? "Camera blocked: allow it in your browser's settings." : "Camera error: try 📷 for another camera.");
      }
    })();

    async function start(s: MediaStream, current: string | undefined) {
      const track = s.getVideoTracks()[0];
      trackRef.current = track;
      setCurrentId(current);
      const caps: Caps = typeof track.getCapabilities === "function" ? track.getCapabilities() as Caps : {};
      if (caps.focusMode?.includes("continuous")) {
        try { await track.applyConstraints({ advanced: [{ focusMode: "continuous" } as MediaTrackConstraintSet] }); } catch { /* keep its own focus */ }
      }
      hwZoom.current = caps.zoom && caps.zoom.max > caps.zoom.min ? { min: caps.zoom.min, max: caps.zoom.max } : null;
      setTorch(caps.torch ? false : null);
      writeCameraPrefs(window.localStorage, { deviceId: current, zoom: zoomRef.current });
      await applyZoom(zoomRef.current);

      const v = videoRef.current!;
      v.srcObject = s;
      await v.play().catch(() => {});
      if (stopped) return;
      setReady(true);
      setStatus("Hold the barcode flat in the window. Blurry? Step back and zoom in.");

      const native = await nativeDetector();
      const zx = native ? null : zxingReader();
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d", { willReadFrequently: true })!;

      const tick = async () => {
        if (stopped) return;
        if (v.videoWidth && v.readyState >= 2) {
          const r = cropRect(v.videoWidth, v.videoHeight, digitalRef.current);
          canvas.width = r.outW; canvas.height = r.outH;
          ctx.drawImage(v, r.sx, r.sy, r.sw, r.sh, 0, 0, r.outW, r.outH);
          let text: string | null = null;
          try {
            if (native) text = (await native.detect(canvas))[0]?.rawValue ?? null;
            else text = zx!.decodeFromCanvas(canvas).getText();
          } catch { /* nothing read this frame */ }
          const digits = text ? scannedDigits(text) : null;
          if (digits && !stopped) { stopped = true; onCodeRef.current(digits); return; }
        }
        timer = window.setTimeout(tick, SCAN_EVERY_MS);
      };
      tick();
    }

    return () => {
      stopped = true;
      window.clearTimeout(timer);
      stream?.getTracks().forEach((t) => t.stop());
      trackRef.current = null;
    };
  }, [camId]);

  function cycleZoom() {
    const z = nextZoom(zoom);
    zoomRef.current = z;
    setZoom(z);
    applyZoom(z);
    writeCameraPrefs(window.localStorage, { deviceId: currentId, zoom: z });
  }

  async function toggleTorch() {
    const track = trackRef.current;
    if (!track || torch === null) return;
    try { await track.applyConstraints({ advanced: [{ torch: !torch } as MediaTrackConstraintSet] }); setTorch(!torch); } catch { /* no torch after all */ }
  }

  const camIndex = cams.findIndex((c) => c.deviceId === currentId);

  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ fontSize: 13, opacity: 0.6, textAlign: "center", minHeight: "2.6em" }}>{status}</div>
      <div style={{ position: "relative", aspectRatio: String(VIEW_ASPECT), overflow: "hidden", borderRadius: 12, border: "1px solid rgba(255,255,255,0.15)", background: "#000" }}>
        <video ref={videoRef} muted playsInline
          style={{ width: "100%", height: "100%", objectFit: "cover", transform: `scale(${digital})`, visibility: ready ? "visible" : "hidden" }} />
        {/* Where to put the bars. */}
        <div style={{ position: "absolute", left: "10%", right: "10%", top: "50%", height: 2, background: "rgba(255,80,80,0.7)", boxShadow: "0 0 6px rgba(255,80,80,0.8)" }} />
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
        <button className="chip" style={CHIP} onClick={cycleZoom}>🔍 {zoom}×</button>
        <button className="chip" style={{ ...CHIP, visibility: cams.length > 1 ? "visible" : "hidden" }}
          onClick={() => { setReady(false); setCamId(nextCamera(cams, currentId) ?? ""); }}>
          📷 {camIndex >= 0 ? camIndex + 1 : 1}/{cams.length}
        </button>
        <button className="chip" style={{ ...CHIP, visibility: torch === null ? "hidden" : "visible" }} data-active={!!torch} onClick={toggleTorch}>🔦</button>
      </div>
    </div>
  );
}
