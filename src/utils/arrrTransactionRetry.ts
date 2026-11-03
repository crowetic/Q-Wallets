export const ARRR_TRANSACTION_RETRY_DELAY_MS = 5000;

type Wait = (delayMs: number) => Promise<void>;

const wait: Wait = (delayMs) =>
  new Promise((resolve) => window.setTimeout(resolve, delayMs));

const apiError = (value: unknown): unknown | null => {
  if (!value || typeof value !== 'object') return null;

  const error = (value as { error?: unknown }).error;
  return error ? value : null;
};

const errorText = (error: unknown) => {
  if (error instanceof Error) return error.message.toLowerCase();
  if (!error || typeof error !== 'object') return String(error).toLowerCase();

  const record = error as { error?: unknown; message?: unknown };
  return `${String(record.error ?? '')} ${String(record.message ?? '')}`
    .trim()
    .toLowerCase();
};

export const isTransientArrrTransactionError = (error: unknown) => {
  const message = errorText(error);
  return [
    'timeout',
    'timed out',
    'wallet lock busy',
    'wallet busy',
    'switch in progress',
    'not initialized',
    "isn't initialized",
  ].some((fragment) => message.includes(fragment));
};

type ArrrTransactionResponse = {
  outputs?: Array<{ address?: unknown }>;
};

export const hasUnresolvedArrrRecipients = (response: unknown): boolean => {
  if (!Array.isArray(response)) return false;

  return response.some((transaction: ArrrTransactionResponse) =>
    transaction?.outputs?.some((output) => output?.address === '[UNKNOWN]')
  );
};

/**
 * Retries once after the host's fixed request timeout. If the Core request
 * finishes after the host stops waiting, the retry resolves from Core's cache
 * instead of repeating the native work.
 */
export const requestArrrTransactionsWithRetry = async <T>(
  request: () => Promise<T>,
  waitForRetry: Wait = wait
): Promise<T> => {
  const requestOnce = async () => {
    const response = await request();
    const error = apiError(response);
    if (error) throw error;
    return response;
  };

  try {
    return await requestOnce();
  } catch (error) {
    if (!isTransientArrrTransactionError(error)) throw error;
    await waitForRetry(ARRR_TRANSACTION_RETRY_DELAY_MS);
    return requestOnce();
  }
};
