import { describe, expect, it } from 'vitest';
import { calculateSendFee } from '../sendFee';
import { calculateMaxSendable } from '../maxSendable';

describe('selected send fees', () => {
  it.each([
    ['BTC', 500],
    ['LTC', 1000],
    ['DOGE', 5000],
  ])(
    'reserves the selected %s rate in the same units sent to Hub',
    (_, bytes) => {
      for (const rate of [100, 1500, 10000, 99999]) {
        const fee = calculateSendFee(rate, bytes as number)!;
        const max = calculateMaxSendable('1', fee.estimatedFee, 1000);
        expect(fee.feePerByte * 1e8).toBeCloseTo(Math.ceil(rate / 1000));
        expect(fee.ratePerKb).toBe(Math.ceil(rate / 1000) * 1000);
        expect(Math.round(max * 1e8) + Math.round(fee.estimatedFee * 1e8)).toBe(
          100000000 - 1000
        );
        expect(max + fee.feePerByte * (bytes as number)).toBeLessThan(1);
      }
    }
  );

  it('does not round a positive sub-satoshi rate down to a zero-fee send', () => {
    expect(calculateSendFee(100, 500)).toEqual({
      feePerByte: 0.00000001,
      estimatedFee: 0.000005,
      ratePerKb: 1000,
    });
  });

  it.each([10, 100, 1500, 3000])(
    'reserves slider rate %s in satoshis per byte',
    (rate) => {
      const fee = calculateSendFee(rate, 1000, 'per-byte')!;
      expect(fee.feePerByte).toBe(rate / 1e8);
      expect(fee.estimatedFee).toBe((rate * 1000) / 1e8);
    }
  );

  it.each([0, -1, NaN, Infinity, Number.MAX_VALUE])(
    'rejects unavailable or invalid rate %s',
    (rate) => {
      expect(calculateSendFee(rate, 500)).toBeNull();
    }
  );
});
