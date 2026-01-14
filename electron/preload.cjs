const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("api", {
  pickVideo: () => ipcRenderer.invoke("pick-video"),
  convertVideo: (options) => ipcRenderer.invoke("convert-video", options),

  onFFmpegProgress: (cb) =>
    ipcRenderer.on("ffmpeg-progress", (_, data) => cb(data)),

  onProcessingProgress: (cb) =>
    ipcRenderer.on("processing-progress", (_, data) => cb(data)),
});
