const IPV6_SEPARATOR = ':';
const IPV6_COMPRESSION = '::';
const IPV6_GROUP_COUNT = 8;
const IPV6_PREFIX_GROUPS = 4;
const HEXADECIMAL_RADIX = 16;
const IPV4_MAPPED_PREFIX = '::ffff:';
const IPV4_SEPARATOR = '.';
const IPV4_MAPPED_HEXADECIMAL_PATTERN = /^[0-9a-f]{1,4}:[0-9a-f]{1,4}$/i;
const BYTE_BITS = 8;
const BYTE_MASK = 0xff;
const GROUP_VALUES = BYTE_MASK + 1;

function splitGroups({ text }: { text: string }): string[] {
  if (text === '') return [];
  return text.split(IPV6_SEPARATOR);
}

function expandGroups({ address }: { address: string }): string[] | null {
  const compressionIndex = address.indexOf(IPV6_COMPRESSION);
  if (compressionIndex === -1) return splitGroups({ text: address });
  const headGroups = splitGroups({ text: address.slice(0, compressionIndex) });
  const tailGroups = splitGroups({ text: address.slice(compressionIndex + IPV6_COMPRESSION.length) });
  const fillCount = IPV6_GROUP_COUNT - headGroups.length - tailGroups.length;
  if (fillCount < 0) return null;
  return [...headGroups, ...Array<string>(fillCount).fill('0'), ...tailGroups];
}

function mappedIpv4Of({ address }: { address: string }): string | null {
  const lowered = address.toLowerCase();
  if (!lowered.startsWith(IPV4_MAPPED_PREFIX)) return null;
  const mapped = lowered.slice(IPV4_MAPPED_PREFIX.length);
  if (mapped.includes(IPV4_SEPARATOR)) return mapped;
  if (!IPV4_MAPPED_HEXADECIMAL_PATTERN.test(mapped)) return null;
  const [high, low] = mapped.split(IPV6_SEPARATOR).map((group) => parseInt(group, HEXADECIMAL_RADIX));
  const value = high! * GROUP_VALUES ** 2 + low!;
  return [value >>> (BYTE_BITS * 3), value >>> (BYTE_BITS * 2), value >>> BYTE_BITS, value]
    .map((part) => part & BYTE_MASK)
    .join(IPV4_SEPARATOR);
}

export function clientRateKey({ address }: { address: string }): string {
  if (!address.includes(IPV6_SEPARATOR)) return address;
  const mappedIpv4 = mappedIpv4Of({ address });
  if (mappedIpv4 !== null) return mappedIpv4;
  const groups = expandGroups({ address });
  if (groups === null) return address;
  const prefixGroups = groups.slice(0, IPV6_PREFIX_GROUPS);
  return prefixGroups.map((group) => parseInt(group, HEXADECIMAL_RADIX).toString(HEXADECIMAL_RADIX)).join(IPV6_SEPARATOR);
}
