export interface ErrorDetails {
  category: 'CORS' | 'NETWORK' | 'AUTH' | 'API' | 'CONFIG' | 'UNKNOWN';
  rootCause: string;
  impact: string;
  recommendations: string[];
  quickFixes: QuickFix[];
  technicalDetails?: any;
}

export interface QuickFix {
  label: string;
  action: string;
  description: string;
}

export interface ValidationStep {
  name: string;
  description: string;
  status: 'pending' | 'running' | 'success' | 'error';
  error?: string;
  errorDetails?: ErrorDetails;
  data?: any;
}