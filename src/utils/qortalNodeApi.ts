const QORTAL_API_TIMEOUT_MS = 5000;

export type QortalNameSearchResult = {
  name: string;
  owner: string;
};

export type QortalNameData = {
  name: string;
  owner: string;
};

const fetchJsonWithTimeout = async (url: string, signal?: AbortSignal) => {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => {
    controller.abort();
  }, QORTAL_API_TIMEOUT_MS);
  const abortRequest = () => controller.abort();

  signal?.addEventListener('abort', abortRequest, { once: true });
  if (signal?.aborted) controller.abort();

  try {
    const response = await fetch(url, {
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Qortal API request failed: ${response.status}`);
    }

    return response.json();
  } finally {
    window.clearTimeout(timeoutId);
    signal?.removeEventListener('abort', abortRequest);
  }
};

export const validateArrrRecipientWithCore = async (
  address: string,
  signal?: AbortSignal
): Promise<boolean> => {
  const recipient = address.trim();
  if (!recipient) return false;
  const result = await fetchJsonWithTimeout(
    `/crosschain/arrr/validateaddress?address=${encodeURIComponent(recipient)}`,
    signal
  );
  if (typeof result !== 'boolean') {
    throw new Error('Unexpected Core address validation response');
  }
  return result;
};

const toNameSearchResults = (payload: unknown): QortalNameSearchResult[] => {
  if (!Array.isArray(payload)) return [];

  return payload
    .map((item) => {
      if (!item || typeof item !== 'object') return null;

      const record = item as { name?: unknown; owner?: unknown };
      if (typeof record.name !== 'string' || typeof record.owner !== 'string') {
        return null;
      }

      return {
        name: record.name,
        owner: record.owner,
      };
    })
    .filter((item): item is QortalNameSearchResult => Boolean(item));
};

const toNameData = (payload: unknown): QortalNameData | null => {
  if (!payload || typeof payload !== 'object') return null;

  const record = payload as { name?: unknown; owner?: unknown };
  if (typeof record.name !== 'string' || typeof record.owner !== 'string') {
    return null;
  }

  return {
    name: record.name,
    owner: record.owner,
  };
};

export const getQortalNameData = async (
  name: string,
  signal?: AbortSignal
): Promise<QortalNameData | null> => {
  const trimmedName = name.trim();
  if (!trimmedName) return null;

  let lastError: unknown = null;

  if (signal?.aborted) return null;

  try {
    const payload = await fetchJsonWithTimeout(
      `/names/${encodeURIComponent(trimmedName)}`,
      signal
    );
    const result = toNameData(payload);

    if (result) {
      return result;
    }
  } catch (error) {
    lastError = error;
  }

  const searchResults = await searchQortalNames(trimmedName, 10, signal);
  const exactMatch = searchResults.find(
    (result) => result.name.toLowerCase() === trimmedName.toLowerCase()
  );

  if (exactMatch) {
    return exactMatch;
  }

  if (lastError) {
    console.warn('QORT name lookup failed:', lastError);
  }

  return null;
};

export const searchQortalNames = async (
  query: string,
  limit = 10,
  signal?: AbortSignal
) => {
  const trimmedQuery = query.trim();
  if (!trimmedQuery) return [];

  const params = new URLSearchParams({
    limit: String(limit),
    prefix: 'true',
    query: trimmedQuery,
  });

  if (signal?.aborted) return [];

  try {
    const payload = await fetchJsonWithTimeout(
      `/names/search?${params.toString()}`,
      signal
    );
    return toNameSearchResults(payload);
  } catch (error) {
    console.warn('QORT name search failed:', error);
  }

  return [];
};
