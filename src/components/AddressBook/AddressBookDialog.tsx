import React, { useState, useEffect } from 'react';
import {
  Dialog,
  AppBar,
  Toolbar,
  Typography,
  IconButton,
  DialogContent,
  TextField,
  Box,
  Button,
  InputAdornment,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import { Add, Close, Search } from '@mui/icons-material';
import type { Theme } from '@mui/material/styles';
import { Coin } from 'qapp-core';
import { useTranslation } from 'react-i18next';
import { Transition } from '../../styles/page-styles';
import { AddressBookCoin, AddressBookEntry } from '../../utils/Types';
import {
  getAddressBook,
  searchAddresses,
  deleteAddress,
  addAddress,
  updateAddress,
  moveAddressBookEntry,
  toggleAddressBookFavorite,
} from '../../utils/addressBookStorage';
import { AddressBookTable } from './AddressBookTable';
import { AddressFormDialog } from './AddressFormDialog';
import { DeleteConfirmationDialog } from './DeleteConfirmationDialog';
import {
  EMPTY_STRING,
  ADDRESSBOOK_ROWS_PER_PAGE,
} from '../../common/constants';
import coinLogoARRR from '../../assets/arrr.png';
import coinLogoBTC from '../../assets/btc.png';
import coinLogoDGB from '../../assets/dgb.png';
import coinLogoDOGE from '../../assets/doge.png';
import coinLogoLTC from '../../assets/ltc.png';
import coinLogoQORT from '../../assets/qort.png';
import coinLogoRVN from '../../assets/rvn.png';
import coinLogoXMR from '../../assets/wallet-renders/xmr-coin-render.svg';

const coinLogos: Partial<Record<AddressBookCoin, string>> = {
  [Coin.ARRR]: coinLogoARRR,
  [Coin.BTC]: coinLogoBTC,
  [Coin.DGB]: coinLogoDGB,
  [Coin.DOGE]: coinLogoDOGE,
  [Coin.LTC]: coinLogoLTC,
  [Coin.QORT]: coinLogoQORT,
  [Coin.RVN]: coinLogoRVN,
  XMR: coinLogoXMR,
};

interface AddressBookDialogProps {
  open: boolean;
  onClose: () => void;
  coinType: AddressBookCoin;
  onSelectAddress?: (address: string, name: string) => void;
  onAddressBookChange?: () => void;
  prefillData?: { name: string; address: string } | null;
}

export const AddressBookDialog: React.FC<AddressBookDialogProps> = ({
  open,
  onClose,
  coinType,
  onSelectAddress,
  onAddressBookChange,
  prefillData,
}) => {
  const { t } = useTranslation(['core']);
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));
  const coinLogo = coinLogos[coinType] || coinLogoQORT;

  const [entries, setEntries] = useState<AddressBookEntry[]>([]);
  const [searchQuery, setSearchQuery] = useState(EMPTY_STRING);
  const [openForm, setOpenForm] = useState(false);
  const [openDeleteConfirm, setOpenDeleteConfirm] = useState(false);
  const [editingEntry, setEditingEntry] = useState<
    AddressBookEntry | undefined
  >(undefined);
  const [deletingEntry, setDeletingEntry] = useState<
    AddressBookEntry | undefined
  >(undefined);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(ADDRESSBOOK_ROWS_PER_PAGE);
  const [saveError, setSaveError] = useState<string>(EMPTY_STRING);

  // Load entries when dialog opens or coinType changes
  useEffect(() => {
    if (open) {
      setPage(0);
      loadEntries();
    }
  }, [open, coinType]);

  // Open form with prefilled data when prefillData is provided
  useEffect(() => {
    if (open && prefillData) {
      // Don't set editingEntry, just open the form
      // The prefill data will be passed as props to AddressFormDialog
      setEditingEntry(undefined);
      setOpenForm(true);
    }
  }, [open, prefillData]);

  // Filter entries when search query changes
  useEffect(() => {
    if (searchQuery.trim()) {
      const filtered = searchAddresses(coinType, searchQuery);
      setEntries(filtered);
    } else {
      loadEntries();
    }
    // Reset to first page when search query changes
    setPage(0);
  }, [searchQuery, coinType]);

  const loadEntries = (query = searchQuery) => {
    const allEntries = query.trim()
      ? searchAddresses(coinType, query)
      : getAddressBook(coinType);
    setEntries(allEntries);
    return allEntries;
  };

  const handleAddNew = () => {
    setEditingEntry(undefined);
    setSaveError(EMPTY_STRING);
    setOpenForm(true);
  };

  const handleEdit = (entry: AddressBookEntry) => {
    setEditingEntry(entry);
    setSaveError(EMPTY_STRING);
    setOpenForm(true);
  };

  const handleDeleteClick = (entry: AddressBookEntry) => {
    setDeletingEntry(entry);
    setOpenDeleteConfirm(true);
  };

  const handleDeleteConfirm = () => {
    if (deletingEntry) {
      const deleted = deleteAddress(deletingEntry.id, coinType);
      if (deleted) {
        loadEntries();
        onAddressBookChange?.();
        if (editingEntry?.id === deletingEntry.id) {
          setOpenForm(false);
        }
      }
      setOpenDeleteConfirm(false);
      setDeletingEntry(undefined);

      // Adjust page if we deleted the last item on the current page
      if (deleted) {
        const newTotalEntries = entries.length - 1;
        const maxPage = Math.max(
          0,
          Math.ceil(newTotalEntries / rowsPerPage) - 1
        );
        if (page > maxPage) {
          setPage(maxPage);
        }
      }
    }
  };

  const handleDeleteCancel = () => {
    setOpenDeleteConfirm(false);
    setDeletingEntry(undefined);
  };

  const handleSave = (entry: Omit<AddressBookEntry, 'id' | 'createdAt'>) => {
    try {
      let savedEntry: AddressBookEntry | null;
      if (editingEntry) {
        // Update existing entry
        savedEntry = updateAddress(editingEntry.id, coinType, {
          name: entry.name,
          address: entry.address,
          note: entry.note,
        });
      } else {
        // Add new entry
        savedEntry = addAddress(entry);
      }

      if (!savedEntry) {
        throw new Error(t('core:message.error.something_went_wrong'));
      }

      loadEntries();
      setOpenForm(false);
      setSaveError(EMPTY_STRING);
      onAddressBookChange?.();
    } catch (error: any) {
      console.error('Error saving address:', error);
      // Set the error message to display in the form
      const errorMessage =
        error?.message || t('core:message.error.something_went_wrong');
      setSaveError(
        errorMessage === 'Address already exists in the address book'
          ? t('core:message.error.address_already_exists')
          : errorMessage
      );
    }
  };

  const handleFormClose = () => {
    setOpenForm(false);
    setSaveError(EMPTY_STRING);
  };

  const handleFormExited = () => {
    setEditingEntry(undefined);
    setSaveError(EMPTY_STRING);
  };

  const handleUse = (entry: AddressBookEntry) => {
    if (onSelectAddress) {
      console.log(`Address Book: Using address ${entry.name} for ${coinType}`);
      onSelectAddress(entry.address, entry.name);
    }
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  };

  const handlePageChange = (_event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleRowsPerPageChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const handleToggleFavorite = (entry: AddressBookEntry) => {
    const updatedEntries = toggleAddressBookFavorite(entry.id, coinType);
    if (updatedEntries) {
      loadEntries();
      onAddressBookChange?.();
      setPage(0);
    }
  };

  const handleReorder = (sourceId: string, targetId: string) => {
    const updatedEntries = moveAddressBookEntry(coinType, sourceId, targetId);
    if (updatedEntries) {
      loadEntries();
      onAddressBookChange?.();
    }
  };

  return (
    <>
      <Dialog
        fullScreen={fullScreen}
        open={open}
        onClose={onClose}
        slots={{ transition: Transition }}
        maxWidth={false}
        disableScrollLock
        disableAutoFocus
        disableRestoreFocus
        slotProps={{
          paper: {
            sx: {
              bgcolor: (t: Theme) =>
                t.palette.mode === 'dark'
                  ? 'rgba(3, 17, 29, 0.985)'
                  : '#ffffff',
              backgroundImage: (t: Theme) =>
                t.palette.mode === 'dark'
                  ? 'radial-gradient(circle at 13% 6%, rgba(24,189,242,0.13), transparent 30%), linear-gradient(180deg, rgba(5,24,39,0.99) 0%, rgba(3,13,23,0.995) 100%)'
                  : 'radial-gradient(circle at 13% 6%, rgba(11,143,211,0.08), transparent 32%), linear-gradient(180deg, rgba(255,255,255,0.99) 0%, rgba(246,250,252,0.995) 100%)',
              border: (t: Theme) =>
                t.palette.mode === 'dark'
                  ? '1px solid rgba(91,132,158,0.28)'
                  : '1px solid rgba(11,143,211,0.16)',
              borderRadius: fullScreen ? 0 : 2,
              boxShadow: (t: Theme) =>
                t.palette.mode === 'dark'
                  ? '0 28px 72px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.04)'
                  : '0 24px 70px rgba(15,74,106,0.18), inset 0 1px 0 rgba(255,255,255,0.9)',
              maxHeight: fullScreen ? '100dvh' : 'calc(100dvh - 48px)',
              overflowX: 'hidden',
              width: fullScreen ? '100%' : 'min(900px, calc(100vw - 24px))',
            },
          },
        }}
      >
        <AppBar
          sx={{
            bgcolor: 'transparent',
            backgroundColor: 'transparent',
            backgroundImage: 'none',
            borderBottom: 'none',
            boxShadow: 'none',
            color: 'text.primary',
            position: 'relative',
          }}
        >
          <Toolbar
            sx={{
              minHeight: { xs: 72, md: 76 },
              px: { xs: 2.35, md: 2.75 },
            }}
          >
            <Box
              sx={{
                alignItems: 'center',
                display: 'flex',
                flexGrow: 1,
                gap: { xs: 1.35, md: 1.55 },
                minWidth: 0,
              }}
            >
              <Box
                component="img"
                src={coinLogo}
                alt=""
                sx={{
                  filter: 'drop-shadow(0 0 16px rgba(24,189,242,0.45))',
                  height: { xs: 34, md: 36 },
                  width: { xs: 34, md: 36 },
                }}
              />
              <Typography
                sx={{
                  color: 'text.primary',
                  fontSize: { xs: 19, md: 20 },
                  fontWeight: 700,
                  letterSpacing: 0,
                  lineHeight: 1.05,
                  minWidth: 0,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
                component="div"
              >
                {t('core:address_book_title', {
                  coinType: coinType,
                  postProcess: 'capitalizeFirstChar',
                })}
              </Typography>
            </Box>
            <IconButton
              color="inherit"
              onClick={onClose}
              aria-label={t('core:action.close', {
                postProcess: 'capitalizeFirstChar',
              })}
              sx={{
                color: 'text.secondary',
                ml: 1.2,
                p: 0.35,
                '&:hover': {
                  bgcolor: 'rgba(116,158,180,0.08)',
                  color: 'text.primary',
                },
                '& svg': {
                  fontSize: { xs: 28, md: 29 },
                },
              }}
            >
              <Close />
            </IconButton>
          </Toolbar>
        </AppBar>

        <DialogContent
          sx={{
            overflowX: 'hidden',
            px: { xs: 2.15, sm: 2.45, md: 2.75 },
            pb: { xs: 2.2, sm: 2.45, md: 2.75 },
            pt: { xs: 0.2, md: 0.3 },
            scrollbarGutter: 'stable',
          }}
        >
          <Box sx={{ mx: 'auto', width: '100%' }}>
            <Box
              sx={{
                alignItems: { xs: 'stretch', md: 'center' },
                display: 'grid',
                gap: { xs: 1, md: 1 },
                gridTemplateColumns: {
                  xs: '1fr',
                  md: 'minmax(0, 1fr) 190px',
                },
                mb: { xs: 1.35, md: 1.5 },
              }}
            >
              <TextField
                fullWidth
                placeholder={t('core:address_book_search', {
                  postProcess: 'capitalizeFirstChar',
                })}
                variant="outlined"
                value={searchQuery}
                onChange={handleSearchChange}
                slotProps={{
                  htmlInput: {
                    'aria-label': t('core:address_book_search', {
                      postProcess: 'capitalizeFirstChar',
                    }),
                  },
                  input: {
                    startAdornment: (
                      <InputAdornment position="start">
                        <Search
                          sx={{
                            color: 'text.secondary',
                            fontSize: 20,
                          }}
                        />
                      </InputAdornment>
                    ),
                  },
                }}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    bgcolor: (t: Theme) =>
                      t.palette.mode === 'dark'
                        ? 'rgba(0,8,16,0.2)'
                        : 'rgba(255,255,255,0.76)',
                    borderRadius: 1.35,
                    minHeight: { xs: 44, md: 44 },
                    '& fieldset': {
                      borderColor: (t: Theme) =>
                        t.palette.mode === 'dark'
                          ? 'rgba(116,158,180,0.16)'
                          : 'rgba(11,143,211,0.18)',
                    },
                    '&:hover fieldset': {
                      borderColor: (t: Theme) =>
                        t.palette.mode === 'dark'
                          ? 'rgba(116,158,180,0.3)'
                          : 'rgba(11,143,211,0.32)',
                    },
                    '&.Mui-focused fieldset': {
                      borderColor: 'rgba(24,189,242,0.62)',
                    },
                  },
                  '& .MuiOutlinedInput-input': {
                    color: 'text.secondary',
                    fontSize: { xs: 13, md: 13 },
                    fontWeight: 400,
                    py: { xs: 1.1, md: 1.1 },
                    '&::placeholder': {
                      color: 'text.secondary',
                      fontWeight: 400,
                      opacity: 0.88,
                    },
                  },
                  '& .MuiInputAdornment-root svg': {
                    fontSize: 20,
                  },
                }}
              />
              <Button
                variant="contained"
                startIcon={<Add />}
                onClick={handleAddNew}
                size="small"
                sx={{
                  bgcolor: 'rgba(6,126,208,0.94)',
                  backgroundImage:
                    'linear-gradient(180deg, rgba(18,158,238,0.94), rgba(4,111,198,0.94))',
                  border: '1px solid rgba(85,205,255,0.38)',
                  borderRadius: 1.35,
                  boxShadow:
                    '0 8px 20px rgba(3,139,236,0.18), inset 0 1px 0 rgba(255,255,255,0.16)',
                  color: 'rgba(255,255,255,0.96)',
                  fontSize: { xs: 12.5, md: 13 },
                  fontWeight: 650,
                  minHeight: { xs: 42, md: 44 },
                  px: { xs: 1.2, md: 1.3 },
                  whiteSpace: 'nowrap',
                  '& .MuiButton-startIcon': {
                    mr: { xs: 0.65, md: 1 },
                    '& svg': {
                      fontSize: { xs: 17, md: 18 },
                    },
                  },
                  '&:hover': {
                    bgcolor: '#1399e8',
                    borderColor: 'rgba(107,216,255,0.52)',
                    boxShadow: '0 12px 26px rgba(24,189,242,0.24)',
                  },
                }}
              >
                {t('core:address_book_add_new', {
                  postProcess: 'capitalizeFirstChar',
                })}
              </Button>
            </Box>

            {entries.length === 0 ? (
              <Box
                sx={{
                  alignItems: 'center',
                  bgcolor: (t: Theme) =>
                    t.palette.mode === 'dark'
                      ? 'rgba(0,8,16,0.12)'
                      : 'rgba(246,250,252,0.72)',
                  border: (t: Theme) =>
                    t.palette.mode === 'dark'
                      ? '1px solid rgba(116,158,180,0.08)'
                      : '1px solid rgba(11,143,211,0.12)',
                  borderRadius: 1.35,
                  display: 'flex',
                  justifyContent: 'center',
                  minHeight: { xs: 156, md: 170 },
                }}
              >
                <Typography
                  sx={{
                    color: 'text.secondary',
                    fontSize: { xs: 14, md: 15 },
                    fontWeight: 500,
                  }}
                >
                  {t('core:address_book_empty', {
                    postProcess: 'capitalizeFirstChar',
                  })}
                </Typography>
              </Box>
            ) : (
              <AddressBookTable
                entries={entries}
                onEdit={handleEdit}
                onDelete={handleDeleteClick}
                onUse={onSelectAddress ? handleUse : undefined}
                onToggleFavorite={handleToggleFavorite}
                onReorder={handleReorder}
                page={page}
                rowsPerPage={rowsPerPage}
                onPageChange={handlePageChange}
                onRowsPerPageChange={handleRowsPerPageChange}
              />
            )}
          </Box>
        </DialogContent>
      </Dialog>

      {/* Add/Edit Form Dialog */}
      <AddressFormDialog
        open={openForm}
        onClose={handleFormClose}
        coinType={coinType}
        entry={editingEntry}
        onDelete={handleDeleteClick}
        onSave={handleSave}
        prefillName={prefillData?.name}
        prefillAddress={prefillData?.address}
        saveError={saveError}
        onExited={handleFormExited}
      />

      {/* Delete Confirmation Dialog */}
      <DeleteConfirmationDialog
        open={openDeleteConfirm}
        onClose={handleDeleteCancel}
        onConfirm={handleDeleteConfirm}
        entryName={deletingEntry?.name || EMPTY_STRING}
      />
    </>
  );
};
