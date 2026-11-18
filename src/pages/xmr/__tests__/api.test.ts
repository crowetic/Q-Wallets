import { describe, expect, it } from 'vitest';
import {
  atomicAmount,
  decimalAmount,
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
