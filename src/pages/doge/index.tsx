import { calculateSendFee } from '../../utils/sendFee';
import { useSendAmount } from '../../hooks/useSendAmount';
import {
  ChangeEvent,
  MouseEvent,
  SyntheticEvent,
  useEffect,
  useState,
} from 'react';
import { timeoutDelay, copyToClipboard } from '../../common/functions';
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
import coinLogoDOGE from '../../assets/doge.png';
import { useTranslation } from 'react-i18next';
import {
  DOGE_FEE,
  EMPTY_STRING,
  SEND_MAX_SAFETY_BUFFER_SATS,
  TIME_MINUTES_3,
  TIME_MINUTES_5,
  TIME_SECONDS_2,
  TIME_SECONDS_3,
  TIME_SECONDS_4,
} from '../../common/constants';
import {
  SlideTransition,
  SubmitDialog,
  Transition,
  WalletSendDialog,
} from '../../styles/page-styles';
import { FeeManager } from '../../components/FeeManager';
import { Coin } from 'qapp-core';
import { validateDogeAddress } from '../../utils/addressValidation';
import { calculateMaxSendable } from '../../utils/maxSendable';

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

export default function DogecoinWallet() {
  const { t } = useTranslation(['core']);
  const [walletInfoDoge, setWalletInfoDoge] = useState<any>({});
  const [walletBalanceDoge, setWalletBalanceDoge] = useState<any>(0);
  const [_isLoadingWalletInfoDoge, setIsLoadingWalletInfoDoge] =
    useState<boolean>(true);
  const [isLoadingWalletBalanceDoge, setIsLoadingWalletBalanceDoge] =
    useState<boolean>(true);
  const [transactionsDoge, setTransactionsDoge] = useState<any>([]);
  const [isLoadingDogeTransactions, setIsLoadingDogeTransactions] =
    useState<boolean>(true);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [copyDogeTxHash, setCopyDogeTxHash] = useState(EMPTY_STRING);
  const [openDogeSend, setOpenDogeSend] = useState(false);
  const [dogeRecipient, setDogeRecipient] = useState(EMPTY_STRING);
  const [dogeRecipientDisplayName, setDogeRecipientDisplayName] =
    useState(EMPTY_STRING);
  const [addressFormatError, setAddressFormatError] = useState(false);
  const [loadingRefreshDoge, setLoadingRefreshDoge] = useState(false);
  const [openTxDogeSubmit, setOpenTxDogeSubmit] = useState(false);
  const [openSendDogeSuccess, setOpenSendDogeSuccess] = useState(false);
  const [openSendDogeError, setOpenSendDogeError] = useState(false);
  const [openDogeAddressBook, setOpenDogeAddressBook] = useState(false);
  const [receivePanelOpen, setReceivePanelOpen] = useState(false);

  const [inputFee, setInputFee] = useState(0);
  const [_walletInfoError, setWalletInfoError] = useState<string | null>(null);
  const [walletBalanceError, setWalletBalanceError] = useState<string | null>(
    null
  );

  const sendFee = calculateSendFee(inputFee, DOGE_FEE);
  const dogeFeeCalculated = sendFee?.feePerByte ?? 0;
  const estimatedFeeCalculated = sendFee?.estimatedFee ?? NaN;

  // Safely-spendable max: integer-satoshi math plus a small safety buffer so
  // the prefilled amount never lands on/above the host's spendable cutoff.
  const maxSendableDogeCoin = () =>
    calculateMaxSendable(
      walletBalanceDoge,
      estimatedFeeCalculated,
      SEND_MAX_SAFETY_BUFFER_SATS
    );
  const {
    amount: dogeAmount,
    setAmount: setDogeAmount,
    sendMax: handleSendMaxDoge,
  } = useSendAmount(maxSendableDogeCoin());

  const handleOpenAddressBook = () => {
    setOpenDogeAddressBook(true);
  };

  const handleCloseAddressBook = () => {
    setOpenDogeAddressBook(false);
  };

  const handleSelectAddress = (address: string, name: string) => {
    setDogeRecipient(address);
    setDogeRecipientDisplayName(name || EMPTY_STRING);
    setDogeAmount(0);
    setOpenDogeAddressBook(false);
    setOpenDogeSend(true);
    setAddressFormatError(false);
    setOpenSendDogeError(false);
  };

  const handleOpenDogeSend = () => {
    setDogeAmount(0);
    setDogeRecipient(EMPTY_STRING);
    setDogeRecipientDisplayName(EMPTY_STRING);
    setOpenDogeSend(true);
    setAddressFormatError(false);
    setOpenSendDogeError(false);
  };

  const disableCanSendDoge = () =>
    dogeAmount <= 0 ||
    dogeRecipient === EMPTY_STRING ||
    addressFormatError ||
    dogeAmount > maxSendableDogeCoin();

  const handleRecipientChange = (
    e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const value = e.target.value.trim();
    setDogeRecipient(value);
    setDogeRecipientDisplayName(EMPTY_STRING);

    if (validateDogeAddress(value) || value === EMPTY_STRING) {
      setAddressFormatError(false);
    } else {
      setAddressFormatError(true);
    }
  };

  const handleCloseDogeSend = () => {
    setDogeAmount(0);
    setDogeRecipientDisplayName(EMPTY_STRING);
    setOpenDogeSend(false);
    setAddressFormatError(false);
    setOpenSendDogeError(false);
  };

  const handleClearDogeRecipient = () => {
    setDogeRecipient(EMPTY_STRING);
    setDogeRecipientDisplayName(EMPTY_STRING);
    setAddressFormatError(false);
    setOpenSendDogeError(false);
  };

  const changeCopyDogeTxHash = async () => {
    setCopyDogeTxHash('Copied');
    await timeoutDelay(TIME_SECONDS_2);
    setCopyDogeTxHash(EMPTY_STRING);
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

  const handleCloseSendDogeSuccess = (
    _event?: SyntheticEvent | Event,
    reason?: SnackbarCloseReason
  ) => {
    if (reason === 'clickaway') {
      return;
    }
    setOpenSendDogeSuccess(false);
  };

  const handleCloseSendDogeError = (
    _event?: SyntheticEvent | Event,
    reason?: SnackbarCloseReason
  ) => {
    if (reason === 'clickaway') {
      return;
    }
    setOpenSendDogeError(false);
  };

  const getWalletInfoDoge = async () => {
    setIsLoadingWalletInfoDoge(true);
    try {
      setWalletInfoError(null);
      const response = await qortalRequest({
        action: 'GET_USER_WALLET',
        coin: Coin.DOGE,
      });
      if (response?.error) {
        setWalletInfoDoge({});
        setWalletInfoError(
          typeof response.error === 'string'
            ? response.error
            : t('core:message.error.loading_address', {
                postProcess: 'capitalizeFirstChar',
              })
        );
      } else {
        setWalletInfoDoge(response);
        setWalletInfoError(null);
      }
    } catch (error: any) {
      setWalletInfoDoge({});
      setWalletInfoError(
        error?.message ? String(error.message) : String(error)
      );
      console.error('ERROR GET DOGE WALLET INFO', error);
    } finally {
      setIsLoadingWalletInfoDoge(false);
    }
  };

  const getWalletBalanceDoge = async () => {
    try {
      setIsLoadingWalletBalanceDoge(true);

      const response = await qortalRequestWithTimeout(
        {
          action: 'GET_WALLET_BALANCE',
          coin: Coin.DOGE,
        },
        TIME_MINUTES_5
      );
      if (!response?.error) {
        setWalletBalanceDoge(response);
      }
    } catch (error: any) {
      setWalletBalanceDoge(null);
      setWalletBalanceError(
        error?.message ? String(error.message) : String(error)
      );
      console.error('ERROR GET DOGE BALANCE', error);
    } finally {
      setIsLoadingWalletBalanceDoge(false);
    }
  };

  const getTransactionsDoge = async () => {
    try {
      setIsLoadingDogeTransactions(true);
      const responseDogeTransactions = await qortalRequestWithTimeout(
        {
          action: 'GET_USER_WALLET_TRANSACTIONS',
          coin: Coin.DOGE,
        },
        TIME_MINUTES_5
      );

      if (responseDogeTransactions?.error) {
        setTransactionsDoge([]);
        setWalletBalanceDoge(null);
      } else {
        setTransactionsDoge(responseDogeTransactions);
      }
    } catch (error: any) {
      setTransactionsDoge([]);
      console.error('ERROR GET DOGE TRANSACTIONS', error);
    } finally {
      setIsLoadingDogeTransactions(false);
    }
  };

  useEffect(() => {
    let intervalId: any;
    (async () => {
      await Promise.all([
        getWalletInfoDoge(),
        getWalletBalanceDoge(),
        getTransactionsDoge(),
      ]);
      intervalId = setInterval(() => {
        getWalletBalanceDoge();
        getTransactionsDoge();
      }, TIME_MINUTES_3);
    })();
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, []);

  const handleLoadingRefreshDoge = async () => {
    setLoadingRefreshDoge(true);
    await getTransactionsDoge();
    setLoadingRefreshDoge(false);
  };

  const sendDogeRequest = async () => {
    if (!dogeFeeCalculated) return;
    // Conservative revalidation: never submit more than the safely-spendable
    // max, even if state changed (e.g. balance refresh) after input.
    if (dogeAmount <= 0 || dogeAmount > maxSendableDogeCoin()) {
      setOpenSendDogeError(true);
      return;
    }

    setOpenTxDogeSubmit(true);
    try {
      const sendRequest = await qortalRequest({
        action: 'SEND_COIN',
        coin: Coin.DOGE,
        recipient: dogeRecipient,
        amount: dogeAmount,
        fee: dogeFeeCalculated,
      });
      if (!sendRequest?.error) {
        setDogeAmount(0);
        setDogeRecipient(EMPTY_STRING);
        setDogeRecipientDisplayName(EMPTY_STRING);
        setOpenTxDogeSubmit(false);
        setOpenSendDogeSuccess(true);
        setIsLoadingWalletBalanceDoge(true);
        await timeoutDelay(TIME_SECONDS_3);
        await getTransactionsDoge();
      }
    } catch (error) {
      setDogeAmount(0);
      setDogeRecipient(EMPTY_STRING);
      setDogeRecipientDisplayName(EMPTY_STRING);
      setOpenTxDogeSubmit(false);
      setOpenSendDogeError(true);
      setIsLoadingWalletBalanceDoge(true);
      await timeoutDelay(TIME_SECONDS_3);
      await getTransactionsDoge();
      console.error('ERROR SENDING DOGE', error);
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
      coin="DOGE"
      copyHashLabel={copyDogeTxHash || undefined}
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
        changeCopyDogeTxHash();
      }}
      onPageChange={handleChangePage}
      onRowsPerPageChange={handleChangeRowsPerPage}
      page={page}
      rows={transactionsDoge}
      rowsPerPage={rowsPerPage}
    />
  );

  return (
    <Box sx={{ width: '100%', mt: 2 }}>
      <WalletSendDialog
        open={openDogeSend}
        onClose={handleCloseDogeSend}
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
          open={openTxDogeSubmit}
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
          open={openSendDogeSuccess}
          autoHideDuration={TIME_SECONDS_4}
          slots={{ transition: SlideTransition }}
          onClose={handleCloseSendDogeSuccess}
        >
          <Alert
            onClose={handleCloseSendDogeSuccess}
            severity="success"
            variant="filled"
            sx={{ width: '100%' }}
          >
            {t('core:message.generic.sent_transaction', {
              coin: Coin.DOGE,
              postProcess: 'capitalizeAll',
            })}
          </Alert>
        </Snackbar>
        <Snackbar
          open={openSendDogeError}
          autoHideDuration={TIME_SECONDS_4}
          onClose={handleCloseSendDogeError}
        >
          <Alert
            onClose={handleCloseSendDogeError}
            severity="error"
            variant="filled"
            sx={{ width: '100%' }}
          >
            {t('core:message.error.something_went_wrong', {
              postProcess: 'capitalizeAll',
            })}
          </Alert>
        </Snackbar>
        <ExternalSendForm
          addressError={addressFormatError}
          addressHelperText={
            addressFormatError
              ? t('core:message.error.doge_address_invalid', {
                  postProcess: 'capitalizeFirstChar',
                })
              : t('core:message.generic.doge_address', {
                  postProcess: 'capitalizeFirstChar',
                })
          }
          addressInputId="doge-address"
          amount={dogeAmount}
          balance={walletBalanceDoge}
          balanceError={walletBalanceError}
          coinLogo={coinLogoDOGE}
          feeContent={<FeeManager coin="DOGE" onChange={setInputFee} />}
          isBalanceLoading={isLoadingWalletBalanceDoge}
          maxSendable={maxSendableDogeCoin()}
          onAmountChange={setDogeAmount}
          onClearRecipient={handleClearDogeRecipient}
          onClose={handleCloseDogeSend}
          onOpenAddressBook={handleOpenAddressBook}
          onRecipientChange={handleRecipientChange}
          onSend={sendDogeRequest}
          onSendMax={handleSendMaxDoge}
          recipient={dogeRecipient}
          recipientDisplayName={dogeRecipientDisplayName}
          recipientSubtitle={t('core:address_book_ui.symbol_contact', {
            symbol: 'DOGE',
          })}
          sendDisabled={disableCanSendDoge()}
          showAddressBookButton
          symbol="DOGE"
        />
      </WalletSendDialog>

      <AddressBookDialog
        open={openDogeAddressBook}
        onClose={handleCloseAddressBook}
        coinType={Coin.DOGE}
        onSelectAddress={handleSelectAddress}
      />

      <WalletWorkspace
        address={walletInfoDoge?.address ?? EMPTY_STRING}
        addressBookRefreshKey={openDogeAddressBook}
        balance={walletBalanceDoge}
        balanceDecimals={8}
        balanceError={walletBalanceError}
        coin="DOGE"
        isBalanceLoading={isLoadingWalletBalanceDoge}
        onAddContact={handleOpenAddressBook}
        onSelectAddress={handleSelectAddress}
        onSend={handleOpenDogeSend}
        onToggleReceive={() => setReceivePanelOpen((prev) => !prev)}
        receiveOpen={receivePanelOpen}
        transactions={
          <WalletTransactionsCard
            isRefreshing={loadingRefreshDoge}
            onRefresh={handleLoadingRefreshDoge}
          >
            {isLoadingDogeTransactions || loadingRefreshDoge ? (
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
