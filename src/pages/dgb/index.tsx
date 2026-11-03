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
  ExternalFeeSlider,
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
import coinLogoDGB from '../../assets/dgb.png';
import { useTranslation } from 'react-i18next';
import {
  DGB_FEE,
  EMPTY_STRING,
  SEND_MAX_SAFETY_BUFFER_SATS,
  UTXO_SEND_TRANSACTION_BYTES,
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
import { Coin } from 'qapp-core';
import { validateDgbAddress } from '../../utils/addressValidation';
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

const dgbMarks = [
  {
    value: 1,
    label: 'MIN',
  },
  {
    value: 10,
    label: 'DEF',
  },
  {
    value: 100,
    label: 'MAX',
  },
];

function valueTextDgb(value: number) {
  return `${value} SAT`;
}

export default function DigibyteWallet() {
  const { t } = useTranslation(['core']);
  const [walletInfoDgb, setWalletInfoDgb] = useState<any>({});
  const [walletBalanceDgb, setWalletBalanceDgb] = useState<any>(0);
  const [_isLoadingWalletInfoDgb, setIsLoadingWalletInfoDgb] =
    useState<boolean>(true);
  const [isLoadingWalletBalanceDgb, setIsLoadingWalletBalanceDgb] =
    useState<boolean>(true);
  const [transactionsDgb, setTransactionsDgb] = useState<any>([]);
  const [isLoadingDgbTransactions, setIsLoadingDgbTransactions] =
    useState<boolean>(true);
  const [_walletInfoError, setWalletInfoError] = useState<string | null>(null);
  const [walletBalanceError, setWalletBalanceError] = useState<string | null>(
    null
  );
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [copyDgbTxHash, setCopyDgbTxHash] = useState(EMPTY_STRING);
  const [openDgbSend, setOpenDgbSend] = useState(false);
  const [dgbRecipient, setDgbRecipient] = useState(EMPTY_STRING);
  const [dgbRecipientDisplayName, setDgbRecipientDisplayName] =
    useState(EMPTY_STRING);
  const [addressFormatError, setAddressFormatError] = useState(false);
  const [dgbFee, setDgbFee] = useState<number>(DGB_FEE);
  const [loadingRefreshDgb, setLoadingRefreshDgb] = useState(false);
  const [openTxDgbSubmit, setOpenTxDgbSubmit] = useState(false);
  const [openSendDgbSuccess, setOpenSendDgbSuccess] = useState(false);
  const [openSendDgbError, setOpenSendDgbError] = useState(false);
  const [openDgbAddressBook, setOpenDgbAddressBook] = useState(false);
  const [receivePanelOpen, setReceivePanelOpen] = useState(false);

  const sendFee = calculateSendFee(
    dgbFee,
    UTXO_SEND_TRANSACTION_BYTES,
    'per-byte'
  );
  const dgbFeeCalculated = sendFee?.feePerByte ?? 0;
  const estimatedDgbFee = sendFee?.estimatedFee ?? NaN;

  // Safely-spendable max: integer-satoshi math plus a small safety buffer so
  // the prefilled amount never lands on/above the host's spendable cutoff.
  const maxSendableDbgCoin = () =>
    calculateMaxSendable(
      walletBalanceDgb,
      estimatedDgbFee,
      SEND_MAX_SAFETY_BUFFER_SATS
    );
  const {
    amount: dgbAmount,
    setAmount: setDgbAmount,
    sendMax: handleSendMaxDgb,
  } = useSendAmount(maxSendableDbgCoin());

  const handleOpenAddressBook = () => {
    setOpenDgbAddressBook(true);
  };

  const handleCloseAddressBook = () => {
    setOpenDgbAddressBook(false);
  };

  const handleSelectAddress = (address: string, name: string) => {
    setDgbRecipient(address);
    setDgbRecipientDisplayName(name || EMPTY_STRING);
    setDgbAmount(0);
    setDgbFee(DGB_FEE);
    setOpenDgbAddressBook(false);
    setOpenDgbSend(true);
    setAddressFormatError(false);
    setOpenSendDgbError(false);
  };

  const handleOpenDgbSend = () => {
    setDgbAmount(0);
    setDgbRecipient(EMPTY_STRING);
    setDgbRecipientDisplayName(EMPTY_STRING);
    setDgbFee(DGB_FEE);
    setOpenDgbSend(true);
    setAddressFormatError(false);
    setOpenSendDgbError(false);
  };

  const disableCanSendDgb = () =>
    dgbAmount <= 0 ||
    dgbRecipient === EMPTY_STRING ||
    addressFormatError ||
    dgbAmount > maxSendableDbgCoin();

  const handleRecipientChange = (
    e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const value = e.target.value.trim();
    setDgbRecipient(value);
    setDgbRecipientDisplayName(EMPTY_STRING);

    if (validateDgbAddress(value) || value === EMPTY_STRING) {
      setAddressFormatError(false);
    } else {
      setAddressFormatError(true);
    }
  };

  const handleCloseDgbSend = () => {
    setDgbAmount(0);
    setDgbFee(DGB_FEE);
    setDgbRecipientDisplayName(EMPTY_STRING);
    setOpenDgbSend(false);
    setAddressFormatError(false);
    setOpenSendDgbError(false);
  };

  const handleClearDgbRecipient = () => {
    setDgbRecipient(EMPTY_STRING);
    setDgbRecipientDisplayName(EMPTY_STRING);
    setAddressFormatError(false);
    setOpenSendDgbError(false);
  };

  const changeCopyDgbTxHash = async () => {
    setCopyDgbTxHash('Copied');
    await timeoutDelay(TIME_SECONDS_2);
    setCopyDgbTxHash(EMPTY_STRING);
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

  const handleChangeDgbFee = (_: Event, newValue: number | number[]) => {
    setDgbFee(newValue as number);
  };

  const handleCloseSendDgbSuccess = (
    _event?: SyntheticEvent | Event,
    reason?: SnackbarCloseReason
  ) => {
    if (reason === 'clickaway') {
      return;
    }
    setOpenSendDgbSuccess(false);
  };

  const handleCloseSendDgbError = (
    _event?: SyntheticEvent | Event,
    reason?: SnackbarCloseReason
  ) => {
    if (reason === 'clickaway') {
      return;
    }
    setOpenSendDgbError(false);
  };

  const getWalletInfoDgb = async () => {
    setIsLoadingWalletInfoDgb(true);
    try {
      setWalletInfoError(null);
      const response = await qortalRequest({
        action: 'GET_USER_WALLET',
        coin: Coin.DGB,
      });
      if (response?.error) {
        setWalletInfoDgb({});
        setWalletInfoError(
          typeof response.error === 'string'
            ? response.error
            : t('core:message.error.loading_address', {
                postProcess: 'capitalizeFirstChar',
              })
        );
      } else {
        setWalletInfoDgb(response);
        setWalletInfoError(null);
      }
    } catch (error: any) {
      setWalletInfoDgb({});
      setWalletInfoError(
        error?.message ? String(error.message) : String(error)
      );
      console.error('ERROR GET DGB WALLET INFO', error);
    } finally {
      setIsLoadingWalletInfoDgb(false);
    }
  };

  const getWalletBalanceDgb = async () => {
    try {
      setIsLoadingWalletBalanceDgb(true);

      const response = await qortalRequestWithTimeout(
        {
          action: 'GET_WALLET_BALANCE',
          coin: Coin.DGB,
        },
        TIME_MINUTES_5
      );
      if (!response?.error) {
        setWalletBalanceDgb(response);
      }
    } catch (error: any) {
      setWalletBalanceDgb(null);
      setWalletBalanceError(
        error?.message ? String(error.message) : String(error)
      );
      console.error('ERROR GET DGB BALANCE', error);
    } finally {
      setIsLoadingWalletBalanceDgb(false);
    }
  };

  const getTransactionsDgb = async () => {
    try {
      setIsLoadingDgbTransactions(true);
      const responseDgbTransactions = await qortalRequestWithTimeout(
        {
          action: 'GET_USER_WALLET_TRANSACTIONS',
          coin: Coin.DGB,
        },
        TIME_MINUTES_5
      );

      if (responseDgbTransactions?.error) {
        setTransactionsDgb([]);
      } else {
        setTransactionsDgb(responseDgbTransactions);
      }
    } catch (error: any) {
      setTransactionsDgb([]);
      console.error('ERROR GET DGB TRANSACTIONS', error);
    } finally {
      setIsLoadingDgbTransactions(false);
    }
  };

  useEffect(() => {
    let intervalId: any;
    (async () => {
      await Promise.all([
        getWalletInfoDgb(),
        getWalletBalanceDgb(),
        getTransactionsDgb(),
      ]);
      intervalId = setInterval(() => {
        getWalletBalanceDgb();
        getTransactionsDgb();
      }, TIME_MINUTES_3);
    })();
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, []);

  const handleLoadingRefreshDgb = async () => {
    setLoadingRefreshDgb(true);
    await getTransactionsDgb();
    setLoadingRefreshDgb(false);
  };

  const sendDgbRequest = async () => {
    // Conservative revalidation: never submit more than the safely-spendable
    // max, even if state changed (e.g. balance refresh) after input.
    if (dgbAmount <= 0 || dgbAmount > maxSendableDbgCoin()) {
      setOpenSendDgbError(true);
      return;
    }
    setOpenTxDgbSubmit(true);
    try {
      const sendRequest = await qortalRequest({
        action: 'SEND_COIN',
        coin: Coin.DGB,
        recipient: dgbRecipient,
        amount: dgbAmount,
        fee: dgbFeeCalculated,
      });
      if (!sendRequest?.error) {
        setDgbAmount(0);
        setDgbRecipient(EMPTY_STRING);
        setDgbRecipientDisplayName(EMPTY_STRING);
        setDgbFee(DGB_FEE);
        setOpenTxDgbSubmit(false);
        setOpenSendDgbSuccess(true);
        setIsLoadingWalletBalanceDgb(true);
        await timeoutDelay(TIME_SECONDS_3);
        await getTransactionsDgb();
      }
    } catch (error) {
      setDgbAmount(0);
      setDgbRecipient(EMPTY_STRING);
      setDgbRecipientDisplayName(EMPTY_STRING);
      setDgbFee(DGB_FEE);
      setOpenTxDgbSubmit(false);
      setOpenSendDgbError(true);
      setIsLoadingWalletBalanceDgb(true);
      await timeoutDelay(TIME_SECONDS_3);
      getTransactionsDgb();
      console.error('ERROR SENDING DGB', error);
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
      coin="DGB"
      copyHashLabel={copyDgbTxHash || undefined}
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
        changeCopyDgbTxHash();
      }}
      onPageChange={handleChangePage}
      onRowsPerPageChange={handleChangeRowsPerPage}
      page={page}
      rows={transactionsDgb}
      rowsPerPage={rowsPerPage}
    />
  );

  return (
    <Box sx={{ width: '100%', mt: 2 }}>
      <WalletSendDialog
        open={openDgbSend}
        onClose={handleCloseDgbSend}
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
          open={openTxDgbSubmit}
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
          open={openSendDgbSuccess}
          autoHideDuration={TIME_SECONDS_4}
          slots={{ transition: SlideTransition }}
          onClose={handleCloseSendDgbSuccess}
        >
          <Alert
            onClose={handleCloseSendDgbSuccess}
            severity="success"
            variant="filled"
            sx={{ width: '100%' }}
          >
            {t('core:message.generic.sent_transaction', {
              coin: Coin.DGB,
              postProcess: 'capitalizeAll',
            })}
          </Alert>
        </Snackbar>
        <Snackbar
          open={openSendDgbError}
          autoHideDuration={TIME_SECONDS_4}
          onClose={handleCloseSendDgbError}
        >
          <Alert
            onClose={handleCloseSendDgbError}
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
              ? t('core:message.error.digibyte_address_invalid', {
                  postProcess: 'capitalizeFirstChar',
                })
              : t('core:message.generic.digibyte_address', {
                  postProcess: 'capitalizeFirstChar',
                })
          }
          addressInputId="dgb-address"
          amount={dgbAmount}
          balance={walletBalanceDgb}
          balanceError={walletBalanceError}
          coinLogo={coinLogoDGB}
          feeContent={
            <ExternalFeeSlider
              defaultValue={10}
              fee={dgbFee}
              getAriaValueText={valueTextDgb}
              marks={dgbMarks}
              max={100}
              min={1}
              onChange={handleChangeDgbFee}
              sliderId="dgb-fee-slider"
              step={5}
            />
          }
          isBalanceLoading={isLoadingWalletBalanceDgb}
          maxSendable={maxSendableDbgCoin()}
          onAmountChange={setDgbAmount}
          onClearRecipient={handleClearDgbRecipient}
          onClose={handleCloseDgbSend}
          onOpenAddressBook={handleOpenAddressBook}
          onRecipientChange={handleRecipientChange}
          onSend={sendDgbRequest}
          onSendMax={handleSendMaxDgb}
          recipient={dgbRecipient}
          recipientDisplayName={dgbRecipientDisplayName}
          recipientSubtitle={t('core:address_book_ui.symbol_contact', {
            symbol: 'DGB',
          })}
          sendDisabled={disableCanSendDgb()}
          showAddressBookButton
          showBalanceMeter
          symbol="DGB"
        />
      </WalletSendDialog>

      <AddressBookDialog
        open={openDgbAddressBook}
        onClose={handleCloseAddressBook}
        coinType={Coin.DGB}
        onSelectAddress={handleSelectAddress}
      />

      <WalletWorkspace
        address={walletInfoDgb?.address ?? EMPTY_STRING}
        addressBookRefreshKey={openDgbAddressBook}
        balance={walletBalanceDgb}
        balanceDecimals={8}
        balanceError={walletBalanceError}
        coin="DGB"
        isBalanceLoading={isLoadingWalletBalanceDgb}
        onAddContact={handleOpenAddressBook}
        onSelectAddress={handleSelectAddress}
        onSend={handleOpenDgbSend}
        onToggleReceive={() => setReceivePanelOpen((prev) => !prev)}
        receiveOpen={receivePanelOpen}
        transactions={
          <WalletTransactionsCard
            isRefreshing={loadingRefreshDgb}
            onRefresh={handleLoadingRefreshDgb}
          >
            {isLoadingDgbTransactions || loadingRefreshDgb ? (
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
