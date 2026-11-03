// String
export const EMPTY_STRING: string = '';
export const ONE_SPACE: string = ' ';

// Number
export const ADDRESSBOOK_NAME_LENGTH: number = 50;
export const ADDRESSBOOK_NOTE_LENGTH: number = 200;
export const ADDRESSBOOK_ROWS_PER_PAGE: number = 5;
export const DECIMAL_ROUND_UP: number = 8;

// QORT section
export const QORT_1_UNIT: number = 100000000;

// Satoshis held back by "SEND MAX" so the prefilled amount stays strictly
// within the spendable balance (absorbs fee-estimate / serialization slack).
// 1000 sats = 0.00001 coin — negligible to the user, enough to clear the
// host's "Insufficient funds" boundary check.
export const SEND_MAX_SAFETY_BUFFER_SATS: number = 1000;
export const UTXO_SEND_TRANSACTION_BYTES: number = 1000;

// Fees
export const ARRR_FEE: number = 0.0001;
export const BTC_FEE: number = 500;
export const DGB_FEE: number = 10;
export const DOGE_FEE: number = 5000;
export const LTC_FEE: number = 1000;
export const RVN_FEE: number = 1500;

// Time section
// milliseconds
export const TIME_MILLISECONDS_50: number = 50;
export const TIME_MILLISECONDS_250: number = 250;
export const TIME_MILLISECONDS_400: number = 400;
export const TIME_MILLISECONDS_500: number = 500;
export const TIME_MILLISECONDS_1000: number = 1000;
export const TIME_MILLISECONDS_1500: number = 1500;

// seconds
export const TIME_SECONDS_1: number = TIME_MILLISECONDS_1000;
export const TIME_SECONDS_2: number = 2 * TIME_SECONDS_1;
export const TIME_SECONDS_3: number = 3 * TIME_SECONDS_1;
export const TIME_SECONDS_4: number = 4 * TIME_SECONDS_1;
export const TIME_SECONDS_5: number = 5 * TIME_SECONDS_1;
export const TIME_SECONDS_10: number = 10 * TIME_SECONDS_1;
export const TIME_SECONDS_20: number = 20 * TIME_SECONDS_1;
export const TIME_SECONDS_40: number = 40 * TIME_SECONDS_1;

// minutes
export const TIME_MINUTES_1: number = 60 * TIME_SECONDS_1;
export const TIME_MINUTES_2: number = 2 * TIME_MINUTES_1;
export const TIME_MINUTES_3: number = 3 * TIME_MINUTES_1;
export const TIME_MINUTES_4: number = 4 * TIME_MINUTES_1;
export const TIME_MINUTES_5: number = 5 * TIME_MINUTES_1;
export const TIME_MINUTES_6: number = 6 * TIME_MINUTES_1;
export const TIME_MINUTES_10: number = 10 * TIME_MINUTES_1;
export const TIME_MINUTES_20: number = 20 * TIME_MINUTES_1;
export const TIME_MINUTES_30: number = 30 * TIME_MINUTES_1;
