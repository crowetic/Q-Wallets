import React, { useMemo, useState, useEffect } from 'react';
import {
  Box,
  Button,
  CircularProgress,
  ClickAwayListener,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  InputAdornment,
  TextField,
  Typography,
} from '@mui/material';
import type { Theme } from '@mui/material/styles';
import Check from '@mui/icons-material/Check';
import CheckCircleOutline from '@mui/icons-material/CheckCircleOutline';
import Close from '@mui/icons-material/Close';
import DeleteOutline from '@mui/icons-material/DeleteOutline';
import PersonOutline from '@mui/icons-material/PersonOutline';
import { Coin } from 'qapp-core';
import { useTranslation } from 'react-i18next';
import {
  DialogGeneral,
  FAST_DIALOG_TRANSITION_MS,
  Transition,
} from '../../styles/page-styles';
import { AddressBookEntry } from '../../utils/Types';
import { getAddressBook } from '../../utils/addressBookStorage';
import { validateAddress } from '../../utils/addressValidation';
import {
  ADDRESSBOOK_NAME_LENGTH,
  ADDRESSBOOK_NOTE_LENGTH,
  EMPTY_STRING,
} from '../../common/constants';
import {
  searchQortalNames,
  type QortalNameSearchResult,
} from '../../utils/qortalNodeApi';
import { NameText } from '../NameText';
import { hasInvisibleCharacters } from '../../utils/invisibleCharacters';
import coinLogoARRR from '../../assets/arrr.png';
import coinLogoBTC from '../../assets/btc.png';
import coinLogoDGB from '../../assets/dgb.png';
import coinLogoDOGE from '../../assets/doge.png';
import coinLogoLTC from '../../assets/ltc.png';
import coinLogoQORT from '../../assets/qort.png';
import coinLogoRVN from '../../assets/rvn.png';
import { useArrrAddressValidation } from '../../hooks/useArrrAddressValidation';

const ADDRESS_LOOKUP_DEBOUNCE_MS = 350;
const ADDRESS_MIN_LENGTH = 3;
const QORT_ADDRESS_PATTERN = /^Q[1-9A-HJ-NP-Za-km-z]{33}$/;

type QortResolvedContact = {
  address: string;
  name: string;
};

const coinLogos: Partial<Record<Coin, string>> = {
  [Coin.ARRR]: coinLogoARRR,
  [Coin.BTC]: coinLogoBTC,
  [Coin.DGB]: coinLogoDGB,
  [Coin.DOGE]: coinLogoDOGE,
  [Coin.LTC]: coinLogoLTC,
  [Coin.QORT]: coinLogoQORT,
  [Coin.RVN]: coinLogoRVN,
};

const fieldLabelSx = {
  color: (t: Theme) =>
    t.palette.mode === 'dark' ? 'rgba(228,238,248,0.9)' : 'text.primary',
  fontSize: { xs: 14.5, sm: 15 },
  fontWeight: 700,
  letterSpacing: 0,
  lineHeight: 1.2,
  mb: 0.85,
} as const;

const formFieldSx = {
  '& .MuiOutlinedInput-root': {
    bgcolor: (t: Theme) =>
      t.palette.mode === 'dark' ? 'rgba(0,8,16,0.2)' : 'rgba(255,255,255,0.76)',
    borderRadius: 1.35,
    minHeight: { xs: 54, sm: 56 },
    px: { xs: 1.2, sm: 1.35 },
    '& fieldset': {
      borderColor: (t: Theme) =>
        t.palette.mode === 'dark'
          ? 'rgba(116,158,180,0.16)'
          : 'rgba(11,143,211,0.18)',
    },
    '&:hover fieldset': {
      borderColor: (t: Theme) =>
        t.palette.mode === 'dark'
          ? 'rgba(116,158,180,0.3)'
          : 'rgba(11,143,211,0.32)',
    },
    '&.Mui-focused fieldset': {
      borderColor: 'rgba(24,189,242,0.62)',
      borderWidth: 1,
    },
  },
  '& .MuiOutlinedInput-input': {
    color: 'text.primary',
    fontSize: { xs: 15.5, sm: 16 },
    fontWeight: 500,
    py: 0,
    '&::placeholder': {
      color: 'text.secondary',
      fontWeight: 400,
      opacity: 0.58,
    },
  },
  '& .MuiFormHelperText-root': {
    color: 'text.secondary',
    fontSize: 12.5,
    fontWeight: 600,
    lineHeight: 1.25,
    ml: 1.2,
    mt: 0.85,
  },
} as const;

interface AddressFormDialogProps {
  open: boolean;
  onClose: () => void;
  coinType: Coin;
  entry?: AddressBookEntry;
  onSave: (entry: Omit<AddressBookEntry, 'id' | 'createdAt'>) => void;
  onDelete?: (entry: AddressBookEntry) => void;
  prefillName?: string;
  prefillAddress?: string;
  saveError?: string;
  disableRestoreFocus?: boolean;
  onExited?: () => void;
}

export const AddressFormDialog: React.FC<AddressFormDialogProps> = ({
  open,
  onClose,
  coinType,
  entry,
  onSave,
  onDelete,
  prefillName,
  prefillAddress,
  saveError,
  disableRestoreFocus,
  onExited,
}) => {
  const { t } = useTranslation(['core']);
  const coinLogo = coinLogos[coinType] || coinLogoQORT;

  const [name, setName] = useState(EMPTY_STRING);
  const [address, setAddress] = useState(EMPTY_STRING);
  const [note, setNote] = useState(EMPTY_STRING);

  const [nameError, setNameError] = useState(EMPTY_STRING);
  const [localAddressError, setAddressError] = useState(EMPTY_STRING);
  const arrrValidation = useArrrAddressValidation(
    address,
    open && coinType === Coin.ARRR
  );
  const addressError =
    coinType === Coin.ARRR && address.trim()
      ? arrrValidation.status === 'unavailable'
        ? t('core:send.arrr_validation_unavailable')
        : arrrValidation.status === 'invalid'
          ? t('core:send.arrr_address_invalid')
          : EMPTY_STRING
      : localAddressError;
  const [noteError, setNoteError] = useState(EMPTY_STRING);

  // QORT-specific state for username resolution
  const [addressValidating, setAddressValidating] = useState(false);
  const [addressConfirmed, setAddressConfirmed] = useState(false);
  const [addressLookupEnabled, setAddressLookupEnabled] = useState(false);
  const [saveConfirmPromptActive, setSaveConfirmPromptActive] = useState(false);
  const [nameLookupEnabled, setNameLookupEnabled] = useState(false);
  const [nameSearchOpen, setNameSearchOpen] = useState(false);
  const [nameSuggestions, setNameSuggestions] = useState<
    QortalNameSearchResult[]
  >([]);
  const [qortResolvedContact, setQortResolvedContact] =
    useState<QortResolvedContact | null>(null);
  // QORT address that the node reports has no registered name: the user is then
  // free to pick their own label for it.
  const [qortUnregisteredAddress, setQortUnregisteredAddress] = useState<
    string | null
  >(null);

  const isEditMode = !!entry;
  const existingQortContacts = useMemo(() => {
    if (coinType !== Coin.QORT || !open) return [];
    return getAddressBook(Coin.QORT).filter(
      (contact) => contact.id !== entry?.id
    );
  }, [coinType, entry?.id, open]);

  // The address in the field is known to have no registered Qortal name, so the
  // name field holds a user-chosen label instead of a resolved name.
  const isQortAddressUnregistered =
    coinType === Coin.QORT &&
    !!qortUnregisteredAddress &&
    qortUnregisteredAddress === address.trim();

  const isNameSuggestionAlreadySaved = (suggestion: QortalNameSearchResult) => {
    const suggestionName = suggestion.name.trim().toLowerCase();
    const suggestionOwner = (suggestion.owner || EMPTY_STRING).trim();

    return existingQortContacts.some(
      (contact) =>
        contact.address.trim() === suggestionOwner ||
        contact.name.trim().toLowerCase() === suggestionName
    );
  };

  // Load entry data when editing
  useEffect(() => {
    if (open) {
      const nextName = entry ? entry.name : prefillName || EMPTY_STRING;
      const nextAddress = entry
        ? entry.address
        : prefillAddress || EMPTY_STRING;

      if (entry) {
        setName(nextName);
        setAddress(nextAddress);
        setNote(entry.note);
      } else {
        // Reset form for new entry or use prefill data
        setName(nextName);
        setAddress(nextAddress);
        setNote(EMPTY_STRING);
      }
      // Clear errors when dialog opens
      setNameError(EMPTY_STRING);
      setAddressError(EMPTY_STRING);
      setNoteError(EMPTY_STRING);
      setAddressValidating(false);
      setAddressLookupEnabled(false);
      setAddressConfirmed(!!entry);
      setSaveConfirmPromptActive(false);
      setNameLookupEnabled(false);
      setNameSearchOpen(false);
      setNameSuggestions([]);
      setQortResolvedContact(
        coinType === Coin.QORT && nextName.trim() && nextAddress.trim()
          ? {
              address: nextAddress.trim(),
              name: nextName.trim(),
            }
          : null
      );
      setQortUnregisteredAddress(null);
    }
  }, [open, entry, prefillName, prefillAddress, coinType]);

  // QORT name search - lets users choose a registered name and then confirm its owner address.
  useEffect(() => {
    const query = name.trim();

    if (
      coinType !== Coin.QORT ||
      !nameLookupEnabled ||
      !query ||
      query.length < ADDRESS_MIN_LENGTH
    ) {
      setNameSuggestions([]);
      setNameSearchOpen(false);
      setAddressValidating(false);
      return;
    }

    setAddressValidating(true);
    let cancelled = false;
    const controller = new AbortController();

    const timeout = setTimeout(async () => {
      try {
        const results = await searchQortalNames(query, 10, controller.signal);

        if (cancelled) return;
        setNameSuggestions(results);
        setNameSearchOpen(results.length > 0);
        setNameError(
          results.length === 0
            ? t('core:message.error.recipient_not_found', {
                postProcess: 'capitalizeFirstChar',
              })
            : EMPTY_STRING
        );
      } catch (err: any) {
        if (!cancelled && err.name !== 'AbortError') {
          console.error('Name lookup failed:', err.message);
          setNameSuggestions([]);
          setNameSearchOpen(false);
          setNameError(
            t('core:message.error.recipient_lookup_failed', {
              postProcess: 'capitalizeFirstChar',
            })
          );
        }
      } finally {
        if (!cancelled) {
          setAddressValidating(false);
        }
      }
    }, ADDRESS_LOOKUP_DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(timeout);
      controller.abort();
    };
  }, [name, coinType, nameLookupEnabled, t]);

  // Resolves a typed QORT address to its primary name. An address without a
  // registered name is not an error: it only means the user has to label it.
  useEffect(() => {
    const addressQuery = address.trim();
    // Editing an existing contact never refills the name field, but the stored
    // address is still checked so a custom label stays editable.
    const isSilentLookup =
      open && !addressLookupEnabled && entry?.address.trim() === addressQuery;

    if (
      coinType !== Coin.QORT ||
      (!addressLookupEnabled && !isSilentLookup) ||
      !addressQuery ||
      !QORT_ADDRESS_PATTERN.test(addressQuery)
    ) {
      if (addressLookupEnabled) {
        setAddressValidating(false);
      }
      return;
    }

    if (!isSilentLookup) {
      setAddressValidating(true);
    }
    let cancelled = false;

    const timeout = setTimeout(async () => {
      try {
        if (typeof qortalRequest !== 'function') return;

        const primaryName = await qortalRequest({
          action: 'GET_PRIMARY_NAME',
          address: addressQuery,
        });

        if (cancelled) return;

        const resolvedName =
          typeof primaryName === 'string' ? primaryName.trim() : EMPTY_STRING;

        if (resolvedName) {
          setQortUnregisteredAddress(null);
          // A silent lookup only reports whether a name exists; it must not
          // overwrite the label or the pair confirmed from a name search.
          if (isSilentLookup) return;
          setName(resolvedName);
          setNameError(EMPTY_STRING);
          setQortResolvedContact({
            address: addressQuery,
            name: resolvedName,
          });
          return;
        }

        setQortUnregisteredAddress(addressQuery);
        setQortResolvedContact(null);
        setNameError(EMPTY_STRING);
      } catch (err: any) {
        if (cancelled) return;

        console.error('Address owner lookup failed:', err.message);
        if (isSilentLookup) return;

        setName(EMPTY_STRING);
        setNameError(
          t('core:message.error.recipient_lookup_failed', {
            postProcess: 'capitalizeFirstChar',
          })
        );
        setQortResolvedContact(null);
      } finally {
        if (!cancelled) {
          setAddressValidating(false);
        }
      }
    }, ADDRESS_LOOKUP_DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [address, addressLookupEnabled, coinType, entry, open, t]);

  const validateName = (value: string): boolean => {
    if (!value.trim()) {
      setNameError(
        t('core:address_book_name_required', {
          postProcess: 'capitalizeFirstChar',
        })
      );
      return false;
    }
    if (value.length > ADDRESSBOOK_NAME_LENGTH) {
      setNameError(
        t('core:address_book_name_max_length', {
          postProcess: 'capitalizeFirstChar',
        })
      );
      return false;
    }
    if (coinType === Coin.QORT && hasInvisibleCharacters(value)) {
      setNameError(
        t('core:message.error.invisible_qortal_name', {
          postProcess: 'capitalizeFirstChar',
        })
      );
      return false;
    }
    setNameError(EMPTY_STRING);
    return true;
  };

  const validateAddressField = (value: string): boolean => {
    if (!value.trim()) {
      setAddressError(
        t('core:address_book_address_required', {
          postProcess: 'capitalizeFirstChar',
        })
      );
      return false;
    }
    if (coinType === Coin.ARRR) {
      return (
        arrrValidation.address === value.trim() &&
        arrrValidation.status === 'valid'
      );
    }
    if (!validateAddress(coinType, value)) {
      setAddressError(
        t('core:address_book_address_invalid', {
          coinType: coinType,
          postProcess: 'capitalizeFirstChar',
        })
      );
      return false;
    }
    if (coinType === Coin.QORT && !QORT_ADDRESS_PATTERN.test(value.trim())) {
      setAddressError(
        t('core:address_book_address_invalid', {
          coinType: coinType,
          postProcess: 'capitalizeFirstChar',
        })
      );
      return false;
    }
    setAddressError(EMPTY_STRING);
    return true;
  };

  const validateNote = (value: string): boolean => {
    if (value.length > ADDRESSBOOK_NOTE_LENGTH) {
      setNoteError(
        t('core:address_book_note_max_length', {
          max_note: ADDRESSBOOK_NOTE_LENGTH,
          postProcess: 'capitalizeFirstChar',
        })
      );
      return false;
    }
    setNoteError(EMPTY_STRING);
    return true;
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setName(value);
    if (isQortAddressUnregistered) {
      // Labelling an address that owns no name: keep it and skip name search.
      setNameLookupEnabled(false);
      setNameSearchOpen(false);
      setNameSuggestions([]);
    } else {
      setNameLookupEnabled(true);
      if (coinType === Coin.QORT) {
        setAddressLookupEnabled(false);
        setAddress(EMPTY_STRING);
        setAddressConfirmed(false);
        setAddressError(EMPTY_STRING);
        setQortResolvedContact(null);
      }
    }
    validateName(value);
  };

  const handleAddressChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.trim();
    if (coinType === Coin.QORT) {
      setName(EMPTY_STRING);
      setNameError(EMPTY_STRING);
      setNameLookupEnabled(false);
      setNameSearchOpen(false);
      setNameSuggestions([]);
      setAddressLookupEnabled(true);
      setQortResolvedContact(null);
      setQortUnregisteredAddress(null);
    }
    setAddress(value);
    setAddressConfirmed(false);
    validateAddressField(value);
  };

  const handleNoteChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setNote(value);
    validateNote(value);
  };

  const handleSave = () => {
    // Validate all fields
    const isNameValid = validateName(name);
    const isAddressValid = validateAddressField(address);
    const isNoteValid = validateNote(note);

    if (isNameValid && isAddressValid && isNoteValid) {
      onSave({
        name: name.trim(),
        address: address.trim(),
        note: note.trim(),
        coinType,
      });
    }
  };

  const handleSelectNameSuggestion = (suggestion: QortalNameSearchResult) => {
    if (hasInvisibleCharacters(suggestion.name)) {
      setNameError(
        t('core:message.error.invisible_qortal_name', {
          postProcess: 'capitalizeFirstChar',
        })
      );
      return;
    }

    const resolvedAddress = suggestion.owner ?? EMPTY_STRING;
    setNameLookupEnabled(false);
    setAddressLookupEnabled(false);
    setName(suggestion.name);
    setAddress(resolvedAddress);
    setAddressConfirmed(false);
    setQortResolvedContact({
      address: resolvedAddress.trim(),
      name: suggestion.name.trim(),
    });
    setQortUnregisteredAddress(null);
    setNameSearchOpen(false);
    setNameSuggestions([]);
    validateName(suggestion.name);
    validateAddressField(resolvedAddress);
  };

  const handleConfirmAddress = () => {
    if (
      coinType === Coin.QORT &&
      !isQortAddressUnregistered &&
      (!qortResolvedContact ||
        qortResolvedContact.address !== address.trim() ||
        qortResolvedContact.name !== name.trim())
    ) {
      setAddressConfirmed(false);
      setAddressError(
        t('core:message.error.recipient_not_found', {
          postProcess: 'capitalizeFirstChar',
        })
      );
      return;
    }

    if (validateAddressField(address)) {
      setAddressConfirmed(true);
      setSaveConfirmPromptActive(false);
    }
  };

  const isQortResolvedContactCurrent =
    coinType !== Coin.QORT ||
    isQortAddressUnregistered ||
    (!!qortResolvedContact &&
      qortResolvedContact.address === address.trim() &&
      qortResolvedContact.name === name.trim());
  const isFormValid =
    name.trim() !== EMPTY_STRING &&
    address.trim() !== EMPTY_STRING &&
    !nameError &&
    !addressError &&
    (coinType !== Coin.ARRR || arrrValidation.status === 'valid') &&
    !noteError &&
    (coinType === Coin.QORT
      ? !addressValidating && addressConfirmed && isQortResolvedContactCurrent
      : true);
  const shouldGlowAddressConfirmText =
    coinType === Coin.QORT &&
    !addressConfirmed &&
    !addressError &&
    saveConfirmPromptActive;

  return (
    <DialogGeneral
      open={open}
      onClose={onClose}
      maxWidth={false}
      fullWidth
      disableScrollLock
      disableRestoreFocus={disableRestoreFocus}
      slots={{ transition: Transition }}
      slotProps={{
        transition: {
          onExited,
          timeout: FAST_DIALOG_TRANSITION_MS,
        },
        paper: {
          sx: {
            bgcolor: (t: Theme) =>
              t.palette.mode === 'dark' ? 'rgba(3, 17, 29, 0.985)' : '#ffffff',
            backgroundImage: (t: Theme) =>
              t.palette.mode === 'dark'
                ? 'radial-gradient(circle at 13% 6%, rgba(24,189,242,0.13), transparent 30%), linear-gradient(180deg, rgba(5,24,39,0.99) 0%, rgba(3,13,23,0.995) 100%)'
                : 'radial-gradient(circle at 13% 6%, rgba(11,143,211,0.08), transparent 32%), linear-gradient(180deg, rgba(255,255,255,0.99) 0%, rgba(246,250,252,0.995) 100%)',
            border: (t: Theme) =>
              t.palette.mode === 'dark'
                ? '1px solid rgba(91,132,158,0.28)'
                : '1px solid rgba(11,143,211,0.16)',
            borderRadius: 2,
            boxShadow: (t: Theme) =>
              t.palette.mode === 'dark'
                ? '0 28px 72px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.04)'
                : '0 24px 70px rgba(15,74,106,0.18), inset 0 1px 0 rgba(255,255,255,0.9)',
            overflow: 'hidden',
            width: 'min(592px, calc(100vw - 24px))',
          },
        },
      }}
    >
      <DialogTitle
        sx={{
          alignItems: 'center',
          bgcolor: 'transparent',
          backgroundColor: 'transparent',
          backgroundImage: 'none',
          borderBottom: 'none',
          display: 'flex',
          minHeight: { xs: 76, sm: 78 },
          px: { xs: 2.35, sm: 2.55 },
          py: 0,
          position: 'relative',
        }}
      >
        <Box
          sx={{
            alignItems: 'center',
            display: 'flex',
            flexGrow: 1,
            gap: { xs: 1.45, sm: 1.65 },
            minWidth: 0,
          }}
        >
          <Box
            component="img"
            src={coinLogo}
            alt=""
            sx={{
              filter: 'drop-shadow(0 0 16px rgba(24,189,242,0.45))',
              height: { xs: 34, sm: 36 },
              width: { xs: 34, sm: 36 },
            }}
          />
          <Typography
            sx={{
              color: 'text.primary',
              fontSize: { xs: 18, sm: 19 },
              fontWeight: 700,
              letterSpacing: 0,
              lineHeight: 1,
              minWidth: 0,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {isEditMode
              ? t('core:address_book_edit', {
                  postProcess: 'capitalizeFirstChar',
                })
              : t('core:address_book_add_new', {
                  postProcess: 'capitalizeFirstChar',
                })}
          </Typography>
        </Box>
        <IconButton
          aria-label={t('core:action.close', {
            postProcess: 'capitalizeFirstChar',
          })}
          onClick={onClose}
          sx={{
            color: 'text.secondary',
            ml: 1.2,
            p: 0.35,
            '&:hover': {
              bgcolor: 'rgba(116,158,180,0.08)',
              color: 'text.primary',
            },
            '& svg': {
              fontSize: 25,
            },
          }}
        >
          <Close />
        </IconButton>
      </DialogTitle>

      <DialogContent
        sx={{
          overflow: 'visible',
          px: { xs: '20px !important', sm: '28px !important' },
          pb: { xs: '20px !important', sm: '22px !important' },
          pt: { xs: '0px !important', sm: '2px !important' },
        }}
      >
        <Box sx={{ display: 'grid', gap: { xs: 2.25, sm: 2.45 } }}>
          <Box sx={{ position: 'relative' }}>
            <Typography sx={fieldLabelSx}>
              {t('core:address_book_name', {
                postProcess: 'capitalizeFirstChar',
              })}
            </Typography>
            <TextField
              required
              fullWidth
              placeholder={t('core:address_book_ui.enter_name')}
              value={name}
              onChange={handleNameChange}
              error={!!nameError}
              helperText={
                nameError ||
                (isQortAddressUnregistered
                  ? t('core:address_book_ui.no_registered_name')
                  : EMPTY_STRING)
              }
              slotProps={{
                htmlInput: {
                  maxLength: ADDRESSBOOK_NAME_LENGTH,
                  'aria-label': t('core:address_book_name', {
                    postProcess: 'capitalizeFirstChar',
                  }),
                },
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <PersonOutline
                        sx={{ color: 'text.secondary', fontSize: 22 }}
                      />
                    </InputAdornment>
                  ),
                  endAdornment:
                    coinType === Coin.QORT && addressValidating ? (
                      <InputAdornment position="end">
                        <CircularProgress size={16} />
                      </InputAdornment>
                    ) : undefined,
                },
              }}
              sx={formFieldSx}
            />
            {coinType === Coin.QORT && nameSearchOpen && (
              <ClickAwayListener onClickAway={() => setNameSearchOpen(false)}>
                <Box
                  sx={{
                    bgcolor: (t: Theme) =>
                      t.palette.mode === 'dark'
                        ? 'rgba(5, 16, 27, 0.98)'
                        : 'rgba(255,255,255,0.98)',
                    border: (t: Theme) =>
                      t.palette.mode === 'dark'
                        ? '1px solid rgba(116,158,180,0.2)'
                        : '1px solid rgba(11,143,211,0.18)',
                    borderRadius: 1,
                    boxShadow: (t: Theme) =>
                      t.palette.mode === 'dark'
                        ? '0 18px 40px rgba(0,0,0,0.32)'
                        : '0 18px 40px rgba(15,74,106,0.16)',
                    left: 0,
                    maxHeight: 216,
                    overflowY: 'auto',
                    position: 'absolute',
                    right: 0,
                    top: 'calc(100% + 6px)',
                    zIndex: 1500,
                  }}
                >
                  {nameSuggestions.map((suggestion) => {
                    const alreadySaved =
                      isNameSuggestionAlreadySaved(suggestion);

                    return (
                      <Box
                        component="button"
                        type="button"
                        key={`${suggestion.name}-${suggestion.owner}`}
                        onClick={() => handleSelectNameSuggestion(suggestion)}
                        sx={{
                          alignItems: 'center',
                          appearance: 'none',
                          bgcolor: 'transparent',
                          border: 0,
                          color: 'text.primary',
                          cursor: 'pointer',
                          display: 'grid',
                          font: 'inherit',
                          gap: 0.35,
                          justifyItems: 'start',
                          px: 2,
                          py: 1.1,
                          textAlign: 'left',
                          width: '100%',
                          '&:hover': {
                            bgcolor: 'rgba(24,189,242,0.08)',
                          },
                        }}
                      >
                        <NameText
                          component="span"
                          name={suggestion.name}
                          sx={{ fontSize: 14, fontWeight: 700 }}
                        >
                          {alreadySaved ? (
                            <Box
                              component="span"
                              sx={{
                                color: 'error.main',
                                fontSize: 12,
                                fontWeight: 700,
                                ml: 0.75,
                              }}
                            >
                              {t('core:address_book_ui.already_in_list')}
                            </Box>
                          ) : null}
                        </NameText>
                        <Typography
                          sx={{
                            color: 'text.secondary',
                            fontSize: 12,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            width: '100%',
                          }}
                        >
                          {suggestion.owner}
                        </Typography>
                      </Box>
                    );
                  })}
                </Box>
              </ClickAwayListener>
            )}
          </Box>

          {coinType === Coin.QORT && (
            <Box sx={{ alignItems: 'center', display: 'flex', gap: 2 }}>
              <Box
                sx={{
                  bgcolor: (t: Theme) =>
                    t.palette.mode === 'dark'
                      ? 'rgba(116,158,180,0.1)'
                      : 'rgba(11,143,211,0.14)',
                  flex: 1,
                  height: '1px',
                }}
              />
              <Typography
                sx={{
                  color: 'text.secondary',
                  fontSize: 12,
                  fontWeight: 700,
                  letterSpacing: 0,
                }}
              >
                {t('core:common.or')}
              </Typography>
              <Box
                sx={{
                  bgcolor: (t: Theme) =>
                    t.palette.mode === 'dark'
                      ? 'rgba(116,158,180,0.1)'
                      : 'rgba(11,143,211,0.14)',
                  flex: 1,
                  height: '1px',
                }}
              />
            </Box>
          )}

          <Box>
            <Typography sx={fieldLabelSx}>
              {t('core:address_book_address', {
                postProcess: 'capitalizeFirstChar',
              })}
            </Typography>
            <TextField
              required
              fullWidth
              placeholder={t('core:address_book_ui.enter_symbol_address', {
                symbol: coinType,
              })}
              value={address}
              onChange={handleAddressChange}
              error={!!addressError}
              helperText={
                addressError ||
                (coinType === Coin.ARRR && arrrValidation.status === 'pending'
                  ? t('core:send.arrr_validating')
                  : EMPTY_STRING) ||
                (coinType === Coin.QORT
                  ? addressConfirmed
                    ? t('core:address_book_ui.address_confirmed')
                    : t('core:address_book_ui.confirm_address_before_saving')
                  : EMPTY_STRING)
              }
              slotProps={{
                htmlInput: {
                  'aria-label': t('core:address_book_address', {
                    postProcess: 'capitalizeFirstChar',
                  }),
                },
                input: {
                  endAdornment:
                    coinType === Coin.QORT ? (
                      <InputAdornment
                        position="end"
                        sx={{
                          ml: 1,
                          mr: 0,
                        }}
                      >
                        <IconButton
                          aria-label={t('core:address_book_ui.confirm_address')}
                          disabled={!address.trim() || !!addressError}
                          onClick={handleConfirmAddress}
                          sx={{
                            color: addressConfirmed
                              ? 'success.main'
                              : 'primary.main',
                            height: { xs: 38, sm: 40 },
                            width: { xs: 38, sm: 40 },
                            '&:disabled': {
                              color: 'text.disabled',
                            },
                          }}
                        >
                          {addressConfirmed ? (
                            <CheckCircleOutline sx={{ fontSize: 22 }} />
                          ) : (
                            <Check sx={{ fontSize: 22 }} />
                          )}
                        </IconButton>
                      </InputAdornment>
                    ) : undefined,
                },
              }}
              sx={{
                ...formFieldSx,
                '& .MuiFormHelperText-root': {
                  ...formFieldSx['& .MuiFormHelperText-root'],
                  animation: shouldGlowAddressConfirmText
                    ? 'addressConfirmWarningPulse 900ms ease-in-out infinite'
                    : 'none',
                  color: addressError
                    ? 'error.main'
                    : addressConfirmed
                      ? 'success.main'
                      : coinType === Coin.QORT
                        ? 'error.main'
                        : 'text.secondary',
                  textShadow: shouldGlowAddressConfirmText
                    ? '0 0 10px rgba(255,90,104,0.42)'
                    : 'none',
                  '@keyframes addressConfirmWarningPulse': {
                    '0%, 100%': {
                      color: '#ff4d5e',
                      textShadow: '0 0 0 rgba(255,90,104,0)',
                    },
                    '50%': {
                      color: '#ffffff',
                      textShadow:
                        '0 0 12px rgba(255,90,104,0.7), 0 0 22px rgba(255,90,104,0.34)',
                    },
                  },
                },
              }}
            />
          </Box>

          <Box>
            <Typography sx={fieldLabelSx}>
              {t('core:address_book_note', {
                postProcess: 'capitalizeFirstChar',
              })}{' '}
              {t('core:common.optional_parenthetical')}
            </Typography>
            <Box sx={{ position: 'relative' }}>
              <TextField
                fullWidth
                placeholder={t('core:address_book_ui.add_note_optional')}
                value={note}
                onChange={handleNoteChange}
                error={!!noteError}
                helperText={noteError || EMPTY_STRING}
                multiline
                rows={3}
                slotProps={{
                  htmlInput: {
                    maxLength: ADDRESSBOOK_NOTE_LENGTH,
                    'aria-label': t('core:address_book_note', {
                      postProcess: 'capitalizeFirstChar',
                    }),
                  },
                }}
                sx={{
                  ...formFieldSx,
                  '& .MuiOutlinedInput-root': {
                    ...formFieldSx['& .MuiOutlinedInput-root'],
                    alignItems: 'flex-start',
                    minHeight: 94,
                    pb: 2.2,
                    pt: 1.05,
                  },
                  '& .MuiOutlinedInput-input': {
                    ...formFieldSx['& .MuiOutlinedInput-input'],
                    fontSize: { xs: 14.5, sm: 15 },
                    fontWeight: 400,
                    lineHeight: 1.45,
                    pr: 7,
                    '&::placeholder': {
                      color: 'text.secondary',
                      fontWeight: 400,
                      opacity: 0.48,
                    },
                  },
                }}
              />
              <Typography
                sx={{
                  bottom: noteError ? 30 : 10,
                  color: 'text.secondary',
                  fontSize: 14,
                  fontWeight: 700,
                  position: 'absolute',
                  right: 16,
                }}
              >
                {note.length}/{ADDRESSBOOK_NOTE_LENGTH}
              </Typography>
            </Box>
          </Box>
        </Box>
      </DialogContent>

      <DialogActions
        sx={{
          borderTop: (t: Theme) =>
            t.palette.mode === 'dark'
              ? '1px solid rgba(116,158,180,0.12)'
              : '1px solid rgba(11,143,211,0.12)',
          flexDirection: { xs: 'column', sm: 'row' },
          gap: { xs: 1.1, sm: 1.4 },
          justifyContent: 'space-between',
          pb: { xs: '14px !important', sm: '12px !important' },
          pt: '12px !important',
          px: { xs: '20px !important', sm: '28px !important' },
        }}
      >
        <Box
          sx={{
            alignItems: { xs: 'stretch', sm: 'center' },
            color: 'error.main',
            display: 'flex',
            flexDirection: { xs: 'column', sm: 'row' },
            fontSize: 13,
            fontWeight: 600,
            gap: 1.2,
            maxWidth: { xs: '100%', sm: '48%' },
            minHeight: { xs: saveError ? 'auto' : 0, sm: 'auto' },
            width: { xs: '100%', sm: 'auto' },
          }}
        >
          {entry && onDelete ? (
            <Button
              color="error"
              onClick={() => onDelete(entry)}
              startIcon={<DeleteOutline />}
              variant="outlined"
              sx={{
                borderColor: 'rgba(255,91,105,0.28)',
                borderRadius: 1.35,
                fontSize: { xs: 14, sm: 14.5 },
                fontWeight: 700,
                minHeight: { xs: 38, sm: 40 },
                minWidth: { xs: 0, sm: 92 },
                px: 2,
                width: { xs: '100%', sm: 'auto' },
                '&:hover': {
                  bgcolor: 'rgba(255,91,105,0.08)',
                  borderColor: 'rgba(255,91,105,0.48)',
                },
              }}
            >
              {t('core:address_book_delete', {
                postProcess: 'capitalizeFirstChar',
              })}
            </Button>
          ) : null}
          {saveError ? <Box sx={{ minWidth: 0 }}>{saveError}</Box> : null}
        </Box>
        <Box
          sx={{
            display: 'flex',
            gap: 1.2,
            justifyContent: { xs: 'stretch', sm: 'flex-end' },
            width: { xs: '100%', sm: 'auto' },
          }}
        >
          <Button
            onClick={onClose}
            variant="outlined"
            sx={{
              borderColor: 'rgba(116,158,180,0.22)',
              borderRadius: 1.35,
              color: 'primary.main',
              fontSize: { xs: 14, sm: 14.5 },
              fontWeight: 700,
              minHeight: { xs: 38, sm: 40 },
              minWidth: { xs: 0, sm: 86 },
              px: 2,
              width: { xs: '100%', sm: 'auto' },
              '&:hover': {
                bgcolor: 'rgba(116,158,180,0.08)',
                borderColor: 'rgba(116,158,180,0.38)',
              },
            }}
          >
            {t('core:address_book_cancel', {
              postProcess: 'capitalizeFirstChar',
            })}
          </Button>
          <Box
            component="span"
            onMouseEnter={() => {
              if (coinType === Coin.QORT && !addressConfirmed) {
                setSaveConfirmPromptActive(true);
              }
            }}
            onMouseLeave={() => setSaveConfirmPromptActive(false)}
            sx={{
              display: 'inline-flex',
              width: { xs: '100%', sm: 'auto' },
            }}
          >
            <Button
              onClick={handleSave}
              variant="contained"
              disabled={!isFormValid}
              sx={{
                bgcolor: '#0a9eff',
                backgroundImage:
                  'linear-gradient(180deg, rgba(24,174,255,0.98), rgba(4,126,220,0.98))',
                border: '1px solid rgba(85,205,255,0.32)',
                borderRadius: 1.35,
                boxShadow:
                  '0 10px 26px rgba(3,139,236,0.28), inset 0 1px 0 rgba(255,255,255,0.18)',
                color: 'white',
                fontSize: { xs: 14, sm: 14.5 },
                fontWeight: 700,
                minHeight: { xs: 38, sm: 40 },
                minWidth: { xs: 0, sm: 86 },
                px: 2,
                width: { xs: '100%', sm: 'auto' },
                '&:hover': {
                  bgcolor: '#16baf2',
                  boxShadow: '0 14px 32px rgba(24,189,242,0.32)',
                },
                '&:disabled': {
                  bgcolor: 'rgba(116,158,180,0.16)',
                  backgroundImage: 'none',
                  borderColor: 'rgba(116,158,180,0.08)',
                  boxShadow: 'none',
                  color: 'rgba(255,255,255,0.34)',
                },
              }}
            >
              {t('core:address_book_save', {
                postProcess: 'capitalizeFirstChar',
              })}
            </Button>
          </Box>
        </Box>
      </DialogActions>
    </DialogGeneral>
  );
};
