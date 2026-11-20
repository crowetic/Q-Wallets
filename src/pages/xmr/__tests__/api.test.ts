import { describe, expect, it } from 'vitest';
import {
  atomicAmount,
  decimalAmount,
  paymentAmount,
  maxPaymentAmount,
  validatePayment,
  publicWallet,
  walletStatus,
} from '../api';
const address = '5' + 'a'.repeat(94);
const status = {
  network: 'stagenet',
  address,
  daemonUrl: 'https://example.org',
  initialized: true,
  syncing: false,
  synced: true,
  walletHeight: 100,
  daemonHeight: 100,
  progress: 1,
  balanceAtomic: '1000000000001',
  unlockedBalanceAtomic: '1000000000001',
  transactions: [],
  pending: null,
  error: null,
};
describe('XMR exact amounts', () => {
  it.each(['0.000000000001', '1.000000000001', '18446744.073709551615'])(
    'round trips %s without floating point',
    (value) => expect(decimalAmount(atomicAmount(value).toString())).toBe(value)
  );
  it.each([
    '0',
    '-1',
    '01',
    '.1',
    '1e-3',
    '1.0000000000001',
    '18446744.073709551616',
  ])('rejects %s', (value) => expect(() => atomicAmount(value)).toThrow());
  it('renders zero and removes trailing zeroes', () => {
    expect(decimalAmount('0')).toBe('0');
    expect(decimalAmount('100000000000')).toBe('0.1');
  });
});
describe('XMR payment input', () => {
  it.each([
    ['.05', '0.05'],
    [' .000000000001 ', '0.000000000001'],
    ['0.050000000000', '0.05'],
    ['1.000000000001', '1.000000000001'],
    ['18446744.073709551615', '18446744.073709551615'],
  ])('normalizes %s exactly to %s for the Hub', (input, expected) => {
    expect(paymentAmount(input)).toBe(expected);
  });
  it.each([
    '.',
    '.0',
    '-.05',
    '1e-3',
    '0,05',
    'NaN',
    '0.0000000000001',
    '1.0000000000001',
    '18446744.073709551616',
  ])('rejects invalid payment %s rather than rounding it', (input) => {
    expect(() => paymentAmount(input)).toThrow();
  });
  it('reserves the whole fee limit from unlocked funds in exact atomic units', () => {
    expect(maxPaymentAmount('500000000001', '.001')).toBe('0.499000000001');
    expect(maxPaymentAmount('1000000000', '.001')).toBe('0');
    expect(maxPaymentAmount('1', '.001')).toBe('0');
    expect(maxPaymentAmount('1000000000000000001', '.001')).toBe(
      '999999.999000000001'
    );
  });
  it.each(['', '0', '-1', '1.000000000001', '.0000000000001'])(
    'does not offer Max for invalid fee limit %s',
    (fee) => {
      expect(maxPaymentAmount('1000000000000', fee)).toBe('0');
    }
  );
  it('identifies each invalid field and checks unlocked rather than total funds', () => {
    expect(
      validatePayment(
        { recipient: '', amount: '.0', maxFee: '2' },
        '500000000000'
      ).errors
    ).toEqual({
      recipient: 'core:xmr.invalid_recipient',
      amount: 'core:xmr.invalid_amount',
      maxFee: 'core:xmr.invalid_fee',
    });
    expect(
      validatePayment(
        { recipient: address, amount: '.5', maxFee: '.001' },
        '500000000000'
      ).errors
    ).toEqual({
      amount: 'core:xmr.insufficient_unlocked',
    });
    expect(
      validatePayment(
        { recipient: ` ${address} `, amount: '.05', maxFee: '.001' },
        '500000000000'
      )
    ).toEqual({
      errors: {},
      payment: { recipient: address, amount: '0.05', maxFee: '0.001' },
    });
  });
});
it('accepts public status including its nullable error field', () => {
  expect(walletStatus(status, address)).toEqual(status);
  expect(walletStatus({ ...status, error: 'daemon' }, address).error).toBe(
    'daemon'
  );
});
it('rejects bridge errors, wrong account/network, malformed amounts and unbounded history', () => {
  for (const bad of [
    { error: 'denied' },
    { ...status, address: 'other' },
    { ...status, network: 'mainnet' },
    { ...status, balanceAtomic: 1 },
    { ...status, progress: NaN },
    { ...status, transactions: Array(101).fill({}) },
  ])
    expect(() => walletStatus(bad, address)).toThrow();
});
it('projects a public address and ignores any extra fields', () => {
  expect(
    publicWallet({ address, network: 'stagenet', secret: 'must-not-retain' })
  ).toEqual({ address, network: 'stagenet' });
});
