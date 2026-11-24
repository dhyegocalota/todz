import { describe, expect, test } from 'vitest';
import { clientRateKey } from '../src/client-rate-key';

describe('clientRateKey', () => {
  test('keys an IPv4 address as itself', () => {
    expect(clientRateKey({ address: '203.0.113.7' })).toBe('203.0.113.7');
  });

  test('keys an IPv4-mapped IPv6 address as the IPv4 address', () => {
    expect(clientRateKey({ address: '::ffff:203.0.113.7' })).toBe('203.0.113.7');
  });

  test('keys the hexadecimal form of an IPv4-mapped IPv6 address as the IPv4 address', () => {
    expect(clientRateKey({ address: '::ffff:cb00:7107' })).toBe('203.0.113.7');
  });

  test('keys an IPv6 address by its 64-bit prefix', () => {
    expect(clientRateKey({ address: '2001:db8:1:2:3:4:5:6' })).toBe('2001:db8:1:2');
  });

  test('keys a compressed IPv6 address by its 64-bit prefix', () => {
    expect(clientRateKey({ address: '2001:db8::1' })).toBe('2001:db8:0:0');
  });

  test('keys two addresses of one 64-bit prefix alike', () => {
    expect(clientRateKey({ address: '2001:DB8:1:2::1' })).toBe(clientRateKey({ address: '2001:db8:1:2:ffff:eeee:dddd:cccc' }));
  });
});
