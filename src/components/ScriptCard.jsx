import React, { useState } from "react";
import "./ScriptCard.css";

export default function ScriptCard({ onDownload }) {
  const [downloading, setDownloading] = useState(false);

  async function handleDownload() {
    if (!onDownload) return;

    try {
      setDownloading(true);
      await onDownload();
    } catch (err) {
      console.error(err);
      alert("Download failed. Make sure RobloxScript.txt is inside the public folder.");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="scriptCard">
      <div className="scriptHeader">
        <div className="scriptTitle">Roblox Playback Setup</div>
        <div className="scriptSub">
          Download the Roblox script and follow these steps to play the converted video inside Roblox Studio.
        </div>
      </div>

      <div className="scriptButtons">
        <button
          type="button"
          className="btn primary"
          onClick={handleDownload}
          disabled={downloading}
        >
          {downloading ? "Downloading..." : "Download Roblox Script"}
        </button>
      </div>

      <div className="scriptInstructions">
        <div className="instTitle">Instructions</div>

        <ol className="instList">
          <li>
            Download <b>RobloxPlayer.lua</b> from this card.
          </li>
          <li>
            Convert your video using this tool and download <b>VideoDelta.lua</b>.
          </li>
          <li>
            Open <b>Roblox Studio</b> and insert a <b>Part</b> into the workspace.
          </li>
          <li>
            Add a <b>SurfaceGui</b> inside the Part (choose the face you want to display the video on).
          </li>
          <li>
            Inside the <b>SurfaceGui</b>, insert a <b>Script</b> named{" "}
            <b>VideoPlayer</b>.
          </li>
          <li>
            Under <b>VideoPlayer</b>, insert a <b>ModuleScript</b> named{" "}
            <b>VideoData</b>.
          </li>
          <li>
            Copy-paste the contents of <b>RobloxPlayer.lua</b> into the{" "}
            <b>VideoPlayer</b> script.
          </li>
          <li>
            Copy-paste the contents of <b>VideoDelta.lua</b> into the{" "}
            <b>VideoData</b> module script.
          </li>
          <li>
            Run the game. The video will play on the Part through the SurfaceGui.
          </li>
        </ol>

        <div className="instTip">
          Tip: For better performance, use lower resolution or increase Block Size.
          For better quality, increase resolution and reduce Block Size.
        </div>
      </div>
    </div>
  );
}
