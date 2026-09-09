import {
  ChangeEvent,
  MouseEvent,
  SyntheticEvent,
  useEffect,
  useState,
} from 'react';
import { timeoutDelay, copyToClipboard } from '../../common/functions';
import { useTheme } from '@mui/material/styles';
import {
  Alert,
  Box,
  DialogContent,
  IconButton,
  Typography,
} from '@mui/material';
import Snackbar from '@mui/material/Snackbar';
type SnackbarCloseReason = 'timeout' | 'clickaway' | 'escapeKeyDown';
import CircularProgress from '@mui/material/CircularProgress';
import {
  FirstPage,
  KeyboardArrowLeft,
  KeyboardArrowRight,
  LastPage,
} from '@mui/icons-material';
import coinLogoLTC from '../../assets/ltc.png';
import { useTranslation } from 'react-i18next';
import {
  DECIMAL_ROUND_UP,
  EMPTY_STRING,
  LTC_FEE,
  SEND_MAX_SAFETY_BUFFER_SATS,
  TIME_MINUTES_3,
  TIME_MINUTES_5,
  TIME_SECONDS_2,
  TIME_SECONDS_3,
  TIME_SECONDS_4,
  TIME_SECONDS_20,
} from '../../common/constants';
import {
  SlideTransition,
  SubmitDialog,
  Transition,
  WalletSendDialog,
} from '../../styles/page-styles';
import { FeeManager } from '../../components/FeeManager';
import { Coin } from 'qapp-core';
import { validateLtcAddress } from '../../utils/addressValidation';
import { calculateMaxSendable } from '../../utils/maxSendable';
import { getQortalRequestErrorMessage } from '../../utils/qortalRequestError';
import { AddressBookDialog } from '../../components/AddressBook/AddressBookDialog';
import {
  WalletExternalTransactionsList,
  WalletTransactionsCard,
  WalletTransactionsLoader,
  WalletWorkspace,
} from '../../components/WalletWorkspace';
import {
  ExternalSendForm,
  sendCoinDialogPaperSx,
} from '../../components/ExternalSendForm';

interface TablePaginationActionsProps {
  count: number;
  page: number;
  rowsPerPage: number;
  onPageChange: (event: MouseEvent<HTMLButtonElement>, newPage: number) => void;
}

function TablePaginationActions(props: TablePaginationActionsProps) {
  const { t } = useTranslation(['core']);
  const theme = useTheme();
  const { count, page, rowsPerPage, onPageChange } = props;

  const handleFirstPageButtonClick = (event: MouseEvent<HTMLButtonElement>) => {
    onPageChange(event, 0);
  };

  const handleBackButtonClick = (event: MouseEvent<HTMLButtonElement>) => {
    onPageChange(event, page - 1);
  };

  const handleNextButtonClick = (event: MouseEvent<HTMLButtonElement>) => {
    onPageChange(event, page + 1);
  };

  const handleLastPageButtonClick = (event: MouseEvent<HTMLButtonElement>) => {
    onPageChange(event, Math.max(0, Math.ceil(count / rowsPerPage) - 1));
  };

  return (
    <Box sx={{ flexShrink: 0, ml: 2.5 }}>
      <IconButton
        onClick={handleFirstPageButtonClick}
        disabled={page === 0}
        aria-label={t('core:page.first', {
          postProcess: 'capitalizeAll',
        })}
      >
        {theme.direction === 'rtl' ? <LastPage /> : <FirstPage />}
      </IconButton>
      <IconButton
        onClick={handleBackButtonClick}
        disabled={page === 0}
        aria-label={t('core:page.previous', {
          postProcess: 'capitalizeAll',
        })}
      >
        {theme.direction === 'rtl' ? (
          <KeyboardArrowRight />
        ) : (
          <KeyboardArrowLeft />
        )}
      </IconButton>
      <IconButton
        onClick={handleNextButtonClick}
        disabled={page >= Math.ceil(count / rowsPerPage) - 1}
        aria-label={t('core:page.next', {
          postProcess: 'capitalizeAll',
        })}
      >
        {theme.direction === 'rtl' ? (
          <KeyboardArrowLeft />
        ) : (
          <KeyboardArrowRight />
        )}
      </IconButton>
      <IconButton
        onClick={handleLastPageButtonClick}
        disabled={page >= Math.ceil(count / rowsPerPage) - 1}
        aria-label={t('core:page.last', {
          postProcess: 'capitalizeAll',
        })}
      >
        {theme.direction === 'rtl' ? <FirstPage /> : <LastPage />}
      </IconButton>
    </Box>
  );
}

export default function LitecoinWallet() {
  const { t } = useTranslation(['core']);
  const [walletInfoLtc, setWalletInfoLtc] = useState<any>({});
  const [walletBalanceLtc, setWalletBalanceLtc] = useState<any>(0);
  const [_isLoadingWalletInfoLtc, setIsLoadingWalletInfoLtc] =
    useState<boolean>(true);
  const [isLoadingWalletBalanceLtc, setIsLoadingWalletBalanceLtc] =
    useState<boolean>(true);
  const [transactionsLtc, setTransactionsLtc] = useState<any>([]);
  const [isLoadingLtcTransactions, setIsLoadingLtcTransactions] =
    useState<boolean>(true);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [copyLtcTxHash, setCopyLtcTxHash] = useState(EMPTY_STRING);
  const [openLtcSend, setOpenLtcSend] = useState(false);
  const [ltcAmount, setLtcAmount] = useState<number>(0);
  const [ltcRecipient, setLtcRecipient] = useState(EMPTY_STRING);
  const [ltcRecipientDisplayName, setLtcRecipientDisplayName] =
    useState(EMPTY_STRING);
  const [addressFormatError, setAddressFormatError] = useState(false);
  const [loadingRefreshLtc, setLoadingRefreshLtc] = useState(false);
  const [openTxLtcSubmit, setOpenTxLtcSubmit] = useState(false);
  const [openSendLtcSuccess, setOpenSendLtcSuccess] = useState(false);
  const [openSendLtcError, setOpenSendLtcError] = useState(false);
  const [sendLtcError, setSendLtcError] = useState(EMPTY_STRING);
  const [openLtcAddressBook, setOpenLtcAddressBook] = useState(false);
  const [receivePanelOpen, setReceivePanelOpen] = useState(false);
  const [inputFee, setInputFee] = useState(0);
  const [_walletInfoError, setWalletInfoError] = useState<string | null>(null);
  const [walletBalanceError, setWalletBalanceError] = useState<string | null>(
    null
  );

  const ltcFeeCalculated = +(+inputFee / 1000 / 1e8).toFixed(DECIMAL_ROUND_UP);
  const estimatedFeeCalculated = +ltcFeeCalculated * LTC_FEE;

  // Safely-spendable max: integer-satoshi math plus a small safety buffer so
  // the prefilled amount never lands on/above the host's spendable cutoff.
  const maxSendableLtcCoin = () =>
    calculateMaxSendable(
      walletBalanceLtc,
      estimatedFeeCalculated,
      SEND_MAX_SAFETY_BUFFER_SATS
    );

  const handleOpenAddressBook = () => {
    setOpenLtcAddressBook(true);
  };

  const handleCloseAddressBook = () => {
    setOpenLtcAddressBook(false);
  };

  const handleSelectAddress = (address: string, name: string) => {
    setLtcRecipient(address);
    setLtcRecipientDisplayName(name || EMPTY_STRING);
    setLtcAmount(0);
    setOpenLtcAddressBook(false);
    setOpenLtcSend(true);
    setAddressFormatError(false);
    setOpenSendLtcError(false);
    setSendLtcError(EMPTY_STRING);
    setWalletInfoError(null);
    setWalletBalanceError(null);
  };

  const handleOpenLtcSend = () => {
    setLtcAmount(0);
    setLtcRecipient(EMPTY_STRING);
    setLtcRecipientDisplayName(EMPTY_STRING);
    setOpenLtcSend(true);
    setAddressFormatError(false);
    setOpenSendLtcError(false);
    setSendLtcError(EMPTY_STRING);
    setWalletInfoError(null);
    setWalletBalanceError(null);
  };

  const disableCanSendLtc = () =>
    ltcAmount <= 0 ||
    ltcRecipient === EMPTY_STRING ||
    addressFormatError ||
    ltcAmount > maxSendableLtcCoin();

  const handleRecipientChange = (
    e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const value: string = e.target.value.trim();
    setLtcRecipient(value);
    setLtcRecipientDisplayName(EMPTY_STRING);

    if (validateLtcAddress(value) || value === EMPTY_STRING) {
      setAddressFormatError(false);
    } else {
      setAddressFormatError(true);
    }
  };

  const handleCloseLtcSend = () => {
    setLtcAmount(0);
    setLtcRecipientDisplayName(EMPTY_STRING);
    setOpenLtcSend(false);
    setAddressFormatError(false);
    setOpenSendLtcError(false);
    setWalletInfoError(null);
    setWalletBalanceError(null);
  };

  const handleClearLtcRecipient = () => {
    setLtcRecipient(EMPTY_STRING);
    setLtcRecipientDisplayName(EMPTY_STRING);
    setAddressFormatError(false);
    setOpenSendLtcError(false);
  };

  const changeCopyLtcTxHash = async () => {
    setCopyLtcTxHash('Copied');
    await timeoutDelay(TIME_SECONDS_2);
    setCopyLtcTxHash(EMPTY_STRING);
  };

  const handleChangePage = (
    _event: MouseEvent<HTMLButtonElement> | null,
    newPage: number
  ) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const handleCloseSendLtcSuccess = (
    _event?: SyntheticEvent | Event,
    reason?: SnackbarCloseReason
  ) => {
    if (reason === 'clickaway') {
      return;
    }
    setOpenSendLtcSuccess(false);
  };

  const handleCloseSendLtcError = (
    _event?: SyntheticEvent | Event,
    reason?: SnackbarCloseReason
  ) => {
    if (reason === 'clickaway') {
      return;
    }
    setOpenSendLtcError(false);
  };

  const getWalletInfoLtc = async () => {
    setIsLoadingWalletInfoLtc(true);
    try {
      setWalletInfoError(null);
      const response = await qortalRequest({
        action: 'GET_USER_WALLET',
        coin: Coin.LTC,
      });
      if (response?.error) {
        setWalletInfoLtc({});
        setWalletInfoError(
          typeof response.error === 'string'
            ? response.error
            : t('core:message.error.loading_address', {
                postProcess: 'capitalizeFirstChar',
              })
        );
      } else {
        setWalletInfoLtc(response);
        setWalletInfoError(null);
      }
    } catch (error: any) {
      setWalletInfoLtc({});
      setWalletInfoError(
        error?.message ? String(error.message) : String(error)
      );
      console.error('ERROR GET LTC WALLET INFO', error);
    } finally {
      setIsLoadingWalletInfoLtc(false);
    }
  };

  const getWalletBalanceLtc = async () => {
    try {
      setIsLoadingWalletBalanceLtc(true);

      const response = await qortalRequestWithTimeout(
        {
          action: 'GET_WALLET_BALANCE',
          coin: Coin.LTC,
        },
        TIME_MINUTES_5
      );
      if (!response?.error) {
        setWalletBalanceLtc(response);
      }
    } catch (error: any) {
      setWalletBalanceLtc(null);
      setWalletBalanceError(
        error?.message ? String(error.message) : String(error)
      );
      console.error('ERROR GET LTC BALANCE', error);
    } finally {
      setIsLoadingWalletBalanceLtc(false);
    }
  };

  const getTransactionsLtc = async () => {
    try {
      setIsLoadingLtcTransactions(true);

      const responseLtcTransactions = await qortalRequestWithTimeout(
        {
          action: 'GET_USER_WALLET_TRANSACTIONS',
          coin: Coin.LTC,
        },
        TIME_MINUTES_5
      );

      if (responseLtcTransactions?.error) {
        setTransactionsLtc([]);
      } else {
        setTransactionsLtc(responseLtcTransactions);
      }
    } catch (error: any) {
      setTransactionsLtc([]);
      console.error('ERROR GET LTC TRANSACTIONS', error);
    } finally {
      setIsLoadingLtcTransactions(false);
    }
  };

  useEffect(() => {
    let intervalId: any;
    (async () => {
      await Promise.all([
        getWalletInfoLtc(),
        getWalletBalanceLtc(),
        getTransactionsLtc(),
      ]);
      intervalId = setInterval(() => {
        getWalletBalanceLtc();
        getTransactionsLtc();
      }, TIME_MINUTES_3);
    })();
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, []);

  const handleLoadingRefreshLtc = async () => {
    setLoadingRefreshLtc(true);
    await getTransactionsLtc();
    setLoadingRefreshLtc(false);
  };

  const handleSendMaxLtc = () => {
    if (maxSendableLtcCoin() <= 0) {
      setLtcAmount(0);
    } else {
      setLtcAmount(maxSendableLtcCoin());
    }
  };

  const sendLtcRequest = async () => {
    if (!ltcFeeCalculated) return;
    // Conservative revalidation: never submit more than the safely-spendable
    // max, even if state changed (e.g. balance refresh) after input.
    if (ltcAmount <= 0 || ltcAmount > maxSendableLtcCoin()) {
      setSendLtcError(EMPTY_STRING);
      setOpenSendLtcError(true);
      return;
    }
    setOpenSendLtcError(false);
    setSendLtcError(EMPTY_STRING);
    setOpenTxLtcSubmit(true);

    try {
      const sendRequest = await qortalRequest({
        action: 'SEND_COIN',
        coin: Coin.LTC,
        recipient: ltcRecipient,
        amount: ltcAmount,
        fee: ltcFeeCalculated,
      });
      if (sendRequest?.error) throw sendRequest;

      setLtcAmount(0);
      setLtcRecipient(EMPTY_STRING);
      setLtcRecipientDisplayName(EMPTY_STRING);
      setOpenTxLtcSubmit(false);
      setOpenSendLtcSuccess(true);
      await timeoutDelay(TIME_SECONDS_3);
      await Promise.all([getWalletBalanceLtc(), getTransactionsLtc()]);
    } catch (error) {
      setSendLtcError(getQortalRequestErrorMessage(error) ?? EMPTY_STRING);
      setOpenSendLtcError(true);
      console.error('ERROR SENDING LTC', error);
    } finally {
      setOpenTxLtcSubmit(false);
    }
  };

  const tableLoader = () => {
    return (
      <WalletTransactionsLoader
        label={t('core:message.generic.loading_transactions', {
          postProcess: 'capitalizeFirstChar',
        })}
      />
    );
  };

  const transactionsTable = () => (
    <WalletExternalTransactionsList
      ActionsComponent={TablePaginationActions}
      coin="LTC"
      copyHashLabel={copyLtcTxHash || undefined}
      labels={{
        copyHash: (hash) =>
          t('core:action.copy_hash', {
            hash,
            postProcess: 'capitalizeFirstChar',
          }),
        fee: t('core:fee.fee', {
          postProcess: 'capitalizeFirstChar',
        }),
        noTransactions: 'No transactions.',
        receiver: t('core:receiver', {
          postProcess: 'capitalizeFirstChar',
        }),
        rowsPerPage: t('core:rows_per_page', {
          postProcess: 'capitalizeFirstChar',
        }),
        sender: t('core:sender', {
          postProcess: 'capitalizeFirstChar',
        }),
        time: t('core:time', {
          postProcess: 'capitalizeFirstChar',
        }),
        totalAmount: t('core:total_amount', {
          postProcess: 'capitalizeFirstChar',
        }),
        transactionHash: t('core:transaction_hash', {
          postProcess: 'capitalizeFirstChar',
        }),
        waitingConfirmation: t('core:message.generic.waiting_confirmation', {
          postProcess: 'capitalizeFirstChar',
        }),
      }}
      onCopyHash={(hash) => {
        copyToClipboard(hash);
        changeCopyLtcTxHash();
      }}
      onPageChange={handleChangePage}
      onRowsPerPageChange={handleChangeRowsPerPage}
      page={page}
      rows={transactionsLtc}
      rowsPerPage={rowsPerPage}
    />
  );

  return (
    <Box sx={{ width: '100%', mt: 2 }}>
      <WalletSendDialog
        open={openLtcSend}
        onClose={handleCloseLtcSend}
        slots={{ transition: Transition }}
        maxWidth={false}
        fullWidth
        disableAutoFocus
        disableRestoreFocus
        disableScrollLock
        slotProps={{
          paper: {
            sx: sendCoinDialogPaperSx,
          },
        }}
      >
        <SubmitDialog
          fullWidth={true}
          maxWidth="xs"
          open={openTxLtcSubmit}
          disableScrollLock
        >
          <DialogContent>
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'center',
                flexWrap: 'wrap',
              }}
            >
              <Box
                style={{
                  width: '100%',
                  display: 'flex',
                  justifyContent: 'center',
                }}
              >
                <CircularProgress color="success" size={64} />
              </Box>
              <Box
                style={{
                  width: '100%',
                  display: 'flex',
                  justifyContent: 'center',
                  marginTop: '20px',
                }}
              >
                <Typography
                  variant="h6"
                  sx={{
                    color: 'primary.main',
                    fontStyle: 'italic',
                    fontWeight: 700,
                  }}
                >
                  {t('core:message.generic.processing_transaction', {
                    postProcess: 'capitalizeFirstChar',
                  })}
                </Typography>
              </Box>
            </Box>
          </DialogContent>
        </SubmitDialog>
        <Snackbar
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
          open={openSendLtcSuccess}
          autoHideDuration={TIME_SECONDS_4}
          slots={{ transition: SlideTransition }}
          onClose={handleCloseSendLtcSuccess}
        >
          <Alert
            onClose={handleCloseSendLtcSuccess}
            severity="success"
            variant="filled"
            sx={{ width: '100%' }}
          >
            {t('core:message.generic.sent_transaction', {
              coin: Coin.LTC,
              postProcess: 'capitalizeAll',
            })}
          </Alert>
        </Snackbar>
        <Snackbar
          open={openSendLtcError}
          autoHideDuration={TIME_SECONDS_20}
          onClose={handleCloseSendLtcError}
        >
          <Alert
            onClose={handleCloseSendLtcError}
            severity="error"
            variant="filled"
            sx={{ overflowWrap: 'anywhere', width: '100%' }}
          >
            {sendLtcError ||
              t('core:message.error.something_went_wrong', {
                postProcess: 'capitalizeFirstChar',
              })}
          </Alert>
        </Snackbar>
        <ExternalSendForm
          addressError={addressFormatError}
          addressHelperText={
            addressFormatError
              ? t('core:message.error.litecoin_address_invalid', {
                  postProcess: 'capitalizeFirstChar',
                })
              : t('core:message.generic.litecoin_address', {
                  postProcess: 'capitalizeFirstChar',
                })
          }
          addressInputId="ltc-address"
          amount={ltcAmount}
          balance={walletBalanceLtc}
          balanceError={walletBalanceError}
          coinLogo={coinLogoLTC}
          feeContent={<FeeManager coin="LTC" onChange={setInputFee} />}
          isBalanceLoading={isLoadingWalletBalanceLtc}
          maxSendable={maxSendableLtcCoin()}
          onAmountChange={setLtcAmount}
          onClearRecipient={handleClearLtcRecipient}
          onClose={handleCloseLtcSend}
          onOpenAddressBook={handleOpenAddressBook}
          onRecipientChange={handleRecipientChange}
          onSend={sendLtcRequest}
          onSendMax={handleSendMaxLtc}
          recipient={ltcRecipient}
          recipientDisplayName={ltcRecipientDisplayName}
          recipientSubtitle={t('core:address_book_ui.symbol_contact', {
            symbol: 'LTC',
          })}
          sendDisabled={disableCanSendLtc()}
          showAddressBookButton
          symbol="LTC"
        />
      </WalletSendDialog>

      <AddressBookDialog
        open={openLtcAddressBook}
        onClose={handleCloseAddressBook}
        coinType={Coin.LTC}
        onSelectAddress={handleSelectAddress}
      />

      <WalletWorkspace
        address={walletInfoLtc?.address ?? EMPTY_STRING}
        addressBookRefreshKey={openLtcAddressBook}
        balance={walletBalanceLtc}
        balanceDecimals={8}
        balanceError={walletBalanceError}
        coin="LTC"
        isBalanceLoading={isLoadingWalletBalanceLtc}
        onAddContact={handleOpenAddressBook}
        onSelectAddress={handleSelectAddress}
        onSend={handleOpenLtcSend}
        onToggleReceive={() => setReceivePanelOpen((prev) => !prev)}
        receiveOpen={receivePanelOpen}
        transactions={
          <WalletTransactionsCard
            isRefreshing={loadingRefreshLtc}
            onRefresh={handleLoadingRefreshLtc}
          >
            {isLoadingLtcTransactions || loadingRefreshLtc ? (
              tableLoader()
            ) : (
              <Box sx={{ width: '100%' }}>{transactionsTable()}</Box>
            )}
          </WalletTransactionsCard>
        }
      />
    </Box>
  );
}
