import { useSendAmount } from '../../hooks/useSendAmount';
import {
  CheckCircleOutline,
  Close,
  ExpandMore,
  FirstPage,
  HistoryToggleOff,
  InfoOutlined,
  KeyboardArrowLeft,
  KeyboardArrowRight,
  LastPage,
  LockOutlined,
  NorthEast,
  PersonOutline,
  ShieldOutlined,
} from '@mui/icons-material';
import {
  Alert,
  AppBar,
  Avatar,
  Box,
  Button,
  Checkbox,
  ClickAwayListener,
  DialogContent,
  IconButton,
  InputAdornment,
  Menu,
  MenuItem,
  Paper,
  Table,
  TableBody,
  TableContainer,
  TableFooter,
  TableHead,
  TablePagination,
  TableRow,
  TextField,
  Toolbar,
  Tooltip,
  Typography,
} from '@mui/material';
import CircularProgress from '@mui/material/CircularProgress';
import Snackbar from '@mui/material/Snackbar';
type SnackbarCloseReason = 'timeout' | 'clickaway' | 'escapeKeyDown';
import { useTheme, type Theme } from '@mui/material/styles';
import TableCell from '@mui/material/TableCell';
import { useAtom } from 'jotai';
import { Coin, RequestQueueWithPromise, useGlobal } from 'qapp-core';
import {
  ChangeEvent,
  Key,
  MouseEvent,
  ReactNode,
  SyntheticEvent,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { NumericFormat as _NumericFormat } from 'react-number-format';
const NumericFormat = _NumericFormat as React.FC<
  React.ComponentProps<typeof _NumericFormat> & Record<string, unknown>
>;
import coinLogoQORT from '../../assets/qort.png';
import {
  EMPTY_STRING,
  QORT_1_UNIT,
  TIME_MINUTES_1,
  TIME_SECONDS_3,
  TIME_SECONDS_4,
} from '../../common/constants';
import {
  cropString,
  epochToAgo,
  humanFileSize,
  timeoutDelay,
} from '../../common/functions';
import WalletContext from '../../contexts/walletContext';
import { qortTransactionFiltersAtom } from '../../state/global/qort';
import {
  CustomWidthTooltip,
  SlideTransition,
  StyledTableCell,
  StyledTableRow,
  SubmitDialog,
  Transition,
  WalletSendDialog,
} from '../../styles/page-styles';
import { calculateMaxSendable } from '../../utils/maxSendable';
import { AddressBookDialog } from '../../components/AddressBook/AddressBookDialog';
import { NameText } from '../../components/NameText';
import {
  WalletSyncCard,
  WalletTransactionsCard,
  WalletTransactionsLoader,
  WalletWorkspace,
} from '../../components/WalletWorkspace';
import {
  AddressBookEntry,
  SearchTransactionsResponse,
} from '../../utils/Types';
import {
  ADDRESS_BOOK_STORAGE_EVENT,
  createAddressBookSyncSignature,
  getAddressBook,
  getAddressBookSyncBaselineKey,
  getAddressBookSyncRequiredKey,
  saveAddressBookSnapshot,
} from '../../utils/addressBookStorage';
import { publishToQDN } from '../../utils/addressBookQDN';
import {
  getAddressBookAvatarColor,
  getAddressBookAvatarSx,
} from '../../components/AddressBook/avatarPalette';
import {
  searchQortalNames,
  type QortalNameSearchResult,
} from '../../utils/qortalNodeApi';
import { hasInvisibleCharacters } from '../../utils/invisibleCharacters';

interface TablePaginationActionsProps {
  count: number;
  page: number;
  rowsPerPage: number;
  onPageChange: (event: MouseEvent<HTMLButtonElement>, newPage: number) => void;
}

type QortAddressBookSyncStatus = 'idle' | 'success' | 'dirty' | 'error';

const QORT_ADDRESS_PATTERN = /^Q[1-9A-HJ-NP-Za-km-z]{33}$/;
const QORT_BALANCE_REFRESH_INTERVAL_MS = 2.5 * TIME_MINUTES_1;

const addressToPrimaryName: any = {};
const requestQueueGetPrimaryName = new RequestQueueWithPromise(10);

const getPrimaryAccountName = async (address: string) => {
  if (addressToPrimaryName[address]) return addressToPrimaryName[address];
  try {
    const primaryName = await requestQueueGetPrimaryName.enqueue(() =>
      qortalRequest({ action: 'GET_PRIMARY_NAME', address })
    );
    if (primaryName) addressToPrimaryName[address] = primaryName;
    return primaryName ?? EMPTY_STRING;
  } catch (e) {
    console.log(e);
  }
  return EMPTY_STRING;
};

const replaceAddressesWithNames = async (
  data: SearchTransactionsResponse[]
) => {
  if (!data || data.length === 0) return;
  const addressToNames: { address: string; name?: string }[] = [];
  const namePromises: Promise<string>[] = [];

  const addAddressIfNotInArray = (address: string) => {
    const isAddressInArray = addressToNames.find(
      (arrayAddress) => arrayAddress.address === address
    );

    if (!isAddressInArray && address) {
      addressToNames.push({ address });
      namePromises.push(getPrimaryAccountName(address));
    }
  };

  data.map((d) => {
    addAddressIfNotInArray(d.creatorAddress);
    addAddressIfNotInArray(d.recipient);
  });

  const accountNames = await Promise.all(namePromises);
  addressToNames.map((value, index) => (value.name = accountNames[index]));

  const findName = (address: string) => {
    const data = addressToNames.find((d) => d.address === address);
    return data?.name || data?.address;
  };

  return data.map((d) => {
    const creatorAddress = findName(d.creatorAddress);
    const recipient = findName(d.recipient);
    return {
      ...d,
      creatorAddress,
      creatorAddressOriginal: d.creatorAddress,
      recipient,
      recipientOriginal: d.recipient,
    } as SearchTransactionsResponse;
  });
};

const saveQortAddressBookSyncBaseline = (entries: AddressBookEntry[]) => {
  localStorage.setItem(
    getAddressBookSyncBaselineKey(Coin.QORT),
    createAddressBookSyncSignature(entries)
  );
};

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

export default function QortalWallet() {
  const ADDRESS_MIN_LENGTH = 3;
  const ADDRESS_LOOKUP_DEBOUNCE_MS = 350;

  const { t } = useTranslation(['core']);
  const theme = useTheme();

  const { address, nodeInfo } = useContext(WalletContext);
  const [walletBalanceQort, setWalletBalanceQort] = useState<any>(0);
  const [isLoadingWalletBalanceQort, setIsLoadingWalletBalanceQort] =
    useState<boolean>(true);
  const [paymentInfo, setPaymentInfo] = useState<any>([]);
  const [qortTxFee, setQortTxFee] = useState<number>(0.01);
  const [arbitraryInfo, setArbitraryInfo] = useState<any>([]);
  const [atInfo, setAtInfo] = useState<any>([]);
  const [groupInfo, setGroupInfo] = useState<any>([]);
  const [nameInfo, setNameInfo] = useState<any>([]);
  const [assetInfo, setAssetInfo] = useState<any>([]);
  const [pollInfo, setPollInfo] = useState<any>([]);
  const [rewardshareInfo, setRewardshareInfo] = useState<any>([]);
  const [allInfo, setAllInfo] = useState<any>([]);
  const [selectedTransactionFilters, setSelectedTransactionFilters] = useAtom(
    qortTransactionFiltersAtom
  );
  const [advancedFilterAnchor, setAdvancedFilterAnchor] =
    useState<null | HTMLElement>(null);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [openQortAddressBook, setOpenQortAddressBook] = useState(false);
  const [receivePanelOpen, setReceivePanelOpen] = useState(false);
  const [qortAddressBookEntries, setQortAddressBookEntries] = useState<
    AddressBookEntry[]
  >([]);
  const [qortAddressBookSyncing, setQortAddressBookSyncing] = useState(false);
  const [qortAddressBookSyncStatus, setQortAddressBookSyncStatus] =
    useState<QortAddressBookSyncStatus>('idle');
  const [qortAddressBookLastSync, setQortAddressBookLastSync] = useState<
    number | null
  >(null);
  const [addressBookPrefill, setAddressBookPrefill] = useState<{
    name: string;
    address: string;
  } | null>(null);
  const [loadingRefreshQort, setLoadingRefreshQort] = useState(false);
  const [openQortSend, setOpenQortSend] = useState(false);
  const [openTxQortSubmit, setOpenTxQortSubmit] = useState(false);
  const [openSendQortSuccess, setOpenSendQortSuccess] = useState(false);
  const [openSendQortError, setOpenSendQortError] = useState(false);
  const [qortRecipient, setQortRecipient] = useState<string>(EMPTY_STRING);
  const [qortRecipientDisplayName, setQortRecipientDisplayName] =
    useState<string>(EMPTY_STRING);
  const [sendDisabled, setSendDisabled] = useState<boolean>(true);
  const [amountError, setAmountError] = useState<string | null>(null);
  const [recipientError, setRecipientError] = useState<string | null>(null);
  const [addressValidating, setAddressValidating] = useState(false);
  const [qortNameSearchOpen, setQortNameSearchOpen] = useState(false);
  const [qortNameSuggestions, setQortNameSuggestions] = useState<
    QortalNameSearchResult[]
  >([]);
  const [amountTouched, setAmountTouched] = useState(false);
  const [recipientTouched, setRecipientTouched] = useState(false);
  const userName = useGlobal().auth.name;

  const toFiniteNumber = (value: unknown) => {
    const parsed =
      typeof value === 'number' ? value : Number.parseFloat(String(value ?? 0));
    return Number.isFinite(parsed) ? parsed : 0;
  };

  const formatDecimal = (
    value: unknown,
    minimumFractionDigits = 2,
    maximumFractionDigits = 2
  ) => {
    return toFiniteNumber(value).toLocaleString(undefined, {
      minimumFractionDigits,
      maximumFractionDigits,
    });
  };

  const formatQortAmount = (value: unknown) => formatDecimal(value, 2, 2);
  const formatQortFee = (value: unknown) => formatDecimal(value, 2, 4);

  // Safely-spendable max via integer-satoshi math (avoids the floating-point
  // boundary error). QORT has a deterministic on-chain fee and an account
  // model, so no extra safety buffer is needed.
  const maxSendableQortCoin = () =>
    calculateMaxSendable(walletBalanceQort, qortTxFee);
  const {
    amount: qortAmount,
    setAmount: setQortAmount,
    sendMax: handleSendMaxQort,
  } = useSendAmount(maxSendableQortCoin());

  const emptyRowsPayment =
    page > 0
      ? Math.max(0, (1 + page) * rowsPerPage - paymentInfo?.length || 0)
      : 0;
  const emptyRowsArbitrary =
    page > 0
      ? Math.max(0, (1 + page) * rowsPerPage - arbitraryInfo?.length || 0)
      : 0;
  const emptyRowsAt =
    page > 0 ? Math.max(0, (1 + page) * rowsPerPage - atInfo?.length || 0) : 0;
  const emptyRowsGroup =
    page > 0
      ? Math.max(0, (1 + page) * rowsPerPage - groupInfo?.length || 0)
      : 0;
  const emptyRowsName =
    page > 0
      ? Math.max(0, (1 + page) * rowsPerPage - nameInfo?.length || 0)
      : 0;
  const emptyRowsAsset =
    page > 0
      ? Math.max(0, (1 + page) * rowsPerPage - assetInfo?.length || 0)
      : 0;
  const emptyRowsPoll =
    page > 0
      ? Math.max(0, (1 + page) * rowsPerPage - pollInfo?.length || 0)
      : 0;
  const emptyRowsRewardshare =
    page > 0
      ? Math.max(0, (1 + page) * rowsPerPage - rewardshareInfo?.length || 0)
      : 0;
  const emptyRowsAll =
    page > 0 ? Math.max(0, (1 + page) * rowsPerPage - allInfo?.length || 0) : 0;

  const handleOpenAddressBook = () => {
    setOpenQortAddressBook(true);
  };

  const loadQortAddressBookEntries = useCallback(() => {
    const entries = getAddressBook(Coin.QORT);
    setQortAddressBookEntries(entries);
    return entries;
  }, []);

  const refreshQortAddressBookSyncState = useCallback(
    (entries: AddressBookEntry[]) => {
      const cleanBaseline = localStorage.getItem(
        getAddressBookSyncBaselineKey(Coin.QORT)
      );

      if (
        cleanBaseline &&
        createAddressBookSyncSignature(entries) === cleanBaseline
      ) {
        localStorage.removeItem(getAddressBookSyncRequiredKey(Coin.QORT));
        setQortAddressBookSyncStatus('success');
        return;
      }

      localStorage.setItem(getAddressBookSyncRequiredKey(Coin.QORT), 'true');
      setQortAddressBookSyncStatus('dirty');
    },
    []
  );

  const handleToggleReceivePanel = () => {
    setReceivePanelOpen((prev) => !prev);
  };

  const handleOpenAddressBookWithData = (
    name: string,
    addressValue: string
  ) => {
    setAddressBookPrefill({ name, address: addressValue });
    setOpenQortAddressBook(true);
  };

  const handleCloseAddressBook = () => {
    setOpenQortAddressBook(false);
    setAddressBookPrefill(null);
    loadQortAddressBookEntries();
  };

  const handleQortAddressBookChange = useCallback(() => {
    const entries = loadQortAddressBookEntries();
    refreshQortAddressBookSyncState(entries);
  }, [loadQortAddressBookEntries, refreshQortAddressBookSyncState]);

  const refreshQortAddressBookFromStorage = useCallback(() => {
    const entries = loadQortAddressBookEntries();
    if (
      localStorage.getItem(getAddressBookSyncRequiredKey(Coin.QORT)) === 'true'
    ) {
      refreshQortAddressBookSyncState(entries);
      return;
    }

    saveQortAddressBookSyncBaseline(entries);
    setQortAddressBookSyncStatus('success');
  }, [loadQortAddressBookEntries, refreshQortAddressBookSyncState]);

  const handleSyncQortAddressBook = async () => {
    const hadRequiredSync =
      qortAddressBookSyncStatus === 'dirty' ||
      localStorage.getItem(getAddressBookSyncRequiredKey(Coin.QORT)) === 'true';

    setQortAddressBookSyncing(true);
    try {
      const entries = getAddressBook(Coin.QORT);
      const publishedAt = await publishToQDN(
        Coin.QORT,
        entries,
        userName || undefined
      );
      if (publishedAt) {
        saveAddressBookSnapshot(Coin.QORT, entries, publishedAt);
        saveQortAddressBookSyncBaseline(entries);
        localStorage.removeItem(getAddressBookSyncRequiredKey(Coin.QORT));
        setQortAddressBookLastSync(publishedAt);
        setQortAddressBookSyncStatus('success');
      } else {
        setQortAddressBookSyncStatus(hadRequiredSync ? 'dirty' : 'error');
      }
    } catch (error) {
      console.error('Failed to sync QORT address book:', error);
      setQortAddressBookSyncStatus(hadRequiredSync ? 'dirty' : 'error');
    } finally {
      setQortAddressBookSyncing(false);
      loadQortAddressBookEntries();
    }
  };

  useEffect(() => {
    refreshQortAddressBookFromStorage();
  }, [address, openQortAddressBook, refreshQortAddressBookFromStorage]);

  useEffect(() => {
    const handleAddressBookStorage = () => {
      refreshQortAddressBookFromStorage();
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
  }, [refreshQortAddressBookFromStorage]);

  const handleSelectAddress = (address: string, name: string) => {
    setQortRecipient(address);
    setQortRecipientDisplayName(name || EMPTY_STRING);
    setOpenQortAddressBook(false);
    setOpenQortSend(true);
    setRecipientError(null);
    setQortNameSearchOpen(false);
    setQortNameSuggestions([]);
    setRecipientTouched(true); // Trigger validation for QORT addresses
  };

  const handleSelectQortNameSuggestion = (
    suggestion: QortalNameSearchResult
  ) => {
    if (
      hasInvisibleCharacters(suggestion.name) ||
      !QORT_ADDRESS_PATTERN.test(suggestion.owner)
    ) {
      setRecipientError(t('core:message.error.invisible_qortal_name'));
      setQortNameSearchOpen(false);
      return;
    }

    setQortRecipient(suggestion.owner);
    setQortRecipientDisplayName(suggestion.name);
    setRecipientError(null);
    setRecipientTouched(true);
    setAddressValidating(false);
    setQortNameSearchOpen(false);
    setQortNameSuggestions([]);
  };

  const handleClearQortRecipient = () => {
    setQortRecipient(EMPTY_STRING);
    setQortRecipientDisplayName(EMPTY_STRING);
    setRecipientError(null);
    setQortNameSearchOpen(false);
    setQortNameSuggestions([]);
    setRecipientTouched(false);
  };

  const openUserLookup = async (addressOrName: string) => {
    const value = addressOrName?.trim();
    if (!value || value === '-') return;

    qortalRequest({
      action: 'OPEN_USER_LOOKUP',
      user: value,
    }).catch((error) => console.error(error));
  };

  const handleTransactionFiltersChange = (newValues: string[]) => {
    setSelectedTransactionFilters(newValues);
    setPage(0);
  };

  const handleAdvancedFilterClick = (event: MouseEvent<HTMLElement>) => {
    setAdvancedFilterAnchor(event.currentTarget);
  };

  const handleAdvancedFilterClose = () => {
    setAdvancedFilterAnchor(null);
  };

  const handleAdvancedFilterSelect = (newValue: string) => {
    const nonAllFilterValues = [
      'payments',
      'rewards',
      'arbitrary',
      'at',
      'group',
      'name',
      'asset',
      'poll',
    ];

    if (newValue === 'all') {
      const allFiltersAreActive =
        selectedTransactionFilters.includes('all') ||
        nonAllFilterValues.every((filterValue) =>
          selectedTransactionFilters.includes(filterValue)
        );
      handleTransactionFiltersChange(allFiltersAreActive ? [] : ['all']);
      return;
    }

    const activeValues = selectedTransactionFilters.includes('all')
      ? nonAllFilterValues
      : selectedTransactionFilters;
    const nextValues = activeValues.includes(newValue)
      ? activeValues.filter((filterValue) => filterValue !== newValue)
      : [...activeValues, newValue];

    handleTransactionFiltersChange(
      nextValues.length === nonAllFilterValues.length ? ['all'] : nextValues
    );
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

  const handleOpenQortSend = () => {
    setQortAmount(0);
    setQortRecipient(EMPTY_STRING);
    setQortRecipientDisplayName(EMPTY_STRING);
    setOpenQortSend(true);
    setAmountError(null);
    setAmountTouched(false);
    setRecipientError(null);
    setQortNameSearchOpen(false);
    setQortNameSuggestions([]);
    setRecipientTouched(false);
  };

  const handleCloseQortSend = () => {
    setQortAmount(0);
    setQortRecipient(EMPTY_STRING);
    setQortRecipientDisplayName(EMPTY_STRING);
    setOpenQortSend(false);
    setAmountError(null);
    setAmountTouched(false);
    setRecipientError(null);
    setQortNameSearchOpen(false);
    setQortNameSuggestions([]);
    setRecipientTouched(false);
  };

  const handleCloseSendQortSuccess = (
    _event?: SyntheticEvent | Event,
    reason?: SnackbarCloseReason
  ) => {
    if (reason === 'clickaway') {
      return;
    }
    setOpenSendQortSuccess(false);
  };

  const handleCloseSendQortError = (
    _event?: SyntheticEvent | Event,
    reason?: SnackbarCloseReason
  ) => {
    if (reason === 'clickaway') {
      return;
    }
    setOpenSendQortError(false);
  };

  // core validation (synchronous checks)
  const validateAmountLocal = useCallback(
    (amount?: number) => {
      const a =
        typeof amount === 'number' && Number.isFinite(amount) ? amount : 0;
      if (a <= 0) {
        setAmountError(
          t('core:message.error.amount_positive', {
            postProcess: 'capitalizeFirstChar',
          })
        );
        return false;
      }
      if (a > maxSendableQortCoin()) {
        setAmountError(
          t('core:message.error.amount_exceeds_balance', {
            maxAmount: maxSendableQortCoin(),
            postProcess: 'capitalizeFirstChar',
          })
        );
        return false;
      }
      setAmountError(null);
      return true;
    },
    [walletBalanceQort, qortTxFee, t]
  );

  // QORT recipient validation plus debounced name search.
  useEffect(() => {
    const recipientValue = qortRecipient.trim();

    // Early exit: if recipient not touched, no validation needed
    if (!recipientTouched) {
      setRecipientError(null);
      setAddressValidating(false);
      setQortNameSearchOpen(false);
      setQortNameSuggestions([]);
      return;
    }

    // Synchronous validations
    if (recipientValue === EMPTY_STRING) {
      setRecipientError(t('core:message.error.recipient_required'));
      setAddressValidating(false);
      setQortNameSearchOpen(false);
      setQortNameSuggestions([]);
      return;
    }

    if (recipientValue.length < ADDRESS_MIN_LENGTH) {
      setRecipientError(t('core:message.error.recipient_too_short'));
      setAddressValidating(false);
      setQortNameSearchOpen(false);
      setQortNameSuggestions([]);
      return;
    }

    if (
      hasInvisibleCharacters(recipientValue) ||
      hasInvisibleCharacters(qortRecipientDisplayName)
    ) {
      setRecipientError(t('core:message.error.invisible_qortal_name'));
      setAddressValidating(false);
      setQortNameSearchOpen(false);
      setQortNameSuggestions([]);
      return;
    }

    if (QORT_ADDRESS_PATTERN.test(recipientValue)) {
      setRecipientError(null);
      setAddressValidating(false);
      setQortNameSearchOpen(false);
      setQortNameSuggestions([]);
      return;
    }

    // Search registered names, but let the user choose the intended recipient.
    setAddressValidating(true);
    setRecipientError(null);
    setQortNameSearchOpen(false);

    const controller = new AbortController();
    const timeout = setTimeout(async () => {
      try {
        const results = await searchQortalNames(
          recipientValue,
          10,
          controller.signal
        );
        const safeResults = results.filter(
          (result) =>
            !hasInvisibleCharacters(result.name) &&
            QORT_ADDRESS_PATTERN.test(result.owner)
        );

        setQortNameSuggestions(safeResults);
        setQortNameSearchOpen(safeResults.length > 0);
        setRecipientError(
          safeResults.length === 0
            ? t('core:message.error.recipient_not_found')
            : null
        );
      } catch (err: any) {
        if (err.name === 'AbortError') return;
        console.error('Recipient lookup failed:', err.message);
        setQortNameSuggestions([]);
        setQortNameSearchOpen(false);
        setRecipientError(t('core:message.error.recipient_lookup_failed'));
      } finally {
        setAddressValidating(false);
      }
    }, ADDRESS_LOOKUP_DEBOUNCE_MS);

    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [qortRecipient, qortRecipientDisplayName, recipientTouched, t]);

  // Consolidated send button enablement - derived from all validation states
  useEffect(() => {
    const amountValid = validateAmountLocal(qortAmount);
    const recipientValue = qortRecipient.trim();
    const recipientLocallyValid =
      !!recipientValue && recipientValue.length >= ADDRESS_MIN_LENGTH;
    const recipientNameSafe =
      !hasInvisibleCharacters(qortRecipient) &&
      !hasInvisibleCharacters(qortRecipientDisplayName);
    const recipientAddressValid = QORT_ADDRESS_PATTERN.test(recipientValue);
    const addressFound =
      !addressValidating &&
      recipientError === null &&
      recipientTouched &&
      recipientLocallyValid &&
      recipientAddressValid;

    const finalEnabled =
      amountValid && recipientLocallyValid && recipientNameSafe && addressFound;
    setSendDisabled(!finalEnabled);
  }, [
    qortAmount,
    qortRecipient,
    qortRecipientDisplayName,
    addressValidating,
    recipientError,
    recipientTouched,
    validateAmountLocal,
  ]);

  // input handlers
  const onAmountChange = (
    values: { floatValue?: number },
    sourceInfo: { source: string }
  ) => {
    if (sourceInfo.source !== 'event') return;
    const next = values.floatValue ?? 0;
    setQortAmount(next);
    // quick local validation
    validateAmountLocal(next);
  };

  const onAmountBlur = () => setAmountTouched(true);
  const onRecipientBlur = () => setRecipientTouched(true);

  const getQortalTransactions = useCallback(
    async (signal?: AbortSignal) => {
      setLoadingRefreshQort(true);

      const arbitraryLink = `/transactions/search?txType=ARBITRARY&address=${address}&confirmationStatus=CONFIRMED&limit=0&reverse=true`;
      const assetLink = `/transactions/search?txType=CANCEL_ASSET_ORDER&txType=CREATE_ASSET_ORDER&txType=ISSUE_ASSET&txType=TRANSFER_ASSET&txType=UPDATE_ASSET&address=${address}&confirmationStatus=CONFIRMED&limit=0&reverse=true`;
      const atLink = `/transactions/search?txType=AT&txType=DEPLOY_AT&txType=MESSAGE&address=${address}&confirmationStatus=CONFIRMED&limit=0&reverse=true`;
      const groupLink = `/transactions/search?txType=CREATE_GROUP&txType=UPDATE_GROUP&txType=ADD_GROUP_ADMIN&txType=REMOVE_GROUP_ADMIN&txType=GROUP_BAN&txType=CANCEL_GROUP_BAN&txType=GROUP_KICK&txType=GROUP_INVITE&txType=CANCEL_GROUP_INVITE&txType=JOIN_GROUP&txType=LEAVE_GROUP&txType=GROUP_APPROVAL&txType=SET_GROUP&address=${address}&confirmationStatus=CONFIRMED&limit=0&reverse=true`;
      const nameLink = `/transactions/search?txType=REGISTER_NAME&txType=UPDATE_NAME&txType=SELL_NAME&txType=CANCEL_SELL_NAME&txType=BUY_NAME&address=${address}&confirmationStatus=CONFIRMED&limit=0&reverse=true`;
      const paymentLink = `/transactions/search?txType=PAYMENT&address=${address}&confirmationStatus=CONFIRMED&limit=0&reverse=true`;
      const pendingArbitraryLink = `/transactions/unconfirmed?txType=ARBITRARY&creator=${address}&limit=0&reverse=true`;
      const pendingAssetLink = `/transactions/unconfirmed?txType=CANCEL_ASSET_ORDER&txType=CREATE_ASSET_ORDER&txType=ISSUE_ASSET&txType=TRANSFER_ASSET&txType=UPDATE_ASSET&creator=${address}&limit=0&reverse=true`;
      const pendingAtLink = `/transactions/unconfirmed?txType=AT&txType=DEPLOY_AT&txType=MESSAGE&creator=${address}&limit=0&reverse=true`;
      const pendingGroupLink = `/transactions/unconfirmed?txType=CREATE_GROUP&txType=UPDATE_GROUP&txType=ADD_GROUP_ADMIN&txType=REMOVE_GROUP_ADMIN&txType=GROUP_BAN&txType=CANCEL_GROUP_BAN&txType=GROUP_KICK&txType=GROUP_INVITE&txType=CANCEL_GROUP_INVITE&txType=JOIN_GROUP&txType=LEAVE_GROUP&txType=GROUP_APPROVAL&txType=SET_GROUP&creator=${address}&limit=0&reverse=true`;
      const pendingNameLink = `/transactions/unconfirmed?txType=REGISTER_NAME&txType=UPDATE_NAME&txType=SELL_NAME&txType=CANCEL_SELL_NAME&txType=BUY_NAME&creator=${address}&limit=0&reverse=true`;
      const pendingPaymentLink = `/transactions/unconfirmed?txType=PAYMENT&creator=${address}&limit=0&reverse=true`;
      const pendingPollLink = `/transactions/unconfirmed?txType=CREATE_POLL&txType=VOTE_ON_POLL&creator=${address}&limit=0&reverse=true`;
      const pendingRewardshareLink = `/transactions/unconfirmed?txType=REWARD_SHARE&txType=TRANSFER_PRIVS&txType=PRESENCE&creator=${address}&limit=0&reverse=true`;
      const pollLink = `/transactions/search?txType=CREATE_POLL&txType=VOTE_ON_POLL&address=${address}&confirmationStatus=CONFIRMED&limit=0&reverse=true`;
      const rewardshareLink = `/transactions/search?txType=REWARD_SHARE&txType=TRANSFER_PRIVS&txType=PRESENCE&address=${address}&confirmationStatus=CONFIRMED&limit=0&reverse=true`;

      const compareFn = (
        a: { timestamp: number },
        b: { timestamp: number }
      ) => {
        return b.timestamp - a.timestamp;
      };

      const toArray = (value: unknown) =>
        Array.isArray(value) ? value : ([] as any[]);

      const fetchPayment = async () => {
        const paymentResponse = await fetch(paymentLink, { signal });
        const pendingPaymentResponse = await fetch(pendingPaymentLink, {
          signal,
        });
        const paymentResult = await paymentResponse.json();
        const pendingPaymentResult = await pendingPaymentResponse.json();
        const allPayment = [
          ...toArray(paymentResult),
          ...toArray(pendingPaymentResult),
        ];
        const allPaymentSorted = (await replaceAddressesWithNames(
          allPayment.sort(compareFn)
        )) as any[];
        setPaymentInfo(allPaymentSorted);
        return allPaymentSorted;
      };

      const fetchArbitrary = async () => {
        const arbitraryResponse = await fetch(arbitraryLink, { signal });
        const pendingArbitraryResponse = await fetch(pendingArbitraryLink, {
          signal,
        });
        const arbitraryResult = await arbitraryResponse.json();
        const pendingArbitraryResult = await pendingArbitraryResponse.json();
        const allArbitrary = [
          ...toArray(arbitraryResult),
          ...toArray(pendingArbitraryResult),
        ];
        const allArbitrarySorted = (await replaceAddressesWithNames(
          allArbitrary.sort(compareFn)
        )) as any[];

        setArbitraryInfo(allArbitrarySorted);
        return allArbitrarySorted;
      };

      const fetchAt = async () => {
        const atResponse = await fetch(atLink, { signal });
        const pendingAtResponse = await fetch(pendingAtLink, { signal });
        const atResult = await atResponse.json();
        const pendingAtResult = await pendingAtResponse.json();
        const allAt = [...toArray(atResult), ...toArray(pendingAtResult)];
        const allAtSorted = (await replaceAddressesWithNames(
          allAt.sort(compareFn)
        )) as any[];

        setAtInfo(allAtSorted);
        return allAtSorted;
      };

      const fetchGroup = async () => {
        const groupResponse = await fetch(groupLink, { signal });
        const pendingGroupResponse = await fetch(pendingGroupLink, { signal });
        const groupResult = await groupResponse.json();
        const pendingGroupResult = await pendingGroupResponse.json();
        const allGroup = [
          ...toArray(groupResult),
          ...toArray(pendingGroupResult),
        ];
        const allGroupSorted = (await replaceAddressesWithNames(
          allGroup.sort(compareFn)
        )) as any[];
        setGroupInfo(allGroupSorted);
        return allGroupSorted;
      };

      const fetchName = async () => {
        const nameResponse = await fetch(nameLink, { signal });
        const pendingNameResponse = await fetch(pendingNameLink, { signal });
        const nameResult = await nameResponse.json();
        const pendingNameResult = await pendingNameResponse.json();
        const allName = [...toArray(nameResult), ...toArray(pendingNameResult)];
        const allNameSorted = (await replaceAddressesWithNames(
          allName.sort(compareFn)
        )) as any[];
        setNameInfo(allNameSorted);
        return allNameSorted;
      };

      const fetchAsset = async () => {
        const assetResponse = await fetch(assetLink, { signal });
        const pendingAssetResponse = await fetch(pendingAssetLink, { signal });
        const assetResult = await assetResponse.json();
        const pendingAssetResult = await pendingAssetResponse.json();
        const allAsset = [
          ...toArray(assetResult),
          ...toArray(pendingAssetResult),
        ];
        const allAssetSorted = (await replaceAddressesWithNames(
          allAsset.sort(compareFn)
        )) as any[];

        setAssetInfo(allAssetSorted);
        return allAssetSorted;
      };

      const fetchPoll = async () => {
        const pollResponse = await fetch(pollLink, { signal });
        const pendingPollResponse = await fetch(pendingPollLink, { signal });
        const pollResult = await pollResponse.json();
        const pendingPollResult = await pendingPollResponse.json();
        const allPoll = [...toArray(pollResult), ...toArray(pendingPollResult)];
        const allPollSorted = (await replaceAddressesWithNames(
          allPoll.sort(compareFn)
        )) as any[];

        setPollInfo(allPollSorted);
        return allPollSorted;
      };

      const fetchRewardshare = async () => {
        const rewardshareResponse = await fetch(rewardshareLink, { signal });
        const pendingRewardshareResponse = await fetch(pendingRewardshareLink, {
          signal,
        });
        const rewardshareResult = await rewardshareResponse.json();
        const pendingRewardshareResult =
          await pendingRewardshareResponse.json();
        const allRewardshare = [
          ...toArray(rewardshareResult),
          ...toArray(pendingRewardshareResult),
        ];
        const allRewardshareSorted = (await replaceAddressesWithNames(
          allRewardshare.sort(compareFn)
        )) as any[];

        setRewardshareInfo(allRewardshareSorted);
        return allRewardshareSorted;
      };

      try {
        const [
          arbitraries,
          assets,
          ats,
          groups,
          names,
          payments,
          polls,
          rewardshares,
        ] = await Promise.all([
          fetchPayment(),
          fetchArbitrary(),
          fetchAt(),
          fetchGroup(),
          fetchName(),
          fetchAsset(),
          fetchPoll(),
          fetchRewardshare(),
        ]);

        const combinedTransactions = [
          arbitraries,
          assets,
          ats,
          groups,
          names,
          payments,
          polls,
          rewardshares,
        ].reduce<any[]>((acc, list) => {
          if (Array.isArray(list)) {
            acc.push(...list);
          }
          return acc;
        }, []);

        setAllInfo(combinedTransactions.sort(compareFn));
      } catch (error: any) {
        if (error.name === 'AbortError') return;
        console.error('Failed to fetch QORT transactions', error);
        setAllInfo([]);
      } finally {
        setLoadingRefreshQort(false);
      }
    },
    [address]
  );

  const handleLoadingRefreshQort = async () => {
    await getQortalTransactions();
  };

  const getWalletBalanceQort = useCallback(
    async (signal?: AbortSignal) => {
      try {
        setIsLoadingWalletBalanceQort(true);
        const balanceLink = `/addresses/balance/${address}`;
        const response = await fetch(balanceLink, { signal });
        const data = await response.json();
        setWalletBalanceQort(data);
      } catch (error: any) {
        if (error.name === 'AbortError') return;
        console.error(error);
      } finally {
        setIsLoadingWalletBalanceQort(false);
      }
    },
    [address]
  );

  useEffect(() => {
    if (!address) return;

    const controller = new AbortController();
    const intervalGetWalletBalance = setInterval(() => {
      getWalletBalanceQort();
    }, QORT_BALANCE_REFRESH_INTERVAL_MS);
    getWalletBalanceQort(controller.signal);

    return () => {
      clearInterval(intervalGetWalletBalance);
      controller.abort();
    };
  }, [address, getWalletBalanceQort]);

  useEffect(() => {
    let cancelled = false;

    const fetchQortTxFee = async () => {
      try {
        const res = await fetch('/transactions/unitfee?txType=PAYMENT');
        const rawFee = await res.json();

        if (!cancelled && typeof rawFee === 'number' && rawFee > 0) {
          setQortTxFee(Math.max(rawFee / QORT_1_UNIT, 0.01));
        }
      } catch (err) {
        console.error('Failed to fetch QORT tx fee', err);
      }
    };

    fetchQortTxFee();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!address) return;

    const controller = new AbortController();
    getQortalTransactions(controller.signal);

    return () => {
      controller.abort();
    };
  }, [address, getQortalTransactions]);

  const sendQortRequest = async () => {
    const recipientValue = qortRecipient.trim();

    if (
      hasInvisibleCharacters(recipientValue) ||
      hasInvisibleCharacters(qortRecipientDisplayName)
    ) {
      setRecipientTouched(true);
      setRecipientError(t('core:message.error.invisible_qortal_name'));
      return;
    }

    setOpenTxQortSubmit(true);
    try {
      const sendRequest = await qortalRequest({
        action: 'SEND_COIN',
        coin: Coin.QORT,
        recipient: recipientValue,
        amount: qortAmount,
      });
      if (!sendRequest?.error) {
        setAmountError(null);
        setAmountTouched(false);
        setRecipientError(null);
        setRecipientTouched(false);

        setQortAmount(0);
        setQortRecipient(EMPTY_STRING);
        setQortRecipientDisplayName(EMPTY_STRING);
        setQortNameSearchOpen(false);
        setQortNameSuggestions([]);
        setOpenTxQortSubmit(false);
        setOpenSendQortSuccess(true);

        await timeoutDelay(TIME_SECONDS_3);
        getWalletBalanceQort();
        getQortalTransactions();
      }
    } catch (error) {
      setQortAmount(0);
      setQortRecipient(EMPTY_STRING);
      setQortRecipientDisplayName(EMPTY_STRING);
      setQortNameSearchOpen(false);
      setQortNameSuggestions([]);
      setOpenTxQortSubmit(false);
      setOpenSendQortError(true);
      await timeoutDelay(TIME_SECONDS_3);
      getWalletBalanceQort();
      getQortalTransactions();
      console.error('ERROR SENDING QORT', error);
    }
  };

  const tablePayment = () => {
    if (paymentInfo && paymentInfo.length > 0) {
      return (
        <>
          <TableContainer component={Paper}>
            <Table
              stickyHeader
              sx={{ width: '100%' }}
              aria-label="payments-table"
            >
              <TableHead>
                <TableRow>
                  <StyledTableCell align="center">
                    {t('core:status', {
                      postProcess: 'capitalizeFirstChar',
                    })}
                  </StyledTableCell>
                  <StyledTableCell align="left">
                    {t('core:type', {
                      postProcess: 'capitalizeFirstChar',
                    })}
                  </StyledTableCell>
                  <StyledTableCell align="left">
                    {t('core:creator', {
                      postProcess: 'capitalizeFirstChar',
                    })}
                  </StyledTableCell>
                  <StyledTableCell align="left">
                    {t('core:recipient', {
                      postProcess: 'capitalizeFirstChar',
                    })}
                  </StyledTableCell>
                  <StyledTableCell align="left">
                    {t('core:amount', {
                      postProcess: 'capitalizeFirstChar',
                    })}
                  </StyledTableCell>
                  <StyledTableCell align="left">
                    {t('core:fee.fee', {
                      postProcess: 'capitalizeFirstChar',
                    })}
                  </StyledTableCell>
                  <StyledTableCell align="left">
                    {t('core:time', {
                      postProcess: 'capitalizeFirstChar',
                    })}
                  </StyledTableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {(rowsPerPage > 0
                  ? paymentInfo.slice(
                      page * rowsPerPage,
                      page * rowsPerPage + rowsPerPage
                    )
                  : paymentInfo
                ).map(
                  (
                    row: {
                      amount: number;
                      approvalStatus: string;
                      blockHeight: number;
                      creatorAddress: string;
                      creatorAddressOriginal?: string;
                      fee: number;
                      recipient: string;
                      recipientOriginal?: string;
                      reference: string;
                      senderPublicKey: string;
                      signature: string;
                      timestamp: number;
                      txGroupId: number;
                      type: string;
                    },
                    a: Key
                  ) => (
                    <StyledTableRow key={a}>
                      <StyledTableCell style={{ width: 'auto' }} align="center">
                        {(() => {
                          let confirmations: number =
                            nodeInfo?.height - row?.blockHeight;
                          if (confirmations < 3) {
                            return (
                              <Tooltip
                                placement="top"
                                title={t(
                                  'core:message.generic.confirmations_third',
                                  {
                                    postProcess: 'capitalizeFirstChar',
                                    count: confirmations,
                                  }
                                )}
                              >
                                <HistoryToggleOff
                                  style={{
                                    fontSize: '15px',
                                    color: theme.palette.error.main,
                                    marginTop: '2px',
                                  }}
                                />
                              </Tooltip>
                            );
                          } else {
                            let confirmations: number =
                              nodeInfo?.height - row?.blockHeight;
                            return (
                              <Tooltip
                                placement="top"
                                title={t('core:message.generic.confirmations', {
                                  postProcess: 'capitalizeFirstChar',
                                  count: confirmations,
                                })}
                              >
                                <CheckCircleOutline
                                  style={{
                                    fontSize: '15px',
                                    color: theme.palette.success.main,
                                    marginTop: '2px',
                                  }}
                                />
                              </Tooltip>
                            );
                          }
                        })()}
                      </StyledTableCell>
                      <StyledTableCell style={{ width: 'auto' }} align="left">
                        {row?.type}
                      </StyledTableCell>
                      <StyledTableCell
                        style={{ width: 'auto', cursor: 'pointer' }}
                        align="left"
                        title={t('core:action.double_click_addressbook', {
                          address:
                            row?.creatorAddressOriginal || row?.creatorAddress,
                        })}
                        onDoubleClick={() =>
                          handleOpenAddressBookWithData(
                            row?.creatorAddress || EMPTY_STRING,
                            row?.creatorAddressOriginal ||
                              row?.creatorAddress ||
                              EMPTY_STRING
                          )
                        }
                      >
                        {row?.creatorAddress === address ||
                        row?.creatorAddress === userName ? (
                          <Box style={{ color: theme.palette.info.main }}>
                            {row?.creatorAddress}
                          </Box>
                        ) : (
                          row?.creatorAddress
                        )}
                      </StyledTableCell>
                      <StyledTableCell
                        style={{ width: 'auto', cursor: 'pointer' }}
                        align="left"
                        title={t('core:action.double_click_addressbook', {
                          address: row?.recipientOriginal || row?.recipient,
                        })}
                        onDoubleClick={() =>
                          handleOpenAddressBookWithData(
                            row?.recipient || EMPTY_STRING,
                            row?.recipientOriginal ||
                              row?.recipient ||
                              EMPTY_STRING
                          )
                        }
                      >
                        {row?.recipient === address ||
                        row?.recipient === userName ? (
                          <Box style={{ color: theme.palette.info.main }}>
                            {row?.recipient}
                          </Box>
                        ) : (
                          row?.recipient
                        )}
                      </StyledTableCell>
                      <StyledTableCell style={{ width: 'auto' }} align="left">
                        {row?.recipient === address ||
                        row?.recipient === userName ? (
                          <Box style={{ color: theme.palette.success.main }}>
                            + {row?.amount}
                          </Box>
                        ) : (
                          <Box style={{ color: theme.palette.error.main }}>
                            - {row?.amount}
                          </Box>
                        )}
                      </StyledTableCell>
                      <StyledTableCell style={{ width: 'auto' }} align="left">
                        {row?.fee}
                      </StyledTableCell>
                      <StyledTableCell style={{ width: 'auto' }} align="left">
                        <CustomWidthTooltip
                          placement="top"
                          title={new Date(row?.timestamp).toLocaleString()}
                        >
                          <Box>{epochToAgo(row?.timestamp)}</Box>
                        </CustomWidthTooltip>
                      </StyledTableCell>
                    </StyledTableRow>
                  )
                )}
                {emptyRowsPayment > 0 && (
                  <TableRow style={{ height: 53 * emptyRowsPayment }}>
                    <TableCell colSpan={7} />
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
          <TablePagination
            component="div" // important when used outside <Table>
            labelRowsPerPage={t('core:rows_per_page', {
              postProcess: 'capitalizeFirstChar',
            })}
            rowsPerPageOptions={[5, 10, 25]}
            count={paymentInfo.length}
            rowsPerPage={rowsPerPage}
            page={page}
            onPageChange={handleChangePage}
            onRowsPerPageChange={handleChangeRowsPerPage}
            ActionsComponent={TablePaginationActions}
          />
        </>
      );
    } else {
      return (
        <Typography
          variant="h5"
          align="center"
          sx={{ color: 'white', fontWeight: 700 }}
        >
          {t('core:message.generic.no_transactions', {
            postProcess: 'capitalizeFirstChar',
            transaction_type: 'PAYMENT',
          })}
        </Typography>
      );
    }
  };

  const tableArbitrary = () => {
    if (arbitraryInfo && arbitraryInfo.length > 0) {
      return (
        <TableContainer component={Paper}>
          <Table
            stickyHeader
            sx={{ width: '100%' }}
            aria-label="arbitrary-table"
          >
            <TableHead>
              <TableRow>
                <StyledTableCell align="center">
                  {t('core:status', {
                    postProcess: 'capitalizeFirstChar',
                  })}
                </StyledTableCell>
                <StyledTableCell align="center">
                  {t('core:type', {
                    postProcess: 'capitalizeFirstChar',
                  })}
                </StyledTableCell>
                <StyledTableCell align="left">
                  {t('core:creator', {
                    postProcess: 'capitalizeFirstChar',
                  })}
                </StyledTableCell>
                <StyledTableCell align="left">
                  {t('core:identifier', {
                    postProcess: 'capitalizeFirstChar',
                  })}
                </StyledTableCell>
                <StyledTableCell align="left">
                  {t('core:size', {
                    postProcess: 'capitalizeFirstChar',
                  })}
                </StyledTableCell>
                <StyledTableCell align="left">
                  {t('core:fee.fee', {
                    postProcess: 'capitalizeFirstChar',
                  })}
                </StyledTableCell>
                <StyledTableCell align="left">
                  {t('core:time', {
                    postProcess: 'capitalizeFirstChar',
                  })}
                </StyledTableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {(rowsPerPage > 0
                ? arbitraryInfo.slice(
                    page * rowsPerPage,
                    page * rowsPerPage + rowsPerPage
                  )
                : arbitraryInfo
              ).map(
                (
                  row: {
                    blockHeight: number;
                    type: string;
                    creatorAddress: string;
                    creatorAddressOriginal?: string;
                    identifier: string;
                    size: number;
                    fee: number;
                    timestamp: number;
                  },
                  b: Key
                ) => (
                  <StyledTableRow key={b}>
                    <StyledTableCell style={{ width: 'auto' }} align="center">
                      {(() => {
                        let confirmations: number =
                          nodeInfo?.height - row?.blockHeight;
                        if (confirmations < 3) {
                          return (
                            <Tooltip
                              placement="top"
                              title={t(
                                'core:message.generic.confirmations_third',
                                {
                                  postProcess: 'capitalizeFirstChar',
                                  count: confirmations,
                                }
                              )}
                            >
                              <HistoryToggleOff
                                style={{
                                  fontSize: '15px',
                                  color: theme.palette.error.main,
                                  marginTop: '2px',
                                }}
                              />
                            </Tooltip>
                          );
                        } else {
                          return (
                            <Tooltip
                              placement="top"
                              title={t('core:message.generic.confirmations', {
                                postProcess: 'capitalizeFirstChar',
                                count: confirmations,
                              })}
                            >
                              <CheckCircleOutline
                                style={{
                                  fontSize: '15px',
                                  color: theme.palette.success.main,
                                  marginTop: '2px',
                                }}
                              />
                            </Tooltip>
                          );
                        }
                      })()}
                    </StyledTableCell>
                    <StyledTableCell style={{ width: 'auto' }} align="left">
                      {row?.type}
                    </StyledTableCell>
                    <StyledTableCell
                      style={{ width: 'auto', cursor: 'pointer' }}
                      align="left"
                      title={t('core:action.double_click_addressbook', {
                        address:
                          row?.creatorAddressOriginal || row?.creatorAddress,
                      })}
                      onDoubleClick={() =>
                        handleOpenAddressBookWithData(
                          row?.creatorAddress || EMPTY_STRING,
                          row?.creatorAddressOriginal ||
                            row?.creatorAddress ||
                            EMPTY_STRING
                        )
                      }
                    >
                      {row?.creatorAddress === address ||
                      row?.creatorAddress === userName ? (
                        <Box style={{ color: theme.palette.info.main }}>
                          {row?.creatorAddress}
                        </Box>
                      ) : (
                        row?.creatorAddress
                      )}
                    </StyledTableCell>
                    <StyledTableCell style={{ width: 'auto' }} align="left">
                      {row?.identifier}
                    </StyledTableCell>
                    <StyledTableCell style={{ width: 'auto' }} align="left">
                      <Box style={{ color: theme.palette.success.main }}>
                        {humanFileSize(row?.size, true, 2)}
                      </Box>
                    </StyledTableCell>
                    <StyledTableCell style={{ width: 'auto' }} align="left">
                      {row?.fee}
                    </StyledTableCell>
                    <StyledTableCell style={{ width: 'auto' }} align="left">
                      <CustomWidthTooltip
                        placement="top"
                        title={new Date(row?.timestamp).toLocaleString()}
                      >
                        <Box>{epochToAgo(row?.timestamp)}</Box>
                      </CustomWidthTooltip>
                    </StyledTableCell>
                  </StyledTableRow>
                )
              )}
              {emptyRowsArbitrary > 0 && (
                <TableRow style={{ height: 53 * emptyRowsArbitrary }}>
                  <TableCell colSpan={7} />
                </TableRow>
              )}
            </TableBody>
            <TableFooter sx={{ width: '100%' }}>
              <TableRow>
                <TablePagination
                  labelRowsPerPage={t('core:rows_per_page', {
                    postProcess: 'capitalizeFirstChar',
                  })}
                  rowsPerPageOptions={[5, 10, 25]}
                  colSpan={7}
                  count={arbitraryInfo.length}
                  rowsPerPage={rowsPerPage}
                  page={page}
                  slotProps={{
                    select: {
                      inputProps: {
                        'aria-label': 'rows per page',
                      },
                      native: true,
                    },
                  }}
                  onPageChange={handleChangePage}
                  onRowsPerPageChange={handleChangeRowsPerPage}
                  ActionsComponent={TablePaginationActions}
                />
              </TableRow>
            </TableFooter>
          </Table>
        </TableContainer>
      );
    } else {
      return (
        <Typography
          variant="h5"
          align="center"
          sx={{ color: 'white', fontWeight: 700 }}
        >
          {t('core:message.generic.no_transactions', {
            postProcess: 'capitalizeFirstChar',
            transaction_type: 'ARBITRARY',
          })}
        </Typography>
      );
    }
  };

  const tableAt = () => {
    if (atInfo && atInfo.length > 0) {
      return (
        <TableContainer component={Paper}>
          <Table stickyHeader sx={{ width: '100%' }} aria-label="at-table">
            <TableHead>
              <TableRow>
                <StyledTableCell align="center">
                  {t('core:status', {
                    postProcess: 'capitalizeFirstChar',
                  })}
                </StyledTableCell>
                <StyledTableCell align="center">
                  {t('core:type', {
                    postProcess: 'capitalizeFirstChar',
                  })}
                </StyledTableCell>
                <StyledTableCell align="left">
                  {t('core:creator', {
                    postProcess: 'capitalizeFirstChar',
                  })}
                </StyledTableCell>
                <StyledTableCell align="left">
                  {t('core:recipient', {
                    postProcess: 'capitalizeFirstChar',
                  })}
                </StyledTableCell>
                <StyledTableCell align="left">
                  {t('core:amount', {
                    postProcess: 'capitalizeFirstChar',
                  })}
                </StyledTableCell>
                <StyledTableCell align="left">
                  {t('core:fee.fee', {
                    postProcess: 'capitalizeFirstChar',
                  })}
                </StyledTableCell>
                <StyledTableCell align="left">
                  {t('core:time', {
                    postProcess: 'capitalizeFirstChar',
                  })}
                </StyledTableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {(rowsPerPage > 0
                ? atInfo.slice(
                    page * rowsPerPage,
                    page * rowsPerPage + rowsPerPage
                  )
                : atInfo
              ).map(
                (
                  row: {
                    blockHeight: number;
                    type: string;
                    creatorAddress: string;
                    creatorAddressOriginal?: string;
                    recipient: string;
                    recipientOriginal?: string;
                    description: string | '';
                    amount: number;
                    fee: number;
                    timestamp: number;
                  },
                  c: Key
                ) => (
                  <StyledTableRow key={c}>
                    <StyledTableCell style={{ width: 'auto' }} align="center">
                      {(() => {
                        let confirmations: number =
                          nodeInfo?.height - row?.blockHeight;
                        if (confirmations < 3) {
                          return (
                            <Tooltip
                              placement="top"
                              title={t(
                                'core:message.generic.confirmations_third',
                                {
                                  postProcess: 'capitalizeFirstChar',
                                  count: confirmations,
                                }
                              )}
                            >
                              <HistoryToggleOff
                                style={{
                                  fontSize: '15px',
                                  color: theme.palette.error.main,
                                  marginTop: '2px',
                                }}
                              />
                            </Tooltip>
                          );
                        } else {
                          return (
                            <Tooltip
                              placement="top"
                              title={t('core:message.generic.confirmations', {
                                postProcess: 'capitalizeFirstChar',
                                count: confirmations,
                              })}
                            >
                              <CheckCircleOutline
                                style={{
                                  fontSize: '15px',
                                  color: theme.palette.success.main,
                                  marginTop: '2px',
                                }}
                              />
                            </Tooltip>
                          );
                        }
                      })()}
                    </StyledTableCell>
                    <StyledTableCell style={{ width: 'auto' }} align="left">
                      {row?.type}
                    </StyledTableCell>
                    <StyledTableCell
                      style={{ width: 'auto', cursor: 'pointer' }}
                      align="left"
                      title={t('core:action.double_click_addressbook', {
                        address:
                          row?.creatorAddressOriginal || row?.creatorAddress,
                      })}
                      onDoubleClick={() =>
                        handleOpenAddressBookWithData(
                          row?.creatorAddress || EMPTY_STRING,
                          row?.creatorAddressOriginal ||
                            row?.creatorAddress ||
                            EMPTY_STRING
                        )
                      }
                    >
                      {row?.creatorAddress === address ||
                      row?.creatorAddress === userName ? (
                        <Box style={{ color: theme.palette.info.main }}>
                          {row?.creatorAddress}
                        </Box>
                      ) : (
                        row?.creatorAddress
                      )}
                    </StyledTableCell>
                    <StyledTableCell
                      style={{
                        width: 'auto',
                        cursor:
                          row?.recipientOriginal || row?.recipient
                            ? 'pointer'
                            : 'default',
                      }}
                      align="left"
                      title={
                        row?.recipientOriginal || row?.recipient
                          ? t('core:action.double_click_addressbook', {
                              address: row?.recipientOriginal || row?.recipient,
                            })
                          : undefined
                      }
                      onDoubleClick={() =>
                        (row?.recipientOriginal || row?.recipient) &&
                        handleOpenAddressBookWithData(
                          row?.recipient || EMPTY_STRING,
                          row?.recipientOriginal ||
                            row?.recipient ||
                            EMPTY_STRING
                        )
                      }
                    >
                      {(() => {
                        if (row?.recipient) {
                          if (
                            row?.recipient === address ||
                            row?.recipient === userName
                          ) {
                            return (
                              <Box style={{ color: theme.palette.info.main }}>
                                {row?.recipient}
                              </Box>
                            );
                          } else {
                            return row?.recipient;
                          }
                        } else if (row?.description) {
                          return row?.description;
                        } else {
                          return EMPTY_STRING;
                        }
                      })()}
                    </StyledTableCell>
                    <StyledTableCell style={{ width: 'auto' }} align="left">
                      {row?.recipient === address ||
                      row?.recipient === userName ? (
                        <Box style={{ color: theme.palette.success.main }}>
                          + {row?.amount}
                        </Box>
                      ) : (
                        <Box style={{ color: theme.palette.error.main }}>
                          - {row?.amount}
                        </Box>
                      )}
                    </StyledTableCell>
                    <StyledTableCell style={{ width: 'auto' }} align="left">
                      {row?.fee}
                    </StyledTableCell>
                    <StyledTableCell style={{ width: 'auto' }} align="left">
                      <CustomWidthTooltip
                        placement="top"
                        title={new Date(row?.timestamp).toLocaleString()}
                      >
                        <Box>{epochToAgo(row?.timestamp)}</Box>
                      </CustomWidthTooltip>
                    </StyledTableCell>
                  </StyledTableRow>
                )
              )}
              {emptyRowsAt > 0 && (
                <TableRow style={{ height: 53 * emptyRowsAt }}>
                  <TableCell colSpan={7} />
                </TableRow>
              )}
            </TableBody>
            <TableFooter sx={{ width: '100%' }}>
              <TableRow>
                <TablePagination
                  labelRowsPerPage={t('core:rows_per_page', {
                    postProcess: 'capitalizeFirstChar',
                  })}
                  rowsPerPageOptions={[5, 10, 25]}
                  colSpan={7}
                  count={atInfo.length}
                  rowsPerPage={rowsPerPage}
                  page={page}
                  slotProps={{
                    select: {
                      inputProps: {
                        'aria-label': 'rows per page',
                      },
                      native: true,
                    },
                  }}
                  onPageChange={handleChangePage}
                  onRowsPerPageChange={handleChangeRowsPerPage}
                  ActionsComponent={TablePaginationActions}
                />
              </TableRow>
            </TableFooter>
          </Table>
        </TableContainer>
      );
    } else {
      return (
        <Typography
          variant="h5"
          align="center"
          sx={{ color: 'white', fontWeight: 700 }}
        >
          {t('core:message.generic.no_transactions', {
            postProcess: 'capitalizeFirstChar',
            transaction_type: 'AT',
          })}
        </Typography>
      );
    }
  };

  const tableGroup = () => {
    if (groupInfo && groupInfo.length > 0) {
      return (
        <TableContainer component={Paper}>
          <Table stickyHeader sx={{ width: '100%' }} aria-label="group-table">
            <TableHead>
              <TableRow>
                <StyledTableCell align="center">
                  {t('core:status', {
                    postProcess: 'capitalizeFirstChar',
                  })}
                </StyledTableCell>
                <StyledTableCell align="left">
                  {t('core:type', {
                    postProcess: 'capitalizeFirstChar',
                  })}
                </StyledTableCell>
                <StyledTableCell align="left">
                  {t('core:creator', {
                    postProcess: 'capitalizeFirstChar',
                  })}
                </StyledTableCell>
                <StyledTableCell align="left">
                  {t('core:info', {
                    postProcess: 'capitalizeFirstChar',
                  })}
                </StyledTableCell>
                <StyledTableCell align="left">
                  {t('core:fee.fee', {
                    postProcess: 'capitalizeFirstChar',
                  })}
                </StyledTableCell>
                <StyledTableCell align="left">
                  {t('core:time', {
                    postProcess: 'capitalizeFirstChar',
                  })}
                </StyledTableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {(rowsPerPage > 0
                ? groupInfo.slice(
                    page * rowsPerPage,
                    page * rowsPerPage + rowsPerPage
                  )
                : groupInfo
              ).map(
                (
                  row: {
                    admin: string;
                    blockHeight: number;
                    creatorAddress: string;
                    creatorAddressOriginal?: string;
                    fee: number;
                    groupId: number;
                    groupName: string;
                    invitee: string;
                    member: string;
                    newDescription: string;
                    offender: string;
                    reference: string;
                    timestamp: number;
                    type: string;
                  },
                  d: Key
                ) => (
                  <StyledTableRow key={d}>
                    <StyledTableCell style={{ width: 'auto' }} align="center">
                      {(() => {
                        let confirmations: number =
                          nodeInfo?.height - row?.blockHeight;
                        if (confirmations < 3) {
                          return (
                            <Tooltip
                              placement="top"
                              title={t(
                                'core:message.generic.confirmations_third',
                                {
                                  postProcess: 'capitalizeFirstChar',
                                  count: confirmations,
                                }
                              )}
                            >
                              <HistoryToggleOff
                                style={{
                                  fontSize: '15px',
                                  color: theme.palette.error.main,
                                  marginTop: '2px',
                                }}
                              />
                            </Tooltip>
                          );
                        } else {
                          return (
                            <Tooltip
                              placement="top"
                              title={t('core:message.generic.confirmations', {
                                postProcess: 'capitalizeFirstChar',
                                count: confirmations,
                              })}
                            >
                              <CheckCircleOutline
                                style={{
                                  fontSize: '15px',
                                  color: theme.palette.success.main,
                                  marginTop: '2px',
                                }}
                              />
                            </Tooltip>
                          );
                        }
                      })()}
                    </StyledTableCell>
                    <StyledTableCell style={{ width: 'auto' }} align="left">
                      {row?.type}
                    </StyledTableCell>
                    <StyledTableCell
                      style={{ width: 'auto', cursor: 'pointer' }}
                      align="left"
                      title={t('core:action.double_click_addressbook', {
                        address:
                          row?.creatorAddressOriginal || row?.creatorAddress,
                      })}
                      onDoubleClick={() =>
                        handleOpenAddressBookWithData(
                          row?.creatorAddress || EMPTY_STRING,
                          row?.creatorAddressOriginal ||
                            row?.creatorAddress ||
                            EMPTY_STRING
                        )
                      }
                    >
                      {row?.creatorAddress === address ||
                      row?.creatorAddress === userName ? (
                        <Box style={{ color: theme.palette.info.main }}>
                          {row?.creatorAddress}
                        </Box>
                      ) : (
                        row?.creatorAddress
                      )}
                    </StyledTableCell>
                    <StyledTableCell style={{ width: 'auto' }} align="left">
                      {(() => {
                        if (row?.type === 'CREATE_GROUP') {
                          return t('core:message.group_actions.create_group', {
                            groupName: row?.groupName,
                            id: row?.groupId,
                            postProcess: 'capitalizeFirstChar',
                          });
                        } else if (row?.type === 'UPDATE_GROUP') {
                          return t('core:message.group_actions.update_group', {
                            newDescription: row?.newDescription,
                            id: row?.groupId,
                            postProcess: 'capitalizeFirstChar',
                          });
                        } else if (row?.type === 'ADD_GROUP_ADMIN') {
                          return t(
                            'core:message.group_actions.add_group_admin',
                            {
                              member: row?.member,
                              id: row?.groupId,
                              postProcess: 'capitalizeFirstChar',
                            }
                          );
                        } else if (row?.type === 'REMOVE_GROUP_ADMIN') {
                          return t(
                            'core:message.group_actions.remove_group_admin',
                            {
                              admn: row?.admin,
                              id: row?.groupId,
                              postProcess: 'capitalizeFirstChar',
                            }
                          );
                        } else if (row?.type === 'GROUP_BAN') {
                          return t('core:message.group_actions.group_ban', {
                            offender: row?.offender,
                            id: row?.groupId,
                            postProcess: 'capitalizeFirstChar',
                          });
                        } else if (row?.type === 'CANCEL_GROUP_BAN') {
                          return t(
                            'core:message.group_actions.cancel_group_ban',
                            {
                              member: row?.member,
                              id: row?.groupId,
                              postProcess: 'capitalizeFirstChar',
                            }
                          );
                        } else if (row?.type === 'GROUP_KICK') {
                          return t('core:message.group_actions.group_kick', {
                            member: row?.member,
                            id: row?.groupId,
                            postProcess: 'capitalizeFirstChar',
                          });
                        } else if (row?.type === 'GROUP_INVITE') {
                          if (row?.invitee === address) {
                            return (
                              <Box>
                                <Trans
                                  i18nKey="message.group_actions.group_invite"
                                  values={{
                                    invitee: row?.invitee,
                                    id: row?.groupId,
                                  }}
                                  components={{
                                    blue: (
                                      <span
                                        style={{
                                          color: theme.palette.info.main,
                                          marginLeft: '5px',
                                          marginRight: '5px',
                                        }}
                                      />
                                    ),
                                  }}
                                />
                              </Box>
                            );
                          } else {
                            return (
                              'Invitee: ' +
                              row?.invitee +
                              ' ID: ' +
                              row?.groupId
                            );
                          }
                        } else if (row?.type === 'CANCEL_GROUP_INVITE') {
                          return t('core:message.group_actions.reference', {
                            reference: row?.reference,
                            postProcess: 'capitalizeFirstChar',
                          });
                        } else if (row?.type === 'JOIN_GROUP') {
                          return t('core:message.group_actions.join_group', {
                            id: row?.groupId,
                            postProcess: 'capitalizeFirstChar',
                          });
                        } else if (row?.type === 'LEAVE_GROUP') {
                          return t('core:message.group_actions.leave_group', {
                            id: row?.groupId,
                            postProcess: 'capitalizeFirstChar',
                          });
                        } else if (row?.type === 'GROUP_APPROVAL') {
                          return t('core:message.group_actions.reference', {
                            reference: row?.reference,
                            postProcess: 'capitalizeFirstChar',
                          });
                        } else if (row?.type === 'SET_GROUP') {
                          return EMPTY_STRING;
                        }
                      })()}
                    </StyledTableCell>
                    <StyledTableCell style={{ width: 'auto' }} align="left">
                      {row?.fee}
                    </StyledTableCell>
                    <StyledTableCell style={{ width: 'auto' }} align="left">
                      <CustomWidthTooltip
                        placement="top"
                        title={new Date(row?.timestamp).toLocaleString()}
                      >
                        <Box>{epochToAgo(row?.timestamp)}</Box>
                      </CustomWidthTooltip>
                    </StyledTableCell>
                  </StyledTableRow>
                )
              )}
              {emptyRowsGroup > 0 && (
                <TableRow style={{ height: 53 * emptyRowsGroup }}>
                  <TableCell colSpan={6} />
                </TableRow>
              )}
            </TableBody>
            <TableFooter sx={{ width: '100%' }}>
              <TableRow>
                <TablePagination
                  labelRowsPerPage={t('core:rows_per_page', {
                    postProcess: 'capitalizeFirstChar',
                  })}
                  rowsPerPageOptions={[5, 10, 25]}
                  colSpan={6}
                  count={groupInfo.length}
                  rowsPerPage={rowsPerPage}
                  page={page}
                  slotProps={{
                    select: {
                      inputProps: {
                        'aria-label': 'rows per page',
                      },
                      native: true,
                    },
                  }}
                  onPageChange={handleChangePage}
                  onRowsPerPageChange={handleChangeRowsPerPage}
                  ActionsComponent={TablePaginationActions}
                />
              </TableRow>
            </TableFooter>
          </Table>
        </TableContainer>
      );
    } else {
      return (
        <Typography
          variant="h5"
          align="center"
          sx={{ color: 'white', fontWeight: 700 }}
        >
          {t('core:message.generic.no_transactions', {
            postProcess: 'capitalizeFirstChar',
            transaction_type: 'GROUP',
          })}
        </Typography>
      );
    }
  };

  const tableName = () => {
    if (nameInfo && nameInfo.length > 0) {
      return (
        <TableContainer component={Paper}>
          <Table stickyHeader sx={{ width: '100%' }} aria-label="group-table">
            <TableHead>
              <TableRow>
                <StyledTableCell align="center">
                  {t('core:status', {
                    postProcess: 'capitalizeFirstChar',
                  })}
                </StyledTableCell>
                <StyledTableCell align="left">
                  {t('core:type', {
                    postProcess: 'capitalizeFirstChar',
                  })}
                </StyledTableCell>
                <StyledTableCell align="left">
                  {t('core:creator', {
                    postProcess: 'capitalizeFirstChar',
                  })}
                </StyledTableCell>
                <StyledTableCell align="left">
                  {t('core:info', {
                    postProcess: 'capitalizeFirstChar',
                  })}
                </StyledTableCell>
                <StyledTableCell align="left">
                  {t('core:fee.fee', {
                    postProcess: 'capitalizeFirstChar',
                  })}
                </StyledTableCell>
                <StyledTableCell align="left">
                  {t('core:time', {
                    postProcess: 'capitalizeFirstChar',
                  })}
                </StyledTableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {(rowsPerPage > 0
                ? nameInfo.slice(
                    page * rowsPerPage,
                    page * rowsPerPage + rowsPerPage
                  )
                : nameInfo
              ).map(
                (
                  row: {
                    blockHeight: number;
                    type: string;
                    creatorAddress: string;
                    name: string;
                    newName: string;
                    seller: string;
                    amount: number;
                    fee: number;
                    timestamp: number;
                  },
                  e: Key
                ) => (
                  <StyledTableRow key={e}>
                    <StyledTableCell style={{ width: 'auto' }} align="center">
                      {(() => {
                        let confirmations: number =
                          nodeInfo?.height - row?.blockHeight;
                        if (confirmations < 3) {
                          return (
                            <Tooltip
                              placement="top"
                              title={t(
                                'core:message.generic.confirmations_third',
                                {
                                  postProcess: 'capitalizeFirstChar',
                                  count: confirmations,
                                }
                              )}
                            >
                              <HistoryToggleOff
                                style={{
                                  fontSize: '15px',
                                  color: theme.palette.error.main,
                                  marginTop: '2px',
                                }}
                              />
                            </Tooltip>
                          );
                        } else {
                          return (
                            <Tooltip
                              placement="top"
                              title={t('core:message.generic.confirmations', {
                                postProcess: 'capitalizeFirstChar',
                                count: confirmations,
                              })}
                            >
                              <CheckCircleOutline
                                style={{
                                  fontSize: '15px',
                                  color: theme.palette.success.main,
                                  marginTop: '2px',
                                }}
                              />
                            </Tooltip>
                          );
                        }
                      })()}
                    </StyledTableCell>
                    <StyledTableCell style={{ width: 'auto' }} align="left">
                      {row?.type}
                    </StyledTableCell>
                    <StyledTableCell style={{ width: 'auto' }} align="left">
                      {row?.creatorAddress === address ||
                      row?.creatorAddress === userName ? (
                        <Box style={{ color: theme.palette.info.main }}>
                          {row?.creatorAddress}
                        </Box>
                      ) : (
                        row?.creatorAddress
                      )}
                    </StyledTableCell>
                    <StyledTableCell style={{ width: 'auto' }} align="left">
                      {(() => {
                        if (row?.type === 'REGISTER_NAME') {
                          return t('core:qortal.registered_name', {
                            name: row?.name,
                            postProcess: 'capitalizeFirstChar',
                          });
                        } else if (row?.type === 'UPDATE_NAME') {
                          return t('core:qortal.old_new_name', {
                            oldName: row?.name,
                            newName: row?.newName,
                            postProcess: 'capitalizeFirstChar',
                          });
                        } else if (row?.type === 'SELL_NAME') {
                          return t('core:qortal.name_to_sell', {
                            name: row?.name,
                            amount: row?.amount,
                            postProcess: 'capitalizeFirstChar',
                          });
                        } else if (row?.type === 'CANCEL_SELL_NAME') {
                          return t('core:qortal.cancelled_name_sale', {
                            name: row?.name,
                            postProcess: 'capitalizeFirstChar',
                          });
                        } else if (row?.type === 'BUY_NAME') {
                          return t('core:qortal.seller', {
                            seller: row?.seller,
                            amount: row?.amount,
                            postProcess: 'capitalizeFirstChar',
                          });
                        }
                      })()}
                    </StyledTableCell>
                    <StyledTableCell style={{ width: 'auto' }} align="left">
                      {row?.fee}
                    </StyledTableCell>
                    <StyledTableCell style={{ width: 'auto' }} align="left">
                      <CustomWidthTooltip
                        placement="top"
                        title={new Date(row?.timestamp).toLocaleString()}
                      >
                        <Box>{epochToAgo(row?.timestamp)}</Box>
                      </CustomWidthTooltip>
                    </StyledTableCell>
                  </StyledTableRow>
                )
              )}
              {emptyRowsName > 0 && (
                <TableRow style={{ height: 53 * emptyRowsName }}>
                  <TableCell colSpan={6} />
                </TableRow>
              )}
            </TableBody>
            <TableFooter sx={{ width: '100%' }}>
              <TableRow>
                <TablePagination
                  labelRowsPerPage={t('core:rows_per_page', {
                    postProcess: 'capitalizeFirstChar',
                  })}
                  rowsPerPageOptions={[5, 10, 25]}
                  colSpan={6}
                  count={nameInfo.length}
                  rowsPerPage={rowsPerPage}
                  page={page}
                  slotProps={{
                    select: {
                      inputProps: {
                        'aria-label': 'rows per page',
                      },
                      native: true,
                    },
                  }}
                  onPageChange={handleChangePage}
                  onRowsPerPageChange={handleChangeRowsPerPage}
                  ActionsComponent={TablePaginationActions}
                />
              </TableRow>
            </TableFooter>
          </Table>
        </TableContainer>
      );
    } else {
      return (
        <Typography
          variant="h5"
          align="center"
          sx={{ color: 'white', fontWeight: 700 }}
        >
          {t('core:message.generic.no_transactions', {
            postProcess: 'capitalizeFirstChar',
            transaction_type: 'NAME',
          })}
        </Typography>
      );
    }
  };

  const tableAsset = () => {
    if (assetInfo && assetInfo.length > 0) {
      return (
        <TableContainer component={Paper}>
          <Table stickyHeader sx={{ width: '100%' }} aria-label="group-table">
            <TableHead>
              <TableRow>
                <StyledTableCell align="center">
                  {t('core:status', {
                    postProcess: 'capitalizeFirstChar',
                  })}
                </StyledTableCell>
                <StyledTableCell align="left">
                  {t('core:type', {
                    postProcess: 'capitalizeFirstChar',
                  })}
                </StyledTableCell>
                <StyledTableCell align="left">
                  {t('core:creator', {
                    postProcess: 'capitalizeFirstChar',
                  })}
                </StyledTableCell>
                <StyledTableCell align="left">
                  {t('core:recipient', {
                    postProcess: 'capitalizeFirstChar',
                  })}
                </StyledTableCell>
                <StyledTableCell align="left">
                  {t('core:amount', {
                    postProcess: 'capitalizeFirstChar',
                  })}
                </StyledTableCell>
                <StyledTableCell align="left">
                  {t('core:fee.fee', {
                    postProcess: 'capitalizeFirstChar',
                  })}
                </StyledTableCell>
                <StyledTableCell align="left">
                  {t('core:time', {
                    postProcess: 'capitalizeFirstChar',
                  })}
                </StyledTableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {(rowsPerPage > 0
                ? assetInfo.slice(
                    page * rowsPerPage,
                    page * rowsPerPage + rowsPerPage
                  )
                : assetInfo
              ).map(
                (
                  row: {
                    amount: number;
                    assetName: string;
                    blockHeight: number;
                    creatorAddress: string;
                    description: string;
                    fee: number;
                    quantity: number;
                    recipient: string;
                    timestamp: number;
                    type: string;
                  },
                  f: Key
                ) => (
                  <StyledTableRow key={f}>
                    <StyledTableCell style={{ width: 'auto' }} align="center">
                      {(() => {
                        let confirmations: number =
                          nodeInfo?.height - row?.blockHeight;
                        if (confirmations < 3) {
                          return (
                            <Tooltip
                              placement="top"
                              title={t(
                                'core:message.generic.confirmations_third',
                                {
                                  postProcess: 'capitalizeFirstChar',
                                  count: confirmations,
                                }
                              )}
                            >
                              <HistoryToggleOff
                                style={{
                                  fontSize: '15px',
                                  color: theme.palette.error.main,
                                  marginTop: '2px',
                                }}
                              />
                            </Tooltip>
                          );
                        } else {
                          return (
                            <Tooltip
                              placement="top"
                              title={t('core:message.generic.confirmations', {
                                postProcess: 'capitalizeFirstChar',
                                count: confirmations,
                              })}
                            >
                              <CheckCircleOutline
                                style={{
                                  fontSize: '15px',
                                  color: theme.palette.success.main,
                                  marginTop: '2px',
                                }}
                              />
                            </Tooltip>
                          );
                        }
                      })()}
                    </StyledTableCell>
                    <StyledTableCell style={{ width: 'auto' }} align="left">
                      {row?.type}
                    </StyledTableCell>
                    <StyledTableCell style={{ width: 'auto' }} align="left">
                      {row?.creatorAddress === address ||
                      row?.creatorAddress === userName ? (
                        <Box style={{ color: theme.palette.info.main }}>
                          {row?.creatorAddress}
                        </Box>
                      ) : (
                        row?.creatorAddress
                      )}
                    </StyledTableCell>
                    <StyledTableCell style={{ width: 'auto' }} align="left">
                      {(() => {
                        if (row?.type === 'TRANSFER_ASSET') {
                          return row?.recipient === address ||
                            row?.recipient === userName ? (
                            <Box style={{ color: theme.palette.info.main }}>
                              {row?.recipient}
                            </Box>
                          ) : (
                            row?.recipient
                          );
                        } else if (row?.type === 'ISSUE_ASSET') {
                          return t('core:qortal.asset_name', {
                            name: row?.assetName,
                            postProcess: 'capitalizeFirstChar',
                          });
                        }
                      })()}
                    </StyledTableCell>
                    <StyledTableCell style={{ width: 'auto' }} align="left">
                      {row?.amount ? row?.amount : row?.quantity}
                    </StyledTableCell>
                    <StyledTableCell style={{ width: 'auto' }} align="left">
                      {row?.fee}
                    </StyledTableCell>
                    <StyledTableCell style={{ width: 'auto' }} align="left">
                      <CustomWidthTooltip
                        placement="top"
                        title={new Date(row?.timestamp).toLocaleString()}
                      >
                        <Box>{epochToAgo(row?.timestamp)}</Box>
                      </CustomWidthTooltip>
                    </StyledTableCell>
                  </StyledTableRow>
                )
              )}
              {emptyRowsAsset > 0 && (
                <TableRow style={{ height: 53 * emptyRowsAsset }}>
                  <TableCell colSpan={7} />
                </TableRow>
              )}
            </TableBody>
            <TableFooter sx={{ width: '100%' }}>
              <TableRow>
                <TablePagination
                  labelRowsPerPage={t('core:rows_per_page', {
                    postProcess: 'capitalizeFirstChar',
                  })}
                  rowsPerPageOptions={[5, 10, 25]}
                  colSpan={7}
                  count={assetInfo.length}
                  rowsPerPage={rowsPerPage}
                  page={page}
                  slotProps={{
                    select: {
                      inputProps: {
                        'aria-label': 'rows per page',
                      },
                      native: true,
                    },
                  }}
                  onPageChange={handleChangePage}
                  onRowsPerPageChange={handleChangeRowsPerPage}
                  ActionsComponent={TablePaginationActions}
                />
              </TableRow>
            </TableFooter>
          </Table>
        </TableContainer>
      );
    } else {
      return (
        <Typography
          variant="h5"
          align="center"
          sx={{ color: 'white', fontWeight: 700 }}
        >
          {t('core:message.generic.no_transactions', {
            postProcess: 'capitalizeFirstChar',
            transaction_type: 'ASSET',
          })}
        </Typography>
      );
    }
  };

  const tablePoll = () => {
    if (pollInfo && pollInfo.length > 0) {
      return (
        <TableContainer component={Paper}>
          <Table stickyHeader sx={{ width: '100%' }} aria-label="group-table">
            <TableHead>
              <TableRow>
                <StyledTableCell align="center">
                  {t('core:status', {
                    postProcess: 'capitalizeFirstChar',
                  })}
                </StyledTableCell>
                <StyledTableCell align="center">
                  {t('core:type', {
                    postProcess: 'capitalizeFirstChar',
                  })}
                </StyledTableCell>
                <StyledTableCell align="left">
                  {t('core:creator', {
                    postProcess: 'capitalizeFirstChar',
                  })}
                </StyledTableCell>
                <StyledTableCell align="left">
                  {t('core:poll_name', {
                    postProcess: 'capitalizeFirstChar',
                  })}
                </StyledTableCell>
                <StyledTableCell align="left">
                  {t('core:fee.fee', {
                    postProcess: 'capitalizeFirstChar',
                  })}
                </StyledTableCell>
                <StyledTableCell align="left">
                  {t('core:time', {
                    postProcess: 'capitalizeFirstChar',
                  })}
                </StyledTableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {(rowsPerPage > 0
                ? pollInfo.slice(
                    page * rowsPerPage,
                    page * rowsPerPage + rowsPerPage
                  )
                : pollInfo
              ).map(
                (
                  row: {
                    blockHeight: number;
                    creatorAddress: string;
                    fee: number;
                    pollName: string;
                    timestamp: number;
                    type: string;
                  },
                  g: Key
                ) => (
                  <StyledTableRow key={g}>
                    <StyledTableCell style={{ width: 'auto' }} align="center">
                      {(() => {
                        const confirmations: number =
                          nodeInfo?.height - row?.blockHeight;
                        if (confirmations < 3) {
                          return (
                            <Tooltip
                              placement="top"
                              title={t(
                                'core:message.generic.confirmations_third',
                                {
                                  postProcess: 'capitalizeFirstChar',
                                  count: confirmations,
                                }
                              )}
                            >
                              <HistoryToggleOff
                                style={{
                                  fontSize: '15px',
                                  color: theme.palette.error.main,
                                  marginTop: '2px',
                                }}
                              />
                            </Tooltip>
                          );
                        } else {
                          return (
                            <Tooltip
                              placement="top"
                              title={t('core:message.generic.confirmations', {
                                postProcess: 'capitalizeFirstChar',
                                count: confirmations,
                              })}
                            >
                              <CheckCircleOutline
                                style={{
                                  fontSize: '15px',
                                  color: theme.palette.success.main,
                                  marginTop: '2px',
                                }}
                              />
                            </Tooltip>
                          );
                        }
                      })()}
                    </StyledTableCell>
                    <StyledTableCell style={{ width: 'auto' }} align="left">
                      {row?.type}
                    </StyledTableCell>
                    <StyledTableCell style={{ width: 'auto' }} align="left">
                      {row?.creatorAddress === address ||
                      row?.creatorAddress === userName ? (
                        <Box style={{ color: theme.palette.info.main }}>
                          {row?.creatorAddress}
                        </Box>
                      ) : (
                        row?.creatorAddress
                      )}
                    </StyledTableCell>
                    <StyledTableCell style={{ width: 'auto' }} align="left">
                      {row?.pollName}
                    </StyledTableCell>
                    <StyledTableCell style={{ width: 'auto' }} align="left">
                      {row?.fee}
                    </StyledTableCell>
                    <StyledTableCell style={{ width: 'auto' }} align="left">
                      <CustomWidthTooltip
                        placement="top"
                        title={new Date(row?.timestamp).toLocaleString()}
                      >
                        <Box>{epochToAgo(row?.timestamp)}</Box>
                      </CustomWidthTooltip>
                    </StyledTableCell>
                  </StyledTableRow>
                )
              )}
              {emptyRowsPoll > 0 && (
                <TableRow style={{ height: 53 * emptyRowsPoll }}>
                  <TableCell colSpan={6} />
                </TableRow>
              )}
            </TableBody>
            <TableFooter sx={{ width: '100%' }}>
              <TableRow>
                <TablePagination
                  labelRowsPerPage={t('core:rows_per_page', {
                    postProcess: 'capitalizeFirstChar',
                  })}
                  rowsPerPageOptions={[5, 10, 25]}
                  colSpan={6}
                  count={pollInfo.length}
                  rowsPerPage={rowsPerPage}
                  page={page}
                  slotProps={{
                    select: {
                      inputProps: {
                        'aria-label': 'rows per page',
                      },
                      native: true,
                    },
                  }}
                  onPageChange={handleChangePage}
                  onRowsPerPageChange={handleChangeRowsPerPage}
                  ActionsComponent={TablePaginationActions}
                />
              </TableRow>
            </TableFooter>
          </Table>
        </TableContainer>
      );
    } else {
      return (
        <Typography
          variant="h5"
          align="center"
          sx={{ color: 'white', fontWeight: 700 }}
        >
          {t('core:message.generic.no_transactions', {
            postProcess: 'capitalizeFirstChar',
            transaction_type: 'POLL',
          })}
        </Typography>
      );
    }
  };

  const tableRewardshare = () => {
    if (rewardshareInfo && rewardshareInfo.length > 0) {
      return (
        <TableContainer component={Paper}>
          <Table
            stickyHeader
            sx={{ width: '100%' }}
            aria-label="payments-table"
          >
            <TableHead>
              <TableRow>
                <StyledTableCell align="center">
                  {t('core:status', {
                    postProcess: 'capitalizeFirstChar',
                  })}
                </StyledTableCell>
                <StyledTableCell align="left">
                  {t('core:type', {
                    postProcess: 'capitalizeFirstChar',
                  })}
                </StyledTableCell>
                <StyledTableCell align="left">
                  {t('core:creator', {
                    postProcess: 'capitalizeFirstChar',
                  })}
                </StyledTableCell>
                <StyledTableCell align="left">
                  {t('core:recipient', {
                    postProcess: 'capitalizeFirstChar',
                  })}
                </StyledTableCell>
                <StyledTableCell align="left">
                  {t('core:info', {
                    postProcess: 'capitalizeFirstChar',
                  })}
                </StyledTableCell>
                <StyledTableCell align="left">
                  {t('core:fee.fee', {
                    postProcess: 'capitalizeFirstChar',
                  })}
                </StyledTableCell>
                <StyledTableCell align="left">
                  {t('core:time', {
                    postProcess: 'capitalizeFirstChar',
                  })}
                </StyledTableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {(rowsPerPage > 0
                ? rewardshareInfo.slice(
                    page * rowsPerPage,
                    page * rowsPerPage + rowsPerPage
                  )
                : rewardshareInfo
              ).map(
                (
                  row: {
                    blockHeight: number;
                    creatorAddress: string;
                    fee: number;
                    recipient: string;
                    rewardSharePublicKey: string;
                    sharePercent: string;
                    timestamp: number;
                    type: string;
                  },
                  h: Key
                ) => (
                  <StyledTableRow key={h}>
                    <StyledTableCell style={{ width: 'auto' }} align="center">
                      {(() => {
                        let confirmations: number =
                          nodeInfo?.height - row?.blockHeight;
                        if (confirmations < 3) {
                          return (
                            <Tooltip
                              placement="top"
                              title={t(
                                'core:message.generic.confirmations_third',
                                {
                                  postProcess: 'capitalizeFirstChar',
                                  count: confirmations,
                                }
                              )}
                            >
                              <HistoryToggleOff
                                style={{
                                  fontSize: '15px',
                                  color: theme.palette.error.main,
                                  marginTop: '2px',
                                }}
                              />
                            </Tooltip>
                          );
                        } else {
                          return (
                            <Tooltip
                              placement="top"
                              title={t('core:message.generic.confirmations', {
                                postProcess: 'capitalizeFirstChar',
                                count: confirmations,
                              })}
                            >
                              <CheckCircleOutline
                                style={{
                                  fontSize: '15px',
                                  color: theme.palette.success.main,
                                  marginTop: '2px',
                                }}
                              />
                            </Tooltip>
                          );
                        }
                      })()}
                    </StyledTableCell>
                    <StyledTableCell style={{ width: 'auto' }} align="left">
                      {row?.type}
                    </StyledTableCell>
                    <StyledTableCell style={{ width: 'auto' }} align="left">
                      {row?.creatorAddress === address ||
                      row?.creatorAddress === userName ? (
                        <Box style={{ color: theme.palette.info.main }}>
                          {row?.creatorAddress}
                        </Box>
                      ) : (
                        row?.creatorAddress
                      )}
                    </StyledTableCell>
                    <StyledTableCell style={{ width: 'auto' }} align="left">
                      {row?.recipient === address ||
                      row?.recipient === userName ? (
                        <Box style={{ color: theme.palette.info.main }}>
                          {row?.recipient}
                        </Box>
                      ) : (
                        row?.recipient
                      )}
                    </StyledTableCell>
                    <StyledTableCell style={{ width: 'auto' }} align="left">
                      {row?.sharePercent?.startsWith('-') ? (
                        <Box
                          style={{
                            color: theme.palette.error.main,
                            display: 'flex',
                            alignItems: 'center',
                          }}
                        >
                          {t('core:qortal.removed', {
                            postProcess: 'capitalizeFirstChar',
                          })}
                          <CustomWidthTooltip
                            placement="top"
                            title={
                              row?.recipient === row?.creatorAddress
                                ? 'Minting Key: ' + row?.rewardSharePublicKey
                                : EMPTY_STRING
                            }
                          >
                            <InfoOutlined
                              style={{
                                fontSize: '14px',
                                color: theme.palette.info.main,
                                marginLeft: '8px',
                              }}
                            />
                          </CustomWidthTooltip>
                        </Box>
                      ) : (
                        <Box
                          style={{
                            color: theme.palette.success.main,
                            display: 'flex',
                            alignItems: 'center',
                          }}
                        >
                          {t('core:qortal.created', {
                            postProcess: 'capitalizeFirstChar',
                          })}
                          <CustomWidthTooltip
                            placement="top"
                            title={
                              row?.recipient === row?.creatorAddress ||
                              row?.recipient === userName
                                ? 'Minting Key: ' + row?.rewardSharePublicKey
                                : EMPTY_STRING
                            }
                          >
                            <InfoOutlined
                              style={{
                                fontSize: '14px',
                                color: theme.palette.info.main,
                                marginLeft: '8px',
                              }}
                            />
                          </CustomWidthTooltip>
                        </Box>
                      )}
                    </StyledTableCell>
                    <StyledTableCell style={{ width: 'auto' }} align="left">
                      {row?.fee}
                    </StyledTableCell>
                    <StyledTableCell style={{ width: 'auto' }} align="left">
                      <CustomWidthTooltip
                        placement="top"
                        title={new Date(row?.timestamp).toLocaleString()}
                      >
                        <Box>{epochToAgo(row?.timestamp)}</Box>
                      </CustomWidthTooltip>
                    </StyledTableCell>
                  </StyledTableRow>
                )
              )}
              {emptyRowsRewardshare > 0 && (
                <TableRow style={{ height: 53 * emptyRowsRewardshare }}>
                  <TableCell colSpan={7} />
                </TableRow>
              )}
            </TableBody>
            <TableFooter sx={{ width: '100%' }}>
              <TableRow>
                <TablePagination
                  labelRowsPerPage={t('core:rows_per_page', {
                    postProcess: 'capitalizeFirstChar',
                  })}
                  rowsPerPageOptions={[5, 10, 25]}
                  colSpan={7}
                  count={rewardshareInfo.length}
                  rowsPerPage={rowsPerPage}
                  page={page}
                  slotProps={{
                    select: {
                      inputProps: {
                        'aria-label': 'row per page',
                      },
                      native: true,
                    },
                  }}
                  onPageChange={handleChangePage}
                  onRowsPerPageChange={handleChangeRowsPerPage}
                  ActionsComponent={TablePaginationActions}
                />
              </TableRow>
            </TableFooter>
          </Table>
        </TableContainer>
      );
    } else {
      return (
        <Typography
          variant="h5"
          align="center"
          sx={{ color: 'white', fontWeight: 700 }}
        >
          {t('core:message.generic.no_transactions', {
            postProcess: 'capitalizeFirstChar',
            transaction_type: 'REWARDSHARE',
          })}
        </Typography>
      );
    }
  };

  const tableAll = () => {
    if (allInfo && allInfo.length > 0) {
      return (
        <>
          <TableContainer component={Paper}>
            <Table stickyHeader sx={{ width: '100%' }} aria-label="all-table">
              <TableHead>
                <TableRow>
                  <StyledTableCell align="center">
                    {t('core:status', {
                      postProcess: 'capitalizeFirstChar',
                    })}
                  </StyledTableCell>
                  <StyledTableCell align="left">
                    {t('core:type', {
                      postProcess: 'capitalizeFirstChar',
                    })}
                  </StyledTableCell>
                  <StyledTableCell align="left">
                    {t('core:creator', {
                      postProcess: 'capitalizeFirstChar',
                    })}
                  </StyledTableCell>
                  <StyledTableCell align="center">
                    {t('core:identifier', {
                      postProcess: 'capitalizeFirstChar',
                    })}
                  </StyledTableCell>
                  <StyledTableCell align="center">
                    {t('core:size', {
                      postProcess: 'capitalizeFirstChar',
                    })}
                  </StyledTableCell>
                  <StyledTableCell align="left">
                    {t('core:recipient', {
                      postProcess: 'capitalizeFirstChar',
                    })}
                  </StyledTableCell>
                  <StyledTableCell align="left">
                    {t('core:amount', {
                      postProcess: 'capitalizeFirstChar',
                    })}
                  </StyledTableCell>
                  <StyledTableCell align="left">
                    {t('core:info', {
                      postProcess: 'capitalizeFirstChar',
                    })}
                  </StyledTableCell>
                  <StyledTableCell align="left">
                    {t('core:poll_name', {
                      postProcess: 'capitalizeFirstChar',
                    })}
                  </StyledTableCell>
                  <StyledTableCell align="left">
                    {t('core:fee.fee', {
                      postProcess: 'capitalizeFirstChar',
                    })}
                  </StyledTableCell>
                  <StyledTableCell align="left">
                    {t('core:time', {
                      postProcess: 'capitalizeFirstChar',
                    })}
                  </StyledTableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {(rowsPerPage > 0
                  ? allInfo.slice(
                      page * rowsPerPage,
                      page * rowsPerPage + rowsPerPage
                    )
                  : allInfo
                ).map(
                  (
                    row: {
                      amount: number;
                      blockHeight: number;
                      creatorAddress: string;
                      fee: number;
                      identifier: string;
                      name: string;
                      newName: string;
                      pollName: string;
                      recipient: string;
                      rewardSharePublicKey: string;
                      seller: string;
                      sharePercent: string;
                      size: number;
                      timestamp: number;
                      type: string;
                    },
                    h: Key
                  ) => (
                    <StyledTableRow key={h}>
                      <StyledTableCell style={{ width: 'auto' }} align="center">
                        {(() => {
                          let confirmations: number =
                            nodeInfo?.height - row?.blockHeight;
                          if (confirmations < 3) {
                            return (
                              <Tooltip
                                placement="top"
                                title={t(
                                  'core:message.generic.confirmations_third',
                                  {
                                    postProcess: 'capitalizeFirstChar',
                                    count: confirmations,
                                  }
                                )}
                              >
                                <HistoryToggleOff
                                  style={{
                                    fontSize: '15px',
                                    color: theme.palette.error.main,
                                    marginTop: '2px',
                                  }}
                                />
                              </Tooltip>
                            );
                          } else {
                            return (
                              <Tooltip
                                placement="top"
                                title={t('core:message.generic.confirmations', {
                                  postProcess: 'capitalizeFirstChar',
                                  count: confirmations,
                                })}
                              >
                                <CheckCircleOutline
                                  style={{
                                    fontSize: '15px',
                                    color: theme.palette.success.main,
                                    marginTop: '2px',
                                  }}
                                />
                              </Tooltip>
                            );
                          }
                        })()}
                      </StyledTableCell>
                      <StyledTableCell style={{ width: 'auto' }} align="left">
                        {row?.type}
                      </StyledTableCell>
                      <StyledTableCell style={{ width: 'auto' }} align="left">
                        <CustomWidthTooltip
                          placement="top"
                          title={row?.creatorAddress}
                        >
                          <Box>
                            {row?.creatorAddress === address ||
                            row?.creatorAddress === userName ? (
                              <Box style={{ color: theme.palette.info.main }}>
                                {cropString(row?.creatorAddress)}
                              </Box>
                            ) : (
                              cropString(row?.creatorAddress)
                            )}
                          </Box>
                        </CustomWidthTooltip>
                      </StyledTableCell>
                      <StyledTableCell style={{ width: 'auto' }} align="left">
                        <CustomWidthTooltip
                          placement="top"
                          title={row?.identifier}
                        >
                          <Box>
                            {row?.identifier
                              ? cropString(row?.identifier)
                              : EMPTY_STRING}
                          </Box>
                        </CustomWidthTooltip>
                      </StyledTableCell>
                      <StyledTableCell style={{ width: 'auto' }} align="right">
                        {row?.size > 0
                          ? humanFileSize(row?.size, true, 2)
                          : EMPTY_STRING}
                      </StyledTableCell>
                      <StyledTableCell style={{ width: 'auto' }} align="left">
                        <CustomWidthTooltip
                          placement="top"
                          title={row?.recipient}
                        >
                          <Box>
                            {row?.recipient === address ||
                            row?.recipient === userName ? (
                              <Box style={{ color: theme.palette.info.main }}>
                                {cropString(row?.recipient)}
                              </Box>
                            ) : row?.recipient ? (
                              cropString(row?.recipient)
                            ) : (
                              EMPTY_STRING
                            )}
                          </Box>
                        </CustomWidthTooltip>
                      </StyledTableCell>
                      <StyledTableCell style={{ width: 'auto' }} align="left">
                        {row?.amount}
                      </StyledTableCell>
                      <StyledTableCell style={{ width: 'auto' }} align="left">
                        {(() => {
                          if (row?.type === 'REGISTER_NAME') {
                            return t('core:qortal.registered_name', {
                              name: row?.name,
                              postProcess: 'capitalizeFirstChar',
                            });
                          } else if (row?.type === 'UPDATE_NAME') {
                            return t('core:qortal.old_new_name', {
                              oldName: row?.name,
                              newName: row?.newName,
                              postProcess: 'capitalizeFirstChar',
                            });
                          } else if (row?.type === 'SELL_NAME') {
                            return t('core:qortal.name_to_sell', {
                              name: row?.name,
                              amount: row?.amount,
                              postProcess: 'capitalizeFirstChar',
                            });
                          } else if (row?.type === 'CANCEL_SELL_NAME') {
                            return t('core:qortal.cancelled_name_sale', {
                              name: row?.name,
                              postProcess: 'capitalizeFirstChar',
                            });
                          } else if (row?.type === 'BUY_NAME') {
                            return t('core:qortal.seller', {
                              seller: row?.seller,
                              amount: row?.amount,
                              postProcess: 'capitalizeFirstChar',
                            });
                          } else if (row?.type === 'REWARD_SHARE') {
                            {
                              row?.sharePercent &&
                              row?.sharePercent?.startsWith('-') ? (
                                <Box
                                  style={{
                                    color: theme.palette.error.main,
                                    display: 'flex',
                                    alignItems: 'center',
                                  }}
                                >
                                  {t('core:qortal.removed', {
                                    postProcess: 'capitalizeFirstChar',
                                  })}
                                  <CustomWidthTooltip
                                    placement="top"
                                    title={
                                      row?.recipient === row?.creatorAddress
                                        ? 'Minting Key: ' +
                                          row?.rewardSharePublicKey
                                        : EMPTY_STRING
                                    }
                                  >
                                    <InfoOutlined
                                      style={{
                                        fontSize: '14px',
                                        color: theme.palette.info.main,
                                        marginLeft: '8px',
                                      }}
                                    />
                                  </CustomWidthTooltip>
                                </Box>
                              ) : (
                                row?.sharePercent && (
                                  <Box
                                    style={{
                                      color: theme.palette.success.main,
                                      display: 'flex',
                                      alignItems: 'center',
                                    }}
                                  >
                                    {t('core:qortal.created', {
                                      postProcess: 'capitalizeFirstChar',
                                    })}
                                    <CustomWidthTooltip
                                      placement="top"
                                      title={
                                        row?.recipient === row?.creatorAddress
                                          ? 'Minting Key: ' +
                                            row?.rewardSharePublicKey
                                          : EMPTY_STRING
                                      }
                                    >
                                      <InfoOutlined
                                        style={{
                                          fontSize: '14px',
                                          color: theme.palette.info.main,
                                          marginLeft: '8px',
                                        }}
                                      />
                                    </CustomWidthTooltip>
                                  </Box>
                                )
                              );
                            }
                          }
                        })()}
                      </StyledTableCell>
                      <StyledTableCell style={{ width: 'auto' }} align="left">
                        {row?.pollName}
                      </StyledTableCell>
                      <StyledTableCell style={{ width: 'auto' }} align="left">
                        {row?.fee}
                      </StyledTableCell>
                      <StyledTableCell style={{ width: 'auto' }} align="left">
                        {row?.timestamp > 0 ? (
                          <CustomWidthTooltip
                            placement="top"
                            title={new Date(row?.timestamp).toLocaleString()}
                          >
                            <Box>{epochToAgo(row?.timestamp)}</Box>
                          </CustomWidthTooltip>
                        ) : (
                          EMPTY_STRING
                        )}
                      </StyledTableCell>
                    </StyledTableRow>
                  )
                )}
                {emptyRowsAll > 0 && (
                  <TableRow style={{ height: 53 * emptyRowsAll }}>
                    <TableCell colSpan={11} />
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
          <TablePagination
            component="div"
            labelRowsPerPage={t('core:rows_per_page', {
              postProcess: 'capitalizeFirstChar',
            })}
            rowsPerPageOptions={[5, 10, 25]}
            count={allInfo.length}
            rowsPerPage={rowsPerPage}
            page={page}
            onPageChange={handleChangePage}
            onRowsPerPageChange={handleChangeRowsPerPage}
            ActionsComponent={TablePaginationActions}
          />
        </>
      );
    } else {
      return (
        <Typography
          variant="h5"
          align="center"
          sx={{ color: 'white', fontWeight: 700 }}
        >
          {t('core:message.generic.no_transactions', {
            postProcess: 'capitalizeFirstChar',
            transaction_type: 'ALL',
          })}
        </Typography>
      );
    }
  };

  // Retain the legacy per-type renderers while the unified table handles the visible UX.
  void tablePayment;
  void tableArbitrary;
  void tableAt;
  void tableGroup;
  void tableName;
  void tableAsset;
  void tablePoll;
  void tableRewardshare;
  void tableAll;

  const qortalTables = () => {
    const safeAllInfo = Array.isArray(allInfo) ? allInfo : [];
    const filters = [
      { label: t('core:filters.all'), rows: safeAllInfo, value: 'all' },
      {
        label: t('core:filters.payments'),
        rows: paymentInfo,
        value: 'payments',
      },
      {
        label: t('core:filters.rewards'),
        rows: rewardshareInfo,
        value: 'rewards',
      },
      {
        label: t('core:filters.arbitrary'),
        rows: arbitraryInfo,
        value: 'arbitrary',
      },
      { label: t('core:filters.at'), rows: atInfo, value: 'at' },
      { label: t('core:filters.group'), rows: groupInfo, value: 'group' },
      { label: t('core:filters.name'), rows: nameInfo, value: 'name' },
      { label: t('core:filters.asset'), rows: assetInfo, value: 'asset' },
      { label: t('core:filters.poll'), rows: pollInfo, value: 'poll' },
    ];
    const nonAllFilters = filters.filter((filter) => filter.value !== 'all');
    const isAllFiltersSelected =
      selectedTransactionFilters.includes('all') ||
      selectedTransactionFilters.length === nonAllFilters.length;
    const activeFilterValues = isAllFiltersSelected
      ? nonAllFilters.map((filter) => filter.value)
      : selectedTransactionFilters;
    const selectedFilterLabel = isAllFiltersSelected
      ? 'All'
      : activeFilterValues.length === 0
        ? 'No filters'
        : activeFilterValues.length === 1
          ? (filters.find((filter) => filter.value === activeFilterValues[0])
              ?.label ?? 'Filtered')
          : `${activeFilterValues.length} filters`;
    const advancedFilterOpen = Boolean(advancedFilterAnchor);
    const transactionHeaderSx = {
      color: 'text.secondary',
      fontSize: 11,
      fontWeight: 700,
      letterSpacing: 0,
      lineHeight: 1,
      minWidth: 0,
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      textTransform: 'uppercase',
      whiteSpace: 'nowrap',
    } as const;
    const transactionRowHoverSx = {
      overflow: 'hidden',
      position: 'relative',
      '&::before': {
        background: (t: Theme) =>
          t.palette.mode === 'dark'
            ? 'linear-gradient(90deg, rgba(24,189,242,0.07), rgba(24,189,242,0.025))'
            : 'linear-gradient(90deg, rgba(11,143,211,0.08), rgba(11,143,211,0.025))',
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

    const formatTransactionType = (type?: string) => {
      if (!type) return '-';
      return type
        .toLowerCase()
        .split('_')
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ');
    };

    const getTransactionKey = (row: any) =>
      row?.signature ||
      [
        row?.type,
        row?.timestamp,
        row?.creatorAddress,
        row?.recipient,
        row?.amount,
        row?.fee,
      ].join(':');
    const getFilterRows = (rows: unknown) => (Array.isArray(rows) ? rows : []);

    const selectedRowKeys = new Set<string>();

    filters.forEach((filter) => {
      if (filter.value === 'all') return;
      if (!activeFilterValues.includes(filter.value)) return;
      getFilterRows(filter.rows).forEach((row: any) =>
        selectedRowKeys.add(getTransactionKey(row))
      );
    });
    const selectedRows = isAllFiltersSelected
      ? safeAllInfo
      : safeAllInfo.filter((row: any) => {
          const key = getTransactionKey(row);
          return selectedRowKeys.has(key);
        });

    const getDisplayAddress = (row: any, field: 'creator' | 'recipient') => {
      if (field === 'creator') {
        return row?.creatorAddress || row?.sender || row?.owner || '-';
      }

      return row?.recipient || row?.recipientAddress || row?.atAddress || '-';
    };

    const getRawAddress = (row: any, field: 'creator' | 'recipient') => {
      if (field === 'creator') {
        return row?.creatorAddressOriginal || row?.creatorAddress || '';
      }

      return (
        row?.recipientOriginal || row?.recipientAddress || row?.recipient || ''
      );
    };

    const renderAddressCell = (row: any, field: 'creator' | 'recipient') => {
      const displayAddress = getDisplayAddress(row, field);
      const rawAddress = getRawAddress(row, field);
      const lookupValue = rawAddress || displayAddress;
      const canLookup = lookupValue && lookupValue !== '-';
      const isCurrentUser =
        displayAddress === address ||
        displayAddress === userName ||
        rawAddress === address;
      const isDisplayedQortalName =
        typeof displayAddress === 'string' &&
        displayAddress !== '-' &&
        !QORT_ADDRESS_PATTERN.test(displayAddress);

      return (
        <NameText
          component="span"
          name={isDisplayedQortalName ? displayAddress : undefined}
          fallback={displayAddress}
          role={canLookup ? 'button' : undefined}
          tabIndex={canLookup ? 0 : undefined}
          title={canLookup ? 'Open in User Search' : undefined}
          onClick={() => openUserLookup(lookupValue)}
          onKeyDown={(event) => {
            if (!canLookup) return;
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              openUserLookup(lookupValue);
            }
          }}
          sx={{
            color: isCurrentUser ? 'info.main' : 'text.primary',
            cursor: canLookup ? 'pointer' : 'default',
            display: 'block',
            fontSize: 13,
            fontWeight: isCurrentUser ? 600 : 400,
            maxWidth: 156,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            '&:hover': canLookup
              ? {
                  color: 'primary.main',
                  textDecoration: 'underline',
                  textUnderlineOffset: '3px',
                }
              : undefined,
          }}
        />
      );
    };

    const renderStatusIcon = (row: any) => {
      const confirmations =
        typeof row?.blockHeight === 'number' &&
        typeof nodeInfo?.height === 'number'
          ? nodeInfo.height - row.blockHeight
          : null;
      const isPending = confirmations == null || confirmations < 3;

      return (
        <Tooltip
          placement="top"
          title={
            confirmations == null
              ? t('core:transaction_status.pending_confirmation')
              : isPending
                ? t('core:transaction_status.pending_confirmations', {
                    count: confirmations,
                  })
                : t('core:transaction_status.confirmed')
          }
        >
          {isPending ? (
            <HistoryToggleOff sx={{ color: 'error.main', fontSize: 16 }} />
          ) : (
            <CheckCircleOutline sx={{ color: 'success.main', fontSize: 16 }} />
          )}
        </Tooltip>
      );
    };

    const renderAmountCell = (row: any) => {
      const hasAmount = row?.amount !== undefined && row?.amount !== null;
      if (!hasAmount) {
        return (
          <Typography
            sx={{ color: 'text.secondary', fontSize: 13, fontWeight: 400 }}
          >
            -
          </Typography>
        );
      }

      const amount = Math.abs(toFiniteNumber(row.amount));
      const rawRecipient = getRawAddress(row, 'recipient');
      const displayRecipient = getDisplayAddress(row, 'recipient');
      const isIncoming =
        rawRecipient === address ||
        displayRecipient === address ||
        displayRecipient === userName;

      return (
        <Typography
          sx={{
            color: isIncoming ? 'success.main' : 'error.main',
            fontSize: 13,
            fontWeight: 500,
            whiteSpace: 'nowrap',
          }}
        >
          {isIncoming ? '+' : '-'}
          {formatQortAmount(amount)} QORT
        </Typography>
      );
    };

    // Context-aware "Info" cell: shows the column that used to be dedicated per
    // transaction type before the unified table — identifier/size for ARBITRARY,
    // poll name for polls, the human-readable action for NAME/GROUP txs, and the
    // reward-share created/removed state.
    const infoTextSx = {
      color: 'text.secondary',
      fontSize: 13,
      fontWeight: 400,
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
    } as const;

    const renderTransactionInfo = (row: any): ReactNode => {
      const type = row?.type;
      const infoText = (content: ReactNode, title?: string) => {
        const node = <Typography sx={infoTextSx}>{content}</Typography>;
        return title ? (
          <CustomWidthTooltip placement="top" title={title}>
            {node}
          </CustomWidthTooltip>
        ) : (
          node
        );
      };

      // NAME transactions
      if (type === 'REGISTER_NAME') {
        return infoText(
          t('core:qortal.registered_name', {
            name: row?.name,
            postProcess: 'capitalizeFirstChar',
          })
        );
      }
      if (type === 'UPDATE_NAME') {
        return infoText(
          t('core:qortal.old_new_name', {
            oldName: row?.name,
            newName: row?.newName,
            postProcess: 'capitalizeFirstChar',
          })
        );
      }
      if (type === 'SELL_NAME') {
        return infoText(
          t('core:qortal.name_to_sell', {
            name: row?.name,
            amount: row?.amount,
            postProcess: 'capitalizeFirstChar',
          })
        );
      }
      if (type === 'CANCEL_SELL_NAME') {
        return infoText(
          t('core:qortal.cancelled_name_sale', {
            name: row?.name,
            postProcess: 'capitalizeFirstChar',
          })
        );
      }
      if (type === 'BUY_NAME') {
        return infoText(
          t('core:qortal.seller', {
            seller: row?.seller,
            amount: row?.amount,
            postProcess: 'capitalizeFirstChar',
          })
        );
      }

      // REWARD_SHARE / TRANSFER_PRIVS / PRESENCE -> created/removed
      if (
        type === 'REWARD_SHARE' ||
        type === 'TRANSFER_PRIVS' ||
        type === 'PRESENCE'
      ) {
        if (!row?.sharePercent) return null;
        const removed = String(row.sharePercent).startsWith('-');
        const mintingKeyTitle =
          row?.recipient === row?.creatorAddress || row?.recipient === userName
            ? 'Minting Key: ' + row?.rewardSharePublicKey
            : EMPTY_STRING;
        return (
          <Box
            sx={{
              alignItems: 'center',
              color: removed ? 'error.main' : 'success.main',
              display: 'flex',
              fontSize: 13,
              fontWeight: 400,
              minWidth: 0,
            }}
          >
            {removed
              ? t('core:qortal.removed', {
                  postProcess: 'capitalizeFirstChar',
                })
              : t('core:qortal.created', {
                  postProcess: 'capitalizeFirstChar',
                })}
            {mintingKeyTitle ? (
              <CustomWidthTooltip placement="top" title={mintingKeyTitle}>
                <InfoOutlined
                  sx={{ color: 'info.main', fontSize: 14, ml: 1 }}
                />
              </CustomWidthTooltip>
            ) : null}
          </Box>
        );
      }

      // GROUP transactions
      const groupId = row?.groupId;
      if (type === 'CREATE_GROUP') {
        return infoText(
          t('core:message.group_actions.create_group', {
            groupName: row?.groupName,
            id: groupId,
            postProcess: 'capitalizeFirstChar',
          })
        );
      }
      if (type === 'UPDATE_GROUP') {
        return infoText(
          t('core:message.group_actions.update_group', {
            newDescription: row?.newDescription,
            id: groupId,
            postProcess: 'capitalizeFirstChar',
          })
        );
      }
      if (type === 'ADD_GROUP_ADMIN') {
        return infoText(
          t('core:message.group_actions.add_group_admin', {
            member: row?.member,
            id: groupId,
            postProcess: 'capitalizeFirstChar',
          })
        );
      }
      if (type === 'REMOVE_GROUP_ADMIN') {
        return infoText(
          t('core:message.group_actions.remove_group_admin', {
            admn: row?.admin,
            id: groupId,
            postProcess: 'capitalizeFirstChar',
          })
        );
      }
      if (type === 'GROUP_BAN') {
        return infoText(
          t('core:message.group_actions.group_ban', {
            offender: row?.offender,
            id: groupId,
            postProcess: 'capitalizeFirstChar',
          })
        );
      }
      if (type === 'CANCEL_GROUP_BAN') {
        return infoText(
          t('core:message.group_actions.cancel_group_ban', {
            member: row?.member,
            id: groupId,
            postProcess: 'capitalizeFirstChar',
          })
        );
      }
      if (type === 'GROUP_KICK') {
        return infoText(
          t('core:message.group_actions.group_kick', {
            member: row?.member,
            id: groupId,
            postProcess: 'capitalizeFirstChar',
          })
        );
      }
      if (type === 'GROUP_INVITE') {
        if (row?.invitee === address) {
          return (
            <Typography sx={infoTextSx}>
              <Trans
                i18nKey="message.group_actions.group_invite"
                values={{ invitee: row?.invitee, id: groupId }}
                components={{
                  blue: (
                    <span
                      style={{
                        color: theme.palette.info.main,
                        marginLeft: '5px',
                        marginRight: '5px',
                      }}
                    />
                  ),
                }}
              />
            </Typography>
          );
        }
        return infoText('Invitee: ' + row?.invitee + ' ID: ' + groupId);
      }
      if (type === 'CANCEL_GROUP_INVITE' || type === 'GROUP_APPROVAL') {
        return infoText(
          t('core:message.group_actions.reference', {
            reference: row?.reference,
            postProcess: 'capitalizeFirstChar',
          })
        );
      }
      if (type === 'JOIN_GROUP') {
        return infoText(
          t('core:message.group_actions.join_group', {
            id: groupId,
            postProcess: 'capitalizeFirstChar',
          })
        );
      }
      if (type === 'LEAVE_GROUP') {
        return infoText(
          t('core:message.group_actions.leave_group', {
            id: groupId,
            postProcess: 'capitalizeFirstChar',
          })
        );
      }

      return null;
    };

    const renderIdentifierCell = (row: any) => {
      const identifier = row?.identifier
        ? String(row.identifier)
        : EMPTY_STRING;
      if (!identifier) return <Typography sx={infoTextSx}>-</Typography>;
      return (
        <CustomWidthTooltip placement="top" title={identifier}>
          <Typography sx={infoTextSx}>{cropString(identifier)}</Typography>
        </CustomWidthTooltip>
      );
    };

    const renderSizeCell = (row: any) => (
      <Typography sx={{ ...infoTextSx, textAlign: 'right' }}>
        {row?.size > 0 ? humanFileSize(row.size, true, 2) : '-'}
      </Typography>
    );

    const renderPollNameCell = (row: any) => (
      <Typography sx={infoTextSx}>{row?.pollName || '-'}</Typography>
    );

    const renderTypeCell = (row: any) => (
      <Typography
        sx={{
          color: 'text.secondary',
          fontSize: 13,
          fontWeight: 400,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {formatTransactionType(row?.type)}
      </Typography>
    );

    const renderFeeCell = (row: any) => (
      <Typography
        sx={{
          color: 'text.secondary',
          fontSize: 13,
          fontWeight: 400,
          textAlign: 'right',
          whiteSpace: 'nowrap',
        }}
      >
        {row?.fee !== undefined && row?.fee !== null
          ? `${formatQortFee(row.fee)} QORT`
          : '-'}
      </Typography>
    );

    const renderTimeCell = (row: any) => (
      <CustomWidthTooltip
        placement="top"
        title={new Date(row?.timestamp).toLocaleString()}
      >
        <Typography
          sx={{
            color: 'text.secondary',
            fontSize: 13,
            fontWeight: 400,
            whiteSpace: 'nowrap',
          }}
        >
          {row?.timestamp ? epochToAgo(row.timestamp) : '-'}
        </Typography>
      </CustomWidthTooltip>
    );

    const renderInfoCell = (row: any) =>
      renderTransactionInfo(row) ?? <Typography sx={infoTextSx}>-</Typography>;

    // Mobile detail = the most relevant per-type value (info, identifier/size,
    // or poll name) collapsed into one card field.
    const renderTransactionDetail = (row: any): ReactNode => {
      const info = renderTransactionInfo(row);
      if (info) return info;
      const identifier = row?.identifier
        ? String(row.identifier)
        : EMPTY_STRING;
      const size =
        row?.size > 0 ? humanFileSize(row.size, true, 2) : EMPTY_STRING;
      if (identifier || size) {
        return (
          <Typography sx={{ ...infoTextSx, whiteSpace: 'normal' }}>
            {[identifier ? cropString(identifier) : EMPTY_STRING, size]
              .filter(Boolean)
              .join(' · ')}
          </Typography>
        );
      }
      if (row?.pollName) {
        return <Typography sx={infoTextSx}>{row.pollName}</Typography>;
      }
      return null;
    };

    // Each filter exposes its own ordered column set; the visible columns are the
    // union of the selected filters (canonical order), so columns appear/disappear
    // with the filter selection. ALL shows the full superset.
    type TransactionColumnId =
      | 'status'
      | 'type'
      | 'creator'
      | 'identifier'
      | 'size'
      | 'recipient'
      | 'amount'
      | 'info'
      | 'pollName'
      | 'fee'
      | 'time';

    const transactionColumnConfig: Record<
      TransactionColumnId,
      {
        headerKey: string;
        align: 'left' | 'center' | 'right';
        widthXs: string;
        widthXl: string;
        minPx: number;
        renderCell: (row: any) => ReactNode;
      }
    > = {
      status: {
        headerKey: 'core:status',
        align: 'center',
        widthXs: '42px',
        widthXl: '54px',
        minPx: 42,
        renderCell: (row) => (
          <Box sx={{ display: 'flex', justifyContent: 'center' }}>
            {renderStatusIcon(row)}
          </Box>
        ),
      },
      type: {
        headerKey: 'core:type',
        align: 'left',
        widthXs: 'minmax(82px, 0.55fr)',
        widthXl: 'minmax(110px, 0.7fr)',
        minPx: 82,
        renderCell: renderTypeCell,
      },
      creator: {
        headerKey: 'core:creator',
        align: 'left',
        widthXs: 'minmax(120px, 1fr)',
        widthXl: 'minmax(150px, 1fr)',
        minPx: 120,
        renderCell: (row) => renderAddressCell(row, 'creator'),
      },
      identifier: {
        headerKey: 'core:identifier',
        align: 'left',
        widthXs: 'minmax(120px, 0.9fr)',
        widthXl: 'minmax(150px, 1fr)',
        minPx: 120,
        renderCell: renderIdentifierCell,
      },
      size: {
        headerKey: 'core:size',
        align: 'right',
        widthXs: 'minmax(72px, 0.5fr)',
        widthXl: 'minmax(90px, 0.55fr)',
        minPx: 72,
        renderCell: renderSizeCell,
      },
      recipient: {
        headerKey: 'core:recipient',
        align: 'left',
        widthXs: 'minmax(120px, 1fr)',
        widthXl: 'minmax(150px, 1fr)',
        minPx: 120,
        renderCell: (row) => renderAddressCell(row, 'recipient'),
      },
      amount: {
        headerKey: 'core:amount',
        align: 'right',
        widthXs: 'minmax(95px, 0.72fr)',
        widthXl: 'minmax(118px, 0.78fr)',
        minPx: 95,
        renderCell: (row) => (
          <Box sx={{ textAlign: 'right' }}>{renderAmountCell(row)}</Box>
        ),
      },
      info: {
        headerKey: 'core:info',
        align: 'left',
        widthXs: 'minmax(132px, 1.1fr)',
        widthXl: 'minmax(160px, 1.15fr)',
        minPx: 132,
        renderCell: renderInfoCell,
      },
      pollName: {
        headerKey: 'core:poll_name',
        align: 'left',
        widthXs: 'minmax(120px, 0.9fr)',
        widthXl: 'minmax(150px, 1fr)',
        minPx: 120,
        renderCell: renderPollNameCell,
      },
      fee: {
        headerKey: 'core:fee.fee',
        align: 'right',
        widthXs: 'minmax(76px, 0.55fr)',
        widthXl: 'minmax(92px, 0.62fr)',
        minPx: 76,
        renderCell: renderFeeCell,
      },
      time: {
        headerKey: 'core:time',
        align: 'left',
        widthXs: 'minmax(88px, 0.58fr)',
        widthXl: 'minmax(112px, 0.66fr)',
        minPx: 88,
        renderCell: renderTimeCell,
      },
    };

    const transactionColumnOrder: TransactionColumnId[] = [
      'status',
      'type',
      'creator',
      'identifier',
      'size',
      'recipient',
      'amount',
      'info',
      'pollName',
      'fee',
      'time',
    ];

    const filterColumnSets: Record<string, TransactionColumnId[]> = {
      all: transactionColumnOrder,
      payments: [
        'status',
        'type',
        'creator',
        'recipient',
        'amount',
        'fee',
        'time',
      ],
      arbitrary: [
        'status',
        'type',
        'creator',
        'identifier',
        'size',
        'fee',
        'time',
      ],
      at: ['status', 'type', 'creator', 'recipient', 'amount', 'fee', 'time'],
      group: ['status', 'type', 'creator', 'info', 'fee', 'time'],
      name: ['status', 'type', 'creator', 'info', 'fee', 'time'],
      asset: [
        'status',
        'type',
        'creator',
        'recipient',
        'amount',
        'fee',
        'time',
      ],
      poll: ['status', 'type', 'creator', 'pollName', 'fee', 'time'],
      rewards: [
        'status',
        'type',
        'creator',
        'recipient',
        'info',
        'fee',
        'time',
      ],
    };

    const visibleColumnIds: TransactionColumnId[] = (() => {
      if (isAllFiltersSelected) return transactionColumnOrder;
      const visible = new Set<TransactionColumnId>();
      activeFilterValues.forEach((value) => {
        (filterColumnSets[value] ?? []).forEach((id) => visible.add(id));
      });
      const ordered = transactionColumnOrder.filter((id) => visible.has(id));
      return ordered.length > 0
        ? ordered
        : ['status', 'type', 'creator', 'fee', 'time'];
    })();

    // "Fit" mode: keep min widths only for the compact/numeric columns so they
    // stay readable; let the wide text columns shrink toward 0 (their content
    // already ellipsizes) so every visible column fits without horizontal
    // scrolling and Fee/Time (the rightmost columns) never fall off-screen.
    const fitProtectedColumns = new Set<TransactionColumnId>([
      'status',
      'size',
      'amount',
      'fee',
      'time',
    ]);
    const toFitTrack = (width: string, id: TransactionColumnId) =>
      fitProtectedColumns.has(id)
        ? width
        : width.replace(/minmax\(\d+px,/, 'minmax(0px,');
    const transactionGridColumns = {
      xs: visibleColumnIds
        .map((id) => toFitTrack(transactionColumnConfig[id].widthXs, id))
        .join(' '),
      xl: visibleColumnIds
        .map((id) => toFitTrack(transactionColumnConfig[id].widthXl, id))
        .join(' '),
    };

    const renderTransactionRows = (rows: any[]) => {
      if (!rows || rows.length === 0) {
        return (
          <Box
            sx={{
              bgcolor: 'transparent',
              borderRadius: 1,
              color: 'text.secondary',
              px: 2,
              py: 4,
              textAlign: 'center',
            }}
          >
            <Typography sx={{ fontWeight: 600 }}>
              {t('core:wallet.no_transactions')}
            </Typography>
          </Box>
        );
      }

      const pagedRows =
        rowsPerPage > 0
          ? rows.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
          : rows;

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
            {pagedRows.map((row: any, index: Key) => (
              <Box
                key={row?.signature || index}
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
                    gridTemplateColumns: 'auto minmax(0, 1fr) auto',
                    minWidth: 0,
                  }}
                >
                  <Box sx={{ pt: 0.15 }}>{renderStatusIcon(row)}</Box>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography
                      sx={{
                        color: 'text.primary',
                        fontSize: 13.5,
                        fontWeight: 700,
                        lineHeight: 1.2,
                        minWidth: 0,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {formatTransactionType(row?.type)}
                    </Typography>
                    <CustomWidthTooltip
                      placement="top"
                      title={
                        row?.timestamp
                          ? new Date(row.timestamp).toLocaleString()
                          : t('core:transaction_status.pending_confirmation')
                      }
                    >
                      <Typography
                        sx={{
                          color: 'text.secondary',
                          fontSize: 12,
                          fontWeight: 500,
                          mt: 0.35,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {row?.timestamp ? epochToAgo(row.timestamp) : '-'}
                      </Typography>
                    </CustomWidthTooltip>
                  </Box>
                  <Box sx={{ textAlign: 'right' }}>{renderAmountCell(row)}</Box>
                </Box>

                <Box
                  sx={{
                    display: 'grid',
                    gap: 1,
                    gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
                    minWidth: 0,
                  }}
                >
                  {renderMobileField(
                    t('core:creator', { postProcess: 'capitalizeFirstChar' }),
                    renderAddressCell(row, 'creator')
                  )}
                  {renderMobileField(
                    t('core:recipient', {
                      postProcess: 'capitalizeFirstChar',
                    }),
                    renderAddressCell(row, 'recipient')
                  )}
                </Box>

                <Box
                  sx={{
                    alignItems: 'end',
                    display: 'grid',
                    gap: 1,
                    gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
                    minWidth: 0,
                  }}
                >
                  {renderMobileField(
                    t('core:fee.fee', { postProcess: 'capitalizeFirstChar' }),
                    <Typography
                      sx={{
                        color: 'text.secondary',
                        fontSize: 13,
                        fontWeight: 500,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {row?.fee !== undefined && row?.fee !== null
                        ? `${formatQortFee(row.fee)} QORT`
                        : '-'}
                    </Typography>
                  )}
                  {renderMobileField(
                    t('core:transaction_signature', {
                      postProcess: 'capitalizeFirstChar',
                    }),
                    <Typography
                      title={row?.signature}
                      sx={{
                        color: 'text.secondary',
                        fontSize: 13,
                        fontWeight: 500,
                        minWidth: 0,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {row?.signature ? cropString(row.signature) : '-'}
                    </Typography>
                  )}
                </Box>

                {renderTransactionDetail(row) && (
                  <Box sx={{ minWidth: 0 }}>
                    {renderMobileField(
                      t('core:info', { postProcess: 'capitalizeFirstChar' }),
                      <Box sx={{ minWidth: 0, whiteSpace: 'normal' }}>
                        {renderTransactionDetail(row)}
                      </Box>
                    )}
                  </Box>
                )}
              </Box>
            ))}
          </Box>

          <Box
            sx={{
              display: { xs: 'none', sm: 'block' },
              minWidth: 0,
              width: '100%',
              maxWidth: '100%',
              overflowX: 'auto',
              overflowY: 'hidden',
              overscrollBehaviorX: 'contain',
              pb: 0.75,
              touchAction: 'pan-x pan-y',
              WebkitOverflowScrolling: 'touch',
            }}
          >
            <Box sx={{ width: '100%' }}>
              <Box
                aria-hidden
                sx={{
                  alignItems: 'center',
                  borderBottom: (t) =>
                    `1px solid ${
                      t.palette.mode === 'dark'
                        ? 'rgba(116,158,180,0.15)'
                        : 'rgba(17,24,39,0.08)'
                    }`,
                  display: 'grid',
                  gap: 1,
                  gridTemplateColumns: transactionGridColumns,
                  px: { xs: 1.25, md: 2 },
                  py: 1.15,
                }}
              >
                {visibleColumnIds.map((id) => {
                  const column = transactionColumnConfig[id];
                  return (
                    <Typography
                      key={id}
                      sx={{ ...transactionHeaderSx, textAlign: column.align }}
                    >
                      {t(column.headerKey, {
                        postProcess: 'capitalizeFirstChar',
                      })}
                    </Typography>
                  );
                })}
              </Box>

              <Box sx={{ display: 'grid', gap: 0, px: { md: 0.4 }, py: 0.35 }}>
                {pagedRows.map((row: any, index: Key) => (
                  <Box
                    key={row?.signature || index}
                    sx={{
                      ...transactionRowHoverSx,
                      alignItems: 'center',
                      bgcolor: (t) =>
                        t.palette.mode === 'dark'
                          ? 'rgba(4, 22, 38, 0.16)'
                          : 'rgba(255,255,255,0.58)',
                      borderBottom: (t) =>
                        `1px solid ${
                          t.palette.mode === 'dark'
                            ? 'rgba(116,158,180,0.06)'
                            : 'rgba(17,24,39,0.06)'
                        }`,
                      borderRadius: 0.65,
                      display: 'grid',
                      gap: 1,
                      gridTemplateColumns: transactionGridColumns,
                      minHeight: 46,
                      px: { xs: 1.25, md: 1.6 },
                      py: 0.85,
                      transition:
                        'background-color 150ms ease, border-color 150ms ease',
                    }}
                  >
                    {visibleColumnIds.map((id) => (
                      <Box key={id} sx={{ minWidth: 0 }}>
                        {transactionColumnConfig[id].renderCell(row)}
                      </Box>
                    ))}
                  </Box>
                ))}
              </Box>
            </Box>
          </Box>
          <TablePagination
            component="div"
            labelRowsPerPage={t('core:rows_per_page', {
              postProcess: 'capitalizeFirstChar',
            })}
            rowsPerPageOptions={[5, 10, 25]}
            count={rows.length}
            rowsPerPage={rowsPerPage}
            page={page}
            slotProps={{
              select: {
                MenuProps: {
                  disableScrollLock: true,
                },
              },
            }}
            onPageChange={handleChangePage}
            onRowsPerPageChange={handleChangeRowsPerPage}
            ActionsComponent={TablePaginationActions}
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
    };

    const filterActions = (
      <>
        <Button
          aria-controls={
            advancedFilterOpen ? 'advanced-filter-menu' : undefined
          }
          aria-haspopup="true"
          aria-expanded={advancedFilterOpen ? 'true' : undefined}
          endIcon={<ExpandMore sx={{ fontSize: 18 }} />}
          onClick={handleAdvancedFilterClick}
          size="small"
          variant={isAllFiltersSelected ? 'text' : 'outlined'}
          sx={{
            borderRadius: 1,
            color: isAllFiltersSelected ? 'text.secondary' : 'primary.main',
            fontSize: 13,
            fontWeight: 700,
            minHeight: 34,
            px: 1,
            whiteSpace: 'nowrap',
            '& .MuiButton-endIcon': {
              ml: 0.65,
            },
          }}
        >
          {isAllFiltersSelected
            ? t('core:filters.advanced')
            : selectedFilterLabel}
        </Button>
        <Menu
          id="advanced-filter-menu"
          anchorEl={advancedFilterAnchor}
          anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
          open={advancedFilterOpen}
          onClose={handleAdvancedFilterClose}
          transformOrigin={{ horizontal: 'right', vertical: 'top' }}
          disableScrollLock
          slotProps={{
            paper: {
              sx: {
                maxWidth: 'calc(100vw - 32px)',
                mt: 0.5,
                minWidth: 180,
                overflowX: 'hidden',
              },
            },
          }}
        >
          {filters.map((filter) => (
            <MenuItem
              key={filter.value}
              onClick={() => handleAdvancedFilterSelect(filter.value)}
              sx={{
                gap: 2,
                justifyContent: 'space-between',
                minWidth: 220,
              }}
            >
              <Typography sx={{ fontWeight: 600 }}>{filter.label}</Typography>
              <Checkbox
                checked={
                  filter.value === 'all'
                    ? isAllFiltersSelected
                    : activeFilterValues.includes(filter.value)
                }
                edge="end"
                size="small"
                tabIndex={-1}
                sx={{ ml: 'auto', p: 0.25 }}
              />
            </MenuItem>
          ))}
        </Menu>
      </>
    );

    return {
      actions: filterActions,
      content: (
        <Box sx={{ pt: 0.75, width: '100%' }}>
          {renderTransactionRows(selectedRows)}
        </Box>
      ),
    };
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

  const qortAddress = address ?? EMPTY_STRING;
  const qortAddressBookNeedsSync = qortAddressBookSyncStatus === 'dirty';
  const qortAddressBookNeedsAttention =
    qortAddressBookNeedsSync || qortAddressBookSyncStatus === 'error';
  const syncStatusLabel = qortAddressBookSyncing
    ? 'Syncing...'
    : qortAddressBookNeedsSync
      ? 'Sync required'
      : qortAddressBookSyncStatus === 'error'
        ? 'Sync failed'
        : 'Up to date';
  const syncStatusTooltip = qortAddressBookNeedsSync
    ? 'Local contacts changed. Sync to publish the latest encrypted address book backup.'
    : qortAddressBookSyncStatus === 'error'
      ? 'The last sync did not complete.'
      : qortAddressBookSyncStatus === 'success' && qortAddressBookLastSync
        ? `Last sync: ${new Intl.DateTimeFormat(undefined, {
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            month: 'short',
            year: 'numeric',
          }).format(new Date(qortAddressBookLastSync))}`
        : syncStatusLabel;
  const qortalTableView = openQortSend
    ? { actions: null, content: null }
    : qortalTables();
  const qortSendLabelSx = {
    color: (t: Theme) =>
      t.palette.mode === 'dark' ? 'rgba(228,238,248,0.9)' : 'text.primary',
    fontSize: { xs: 14.5, md: 15 },
    fontWeight: 700,
    lineHeight: 1.2,
  } as const;
  const qortSendHelperSx = {
    color: 'text.secondary',
    fontSize: { xs: 12.5, md: 13 },
    fontWeight: 500,
    lineHeight: 1.45,
    ml: 1.6,
    mt: 0.85,
  } as const;
  const qortSendFieldSx = {
    '& .MuiFormHelperText-root': qortSendHelperSx,
    '& .MuiOutlinedInput-root': {
      bgcolor: (t: Theme) =>
        t.palette.mode === 'dark'
          ? 'rgba(0,8,16,0.2)'
          : 'rgba(255,255,255,0.72)',
      borderRadius: 1.35,
      minHeight: { xs: 54, md: 56 },
      px: { xs: 1.2, md: 1.35 },
      transition: 'background-color 160ms ease',
      '& fieldset': {
        borderColor: (t: Theme) =>
          t.palette.mode === 'dark'
            ? 'rgba(116,158,180,0.15)'
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
      fontSize: { xs: 15.5, md: 16 },
      fontWeight: 500,
      py: 0,
      '&::placeholder': {
        color: 'text.secondary',
        fontWeight: 400,
        opacity: 0.58,
      },
    },
  } as const;
  const qortSendInfoIconSx = {
    color: 'text.secondary',
    fontSize: { xs: 14.5, md: 15 },
    opacity: 0.82,
  } as const;
  const qortRecipientInitials =
    qortRecipientDisplayName
      .split(' ')
      .filter(Boolean)
      .map((part) => part[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || Coin.QORT[0];
  const qortRecipientAvatarColor = getAddressBookAvatarColor(
    `${qortRecipientDisplayName}-${qortRecipient}`
  );
  const qortSendConfirming =
    addressValidating && recipientTouched && qortRecipient !== EMPTY_STRING;

  return (
    <Box sx={{ width: '100%', mt: 2 }}>
      <WalletSendDialog
        open={openQortSend}
        onClose={handleCloseQortSend}
        slots={{ transition: Transition }}
        maxWidth={false}
        fullWidth
        disableAutoFocus
        disableRestoreFocus
        disableScrollLock
        slotProps={{
          paper: {
            sx: {
              '&&': {
                backgroundColor: (t: Theme) =>
                  t.palette.mode === 'dark'
                    ? 'rgba(3, 17, 29, 0.985)'
                    : '#ffffff',
                backgroundImage: (t: Theme) =>
                  t.palette.mode === 'dark'
                    ? 'radial-gradient(circle at 13% 6%, rgba(24,189,242,0.13), transparent 30%), linear-gradient(180deg, rgba(5,24,39,0.99) 0%, rgba(3,13,23,0.995) 100%)'
                    : 'radial-gradient(circle at 13% 6%, rgba(11,143,211,0.12), transparent 30%), linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(246,251,253,0.99) 100%)',
                border: (t: Theme) =>
                  t.palette.mode === 'dark'
                    ? '1px solid rgba(91,132,158,0.28)'
                    : '1px solid rgba(11,143,211,0.14)',
                boxShadow: (t: Theme) =>
                  t.palette.mode === 'dark'
                    ? '0 28px 72px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.04)'
                    : '0 24px 70px rgba(15,74,106,0.18), inset 0 1px 0 rgba(255,255,255,0.9)',
              },
              backgroundColor: (t: Theme) =>
                t.palette.mode === 'dark'
                  ? 'rgba(3, 17, 29, 0.985)'
                  : '#ffffff',
              backgroundImage: (t: Theme) =>
                t.palette.mode === 'dark'
                  ? 'radial-gradient(circle at 13% 6%, rgba(24,189,242,0.13), transparent 30%), linear-gradient(180deg, rgba(5,24,39,0.99) 0%, rgba(3,13,23,0.995) 100%)'
                  : 'radial-gradient(circle at 13% 6%, rgba(11,143,211,0.12), transparent 30%), linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(246,251,253,0.99) 100%)',
              border: (t: Theme) =>
                t.palette.mode === 'dark'
                  ? '1px solid rgba(91,132,158,0.28)'
                  : '1px solid rgba(11,143,211,0.14)',
              borderRadius: 2,
              boxShadow: (t: Theme) =>
                t.palette.mode === 'dark'
                  ? '0 28px 72px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.04)'
                  : '0 24px 70px rgba(15,74,106,0.18), inset 0 1px 0 rgba(255,255,255,0.9)',
              minHeight: 'min(590px, calc(100dvh - 32px))',
              width: 'min(592px, calc(100vw - 24px))',
            },
          },
        }}
      >
        <SubmitDialog
          fullWidth={true}
          maxWidth="xs"
          open={openTxQortSubmit}
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
          open={openSendQortSuccess}
          autoHideDuration={TIME_SECONDS_4}
          slots={{ transition: SlideTransition }}
          onClose={handleCloseSendQortSuccess}
        >
          <Alert
            onClose={handleCloseSendQortSuccess}
            severity="success"
            variant="filled"
            sx={{ width: '100%' }}
          >
            {t('core:message.generic.sent_transaction', {
              coin: Coin.QORT,
              postProcess: 'capitalizeAll',
            })}
          </Alert>
        </Snackbar>
        <Snackbar
          open={openSendQortError}
          autoHideDuration={TIME_SECONDS_4}
          onClose={handleCloseSendQortError}
        >
          <Alert
            onClose={handleCloseSendQortError}
            severity="error"
            variant="filled"
            sx={{ width: '100%' }}
          >
            {t('core:message.error.something_went_wrong', {
              postProcess: 'capitalizeAll',
            })}
          </Alert>
        </Snackbar>
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
              px: { xs: 2.35, md: 2.55 },
            }}
          >
            <IconButton
              color="inherit"
              onClick={handleCloseQortSend}
              aria-label="close"
              sx={{
                color: 'text.secondary',
                mr: { xs: 1.25, md: 1.45 },
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
                bgcolor: 'primary.main',
                boxShadow: '0 0 20px rgba(24,189,242,0.24)',
                height: { xs: 34, md: 36 },
                mr: { xs: 1.65, md: 1.8 },
                width: { xs: 34, md: 36 },
              }}
              alt="QORT Logo"
              src={coinLogoQORT}
            />
            <Typography
              variant="h6"
              noWrap
              component="div"
              sx={{
                color: 'text.primary',
                flexGrow: 1,
                fontSize: { xs: 18, md: 19 },
                fontWeight: 700,
                letterSpacing: 0,
                lineHeight: 1,
              }}
            >
              {t('core:action.transfer_coin', {
                coin: Coin.QORT,
                postProcess: 'capitalizeFirstChar',
              })}
            </Typography>
            <Button
              disabled={sendDisabled}
              variant="contained"
              startIcon={
                qortSendConfirming ? (
                  <CircularProgress color="inherit" size={16} thickness={4.2} />
                ) : (
                  <NorthEast />
                )
              }
              aria-label="send-qort"
              onClick={sendQortRequest}
              sx={{
                bgcolor: '#0a9eff',
                backgroundImage:
                  'linear-gradient(180deg, rgba(24,174,255,0.98), rgba(4,126,220,0.98))',
                border: '1px solid rgba(85,205,255,0.32)',
                borderRadius: 1.4,
                boxShadow:
                  '0 10px 26px rgba(3,139,236,0.34), inset 0 1px 0 rgba(255,255,255,0.18)',
                color: 'white',
                fontSize: { xs: 14, md: 14.5 },
                fontWeight: 700,
                justifySelf: 'end',
                minHeight: { xs: 38, md: 40 },
                minWidth: qortSendConfirming
                  ? { xs: 126, md: 134 }
                  : { xs: 92, md: 98 },
                px: { xs: 1.65, md: 1.9 },
                transition:
                  'min-width 180ms ease, background-color 160ms ease, box-shadow 160ms ease',
                '& .MuiButton-startIcon svg': {
                  fontSize: 19,
                },
                '&:hover': {
                  bgcolor: '#16baf2',
                  boxShadow: '0 18px 44px rgba(24,189,242,0.38)',
                },
                '&:disabled': {
                  bgcolor: qortSendConfirming
                    ? 'rgba(24,158,255,0.56)'
                    : 'rgba(116,158,180,0.18)',
                  backgroundImage: qortSendConfirming
                    ? 'linear-gradient(180deg, rgba(24,174,255,0.72), rgba(4,126,220,0.72))'
                    : 'none',
                  borderColor: qortSendConfirming
                    ? 'rgba(85,205,255,0.22)'
                    : 'rgba(116,158,180,0.1)',
                  boxShadow: qortSendConfirming
                    ? '0 10px 24px rgba(3,139,236,0.16), inset 0 1px 0 rgba(255,255,255,0.08)'
                    : 'none',
                  color: qortSendConfirming
                    ? 'rgba(255,255,255,0.78)'
                    : 'rgba(255,255,255,0.44)',
                },
              }}
            >
              {qortSendConfirming
                ? t('core:action.confirming', {
                    postProcess: 'capitalizeFirstChar',
                  })
                : t('core:action.send', {
                    postProcess: 'capitalizeFirstChar',
                  })}
            </Button>
          </Toolbar>
        </AppBar>
        <Box
          sx={{
            display: 'grid',
            gap: { xs: 2.85, md: 3.05 },
            minHeight: { xs: 472, md: 484 },
            px: { xs: 2.75, md: 3 },
            pb: { xs: 2.85, md: 3 },
            pt: { xs: 0.4, md: 0.55 },
          }}
        >
          <Box sx={{ display: 'grid', gap: 0.85 }}>
            <Typography sx={qortSendLabelSx}>{t('core:send.to')}</Typography>
            {qortRecipientDisplayName ? (
              <>
                <Box
                  sx={{
                    bgcolor: (t: Theme) =>
                      t.palette.mode === 'dark'
                        ? 'rgba(0,8,16,0.18)'
                        : 'rgba(255,255,255,0.76)',
                    border: (t: Theme) =>
                      t.palette.mode === 'dark'
                        ? '1px solid rgba(116,158,180,0.15)'
                        : '1px solid rgba(11,143,211,0.16)',
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
                      minHeight: { xs: 70, md: 72 },
                      px: { xs: 1.65, md: 1.75 },
                      py: { xs: 0.85, md: 0.95 },
                    }}
                  >
                    <Avatar
                      sx={{
                        ...getAddressBookAvatarSx(qortRecipientAvatarColor),
                        fontSize: { xs: 13, md: 13.5 },
                        fontWeight: 700,
                        height: { xs: 42, md: 44 },
                        width: { xs: 42, md: 44 },
                      }}
                    >
                      {qortRecipientInitials}
                    </Avatar>
                    <Box sx={{ display: 'grid', gap: 0.35, minWidth: 0 }}>
                      <NameText
                        noWrap
                        name={qortRecipientDisplayName}
                        sx={{
                          color: 'text.primary',
                          fontSize: { xs: 18, md: 18.5 },
                          fontWeight: 700,
                          lineHeight: 1.05,
                        }}
                      />
                      <Typography
                        noWrap
                        sx={{
                          color: 'text.secondary',
                          fontSize: { xs: 13.2, md: 13.6 },
                          fontWeight: 500,
                          lineHeight: 1,
                        }}
                      >
                        {t('core:wallet.qortal_user')}
                      </Typography>
                    </Box>
                    <IconButton
                      aria-label={t('core:action.clear_recipient')}
                      onClick={handleClearQortRecipient}
                      sx={{
                        color: 'text.secondary',
                        height: { xs: 32, md: 34 },
                        width: { xs: 32, md: 34 },
                        '& svg': { fontSize: { xs: 20, md: 21 } },
                        '&:hover': {
                          bgcolor: 'rgba(116,158,180,0.08)',
                          color: 'text.primary',
                        },
                      }}
                    >
                      <Close />
                    </IconButton>
                    <IconButton
                      aria-label={t('core:action.open_address_book')}
                      onClick={handleOpenAddressBook}
                      sx={{
                        border: '1px solid rgba(116,158,180,0.12)',
                        borderRadius: 1.2,
                        color: 'primary.main',
                        height: { xs: 34, md: 36 },
                        width: { xs: 34, md: 36 },
                        '&:hover': {
                          bgcolor: 'rgba(24,189,242,0.08)',
                          borderColor: 'rgba(24,189,242,0.34)',
                          color: '#37d0ff',
                        },
                      }}
                    >
                      <PersonOutline sx={{ fontSize: { xs: 19, md: 20 } }} />
                    </IconButton>
                  </Box>
                  <Box
                    sx={{
                      alignItems: 'center',
                      borderTop: (t: Theme) =>
                        t.palette.mode === 'dark'
                          ? '1px solid rgba(116,158,180,0.115)'
                          : '1px solid rgba(11,143,211,0.12)',
                      display: 'flex',
                      gap: 0.85,
                      minHeight: { xs: 40, md: 42 },
                      minWidth: 0,
                      px: { xs: 1.65, md: 1.75 },
                      py: 0.65,
                    }}
                  >
                    <Typography
                      sx={{
                        color: 'text.secondary',
                        flexShrink: 0,
                        fontSize: { xs: 13, md: 13.5 },
                        fontWeight: 600,
                      }}
                    >
                      {t('core:send.address_label')}
                    </Typography>
                    <Typography
                      noWrap
                      sx={{
                        color: 'text.secondary',
                        fontSize: { xs: 13, md: 13.5 },
                        fontWeight: 500,
                        minWidth: 0,
                      }}
                    >
                      {qortRecipient}
                    </Typography>
                  </Box>
                </Box>
                {recipientTouched && recipientError ? (
                  <Typography
                    sx={{
                      ...qortSendHelperSx,
                      color: 'error.main',
                    }}
                  >
                    {recipientError}
                  </Typography>
                ) : null}
              </>
            ) : (
              <ClickAwayListener
                onClickAway={() => setQortNameSearchOpen(false)}
              >
                <Box sx={{ position: 'relative' }}>
                  <TextField
                    required
                    autoComplete="new-password"
                    id="qort-recipient-manual"
                    placeholder={t('core:send.qort_address_or_name')}
                    value={qortRecipient}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                      const input = e.currentTarget;
                      setQortRecipientDisplayName(EMPTY_STRING);
                      setQortRecipient(e.target.value);
                      setQortNameSearchOpen(false);
                      setRecipientTouched(true);
                      window.requestAnimationFrame(() => {
                        if (document.activeElement === input) {
                          const end = input.value.length;
                          input.setSelectionRange(end, end);
                        }
                      });
                    }}
                    onBlur={onRecipientBlur}
                    onFocus={(e: React.FocusEvent<HTMLInputElement>) => {
                      const input = e.currentTarget;
                      if (qortNameSuggestions.length > 0) {
                        setQortNameSearchOpen(true);
                      }
                      window.requestAnimationFrame(() => {
                        const end = input.value.length;
                        input.setSelectionRange(end, end);
                      });
                    }}
                    slotProps={{
                      htmlInput: {
                        'aria-label': t('core:send.receiver_address_or_name'),
                        autoCapitalize: 'none',
                        autoComplete: 'new-password',
                        autoCorrect: 'off',
                        minLength: 3,
                        name: 'qort-recipient-manual-no-autofill',
                        spellCheck: false,
                      },
                      input: {
                        endAdornment: (
                          <InputAdornment position="end">
                            <IconButton
                              aria-label={t('core:action.open_address_book')}
                              onClick={handleOpenAddressBook}
                              sx={{
                                border: '1px solid rgba(116,158,180,0.12)',
                                borderRadius: 1,
                                color: 'primary.main',
                                height: { xs: 31, md: 32 },
                                ml: { xs: 0.8, md: 1 },
                                width: { xs: 31, md: 32 },
                                '&:hover': {
                                  bgcolor: 'rgba(24,189,242,0.08)',
                                  borderColor: 'rgba(24,189,242,0.34)',
                                  color: '#37d0ff',
                                },
                              }}
                            >
                              <PersonOutline
                                sx={{ fontSize: { xs: 18, md: 19 } }}
                              />
                            </IconButton>
                          </InputAdornment>
                        ),
                      },
                    }}
                    fullWidth
                    helperText={
                      recipientTouched && recipientError
                        ? recipientError
                        : undefined
                    }
                    error={recipientTouched && !!recipientError}
                    sx={{
                      ...qortSendFieldSx,
                      '& .MuiFormHelperText-root': {
                        ...qortSendHelperSx,
                        color:
                          recipientTouched && recipientError
                            ? 'error.main'
                            : 'text.secondary',
                      },
                    }}
                  />
                  {qortNameSearchOpen && qortNameSuggestions.length > 0 ? (
                    <Box
                      sx={{
                        bgcolor: (t: Theme) =>
                          t.palette.mode === 'dark'
                            ? 'rgba(5, 16, 27, 0.98)'
                            : 'rgba(255,255,255,0.98)',
                        border: (t: Theme) =>
                          t.palette.mode === 'dark'
                            ? '1px solid rgba(116,158,180,0.2)'
                            : '1px solid rgba(11,143,211,0.18)',
                        borderRadius: 1,
                        boxShadow: (t: Theme) =>
                          t.palette.mode === 'dark'
                            ? '0 18px 40px rgba(0,0,0,0.32)'
                            : '0 18px 40px rgba(15,74,106,0.16)',
                        left: 0,
                        maxHeight: 216,
                        overflowY: 'auto',
                        position: 'absolute',
                        right: 0,
                        top: 'calc(100% + 6px)',
                        zIndex: 1500,
                      }}
                    >
                      {qortNameSuggestions.map((suggestion) => (
                        <Box
                          component="button"
                          type="button"
                          key={`${suggestion.name}-${suggestion.owner}`}
                          onClick={() =>
                            handleSelectQortNameSuggestion(suggestion)
                          }
                          sx={{
                            alignItems: 'center',
                            appearance: 'none',
                            bgcolor: 'transparent',
                            border: 0,
                            color: 'text.primary',
                            cursor: 'pointer',
                            display: 'grid',
                            font: 'inherit',
                            gap: 0.35,
                            justifyItems: 'start',
                            px: 2,
                            py: 1.1,
                            textAlign: 'left',
                            width: '100%',
                            '&:hover': {
                              bgcolor: 'rgba(24,189,242,0.08)',
                            },
                          }}
                        >
                          <NameText
                            component="span"
                            name={suggestion.name}
                            sx={{ fontSize: 14, fontWeight: 700 }}
                          />
                          <Typography
                            sx={{
                              color: 'text.secondary',
                              fontSize: 12,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              width: '100%',
                            }}
                          >
                            {suggestion.owner}
                          </Typography>
                        </Box>
                      ))}
                    </Box>
                  ) : null}
                </Box>
              </ClickAwayListener>
            )}
          </Box>

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
              <Typography sx={qortSendLabelSx}>{t('core:amount')}</Typography>
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
                    <InfoOutlined sx={qortSendInfoIconSx} />
                    <Typography
                      sx={{
                        color: 'text.secondary',
                        fontSize: { xs: 13.2, md: 13.6 },
                        fontWeight: 500,
                        lineHeight: 1.2,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {isLoadingWalletBalanceQort
                        ? t('core:send.max_sendable_loading')
                        : t('core:send.max_sendable', {
                            amount: formatQortAmount(maxSendableQortCoin()),
                            symbol: 'QORT',
                          })}
                    </Typography>
                  </Box>
                </Tooltip>
                <Button
                  variant="text"
                  onClick={handleSendMaxQort}
                  sx={{
                    color: 'primary.main',
                    fontSize: { xs: 13.8, md: 14.2 },
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
                  {t('core:max')}
                </Button>
              </Box>
            </Box>
            <NumericFormat
              decimalScale={8}
              defaultValue={0}
              value={
                qortAmount === 0 ? EMPTY_STRING : (qortAmount ?? EMPTY_STRING)
              }
              allowNegative={false}
              customInput={TextField as React.ComponentType<any>}
              valueIsNumericString
              placeholder="0.00"
              fullWidth
              isAllowed={(values) => {
                const max = maxSendableQortCoin();
                const { formattedValue, floatValue } = values;
                return (
                  formattedValue === EMPTY_STRING || (floatValue ?? 0) <= max
                );
              }}
              onValueChange={onAmountChange}
              onBlur={onAmountBlur}
              required
              helperText={
                amountTouched && amountError ? amountError : undefined
              }
              error={amountTouched && !!amountError}
              slotProps={{
                htmlInput: {
                  'aria-label': t('core:send.symbol_amount', {
                    symbol: 'QORT',
                  }),
                },
                input: {
                  endAdornment: (
                    <InputAdornment position="end">
                      <Typography
                        sx={{
                          color: 'text.secondary',
                          fontSize: { xs: 14.5, md: 15 },
                          fontWeight: 700,
                          letterSpacing: 0,
                          lineHeight: 1,
                        }}
                      >
                        QORT
                      </Typography>
                    </InputAdornment>
                  ),
                },
              }}
              sx={{
                ...qortSendFieldSx,
                '& .MuiFormHelperText-root': {
                  ...qortSendHelperSx,
                  color:
                    amountTouched && amountError
                      ? 'error.main'
                      : 'text.secondary',
                },
                '& .MuiOutlinedInput-root': {
                  ...qortSendFieldSx['& .MuiOutlinedInput-root'],
                  bgcolor: (t: Theme) =>
                    t.palette.mode === 'dark'
                      ? 'rgba(0,8,16,0.2)'
                      : 'rgba(255,255,255,0.86)',
                  borderRadius: 1.55,
                  minHeight: { xs: 54, md: 56 },
                  px: { xs: 1.45, md: 1.6 },
                  '& fieldset': {
                    borderColor:
                      amountTouched && amountError
                        ? 'error.main'
                        : 'rgba(24,158,255,0.9)',
                    boxShadow:
                      amountTouched && amountError
                        ? 'none'
                        : '0 0 18px rgba(24,158,255,0.18)',
                  },
                  '&:hover fieldset': {
                    borderColor:
                      amountTouched && amountError
                        ? 'error.main'
                        : 'rgba(24,174,255,0.96)',
                  },
                },
                '& .MuiOutlinedInput-input': {
                  color: 'text.primary',
                  fontSize: { xs: 23, md: 24 },
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

          <Tooltip title={t('core:send.network_fee_max_tooltip')}>
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
              <InfoOutlined sx={qortSendInfoIconSx} />
              <Typography
                sx={{
                  fontSize: { xs: 12.5, md: 13 },
                  fontWeight: 500,
                }}
              >
                {t('core:send.network_fee')}
              </Typography>
              <Typography
                sx={{
                  color: 'text.primary',
                  fontSize: { xs: 14, md: 14.5 },
                  fontWeight: 700,
                  textAlign: 'right',
                  whiteSpace: 'nowrap',
                }}
              >
                {formatQortAmount(qortTxFee)} QORT
              </Typography>
            </Box>
          </Tooltip>

          <Box
            sx={{
              alignItems: 'flex-start',
              bgcolor: (t: Theme) =>
                t.palette.mode === 'dark'
                  ? 'rgba(8, 57, 52, 0.34)'
                  : 'rgba(232, 248, 241, 0.9)',
              border: (t: Theme) =>
                t.palette.mode === 'dark'
                  ? '1px solid rgba(34, 227, 138, 0.11)'
                  : '1px solid rgba(26, 140, 86, 0.18)',
              borderRadius: 1.55,
              display: 'flex',
              gap: 1.6,
              mt: 0.1,
              px: { xs: 1.7, md: 1.85 },
              py: { xs: 2.05, md: 2.2 },
            }}
          >
            <ShieldOutlined
              sx={{ color: 'success.main', fontSize: { xs: 29, md: 31 } }}
            />
            <Box sx={{ display: 'grid', gap: 0.35 }}>
              <Typography
                sx={{
                  color: 'text.primary',
                  fontSize: { xs: 13.5, md: 14 },
                  fontWeight: 700,
                  lineHeight: 1.25,
                }}
              >
                Always double-check the address before sending.
              </Typography>
              <Typography
                sx={{
                  color: 'text.secondary',
                  fontSize: { xs: 12.8, md: 13.2 },
                  fontWeight: 400,
                  lineHeight: 1.35,
                }}
              >
                Transactions on the Qortal network are irreversible.
              </Typography>
            </Box>
          </Box>

          <Box
            sx={{
              alignItems: 'center',
              bgcolor: (t: Theme) =>
                t.palette.mode === 'dark'
                  ? 'rgba(0,8,16,0.12)'
                  : 'rgba(246,250,252,0.78)',
              border: (t: Theme) =>
                t.palette.mode === 'dark'
                  ? '1px solid rgba(116,158,180,0.09)'
                  : '1px solid rgba(11,143,211,0.12)',
              borderRadius: 1.35,
              color: 'text.secondary',
              display: 'flex',
              gap: 0.75,
              justifyContent: 'center',
              minHeight: { xs: 40, md: 42 },
              mt: -0.1,
              px: 1.4,
            }}
          >
            <LockOutlined sx={{ fontSize: { xs: 14, md: 15 } }} />
            <Typography
              sx={{
                color: 'text.secondary',
                fontSize: { xs: 12.5, md: 13 },
                fontWeight: 600,
                lineHeight: 1,
                textAlign: 'center',
              }}
            >
              Secure &bull; Decentralized
            </Typography>
          </Box>
        </Box>
      </WalletSendDialog>

      <AddressBookDialog
        open={openQortAddressBook}
        onClose={handleCloseAddressBook}
        coinType={Coin.QORT}
        onSelectAddress={handleSelectAddress}
        onAddressBookChange={handleQortAddressBookChange}
        prefillData={addressBookPrefill}
      />

      <WalletWorkspace
        address={qortAddress}
        addressBookRefreshKey={`${openQortAddressBook}-${qortAddressBookEntries.length}-${qortAddressBookSyncStatus}`}
        balance={walletBalanceQort}
        balanceDecimals={2}
        coin="QORT"
        isBalanceLoading={isLoadingWalletBalanceQort}
        noAddressLabel={t('core:message.generic.no_address', {
          postProcess: 'capitalizeFirstChar',
        })}
        onAddContact={handleOpenAddressBook}
        onAddressBookChange={handleQortAddressBookChange}
        onSelectAddress={handleSelectAddress}
        onSend={handleOpenQortSend}
        onToggleReceive={handleToggleReceivePanel}
        receiveOpen={receivePanelOpen}
        rightColumnAfter={
          <WalletSyncCard
            isSyncing={qortAddressBookSyncing}
            onSync={handleSyncQortAddressBook}
            statusLabel={syncStatusLabel}
            statusTone={qortAddressBookNeedsAttention ? 'error' : 'success'}
            statusTooltip={syncStatusTooltip}
          />
        }
        transactions={
          <WalletTransactionsCard
            actions={qortalTableView.actions}
            isRefreshing={loadingRefreshQort}
            onRefresh={handleLoadingRefreshQort}
          >
            <Box
              sx={{
                alignItems: loadingRefreshQort ? 'center' : undefined,
                display: loadingRefreshQort ? 'grid' : 'block',
                minHeight: rowsPerPage === 10 ? { md: 548 } : undefined,
                minWidth: 0,
                maxWidth: '100%',
              }}
            >
              {loadingRefreshQort ? tableLoader() : qortalTableView.content}
            </Box>
          </WalletTransactionsCard>
        }
      />
    </Box>
  );
}
