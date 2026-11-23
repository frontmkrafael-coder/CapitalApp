import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { TransactionType, RecurringFrequency } from '../types';
import {
  DollarSign,
  FileText,
  Coffee,
  Home,
  Car,
  ShoppingBag,
  HeartPulse,
  GraduationCap,
  Briefcase,
  Target,
  Repeat,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface TransactionFormProps {
  isOpen: boolean;
  initialType?: TransactionType;
  onClose: () => void;
  onSubmit: (data: {
    description: string;
    amount: number;
    type: TransactionType;
    category: string;
    date: string;
    recurring?: {
      frequency: RecurringFrequency;
      autoProcess: boolean;
    };
  }) => Promise<void> | void;
}

const CATEGORIES = [
  { name: 'Salário', type: 'income', icon: DollarSign, color: 'bg-[#30D158]' },
  { name: 'Freelance', type: 'income', icon: Briefcase, color: 'bg-[#38BDF8]' },
  { name: 'Pix', type: 'income', icon: DollarSign, color: 'bg-[#2F6BFF]' },
  { name: 'Investimentos', type: 'income', icon: DollarSign, color: 'bg-[#9D7BFF]' },
  { name: 'Alimentação', type: 'expense', icon: Coffee, color: 'bg-[#FF9F0A]' },
  { name: 'Moradia', type: 'expense', icon: Home, color: 'bg-[#5E5CE6]' },
  { name: 'Transporte', type: 'expense', icon: Car, color: 'bg-[#2F6BFF]' },
  { name: 'Lazer', type: 'expense', icon: ShoppingBag, color: 'bg-[#FF375F]' },
  { name: 'Saúde', type: 'expense', icon: HeartPulse, color: 'bg-[#FF453A]' },
  { name: 'Educação', type: 'expense', icon: GraduationCap, color: 'bg-[#9D7BFF]' },
  { name: 'Contas', type: 'expense', icon: FileText, color: 'bg-[#38BDF8]' },
  { name: 'Metas', type: 'expense', icon: Target, color: 'bg-[#FF9F0A]' },
];

const FREQUENCY_OPTIONS: { id: RecurringFrequency; label: string }[] = [
  { id: 'weekly', label: 'Semanal' },
  { id: 'biweekly', label: 'Quinzenal' },
  { id: 'monthly', label: 'Mensal' },
  { id: 'yearly', label: 'Anual' },
];

const getTodayLocalIso = () => {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const TransactionForm: React.FC<TransactionFormProps> = ({
  isOpen,
  initialType = TransactionType.EXPENSE,
  onClose,
  onSubmit,
}) => {
  const [type, setType] = useState<TransactionType>(initialType);
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState(
    initialType === TransactionType.INCOME ? 'Salário' : 'Alimentação'
  );
  const [date, setDate] = useState(getTodayLocalIso);
  const [isRecurring, setIsRecurring] = useState(false);
  const [frequency, setFrequency] = useState<RecurringFrequency>('monthly');
  const [autoProcess, setAutoProcess] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setType(initialType);
      setCategory(initialType === TransactionType.INCOME ? 'Salário' : 'Alimentação');
      setDate(getTodayLocalIso());
      setIsRecurring(false);
      setFrequency('monthly');
      setAutoProcess(true);
    }
  }, [isOpen, initialType]);

  // Body scroll lock & Escape key dismiss
  useEffect(() => {
    if (!isOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);

    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [isOpen, onClose]);

  if (typeof document === 'undefined') return null;

  const parsedAmount = parseFloat(amount);
  const isValid =
    !submitting &&
    description.trim().length > 0 &&
    Number.isFinite(parsedAmount) &&
    parsedAmount > 0 &&
    Boolean(date);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) return;

    setSubmitting(true);
    try {
      await onSubmit({
        description: description.trim(),
        amount: parsedAmount,
        type,
        category,
        date,
        recurring: isRecurring ? { frequency, autoProcess } : undefined,
      });
      setDescription('');
      setAmount('');
      setIsRecurring(false);
      onClose();
    } catch {
      // Error feedback handled by caller
    } finally {
      setSubmitting(false);
    }
  };

  const filteredCategories = CATEGORIES.filter((c) =>
    type === TransactionType.INCOME ? c.type === 'income' : c.type === 'expense'
  );

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center p-0 sm:p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.14 }}
            onClick={onClose}
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
              <button
                type="button"
                onClick={onClose}
                className="text-[15px] font-medium px-2 py-1 rounded-lg hover:opacity-80 active:opacity-60 transition-opacity"
                style={{ color: 'var(--app-accent)' }}
              >
                Cancelar
              </button>
              <h2 className="text-[17px] font-bold oneui-text tracking-tight">Nova Transação</h2>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={!isValid}
                className="oneui-accent-btn disabled:opacity-40 font-semibold text-[14px] px-4 py-1.5 rounded-full shadow-sm active:scale-95 transition-transform"
              >
                {submitting ? 'Salvando...' : 'Salvar'}
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-5 overflow-y-auto">
              {/* iOS-inspired segmented control with One UI rounding */}
              <div className="oneui-surface-2 p-1 rounded-[18px] flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => {
                    setType(TransactionType.EXPENSE);
                    setCategory('Alimentação');
                  }}
                  className={`flex-1 min-h-[42px] py-2 rounded-[14px] text-[14px] font-semibold transition-all ${
                    type === TransactionType.EXPENSE
                      ? 'bg-[#FF453A] text-white shadow-sm'
                      : 'oneui-text-secondary hover:opacity-90'
                  }`}
                >
                  Despesa
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setType(TransactionType.INCOME);
                    setCategory('Salário');
                  }}
                  className={`flex-1 min-h-[42px] py-2 rounded-[14px] text-[14px] font-semibold transition-all ${
                    type === TransactionType.INCOME
                      ? 'bg-[#30D158] text-black shadow-sm'
                      : 'oneui-text-secondary hover:opacity-90'
                  }`}
                >
                  Receita
                </button>
              </div>

              {/* Hero Amount Input */}
              <div className="text-center py-2">
                <span className="text-[12px] font-semibold oneui-text-muted uppercase tracking-wider block mb-1">
                  Valor da Transação
                </span>
                <div className="flex items-center justify-center gap-1.5">
                  <span
                    className={`text-2xl md:text-3xl font-bold ${
                      type === TransactionType.INCOME ? 'text-[#30D158]' : 'oneui-text-secondary'
                    }`}
                  >
                    R$
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    autoFocus
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className={`bg-transparent text-4xl md:text-5xl font-extrabold text-center focus:outline-none tracking-tight max-w-[260px] tabular-nums ${
                      type === TransactionType.INCOME ? 'text-[#30D158]' : 'oneui-text'
                    }`}
                    placeholder="0,00"
                  />
                </div>
              </div>

              {/* Grouped Inset Form Fields */}
              <div className="oneui-surface-2 oneui-divider overflow-hidden">
                <div className="px-4 py-3.5 flex items-center justify-between gap-3">
                  <label className="text-[14px] font-medium oneui-text-secondary min-w-[85px]">Descrição</label>
                  <input
                    type="text"
                    maxLength={200}
                    required
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full bg-transparent text-right text-[15px] oneui-text placeholder:opacity-40 focus:outline-none"
                    placeholder="Ex: Mercado, Uber, Salário"
                  />
                </div>

                <div className="px-4 py-3.5 flex items-center justify-between gap-3">
                  <label className="text-[14px] font-medium oneui-text-secondary min-w-[85px]">Data</label>
                  <input
                    type="date"
                    required
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="bg-transparent text-right text-[15px] oneui-text focus:outline-none cursor-pointer tabular-nums"
                  />
                </div>
              </div>

              {/* Recurring Option */}
              <div className="oneui-surface-2 p-4 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className="w-9 h-9 rounded-[12px] flex items-center justify-center shrink-0"
                      style={{ backgroundColor: 'var(--app-accent-soft)', color: 'var(--app-accent)' }}
                    >
                      <Repeat size={17} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[14px] font-semibold oneui-text">Pagamento recorrente</p>
                      <p className="text-[11px] oneui-text-muted">Agendar repetição automática</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={isRecurring}
                    onClick={() => setIsRecurring((prev) => !prev)}
                    className="w-[48px] h-[28px] rounded-full p-[3px] transition-colors relative shrink-0"
                    style={{
                      backgroundColor: isRecurring ? '#30D158' : 'var(--app-surface-3)',
                      border: '1px solid var(--app-border-strong)',
                    }}
                  >
                    <div
                      className={`w-[20px] h-[20px] bg-white rounded-full shadow-sm transition-transform ${
                        isRecurring ? 'translate-x-[20px]' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                <AnimatePresence>
                  {isRecurring && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden space-y-3 pt-2"
                      style={{ borderTop: '1px solid var(--app-divider)' }}
                    >
                      <div className="grid grid-cols-4 gap-1.5">
                        {FREQUENCY_OPTIONS.map((opt) => (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => setFrequency(opt.id)}
                            className={`py-2 px-2 rounded-[12px] text-[12px] font-semibold transition-all ${
                              frequency === opt.id
                                ? 'oneui-accent-btn shadow-sm'
                                : 'oneui-text-secondary oneui-hover'
                            }`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                      <label className="flex items-center justify-between gap-2 text-[12px] oneui-text-secondary cursor-pointer">
                        <span>Lançar automaticamente na data de vencimento</span>
                        <input
                          type="checkbox"
                          checked={autoProcess}
                          onChange={(e) => setAutoProcess(e.target.checked)}
                          className="w-4 h-4 accent-[#30D158]"
                        />
                      </label>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Categories Grid */}
              <div>
                <label className="block text-[12px] font-semibold uppercase tracking-wider oneui-text-muted mb-2.5 px-1">
                  Categoria
                </label>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {filteredCategories.map((c) => {
                    const isSelected = category === c.name;
                    const IconComponent = c.icon;
                    return (
                      <motion.button
                        key={c.name}
                        type="button"
                        whileTap={{ scale: 0.94 }}
                        onClick={() => setCategory(c.name)}
                        className="p-2.5 rounded-[18px] flex flex-col items-center gap-1.5 transition-colors gpu-accelerated"
                        style={
                          isSelected
                            ? {
                                backgroundColor: 'var(--app-accent-soft)',
                                border: '1.5px solid var(--app-accent)',
                              }
                            : {
                                backgroundColor: 'var(--app-surface-2)',
                                border: '1px solid var(--app-border)',
                              }
                        }
                      >
                        <div
                          className={`w-8 h-8 rounded-[11px] ${c.color} text-white flex items-center justify-center shadow-sm`}
                        >
                          <IconComponent size={16} strokeWidth={2.3} />
                        </div>
                        <span
                          className={`text-[12px] truncate w-full text-center ${
                            isSelected ? 'oneui-text font-semibold' : 'oneui-text-secondary font-medium'
                          }`}
                        >
                          {c.name}
                        </span>
                      </motion.button>
                    );
                  })}
                </div>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
};

export default TransactionForm;
