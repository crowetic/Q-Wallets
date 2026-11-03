import { useSendAmount } from '../../hooks/useSendAmount';
import WalletContext from '../../contexts/walletContext';
import { copyToClipboard, timeoutDelay } from '../../common/functions';
import { AddressBookDialog } from '../../components/AddressBook/AddressBookDialog';
import {
  WalletExternalTransactionsList,
  WalletTransactionsCard,
  WalletTransactionsLoader,
  WalletWorkspace,
} from '../../components/WalletWorkspace';
import { useTheme } from '@mui/material/styles';
import {
  Alert,
  Box,
  Button,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  List,
  ListItemButton,
  ListItemText,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import Snackbar from '@mui/material/Snackbar';
type SnackbarCloseReason = 'timeout' | 'clickaway' | 'escapeKeyDown';
import CircularProgress from '@mui/material/CircularProgress';
import LinearProgress from '@mui/material/LinearProgress';
import {
  FirstPage,
  InfoOutlined,
  KeyboardArrowLeft,
  KeyboardArrowRight,
  LastPage,
} from '@mui/icons-material';
import coinLogoARRR from '../../assets/arrr.png';
import {
  ChangeEvent,
  Key,
  MouseEvent,
  SyntheticEvent,
  useContext,
  useEffect,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import {
  ARRR_FEE,
  EMPTY_STRING,
  SEND_MAX_SAFETY_BUFFER_SATS,
  TIME_MINUTES_2,
  TIME_MINUTES_3,
  TIME_MINUTES_5,
  TIME_SECONDS_2,
  TIME_SECONDS_3,
  TIME_SECONDS_4,
  TIME_SECONDS_5,
} from '../../common/constants';
import {
  LightwalletDialog,
  SlideTransition,
  SubmitDialog,
  Transition,
  WalletCard,
  WalletSendDialog,
} from '../../styles/page-styles';
import { Coin } from 'qapp-core';
import { validateArrrAddress } from '../../utils/addressValidation';
import {
  ExternalSendForm,
  sendCoinDialogPaperSx,
} from '../../components/ExternalSendForm';
import { calculateMaxSendable } from '../../utils/maxSendable';
import { useArrrAddressValidation } from '../../hooks/useArrrAddressValidation';
import { walletErrorMessage } from '../../utils/walletErrorMessage';
import {
  ARRR_TRANSACTION_RETRY_DELAY_MS,
  hasUnresolvedArrrRecipients,
  requestArrrTransactionsWithRetry,
} from '../../utils/arrrTransactionRetry';

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

export default function PirateWallet() {
  const { t } = useTranslation(['core']);
  const { isUsingGateway } = useContext(WalletContext);
  const [isSynced, setIsSynced] = useState(false);
  const [syncStatus, setSyncStatus] = useState(EMPTY_STRING);
  const [walletInfoArrr, setWalletInfoArrr] = useState<any>({});
  const [walletBalanceArrr, setWalletBalanceArrr] = useState<any>(0);
  const [_isLoadingWalletInfoArrr, setIsLoadingWalletInfoArrr] =
    useState<boolean>(true);
  const [isLoadingWalletBalanceArrr, setIsLoadingWalletBalanceArrr] =
    useState<boolean>(true);
  const [allLightwalletServersArrr, setAllLightwalletServersArrr] =
    useState<any>([]);
  const [currentLightwalletServerArrr, setCurrentLightwalletServerArrr] =
    useState<any>([]);
  const [_changeServer, setChangeServer] = useState(false);
  const [arrrMemo, setArrrMemo] = useState(EMPTY_STRING);
  const [transactionsArrr, setTransactionsArrr] = useState<any>([]);
  const [isLoadingArrrTransactions, setIsLoadingArrrTransactions] =
    useState<boolean>(true);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [copyArrrTxHash, setCopyArrrTxHash] = useState(EMPTY_STRING);
  const [openArrrLightwallet, setOpenArrrLightwallet] = useState(false);
  const [openArrrServerChange, setOpenArrrServerChange] = useState(false);
  const [openArrrSend, setOpenArrrSend] = useState(false);
  const [arrrRecipient, setArrrRecipient] = useState(EMPTY_STRING);
  const [arrrRecipientDisplayName, setArrrRecipientDisplayName] =
    useState(EMPTY_STRING);
  const recipientValidation = useArrrAddressValidation(
    arrrRecipient,
    openArrrSend
  );
  const addressFormatError =
    recipientValidation.status === 'invalid' ||
    recipientValidation.status === 'unavailable';
  const [loadingRefreshArrr, setLoadingRefreshArrr] = useState(false);
  const [openTxArrrSubmit, setOpenTxArrrSubmit] = useState(false);
  const [openSendArrrSuccess, setOpenSendArrrSuccess] = useState(false);
  const [openSendArrrError, setOpenSendArrrError] = useState(false);
  const [sendArrrError, setSendArrrError] = useState(EMPTY_STRING);
  const [openArrrAddressBook, setOpenArrrAddressBook] = useState(false);
  const [receivePanelOpen, setReceivePanelOpen] = useState(false);
  const [_retry, setRetry] = useState(false);

  // Safely-spendable max: integer-satoshi math plus a small safety buffer so
  // the prefilled amount never lands on/above the host's spendable cutoff.
  const maxSendableArrrCoin = () =>
    calculateMaxSendable(
      walletBalanceArrr,
      ARRR_FEE,
      SEND_MAX_SAFETY_BUFFER_SATS
    );
  const {
    amount: arrrAmount,
    setAmount: setArrrAmount,
    sendMax: handleSendMaxArrr,
  } = useSendAmount(maxSendableArrrCoin());

  const arrrSendLabelSx = {
    color: 'rgba(228,238,248,0.9)',
    fontSize: { xs: 14.5, sm: 15 },
    fontWeight: 700,
    lineHeight: 1.2,
  } as const;
  const arrrHelperSx = {
    color: 'text.secondary',
    fontSize: { xs: 12.5, sm: 13 },
    fontWeight: 500,
    lineHeight: 1.45,
    ml: 1.6,
    mt: 0.85,
  } as const;
  const arrrFieldSx = {
    '& .MuiFormHelperText-root': arrrHelperSx,
    '& .MuiOutlinedInput-root': {
      bgcolor: 'rgba(0,8,16,0.2)',
      borderRadius: 1.35,
      minHeight: { xs: 54, sm: 56 },
      px: { xs: 1.2, sm: 1.35 },
      transition: 'background-color 160ms ease',
      '& fieldset': {
        borderColor: 'rgba(116,158,180,0.16)',
      },
      '&:hover fieldset': {
        borderColor: 'rgba(116,158,180,0.3)',
      },
      '&.Mui-focused': {
        bgcolor: 'rgba(0,8,16,0.2)',
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
  const arrrSendInfoIconSx = {
    color: 'text.secondary',
    fontSize: { xs: 14.5, sm: 15 },
    opacity: 0.82,
  } as const;

  const handleCloseArrrLightwallet = () => {
    setOpenArrrLightwallet(false);
  };

  const handleCloseArrrServerChange = () => {
    setOpenArrrServerChange(false);
  };

  const handleOpenAddressBook = () => {
    setOpenArrrAddressBook(true);
  };

  const handleCloseAddressBook = () => {
    setOpenArrrAddressBook(false);
  };

  const handleSelectAddress = (address: string, name: string) => {
    setArrrRecipient(address);
    setArrrRecipientDisplayName(name || EMPTY_STRING);
    setArrrAmount(0);
    setOpenArrrAddressBook(false);
    setOpenArrrSend(true);
    setOpenSendArrrError(false);
  };

  const handleOpenArrrSend = () => {
    setArrrAmount(0);
    setArrrRecipient(EMPTY_STRING);
    setArrrRecipientDisplayName(EMPTY_STRING);
    setArrrMemo(EMPTY_STRING);
    setOpenArrrSend(true);
    setOpenSendArrrError(false);
  };

  const disableCanSendArrr = () =>
    arrrAmount <= 0 ||
    arrrRecipient === EMPTY_STRING ||
    recipientValidation.status !== 'valid' ||
    arrrAmount > maxSendableArrrCoin();

  const handleRecipientChange = (
    e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const value = e.target.value.trim();
    setArrrRecipient(value);
    setArrrRecipientDisplayName(EMPTY_STRING);
  };

  const handleCloseArrrSend = () => {
    setArrrAmount(0);
    setArrrRecipient(EMPTY_STRING);
    setArrrRecipientDisplayName(EMPTY_STRING);
    setArrrMemo(EMPTY_STRING);
    setOpenArrrSend(false);
    setOpenSendArrrError(false);
  };

  const handleClearArrrRecipient = () => {
    setArrrRecipient(EMPTY_STRING);
    setArrrRecipientDisplayName(EMPTY_STRING);
    setOpenSendArrrError(false);
  };

  const changeCopyArrrTxHash = async () => {
    setCopyArrrTxHash('Copied');
    await timeoutDelay(TIME_SECONDS_2);
    setCopyArrrTxHash(EMPTY_STRING);
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

  const handleCloseSendArrrSuccess = (
    _event?: SyntheticEvent | Event,
    reason?: SnackbarCloseReason
  ) => {
    if (reason === 'clickaway') {
      return;
    }
    setOpenSendArrrSuccess(false);
  };

  const handleCloseSendArrrError = (
    _event?: SyntheticEvent | Event,
    reason?: SnackbarCloseReason
  ) => {
    if (reason === 'clickaway') {
      return;
    }
    setOpenSendArrrError(false);
  };

  const sendArrrRequest = async () => {
    // Conservative revalidation: never submit more than the safely-spendable
    // max, even if state changed (e.g. balance refresh) after input.
    setSendArrrError(EMPTY_STRING);
    if (!Number.isFinite(arrrAmount) || arrrAmount <= 0) {
      setSendArrrError(t('core:message.error.amount_positive'));
      setOpenSendArrrError(true);
      return;
    }
    if (arrrAmount > maxSendableArrrCoin()) {
      setSendArrrError(
        t('core:message.error.amount_exceeds_balance', {
          maxAmount: maxSendableArrrCoin(),
        })
      );
      setOpenSendArrrError(true);
      return;
    }
    if (recipientValidation.status !== 'valid') {
      setSendArrrError(t('core:send.arrr_validation_unavailable'));
      setOpenSendArrrError(true);
      return;
    }
    setOpenTxArrrSubmit(true);
    try {
      // Recheck through the selected Core immediately before handing off the
      // payment. No wallet secrets are needed for address validation.
      let recipientValid: boolean;
      try {
        recipientValid = await validateArrrAddress(arrrRecipient);
      } catch {
        throw new Error(t('core:send.arrr_validation_unavailable'));
      }
      if (!recipientValid) throw new Error(t('core:send.arrr_address_invalid'));
      const sendRequest = await qortalRequest({
        action: 'SEND_COIN',
        coin: Coin.ARRR,
        recipient: arrrRecipient,
        amount: arrrAmount,
        memo: arrrMemo,
      });
      if (sendRequest?.error) throw sendRequest;
      if (sendRequest == null) throw new Error(t('core:send.arrr_send_failed'));
      setArrrAmount(0);
      setArrrRecipient(EMPTY_STRING);
      setArrrRecipientDisplayName(EMPTY_STRING);
      setArrrMemo(EMPTY_STRING);
      setOpenTxArrrSubmit(false);
      setOpenSendArrrSuccess(true);
      setIsLoadingWalletBalanceArrr(true);
      await timeoutDelay(TIME_SECONDS_3);
      getWalletBalanceArrr();
    } catch (error) {
      const message = walletErrorMessage(
        error,
        t('core:send.arrr_send_failed')
      );
      setSendArrrError(message);
      setOpenSendArrrError(true);
      console.error('ERROR SENDING ARRR', message);
    } finally {
      setOpenTxArrrSubmit(false);
    }
  };

  const getWalletInfoArrr = async () => {
    setIsLoadingWalletInfoArrr(true);
    try {
      const response = await qortalRequest({
        action: 'GET_USER_WALLET',
        coin: Coin.ARRR,
      });
      if (!response?.error) {
        setWalletInfoArrr(response);
      }
    } catch (error) {
      setWalletInfoArrr({});
      console.error('ERROR GET ARRR WALLET INFO', error);
    } finally {
      setIsLoadingWalletInfoArrr(false);
    }
  };

  const getWalletBalanceArrr = async () => {
    try {
      setIsLoadingWalletBalanceArrr(true);

      const response = await qortalRequestWithTimeout(
        {
          action: 'GET_WALLET_BALANCE',
          coin: Coin.ARRR,
        },
        TIME_MINUTES_2
      );
      if (!response?.error) {
        setWalletBalanceArrr(response);
      }
    } catch (error: any) {
      setWalletBalanceArrr(null);
      console.error('ERROR GET ARRR BALANCE', error);
    } finally {
      setIsLoadingWalletBalanceArrr(false);
    }
  };

  const getUpdatedWalletBalance = () => {
    const intervalGetWalletBalanceArrr = setInterval(() => {
      getWalletBalanceArrr();
    }, TIME_MINUTES_3);
    getWalletBalanceArrr();
    return () => {
      clearInterval(intervalGetWalletBalanceArrr);
    };
  };

  const getLightwalletServersArrr = async () => {
    try {
      const response = await qortalRequest({
        action: 'GET_CROSSCHAIN_SERVER_INFO',
        coin: Coin.ARRR,
      });
      if (!response?.error) {
        setAllLightwalletServersArrr(response);
        let currentArrrServer = response.filter(function (item: {
          isCurrent: boolean;
        }) {
          return item.isCurrent == true;
        });
        setCurrentLightwalletServerArrr(currentArrrServer);
      }
    } catch (error) {
      setAllLightwalletServersArrr({});
      console.error('ERROR GET ARRR SERVERS INFO', error);
    }
  };

  const getTransactionsArrr = async () => {
    try {
      setIsLoadingArrrTransactions(true);
      const requestTransactions = () =>
        qortalRequestWithTimeout(
          {
            action: 'GET_USER_WALLET_TRANSACTIONS',
            coin: Coin.ARRR,
          },
          TIME_MINUTES_5
        );
      const response =
        await requestArrrTransactionsWithRetry(requestTransactions);
      const compareFn = (
        a: { timestamp: number },
        b: { timestamp: number }
      ) => {
        return b.timestamp - a.timestamp;
      };
      const sortedArrrTransactions = response.sort(compareFn);
      setTransactionsArrr(sortedArrrTransactions);
      setIsLoadingArrrTransactions(false);

      if (hasUnresolvedArrrRecipients(response)) {
        // Render the usable history immediately. Native Core has already
        // cached every exact recipient it recovered, so this quiet follow-up
        // only spends time on txids that missed the first bounded pass.
        void (async () => {
          await timeoutDelay(ARRR_TRANSACTION_RETRY_DELAY_MS);
          try {
            const enrichedResponse = await requestTransactions();
            if (!enrichedResponse?.error && Array.isArray(enrichedResponse)) {
              setTransactionsArrr(enrichedResponse.sort(compareFn));
            }
          } catch (error) {
            console.info(
              'ARRR recipient enrichment will continue on the next refresh',
              error
            );
          }
        })();
      }
    } catch (error) {
      setIsLoadingArrrTransactions(false);
      setTransactionsArrr([]);
      console.error('ERROR GET ARRR TRANSACTIONS', error);
    }
  };

  const getArrrSyncStatus = async () => {
    try {
      let counter = 0;
      let counter2 = 0;
      while (!isSynced && counter < 36 && counter2 < 60) {
        const response = await qortalRequest({
          action: 'GET_ARRR_SYNC_STATUS',
        });
        if (!response?.error) {
          if (
            response.indexOf('<') > -1 ||
            response !== 'Synchronized' ||
            response === 'Not initialized yet'
          ) {
            if (response.indexOf('<') > -1) {
              setSyncStatus(
                t('core:message.error.pirate_chain_no_server', {
                  postProcess: 'capitalizeAll',
                })
              );
              setChangeServer(false);
              setIsSynced(false);
              counter = 37;
            } else if (response === 'Not initialized yet') {
              setChangeServer(false);
              setSyncStatus(
                t('core:message.generic.not_initialized_yet', {
                  postProcess: 'capitalizeAll',
                })
              );
              setIsSynced(false);
              counter += 1;
              await new Promise((resolve) =>
                setTimeout(resolve, TIME_SECONDS_5)
              );
            } else if (response === 'Initializing wallet...') {
              setChangeServer(false);
              setSyncStatus(
                t('core:message.generic.initializing_wallet', {
                  postProcess: 'capitalizeAll',
                })
              );
              setIsSynced(false);
              counter2 += 1;
              await new Promise((resolve) =>
                setTimeout(resolve, TIME_SECONDS_5)
              );
            } else {
              setChangeServer(false);
              setSyncStatus(response);
              setIsSynced(false);
              await new Promise((resolve) =>
                setTimeout(resolve, TIME_SECONDS_5)
              );
            }
          } else {
            setIsSynced(true);
            setSyncStatus(EMPTY_STRING);
            setChangeServer(false);
            getWalletInfoArrr();
            await new Promise((resolve) => setTimeout(resolve, TIME_SECONDS_3));
            getUpdatedWalletBalance();
            await new Promise((resolve) => setTimeout(resolve, TIME_SECONDS_3));
            getLightwalletServersArrr();
            await new Promise((resolve) => setTimeout(resolve, TIME_SECONDS_3));
            getTransactionsArrr();
            return;
          }
        }
      }
      setIsSynced(false);
      setSyncStatus(
        t('core:message.error.pirate_chain_no_server', {
          postProcess: 'capitalizeAll',
        })
      );
      setChangeServer(true);
      return;
    } catch (error) {
      setSyncStatus(String(error));
      setIsSynced(false);
      setRetry(true);
      console.error('ERROR GET ARRR SYNC STATUS', error);
    }
  };

  const handleOpenArrrServerChange = async () => {
    await getLightwalletServersArrr();
    setOpenArrrServerChange(true);
  };

  const handleRetry = async () => {
    setRetry(false);
    await getArrrSyncStatus();
  };

  const handleLoadingRefreshArrr = async () => {
    setLoadingRefreshArrr(true);
    await getTransactionsArrr();
    setLoadingRefreshArrr(false);
  };

  useEffect(() => {
    getArrrSyncStatus();
  }, []);

  if (isUsingGateway) {
    return (
      <Alert variant="filled" severity="error">
        {t('core:message.error.pirate_chain_gateway', {
          postProcess: 'capitalizeEachFirst',
        })}
      </Alert>
    );
  }

  const setNewCurrentArrrServer = async (
    typeServer: string,
    hostServer: string,
    portServer: number
  ) => {
    try {
      const setServer = await qortalRequest({
        action: 'SET_CURRENT_FOREIGN_SERVER',
        coin: Coin.ARRR,
        type: typeServer,
        host: hostServer,
        port: portServer,
      });
      if (!setServer?.error) {
        setOpenArrrLightwallet(false);
        await getLightwalletServersArrr();
        await getWalletBalanceArrr();
        await getTransactionsArrr();
      }
    } catch (error) {
      await getLightwalletServersArrr();
      setOpenArrrLightwallet(false);
      console.error('ERROR GET ARRR SERVERS INFO', error);
    }
  };

  const setNewArrrServer = async (
    typeServer: string,
    hostServer: string,
    portServer: number
  ) => {
    try {
      const setServer = await qortalRequest({
        action: 'SET_CURRENT_FOREIGN_SERVER',
        coin: Coin.ARRR,
        type: typeServer,
        host: hostServer,
        port: portServer,
      });
      if (!setServer?.error) {
        setOpenArrrServerChange(false);
        await getLightwalletServersArrr();
        await getArrrSyncStatus();
      }
    } catch (error) {
      setOpenArrrServerChange(false);
      await getLightwalletServersArrr();
      await getArrrSyncStatus();
      console.error('ERROR GET ARRR SERVERS INFO', error);
    }
  };

  const ArrrTableLoader = () => {
    return (
      <WalletTransactionsLoader
        label={t('core:message.generic.loading_transactions', {
          postProcess: 'capitalizeFirstChar',
        })}
      />
    );
  };

  const ArrrTransactionsTable = () => (
    <WalletExternalTransactionsList
      ActionsComponent={TablePaginationActions}
      coin="ARRR"
      copyHashLabel={copyArrrTxHash || undefined}
      labels={{
        copyHash: (hash) =>
          t('core:action.copy_hash', {
            hash,
            postProcess: 'capitalizeFirstChar',
          }),
        fee: t('core:fee.fee', {
          postProcess: 'capitalizeFirstChar',
        }),
        memo: t('core:memo', {
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
        changeCopyArrrTxHash();
      }}
      onPageChange={handleChangePage}
      onRowsPerPageChange={handleChangeRowsPerPage}
      page={page}
      rows={transactionsArrr}
      rowsPerPage={rowsPerPage}
      showMemo
    />
  );

  return (
    <Box sx={{ width: '100%', mt: 2 }}>
      <AddressBookDialog
        open={openArrrAddressBook}
        onClose={handleCloseAddressBook}
        coinType={Coin.ARRR}
        onSelectAddress={handleSelectAddress}
      />

      <LightwalletDialog
        onClose={handleCloseArrrLightwallet}
        aria-labelledby="arrr-electrum-servers"
        open={openArrrLightwallet}
        keepMounted={false}
      >
        <DialogTitle
          sx={{ m: 0, p: 2, fontSize: '14px' }}
          id="arrr-electrum-servers"
        >
          {t('core:message.generic.pirate_chain_servers', {
            postProcess: 'capitalizeFirstChar',
          })}
        </DialogTitle>
        <DialogContent dividers>
          <Box
            sx={{
              width: '100%',
              maxWidth: 500,
              position: 'relative',
              overflow: 'auto',
              maxHeight: 400,
            }}
          >
            <List>
              {allLightwalletServersArrr.map(
                (
                  server: {
                    connectionType: string;
                    hostName: string;
                    port: number;
                  },
                  i: Key
                ) => (
                  <ListItemButton
                    key={i}
                    onClick={() => {
                      setNewCurrentArrrServer(
                        server?.connectionType,
                        server?.hostName,
                        server?.port
                      );
                    }}
                  >
                    <ListItemText
                      primary={
                        server?.connectionType +
                        '://' +
                        server?.hostName +
                        ':' +
                        server?.port
                      }
                      key={i}
                    />
                  </ListItemButton>
                )
              )}
            </List>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button autoFocus onClick={handleCloseArrrLightwallet}>
            {t('core:action.close', {
              postProcess: 'capitalizeFirstChar',
            })}
          </Button>
        </DialogActions>
      </LightwalletDialog>

      <WalletSendDialog
        open={openArrrSend}
        onClose={handleCloseArrrSend}
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
          open={openTxArrrSubmit}
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
          open={openSendArrrSuccess}
          autoHideDuration={TIME_SECONDS_4}
          slots={{ transition: SlideTransition }}
          onClose={handleCloseSendArrrSuccess}
        >
          <Alert
            onClose={handleCloseSendArrrSuccess}
            severity="success"
            variant="filled"
            sx={{ width: '100%' }}
          >
            {t('core:message.generic.sent_transaction', {
              coin: Coin.ARRR,
              postProcess: 'capitalizeAll',
            })}
          </Alert>
        </Snackbar>
        <Snackbar open={openSendArrrError} onClose={handleCloseSendArrrError}>
          <Alert
            onClose={handleCloseSendArrrError}
            severity="error"
            variant="filled"
            sx={{ width: '100%', userSelect: 'text' }}
          >
            {sendArrrError || t('core:send.arrr_send_failed')}
          </Alert>
        </Snackbar>
        <ExternalSendForm
          addressError={addressFormatError}
          addressValidationPending={recipientValidation.status === 'pending'}
          addressHelperText={
            recipientValidation.status === 'unavailable'
              ? t('core:send.arrr_validation_unavailable')
              : recipientValidation.status === 'pending'
                ? t('core:send.arrr_validating')
                : t('core:send.arrr_address_invalid')
          }
          addressInputId="arrr-address"
          afterRecipientContent={
            <Box sx={{ display: 'grid', gap: 0.85 }}>
              <Typography sx={arrrSendLabelSx}>
                {t('core:send.memo')}
              </Typography>
              <TextField
                id="arrr-memo"
                value={arrrMemo}
                fullWidth
                placeholder={t('core:send.optional_memo')}
                slotProps={{
                  htmlInput: {
                    'aria-label': t('core:send.symbol_memo', {
                      symbol: 'ARRR',
                    }),
                    maxLength: 40,
                  },
                }}
                onChange={(
                  e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
                ) => setArrrMemo(e.target.value)}
                sx={arrrFieldSx}
              />
            </Box>
          }
          amount={arrrAmount}
          balance={walletBalanceArrr}
          balanceError={null}
          coinLogo={coinLogoARRR}
          feeContent={
            <Tooltip title={t('core:send.current_network_fee_tooltip')}>
              <Box
                sx={{
                  alignItems: 'center',
                  color: 'text.secondary',
                  display: 'grid',
                  gap: 0.75,
                  gridTemplateColumns: 'auto auto minmax(80px, auto)',
                  justifySelf: 'end',
                  mt: -0.3,
                  opacity: 0.78,
                  px: 0.4,
                }}
              >
                <InfoOutlined sx={arrrSendInfoIconSx} />
                <Typography
                  sx={{
                    fontSize: { xs: 12.5, sm: 13 },
                    fontWeight: 500,
                  }}
                >
                  {t('core:send.network_fee')}
                </Typography>
                <Typography
                  sx={{
                    color: 'text.primary',
                    fontSize: { xs: 14, sm: 14.5 },
                    fontWeight: 700,
                    textAlign: 'right',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {ARRR_FEE} ARRR
                </Typography>
              </Box>
            </Tooltip>
          }
          isBalanceLoading={isLoadingWalletBalanceArrr}
          maxSendable={maxSendableArrrCoin()}
          onAmountChange={setArrrAmount}
          onClearRecipient={handleClearArrrRecipient}
          onClose={handleCloseArrrSend}
          onOpenAddressBook={handleOpenAddressBook}
          onRecipientChange={handleRecipientChange}
          onSend={sendArrrRequest}
          onSendMax={handleSendMaxArrr}
          recipient={arrrRecipient}
          recipientDisplayName={arrrRecipientDisplayName}
          recipientSubtitle={t('core:address_book_ui.symbol_contact', {
            symbol: 'ARRR',
          })}
          sendDisabled={disableCanSendArrr()}
          showAddressBookButton
          symbol="ARRR"
        />
      </WalletSendDialog>

      <LightwalletDialog
        onClose={handleCloseArrrServerChange}
        aria-labelledby="arrr-electrum-servers"
        open={openArrrServerChange}
        keepMounted={false}
      >
        <DialogTitle
          sx={{ m: 0, p: 2, fontSize: '14px' }}
          id="arrr-electrum-servers"
        >
          {t('core:message.generic.pirate_chain_servers', {
            postProcess: 'capitalizeFirstChar',
          })}
        </DialogTitle>
        <DialogContent dividers>
          <Box
            sx={{
              width: '100%',
              maxWidth: 500,
              position: 'relative',
              overflow: 'auto',
              maxHeight: 400,
            }}
          >
            <List>
              {allLightwalletServersArrr.map(
                (
                  server: {
                    connectionType: string;
                    hostName: string;
                    port: number;
                  },
                  i: Key
                ) => (
                  <ListItemButton
                    key={i}
                    onClick={() => {
                      setNewArrrServer(
                        server?.connectionType,
                        server?.hostName,
                        server?.port
                      );
                    }}
                  >
                    <ListItemText
                      primary={
                        server?.connectionType +
                        '://' +
                        server?.hostName +
                        ':' +
                        server?.port
                      }
                      key={i}
                    />
                  </ListItemButton>
                )
              )}
            </List>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button autoFocus onClick={handleCloseArrrServerChange}>
            {t('core:action.close', {
              postProcess: 'capitalizeFirstChar',
            })}
          </Button>
        </DialogActions>
      </LightwalletDialog>

      <WalletWorkspace
        address={walletInfoArrr?.address ?? EMPTY_STRING}
        addressBookRefreshKey={openArrrAddressBook}
        balance={walletBalanceArrr}
        balanceDecimals={8}
        coin="ARRR"
        isBalanceLoading={isLoadingWalletBalanceArrr}
        onAddContact={handleOpenAddressBook}
        onSelectAddress={handleSelectAddress}
        onSend={handleOpenArrrSend}
        onToggleReceive={() => setReceivePanelOpen((prev) => !prev)}
        receiveOpen={receivePanelOpen}
        rightColumnAfter={
          <WalletCard sx={{ overflow: 'hidden', width: '100%' }}>
            <Box sx={{ display: 'grid', gap: 1.5, p: { xs: 2, md: 2.25 } }}>
              <Typography sx={{ fontWeight: 600 }}>
                Lightwallet server
              </Typography>
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  Current server
                </Typography>
                <Typography
                  sx={{
                    fontWeight: 600,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {currentLightwalletServerArrr[0]?.hostName ? (
                    currentLightwalletServerArrr[0]?.hostName +
                    ':' +
                    currentLightwalletServerArrr[0]?.port
                  ) : (
                    <LinearProgress />
                  )}
                </Typography>
              </Box>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                {syncStatus}
              </Typography>
              <Button
                fullWidth
                onClick={handleOpenArrrServerChange}
                variant="outlined"
              >
                Change server
              </Button>
              {!isSynced && !isLoadingWalletBalanceArrr && (
                <Button fullWidth onClick={handleRetry} variant="contained">
                  Retry
                </Button>
              )}
            </Box>
          </WalletCard>
        }
        transactions={
          <WalletTransactionsCard
            isRefreshing={loadingRefreshArrr}
            onRefresh={handleLoadingRefreshArrr}
          >
            {isLoadingArrrTransactions || loadingRefreshArrr ? (
              ArrrTableLoader()
            ) : (
              <Box sx={{ width: '100%' }}>{ArrrTransactionsTable()}</Box>
            )}
          </WalletTransactionsCard>
        }
      />
    </Box>
  );
}
