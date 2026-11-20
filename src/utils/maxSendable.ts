const UNITS = 100000000n;

// Parse balance strings before Number conversion. Extra balance decimals round
// down; extra fee decimals round up, so neither can increase the maximum.
const atomicUnits = (
  value: number | string,
  roundUp = false
): bigint | null => {
  if (typeof value !== 'number' && typeof value !== 'string') return null;
  if (typeof value === 'number' && (!Number.isFinite(value) || value < 0))
    return null;
  const text =
    typeof value === 'number'
      ? /e/i.test(String(value))
        ? value.toFixed(24)
        : String(value)
      : value.trim();
  if (text.length > 128 || !/^\d+(\.\d+)?$/.test(text)) return null;
  const [whole, fraction = ''] = text.split('.');
  return (
    BigInt(whole) * UNITS +
    BigInt(fraction.slice(0, 8).padEnd(8, '0')) +
    (roundUp && /[1-9]/.test(fraction.slice(8)) ? 1n : 0n)
  );
};

export const canRequestMax = (balance: number | string): boolean => {
  const units = atomicUnits(balance);
  return units !== null && units > 0n;
};

/** Conservative eight-decimal preview/manual limit, retaining the safety buffer.
 * Native UTXO Max requests let Hub compute the final fee from its inputs. */
export const calculateMaxSendable = (
  balance: number | string,
  fee: number | string,
  bufferSats = 0
): number => {
  const balanceSats = atomicUnits(balance);
  const feeSats = atomicUnits(fee, true);
  if (
    balanceSats === null ||
    feeSats === null ||
    !Number.isSafeInteger(bufferSats)
  )
    return 0;
  const hostBalance = Number(balance) * Number(UNITS);
  if (!Number.isFinite(hostBalance)) return 0;
  const hostBalanceSats = BigInt(Math.round(hostBalance));
  let maximum =
    (balanceSats < hostBalanceSats ? balanceSats : hostBalanceSats) -
    feeSats -
    BigInt(Math.max(0, bufferSats));
  // Not every atomic value at large balances is representable by legacy Number
  // bridges. Step down rather than rounding above their spendable boundary.
  for (let attempt = 0; attempt < 4 && maximum > 0n; attempt++) {
    const amount = Number(
      `${maximum / UNITS}.${(maximum % UNITS).toString().padStart(8, '0')}`
    );
    const decimalUnits = atomicUnits(amount, true);
    const hostUnits = amount * Number(UNITS);
    if (
      decimalUnits !== null &&
      decimalUnits <= maximum &&
      Number.isFinite(hostUnits) &&
      BigInt(Math.ceil(hostUnits)) <= maximum
    )
      return amount;
    maximum -= BigInt(
      Math.max(1, Math.ceil(Math.abs(amount) * Number.EPSILON * Number(UNITS)))
    );
  }
  return 0;
};
