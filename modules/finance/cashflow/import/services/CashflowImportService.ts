import { ExcelParser, ParseResult } from './ExcelParser';
import { CashflowImportValidator } from './CashflowImportValidator';
import { CashflowImportMapper } from './CashflowImportMapper';
import { CashflowBatchImporter } from './CashflowBatchImporter';
import { IntermediateEntry, ValidatedEntry, ImportValidationResult } from '../types';
import { Quote, CashflowEntry, User } from '../../../../utils/types';

export interface ParseAndMapResult {
  parseInfo: ParseResult;
  mappedEntries: IntermediateEntry[];
  validatedEntries: ValidatedEntry[];
  validationResult: ImportValidationResult;
}

export class CashflowImportService {
  public parser: ExcelParser;
  public validator: CashflowImportValidator;
  public mapper: CashflowImportMapper;
  public importer: CashflowBatchImporter;

  constructor() {
    this.parser = new ExcelParser();
    this.validator = new CashflowImportValidator();
    this.mapper = new CashflowImportMapper();
    this.importer = new CashflowBatchImporter();
  }

  /**
   * Main orchestrator for the initial parsing, mapping and validation (Phase 2 & 3).
   */
  async parseAndMap(
    file: File, 
    quotes: Quote[],
    isDateClosed: (date: string) => boolean,
    existingEntries: CashflowEntry[]
  ): Promise<ParseAndMapResult> {
    console.log('[CashflowImportService] Starting parsing and mapping for:', file.name);
    
    // Parse
    const parseResult = await this.parser.parse(file);
    
    // Map
    const mappedEntries = this.mapper.map(parseResult.rows);
    
    // Validate
    const { validatedEntries, validationResult } = this.validator.validate(mappedEntries, quotes, isDateClosed, existingEntries);
    
    return {
      parseInfo: parseResult,
      mappedEntries,
      validatedEntries,
      validationResult
    };
  }

  /**
   * Execute the final import using Firestore writeBatch (Phase 5).
   */
  async importData(
    entries: ValidatedEntry[], 
    currentUser: User,
    onProgress?: (progress: any) => void
  ) {
    // 1. Filter out completely invalid entries. Warnings can be imported.
    const validEntriesToImport = entries.filter(e => e.isValid);

    // 2. Map ValidatedEntry to Partial<CashflowEntry>
    const finalPayloads: Partial<CashflowEntry>[] = validEntriesToImport.map(entry => {
       return {
         date: entry.parsedDate!,
         amount: entry.parsedTotal!,
         currency: entry.parsedCurrency!,
         type: entry.parsedType!,
         description: entry.rawDetails ? String(entry.rawDetails) : '',
         expenseSubtype: entry.parsedSubtype,
         provider: entry.rawProvider ? String(entry.rawProvider) : null,
         paymentMethod: entry.rawMethod ? String(entry.rawMethod) : null,
         bankAccount: entry.rawAccount ? String(entry.rawAccount) : null,
         invoice: entry.rawConsecutive ? String(entry.rawConsecutive) : null,
         projectId: entry.parsedProjectId ? entry.parsedProjectId : null
       };
    });

    // 3. Delegate to importer
    return await this.importer.import(finalPayloads, currentUser, onProgress);
  }
}

export const cashflowImportService = new CashflowImportService();
