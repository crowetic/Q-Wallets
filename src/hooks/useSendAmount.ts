import { useCallback, useState } from 'react';

/** Keep a Max selection in step with fees/balance until the user edits it. */
export const useSendAmount = (maxSendable: number) => {
  const [selection, setSelection] = useState({ amount: 0, max: false });
  const setAmount = useCallback((amount: number) => {
    setSelection({ amount, max: false });
  }, []);
  const sendMax = useCallback(() => {
    setSelection({ amount: 0, max: true });
  }, []);

  return {
    amount: selection.max ? maxSendable : selection.amount,
    setAmount,
    sendMax,
  };
};
