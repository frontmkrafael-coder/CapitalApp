import React, { useMemo } from 'react';
import { Transaction, TransactionType, FinancialGoal } from '../types';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Legend,
} from 'recharts';
import { motion } from 'framer-motion';
import { TrendingUp, Target, ArrowLeft } from 'lucide-react';

interface ExtendedAnalyticsProps {
  transactions: Transaction[];
  goals: FinancialGoal[];
  onBack: () => void;
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  }).format(value);
};

const CustomChartTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const income = payload.find((p: any) => p.dataKey === 'income')?.value || 0;
    const expense = payload.find((p: any) => p.dataKey === 'expense')?.value || 0;
    return (
      <div className="oneui-dock rounded-[18px] p-3 text-xs space-y-1.5 min-w-[140px]">
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

const ExtendedAnalytics: React.FC<ExtendedAnalyticsProps> = ({ transactions, goals, onBack }) => {
  const cashFlowData = useMemo(() => {
    const dataMap: Record<string, { name: string; income: number; expense: number; balance: number }> = {};
    const now = new Date();

    for (let i = 29; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      const key = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
      dataMap[key] = { name: key, income: 0, expense: 0, balance: 0 };
    }

    transactions.forEach((t) => {
      if (!t.date) return;
      const parts = t.date.split('-').map(Number);
      if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return;
      const date = new Date(parts[0], parts[1] - 1, parts[2]);
      const key = date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });

      if (dataMap[key]) {
        if (t.type === TransactionType.INCOME) dataMap[key].income += t.amount;
        else dataMap[key].expense += t.amount;
      }
    });

    return Object.values(dataMap);
  }, [transactions]);

  const goalsData = useMemo(() => {
    return goals
      .filter((g) => !g.isCompleted && g.targetAmount > 0)
      .map((g) => {
        const clampedCurrent = Math.min(Math.max(0, g.currentAmount), g.targetAmount);
        return {
          name: g.title,
          current: clampedCurrent,
          remaining: Math.max(0, g.targetAmount - clampedCurrent),
          target: g.targetAmount,
          progress: Math.min((g.currentAmount / g.targetAmount) * 100, 100),
        };
      });
  }, [goals]);

  return (
    <div className="space-y-6 flex flex-col pb-12">
      <div className="flex items-center gap-3.5 mb-1">
        <button
          type="button"
          onClick={onBack}
          className="w-10 h-10 oneui-card oneui-hover rounded-full flex items-center justify-center oneui-text active:scale-90 transition-transform shrink-0"
          aria-label="Voltar"
        >
          <ArrowLeft size={18} />
        </button>
        <div>
          <h2 className="text-xl md:text-2xl font-extrabold oneui-text tracking-tight">
            Análise Detalhada (30 Dias)
          </h2>
          <p className="text-[12px] oneui-text-muted">Visão panorâmica de fluxo e execução de metas</p>
        </div>
      </div>

      {/* BIG CASH FLOW CHART */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="oneui-card p-6 flex flex-col"
      >
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-[12px] flex items-center justify-center"
              style={{ backgroundColor: 'var(--app-accent-soft)', color: 'var(--app-accent)' }}
            >
              <TrendingUp size={18} />
            </div>
            <h3 className="text-[16px] font-bold oneui-text">Fluxo de Caixa Diário</h3>
          </div>
          <span className="text-[12px] font-semibold oneui-text-muted">Últimos 30 dias</span>
        </div>

        <div className="w-full h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={cashFlowData} margin={{ top: 10, right: 10, left: -18, bottom: 0 }}>
              <defs>
                <linearGradient id="iosIncomeBig" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#30D158" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#30D158" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="iosExpenseBig" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#FF453A" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#FF453A" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--app-chart-grid)" vertical={false} />
              <XAxis
                dataKey="name"
                stroke="var(--app-chart-axis)"
                fontSize={10}
                tickLine={false}
                axisLine={false}
                interval={4}
              />
              <YAxis
                stroke="var(--app-chart-axis)"
                fontSize={10}
                tickLine={false}
                axisLine={false}
                tickFormatter={(val) => (val >= 1000 ? `R$${(val / 1000).toFixed(1)}k` : `R$${val}`)}
              />
              <Tooltip content={<CustomChartTooltip />} />
              <Area
                type="monotone"
                dataKey="income"
                name="Receita"
                stroke="#30D158"
                strokeWidth={2.5}
                fillOpacity={1}
                fill="url(#iosIncomeBig)"
              />
              <Area
                type="monotone"
                dataKey="expense"
                name="Despesa"
                stroke="#FF453A"
                strokeWidth={2.5}
                fillOpacity={1}
                fill="url(#iosExpenseBig)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </motion.div>

      {/* GOALS COMPLETION CARD */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.08 }}
        className="oneui-card p-6 flex flex-col"
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-[12px] bg-[#FF9F0A]/15 text-[#FF9F0A] flex items-center justify-center">
              <Target size={18} />
            </div>
            <h3 className="text-[16px] font-bold oneui-text">Execução e Progresso das Metas</h3>
          </div>
        </div>

        {goalsData.length > 0 ? (
          <div className="w-full h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={goalsData} layout="vertical" margin={{ top: 0, right: 30, left: 20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--app-chart-grid)" horizontal={false} />
                <XAxis type="number" hide />
                <YAxis
                  dataKey="name"
                  type="category"
                  stroke="var(--app-chart-axis)"
                  fontSize={11}
                  width={100}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  cursor={{ fill: 'var(--app-hover)' }}
                  contentStyle={{
                    backgroundColor: 'var(--app-surface)',
                    borderColor: 'var(--app-border-strong)',
                    borderRadius: '16px',
                    color: 'var(--app-text)',
                  }}
                  formatter={(value: number, name: string) => [
                    formatCurrency(value),
                    name === 'remaining' ? 'Faltante' : 'Guardado',
                  ]}
                />
                <Legend />
                <Bar
                  dataKey="current"
                  name="Guardado"
                  stackId="a"
                  fill="var(--app-accent)"
                  radius={[6, 0, 0, 6]}
                  barSize={18}
                />
                <Bar
                  dataKey="remaining"
                  name="Faltante"
                  stackId="a"
                  fill="var(--app-surface-3)"
                  radius={[0, 6, 6, 0]}
                  barSize={18}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center oneui-text-muted min-h-[180px]">
            <Target size={34} className="mb-2 opacity-50" />
            <p className="text-[14px]">Nenhuma meta ativa para analisar no momento.</p>
          </div>
        )}
      </motion.div>
    </div>
  );
};

export default ExtendedAnalytics;
