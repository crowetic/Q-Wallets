import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useSendAmount } from '../useSendAmount';
import { calculateMaxSendable } from '../../utils/maxSendable';
import { calculateSendFee } from '../../utils/sendFee';

describe('Send Max selection', () => {
  it('tracks fee increases, decreases and balance changes after selecting Max', () => {
    const { result, rerender } = renderHook(
      ({ balance, rate }) => {
        const fee = calculateSendFee(rate, 500);
        return useSendAmount(
          calculateMaxSendable(balance, fee?.estimatedFee ?? NaN, 1000)
        );
      },
      { initialProps: { balance: 1, rate: 1000 } }
    );
    act(() => result.current.sendMax());
    expect(result.current.amount).toBe(0.999985);
    rerender({ balance: 1, rate: 10000 });
    expect(result.current.amount).toBe(0.99994);
    rerender({ balance: 2, rate: 1000 });
    expect(result.current.amount).toBe(1.999985);
  });

  it('keeps manually entered amounts and resets separate from Max mode', () => {
    const { result, rerender } = renderHook(({ max }) => useSendAmount(max), {
      initialProps: { max: 0.9 },
    });
    act(() => result.current.sendMax());
    act(() => result.current.setAmount(0.5));
    rerender({ max: 0.8 });
    expect(result.current.amount).toBe(0.5);
    act(() => result.current.setAmount(0));
    rerender({ max: 0.7 });
    expect(result.current.amount).toBe(0);
  });

  it('waits for valid fees and becomes zero when funds cannot cover them', () => {
    const { result, rerender } = renderHook(({ max }) => useSendAmount(max), {
      initialProps: { max: 0 },
    });
    act(() => result.current.sendMax());
    expect(result.current.amount).toBe(0);
    rerender({ max: 0.9 });
    expect(result.current.amount).toBe(0.9);
    rerender({ max: 0 });
    expect(result.current.amount).toBe(0);
  });
});
