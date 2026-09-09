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
import coinLogoRVN from '../../assets/rvn.png';
import { useTranslation } from 'react-i18next';
import {
  DECIMAL_ROUND_UP,
  EMPTY_STRING,
  RVN_FEE,
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
import { AddressBookDialog } from '../../components/AddressBook/AddressBookDialog';
import {
  WalletExternalTransactionsList,
  WalletTransactionsLoader,
  WalletTransactionsCard,
  WalletWorkspace,
} from '../../components/WalletWorkspace';
import {
  ExternalFeeSlider,
  ExternalSendForm,
  sendCoinDialogPaperSx,
} from '../../components/ExternalSendForm';
import { calculateMaxSendable } from '../../utils/maxSendable';
import { getQortalRequestErrorMessage } from '../../utils/qortalRequestError';

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

const rvnMarks = [
  {
    value: 1000,
    label: 'MIN',
  },
  {
    value: 1500,
    label: 'DEF',
  },
  {
    value: 10000,
    label: 'MAX',
  },
];

function valueTextRvn(value: number) {
  return `${value} SAT`;
}

export default function RavencoinWallet() {
  const { t } = useTranslation(['core']);
  const [walletInfoRvn, setWalletInfoRvn] = useState<any>({});
  const [walletBalanceRvn, setWalletBalanceRvn] = useState<any>(0);
  const [_isLoadingWalletInfoRvn, setIsLoadingWalletInfoRvn] =
    useState<boolean>(true);
  const [isLoadingWalletBalanceRvn, setIsLoadingWalletBalanceRvn] =
    useState<boolean>(true);
  const [transactionsRvn, setTransactionsRvn] = useState<any>([]);
  const [isLoadingRvnTransactions, setIsLoadingRvnTransactions] =
    useState<boolean>(true);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [copyRvnTxHash, setCopyRvnTxHash] = useState(EMPTY_STRING);
  const [openRvnSend, setOpenRvnSend] = useState(false);
  const [rvnAmount, setRvnAmount] = useState<number>(0);
  const [rvnRecipient, setRvnRecipient] = useState(EMPTY_STRING);
  const [rvnRecipientDisplayName, setRvnRecipientDisplayName] =
    useState(EMPTY_STRING);
  const [addressFormatError, setAddressFormatError] = useState(false);
  const [rvnFee, setRvnFee] = useState<number>(0);
  const [_walletInfoError, setWalletInfoError] = useState<string | null>(null);
  const [walletBalanceError, setWalletBalanceError] = useState<string | null>(
    null
  );
  const [loadingRefreshRvn, setLoadingRefreshRvn] = useState(false);
  const [openTxRvnSubmit, setOpenTxRvnSubmit] = useState(false);
  const [openSendRvnSuccess, setOpenSendRvnSuccess] = useState(false);
  const [openSendRvnError, setOpenSendRvnError] = useState(false);
  const [sendRvnError, setSendRvnError] = useState(EMPTY_STRING);
  const [openRvnAddressBook, setOpenRvnAddressBook] = useState(false);
  const [receivePanelOpen, setReceivePanelOpen] = useState(false);

  // Estimated fee in whole coins (fee rate applied to a ~1000-byte tx).
  const estimatedRvnFee = (rvnFee * 1000) / 1e8;

  // Safely-spendable max: integer-satoshi math plus a small safety buffer so
  // the prefilled amount never lands on/above the host's spendable cutoff.
  const maxSendableRvnCoin = () =>
    calculateMaxSendable(
      walletBalanceRvn,
      estimatedRvnFee,
      SEND_MAX_SAFETY_BUFFER_SATS
    );

  const handleOpenAddressBook = () => {
    setOpenRvnAddressBook(true);
  };

  const handleCloseAddressBook = () => {
    setOpenRvnAddressBook(false);
  };

  const handleSelectAddress = (address: string, name: string) => {
    setRvnRecipient(address);
    setRvnRecipientDisplayName(name || EMPTY_STRING);
    setRvnAmount(0);
    setRvnFee(RVN_FEE);
    setOpenRvnAddressBook(false);
    setOpenRvnSend(true);
    setAddressFormatError(false);
    setWalletInfoError(null);
    setWalletBalanceError(null);
    setOpenSendRvnError(false);
  };

  const handleOpenRvnSend = () => {
    setRvnAmount(0);
    setRvnRecipient(EMPTY_STRING);
    setRvnRecipientDisplayName(EMPTY_STRING);
    setRvnFee(RVN_FEE);
    setOpenRvnSend(true);
    setAddressFormatError(false);
    setWalletInfoError(null);
    setWalletBalanceError(null);
    setOpenSendRvnError(false);
  };

  const disableCanSendRvn = () =>
    rvnAmount <= 0 ||
    rvnRecipient === EMPTY_STRING ||
    addressFormatError ||
    rvnAmount > maxSendableRvnCoin();

  const handleRecipientChange = (
    e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const value = e.target.value.trim();
    const pattern = /^(R[1-9A-HJ-NP-Za-km-z]{33})$/;

    setRvnRecipient(value);
    setRvnRecipientDisplayName(EMPTY_STRING);

    if (pattern.test(value) || value === EMPTY_STRING) {
      setAddressFormatError(false);
    } else {
      setAddressFormatError(true);
    }
  };

  const handleCloseRvnSend = () => {
    setRvnAmount(0);
    setRvnFee(0);
    setRvnRecipientDisplayName(EMPTY_STRING);
    setOpenRvnSend(false);
    setAddressFormatError(false);
    setWalletInfoError(null);
    setWalletBalanceError(null);
    setOpenSendRvnError(false);
  };

  const handleClearRvnRecipient = () => {
    setRvnRecipient(EMPTY_STRING);
    setRvnRecipientDisplayName(EMPTY_STRING);
    setAddressFormatError(false);
    setWalletInfoError(null);
    setWalletBalanceError(null);
    setOpenSendRvnError(false);
  };

  const changeCopyRvnTxHash = async () => {
    setCopyRvnTxHash('Copied');
    await timeoutDelay(TIME_SECONDS_2);
    setCopyRvnTxHash(EMPTY_STRING);
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

  const handleChangeRvnFee = (_: Event, newValue: number | number[]) => {
    setRvnFee(newValue as number);
    setRvnAmount(0);
  };

  const handleCloseSendRvnSuccess = (
    _event?: SyntheticEvent | Event,
    reason?: SnackbarCloseReason
  ) => {
    if (reason === 'clickaway') {
      return;
    }
    setOpenSendRvnSuccess(false);
  };

  const handleCloseSendRvnError = (
    _event?: SyntheticEvent | Event,
    reason?: SnackbarCloseReason
  ) => {
    if (reason === 'clickaway') {
      return;
    }
    setOpenSendRvnError(false);
  };

  const getWalletInfoRvn = async () => {
    setIsLoadingWalletInfoRvn(true);
    try {
      setWalletInfoError(null);
      const response = await qortalRequest({
        action: 'GET_USER_WALLET',
        coin: Coin.RVN,
      });
      if (response?.error) {
        setWalletInfoRvn({});
        setWalletInfoError(
          typeof response.error === 'string'
            ? response.error
            : t('core:message.error.loading_address', {
                postProcess: 'capitalizeFirstChar',
              })
        );
      } else {
        setWalletInfoRvn(response);
        setWalletInfoError(null);
      }
    } catch (error: any) {
      setWalletInfoRvn({});
      setWalletInfoError(
        error?.message ? String(error.message) : String(error)
      );
      console.error('ERROR GET RVN WALLET INFO', error);
    } finally {
      setIsLoadingWalletInfoRvn(false);
    }
  };

  const getWalletBalanceRvn = async () => {
    try {
      setIsLoadingWalletBalanceRvn(true);

      const response = await qortalRequestWithTimeout(
        {
          action: 'GET_WALLET_BALANCE',
          coin: Coin.RVN,
        },
        TIME_MINUTES_5
      );
      if (!response?.error) {
        setWalletBalanceRvn(response);
      }
    } catch (error: any) {
      setWalletBalanceRvn(null);
      setWalletBalanceError(
        error?.message ? String(error.message) : String(error)
      );
      console.error('ERROR GET RVN BALANCE', error);
    } finally {
      setIsLoadingWalletBalanceRvn(false);
    }
  };

  const getTransactionsRvn = async () => {
    try {
      setIsLoadingRvnTransactions(true);
      const responseRvnTransactions = await qortalRequestWithTimeout(
        {
          action: 'GET_USER_WALLET_TRANSACTIONS',
          coin: Coin.RVN,
        },
        TIME_MINUTES_5
      );

      if (responseRvnTransactions?.error) {
        setTransactionsRvn([]);
      } else {
        setTransactionsRvn(responseRvnTransactions);
      }
    } catch (error: any) {
      setTransactionsRvn([]);
      console.error('ERROR GET RVN TRANSACTIONS', error);
    } finally {
      setIsLoadingRvnTransactions(false);
    }
  };

  useEffect(() => {
    let intervalId: any;
    (async () => {
      await Promise.all([
        getWalletInfoRvn(),
        getWalletBalanceRvn(),
        getTransactionsRvn(),
      ]);
      intervalId = setInterval(() => {
        getWalletBalanceRvn();
        getTransactionsRvn();
      }, TIME_MINUTES_3);
    })();
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, []);

  const handleLoadingRefreshRvn = async () => {
    setLoadingRefreshRvn(true);
    await getTransactionsRvn();
    setLoadingRefreshRvn(false);
  };

  const handleSendMaxRvn = () => {
    if (maxSendableRvnCoin() <= 0) {
      setRvnAmount(0);
    } else {
      setRvnAmount(maxSendableRvnCoin());
    }
  };

  const sendRvnRequest = async () => {
    // Conservative revalidation: never submit more than the safely-spendable
    // max, even if state changed (e.g. balance refresh) after input.
    if (rvnAmount <= 0 || rvnAmount > maxSendableRvnCoin()) {
      setSendRvnError(EMPTY_STRING);
      setOpenSendRvnError(true);
      return;
    }
    setOpenSendRvnError(false);
    setSendRvnError(EMPTY_STRING);
    setOpenTxRvnSubmit(true);
    const rvnFeeCalculated = Number(rvnFee / 1e8).toFixed(DECIMAL_ROUND_UP);
    try {
      const sendRequest = await qortalRequest({
        action: 'SEND_COIN',
        coin: Coin.RVN,
        recipient: rvnRecipient,
        amount: rvnAmount,
        fee: rvnFeeCalculated,
      });
      if (sendRequest?.error) throw sendRequest;

      setRvnAmount(0);
      setRvnRecipient(EMPTY_STRING);
      setRvnRecipientDisplayName(EMPTY_STRING);
      setRvnFee(RVN_FEE);
      setOpenTxRvnSubmit(false);
      setOpenSendRvnSuccess(true);
      await timeoutDelay(TIME_SECONDS_3);
      await Promise.all([getWalletBalanceRvn(), getTransactionsRvn()]);
    } catch (error) {
      setSendRvnError(getQortalRequestErrorMessage(error) ?? EMPTY_STRING);
      setOpenSendRvnError(true);
      console.error('ERROR SENDING RVN', error);
    } finally {
      setOpenTxRvnSubmit(false);
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
      coin="RVN"
      copyHashLabel={copyRvnTxHash || undefined}
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
        changeCopyRvnTxHash();
      }}
      onPageChange={handleChangePage}
      onRowsPerPageChange={handleChangeRowsPerPage}
      page={page}
      rows={transactionsRvn}
      rowsPerPage={rowsPerPage}
    />
  );

  return (
    <Box sx={{ width: '100%', mt: 2 }}>
      <WalletSendDialog
        open={openRvnSend}
        onClose={handleCloseRvnSend}
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
          open={openTxRvnSubmit}
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
          open={openSendRvnSuccess}
          autoHideDuration={TIME_SECONDS_4}
          slots={{ transition: SlideTransition }}
          onClose={handleCloseSendRvnSuccess}
        >
          <Alert
            onClose={handleCloseSendRvnSuccess}
            severity="success"
            variant="filled"
            sx={{ width: '100%' }}
          >
            {t('core:message.generic.sent_transaction', {
              coin: Coin.RVN,
              postProcess: 'capitalizeAll',
            })}
          </Alert>
        </Snackbar>
        <Snackbar
          open={openSendRvnError}
          autoHideDuration={TIME_SECONDS_20}
          onClose={handleCloseSendRvnError}
        >
          <Alert
            onClose={handleCloseSendRvnError}
            severity="error"
            variant="filled"
            sx={{ overflowWrap: 'anywhere', width: '100%' }}
          >
            {sendRvnError ||
              t('core:message.error.something_went_wrong', {
                postProcess: 'capitalizeFirstChar',
              })}
          </Alert>
        </Snackbar>
        <ExternalSendForm
          addressError={addressFormatError}
          addressHelperText={
            addressFormatError
              ? t('core:message.error.ravencoin_address_invalid', {
                  postProcess: 'capitalizeFirstChar',
                })
              : t('core:message.generic.ravencoin_address', {
                  postProcess: 'capitalizeFirstChar',
                })
          }
          addressInputId="rvn-address"
          amount={rvnAmount}
          balance={walletBalanceRvn}
          balanceError={walletBalanceError}
          coinLogo={coinLogoRVN}
          feeContent={
            <ExternalFeeSlider
              defaultValue={1500}
              fee={rvnFee}
              getAriaValueText={valueTextRvn}
              marks={rvnMarks}
              max={10000}
              min={1000}
              onChange={handleChangeRvnFee}
              sliderId="rvn-fee-slider"
              step={100}
            />
          }
          isBalanceLoading={isLoadingWalletBalanceRvn}
          maxSendable={maxSendableRvnCoin()}
          onAmountChange={setRvnAmount}
          onClearRecipient={handleClearRvnRecipient}
          onClose={handleCloseRvnSend}
          onOpenAddressBook={handleOpenAddressBook}
          onRecipientChange={handleRecipientChange}
          onSend={sendRvnRequest}
          onSendMax={handleSendMaxRvn}
          recipient={rvnRecipient}
          recipientDisplayName={rvnRecipientDisplayName}
          recipientSubtitle={t('core:address_book_ui.symbol_contact', {
            symbol: 'RVN',
          })}
          sendDisabled={disableCanSendRvn()}
          showAddressBookButton
          showBalanceMeter
          symbol="RVN"
        />
      </WalletSendDialog>

      <AddressBookDialog
        open={openRvnAddressBook}
        onClose={handleCloseAddressBook}
        coinType={Coin.RVN}
        onSelectAddress={handleSelectAddress}
      />

      <WalletWorkspace
        address={walletInfoRvn?.address ?? EMPTY_STRING}
        addressBookRefreshKey={openRvnAddressBook}
        balance={walletBalanceRvn}
        balanceDecimals={8}
        balanceError={walletBalanceError}
        coin="RVN"
        isBalanceLoading={isLoadingWalletBalanceRvn}
        onAddContact={handleOpenAddressBook}
        onSelectAddress={handleSelectAddress}
        onSend={handleOpenRvnSend}
        onToggleReceive={() => setReceivePanelOpen((prev) => !prev)}
        receiveOpen={receivePanelOpen}
        transactions={
          <WalletTransactionsCard
            isRefreshing={loadingRefreshRvn}
            onRefresh={handleLoadingRefreshRvn}
          >
            {isLoadingRvnTransactions || loadingRefreshRvn ? (
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
