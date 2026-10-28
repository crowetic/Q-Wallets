import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useArrrAddressValidation } from '../useArrrAddressValidation';
import { validateArrrAddress } from '../../utils/addressValidation';

vi.mock('../../utils/addressValidation', () => ({
  validateArrrAddress: vi.fn(),
}));

describe('ARRR recipient validation lifecycle', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.mocked(validateArrrAddress).mockReset();
  });
  afterEach(() => vi.useRealTimers());

  it('debounces requests and only enables the current validated recipient', async () => {
    vi.mocked(validateArrrAddress).mockResolvedValue(true);
    const { result, rerender } = renderHook(
      ({ address }) => useArrrAddressValidation(address),
      {
        initialProps: { address: 'pirate1first' },
      }
    );
    expect(result.current.status).toBe('pending');
    rerender({ address: 'pirate1second' });
    await act(() => vi.advanceTimersByTimeAsync(350));
    expect(validateArrrAddress).toHaveBeenCalledTimes(1);
    expect(validateArrrAddress).toHaveBeenCalledWith(
      'pirate1second',
      expect.any(AbortSignal)
    );
    expect(result.current.status).toBe('valid');
    rerender({ address: 'pirate1third' });
    expect(result.current.status).toBe('pending');
  });

  it('ignores a delayed success after the address changed, even if transport ignores abort', async () => {
    let resolveOld: (value: boolean) => void = () => {};
    vi.mocked(validateArrrAddress)
      .mockImplementationOnce(
        () =>
          new Promise<boolean>((resolve) => {
            resolveOld = resolve;
          })
      )
      .mockResolvedValueOnce(false);
    const { result, rerender } = renderHook(
      ({ address }) => useArrrAddressValidation(address),
      {
        initialProps: { address: 'pirate1old' },
      }
    );
    await act(() => vi.advanceTimersByTimeAsync(350));
    const oldSignal = vi.mocked(validateArrrAddress).mock.calls[0][1];
    rerender({ address: 'pirate1new' });
    expect(oldSignal?.aborted).toBe(true);
    await act(() => vi.advanceTimersByTimeAsync(350));
    expect(result.current.status).toBe('invalid');
    await act(async () => resolveOld(true));
    expect(result.current.status).toBe('invalid');
  });

  it('keeps unavailable validation disabled and aborts on closing', async () => {
    vi.mocked(validateArrrAddress).mockRejectedValue(new Error('404'));
    const { result, rerender } = renderHook(
      ({ enabled }) => useArrrAddressValidation('pirate1example', enabled),
      {
        initialProps: { enabled: true },
      }
    );
    await act(() => vi.advanceTimersByTimeAsync(350));
    expect(result.current.status).toBe('unavailable');
    rerender({ enabled: false });
    expect(result.current.status).toBe('idle');
    expect(vi.mocked(validateArrrAddress).mock.calls[0][1]?.aborted).toBe(true);
    rerender({ enabled: true });
    expect(result.current.status).toBe('pending');
  });
});
