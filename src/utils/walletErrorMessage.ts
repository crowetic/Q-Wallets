/** Display the host's error message without serializing a wallet request or arbitrary object. */
export const walletErrorMessage = (
  error: unknown,
  fallback: string
): string => {
  let message: unknown = error;
  if (error && typeof error === 'object') {
    const record = error as { message?: unknown; error?: unknown };
    message = record.message ?? record.error;
    if (message && typeof message === 'object') {
      message = (message as { message?: unknown }).message;
    }
  }
  if (typeof message !== 'string' || !message.trim()) return fallback;
  // Never render an HTML error page or stringify the full response payload.
  if (/<\/?[a-z][^>]*>/i.test(message)) return fallback;
  return message
    .trim()
    .replace(
      /(["']?(?:entropy58|arrrSeed58|seedPhrase|privateKey|apiKey|foreignKey)["']?\s*[:=]\s*)(?:"[^"]*"|'[^']*'|[^\s&,}]+)/gi,
      '$1…'
    )
    .slice(0, 1000);
};
