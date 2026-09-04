import { useEffect, useRef, useState } from "react";

const BURST_FRAME_COUNT = 7;
const BURST_DURATION_MS = 3000;

function randomChallengeCode() {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

/**
 * Renders a live camera viewfinder, burns a one-time freshness code +
 * today's date into every captured frame (defeats "old real photo, real
 * GPS" replay), and captures a burst of frames while the farmer pans
 * across the plot (feeds the server-side parallax check).
 */
export default function LiveCapture({ onCaptured, onError }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const [challengeCode] = useState(randomChallengeCode);
  const [cameraReady, setCameraReady] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function startCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 960 } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        setCameraReady(true);
      } catch (err) {
        onError?.(err.message || "Camera access was denied or unavailable.");
      }
    }
    startCamera();
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function drawFrameWithOverlay() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Burn the freshness code + date into the pixel data itself, so it
    // survives even if EXIF/metadata is stripped or forged downstream.
    const label = `PlotProof · ${challengeCode} · ${new Date().toISOString().slice(0, 16).replace("T", " ")}`;
    const fontSize = Math.max(16, Math.round(canvas.width / 32));
    ctx.font = `600 ${fontSize}px Inter, sans-serif`;
    const textWidth = ctx.measureText(label).width;
    const pad = fontSize * 0.6;
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.fillRect(0, canvas.height - fontSize - pad * 2, textWidth + pad * 2, fontSize + pad * 2);
    ctx.fillStyle = "#ffffff";
    ctx.fillText(label, pad, canvas.height - pad);

    return new Promise((resolve, reject) => canvas.toBlob(
      (blob) => blob ? resolve(blob) : reject(new Error("Could not encode the camera frame.")),
      "image/jpeg",
      0.92
    ));
  }

  async function startPanCapture() {
    setCapturing(true);
    setProgress(0);
    try {
      const frames = [];
      const interval = BURST_DURATION_MS / (BURST_FRAME_COUNT - 1);

      for (let i = 0; i < BURST_FRAME_COUNT; i++) {
        const blob = await drawFrameWithOverlay();
        frames.push(blob);
        setProgress((i + 1) / BURST_FRAME_COUNT);
        if (i < BURST_FRAME_COUNT - 1) {
          await new Promise((r) => setTimeout(r, interval));
        }
      }

      const captureTimestamp = Date.now();

      navigator.geolocation.getCurrentPosition(
        (position) => {
          streamRef.current?.getTracks().forEach((t) => t.stop());
          onCaptured({
            frames,
            lat: position.coords.latitude,
            lon: position.coords.longitude,
            gpsAccuracy: position.coords.accuracy,
            captureTimestamp,
          });
        },
        (err) => {
          setCapturing(false);
          onError?.("Location access was denied or unavailable: " + err.message);
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    } catch (error) {
      setCapturing(false);
      onError?.(error.message || "Camera capture failed.");
    }
  }

  return (
    <div style={{ position: "relative", borderRadius: 12, overflow: "hidden", background: "#000" }}>
      <video ref={videoRef} playsInline muted style={{ width: "100%", display: "block", aspectRatio: "4/3", objectFit: "cover" }} />
      <canvas ref={canvasRef} style={{ display: "none" }} />

      {cameraReady && (
        <div
          style={{
            position: "absolute",
            top: 12,
            left: 12,
            right: 12,
            display: "flex",
            justifyContent: "space-between",
            color: "#fff",
            fontSize: 13,
            fontFamily: "var(--font-body)",
            textShadow: "0 1px 3px rgba(0,0,0,0.8)",
          }}
        >
          <span>Code {challengeCode}</span>
          <span>{new Date().toLocaleDateString()}</span>
        </div>
      )}

      {!capturing && cameraReady && (
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            padding: 16,
            background: "linear-gradient(transparent, rgba(0,0,0,0.75))",
          }}
        >
          <p style={{ color: "#fff", fontSize: 13, marginBottom: 12, maxWidth: "none" }}>
            Point the camera at your plot. When you tap start, move sideways a few steps while panning slowly for 3
            seconds. Keep nearby plants and distant scenery in view — this proves real depth, not a photo of a photo.
          </p>
          <button className="btn btn-primary" style={{ width: "100%" }} onClick={startPanCapture}>
            Start pan capture
          </button>
        </div>
      )}

      {capturing && (
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: 16, background: "rgba(0,0,0,0.75)" }}>
          <p style={{ color: "#fff", fontSize: 13, marginBottom: 8, maxWidth: "none" }}>Keep panning slowly…</p>
          <div style={{ height: 6, background: "rgba(255,255,255,0.25)", borderRadius: 3, overflow: "hidden" }}>
            <div
              style={{
                height: "100%",
                width: `${progress * 100}%`,
                background: "var(--fruit-600)",
                transition: "width 0.15s linear",
              }}
            />
          </div>
        </div>
      )}

      {!cameraReady && <div style={{ padding: 40, color: "#fff", textAlign: "center" }}>Requesting camera access…</div>}
    </div>
  );
}
