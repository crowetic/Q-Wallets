import { base64ToObject, Coin, objectToBase64 } from 'qapp-core';
import { AddressBookCoin, AddressBookEntry } from './Types';
import type { AddressBookLocalStorage } from './addressBookStorage';
import {
  createAddressBookSyncSignature,
  getAddressBook,
  getAddressBookPublishedHashKey,
  getAddressBookSyncBaselineKey,
  getAddressBookStorageKey,
  getAddressBookSyncRequiredKey,
  saveAddressBookSnapshot,
} from './addressBookStorage';

/**
 * Get all available coin types from the Coin enum
 */
function getAvailableCoins(): AddressBookCoin[] {
  return [...Object.values(Coin), 'XMR'];
}

/**
 * Get the current authenticated username
 * This uses qortalRequest to avoid React hook dependency
 */
async function getCurrentUserName(): Promise<string | null> {
  try {
    const response = await qortalRequest({
      action: 'GET_USER_ACCOUNT',
    });
    return response?.name || null;
  } catch (error) {
    console.error('QDN Sync: Failed to get username', error);
    return null;
  }
}

/**
 * Data structure for QDN storage
 * Includes entries, timestamp, and optional hash for conflict detection
 */
export interface AddressBookQDNData {
  coinType?: string; // Guards against QDN returning a resource for the wrong coin
  entries: AddressBookEntry[];
  lastUpdated: number; // Unix timestamp
  hash?: string; // Optional: hash of entries for quick comparison
}

/**
 * Debounce timeouts for each coin type
 */
let publishTimeouts: { [coinType: string]: NodeJS.Timeout } = {};

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

const normalizeEntryForHash = (entry: AddressBookEntry) => ({
  address: entry.address.trim(),
  coinType: entry.coinType,
  favorite: Boolean(entry.favorite),
  favoriteAt: isFiniteNumber(entry.favoriteAt) ? entry.favoriteAt : undefined,
  id: entry.id,
  name: entry.name.trim(),
  note: (entry.note || '').trim(),
  sortOrder: isFiniteNumber(entry.sortOrder) ? entry.sortOrder : undefined,
});

/**
 * Generates a hash of the entries for quick comparison.
 * Sorts entries by ID for stable hashing and ignores internal timestamps.
 */
function generateHash(entries: AddressBookEntry[]): string {
  // Sort entries by ID so hashes are stable when the same entries are loaded.
  const sortedEntries = [...entries]
    .map(normalizeEntryForHash)
    .sort((a, b) => a.id.localeCompare(b.id));
  const dataString = JSON.stringify(sortedEntries);

  // Simple hash function (djb2 algorithm variant)
  let hash = 0;
  for (let i = 0; i < dataString.length; i++) {
    const char = dataString.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return hash.toString(36);
}

/**
 * Encrypts and publishes the address book to QDN
 * Gracefully handles errors without throwing
 * @param coinType - The coin type (BTC, DOGE, etc.)
 * @param entries - The address book entries to publish
 * @param userName - Optional username (if not provided, will attempt to fetch)
 */
function markSyncRequired(
  coinType: string,
  cleanBaselineEntries?: AddressBookEntry[]
): void {
  localStorage.setItem(getAddressBookSyncRequiredKey(coinType), 'true');
  if (cleanBaselineEntries) {
    localStorage.setItem(
      getAddressBookSyncBaselineKey(coinType),
      createAddressBookSyncSignature(cleanBaselineEntries)
    );
    return;
  }

  localStorage.removeItem(getAddressBookSyncBaselineKey(coinType));
}

function clearSyncRequired(coinType: string): void {
  localStorage.removeItem(getAddressBookSyncRequiredKey(coinType));
}

async function publishToQDN(
  coinType: string,
  entries: AddressBookEntry[],
  userName?: string
): Promise<number | null> {
  try {
    // Get user name from parameter or fetch it
    const actualUserName = userName || (await getCurrentUserName());

    if (!actualUserName) {
      console.error('QDN Sync: No authenticated user found');
      return null;
    }

    // Capture the timestamp now so QDN data and the returned value share
    // the same value — callers use it to align localStorage with QDN.
    const lastUpdated = Date.now();
    const hash = generateHash(entries);

    // Prepare data object with metadata
    const qdnData: AddressBookQDNData = {
      coinType,
      entries,
      lastUpdated,
      hash,
    };

    // Convert to base64 (UTF-8 safe)
    const base64 = await objectToBase64(qdnData);

    // Encrypt with user's private key
    const encryptedData = await qortalRequest({
      action: 'ENCRYPT_DATA',
      base64,
    });

    // Publish to QDN
    await qortalRequest({
      action: 'PUBLISH_QDN_RESOURCE',
      base64: encryptedData,
      name: actualUserName,
      service: 'DOCUMENT_PRIVATE',
      identifier: `q-wallets-addressbook-${coinType}`,
    });

    // Record the published hash so future startup syncs can detect when QDN
    // is temporarily unavailable vs genuinely missing.
    localStorage.setItem(getAddressBookPublishedHashKey(coinType), hash);
    clearSyncRequired(coinType);

    console.log(
      `QDN Sync: Published ${coinType} address book for user ${actualUserName}`
    );
    return lastUpdated;
  } catch (error) {
    console.error(`QDN Sync Error (Publish ${coinType}):`, error);
    // Don't throw - allow localStorage to continue working
    return null;
  }
}

/**
 * Retrieves and decrypts the address book from QDN
 * Returns null on error or if no data exists
 * @param coinType - The coin type (BTC, DOGE, etc.)
 * @param userName - Optional username (if not provided, will attempt to fetch)
 */
async function fetchFromQDN(
  coinType: string,
  userName?: string
): Promise<AddressBookQDNData | null> {
  try {
    // Get user name from parameter or fetch it
    const actualUserName = userName || (await getCurrentUserName());

    if (!actualUserName) {
      console.error('QDN Sync: No authenticated user found');
      return null;
    }

    // Fetch encrypted data from QDN
    let encryptedBase64;
    try {
      encryptedBase64 = await qortalRequest({
        action: 'FETCH_QDN_RESOURCE',
        identifier: `q-wallets-addressbook-${coinType}`,
        service: 'DOCUMENT_PRIVATE',
        name: actualUserName,
        encoding: 'base64',
      });
    } catch (fetchError: any) {
      // Handle expected "resource not found" errors silently
      // This includes: 404 errors, 1401 errors, and "Couldn't find PUT transaction" messages
      const isResourceNotFound =
        fetchError?.message?.includes('404') ||
        fetchError?.status === 404 ||
        fetchError?.error === 1401 ||
        fetchError?.message?.includes("Couldn't find PUT transaction");

      if (isResourceNotFound) {
        // This is expected when no data has been published yet - don't log as error
        return null;
      }

      // Re-throw unexpected errors
      console.error(
        `QDN Sync: Unexpected error fetching ${coinType}:`,
        fetchError
      );
      throw fetchError;
    }

    if (!encryptedBase64) {
      console.log(`QDN Sync: No data found for ${coinType}`);
      return null;
    }

    console.log(
      `QDN Sync: Fetched encrypted data for ${coinType}, decrypting...`
    );

    // Decrypt data (returns the original base64 string)
    let decryptedBase64;
    try {
      decryptedBase64 = await qortalRequest({
        action: 'DECRYPT_DATA',
        encryptedData: encryptedBase64,
      });

      if (!decryptedBase64) {
        console.warn(
          `QDN Sync: DECRYPT_DATA returned empty result for ${coinType}. The data may be from an incompatible version.`
        );
        return null;
      }
    } catch (decryptError: any) {
      console.warn(
        `QDN Sync: Failed to decrypt ${coinType} data. The data may be from an incompatible version.`
      );
      return null;
    }

    // Try to parse the decrypted data
    let qdnData: AddressBookQDNData;

    // First, check if it's already a JSON object
    if (typeof decryptedBase64 === 'object' && decryptedBase64.entries) {
      qdnData = decryptedBase64;
    } else if (typeof decryptedBase64 === 'string') {
      try {
        qdnData = JSON.parse(decryptedBase64);
      } catch (jsonError) {
        // Not JSON, assume it's base64-encoded
        try {
          qdnData = base64ToObject(decryptedBase64) as AddressBookQDNData;
        } catch (base64Error) {
          console.error(
            `QDN Sync: Failed to parse decrypted data for ${coinType}:`,
            base64Error
          );
          throw new Error(
            `Unable to parse decrypted QDN data for ${coinType}. Data format mismatch.`
          );
        }
      }
    } else {
      throw new Error(
        `Unexpected decrypted data type: ${typeof decryptedBase64}`
      );
    }

    // Reject resources that carry a different coinType. This guards against
    // the Qortal node returning a resource for a different identifier when the
    // requested one is not yet available (e.g. during propagation).
    // Primary check: top-level coinType field (present in resources published
    // after the fix was deployed).
    if (qdnData.coinType && qdnData.coinType !== coinType) {
      console.warn(
        `QDN Sync: Fetched resource for "${coinType}" contains coinType "${qdnData.coinType}", discarding`
      );
      return null;
    }
    // Secondary check: entries' coinType field (covers older QDN resources that
    // predate the top-level coinType field).
    if (qdnData.entries.some((e) => e.coinType !== coinType)) {
      console.warn(
        `QDN Sync: Fetched resource for "${coinType}" contains entries with wrong coinType, discarding`
      );
      return null;
    }

    return qdnData;
  } catch (error) {
    console.error(`QDN Sync Error (Fetch ${coinType}):`, error);
    return null;
  }
}

/**
 * Syncs a single address book on startup.
 * This startup path is read-only for QDN: it can fetch newer remote data or
 * mark local data as needing a user-initiated sync, but it must not publish
 * because publishing opens a fee-bearing Qortal permission dialog.
 * @param coinType - The coin type to sync
 * @param userName - Optional username (if not provided, will attempt to fetch)
 */
async function syncAddressBookOnStartup(
  coinType: string,
  userName?: string
): Promise<void> {
  try {
    // Get data from both sources
    const localEntries = getAddressBook(coinType as AddressBookCoin);
    const qdnData = await fetchFromQDN(coinType, userName);

    // If no QDN data exists, leave local data alone and wait for an
    // explicit user sync instead of opening a publish permission dialog.
    if (!qdnData) {
      if (localEntries.length > 0) {
        // Last successful publish sentinel prevents a repeated permission dialog.
        const lastPublishedHash = localStorage.getItem(
          getAddressBookPublishedHashKey(coinType)
        );
        if (lastPublishedHash === generateHash(localEntries)) {
          clearSyncRequired(coinType);
          console.log(
            `QDN Sync: ${coinType} QDN unavailable but content matches last publish, skipping`
          );
          return;
        }
        console.log(
          `QDN Sync: No QDN data for ${coinType}; manual sync required`
        );
        markSyncRequired(coinType);
      }
      return;
    }

    // Get local last updated timestamp from localStorage metadata
    const localStorageKey = getAddressBookStorageKey(coinType);
    const localData = localStorage.getItem(localStorageKey);
    let localLastUpdated = 0;

    if (localData) {
      try {
        const parsed: AddressBookLocalStorage = JSON.parse(localData);
        localLastUpdated = parsed.lastUpdated || 0;
      } catch (e) {
        console.error('QDN Sync: Error parsing local data', e);
      }
    }

    // Compare timestamps to determine which is newer
    const qdnLastUpdated = qdnData.lastUpdated || 0;

    if (qdnLastUpdated > localLastUpdated) {
      // QDN data is newer, update localStorage
      console.log(
        `QDN Sync: QDN data is newer for ${coinType}, updating localStorage`
      );

      saveAddressBookSnapshot(coinType, qdnData.entries, qdnData.lastUpdated);
      clearSyncRequired(coinType);
    } else if (localLastUpdated > qdnLastUpdated) {
      // Local timestamp is newer, mirroring master's decision tree without
      // auto-publishing. If content differs, keep local and ask the user to
      // sync manually instead of opening a publish permission dialog.
      const localHash = generateHash(localEntries);
      const qdnHash = qdnData.hash ?? generateHash(qdnData.entries);
      if (localHash === qdnHash) {
        clearSyncRequired(coinType);
        console.log(
          `QDN Sync: ${coinType} timestamps differ but content is identical, skipping publish`
        );
        // Re-align local timestamp to QDN so future startups go straight to the
        // hash-comparison path instead of re-evaluating timestamps
        saveAddressBookSnapshot(coinType, localEntries, qdnData.lastUpdated);
      } else if (
        localHash ===
        localStorage.getItem(getAddressBookPublishedHashKey(coinType))
      ) {
        clearSyncRequired(coinType);
        console.log(
          `QDN Sync: ${coinType} local snapshot matches last publish; waiting for QDN propagation`
        );
      } else {
        console.log(
          `QDN Sync: Local ${coinType} data is newer and differs from QDN; manual sync required`
        );
        markSyncRequired(coinType, qdnData.entries);
      }
    } else {
      // Same timestamp - use hash comparison if available
      if (qdnData.hash && localData) {
        const localHash = generateHash(localEntries);
        if (localHash !== qdnData.hash) {
          console.log(
            `QDN Sync: Hash mismatch for ${coinType}, using QDN data`
          );
          saveAddressBookSnapshot(
            coinType,
            qdnData.entries,
            qdnData.lastUpdated
          );
        }
      }
      clearSyncRequired(coinType);
      console.log(`QDN Sync: ${coinType} data is in sync`);
    }
  } catch (error) {
    console.error(`QDN Sync Error (Startup ${coinType}):`, error);
    // Don't throw - allow app to continue with localStorage only
  }
}

/**
 * Syncs all coin address books on app startup
 * Runs in parallel for better performance
 * @param userName - Optional username from useAuth() hook (recommended to avoid extra API calls)
 */
export async function syncAllAddressBooksOnStartup(
  userName?: string
): Promise<void> {
  // Get all supported coin types from the Coin enum
  const coinTypes = getAvailableCoins();

  console.log('QDN Sync: Starting sync for all address books...');

  try {
    // Sync all coin types in parallel
    await Promise.all(
      coinTypes.map((coinType) => syncAddressBookOnStartup(coinType, userName))
    );

    console.log('QDN Sync: All address books synced');
  } catch (error) {
    console.error('QDN Sync: Error during startup sync', error);
    // Don't throw - allow app to continue
  }
}

/**
 * Debounced version of publishToQDN
 * Delays publish to avoid excessive network calls during rapid changes
 */
export function debouncedPublishToQDN(
  coinType: string,
  entries: AddressBookEntry[],
  delay = 2000
): void {
  // Clear existing timeout for this coin type
  if (publishTimeouts[coinType]) {
    clearTimeout(publishTimeouts[coinType]);
  }

  // Set new timeout.
  // publishToQDN never throws (errors are caught internally), but keep the
  // .catch() as a safety net. The returned timestamp is intentionally ignored
  // here: after a successful debounced publish QDN's timestamp is always
  // greater than the local lastUpdated (which was set at mutation time), so
  // the next startup sync correctly treats QDN as newer and refreshes local.
  publishTimeouts[coinType] = setTimeout(() => {
    publishToQDN(coinType, entries).catch((err) =>
      console.error('QDN Sync: Failed to publish:', err)
    );
  }, delay);
}

export { publishToQDN };
