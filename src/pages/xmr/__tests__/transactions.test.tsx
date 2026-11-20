import { beforeEach, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import XmrTransactions from '../transactions';
import type { XmrTransaction } from '../api';

const t = (key: string, options?: Record<string, unknown>) =>
  options?.hash ? `${key} ${options.hash}` : key;
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t, i18n: { resolvedLanguage: 'en' } }),
}));

const transaction: XmrTransaction = {
  txId: 'a'.repeat(64),
  incoming: false,
  amountAtomic: '1000000000000000001',
  feeAtomic: '1000000001',
  confirmations: 3,
  timestamp: 1795190000,
};

beforeEach(() => {
  vi.mocked(navigator.clipboard.writeText).mockReset().mockResolvedValue();
});

it('shows exact amounts, direction, fee, confirmations, date and a copyable hash', async () => {
  const refresh = vi.fn();
  render(
    <XmrTransactions
      rows={[transaction]}
      isRefreshing={false}
      onRefresh={refresh}
    />
  );
  const table = screen.getByRole('table');
  expect(
    within(table).getByText('1000000.000000000001 XMR')
  ).toBeInTheDocument();
  expect(within(table).getByText('0.001000000001 XMR')).toBeInTheDocument();
  expect(within(table).getByText('core:xmr.sent_label')).toBeInTheDocument();
  expect(within(table).getByText('3')).toBeInTheDocument();
  expect(
    within(table).getByText(
      new Date(transaction.timestamp! * 1000).toLocaleString('en')
    )
  ).toBeInTheDocument();
  fireEvent.click(
    screen.getByRole('button', {
      name: `core:action.copy_hash ${transaction.txId}`,
    })
  );
  await screen.findByText('core:xmr.hash_copied');
  expect(navigator.clipboard.writeText).toHaveBeenCalledWith(transaction.txId);
  fireEvent.click(screen.getByRole('button', { name: /refresh/i }));
  expect(refresh).toHaveBeenCalledOnce();
});

it('shows incoming/unconfirmed payments and explains clipboard failure', async () => {
  vi.mocked(navigator.clipboard.writeText).mockRejectedValue(
    new Error('denied')
  );
  render(
    <XmrTransactions
      rows={[
        { ...transaction, incoming: true, timestamp: null, confirmations: 0 },
      ]}
      isRefreshing={false}
      onRefresh={vi.fn()}
    />
  );
  expect(screen.getByText('core:xmr.received')).toBeInTheDocument();
  expect(screen.getByText('core:xmr.unconfirmed')).toBeInTheDocument();
  fireEvent.click(
    screen.getByRole('button', {
      name: `core:action.copy_hash ${transaction.txId}`,
    })
  );
  await screen.findByText('core:xmr.hash_copy_failed');
  expect(screen.queryByText('core:xmr.hash_copied')).not.toBeInTheDocument();
  expect(screen.getByText(transaction.txId)).toBeInTheDocument();
});

it('paginates the latest history and clamps the page when it shrinks', () => {
  const rows = Array.from({ length: 12 }, (_, index) => ({
    ...transaction,
    txId: index.toString(16).padStart(64, '0'),
  }));
  const { rerender } = render(
    <XmrTransactions rows={rows} isRefreshing={false} onRefresh={vi.fn()} />
  );
  expect(screen.getAllByRole('row')).toHaveLength(11);
  fireEvent.click(screen.getByRole('button', { name: /next page/i }));
  expect(screen.getAllByRole('row')).toHaveLength(3);
  expect(screen.getByText(rows[11].txId)).toBeInTheDocument();
  rerender(
    <XmrTransactions
      rows={[rows[0]]}
      isRefreshing={false}
      onRefresh={vi.fn()}
    />
  );
  expect(screen.getByText(rows[0].txId)).toBeInTheDocument();
});
