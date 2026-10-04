/**
 * Decodes a binary server-to-client audio frame:
 * 4-byte big-endian sentence index followed by raw WAV bytes.
 */
export function decodeAudioFrame(buffer: ArrayBuffer): { index: number; wavBytes: Uint8Array } {
  if (buffer.byteLength < 4) {
    throw new Error("Audio frame is too short to contain a 4-byte index header");
  }
  const view = new DataView(buffer);
  const index = view.getUint32(0, false); // false = big-endian
  const wavBytes = new Uint8Array(buffer, 4);
  return { index, wavBytes };
}

/**
 * Encodes a client utterance to send over WebSocket:
 * raw 16 kHz mono signed 16-bit PCM buffer.
 */
export function encodeUtteranceFrame(pcmBytes: Int16Array | Uint8Array): Uint8Array {
  if (pcmBytes instanceof Int16Array) {
    return new Uint8Array(pcmBytes.buffer, pcmBytes.byteOffset, pcmBytes.byteLength);
  }
  return pcmBytes;
}
