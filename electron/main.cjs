const { app, BrowserWindow, ipcMain, dialog } = require("electron");
const path = require("path");
const fs = require("fs");

const ffmpeg = require("fluent-ffmpeg");
const ffmpegPath = require("ffmpeg-static");
const ffprobePath = require("ffprobe-static").path;

ffmpeg.setFfmpegPath(ffmpegPath);
ffmpeg.setFfprobePath(ffprobePath);

let win;

function createWindow() {
  win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // Dev: load vite
  if (!app.isPackaged) {
    win.loadURL("http://localhost:5173");
    win.webContents.openDevTools();
  } else {
    win.loadFile(path.join(__dirname, "../dist/index.html"));
  }
}

app.whenReady().then(createWindow);

ipcMain.handle("pick-video", async () => {
  const result = await dialog.showOpenDialog({
    properties: ["openFile"],
    filters: [{ name: "Videos", extensions: ["mp4", "mov", "mkv", "avi", "webm"] }],
  });

  if (result.canceled) return null;
  return result.filePaths[0];
});

ipcMain.handle("convert-video", async (event, options) => {
  const { inputPath, fps, width, height, block, quantStep, maxSeconds } = options;

  const tempDir = path.join(app.getPath("temp"), "rbx_video_frames");
  if (fs.existsSync(tempDir)) fs.rmSync(tempDir, { recursive: true, force: true });
  fs.mkdirSync(tempDir, { recursive: true });

  const framesPattern = path.join(tempDir, "frame_%05d.png");

  // 1) extract frames
  await new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .outputOptions([
        "-vf",
        `fps=${fps},scale=${width}:${height}`,
        "-t",
        String(maxSeconds),
      ])
      .output(framesPattern)
      .on("progress", (p) => {
        // p.frames exists sometimes
        win.webContents.send("ffmpeg-progress", p);
      })
      .on("end", resolve)
      .on("error", reject)
      .run();
  });

  // 2) read frame files
  const files = fs
    .readdirSync(tempDir)
    .filter((x) => x.endsWith(".png"))
    .sort();

  if (files.length === 0) throw new Error("No frames extracted.");

  // 3) use node-canvas for pixel reading
  const { createCanvas, loadImage } = require("canvas");
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");

  const gW = Math.floor(width / block);
  const gH = Math.floor(height / block);
  const gridSize = gW * gH;

  function quantize(v, step) {
    return Math.floor(v / step) * step;
  }

  function imageToGrid(img) {
    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0, width, height);
    const imageData = ctx.getImageData(0, 0, width, height).data;

    const grid = new Array(gridSize);
    let gi = 0;

    for (let by = 0; by < height; by += block) {
      for (let bx = 0; bx < width; bx += block) {
        let r = 0, g = 0, b = 0, count = 0;

        for (let yy = 0; yy < block; yy++) {
          for (let xx = 0; xx < block; xx++) {
            const x = bx + xx;
            const y = by + yy;
            const idx = (y * width + x) * 4;
            r += imageData[idx];
            g += imageData[idx + 1];
            b += imageData[idx + 2];
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

  let prevGrid = null;
  const luaFrames = [];

  const start = Date.now();
  for (let i = 0; i < files.length; i++) {
    const img = await loadImage(path.join(tempDir, files[i]));
    const grid = imageToGrid(img);

    if (!prevGrid) {
      const full = [];
      for (let p = 0; p < gridSize; p++) {
        const [r, g, b] = grid[p];
        full.push(r, g, b);
      }
      luaFrames.push(full);
      prevGrid = grid;
    } else {
      const changes = [];
      for (let p = 0; p < gridSize; p++) {
        const a = grid[p];
        const b = prevGrid[p];
        if (a[0] !== b[0] || a[1] !== b[1] || a[2] !== b[2]) {
          changes.push(p + 1, a[0], a[1], a[2]);
        }
      }
      luaFrames.push(changes);
      prevGrid = grid;
    }

    const elapsed = (Date.now() - start) / 1000;
    const speed = (i + 1) / Math.max(elapsed, 0.01);
    const remaining = files.length - (i + 1);
    const eta = remaining / Math.max(speed, 0.01);

    win.webContents.send("processing-progress", {
      done: i + 1,
      total: files.length,
      eta,
    });
  }

  // 4) build Lua output
  let lua = "";
  lua += "return {\n";
  lua += `  Width = ${gW},\n`;
  lua += `  Height = ${gH},\n`;
  lua += `  FPS = ${fps},\n`;
  lua += "  Frames = {\n";

  for (const arr of luaFrames) {
    lua += "    {" + arr.join(",") + "},\n";
  }

  lua += "  }\n";
  lua += "}\n";

  // save output file dialog
  const out = await dialog.showSaveDialog({
    defaultPath: "VideoDelta.lua",
    filters: [{ name: "Lua file", extensions: ["lua"] }],
  });

  if (!out.canceled && out.filePath) {
    fs.writeFileSync(out.filePath, lua, "utf8");
  }

  // cleanup
  fs.rmSync(tempDir, { recursive: true, force: true });

  return { ok: true };
});
