import React, { useState, useMemo } from 'react';
import { Transaction, TransactionType, RecurringPayment } from '../types';
import {
  Trash2,
  Search,
  ArrowUpRight,
  ArrowDownRight,
  Plus,
  Tag,
  Coffee,
  Home,
  Car,
  ShoppingBag,
  HeartPulse,
  GraduationCap,
  FileText,
  DollarSign,
  Target,
  Repeat,
  X,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import RecurringPayments from './RecurringPayments';

interface TransactionListProps {
  transactions: Transaction[];
  onDelete: (id: string) => void;
  onAdd: () => void;
  recurringPayments: RecurringPayment[];
  onAddRecurring: (data: Omit<RecurringPayment, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  onUpdateRecurring: (id: string, updates: Partial<RecurringPayment>) => Promise<void>;
  onExecuteRecurringNow: (item: RecurringPayment) => Promise<void>;
  onSkipRecurringCycle: (item: RecurringPayment) => Promise<void>;
  onDeleteRecurring: (id: string) => Promise<void>;
}

const getCategoryIcon = (category: string, type: TransactionType) => {
  const cat = category.toLowerCase();
  if (cat.includes('meta')) {
    return { icon: Target, bg: 'bg-[#FF9F0A]' };
  }
  if (cat.includes('salário') || cat.includes('freelance') || cat.includes('pix') || cat.includes('invest')) {
    return { icon: DollarSign, bg: 'bg-[#30D158]' };
  }
  if (cat.includes('aliment') || cat.includes('comida') || cat.includes('restaurante')) {
    return { icon: Coffee, bg: 'bg-[#FF9F0A]' };
  }
  if (cat.includes('moradia') || cat.includes('aluguel') || cat.includes('casa')) {
    return { icon: Home, bg: 'bg-[#5E5CE6]' };
  }
  if (cat.includes('transporte') || cat.includes('combustível') || cat.includes('uber')) {
    return { icon: Car, bg: 'bg-[#2F6BFF]' };
  }
  if (cat.includes('lazer') || cat.includes('viagem') || cat.includes('shopping')) {
    return { icon: ShoppingBag, bg: 'bg-[#FF375F]' };
  }
  if (cat.includes('saúde') || cat.includes('farmácia') || cat.includes('médico')) {
    return { icon: HeartPulse, bg: 'bg-[#FF453A]' };
  }
  if (cat.includes('educação') || cat.includes('curso')) {
    return { icon: GraduationCap, bg: 'bg-[#9D7BFF]' };
  }
  if (cat.includes('contas') || cat.includes('boleto')) {
    return { icon: FileText, bg: 'bg-[#38BDF8]' };
  }
  return type === TransactionType.INCOME
    ? { icon: ArrowUpRight, bg: 'bg-[#30D158]' }
    : { icon: ArrowDownRight, bg: 'bg-[#64748B]' };
};

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
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
  } catch {
    return dateStr;
  }
};

const TransactionList: React.FC<TransactionListProps> = ({
  transactions,
  onDelete,
  onAdd,
  recurringPayments,
  onAddRecurring,
  onUpdateRecurring,
  onExecuteRecurringNow,
  onSkipRecurringCycle,
  onDeleteRecurring,
}) => {
  const [subTab, setSubTab] = useState<'ledger' | 'recurring'>('ledger');
  const [filter, setFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'income' | 'expense'>('all');

  const filteredTransactions = useMemo(() => {
    return transactions.filter((t) => {
      const matchesSearch =
        t.description.toLowerCase().includes(filter.toLowerCase()) ||
        t.category.toLowerCase().includes(filter.toLowerCase());
      const matchesType = typeFilter === 'all' ? true : t.type === typeFilter;
      return matchesSearch && matchesType;
    });
  }, [transactions, filter, typeFilter]);

  return (
    <div className="space-y-5">
      {/* SUB-TAB SWITCHER: EXTRATO vs RECORRENTES */}
      <div className="oneui-card p-1.5 rounded-[22px] grid grid-cols-2 gap-1 max-w-md">
        <button
          type="button"
          onClick={() => setSubTab('ledger')}
          className={`min-h-[42px] py-2 px-4 rounded-[16px] text-[13px] font-semibold transition-all flex items-center justify-center gap-2 ${
            subTab === 'ledger' ? 'oneui-accent-btn shadow-sm' : 'oneui-text-secondary oneui-hover'
          }`}
        >
          <span>Extrato ({transactions.length})</span>
        </button>
        <button
          type="button"
          onClick={() => setSubTab('recurring')}
          className={`min-h-[42px] py-2 px-4 rounded-[16px] text-[13px] font-semibold transition-all flex items-center justify-center gap-2 ${
            subTab === 'recurring' ? 'oneui-accent-btn shadow-sm' : 'oneui-text-secondary oneui-hover'
          }`}
        >
          <Repeat size={15} />
          <span>Recorrentes ({recurringPayments.length})</span>
        </button>
      </div>

      <AnimatePresence mode="wait">
        {subTab === 'recurring' ? (
          <motion.div
            key="recurring-tab"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.16 }}
            className="gpu-accelerated"
          >
            <RecurringPayments
              recurringPayments={recurringPayments}
              onAdd={onAddRecurring}
              onUpdate={onUpdateRecurring}
              onExecuteNow={onExecuteRecurringNow}
              onSkipCycle={onSkipRecurringCycle}
              onDelete={onDeleteRecurring}
            />
          </motion.div>
        ) : (
          <motion.div
            key="ledger-tab"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.16 }}
            className="space-y-5 gpu-accelerated"
          >
            {/* SEARCH & FILTER TOOLBAR */}
            <div className="oneui-card p-4 flex flex-col md:flex-row gap-3 justify-between items-center">
              <div className="relative w-full md:w-80">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 oneui-text-muted" size={16} />
                <input
                  type="text"
                  placeholder="Buscar transação ou categoria..."
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  className="w-full oneui-surface-2 rounded-[16px] pl-10 pr-9 py-2.5 text-[14px] oneui-text placeholder:opacity-45 focus:outline-none transition-all"
                />
                {filter && (
                  <button
                    type="button"
                    onClick={() => setFilter('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full oneui-text-secondary flex items-center justify-center"
                    style={{ backgroundColor: 'var(--app-surface-3)' }}
                    aria-label="Limpar busca"
                  >
                    <X size={11} />
                  </button>
                )}
              </div>

              <div className="oneui-surface-2 flex items-center gap-1 p-1 rounded-[16px] w-full md:w-auto">
                <button
                  type="button"
                  onClick={() => setTypeFilter('all')}
                  className={`flex-1 md:flex-none min-h-[38px] px-4 py-1.5 rounded-[12px] text-[13px] font-semibold transition-all ${
                    typeFilter === 'all' ? 'oneui-accent-btn shadow-sm' : 'oneui-text-secondary'
                  }`}
                >
                  Todas
                </button>
                <button
                  type="button"
                  onClick={() => setTypeFilter(TransactionType.INCOME)}
                  className={`flex-1 md:flex-none min-h-[38px] px-4 py-1.5 rounded-[12px] text-[13px] font-semibold transition-all ${
                    typeFilter === TransactionType.INCOME
                      ? 'bg-[#30D158] text-black shadow-sm'
                      : 'oneui-text-secondary'
                  }`}
                >
                  Entradas
                </button>
                <button
                  type="button"
                  onClick={() => setTypeFilter(TransactionType.EXPENSE)}
                  className={`flex-1 md:flex-none min-h-[38px] px-4 py-1.5 rounded-[12px] text-[13px] font-semibold transition-all ${
                    typeFilter === TransactionType.EXPENSE
                      ? 'bg-[#FF453A] text-white shadow-sm'
                      : 'oneui-text-secondary'
                  }`}
                >
                  Saídas
                </button>
              </div>

              <button
                type="button"
                onClick={onAdd}
                className="hidden md:flex items-center gap-2 oneui-accent-btn px-5 py-2.5 min-h-[44px] rounded-[16px] text-[14px] font-semibold shadow-sm active:scale-95 transition-transform"
              >
                <Plus size={16} strokeWidth={2.5} />
                <span>Nova Transação</span>
              </button>
            </div>

            {/* MOBILE VIEW: One UI 9 Inset Grouped List */}
            <div className="md:hidden">
              <div className="oneui-card overflow-hidden oneui-divider">
                <AnimatePresence>
                  {filteredTransactions.map((t, idx) => {
                    const { icon: CatIcon, bg: iconBg } = getCategoryIcon(t.category, t.type);
                    const isIncome = t.type === TransactionType.INCOME;
                    return (
                      <motion.div
                        key={t.id}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, x: -16 }}
                        transition={{ duration: 0.16, delay: Math.min(idx * 0.015, 0.12) }}
                        className="p-4 flex items-center justify-between gap-3 oneui-hover transition-colors gpu-accelerated"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div
                            className={`w-10 h-10 rounded-[14px] ${iconBg} text-white flex items-center justify-center shrink-0 shadow-sm`}
                          >
                            <CatIcon size={18} strokeWidth={2.2} />
                          </div>
                          <div className="min-w-0">
                            <p className="text-[15px] font-semibold oneui-text truncate leading-tight">
                              {t.description}
                            </p>
                            <p className="text-[12px] oneui-text-muted mt-0.5 truncate">
                              {t.category} · {formatDate(t.date)}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <span
                            className={`text-[15px] font-bold tabular-nums ${
                              isIncome ? 'text-[#30D158]' : 'oneui-text'
                            }`}
                          >
                            {isIncome ? '+' : '-'}
                            {formatCurrency(t.amount)}
                          </span>
                          <button
                            type="button"
                            onClick={() => onDelete(t.id)}
                            className="p-2 oneui-text-muted hover:text-[#FF453A] active:scale-90 transition-transform rounded-xl"
                            title="Excluir"
                            aria-label="Excluir transação"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>

                {filteredTransactions.length === 0 && (
                  <div className="py-12 px-4 text-center">
                    <div className="w-12 h-12 rounded-full oneui-surface-2 flex items-center justify-center mx-auto mb-3 oneui-text-muted">
                      <Tag size={20} />
                    </div>
                    <p className="text-[15px] font-semibold oneui-text">Nenhuma transação encontrada</p>
                    <p className="text-[12px] oneui-text-muted mt-1 mb-4">
                      Adicione uma receita ou despesa para começar.
                    </p>
                    <button
                      type="button"
                      onClick={onAdd}
                      className="oneui-accent-btn px-4 py-2.5 rounded-[14px] text-[13px] font-semibold"
                    >
                      + Adicionar Transação
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* DESKTOP VIEW: Clean One UI + iOS Table */}
            <div className="hidden md:block oneui-card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead
                    className="text-[11px] uppercase tracking-wider oneui-text-muted font-semibold"
                    style={{
                      backgroundColor: 'var(--app-surface-2)',
                      borderBottom: '1px solid var(--app-divider)',
                    }}
                  >
                    <tr>
                      <th className="px-6 py-4">Descrição</th>
                      <th className="px-6 py-4">Categoria</th>
                      <th className="px-6 py-4">Data</th>
                      <th className="px-6 py-4 text-right">Valor</th>
                      <th className="px-6 py-4 text-center">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="oneui-divider">
                    <AnimatePresence>
                      {filteredTransactions.map((t) => {
                        const { icon: CatIcon, bg: iconBg } = getCategoryIcon(t.category, t.type);
                        const isIncome = t.type === TransactionType.INCOME;
                        return (
                          <motion.tr
                            key={t.id}
                            initial={{ opacity: 0, y: 4 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, x: -10 }}
                            className="oneui-hover transition-colors group"
                          >
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-3">
                                <div
                                  className={`w-9 h-9 rounded-[12px] ${iconBg} text-white flex items-center justify-center shrink-0 shadow-sm`}
                                >
                                  <CatIcon size={17} strokeWidth={2.2} />
                                </div>
                                <span className="text-[14px] font-semibold oneui-text">{t.description}</span>
                              </div>
                            </td>
                            <td className="px-6 py-4 text-[13px] font-medium oneui-text-secondary">
                              {t.category}
                            </td>
                            <td className="px-6 py-4 text-[13px] oneui-text-muted tabular-nums">
                              {formatDate(t.date)}
                            </td>
                            <td
                              className={`px-6 py-4 text-right font-bold text-[15px] tabular-nums ${
                                isIncome ? 'text-[#30D158]' : 'oneui-text'
                              }`}
                            >
                              {isIncome ? '+' : '-'}
                              {formatCurrency(t.amount)}
                            </td>
                            <td className="px-6 py-4 text-center">
                              <button
                                type="button"
                                onClick={() => onDelete(t.id)}
                                className="p-2 oneui-text-muted hover:text-[#FF453A] hover:bg-[#FF453A]/10 rounded-[12px] transition-all opacity-60 group-hover:opacity-100"
                                title="Excluir"
                                aria-label="Excluir transação"
                              >
                                <Trash2 size={16} />
                              </button>
                            </td>
                          </motion.tr>
                        );
                      })}
                    </AnimatePresence>

                    {filteredTransactions.length === 0 && (
                      <tr>
                        <td colSpan={5} className="py-16 text-center">
                          <p className="oneui-text-muted text-[14px]">Nenhuma transação encontrada.</p>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default TransactionList;
