// src/global.d.ts

interface QortalRequestOptions {
  action: string;
  address?: string;
  amount?: number | string;
  assetId?: number;
  blob?: Blob;
  blockLimit?: number;
  category?: string;
  coin?: string;
  confirmationStatus?: string;
  creationBytes?: string;
  data64?: string;
  description?: string;
  destinationAddress?: string;
  encoding?: string;
  encryptedData?: string;
  exactMatchNames?: boolean;
  excludeBlocked?: boolean;
  fee?: number | string;
  file?: File;
  filename?: string;
  host?: string;
  identifier?: string;
  includeMetadata?: boolean;
  item?: string;
  items?: string[];
  limit?: number;
  list_name?: string;
  memo?: string;
  maxFee?: string;
  sendMax?: boolean;
  verified?: boolean;
  initialize?: boolean;
  restoreHeight?: number;
  retryPending?: boolean;
  metaData?: string;
  mimeType?: string;
  mode?: string;
  name?: string;
  offset?: number;
  port?: number;
  prefix?: boolean;
  query?: string;
  recipient?: string;
  resources?: any[];
  reverse?: boolean;
  service?: string;
  startBlock?: number;
  tag1?: string;
  tag2?: string;
  tag3?: string;
  tag4?: string;
  tag5?: string;
  tags?: string[] | string;
  title?: string;
  txGroupId?: number;
  txType?: TransactionType[];
  type?: string;
}

declare function qortalRequest(options: QortalRequestOptions): Promise<any>;

declare function qortalRequestWithTimeout(
  options: QortalRequestOptions,
  time: number
): Promise<any>;

declare global {
  interface Window {
    _qdnBase: any;
    _qdnTheme: string;
  }
}

declare global {
  interface Window {
    showSaveFilePicker: (
      options?: SaveFilePickerOptions
    ) => Promise<FileSystemFileHandle>;
  }
}
