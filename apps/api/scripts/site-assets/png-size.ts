export type PixelSize = { width: number; height: number };

export function pngSizeOf(bytes: Uint8Array): PixelSize {
  throw new Error(`pngSizeOf is not implemented for ${bytes.length} bytes`);
}
