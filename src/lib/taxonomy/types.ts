/** Portable ICMA BDT 2.0 types — no UI or database dependencies. */
export interface BdtParty { PartyName?: string; LEIIdentifier?: string; PartyRole?: string; [k: string]: unknown }
export interface BdtIdentifier { Type: string; Value: string }
export interface BdtRatingEntry { RatingAgency: string; RatingValue: string; RatingOutlook?: string }

/** Minimal portable term-sheet document: stage 1..7 plus BDT element paths -> values. */
export interface BdtDocument {
  stage: number;
  deal?: string;
  ver?: string;
  seq?: number;
  f: Record<string, string>;
  parties?: BdtParty[];
  ids?: BdtIdentifier[];
  ratings?: BdtRatingEntry[];
  contacts?: { Name: string; Email: string }[];
  docs?: { DocumentName: string; DocumentDate?: string; DocumentLink?: string; DocumentVersion?: string }[];
}

export type Severity = 'error' | 'warning';
export interface ValidationIssue { code: string; path?: string; message: string; stage?: number }
export type ValidationError = ValidationIssue;
export type ValidationWarning = ValidationIssue;

export interface ValidationReport {
  isValid: boolean;
  stage: number;
  stageName: string;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  summary: string;
}

export type BdtExportFormat = 'json' | 'xml' | 'text';
