import { useContext, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  LinearProgress,
  DialogActions,
  DialogContent,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import ContentCopy from '@mui/icons-material/ContentCopy';
import {
  WalletWorkspace,
  WalletTransactionsCard,
} from '../../components/WalletWorkspace';
import { WalletSendDialog } from '../../styles/page-styles';
import walletContext from '../../contexts/walletContext';
import {
  atomicAmount,
  checkedReply,
  decimalAmount,
  publicWallet,
  walletStatus,
  type XmrStatus,
  type XmrWallet,
} from './api';

const FAUCET_URL = 'https://faucet-stagenet.xmr.nodely.dev/';

// Account reads and native initialization include explicit Hub approvals.
const walletRequest = (options: QortalRequestOptions) =>
  qortalRequestWithTimeout(options, 600000);

export default function MoneroWallet() {
  const { t } = useTranslation(['core']);
  const {
    address: account,
    isAuthenticated,
    isUsingGateway,
    nodeInfo,
  } = useContext(walletContext);
  const [receiveOpen, setReceiveOpen] = useState(false);
  const [sendOpen, setSendOpen] = useState(false);
  const [wallet, setWallet] = useState<XmrWallet | null>(null);
  const [status, setStatus] = useState<XmrStatus | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [restoreHeight, setRestoreHeight] = useState('0');
  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');
  const [maxFee, setMaxFee] = useState('0.001');
  const generation = useRef(0);
  const working = useRef(false);
  const mode = `${account}:${nodeInfo?.isTestNet}:${nodeInfo?.moneroNetwork}`;
  useEffect(() => {
    const revision = ++generation.current;
    setWallet(null);
    setReceiveOpen(false);
    setSendOpen(false);
    setStatus(null);
    setError('');
    setMessage('');
    setRecipient('');
    setAmount('');
    setRestoreHeight('0');
    setBusy(false);
    working.current = false;
    return () => {
      generation.current = revision + 1;
    };
  }, [mode, isAuthenticated]);

  const showError = (reason: unknown) => {
    const text =
      reason instanceof Error
        ? reason.message
        : typeof reason === 'string'
          ? reason
          : '';
    setError(
      text && text !== 'XMR' && text !== 'invalid'
        ? text.slice(0, 500)
        : t('core:xmr.failed')
    );
  };
  const run = async (operation: (revision: number) => Promise<void>) => {
    if (working.current) return;
    const revision = generation.current;
    working.current = true;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await operation(revision);
    } catch (reason) {
      if (revision === generation.current) showError(reason);
    } finally {
      if (revision === generation.current) {
        working.current = false;
        setBusy(false);
      }
    }
  };
  const getStatus = async (current: XmrWallet, initialize = false) =>
    walletStatus(
      await walletRequest({
        action: 'GET_USER_WALLET_INFO',
        coin: 'XMR',
        ...(initialize
          ? { initialize: true, restoreHeight: Number(restoreHeight) }
          : {}),
      }),
      current.address
    );
  const connect = () =>
    run(async (revision) => {
      const current = publicWallet(
        await walletRequest({ action: 'GET_USER_WALLET', coin: 'XMR' })
      );
      if (revision !== generation.current) return;
      setWallet(current);
      if (current.network === 'stagenet') {
        const next = await getStatus(current);
        if (revision === generation.current) setStatus(next);
      }
    });
  useEffect(() => {
    if (!wallet || wallet.network !== 'stagenet') return;
    const revision = generation.current;
    let stopped = false;
    let polling = false;
    const timer = setInterval(async () => {
      if (polling || working.current) return;
      polling = true;
      try {
        const next = walletStatus(
          await walletRequest({ action: 'GET_USER_WALLET_INFO', coin: 'XMR' }),
          wallet.address
        );
        if (!stopped && revision === generation.current) setStatus(next);
      } catch (reason) {
        if (!stopped && revision === generation.current) showError(reason);
      } finally {
        polling = false;
      }
    }, 10000);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
    // Error text follows the current language; no monetary/account state is cached.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wallet, t]);
  const start = () =>
    run(async (revision) => {
      if (
        !wallet ||
        !/^(0|[1-9][0-9]*)$/.test(restoreHeight) ||
        !Number.isSafeInteger(Number(restoreHeight)) ||
        Number(restoreHeight) > (status?.daemonHeight ?? 0)
      )
        throw new Error(t('core:xmr.invalid_height'));
      const next = await getStatus(wallet, true);
      if (revision === generation.current) setStatus(next);
    });
  const send = (retryPending = false) =>
    run(async (revision) => {
      if (
        !wallet ||
        !status?.synced ||
        status.syncing ||
        (status.pending && !retryPending)
      )
        throw new Error(t('core:xmr.wait_sync'));
      if (!retryPending) {
        try {
          if (
            !/^[1-9A-HJ-NP-Za-km-z]{95}$/.test(recipient) ||
            atomicAmount(maxFee) > 1000000000000n ||
            atomicAmount(amount) + atomicAmount(maxFee) >
              BigInt(status.unlockedBalanceAtomic)
          )
            throw new Error();
        } catch {
          throw new Error(t('core:xmr.invalid_payment'));
        }
      }
      const txId = checkedReply(
        await walletRequest({
          action: 'SEND_COIN',
          coin: 'XMR',
          ...(retryPending
            ? { retryPending: true }
            : { recipient, amount, maxFee }),
        })
      );
      if (typeof txId !== 'string' || !/^[a-f0-9]{64}$/.test(txId))
        throw new Error(t('core:xmr.failed'));
      if (revision !== generation.current) return;
      setMessage(t('core:xmr.sent', { txId }));
      setAmount('');
      setSendOpen(false);
      // Stop duplicate submissions immediately, even if the following status read fails.
      setStatus((current) =>
        current ? { ...current, synced: false } : current
      );
      const next = await getStatus(wallet);
      if (revision === generation.current) setStatus(next);
    });

  const copyFaucet = async () => {
    const revision = generation.current;
    setError('');
    setMessage('');
    try {
      await navigator.clipboard.writeText(FAUCET_URL);
      if (revision === generation.current)
        setMessage(t('core:xmr.faucet_copied'));
    } catch {
      if (revision === generation.current) setError(t('core:xmr.copy_failed'));
    }
  };

  return (
    <Stack spacing={3} sx={{ mt: 2, width: '100%' }}>
      <Stack alignItems="center" direction="row" spacing={2}>
        <Typography variant="h4">Monero</Typography>
        <Chip color="warning" label={t('core:xmr.testing')} />
      </Stack>
      <Alert severity="warning">{t('core:xmr.stagenet_only')}</Alert>
      {!isAuthenticated ? (
        <Alert severity="info">{t('core:xmr.login')}</Alert>
      ) : isUsingGateway ? (
        <Alert severity="info">{t('core:xmr.gateway')}</Alert>
      ) : wallet?.network !== 'stagenet' ? (
        <Button disabled={busy} onClick={connect} variant="outlined">
          {t('core:xmr.connect')}
        </Button>
      ) : null}
      {error && (
        <Alert severity="error" sx={{ overflowWrap: 'anywhere' }}>
          {error}
        </Alert>
      )}
      {message && (
        <Alert severity="success" sx={{ overflowWrap: 'anywhere' }}>
          {message}
        </Alert>
      )}
      {wallet?.network === 'mainnet' && (
        <Alert severity="info">{t('core:xmr.configure')}</Alert>
      )}
      {wallet?.network === 'stagenet' && (
        <>
          <WalletWorkspace
            address={wallet.address}
            balance={status ? decimalAmount(status.balanceAtomic) : null}
            balanceDecimals={12}
            coin="XMR"
            formattedBalance={
              status ? `${decimalAmount(status.balanceAtomic)} XMR` : undefined
            }
            isBalanceLoading={!status}
            onSend={() => setSendOpen(true)}
            onToggleReceive={() => setReceiveOpen((open) => !open)}
            receiveOpen={receiveOpen}
            rightColumnAfter={
              <Card>
                <CardContent>
                  <Stack spacing={2}>
                    <Typography variant="h6">
                      {t('core:xmr.receive')}
                    </Typography>
                    <TextField
                      fullWidth
                      label={t('core:xmr.faucet')}
                      value={FAUCET_URL}
                      slotProps={{ input: { readOnly: true } }}
                      onFocus={(event) => event.target.select()}
                    />
                    <Button
                      onClick={copyFaucet}
                      startIcon={<ContentCopy />}
                      variant="outlined"
                    >
                      {t('core:xmr.copy_faucet')}
                    </Button>
                    <Typography variant="body2">
                      {t('core:xmr.faucet_help')}
                    </Typography>
                    <Typography variant="body2">
                      {t('core:xmr.backup')}
                    </Typography>
                  </Stack>
                </CardContent>
              </Card>
            }
            transactions={
              <WalletTransactionsCard
                title={t('core:xmr.history')}
                isRefreshing={busy}
                onRefresh={() =>
                  run(async (revision) => {
                    const next = await getStatus(wallet);
                    if (revision === generation.current) setStatus(next);
                  })
                }
              >
                <Stack spacing={2}>
                  {!status?.transactions.length && (
                    <Typography>{t('core:xmr.no_transactions')}</Typography>
                  )}
                  {status?.transactions.map((tx) => (
                    <Box
                      key={tx.txId}
                      sx={{
                        borderBottom: 1,
                        borderColor: 'divider',
                        paddingBottom: 2,
                      }}
                    >
                      <Typography>
                        {t(
                          tx.incoming
                            ? 'core:xmr.incoming'
                            : 'core:xmr.outgoing',
                          {
                            amount: decimalAmount(tx.amountAtomic),
                            confirmations: tx.confirmations,
                          }
                        )}
                      </Typography>
                      <Typography>
                        {t('core:xmr.fee', {
                          amount: decimalAmount(tx.feeAtomic),
                        })}
                      </Typography>
                      <Typography
                        sx={{
                          fontFamily: 'monospace',
                          overflowWrap: 'anywhere',
                        }}
                      >
                        {tx.txId}
                      </Typography>
                    </Box>
                  ))}
                </Stack>
              </WalletTransactionsCard>
            }
          >
            {status && (
              <Card>
                <CardContent>
                  <Stack spacing={2}>
                    <Typography variant="h6">{t('core:xmr.wallet')}</Typography>
                    <Typography>
                      {t('core:xmr.total', {
                        amount: decimalAmount(status.balanceAtomic),
                      })}
                    </Typography>
                    <Typography>
                      {t('core:xmr.unlocked', {
                        amount: decimalAmount(status.unlockedBalanceAtomic),
                      })}
                    </Typography>
                    <Typography>
                      {t('core:xmr.heights', {
                        wallet: status.walletHeight,
                        daemon: status.daemonHeight,
                      })}
                    </Typography>
                    <Typography variant="body2">
                      {t('core:xmr.daemon', { url: status.daemonUrl })}
                    </Typography>
                    {status.error && (
                      <Alert severity="error">{t('core:xmr.scan_error')}</Alert>
                    )}
                    {!status.initialized ? (
                      <>
                        <Alert severity="info">
                          {t('core:xmr.restore_help')}
                        </Alert>
                        <TextField
                          label={t('core:xmr.restore_height')}
                          value={restoreHeight}
                          onChange={(event) =>
                            setRestoreHeight(event.target.value)
                          }
                          slotProps={{ htmlInput: { inputMode: 'numeric' } }}
                          disabled={busy}
                        />
                        <Button
                          disabled={busy}
                          onClick={() =>
                            setRestoreHeight(String(status.daemonHeight))
                          }
                        >
                          {t('core:xmr.use_tip')}
                        </Button>
                        <Button
                          disabled={busy}
                          onClick={start}
                          variant="contained"
                        >
                          {t('core:xmr.start')}
                        </Button>
                      </>
                    ) : (
                      <>
                        <LinearProgress
                          variant="determinate"
                          value={status.progress * 100}
                          aria-label={t('core:xmr.progress')}
                        />
                        <Typography>
                          {t(
                            status.synced && !status.syncing
                              ? 'core:xmr.ready'
                              : 'core:xmr.wait_sync'
                          )}
                        </Typography>
                      </>
                    )}
                  </Stack>
                </CardContent>
              </Card>
            )}
            {status?.pending && (
              <Alert severity="warning">
                <Stack spacing={1}>
                  <Typography sx={{ overflowWrap: 'anywhere' }}>
                    {t('core:xmr.pending', { txId: status.pending.txId })}
                  </Typography>
                  <Button
                    disabled={busy || status.syncing || !status.synced}
                    onClick={() => send(true)}
                  >
                    {t('core:xmr.retry_payment')}
                  </Button>
                </Stack>
              </Alert>
            )}
          </WalletWorkspace>
          <WalletSendDialog
            open={sendOpen}
            onClose={() => setSendOpen(false)}
            aria-labelledby="xmr-send-title"
          >
            <DialogContent>
              <Stack
                component="form"
                spacing={2}
                onSubmit={(event) => {
                  event.preventDefault();
                  void send();
                }}
              >
                <Typography id="xmr-send-title" variant="h6">
                  {t('core:xmr.send')}
                </Typography>
                <TextField
                  label={t('core:xmr.recipient')}
                  value={recipient}
                  onChange={(event) => setRecipient(event.target.value)}
                  disabled={busy}
                  autoComplete="off"
                />
                <TextField
                  label={t('core:xmr.amount')}
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  disabled={busy}
                  slotProps={{ htmlInput: { inputMode: 'decimal' } }}
                />
                <TextField
                  label={t('core:xmr.max_fee')}
                  value={maxFee}
                  onChange={(event) => setMaxFee(event.target.value)}
                  disabled={busy}
                  slotProps={{ htmlInput: { inputMode: 'decimal' } }}
                />
                <Typography variant="body2">
                  {t('core:xmr.payment_help')}
                </Typography>
                <Button
                  type="submit"
                  variant="contained"
                  disabled={
                    busy ||
                    !status?.synced ||
                    status.syncing ||
                    !!status.pending
                  }
                >
                  {t('core:xmr.approve')}
                </Button>
              </Stack>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setSendOpen(false)}>
                {t('core:action.close', { postProcess: 'capitalizeFirstChar' })}
              </Button>
            </DialogActions>
          </WalletSendDialog>
        </>
      )}
    </Stack>
  );
}
