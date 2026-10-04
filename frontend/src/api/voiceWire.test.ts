import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { decodeAudioFrame, encodeUtteranceFrame } from "./voiceWire";

describe("voiceWire contract fixtures", () => {
  it("matches backend contract fixture in contract/voice_frames.json", () => {
    const fixturePath = path.resolve(__dirname, "../../../contract/voice_frames.json");
    const fixture = JSON.parse(fs.readFileSync(fixturePath, "utf-8"));

    const frameHex = fixture.audio_frame.frame_hex;
    const buffer = Buffer.from(frameHex, "hex");
    const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);

    const { index, wavBytes } = decodeAudioFrame(arrayBuffer);

    expect(index).toBe(fixture.audio_frame.index);
    expect(Buffer.from(wavBytes).toString("hex")).toBe(fixture.audio_frame.wav_hex);
  });

  it("encodes Int16Array utterance buffer", () => {
    const pcm = new Int16Array([0, 100, 200, 300]);
    const encoded = encodeUtteranceFrame(pcm);
    expect(encoded.byteLength).toBe(8);
  });
});
