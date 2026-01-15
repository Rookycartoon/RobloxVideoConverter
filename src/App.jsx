import { useEffect, useMemo, useRef, useState } from "react";
import ScriptCard from "./components/ScriptCard";
import "./App.css";

export default function App() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  const [file, setFile] = useState(null);
  const [videoURL, setVideoURL] = useState("");

  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState("");
  const [status, setStatus] = useState("Idle");

  // progress + eta
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [eta, setEta] = useState(null);

  // settings
  const [fps, setFps] = useState(15);
  const [baseW, setBaseW] = useState(256);
  const [baseH, setBaseH] = useState(144);
  const [block, setBlock] = useState(4);
  const [maxSeconds, setMaxSeconds] = useState(30);
  const [quantStep, setQuantStep] = useState(8);

  const gridW = useMemo(() => Math.floor(baseW / block), [baseW, block]);
  const gridH = useMemo(() => Math.floor(baseH / block), [baseH, block]);
  const blocksCount = gridW * gridH;

  const perf = useMemo(() => {
    const score = blocksCount * fps;
    if (score <= 50000) return "ok";
    if (score <= 120000) return "med";
    return "heavy";
  }, [blocksCount, fps]);

  const perfText = perf === "ok" ? "Light" : perf === "med" ? "Medium" : "Heavy";

  function appendLog(s) {
    setLog((prev) => prev + s + "\n");
  }

  function formatTime(seconds) {
    if (seconds == null || !isFinite(seconds) || seconds < 0) return "--:--";
    seconds = Math.floor(seconds);
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }

  function downloadText(filename, text) {
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = filename;

    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }

  // ✅ Downloads the script stored in /public/RobloxScript.txt
  async function downloadPublicScript() {
    const res = await fetch("/RobloxScript.txt");
    if (!res.ok) throw new Error("RobloxScript.txt not found in /public folder");

    const text = await res.text();
    downloadText("RobloxPlayer.lua", text);
    appendLog("RobloxPlayer.lua downloaded.");
  }

  function quantize(v, step) {
    return Math.floor(v / step) * step;
  }

  // cleanup blob url when file changes
  useEffect(() => {
    return () => {
      if (videoURL) URL.revokeObjectURL(videoURL);
    };
  }, [videoURL]);

  function applyPreset(preset) {
    if (preset === "fast") {
      setFps(10);
      setMaxSeconds(20);
      setBaseW(256);
      setBaseH(144);
      setBlock(8);
      setQuantStep(16);
    } else if (preset === "balanced") {
      setFps(15);
      setMaxSeconds(30);
      setBaseW(256);
      setBaseH(144);
      setBlock(4);
      setQuantStep(8);
    } else if (preset === "high") {
      setFps(15);
      setMaxSeconds(30);
      setBaseW(384);
      setBaseH(216);
      setBlock(4);
      setQuantStep(4);
    } else if (preset === "ultra") {
      setFps(15);
      setMaxSeconds(30);
      setBaseW(512);
      setBaseH(288);
      setBlock(2);
      setQuantStep(4);
    }
  }

  async function loadVideoFromFile(f) {
    setLog("");
    setProgress({ done: 0, total: 0 });
    setEta(null);

    const url = URL.createObjectURL(f);
    setVideoURL(url);

    // load into hidden video
    const v = videoRef.current;
    v.src = url;

    await new Promise((res, rej) => {
      v.onloadedmetadata = () => res();
      v.onerror = () => rej(new Error("Failed to load video"));
    });

    appendLog(`Loaded video: ${f.name}`);
    appendLog(`Duration: ${v.duration.toFixed(2)}s`);
    appendLog(`Video size: ${v.videoWidth} x ${v.videoHeight}`);
  }

  function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }

  async function seekTo(video, time) {
    video.currentTime = time;
    await new Promise((res) => {
      const onSeeked = () => {
        video.removeEventListener("seeked", onSeeked);
        res();
      };
      video.addEventListener("seeked", onSeeked);
    });
  }

  function imageDataToGrid(imageData, outW, outH) {
    const data = imageData.data;
    const gW = Math.floor(outW / block);
    const gH = Math.floor(outH / block);
    const gridSize = gW * gH;

    const grid = new Array(gridSize);
    let gi = 0;

    for (let by = 0; by < outH; by += block) {
      for (let bx = 0; bx < outW; bx += block) {
        let r = 0,
          g = 0,
          b = 0,
          count = 0;

        for (let yy = 0; yy < block; yy++) {
          for (let xx = 0; xx < block; xx++) {
            const x = bx + xx;
            const y = by + yy;
            const idx = (y * outW + x) * 4;

            r += data[idx];
            g += data[idx + 1];
            b += data[idx + 2];
            count++;
          }
        }

        r = quantize(Math.round(r / count), quantStep);
        g = quantize(Math.round(g / count), quantStep);
        b = quantize(Math.round(b / count), quantStep);

        grid[gi++] = [r, g, b];
      }
    }

    return grid;
  }

  async function convert() {
    if (!file || !videoRef.current) return;

    const v = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });

    // output size divisible by block
    const outW = Math.floor(baseW / block) * block;
    const outH = Math.floor(baseH / block) * block;

    const gW = Math.floor(outW / block);
    const gH = Math.floor(outH / block);
    const gridSize = gW * gH;

    canvas.width = outW;
    canvas.height = outH;

    setBusy(true);
    setLog("");
    setStatus("Preparing...");
    setProgress({ done: 0, total: 0 });
    setEta(null);

    try {
      setStatus("Reading metadata...");

      const duration = Math.min(v.duration || 0, maxSeconds);
      if (!duration || !isFinite(duration)) throw new Error("Invalid video duration");

      const totalFrames = Math.max(1, Math.floor(duration * fps));
      setProgress({ done: 0, total: totalFrames });

      appendLog("Starting conversion...");
      appendLog(
        `Settings: fps=${fps} size=${outW}x${outH} block=${block} seconds=${duration.toFixed(2)}`
      );
      appendLog(`Grid: ${gW}x${gH}`);

      // ensure video is ready
      v.pause();
      await seekTo(v, 0);
      await sleep(50);

      let prevGrid = null;
      const luaFrames = [];

      const start = performance.now();
      let lastEtaUpdate = 0;

      for (let f = 0; f < totalFrames; f++) {
        setStatus("Processing frames...");

        const t = f / fps;
        await seekTo(v, t);

        ctx.clearRect(0, 0, outW, outH);
        ctx.drawImage(v, 0, 0, outW, outH);

        const imgData = ctx.getImageData(0, 0, outW, outH);
        const grid = imageDataToGrid(imgData, outW, outH);

        if (!prevGrid) {
          const full = [];
          for (let i = 0; i < gridSize; i++) {
            const [r, g, b] = grid[i];
            full.push(r, g, b);
          }
          luaFrames.push(full);
          prevGrid = grid;
        } else {
          const changes = [];
          for (let i = 0; i < gridSize; i++) {
            const a = grid[i];
            const p = prevGrid[i];
            if (a[0] !== p[0] || a[1] !== p[1] || a[2] !== p[2]) {
              changes.push(i + 1, a[0], a[1], a[2]);
            }
          }
          luaFrames.push(changes);
          prevGrid = grid;
        }

        setProgress({ done: f + 1, total: totalFrames });

        const now = performance.now();
        if (now - lastEtaUpdate > 450 && f >= 5) {
          lastEtaUpdate = now;
          const elapsed = (now - start) / 1000;
          const speed = (f + 1) / Math.max(elapsed, 0.001);
          const remaining = totalFrames - (f + 1);
          setEta(remaining / Math.max(speed, 0.01));
        }

        if (f % 25 === 0) appendLog(`Progress: ${f + 1}/${totalFrames}`);
        if (f % 5 === 0) await sleep(1);
      }

      setStatus("Building Lua module...");
      setEta(0);

      let lua = "";
      lua += "return {\n";
      lua += `  Width = ${gW},\n`;
      lua += `  Height = ${gH},\n`;
      lua += `  FPS = ${fps},\n`;
      lua += "  Frames = {\n";
      for (const arr of luaFrames) lua += "    {" + arr.join(",") + "},\n";
      lua += "  }\n";
      lua += "}\n";

      downloadText("VideoDelta.lua", lua);
      setStatus("Completed");
      appendLog("Done. VideoDelta.lua downloaded.");
    } catch (e) {
      setStatus("Failed");
      appendLog("Error: " + (e?.message || String(e)));
      console.error(e);
    } finally {
      setBusy(false);
    }
  }

  const progressPct = progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;

  return (
    <>
      <div className="shell">
        <div className="topbar">
          <div>
            <div className="title">Roblox Video Converter</div>
            <div className="subtitle">Web version. Runs locally in your browser.</div>
          </div>

          <div className={"status " + (busy ? "processing" : "idle")}>
            <span className="dot" />
            {status}
          </div>
        </div>

        <div className="layout">
          {/* Left */}
          <div className="panel">
            <div className="panelHeader">
              <div className="panelTitle">Input</div>
              <div className="panelHint">
                Upload a video file. Conversion happens fully in your browser.
              </div>
            </div>

            <div className="row" style={{ marginTop: 12 }}>
              <label className="fileBtn">
                Upload Video
                <input
                  type="file"
                  accept="video/*"
                  disabled={busy}
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    setFile(f);
                    await loadVideoFromFile(f);
                  }}
                />
              </label>

              <button className="btn primary" onClick={convert} disabled={busy || !file}>
                {busy ? "Converting..." : "Convert and Download Lua"}
              </button>
            </div>

            <div className="pathBox" title={file?.name || "No file selected"}>
              {file ? file.name : "No file selected"}
            </div>

            <div className="section">
              <div className="sectionTitle">Presets</div>
              <div className="tabs">
                <button className="tab" onClick={() => applyPreset("fast")} disabled={busy}>
                  Fast
                </button>
                <button className="tab active" onClick={() => applyPreset("balanced")} disabled={busy}>
                  Balanced
                </button>
                <button className="tab" onClick={() => applyPreset("high")} disabled={busy}>
                  High
                </button>
                <button className="tab" onClick={() => applyPreset("ultra")} disabled={busy}>
                  Ultra
                </button>
              </div>
            </div>

            <div className="section">
              <div className="sectionTitle">Settings</div>

              <div className="grid">
                <div className="field">
                  <label>FPS</label>
                  <select value={fps} onChange={(e) => setFps(Number(e.target.value))} disabled={busy}>
                    <option value={10}>10</option>
                    <option value={15}>15</option>
                    <option value={20}>20</option>
                  </select>
                </div>

                <div className="field">
                  <label>Base Width</label>
                  <input type="number" value={baseW} onChange={(e) => setBaseW(Number(e.target.value))} disabled={busy} />
                </div>

                <div className="field">
                  <label>Base Height</label>
                  <input type="number" value={baseH} onChange={(e) => setBaseH(Number(e.target.value))} disabled={busy} />
                </div>

                <div className="field">
                  <label>Block Size</label>
                  <div className="sliderRow">
                    <input type="range" min="2" max="12" step="1" value={block} onChange={(e) => setBlock(Number(e.target.value))} disabled={busy} />
                    <span className="pill">{block}</span>
                  </div>
                </div>

                <div className="field">
                  <label>Max Seconds</label>
                  <input type="number" value={maxSeconds} onChange={(e) => setMaxSeconds(Number(e.target.value))} disabled={busy} />
                </div>

                <div className="field">
                  <label>Quant Step</label>
                  <div className="sliderRow">
                    <input type="range" min="2" max="32" step="2" value={quantStep} onChange={(e) => setQuantStep(Number(e.target.value))} disabled={busy} />
                    <span className="pill">{quantStep}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right */}
          <div className="panel">
            <div className="panelHeader">
              <div className="panelTitle">Output</div>
              <div className="panelHint">Progress and estimated performance impact in Roblox.</div>
            </div>

            <div className="cards">
              <div className="infoCard">
                <div className="infoTitle">Grid</div>
                <div className="infoValue">{gridW} × {gridH}</div>
                <div className="infoSub">{blocksCount} blocks per frame</div>
              </div>

              <div className="infoCard">
                <div className="infoTitle">Load</div>
                <div className={"infoValue " + perf}>{perfText}</div>
                <div className="infoSub">Roblox playback cost</div>
              </div>

              <div className="infoCard">
                <div className="infoTitle">ETA</div>
                <div className="infoValue">{busy ? formatTime(eta) : "--:--"}</div>
                <div className="infoSub">{busy ? "Estimated remaining time" : "Idle"}</div>
              </div>
            </div>

            <div className="progressWrap">
              <div className="progressTop">
                <div className="progressText">
                  {busy
                    ? `Processing ${progress.done}/${progress.total} (${progressPct}%)`
                    : "Ready"}
                </div>
                <div className="progressStage">{busy ? "running" : "idle"}</div>
              </div>

              <div className="progressBar">
                <div className="progressFill" style={{ width: busy ? `${progressPct}%` : "0%" }} />
              </div>
            </div>

            <div className="log">
              <div className="logHeader">Log</div>
              <textarea value={log} readOnly />
            </div>

            <div className="footnote">
              Larger resolution and lower block size increases quality but raises runtime cost.
            </div>
          </div>
        </div>

        {/* Hidden workers */}
        <video ref={videoRef} style={{ display: "none" }} crossOrigin="anonymous" />
        <canvas ref={canvasRef} style={{ display: "none" }} />
      </div>

      {/* ✅ ScriptCard placed on LEFT column */}
      <ScriptCard onDownload={downloadPublicScript} />
    </>
  );
}
