import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Chip,
  IconButton,
  TablePagination,
  Tooltip,
  Typography,
} from '@mui/material';
import { ContentCopy, NorthEast, SouthWest } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { WalletTransactionsCard } from '../../components/WalletWorkspace';
import { decimalAmount, type XmrTransaction } from './api';

const rowSx = {
  alignItems: 'center',
  display: 'grid',
  gap: 2,
  gridTemplateColumns:
    'minmax(185px, 1.4fr) 120px 110px 150px minmax(150px, 1fr)',
  minWidth: 795,
  px: 2,
  py: 1.5,
} as const;

export default function XmrTransactions({
  rows,
  isRefreshing,
  onRefresh,
}: {
  rows: XmrTransaction[];
  isRefreshing: boolean;
  onRefresh: () => void;
}) {
  const { t, i18n } = useTranslation(['core']);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [copiedHash, setCopiedHash] = useState('');
  const [copyError, setCopyError] = useState(false);
  const mounted = useRef(false);
  const copyRevision = useRef(0);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const displayPage = Math.min(
    page,
    Math.max(0, Math.ceil(rows.length / rowsPerPage) - 1)
  );
  const copyHash = async (hash: string) => {
    const revision = ++copyRevision.current;
    setCopiedHash('');
    setCopyError(false);
    try {
      await navigator.clipboard.writeText(hash);
      if (mounted.current && revision === copyRevision.current)
        setCopiedHash(hash);
    } catch {
      if (mounted.current && revision === copyRevision.current)
        setCopyError(true);
    }
  };
  return (
    <WalletTransactionsCard isRefreshing={isRefreshing} onRefresh={onRefresh}>
      {copyError && (
        <Alert severity="error">{t('core:xmr.hash_copy_failed')}</Alert>
      )}
      {copiedHash && (
        <Alert severity="success">{t('core:xmr.hash_copied')}</Alert>
      )}
      {!rows.length ? (
        <Typography sx={{ p: 2 }}>{t('core:xmr.no_transactions')}</Typography>
      ) : (
        <Box sx={{ overflowX: 'auto' }}>
          <Box role="table" aria-label={t('core:wallet.transactions')}>
            <Box role="row" sx={{ ...rowSx, color: 'text.secondary' }}>
              {[
                'core:amount',
                'core:fee.fee',
                'core:xmr.confirmations',
                'core:time',
                'core:transaction_hash',
              ].map((key) => (
                <Typography key={key} role="columnheader" variant="caption">
                  {t(key, { postProcess: 'capitalizeFirstChar' })}
                </Typography>
              ))}
            </Box>
            {rows
              .slice(displayPage * rowsPerPage, (displayPage + 1) * rowsPerPage)
              .map((tx) => (
                <Box
                  key={tx.txId}
                  role="row"
                  sx={{ ...rowSx, borderColor: 'divider', borderTop: 1 }}
                >
                  <Box role="cell">
                    <Chip
                      color={tx.incoming ? 'success' : 'default'}
                      icon={tx.incoming ? <SouthWest /> : <NorthEast />}
                      label={t(
                        tx.incoming
                          ? 'core:xmr.received'
                          : 'core:xmr.sent_label'
                      )}
                      size="small"
                      variant="outlined"
                    />
                    <Typography sx={{ mt: 0.5 }}>
                      {decimalAmount(tx.amountAtomic)} XMR
                    </Typography>
                  </Box>
                  <Typography role="cell">
                    {decimalAmount(tx.feeAtomic)} XMR
                  </Typography>
                  <Typography role="cell">{tx.confirmations}</Typography>
                  <Typography role="cell" variant="body2">
                    {tx.timestamp
                      ? new Date(tx.timestamp * 1000).toLocaleString(
                          i18n?.resolvedLanguage
                        )
                      : t('core:xmr.unconfirmed')}
                  </Typography>
                  <Box
                    role="cell"
                    sx={{ alignItems: 'center', display: 'flex', minWidth: 0 }}
                  >
                    <Tooltip title={tx.txId}>
                      <Typography
                        noWrap
                        sx={{ fontFamily: 'monospace', userSelect: 'all' }}
                      >
                        {tx.txId}
                      </Typography>
                    </Tooltip>
                    <IconButton
                      aria-label={t('core:action.copy_hash', { hash: tx.txId })}
                      onClick={() => void copyHash(tx.txId)}
                      size="small"
                    >
                      <ContentCopy fontSize="small" />
                    </IconButton>
                  </Box>
                </Box>
              ))}
          </Box>
        </Box>
      )}
      {rows.length > 0 && (
        <TablePagination
          component="div"
          count={rows.length}
          page={displayPage}
          rowsPerPage={rowsPerPage}
          rowsPerPageOptions={[5, 10, 25]}
          labelRowsPerPage={t('core:rows_per_page', {
            postProcess: 'capitalizeFirstChar',
          })}
          onPageChange={(_, next) => setPage(next)}
          onRowsPerPageChange={(event) => {
            setPage(0);
            setRowsPerPage(Number(event.target.value));
          }}
        />
      )}
    </WalletTransactionsCard>
  );
}
