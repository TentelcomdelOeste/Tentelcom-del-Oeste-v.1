export type PreAnalysisStatus = 'Borrador' | 'Enviado' | 'Convertido';
export type CostType = 'Directo' | 'Indirecto';
export type ProjectRiskLevel = 'Bajo' | 'Medio' | 'Alto';

export interface PreAnalysisCostItem {
  id: string;
  type: CostType;
  category: string;
  description: string;
  amount: number;
}

export interface SensitivityFactors {
  materials: number; // % de variación
  labor: number;    // % de variación
  exchangeRate: number; // % de variación
}

export interface PreAnalysis {
  id: string;
  projectName: string;
  client: string;
  currency: 'USD' | 'CRC';
  estimatedBudget: number;
  durationMonths: number;
  contingencyPercent: number;
  targetMargin: number;
  
  costItems: PreAnalysisCostItem[];
  sensitivity: SensitivityFactors;
  riskScore: number;
  
  status: PreAnalysisStatus;
  createdAt: string;
  createdBy: string;
  notes?: string;
}