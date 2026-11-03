import {
  Box,
  Button,
  Collapse,
  InputAdornment,
  MenuItem,
  Select,
  TextField,
  Tooltip,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
  useMediaQuery,
} from '@mui/material';
import { InfoOutlined } from '@mui/icons-material';
import type { ChangeEvent, MouseEvent } from 'react';
import { useEffect, useState } from 'react';
import { useRecommendedFees } from '../hooks/useRecommendedFees';
import type { FeeType } from '../hooks/useRecommendedFees';
import { useTranslation } from 'react-i18next';
import { calculateSendFee } from '../utils/sendFee';

type FeeManagerProps = {
  coin: string;
  onChange: (fee: number) => void;
};

export const FeeManager = ({ coin, onChange }: FeeManagerProps) => {
  const { t } = useTranslation('core');
  const reduceMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const {
    selectedFeePublisher,
    setSelectedFeePublisher,
    currentFee: recommendedFee,
    selectFeeType,
    setSelectFeeType,
    data,
    customFee,
    setCustomFee,
  } = useRecommendedFees({ selectedCoin: coin });

  const currentFee =
    recommendedFee === null
      ? null
      : (calculateSendFee(recommendedFee, 1000)?.ratePerKb ?? 0);

  const handleFeeTypeChange = (
    _event: MouseEvent<HTMLElement>,
    nextFeeType: FeeType | null
  ) => {
    if (nextFeeType) {
      setSelectFeeType(nextFeeType);
    }
  };

  useEffect(() => {
    onChange(currentFee ?? 0);
  }, [currentFee, onChange]);

  const feeValue = currentFee ?? '--';
  const feeIsLong =
    typeof currentFee === 'number' &&
    Number.isFinite(currentFee) &&
    Math.abs(currentFee) > 9999;
  const selectedFeeLabel = t(`core:fee.${selectFeeType}`, {
    postProcess: 'capitalizeFirstChar',
  });
  const feeUnitText = currentFee === null ? 'Loading' : `${feeValue} sat/kB`;
  const feeText =
    currentFee === null ? 'Fee loading' : `${selectedFeeLabel}: ${feeUnitText}`;
  const isDogeFee = coin.toUpperCase() === 'DOGE';
  const compactFeeText = isDogeFee ? feeUnitText : feeText;
  const feeTooltipTitle = `${t('core:fee.current', {
    fee: feeValue,
    postProcess: 'capitalizeFirstChar',
  })}. ${t('core:message.generic.low_fee_transation', {
    postProcess: 'capitalizeFirstChar',
  })}`;
  const feeOptions: Array<{
    fee: number | null;
    helper?: string;
    label: string;
    value: FeeType;
  }> = [
    {
      fee: data?.low_fee_per_kb ?? null,
      label: t('core:fee.low', { postProcess: 'capitalizeFirstChar' }),
      value: 'low',
    },
    {
      fee: data?.medium_fee_per_kb ?? null,
      helper: 'Recommended',
      label: t('core:fee.medium', { postProcess: 'capitalizeFirstChar' }),
      value: 'medium',
    },
    {
      fee: data?.high_fee_per_kb ?? null,
      label: t('core:fee.high', { postProcess: 'capitalizeFirstChar' }),
      value: 'high',
    },
    {
      fee: customFee,
      label: t('core:fee.custom', { postProcess: 'capitalizeFirstChar' }),
      value: 'custom',
    },
  ];

  return (
    <Box
      sx={{
        bgcolor: 'rgba(0,8,16,0.13)',
        border: '1px solid rgba(116,158,180,0.14)',
        borderRadius: 1.15,
        overflow: 'hidden',
        width: '100%',
      }}
    >
      <Box
        sx={{
          alignItems: 'center',
          display: 'grid',
          gap: { xs: 1, sm: 1.15 },
          gridTemplateColumns: {
            xs: '1fr',
            sm: 'minmax(88px, 0.68fr) minmax(150px, 1.1fr) auto minmax(134px, 0.95fr)',
          },
          px: { xs: 1.45, sm: 1.55 },
          py: 1.05,
        }}
      >
        <Typography
          sx={{
            color: 'text.secondary',
            fontSize: 12.5,
            fontWeight: 500,
            letterSpacing: 0,
            whiteSpace: 'nowrap',
          }}
        >
          {t('core:fee.publisher', {
            postProcess: 'capitalizeFirstChar',
          })}
        </Typography>

        <Select
          size="small"
          value={selectedFeePublisher}
          onChange={(e: { target: { value: string } }) => {
            if (e.target.value) {
              setSelectedFeePublisher(e.target.value);
            }
          }}
          sx={{
            bgcolor: 'rgba(0,8,16,0.24)',
            borderRadius: 1.2,
            color: 'text.primary',
            fontSize: 13,
            fontWeight: 600,
            minWidth: 0,
            width: '100%',
            '& .MuiOutlinedInput-notchedOutline': {
              borderColor: 'primary.main',
            },
            '&:hover .MuiOutlinedInput-notchedOutline': {
              borderColor: 'primary.main',
            },
            '& .MuiSelect-icon': {
              color: 'text.primary',
            },
          }}
        >
          <MenuItem value="Foreign-Fee-Publisher">
            Foreign-Fee-Publisher
          </MenuItem>
          <MenuItem value="JSON.Bridge">JSON.Bridge</MenuItem>
        </Select>

        <Button
          variant="outlined"
          aria-expanded={advancedOpen}
          onClick={() => setAdvancedOpen((current) => !current)}
          sx={{
            bgcolor: advancedOpen ? 'rgba(24,189,242,0.08)' : 'transparent',
            borderColor: advancedOpen
              ? 'rgba(24,189,242,0.54)'
              : 'rgba(116,158,180,0.2)',
            borderRadius: 1.2,
            color: advancedOpen ? 'primary.main' : 'text.primary',
            fontSize: 12,
            fontWeight: 600,
            minHeight: 32,
            minWidth: 104,
            px: 1.35,
            textTransform: 'none',
            '&:hover': {
              bgcolor: 'rgba(116,158,180,0.08)',
              borderColor: 'rgba(24,189,242,0.45)',
            },
          }}
        >
          Advanced
        </Button>

        <Tooltip title={feeTooltipTitle}>
          <Box
            sx={{
              alignItems: 'center',
              color: 'text.secondary',
              display: 'inline-flex',
              gap: 0.55,
              justifySelf: { xs: 'start', sm: 'end' },
              minWidth: { sm: 0 },
              opacity: 0.72,
              overflow: 'hidden',
              whiteSpace: 'nowrap',
              width: { xs: 'auto', sm: '100%' },
            }}
          >
            <InfoOutlined
              sx={{ color: 'text.secondary', fontSize: 15, opacity: 0.82 }}
            />
            <Typography
              sx={{
                fontSize: 12.5,
                fontWeight: 500,
                minWidth: 0,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {feeIsLong
                ? isDogeFee
                  ? compactFeeText
                  : `${selectedFeeLabel} fee set`
                : compactFeeText}
            </Typography>
          </Box>
        </Tooltip>

        <Collapse
          in={advancedOpen}
          timeout={reduceMotion ? 0 : 360}
          unmountOnExit
          sx={{
            gridColumn: '1 / -1',
            maxWidth: '100%',
            mt: 0.15,
            '& .MuiCollapse-wrapperInner': {
              opacity: advancedOpen ? 1 : 0,
              transform: advancedOpen ? 'translateY(0)' : 'translateY(-8px)',
              transition: reduceMotion
                ? 'none'
                : 'opacity 280ms ease-out, transform 360ms cubic-bezier(0.2, 0, 0, 1)',
            },
          }}
        >
          <Box
            sx={{
              borderTop: '1px solid rgba(116,158,180,0.12)',
              display: 'grid',
              gap: 1,
              pt: 1.05,
            }}
          >
            <ToggleButtonGroup
              exclusive
              value={selectFeeType}
              onChange={handleFeeTypeChange}
              aria-label={`${coin} fee speed`}
              sx={{
                display: 'grid',
                gap: 0.65,
                gridTemplateColumns: {
                  xs: 'repeat(2, minmax(0, 1fr))',
                  sm: 'repeat(4, minmax(0, 1fr))',
                },
                width: '100%',
                '& .MuiToggleButtonGroup-grouped': {
                  border: '1px solid rgba(116,158,180,0.2) !important',
                  borderRadius: '8px !important',
                  m: '0 !important',
                },
              }}
            >
              {feeOptions.map((option) => {
                const isRecommendedPreset =
                  option.value !== 'custom' && option.fee !== null;
                const valueText =
                  option.value === 'custom'
                    ? option.fee !== null && option.fee > 0
                      ? `${option.fee} sat/kB`
                      : 'Manual entry'
                    : isRecommendedPreset
                      ? `${option.fee} sat/kB`
                      : 'Loading';

                return (
                  <ToggleButton
                    key={option.value}
                    disabled={option.value !== 'custom' && !data}
                    value={option.value}
                    sx={{
                      alignItems: 'flex-start',
                      alignContent: option.helper ? 'start' : 'center',
                      bgcolor:
                        selectFeeType === option.value
                          ? 'rgba(24,189,242,0.1)'
                          : 'rgba(0,8,16,0.2)',
                      color: 'text.primary',
                      display: 'grid',
                      gap: 0.28,
                      justifyItems: 'start',
                      minHeight: 64,
                      overflow: 'hidden',
                      px: 1,
                      py: 0.85,
                      textAlign: 'left',
                      textTransform: 'none',
                      '&.Mui-selected': {
                        bgcolor: 'rgba(24,189,242,0.12)',
                        borderColor: 'rgba(24,189,242,0.54) !important',
                        color: 'primary.main',
                      },
                      '&.Mui-selected:hover, &:hover': {
                        bgcolor: 'rgba(24,189,242,0.1)',
                      },
                    }}
                  >
                    <Typography
                      sx={{
                        fontSize: 12.5,
                        fontWeight: 700,
                        lineHeight: 1.05,
                      }}
                    >
                      {option.label}
                    </Typography>
                    <Typography
                      sx={{
                        color:
                          selectFeeType === option.value
                            ? 'primary.main'
                            : 'text.secondary',
                        fontSize: 11.5,
                        fontWeight: 550,
                        lineHeight: 1.05,
                        minWidth: 0,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        width: '100%',
                      }}
                    >
                      {valueText}
                    </Typography>
                    {option.helper && (
                      <Typography
                        sx={{
                          color:
                            selectFeeType === option.value
                              ? 'primary.main'
                              : 'text.secondary',
                          fontSize: 10.8,
                          fontWeight: 700,
                          lineHeight: 1.05,
                          opacity: selectFeeType === option.value ? 0.95 : 0.7,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          width: '100%',
                        }}
                      >
                        {option.helper}
                      </Typography>
                    )}
                  </ToggleButton>
                );
              })}
            </ToggleButtonGroup>

            {selectFeeType === 'custom' && (
              <TextField
                type="number"
                value={customFee}
                onChange={(event: ChangeEvent<HTMLInputElement>) =>
                  setCustomFee(+event.target.value)
                }
                autoComplete="off"
                placeholder="0"
                size="small"
                fullWidth
                slotProps={{
                  htmlInput: {
                    inputMode: 'numeric',
                    min: 0,
                  },
                  input: {
                    endAdornment: (
                      <InputAdornment position="end">
                        <Typography
                          sx={{
                            color: 'text.secondary',
                            fontSize: 13,
                            fontWeight: 500,
                          }}
                        >
                          sat/kB
                        </Typography>
                      </InputAdornment>
                    ),
                  },
                }}
                sx={{
                  maxWidth: '100%',
                  '& .MuiOutlinedInput-root': {
                    bgcolor: 'rgba(0,8,16,0.24)',
                    borderRadius: 1.1,
                    color: 'text.primary',
                    fontSize: 14,
                    fontWeight: 500,
                    minHeight: 38,
                    '& fieldset': {
                      borderColor: 'rgba(116,158,180,0.2)',
                    },
                    '&:hover fieldset': {
                      borderColor: 'rgba(116,158,180,0.34)',
                    },
                    '&.Mui-focused fieldset': {
                      borderColor: 'rgba(24,189,242,0.62)',
                      borderWidth: 1,
                    },
                  },
                  '& .MuiOutlinedInput-input': {
                    py: 0,
                    '&::-webkit-outer-spin-button, &::-webkit-inner-spin-button':
                      {
                        WebkitAppearance: 'none',
                        margin: 0,
                      },
                  },
                  '& input[type=number]': {
                    MozAppearance: 'textfield',
                  },
                }}
              />
            )}
          </Box>
        </Collapse>

        {feeIsLong && !isDogeFee && (
          <Tooltip title={feeTooltipTitle}>
            <Box
              sx={{
                alignItems: 'center',
                color: 'text.secondary',
                display: 'inline-flex',
                gap: 0.55,
                gridColumn: {
                  xs: '1',
                  sm: selectFeeType === 'custom' ? '3 / 5' : '2 / 5',
                },
                justifySelf: { xs: 'start', sm: 'end' },
                opacity: 0.72,
                whiteSpace: 'nowrap',
              }}
            >
              <InfoOutlined
                sx={{ color: 'text.secondary', fontSize: 15, opacity: 0.82 }}
              />
              <Typography sx={{ fontSize: 12.5, fontWeight: 500 }}>
                {compactFeeText}
              </Typography>
            </Box>
          </Tooltip>
        )}
      </Box>
    </Box>
  );
};
