import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { RecurringPayment, RecurringFrequency, TransactionType } from '../types';
import { getTodayIsoDate } from '../services/firebase';
import {
  Repeat,
  Plus,
  Play,
  SkipForward,
  Pause,
  Trash2,
  Edit3,
  Calendar,
  X,
  ArrowUpRight,
  ArrowDownRight,
  Zap,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface RecurringPaymentsProps {
  recurringPayments: RecurringPayment[];
  onAdd: (data: Omit<RecurringPayment, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  onUpdate: (id: string, updates: Partial<RecurringPayment>) => Promise<void>;
  onExecuteNow: (item: RecurringPayment) => Promise<void>;
  onSkipCycle: (item: RecurringPayment) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

const formatDateBr = (dateStr: string) => {
  try {
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
};

const FREQ_LABELS: Record<RecurringFrequency, string> = {
  weekly: 'Semanal',
  biweekly: 'Quinzenal',
  monthly: 'Mensal',
  yearly: 'Anual',
};

const MONTHLY_MULTIPLIER: Record<RecurringFrequency, number> = {
  weekly: 4.33,
  biweekly: 2.17,
  monthly: 1,
  yearly: 1 / 12,
};

const CATEGORIES_BY_TYPE: Record<TransactionType, string[]> = {
  [TransactionType.EXPENSE]: [
    'Contas',
    'Moradia',
    'Alimentação',
    'Transporte',
    'Saúde',
    'Educação',
    'Lazer',
    'Metas',
  ],
  [TransactionType.INCOME]: ['Salário', 'Freelance', 'Pix', 'Investimentos'],
};

const getDueBadge = (nextDueDate: string, isActive: boolean) => {
  if (!isActive) {
    return { label: 'Pausado', cls: 'bg-[#64748B]/18 text-[#94A3B8]' };
  }
  const today = getTodayIsoDate();
  if (nextDueDate < today) {
    return { label: 'Vencido', cls: 'bg-[#FF453A]/16 text-[#FF453A]' };
  }
  if (nextDueDate === today) {
    return { label: 'Vence hoje', cls: 'bg-[#FF9F0A]/18 text-[#FF9F0A]' };
  }
  const [ty, tm, td] = today.split('-').map(Number);
  const [ny, nm, nd] = nextDueDate.split('-').map(Number);
  const diffDays = Math.round(
    (new Date(ny, nm - 1, nd).getTime() - new Date(ty, tm - 1, td).getTime()) / (1000 * 60 * 60 * 24)
  );
  if (diffDays <= 5) {
    return { label: `Em ${diffDays}d`, cls: 'bg-[#FF9F0A]/15 text-[#FF9F0A]' };
  }
  return { label: `Em ${diffDays}d`, cls: 'bg-[#30D158]/15 text-[#30D158]' };
};

const RecurringPayments: React.FC<RecurringPaymentsProps> = ({
  recurringPayments,
  onAdd,
  onUpdate,
  onExecuteNow,
  onSkipCycle,
  onDelete,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<RecurringPayment | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [type, setType] = useState<TransactionType>(TransactionType.EXPENSE);
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('Contas');
  const [frequency, setFrequency] = useState<RecurringFrequency>('monthly');
  const [dayOfMonth, setDayOfMonth] = useState('5');
  const [nextDueDate, setNextDueDate] = useState(getTodayIsoDate);
  const [autoProcess, setAutoProcess] = useState(true);

  useEffect(() => {
    if (!isModalOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsModalOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [isModalOpen]);

  const summary = useMemo(() => {
    let monthlyIncome = 0;
    let monthlyExpense = 0;
    for (const item of recurringPayments) {
      if (!item.isActive) continue;
      const monthlyValue = item.amount * (MONTHLY_MULTIPLIER[item.frequency] || 1);
      if (item.type === TransactionType.INCOME) monthlyIncome += monthlyValue;
      else monthlyExpense += monthlyValue;
    }
    return {
      monthlyIncome,
      monthlyExpense,
      netMonthly: monthlyIncome - monthlyExpense,
      activeCount: recurringPayments.filter((i) => i.isActive).length,
    };
  }, [recurringPayments]);

  const openCreateModal = () => {
    setEditingItem(null);
    const today = getTodayIsoDate();
    setType(TransactionType.EXPENSE);
    setDescription('');
    setAmount('');
    setCategory('Contas');
    setFrequency('monthly');
    setDayOfMonth(String(Number(today.split('-')[2]) || 1));
    setNextDueDate(today);
    setAutoProcess(true);
    setIsModalOpen(true);
  };

  const openEditModal = (item: RecurringPayment) => {
    setEditingItem(item);
    setType(item.type);
    setDescription(item.description);
    setAmount(String(item.amount));
    setCategory(item.category);
    setFrequency(item.frequency);
    setDayOfMonth(String(item.dayOfMonth));
    setNextDueDate(item.nextDueDate);
    setAutoProcess(item.autoProcess);
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAmount = parseFloat(amount);
    const parsedDay = Math.min(31, Math.max(1, parseInt(dayOfMonth, 10) || 1));
    if (!description.trim() || !Number.isFinite(parsedAmount) || parsedAmount <= 0 || !nextDueDate) {
      return;
    }
    setSubmitting(true);
    try {
      if (editingItem) {
        await onUpdate(editingItem.id, {
          description: description.trim(),
          amount: parsedAmount,
          type,
          category,
          frequency,
          dayOfMonth: parsedDay,
          nextDueDate,
          autoProcess,
        });
      } else {
        await onAdd({
          description: description.trim(),
          amount: parsedAmount,
          type,
          category,
          frequency,
          dayOfMonth: parsedDay,
          startDate: nextDueDate,
          nextDueDate,
          lastExecutedDate: null,
          autoProcess,
          isActive: true,
        });
      }
      setIsModalOpen(false);
    } finally {
      setSubmitting(false);
    }
  };

  const runAction = async (id: string, fn: () => Promise<void>) => {
    setBusyId(id);
    try {
      await fn();
    } finally {
      setBusyId(null);
    }
  };

  const modalPortal =
    typeof document !== 'undefined'
      ? createPortal(
          <AnimatePresence>
            {isModalOpen && (
              <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center p-0 sm:p-4">
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setIsModalOpen(false)}
                  className="oneui-modal-backdrop fixed inset-0 backdrop-blur-md gpu-accelerated"
                  style={{ backgroundColor: 'var(--app-backdrop)' }}
                />
                <motion.div
                  initial={{ y: '100%', opacity: 0.9 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: '100%', opacity: 0 }}
                  transition={{ type: 'spring', damping: 30, stiffness: 460, mass: 0.65 }}
                  className="relative z-10 w-full max-w-lg rounded-t-[30px] sm:rounded-[30px] shadow-2xl overflow-hidden max-h-[92dvh] flex flex-col pb-safe gpu-accelerated"
                  style={{
                    backgroundColor: 'var(--app-surface)',
                    border: '1px solid var(--app-border-strong)',
                    color: 'var(--app-text)',
                  }}
                >
                  <div className="pt-3 pb-1 flex justify-center sm:hidden">
                    <div
                      className="w-11 h-1.5 rounded-full"
                      style={{ backgroundColor: 'var(--app-border-strong)' }}
                    />
                  </div>

                  <div
                    className="flex items-center justify-between px-5 py-4"
                    style={{ borderBottom: '1px solid var(--app-divider)' }}
                  >
                    <h2 className="text-[17px] font-bold oneui-text">
                      {editingItem ? 'Editar Recorrência' : 'Novo Pagamento Recorrente'}
                    </h2>
                    <button
                      type="button"
                      onClick={() => setIsModalOpen(false)}
                      className="w-8 h-8 rounded-full oneui-surface-2 flex items-center justify-center oneui-text-secondary active:scale-95"
                      aria-label="Fechar"
                    >
                      <X size={16} />
                    </button>
                  </div>

                  <form onSubmit={handleSave} className="p-5 sm:p-6 space-y-4 overflow-y-auto">
                    <div className="oneui-surface-2 p-1 rounded-[18px] flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          setType(TransactionType.EXPENSE);
                          setCategory('Contas');
                        }}
                        className={`flex-1 min-h-[40px] rounded-[14px] text-[13px] font-semibold transition-all ${
                          type === TransactionType.EXPENSE
                            ? 'bg-[#FF453A] text-white shadow-sm'
                            : 'oneui-text-secondary'
                        }`}
                      >
                        Despesa Fixa
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setType(TransactionType.INCOME);
                          setCategory('Salário');
                        }}
                        className={`flex-1 min-h-[40px] rounded-[14px] text-[13px] font-semibold transition-all ${
                          type === TransactionType.INCOME
                            ? 'bg-[#30D158] text-black shadow-sm'
                            : 'oneui-text-secondary'
                        }`}
                      >
                        Receita Fixa
                      </button>
                    </div>

                    <div className="oneui-surface-2 oneui-divider overflow-hidden">
                      <div className="px-4 py-3.5 flex items-center justify-between gap-3">
                        <label className="text-[14px] font-medium oneui-text-secondary min-w-[90px]">
                          Descrição
                        </label>
                        <input
                          type="text"
                          maxLength={200}
                          required
                          value={description}
                          onChange={(e) => setDescription(e.target.value)}
                          placeholder="Ex: Aluguel, Internet, Mensalidade"
                          className="w-full bg-transparent text-right text-[15px] oneui-text placeholder:opacity-40 focus:outline-none"
                        />
                      </div>

                      <div className="px-4 py-3.5 flex items-center justify-between gap-3">
                        <label className="text-[14px] font-medium oneui-text-secondary min-w-[90px]">
                          Valor (R$)
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          min="0.01"
                          required
                          value={amount}
                          onChange={(e) => setAmount(e.target.value)}
                          placeholder="0.00"
                          className="w-full bg-transparent text-right text-[15px] font-bold oneui-text tabular-nums placeholder:opacity-40 focus:outline-none"
                        />
                      </div>

                      <div className="px-4 py-3.5 flex items-center justify-between gap-3">
                        <label className="text-[14px] font-medium oneui-text-secondary min-w-[90px]">
                          Categoria
                        </label>
                        <select
                          value={category}
                          onChange={(e) => setCategory(e.target.value)}
                          className="bg-transparent text-right text-[14px] font-semibold oneui-text focus:outline-none cursor-pointer"
                        >
                          {CATEGORIES_BY_TYPE[type].map((cat) => (
                            <option key={cat} value={cat} className="bg-[#161620] text-white">
                              {cat}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="px-4 py-3.5 flex items-center justify-between gap-3">
                        <label className="text-[14px] font-medium oneui-text-secondary min-w-[90px]">
                          Dia base
                        </label>
                        <input
                          type="number"
                          min="1"
                          max="31"
                          required
                          value={dayOfMonth}
                          onChange={(e) => setDayOfMonth(e.target.value)}
                          className="w-24 bg-transparent text-right text-[15px] font-bold oneui-text tabular-nums focus:outline-none"
                        />
                      </div>

                      <div className="px-4 py-3.5 flex items-center justify-between gap-3">
                        <label className="text-[14px] font-medium oneui-text-secondary min-w-[110px]">
                          Próximo venc.
                        </label>
                        <input
                          type="date"
                          required
                          value={nextDueDate}
                          onChange={(e) => setNextDueDate(e.target.value)}
                          className="bg-transparent text-right text-[15px] oneui-text tabular-nums focus:outline-none cursor-pointer"
                        />
                      </div>
                    </div>

                    <div>
                      <p className="text-[12px] font-semibold uppercase tracking-wider oneui-text-muted mb-2 px-1">
                        Frequência
                      </p>
                      <div className="oneui-surface-2 p-1 rounded-[16px] grid grid-cols-4 gap-1">
                        {(['weekly', 'biweekly', 'monthly', 'yearly'] as RecurringFrequency[]).map((f) => (
                          <button
                            key={f}
                            type="button"
                            onClick={() => setFrequency(f)}
                            className={`min-h-[38px] rounded-[12px] text-[12px] font-semibold transition-all ${
                              frequency === f ? 'oneui-accent-btn shadow-sm' : 'oneui-text-secondary'
                            }`}
                          >
                            {FREQ_LABELS[f]}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="oneui-surface-2 p-4 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[14px] font-semibold oneui-text">Lançamento automático</p>
                        <p className="text-[11px] oneui-text-muted">
                          Cria a transação no extrato automaticamente ao abrir o app no vencimento
                        </p>
                      </div>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={autoProcess}
                        onClick={() => setAutoProcess((p) => !p)}
                        className="w-[48px] h-[28px] rounded-full p-[3px] transition-colors relative shrink-0"
                        style={{
                          backgroundColor: autoProcess ? '#30D158' : 'var(--app-surface-3)',
                          border: '1px solid var(--app-border-strong)',
                        }}
                      >
                        <div
                          className={`w-[20px] h-[20px] bg-white rounded-full shadow-sm transition-transform ${
                            autoProcess ? 'translate-x-[20px]' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>

                    <button
                      type="submit"
                      disabled={submitting}
                      className="w-full min-h-[48px] oneui-accent-btn font-bold py-3.5 rounded-[18px] shadow-md active:scale-[0.98] transition-transform text-[15px] disabled:opacity-50"
                    >
                      {submitting
                        ? 'Salvando...'
                        : editingItem
                        ? 'Salvar Alterações'
                        : 'Agendar Recorrência'}
                    </button>
                  </form>
                </motion.div>
              </div>
            )}
          </AnimatePresence>,
          document.body
        )
      : null;

  return (
    <div className="space-y-5">
      {/* KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="oneui-card p-4">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[#30D158] uppercase tracking-wider mb-1">
            <ArrowUpRight size={14} />
            <span>Receitas Recorrentes / mês</span>
          </div>
          <p className="text-xl font-extrabold oneui-text tabular-nums">
            {formatCurrency(summary.monthlyIncome)}
          </p>
        </div>

        <div className="oneui-card p-4">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[#FF453A] uppercase tracking-wider mb-1">
            <ArrowDownRight size={14} />
            <span>Despesas Fixas / mês</span>
          </div>
          <p className="text-xl font-extrabold oneui-text tabular-nums">
            {formatCurrency(summary.monthlyExpense)}
          </p>
        </div>

        <div className="oneui-card p-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold oneui-text-muted uppercase tracking-wider mb-1">
              Saldo Previsto ({summary.activeCount} ativos)
            </p>
            <p
              className={`text-xl font-extrabold tabular-nums ${
                summary.netMonthly >= 0 ? 'text-[#30D158]' : 'text-[#FF453A]'
              }`}
            >
              {formatCurrency(summary.netMonthly)}
            </p>
          </div>
          <button
            type="button"
            onClick={openCreateModal}
            className="oneui-accent-btn px-3.5 py-2.5 min-h-[42px] rounded-[14px] text-[13px] font-semibold flex items-center gap-1.5 active:scale-95 transition-transform shrink-0"
          >
            <Plus size={16} strokeWidth={2.5} />
            <span>Agendar</span>
          </button>
        </div>
      </div>

      {/* Schedules List */}
      {recurringPayments.length === 0 ? (
        <div
          className="py-14 text-center rounded-[28px] p-8"
          style={{
            border: '1.5px dashed var(--app-border-strong)',
            backgroundColor: 'var(--app-surface)',
          }}
        >
          <div className="w-14 h-14 rounded-full oneui-surface-2 flex items-center justify-center mx-auto mb-3 oneui-text-muted">
            <Repeat size={26} />
          </div>
          <p className="text-[16px] font-bold oneui-text">Nenhum pagamento recorrente</p>
          <p className="text-[13px] oneui-text-secondary max-w-md mx-auto mt-1 mb-5">
            Cadastre assinaturas, aluguel, contas mensais ou receitas fixas para manter seu saldo previsto sob controle.
          </p>
          <button
            type="button"
            onClick={openCreateModal}
            className="oneui-accent-btn px-5 py-3 rounded-[16px] text-[14px] font-semibold inline-flex items-center gap-2 active:scale-95 transition-transform"
          >
            <Plus size={16} strokeWidth={2.5} />
            <span>Agendar Pagamento Recorrente</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <AnimatePresence>
            {recurringPayments.map((item, idx) => {
              const badge = getDueBadge(item.nextDueDate, item.isActive);
              const isIncome = item.type === TransactionType.INCOME;
              const isBusy = busyId === item.id;
              return (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.96 }}
                  transition={{ duration: 0.18, delay: Math.min(idx * 0.025, 0.14) }}
                  className={`oneui-card p-5 space-y-4 gpu-accelerated ${!item.isActive ? 'opacity-70' : ''}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`w-10 h-10 rounded-[14px] flex items-center justify-center shrink-0 ${
                          isIncome ? 'bg-[#30D158]/15 text-[#30D158]' : 'bg-[#FF453A]/15 text-[#FF453A]'
                        }`}
                      >
                        <Repeat size={18} />
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-[15px] font-bold oneui-text truncate">{item.description}</h3>
                        <p className="text-[12px] oneui-text-muted truncate">
                          {item.category} · {FREQ_LABELS[item.frequency]} (Dia {item.dayOfMonth})
                        </p>
                      </div>
                    </div>

                    <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold shrink-0 ${badge.cls}`}>
                      {badge.label}
                    </span>
                  </div>

                  <div className="flex items-end justify-between gap-3">
                    <div>
                      <p className="text-[11px] oneui-text-muted uppercase tracking-wider">Valor</p>
                      <p
                        className={`text-2xl font-extrabold tabular-nums ${
                          isIncome ? 'text-[#30D158]' : 'oneui-text'
                        }`}
                      >
                        {isIncome ? '+' : '-'}
                        {formatCurrency(item.amount)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[11px] oneui-text-muted flex items-center justify-end gap-1">
                        <Calendar size={11} />
                        <span>Próximo vencimento</span>
                      </p>
                      <p className="text-[13px] font-bold oneui-text-secondary tabular-nums">
                        {formatDateBr(item.nextDueDate)}
                      </p>
                      {item.autoProcess && item.isActive && (
                        <p className="text-[10px] font-semibold text-[#30D158] flex items-center justify-end gap-0.5 mt-0.5">
                          <Zap size={10} /> Automático
                        </p>
                      )}
                    </div>
                  </div>

                  <div
                    className="pt-3 flex flex-wrap items-center justify-between gap-2"
                    style={{ borderTop: '1px solid var(--app-divider)' }}
                  >
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => runAction(item.id, () => onExecuteNow(item))}
                        className="oneui-accent-btn px-3 py-1.5 min-h-[34px] rounded-[12px] text-[12px] font-semibold flex items-center gap-1 active:scale-95 transition-transform disabled:opacity-50"
                        title="Lançar no extrato e avançar para o próximo ciclo"
                      >
                        <Play size={12} fill="currentColor" />
                        <span>Lançar agora</span>
                      </button>

                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => runAction(item.id, () => onSkipCycle(item))}
                        className="oneui-surface-2 oneui-hover px-2.5 py-1.5 min-h-[34px] rounded-[12px] text-[12px] font-semibold oneui-text-secondary flex items-center gap-1 active:scale-95 transition-transform"
                        title="Pular ciclo sem lançar"
                      >
                        <SkipForward size={13} />
                        <span>Pular</span>
                      </button>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() =>
                          runAction(item.id, () => onUpdate(item.id, { isActive: !item.isActive }))
                        }
                        className="p-2 rounded-[10px] oneui-surface-2 oneui-text-secondary oneui-hover active:scale-95 transition-transform"
                        title={item.isActive ? 'Pausar' : 'Reativar'}
                        aria-label={item.isActive ? 'Pausar recorrência' : 'Reativar recorrência'}
                      >
                        {item.isActive ? <Pause size={14} /> : <Play size={14} />}
                      </button>
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => openEditModal(item)}
                        className="p-2 rounded-[10px] oneui-surface-2 oneui-text-secondary oneui-hover active:scale-95 transition-transform"
                        title="Editar"
                        aria-label="Editar recorrência"
                      >
                        <Edit3 size={14} />
                      </button>
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => runAction(item.id, () => onDelete(item.id))}
                        className="p-2 rounded-[10px] oneui-surface-2 oneui-text-muted hover:text-[#FF453A] active:scale-95 transition-transform"
                        title="Excluir"
                        aria-label="Excluir recorrência"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      {modalPortal}
    </div>
  );
};

export default RecurringPayments;
