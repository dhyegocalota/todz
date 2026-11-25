import { describe, expect, test } from 'vitest';
import { icoBytes } from '../../scripts/site-assets/ico-file';

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const HEADER_LENGTH = 6;
const ENTRY_LENGTH = 16;
const ICON_TYPE = 1;
const LARGE_SIZE = 256;

function fakePng({ size, payloadLength }: { size: number; payloadLength: number }): Buffer {
  const header = Buffer.alloc(HEADER_LENGTH + ENTRY_LENGTH);
  header.writeUInt32BE(13, 0);
  header.write('IHDR', 4, 'ascii');
  header.writeUInt32BE(size, 8);
  header.writeUInt32BE(size, 12);
  return Buffer.concat([PNG_SIGNATURE, header, Buffer.alloc(payloadLength, size % 251)]);
}

function entryOf({ ico, index }: { ico: Buffer; index: number }) {
  const start = HEADER_LENGTH + index * ENTRY_LENGTH;
  return {
    width: ico.readUInt8(start),
    height: ico.readUInt8(start + 1),
    planes: ico.readUInt16LE(start + 4),
    bitsPerPixel: ico.readUInt16LE(start + 6),
    length: ico.readUInt32LE(start + 8),
    offset: ico.readUInt32LE(start + 12),
  };
}

describe('icoBytes', () => {
  const pngs = [
    fakePng({ size: 16, payloadLength: 40 }),
    fakePng({ size: 32, payloadLength: 90 }),
    fakePng({ size: 48, payloadLength: 150 }),
  ];
  const ico = icoBytes(pngs);

  test('writes a 6-byte header: reserved 0, type 1, the image count', () => {
    expect([ico.readUInt16LE(0), ico.readUInt16LE(2), ico.readUInt16LE(4)]).toEqual([0, ICON_TYPE, 3]);
  });

  test('writes one 16-byte entry per image with its width, height, length and offset', () => {
    const firstOffset = HEADER_LENGTH + 3 * ENTRY_LENGTH;
    const entries = [0, 1, 2].map((index) => entryOf({ ico, index }));
    expect(entries.map(({ width, height }) => [width, height])).toEqual([
      [16, 16],
      [32, 32],
      [48, 48],
    ]);
    expect(entries.map(({ length }) => length)).toEqual(pngs.map((png) => png.length));
    const expectedOffsets = pngs.map((_, index) => pngs.slice(0, index).reduce((offset, png) => offset + png.length, firstOffset));
    expect(entries.map(({ offset }) => offset)).toEqual(expectedOffsets);
    expect(entries.map(({ planes, bitsPerPixel }) => [planes, bitsPerPixel])).toEqual(pngs.map(() => [1, 32]));
  });

  test('follows the directory with the PNGs byte for byte and nothing else', () => {
    const body = ico.subarray(HEADER_LENGTH + 3 * ENTRY_LENGTH);
    expect(body.equals(Buffer.concat(pngs))).toBe(true);
  });

  test('writes 0 for a width of 256', () => {
    const large = icoBytes([fakePng({ size: LARGE_SIZE, payloadLength: 10 })]);
    expect(entryOf({ ico: large, index: 0 }).width).toBe(0);
    expect(entryOf({ ico: large, index: 0 }).height).toBe(0);
  });
});
