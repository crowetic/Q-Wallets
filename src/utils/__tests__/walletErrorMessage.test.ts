import { describe, expect, it } from 'vitest';
import { walletErrorMessage } from '../walletErrorMessage';

describe('wallet host error messages', () => {
  it('accepts thrown, string and structured error messages', () => {
    for (const value of [
      new Error('Wallet busy'),
      ' Wallet busy ',
      { error: 'Wallet busy' },
      { error: 1205, message: 'Wallet busy' },
      { error: { message: 'Wallet busy' } },
    ]) {
      expect(walletErrorMessage(value, 'fallback')).toBe('Wallet busy');
    }
  });
  it('never serializes an arbitrary response or an HTML error page', () => {
    for (const value of [
      null,
      undefined,
      {},
      { entropy58: 'must-not-display' },
      '<html>failed</html>',
      { error: 500 },
    ]) {
      expect(walletErrorMessage(value, 'fallback')).toBe('fallback');
    }
  });
  it('bounds the displayed message length', () => {
    expect(walletErrorMessage('a'.repeat(10000), 'fallback')).toHaveLength(
      1000
    );
  });
  it('redacts named secret fields if they occur inside an upstream message', () => {
    const message = walletErrorMessage(
      'Failed?apiKey=secret-key&entropy58=test-entropy',
      'fallback'
    );
    expect(message).not.toContain('secret-key');
    expect(message).not.toContain('test-entropy');
  });
});
