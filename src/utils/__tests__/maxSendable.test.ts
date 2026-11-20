import { describe, it, expect } from 'vitest';
import { calculateMaxSendable } from '../maxSendable';

describe('calculateMaxSendable', () => {
  it('subtracts the fee from the balance', () => {
    expect(calculateMaxSendable(1, 0.0005)).toBe(0.9995);
  });

  it('holds back the safety buffer when provided', () => {
    // 1000 sats buffer = 0.00001 coin
    expect(calculateMaxSendable(1, 0.0005, 1000)).toBe(0.99949);
  });

  it('never returns more than balance minus fee plus buffer (round-trips within balance)', () => {
    const balance = 1.1;
    const fee = 0.00005;
    const max = calculateMaxSendable(balance, fee, 1000);
    // amount + fee, recomputed in satoshis, must stay within the balance
    const amountSats = Math.round(max * 1e8);
    const feeSats = Math.round(fee * 1e8);
    expect(amountSats + feeSats).toBeLessThanOrEqual(Math.round(balance * 1e8));
  });

  it('keeps amount + fee strictly within balance across many values (with buffer)', () => {
    const fee = 0.00005;
    for (let i = 1; i <= 500; i++) {
      const balance = i / 100; // 0.01 .. 5.00
      const max = calculateMaxSendable(balance, fee, 1000);
      // Recompute the host-side boundary in satoshi space.
      const totalSats = Math.round(max * 1e8) + Math.round(fee * 1e8);
      expect(totalSats).toBeLessThan(Math.round(balance * 1e8));
    }
  });

  it('returns 0 when the fee meets or exceeds the balance', () => {
    expect(calculateMaxSendable(0.0005, 0.0005)).toBe(0);
    expect(calculateMaxSendable(0.0001, 0.0005)).toBe(0);
  });

  it('returns 0 when the buffer pushes the result to zero or below', () => {
    // balance - fee = 1000 sats, buffer = 1000 sats -> 0
    expect(calculateMaxSendable(0.0000_2, 0.000_01, 1000)).toBe(0);
  });

  it('returns 0 for a zero balance', () => {
    expect(calculateMaxSendable(0, 0.0005)).toBe(0);
  });

  it('returns 0 for non-finite inputs', () => {
    expect(calculateMaxSendable(NaN, 0.0005)).toBe(0);
    expect(calculateMaxSendable(1, NaN)).toBe(0);
    expect(calculateMaxSendable(Infinity, 0.0005)).toBe(0);
  });

  it('coerces numeric-string inputs (host returns balance as a string)', () => {
    // Regression: Number.isFinite('700') === false, so an un-coerced guard
    // would wrongly return 0 for a string balance.
    expect(calculateMaxSendable('700', '0.0001', 1000)).toBe(699.99989);
    expect(calculateMaxSendable('1', '0.0005')).toBe(0.9995);
  });

  it('returns 0 for non-numeric-string inputs', () => {
    expect(calculateMaxSendable('abc', 0.0005)).toBe(0);
    expect(calculateMaxSendable('', 0.0005)).toBe(0);
  });

  it('never rounds a balance upward to invent an extra atomic unit', () => {
    const result = calculateMaxSendable(0.123456789, 0);
    expect(result).toBe(0.12345678);
    expect(result.toString().split('.')[1].length).toBeLessThanOrEqual(8);
  });

  it('rejects invalid fees and buffers instead of increasing the maximum', () => {
    expect(calculateMaxSendable(1, -0.1)).toBe(0);
    expect(calculateMaxSendable(1, '', 1000)).toBe(0);
    expect(calculateMaxSendable(1, 0.01, NaN)).toBe(0);
    expect(calculateMaxSendable(1, 0.01, Infinity)).toBe(0);
  });

  it('subtracts string balances exactly and remains within the Hub atomic boundary', () => {
    for (const balance of [
      '90071992.54740991',
      '100000000.00000003',
      '1000000000.00000005',
    ]) {
      const [whole, fraction] = balance.split('.');
      const available =
        BigInt(whole) * 100000000n + BigInt(fraction) - 1000000n;
      const result = calculateMaxSendable(balance, '0.01');
      expect(result).toBeGreaterThan(0);
      expect(BigInt(Math.round(result * 1e8))).toBeLessThanOrEqual(available);
      expect(available - BigInt(Math.round(result * 1e8))).toBeLessThan(32n);
    }
  });

  it('ignores negative buffers (treats them as zero)', () => {
    expect(calculateMaxSendable(1, 0.0005, -1000)).toBe(0.9995);
  });
});
