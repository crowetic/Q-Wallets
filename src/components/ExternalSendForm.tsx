import type {
  ChangeEvent,
  ComponentProps,
  ComponentType,
  FC,
  ReactNode,
} from 'react';
import {
  AppBar,
  Avatar,
  Box,
  Button,
  IconButton,
  InputAdornment,
  Slider,
  SliderProps,
  TextField,
  Toolbar,
  Tooltip,
  Typography,
} from '@mui/material';
import type { Theme } from '@mui/material/styles';
import {
  LockOutlined,
  Close,
  InfoOutlined,
  NorthEast,
  PersonOutline,
  ShieldOutlined,
} from '@mui/icons-material';
import { NumericFormat as _NumericFormat } from 'react-number-format';
import {
  getAddressBookAvatarColor,
  getAddressBookAvatarSx,
} from './AddressBook/avatarPalette';
import { useTranslation } from 'react-i18next';

const NumericFormat = _NumericFormat as FC<
  ComponentProps<typeof _NumericFormat> & Record<string, unknown>
>;

type ExternalSendFormProps = {
  addressError: boolean;
  addressHelperText: ReactNode;
  addressValidationPending?: boolean;
  addressInputId: string;
  amount: number;
  afterRecipientContent?: ReactNode;
  balance: number | string | null | undefined;
  balanceError?: string | null;
  coinLogo: string;
  feeContent: ReactNode;
  isBalanceLoading: boolean;
  maxSendable: number;
  onAmountChange: (amount: number) => void;
  onClearRecipient?: () => void;
  onClose: () => void;
  onOpenAddressBook?: () => void;
  onRecipientChange: (
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => void;
  recipientInputProps?: Record<string, unknown>;
  onSend: () => void;
  onSendMax: () => void;
  recipient: string;
  recipientDisplayName?: string;
  recipientSubtitle?: ReactNode;
  sendDisabled: boolean;
  showAddressBookButton?: boolean;
  showBalanceMeter?: boolean;
  symbol: string;
};

type ExternalFeeSliderProps = {
  defaultValue: number;
  fee: number;
  getAriaValueText: NonNullable<SliderProps['getAriaValueText']>;
  marks: SliderProps['marks'];
  max: number;
  min: number;
  onChange: NonNullable<SliderProps['onChange']>;
  sliderId: string;
  step: number;
};

const maxOrZero = (value: number) =>
  Number.isFinite(value) && value > 0 ? value : 0;

export const sendCoinDialogPaperSx = {
  backgroundColor: (t: Theme) =>
    t.palette.mode === 'dark' ? 'rgba(3, 17, 29, 0.985)' : '#ffffff',
  backgroundImage: (t: Theme) =>
    t.palette.mode === 'dark'
      ? 'radial-gradient(circle at 13% 6%, rgba(24,189,242,0.13), transparent 30%), linear-gradient(180deg, rgba(5,24,39,0.99) 0%, rgba(3,13,23,0.995) 100%)'
      : 'radial-gradient(circle at 13% 6%, rgba(11,143,211,0.12), transparent 30%), linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(246,251,253,0.99) 100%)',
  border: (t: Theme) =>
    t.palette.mode === 'dark'
      ? '1px solid rgba(91,132,158,0.28)'
      : '1px solid rgba(11,143,211,0.14)',
  borderRadius: 2,
  boxShadow:
    '0 28px 72px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.04)',
  minHeight: 'min(590px, calc(100dvh - 32px))',
  width: 'min(640px, calc(100vw - 24px))',
} as const;

const sendLabelSx = {
  color: (t: Theme) =>
    t.palette.mode === 'dark' ? 'rgba(228,238,248,0.9)' : 'text.primary',
  fontSize: { xs: 14.5, sm: 15 },
  fontWeight: 700,
  lineHeight: 1.2,
} as const;

const helperSx = {
  color: 'text.secondary',
  fontSize: { xs: 12.5, sm: 13 },
  fontWeight: 500,
  lineHeight: 1.45,
  ml: 1.6,
  mt: 0.85,
} as const;

const fieldSx = {
  '& .MuiFormHelperText-root': {
    ...helperSx,
  },
  '& .MuiOutlinedInput-root': {
    bgcolor: (t: Theme) =>
      t.palette.mode === 'dark' ? 'rgba(0,8,16,0.2)' : 'rgba(255,255,255,0.72)',
    borderRadius: 1.35,
    minHeight: { xs: 54, sm: 56 },
    px: { xs: 1.2, sm: 1.35 },
    transition: 'background-color 160ms ease',
    '& fieldset': {
      borderColor: (t: Theme) =>
        t.palette.mode === 'dark'
          ? 'rgba(116,158,180,0.16)'
          : 'rgba(11,143,211,0.16)',
    },
    '&:hover fieldset': {
      borderColor: (t: Theme) =>
        t.palette.mode === 'dark'
          ? 'rgba(116,158,180,0.3)'
          : 'rgba(11,143,211,0.32)',
    },
    '&.Mui-focused': {
      bgcolor: (t: Theme) =>
        t.palette.mode === 'dark'
          ? 'rgba(0,8,16,0.2)'
          : 'rgba(255,255,255,0.86)',
    },
    '&.Mui-focused fieldset': {
      borderColor: 'rgba(24,189,242,0.62)',
      borderWidth: 1,
    },
  },
  '& .MuiOutlinedInput-input': {
    color: 'text.primary',
    fontSize: { xs: 16, sm: 16.5 },
    fontWeight: 500,
    py: 0,
    '&::placeholder': {
      color: 'text.secondary',
      fontWeight: 400,
      opacity: 0.58,
    },
  },
} as const;

const infoIconSx = {
  color: 'text.secondary',
  fontSize: { xs: 14.5, sm: 15 },
  opacity: 0.82,
} as const;

export function ExternalSendForm({
  addressError,
  addressHelperText,
  addressValidationPending = false,
  addressInputId,
  afterRecipientContent,
  amount,
  coinLogo,
  feeContent,
  maxSendable,
  onAmountChange,
  onClearRecipient,
  onClose,
  onOpenAddressBook,
  onRecipientChange,
  onSend,
  onSendMax,
  recipient,
  recipientDisplayName = '',
  recipientInputProps,
  recipientSubtitle,
  sendDisabled,
  showAddressBookButton = false,
  symbol,
}: ExternalSendFormProps) {
  const { t } = useTranslation(['core']);
  const displayRecipientSubtitle =
    recipientSubtitle ?? t('core:address_book_ui.contact');
  const safeMax = maxOrZero(maxSendable);
  const recipientInitials =
    recipientDisplayName
      .split(' ')
      .filter(Boolean)
      .map((part) => part[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || symbol[0];
  const recipientAvatarColor = getAddressBookAvatarColor(
    `${recipientDisplayName}-${recipient}`
  );

  return (
    <>
      <AppBar
        sx={{
          bgcolor: 'transparent',
          backgroundColor: 'transparent',
          backgroundImage: 'none',
          borderBottom: 'none',
          boxShadow: 'none',
          color: 'text.primary',
          position: 'static',
        }}
      >
        <Toolbar
          sx={{
            minHeight: '78px !important',
            px: { xs: 2.35, sm: 2.55 },
          }}
        >
          <IconButton
            color="inherit"
            onClick={onClose}
            aria-label="close"
            sx={{
              color: 'text.secondary',
              mr: { xs: 1.25, sm: 1.45 },
              p: 0.35,
              '& svg': { fontSize: 28 },
              '&:hover': {
                bgcolor: 'rgba(116,158,180,0.08)',
                color: 'text.primary',
              },
            }}
          >
            <Close />
          </IconButton>
          <Avatar
            sx={{
              bgcolor: 'transparent',
              boxShadow: '0 0 20px rgba(24,189,242,0.24)',
              height: { xs: 34, sm: 36 },
              mr: { xs: 1.65, sm: 1.8 },
              width: { xs: 34, sm: 36 },
            }}
            alt={`${symbol} Logo`}
            src={coinLogo}
          />
          <Typography
            variant="h6"
            noWrap
            component="div"
            sx={{
              color: 'text.primary',
              flexGrow: 1,
              fontSize: { xs: 18, sm: 19 },
              fontWeight: 700,
              letterSpacing: 0,
              lineHeight: 1,
            }}
          >
            {t('core:wallet.transfer_symbol', { symbol })}
          </Typography>
          <Button
            disabled={sendDisabled}
            variant="contained"
            startIcon={<NorthEast />}
            aria-label={`send-${symbol.toLowerCase()}`}
            onClick={onSend}
            sx={{
              bgcolor: '#0a9eff',
              backgroundImage:
                'linear-gradient(180deg, rgba(24,174,255,0.98), rgba(4,126,220,0.98))',
              border: '1px solid rgba(85,205,255,0.32)',
              borderRadius: 1.4,
              boxShadow:
                '0 10px 26px rgba(3,139,236,0.34), inset 0 1px 0 rgba(255,255,255,0.18)',
              color: 'white',
              fontSize: { xs: 14, sm: 14.5 },
              fontWeight: 700,
              justifySelf: 'end',
              minHeight: { xs: 38, sm: 40 },
              minWidth: { xs: 92, sm: 98 },
              px: { xs: 1.65, sm: 1.9 },
              '& .MuiButton-startIcon svg': {
                fontSize: 19,
              },
              '&:hover': {
                bgcolor: '#16baf2',
                boxShadow: '0 18px 44px rgba(24,189,242,0.38)',
              },
              '&:disabled': {
                bgcolor: 'rgba(116,158,180,0.18)',
                backgroundImage: 'none',
                borderColor: 'rgba(116,158,180,0.1)',
                boxShadow: 'none',
                color: 'rgba(255,255,255,0.44)',
              },
            }}
          >
            {t('core:action.send', { postProcess: 'capitalizeFirstChar' })}
          </Button>
        </Toolbar>
      </AppBar>

      <Box
        sx={{
          display: 'grid',
          gap: { xs: 2.85, sm: 3.05 },
          minHeight: { xs: 472, sm: 484 },
          px: { xs: 2.75, sm: 3 },
          pb: { xs: 2.85, sm: 3 },
          pt: { xs: 0.4, sm: 0.55 },
        }}
      >
        <Box sx={{ display: 'grid', gap: 0.85 }}>
          <Typography sx={sendLabelSx}>{t('core:send.to')}</Typography>
          {recipientDisplayName ? (
            <Box
              sx={{
                bgcolor: 'rgba(0,8,16,0.18)',
                border: '1px solid rgba(116,158,180,0.15)',
                borderRadius: 1.55,
                display: 'grid',
                overflow: 'hidden',
              }}
            >
              <Box
                sx={{
                  alignItems: 'center',
                  display: 'grid',
                  gap: 1.25,
                  gridTemplateColumns: 'auto minmax(0, 1fr) auto auto',
                  minHeight: { xs: 70, sm: 72 },
                  px: { xs: 1.65, sm: 1.75 },
                  py: { xs: 0.85, sm: 0.95 },
                }}
              >
                <Avatar
                  sx={{
                    ...getAddressBookAvatarSx(recipientAvatarColor),
                    fontSize: { xs: 13, sm: 13.5 },
                    fontWeight: 700,
                    height: { xs: 42, sm: 44 },
                    width: { xs: 42, sm: 44 },
                  }}
                >
                  {recipientInitials}
                </Avatar>
                <Box sx={{ display: 'grid', gap: 0.35, minWidth: 0 }}>
                  <Typography
                    noWrap
                    sx={{
                      color: 'text.primary',
                      fontSize: { xs: 18, sm: 18.5 },
                      fontWeight: 700,
                      lineHeight: 1.05,
                    }}
                  >
                    {recipientDisplayName}
                  </Typography>
                  <Typography
                    noWrap
                    sx={{
                      color: 'text.secondary',
                      fontSize: { xs: 13.2, sm: 13.6 },
                      fontWeight: 500,
                      lineHeight: 1,
                    }}
                  >
                    {displayRecipientSubtitle}
                  </Typography>
                </Box>
                {onClearRecipient ? (
                  <IconButton
                    aria-label={t('core:action.clear_recipient')}
                    onClick={onClearRecipient}
                    sx={{
                      color: 'text.secondary',
                      height: { xs: 32, sm: 34 },
                      width: { xs: 32, sm: 34 },
                      '& svg': { fontSize: { xs: 20, sm: 21 } },
                      '&:hover': {
                        bgcolor: 'rgba(116,158,180,0.08)',
                        color: 'text.primary',
                      },
                    }}
                  >
                    <Close />
                  </IconButton>
                ) : null}
                {showAddressBookButton && onOpenAddressBook ? (
                  <IconButton
                    aria-label={t('core:action.open_address_book')}
                    onClick={onOpenAddressBook}
                    sx={{
                      border: '1px solid rgba(116,158,180,0.12)',
                      borderRadius: 1.2,
                      color: 'primary.main',
                      height: { xs: 34, sm: 36 },
                      width: { xs: 34, sm: 36 },
                      '&:hover': {
                        bgcolor: 'rgba(24,189,242,0.08)',
                        borderColor: 'rgba(24,189,242,0.34)',
                        color: '#37d0ff',
                      },
                    }}
                  >
                    <PersonOutline sx={{ fontSize: { xs: 19, sm: 20 } }} />
                  </IconButton>
                ) : null}
              </Box>
              <Box
                sx={{
                  alignItems: 'center',
                  borderTop: '1px solid rgba(116,158,180,0.115)',
                  display: 'flex',
                  gap: 0.85,
                  minHeight: { xs: 40, sm: 42 },
                  minWidth: 0,
                  px: { xs: 1.65, sm: 1.75 },
                  py: 0.65,
                }}
              >
                <Typography
                  sx={{
                    color: 'text.secondary',
                    flexShrink: 0,
                    fontSize: { xs: 13, sm: 13.5 },
                    fontWeight: 600,
                  }}
                >
                  {t('core:send.address_label')}
                </Typography>
                <Typography
                  noWrap
                  sx={{
                    color: 'text.secondary',
                    fontSize: { xs: 13, sm: 13.5 },
                    fontWeight: 500,
                    minWidth: 0,
                  }}
                >
                  {recipient}
                </Typography>
              </Box>
            </Box>
          ) : (
            <TextField
              required
              id={addressInputId}
              value={recipient}
              onChange={onRecipientChange}
              error={addressError}
              fullWidth
              placeholder={t('core:send.symbol_address_placeholder', {
                symbol,
              })}
              helperText={
                addressError || addressValidationPending
                  ? addressHelperText
                  : undefined
              }
              slotProps={{
                htmlInput: {
                  'aria-label': t('core:send.symbol_receiver_address', {
                    symbol,
                  }),
                  autoCapitalize: 'none',
                  autoComplete: 'new-password',
                  autoCorrect: 'off',
                  spellCheck: false,
                  ...recipientInputProps,
                },
                input: {
                  endAdornment:
                    showAddressBookButton && onOpenAddressBook ? (
                      <InputAdornment position="end">
                        <Tooltip title={t('core:action.open_address_book')}>
                          <IconButton
                            aria-label={t('core:action.open_address_book')}
                            onClick={onOpenAddressBook}
                            sx={{
                              border: '1px solid rgba(116,158,180,0.12)',
                              borderRadius: 1,
                              color: 'primary.main',
                              height: { xs: 31, sm: 32 },
                              width: { xs: 31, sm: 32 },
                              '&:hover': {
                                bgcolor: 'rgba(24,189,242,0.08)',
                                borderColor: 'rgba(24,189,242,0.34)',
                                color: '#37d0ff',
                              },
                            }}
                          >
                            <PersonOutline sx={{ fontSize: 18 }} />
                          </IconButton>
                        </Tooltip>
                      </InputAdornment>
                    ) : undefined,
                },
              }}
              sx={{
                ...fieldSx,
                '& .MuiFormHelperText-root': {
                  ...helperSx,
                  color: addressError ? 'error.main' : 'text.secondary',
                },
              }}
            />
          )}
        </Box>

        {afterRecipientContent}

        <Box sx={{ display: 'grid', gap: 1.05 }}>
          <Box
            sx={{
              alignItems: 'center',
              display: 'flex',
              flexWrap: 'wrap',
              gap: 0.9,
              justifyContent: 'space-between',
            }}
          >
            <Typography sx={sendLabelSx}>
              {t('core:amount', { postProcess: 'capitalizeFirstChar' })}
            </Typography>
            <Box
              sx={{
                alignItems: 'center',
                display: 'inline-flex',
                gap: 0.75,
                minHeight: 26,
              }}
            >
              <Tooltip title={t('core:send.max_sendable_tooltip')}>
                <Box
                  sx={{
                    alignItems: 'center',
                    color: 'text.secondary',
                    display: 'inline-flex',
                    gap: 0.45,
                  }}
                >
                  <InfoOutlined sx={infoIconSx} />
                  <Typography
                    sx={{
                      color: 'text.secondary',
                      fontSize: { xs: 13.2, sm: 13.6 },
                      fontWeight: 500,
                      lineHeight: 1.2,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {t('core:send.max_sendable', {
                      amount: safeMax,
                      symbol,
                    })}
                  </Typography>
                </Box>
              </Tooltip>
              <Button
                variant="text"
                onClick={onSendMax}
                sx={{
                  color: 'primary.main',
                  fontSize: { xs: 13.8, sm: 14.2 },
                  fontWeight: 700,
                  lineHeight: 1,
                  minHeight: 24,
                  minWidth: 0,
                  px: 0.35,
                  py: 0,
                  '&:hover': {
                    bgcolor: 'transparent',
                    color: '#37d0ff',
                  },
                }}
              >
                {t('core:action.send_max', {
                  postProcess: 'capitalizeFirstChar',
                })}
              </Button>
            </Box>
          </Box>
          <NumericFormat
            decimalScale={8}
            defaultValue={0}
            value={amount === 0 ? '' : amount}
            allowNegative={false}
            customInput={TextField as ComponentType<any>}
            valueIsNumericString
            placeholder="0.00"
            fullWidth
            isAllowed={(values) => {
              const { formattedValue, floatValue } = values;
              return formattedValue === '' || (floatValue ?? 0) <= safeMax;
            }}
            onValueChange={(values) => {
              onAmountChange(values.floatValue ?? 0);
            }}
            required
            slotProps={{
              htmlInput: {
                'aria-label': `${symbol} amount`,
              },
              input: {
                endAdornment: (
                  <InputAdornment position="end">
                    <Typography
                      sx={{
                        color: 'text.secondary',
                        fontSize: { xs: 14.5, sm: 15 },
                        fontWeight: 700,
                        letterSpacing: 0,
                        lineHeight: 1,
                      }}
                    >
                      {symbol}
                    </Typography>
                  </InputAdornment>
                ),
              },
            }}
            sx={{
              ...fieldSx,
              '& .MuiOutlinedInput-root': {
                ...fieldSx['& .MuiOutlinedInput-root'],
                bgcolor: 'rgba(0,8,16,0.2)',
                borderRadius: 1.55,
                minHeight: { xs: 54, sm: 56 },
                px: { xs: 1.45, sm: 1.6 },
                '& fieldset': {
                  borderColor: 'rgba(24,158,255,0.9)',
                  boxShadow: '0 0 18px rgba(24,158,255,0.18)',
                },
                '&:hover fieldset': {
                  borderColor: 'rgba(24,174,255,0.96)',
                },
              },
              '& .MuiOutlinedInput-input': {
                color: 'text.primary',
                fontSize: { xs: 23, sm: 24 },
                fontWeight: 400,
                py: 0,
                textAlign: 'left',
                '&::placeholder': {
                  color: 'text.secondary',
                  fontWeight: 400,
                  opacity: 0.86,
                },
              },
            }}
          />
        </Box>

        {feeContent}

        <Box
          sx={{
            alignItems: 'flex-start',
            bgcolor: 'rgba(8, 57, 52, 0.34)',
            border: '1px solid rgba(34, 227, 138, 0.11)',
            borderRadius: 1.55,
            display: 'flex',
            gap: 1.6,
            px: { xs: 1.7, sm: 1.85 },
            py: { xs: 2.05, sm: 2.2 },
          }}
        >
          <ShieldOutlined
            sx={{ color: 'success.main', fontSize: { xs: 29, sm: 31 } }}
          />
          <Box sx={{ display: 'grid', gap: 0.35 }}>
            <Typography
              sx={{
                color: 'text.primary',
                fontSize: { xs: 13.5, sm: 14 },
                fontWeight: 700,
                lineHeight: 1.25,
              }}
            >
              {t('core:send.double_check_address')}
            </Typography>
            <Typography
              sx={{
                color: 'text.secondary',
                fontSize: { xs: 12.8, sm: 13.2 },
                fontWeight: 400,
                lineHeight: 1.35,
              }}
            >
              {t('core:send.irreversible')}
            </Typography>
          </Box>
        </Box>

        <Box
          sx={{
            alignItems: 'center',
            bgcolor: 'rgba(0,8,16,0.12)',
            border: '1px solid rgba(116,158,180,0.09)',
            borderRadius: 1.35,
            color: 'text.secondary',
            display: 'flex',
            gap: 0.75,
            justifyContent: 'center',
            minHeight: { xs: 40, sm: 42 },
            mt: -0.1,
            px: 1.4,
          }}
        >
          <LockOutlined sx={{ fontSize: { xs: 14, sm: 15 } }} />
          <Typography
            sx={{
              color: 'text.secondary',
              fontSize: { xs: 12.5, sm: 13 },
              fontWeight: 600,
              lineHeight: 1,
              textAlign: 'center',
            }}
          >
            {symbol === 'ARRR'
              ? t('core:send.secure_private_decentralized')
              : t('core:send.secure_decentralized')}
          </Typography>
        </Box>
      </Box>
    </>
  );
}

export function ExternalFeeSlider({
  defaultValue,
  fee,
  getAriaValueText,
  marks,
  max,
  min,
  onChange,
  sliderId,
  step,
}: ExternalFeeSliderProps) {
  const { t } = useTranslation(['core']);

  return (
    <>
      <Box
        sx={{
          alignItems: 'center',
          bgcolor: 'rgba(0,8,16,0.13)',
          border: '1px solid rgba(116,158,180,0.14)',
          borderRadius: 1.15,
          display: 'grid',
          gap: { xs: 1.35, sm: 1.55 },
          gridTemplateColumns: { xs: '1fr', sm: '148px minmax(0, 1fr)' },
          minHeight: 64,
          px: 1.55,
          py: 0.85,
        }}
      >
        <Box>
          <Typography
            sx={{
              color: 'text.secondary',
              fontSize: 12.5,
              fontWeight: 500,
              letterSpacing: 0,
              whiteSpace: 'nowrap',
            }}
          >
            {t('core:send.fee_per_byte')}
          </Typography>
          <Typography
            sx={{
              color: 'text.primary',
              fontSize: 17,
              fontWeight: 650,
              lineHeight: 1.1,
              mt: 0.45,
            }}
          >
            {fee} SAT
          </Typography>
        </Box>
        <Box sx={{ px: { xs: 0.5, sm: 1.2 } }}>
          <Slider
            track={false}
            step={step}
            min={min}
            max={max}
            value={fee || defaultValue}
            valueLabelDisplay="auto"
            aria-labelledby={sliderId}
            getAriaValueText={getAriaValueText}
            marks={marks}
            onChange={onChange}
            sx={{
              color: 'primary.main',
              '& .MuiSlider-mark': {
                bgcolor: 'rgba(255,255,255,0.4)',
                height: 3,
                width: 3,
              },
              '& .MuiSlider-markLabel': {
                color: 'text.secondary',
                fontSize: 11,
                fontWeight: 500,
              },
              '& .MuiSlider-rail': {
                bgcolor: 'rgba(116,158,180,0.28)',
                height: 3,
              },
              '& .MuiSlider-thumb': {
                boxShadow: '0 0 16px rgba(24,189,242,0.3)',
                height: 18,
                width: 18,
              },
            }}
          />
        </Box>
      </Box>
      <Box
        sx={{
          alignItems: 'center',
          color: 'text.secondary',
          display: 'inline-flex',
          gap: 0.75,
          justifySelf: 'end',
          mt: -0.75,
          opacity: 0.74,
          px: 0.4,
        }}
      >
        <InfoOutlined sx={infoIconSx} />
        <Tooltip title={t('core:message.generic.low_fee_transation')}>
          <Typography sx={{ fontSize: { xs: 12.5, sm: 13 }, fontWeight: 500 }}>
            {t('core:send.confirmation_speed')}
          </Typography>
        </Tooltip>
      </Box>
    </>
  );
}
