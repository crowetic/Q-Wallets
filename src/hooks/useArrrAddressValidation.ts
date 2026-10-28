import { useEffect, useMemo, useState } from 'react';
import { validateArrrAddress } from '../utils/addressValidation';

type ValidationStatus =
  | 'idle'
  | 'pending'
  | 'valid'
  | 'invalid'
  | 'unavailable';
type ValidationQuery = { address: string; enabled: boolean };
type ValidationResult = {
  query: ValidationQuery | null;
  status: ValidationStatus;
};

/** Each result belongs to one exact recipient; obsolete results cannot enable sending. */
export const useArrrAddressValidation = (address: string, enabled = true) => {
  const recipient = address.trim();
  const query = useMemo(
    () => ({ address: recipient, enabled }),
    [recipient, enabled]
  );
  const [result, setResult] = useState<ValidationResult>({
    query: null,
    status: 'idle',
  });

  useEffect(() => {
    if (!query.enabled || !query.address) return;
    const controller = new AbortController();
    let current = true;
    const timer = window.setTimeout(async () => {
      try {
        const valid = await validateArrrAddress(
          query.address,
          controller.signal
        );
        if (current) {
          setResult({
            query,
            status: valid ? 'valid' : 'invalid',
          });
        }
      } catch {
        if (current) setResult({ query, status: 'unavailable' });
      }
    }, 350);
    return () => {
      current = false;
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  const status: ValidationStatus =
    !enabled || !recipient
      ? 'idle'
      : result.query === query
        ? result.status
        : 'pending';
  return { address: recipient, status };
};
