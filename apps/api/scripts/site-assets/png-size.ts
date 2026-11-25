export type PixelSize = { width: number; height: number };

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const IHDR_WIDTH_OFFSET = 16;
const IHDR_HEIGHT_OFFSET = 20;

export function pngSizeOf(bytes: Buffer): PixelSize {
  const isPng = bytes.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE);
  if (!isPng) throw new Error('not a PNG: the signature is missing');
  return { width: bytes.readUInt32BE(IHDR_WIDTH_OFFSET), height: bytes.readUInt32BE(IHDR_HEIGHT_OFFSET) };
}
