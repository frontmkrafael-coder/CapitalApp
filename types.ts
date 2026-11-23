// --- Enums & Basic Types ---
export enum TransactionType {
  INCOME = 'income',
  EXPENSE = 'expense',
}

export type ThemeType =
  | 'default'
  | 'oneui-light'
  | 'ios'
  | 'ios-midnight'
  | 'cyberpunk'
  | 'ocean'
  | 'sunset';

export type LayoutMode = 'default' | 'minimal' | 'advanced' | 'ios';
export type FpsLevel = 'low' | 'medium' | 'high';
export type RecurringFrequency = 'weekly' | 'biweekly' | 'monthly' | 'yearly';
export type EmploymentType = 'fixed' | 'freelancer';

// --- Domain Entities ---
export interface Transaction {
  id: string;
  userId?: string;
  description: string;
  amount: number;
  type: TransactionType;
  category: string;
  date: string; // ISO string YYYY-MM-DD
  createdAt: number;
  updatedAt?: number;
}

export interface FinancialGoal {
  id: string;
  userId?: string;
  title: string;
  targetAmount: number;
  currentAmount: number;
  deadline: string; // ISO string YYYY-MM-DD
  isAI: boolean;
  isCompleted: boolean;
  createdAt?: number;
  updatedAt?: number;
}

export interface RecurringPayment {
  id: string;
  userId?: string;
  description: string;
  amount: number;
  type: TransactionType;
  category: string;
  frequency: RecurringFrequency;
  dayOfMonth: number; // 1..31
  startDate: string; // YYYY-MM-DD
  nextDueDate: string; // YYYY-MM-DD
  lastExecutedDate?: string | null;
  autoProcess: boolean;
  isActive: boolean;
  createdAt?: number;
  updatedAt?: number;
}

export interface CompanyRecord {
  id: string;
  userId?: string;
  name: string;
  cnpj?: string | null;
  employmentType: EmploymentType;
  admissionDate: string; // YYYY-MM-DD
  baseSalary?: number | null;
  paymentDay?: number | null; // 1..31
  advanceDay?: number | null; // 1..31 (optional)
  dailyRate?: number | null;
  createdAt?: number;
  updatedAt?: number;
}

export interface UserProfile {
  uid: string;
  displayName: string | null;
  email: string | null;
  photoURL: string | null;
  emailVerified: boolean;
  phoneNumber?: string | null;
  bio?: string | null;
  jobTitle?: string | null;
  website?: string | null;
  createdAt?: number;
  lastLogin?: number;
  updatedAt?: number;
}

export interface UserStats {
  userId?: string;
  hasUsedAI?: boolean;
  totalTransactions?: number;
  lastAnalysisDate?: number;
}

export interface Achievement {
  id: string;
  title: string;
  description: string;
  iconName: 'FirstIncome' | 'FirstExpense' | 'FirstAI' | 'DataMaster' | 'Saver';
  isUnlocked: boolean;
  unlockedAt?: string;
  progress?: number; // 0 to 100
}

// --- AI Types ---
export interface AIAnalysisResult {
  summary: string;
  savingsTip: string;
  alert: string | null;
  prediction: string;
  cashFlowTip?: string;
  suggestedGoals?: { title: string; targetAmount: number; deadline: string }[];
  analyzedAt?: number;
}

// --- Configuration Types ---
export interface AppSettings {
  performance: {
    fps: FpsLevel;
    highPerformanceMode: boolean;
  };
  visual: {
    theme: ThemeType;
    layoutMode: LayoutMode;
    scale: number; // 0.8 a 1.2
    autoHideDock?: boolean;
  };
  account: {
    autoLogin: boolean;
    notificationsEnabled?: boolean;
  };
}

// --- UI State Types ---
export interface DashboardStats {
  totalIncome: number;
  totalExpense: number;
  balance: number;
  savingsRate: number; // Percentage
}

export interface ToastMessage {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
  duration?: number;
}

export interface LoadingState {
  auth: boolean;
  data: boolean;
  ai: boolean;
  action: boolean;
}
