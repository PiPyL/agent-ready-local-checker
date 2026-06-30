export type CheckStatus = 'pass' | 'fail' | 'warning' | 'unknown';

export type ScanGrade = 'Excellent' | 'Good' | 'Needs Work' | 'Poor';

export interface ScanCheck {
  id: string;
  title: string;
  category: 'discoverability' | 'agent-content' | 'bot-policy' | 'protocol' | 'metadata';
  status: CheckStatus;
  score: number;
  maxScore: number;
  message: string;
  evidence?: string;
  fix?: string;
}

export interface DomInsight {
  title: string;
  metaDescription: string | null;
  canonicalUrl: string | null;
  jsonLdCount: number;
  h1Count: number;
  h2Count: number;
  visibleTextLength: number;
}

export interface ScanResult {
  url: string;
  origin: string;
  domain: string;
  scannedAt: string;
  score: number;
  grade: ScanGrade;
  checks: ScanCheck[];
}

export interface ScanRequest {
  url: string;
  tabId?: number;
}
