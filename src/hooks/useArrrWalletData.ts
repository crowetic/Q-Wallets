import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Coin } from 'qapp-core';
import {
  TIME_MINUTES_2,
  TIME_MINUTES_3,
  TIME_MINUTES_5,
  TIME_SECONDS_5,
} from '../common/constants';
import type { WalletExternalTransactionRow } from '../components/WalletWorkspace';
import {
  ARRR_TRANSACTION_RETRY_DELAY_MS,
  hasUnresolvedArrrRecipients,
  requestArrrTransactionsWithRetry,
} from '../utils/arrrTransactionRetry';
import { walletErrorMessage } from '../utils/walletErrorMessage';

type LightwalletServer = {
  isCurrent?: boolean;
  hostName: string;
  port: number;
  connectionType: string;
};

const initialData = () => ({
  isSynced: false,
  syncStatus: '',
  walletInfo: { address: '' },
  balance: null as number | null,
  isBalanceLoading: true,
  servers: [] as LightwalletServer[],
  transactions: [] as WalletExternalTransactionRow[],
  isTransactionsLoading: true,
});

/** Stop waiting locally: the host bridge cannot cancel an in-flight Core call. */
const read = <T>(
  options: QortalRequestOptions,
  signal: AbortSignal,
  timeout = TIME_MINUTES_2
): Promise<T> =>
  new Promise((resolve, reject) => {
    if (signal.aborted) return reject(signal.reason);
    const finish = () => {
      window.clearTimeout(timer);
      signal.removeEventListener('abort', abort);
    };
    const abort = () => {
      finish();
      reject(signal.reason);
    };
    const timer = window.setTimeout(() => {
      finish();
      reject(new Error('ARRR wallet read timed out'));
    }, timeout);
    signal.addEventListener('abort', abort, { once: true });
    // Promise.resolve also catches a synchronous bridge failure. Settling the
    // local promise once prevents a late host response from reviving a run.
    Promise.resolve()
      .then(() => {
        signal.throwIfAborted();
        return qortalRequestWithTimeout(options, timeout);
      })
      .then(
        (response: T & { error?: unknown }) => {
          finish();
          if (response?.error) reject(response);
          else resolve(response);
        },
        (error: unknown) => {
          finish();
          reject(error);
        }
      );
  });

const pause = (milliseconds: number, signal: AbortSignal): Promise<void> =>
  new Promise((resolve, reject) => {
    if (signal.aborted) return reject(signal.reason);
    const abort = () => {
      window.clearTimeout(timer);
      reject(signal.reason);
    };
    const timer = window.setTimeout(() => {
      signal.removeEventListener('abort', abort);
      resolve();
    }, milliseconds);
    signal.addEventListener('abort', abort, { once: true });
  });

type Session = {
  stop: () => void;
  refreshBalance: (delay?: number) => Promise<boolean>;
  refreshServers: () => Promise<boolean>;
  refreshTransactions: () => Promise<void>;
};

/** Own every ARRR read and timer for one mounted wallet/account. */
export const useArrrWalletData = (enabled: boolean, account: string | null) => {
  const { t } = useTranslation(['core']);
  const [data, setData] = useState(initialData);
  const [attempt, setAttempt] = useState(0);
  const session = useRef<Session | null>(null);

  useEffect(() => {
    setData(initialData());
    if (!enabled) return;
    const controller = new AbortController();
    const { signal } = controller;
    const update = (changes: Partial<typeof data>) => {
      if (!signal.aborted) setData((previous) => ({ ...previous, ...changes }));
    };
    const log = (operation: string, error: unknown) => {
      if (!signal.aborted) {
        console.warn(
          operation,
          walletErrorMessage(error, 'ARRR request failed')
        );
      }
    };
    // Dialog refreshes and background work share the same pending read.
    let balanceRead: Promise<boolean> | null = null;
    const refreshBalance = (delay = 0): Promise<boolean> => {
      if (signal.aborted) return Promise.resolve(false);
      if (balanceRead) return balanceRead;
      balanceRead = (async () => {
        update({ isBalanceLoading: true });
        try {
          if (delay) await pause(delay, signal);
          const response = await read<unknown>(
            { action: 'GET_WALLET_BALANCE', coin: Coin.ARRR },
            signal
          );
          if (
            (typeof response !== 'string' && typeof response !== 'number') ||
            response === '' ||
            !Number.isFinite(Number(response))
          ) {
            throw new Error('Invalid ARRR balance response');
          }
          update({ balance: Number(response) });
          return true;
        } catch (error) {
          update({ balance: null });
          log('ERROR GET ARRR BALANCE', error);
          return false;
        } finally {
          update({ isBalanceLoading: false });
          balanceRead = null;
        }
      })();
      return balanceRead;
    };

    let serverRead: Promise<boolean> | null = null;
    const refreshServers = (): Promise<boolean> => {
      if (signal.aborted) return Promise.resolve(false);
      if (serverRead) return serverRead;
      serverRead = (async () => {
        try {
          const response = await read<LightwalletServer[]>(
            { action: 'GET_CROSSCHAIN_SERVER_INFO', coin: Coin.ARRR },
            signal
          );
          if (!Array.isArray(response))
            throw new Error('Invalid ARRR server response');
          update({ servers: response });
          return response.some((server) => server.isCurrent);
        } catch (error) {
          log('ERROR GET ARRR SERVERS INFO', error);
          return false;
        } finally {
          serverRead = null;
        }
      })();
      return serverRead;
    };

    let transactionRead: Promise<void> | null = null;
    const refreshTransactions = (): Promise<void> => {
      if (signal.aborted) return Promise.resolve();
      if (transactionRead) return transactionRead;
      transactionRead = (async () => {
        update({ isTransactionsLoading: true });
        const requestTransactions = async () => {
          const response = await read<WalletExternalTransactionRow[]>(
            { action: 'GET_USER_WALLET_TRANSACTIONS', coin: Coin.ARRR },
            signal,
            TIME_MINUTES_5
          );
          if (!Array.isArray(response))
            throw new Error('Invalid ARRR transaction response');
          return response;
        };
        const sort = (rows: WalletExternalTransactionRow[]) =>
          [...rows].sort((a, b) => (b.timestamp ?? 0) - (a.timestamp ?? 0));
        try {
          const response = await requestArrrTransactionsWithRetry(
            requestTransactions,
            (delay) => pause(delay, signal)
          );
          update({
            transactions: sort(response),
            isTransactionsLoading: false,
          });
          if (hasUnresolvedArrrRecipients(response)) {
            // Show usable history before the bounded recipient follow-up.
            await pause(ARRR_TRANSACTION_RETRY_DELAY_MS, signal);
            try {
              update({ transactions: sort(await requestTransactions()) });
            } catch (error) {
              log(
                'ARRR recipient enrichment will continue on the next refresh',
                error
              );
            }
          }
        } catch (error) {
          log('ERROR GET ARRR TRANSACTIONS', error);
        } finally {
          update({ isTransactionsLoading: false });
          transactionRead = null;
        }
      })();
      return transactionRead;
    };

    const pollBalance = async () => {
      while (!signal.aborted) {
        const loaded = await refreshBalance();
        await pause(loaded ? TIME_MINUTES_3 : TIME_SECONDS_5, signal);
      }
    };
    const loadServers = async () => {
      while (!signal.aborted && !(await refreshServers())) {
        await pause(TIME_SECONDS_5, signal);
      }
    };
    const connect = async () => {
      while (!signal.aborted) {
        try {
          const status = await read<string>(
            { action: 'GET_ARRR_SYNC_STATUS' },
            signal
          );
          if (typeof status !== 'string' || !status || status.includes('<'))
            throw new Error('Invalid ARRR sync response');
          if (status === 'Synchronized') {
            const walletInfo = await read<{ address: string }>(
              { action: 'GET_USER_WALLET', coin: Coin.ARRR },
              signal
            );
            if (typeof walletInfo?.address !== 'string' || !walletInfo.address)
              throw new Error('Invalid ARRR wallet response');
            update({ walletInfo, isSynced: true, syncStatus: '' });
            void pollBalance().catch(() => {});
            void loadServers().catch(() => {});
            void refreshTransactions();
            return;
          }
          const key =
            status === 'Not initialized yet'
              ? 'core:message.generic.not_initialized_yet'
              : status === 'Initializing wallet...'
                ? 'core:message.generic.initializing_wallet'
                : null;
          update({
            syncStatus: key ? t(key, { postProcess: 'capitalizeAll' }) : status,
          });
        } catch (error) {
          if (signal.aborted) return;
          log('ERROR INITIALIZING ARRR WALLET; retrying', error);
          update({
            syncStatus: t('core:wallet.reconnecting'),
          });
        }
        // Rejections, error objects and malformed responses all take this path.
        await pause(TIME_SECONDS_5, signal);
      }
    };
    const current = {
      stop: () => controller.abort(),
      refreshBalance,
      refreshServers,
      refreshTransactions,
    };
    session.current = current;
    void connect().catch(() => {});
    return () => {
      controller.abort();
      if (session.current === current) session.current = null;
    };
  }, [enabled, account, attempt, t]);

  const retry = useCallback(() => {
    session.current?.stop();
    setAttempt((value) => value + 1);
  }, []);
  const refreshBalance = useCallback(
    (delay = 0) =>
      session.current?.refreshBalance(delay) ?? Promise.resolve(false),
    []
  );
  const refreshServers = useCallback(
    () => session.current?.refreshServers() ?? Promise.resolve(false),
    []
  );
  const refreshTransactions = useCallback(
    () => session.current?.refreshTransactions() ?? Promise.resolve(),
    []
  );
  return {
    ...data,
    retry,
    refreshBalance,
    refreshServers,
    refreshTransactions,
  };
};
