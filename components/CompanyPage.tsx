import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { CompanyRecord, EmploymentType, TransactionType } from '../types';
import { getTodayIsoDate } from '../services/firebase';
import {
  Building2,
  Plus,
  Edit3,
  Trash2,
  Calendar,
  Briefcase,
  DollarSign,
  ArrowUpRight,
  Clock,
  X,
  Minus,
  CheckCircle2,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface CompanyPageProps {
  companies: CompanyRecord[];
  onAddCompany: (company: Omit<CompanyRecord, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  onUpdateCompany: (
    id: string,
    company: Omit<CompanyRecord, 'id' | 'createdAt' | 'updatedAt'>
  ) => Promise<void>;
  onDeleteCompany: (id: string) => Promise<void>;
  onPostIncome: (data: {
    description: string;
    amount: number;
    type: TransactionType;
    category: string;
    date: string;
  }) => Promise<void>;
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

const formatCnpjMask = (raw: string): string => {
  const digits = raw.replace(/\D/g, '').slice(0, 14);
  if (digits.length <= 2) return digits;
  if (digits.length <= 5) return `${digits.slice(0, 2)}.${digits.slice(2)}`;
  if (digits.length <= 8) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5)}`;
  if (digits.length <= 12)
    return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8)}`;
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(
    8,
    12
  )}-${digits.slice(12, 14)}`;
};

const getTenureLabel = (admissionDate: string): string => {
  try {
    const [y, m, d] = admissionDate.split('-').map(Number);
    const start = new Date(y, m - 1, d);
    const now = new Date();
    const totalDays = Math.max(0, Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
    if (totalDays < 30) return `${totalDays} ${totalDays === 1 ? 'dia' : 'dias'}`;
    const months = Math.floor(totalDays / 30.4375);
    const years = Math.floor(months / 12);
    const remMonths = months % 12;
    if (years > 0 && remMonths > 0) return `${years}a ${remMonths}m`;
    if (years > 0) return `${years} ${years === 1 ? 'ano' : 'anos'}`;
    return `${months} ${months === 1 ? 'mês' : 'meses'}`;
  } catch {
    return '—';
  }
};

const getDaysUntilDayOfMonth = (dayOfMonth: number): number => {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const clampedCurrentMax = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  let target = new Date(now.getFullYear(), now.getMonth(), Math.min(dayOfMonth, clampedCurrentMax));
  if (target < today) {
    const nextMax = new Date(now.getFullYear(), now.getMonth() + 2, 0).getDate();
    target = new Date(now.getFullYear(), now.getMonth() + 1, Math.min(dayOfMonth, nextMax));
  }
  return Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
};

const CompanyPage: React.FC<CompanyPageProps> = ({
  companies,
  onAddCompany,
  onUpdateCompany,
  onDeleteCompany,
  onPostIncome,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCompany, setEditingCompany] = useState<CompanyRecord | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [postingId, setPostingId] = useState<string | null>(null);
  const [freelancerDaysMap, setFreelancerDaysMap] = useState<Record<string, number>>({});

  // Form states
  const [employmentType, setEmploymentType] = useState<EmploymentType>('fixed');
  const [name, setName] = useState('');
  const [cnpj, setCnpj] = useState('');
  const [admissionDate, setAdmissionDate] = useState(getTodayIsoDate);
  const [baseSalary, setBaseSalary] = useState('');
  const [paymentDay, setPaymentDay] = useState('5');
  const [advanceDay, setAdvanceDay] = useState('');
  const [dailyRate, setDailyRate] = useState('');

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
    const fixedCompanies = companies.filter((c) => c.employmentType === 'fixed');
    const freelancerCompanies = companies.filter((c) => c.employmentType === 'freelancer');
    const totalFixedMonthly = fixedCompanies.reduce((sum, c) => sum + (c.baseSalary || 0), 0);
    const avgDailyRate =
      freelancerCompanies.length > 0
        ? freelancerCompanies.reduce((sum, c) => sum + (c.dailyRate || 0), 0) /
          freelancerCompanies.length
        : 0;
    return {
      fixedCount: fixedCompanies.length,
      freelancerCount: freelancerCompanies.length,
      totalFixedMonthly,
      avgDailyRate,
    };
  }, [companies]);

  const openCreateModal = () => {
    setEditingCompany(null);
    setEmploymentType('fixed');
    setName('');
    setCnpj('');
    setAdmissionDate(getTodayIsoDate());
    setBaseSalary('');
    setPaymentDay('5');
    setAdvanceDay('');
    setDailyRate('');
    setIsModalOpen(true);
  };

  const openEditModal = (company: CompanyRecord) => {
    setEditingCompany(company);
    setEmploymentType(company.employmentType);
    setName(company.name);
    setCnpj(company.cnpj || '');
    setAdmissionDate(company.admissionDate);
    setBaseSalary(company.baseSalary ? String(company.baseSalary) : '');
    setPaymentDay(company.paymentDay ? String(company.paymentDay) : '5');
    setAdvanceDay(company.advanceDay ? String(company.advanceDay) : '');
    setDailyRate(company.dailyRate ? String(company.dailyRate) : '');
    setIsModalOpen(true);
  };

  const handleSaveCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !admissionDate) return;

    setSubmitting(true);
    try {
      const payload: Omit<CompanyRecord, 'id' | 'createdAt' | 'updatedAt'> =
        employmentType === 'fixed'
          ? {
              name: name.trim(),
              cnpj: cnpj.trim() || null,
              employmentType: 'fixed',
              admissionDate,
              baseSalary: parseFloat(baseSalary),
              paymentDay: Math.min(31, Math.max(1, parseInt(paymentDay, 10) || 5)),
              advanceDay: advanceDay.trim()
                ? Math.min(31, Math.max(1, parseInt(advanceDay, 10) || 20))
                : null,
              dailyRate: null,
            }
          : {
              name: name.trim(),
              cnpj: cnpj.trim() || null,
              employmentType: 'freelancer',
              admissionDate,
              baseSalary: null,
              paymentDay: null,
              advanceDay: null,
              dailyRate: parseFloat(dailyRate),
            };

      if (editingCompany) {
        await onUpdateCompany(editingCompany.id, payload);
      } else {
        await onAddCompany(payload);
      }
      setIsModalOpen(false);
    } finally {
      setSubmitting(false);
    }
  };

  const handleQuickPostIncome = async (
    key: string,
    description: string,
    amount: number,
    category: string
  ) => {
    if (!Number.isFinite(amount) || amount <= 0) return;
    setPostingId(key);
    try {
      await onPostIncome({
        description,
        amount: Number(amount.toFixed(2)),
        type: TransactionType.INCOME,
        category,
        date: getTodayIsoDate(),
      });
    } finally {
      setPostingId(null);
    }
  };

  const getFreelancerDays = (id: string) => Math.max(1, freelancerDaysMap[id] || 1);
  const setFreelancerDays = (id: string, days: number) => {
    setFreelancerDaysMap((prev) => ({
      ...prev,
      [id]: Math.min(31, Math.max(1, days)),
    }));
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
                      {editingCompany ? 'Editar Empresa' : 'Cadastrar Empresa'}
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

                  <form onSubmit={handleSaveCompany} className="p-5 sm:p-6 space-y-4 overflow-y-auto">
                    {/* Employment Regime Switch */}
                    <div className="oneui-surface-2 p-1 rounded-[18px] grid grid-cols-2 gap-1">
                      <button
                        type="button"
                        onClick={() => setEmploymentType('fixed')}
                        className={`min-h-[42px] rounded-[14px] text-[13px] font-semibold transition-all ${
                          employmentType === 'fixed'
                            ? 'oneui-accent-btn shadow-sm'
                            : 'oneui-text-secondary'
                        }`}
                      >
                        Salário Fixo
                      </button>
                      <button
                        type="button"
                        onClick={() => setEmploymentType('freelancer')}
                        className={`min-h-[42px] rounded-[14px] text-[13px] font-semibold transition-all ${
                          employmentType === 'freelancer'
                            ? 'bg-[#0EA5E9] text-white shadow-sm'
                            : 'oneui-text-secondary'
                        }`}
                      >
                        Freelancer (Diária)
                      </button>
                    </div>

                    {/* Shared Company Info */}
                    <div className="oneui-surface-2 oneui-divider overflow-hidden">
                      <div className="px-4 py-3.5 flex items-center justify-between gap-3">
                        <label className="text-[14px] font-medium oneui-text-secondary min-w-[95px]">
                          Empresa
                        </label>
                        <input
                          type="text"
                          maxLength={120}
                          required
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          placeholder="Nome da empresa"
                          className="w-full bg-transparent text-right text-[15px] oneui-text placeholder:opacity-40 focus:outline-none"
                        />
                      </div>

                      <div className="px-4 py-3.5 flex items-center justify-between gap-3">
                        <label className="text-[14px] font-medium oneui-text-secondary min-w-[95px]">
                          CNPJ
                        </label>
                        <input
                          type="text"
                          inputMode="numeric"
                          maxLength={18}
                          value={cnpj}
                          onChange={(e) => setCnpj(formatCnpjMask(e.target.value))}
                          placeholder="00.000.000/0000-00"
                          className="w-full bg-transparent text-right text-[15px] oneui-text tabular-nums placeholder:opacity-40 focus:outline-none"
                        />
                      </div>

                      <div className="px-4 py-3.5 flex items-center justify-between gap-3">
                        <label className="text-[14px] font-medium oneui-text-secondary min-w-[115px]">
                          {employmentType === 'fixed' ? 'Data Admissão' : 'Início Atuação'}
                        </label>
                        <input
                          type="date"
                          required
                          value={admissionDate}
                          onChange={(e) => setAdmissionDate(e.target.value)}
                          className="bg-transparent text-right text-[15px] oneui-text tabular-nums focus:outline-none cursor-pointer"
                        />
                      </div>
                    </div>

                    {/* Conditional Compensation Fields */}
                    <AnimatePresence mode="wait">
                      {employmentType === 'fixed' ? (
                        <motion.div
                          key="fixed-fields"
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -6 }}
                          transition={{ duration: 0.14 }}
                          className="oneui-surface-2 oneui-divider overflow-hidden"
                        >
                          <div className="px-4 py-3.5 flex items-center justify-between gap-3">
                            <label className="text-[14px] font-medium oneui-text-secondary min-w-[120px]">
                              Salário Base (R$)
                            </label>
                            <input
                              type="number"
                              step="0.01"
                              min="0.01"
                              required
                              value={baseSalary}
                              onChange={(e) => setBaseSalary(e.target.value)}
                              placeholder="0.00"
                              className="w-full bg-transparent text-right text-[15px] font-bold oneui-text tabular-nums placeholder:opacity-40 focus:outline-none"
                            />
                          </div>

                          <div className="px-4 py-3.5 flex items-center justify-between gap-3">
                            <label className="text-[14px] font-medium oneui-text-secondary min-w-[130px]">
                              Dia do Pagamento
                            </label>
                            <input
                              type="number"
                              min="1"
                              max="31"
                              required
                              value={paymentDay}
                              onChange={(e) => setPaymentDay(e.target.value)}
                              placeholder="5"
                              className="w-24 bg-transparent text-right text-[15px] font-bold oneui-text tabular-nums focus:outline-none"
                            />
                          </div>

                          <div className="px-4 py-3.5 flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <label className="text-[14px] font-medium oneui-text-secondary block">
                                Dia Adiantamento
                              </label>
                              <span className="text-[11px] oneui-text-muted">Opcional (vale salarial)</span>
                            </div>
                            <input
                              type="number"
                              min="1"
                              max="31"
                              value={advanceDay}
                              onChange={(e) => setAdvanceDay(e.target.value)}
                              placeholder="Opcional"
                              className="w-28 bg-transparent text-right text-[15px] font-bold oneui-text tabular-nums placeholder:opacity-35 focus:outline-none"
                            />
                          </div>
                        </motion.div>
                      ) : (
                        <motion.div
                          key="freelancer-fields"
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -6 }}
                          transition={{ duration: 0.14 }}
                          className="space-y-3"
                        >
                          <div className="oneui-surface-2 overflow-hidden">
                            <div className="px-4 py-3.5 flex items-center justify-between gap-3">
                              <label className="text-[14px] font-medium oneui-text-secondary min-w-[130px]">
                                Valor da Diária (R$)
                              </label>
                              <input
                                type="number"
                                step="0.01"
                                min="0.01"
                                required
                                value={dailyRate}
                                onChange={(e) => setDailyRate(e.target.value)}
                                placeholder="0.00"
                                className="w-full bg-transparent text-right text-[15px] font-bold text-[#0EA5E9] tabular-nums placeholder:opacity-40 focus:outline-none"
                              />
                            </div>
                          </div>
                          <p className="text-[12px] oneui-text-muted px-1 leading-relaxed">
                            No modo Freelancer, não é necessário informar salário base nem datas fixas — apenas os dados da empresa e o valor da diária.
                          </p>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    <button
                      type="submit"
                      disabled={submitting}
                      className="w-full min-h-[48px] oneui-accent-btn font-bold py-3.5 rounded-[18px] shadow-md active:scale-[0.98] transition-transform text-[15px] disabled:opacity-50"
                    >
                      {submitting
                        ? 'Salvando...'
                        : editingCompany
                        ? 'Atualizar Empresa'
                        : 'Salvar Empresa'}
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
    <div className="space-y-6">
      {/* KPI Summary Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        <div className="oneui-card p-5">
          <p className="text-[11px] font-semibold uppercase tracking-wider oneui-text-muted mb-1">
            Renda Fixa Mensal Prevista
          </p>
          <p className="text-2xl font-extrabold text-[#30D158] tabular-nums">
            {formatCurrency(summary.totalFixedMonthly)}
          </p>
          <p className="text-[12px] oneui-text-muted mt-1">
            Soma dos salários base ({summary.fixedCount}{' '}
            {summary.fixedCount === 1 ? 'empresa' : 'empresas'})
          </p>
        </div>

        <div className="oneui-card p-5">
          <p className="text-[11px] font-semibold uppercase tracking-wider oneui-text-muted mb-1">
            Diária Média Freelancer
          </p>
          <p className="text-2xl font-extrabold text-[#0EA5E9] tabular-nums">
            {summary.avgDailyRate > 0 ? formatCurrency(summary.avgDailyRate) : '—'}
          </p>
          <p className="text-[12px] oneui-text-muted mt-1">
            {summary.freelancerCount}{' '}
            {summary.freelancerCount === 1 ? 'contrato freelancer' : 'contratos freelancer'}
          </p>
        </div>

        <div className="oneui-card p-5 flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider oneui-text-muted mb-1">
              Empresas Ativas
            </p>
            <p className="text-2xl font-extrabold oneui-text tabular-nums">{companies.length}</p>
            <p className="text-[12px] oneui-text-muted mt-1">Fontes de renda</p>
          </div>
          <button
            type="button"
            onClick={openCreateModal}
            className="oneui-accent-btn px-4 py-3 min-h-[44px] rounded-[16px] text-[13px] font-semibold flex items-center gap-1.5 shadow-sm active:scale-95 transition-transform shrink-0"
          >
            <Plus size={16} strokeWidth={2.5} />
            <span>Nova Empresa</span>
          </button>
        </div>
      </div>

      {/* Empty State or Company Cards */}
      {companies.length === 0 ? (
        <div
          className="py-14 text-center rounded-[28px] p-8"
          style={{
            border: '1.5px dashed var(--app-border-strong)',
            backgroundColor: 'var(--app-surface)',
          }}
        >
          <div className="w-14 h-14 rounded-full oneui-surface-2 flex items-center justify-center mx-auto mb-3 text-[#0EA5E9]">
            <Building2 size={26} />
          </div>
          <p className="text-[16px] font-bold oneui-text">Nenhuma empresa cadastrada</p>
          <p className="text-[13px] oneui-text-secondary max-w-md mx-auto mt-1 mb-5">
            Cadastre seu emprego CLT/PJ com salário base e datas de pagamento ou suas atuações como freelancer por diária.
          </p>
          <button
            type="button"
            onClick={openCreateModal}
            className="oneui-accent-btn px-5 py-3 rounded-[16px] text-[14px] font-semibold inline-flex items-center gap-2 active:scale-95 transition-transform"
          >
            <Plus size={16} strokeWidth={2.5} />
            <span>Cadastrar Primeira Empresa</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <AnimatePresence>
            {companies.map((company, idx) => {
              const isFixed = company.employmentType === 'fixed';
              const tenure = getTenureLabel(company.admissionDate);
              const daysToPay =
                isFixed && company.paymentDay ? getDaysUntilDayOfMonth(company.paymentDay) : null;
              const daysToAdvance =
                isFixed && company.advanceDay ? getDaysUntilDayOfMonth(company.advanceDay) : null;

              const baseSalaryVal = company.baseSalary || 0;
              const estimatedAdvance = baseSalaryVal * 0.4;
              const estimatedRemainder = baseSalaryVal * 0.6;

              const freeDays = getFreelancerDays(company.id);
              const freeDaily = company.dailyRate || 0;
              const freeTotal = freeDays * freeDaily;

              return (
                <motion.div
                  key={company.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.96 }}
                  transition={{ duration: 0.18, delay: Math.min(idx * 0.03, 0.15) }}
                  className="oneui-card p-6 space-y-5 gpu-accelerated flex flex-col justify-between"
                >
                  <div className="space-y-4">
                    {/* Header */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`w-11 h-11 rounded-[14px] flex items-center justify-center shrink-0 ${
                            isFixed
                              ? 'bg-[#30D158]/15 text-[#30D158]'
                              : 'bg-[#0EA5E9]/15 text-[#0EA5E9]'
                          }`}
                        >
                          {isFixed ? <Building2 size={20} /> : <Briefcase size={20} />}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-[17px] font-bold oneui-text truncate">
                              {company.name}
                            </h3>
                            <span
                              className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                                isFixed
                                  ? 'bg-[#30D158]/15 text-[#30D158]'
                                  : 'bg-[#0EA5E9]/15 text-[#0EA5E9]'
                              }`}
                            >
                              {isFixed ? 'Salário Fixo' : 'Freelancer'}
                            </span>
                          </div>
                          <p className="text-[12px] oneui-text-muted mt-0.5 tabular-nums">
                            {company.cnpj ? `CNPJ: ${company.cnpj} · ` : ''}
                            Desde {formatDateBr(company.admissionDate)} ({tenure})
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => openEditModal(company)}
                          className="p-2 rounded-[11px] oneui-surface-2 oneui-text-secondary oneui-hover active:scale-95 transition-transform"
                          title="Editar empresa"
                          aria-label="Editar empresa"
                        >
                          <Edit3 size={15} />
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteCompany(company.id)}
                          className="p-2 rounded-[11px] oneui-surface-2 oneui-text-muted hover:text-[#FF453A] active:scale-95 transition-transform"
                          title="Remover empresa"
                          aria-label="Remover empresa"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>

                    {/* Body by Regime */}
                    {isFixed ? (
                      <div className="space-y-3">
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                          <div className="oneui-surface-2 p-3.5 col-span-2 sm:col-span-1">
                            <p className="text-[11px] oneui-text-muted uppercase tracking-wider mb-0.5">
                              Salário Base
                            </p>
                            <p className="text-[18px] font-extrabold text-[#30D158] tabular-nums">
                              {formatCurrency(baseSalaryVal)}
                            </p>
                          </div>

                          <div className="oneui-surface-2 p-3.5">
                            <p className="text-[11px] oneui-text-muted uppercase tracking-wider mb-0.5 flex items-center gap-1">
                              <Calendar size={11} /> Pagamento
                            </p>
                            <p className="text-[15px] font-bold oneui-text tabular-nums">
                              Dia {company.paymentDay}
                            </p>
                            <p className="text-[11px] text-[#30D158] font-semibold mt-0.5 tabular-nums">
                              {daysToPay === 0
                                ? 'Cai hoje!'
                                : daysToPay !== null
                                ? `Em ${daysToPay} ${daysToPay === 1 ? 'dia' : 'dias'}`
                                : ''}
                            </p>
                          </div>

                          <div className="oneui-surface-2 p-3.5">
                            <p className="text-[11px] oneui-text-muted uppercase tracking-wider mb-0.5 flex items-center gap-1">
                              <Clock size={11} /> Adiantamento
                            </p>
                            {company.advanceDay ? (
                              <>
                                <p className="text-[15px] font-bold oneui-text tabular-nums">
                                  Dia {company.advanceDay}
                                </p>
                                <p className="text-[11px] text-[#FF9F0A] font-semibold mt-0.5 tabular-nums">
                                  {daysToAdvance === 0
                                    ? 'Cai hoje!'
                                    : daysToAdvance !== null
                                    ? `Em ${daysToAdvance}d`
                                    : ''}
                                </p>
                              </>
                            ) : (
                              <p className="text-[13px] font-medium oneui-text-muted mt-1">Não configurado</p>
                            )}
                          </div>
                        </div>

                        {company.advanceDay && (
                          <div className="oneui-surface-2 px-4 py-2.5 flex items-center justify-between text-[12px] oneui-text-secondary tabular-nums">
                            <span>Prévia vale (40%): {formatCurrency(estimatedAdvance)}</span>
                            <span>Saldo (60%): {formatCurrency(estimatedRemainder)}</span>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="oneui-surface-2 p-4 flex items-center justify-between gap-4">
                          <div>
                            <p className="text-[11px] oneui-text-muted uppercase tracking-wider mb-0.5">
                              Valor da Diária
                            </p>
                            <p className="text-2xl font-extrabold text-[#0EA5E9] tabular-nums">
                              {formatCurrency(freeDaily)}
                            </p>
                          </div>

                          {/* Interactive Daily Rate Calculator */}
                          <div className="flex flex-col items-end gap-1">
                            <span className="text-[11px] oneui-text-muted font-medium">
                              Calcular diárias
                            </span>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => setFreelancerDays(company.id, freeDays - 1)}
                                className="w-8 h-8 rounded-full oneui-card flex items-center justify-center oneui-text active:scale-90 transition-transform"
                                aria-label="Diminuir diárias"
                              >
                                <Minus size={14} />
                              </button>
                              <span className="w-8 text-center text-[15px] font-extrabold oneui-text tabular-nums">
                                {freeDays}
                              </span>
                              <button
                                type="button"
                                onClick={() => setFreelancerDays(company.id, freeDays + 1)}
                                className="w-8 h-8 rounded-full oneui-card flex items-center justify-center oneui-text active:scale-90 transition-transform"
                                aria-label="Aumentar diárias"
                              >
                                <Plus size={14} />
                              </button>
                            </div>
                          </div>
                        </div>

                        <div className="oneui-surface-2 px-4 py-3 flex items-center justify-between text-[13px] tabular-nums">
                          <span className="oneui-text-secondary font-medium">
                            Total calculado ({freeDays} {freeDays === 1 ? 'diária' : 'diárias'})
                          </span>
                          <span className="font-extrabold text-[#30D158] text-[15px]">
                            {formatCurrency(freeTotal)}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Quick Income Launch Actions */}
                  <div
                    className="pt-4 flex flex-wrap items-center gap-2"
                    style={{ borderTop: '1px solid var(--app-divider)' }}
                  >
                    {isFixed ? (
                      <>
                        <button
                          type="button"
                          disabled={postingId !== null}
                          onClick={() =>
                            handleQuickPostIncome(
                              `${company.id}-salary`,
                              `Salário - ${company.name}`,
                              company.advanceDay ? estimatedRemainder : baseSalaryVal,
                              'Salário'
                            )
                          }
                          className="flex-1 min-h-[42px] px-4 py-2 rounded-[14px] bg-[#30D158] text-black font-bold text-[13px] flex items-center justify-center gap-1.5 shadow-sm active:scale-95 transition-transform disabled:opacity-50"
                        >
                          {postingId === `${company.id}-salary` ? (
                            <CheckCircle2 size={15} />
                          ) : (
                            <ArrowUpRight size={15} strokeWidth={2.5} />
                          )}
                          <span>
                            {company.advanceDay ? 'Lançar Saldo (60%)' : 'Lançar Salário'}
                          </span>
                        </button>

                        {company.advanceDay && (
                          <button
                            type="button"
                            disabled={postingId !== null}
                            onClick={() =>
                              handleQuickPostIncome(
                                `${company.id}-advance`,
                                `Adiantamento Salarial - ${company.name}`,
                                estimatedAdvance,
                                'Salário'
                              )
                            }
                            className="min-h-[42px] px-4 py-2 rounded-[14px] oneui-surface-2 oneui-hover font-semibold text-[13px] oneui-text flex items-center justify-center gap-1.5 active:scale-95 transition-transform disabled:opacity-50"
                          >
                            <DollarSign size={14} className="text-[#FF9F0A]" />
                            <span>Lançar Vale (40%)</span>
                          </button>
                        )}
                      </>
                    ) : (
                      <button
                        type="button"
                        disabled={postingId !== null}
                        onClick={() =>
                          handleQuickPostIncome(
                            `${company.id}-daily`,
                            `${freeDays} ${freeDays === 1 ? 'diária' : 'diárias'} - ${company.name}`,
                            freeTotal,
                            'Freelance'
                          )
                        }
                        className="w-full min-h-[42px] px-4 py-2 rounded-[14px] bg-[#0EA5E9] text-white font-bold text-[13px] flex items-center justify-center gap-1.5 shadow-sm active:scale-95 transition-transform disabled:opacity-50"
                      >
                        <ArrowUpRight size={15} strokeWidth={2.5} />
                        <span>
                          Lançar {freeDays} {freeDays === 1 ? 'Diária' : 'Diárias'} ({formatCurrency(freeTotal)})
                        </span>
                      </button>
                    )}
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

export default CompanyPage;
