import type { ComponentProps } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useGlobal } from 'qapp-core';
import type {
  ExternalFeeSlider,
  ExternalSendForm,
} from '../../components/ExternalSendForm';
import WalletContext, { defaultState } from '../../contexts/walletContext';
import BitcoinWallet from '../btc';
import LitecoinWallet from '../ltc';
import DogecoinWallet from '../doge';
import DigibyteWallet from '../dgb';
import RavencoinWallet from '../rvn';
import PirateWallet from '../arrr';
import QortalWallet from '../qort';

const t = (key: string) => key;
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t }),
  Trans: () => null,
}));
vi.mock('../../common/functions', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../common/functions')>()),
  copyToClipboard: vi.fn(),
  timeoutDelay: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../../components/AddressBook/AddressBookDialog', () => ({
  AddressBookDialog: () => null,
}));
vi.mock('../../components/WalletWorkspace', () => ({
  WalletWorkspace: ({
    coin,
    onSelectAddress,
  }: {
    coin: string;
    onSelectAddress: (address: string, name: string) => void;
  }) => (
    <button
      onClick={() =>
        onSelectAddress(
          coin === 'QORT' ? `Q${'a'.repeat(33)}` : 'fixture-recipient',
          'Contact'
        )
      }
    >
      Send to contact
    </button>
  ),
  WalletExternalTransactionsList: () => null,
  WalletTransactionsCard: () => null,
  WalletTransactionsLoader: () => null,
  WalletSyncCard: () => null,
}));
vi.mock('../../components/FeeManager', () => ({
  FeeManager: ({ onChange }: { onChange: (fee: number) => void }) => (
    <input
      aria-label="fee rate"
      onChange={(event) => onChange(Number(event.target.value))}
    />
  ),
}));
vi.mock('../../components/ExternalSendForm', () => ({
  sendCoinDialogPaperSx: {},
  ExternalSendForm: (props: ComponentProps<typeof ExternalSendForm>) => (
    <>
      <input
        aria-label="amount"
        value={props.amount}
        onChange={(event) => props.onAmountChange(Number(event.target.value))}
      />
      {props.feeContent}
      <button onClick={props.onSendMax}>Max</button>
      <button disabled={props.sendDisabled} onClick={props.onSend}>
        Pay
      </button>
      <button onClick={props.onClose}>Close transfer</button>
    </>
  ),
  ExternalFeeSlider: (props: ComponentProps<typeof ExternalFeeSlider>) => (
    <input
      aria-label="fee rate"
      value={props.fee}
      onChange={(event) =>
        props.onChange(event.nativeEvent, Number(event.target.value), 0)
      }
    />
  ),
}));

describe('wallet Send Max handoff', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.mocked(useGlobal).mockReturnValue({
      auth: { name: '' },
    } as ReturnType<typeof useGlobal>);
    vi.stubGlobal(
      'qortalRequest',
      vi.fn(async ({ action }: { action: string }) => {
        if (action === 'GET_ARRR_SYNC_STATUS') return 'Synchronized';
        if (action === 'GET_WALLET_BALANCE') return '1';
        if (action === 'GET_USER_WALLET') return { address: 'fixture-wallet' };
        if (action === 'SEND_COIN') return { txid: 'synthetic-test-only' };
        return [];
      })
    );
    vi.stubGlobal(
      'qortalRequestWithTimeout',
      (request: Parameters<typeof qortalRequest>[0]) => qortalRequest(request)
    );
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it.each([
    { coin: 'BTC', Wallet: BitcoinWallet, bytes: 500, rate: 10000, sats: 10 },
    { coin: 'LTC', Wallet: LitecoinWallet, bytes: 1000, rate: 10000, sats: 10 },
    {
      coin: 'DOGE',
      Wallet: DogecoinWallet,
      bytes: 5000,
      rate: 10000,
      sats: 10,
    },
    { coin: 'DGB', Wallet: DigibyteWallet, bytes: 1000, rate: 25, sats: 25 },
    {
      coin: 'RVN',
      Wallet: RavencoinWallet,
      bytes: 1000,
      rate: 2000,
      sats: 2000,
    },
  ])(
    '$coin keeps Max selected after a fee change and submits that amount and rate',
    async ({ coin, Wallet, bytes, rate, sats }) => {
      render(<Wallet />);
      await act(async () => {});
      fireEvent.click(screen.getByText('Send to contact'));
      const amount = screen.getByLabelText('amount');
      const fee = screen.getByLabelText('fee rate');
      fireEvent.click(screen.getByText('Max'));

      if (['BTC', 'LTC', 'DOGE'].includes(coin)) {
        // An unavailable publisher fee must not allow a zero-fee Max send.
        expect(amount).toHaveValue('0');
        expect(screen.getByText('Pay')).toBeDisabled();
        fireEvent.change(fee, { target: { value: '1500' } });
        expect(Number((amount as HTMLInputElement).value)).toBe(
          (100000000 - 2 * bytes - 1000) / 1e8
        );
      } else {
        // Address-book entry must use the default slider fee immediately.
        const defaultSats = coin === 'DGB' ? 10 : 1500;
        expect(Number((amount as HTMLInputElement).value)).toBe(
          (100000000 - defaultSats * bytes - 1000) / 1e8
        );
      }

      fireEvent.change(fee, { target: { value: String(rate) } });
      const expectedMax = (100000000 - sats * bytes - 1000) / 1e8;
      expect(Number((amount as HTMLInputElement).value)).toBe(expectedMax);
      expect(screen.getByText('Pay')).toBeEnabled();
      await act(async () => fireEvent.click(screen.getByText('Pay')));
      expect(qortalRequest).toHaveBeenCalledWith({
        action: 'SEND_COIN',
        coin,
        recipient: 'fixture-recipient',
        amount: expectedMax,
        fee: sats / 1e8,
      });

      // A manually entered amount survives fee changes; closing resets Max.
      fireEvent.change(amount, { target: { value: '0.5' } });
      fireEvent.change(fee, { target: { value: '100' } });
      expect(amount).toHaveValue('0.5');
      fireEvent.click(screen.getByText('Close transfer'));
      fireEvent.click(screen.getByText('Send to contact'));
      expect(screen.getByLabelText('amount')).toHaveValue('0');
    }
  );

  it('ARRR reserves its fixed fee and buffer and tracks balance refreshes', async () => {
    render(
      <WalletContext.Provider
        value={{ ...defaultState, isUsingGateway: false }}
      >
        <PirateWallet />
      </WalletContext.Provider>
    );
    await act(async () => {});
    await act(() => vi.advanceTimersByTimeAsync(10000));
    fireEvent.click(screen.getByText('Send to contact'));
    fireEvent.click(screen.getByText('Max'));
    expect(screen.getByLabelText('amount')).toHaveValue('0.99989');
    vi.mocked(qortalRequest).mockImplementation(async ({ action }) =>
      action === 'GET_WALLET_BALANCE' ? '2' : []
    );
    await act(() => vi.advanceTimersByTimeAsync(180000));
    expect(screen.getByLabelText('amount')).toHaveValue('1.99989');
    await act(async () => fireEvent.click(screen.getByText('Pay')));
    expect(qortalRequest).toHaveBeenCalledWith({
      action: 'SEND_COIN',
      coin: 'ARRR',
      recipient: 'fixture-recipient',
      amount: 1.99989,
      memo: '',
    });
  });

  it('QORT Max uses the on-chain fee, follows balance refreshes and preserves manual edits', async () => {
    let balance = '1';
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => ({
        ok: true,
        json: async () => {
          if (url.startsWith('/addresses/balance/')) return balance;
          if (url.startsWith('/transactions/unitfee')) return 2000000;
          return [];
        },
      }))
    );
    const recipient = `Q${'a'.repeat(33)}`;
    render(
      <WalletContext.Provider value={{ ...defaultState, address: recipient }}>
        <QortalWallet />
      </WalletContext.Provider>
    );
    await act(async () => {});
    fireEvent.click(screen.getByText('Send to contact'));
    fireEvent.click(screen.getByText('core:max'));
    const amount = screen.getByRole('textbox', {
      name: 'core:send.symbol_amount',
    });
    expect(amount).toHaveValue('0.98');
    balance = '2';
    await act(() => vi.advanceTimersByTimeAsync(150000));
    expect(amount).toHaveValue('1.98');
    fireEvent.change(amount, { target: { value: '0.5' } });
    balance = '3';
    await act(() => vi.advanceTimersByTimeAsync(150000));
    expect(amount).toHaveValue('0.5');
    const send = screen.getByRole('button', { name: 'send-qort' });
    expect(send).toBeEnabled();
    await act(async () => fireEvent.click(send));
    expect(qortalRequest).toHaveBeenCalledWith({
      action: 'SEND_COIN',
      coin: 'QORT',
      recipient,
      amount: 0.5,
    });
  });
});
