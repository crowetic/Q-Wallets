/** Require a host-confirmed transaction ID before clearing a payment draft. */
export const requireSendCoinTransactionId = (
  response: unknown,
  fallback: string
): string => {
  const record =
    response && typeof response === 'object'
      ? (response as Record<string, unknown>)
      : null;
  if (record?.error) throw response;
  const txId =
    typeof response === 'string' ? response : (record?.txid ?? record?.txId);
  if (typeof txId !== 'string' || !/^[a-f0-9]{64}$/i.test(txId)) {
    throw new Error(fallback);
  }
  return txId;
};
