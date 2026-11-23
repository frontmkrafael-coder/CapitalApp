import React, { useEffect, useState, useMemo, useRef } from 'react';
import {
  Transaction,
  TransactionType,
  AIAnalysisResult,
  FinancialGoal,
  RecurringPayment,
} from '../types';
import {
  ArrowUpRight,
  ArrowDownRight,
  TrendingUp,
  Sparkles,
  ChevronRight,
  ArrowUpCircle,
  ArrowDownCircle,
  CheckCircle2,
  Layers,
  Percent,
  Target,
  Loader2,
  AlertTriangle,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import ExtendedAnalytics from './ExtendedAnalytics';

interface DashboardProps {
  transactions: Transaction[];
  aiInsight: AIAnalysisResult | null;
  aiLoading?: boolean;
  onGenerateAI: () => void;
  goals?: FinancialGoal[];
  recurringPayments?: RecurringPayment[];
  onOpenTransaction?: (initialType?: TransactionType) => void;
  onNavigateTab?: (tab: string) => void;
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
};

const parseLocalIsoDate = (dateStr: string): Date | null => {
  const parts = dateStr?.split('-').map(Number);
  if (!parts || parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return null;
  return new Date(parts[0], parts[1] - 1, parts[2]);
};

const CustomChartTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const income = payload.find((p: any) => p.dataKey === 'income')?.value || 0;
    const expense = payload.find((p: any) => p.dataKey === 'expense')?.value || 0;
    return (
      <div className="oneui-dock rounded-[18px] p-3 text-xs space-y-1.5 min-w-[145px]">
        <p className="font-semibold oneui-text-secondary text-[11px] mb-1">{label}</p>
        <div className="flex items-center justify-between gap-3 text-[#30D158]">
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#30D158]" /> Entradas
          </span>
          <span className="font-bold tabular-nums">{formatCurrency(income)}</span>
        </div>
        <div className="flex items-center justify-between gap-3 text-[#FF453A]">
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#FF453A]" /> Saídas
          </span>
          <span className="font-bold tabular-nums">{formatCurrency(expense)}</span>
        </div>
      </div>
    );
  }
  return null;
};

const Dashboard: React.FC<DashboardProps> = ({
  transactions,
  aiInsight,
  aiLoading = false,
  onGenerateAI,
  goals = [],
  recurringPayments = [],
  onOpenTransaction,
  onNavigateTab,
}) => {
  const [currentView, setCurrentView] = useState<'default' | 'extended'>('default');
  const autoRequestedRef = useRef(false);

  useEffect(() => {
    if (!aiInsight && !aiLoading && !autoRequestedRef.current && transactions.length >= 3) {
      autoRequestedRef.current = true;
      const timer = setTimeout(() => {
        onGenerateAI();
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [transactions.length, aiInsight, aiLoading, onGenerateAI]);

  const stats = useMemo(() => {
    return transactions.reduce(
      (acc, t) => {
        if (t.type === TransactionType.INCOME) {
          acc.income += t.amount;
        } else {
          acc.expense += t.amount;
        }
        acc.balance = acc.income - acc.expense;
        return acc;
      },
      { income: 0, expense: 0, balance: 0 }
    );
  }, [transactions]);

  const savingsRate = useMemo(() => {
    if (stats.income <= 0) return 0;
    const rate = ((stats.income - stats.expense) / stats.income) * 100;
    return Math.max(0, Math.round(rate));
  }, [stats]);

  const nearestGoal = useMemo(() => {
    const active = goals.filter((g) => !g.isCompleted);
    if (active.length === 0) return null;
    // Prioritize goals closest to completion
    return [...active].sort((a, b) => {
      const ratioA = a.targetAmount > 0 ? a.currentAmount / a.targetAmount : 0;
      const ratioB = b.targetAmount > 0 ? b.currentAmount / b.targetAmount : 0;
      return ratioB - ratioA;
    })[0];
  }, [goals]);

  const nearestGoalPercent = useMemo(() => {
    if (!nearestGoal || nearestGoal.targetAmount <= 0) return 0;
    return Math.min((nearestGoal.currentAmount / nearestGoal.targetAmount) * 100, 100);
  }, [nearestGoal]);

  const nearCompletionGoal = useMemo(() => {
    return (
      goals.find((g) => {
        if (g.isCompleted || g.targetAmount <= 0 || g.currentAmount >= g.targetAmount) return false;
        return (g.targetAmount - g.currentAmount) / g.targetAmount < 0.1;
      }) || null
    );
  }, [goals]);

  const committedRecurringExpense = useMemo(() => {
    const mult: Record<string, number> = { weekly: 4.33, biweekly: 2.17, monthly: 1, yearly: 1 / 12 };
    return recurringPayments
      .filter((r) => r.isActive && r.type === TransactionType.EXPENSE)
      .reduce((sum, r) => sum + r.amount * (mult[r.frequency] || 1), 0);
  }, [recurringPayments]);

  const chartData = useMemo(() => {
    const dataMap: Record<string, { name: string; income: number; expense: number }> = {};
    const now = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      const key = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
      dataMap[key] = { name: key, income: 0, expense: 0 };
    }

    transactions.forEach((t) => {
      const date = parseLocalIsoDate(t.date);
      if (!date) return;
      const key = date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
      if (dataMap[key]) {
        if (t.type === TransactionType.INCOME) dataMap[key].income += t.amount;
        else dataMap[key].expense += t.amount;
      }
    });

    return Object.values(dataMap);
  }, [transactions]);

  return (
    <div className="w-full max-w-full min-w-0 flex flex-col space-y-5">
      <AnimatePresence initial={false} mode="wait">
        {currentView === 'default' ? (
          <motion.div
            key="default"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.16 }}
            className="space-y-5 w-full max-w-full min-w-0 gpu-accelerated"
          >
            {/* HERO BENTO OVERVIEW (One UI 9 + iOS) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-5 w-full min-w-0">
              {/* Primary Balance Card */}
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.18 }}
                className="lg:col-span-7 oneui-card p-6 sm:p-7 flex flex-col justify-between space-y-6 min-w-0 gpu-accelerated"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span className="text-[12px] font-semibold oneui-text-muted tracking-wider uppercase">
                      Saldo Principal
                    </span>
                    <p className="text-[12px] oneui-text-secondary mt-0.5">
                      {committedRecurringExpense > 0
                        ? `Livre após fixos/mês: ${formatCurrency(stats.balance - committedRecurringExpense)}`
                        : 'Patrimônio líquido consolidado'}
                    </p>
                  </div>
                  <span
                    className={`text-[12px] font-semibold ${
                      stats.balance >= 0 ? 'text-[#30D158]' : 'text-[#FF453A]'
                    }`}
                  >
                    {stats.balance >= 0 ? 'Positivo' : 'Negativo'}
                  </span>
                </div>

                <div>
                  <h2 className="text-[32px] sm:text-[42px] md:text-[48px] font-extrabold oneui-text tracking-tight tabular-nums leading-none truncate">
                    {formatCurrency(stats.balance)}
                  </h2>
                </div>

                <div
                  className="grid grid-cols-3 gap-2.5 sm:gap-3 pt-4 min-w-0"
                  style={{ borderTop: '1px solid var(--app-divider)' }}
                >
                  <div className="oneui-surface-2 p-3 sm:p-3.5 min-w-0">
                    <div className="flex items-center gap-1 text-[11px] text-[#30D158] font-semibold mb-1 truncate">
                      <ArrowUpRight size={13} className="shrink-0" />
                      <span>Receitas</span>
                    </div>
                    <p className="text-[14px] sm:text-[16px] font-bold oneui-text tabular-nums truncate">
                      {formatCurrency(stats.income)}
                    </p>
                  </div>

                  <div className="oneui-surface-2 p-3 sm:p-3.5 min-w-0">
                    <div className="flex items-center gap-1 text-[11px] text-[#FF453A] font-semibold mb-1 truncate">
                      <ArrowDownRight size={13} className="shrink-0" />
                      <span>Despesas</span>
                    </div>
                    <p className="text-[14px] sm:text-[16px] font-bold oneui-text tabular-nums truncate">
                      {formatCurrency(stats.expense)}
                    </p>
                  </div>

                  <div className="oneui-surface-2 p-3 sm:p-3.5 min-w-0">
                    <div
                      className="flex items-center gap-1 text-[11px] font-semibold mb-1 truncate"
                      style={{ color: 'var(--app-accent)' }}
                    >
                      <Percent size={13} className="shrink-0" />
                      <span>Poupança</span>
                    </div>
                    <p className="text-[14px] sm:text-[16px] font-bold oneui-text tabular-nums truncate">
                      {savingsRate}%
                    </p>
                  </div>
                </div>
              </motion.div>

              {/* Financial Health & Goal Companion Card */}
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.18, delay: 0.03 }}
                className="lg:col-span-5 oneui-card p-6 flex flex-col justify-between space-y-5 min-w-0 gpu-accelerated"
              >
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-[12px] font-semibold uppercase tracking-wider oneui-text-muted">
                      Saúde Financeira
                    </span>
                    <span
                      className={`text-[12px] font-bold ${
                        savingsRate >= 30
                          ? 'text-[#30D158]'
                          : savingsRate > 0
                          ? 'text-[#4C7BFF]'
                          : 'text-[#FF9F0A]'
                      }`}
                    >
                      {savingsRate >= 30 ? 'Excelente' : savingsRate > 0 ? 'Equilibrado' : 'Atenção'}
                    </span>
                  </div>

                  {nearCompletionGoal && (
                    <button
                      type="button"
                      onClick={() => onNavigateTab?.('goals')}
                      className="w-full text-left rounded-[16px] p-3 bg-[#FF9F0A]/14 border border-[#FF9F0A]/35 flex items-center justify-between gap-2 active:scale-[0.98] transition-transform"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <AlertTriangle size={15} className="text-[#FF9F0A] shrink-0" />
                        <div className="min-w-0">
                          <p className="text-[12px] font-bold text-[#FF9F0A]">Meta quase atingida</p>
                          <p className="text-[11px] oneui-text-secondary truncate tabular-nums">
                            {nearCompletionGoal.title} · faltam{' '}
                            {formatCurrency(
                              Math.max(0, nearCompletionGoal.targetAmount - nearCompletionGoal.currentAmount)
                            )}
                          </p>
                        </div>
                      </div>
                      <ChevronRight size={14} className="text-[#FF9F0A] shrink-0" />
                    </button>
                  )}

                  {nearestGoal ? (
                    <div className="oneui-surface-2 p-4 space-y-3 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-8 h-8 rounded-[11px] bg-[#FF9F0A]/15 text-[#FF9F0A] flex items-center justify-center shrink-0">
                            <Target size={16} />
                          </div>
                          <span className="text-[14px] font-bold oneui-text truncate">
                            {nearestGoal.title}
                          </span>
                        </div>
                        <span className="text-[13px] font-bold oneui-text tabular-nums shrink-0">
                          {Math.round(nearestGoalPercent)}%
                        </span>
                      </div>

                      <div
                        className="h-2.5 rounded-full overflow-hidden"
                        style={{ backgroundColor: 'var(--app-surface-3)' }}
                      >
                        <motion.div
                          className="h-full w-full bg-gradient-to-r from-[#FF9F0A] to-[#FFD60A] rounded-full gpu-accelerated"
                          style={{ transformOrigin: 'left' }}
                          initial={{ scaleX: 0 }}
                          animate={{ scaleX: nearestGoalPercent / 100 }}
                          transition={{ type: 'spring', stiffness: 320, damping: 28 }}
                        />
                      </div>

                      <div className="flex justify-between text-[12px] oneui-text-muted tabular-nums">
                        <span>Guardado: {formatCurrency(nearestGoal.currentAmount)}</span>
                        <span>Alvo: {formatCurrency(nearestGoal.targetAmount)}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="oneui-surface-2 p-5 text-center">
                      <Target size={24} className="oneui-text-muted mx-auto mb-1.5 opacity-70" />
                      <p className="text-[14px] font-semibold oneui-text">Nenhuma meta ativa</p>
                      <p className="text-[12px] oneui-text-muted mt-0.5">
                        Cadastre uma meta para acompanhar seu progresso aqui.
                      </p>
                    </div>
                  )}
                </div>

                <div
                  className="pt-3.5 flex items-center justify-between text-[12px] oneui-text-secondary"
                  style={{ borderTop: '1px solid var(--app-divider)' }}
                >
                  <span className="flex items-center gap-1.5 truncate">
                    <CheckCircle2 size={14} className="text-[#30D158] shrink-0" />
                    <span className="truncate tabular-nums">{transactions.length} transações registradas</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setCurrentView('extended')}
                    className="font-semibold flex items-center gap-0.5 hover:underline shrink-0"
                    style={{ color: 'var(--app-accent)' }}
                  >
                    <span>Ver Análise</span>
                    <ChevronRight size={14} />
                  </button>
                </div>
              </motion.div>
            </div>

            {/* ONE UI 9 BENTO QUICK ACTIONS */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 w-full min-w-0">
              <motion.button
                whileTap={{ scale: 0.96 }}
                type="button"
                onClick={() => onOpenTransaction?.(TransactionType.INCOME)}
                className="oneui-card oneui-hover p-4 flex items-center gap-3 min-w-0 text-left gpu-accelerated"
              >
                <div className="w-10 h-10 rounded-[14px] bg-[#30D158]/15 text-[#30D158] flex items-center justify-center shrink-0">
                  <ArrowUpCircle size={20} />
                </div>
                <div className="min-w-0 overflow-hidden">
                  <p className="text-[14px] font-bold oneui-text truncate leading-tight">Nova Entrada</p>
                  <p className="text-[11px] oneui-text-muted truncate mt-0.5">Receita · Pix</p>
                </div>
              </motion.button>

              <motion.button
                whileTap={{ scale: 0.96 }}
                type="button"
                onClick={() => onOpenTransaction?.(TransactionType.EXPENSE)}
                className="oneui-card oneui-hover p-4 flex items-center gap-3 min-w-0 text-left gpu-accelerated"
              >
                <div className="w-10 h-10 rounded-[14px] bg-[#FF453A]/15 text-[#FF453A] flex items-center justify-center shrink-0">
                  <ArrowDownCircle size={20} />
                </div>
                <div className="min-w-0 overflow-hidden">
                  <p className="text-[14px] font-bold oneui-text truncate leading-tight">Nova Saída</p>
                  <p className="text-[11px] oneui-text-muted truncate mt-0.5">Gasto · Conta</p>
                </div>
              </motion.button>

              <motion.button
                whileTap={{ scale: 0.96 }}
                type="button"
                onClick={() => setCurrentView('extended')}
                className="oneui-card oneui-hover p-4 flex items-center gap-3 min-w-0 text-left gpu-accelerated"
              >
                <div
                  className="w-10 h-10 rounded-[14px] flex items-center justify-center shrink-0"
                  style={{ backgroundColor: 'var(--app-accent-soft)', color: 'var(--app-accent)' }}
                >
                  <Layers size={20} />
                </div>
                <div className="min-w-0 overflow-hidden">
                  <p className="text-[14px] font-bold oneui-text truncate leading-tight">Fluxo 30 Dias</p>
                  <p className="text-[11px] oneui-text-muted truncate mt-0.5">Visão ampliada</p>
                </div>
              </motion.button>

              <motion.button
                whileTap={{ scale: 0.96 }}
                type="button"
                disabled={aiLoading}
                onClick={() => onGenerateAI()}
                className="oneui-card oneui-hover p-4 flex items-center gap-3 min-w-0 text-left disabled:opacity-60 gpu-accelerated"
              >
                <div className="w-10 h-10 rounded-[14px] bg-[#9D7BFF]/15 text-[#9D7BFF] flex items-center justify-center shrink-0">
                  {aiLoading ? <Loader2 size={20} className="animate-spin" /> : <Sparkles size={20} />}
                </div>
                <div className="min-w-0 overflow-hidden">
                  <p className="text-[14px] font-bold oneui-text truncate leading-tight">
                    {aiLoading ? 'Analisando...' : 'Diagnóstico IA'}
                  </p>
                  <p className="text-[11px] oneui-text-muted truncate mt-0.5">Insights ativos</p>
                </div>
              </motion.button>
            </div>

            {/* CASH FLOW CHART SECTION */}
            <div className="oneui-card p-5 sm:p-6 space-y-5 w-full min-w-0">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-[17px] font-bold oneui-text flex items-center gap-2">
                    <TrendingUp style={{ color: 'var(--app-accent)' }} size={19} />
                    Fluxo de Caixa (7 dias)
                  </h3>
                  <p className="text-[12px] oneui-text-muted mt-0.5">Evolução diária de entradas e saídas</p>
                </div>

                <div className="oneui-surface-2 flex items-center gap-1 p-1 rounded-[14px] self-start sm:self-auto">
                  <button
                    type="button"
                    onClick={() => setCurrentView('default')}
                    className={`px-3.5 py-1.5 rounded-[10px] text-[12px] font-semibold transition-all ${
                      currentView === 'default' ? 'oneui-accent-btn shadow-sm' : 'oneui-text-secondary'
                    }`}
                  >
                    7 Dias
                  </button>
                  <button
                    type="button"
                    onClick={() => setCurrentView('extended')}
                    className={`px-3.5 py-1.5 rounded-[10px] text-[12px] font-semibold transition-all ${
                      currentView === 'extended' ? 'oneui-accent-btn shadow-sm' : 'oneui-text-secondary'
                    }`}
                  >
                    30 Dias →
                  </button>
                </div>
              </div>

              <div className="h-[220px] sm:h-[260px] w-full min-w-0 relative overflow-hidden">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorIncome" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#30D158" stopOpacity={0.35} />
                        <stop offset="95%" stopColor="#30D158" stopOpacity={0.0} />
                      </linearGradient>
                      <linearGradient id="colorExpense" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#FF453A" stopOpacity={0.35} />
                        <stop offset="95%" stopColor="#FF453A" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--app-chart-grid)" vertical={false} />
                    <XAxis
                      dataKey="name"
                      stroke="var(--app-chart-axis)"
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      stroke="var(--app-chart-axis)"
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(value) => `R$${value}`}
                    />
                    <Tooltip content={<CustomChartTooltip />} />
                    <Area
                      type="monotone"
                      dataKey="income"
                      name="Entradas"
                      stroke="#30D158"
                      strokeWidth={2.5}
                      fillOpacity={1}
                      fill="url(#colorIncome)"
                    />
                    <Area
                      type="monotone"
                      dataKey="expense"
                      name="Saídas"
                      stroke="#FF453A"
                      strokeWidth={2.5}
                      fillOpacity={1}
                      fill="url(#colorExpense)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              <div
                className="rounded-[20px] p-4 flex items-start gap-3.5 min-w-0"
                style={{
                  background:
                    'linear-gradient(135deg, var(--app-accent-soft) 0%, rgba(139, 92, 246, 0.12) 100%)',
                  border: '1px solid var(--app-border-strong)',
                }}
              >
                <div className="w-9 h-9 rounded-[12px] bg-gradient-to-tr from-[#4C7BFF] to-[#8B5CF6] text-white flex items-center justify-center shrink-0 shadow-sm">
                  <Sparkles size={17} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <h4 className="text-[13px] font-bold oneui-text truncate">
                      Inteligência Financeira Capitalyx
                    </h4>
                    {aiInsight?.cashFlowTip && (
                      <span className="text-[11px] font-semibold text-[#30D158] shrink-0">Atualizado</span>
                    )}
                  </div>
                  <p className="text-[13px] oneui-text-secondary leading-relaxed">
                    {aiInsight?.cashFlowTip ||
                      'A análise inteligente avalia seus padrões diários para sugerir ajustes práticos no seu fluxo de caixa.'}
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="extended"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.2 }}
            className="w-full max-w-full min-w-0"
          >
            <ExtendedAnalytics
              transactions={transactions}
              onBack={() => setCurrentView('default')}
              goals={goals}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Dashboard;
