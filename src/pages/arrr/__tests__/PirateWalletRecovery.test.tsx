import { StrictMode, type ReactNode } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import PirateWallet from '../index';
import WalletContext, { defaultState } from '../../../contexts/walletContext';
import {
  TIME_MINUTES_2,
  TIME_MINUTES_3,
  TIME_SECONDS_5,
} from '../../../common/constants';

const t = (key: string) => key;
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t }) }));
vi.mock('../../../components/AddressBook/AddressBookDialog', () => ({
  AddressBookDialog: () => null,
}));
vi.mock('../../../components/WalletWorkspace', () => ({
  WalletWorkspace: ({
    address,
    balance,
    rightColumnAfter,
    transactions,
  }: {
    address: string;
    balance: number | null;
    rightColumnAfter: ReactNode;
    transactions: ReactNode;
  }) => (
    <>
      <output data-testid="address">{address}</output>
      <output data-testid="balance">{balance}</output>
      {rightColumnAfter}
      {transactions}
    </>
  ),
  WalletExternalTransactionsList: ({
    rows,
  }: {
    rows: Array<{ txHash: string }>;
  }) => (
    <output data-testid="transactions">
      {rows.map((row) => row.txHash).join(',')}
    </output>
  ),
  WalletTransactionsCard: ({
    children,
    onRefresh,
    isRefreshing,
  }: {
    children: ReactNode;
    onRefresh: () => void;
    isRefreshing: boolean;
  }) => (
    <>
      <button onClick={onRefresh} disabled={isRefreshing}>
        Refresh history
      </button>
      {children}
    </>
  ),
  WalletTransactionsLoader: () => null,
}));

const address = 'synthetic-wallet-address';
const callsFor = (action: string) =>
  vi
    .mocked(qortalRequest)
    .mock.calls.filter(([request]) => request.action === action);
const settle = () => act(async () => {});
const advance = (milliseconds: number) =>
  act(() => vi.advanceTimersByTimeAsync(milliseconds));
const wallet = (account = 'account-a', gateway = false) => (
  <WalletContext.Provider
    value={{ ...defaultState, address: account, isUsingGateway: gateway }}
  >
    <PirateWallet />
  </WalletContext.Provider>
);

describe('ARRR startup recovery', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.stubGlobal(
      'qortalRequest',
      vi.fn(async ({ action }: { action: string }) => {
        if (action === 'GET_ARRR_SYNC_STATUS') return 'Synchronized';
        if (action === 'GET_USER_WALLET') return { address };
        if (action === 'GET_WALLET_BALANCE') return 12;
        if (action === 'GET_CROSSCHAIN_SERVER_INFO')
          return [
            {
              isCurrent: true,
              connectionType: 'SSL',
              hostName: 'lightwallet.test',
              port: 443,
            },
          ];
        return [];
      })
    );
    vi.stubGlobal(
      'qortalRequestWithTimeout',
      (request: Parameters<typeof qortalRequest>[0]) => qortalRequest(request)
    );
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('recovers from a rejected first sync request without changing coins', async () => {
    vi.mocked(qortalRequest).mockRejectedValueOnce(
      new Error('Request timed out')
    );
    render(wallet());
    await settle();
    expect(
      screen.getByRole('button', { name: 'core:action.retry' })
    ).toBeVisible();
    expect(callsFor('GET_ARRR_SYNC_STATUS')).toHaveLength(1);
    await advance(TIME_SECONDS_5);
    expect(screen.getByTestId('address')).toHaveTextContent(address);
    expect(screen.getByTestId('balance')).toHaveTextContent('12');
    expect(screen.getByText('lightwallet.test:443')).toBeVisible();
    expect(callsFor('SEND_COIN')).toHaveLength(0);
  });

  it('paces returned host errors instead of immediately requesting again', async () => {
    vi.mocked(qortalRequest).mockResolvedValueOnce({
      error: 1205,
      message: 'Wallet busy',
    });
    render(wallet());
    await settle();
    expect(callsFor('GET_ARRR_SYNC_STATUS')).toHaveLength(1);
    await advance(TIME_SECONDS_5 - 1);
    expect(callsFor('GET_ARRR_SYNC_STATUS')).toHaveLength(1);
    await advance(1);
    expect(screen.getByTestId('address')).toHaveTextContent(address);
  });

  it('stops polling when the user leaves ARRR while it is connecting', async () => {
    vi.mocked(qortalRequest).mockResolvedValue('Not initialized yet');
    const view = render(wallet());
    await settle();
    view.unmount();
    await advance(TIME_MINUTES_3);
    expect(callsFor('GET_ARRR_SYNC_STATUS')).toHaveLength(1);
  });

  it('bounds a bridge request that never settles and ignores its late result', async () => {
    let resolveOld!: (response: string) => void;
    vi.mocked(qortalRequest).mockReturnValueOnce(
      new Promise((resolve) => {
        resolveOld = resolve;
      })
    );
    render(wallet());
    await advance(TIME_MINUTES_2 + TIME_SECONDS_5);
    expect(screen.getByTestId('address')).toHaveTextContent(address);
    const reads = callsFor('GET_USER_WALLET').length;
    await act(async () => resolveOld('Synchronized'));
    expect(callsFor('GET_USER_WALLET')).toHaveLength(reads);
  });

  it.each([null, [], '<html>Bad Gateway</html>'])(
    'recovers from a malformed sync response: %j',
    async (response) => {
      vi.mocked(qortalRequest).mockResolvedValueOnce(response);
      render(wallet());
      await settle();
      expect(callsFor('GET_ARRR_SYNC_STATUS')).toHaveLength(1);
      await advance(TIME_SECONDS_5);
      expect(screen.getByTestId('address')).toHaveTextContent(address);
    }
  );

  it('retries a failed address read after synchronization', async () => {
    const request = vi.mocked(qortalRequest).getMockImplementation()!;
    let failed = false;
    vi.mocked(qortalRequest).mockImplementation(async (options) => {
      if (options.action === 'GET_USER_WALLET' && !failed) {
        failed = true;
        return { error: 1205, message: 'Wallet busy' };
      }
      return request(options);
    });
    render(wallet());
    await settle();
    expect(screen.getByTestId('address')).toBeEmptyDOMElement();
    await advance(TIME_SECONDS_5);
    expect(screen.getByTestId('address')).toHaveTextContent(address);
    expect(callsFor('GET_USER_WALLET')).toHaveLength(2);
  });

  it.each(['GET_WALLET_BALANCE', 'GET_CROSSCHAIN_SERVER_INFO'])(
    'recovers a failed initial %s read without restarting the wallet',
    async (failedAction) => {
      const request = vi.mocked(qortalRequest).getMockImplementation()!;
      let failed = false;
      vi.mocked(qortalRequest).mockImplementation(async (options) => {
        if (options.action === failedAction && !failed) {
          failed = true;
          throw new Error('Request canceled');
        }
        return request(options);
      });
      render(wallet());
      await settle();
      expect(screen.getByTestId('address')).toHaveTextContent(address);
      expect(callsFor(failedAction)).toHaveLength(1);
      await advance(TIME_SECONDS_5);
      expect(screen.getByTestId('balance')).toHaveTextContent('12');
      expect(screen.getByText('lightwallet.test:443')).toBeVisible();
      expect(callsFor(failedAction)).toHaveLength(2);
      expect(callsFor('GET_ARRR_SYNC_STATUS')).toHaveLength(1);
    }
  );

  it('manual Retry replaces the pending startup and ignores its late address', async () => {
    let resolveOld!: (response: { address: string }) => void;
    const request = vi.mocked(qortalRequest).getMockImplementation()!;
    let pending = false;
    vi.mocked(qortalRequest).mockImplementation(async (options) => {
      if (options.action === 'GET_USER_WALLET' && !pending) {
        pending = true;
        return new Promise((resolve) => {
          resolveOld = resolve;
        });
      }
      return request(options);
    });
    const view = render(wallet());
    await settle();
    fireEvent.click(screen.getByRole('button', { name: 'core:action.retry' }));
    await settle();
    expect(screen.getByTestId('address')).toHaveTextContent(address);
    await act(async () => resolveOld({ address: 'obsolete-wallet' }));
    expect(screen.getByTestId('address')).toHaveTextContent(address);
    await advance(TIME_MINUTES_3);
    expect(callsFor('GET_WALLET_BALANCE')).toHaveLength(2);
    view.unmount();
    await advance(TIME_MINUTES_3 * 2);
    expect(callsFor('GET_WALLET_BALANCE')).toHaveLength(2);
  });

  it('does not start background reads after an unmounted pending sync resolves', async () => {
    let resolveOld!: (response: string) => void;
    vi.mocked(qortalRequest).mockReturnValueOnce(
      new Promise((resolve) => {
        resolveOld = resolve;
      })
    );
    const view = render(wallet());
    await settle();
    view.unmount();
    await act(async () => resolveOld('Synchronized'));
    await advance(TIME_MINUTES_3);
    expect(callsFor('GET_ARRR_SYNC_STATUS')).toHaveLength(1);
    expect(callsFor('GET_USER_WALLET')).toHaveLength(0);
    expect(callsFor('GET_WALLET_BALANCE')).toHaveLength(0);
  });

  it('starts a fresh wallet session when the account changes', async () => {
    let resolveOld!: (response: { address: string }) => void;
    const request = vi.mocked(qortalRequest).getMockImplementation()!;
    let pending = false;
    vi.mocked(qortalRequest).mockImplementation(async (options) => {
      if (options.action === 'GET_USER_WALLET' && !pending) {
        pending = true;
        return new Promise((resolve) => {
          resolveOld = resolve;
        });
      }
      return request(options);
    });
    const view = render(wallet());
    await settle();
    view.rerender(wallet('account-b'));
    await settle();
    expect(screen.getByTestId('address')).toHaveTextContent(address);
    await act(async () => resolveOld({ address: 'account-a-wallet' }));
    expect(screen.getByTestId('address')).toHaveTextContent(address);
    expect(callsFor('GET_WALLET_BALANCE')).toHaveLength(1);
  });

  it('has one balance poller under React Strict Mode and cleans it up', async () => {
    const view = render(<StrictMode>{wallet()}</StrictMode>);
    await settle();
    expect(callsFor('GET_WALLET_BALANCE')).toHaveLength(1);
    await advance(TIME_MINUTES_3);
    expect(callsFor('GET_WALLET_BALANCE')).toHaveLength(2);
    view.unmount();
    await advance(TIME_MINUTES_3 * 2);
    expect(callsFor('GET_WALLET_BALANCE')).toHaveLength(2);
  });

  it('does not start ARRR wallet reads on a gateway', async () => {
    render(wallet('account-a', true));
    await advance(TIME_MINUTES_3);
    expect(qortalRequest).not.toHaveBeenCalled();
    expect(
      screen.getByText('core:message.error.pirate_chain_gateway')
    ).toBeVisible();
  });

  it('restarts initialization after selecting a different server', async () => {
    render(wallet());
    await settle();
    fireEvent.click(
      screen.getByRole('button', { name: 'core:action.change_server' })
    );
    await settle();
    fireEvent.click(
      screen.getByRole('button', { name: 'SSL://lightwallet.test:443' })
    );
    await settle();
    expect(qortalRequest).toHaveBeenCalledWith({
      action: 'SET_CURRENT_FOREIGN_SERVER',
      coin: 'ARRR',
      type: 'SSL',
      host: 'lightwallet.test',
      port: 443,
    });
    expect(callsFor('GET_ARRR_SYNC_STATUS')).toHaveLength(2);
    expect(screen.getByTestId('address')).toHaveTextContent(address);
    await advance(TIME_MINUTES_3);
    expect(callsFor('GET_WALLET_BALANCE')).toHaveLength(3);
    expect(callsFor('SEND_COIN')).toHaveLength(0);
  });

  it('waits for a current server if the first server list is incomplete', async () => {
    const request = vi.mocked(qortalRequest).getMockImplementation()!;
    let incomplete = true;
    vi.mocked(qortalRequest).mockImplementation(async (options) => {
      if (options.action === 'GET_CROSSCHAIN_SERVER_INFO' && incomplete) {
        incomplete = false;
        return [];
      }
      return request(options);
    });
    render(wallet());
    await settle();
    expect(screen.queryByText('lightwallet.test:443')).not.toBeInTheDocument();
    await advance(TIME_SECONDS_5);
    expect(screen.getByText('lightwallet.test:443')).toBeVisible();
    expect(callsFor('GET_CROSSCHAIN_SERVER_INFO')).toHaveLength(2);
  });

  it('retains the transaction-history retry and renders the recovered history', async () => {
    const request = vi.mocked(qortalRequest).getMockImplementation()!;
    let attempts = 0;
    vi.mocked(qortalRequest).mockImplementation(async (options) => {
      if (String(options.action) === 'GET_USER_WALLET_TRANSACTIONS') {
        if (++attempts === 1) throw new Error('Wallet busy');
        return [{ txHash: 'recovered-history', timestamp: 10 }];
      }
      return request(options);
    });
    render(wallet());
    await settle();
    expect(callsFor('GET_USER_WALLET_TRANSACTIONS')).toHaveLength(1);
    await advance(TIME_SECONDS_5);
    expect(screen.getByTestId('transactions')).toHaveTextContent(
      'recovered-history'
    );
    expect(callsFor('GET_USER_WALLET_TRANSACTIONS')).toHaveLength(2);
  });

  it('shows usable history immediately and then enriches incomplete recipients', async () => {
    const request = vi.mocked(qortalRequest).getMockImplementation()!;
    let attempts = 0;
    vi.mocked(qortalRequest).mockImplementation(async (options) => {
      if (String(options.action) === 'GET_USER_WALLET_TRANSACTIONS') {
        return [
          {
            txHash: ++attempts === 1 ? 'usable-history' : 'enriched-history',
            outputs: [{ address: attempts === 1 ? '[UNKNOWN]' : address }],
          },
        ];
      }
      return request(options);
    });
    render(wallet());
    await settle();
    expect(screen.getByTestId('transactions')).toHaveTextContent(
      'usable-history'
    );
    await advance(TIME_SECONDS_5);
    expect(screen.getByTestId('transactions')).toHaveTextContent(
      'enriched-history'
    );
    expect(callsFor('GET_USER_WALLET_TRANSACTIONS')).toHaveLength(2);
  });

  it('continues recovering after the first follow-up still has unknown recipients', async () => {
    const request = vi.mocked(qortalRequest).getMockImplementation()!;
    let attempts = 0;
    vi.mocked(qortalRequest).mockImplementation(async (options) => {
      if (String(options.action) === 'GET_USER_WALLET_TRANSACTIONS') {
        return [
          {
            txHash:
              ++attempts < 3 ? 'still-incomplete' : 'eventually-recovered',
            outputs: [{ address: attempts < 3 ? '[UNKNOWN]' : address }],
          },
        ];
      }
      return request(options);
    });
    const view = render(wallet());
    await settle();
    await advance(TIME_SECONDS_5);
    expect(callsFor('GET_USER_WALLET_TRANSACTIONS')).toHaveLength(2);
    expect(screen.getByTestId('transactions')).toHaveTextContent(
      'still-incomplete'
    );
    await advance(TIME_SECONDS_5 * 3);
    expect(screen.getByTestId('transactions')).toHaveTextContent(
      'eventually-recovered'
    );
    expect(callsFor('GET_USER_WALLET_TRANSACTIONS')).toHaveLength(3);
    await advance(TIME_MINUTES_3);
    expect(callsFor('GET_USER_WALLET_TRANSACTIONS')).toHaveLength(3);
    view.unmount();
  });

  it('keeps history visible after a failed follow-up and tries again later', async () => {
    const request = vi.mocked(qortalRequest).getMockImplementation()!;
    let attempts = 0;
    vi.mocked(qortalRequest).mockImplementation(async (options) => {
      if (String(options.action) === 'GET_USER_WALLET_TRANSACTIONS') {
        ++attempts;
        if (attempts === 2) throw new Error('Host request timed out');
        return [
          {
            txHash: attempts === 1 ? 'usable-history' : 'recovered-history',
            outputs: [{ address: attempts === 1 ? '[UNKNOWN]' : address }],
          },
        ];
      }
      return request(options);
    });
    render(wallet());
    await settle();
    await advance(TIME_SECONDS_5);
    expect(screen.getByTestId('transactions')).toHaveTextContent(
      'usable-history'
    );
    expect(
      screen.getByRole('button', { name: 'Refresh history' })
    ).toBeEnabled();
    await advance(TIME_SECONDS_5 * 3);
    expect(screen.getByTestId('transactions')).toHaveTextContent(
      'recovered-history'
    );
    expect(callsFor('GET_USER_WALLET_TRANSACTIONS')).toHaveLength(3);
  });

  it('backs off persistent unknowns to one quiet refresh per minute and cancels on leave', async () => {
    const request = vi.mocked(qortalRequest).getMockImplementation()!;
    vi.mocked(qortalRequest).mockImplementation(async (options) => {
      if (String(options.action) === 'GET_USER_WALLET_TRANSACTIONS')
        return [{ txHash: 'incomplete', outputs: [{ address: '[UNKNOWN]' }] }];
      return request(options);
    });
    const view = render(wallet());
    await settle();
    await advance(5000 + 15000 + 30000 + 60000);
    expect(callsFor('GET_USER_WALLET_TRANSACTIONS')).toHaveLength(5);
    await advance(59999);
    expect(callsFor('GET_USER_WALLET_TRANSACTIONS')).toHaveLength(5);
    await advance(1);
    expect(callsFor('GET_USER_WALLET_TRANSACTIONS')).toHaveLength(6);
    view.unmount();
    await advance(TIME_MINUTES_3);
    expect(callsFor('GET_USER_WALLET_TRANSACTIONS')).toHaveLength(6);
  });

  it('does not poll transaction details just to reveal a private incoming sender', async () => {
    const request = vi.mocked(qortalRequest).getMockImplementation()!;
    vi.mocked(qortalRequest).mockImplementation(async (options) => {
      if (String(options.action) === 'GET_USER_WALLET_TRANSACTIONS')
        return [
          {
            txHash: 'incoming',
            inputs: [{ address: '[PRIVATE]' }],
            outputs: [{ address }],
          },
        ];
      return request(options);
    });
    render(wallet());
    await advance(TIME_MINUTES_3);
    expect(callsFor('GET_USER_WALLET_TRANSACTIONS')).toHaveLength(1);
  });

  it('returns to the short delay when Core makes recipient progress', async () => {
    const request = vi.mocked(qortalRequest).getMockImplementation()!;
    let attempts = 0;
    vi.mocked(qortalRequest).mockImplementation(async (options) => {
      if (String(options.action) === 'GET_USER_WALLET_TRANSACTIONS') {
        ++attempts;
        return [
          {
            txHash: 'progressing',
            outputs: [
              { address: attempts < 3 ? '[UNKNOWN]' : address },
              { address: attempts < 4 ? '[UNKNOWN]' : address },
            ],
          },
        ];
      }
      return request(options);
    });
    render(wallet());
    await advance(TIME_SECONDS_5 * 4);
    expect(callsFor('GET_USER_WALLET_TRANSACTIONS')).toHaveLength(3);
    await advance(TIME_SECONDS_5);
    expect(callsFor('GET_USER_WALLET_TRANSACTIONS')).toHaveLength(4);
    await advance(TIME_MINUTES_3);
    expect(callsFor('GET_USER_WALLET_TRANSACTIONS')).toHaveLength(4);
  });

  it('shares a pending quiet read with manual refresh and ignores its old-session result', async () => {
    const request = vi.mocked(qortalRequest).getMockImplementation()!;
    let attempts = 0;
    let resolveOld!: (response: unknown) => void;
    vi.mocked(qortalRequest).mockImplementation(async (options) => {
      if (String(options.action) === 'GET_USER_WALLET_TRANSACTIONS') {
        if (++attempts === 2)
          return new Promise((resolve) => {
            resolveOld = resolve;
          });
        return [
          {
            txHash: attempts === 1 ? 'account-a-history' : 'account-b-history',
            outputs: [{ address: attempts === 1 ? '[UNKNOWN]' : address }],
          },
        ];
      }
      return request(options);
    });
    const view = render(wallet());
    await advance(TIME_SECONDS_5);
    fireEvent.click(screen.getByRole('button', { name: 'Refresh history' }));
    await settle();
    expect(callsFor('GET_USER_WALLET_TRANSACTIONS')).toHaveLength(2);
    view.rerender(wallet('account-b'));
    await settle();
    expect(screen.getByTestId('transactions')).toHaveTextContent(
      'account-b-history'
    );
    await act(async () =>
      resolveOld([
        { txHash: 'obsolete-account-a-result', outputs: [{ address }] },
      ])
    );
    expect(screen.getByTestId('transactions')).toHaveTextContent(
      'account-b-history'
    );
    await advance(TIME_MINUTES_3);
    expect(callsFor('GET_USER_WALLET_TRANSACTIONS')).toHaveLength(3);
  });

  it('allows manual refreshes to finish while background recipient recovery remains pending', async () => {
    const request = vi.mocked(qortalRequest).getMockImplementation()!;
    vi.mocked(qortalRequest).mockImplementation(async (options) => {
      if (String(options.action) === 'GET_USER_WALLET_TRANSACTIONS')
        return [{ txHash: 'incomplete', outputs: [{ address: '[UNKNOWN]' }] }];
      return request(options);
    });
    render(wallet());
    await settle();
    fireEvent.click(screen.getByRole('button', { name: 'Refresh history' }));
    await settle();
    expect(
      screen.getByRole('button', { name: 'Refresh history' })
    ).toBeEnabled();
    expect(screen.getByTestId('transactions')).toHaveTextContent('incomplete');
    expect(callsFor('GET_USER_WALLET_TRANSACTIONS')).toHaveLength(2);
    await advance(TIME_SECONDS_5);
    expect(callsFor('GET_USER_WALLET_TRANSACTIONS')).toHaveLength(3);
  });

  it.each(['retry', 'enrichment'])(
    'cancels pending transaction %s work when leaving ARRR',
    async (followUp) => {
      const request = vi.mocked(qortalRequest).getMockImplementation()!;
      vi.mocked(qortalRequest).mockImplementation(async (options) => {
        if (String(options.action) === 'GET_USER_WALLET_TRANSACTIONS') {
          if (followUp === 'retry') throw new Error('Wallet busy');
          return [
            { txHash: 'usable-history', outputs: [{ address: '[UNKNOWN]' }] },
          ];
        }
        return request(options);
      });
      const view = render(wallet());
      await settle();
      view.unmount();
      await advance(TIME_MINUTES_3);
      expect(callsFor('GET_USER_WALLET_TRANSACTIONS')).toHaveLength(1);
    }
  );
});
