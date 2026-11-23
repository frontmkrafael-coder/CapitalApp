import React, { useState, useMemo } from 'react';
import { FinancialGoal } from '../types';
import {
  Target,
  Sparkles,
  Plus,
  Trash2,
  Award,
  Calendar,
  Check,
  Wallet,
  AlertTriangle,
  TrendingUp,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface GoalsProps {
  goals: FinancialGoal[];
  availableBalance: number;
  onAddGoal: (goal: Omit<FinancialGoal, 'id'>) => Promise<void> | void;
  onDepositFromBalance: (goal: FinancialGoal, amount: number) => Promise<void>;
  onDeleteGoal: (id: string) => Promise<void> | void;
  onOpenNewGoal?: () => void;
  suggestions?: { title: string; targetAmount: number; deadline: string }[];
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
};

const formatDate = (dateStr: string) => {
  try {
    const [year, month, day] = dateStr.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return dateStr;
  }
};

const getDaysRemaining = (deadlineStr: string): number => {
  try {
    const [y, m, d] = deadlineStr.split('-').map(Number);
    const target = new Date(y, m - 1, d);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  } catch {
    return 0;
  }
};

const Goals: React.FC<GoalsProps> = ({
  goals,
  availableBalance,
  onAddGoal,
  onDepositFromBalance,
  onDeleteGoal,
  onOpenNewGoal,
  suggestions,
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [addAmountStr, setAddAmountStr] = useState('');
  const [depositingId, setDepositingId] = useState<string | null>(null);

  const activeGoals = useMemo(() => goals.filter((g) => !g.isCompleted), [goals]);
  const completedGoals = useMemo(() => goals.filter((g) => g.isCompleted), [goals]);

  const nearCompletionGoals = useMemo(
    () =>
      activeGoals.filter((g) => {
        if (g.targetAmount <= 0 || g.currentAmount >= g.targetAmount) return false;
        const missingRatio = (g.targetAmount - g.currentAmount) / g.targetAmount;
        return missingRatio > 0 && missingRatio < 0.1;
      }),
    [activeGoals]
  );

  const summary = useMemo(() => {
    const totalReserved = goals.reduce((sum, g) => sum + (g.currentAmount || 0), 0);
    const totalTarget = goals.reduce((sum, g) => sum + (g.targetAmount || 0), 0);
    const overallProgress = totalTarget > 0 ? Math.min(100, Math.round((totalReserved / totalTarget) * 100)) : 0;
    return { totalReserved, totalTarget, overallProgress };
  }, [goals]);

  const executeDeposit = async (goal: FinancialGoal, rawValue: number) => {
    const value = Number(rawValue.toFixed(2));
    if (!Number.isFinite(value) || value <= 0) return;
    if (value > availableBalance) return;
    setDepositingId(goal.id);
    try {
      await onDepositFromBalance(goal, value);
      setEditingId(null);
      setAddAmountStr('');
    } finally {
      setDepositingId(null);
    }
  };

  const handleUpdateProgress = (goal: FinancialGoal) => {
    if (editingId === goal.id) {
      const valueToAdd = parseFloat(addAmountStr);
      if (Number.isFinite(valueToAdd) && valueToAdd > 0 && valueToAdd <= availableBalance) {
        executeDeposit(goal, valueToAdd);
      }
    } else {
      setAddAmountStr('');
      setEditingId(goal.id);
    }
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setAddAmountStr('');
  };

  const handleAcceptSuggestion = (suggestion: { title: string; targetAmount: number; deadline: string }) => {
    const safeTarget = Number(suggestion.targetAmount);
    if (!suggestion.title || !Number.isFinite(safeTarget) || safeTarget <= 0) return;
    onAddGoal({
      title: suggestion.title,
      targetAmount: safeTarget,
      currentAmount: 0,
      deadline: suggestion.deadline,
      isAI: true,
      isCompleted: false,
    });
  };

  const renderGoalCard = (goal: FinancialGoal, idx: number) => {
    const progress =
      goal.targetAmount > 0 ? Math.min(Math.max((goal.currentAmount / goal.targetAmount) * 100, 0), 100) : 0;
    const remaining = Math.max(0, goal.targetAmount - goal.currentAmount);
    const missingRatio = goal.targetAmount > 0 ? remaining / goal.targetAmount : 1;
    const isNearCompletion = !goal.isCompleted && remaining > 0 && missingRatio < 0.1;
    const daysLeft = getDaysRemaining(goal.deadline);
    const monthsLeft = Math.max(1, daysLeft / 30.4375);
    const suggestedMonthly = !goal.isCompleted && remaining > 0 ? remaining / monthsLeft : 0;

    const isEditing = editingId === goal.id;
    const isBusy = depositingId === goal.id;
    const parsedInput = parseFloat(addAmountStr);
    const exceedsBalance = Number.isFinite(parsedInput) && parsedInput > availableBalance;
    const canConfirm =
      !isBusy &&
      Number.isFinite(parsedInput) &&
      parsedInput > 0 &&
      parsedInput <= availableBalance;

    const quarterBalance = Number(Math.max(0, availableBalance * 0.25).toFixed(2));

    return (
      <motion.div
        key={goal.id}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96 }}
        transition={{ duration: 0.18, delay: Math.min(idx * 0.03, 0.15) }}
        className="oneui-card p-6 relative overflow-hidden flex flex-col justify-between gpu-accelerated"
        style={
          goal.isCompleted
            ? { borderColor: 'rgba(48, 209, 88, 0.35)' }
            : isNearCompletion
            ? { borderColor: 'rgba(255, 159, 10, 0.5)' }
            : undefined
        }
      >
        <div>
          <div className="flex justify-between items-start mb-3">
            <div className="flex items-center gap-3 max-w-[82%]">
              <div
                className={`w-9 h-9 rounded-[12px] ${
                  goal.isCompleted ? 'bg-[#30D158]/15 text-[#30D158]' : 'bg-[#FF9F0A]/15 text-[#FF9F0A]'
                } flex items-center justify-center shrink-0`}
              >
                {goal.isCompleted ? <Award size={18} /> : <Target size={18} />}
              </div>
              <div className="min-w-0">
                <h3 className="font-bold text-[16px] oneui-text truncate" title={goal.title}>
                  {goal.title}
                </h3>
                <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                  {goal.isAI && <span className="text-[11px] font-semibold text-[#9D7BFF]">Sugerido por IA</span>}
                  {isNearCompletion && (
                    <span className="px-2 py-0.5 rounded-full bg-[#FF9F0A]/18 text-[#FF9F0A] text-[10px] font-bold">
                      Meta quase atingida
                    </span>
                  )}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => onDeleteGoal(goal.id)}
              className="oneui-text-muted hover:text-[#FF453A] p-2 hover:bg-[#FF453A]/10 rounded-xl transition-colors"
              title="Remover Meta"
              aria-label="Remover Meta"
            >
              <Trash2 size={16} />
            </button>
          </div>

          <div className="space-y-4 mt-4">
            <div className="flex justify-between items-end gap-2">
              <div>
                <p className="text-[11px] oneui-text-muted uppercase tracking-wider mb-0.5">
                  {isEditing ? 'Aportar do Saldo Principal' : 'Valor Guardado'}
                </p>
                {isEditing ? (
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className="text-[#30D158] font-bold text-lg">+ R$</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={addAmountStr}
                      onChange={(e) => setAddAmountStr(e.target.value)}
                      className="w-28 oneui-surface-2 rounded-[12px] px-3 py-1.5 text-[15px] font-bold oneui-text focus:outline-none tabular-nums"
                      autoFocus
                      placeholder="0.00"
                    />
                  </div>
                ) : (
                  <p className="text-2xl font-extrabold oneui-text tabular-nums">
                    {formatCurrency(goal.currentAmount)}
                  </p>
                )}
              </div>

              <div className="text-right">
                <p className="text-[11px] oneui-text-muted uppercase tracking-wider mb-0.5">Meta Alvo</p>
                <p className="text-[15px] font-bold oneui-text-secondary tabular-nums">
                  {formatCurrency(goal.targetAmount)}
                </p>
              </div>
            </div>

            <div>
              <div className="flex justify-between text-[12px] oneui-text-muted mb-1.5 font-medium">
                <span>Progresso</span>
                <span className="tabular-nums font-bold oneui-text">{Math.round(progress)}%</span>
              </div>
              <div
                className="h-3 rounded-full overflow-hidden relative"
                style={{ backgroundColor: 'var(--app-surface-2)' }}
              >
                <motion.div
                  className={`h-full w-full rounded-full gpu-accelerated ${
                    goal.isCompleted
                      ? 'bg-gradient-to-r from-[#30D158] to-[#34D399]'
                      : isNearCompletion
                      ? 'bg-gradient-to-r from-[#FF9F0A] to-[#30D158]'
                      : 'bg-gradient-to-r from-[#FF9F0A] to-[#FFD60A]'
                  }`}
                  style={{ transformOrigin: 'left' }}
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: progress / 100 }}
                  transition={{ type: 'spring', stiffness: 320, damping: 28 }}
                />
              </div>
            </div>

            {!goal.isCompleted && (
              <div className="oneui-surface-2 px-3.5 py-2.5 flex items-center justify-between gap-2 text-[12px] tabular-nums">
                <span className="oneui-text-secondary">
                  Faltam <strong className="oneui-text">{formatCurrency(remaining)}</strong>
                </span>
                <span className="oneui-text-muted">
                  {daysLeft > 0
                    ? `~${formatCurrency(suggestedMonthly)}/mês`
                    : daysLeft === 0
                    ? 'Vence hoje'
                    : 'Prazo vencido'}
                </span>
              </div>
            )}

            {isEditing && (
              <div className="space-y-2 pt-1">
                <div className="flex items-center justify-between text-[11px] px-1 tabular-nums">
                  <span className="oneui-text-muted">Saldo Principal disponível:</span>
                  <span
                    className={`font-bold ${
                      availableBalance > 0 ? 'text-[#30D158]' : 'text-[#FF453A]'
                    }`}
                  >
                    {formatCurrency(availableBalance)}
                  </span>
                </div>

                {(exceedsBalance || availableBalance <= 0) && (
                  <p className="text-[11px] text-[#FF453A] font-semibold px-1">
                    {availableBalance <= 0
                      ? 'Saldo Principal insuficiente para novos aportes.'
                      : 'Valor excede seu Saldo Principal disponível.'}
                  </p>
                )}

                <div className="grid grid-cols-4 gap-1.5">
                  {[50, 100].map((val) => (
                    <button
                      key={val}
                      type="button"
                      disabled={isBusy || availableBalance < val}
                      onClick={() => executeDeposit(goal, val)}
                      className="py-1.5 rounded-[10px] oneui-surface-2 oneui-hover text-[12px] font-bold oneui-text active:scale-95 transition-transform tabular-nums disabled:opacity-40"
                    >
                      +{val}
                    </button>
                  ))}
                  <button
                    type="button"
                    disabled={isBusy || quarterBalance <= 0}
                    onClick={() => executeDeposit(goal, quarterBalance)}
                    className="py-1.5 rounded-[10px] oneui-surface-2 oneui-hover text-[11px] font-bold oneui-text active:scale-95 transition-transform disabled:opacity-40"
                  >
                    25% Saldo
                  </button>
                  <button
                    type="button"
                    disabled={isBusy || remaining <= 0 || availableBalance < remaining}
                    onClick={() => executeDeposit(goal, remaining)}
                    className="py-1.5 rounded-[10px] bg-[#30D158]/18 text-[#30D158] text-[11px] font-bold active:scale-95 transition-transform disabled:opacity-40"
                  >
                    Completar
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        <div
          className="mt-5 pt-3.5 flex justify-between items-center gap-2"
          style={{ borderTop: '1px solid var(--app-divider)' }}
        >
          {!isEditing ? (
            <div className="flex items-center gap-1.5 text-[12px] oneui-text-muted tabular-nums">
              <Calendar size={13} />
              <span>
                {formatDate(goal.deadline)}
                {!goal.isCompleted && daysLeft > 0 ? ` (${daysLeft}d)` : ''}
              </span>
            </div>
          ) : (
            <button
              type="button"
              onClick={handleCancelEdit}
              className="text-[13px] font-medium oneui-text-secondary hover:opacity-100"
            >
              Cancelar
            </button>
          )}

          {!goal.isCompleted && (
            <button
              type="button"
              disabled={isEditing ? !canConfirm : isBusy}
              onClick={() => handleUpdateProgress(goal)}
              className={`text-[13px] px-4 py-2 min-h-[38px] rounded-[14px] font-semibold transition-transform active:scale-95 flex items-center gap-1.5 shadow-sm disabled:opacity-45 ${
                isEditing ? 'bg-[#30D158] text-black' : 'oneui-accent-btn'
              }`}
            >
              {isEditing ? <Check size={14} strokeWidth={2.5} /> : <Plus size={14} strokeWidth={2.5} />}
              <span>{isBusy ? 'Aplicando...' : isEditing ? 'Confirmar' : 'Usar Saldo'}</span>
            </button>
          )}

          {goal.isCompleted && (
            <div className="flex items-center gap-1.5 text-[#30D158] text-[13px] font-bold">
              <Award size={15} />
              <span>Concluída</span>
            </div>
          )}
        </div>
      </motion.div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Top KPI Bar: Saldo Principal & Resumo das Metas */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        <div className="oneui-card p-5 gpu-accelerated">
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider oneui-text-muted mb-1">
            <Wallet size={13} className="text-[#30D158]" />
            <span>Saldo Principal Disponível</span>
          </div>
          <p
            className={`text-2xl font-extrabold tabular-nums ${
              availableBalance > 0 ? 'text-[#30D158]' : 'text-[#FF453A]'
            }`}
          >
            {formatCurrency(availableBalance)}
          </p>
          <p className="text-[11px] oneui-text-muted mt-1">
            Aportes descontam automaticamente do Saldo Principal
          </p>
        </div>

        <div className="oneui-card p-5 gpu-accelerated">
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider oneui-text-muted mb-1">
            <Target size={13} className="text-[#FF9F0A]" />
            <span>Reservado em Metas</span>
          </div>
          <p className="text-2xl font-extrabold oneui-text tabular-nums">
            {formatCurrency(summary.totalReserved)}
          </p>
          <p className="text-[11px] oneui-text-muted mt-1 tabular-nums">
            De {formatCurrency(summary.totalTarget)} planejados
          </p>
        </div>

        <div className="oneui-card p-5 gpu-accelerated">
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider oneui-text-muted mb-1">
            <TrendingUp size={13} style={{ color: 'var(--app-accent)' }} />
            <span>Progresso Geral</span>
          </div>
          <p className="text-2xl font-extrabold oneui-text tabular-nums">{summary.overallProgress}%</p>
          <div
            className="h-2 rounded-full overflow-hidden mt-2"
            style={{ backgroundColor: 'var(--app-surface-2)' }}
          >
            <motion.div
              className="h-full w-full rounded-full bg-gradient-to-r from-[#4C7BFF] to-[#30D158] gpu-accelerated"
              style={{ transformOrigin: 'left' }}
              initial={{ scaleX: 0 }}
              animate={{ scaleX: summary.overallProgress / 100 }}
              transition={{ type: 'spring', stiffness: 320, damping: 28 }}
            />
          </div>
        </div>
      </div>

      {/* Near-Completion Alert Banner (< 10% remaining) */}
      <AnimatePresence>
        {nearCompletionGoals.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="rounded-[24px] p-4 sm:p-5 bg-[#FF9F0A]/12 border border-[#FF9F0A]/35 space-y-3 gpu-accelerated"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-[12px] bg-[#FF9F0A]/20 text-[#FF9F0A] flex items-center justify-center shrink-0">
                <AlertTriangle size={18} />
              </div>
              <div>
                <h3 className="text-[15px] font-bold oneui-text">
                  Meta quase atingida!
                </h3>
                <p className="text-[12px] oneui-text-secondary">
                  Falta menos de 10% para concluir {nearCompletionGoals.length === 1 ? 'este objetivo' : 'estes objetivos'}:
                </p>
              </div>
            </div>

            <div className="space-y-2">
              {nearCompletionGoals.map((g) => {
                const remaining = Math.max(0, g.targetAmount - g.currentAmount);
                const pctLeft = ((remaining / g.targetAmount) * 100).toFixed(1);
                const canCompleteNow = availableBalance >= remaining;
                return (
                  <div
                    key={g.id}
                    className="oneui-surface-2 px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5"
                  >
                    <div className="min-w-0">
                      <p className="text-[14px] font-bold oneui-text truncate">{g.title}</p>
                      <p className="text-[12px] oneui-text-secondary tabular-nums">
                        Faltam apenas <strong className="text-[#FF9F0A]">{formatCurrency(remaining)}</strong> ({pctLeft}%)
                      </p>
                    </div>
                    {canCompleteNow && (
                      <button
                        type="button"
                        disabled={depositingId === g.id}
                        onClick={() => executeDeposit(g, remaining)}
                        className="px-3.5 py-2 min-h-[38px] rounded-[12px] bg-[#30D158] text-black text-[12px] font-bold active:scale-95 transition-transform shrink-0"
                      >
                        {depositingId === g.id ? 'Concluindo...' : 'Completar com Saldo'}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {suggestions && suggestions.length > 0 && (
        <div
          className="oneui-card p-6"
          style={{
            background:
              'linear-gradient(135deg, var(--app-accent-soft) 0%, rgba(139, 92, 246, 0.12) 100%)',
          }}
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="w-9 h-9 rounded-[12px] bg-gradient-to-tr from-[#4C7BFF] to-[#8B5CF6] text-white flex items-center justify-center">
              <Sparkles size={17} />
            </div>
            <div>
              <h3 className="text-[16px] font-bold oneui-text">Metas Recomendadas pela IA</h3>
              <p className="text-[12px] oneui-text-secondary">Baseado nos seus gastos e projeções financeiras</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {suggestions.map((s, idx) => (
              <div key={idx} className="oneui-card p-4 flex justify-between items-center gap-3">
                <div className="min-w-0">
                  <p className="font-semibold oneui-text text-[15px] truncate">{s.title}</p>
                  <p className="text-[14px] text-[#30D158] font-bold mt-0.5 tabular-nums">
                    {formatCurrency(s.targetAmount)}
                  </p>
                  <p className="text-[11px] oneui-text-muted mt-0.5">Prazo: {formatDate(s.deadline)}</p>
                </div>
                <button
                  type="button"
                  onClick={() => handleAcceptSuggestion(s)}
                  className="oneui-accent-btn px-3.5 py-2.5 rounded-[14px] transition-transform active:scale-95 flex items-center gap-1.5 text-[12px] font-semibold shrink-0"
                  title="Aceitar Meta"
                >
                  <Plus size={15} strokeWidth={2.5} />
                  <span>Adicionar</span>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[18px] font-bold oneui-text flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-[11px] bg-[#FF9F0A]/15 text-[#FF9F0A] flex items-center justify-center">
              <Target size={17} />
            </div>
            <span>Metas em Andamento ({activeGoals.length})</span>
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          <AnimatePresence>{activeGoals.map((g, idx) => renderGoalCard(g, idx))}</AnimatePresence>

          {activeGoals.length === 0 && (!suggestions || suggestions.length === 0) && completedGoals.length === 0 && (
            <div
              className="col-span-full py-14 text-center rounded-[28px] p-8"
              style={{
                border: '1.5px dashed var(--app-border-strong)',
                backgroundColor: 'var(--app-surface)',
              }}
            >
              <div className="w-14 h-14 rounded-full oneui-surface-2 flex items-center justify-center mx-auto mb-3 oneui-text-muted">
                <Target size={26} />
              </div>
              <p className="text-[16px] font-bold oneui-text">Nenhuma meta cadastrada</p>
              <p className="text-[13px] oneui-text-secondary max-w-sm mx-auto mt-1 mb-5">
                Defina objetivos como viagem, reserva de emergência ou compra para acompanhar seu progresso.
              </p>
              {onOpenNewGoal && (
                <button
                  type="button"
                  onClick={onOpenNewGoal}
                  className="oneui-accent-btn px-5 py-3 rounded-[16px] text-[14px] font-semibold inline-flex items-center gap-2 active:scale-95 transition-transform"
                >
                  <Plus size={16} strokeWidth={2.5} />
                  <span>Criar Primeira Meta</span>
                </button>
              )}
            </div>
          )}

          {activeGoals.length === 0 && completedGoals.length > 0 && (
            <div className="col-span-full py-8 text-center oneui-card p-6">
              <p className="text-[15px] oneui-text font-semibold">
                Todas as metas ativas foram concluídas com sucesso!
              </p>
              <p className="text-[12px] oneui-text-muted mt-1">
                Crie um novo objetivo financeiro para continuar evoluindo.
              </p>
            </div>
          )}
        </div>
      </div>

      {completedGoals.length > 0 && (
        <div className="pt-6" style={{ borderTop: '1px solid var(--app-divider)' }}>
          <h2 className="text-[18px] font-bold oneui-text flex items-center gap-2.5 mb-4">
            <div className="w-8 h-8 rounded-[11px] bg-[#30D158]/15 text-[#30D158] flex items-center justify-center">
              <Award size={17} />
            </div>
            <span>Metas Concluídas ({completedGoals.length})</span>
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {completedGoals.map((g, idx) => renderGoalCard(g, idx))}
          </div>
        </div>
      )}
    </div>
  );
};

export default Goals;
