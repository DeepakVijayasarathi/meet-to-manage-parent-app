import assert from "node:assert/strict";
import { test } from "node:test";

import { roomUrl } from "./jitsi.ts";

function configOf(url: string): Record<string, unknown> {
  const hash = url.split("#")[1] ?? "";
  return Object.fromEntries(
    hash.split("&").map((pair) => {
      const [key, value] = pair.split("=");
      return [decodeURIComponent(key), JSON.parse(decodeURIComponent(value))];
    }),
  );
}

const join = { domain: "meet.example.com", room: "trn-abc", token: "t0k3n" };

test("phone calls relay through the bridge and cap camera size for weak links", () => {
  const config = configOf(roomUrl(join, "Asha"));
  assert.equal(config["config.p2p.enabled"], false);
  assert.equal(config["config.constraints.video.height.ideal"], 360);
  assert.equal(config["config.constraints.video.height.max"], 480);
});

test("audio survives a bad link: RED, DTX and a 32 kbps cap", () => {
  const config = configOf(roomUrl(join, "Asha"));
  assert.equal(config["config.audioQuality.enableOpusRed"], true);
  assert.equal(config["config.audioQuality.enableOpusDtx"], true);
  assert.equal(config["config.audioQuality.opusMaxAverageBitrate"], 32000);
  assert.equal(config["config.constraints.audio.echoCancellation"], true);
});

test("mic and camera choices from the pre-join screen are kept", () => {
  const config = configOf(roomUrl(join, "Asha", { audioMuted: true, videoMuted: false }));
  assert.equal(config["config.startWithAudioMuted"], true);
  assert.equal(config["config.startWithVideoMuted"], false);
});
