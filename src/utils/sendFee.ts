/** Core accepts whole smallest units per byte, while publishers quote per kB. */
export const calculateSendFee = (
  rate: number,
  estimatedBytes: number,
  unit: 'per-kb' | 'per-byte' = 'per-kb'
): { feePerByte: number; estimatedFee: number; ratePerKb: number } | null => {
  if (!Number.isFinite(rate) || rate <= 0) return null;
  const satsPerByte = Math.ceil(unit === 'per-kb' ? rate / 1000 : rate);
  const reserveSats = satsPerByte * estimatedBytes;
  if (
    !Number.isSafeInteger(satsPerByte) ||
    !Number.isSafeInteger(reserveSats) ||
    reserveSats <= 0
  ) {
    return null;
  }
  return {
    feePerByte: satsPerByte / 1e8,
    estimatedFee: reserveSats / 1e8,
    ratePerKb: satsPerByte * 1000,
  };
};
