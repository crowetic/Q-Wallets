import { describe, expect, it } from 'vitest';
import { getQortalRequestErrorMessage } from '../qortalRequestError';

describe('getQortalRequestErrorMessage', () => {
  it('uses the detailed message from a qortalRequest rejection', () => {
    expect(
      getQortalRequestErrorMessage({
        error: 'FOREIGN_SEND_CONFIRMING',
        message: 'The previous payment is waiting for confirmation.',
      })
    ).toBe('The previous payment is waiting for confirmation.');
  });

  it('falls back to a string error field', () => {
    expect(
      getQortalRequestErrorMessage({ error: 'Network is unavailable.' })
    ).toBe('Network is unavailable.');
  });

  it('accepts Error objects and string rejections', () => {
    expect(getQortalRequestErrorMessage(new Error('Request failed.'))).toBe(
      'Request failed.'
    );
    expect(getQortalRequestErrorMessage(' User declined. ')).toBe(
      'User declined.'
    );
  });

  it('returns null when no readable message is available', () => {
    expect(getQortalRequestErrorMessage(null)).toBeNull();
    expect(getQortalRequestErrorMessage({ error: 500 })).toBeNull();
  });
});
