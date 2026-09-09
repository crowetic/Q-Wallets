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
import coinLogoBTC from '../../assets/btc.png';
import { FeeManager } from '../../components/FeeManager';
import { useTranslation } from 'react-i18next';
import {
  BTC_FEE,
  DECIMAL_ROUND_UP,
  EMPTY_STRING,
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
import { Coin } from 'qapp-core';
import { validateBtcAddress } from '../../utils/addressValidation';
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

export default function BitcoinWallet() {
  const { t } = useTranslation(['core']);
  const [walletInfoBtc, setWalletInfoBtc] = useState<any>({});
  const [_isLoadingWalletInfoBtc, setIsLoadingWalletInfoBtc] =
    useState<boolean>(false);
  const [walletBalanceBtc, setWalletBalanceBtc] = useState<any>(0);
  const [isLoadingWalletBalanceBtc, setIsLoadingWalletBalanceBtc] =
    useState<boolean>(true);
  const [transactionsBtc, setTransactionsBtc] = useState<any>([]);
  const [_isLoadingBtcTransactions, setIsLoadingBtcTransactions] =
    useState<boolean>(true);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [copyBtcTxHash, setCopyBtcTxHash] = useState(EMPTY_STRING);
  const [openBtcSend, setOpenBtcSend] = useState(false);
  const [btcAmount, setBtcAmount] = useState<number>(0);
  const [btcRecipient, setBtcRecipient] = useState(EMPTY_STRING);
  const [btcRecipientDisplayName, setBtcRecipientDisplayName] =
    useState(EMPTY_STRING);
  const [addressFormatError, setAddressFormatError] = useState(false);
  const [loadingRefreshBtc, setLoadingRefreshBtc] = useState(false);
  const [openTxBtcSubmit, setOpenTxBtcSubmit] = useState(false);
  const [openSendBtcSuccess, setOpenSendBtcSuccess] = useState(false);
  const [openSendBtcError, setOpenSendBtcError] = useState(false);
  const [sendBtcError, setSendBtcError] = useState(EMPTY_STRING);
  const [openBtcAddressBook, setOpenBtcAddressBook] = useState(false);
  const [receivePanelOpen, setReceivePanelOpen] = useState(false);
  const [inputFee, setInputFee] = useState(0);
  const [_walletInfoError, setWalletInfoError] = useState<string | null>(null);
  const [walletBalanceError, setWalletBalanceError] = useState<string | null>(
    null
  );
  const btcFeeCalculated = +(+inputFee / 1000 / 1e8).toFixed(DECIMAL_ROUND_UP);
  const estimatedFeeCalculated = +btcFeeCalculated * BTC_FEE;

  // Safely-spendable max: integer-satoshi math plus a small safety buffer so
  // the prefilled amount never lands on/above the host's spendable cutoff.
  const maxSendableBtcCoin = () =>
    calculateMaxSendable(
      walletBalanceBtc,
      estimatedFeeCalculated,
      SEND_MAX_SAFETY_BUFFER_SATS
    );

  const handleOpenAddressBook = () => {
    setOpenBtcAddressBook(true);
  };

  const handleCloseAddressBook = () => {
    setOpenBtcAddressBook(false);
  };

  const handleSelectAddress = (address: string, name: string) => {
    setBtcRecipient(address);
    setBtcRecipientDisplayName(name || EMPTY_STRING);
    setBtcAmount(0);
    setOpenBtcAddressBook(false);
    setOpenBtcSend(true);
    setAddressFormatError(false);
    setOpenSendBtcError(false);
    setSendBtcError(EMPTY_STRING);
    setWalletBalanceError(null);
  };

  const handleOpenBtcSend = () => {
    setBtcAmount(0);
    setBtcRecipient(EMPTY_STRING);
    setBtcRecipientDisplayName(EMPTY_STRING);
    setOpenBtcSend(true);
    setAddressFormatError(false);
    setOpenSendBtcError(false);
    setSendBtcError(EMPTY_STRING);
    setWalletBalanceError(null);
  };

  const disableCanSendBtc = () =>
    btcAmount <= 0 ||
    btcRecipient === EMPTY_STRING ||
    addressFormatError ||
    btcAmount > maxSendableBtcCoin();

  const handleRecipientChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const value = e.target.value.trim();
    setBtcRecipient(value);
    setBtcRecipientDisplayName(EMPTY_STRING);

    if (validateBtcAddress(value) || value === EMPTY_STRING) {
      setAddressFormatError(false);
    } else {
      setAddressFormatError(true);
    }
  };

  const handleCloseBtcSend = () => {
    setBtcAmount(0);
    setBtcRecipientDisplayName(EMPTY_STRING);
    setOpenBtcSend(false);
    setAddressFormatError(false);
    setOpenSendBtcError(false);
    setWalletBalanceError(null);
  };

  const handleClearBtcRecipient = () => {
    setBtcRecipient(EMPTY_STRING);
    setBtcRecipientDisplayName(EMPTY_STRING);
    setAddressFormatError(false);
    setOpenSendBtcError(false);
  };

  const changeCopyBtcTxHash = async () => {
    setCopyBtcTxHash('Copied');
    await timeoutDelay(TIME_SECONDS_2);
    setCopyBtcTxHash(EMPTY_STRING);
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

  const handleCloseSendBtcSuccess = (
    _event?: SyntheticEvent | Event,
    reason?: SnackbarCloseReason
  ) => {
    if (reason === 'clickaway') {
      return;
    }
    setOpenSendBtcSuccess(false);
  };

  const handleCloseSendBtcError = (
    _event?: SyntheticEvent | Event,
    reason?: SnackbarCloseReason
  ) => {
    if (reason === 'clickaway') {
      return;
    }
    setOpenSendBtcError(false);
  };

  const getWalletInfoBtc = async () => {
    setIsLoadingWalletInfoBtc(true);
    try {
      setWalletInfoError(null);
      const response = await qortalRequest({
        action: 'GET_USER_WALLET',
        coin: Coin.BTC,
      });
      if (response?.error) {
        setWalletInfoBtc({});
        setWalletInfoError(
          typeof response.error === 'string'
            ? response.error
            : t('core:message.error.loading_address', {
                postProcess: 'capitalizeFirstChar',
              })
        );
      } else {
        setWalletInfoBtc(response);
        setWalletInfoError(null);
      }
    } catch (error: any) {
      setWalletInfoBtc({});
      setWalletInfoError(
        error?.message ? String(error.message) : String(error)
      );
      console.error('ERROR GET BTC WALLET INFO', error);
    } finally {
      setIsLoadingWalletInfoBtc(false);
    }
  };

  useEffect(() => {
    let intervalId: any;
    (async () => {
      await Promise.all([
        getWalletInfoBtc(),
        getWalletBalanceBtc(),
        getTransactionsBtc(),
      ]);
      intervalId = setInterval(() => {
        getWalletBalanceBtc();
        getTransactionsBtc();
      }, TIME_MINUTES_3);
    })();
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, []);

  const getWalletBalanceBtc = async () => {
    try {
      setIsLoadingWalletBalanceBtc(true);

      const response = await qortalRequestWithTimeout(
        {
          action: 'GET_WALLET_BALANCE',
          coin: Coin.BTC,
        },
        TIME_MINUTES_5
      );

      if (!response?.error) {
        setWalletBalanceBtc(response);
      }
    } catch (error: any) {
      setWalletBalanceBtc(null);
      setWalletBalanceError(
        error?.message ? String(error.message) : String(error)
      );
      console.error('ERROR GET BTC BALANCE', error);
    } finally {
      setIsLoadingWalletBalanceBtc(false);
    }
  };

  const getTransactionsBtc = async () => {
    try {
      setIsLoadingBtcTransactions(true);
      const responseBtcTransactions = await qortalRequestWithTimeout(
        {
          action: 'GET_USER_WALLET_TRANSACTIONS',
          coin: Coin.BTC,
        },
        TIME_MINUTES_5
      );

      if (responseBtcTransactions?.error) {
        setTransactionsBtc([]);
      } else {
        setTransactionsBtc(responseBtcTransactions);
      }
    } catch (error: any) {
      setTransactionsBtc([]);
      console.error('ERROR GET BTC TRANSACTIONS', error);
    } finally {
      setIsLoadingBtcTransactions(false);
    }
  };

  const handleLoadingRefreshBtc = async () => {
    setLoadingRefreshBtc(true);
    await getTransactionsBtc();
    setLoadingRefreshBtc(false);
  };

  const handleSendMaxBtc = () => {
    if (maxSendableBtcCoin() <= 0) {
      setBtcAmount(0);
    } else {
      setBtcAmount(maxSendableBtcCoin());
    }
  };

  const sendBtcRequest = async () => {
    if (!btcFeeCalculated) return;
    // Conservative revalidation: never submit more than the safely-spendable
    // max, even if state changed (e.g. balance refresh) after input.
    if (btcAmount <= 0 || btcAmount > maxSendableBtcCoin()) {
      setSendBtcError(EMPTY_STRING);
      setOpenSendBtcError(true);
      return;
    }
    setOpenSendBtcError(false);
    setSendBtcError(EMPTY_STRING);
    setOpenTxBtcSubmit(true);
    try {
      const sendRequest = await qortalRequest({
        action: 'SEND_COIN',
        coin: Coin.BTC,
        recipient: btcRecipient,
        amount: btcAmount,
        fee: btcFeeCalculated,
      });
      if (sendRequest?.error) throw sendRequest;

      setBtcAmount(0);
      setBtcRecipient(EMPTY_STRING);
      setBtcRecipientDisplayName(EMPTY_STRING);
      setOpenTxBtcSubmit(false);
      setOpenSendBtcSuccess(true);
      await timeoutDelay(TIME_SECONDS_3);
      await Promise.all([getWalletBalanceBtc(), getTransactionsBtc()]);
    } catch (error) {
      setSendBtcError(getQortalRequestErrorMessage(error) ?? EMPTY_STRING);
      setOpenSendBtcError(true);
      console.error('ERROR SENDING BTC', error);
    } finally {
      setOpenTxBtcSubmit(false);
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
      coin="BTC"
      copyHashLabel={copyBtcTxHash || undefined}
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
        changeCopyBtcTxHash();
      }}
      onPageChange={handleChangePage}
      onRowsPerPageChange={handleChangeRowsPerPage}
      page={page}
      rows={transactionsBtc}
      rowsPerPage={rowsPerPage}
    />
  );

  return (
    <Box sx={{ width: '100%', mt: 2 }}>
      <WalletSendDialog
        open={openBtcSend}
        onClose={handleCloseBtcSend}
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
          open={openTxBtcSubmit}
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
          open={openSendBtcSuccess}
          autoHideDuration={TIME_SECONDS_4}
          slots={{ transition: SlideTransition }}
          onClose={handleCloseSendBtcSuccess}
        >
          <Alert
            onClose={handleCloseSendBtcSuccess}
            severity="success"
            variant="filled"
            sx={{ width: '100%' }}
          >
            {t('core:message.generic.sent_transaction', {
              coin: Coin.BTC,
              postProcess: 'capitalizeAll',
            })}
          </Alert>
        </Snackbar>
        <Snackbar
          open={openSendBtcError}
          autoHideDuration={TIME_SECONDS_20}
          onClose={handleCloseSendBtcError}
        >
          <Alert
            onClose={handleCloseSendBtcError}
            severity="error"
            variant="filled"
            sx={{ overflowWrap: 'anywhere', width: '100%' }}
          >
            {sendBtcError ||
              t('core:message.error.something_went_wrong', {
                postProcess: 'capitalizeFirstChar',
              })}
          </Alert>
        </Snackbar>
        <ExternalSendForm
          addressError={addressFormatError}
          addressHelperText={
            addressFormatError
              ? t('core:message.error.bitcoin_address_invalid', {
                  postProcess: 'capitalizeFirstChar',
                })
              : t('core:message.generic.bitcoin_address', {
                  postProcess: 'capitalizeFirstChar',
                })
          }
          addressInputId="btc-address"
          amount={btcAmount}
          balance={walletBalanceBtc}
          balanceError={walletBalanceError}
          coinLogo={coinLogoBTC}
          feeContent={<FeeManager coin="BTC" onChange={setInputFee} />}
          isBalanceLoading={isLoadingWalletBalanceBtc}
          maxSendable={maxSendableBtcCoin()}
          onAmountChange={setBtcAmount}
          onClearRecipient={handleClearBtcRecipient}
          onClose={handleCloseBtcSend}
          onOpenAddressBook={handleOpenAddressBook}
          onRecipientChange={handleRecipientChange}
          onSend={sendBtcRequest}
          onSendMax={handleSendMaxBtc}
          recipient={btcRecipient}
          recipientDisplayName={btcRecipientDisplayName}
          recipientSubtitle={t('core:address_book_ui.symbol_contact', {
            symbol: 'BTC',
          })}
          sendDisabled={disableCanSendBtc()}
          showAddressBookButton
          symbol="BTC"
        />
      </WalletSendDialog>

      <AddressBookDialog
        open={openBtcAddressBook}
        onClose={handleCloseAddressBook}
        coinType={Coin.BTC}
        onSelectAddress={handleSelectAddress}
      />

      <WalletWorkspace
        address={walletInfoBtc?.address ?? EMPTY_STRING}
        addressBookRefreshKey={openBtcAddressBook}
        balance={walletBalanceBtc}
        balanceDecimals={8}
        balanceError={walletBalanceError}
        coin="BTC"
        isBalanceLoading={isLoadingWalletBalanceBtc}
        onAddContact={handleOpenAddressBook}
        onSelectAddress={handleSelectAddress}
        onSend={handleOpenBtcSend}
        onToggleReceive={() => setReceivePanelOpen((prev) => !prev)}
        receiveOpen={receivePanelOpen}
        transactions={
          <WalletTransactionsCard
            isRefreshing={loadingRefreshBtc}
            onRefresh={handleLoadingRefreshBtc}
          >
            {loadingRefreshBtc ? (
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
