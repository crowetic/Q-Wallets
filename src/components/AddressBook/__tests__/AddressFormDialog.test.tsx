import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AddressFormDialog } from '../AddressFormDialog';
import { Coin } from 'qapp-core';
import * as addressValidation from '../../../utils/addressValidation';
import { searchQortalNames } from '../../../utils/qortalNodeApi';

// Mock react-i18next. `t` must keep a stable identity across renders, exactly
// like the real provider — otherwise effects that depend on `t` re-run every
// render and the QORT name-search effect loops infinitely.
const t = (key: string) => key;
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t,
    i18n: { changeLanguage: vi.fn() },
  }),
}));

// Mock address validation
vi.mock('../../../utils/addressValidation');

vi.mock('../../../utils/qortalNodeApi', () => ({
  searchQortalNames: vi.fn(),
  validateArrrRecipientWithCore: vi.fn(),
}));

describe('AddressFormDialog', () => {
  const defaultProps = {
    open: true,
    onClose: vi.fn(),
    coinType: Coin.BTC,
    onSave: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(addressValidation.validateAddress).mockReturnValue(true);
    vi.mocked(addressValidation.validateArrrAddress).mockResolvedValue(false);
    vi.mocked(searchQortalNames).mockResolvedValue([]);
    vi.stubGlobal('qortalRequest', vi.fn());
  });

  describe('ARRR Core validation', () => {
    const address =
      'pirate1lyp0g5438qkp9s5me5epku9ak9k0dxqsfyt9z894zym8qw38sps488ljyee27yw29vc2cyj8mse';

    it('saves the full Ironwood address only after Core accepts it', async () => {
      vi.mocked(addressValidation.validateArrrAddress).mockResolvedValue(true);
      const user = userEvent.setup();
      render(
        <AddressFormDialog
          {...defaultProps}
          coinType={Coin.ARRR}
          prefillName="Pirate contact"
          prefillAddress={address}
        />
      );
      const saveButton = screen.getByText(/core:address_book_save/);
      expect(saveButton).toBeDisabled();
      await waitFor(() => expect(saveButton).toBeEnabled());
      expect(screen.getByLabelText(/core:address_book_address/)).toHaveValue(
        address
      );
      await user.click(saveButton);
      expect(defaultProps.onSave).toHaveBeenCalledWith(
        expect.objectContaining({ address, coinType: Coin.ARRR })
      );
      expect(addressValidation.validateAddress).not.toHaveBeenCalled();
    });

    it('does not save a rejected ARRR recipient', async () => {
      render(
        <AddressFormDialog
          {...defaultProps}
          coinType={Coin.ARRR}
          prefillName="Pirate contact"
          prefillAddress={address}
        />
      );
      await screen.findByText('core:send.arrr_address_invalid');
      expect(screen.getByText(/core:address_book_save/)).toBeDisabled();
      expect(defaultProps.onSave).not.toHaveBeenCalled();
    });

    it('explains unavailable validation without falling back to the old local regex', async () => {
      vi.mocked(addressValidation.validateArrrAddress).mockRejectedValue(
        new Error('404')
      );
      render(
        <AddressFormDialog
          {...defaultProps}
          coinType={Coin.ARRR}
          prefillName="Pirate contact"
          prefillAddress={address}
        />
      );
      await screen.findByText('core:send.arrr_validation_unavailable');
      expect(screen.getByText(/core:address_book_save/)).toBeDisabled();
    });
  });

  describe('basic rendering', () => {
    it('should render form fields when open', () => {
      render(<AddressFormDialog {...defaultProps} />);

      expect(
        screen.getByLabelText(/core:address_book_name/)
      ).toBeInTheDocument();
      expect(
        screen.getByLabelText(/core:address_book_address/)
      ).toBeInTheDocument();
      expect(
        screen.getByLabelText(/core:address_book_note/)
      ).toBeInTheDocument();
    });

    it('should show the note character counter', () => {
      render(<AddressFormDialog {...defaultProps} />);

      expect(screen.getByText('0/200')).toBeInTheDocument(); // Note counter
    });
  });

  describe('form initialization', () => {
    it('should populate form with entry data in edit mode', () => {
      const entry = {
        id: '1',
        name: 'Alice',
        address: '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa',
        note: 'Test note',
        coinType: Coin.BTC,
        createdAt: Date.now(),
      };

      render(<AddressFormDialog {...defaultProps} entry={entry} />);

      const nameInput = screen.getByLabelText(
        /core:address_book_name/
      ) as HTMLInputElement;
      const addressInput = screen.getByLabelText(
        /core:address_book_address/
      ) as HTMLInputElement;
      const noteInput = screen.getByLabelText(
        /core:address_book_note/
      ) as HTMLInputElement;

      expect(nameInput.value).toBe('Alice');
      expect(addressInput.value).toBe('1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa');
      expect(noteInput.value).toBe('Test note');
    });
  });

  describe('form validation', () => {
    it('should update the name field as the user types', async () => {
      const user = userEvent.setup();

      render(<AddressFormDialog {...defaultProps} />);

      const nameInput = screen.getByLabelText(
        /core:address_book_name/
      ) as HTMLInputElement;
      await user.type(nameInput, 'Alice');

      await waitFor(() => {
        expect(nameInput.value).toBe('Alice');
      });
    });

    it('should update character counter as user types in note field', async () => {
      const user = userEvent.setup();

      render(<AddressFormDialog {...defaultProps} />);

      const noteInput = screen.getByLabelText(/core:address_book_note/);
      await user.type(noteInput, 'Test note');

      await waitFor(() => {
        expect(screen.getByText('9/200')).toBeInTheDocument();
      });
    });

    it('should disable save button when form is invalid', () => {
      render(<AddressFormDialog {...defaultProps} />);

      const saveButton = screen.getByText(/core:address_book_save/);
      expect(saveButton).toBeDisabled();
    });

    it('should enable save button when form is valid', async () => {
      const user = userEvent.setup();

      render(<AddressFormDialog {...defaultProps} />);

      const nameInput = screen.getByLabelText(/core:address_book_name/);
      const addressInput = screen.getByLabelText(/core:address_book_address/);

      await user.type(nameInput, 'Alice');
      await user.type(addressInput, '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa');

      await waitFor(() => {
        const saveButton = screen.getByText(/core:address_book_save/);
        expect(saveButton).not.toBeDisabled();
      });
    });
  });

  describe('save functionality', () => {
    it('should call onSave with form data when save clicked', async () => {
      const user = userEvent.setup();
      const onSave = vi.fn();

      render(<AddressFormDialog {...defaultProps} onSave={onSave} />);

      const nameInput = screen.getByLabelText(/core:address_book_name/);
      const addressInput = screen.getByLabelText(/core:address_book_address/);
      const noteInput = screen.getByLabelText(/core:address_book_note/);

      await user.type(nameInput, 'Alice');
      await user.type(addressInput, '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa');
      await user.type(noteInput, 'Test note');

      const saveButton = screen.getByText(/core:address_book_save/);
      await user.click(saveButton);

      expect(onSave).toHaveBeenCalledWith({
        name: 'Alice',
        address: '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa',
        note: 'Test note',
        coinType: Coin.BTC,
      });
    });

    it('should not call onSave when form is invalid', () => {
      const onSave = vi.fn();

      render(<AddressFormDialog {...defaultProps} onSave={onSave} />);

      // Leave form empty - button should be disabled
      const saveButton = screen.getByText(/core:address_book_save/);
      expect(saveButton).toBeDisabled();
      expect(onSave).not.toHaveBeenCalled();
    });
  });

  describe('cancel functionality', () => {
    it('should call onClose when cancel clicked', async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();

      render(<AddressFormDialog {...defaultProps} onClose={onClose} />);

      const cancelButton = screen.getByText(/core:address_book_cancel/);
      await user.click(cancelButton);

      expect(onClose).toHaveBeenCalled();
    });
  });

  describe('error display', () => {
    it('should display save error when provided', () => {
      render(
        <AddressFormDialog {...defaultProps} saveError="Duplicate address" />
      );

      expect(screen.getByText('Duplicate address')).toBeInTheDocument();
    });
  });

  describe('QORT name resolution', () => {
    const qortAddress = `Q${'A'.repeat(33)}`;

    it('should search QORT names while typing', async () => {
      const user = userEvent.setup();
      vi.mocked(searchQortalNames).mockResolvedValue([
        { name: 'Alice', owner: qortAddress },
      ]);

      render(<AddressFormDialog {...defaultProps} coinType={Coin.QORT} />);

      const nameInput = screen.getByLabelText(/core:address_book_name/);
      await user.type(nameInput, 'Alice');

      expect(await screen.findByText(qortAddress)).toBeInTheDocument();
      expect(searchQortalNames).toHaveBeenCalledWith(
        'Alice',
        10,
        expect.any(AbortSignal)
      );
    });

    it('should not resolve name for non-QORT coins', async () => {
      const user = userEvent.setup();

      render(<AddressFormDialog {...defaultProps} coinType={Coin.BTC} />);

      const nameInput = screen.getByLabelText(/core:address_book_name/);
      await user.type(nameInput, 'Alice');

      expect(searchQortalNames).not.toHaveBeenCalled();
    });

    it('should clear the resolved QORT address when the selected name changes', async () => {
      const user = userEvent.setup();
      vi.mocked(searchQortalNames).mockResolvedValue([
        { name: 'Phill', owner: qortAddress },
      ]);

      render(<AddressFormDialog {...defaultProps} coinType={Coin.QORT} />);

      const nameInput = screen.getByLabelText(
        /core:address_book_name/
      ) as HTMLInputElement;
      const addressInput = screen.getByLabelText(
        /core:address_book_address/
      ) as HTMLInputElement;

      await user.type(nameInput, 'Phill');
      await user.click(await screen.findByText('Phill'));

      expect(nameInput.value).toBe('Phill');
      expect(addressInput.value).toBe(qortAddress);

      await user.type(nameInput, 'l');

      expect(nameInput.value).toBe('Philll');
      expect(addressInput.value).toBe('');
    });

    it('should resolve a typed QORT address to its primary name and clear the name if the address changes', async () => {
      const user = userEvent.setup();
      const qortalRequestMock = vi.fn().mockResolvedValue('Phill');
      vi.stubGlobal('qortalRequest', qortalRequestMock);

      render(<AddressFormDialog {...defaultProps} coinType={Coin.QORT} />);

      const nameInput = screen.getByLabelText(
        /core:address_book_name/
      ) as HTMLInputElement;
      const addressInput = screen.getByLabelText(
        /core:address_book_address/
      ) as HTMLInputElement;

      await user.type(addressInput, qortAddress);

      await waitFor(() => {
        expect(qortalRequestMock).toHaveBeenCalledWith({
          action: 'GET_PRIMARY_NAME',
          address: qortAddress,
        });
        expect(nameInput.value).toBe('Phill');
      });

      await user.type(addressInput, 'A');

      expect(nameInput.value).toBe('');
    });
  });

  describe('QORT addresses without a registered name', () => {
    const qortAddress = `Q${'B'.repeat(33)}`;

    it('should let the user save a custom label for an address that owns no name', async () => {
      const user = userEvent.setup();
      const onSave = vi.fn();
      const qortalRequestMock = vi.fn().mockResolvedValue('');
      vi.stubGlobal('qortalRequest', qortalRequestMock);

      render(
        <AddressFormDialog
          {...defaultProps}
          coinType={Coin.QORT}
          onSave={onSave}
        />
      );

      const nameInput = screen.getByLabelText(
        /core:address_book_name/
      ) as HTMLInputElement;
      const addressInput = screen.getByLabelText(
        /core:address_book_address/
      ) as HTMLInputElement;

      await user.type(addressInput, qortAddress);

      expect(
        await screen.findByText('core:address_book_ui.no_registered_name')
      ).toBeInTheDocument();
      expect(
        screen.queryByText('core:message.error.recipient_not_found')
      ).not.toBeInTheDocument();

      // Typing a label must not wipe the address the label belongs to.
      await user.type(nameInput, 'My friend');
      expect(addressInput.value).toBe(qortAddress);
      expect(searchQortalNames).not.toHaveBeenCalled();

      await user.click(
        screen.getByLabelText('core:address_book_ui.confirm_address')
      );

      const saveButton = screen.getByText(/core:address_book_save/);
      await waitFor(() => expect(saveButton).toBeEnabled());
      await user.click(saveButton);

      expect(onSave).toHaveBeenCalledWith({
        name: 'My friend',
        address: qortAddress,
        note: '',
        coinType: Coin.QORT,
      });
    });

    it('should keep the address while renaming an existing unnamed contact', async () => {
      const user = userEvent.setup();
      const onSave = vi.fn();
      const qortalRequestMock = vi.fn().mockResolvedValue(null);
      vi.stubGlobal('qortalRequest', qortalRequestMock);

      const entry = {
        id: '1',
        name: 'Old label',
        address: qortAddress,
        note: '',
        coinType: Coin.QORT,
        createdAt: Date.now(),
      };

      render(
        <AddressFormDialog
          {...defaultProps}
          coinType={Coin.QORT}
          entry={entry}
          onSave={onSave}
        />
      );

      const nameInput = screen.getByLabelText(
        /core:address_book_name/
      ) as HTMLInputElement;
      const addressInput = screen.getByLabelText(
        /core:address_book_address/
      ) as HTMLInputElement;

      await waitFor(() =>
        expect(qortalRequestMock).toHaveBeenCalledWith({
          action: 'GET_PRIMARY_NAME',
          address: qortAddress,
        })
      );

      await user.clear(nameInput);
      await user.type(nameInput, 'New label');

      expect(addressInput.value).toBe(qortAddress);

      const saveButton = screen.getByText(/core:address_book_save/);
      await waitFor(() => expect(saveButton).toBeEnabled());
      await user.click(saveButton);

      expect(onSave).toHaveBeenCalledWith({
        name: 'New label',
        address: qortAddress,
        note: '',
        coinType: Coin.QORT,
      });
    });

    it('should still clear the address when renaming a contact whose address owns a name', async () => {
      const user = userEvent.setup();
      const qortalRequestMock = vi.fn().mockResolvedValue('Phill');
      vi.stubGlobal('qortalRequest', qortalRequestMock);

      render(<AddressFormDialog {...defaultProps} coinType={Coin.QORT} />);

      const nameInput = screen.getByLabelText(
        /core:address_book_name/
      ) as HTMLInputElement;
      const addressInput = screen.getByLabelText(
        /core:address_book_address/
      ) as HTMLInputElement;

      await user.type(addressInput, qortAddress);

      await waitFor(() => expect(nameInput.value).toBe('Phill'));

      await user.type(nameInput, 'y');

      expect(addressInput.value).toBe('');
    });
  });
});
