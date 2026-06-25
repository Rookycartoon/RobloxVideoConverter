# Roblox Video Converter

Convert ordinary video files into Roblox-compatible Lua frame data that can be played on a SurfaceGui inside Roblox Studio.

## Features

- Import local video files
- Convert video frames into Roblox Lua data
- Delta-frame compression to reduce output size
- Adjustable quality and performance settings
- Presets for Fast, Balanced, High Quality, and Ultra Quality modes
- Roblox playback script download
- Electron desktop application built with React + Vite

---

## How It Works

1. Load a video file.
2. The application samples frames at a chosen FPS.
3. Frames are resized to the selected resolution.
4. Pixels are grouped into blocks.
5. Each block is averaged into a single RGB color.
6. Colors are quantized to reduce data size.
7. The first frame is stored completely.
8. Subsequent frames only store changed pixels (delta compression).
9. Output is exported as `VideoDelta.lua`.

The resulting Lua file can be used inside Roblox Studio together with the provided playback script.

---

## Installation

### Prerequisites

- Node.js 18+
- npm

### Install Dependencies

```bash
npm install
```

### Run Development Mode

```bash
npm run start
```

This launches:

- Vite development server
- Electron desktop application

### Build Web Assets

```bash
npm run build
```

### Build Desktop Application

```bash
npm run dist
```

Packaged files are generated in the `release/` directory.

---

## Project Structure

```text
RobloxVideoConverter/
├── electron/
│   ├── main.cjs
│   └── preload.cjs
├── public/
│   └── RobloxScript.txt
├── src/
│   ├── components/
│   │   └── ScriptCard.jsx
│   ├── App.jsx
│   └── main.jsx
├── package.json
└── README.md
```

---

## Conversion Settings

### FPS

Frames processed per second.

Higher FPS:
- Smoother playback
- Larger Lua files
- More Roblox workload

Lower FPS:
- Smaller files
- Better performance

### Resolution

Controls the frame size before conversion.

Higher resolution:
- Better image quality
- More blocks
- Larger output

### Block Size

Groups pixels into larger color blocks.

Larger blocks:
- Faster playback
- Smaller output
- Lower detail

Smaller blocks:
- Higher detail
- Larger output
- More Roblox objects to update

### Quantization Step

Reduces color precision.

Higher values:
- Smaller output
- More color banding

Lower values:
- Better color accuracy
- Larger files

### Maximum Seconds

Limits how much of the source video is converted.

---

## Presets

### Fast

Recommended for low-end devices.

- 10 FPS
- 256×144
- Block Size 8
- Quantization 16
- Max Length 20s

### Balanced

Default preset.

- 15 FPS
- 256×144
- Block Size 4
- Quantization 8
- Max Length 30s

### High

Better image quality.

- 15 FPS
- 384×216
- Block Size 4
- Quantization 4
- Max Length 30s

### Ultra

Maximum quality.

- 15 FPS
- 512×288
- Block Size 2
- Quantization 4
- Max Length 30s

---

## Roblox Studio Setup

1. Download `RobloxPlayer.lua` from the application.
2. Convert a video and export `VideoDelta.lua`.
3. Open Roblox Studio.
4. Insert a Part into the Workspace.
5. Add a SurfaceGui to the Part.
6. Create a Script named `VideoPlayer` inside the SurfaceGui.
7. Create a ModuleScript named `VideoData` under `VideoPlayer`.
8. Paste the contents of `RobloxPlayer.lua` into `VideoPlayer`.
9. Paste the contents of `VideoDelta.lua` into `VideoData`.
10. Run the game.

The video should play directly on the SurfaceGui.

---

## Performance Recommendations

For best Roblox performance:

- Use the Fast or Balanced preset.
- Keep videos under 30 seconds.
- Use lower resolutions when possible.
- Increase block size for large videos.
- Avoid Ultra mode unless necessary.

---

## Technology Stack

- React 19
- Vite 7
- Electron 39
- Fluent-FFmpeg
- ffmpeg-static
- ffprobe-static
- Node Canvas

---

## Output Format

Generated Lua files contain:

```lua
return {
    Width = GRID_WIDTH,
    Height = GRID_HEIGHT,
    FPS = FPS_VALUE,
    Frames = {
        -- Full first frame
        {...},

        -- Delta frames
        {...}
    }
}
```

The first frame stores all pixels.

Every frame after that stores only changed pixels, reducing file size and improving playback efficiency.

---

## License

Add your preferred license here.
