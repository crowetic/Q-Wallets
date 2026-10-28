import { afterEach, describe, expect, it, vi } from 'vitest';
import { validateAddress, validateArrrAddress } from '../addressValidation';
import { Coin } from 'qapp-core';

describe('Core ARRR address validation', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('asks Core about the complete trimmed address without imposing a prefix or length', async () => {
    const address =
      'pirate1lyp0g5438qkp9s5me5epku9ak9k0dxqsfyt9z894zym8qw38sps488ljyee27yw29vc2cyj8mse';
    const request = vi
      .fn()
      .mockResolvedValue({ ok: true, json: async () => true });
    vi.stubGlobal('fetch', request);
    expect(await validateArrrAddress(` ${address} `)).toBe(true);
    expect(request.mock.calls[0][0]).toBe(
      `/crosschain/arrr/validateaddress?address=${address}`
    );
    expect(await validateArrrAddress('future&format=example')).toBe(true);
    expect(request.mock.calls[1][0]).toContain('future%26format%3Dexample');
  });

  it('honors a false Core result even for an old prefix', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: async () => false })
    );
    expect(await validateArrrAddress('zs1invalid')).toBe(false);
  });

  it('does not make a request for an empty recipient or use the synchronous factory for ARRR', async () => {
    const request = vi.fn();
    vi.stubGlobal('fetch', request);
    expect(await validateArrrAddress('  ')).toBe(false);
    expect(validateAddress(Coin.ARRR, 'pirate1example')).toBe(false);
    expect(request).not.toHaveBeenCalled();
  });

  it('treats an old Core, gateway errors and malformed success responses as unavailable', async () => {
    const request = vi.fn();
    vi.stubGlobal('fetch', request);
    for (const response of [
      { ok: false, status: 404 },
      { ok: false, status: 503 },
      { ok: true, json: async () => ({ valid: true }) },
      { ok: true, json: async () => 'true' },
      { ok: true, json: async () => null },
    ]) {
      request.mockResolvedValueOnce(response);
      await expect(validateArrrAddress('pirate1example')).rejects.toThrow();
    }
  });
});
