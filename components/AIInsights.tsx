import React from 'react';
import { Transaction, AIAnalysisResult, FinancialGoal } from '../types';
import { Sparkles, AlertTriangle, PiggyBank, TrendingUp, Loader2, BrainCircuit, Wallet } from 'lucide-react';
import { motion } from 'framer-motion';

interface AIInsightsProps {
  transactions: Transaction[];
  goals?: FinancialGoal[];
  insight: AIAnalysisResult | null;
  loading: boolean;
  error: string | null;
  onAnalyze: () => Promise<void> | void;
}

const AIInsights: React.FC<AIInsightsProps> = ({
  transactions,
  goals = [],
  insight,
  loading,
  error,
  onAnalyze,
}) => {
  const hasData = transactions.length > 0 || goals.length > 0;

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      <div
        className="oneui-card relative overflow-hidden p-7 md:p-10 text-center"
        style={{
          background:
            'linear-gradient(145deg, var(--app-surface) 0%, var(--app-accent-soft) 65%, rgba(139, 92, 246, 0.14) 100%)',
        }}
      >
        <div className="relative z-10 max-w-xl mx-auto space-y-4">
          <div className="inline-flex p-3.5 rounded-[18px] bg-gradient-to-tr from-[#4C7BFF] via-[#7C5CFF] to-[#9D7BFF] text-white shadow-lg">
            <Sparkles size={26} />
          </div>

          <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold oneui-text tracking-tight">
            Inteligência Financeira Capitalyx
          </h2>

          <p className="text-[15px] oneui-text-secondary leading-relaxed">
            Análises inteligentes avaliam seu fluxo de caixa para identificar gargalos, prever liquidez futura e sugerir metas práticas de economia.
          </p>

          <div className="pt-2">
            {!loading && (
              <button
                type="button"
                onClick={onAnalyze}
                disabled={!hasData}
                className="oneui-accent-btn disabled:opacity-40 disabled:cursor-not-allowed font-bold text-[15px] py-3.5 px-8 rounded-full shadow-lg transition-all active:scale-95 inline-flex items-center gap-2"
              >
                <Sparkles size={18} />
                <span>{insight ? 'Atualizar Análise Financeira' : 'Iniciar Diagnóstico Inteligente'}</span>
              </button>
            )}

            {!hasData && !loading && (
              <p className="text-[12px] oneui-text-muted mt-3">
                Cadastre ao menos uma transação ou meta para habilitar o diagnóstico.
              </p>
            )}

            {loading && (
              <div className="flex flex-col items-center justify-center oneui-text-secondary gap-3 py-2">
                <Loader2 className="animate-spin text-[#9D7BFF]" size={30} />
                <span className="text-[14px] font-medium">
                  Processando transações com inteligência financeira...
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {error && (
        <div className="oneui-card p-5 flex items-start gap-3.5 bg-[#FF453A]/10" style={{ borderColor: 'rgba(255,69,58,0.35)' }}>
          <div className="p-2 bg-[#FF453A]/15 text-[#FF453A] rounded-full shrink-0">
            <AlertTriangle size={20} />
          </div>
          <div>
            <h4 className="text-[15px] font-bold text-[#FF453A] mb-0.5">Não foi possível concluir a análise</h4>
            <p className="text-[13px] oneui-text-secondary leading-relaxed">{error}</p>
          </div>
        </div>
      )}

      {insight && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
          <div className="oneui-card p-6">
            <div className="flex items-center gap-3 mb-3">
              <div
                className="w-9 h-9 rounded-[12px] flex items-center justify-center"
                style={{ backgroundColor: 'var(--app-accent-soft)', color: 'var(--app-accent)' }}
              >
                <BrainCircuit size={19} />
              </div>
              <h3 className="text-[17px] font-bold oneui-text">Resumo Executivo do seu Caixa</h3>
            </div>
            <p className="text-[15px] oneui-text-secondary leading-relaxed">{insight.summary}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="oneui-card p-6" style={{ borderColor: 'rgba(48, 209, 88, 0.30)' }}>
              <div className="flex items-center gap-3 mb-3 text-[#30D158]">
                <div className="w-9 h-9 rounded-[12px] bg-[#30D158]/15 flex items-center justify-center">
                  <PiggyBank size={18} />
                </div>
                <h3 className="text-[16px] font-bold oneui-text">Oportunidade de Economia</h3>
              </div>
              <p className="text-[14px] oneui-text-secondary leading-relaxed">{insight.savingsTip}</p>
            </div>

            <div className="oneui-card p-6" style={{ borderColor: 'rgba(76, 123, 255, 0.30)' }}>
              <div className="flex items-center gap-3 mb-3" style={{ color: 'var(--app-accent)' }}>
                <div
                  className="w-9 h-9 rounded-[12px] flex items-center justify-center"
                  style={{ backgroundColor: 'var(--app-accent-soft)' }}
                >
                  <TrendingUp size={18} />
                </div>
                <h3 className="text-[16px] font-bold oneui-text">Projeção de Fluxo de Caixa</h3>
              </div>
              <p className="text-[14px] oneui-text-secondary leading-relaxed">{insight.prediction}</p>
            </div>
          </div>

          {insight.cashFlowTip && (
            <div className="oneui-card p-6" style={{ borderColor: 'rgba(157, 123, 255, 0.30)' }}>
              <div className="flex items-center gap-3 mb-2.5 text-[#9D7BFF]">
                <div className="w-9 h-9 rounded-[12px] bg-[#9D7BFF]/15 flex items-center justify-center">
                  <Wallet size={18} />
                </div>
                <h3 className="text-[16px] font-bold oneui-text">Dica de Liquidez & Fluxo</h3>
              </div>
              <p className="text-[14px] oneui-text-secondary leading-relaxed">{insight.cashFlowTip}</p>
            </div>
          )}

          {insight.alert && (
            <div className="oneui-card p-5 flex items-start gap-3.5 bg-[#FF453A]/10" style={{ borderColor: 'rgba(255,69,58,0.35)' }}>
              <div className="p-2 bg-[#FF453A]/15 text-[#FF453A] rounded-full shrink-0">
                <AlertTriangle size={20} />
              </div>
              <div>
                <h4 className="text-[15px] font-bold text-[#FF453A] mb-0.5">Alerta de Gastos Detectado</h4>
                <p className="text-[13px] oneui-text-secondary leading-relaxed">{insight.alert}</p>
              </div>
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
};

export default AIInsights;
