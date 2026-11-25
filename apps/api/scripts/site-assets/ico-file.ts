import { pngSizeOf } from './png-size';

const HEADER_LENGTH = 6;
const ENTRY_LENGTH = 16;
const ICON_TYPE = 1;
const COLOR_PLANES = 1;
const BITS_PER_PIXEL = 32;
const SIZE_BYTE_MODULO = 256;

function headerBytes(imageCount: number): Buffer {
  const header = Buffer.alloc(HEADER_LENGTH);
  header.writeUInt16LE(ICON_TYPE, 2);
  header.writeUInt16LE(imageCount, 4);
  return header;
}

function entryBytes({ png, offset }: { png: Buffer; offset: number }): Buffer {
  const { width, height } = pngSizeOf(png);
  const entry = Buffer.alloc(ENTRY_LENGTH);
  entry.writeUInt8(width % SIZE_BYTE_MODULO, 0);
  entry.writeUInt8(height % SIZE_BYTE_MODULO, 1);
  entry.writeUInt16LE(COLOR_PLANES, 4);
  entry.writeUInt16LE(BITS_PER_PIXEL, 6);
  entry.writeUInt32LE(png.length, 8);
  entry.writeUInt32LE(offset, 12);
  return entry;
}

export function icoBytes(pngs: Buffer[]): Buffer {
  const firstOffset = HEADER_LENGTH + pngs.length * ENTRY_LENGTH;
  const entries = pngs.map((png, index) =>
    entryBytes({ png, offset: pngs.slice(0, index).reduce((offset, previous) => offset + previous.length, firstOffset) }),
  );
  return Buffer.concat([headerBytes(pngs.length), ...entries, ...pngs]);
}
