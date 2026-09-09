export const getQortalRequestErrorMessage = (error: unknown): string | null => {
  if (typeof error === 'string') {
    const message = error.trim();
    return message || null;
  }

  if (typeof error !== 'object' || error === null) return null;

  const candidate = error as { error?: unknown; message?: unknown };
  for (const value of [candidate.message, candidate.error]) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }

  return null;
};
