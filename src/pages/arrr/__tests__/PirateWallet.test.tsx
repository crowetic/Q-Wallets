import type { ChangeEvent } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import PirateWallet from '../index';
import WalletContext, { defaultState } from '../../../contexts/walletContext';

const t = (key: string) => key;
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t }) }));
vi.mock('../../../common/functions', () => ({
  copyToClipboard: vi.fn(),
  timeoutDelay: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../../../components/AddressBook/AddressBookDialog', () => ({
  AddressBookDialog: () => null,
}));
vi.mock('../../../components/WalletWorkspace', () => ({
  WalletWorkspace: ({ onSend }: { onSend: () => void }) => (
    <button onClick={onSend}>Open transfer</button>
  ),
  WalletExternalTransactionsList: () => null,
  WalletTransactionsCard: () => null,
  WalletTransactionsLoader: () => null,
}));

type SendFormProps = {
  recipient: string;
  recipientInputProps?: { maxLength?: number };
  onRecipientChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onAmountChange: (amount: number) => void;
  onSend: () => void;
  sendDisabled: boolean;
};
vi.mock('../../../components/ExternalSendForm', () => ({
  sendCoinDialogPaperSx: {},
  ExternalSendForm: (props: SendFormProps) => (
    <>
      <input
        aria-label="recipient"
        value={props.recipient}
        maxLength={props.recipientInputProps?.maxLength}
        onChange={props.onRecipientChange}
      />
      <input
        aria-label="amount"
        onChange={(event) => props.onAmountChange(Number(event.target.value))}
      />
      <button disabled={props.sendDisabled} onClick={props.onSend}>
        Pay
      </button>
    </>
  ),
}));

describe('ARRR transfer uses Core recipient validation', () => {
  const address =
    'pirate1lyp0g5438qkp9s5me5epku9ak9k0dxqsfyt9z894zym8qw38sps488ljyee27yw29vc2cyj8mse';
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: async () => true })
    );
    vi.stubGlobal(
      'qortalRequest',
      vi.fn(async ({ action }: { action: string }) => {
        if (action === 'GET_ARRR_SYNC_STATUS') return 'Synchronized';
        if (action === 'GET_WALLET_BALANCE') return 100;
        if (action === 'GET_USER_WALLET') return { address };
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
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  const prepareTransfer = async () => {
    render(
      <WalletContext.Provider
        value={{ ...defaultState, isUsingGateway: false }}
      >
        <PirateWallet />
      </WalletContext.Provider>
    );
    await act(async () => {});
    await act(() => vi.advanceTimersByTimeAsync(3000));
    fireEvent.click(screen.getByText('Open transfer'));
    const input = screen.getByLabelText('recipient');
    expect(input).not.toHaveAttribute('maxlength');
    fireEvent.change(input, { target: { value: address } });
    fireEvent.change(screen.getByLabelText('amount'), {
      target: { value: '1' },
    });
    expect(input).toHaveValue(address);
    expect(screen.getByText('Pay')).toBeDisabled();
    await act(() => vi.advanceTimersByTimeAsync(350));
    expect(screen.getByText('Pay')).toBeEnabled();
  };

  it('passes the full validated Ironwood recipient and decimal amount to the wallet host', async () => {
    await prepareTransfer();
    await act(async () => fireEvent.click(screen.getByText('Pay')));
    expect(qortalRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'SEND_COIN',
        coin: 'ARRR',
        recipient: address,
        amount: 1,
      })
    );
  });

  it('does not hand off a payment if Core rejects the final recipient recheck', async () => {
    await prepareTransfer();
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => false,
    } as Response);
    await act(async () => fireEvent.click(screen.getByText('Pay')));
    expect(qortalRequest).not.toHaveBeenCalledWith(
      expect.objectContaining({ action: 'SEND_COIN' })
    );
  });
});
