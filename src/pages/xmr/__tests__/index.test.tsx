import { beforeEach, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import walletContext, { defaultState } from '../../../contexts/walletContext';
import MoneroWallet from '../index';
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
  expect(
    screen.getByRole('button', { name: 'core:xmr.approve' })
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
  fireEvent.change(screen.getByLabelText('core:xmr.recipient'), {
    target: { value: status.address },
  });
  fireEvent.change(screen.getByLabelText('core:xmr.amount'), {
    target: { value: '0.000000000001' },
  });
  fireEvent.click(screen.getByText('core:xmr.approve'));
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
  expect(
    screen.getByRole('button', { name: 'core:xmr.approve' })
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
  expect(
    screen.getByRole('button', { name: 'core:xmr.approve' })
  ).toBeDisabled();
  fireEvent.click(screen.getByText('core:xmr.retry_payment'));
  await waitFor(() =>
    expect(request).toHaveBeenCalledWith({
      action: 'SEND_COIN',
      coin: 'XMR',
      retryPending: true,
    })
  );
});
