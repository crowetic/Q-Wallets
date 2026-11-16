import { describe, expect, it } from 'vitest';
import { requireSendCoinTransactionId } from '../sendCoinResult';

const txId = 'ab'.repeat(32);

describe('foreign coin send acknowledgement', () => {
  it.each([txId, { txid: txId }, { txId }])(
    'accepts a transaction ID from supported host response shapes',
    (response) => {
      expect(requireSendCoinTransactionId(response, 'fallback')).toBe(txId);
    }
  );

  it.each([null, undefined, false, true, {}, '', 'ERROR', { txid: 'invalid' }])(
    'does not treat an absent or malformed acknowledgement as success',
    (response) => {
      expect(() => requireSendCoinTransactionId(response, 'fallback')).toThrow(
        'fallback'
      );
    }
  );

  it('preserves the host error even when a response also contains a transaction ID', () => {
    const response = { error: 'Broadcast status is unknown', txid: txId };
    try {
      requireSendCoinTransactionId(response, 'fallback');
      throw new Error('Expected the host error');
    } catch (error) {
      expect(error).toBe(response);
    }
  });
});
