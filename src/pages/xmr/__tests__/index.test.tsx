import { beforeEach, expect, it, vi } from 'vitest';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import walletContext, { defaultState } from '../../../contexts/walletContext';
import MoneroWallet from '../index';
import xmrLogo from '../../../assets/wallet-renders/xmr-coin-render.png';
import {
  addAddress,
  getAddressBook,
  setAddressBookAccountScope,
} from '../../../utils/addressBookStorage';
import { Coin } from 'qapp-core';
const status = {
  network: 'stagenet',
  address: '5' + 'a'.repeat(94),
  daemonUrl: 'https://example.org',
  initialized: true,
  syncing: false,
  synced: true,
  walletHeight: 100,
  daemonHeight: 100,
  progress: 1,
  balanceAtomic: '1000000000001',
  unlockedBalanceAtomic: '1000000000001',
  transactions: [],
  pending: null,
  error: null,
};
const t = (key: string, options?: Record<string, unknown>) =>
  options ? key + ' ' + Object.values(options).join(' ') : key;
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t }) }));
const state = {
  ...defaultState,
  address: 'Q-account-a',
  isAuthenticated: true,
  isUsingGateway: false,
  nodeInfo: { isTestNet: false, moneroNetwork: 'stagenet' },
};
const request = vi.fn();
beforeEach(() => {
  vi.stubGlobal('qortalRequest', request);
  vi.stubGlobal('qortalRequestWithTimeout', (options: QortalRequestOptions) =>
    request(options)
  );
  request.mockReset();
  setAddressBookAccountScope(state.address);
  vi.mocked(navigator.clipboard.writeText).mockReset().mockResolvedValue();
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe = vi.fn();
      unobserve = vi.fn();
      disconnect = vi.fn();
    }
  );
});
const show = () =>
  render(
    <walletContext.Provider value={state}>
      <MoneroWallet />
    </walletContext.Provider>
  );
const connect = async () => {
  fireEvent.click(screen.getByText('core:xmr.connect'));
  await screen.findByText('core:xmr.receive');
};
const openSend = () =>
  fireEvent.click(
    screen.getByRole('button', { name: 'core:wallet.send_symbol XMR' })
  );
const mockConnectedWallet = () =>
  request.mockImplementation(async ({ action }) =>
    action === 'GET_USER_WALLET'
      ? { address: status.address, network: 'stagenet' }
      : status
  );

it('uses only public Hub bridge calls and displays all 12 decimal places', async () => {
  request.mockImplementation(async ({ action }) =>
    action === 'GET_USER_WALLET'
      ? { address: status.address, network: 'stagenet' }
      : status
  );
  show();
  await connect();
  expect(
    await screen.findByText('core:xmr.total 1.000000000001')
  ).toBeInTheDocument();
  expect(request).toHaveBeenCalledWith({
    action: 'GET_USER_WALLET_INFO',
    coin: 'XMR',
  });
  expect(screen.getByText('1.000000000001')).toBeInTheDocument();
  openSend();
  expect(
    screen.getByRole('button', { name: 'core:action.send capitalizeFirstChar' })
  ).toBeEnabled();
});
it('defaults recovery to height zero and requires an explicit start action', async () => {
  request.mockImplementation(async ({ action }) =>
    action === 'GET_USER_WALLET'
      ? { address: status.address, network: 'stagenet' }
      : { ...status, initialized: false, synced: false }
  );
  show();
  await connect();
  await screen.findByLabelText('core:xmr.restore_height');
  expect(screen.getByLabelText('core:xmr.restore_height')).toHaveValue('0');
  expect(request.mock.calls.some(([args]) => args.initialize)).toBe(false);
  fireEvent.click(screen.getByText('core:xmr.start'));
  await waitFor(() =>
    expect(request).toHaveBeenCalledWith({
      action: 'GET_USER_WALLET_INFO',
      coin: 'XMR',
      initialize: true,
      restoreHeight: 0,
    })
  );
});
it('sends an exact decimal string and fee limit, then disables duplicate submissions', async () => {
  let sent = false;
  request.mockImplementation(async ({ action }) => {
    if (action === 'GET_USER_WALLET')
      return { address: status.address, network: 'stagenet' };
    if (action === 'SEND_COIN') {
      sent = true;
      return 'a'.repeat(64);
    }
    return sent ? { ...status, synced: false } : status;
  });
  show();
  await connect();
  await screen.findByText('core:xmr.ready');
  openSend();
  fireEvent.change(screen.getByLabelText('core:xmr.recipient'), {
    target: { value: status.address },
  });
  fireEvent.change(screen.getByLabelText('core:xmr.amount'), {
    target: { value: '0.000000000001' },
  });
  fireEvent.click(
    screen.getByRole('button', { name: 'core:action.send capitalizeFirstChar' })
  );
  await waitFor(() =>
    expect(request).toHaveBeenCalledWith({
      action: 'SEND_COIN',
      coin: 'XMR',
      recipient: status.address,
      amount: '0.000000000001',
      maxFee: '0.001',
    })
  );
  await screen.findByText(/core:xmr.sent/);
  await waitFor(() =>
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  );
  openSend();
  expect(
    screen.getByRole('button', { name: 'core:action.send capitalizeFirstChar' })
  ).toBeDisabled();
});
it('does not initialize or display a receive address for mainnet in this testing release', async () => {
  request.mockResolvedValue({ address: status.address, network: 'mainnet' });
  show();
  fireEvent.click(screen.getByText('core:xmr.connect'));
  await screen.findByText('core:xmr.configure');
  expect(request).toHaveBeenCalledTimes(1);
  expect(screen.queryByText('core:xmr.receive')).not.toBeInTheDocument();
});
it('ignores an old account response after the account changes', async () => {
  let resolve!: (value: unknown) => void;
  request.mockReturnValue(
    new Promise((r) => {
      resolve = r;
    })
  );
  const { rerender } = show();
  fireEvent.click(screen.getByText('core:xmr.connect'));
  rerender(
    <walletContext.Provider value={{ ...state, address: 'Q-account-b' }}>
      <MoneroWallet />
    </walletContext.Provider>
  );
  resolve({ address: status.address, network: 'stagenet' });
  await waitFor(() =>
    expect(screen.getByText('core:xmr.connect')).toBeEnabled()
  );
  expect(request).toHaveBeenCalledTimes(1);
  expect(screen.queryByText('core:xmr.receive')).not.toBeInTheDocument();
});
it('blocks a new payment with an unresolved intent and retries without new payment fields', async () => {
  request.mockImplementation(async ({ action }) =>
    action === 'GET_USER_WALLET'
      ? { address: status.address, network: 'stagenet' }
      : action === 'SEND_COIN'
        ? 'a'.repeat(64)
        : {
            ...status,
            pending: {
              txId: 'a'.repeat(64),
              recipient: status.address,
              amountAtomic: '1',
              feeAtomic: '2',
            },
          }
  );
  show();
  await connect();
  await screen.findByText('core:xmr.retry_payment');
  openSend();
  expect(
    screen.getByRole('button', { name: 'core:action.send capitalizeFirstChar' })
  ).toBeDisabled();
  fireEvent.click(
    screen.getByRole('button', {
      name: 'core:action.close capitalizeFirstChar',
    })
  );
  await waitFor(() =>
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  );
  fireEvent.click(screen.getByText('core:xmr.retry_payment'));
  await waitFor(() =>
    expect(request).toHaveBeenCalledWith({
      action: 'SEND_COIN',
      coin: 'XMR',
      retryPending: true,
    })
  );
});

it('copies the faucet URL without an external navigation link', async () => {
  mockConnectedWallet();
  show();
  await connect();
  expect(screen.getByLabelText('core:xmr.faucet')).toHaveValue(
    'https://faucet-stagenet.xmr.nodely.dev/'
  );
  expect(
    screen.queryByRole('link', { name: /faucet/ })
  ).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'core:xmr.copy_faucet' }));
  await screen.findByText('core:xmr.faucet_copied');
  expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
    'https://faucet-stagenet.xmr.nodely.dev/'
  );
  expect(
    request.mock.calls.every(([args]) => args.action.startsWith('GET_'))
  ).toBe(true);
});
it('keeps the faucet URL available for manual copying when clipboard access fails', async () => {
  mockConnectedWallet();
  vi.mocked(navigator.clipboard.writeText).mockRejectedValue(
    new Error('denied')
  );
  show();
  await connect();
  fireEvent.click(screen.getByRole('button', { name: 'core:xmr.copy_faucet' }));
  await screen.findByText('core:xmr.copy_failed');
  expect(screen.queryByText('core:xmr.faucet_copied')).not.toBeInTheDocument();
  expect(screen.getByLabelText('core:xmr.faucet')).toHaveAttribute('readonly');
});
it('uses the shared Monero summary, receive QR panel and enlarged QR dialog', async () => {
  mockConnectedWallet();
  const { container } = show();
  await connect();
  expect(
    Array.from(container.querySelectorAll('img')).find(
      (image) => image.getAttribute('src') === xmrLogo
    )
  ).toBeInTheDocument();
  expect(
    screen.getByText('core:wallet.coin_wallet Monero')
  ).toBeInTheDocument();
  expect(
    screen.queryByRole('button', { name: 'core:wallet.show_receive_qr XMR' })
  ).not.toBeInTheDocument();
  fireEvent.click(
    screen.getByRole('button', {
      name: 'core:wallet.receive capitalizeFirstChar',
    })
  );
  const qr = await screen.findByRole('button', {
    name: 'core:wallet.show_receive_qr XMR',
  });
  expect(qr.querySelector('svg')).toBeInTheDocument();
  fireEvent.click(qr);
  expect(await screen.findByRole('dialog')).toBeInTheDocument();
  expect(screen.getByRole('dialog')).toHaveTextContent(status.address);
});

it('preserves all atomic units in a large summary balance', async () => {
  request.mockImplementation(async ({ action }) =>
    action === 'GET_USER_WALLET'
      ? { address: status.address, network: 'stagenet' }
      : {
          ...status,
          balanceAtomic: '1000000000000000001',
          unlockedBalanceAtomic: '1000000000000000001',
        }
  );
  show();
  await connect();
  expect(await screen.findByText('1000000.000000000001')).toBeInTheDocument();
});

it('accepts .05 from the reported send and hands a canonical amount to Hub', async () => {
  request.mockImplementation(async ({ action }) =>
    action === 'GET_USER_WALLET'
      ? { address: status.address, network: 'stagenet' }
      : action === 'SEND_COIN'
        ? 'b'.repeat(64)
        : { ...status, unlockedBalanceAtomic: '500000000000' }
  );
  show();
  await connect();
  openSend();
  fireEvent.change(screen.getByLabelText('core:xmr.recipient'), {
    target: { value: status.address },
  });
  fireEvent.change(screen.getByLabelText('core:xmr.amount'), {
    target: { value: '.05' },
  });
  fireEvent.click(
    screen.getByRole('button', { name: 'core:action.send capitalizeFirstChar' })
  );
  await waitFor(() =>
    expect(request).toHaveBeenCalledWith({
      action: 'SEND_COIN',
      coin: 'XMR',
      recipient: status.address,
      amount: '0.05',
      maxFee: '0.001',
    })
  );
});

it.each([
  ['core:xmr.amount', '0.0000000000001', 'core:xmr.invalid_amount'],
  ['core:xmr.amount', '.9999', 'core:xmr.insufficient_unlocked'],
  ['core:xmr.max_fee', '1.000000000001', 'core:xmr.invalid_fee'],
  ['core:xmr.recipient', 'bad-address', 'core:xmr.invalid_recipient'],
])(
  'keeps validation for %s visible in the send dialog without calling Hub',
  async (label, value, error) => {
    mockConnectedWallet();
    show();
    await connect();
    openSend();
    fireEvent.change(screen.getByLabelText('core:xmr.recipient'), {
      target: { value: status.address },
    });
    fireEvent.change(screen.getByLabelText('core:xmr.amount'), {
      target: { value: '.05' },
    });
    fireEvent.change(screen.getByLabelText(label), { target: { value } });
    fireEvent.click(
      screen.getByRole('button', {
        name: 'core:action.send capitalizeFirstChar',
      })
    );
    expect(
      await within(screen.getByRole('dialog')).findByText(error)
    ).toBeInTheDocument();
    expect(
      request.mock.calls.some(([args]) => args.action === 'SEND_COIN')
    ).toBe(false);
  }
);

it('keeps a rejected Hub payment visible in the dialog with its draft intact', async () => {
  request.mockImplementation(async ({ action }) =>
    action === 'GET_USER_WALLET'
      ? { address: status.address, network: 'stagenet' }
      : action === 'SEND_COIN'
        ? { error: 'Payment approval declined' }
        : status
  );
  show();
  await connect();
  openSend();
  fireEvent.change(screen.getByLabelText('core:xmr.recipient'), {
    target: { value: status.address },
  });
  fireEvent.change(screen.getByLabelText('core:xmr.amount'), {
    target: { value: '.05' },
  });
  fireEvent.click(
    screen.getByRole('button', { name: 'core:action.send capitalizeFirstChar' })
  );
  await within(screen.getByRole('dialog')).findByText(
    'Payment approval declined'
  );
  expect(screen.getByLabelText('core:xmr.amount')).toHaveValue('.05');
  expect(screen.getByLabelText('core:xmr.recipient')).toHaveValue(
    status.address
  );
  expect(
    request.mock.calls.filter(([args]) => args.action === 'SEND_COIN')
  ).toHaveLength(1);
});

it('freezes the draft while Hub reviews it and blocks duplicate submissions', async () => {
  let complete!: (value: unknown) => void;
  request.mockImplementation(async ({ action }) =>
    action === 'GET_USER_WALLET'
      ? { address: status.address, network: 'stagenet' }
      : action === 'SEND_COIN'
        ? new Promise((resolve) => {
            complete = resolve;
          })
        : status
  );
  show();
  await connect();
  openSend();
  fireEvent.change(screen.getByLabelText('core:xmr.recipient'), {
    target: { value: status.address },
  });
  fireEvent.change(screen.getByLabelText('core:xmr.amount'), {
    target: { value: '.05' },
  });
  const send = screen.getByRole('button', {
    name: 'core:action.send capitalizeFirstChar',
  });
  fireEvent.click(send);
  await waitFor(() => expect(send).toBeDisabled());
  expect(screen.getByLabelText('core:xmr.recipient')).toBeDisabled();
  expect(screen.getByLabelText('core:xmr.amount')).toBeDisabled();
  expect(screen.getByLabelText('core:xmr.max_fee')).toBeDisabled();
  expect(
    screen.getByRole('button', { name: 'core:action.open_address_book' })
  ).toBeDisabled();
  fireEvent.click(send);
  expect(
    request.mock.calls.filter(([args]) => args.action === 'SEND_COIN')
  ).toHaveLength(1);
  complete({ error: 'Approval cancelled' });
  await screen.findByText('Approval cancelled');
  expect(send).toBeEnabled();
});

it('tracks Max against fee edits while preserving exact precision and manual amounts', async () => {
  mockConnectedWallet();
  show();
  await connect();
  openSend();
  fireEvent.click(
    screen.getByRole('button', {
      name: 'core:action.send_max capitalizeFirstChar',
    })
  );
  expect(screen.getByLabelText('core:xmr.amount')).toHaveValue(
    '0.999000000001'
  );
  fireEvent.change(screen.getByLabelText('core:xmr.max_fee'), {
    target: { value: '.002' },
  });
  expect(screen.getByLabelText('core:xmr.amount')).toHaveValue(
    '0.998000000001'
  );
  fireEvent.change(screen.getByLabelText('core:xmr.amount'), {
    target: { value: '.05' },
  });
  fireEvent.change(screen.getByLabelText('core:xmr.max_fee'), {
    target: { value: '.003' },
  });
  expect(screen.getByLabelText('core:xmr.amount')).toHaveValue('.05');
  fireEvent.change(screen.getByLabelText('core:xmr.max_fee'), {
    target: { value: '' },
  });
  expect(
    screen.getByRole('button', {
      name: 'core:action.send_max capitalizeFirstChar',
    })
  ).toBeDisabled();
});

it('submits XMR Max from unlocked funds with the full fee limit reserved and no unsupported sweep flag', async () => {
  request.mockImplementation(async ({ action }) =>
    action === 'GET_USER_WALLET'
      ? { address: status.address, network: 'stagenet' }
      : action === 'SEND_COIN'
        ? 'b'.repeat(64)
        : {
            ...status,
            balanceAtomic: '1000000000001',
            unlockedBalanceAtomic: '500000000001',
          }
  );
  show();
  await connect();
  openSend();
  fireEvent.change(screen.getByLabelText('core:xmr.recipient'), {
    target: { value: status.address },
  });
  fireEvent.click(
    screen.getByRole('button', {
      name: 'core:action.send_max capitalizeFirstChar',
    })
  );
  fireEvent.click(
    screen.getByRole('button', { name: 'core:action.send capitalizeFirstChar' })
  );
  await waitFor(() =>
    expect(request).toHaveBeenCalledWith({
      action: 'SEND_COIN',
      coin: 'XMR',
      recipient: status.address,
      amount: '0.499000000001',
      maxFee: '0.001',
    })
  );
});

it('shows unlocked funds as available while retaining the total and scan information', async () => {
  request.mockImplementation(async ({ action }) =>
    action === 'GET_USER_WALLET'
      ? { address: status.address, network: 'stagenet' }
      : {
          ...status,
          balanceAtomic: '1000000000001',
          unlockedBalanceAtomic: '500000000001',
        }
  );
  show();
  await connect();
  expect(await screen.findByText('0.500000000001')).toBeInTheDocument();
  expect(screen.getByText('core:xmr.total 1.000000000001')).toBeInTheDocument();
  expect(screen.getByText('core:xmr.heights 100 100')).toBeInTheDocument();
});

it('uses saved XMR contacts with the common address book without mixing coins or accounts', async () => {
  mockConnectedWallet();
  addAddress({
    name: 'Stagenet friend',
    address: status.address,
    note: '',
    coinType: 'XMR',
  });
  addAddress({
    name: 'Bitcoin friend',
    address: 'btc-test-address',
    note: '',
    coinType: Coin.BTC,
  });
  show();
  await connect();
  expect(screen.queryByText('Bitcoin friend')).not.toBeInTheDocument();
  fireEvent.click(screen.getByText('Stagenet friend'));
  expect(await screen.findByRole('dialog')).toHaveTextContent(
    'Stagenet friend'
  );
  expect(
    screen.getByRole('button', { name: 'core:action.open_address_book' })
  ).toBeInTheDocument();
  setAddressBookAccountScope('Q-another-account');
  expect(getAddressBook('XMR')).toEqual([]);
  setAddressBookAccountScope(state.address);
  expect(getAddressBook('XMR')).toHaveLength(1);
  expect(getAddressBook(Coin.BTC)).toHaveLength(1);
});

it('refreshes the main total and available balance after sending and when change unlocks', async () => {
  let sent = false;
  let unlocked = false;
  const interval = vi.spyOn(globalThis, 'setInterval');
  request.mockImplementation(async ({ action }) => {
    if (action === 'GET_USER_WALLET')
      return { address: status.address, network: 'stagenet' };
    if (action === 'SEND_COIN') {
      sent = true;
      return 'a'.repeat(64);
    }
    return {
      ...status,
      balanceAtomic: sent ? '449969620000' : '500000000000',
      unlockedBalanceAtomic: sent
        ? unlocked
          ? '449969620000'
          : '0'
        : '500000000000',
    };
  });
  try {
    show();
    await connect();
    expect(screen.getByText('0.5')).toBeInTheDocument();
    openSend();
    fireEvent.change(screen.getByLabelText('core:xmr.recipient'), {
      target: { value: status.address },
    });
    fireEvent.change(screen.getByLabelText('core:xmr.amount'), {
      target: { value: '.05' },
    });
    fireEvent.click(
      screen.getByRole('button', {
        name: 'core:action.send capitalizeFirstChar',
      })
    );
    await screen.findByText('core:xmr.total 0.44996962');
    expect(screen.getByText('0')).toBeInTheDocument();
    expect(screen.getByText('core:xmr.locked 0.44996962')).toBeInTheDocument();
    expect(screen.getByText('core:xmr.locked_help')).toBeInTheDocument();
    const poll = interval.mock.calls.find(
      ([, delay]) => delay === 10000
    )![0] as () => Promise<void>;
    unlocked = true;
    await act(async () => poll());
    expect(screen.getByText('0.44996962')).toBeInTheDocument();
    expect(screen.getByText('core:xmr.total 0.44996962')).toBeInTheDocument();
    expect(screen.queryByText('core:xmr.locked_help')).not.toBeInTheDocument();
    expect(
      request.mock.calls.filter(([args]) => args.action === 'SEND_COIN')
    ).toHaveLength(1);
  } finally {
    interval.mockRestore();
  }
});
