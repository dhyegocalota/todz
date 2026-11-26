export type PropertyListValue = number | boolean | string | Buffer | PropertyListValue[] | { [key: string]: PropertyListValue };

const MAGIC = 'bplist00';
const TRAILER_BYTES = 32;
const OFFSET_SIZE_AT = 6;
const REFERENCE_SIZE_AT = 7;
const OBJECT_COUNT_AT = 8;
const TOP_OBJECT_AT = 16;
const OFFSET_TABLE_AT = 24;
const NIBBLE_BITS = 4;
const NIBBLE_MASK = 0x0f;
const EXTENDED_LENGTH = 0x0f;
const FALSE_MARKER = 0x08;
const TRUE_MARKER = 0x09;
const DOUBLE_NIBBLE = 3;

enum Marker {
  Integer = 0x1,
  Real = 0x2,
  Data = 0x4,
  AsciiString = 0x5,
  Utf16String = 0x6,
  Array = 0xa,
  Dictionary = 0xd,
}

function unsignedNumber({ bytes, offset, size }: { bytes: Buffer; offset: number; size: number }): number {
  return Number(bytes.readUIntBE(offset, size));
}

export function parsedBinaryPropertyList(bytes: Buffer): PropertyListValue {
  if (bytes.subarray(0, MAGIC.length).toString('latin1') !== MAGIC) throw new Error('not a binary property list');
  const trailer = bytes.length - TRAILER_BYTES;
  const offsetSize = bytes.readUInt8(trailer + OFFSET_SIZE_AT);
  const referenceSize = bytes.readUInt8(trailer + REFERENCE_SIZE_AT);
  const offsetTable = unsignedNumber({ bytes, offset: trailer + OFFSET_TABLE_AT + 4, size: 4 });
  const topObject = unsignedNumber({ bytes, offset: trailer + TOP_OBJECT_AT + 4, size: 4 });
  const objectCount = unsignedNumber({ bytes, offset: trailer + OBJECT_COUNT_AT + 4, size: 4 });
  if (objectCount === 0) throw new Error('empty binary property list');

  function objectOffset(index: number): number {
    return unsignedNumber({ bytes, offset: offsetTable + index * offsetSize, size: offsetSize });
  }

  function lengthAt(offset: number): { length: number; start: number } {
    const nibble = bytes.readUInt8(offset) & NIBBLE_MASK;
    if (nibble !== EXTENDED_LENGTH) return { length: nibble, start: offset + 1 };
    const size = 1 << (bytes.readUInt8(offset + 1) & NIBBLE_MASK);
    return { length: unsignedNumber({ bytes, offset: offset + 2, size }), start: offset + 2 + size };
  }

  function objectAt(index: number): PropertyListValue {
    const offset = objectOffset(index);
    const byte = bytes.readUInt8(offset);
    const marker = byte >> NIBBLE_BITS;
    if (byte === FALSE_MARKER) return false;
    if (byte === TRUE_MARKER) return true;
    if (marker === Marker.Integer) return unsignedNumber({ bytes, offset: offset + 1, size: 1 << (byte & NIBBLE_MASK) });
    if (marker === Marker.Real)
      return (byte & NIBBLE_MASK) === DOUBLE_NIBBLE ? bytes.readDoubleBE(offset + 1) : bytes.readFloatBE(offset + 1);
    const { length, start } = lengthAt(offset);
    if (marker === Marker.Data) return bytes.subarray(start, start + length);
    if (marker === Marker.AsciiString) return bytes.subarray(start, start + length).toString('latin1');
    if (marker === Marker.Utf16String)
      return Buffer.from(bytes.subarray(start, start + length * 2))
        .swap16()
        .toString('utf16le');
    function referencedObject(position: number): PropertyListValue {
      return objectAt(unsignedNumber({ bytes, offset: start + position * referenceSize, size: referenceSize }));
    }
    const positions = Array.from({ length }, (_, position) => position);
    if (marker === Marker.Array) return positions.map(referencedObject);
    if (marker !== Marker.Dictionary) throw new Error(`unsupported property list marker ${marker}`);
    return Object.fromEntries(positions.map((position) => [referencedObject(position) as string, referencedObject(length + position)]));
  }

  return objectAt(topObject);
}
