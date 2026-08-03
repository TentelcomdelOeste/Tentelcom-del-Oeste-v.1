
export enum ImportStep {
  SELECT_FILE = 0,
  PARSE_FILE = 1,
  VALIDATE_DATA = 2,
  PREVIEW = 3,
  IMPORTING = 4,
  RESULT = 5
}

export interface ImportRow {
  [key: string]: any;
}

export interface IntermediateEntry {
  originalRowIndex: number;
  rawDate: any;
  rawProvider: any;
  rawDetails: any;
  rawSubtotal?: any;
  rawTax?: any;
  rawTotal: any;
  rawMethod: any;
  rawAccount: any;
  rawConsecutive: any;
  rawCategory?: any;
  rawCurrency?: any;
  rawType?: any;
  currencyHint?: string;
  [key: string]: any; // for any other fields
}

export interface ValidatedEntry extends IntermediateEntry {
  isValid: boolean;
  errors: ImportError[];
  warnings: ImportWarning[];
  parsedDate?: string; // YYYY-MM-DD
  parsedTotal?: number;
  parsedCurrency?: 'CRC' | 'USD';
  parsedType?: 'Ingreso' | 'Egreso';
  parsedSubtype?: string;
  parsedProjectId?: string | null;
  isDuplicate?: boolean;
  isClosedMonth?: boolean;
}

export interface ImportError {
  row: number;
  column: string;
  message: string;
  value?: any;
}

export interface ImportWarning {
  row: number;
  column: string;
  message: string;
  value?: any;
}

export interface ImportValidationResult {
  isValid: boolean;
  errors: ImportError[];
  warnings: ImportWarning[];
}

export interface ImportPreview {
  entries: IntermediateEntry[];
  totalCount: number;
  validCount: number;
  errorCount: number;
}

export interface ImportStatistics {
  processed: number;
  imported: number;
  failed: number;
  skipped: number;
}

export interface ImportProgress {
  total: number;
  processed: number;
  currentBatch: number;
  totalBatches: number;
  percentage: number;
}

export interface ImportResult {
  success: boolean;
  statistics: ImportStatistics;
  errors: ImportError[];
}

export interface ParseInfo {
  sheetName: string;
  sheetNames: string[];
  rowCount: number;
  headers: string[];
}

export interface ImportState {
  step: ImportStep;
  file: File | null;
  parseInfo: ParseInfo | null;
  rawData: ImportRow[];
  mappedEntries: IntermediateEntry[];
  validatedEntries: ValidatedEntry[];
  validation: ImportValidationResult | null;
  result: ImportResult | null;
  progress: ImportProgress | null;
}
