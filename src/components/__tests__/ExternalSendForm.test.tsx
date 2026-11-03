import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ExternalSendForm } from '../ExternalSendForm';
import { useSendAmount } from '../../hooks/useSendAmount';

const t = (key: string) => key;
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t }) }));

const SendForm = () => {
  const [max, setMax] = useState(0.99);
  const { amount, setAmount, sendMax } = useSendAmount(max);
  return (
    <>
      <button onClick={() => setMax((current) => current - 0.01)}>
        Increase fee
      </button>
      <ExternalSendForm
        addressError={false}
        addressHelperText=""
        addressInputId="recipient"
        amount={amount}
        balance={1}
        coinLogo=""
        feeContent={null}
        isBalanceLoading={false}
        maxSendable={max}
        onAmountChange={setAmount}
        onClose={() => {}}
        onRecipientChange={() => {}}
        onSend={() => {}}
        onSendMax={sendMax}
        recipient="fixture-recipient"
        sendDisabled={false}
        symbol="BTC"
      />
    </>
  );
};

describe('Send Max form', () => {
  it('keeps tracking Max across programmatic input updates, then respects a manual edit', async () => {
    const user = userEvent.setup();
    render(<SendForm />);
    const amount = screen.getByRole('textbox', { name: 'BTC amount' });
    await user.click(
      screen.getByRole('button', { name: 'core:action.send_max' })
    );
    expect(amount).toHaveValue('0.99');
    await user.click(screen.getByRole('button', { name: 'Increase fee' }));
    expect(amount).toHaveValue('0.98');
    await user.click(screen.getByRole('button', { name: 'Increase fee' }));
    expect(amount).toHaveValue('0.97');
    await user.clear(amount);
    await user.type(amount, '0.5');
    await user.click(screen.getByRole('button', { name: 'Increase fee' }));
    expect(amount).toHaveValue('0.5');
  });
});
