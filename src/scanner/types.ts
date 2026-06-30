export type CheckStatus = 'pass' | 'fail' | 'warning' | 'unknown' | 'not_applicable';

export type ScanGrade = 'Excellent' | 'Good' | 'Needs Work' | 'Poor';

export type CheckCategory =
  | 'crawlability'
  | 'indexability'
  | 'discoverability'
  | 'agent-content'
  | 'bot-policy'
  | 'protocol'
  | 'metadata'
  | 'structured-data'
  | 'content-quality'
  | 'social'
  | 'performance';

export type CheckSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';

export type FixEffort = 'low' | 'medium' | 'high';

export type SiteProfile = 'content' | 'saas' | 'docs' | 'ecommerce' | 'local-business' | 'api' | 'app' | 'unknown';

export interface ScanCheck {
  id: string;
  title: string;
  category: CheckCategory;
  status: CheckStatus;
  score: number;
  maxScore: number;
  message: string;
  evidence?: string;
  fix?: string;
  severity?: CheckSeverity;
  impact?: string;
  effort?: FixEffort;
  docsUrl?: string;
  tags?: string[];
  optional?: boolean;
  appliesTo?: SiteProfile[];
}

export interface HeadingInsight {
  level: number;
  text: string;
}

export interface ImageInsight {
  src: string;
  alt: string;
  width?: number | null;
  height?: number | null;
  loading?: string | null;
}

export interface LinkInsight {
  href: string;
  text: string;
  rel: string;
  isInternal: boolean;
}

export interface JsonLdInsight {
  raw: string;
  parseError?: string;
  types: string[];
}

export interface DomInsight {
  title: string;
  metaDescription: string | null;
  canonicalUrl: string | null;
  metaRobots: string | null;
  xRobotsTag?: string | null;
  htmlLang: string | null;
  viewport: string | null;
  ogTitle: string | null;
  ogDescription: string | null;
  ogImage: string | null;
  twitterCard: string | null;
  headings: HeadingInsight[];
  images: ImageInsight[];
  links: LinkInsight[];
  jsonLd: JsonLdInsight[];
  visibleTextLength: number;
  wordCount: number;
}

export interface ScoreBreakdownItem {
  category: CheckCategory;
  score: number;
  maxScore: number;
  percentage: number;
}

export interface FocusScore {
  label: 'SEO' | 'GEO';
  score: number;
  grade: ScanGrade;
  categories: CheckCategory[];
  summary: string;
}

export interface CriticalWarning {
  id: string;
  title: string;
  message: string;
  severity: CheckSeverity;
  fix?: string;
}

export interface ScanResult {
  url: string;
  origin: string;
  domain: string;
  scannedAt: string;
  score: number;
  grade: ScanGrade;
  seoScore: FocusScore;
  geoScore: FocusScore;
  criticalWarnings: CriticalWarning[];
  siteProfiles: SiteProfile[];
  scoreBreakdown: ScoreBreakdownItem[];
  checks: ScanCheck[];
}

export interface ScanRequest {
  url: string;
  tabId?: number;
}
