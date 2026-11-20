// XMR uses 12 decimal places. Keep all monetary values as integer strings.
export interface XmrWallet {
  address: string;
  network: 'stagenet' | 'mainnet';
}
export interface XmrPayment {
  txId: string;
  recipient: string;
  amountAtomic: string;
  feeAtomic: string;
}
export interface XmrTransaction {
  txId: string;
  incoming: boolean;
  amountAtomic: string;
  feeAtomic: string;
  confirmations: number;
  timestamp: number | null;
}
export interface XmrStatus {
  network: 'stagenet';
  address: string;
  daemonUrl: string;
  initialized: boolean;
  syncing: boolean;
  synced: boolean;
  walletHeight: number;
  daemonHeight: number;
  progress: number;
  balanceAtomic: string;
  unlockedBalanceAtomic: string;
  transactions: XmrTransaction[];
  pending: XmrPayment | null;
  error: string | null;
}
const unit = 1000000000000n;
export const atomicAmount = (value: string): bigint => {
  if (!/^(0|[1-9][0-9]{0,7})(\.[0-9]{1,12})?$/.test(value))
    throw new Error('invalid');
  const [whole, fraction = ''] = value.split('.');
  const amount = BigInt(whole) * unit + BigInt(fraction.padEnd(12, '0'));
  if (amount <= 0n || amount > 18446744073709551615n)
    throw new Error('invalid');
  return amount;
};
export const decimalAmount = (value: string): string => {
  if (
    typeof value !== 'string' ||
    !/^(0|[1-9][0-9]{0,19})$/.test(value) ||
    BigInt(value) > 18446744073709551615n
  )
    throw new Error('invalid');
  const amount = BigInt(value);
  const fraction = (amount % unit)
    .toString()
    .padStart(12, '0')
    .replace(/0+$/, '');
  return (amount / unit).toString() + (fraction ? '.' + fraction : '');
};

// Normalize human input at the UI boundary; the Hub still receives strict decimal
// strings. Never pass through Number/parseFloat or round extra decimal places.
export const paymentAmount = (value: string): string => {
  const input = value.trim();
  return decimalAmount(
    atomicAmount(input.startsWith('.') ? `0${input}` : input).toString()
  );
};

export const maxPaymentAmount = (unlocked: string, maxFee: string): string => {
  try {
    const fee = atomicAmount(paymentAmount(maxFee));
    if (fee > unit) return '0';
    decimalAmount(unlocked);
    const available = BigInt(unlocked) - fee;
    return available > 0n ? decimalAmount(available.toString()) : '0';
  } catch {
    return '0';
  }
};

export type PaymentErrors = Partial<
  Record<'recipient' | 'amount' | 'maxFee', string>
>;

export const validatePayment = (
  input: { recipient: string; amount: string; maxFee: string },
  unlocked: string
) => {
  const errors: PaymentErrors = {};
  const recipient = input.recipient.trim();
  let amount = '';
  let maxFee = '';
  if (!/^[1-9A-HJ-NP-Za-km-z]{95}$/.test(recipient))
    errors.recipient = 'core:xmr.invalid_recipient';
  try {
    amount = paymentAmount(input.amount);
  } catch {
    errors.amount = 'core:xmr.invalid_amount';
  }
  try {
    maxFee = paymentAmount(input.maxFee);
    if (atomicAmount(maxFee) > unit) throw new Error('invalid');
  } catch {
    errors.maxFee = 'core:xmr.invalid_fee';
  }
  if (
    !errors.amount &&
    !errors.maxFee &&
    atomicAmount(amount) + atomicAmount(maxFee) > BigInt(unlocked)
  )
    errors.amount = 'core:xmr.insufficient_unlocked';
  return { errors, payment: { recipient, amount, maxFee } };
};
export const checkedReply = <T>(reply: T): T => {
  if (
    reply &&
    typeof reply === 'object' &&
    'error' in reply &&
    !('network' in reply)
  ) {
    const value = reply as { error?: unknown; message?: unknown };
    throw new Error(
      typeof value.message === 'string'
        ? value.message
        : typeof value.error === 'string'
          ? value.error
          : 'XMR'
    );
  }
  return reply;
};
export const publicWallet = (reply: unknown): XmrWallet => {
  const wallet = checkedReply(reply) as XmrWallet;
  if (
    !wallet ||
    !/^[1-9A-HJ-NP-Za-km-z]{95}$/.test(wallet.address) ||
    !['stagenet', 'mainnet'].includes(wallet.network)
  )
    throw new Error('XMR');
  return { address: wallet.address, network: wallet.network };
};
export const walletStatus = (reply: unknown, address: string): XmrStatus => {
  const status = checkedReply(reply) as XmrStatus;
  if (
    !status ||
    status.network !== 'stagenet' ||
    status.address !== address ||
    typeof status.initialized !== 'boolean' ||
    typeof status.synced !== 'boolean' ||
    typeof status.syncing !== 'boolean' ||
    !Number.isSafeInteger(status.walletHeight) ||
    status.walletHeight < 0 ||
    !Number.isSafeInteger(status.daemonHeight) ||
    status.daemonHeight < 0 ||
    !Number.isFinite(status.progress) ||
    status.progress < 0 ||
    status.progress > 1 ||
    !Array.isArray(status.transactions) ||
    status.transactions.length > 100
  )
    throw new Error('XMR');
  decimalAmount(status.balanceAtomic);
  decimalAmount(status.unlockedBalanceAtomic);
  for (const tx of status.transactions) {
    if (
      !/^[a-f0-9]{64}$/.test(tx.txId) ||
      typeof tx.incoming !== 'boolean' ||
      !Number.isSafeInteger(tx.confirmations) ||
      tx.confirmations < 0 ||
      (tx.timestamp !== null &&
        (!Number.isSafeInteger(tx.timestamp) ||
          tx.timestamp < 0 ||
          tx.timestamp > 8640000000000))
    )
      throw new Error('XMR');
    decimalAmount(tx.amountAtomic);
    decimalAmount(tx.feeAtomic);
  }
  if (status.pending) {
    if (
      !/^[a-f0-9]{64}$/.test(status.pending.txId) ||
      !/^[1-9A-HJ-NP-Za-km-z]{95}$/.test(status.pending.recipient)
    )
      throw new Error('XMR');
    decimalAmount(status.pending.amountAtomic);
    decimalAmount(status.pending.feeAtomic);
  }
  return status;
};
