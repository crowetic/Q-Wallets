import { describe, expect, it, vi } from 'vitest';
import {
  ARRR_TRANSACTION_RETRY_DELAY_MS,
  hasUnresolvedArrrRecipients,
  isTransientArrrTransactionError,
  requestArrrTransactionsWithRetry,
} from '../arrrTransactionRetry';

describe('requestArrrTransactionsWithRetry', () => {
  it('returns an immediate successful response without waiting', async () => {
    const request = vi.fn().mockResolvedValue([{ txid: 'first' }]);
    const wait = vi.fn().mockResolvedValue(undefined);

    await expect(
      requestArrrTransactionsWithRetry(request, wait)
    ).resolves.toEqual([{ txid: 'first' }]);
    expect(request).toHaveBeenCalledTimes(1);
    expect(wait).not.toHaveBeenCalled();
  });

  it('retries once after a rejected timeout', async () => {
    const request = vi
      .fn()
      .mockRejectedValueOnce({
        error: 'timeout',
        message:
          'Request timed out after 30000 ms (action: GET_USER_WALLET_TRANSACTIONS)',
      })
      .mockResolvedValueOnce([{ txid: 'cached' }]);
    const wait = vi.fn().mockResolvedValue(undefined);

    await expect(
      requestArrrTransactionsWithRetry(request, wait)
    ).resolves.toEqual([{ txid: 'cached' }]);
    expect(request).toHaveBeenCalledTimes(2);
    expect(wait).toHaveBeenCalledOnce();
    expect(wait).toHaveBeenCalledWith(ARRR_TRANSACTION_RETRY_DELAY_MS);
  });

  it('retries a timeout returned as an API error object', async () => {
    const request = vi
      .fn()
      .mockResolvedValueOnce({ error: 'timeout' })
      .mockResolvedValueOnce([{ txid: 'cached' }]);
    const wait = vi.fn().mockResolvedValue(undefined);

    await expect(
      requestArrrTransactionsWithRetry(request, wait)
    ).resolves.toEqual([{ txid: 'cached' }]);
    expect(request).toHaveBeenCalledTimes(2);
  });

  it('does not retry a non-transient API error', async () => {
    const error = { error: 'invalid entropy' };
    const request = vi.fn().mockResolvedValue(error);
    const wait = vi.fn().mockResolvedValue(undefined);

    await expect(requestArrrTransactionsWithRetry(request, wait)).rejects.toBe(
      error
    );
    expect(request).toHaveBeenCalledTimes(1);
    expect(wait).not.toHaveBeenCalled();
  });

  it('propagates the second failure without starting another retry', async () => {
    const finalError = { error: 'wallet lock busy' };
    const request = vi
      .fn()
      .mockRejectedValueOnce({ error: 'timeout' })
      .mockRejectedValueOnce(finalError);
    const wait = vi.fn().mockResolvedValue(undefined);

    await expect(requestArrrTransactionsWithRetry(request, wait)).rejects.toBe(
      finalError
    );
    expect(request).toHaveBeenCalledTimes(2);
    expect(wait).toHaveBeenCalledTimes(1);
  });
});

describe('isTransientArrrTransactionError', () => {
  it('recognizes timeout and wallet lifecycle failures', () => {
    expect(
      isTransientArrrTransactionError(new Error('Request timed out'))
    ).toBe(true);
    expect(isTransientArrrTransactionError({ error: 'wallet lock busy' })).toBe(
      true
    );
    expect(
      isTransientArrrTransactionError({ message: 'Not initialized yet' })
    ).toBe(true);
    expect(isTransientArrrTransactionError({ error: 'invalid entropy' })).toBe(
      false
    );
  });
});

describe('hasUnresolvedArrrRecipients', () => {
  it('recognizes partial ARRR history responses', () => {
    expect(
      hasUnresolvedArrrRecipients([
        { outputs: [{ address: 'zs1-exact' }] },
        { outputs: [{ address: '[UNKNOWN]' }] },
      ])
    ).toBe(true);
    expect(
      hasUnresolvedArrrRecipients([{ outputs: [{ address: 'pirate1-exact' }] }])
    ).toBe(false);
    expect(hasUnresolvedArrrRecipients({ error: 'timeout' })).toBe(false);
  });
});
