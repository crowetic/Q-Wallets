import {
  Add,
  CheckCircleOutline,
  Close,
  CopyAllTwoTone,
  Edit,
  ErrorOutline,
  FileDownloadOutlined,
  InfoOutlined,
  LockOutlined,
  NorthEast,
  Refresh,
  Search,
  SouthWest,
  Star,
  StarBorder,
  Sync,
  VerifiedRounded,
} from '@mui/icons-material';
import {
  Avatar,
  Box,
  Button,
  Collapse,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  InputAdornment,
  LinearProgress,
  TablePagination,
  TextField,
  Typography,
} from '@mui/material';
import type { Theme } from '@mui/material/styles';
import { Coin } from 'qapp-core';
import {
  ChangeEvent,
  DragEvent,
  KeyboardEvent,
  MouseEvent,
  ReactNode,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import QRCode from 'react-qr-code';
import arrrCoinRender from '../../assets/wallet-renders/arrr-coin-render.png';
import arrrCoinIcon from '../../assets/arrr.png';
import btcCoinRender from '../../assets/wallet-renders/btc-coin-render.png';
import btcCoinIcon from '../../assets/btc.png';
import dgbCoinRender from '../../assets/wallet-renders/dgb-coin-render.png';
import dgbCoinIcon from '../../assets/dgb.png';
import dogeCoinRender from '../../assets/wallet-renders/doge-coin-render.png';
import dogeCoinIcon from '../../assets/doge.png';
import ltcCoinRender from '../../assets/wallet-renders/ltc-coin-render.png';
import ltcCoinIcon from '../../assets/ltc.png';
import qortCoinRender from '../../assets/wallet-renders/qort-coin-render.png';
import qortCoinIcon from '../../assets/qort.png';
import rvnCoinRender from '../../assets/wallet-renders/rvn-coin-render.png';
import rvnCoinIcon from '../../assets/rvn.png';
import xmrCoinRender from '../../assets/wallet-renders/xmr-coin-render.svg';
import {
  copyToClipboard,
  cropString,
  epochToAgo,
} from '../../common/functions';
import {
  CustomWidthTooltip,
  WalletButtons,
  WalletCard,
} from '../../styles/page-styles';
import { AddressBookCoin, AddressBookEntry } from '../../utils/Types';
import {
  ADDRESS_BOOK_STORAGE_EVENT,
  deleteAddress,
  getAddressBook,
  moveAddressBookEntry,
  toggleAddressBookFavorite,
  updateAddress,
} from '../../utils/addressBookStorage';
import { DeleteConfirmationDialog } from '../AddressBook/DeleteConfirmationDialog';
import { AddressFormDialog } from '../AddressBook/AddressFormDialog';
import { NameText } from '../NameText';
import {
  getAddressBookAvatarColor,
  getAddressBookAvatarSx,
} from '../AddressBook/avatarPalette';
import { useTranslation } from 'react-i18next';

type AddressBookCoinSymbol =
  | 'QORT'
  | 'BTC'
  | 'LTC'
  | 'DOGE'
  | 'DGB'
  | 'RVN'
  | 'ARRR'
  | 'XMR';

export type WalletCoinSymbol = AddressBookCoinSymbol;

type WalletVisual = {
  accent: string;
  coinIcon: string;
  coinImage: string;
  coinType: AddressBookCoin;
  decimals: number;
  glow: string;
  glowSoft: string;
  name: string;
  symbol: WalletCoinSymbol;
};

const WALLET_VISUALS: Record<AddressBookCoinSymbol, WalletVisual> = {
  QORT: {
    accent: '#18bdf2',
    coinIcon: qortCoinIcon,
    coinImage: qortCoinRender,
    coinType: Coin.QORT,
    decimals: 2,
    glow: 'rgba(24, 189, 242, 0.42)',
    glowSoft: 'rgba(24, 189, 242, 0.13)',
    name: 'Qortal',
    symbol: 'QORT',
  },
  BTC: {
    accent: '#f6a70b',
    coinIcon: btcCoinIcon,
    coinImage: btcCoinRender,
    coinType: Coin.BTC,
    decimals: 8,
    glow: 'rgba(246, 167, 11, 0.38)',
    glowSoft: 'rgba(246, 167, 11, 0.11)',
    name: 'Bitcoin',
    symbol: 'BTC',
  },
  LTC: {
    accent: '#b9c4d4',
    coinIcon: ltcCoinIcon,
    coinImage: ltcCoinRender,
    coinType: Coin.LTC,
    decimals: 8,
    glow: 'rgba(185, 196, 212, 0.36)',
    glowSoft: 'rgba(185, 196, 212, 0.12)',
    name: 'Litecoin',
    symbol: 'LTC',
  },
  DOGE: {
    accent: '#d7aa36',
    coinIcon: dogeCoinIcon,
    coinImage: dogeCoinRender,
    coinType: Coin.DOGE,
    decimals: 8,
    glow: 'rgba(215, 170, 54, 0.36)',
    glowSoft: 'rgba(215, 170, 54, 0.11)',
    name: 'Dogecoin',
    symbol: 'DOGE',
  },
  DGB: {
    accent: '#2a75d9',
    coinIcon: dgbCoinIcon,
    coinImage: dgbCoinRender,
    coinType: Coin.DGB,
    decimals: 8,
    glow: 'rgba(42, 117, 217, 0.36)',
    glowSoft: 'rgba(42, 117, 217, 0.12)',
    name: 'DigiByte',
    symbol: 'DGB',
  },
  RVN: {
    accent: '#f09a38',
    coinIcon: rvnCoinIcon,
    coinImage: rvnCoinRender,
    coinType: Coin.RVN,
    decimals: 8,
    glow: 'rgba(240, 154, 56, 0.36)',
    glowSoft: 'rgba(56, 102, 214, 0.14)',
    name: 'Ravencoin',
    symbol: 'RVN',
  },
  ARRR: {
    accent: '#e0b64a',
    coinIcon: arrrCoinIcon,
    coinImage: arrrCoinRender,
    coinType: Coin.ARRR,
    decimals: 8,
    glow: 'rgba(224, 182, 74, 0.36)',
    glowSoft: 'rgba(224, 182, 74, 0.11)',
    name: 'Pirate Chain',
    symbol: 'ARRR',
  },
  XMR: {
    coinType: 'XMR',
    accent: '#f26822',
    coinIcon: xmrCoinRender,
    coinImage: xmrCoinRender,
    decimals: 12,
    glow: 'rgba(242, 104, 34, 0.38)',
    glowSoft: 'rgba(242, 104, 34, 0.12)',
    name: 'Monero',
    symbol: 'XMR' as const,
  },
};

const getWalletVars = (visual: Omit<WalletVisual, 'coinType'>) =>
  ({
    '--wallet-accent': visual.accent,
    '--wallet-coin-image': `url(${visual.coinImage})`,
    '--wallet-glow': visual.glow,
    '--wallet-glow-soft': visual.glowSoft,
  }) as Record<string, string>;

type WalletGlowLayerKey = 'coinShadow' | 'floorReflection' | 'floorShadow';

type WalletGlowLayerSettings = {
  blur: number;
  intensity: number;
  spread: number;
  x: number;
  y: number;
};

type WalletGlowDevSettings = Record<
  WalletGlowLayerKey,
  WalletGlowLayerSettings
>;

const DEFAULT_WALLET_GLOW_SETTINGS: WalletGlowDevSettings = {
  coinShadow: { blur: 57, intensity: 75, spread: 75, x: -7, y: 2 },
  floorReflection: { blur: 8, intensity: 220, spread: 109, x: -16, y: 14 },
  floorShadow: { blur: 7, intensity: 220, spread: 100, x: -7, y: 0 },
};

const createWalletGlowCssVars = (settings: WalletGlowDevSettings) => {
  const layerVars = (prefix: string, layer: WalletGlowLayerSettings) => ({
    [`--${prefix}-blur`]: `${layer.blur}px`,
    [`--${prefix}-intensity`]: `${layer.intensity / 100}`,
    [`--${prefix}-spread`]: `${layer.spread / 100}`,
    [`--${prefix}-x`]: `${layer.x}px`,
    [`--${prefix}-y`]: `${layer.y}px`,
  });

  return {
    ...layerVars('wallet-coin-shadow', settings.coinShadow),
    '--wallet-coin-shadow-blur-effective': `${
      (settings.coinShadow.blur * settings.coinShadow.spread) / 100
    }px`,
    '--wallet-coin-shadow-x-effective': `${
      (settings.coinShadow.x * settings.coinShadow.spread) / 100
    }px`,
    '--wallet-coin-shadow-y-effective': `${
      (settings.coinShadow.y * settings.coinShadow.spread) / 100
    }px`,
    ...layerVars('wallet-floor-reflection', settings.floorReflection),
    ...layerVars('wallet-floor-shadow', settings.floorShadow),
  } as Record<string, string>;
};

const WALLET_GLOW_CSS_VARS = createWalletGlowCssVars(
  DEFAULT_WALLET_GLOW_SETTINGS
);

const RECEIVE_QR_SLOT_HEIGHT = 404;

const walletOuterSurfaceSx = {
  backgroundColor: (t: Theme) =>
    t.palette.mode === 'dark'
      ? 'rgba(8, 32, 50, 0.66)'
      : t.palette.background.paper,
  backgroundImage: (t: Theme) =>
    t.palette.mode === 'dark'
      ? 'linear-gradient(180deg, rgba(13, 48, 72, 0.54) 0%, rgba(7, 28, 45, 0.58) 100%)'
      : 'none',
} as const;

const walletInnerSurfaceSx = {
  bgcolor: (t: Theme) =>
    t.palette.mode === 'dark' ? 'rgba(17, 60, 86, 0.34)' : 'background.paper',
} as const;

const WALLET_BALANCE_DISPLAY_LIMIT = '999,999.99'.length;

const formatWalletDisplayAmount = (
  value: unknown,
  symbol: WalletCoinSymbol,
  decimals = WALLET_VISUALS[symbol].decimals
) => {
  if (value === null || value === undefined || value === '')
    return `0 ${symbol}`;

  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return `${String(value)} ${symbol}`;

  const formatter = (maximumFractionDigits: number) =>
    new Intl.NumberFormat('en-US', {
      maximumFractionDigits,
      minimumFractionDigits: 0,
    }).format(numeric);

  let maximumFractionDigits = decimals;
  let formatted = formatter(maximumFractionDigits);

  while (
    formatted.length > WALLET_BALANCE_DISPLAY_LIMIT &&
    maximumFractionDigits > 0
  ) {
    maximumFractionDigits -= 1;
    formatted = formatter(maximumFractionDigits);
  }

  return `${formatted} ${symbol}`;
};

function ReceiveActionIcon({ open }: { open: boolean }) {
  const transition =
    'opacity 260ms ease, transform 520ms cubic-bezier(0.16, 1, 0.3, 1)';

  return (
    <Box
      aria-hidden="true"
      component="span"
      sx={{
        alignItems: 'center',
        display: 'inline-grid',
        height: 20,
        justifyItems: 'center',
        position: 'relative',
        width: 20,
        '& svg': {
          fontSize: 20,
          gridArea: '1 / 1',
          position: 'absolute',
          transformOrigin: 'center',
          transition,
        },
      }}
    >
      <SouthWest
        sx={{
          opacity: open ? 0 : 1,
          transform: open
            ? 'rotate(225deg) scale(0.42)'
            : 'rotate(0deg) scale(1)',
        }}
      />
      <Close
        sx={{
          opacity: open ? 1 : 0,
          transform: open
            ? 'rotate(0deg) scale(1)'
            : 'rotate(-225deg) scale(0.42)',
        }}
      />
    </Box>
  );
}

function ReceiveActionLabel({
  hideReceiveLabel,
  open,
  receiveLabel,
}: {
  hideReceiveLabel: string;
  open: boolean;
  receiveLabel: string;
}) {
  const labelSx = (visible: boolean, direction: number) =>
    ({
      gridArea: '1 / 1',
      opacity: visible ? 1 : 0,
      transform: visible
        ? 'translateY(0) scale(1)'
        : `translateY(${direction * 8}px) scale(0.94)`,
      transition:
        'opacity 240ms ease, transform 420ms cubic-bezier(0.16, 1, 0.3, 1)',
      whiteSpace: 'nowrap',
    }) as const;

  return (
    <Box
      aria-hidden="true"
      component="span"
      sx={{
        alignItems: 'center',
        display: 'inline-grid',
        justifyItems: 'center',
        minWidth: '7ch',
      }}
    >
      <Box component="span" sx={labelSx(!open, -1)}>
        {receiveLabel}
      </Box>
      <Box component="span" sx={labelSx(open, 1)}>
        {hideReceiveLabel}
      </Box>
    </Box>
  );
}

function ReceiveQrMotionContent({
  address,
  coin,
  onQrClick,
  open,
}: ReceiveQrPanelProps & { open: boolean }) {
  const [entered, setEntered] = useState(false);

  useEffect(() => {
    if (!open) {
      setEntered(false);
      return undefined;
    }

    const frameId = requestAnimationFrame(() => setEntered(true));
    return () => {
      cancelAnimationFrame(frameId);
    };
  }, [open]);

  const visible = open && entered;

  return (
    <Box
      sx={{
        opacity: visible ? 1 : 0,
        transformOrigin: 'top center',
        transition: open ? 'opacity 260ms ease-out' : 'opacity 320ms ease-in',
        willChange: 'opacity',
      }}
    >
      <ReceiveQrPanel address={address} coin={coin} onQrClick={onQrClick} />
    </Box>
  );
}

type ReceiveQrDialogProps = {
  address?: string | null;
  coin: WalletCoinSymbol;
  onClose: () => void;
  open: boolean;
};

function ReceiveQrDialog({
  address,
  coin,
  onClose,
  open,
}: ReceiveQrDialogProps) {
  const { t } = useTranslation(['core']);
  const visual = WALLET_VISUALS[coin];
  const value = address ?? '';

  return (
    <Dialog
      disableScrollLock
      disableAutoFocus
      disableRestoreFocus
      fullWidth
      maxWidth={false}
      onClose={onClose}
      open={open}
      slotProps={{
        backdrop: {
          sx: {
            backdropFilter: 'blur(8px)',
            backgroundColor: (t: Theme) =>
              t.palette.mode === 'dark'
                ? 'rgba(0, 7, 12, 0.68)'
                : 'rgba(15, 23, 42, 0.32)',
          },
        },
        paper: {
          sx: {
            ...getWalletVars(visual),
            backgroundColor: (t: Theme) =>
              t.palette.mode === 'dark' ? 'rgba(3, 17, 29, 0.985)' : '#ffffff',
            backgroundImage: (t: Theme) =>
              t.palette.mode === 'dark'
                ? 'radial-gradient(circle at 16% 8%, color-mix(in srgb, var(--wallet-accent) 16%, transparent), transparent 34%), linear-gradient(180deg, rgba(5,24,39,0.99) 0%, rgba(3,13,23,0.995) 100%)'
                : 'radial-gradient(circle at 16% 8%, color-mix(in srgb, var(--wallet-accent) 10%, transparent), transparent 34%), linear-gradient(180deg, rgba(255,255,255,0.99) 0%, rgba(246,250,252,0.995) 100%)',
            border: (t: Theme) =>
              t.palette.mode === 'dark'
                ? '1px solid rgba(91,132,158,0.28)'
                : '1px solid rgba(11,143,211,0.16)',
            borderRadius: 2,
            boxShadow: (t: Theme) =>
              t.palette.mode === 'dark'
                ? '0 28px 72px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.04)'
                : '0 24px 70px rgba(15,74,106,0.18), inset 0 1px 0 rgba(255,255,255,0.9)',
            color: 'text.primary',
            overflow: 'hidden',
            width: 'min(386px, calc(100vw - 28px))',
          },
        },
      }}
    >
      <DialogTitle
        sx={{
          alignItems: 'center',
          display: 'flex',
          gap: 1.35,
          minHeight: 74,
          pb: 1.3,
          pl: 2.4,
          pr: 6,
          pt: 2,
        }}
      >
        <Box
          component="img"
          alt={visual.symbol}
          src={visual.coinImage}
          sx={{
            filter: 'drop-shadow(0 0 18px var(--wallet-glow-soft))',
            height: 38,
            objectFit: 'contain',
            width: 38,
          }}
        />
        <Box sx={{ minWidth: 0 }}>
          <Typography
            sx={{
              fontSize: 19,
              fontWeight: 800,
              letterSpacing: 0,
              lineHeight: 1.1,
            }}
          >
            {t('core:wallet.receive_symbol', { symbol: visual.symbol })}
          </Typography>
          <Typography
            sx={{
              color: 'text.secondary',
              fontSize: 12.5,
              fontWeight: 600,
              lineHeight: 1.3,
              mt: 0.35,
            }}
          >
            {t('core:wallet.coin_address', { coin: visual.name })}
          </Typography>
        </Box>
        <IconButton
          aria-label={t('core:wallet.close_receive_qr_dialog')}
          onClick={onClose}
          size="small"
          sx={{
            color: 'text.secondary',
            position: 'absolute',
            right: 14,
            top: 14,
            '&:hover': {
              bgcolor: 'rgba(116,158,180,0.08)',
              color: 'text.primary',
            },
          }}
        >
          <Close fontSize="small" />
        </IconButton>
      </DialogTitle>
      <DialogContent
        sx={{
          display: 'grid',
          gap: 1.55,
          justifyItems: 'center',
          px: 2.4,
          pb: 2.4,
          pt: 0,
        }}
      >
        <Box
          sx={{
            bgcolor: '#fff',
            borderRadius: 1.25,
            boxShadow:
              '0 0 0 1px rgba(255,255,255,0.08), 0 18px 42px rgba(0,0,0,0.22)',
            p: 1.1,
            width: 'min(246px, 100%)',
          }}
        >
          <QRCode
            value={value}
            size={224}
            fgColor="#000000"
            bgColor="#ffffff"
            level="H"
            style={{ display: 'block', height: '100%', width: '100%' }}
          />
        </Box>
        <Box
          sx={{
            alignItems: 'center',
            bgcolor: (t: Theme) =>
              t.palette.mode === 'dark'
                ? 'rgba(3, 16, 27, 0.64)'
                : 'rgba(246,250,252,0.82)',
            border: (t: Theme) =>
              t.palette.mode === 'dark'
                ? '1px solid rgba(116,158,180,0.16)'
                : '1px solid rgba(11,143,211,0.16)',
            borderRadius: 1,
            display: 'flex',
            gap: 1,
            minHeight: 46,
            px: 1.2,
            width: '100%',
          }}
        >
          <Typography
            sx={{
              color: value ? 'text.primary' : 'text.secondary',
              flex: 1,
              fontSize: 13.5,
              fontWeight: 700,
              minWidth: 0,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {value || t('core:wallet.no_address_available')}
          </Typography>
          <CustomWidthTooltip
            placement="top"
            title={t('core:action.copy_address', {
              postProcess: 'capitalizeFirstChar',
            })}
          >
            <span style={{ display: 'inline-flex' }}>
              <IconButton
                disabled={!value}
                onClick={() => copyToClipboard(value)}
                size="small"
                sx={{
                  color: 'text.secondary',
                  ml: 'auto',
                  '&:hover': { color: 'var(--wallet-accent)' },
                }}
              >
                <CopyAllTwoTone fontSize="small" />
              </IconButton>
            </span>
          </CustomWidthTooltip>
        </Box>
      </DialogContent>
    </Dialog>
  );
}

const toFiniteWalletNumber = (value: unknown) => {
  const parsed =
    typeof value === 'number' ? value : Number.parseFloat(String(value ?? 0));
  return Number.isFinite(parsed) ? parsed : null;
};

const useChargingBalance = (
  value: unknown,
  isLoading?: boolean,
  balanceError?: string | null
) => {
  const [animatedValue, setAnimatedValue] = useState<number | null>(null);
  const previousTargetRef = useRef<number | null>(null);

  useEffect(() => {
    const target = toFiniteWalletNumber(value);

    if (isLoading || balanceError || target === null) {
      previousTargetRef.current = null;
      setAnimatedValue(null);
      return;
    }

    const previousTarget = previousTargetRef.current;
    previousTargetRef.current = target;

    if (previousTarget === target) {
      setAnimatedValue(target);
      return;
    }

    const absTarget = Math.abs(target);
    const chargeOffset =
      absTarget > 0
        ? Math.max(absTarget * 0.035, Math.min(absTarget, 0.01))
        : 0;
    const startValue =
      target >= 0 ? Math.max(0, target - chargeOffset) : target;
    const duration = 720;
    const startedAt = performance.now();
    let frameId = 0;

    const tick = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      setAnimatedValue(startValue + (target - startValue) * eased);

      if (progress < 1) {
        frameId = requestAnimationFrame(tick);
      }
    };

    setAnimatedValue(startValue);
    frameId = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(frameId);
  }, [balanceError, isLoading, value]);

  return animatedValue;
};

type WalletSummaryCardProps = {
  address?: string | null;
  balance?: unknown;
  balanceDecimals?: number;
  balanceError?: string | null;
  coin: WalletCoinSymbol;
  formattedBalance?: string;
  copyAddressLabel?: string;
  hideReceiveLabel?: string;
  isBalanceLoading?: boolean;
  noAddressLabel?: string;
  onSend: () => void;
  onToggleReceive: () => void;
  receiveLabel?: string;
  receiveOpen: boolean;
  sendLabel?: string;
};

export function WalletSummaryCard({
  address,
  balance,
  balanceDecimals,
  balanceError,
  coin,
  copyAddressLabel,
  formattedBalance,
  hideReceiveLabel,
  isBalanceLoading,
  noAddressLabel,
  onSend,
  onToggleReceive,
  receiveLabel,
  receiveOpen,
  sendLabel,
}: WalletSummaryCardProps) {
  const { t } = useTranslation(['core']);
  const visual = WALLET_VISUALS[coin];
  const displayCopyAddressLabel =
    copyAddressLabel ??
    t('core:action.copy_address', { postProcess: 'capitalizeFirstChar' });
  const displayHideReceiveLabel = hideReceiveLabel ?? t('core:wallet.hide_qr');
  const displayNoAddressLabel =
    noAddressLabel ?? t('core:wallet.no_address_available');
  const displayReceiveLabel =
    receiveLabel ??
    t('core:wallet.receive', { postProcess: 'capitalizeFirstChar' });
  const displaySendLabel =
    sendLabel ?? t('core:action.send', { postProcess: 'capitalizeFirstChar' });
  const addressLabel = address || displayNoAddressLabel;
  const animatedBalance = useChargingBalance(
    balance,
    isBalanceLoading,
    balanceError
  );
  const stableFormattedBalance =
    formattedBalance ??
    formatWalletDisplayAmount(balance, visual.symbol, balanceDecimals);
  const displayFormattedBalance =
    formattedBalance ??
    formatWalletDisplayAmount(
      animatedBalance ?? balance,
      visual.symbol,
      balanceDecimals
    );
  const balanceAmount = displayFormattedBalance.endsWith(` ${visual.symbol}`)
    ? displayFormattedBalance.slice(0, -(visual.symbol.length + 1))
    : displayFormattedBalance;
  const balanceFitUnits = Math.max(5.6, stableFormattedBalance.length * 0.62);
  const balanceFontSize = {
    xs: `min(clamp(2rem, 12vw, 3rem), calc(100cqw / ${balanceFitUnits}))`,
    md: `min(clamp(2.45rem, 4vw, 3.35rem), calc(100cqw / ${balanceFitUnits}))`,
  };

  return (
    <WalletCard
      sx={{
        ...getWalletVars(visual),
        backgroundColor: 'transparent',
        backgroundImage: 'none',
        borderColor: 'transparent',
        borderRadius: 0,
        boxShadow: 'none',
        minHeight: { md: 250 },
        overflow: 'visible',
        position: 'relative',
        width: '100%',
      }}
    >
      <Box
        sx={{
          alignItems: 'center',
          display: 'grid',
          gap: { xs: 2.25, md: 2.5 },
          gridTemplateColumns: {
            xs: '1fr',
            md: 'minmax(150px, 0.46fr) minmax(220px, 0.68fr) minmax(280px, 0.86fr)',
            xl: 'minmax(250px, 0.55fr) minmax(285px, 0.72fr) minmax(380px, 0.95fr)',
          },
          minHeight: { md: 250 },
          pb: { xs: 2.25, md: 2.45 },
          pl: { xs: 2.25, md: 2.5, lg: 3.4 },
          pr: { xs: 2.25, md: 4.1 },
          pt: { xs: 2.25, md: 2.45 },
          position: 'relative',
          zIndex: 1,
        }}
      >
        <Box
          aria-hidden="true"
          sx={{
            alignItems: 'center',
            display: 'flex',
            isolation: 'isolate',
            justifyContent: { xs: 'center', md: 'flex-start' },
            minHeight: { xs: 188, md: 210 },
            minWidth: 0,
            overflow: 'visible',
            position: 'relative',
            '&::before': {
              background:
                'radial-gradient(ellipse at 50% 50%, rgba(0,0,0,0.48) 0%, rgba(0,0,0,0.25) 35%, transparent 72%)',
              bottom: { xs: 16, md: 21 },
              content: '""',
              filter: 'blur(var(--wallet-floor-shadow-blur, 7px))',
              height: { xs: 20, md: 24 },
              left: { xs: '21%', md: '7%' },
              opacity: 'calc(0.62 * var(--wallet-floor-shadow-intensity, 1))',
              pointerEvents: 'none',
              position: 'absolute',
              transform:
                'translate(var(--wallet-floor-shadow-x, 0px), var(--wallet-floor-shadow-y, 0px)) perspective(180px) rotateX(64deg) scale(var(--wallet-floor-shadow-spread, 1))',
              width: { xs: '58%', md: '78%' },
              zIndex: 0,
            },
            '&::after': {
              background: `
                radial-gradient(ellipse at 48% 54%, color-mix(in srgb, var(--wallet-accent) 58%, transparent) 0%, color-mix(in srgb, var(--wallet-accent) 28%, transparent) 17%, transparent 50%),
                radial-gradient(ellipse at 50% 66%, rgba(255,255,255,0.18) 0%, color-mix(in srgb, var(--wallet-accent) 18%, transparent) 12%, transparent 36%),
                linear-gradient(90deg, transparent 0%, color-mix(in srgb, var(--wallet-accent) 22%, transparent) 26%, color-mix(in srgb, var(--wallet-accent) 11%, transparent) 55%, transparent 86%)
              `,
              bottom: { xs: 13, md: 17 },
              borderRadius: '50%',
              content: '""',
              filter: 'blur(var(--wallet-floor-reflection-blur, 8px))',
              height: { xs: 28, md: 38 },
              left: { xs: '12%', md: '-3%' },
              opacity:
                'calc(0.78 * var(--wallet-floor-reflection-intensity, 1))',
              pointerEvents: 'none',
              position: 'absolute',
              transform:
                'translate(var(--wallet-floor-reflection-x, 0px), var(--wallet-floor-reflection-y, 0px)) perspective(190px) rotateX(66deg) scale(var(--wallet-floor-reflection-spread, 1))',
              width: { xs: '82%', md: '126%' },
              zIndex: 0,
            },
          }}
        >
          <Box
            sx={{
              alignItems: 'center',
              aspectRatio: '1 / 1',
              display: 'flex',
              justifyContent: 'center',
              position: 'relative',
              width: 'clamp(154px, 15.4vw, 236px)',
              zIndex: 1,
            }}
          >
            <Box
              component="img"
              alt=""
              src={visual.coinImage}
              sx={{
                filter:
                  'drop-shadow(var(--wallet-coin-shadow-x-effective, 0px) var(--wallet-coin-shadow-y-effective, 28px) var(--wallet-coin-shadow-blur-effective, 24px) rgba(0,0,0,calc(0.52 * var(--wallet-coin-shadow-intensity, 1)))) drop-shadow(0 0 11px color-mix(in srgb, var(--wallet-accent) 76%, transparent)) drop-shadow(22px 0 30px color-mix(in srgb, var(--wallet-accent) 28%, transparent))',
                maxHeight: 'clamp(150px, 16.2vw, 250px)',
                maxWidth: 'clamp(150px, 16.2vw, 250px)',
                objectFit: 'contain',
                opacity: 0.96,
                position: 'relative',
                animation: 'walletCoinFloat 5200ms ease-in-out infinite',
                width: '112%',
                zIndex: 1,
                '@keyframes walletCoinFloat': {
                  '0%, 100%': {
                    transform: 'translateY(0) rotate(-4deg)',
                  },
                  '50%': {
                    transform: 'translateY(-5px) rotate(-3.2deg)',
                  },
                },
              }}
            />
          </Box>
        </Box>

        <Box
          sx={{
            alignContent: 'center',
            display: 'grid',
            gap: { xs: 1.85, md: 1.7 },
            minHeight: { md: 170 },
            minWidth: 0,
          }}
        >
          <Box
            sx={{
              display: 'grid',
              gap: 0.65,
              minHeight: 58,
              minWidth: 0,
            }}
          >
            <Box sx={{ alignItems: 'center', display: 'flex', gap: 0.75 }}>
              <Typography
                sx={{
                  color: 'text.primary',
                  fontSize: { xs: 22, md: 24 },
                  fontWeight: 700,
                  lineHeight: 1.05,
                }}
              >
                {t('core:wallet.coin_wallet', { coin: visual.name })}
              </Typography>
              <VerifiedRounded
                sx={{
                  color: 'var(--wallet-accent)',
                  filter: 'drop-shadow(0 0 8px var(--wallet-glow))',
                  fontSize: 19,
                }}
              />
            </Box>
            <Typography sx={{ color: 'text.secondary', fontWeight: 600 }}>
              {visual.symbol}
            </Typography>
          </Box>

          <Box
            sx={{
              containerType: 'inline-size',
              minWidth: 0,
            }}
          >
            <Typography
              variant="body2"
              sx={{ color: 'text.secondary', fontWeight: 500 }}
            >
              {t('core:wallet.available_balance')}
            </Typography>
            <Typography
              component="div"
              sx={{
                alignItems: 'baseline',
                display: 'flex',
                fontSize: balanceFontSize,
                fontWeight: 700,
                gap: '0.32em',
                lineHeight: 1,
                maxWidth: '100%',
                minHeight: {
                  xs: 'clamp(2.15rem, 12vw, 3.1rem)',
                  md: 'clamp(2.6rem, 4vw, 3.45rem)',
                },
                mt: 0.55,
                overflow: 'hidden',
                whiteSpace: 'nowrap',
              }}
            >
              {isBalanceLoading && !balanceError ? (
                <Box sx={{ alignSelf: 'center', maxWidth: 260, width: '100%' }}>
                  <LinearProgress />
                </Box>
              ) : balanceError ? (
                <Typography color="error.main" sx={{ fontWeight: 700 }}>
                  {balanceError}
                </Typography>
              ) : (
                <>
                  <Typography
                    component="span"
                    sx={{
                      font: 'inherit',
                      fontWeight: 'inherit',
                      lineHeight: 1,
                      minWidth: 0,
                      overflow: 'hidden',
                      textOverflow: 'clip',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {balanceAmount}
                  </Typography>
                  <Typography
                    component="span"
                    sx={{
                      flexShrink: 0,
                      fontSize: '0.34em',
                      fontWeight: 700,
                      lineHeight: 1,
                    }}
                  >
                    {visual.symbol}
                  </Typography>
                </>
              )}
            </Typography>
          </Box>
        </Box>

        <Box
          sx={{
            alignContent: 'center',
            display: 'grid',
            gap: 1.35,
            minHeight: { md: 190 },
          }}
        >
          <Typography
            variant="caption"
            sx={{
              color: 'text.secondary',
              fontSize: 13,
              fontWeight: 600,
              lineHeight: 1,
            }}
          >
            {t('core:wallet.your_address')}
          </Typography>
          <Box
            sx={{
              alignItems: 'center',
              background: (t) =>
                t.palette.mode === 'dark'
                  ? 'linear-gradient(90deg, color-mix(in srgb, var(--wallet-accent) 7%, rgba(0, 8, 16, 0.4)) 0%, rgba(0, 8, 16, 0.36) 38%, rgba(0, 8, 16, 0.44) 100%)'
                  : 'linear-gradient(90deg, color-mix(in srgb, var(--wallet-accent) 7%, rgba(255,255,255,0.96)) 0%, rgba(255,255,255,0.92) 48%, rgba(248,252,255,0.96) 100%)',
              border:
                '1px solid color-mix(in srgb, var(--wallet-accent) 18%, rgba(116,158,180,0.24))',
              borderRadius: 1,
              boxShadow:
                'inset 1px 0 0 color-mix(in srgb, var(--wallet-accent) 18%, transparent), inset 0 1px 0 rgba(255,255,255,0.035)',
              display: 'flex',
              gap: 1,
              minHeight: 54,
              minWidth: 0,
              px: 1.35,
              py: 0.9,
            }}
          >
            <Typography
              variant="body2"
              sx={{
                color: address ? 'text.primary' : 'text.secondary',
                fontSize: 14,
                fontWeight: 600,
                minWidth: 0,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {addressLabel}
            </Typography>
            <CustomWidthTooltip placement="top" title={displayCopyAddressLabel}>
              <IconButton
                size="small"
                onClick={() => copyToClipboard(address ?? '')}
                sx={{
                  color: 'text.secondary',
                  ml: 'auto',
                  '&:hover': { color: 'var(--wallet-accent)' },
                }}
              >
                <CopyAllTwoTone fontSize="small" />
              </IconButton>
            </CustomWidthTooltip>
          </Box>

          <Box
            sx={{
              display: 'grid',
              gap: 1.4,
              gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
            }}
          >
            <WalletButtons
              variant="contained"
              startIcon={<NorthEast />}
              aria-label={t('core:wallet.send_symbol', {
                symbol: visual.symbol,
              })}
              onClick={onSend}
              sx={{
                background: (t) =>
                  t.palette.mode === 'dark'
                    ? 'linear-gradient(180deg, color-mix(in srgb, var(--wallet-accent) 36%, rgba(20,39,53,0.96)) 0%, color-mix(in srgb, var(--wallet-accent) 24%, rgba(7,18,30,0.98)) 100%)'
                    : 'linear-gradient(180deg, color-mix(in srgb, var(--wallet-accent) 86%, #ffffff) 0%, color-mix(in srgb, var(--wallet-accent) 72%, #0b5f8d) 100%)',
                border:
                  '1px solid color-mix(in srgb, var(--wallet-accent) 52%, transparent)',
                boxShadow:
                  '0 12px 28px color-mix(in srgb, var(--wallet-accent) 14%, transparent), inset 1px 0 0 color-mix(in srgb, var(--wallet-accent) 26%, transparent), inset 0 1px 0 rgba(255,255,255,0.1)',
                color: (t) =>
                  t.palette.mode === 'dark' ? 'text.primary' : '#ffffff',
                fontSize: 15,
                fontWeight: 700,
                minHeight: 52,
                '&:hover': {
                  background: (t) =>
                    t.palette.mode === 'dark'
                      ? 'linear-gradient(180deg, color-mix(in srgb, var(--wallet-accent) 46%, rgba(24,45,60,0.98)) 0%, color-mix(in srgb, var(--wallet-accent) 30%, rgba(7,18,30,0.98)) 100%)'
                      : 'linear-gradient(180deg, color-mix(in srgb, var(--wallet-accent) 92%, #ffffff) 0%, color-mix(in srgb, var(--wallet-accent) 76%, #0b5f8d) 100%)',
                  borderColor: 'var(--wallet-accent)',
                  boxShadow:
                    '0 14px 32px color-mix(in srgb, var(--wallet-accent) 24%, transparent), inset 0 1px 0 rgba(255,255,255,0.12)',
                },
              }}
            >
              {displaySendLabel}
            </WalletButtons>
            <Button
              aria-label={
                receiveOpen ? displayHideReceiveLabel : displayReceiveLabel
              }
              disableFocusRipple
              disableRipple
              onClick={onToggleReceive}
              startIcon={<ReceiveActionIcon open={receiveOpen} />}
              variant="outlined"
              sx={{
                bgcolor: (t) =>
                  t.palette.mode === 'dark'
                    ? 'rgba(0, 8, 16, 0.28)'
                    : 'rgba(255,255,255,0.76)',
                borderColor:
                  'color-mix(in srgb, var(--wallet-accent) 16%, rgba(116,158,180,0.24))',
                boxShadow:
                  'inset 1px 0 0 color-mix(in srgb, var(--wallet-accent) 12%, transparent)',
                color: 'var(--wallet-accent)',
                fontSize: 15,
                fontWeight: 700,
                minHeight: 52,
                transition:
                  'background-color 180ms ease, border-color 180ms ease, box-shadow 180ms ease, color 180ms ease',
                '& .MuiButton-startIcon': {
                  alignItems: 'center',
                  display: 'inline-flex',
                  height: 20,
                  justifyContent: 'center',
                  mr: 0.9,
                  width: 20,
                },
                '&:hover': {
                  bgcolor:
                    'color-mix(in srgb, var(--wallet-accent) 8%, transparent)',
                  borderColor: 'var(--wallet-accent)',
                },
              }}
            >
              <ReceiveActionLabel
                hideReceiveLabel={displayHideReceiveLabel}
                open={receiveOpen}
                receiveLabel={displayReceiveLabel}
              />
            </Button>
          </Box>
        </Box>
      </Box>
    </WalletCard>
  );
}

type ReceiveQrPanelProps = {
  address?: string | null;
  coin: WalletCoinSymbol;
  copyLabel?: string;
  downloadLabel?: string;
  onQrClick?: () => void;
};

export function ReceiveQrPanel({
  address,
  coin,
  downloadLabel,
  onQrClick,
}: ReceiveQrPanelProps) {
  const { t } = useTranslation(['core']);
  const visual = WALLET_VISUALS[coin];
  const qrRef = useRef<HTMLDivElement | null>(null);
  const value = address ?? '';

  const handleDownload = () => {
    const svg = qrRef.current?.querySelector('svg');
    if (!svg) return;

    const clonedSvg = svg.cloneNode(true) as SVGElement;
    clonedSvg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    const svgData = new XMLSerializer().serializeToString(clonedSvg);
    const blob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${visual.symbol.toLowerCase()}-receive-qr.svg`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <WalletCard
      sx={{
        ...getWalletVars(visual),
        ...walletOuterSurfaceSx,
        alignItems: 'center',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.025)',
        display: 'grid',
        filter: 'none',
        justifyItems: 'center',
        minHeight: { md: 342 },
        overflow: 'hidden',
        p: { xs: 2, md: 2.25 },
        width: '100%',
      }}
    >
      <Box sx={{ textAlign: 'center', width: '100%' }}>
        <Typography sx={{ fontSize: 15, fontWeight: 700, mb: 1.25 }}>
          {t('core:wallet.receive_symbol', { symbol: visual.symbol })}
        </Typography>
        <Box
          component="button"
          type="button"
          aria-label={t('core:wallet.show_receive_qr', {
            symbol: visual.symbol,
          })}
          onClick={onQrClick}
          sx={{
            appearance: 'none',
            background: 'transparent',
            border: 0,
            borderRadius: 1.5,
            cursor: onQrClick ? 'pointer' : 'default',
            display: 'inline-grid',
            font: 'inherit',
            p: 0.35,
            position: 'relative',
            '&:hover .qr-target-frame': {
              borderColor: 'var(--wallet-accent)',
            },
          }}
        >
          <Box
            className="qr-target-frame"
            sx={{
              ...walletInnerSurfaceSx,
              border: '1px solid rgba(116,158,180,0.16)',
              borderRadius: 1.5,
              p: 0.95,
              position: 'relative',
              transition: 'border-color 160ms ease',
            }}
          >
            <Box
              ref={qrRef}
              sx={{
                aspectRatio: '1 / 1',
                bgcolor: '#fff',
                borderRadius: 1,
                p: 1.05,
                width: { xs: 190, md: 212 },
              }}
            >
              <QRCode
                value={value}
                size={204}
                fgColor="#000000"
                bgColor="#ffffff"
                level="H"
                style={{ height: '100%', width: '100%' }}
              />
            </Box>
          </Box>
        </Box>
        <Typography variant="body2" sx={{ color: 'text.secondary', mt: 1.25 }}>
          {t('core:wallet.scan_receive')}
        </Typography>
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'center',
            mt: 1.5,
          }}
        >
          <Button
            onClick={handleDownload}
            size="small"
            startIcon={<FileDownloadOutlined />}
            variant="outlined"
          >
            {downloadLabel ?? t('core:wallet.download')}
          </Button>
        </Box>
      </Box>
    </WalletCard>
  );
}

type WalletAddressBookPanelProps = {
  coin: AddressBookCoinSymbol;
  onAddContact: () => void;
  onAddressBookChange?: () => void;
  onSelectAddress: (address: string, name: string) => void;
  refreshKey?: unknown;
};

export function WalletAddressBookPanel({
  coin,
  onAddContact,
  onAddressBookChange,
  onSelectAddress,
  refreshKey,
}: WalletAddressBookPanelProps) {
  const { t } = useTranslation(['core']);
  const visual = WALLET_VISUALS[coin];
  const [entries, setEntries] = useState<AddressBookEntry[]>([]);
  const [search, setSearch] = useState('');
  const [draggedEntryId, setDraggedEntryId] = useState<string | null>(null);
  const [dragOverEntryId, setDragOverEntryId] = useState<string | null>(null);
  const [editingEntry, setEditingEntry] = useState<
    AddressBookEntry | undefined
  >(undefined);
  const [deletingEntry, setDeletingEntry] = useState<
    AddressBookEntry | undefined
  >(undefined);
  const [editFormOpen, setEditFormOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [editSaveError, setEditSaveError] = useState('');
  const [suppressSelect, setSuppressSelect] = useState(false);

  useEffect(() => {
    setEntries(getAddressBook(visual.coinType));
  }, [refreshKey, visual.coinType]);

  useEffect(() => {
    const handleAddressBookStorage = () => {
      setEntries(getAddressBook(visual.coinType));
    };

    window.addEventListener(
      ADDRESS_BOOK_STORAGE_EVENT,
      handleAddressBookStorage
    );
    return () => {
      window.removeEventListener(
        ADDRESS_BOOK_STORAGE_EVENT,
        handleAddressBookStorage
      );
    };
  }, [visual.coinType]);

  const visibleEntries = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return entries;
    return entries.filter(
      (entry) =>
        entry.name.toLowerCase().includes(query) ||
        entry.address.toLowerCase().includes(query) ||
        entry.note.toLowerCase().includes(query)
    );
  }, [entries, search]);

  const maxVisibleContacts = 12;
  const displayedEntries = visibleEntries.slice(0, maxVisibleContacts);
  const hasMoreContacts = visibleEntries.length > maxVisibleContacts;

  const reloadEntries = () => {
    const nextEntries = getAddressBook(visual.coinType);
    setEntries(nextEntries);
    return nextEntries;
  };

  const handleToggleFavorite = (
    event: MouseEvent<HTMLButtonElement>,
    entry: AddressBookEntry
  ) => {
    event.stopPropagation();
    event.currentTarget.blur();
    const updatedEntries = toggleAddressBookFavorite(entry.id, visual.coinType);
    if (updatedEntries) {
      reloadEntries();
      onAddressBookChange?.();
    }
  };

  const handleEditContact = (
    event: MouseEvent<HTMLButtonElement>,
    entry: AddressBookEntry
  ) => {
    event.stopPropagation();
    event.currentTarget.blur();
    setEditSaveError('');
    setEditingEntry(entry);
    setEditFormOpen(true);
  };

  const handleEditFormClose = () => {
    setEditFormOpen(false);
  };

  const handleEditFormExited = () => {
    setEditingEntry(undefined);
    setEditSaveError('');
  };

  const handleDeleteClick = (entry: AddressBookEntry) => {
    setDeletingEntry(entry);
    setDeleteConfirmOpen(true);
  };

  const handleDeleteCancel = () => {
    setDeleteConfirmOpen(false);
    setDeletingEntry(undefined);
  };

  const handleDeleteConfirm = () => {
    if (!deletingEntry) return;

    const deleted = deleteAddress(deletingEntry.id, visual.coinType);
    if (deleted) {
      reloadEntries();
      onAddressBookChange?.();
      if (editingEntry?.id === deletingEntry.id) {
        setEditFormOpen(false);
      }
    }

    setDeleteConfirmOpen(false);
    setDeletingEntry(undefined);
  };

  const handleEditSave = (
    entry: Omit<AddressBookEntry, 'id' | 'createdAt'>
  ) => {
    if (!editingEntry) return;

    try {
      const savedEntry = updateAddress(editingEntry.id, visual.coinType, {
        name: entry.name,
        address: entry.address,
        note: entry.note,
      });

      if (!savedEntry) {
        throw new Error('Could not save contact.');
      }

      reloadEntries();
      setEditFormOpen(false);
      setEditSaveError('');
      onAddressBookChange?.();
    } catch (error: any) {
      console.error('Error saving address:', error);
      setEditSaveError(
        error?.message || 'Could not save contact. Please try again.'
      );
    }
  };

  const handleReorder = (sourceId: string, targetId: string) => {
    const updatedEntries = moveAddressBookEntry(
      visual.coinType,
      sourceId,
      targetId
    );
    if (updatedEntries) {
      reloadEntries();
      onAddressBookChange?.();
    }
  };

  const handleDragStart = (
    event: DragEvent<HTMLDivElement>,
    entry: AddressBookEntry
  ) => {
    setDraggedEntryId(entry.id);
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', entry.id);
  };

  const handleDragOver = (
    event: DragEvent<HTMLDivElement>,
    entry: AddressBookEntry
  ) => {
    if (!draggedEntryId || draggedEntryId === entry.id) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    setDragOverEntryId(entry.id);
  };

  const handleDrop = (
    event: DragEvent<HTMLDivElement>,
    entry: AddressBookEntry
  ) => {
    event.preventDefault();
    const sourceId = draggedEntryId || event.dataTransfer.getData('text/plain');
    setDraggedEntryId(null);
    setDragOverEntryId(null);

    if (!sourceId || sourceId === entry.id) return;

    setSuppressSelect(true);
    handleReorder(sourceId, entry.id);
    window.setTimeout(() => setSuppressSelect(false), 0);
  };

  const handleDragEnd = () => {
    setDraggedEntryId(null);
    setDragOverEntryId(null);
  };

  return (
    <>
      <WalletCard
        sx={{
          ...getWalletVars(visual),
          background: (t) =>
            t.palette.mode === 'dark'
              ? 'linear-gradient(180deg, rgba(10, 34, 52, 0.82) 0%, rgba(7, 27, 43, 0.76) 100%)'
              : 'linear-gradient(180deg, rgba(255,255,255,0.92) 0%, rgba(247,251,253,0.9) 100%)',
          borderColor: (t) =>
            t.palette.mode === 'dark'
              ? 'rgba(116,158,180,0.14)'
              : 'rgba(11,143,211,0.14)',
          boxShadow: (t) =>
            t.palette.mode === 'dark'
              ? 'inset 0 1px 0 rgba(255,255,255,0.04)'
              : '0 18px 48px rgba(15, 74, 106, 0.08), inset 0 1px 0 rgba(255,255,255,0.82)',
          overflow: 'hidden',
          width: '100%',
        }}
      >
        <Box sx={{ px: { xs: 1.75, md: 2.1 }, py: { xs: 1.75, md: 2 } }}>
          <Typography sx={{ fontSize: 16, fontWeight: 700, mb: 1.2 }}>
            {t('core:wallet.address_book_for_symbol', {
              symbol: visual.symbol,
            })}
          </Typography>
          <TextField
            fullWidth
            placeholder={t('core:address_book_ui.search_placeholder')}
            size="small"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search fontSize="small" sx={{ color: 'text.secondary' }} />
                </InputAdornment>
              ),
            }}
            sx={{
              mb: 1.1,
              '& .MuiInputBase-input': {
                fontSize: 13,
                lineHeight: '18px',
                py: 0.65,
              },
              '& .MuiOutlinedInput-root': {
                bgcolor: (t) =>
                  t.palette.mode === 'dark'
                    ? 'rgba(1, 12, 24, 0.34)'
                    : 'rgba(255,255,255,0.78)',
                minHeight: 32,
                '& fieldset': {
                  borderColor: (t) =>
                    t.palette.mode === 'dark'
                      ? 'rgba(116,158,180,0.18)'
                      : 'rgba(17,24,39,0.08)',
                },
                '&:hover fieldset': { borderColor: 'primary.main' },
              },
            }}
          />
          <Button
            fullWidth
            startIcon={<Add />}
            variant="outlined"
            onClick={onAddContact}
            sx={{
              bgcolor: (t) =>
                t.palette.mode === 'dark'
                  ? 'rgba(13, 48, 72, 0.32)'
                  : 'rgba(255,255,255,0.62)',
              borderColor: (t) =>
                t.palette.mode === 'dark'
                  ? 'rgba(116,158,180,0.16)'
                  : 'rgba(11,143,211,0.22)',
              color: 'text.secondary',
              fontWeight: 600,
              mb: 1.35,
              minHeight: 32,
              py: 0.4,
              '&:hover': {
                bgcolor: (t) =>
                  t.palette.mode === 'dark'
                    ? 'rgba(18, 64, 94, 0.42)'
                    : 'rgba(17,24,39,0.04)',
                borderColor:
                  'color-mix(in srgb, var(--wallet-accent, #18bdf2) 28%, transparent)',
                color: 'text.primary',
              },
            }}
          >
            {t('core:address_book_ui.add_contact')}
          </Button>

          <Box
            sx={{
              display: 'grid',
              gap: 0.45,
              overflow: 'visible',
            }}
          >
            {displayedEntries.length > 0 ? (
              displayedEntries.map((entry, index) => {
                const initials =
                  entry.name
                    .split(' ')
                    .filter(Boolean)
                    .map((part) => part[0])
                    .join('')
                    .slice(0, 2)
                    .toUpperCase() || visual.symbol[0];
                const avatarColor = getAddressBookAvatarColor(
                  `${entry.name}-${entry.address}`,
                  index
                );

                return (
                  <Box
                    key={entry.id}
                    draggable
                    role="button"
                    tabIndex={0}
                    onClick={(event: MouseEvent<HTMLDivElement>) => {
                      if (suppressSelect) return;
                      event.currentTarget.blur();
                      onSelectAddress(entry.address, entry.name);
                    }}
                    onDragStart={(event) => handleDragStart(event, entry)}
                    onDragOver={(event) => handleDragOver(event, entry)}
                    onDrop={(event) => handleDrop(event, entry)}
                    onDragEnd={handleDragEnd}
                    onKeyDown={(event: KeyboardEvent<HTMLDivElement>) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        onSelectAddress(entry.address, entry.name);
                      }
                    }}
                    sx={{
                      alignItems: 'center',
                      bgcolor: (t) =>
                        t.palette.mode === 'dark'
                          ? 'rgba(6, 25, 40, 0.22)'
                          : 'rgba(255,255,255,0.62)',
                      border: (t) =>
                        t.palette.mode === 'dark'
                          ? '1px solid rgba(116,158,180,0.075)'
                          : '1px solid rgba(11,143,211,0.1)',
                      borderRadius: 1,
                      cursor: 'grab',
                      display: 'grid',
                      gap: 0.85,
                      gridTemplateColumns: '38px minmax(0, 1fr) 104px',
                      minHeight: 46,
                      opacity: draggedEntryId === entry.id ? 0.52 : 1,
                      px: 1,
                      py: 0.55,
                      transition:
                        'background-color 150ms ease, border-color 150ms ease, opacity 150ms ease',
                      ...(dragOverEntryId === entry.id && {
                        bgcolor: 'rgba(24,189,242,0.08)',
                        borderColor: 'rgba(24,189,242,0.28)',
                      }),
                      '&:hover': {
                        bgcolor: (t) =>
                          t.palette.mode === 'dark'
                            ? 'rgba(14, 49, 72, 0.3)'
                            : 'rgba(239,248,252,0.95)',
                        borderColor: (t) =>
                          t.palette.mode === 'dark'
                            ? 'rgba(116,158,180,0.13)'
                            : 'rgba(11,143,211,0.18)',
                      },
                      '&:hover .contact-action, &:focus-within .contact-action':
                        {
                          opacity: 1,
                          pointerEvents: 'auto',
                          transform: 'translateX(0)',
                        },
                      '&:hover .contact-action-star, &:focus-within .contact-action-star':
                        {
                          right: 72,
                        },
                      '&:focus-visible': {
                        borderColor:
                          'color-mix(in srgb, var(--wallet-accent, #18bdf2) 44%, transparent)',
                        outline: 'none',
                      },
                    }}
                  >
                    <Avatar
                      sx={{
                        ...getAddressBookAvatarSx(avatarColor),
                        fontSize: 12,
                        fontWeight: 600,
                        height: 32,
                        width: 32,
                      }}
                    >
                      {initials}
                    </Avatar>
                    <Box
                      sx={{
                        alignContent: 'center',
                        display: 'grid',
                        gap: entry.note ? 0.2 : 0,
                        minHeight: 32,
                        minWidth: 0,
                      }}
                    >
                      <NameText
                        name={
                          visual.coinType === Coin.QORT ? entry.name : undefined
                        }
                        fallback={entry.name || '-'}
                        sx={{
                          fontSize: 14,
                          fontWeight: 600,
                          lineHeight: 1.15,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      />
                      {entry.note && (
                        <Typography
                          variant="caption"
                          sx={{
                            color: 'text.secondary',
                            display: 'block',
                            fontSize: 12.5,
                            lineHeight: 1.2,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {entry.note}
                        </Typography>
                      )}
                    </Box>
                    <Box
                      className="contact-actions"
                      sx={{
                        height: 32,
                        justifySelf: 'end',
                        position: 'relative',
                        width: 104,
                      }}
                    >
                      <CustomWidthTooltip
                        placement="top"
                        title={t('core:action.copy_address', {
                          postProcess: 'capitalizeFirstChar',
                        })}
                      >
                        <IconButton
                          className="contact-action contact-action-copy"
                          disableFocusRipple
                          disableRipple
                          size="small"
                          onClick={(event: MouseEvent<HTMLButtonElement>) => {
                            event.stopPropagation();
                            event.currentTarget.blur();
                            copyToClipboard(entry.address);
                          }}
                          sx={{
                            bgcolor: 'transparent',
                            border: '1px solid rgba(116,158,180,0.16)',
                            borderRadius: 1,
                            boxShadow: 'none',
                            color: 'text.secondary',
                            height: 32,
                            opacity: 0,
                            overflow: 'hidden',
                            pointerEvents: 'none',
                            position: 'absolute',
                            right: 36,
                            transform: 'translateX(10px)',
                            transition:
                              'opacity 180ms ease, transform 240ms cubic-bezier(0.16, 1, 0.3, 1), color 150ms ease, border-color 150ms ease, background-color 150ms ease',
                            width: 32,
                            '& .MuiTouchRipple-root': { display: 'none' },
                            '&:hover': {
                              bgcolor: 'rgba(116,158,180,0.08)',
                              borderColor: 'rgba(116,158,180,0.26)',
                              boxShadow: 'none',
                              color: 'text.primary',
                            },
                          }}
                        >
                          <CopyAllTwoTone fontSize="small" />
                        </IconButton>
                      </CustomWidthTooltip>
                      <CustomWidthTooltip
                        placement="top"
                        title={
                          entry.favorite
                            ? t('core:address_book_ui.remove_favorite')
                            : t('core:address_book_ui.favorite')
                        }
                      >
                        <IconButton
                          className="contact-action contact-action-star"
                          disableFocusRipple
                          disableRipple
                          size="small"
                          onClick={(event: MouseEvent<HTMLButtonElement>) =>
                            handleToggleFavorite(event, entry)
                          }
                          sx={{
                            bgcolor: 'transparent',
                            border: entry.favorite
                              ? 0
                              : '1px solid rgba(116,158,180,0.16)',
                            borderRadius: 1,
                            boxShadow: 'none',
                            color: entry.favorite
                              ? '#f6c84c'
                              : 'text.secondary',
                            height: 32,
                            opacity: entry.favorite ? 1 : 0,
                            overflow: 'hidden',
                            pointerEvents: entry.favorite ? 'auto' : 'none',
                            position: 'absolute',
                            right: entry.favorite ? 0 : 72,
                            transform: entry.favorite
                              ? 'translateX(0)'
                              : 'translateX(10px)',
                            transition:
                              'opacity 180ms ease, transform 260ms cubic-bezier(0.16, 1, 0.3, 1), right 260ms cubic-bezier(0.16, 1, 0.3, 1), color 150ms ease, border-color 150ms ease, background-color 150ms ease',
                            width: 32,
                            '& .MuiTouchRipple-root': { display: 'none' },
                            '&:hover': {
                              bgcolor: 'rgba(246,200,76,0.08)',
                              borderColor: 'rgba(246,200,76,0.28)',
                              boxShadow: 'none',
                              color: '#ffd76a',
                            },
                          }}
                        >
                          {entry.favorite ? (
                            <Star sx={{ fontSize: 19 }} />
                          ) : (
                            <StarBorder sx={{ fontSize: 19 }} />
                          )}
                        </IconButton>
                      </CustomWidthTooltip>
                      <CustomWidthTooltip
                        placement="top"
                        title={t('core:address_book_ui.edit_contact')}
                      >
                        <IconButton
                          className="contact-action contact-action-edit"
                          disableFocusRipple
                          disableRipple
                          size="small"
                          onClick={(event: MouseEvent<HTMLButtonElement>) =>
                            handleEditContact(event, entry)
                          }
                          sx={{
                            bgcolor: 'transparent',
                            border: '1px solid rgba(116,158,180,0.16)',
                            borderRadius: 1,
                            boxShadow: 'none',
                            color: 'text.secondary',
                            height: 32,
                            opacity: 0,
                            overflow: 'hidden',
                            pointerEvents: 'none',
                            position: 'absolute',
                            right: 0,
                            transform: 'translateX(10px)',
                            transition:
                              'opacity 180ms ease, transform 240ms cubic-bezier(0.16, 1, 0.3, 1), color 150ms ease, border-color 150ms ease, background-color 150ms ease',
                            width: 32,
                            '& .MuiTouchRipple-root': { display: 'none' },
                            '&:hover': {
                              bgcolor: 'rgba(116,158,180,0.08)',
                              borderColor: 'rgba(116,158,180,0.26)',
                              boxShadow: 'none',
                              color: 'text.primary',
                            },
                          }}
                        >
                          <Edit fontSize="small" />
                        </IconButton>
                      </CustomWidthTooltip>
                    </Box>
                  </Box>
                );
              })
            ) : (
              <Box
                sx={{
                  alignItems: 'center',
                  background:
                    'linear-gradient(180deg, rgba(6, 30, 48, 0.2) 0%, rgba(4, 18, 31, 0.2) 100%)',
                  border: '1px solid rgba(116,158,180,0.075)',
                  borderRadius: 1,
                  color: 'text.secondary',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                  minHeight: { xs: 270, md: 300 },
                  px: { xs: 2.4, md: 2.7 },
                  py: { xs: 3.8, md: 4.35 },
                  textAlign: 'center',
                }}
              >
                <Box
                  sx={{
                    alignItems: 'center',
                    display: 'flex',
                    justifyContent: 'center',
                    mb: 2.1,
                    position: 'relative',
                  }}
                >
                  <Box
                    sx={{
                      alignItems: 'center',
                      bgcolor: 'rgba(116,158,180,0.09)',
                      border: '1px solid rgba(116,158,180,0.18)',
                      borderRadius: 1.4,
                      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.035)',
                      color: 'rgba(148,177,204,0.74)',
                      display: 'grid',
                      height: 62,
                      justifyItems: 'center',
                      width: 62,
                    }}
                  >
                    <Box
                      component="img"
                      src={visual.coinIcon}
                      alt=""
                      sx={{
                        filter:
                          'drop-shadow(0 0 12px color-mix(in srgb, var(--wallet-accent, #18bdf2) 36%, transparent))',
                        height: 36,
                        opacity: 0.92,
                        width: 36,
                      }}
                    />
                  </Box>
                </Box>
                <Typography
                  sx={{
                    color: 'text.primary',
                    fontSize: { xs: 16, md: 17 },
                    fontWeight: 700,
                    lineHeight: 1.2,
                  }}
                >
                  {search.trim()
                    ? 'No matching contacts found'
                    : `No ${visual.symbol} contacts yet`}
                </Typography>
                <Typography
                  variant="body2"
                  sx={{
                    color: 'text.secondary',
                    fontSize: { xs: 13, md: 13.5 },
                    lineHeight: 1.45,
                    maxWidth: 310,
                    mt: 1.15,
                    opacity: 0.86,
                  }}
                >
                  {search.trim()
                    ? 'Try a different name, address or note.'
                    : `Add contacts to your address book to send ${visual.symbol} faster and avoid mistakes.`}
                </Typography>
                {!search.trim() && (
                  <Button
                    startIcon={<Add />}
                    variant="contained"
                    onClick={onAddContact}
                    sx={{
                      bgcolor: 'rgba(6,126,208,0.94)',
                      backgroundImage:
                        'linear-gradient(180deg, rgba(18,158,238,0.96), rgba(4,111,198,0.96))',
                      border: '1px solid rgba(85,205,255,0.4)',
                      borderRadius: 1.35,
                      boxShadow:
                        '0 14px 32px rgba(3,139,236,0.2), inset 0 1px 0 rgba(255,255,255,0.16)',
                      color: 'rgba(255,255,255,0.96)',
                      fontSize: { xs: 13.5, md: 14 },
                      fontWeight: 700,
                      mt: 2.7,
                      minHeight: 44,
                      px: 2.25,
                      whiteSpace: 'nowrap',
                      '& .MuiButton-startIcon': {
                        mr: 0.8,
                        '& svg': { fontSize: 20 },
                      },
                      '&:hover': {
                        bgcolor: '#1399e8',
                        borderColor: 'rgba(107,216,255,0.55)',
                        boxShadow:
                          '0 16px 36px rgba(24,189,242,0.25), inset 0 1px 0 rgba(255,255,255,0.18)',
                      },
                    }}
                  >
                    Add your first contact
                  </Button>
                )}
              </Box>
            )}
          </Box>
          {hasMoreContacts && (
            <Button
              variant="text"
              onClick={onAddContact}
              sx={{
                color: 'primary.main',
                fontSize: 12,
                fontWeight: 400,
                justifyContent: 'flex-start',
                lineHeight: 1,
                minHeight: 16,
                mt: 0.25,
                px: 0,
                py: 0,
                textTransform: 'none',
                '&:hover': {
                  bgcolor: 'transparent',
                  color: '#37d0ff',
                },
              }}
            >
              View all contacts
            </Button>
          )}
        </Box>
      </WalletCard>
      <AddressFormDialog
        coinType={visual.coinType}
        disableRestoreFocus
        entry={editingEntry}
        onClose={handleEditFormClose}
        onDelete={handleDeleteClick}
        onExited={handleEditFormExited}
        onSave={handleEditSave}
        open={editFormOpen}
        saveError={editSaveError}
      />
      <DeleteConfirmationDialog
        entryName={deletingEntry?.name || ''}
        onClose={handleDeleteCancel}
        onConfirm={handleDeleteConfirm}
        open={deleteConfirmOpen}
      />
    </>
  );
}

type WalletTransactionsCardProps = {
  actions?: ReactNode;
  children: ReactNode;
  isRefreshing?: boolean;
  onRefresh?: () => void;
  title?: string;
};

type WalletTransactionsLoaderProps = {
  label?: string;
};

export function WalletTransactionsLoader({
  label,
}: WalletTransactionsLoaderProps) {
  const { t } = useTranslation(['core']);
  const displayLabel = label ?? t('core:wallet.loading_transactions');

  return (
    <Box
      role="status"
      aria-live="polite"
      sx={{
        '@keyframes walletLoaderPulse': {
          '0%, 100%': { opacity: 0.34, transform: 'scaleX(0.96)' },
          '50%': { opacity: 0.9, transform: 'scaleX(1)' },
        },
        '@keyframes walletLoaderSweep': {
          '0%': { transform: 'translateX(-110%)' },
          '100%': { transform: 'translateX(110%)' },
        },
        display: 'grid',
        gap: 1.5,
        justifyItems: 'center',
        px: { xs: 1, sm: 2 },
        py: { xs: 3, md: 3.5 },
      }}
    >
      <Box
        sx={{
          display: 'grid',
          gap: 0.75,
          maxWidth: 560,
          width: 'min(100%, 560px)',
        }}
      >
        {[0, 1, 2].map((index) => (
          <Box
            key={index}
            sx={{
              animation: `walletLoaderPulse 1450ms ease-in-out ${index * 110}ms infinite`,
              bgcolor: 'rgba(116,158,180,0.12)',
              border: '1px solid rgba(116,158,180,0.08)',
              borderRadius: 1,
              height: 12,
              overflow: 'hidden',
              position: 'relative',
              transformOrigin: 'center',
              width: index === 1 ? '84%' : index === 2 ? '68%' : '100%',
              '&::after': {
                animation: 'walletLoaderSweep 1550ms ease-in-out infinite',
                background:
                  'linear-gradient(90deg, transparent, rgba(24,189,242,0.22), transparent)',
                content: '""',
                inset: 0,
                position: 'absolute',
              },
            }}
          />
        ))}
      </Box>
      <Typography
        sx={{
          color: 'text.secondary',
          fontSize: 13,
          fontWeight: 600,
          letterSpacing: 0,
        }}
      >
        {displayLabel}
      </Typography>
    </Box>
  );
}

type WalletExternalTransactionEntry = {
  address?: string;
  addressInWallet?: boolean;
  amount?: number;
};

export type WalletExternalTransactionRow = {
  feeAmount?: unknown;
  inputs?: WalletExternalTransactionEntry[];
  memo?: string;
  outputs?: WalletExternalTransactionEntry[];
  timestamp?: number;
  totalAmount?: unknown;
  txHash?: string;
};

type WalletExternalTransactionsListLabels = {
  copyHash: (hash: string) => string;
  fee: string;
  memo?: string;
  noTransactions: string;
  receiver: string;
  rowsPerPage: string;
  sender: string;
  time: string;
  totalAmount: string;
  transactionHash: string;
  waitingConfirmation: string;
};

type WalletExternalTransactionsListProps = {
  ActionsComponent: any;
  coin: WalletCoinSymbol;
  copyHashLabel?: string;
  labels: WalletExternalTransactionsListLabels;
  onCopyHash: (hash: string) => void;
  onPageChange: (
    event: MouseEvent<HTMLButtonElement> | null,
    newPage: number
  ) => void;
  onRowsPerPageChange: (
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => void;
  page: number;
  rows: WalletExternalTransactionRow[];
  rowsPerPage: number;
  showMemo?: boolean;
};

const externalTransactionHeaderSx = {
  color: 'text.secondary',
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: 0,
  minWidth: 0,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  textTransform: 'uppercase',
  whiteSpace: 'nowrap',
};

const walletTableRowHoverSx = {
  overflow: 'hidden',
  position: 'relative',
  '&::before': {
    background:
      'linear-gradient(90deg, rgba(24,189,242,0.07), rgba(24,189,242,0.025))',
    content: '""',
    inset: 0,
    opacity: 0,
    pointerEvents: 'none',
    position: 'absolute',
    transition: 'opacity 520ms ease-out',
    zIndex: 0,
  },
  '&:hover::before': {
    opacity: 1,
    transitionDuration: '90ms',
  },
  '& > *': {
    position: 'relative',
    zIndex: 1,
  },
} as const;

const formatExternalTransactionAmount = (value: unknown) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return '-';
  return (numeric / 1e8).toFixed(8);
};

export function WalletExternalTransactionsList({
  ActionsComponent,
  coin,
  copyHashLabel,
  labels,
  onCopyHash,
  onPageChange,
  onRowsPerPageChange,
  page,
  rows,
  rowsPerPage,
  showMemo,
}: WalletExternalTransactionsListProps) {
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null);
  const gridColumns = showMemo
    ? 'minmax(120px, 1fr) minmax(120px, 1fr) minmax(120px, 0.9fr) minmax(88px, 0.7fr) minmax(118px, 0.8fr) minmax(78px, 0.55fr) minmax(92px, 0.65fr)'
    : 'minmax(130px, 1fr) minmax(130px, 1fr) minmax(128px, 0.9fr) minmax(118px, 0.78fr) minmax(78px, 0.55fr) minmax(92px, 0.65fr)';
  const minWidth = showMemo ? 880 : 760;
  const pagedRows =
    rowsPerPage > 0
      ? rows.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
      : rows;

  const handleCopyAddress = (address: string) => {
    copyToClipboard(address);
    setCopiedAddress(address);
    window.setTimeout(() => {
      setCopiedAddress((currentAddress) =>
        currentAddress === address ? null : currentAddress
      );
    }, 1200);
  };

  const renderEndpoint = (entries?: WalletExternalTransactionEntry[]) => {
    const addressEntries = entries?.filter((entry) => entry.address) ?? [];

    if (!addressEntries.length) {
      return (
        <Typography sx={{ color: 'text.secondary', fontSize: 13 }}>
          -
        </Typography>
      );
    }

    return (
      <Box
        sx={{
          display: 'grid',
          gap: 0.45,
          minWidth: 0,
        }}
      >
        {addressEntries.map((entry, index) => (
          <Box
            key={`${entry.address}-${index}`}
            sx={{
              alignItems: 'start',
              display: 'grid',
              gap: 0.45,
              gridTemplateColumns: 'minmax(0, 1fr) auto',
              minWidth: 0,
            }}
          >
            <Typography
              component="span"
              title={entry.address}
              sx={{
                color: entry.addressInWallet ? 'text.primary' : 'info.main',
                display: 'block',
                fontSize: 13,
                fontWeight: entry.addressInWallet ? 500 : 600,
                lineHeight: 1.25,
                minWidth: 0,
                overflowWrap: 'anywhere',
                wordBreak: 'break-word',
              }}
            >
              {entry.address}
            </Typography>
            <CustomWidthTooltip
              placement="top"
              title={
                copiedAddress === entry.address ? 'Copied' : 'Copy address'
              }
            >
              <IconButton
                aria-label="copy address"
                onClick={() => handleCopyAddress(entry.address ?? '')}
                size="small"
                sx={{
                  color: 'text.secondary',
                  mt: -0.45,
                  p: 0.25,
                }}
              >
                <CopyAllTwoTone sx={{ fontSize: 15 }} />
              </IconButton>
            </CustomWidthTooltip>
          </Box>
        ))}
      </Box>
    );
  };

  const renderAmount = (row: WalletExternalTransactionRow) => {
    const numeric = Number(row.totalAmount);
    if (!Number.isFinite(numeric)) return '-';
    const isIncoming = numeric > 0;

    return (
      <Typography
        sx={{
          color: isIncoming ? 'success.main' : 'error.main',
          fontSize: 13,
          fontWeight: 700,
          textAlign: 'right',
          whiteSpace: 'nowrap',
        }}
      >
        {isIncoming ? '+' : ''}
        {formatExternalTransactionAmount(row.totalAmount)} {coin}
      </Typography>
    );
  };

  const renderFee = (row: WalletExternalTransactionRow) => {
    const numericFee = Number(row.feeAmount);
    if (!Number.isFinite(numericFee) || numericFee === 0) return '-';

    return (
      <Typography
        sx={{
          color: Number(row.totalAmount) <= 0 ? 'error.main' : 'text.secondary',
          fontSize: 13,
          fontWeight: 500,
          textAlign: 'right',
          whiteSpace: 'nowrap',
        }}
      >
        -{formatExternalTransactionAmount(row.feeAmount)}
      </Typography>
    );
  };

  const renderHash = (hash: string) => (
    <Box
      sx={{
        alignItems: 'center',
        display: 'flex',
        gap: 0.35,
        minWidth: 0,
      }}
    >
      <Typography
        component="span"
        title={hash}
        sx={{
          color: 'text.primary',
          display: 'block',
          fontSize: 13,
          fontWeight: 600,
          minWidth: 0,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {hash ? cropString(hash) : '-'}
      </Typography>
      {hash && (
        <CustomWidthTooltip
          placement="top"
          title={copyHashLabel || labels.copyHash(hash)}
        >
          <IconButton
            aria-label="copy"
            size="small"
            onClick={() => onCopyHash(hash)}
            sx={{ color: 'text.secondary', p: 0.25 }}
          >
            <CopyAllTwoTone sx={{ fontSize: 16 }} />
          </IconButton>
        </CustomWidthTooltip>
      )}
    </Box>
  );

  const renderMobileField = (label: string, content: ReactNode) => (
    <Box sx={{ display: 'grid', gap: 0.45, minWidth: 0 }}>
      <Typography
        sx={{
          color: 'text.secondary',
          fontSize: 10.5,
          fontWeight: 700,
          letterSpacing: 0,
          lineHeight: 1,
          textTransform: 'uppercase',
        }}
      >
        {label}
      </Typography>
      <Box sx={{ minWidth: 0 }}>{content}</Box>
    </Box>
  );

  if (!rows.length) {
    return (
      <Box
        sx={{
          bgcolor: 'transparent',
          borderBottom: (t) => `1px solid ${t.palette.divider}`,
          borderTop: (t) => `1px solid ${t.palette.divider}`,
          color: 'text.secondary',
          px: 2,
          py: 4,
          textAlign: 'center',
        }}
      >
        <Typography sx={{ fontWeight: 600 }}>
          {labels.noTransactions}
        </Typography>
      </Box>
    );
  }

  return (
    <>
      <Box
        sx={{
          display: { xs: 'grid', sm: 'none' },
          gap: 0.85,
          minWidth: 0,
          p: 1,
        }}
      >
        {pagedRows.map((row, index) => {
          const hash = row.txHash ?? '';

          return (
            <Box
              key={hash || index}
              sx={{
                bgcolor: 'rgba(4, 22, 38, 0.22)',
                border: (t) =>
                  `1px solid ${
                    t.palette.mode === 'dark'
                      ? 'rgba(116,158,180,0.11)'
                      : 'rgba(17,24,39,0.08)'
                  }`,
                borderRadius: 1,
                display: 'grid',
                gap: 1.1,
                minWidth: 0,
                p: 1.15,
              }}
            >
              <Box
                sx={{
                  alignItems: 'start',
                  display: 'grid',
                  gap: 1,
                  gridTemplateColumns: 'minmax(0, 1fr) auto',
                  minWidth: 0,
                }}
              >
                {renderMobileField(labels.transactionHash, renderHash(hash))}
                <Box sx={{ textAlign: 'right' }}>{renderAmount(row)}</Box>
              </Box>

              <Box
                sx={{
                  display: 'grid',
                  gap: 1,
                  gridTemplateColumns: 'minmax(0, 1fr)',
                  minWidth: 0,
                }}
              >
                {renderMobileField(labels.sender, renderEndpoint(row.inputs))}
                {renderMobileField(
                  labels.receiver,
                  renderEndpoint(row.outputs)
                )}
              </Box>

              {showMemo && (
                <Box sx={{ minWidth: 0 }}>
                  {renderMobileField(
                    labels.memo ?? 'Memo',
                    <Typography
                      title={row.memo}
                      sx={{
                        color: row.memo ? 'text.primary' : 'text.secondary',
                        fontSize: 13,
                        minWidth: 0,
                        overflowWrap: 'anywhere',
                        wordBreak: 'break-word',
                      }}
                    >
                      {row.memo || '-'}
                    </Typography>
                  )}
                </Box>
              )}

              <Box
                sx={{
                  alignItems: 'end',
                  display: 'grid',
                  gap: 1,
                  gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
                  minWidth: 0,
                }}
              >
                {renderMobileField(labels.fee, renderFee(row))}
                {renderMobileField(
                  labels.time,
                  <CustomWidthTooltip
                    placement="top"
                    title={
                      row.timestamp
                        ? new Date(row.timestamp).toLocaleString()
                        : labels.waitingConfirmation
                    }
                  >
                    <Typography
                      sx={{
                        color: 'text.secondary',
                        fontSize: 13,
                        fontWeight: 500,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {row.timestamp ? epochToAgo(row.timestamp) : '-'}
                    </Typography>
                  </CustomWidthTooltip>
                )}
              </Box>
            </Box>
          );
        })}
      </Box>

      <Box
        sx={{
          display: { xs: 'none', sm: 'block' },
          maxWidth: '100%',
          overflowX: 'auto',
          overflowY: 'hidden',
          overscrollBehaviorX: 'contain',
          pb: 0.75,
          touchAction: 'pan-x pan-y',
          WebkitOverflowScrolling: 'touch',
          '&::-webkit-scrollbar': {
            height: 8,
          },
          '&::-webkit-scrollbar-thumb': {
            bgcolor: 'rgba(116,158,180,0.28)',
            borderRadius: 999,
          },
          '&::-webkit-scrollbar-track': {
            bgcolor: 'rgba(116,158,180,0.08)',
          },
        }}
      >
        <Box sx={{ minWidth }}>
          <Box
            aria-hidden
            sx={{
              alignItems: 'center',
              borderBottom: (t) => `1px solid ${t.palette.divider}`,
              display: 'grid',
              gap: 1,
              gridTemplateColumns: gridColumns,
              px: 1.25,
              py: 1,
            }}
          >
            <Typography sx={externalTransactionHeaderSx}>
              {labels.sender}
            </Typography>
            <Typography sx={externalTransactionHeaderSx}>
              {labels.receiver}
            </Typography>
            <Typography sx={externalTransactionHeaderSx}>
              {labels.transactionHash}
            </Typography>
            {showMemo && (
              <Typography sx={externalTransactionHeaderSx}>
                {labels.memo}
              </Typography>
            )}
            <Typography
              sx={{ ...externalTransactionHeaderSx, textAlign: 'right' }}
            >
              {labels.totalAmount}
            </Typography>
            <Typography
              sx={{ ...externalTransactionHeaderSx, textAlign: 'right' }}
            >
              {labels.fee}
            </Typography>
            <Typography sx={externalTransactionHeaderSx}>
              {labels.time}
            </Typography>
          </Box>

          <Box sx={{ display: 'grid' }}>
            {pagedRows.map((row, index) => {
              const hash = row.txHash ?? '';

              return (
                <Box
                  key={hash || index}
                  sx={{
                    ...walletTableRowHoverSx,
                    alignItems: 'center',
                    bgcolor: 'transparent',
                    borderBottom: (t) =>
                      `1px solid ${
                        t.palette.mode === 'dark'
                          ? 'rgba(116,158,180,0.085)'
                          : 'rgba(17,24,39,0.06)'
                      }`,
                    display: 'grid',
                    gap: 1,
                    gridTemplateColumns: gridColumns,
                    minHeight: 46,
                    px: 1.25,
                    py: 0.85,
                    transition:
                      'background-color 150ms ease, border-color 150ms ease',
                  }}
                >
                  {renderEndpoint(row.inputs)}
                  {renderEndpoint(row.outputs)}
                  {renderHash(hash)}
                  {showMemo && (
                    <Typography
                      title={row.memo}
                      sx={{
                        color: row.memo ? 'text.primary' : 'text.secondary',
                        fontSize: 13,
                        minWidth: 0,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {row.memo || '-'}
                    </Typography>
                  )}
                  {renderAmount(row)}
                  {renderFee(row)}
                  <CustomWidthTooltip
                    placement="top"
                    title={
                      row.timestamp
                        ? new Date(row.timestamp).toLocaleString()
                        : labels.waitingConfirmation
                    }
                  >
                    <Typography
                      sx={{
                        color: 'text.secondary',
                        fontSize: 13,
                        fontWeight: 500,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {row.timestamp ? epochToAgo(row.timestamp) : '-'}
                    </Typography>
                  </CustomWidthTooltip>
                </Box>
              );
            })}
          </Box>
        </Box>
      </Box>
      <TablePagination
        component="div"
        labelRowsPerPage={labels.rowsPerPage}
        rowsPerPageOptions={[5, 10, 25]}
        count={rows.length}
        rowsPerPage={rowsPerPage}
        page={page}
        slotProps={{
          select: {
            inputProps: {
              'aria-label': labels.rowsPerPage,
            },
            MenuProps: {
              disableScrollLock: true,
            },
            native: true,
          },
        }}
        onPageChange={onPageChange}
        onRowsPerPageChange={onRowsPerPageChange}
        ActionsComponent={ActionsComponent}
        sx={{
          color: 'text.secondary',
          mt: 0.5,
          '& .MuiTablePagination-toolbar': {
            flexWrap: { xs: 'wrap', sm: 'nowrap' },
            minHeight: 44,
            px: { xs: 1, sm: 0 },
            rowGap: 0.5,
          },
          '& .MuiTablePagination-spacer': {
            display: { xs: 'none', sm: 'block' },
          },
          '& .MuiTablePagination-selectLabel': {
            display: { xs: 'none', sm: 'block' },
          },
          '& .MuiTablePagination-input': {
            display: { xs: 'none', sm: 'inline-flex' },
          },
          '& .MuiTablePagination-selectLabel, & .MuiTablePagination-displayedRows':
            {
              color: 'text.secondary',
              fontSize: 13,
            },
        }}
      />
    </>
  );
}

export function WalletTransactionsCard({
  actions,
  children,
  isRefreshing,
  onRefresh,
  title,
}: WalletTransactionsCardProps) {
  const { t } = useTranslation(['core']);
  const displayTitle = title ?? t('core:wallet.transactions');

  return (
    <WalletCard
      sx={{
        background: (t) =>
          t.palette.mode === 'dark'
            ? 'linear-gradient(180deg, rgba(10, 36, 56, 0.74) 0%, rgba(7, 29, 47, 0.68) 100%)'
            : 'linear-gradient(180deg, rgba(255,255,255,0.94) 0%, rgba(247,251,253,0.92) 100%)',
        borderColor: (t) =>
          t.palette.mode === 'dark'
            ? 'rgba(116,158,180,0.15)'
            : 'rgba(11,143,211,0.13)',
        boxShadow: (t) =>
          t.palette.mode === 'dark'
            ? 'inset 0 1px 0 rgba(255,255,255,0.045)'
            : '0 18px 54px rgba(15, 74, 106, 0.08), inset 0 1px 0 rgba(255,255,255,0.84)',
        minWidth: 0,
        overflow: 'hidden',
        width: '100%',
        '& .MuiTableContainer-root': {
          bgcolor: 'transparent',
          border: 0,
          borderRadius: 0,
          boxShadow: 'none',
          overflowX: 'hidden',
        },
        '& .MuiTable-root': {
          tableLayout: 'fixed',
          width: '100%',
        },
        '& .MuiTableCell-root': {
          minWidth: 0,
        },
        '& .MuiTableCell-root:nth-of-type(1), & .MuiTableCell-root:nth-of-type(2)':
          {
            width: '18%',
          },
        '& .MuiTableCell-root:nth-of-type(3)': {
          width: '16%',
        },
        '& .MuiTableCell-root:nth-of-type(4)': {
          width: '12%',
        },
        '& .MuiTableCell-root:nth-of-type(5)': {
          width: '10%',
        },
        '& .MuiTableCell-root:nth-of-type(6)': {
          width: '10%',
        },
        '& .MuiTableCell-root:nth-of-type(7)': {
          width: '10%',
        },
        '& .MuiTableCell-head': {
          bgcolor: 'transparent',
          color: 'text.secondary',
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: 0,
          overflow: 'hidden',
          px: 1.5,
          py: 1.2,
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        },
        '& .MuiTableCell-body': {
          bgcolor: 'transparent',
          fontSize: 13,
          height: 46,
          lineHeight: 1.25,
          overflow: 'hidden',
          px: 1.5,
          py: 0.85,
          textOverflow: 'ellipsis',
          verticalAlign: 'middle',
          whiteSpace: 'nowrap',
        },
        '& .MuiTableBody-root .MuiTableRow-root': {
          transition: 'background-color 150ms ease',
        },
        '& .MuiTableBody-root .MuiTableRow-root:hover': {
          bgcolor: (t) =>
            t.palette.mode === 'dark'
              ? 'rgba(24,189,242,0.055)'
              : 'rgba(5,127,168,0.05)',
        },
        '& .MuiTableBody-root .MuiTableCell-root:nth-of-type(1) > .MuiBox-root, & .MuiTableBody-root .MuiTableCell-root:nth-of-type(2) > .MuiBox-root':
          {
            display: 'grid !important',
            gridTemplateColumns: 'minmax(0, 1fr)',
            minWidth: 0,
          },
        '& .MuiTableBody-root .MuiTableCell-root:nth-of-type(1) > .MuiBox-root:not(:first-of-type), & .MuiTableBody-root .MuiTableCell-root:nth-of-type(2) > .MuiBox-root:not(:first-of-type)':
          {
            display: 'none !important',
          },
        '& .MuiTableBody-root .MuiTableCell-root:nth-of-type(1) span, & .MuiTableBody-root .MuiTableCell-root:nth-of-type(2) span':
          {
            minWidth: 0,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          },
        '& .MuiTableBody-root .MuiTableCell-root:nth-of-type(1) span + span, & .MuiTableBody-root .MuiTableCell-root:nth-of-type(2) span + span':
          {
            display: 'none',
          },
        '& .MuiTableBody-root .MuiTableCell-root:nth-of-type(3) .MuiIconButton-root':
          {
            ml: 0.25,
            p: 0.25,
          },
        '& .MuiTableFooter-root .MuiTableCell-root': {
          borderBottom: 0,
          px: 0,
        },
        '& .MuiTablePagination-root': {
          color: 'text.secondary',
        },
        '& .MuiTablePagination-toolbar': {
          minHeight: 44,
          px: 0,
        },
        '& .MuiTablePagination-selectLabel, & .MuiTablePagination-displayedRows':
          {
            color: 'text.secondary',
            fontSize: 13,
          },
      }}
    >
      <Box
        sx={{
          minWidth: 0,
          px: { xs: 1.5, md: 2.25, lg: 2.75 },
          pt: { xs: 1.5, md: 2.05 },
          pb: 1.15,
        }}
      >
        <Box
          sx={{
            alignItems: { xs: 'flex-start', sm: 'center' },
            display: 'flex',
            flexDirection: { xs: 'column', sm: 'row' },
            gap: 0.75,
            justifyContent: 'space-between',
            mb: 1,
          }}
        >
          <Typography
            variant="subtitle1"
            sx={{ fontWeight: 600, lineHeight: 1.1 }}
          >
            {displayTitle}
          </Typography>
          {(actions || onRefresh) && (
            <Box
              sx={{
                alignItems: 'center',
                display: 'flex',
                gap: 0.75,
                justifyContent: { xs: 'space-between', sm: 'flex-end' },
                minWidth: 0,
                width: { xs: '100%', sm: 'auto' },
              }}
            >
              {actions}
              {onRefresh && (
                <Button
                  onClick={onRefresh}
                  loading={isRefreshing}
                  loadingPosition="start"
                  size="small"
                  startIcon={<Refresh sx={{ fontSize: 18 }} />}
                  variant="text"
                  sx={{
                    borderRadius: 1,
                    fontSize: 13,
                    fontWeight: 700,
                    minHeight: 34,
                    px: 1,
                    whiteSpace: 'nowrap',
                    '& .MuiButton-startIcon': {
                      mr: 0.65,
                    },
                  }}
                >
                  {t('core:action.refresh', {
                    postProcess: 'capitalizeFirstChar',
                  })}
                </Button>
              )}
            </Box>
          )}
        </Box>
      </Box>
      <Box
        sx={{
          background: (t) =>
            t.palette.mode === 'dark'
              ? 'linear-gradient(180deg, rgba(18, 62, 89, 0.36) 0%, rgba(12, 47, 72, 0.32) 100%)'
              : 'linear-gradient(180deg, rgba(242,248,251,0.72) 0%, rgba(255,255,255,0.5) 100%)',
          borderTop: (t) =>
            t.palette.mode === 'dark'
              ? '1px solid rgba(116,158,180,0.11)'
              : '1px solid rgba(11,143,211,0.1)',
          boxShadow: (t) =>
            t.palette.mode === 'dark'
              ? 'inset 0 1px 0 rgba(255,255,255,0.028)'
              : 'inset 0 1px 0 rgba(255,255,255,0.72)',
          minWidth: 0,
          overflow: 'hidden',
        }}
      >
        {children}
      </Box>
    </WalletCard>
  );
}

type WalletSyncCardProps = {
  isSyncing?: boolean;
  onSync: () => void;
  statusLabel: string;
  statusTone?: 'success' | 'error';
  statusTooltip?: string;
};

export function WalletSyncCard({
  isSyncing,
  onSync,
  statusLabel,
  statusTone = 'success',
  statusTooltip,
}: WalletSyncCardProps) {
  const { t } = useTranslation(['core']);
  const isError = statusTone === 'error';
  const syncDescription = t('core:wallet.sync_description');

  return (
    <WalletCard
      sx={{
        background: (t) =>
          t.palette.mode === 'dark'
            ? 'linear-gradient(180deg, rgba(10, 34, 52, 0.82) 0%, rgba(7, 27, 43, 0.76) 100%)'
            : 'linear-gradient(180deg, rgba(255,255,255,0.92) 0%, rgba(247,251,253,0.9) 100%)',
        borderColor: (t) =>
          t.palette.mode === 'dark'
            ? 'rgba(116,158,180,0.14)'
            : 'rgba(11,143,211,0.14)',
        boxShadow: (t) =>
          t.palette.mode === 'dark'
            ? 'inset 0 1px 0 rgba(255,255,255,0.04)'
            : '0 18px 48px rgba(15, 74, 106, 0.08), inset 0 1px 0 rgba(255,255,255,0.82)',
        overflow: 'hidden',
        width: '100%',
      }}
    >
      <Box sx={{ display: 'grid', gap: 1.35, px: { xs: 2, md: 2.25 }, py: 2 }}>
        <Box
          sx={{
            alignItems: 'flex-start',
            display: 'flex',
            gap: 1,
            justifyContent: 'space-between',
          }}
        >
          <Box
            sx={{
              alignItems: 'center',
              display: 'flex',
              gap: 0.9,
              minWidth: 0,
            }}
          >
            <Box
              sx={{
                alignItems: 'center',
                bgcolor: isError
                  ? 'rgba(246, 167, 11, 0.08)'
                  : (t) =>
                      t.palette.mode === 'dark'
                        ? 'rgba(1, 12, 24, 0.34)'
                        : 'rgba(239,248,252,0.88)',
                border: '1px solid rgba(116,158,180,0.16)',
                borderRadius: 1,
                color: isError
                  ? 'rgba(246, 196, 78, 0.92)'
                  : 'rgba(34,227,138,0.72)',
                display: 'inline-flex',
                flexShrink: 0,
                height: 32,
                justifyContent: 'center',
                width: 32,
              }}
            >
              <LockOutlined fontSize="small" />
            </Box>
            <Box sx={{ minWidth: 0 }}>
              <Box sx={{ alignItems: 'center', display: 'flex', gap: 0.4 }}>
                <Typography
                  sx={{
                    color: 'text.secondary',
                    fontWeight: 600,
                    lineHeight: 1.15,
                  }}
                >
                  {t('core:wallet.encrypted_sync')}
                </Typography>
                <CustomWidthTooltip placement="top" title={syncDescription}>
                  <InfoOutlined
                    sx={{
                      color: 'text.secondary',
                      cursor: 'help',
                      fontSize: 15,
                      opacity: 0.62,
                    }}
                  />
                </CustomWidthTooltip>
              </Box>
              <Typography
                variant="caption"
                sx={{
                  color: 'text.secondary',
                  display: 'block',
                  mt: 0.45,
                  opacity: 0.78,
                }}
              >
                {t('core:wallet.local_address_book')}
              </Typography>
            </Box>
          </Box>
          <Box
            title={statusTooltip}
            sx={{
              alignItems: 'center',
              bgcolor: isError
                ? 'rgba(246, 167, 11, 0.08)'
                : 'rgba(34,227,138,0.055)',
              border: isError
                ? '1px solid rgba(246, 196, 78, 0.18)'
                : '1px solid rgba(34,227,138,0.14)',
              borderRadius: 999,
              color: isError
                ? 'rgba(246, 196, 78, 0.94)'
                : 'rgba(144, 214, 176, 0.88)',
              display: 'inline-flex',
              fontSize: 12,
              fontWeight: 600,
              flexShrink: 0,
              gap: 0.5,
              px: 1,
              py: 0.45,
            }}
          >
            {isError ? (
              <ErrorOutline sx={{ fontSize: 15 }} />
            ) : (
              <CheckCircleOutline sx={{ fontSize: 15 }} />
            )}
            {statusLabel}
          </Box>
        </Box>

        <Button
          fullWidth
          loading={isSyncing}
          loadingPosition="start"
          onClick={onSync}
          startIcon={<Sync />}
          variant="outlined"
          sx={{
            bgcolor: (t) =>
              t.palette.mode === 'dark'
                ? 'rgba(13, 48, 72, 0.32)'
                : 'rgba(255,255,255,0.62)',
            borderColor: (t) =>
              t.palette.mode === 'dark'
                ? 'rgba(116,158,180,0.16)'
                : 'rgba(11,143,211,0.22)',
            color: 'text.secondary',
            fontWeight: 600,
            minHeight: 42,
            '&:hover': {
              bgcolor: (t) =>
                t.palette.mode === 'dark'
                  ? 'rgba(18, 64, 94, 0.42)'
                  : 'rgba(239,248,252,0.95)',
              borderColor: (t) =>
                t.palette.mode === 'dark'
                  ? 'rgba(116,158,180,0.28)'
                  : 'rgba(11,143,211,0.32)',
              color: 'text.primary',
            },
          }}
        >
          {t('core:wallet.sync_now')}
        </Button>
      </Box>
    </WalletCard>
  );
}

type WalletWorkspaceProps = {
  address?: string | null;
  addressBookRefreshKey?: unknown;
  balance?: unknown;
  balanceDecimals?: number;
  balanceError?: string | null;
  children?: ReactNode;
  formattedBalance?: string;
  isBalanceLoading?: boolean;
  noAddressLabel?: string;
  onAddressBookChange?: () => void;
  onSend: () => void;
  onToggleReceive: () => void;
  receiveOpen: boolean;
  rightColumnAfter?: ReactNode;
  transactions: ReactNode;
  coin: AddressBookCoinSymbol;
  onAddContact: () => void;
  onSelectAddress: (address: string, name: string) => void;
};

export function WalletWorkspace({
  address,
  addressBookRefreshKey,
  balance,
  balanceDecimals,
  balanceError,
  children,
  coin,
  formattedBalance,
  isBalanceLoading,
  noAddressLabel,
  onAddContact,
  onAddressBookChange,
  onSelectAddress,
  onSend,
  onToggleReceive,
  receiveOpen,
  rightColumnAfter,
  transactions,
}: WalletWorkspaceProps) {
  const visual = WALLET_VISUALS[coin];
  const [receiveQrDialogOpen, setReceiveQrDialogOpen] = useState(false);

  // The wallet summary keeps its natural width; the Address book / Sync panels
  // are only shown when they actually fit beside it. When the content would
  // overlap them, they disappear and the main column takes the full width.
  const workspaceRef = useRef<HTMLDivElement | null>(null);
  const mainColumnRef = useRef<HTMLDivElement | null>(null);
  const requiredWidthRef = useRef(0);
  const showSidePanelsRef = useRef(true);
  const [showSidePanels, setShowSidePanels] = useState(true);

  useLayoutEffect(() => {
    const workspace = workspaceRef.current;
    const mainColumn = mainColumnRef.current;
    if (!workspace || !mainColumn) return;

    const RIGHT_COLUMN_WIDTH = 424;
    const COLUMN_GAP = 24;

    const measure = () => {
      const available = workspace.clientWidth;
      // While the panels are shown the main column is constrained to its track.
      // If its content (the wallet summary) is wider than that track it overflows,
      // and scrollWidth then reveals how much total width the layout would need to
      // also fit the side panels. (Only sampled while shown — when hidden the main
      // column spans the full width and would no longer overflow.)
      if (
        showSidePanelsRef.current &&
        mainColumn.scrollWidth > mainColumn.clientWidth + 1
      ) {
        requiredWidthRef.current =
          mainColumn.scrollWidth + RIGHT_COLUMN_WIDTH + COLUMN_GAP;
      }
      const required = requiredWidthRef.current;
      const next = required === 0 ? true : available >= required;
      showSidePanelsRef.current = next;
      setShowSidePanels(next);
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(workspace);
    observer.observe(mainColumn);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!receiveOpen) {
      setReceiveQrDialogOpen(false);
    }
  }, [receiveOpen]);

  return (
    <Box
      ref={workspaceRef}
      sx={{
        ...getWalletVars(visual),
        ...WALLET_GLOW_CSS_VARS,
        alignItems: 'start',
        display: 'grid',
        gap: { xs: 1.8, lg: 2, xl: 3 },
        // Two columns only when the side panels measurably fit beside the main
        // content (see showSidePanels); otherwise the main content spans the
        // full width and the panels are hidden rather than overlapping it.
        gridTemplateColumns: showSidePanels
          ? 'minmax(0, 1fr) minmax(404px, 424px)'
          : '1fr',
        isolation: 'isolate',
        position: 'relative',
        width: '100%',
      }}
    >
      <Box
        ref={mainColumnRef}
        sx={{
          display: 'grid',
          // Constrain children to the column's track (instead of the implicit
          // auto/max-content track) so the summary and transaction table fit or
          // scroll within it rather than overflowing under the side panels.
          gridTemplateColumns: 'minmax(0, 1fr)',
          gap: { xs: 1.8, md: 2 },
          minWidth: 0,
          position: 'relative',
          zIndex: 1,
        }}
      >
        <WalletSummaryCard
          address={address}
          balance={balance}
          balanceDecimals={balanceDecimals}
          balanceError={balanceError}
          coin={coin}
          formattedBalance={formattedBalance}
          isBalanceLoading={isBalanceLoading}
          noAddressLabel={noAddressLabel}
          onSend={onSend}
          onToggleReceive={onToggleReceive}
          receiveOpen={receiveOpen}
        />
        {children}
        <Box sx={{ mt: { xs: 0, md: -0.85 } }}>{transactions}</Box>
      </Box>

      <Box
        sx={{
          display: 'grid',
          gap: 0,
          minWidth: 0,
          position: 'relative',
          zIndex: 1,
        }}
      >
        <Box
          sx={{
            height: {
              xs: 'auto',
              lg: receiveOpen ? RECEIVE_QR_SLOT_HEIGHT : 0,
            },
            mb: { xs: receiveOpen ? 1.6 : 0, lg: 0 },
            overflow: 'visible',
            pointerEvents: receiveOpen ? 'auto' : 'none',
            transition: {
              xs: 'margin-bottom 620ms cubic-bezier(0.4, 0, 0.2, 1)',
              lg: 'height 620ms cubic-bezier(0.4, 0, 0.2, 1)',
            },
          }}
        >
          <Collapse
            in={receiveOpen}
            timeout={620}
            unmountOnExit
            easing={{
              enter: 'cubic-bezier(0.16, 1, 0.3, 1)',
              exit: 'cubic-bezier(0.4, 0, 0.2, 1)',
            }}
            sx={{
              '& .MuiCollapse-wrapper': {
                overflow: 'hidden',
              },
              '& .MuiCollapse-wrapperInner': {
                overflow: 'hidden',
              },
            }}
          >
            <ReceiveQrMotionContent
              address={address}
              coin={coin}
              onQrClick={() => setReceiveQrDialogOpen(true)}
              open={receiveOpen}
            />
          </Collapse>
        </Box>

        <Box
          sx={{
            // Shown only when the panels measurably fit beside the main content
            // (see showSidePanels); otherwise they are hidden so they never
            // overlap the wallet and transaction content.
            display: coin === 'XMR' || showSidePanels ? 'block' : 'none',
            position: 'relative',
            zIndex: 1,
          }}
        >
          <WalletAddressBookPanel
            coin={coin}
            onAddContact={onAddContact}
            onAddressBookChange={onAddressBookChange}
            onSelectAddress={onSelectAddress}
            refreshKey={addressBookRefreshKey}
          />
          {rightColumnAfter ? (
            <Box sx={{ mt: { xs: 1.6, md: 3 } }}>{rightColumnAfter}</Box>
          ) : null}
        </Box>
      </Box>
      <ReceiveQrDialog
        address={address}
        coin={coin}
        onClose={() => setReceiveQrDialogOpen(false)}
        open={receiveQrDialogOpen}
      />
    </Box>
  );
}
