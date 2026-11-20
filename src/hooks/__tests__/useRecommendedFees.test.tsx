import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useRecommendedFees, isValidFeeEstimate } from '../useRecommendedFees';

const estimate = {
  height: 100,
  time: 1_700_000_000,
  low_fee_per_kb: 10,
  medium_fee_per_kb: 20,
  high_fee_per_kb: 30,
};

const okJson = (payload: unknown) => ({ ok: true, json: async () => payload });

const installFetch = (feePayload: unknown) =>
  vi.fn(async (url: string) => {
    if (url.includes('searchsimple')) {
      return okJson([
        { name: 'JSON.Bridge', identifier: 'coinInfo-BTC' },
      ]) as unknown as Response;
    }
    if (url.includes('/arbitrary/JSON/')) {
      return okJson(feePayload) as unknown as Response;
    }
    return okJson(null) as unknown as Response;
  });

describe('isValidFeeEstimate', () => {
  it('accepts a fully-formed estimate', () => {
    expect(isValidFeeEstimate(estimate)).toBe(true);
  });

  it('rejects null and non-objects', () => {
    expect(isValidFeeEstimate(null)).toBe(false);
    expect(isValidFeeEstimate('nope')).toBe(false);
    expect(isValidFeeEstimate(42)).toBe(false);
  });

  it('rejects objects with a missing or non-numeric field', () => {
    const { high_fee_per_kb, ...missing } = estimate;
    void high_fee_per_kb;
    expect(isValidFeeEstimate(missing)).toBe(false);
    expect(isValidFeeEstimate({ ...estimate, medium_fee_per_kb: '20' })).toBe(
      false
    );
  });

  it.each([0, -1, NaN, Infinity])('rejects unusable fee rates %s', (rate) => {
    expect(isValidFeeEstimate({ ...estimate, medium_fee_per_kb: rate })).toBe(
      false
    );
  });
});

describe('useRecommendedFees', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('does not fetch and yields null data when no coin is selected', async () => {
    const fetchMock = installFetch(estimate);
    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() =>
      useRecommendedFees({ selectedCoin: null })
    );

    expect(result.current.data).toBeNull();
    expect(result.current.currentFee).toBeNull();
    // Give any (unexpected) effect a chance to run.
    await act(async () => {});
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('fetches the publisher resource then the fee JSON and exposes the estimate', async () => {
    const fetchMock = installFetch(estimate);
    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() =>
      useRecommendedFees({ selectedCoin: 'BTC' })
    );

    await waitFor(() => expect(result.current.data).not.toBeNull());

    expect(result.current.data).toEqual(estimate);
    // Default fee type is "medium".
    expect(result.current.selectFeeType).toBe('medium');
    expect(result.current.currentFee).toBe(20);

    const urls = fetchMock.mock.calls.map((c) => c[0] as string);
    expect(urls.some((u) => u.includes('searchsimple'))).toBe(true);
    expect(urls.some((u) => u.includes('/arbitrary/JSON/'))).toBe(true);
  });

  it('maps the selected fee type to the matching estimate field', async () => {
    vi.stubGlobal('fetch', installFetch(estimate));

    const { result } = renderHook(() =>
      useRecommendedFees({ selectedCoin: 'BTC' })
    );
    await waitFor(() => expect(result.current.data).not.toBeNull());

    act(() => result.current.setSelectFeeType('high'));
    expect(result.current.currentFee).toBe(30);

    act(() => result.current.setSelectFeeType('low'));
    expect(result.current.currentFee).toBe(10);
  });

  it('returns the custom fee when the fee type is "custom"', async () => {
    vi.stubGlobal('fetch', installFetch(estimate));

    const { result } = renderHook(() =>
      useRecommendedFees({ selectedCoin: 'BTC' })
    );
    await waitFor(() => expect(result.current.data).not.toBeNull());

    act(() => {
      result.current.setSelectFeeType('custom');
      result.current.setCustomFee(123);
    });

    expect(result.current.currentFee).toBe(123);
  });

  it('treats an invalid fee payload as no data', async () => {
    vi.stubGlobal('fetch', installFetch({ height: 1 })); // missing fields

    const { result } = renderHook(() =>
      useRecommendedFees({ selectedCoin: 'BTC' })
    );

    // Let the fetch chain resolve.
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(result.current.data).toBeNull();
    expect(result.current.currentFee).toBeNull();
  });

  it('does not apply an old publisher response after switching publisher', async () => {
    let finish!: (value: unknown) => void;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url.includes('searchsimple'))
          return okJson([
            {
              name: url.includes('Foreign-Fee-Publisher')
                ? 'Foreign-Fee-Publisher'
                : 'JSON.Bridge',
              identifier: 'coinInfo-BTC',
            },
          ]);
        if (url.includes('/JSON/JSON.Bridge/'))
          return new Promise((resolve) => {
            finish = resolve;
          });
        return okJson({ ...estimate, medium_fee_per_kb: 99 });
      })
    );
    const { result } = renderHook(() =>
      useRecommendedFees({ selectedCoin: 'BTC' })
    );
    await waitFor(() => expect(finish).toBeTypeOf('function'));
    act(() => result.current.setSelectedFeePublisher('Foreign-Fee-Publisher'));
    await waitFor(() => expect(result.current.currentFee).toBe(99));
    await act(async () => {
      finish(okJson(estimate));
    });
    expect(result.current.currentFee).toBe(99);
  });

  it('clears the previous coin quote immediately while the next coin is loading', async () => {
    const fetch = installFetch(estimate);
    vi.stubGlobal('fetch', fetch);
    const { result, rerender } = renderHook(
      ({ coin }) => useRecommendedFees({ selectedCoin: coin }),
      { initialProps: { coin: 'BTC' } }
    );
    await waitFor(() => expect(result.current.currentFee).toBe(20));
    fetch.mockImplementation(() => new Promise(() => {}));
    rerender({ coin: 'LTC' });
    expect(result.current.currentFee).toBeNull();
    expect(result.current.data).toBeNull();
  });
});
