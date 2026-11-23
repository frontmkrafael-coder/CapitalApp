import React from 'react';
import { Achievement } from '../types';
import { motion } from 'framer-motion';
import { Trophy, TrendingUp, TrendingDown, Bot, Database, Lock, Medal, CheckCircle2 } from 'lucide-react';

interface AchievementsProps {
  achievements: Achievement[];
}

const getIcon = (iconName: string, isUnlocked: boolean) => {
  const className = isUnlocked ? 'text-white' : 'oneui-text-muted';
  const size = 24;

  switch (iconName) {
    case 'FirstIncome':
      return <TrendingUp size={size} className={className} strokeWidth={2.4} />;
    case 'FirstExpense':
      return <TrendingDown size={size} className={className} strokeWidth={2.4} />;
    case 'FirstAI':
      return <Bot size={size} className={className} strokeWidth={2.4} />;
    case 'DataMaster':
      return <Database size={size} className={className} strokeWidth={2.4} />;
    case 'Saver':
      return <Medal size={size} className={className} strokeWidth={2.4} />;
    default:
      return <Trophy size={size} className={className} strokeWidth={2.4} />;
  }
};

const getBadgeGradient = (iconName: string, isUnlocked: boolean) => {
  if (!isUnlocked) return 'oneui-surface-2';
  switch (iconName) {
    case 'FirstIncome':
      return 'bg-gradient-to-tr from-[#30D158] to-[#34D399] shadow-md';
    case 'FirstExpense':
      return 'bg-gradient-to-tr from-[#FF9F0A] to-[#FFD60A] shadow-md';
    case 'FirstAI':
      return 'bg-gradient-to-tr from-[#8B5CF6] to-[#4C7BFF] shadow-md';
    case 'DataMaster':
      return 'bg-gradient-to-tr from-[#2F6BFF] to-[#38BDF8] shadow-md';
    case 'Saver':
      return 'bg-gradient-to-tr from-[#FF375F] to-[#FF9F0A] shadow-md';
    default:
      return 'bg-gradient-to-tr from-[#FFD60A] to-[#FF9F0A] shadow-md';
  }
};

const Achievements: React.FC<AchievementsProps> = ({ achievements }) => {
  const unlockedCount = achievements.filter((a) => a.isUnlocked).length;
  const progress = achievements.length > 0 ? (unlockedCount / achievements.length) * 100 : 0;

  return (
    <div className="space-y-6 pb-12">
      {/* Header Summary Card */}
      <div className="oneui-card p-6 relative overflow-hidden">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-[16px] bg-gradient-to-tr from-[#FFD60A] to-[#FF9F0A] text-black flex items-center justify-center font-bold shadow-md shrink-0">
              <Trophy size={24} />
            </div>
            <div>
              <h2 className="text-xl md:text-2xl font-extrabold oneui-text tracking-tight">
                Medalhas & Conquistas
              </h2>
              <p className="text-[13px] oneui-text-secondary">Prêmios de hábitos e disciplina financeira</p>
            </div>
          </div>

          <div className="flex items-baseline gap-2 self-end md:self-auto oneui-surface-2 px-4 py-2.5">
            <span className="text-2xl font-extrabold oneui-text tabular-nums">{unlockedCount}</span>
            <span className="oneui-text-muted text-[13px] font-medium">
              / {achievements.length} desbloqueadas
            </span>
          </div>
        </div>

        <div className="mt-6 pt-5" style={{ borderTop: '1px solid var(--app-divider)' }}>
          <div className="flex justify-between text-[12px] oneui-text-muted mb-2 font-medium">
            <span>Progresso da Coleção</span>
            <span className="tabular-nums font-bold oneui-text">{Math.round(progress)}%</span>
          </div>
          <div
            className="h-2.5 rounded-full overflow-hidden relative"
            style={{ backgroundColor: 'var(--app-surface-2)' }}
          >
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.7, ease: 'easeOut' }}
              className="h-full rounded-full bg-gradient-to-r from-[#2F6BFF] via-[#8B5CF6] to-[#30D158]"
            />
          </div>
        </div>
      </div>

      {/* Achievements Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {achievements.map((ach) => (
          <motion.div
            key={ach.id}
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            className={`oneui-card p-6 relative overflow-hidden flex flex-col justify-between ${
              ach.isUnlocked ? '' : 'opacity-65'
            }`}
          >
            <div className="flex items-start justify-between mb-4">
              <div
                className={`w-14 h-14 rounded-[18px] flex items-center justify-center ${getBadgeGradient(
                  ach.iconName,
                  ach.isUnlocked
                )}`}
              >
                {getIcon(ach.iconName, ach.isUnlocked)}
              </div>

              {ach.isUnlocked ? (
                <span className="inline-flex items-center gap-1 text-[12px] font-bold text-[#30D158]">
                  <CheckCircle2 size={14} strokeWidth={2.5} />
                  Conquistado
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[12px] font-medium oneui-text-muted">
                  <Lock size={13} />
                  Bloqueado
                </span>
              )}
            </div>

            <div className="space-y-1">
              <h3 className={`text-[16px] font-bold ${ach.isUnlocked ? 'oneui-text' : 'oneui-text-secondary'}`}>
                {ach.title}
              </h3>
              <p className="text-[13px] oneui-text-muted leading-relaxed">{ach.description}</p>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

export default Achievements;
