import React, { useState, useEffect } from 'react';
import { AppSettings, UserProfile, ThemeType, LayoutMode, FpsLevel } from '../types';
import { updateUserEmail, auth } from '../services/firebase';
import {
  ANDROID_APP_ID,
  DEFAULT_HOSTED_API_URL,
  getHostedApiBaseUrl,
  isNativePlatform,
  setHostedApiBaseUrl,
} from '../services/nativeAndroid';
import {
  Palette,
  User,
  Battery,
  Zap,
  CheckCircle2,
  ShieldCheck,
  Sliders,
  RotateCcw,
  Check,
  PanelBottomClose,
  Minus,
  Plus,
  Mail,
  Smartphone,
  Download,
  Server,
} from 'lucide-react';
import { motion } from 'framer-motion';

interface SettingsProps {
  user: UserProfile;
  settings: AppSettings;
  onUpdateSettings: (newSettings: AppSettings) => void;
  onResetSettings: () => void;
  onShowToast: (message: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
}

interface ThemeOption {
  id: ThemeType;
  label: string;
  subtitle: string;
  bg: string;
  surface: string;
  accent: string;
  text: string;
}

const THEME_OPTIONS: ThemeOption[] = [
  {
    id: 'default',
    label: 'One UI 9 Escuro',
    subtitle: 'Grafite & aura azul-violeta',
    bg: '#0C0C12',
    surface: '#191926',
    accent: '#4C7BFF',
    text: '#F5F6FB',
  },
  {
    id: 'oneui-light',
    label: 'One UI 9 Claro',
    subtitle: 'Pérola suave & cards brancos',
    bg: '#F3F4F9',
    surface: '#FFFFFF',
    accent: '#2F6BFF',
    text: '#11131A',
  },
  {
    id: 'ios-midnight',
    label: 'Preto OLED',
    subtitle: 'Preto puro & verde esmeralda',
    bg: '#000000',
    surface: '#141418',
    accent: '#30D158',
    text: '#FFFFFF',
  },
  {
    id: 'cyberpunk',
    label: 'Vidro Violeta',
    subtitle: 'Índigo profundo & lilás',
    bg: '#0D0A18',
    surface: '#1D1735',
    accent: '#8B5CF6',
    text: '#F7F4FF',
  },
  {
    id: 'ocean',
    label: 'Ocean',
    subtitle: 'Mar profundo & azul ciano',
    bg: '#06101C',
    surface: '#112238',
    accent: '#38BDF8',
    text: '#F0F8FF',
  },
  {
    id: 'sunset',
    label: 'Sunset',
    subtitle: 'Âmbar quente & terracota',
    bg: '#140C0C',
    surface: '#281A1A',
    accent: '#FF8A3D',
    text: '#FFF7F2',
  },
];

const LAYOUT_OPTIONS: { id: LayoutMode; label: string; desc: string }[] = [
  { id: 'minimal', label: 'Minimalista', desc: 'Sem auras nem desfoques, foco total nos dados.' },
  { id: 'default', label: 'One UI + iOS', desc: 'Super-arredondado, vidro sutil e equilíbrio.' },
  { id: 'advanced', label: 'Efeitos Pro', desc: 'Vidro translúcido acentuado e aura ampliada.' },
];

const FPS_OPTIONS: { val: FpsLevel; label: string; desc: string }[] = [
  { val: 'low', label: 'Econômico', desc: 'Transições instantâneas' },
  { val: 'medium', label: 'Equilibrado', desc: 'Suave a 60 FPS' },
  { val: 'high', label: 'ProMotion', desc: 'Molas ágeis 120 Hz' },
];

const SwitchControl: React.FC<{ checked: boolean; onToggle: () => void; label: string }> = ({
  checked,
  onToggle,
  label,
}) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    aria-label={label}
    onClick={onToggle}
    className="w-[52px] h-[32px] rounded-full p-[3px] transition-colors duration-200 relative shrink-0 cursor-pointer"
    style={{
      backgroundColor: checked ? '#30D158' : 'var(--app-surface-3)',
      border: '1px solid var(--app-border-strong)',
    }}
  >
    <div
      className={`w-[24px] h-[24px] bg-white rounded-full shadow-md transition-transform duration-200 ${
        checked ? 'translate-x-[20px]' : 'translate-x-0'
      }`}
    />
  </button>
);

const Settings: React.FC<SettingsProps> = ({
  user,
  settings,
  onUpdateSettings,
  onResetSettings,
  onShowToast,
}) => {
  const [activeTab, setActiveTab] = useState<'visual' | 'performance' | 'account'>('visual');
  const [newEmail, setNewEmail] = useState('');
  const [emailStatus, setEmailStatus] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [serverUrlInput, setServerUrlInput] = useState(() => getHostedApiBaseUrl());
  const [apkInfo, setApkInfo] = useState<{
    available: boolean;
    filename?: string;
    appId?: string;
    version?: string;
    sizeBytes?: number;
    downloadUrl?: string;
  } | null>(null);

  const runningNative = isNativePlatform();

  useEffect(() => {
    if (runningNative) return;
    let active = true;
    fetch('/api/apk/info')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (active && data) setApkInfo(data);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [runningNative]);

  const handleSaveServerUrl = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const saved = setHostedApiBaseUrl(serverUrlInput);
      setServerUrlInput(saved);
      onShowToast('URL do servidor Capitalyx atualizada!', 'success');
    } catch (err: any) {
      onShowToast(err?.message || 'URL inválida.', 'error');
    }
  };

  const handleResetServerUrl = () => {
    const reset = setHostedApiBaseUrl('');
    setServerUrlInput(reset);
    onShowToast('URL padrão do servidor restaurada.', 'info');
  };

  const normalizedTheme: ThemeType = settings.visual.theme === 'ios' ? 'default' : settings.visual.theme;
  const normalizedLayout: LayoutMode =
    settings.visual.layoutMode === 'ios' ? 'default' : settings.visual.layoutMode;
  const autoHideDock = settings.visual.autoHideDock !== false;

  const handleFpsChange = (fps: FpsLevel) => {
    onUpdateSettings({
      ...settings,
      performance: { ...settings.performance, fps },
    });
    const label = FPS_OPTIONS.find((o) => o.val === fps)?.label || fps;
    onShowToast(`Animações definidas para ${label}.`, 'info');
  };

  const handleHighPerformanceToggle = () => {
    const next = !settings.performance.highPerformanceMode;
    onUpdateSettings({
      ...settings,
      performance: {
        ...settings.performance,
        highPerformanceMode: next,
      },
    });
    onShowToast(
      next ? 'Alto desempenho ativado: efeitos pesados desativados.' : 'Efeitos visuais restaurados.',
      'info'
    );
  };

  const handleThemeChange = (theme: ThemeType) => {
    onUpdateSettings({
      ...settings,
      visual: { ...settings.visual, theme },
    });
    const label = THEME_OPTIONS.find((t) => t.id === theme)?.label || theme;
    onShowToast(`Tema alterado para ${label}.`, 'success');
  };

  const handleLayoutModeChange = (mode: LayoutMode) => {
    onUpdateSettings({
      ...settings,
      visual: { ...settings.visual, layoutMode: mode },
    });
    const label = LAYOUT_OPTIONS.find((l) => l.id === mode)?.label || mode;
    onShowToast(`Estilo de layout: ${label}.`, 'info');
  };

  const updateScale = (val: number) => {
    const clamped = Math.round(Math.min(1.2, Math.max(0.8, val)) * 100) / 100;
    onUpdateSettings({
      ...settings,
      visual: { ...settings.visual, scale: clamped },
    });
  };

  const handleAutoHideDockToggle = () => {
    const next = !autoHideDock;
    onUpdateSettings({
      ...settings,
      visual: { ...settings.visual, autoHideDock: next },
    });
    onShowToast(
      next
        ? 'Menu inferior se ocultará automaticamente ao rolar.'
        : 'Menu inferior permanecerá visível ao rolar (modais continuam ocultando).',
      'info'
    );
  };

  const handleAutoLoginToggle = () => {
    const next = !settings.account.autoLogin;
    onUpdateSettings({
      ...settings,
      account: { ...settings.account, autoLogin: next },
    });
    onShowToast(
      next
        ? 'Login automático ativado: sessão salva no navegador.'
        : 'Login automático desativado: sessão válida apenas nesta aba.',
      'info'
    );
  };

  const handleChangeEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (user.emailVerified || !newEmail.trim() || !auth?.currentUser) return;

    setEmailError(null);
    try {
      setEmailStatus('Enviando e-mail de confirmação...');
      await updateUserEmail(auth.currentUser, newEmail.trim());
      setEmailStatus('Confirmação enviada! Valide no novo endereço para concluir.');
      onShowToast('E-mail de confirmação enviado!', 'success');
      setNewEmail('');
    } catch (error: any) {
      setEmailStatus(null);
      if (error?.code === 'auth/requires-recent-login') {
        setEmailError('Por segurança, saia e entre novamente antes de alterar o e-mail.');
      } else {
        setEmailError(error?.message || 'Não foi possível alterar o e-mail.');
      }
    }
  };

  const tabs = [
    { id: 'visual', label: 'Aparência', icon: Palette },
    { id: 'performance', label: 'Desempenho', icon: Zap },
    { id: 'account', label: 'Conta', icon: User },
  ] as const;

  const avatarUrl =
    user.photoURL ||
    `https://ui-avatars.com/api/?name=${encodeURIComponent(user.displayName || 'User')}&background=2F6BFF&color=fff`;

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-8">
      {/* One UI 9 Profile Summary Card */}
      <div className="oneui-card p-5 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4 min-w-0">
          <div className="relative shrink-0">
            <img
              src={avatarUrl}
              alt="User"
              referrerPolicy="no-referrer"
              className="w-14 h-14 sm:w-16 sm:h-16 rounded-full object-cover shadow-md"
              style={{ border: '2px solid var(--app-border-strong)' }}
            />
            {user.emailVerified && (
              <div
                className="absolute -bottom-0.5 -right-0.5 bg-[#30D158] text-white rounded-full p-1"
                style={{ border: '2px solid var(--app-surface)' }}
              >
                <CheckCircle2 size={12} strokeWidth={3} />
              </div>
            )}
          </div>
          <div className="min-w-0">
            <h2 className="text-[18px] font-bold oneui-text truncate leading-tight">
              {user.displayName || 'Usuário'}
            </h2>
            <p className="text-[13px] oneui-text-secondary truncate mt-0.5">
              {user.email || 'Conta Capitalyx'}
            </p>
            <p className="text-[12px] oneui-text-muted mt-0.5">
              {user.emailVerified ? 'Conta verificada' : 'Verificação de e-mail pendente'}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onResetSettings}
          className="oneui-surface-2 oneui-hover px-3.5 py-2.5 min-h-[42px] rounded-[16px] text-[13px] font-semibold oneui-text-secondary flex items-center gap-2 active:scale-95 transition-all"
          title="Restaurar todas as configurações padrão"
        >
          <RotateCcw size={15} />
          <span>Restaurar padrões</span>
        </button>
      </div>

      {/* iOS-inspired Segmented Control */}
      <div className="oneui-card p-1.5 rounded-[22px] grid grid-cols-3 gap-1">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`min-h-[44px] py-2 px-3 rounded-[16px] text-[13px] font-semibold transition-all flex items-center justify-center gap-2 ${
                isActive ? 'oneui-accent-btn shadow-sm' : 'oneui-text-secondary oneui-hover'
              }`}
            >
              <tab.icon size={15} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      <motion.div
        key={activeTab}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.18 }}
        className="space-y-6"
      >
        {activeTab === 'visual' && (
          <div className="space-y-6">
            {/* Theme Picker */}
            <section>
              <p className="text-[12px] font-semibold oneui-text-muted uppercase px-3 mb-2.5 tracking-wider">
                Tema de Cores
              </p>
              <div className="oneui-card p-4 sm:p-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {THEME_OPTIONS.map((t) => {
                    const isSelected = normalizedTheme === t.id;
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => handleThemeChange(t.id)}
                        className="p-3.5 rounded-[20px] text-left transition-all active:scale-[0.98] flex flex-col gap-3"
                        style={{
                          backgroundColor: isSelected ? 'var(--app-accent-soft)' : 'var(--app-surface-2)',
                          border: isSelected
                            ? '1.5px solid var(--app-accent)'
                            : '1px solid var(--app-border)',
                        }}
                      >
                        {/* Live Mini Preview */}
                        <div
                          className="w-full h-14 rounded-[14px] p-2.5 flex items-end justify-between relative overflow-hidden"
                          style={{
                            backgroundColor: t.bg,
                            border: '1px solid rgba(128,128,128,0.18)',
                          }}
                        >
                          <div
                            className="w-16 h-6 rounded-[8px]"
                            style={{ backgroundColor: t.surface }}
                          />
                          <div
                            className="w-8 h-3.5 rounded-full"
                            style={{ backgroundColor: t.accent }}
                          />
                          {isSelected && (
                            <span
                              className="absolute top-2 right-2 w-5 h-5 rounded-full flex items-center justify-center text-white"
                              style={{ backgroundColor: t.accent }}
                            >
                              <Check size={12} strokeWidth={3} />
                            </span>
                          )}
                        </div>
                        <div>
                          <p className="text-[14px] font-bold oneui-text leading-tight">{t.label}</p>
                          <p className="text-[12px] oneui-text-muted mt-0.5">{t.subtitle}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </section>

            {/* Layout Style */}
            <section>
              <p className="text-[12px] font-semibold oneui-text-muted uppercase px-3 mb-2.5 tracking-wider">
                Estrutura de Layout
              </p>
              <div className="oneui-card p-4 sm:p-5">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {LAYOUT_OPTIONS.map((opt) => {
                    const isSelected = normalizedLayout === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => handleLayoutModeChange(opt.id)}
                        className="p-4 rounded-[20px] text-left transition-all active:scale-[0.98]"
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
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[14px] font-bold oneui-text">{opt.label}</span>
                          {isSelected && <Check size={15} style={{ color: 'var(--app-accent)' }} />}
                        </div>
                        <p className="text-[12px] oneui-text-muted leading-snug">{opt.desc}</p>
                      </button>
                    );
                  })}
                </div>
              </div>
            </section>

            {/* Interface Scale & Mobile Dock */}
            <section>
              <p className="text-[12px] font-semibold oneui-text-muted uppercase px-3 mb-2.5 tracking-wider">
                Escala & Navegação Mobile
              </p>
              <div className="oneui-card oneui-divider overflow-hidden">
                {/* Scale Row */}
                <div className="p-5 space-y-4">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-[13px] bg-[#2F6BFF]/15 text-[#2F6BFF] flex items-center justify-center shrink-0">
                        <Sliders size={19} />
                      </div>
                      <div>
                        <p className="text-[15px] font-semibold oneui-text">Escala da Interface</p>
                        <p className="text-[12px] oneui-text-muted">
                          Ajusta o tamanho de textos, cartões e espaçamentos
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => updateScale(settings.visual.scale - 0.05)}
                        disabled={settings.visual.scale <= 0.8}
                        className="w-9 h-9 rounded-full oneui-surface-2 oneui-text flex items-center justify-center disabled:opacity-40 active:scale-95"
                        aria-label="Diminuir escala"
                      >
                        <Minus size={15} />
                      </button>
                      <button
                        type="button"
                        onClick={() => updateScale(1.0)}
                        className="px-3 h-9 rounded-full oneui-surface-2 text-[13px] font-bold tabular-nums"
                        style={{ color: 'var(--app-accent)' }}
                        title="Voltar para 100%"
                      >
                        {Math.round(settings.visual.scale * 100)}%
                      </button>
                      <button
                        type="button"
                        onClick={() => updateScale(settings.visual.scale + 0.05)}
                        disabled={settings.visual.scale >= 1.2}
                        className="w-9 h-9 rounded-full oneui-surface-2 oneui-text flex items-center justify-center disabled:opacity-40 active:scale-95"
                        aria-label="Aumentar escala"
                      >
                        <Plus size={15} />
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <input
                      type="range"
                      min="0.8"
                      max="1.2"
                      step="0.05"
                      value={settings.visual.scale}
                      onChange={(e) => updateScale(parseFloat(e.target.value))}
                      className="w-full h-2 rounded-full cursor-pointer"
                      style={{ accentColor: 'var(--app-accent)' }}
                    />
                    <div className="flex justify-between text-[11px] oneui-text-muted font-medium tabular-nums">
                      <span>Compacto (80%)</span>
                      <span>Padrão (100%)</span>
                      <span>Amplo (120%)</span>
                    </div>
                  </div>
                </div>

                {/* Auto-Hide Dock Toggle */}
                <div className="p-5 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-[13px] bg-[#9D7BFF]/15 text-[#9D7BFF] flex items-center justify-center shrink-0">
                      <PanelBottomClose size={19} />
                    </div>
                    <div>
                      <p className="text-[15px] font-semibold oneui-text">Ocultar Barra ao Rolar</p>
                      <p className="text-[12px] oneui-text-muted">
                        Recolhe a cápsula inferior ao descer a página. Modais sempre a ocultam automaticamente.
                      </p>
                    </div>
                  </div>
                  <SwitchControl
                    checked={autoHideDock}
                    onToggle={handleAutoHideDockToggle}
                    label="Ocultar barra inferior ao rolar"
                  />
                </div>
              </div>
            </section>
          </div>
        )}

        {activeTab === 'performance' && (
          <div className="space-y-6">
            <section>
              <p className="text-[12px] font-semibold oneui-text-muted uppercase px-3 mb-2.5 tracking-wider">
                Taxa de Quadros & Animações
              </p>
              <div className="oneui-card p-4 sm:p-5">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {FPS_OPTIONS.map((opt) => {
                    const isSelected = settings.performance.fps === opt.val;
                    return (
                      <button
                        key={opt.val}
                        type="button"
                        onClick={() => handleFpsChange(opt.val)}
                        className="p-4 rounded-[20px] text-left transition-all active:scale-[0.98]"
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
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[14px] font-bold oneui-text">{opt.label}</span>
                          {isSelected && <Check size={15} style={{ color: 'var(--app-accent)' }} />}
                        </div>
                        <p className="text-[12px] oneui-text-muted">{opt.desc}</p>
                      </button>
                    );
                  })}
                </div>
              </div>
            </section>

            <section>
              <p className="text-[12px] font-semibold oneui-text-muted uppercase px-3 mb-2.5 tracking-wider">
                Bateria & Fluidez
              </p>
              <div className="oneui-card overflow-hidden">
                <div className="p-5 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3.5">
                    <div className="w-10 h-10 rounded-[13px] bg-[#30D158]/15 text-[#30D158] flex items-center justify-center shrink-0">
                      <Battery size={20} />
                    </div>
                    <div>
                      <p className="text-[15px] font-semibold oneui-text">Modo Alto Desempenho</p>
                      <p className="text-[12px] oneui-text-muted">
                        Desativa desfoques de vidro e auras de fundo para economizar GPU e bateria.
                      </p>
                    </div>
                  </div>

                  <SwitchControl
                    checked={settings.performance.highPerformanceMode}
                    onToggle={handleHighPerformanceToggle}
                    label="Modo Alto Desempenho"
                  />
                </div>
              </div>
            </section>
          </div>
        )}

        {activeTab === 'account' && (
          <div className="space-y-6">
            <section>
              <p className="text-[12px] font-semibold oneui-text-muted uppercase px-3 mb-2.5 tracking-wider">
                Sessão & Segurança
              </p>
              <div className="oneui-card overflow-hidden">
                <div className="p-5 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3.5">
                    <div className="w-10 h-10 rounded-[13px] bg-[#2F6BFF]/15 text-[#2F6BFF] flex items-center justify-center shrink-0">
                      <ShieldCheck size={20} />
                    </div>
                    <div>
                      <p className="text-[15px] font-semibold oneui-text">Login Automático</p>
                      <p className="text-[12px] oneui-text-muted">
                        Mantém sua conta conectada mesmo após fechar o navegador (Firebase Auth).
                      </p>
                    </div>
                  </div>

                  <SwitchControl
                    checked={settings.account.autoLogin}
                    onToggle={handleAutoLoginToggle}
                    label="Login Automático"
                  />
                </div>
              </div>
            </section>

            <section>
              <p className="text-[12px] font-semibold oneui-text-muted uppercase px-3 mb-2.5 tracking-wider">
                E-mail da Conta
              </p>
              <div className="oneui-card p-5">
                {user.emailVerified ? (
                  <div className="flex items-center gap-3.5">
                    <div className="w-10 h-10 rounded-[13px] bg-[#30D158]/15 text-[#30D158] flex items-center justify-center shrink-0">
                      <CheckCircle2 size={20} />
                    </div>
                    <p className="text-[14px] oneui-text-secondary leading-relaxed">
                      Seu e-mail <strong className="oneui-text">{user.email}</strong> está verificado e protegido pelo Firebase Authentication.
                    </p>
                  </div>
                ) : (
                  <form onSubmit={handleChangeEmail} className="space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-[13px] bg-[#FF9F0A]/15 text-[#FF9F0A] flex items-center justify-center shrink-0">
                        <Mail size={19} />
                      </div>
                      <p className="text-[13px] oneui-text-secondary">
                        E-mail atual: <strong className="oneui-text">{user.email}</strong> (pendente de confirmação).
                      </p>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-2.5">
                      <input
                        type="email"
                        required
                        value={newEmail}
                        onChange={(e) => setNewEmail(e.target.value)}
                        placeholder="Digite o novo endereço de e-mail"
                        className="flex-1 oneui-surface-2 px-4 py-3 text-[14px] oneui-text placeholder:opacity-45 focus:outline-none"
                      />
                      <button
                        type="submit"
                        className="oneui-accent-btn px-5 py-3 rounded-[16px] text-[14px] font-semibold shadow-sm active:scale-95 transition-all whitespace-nowrap"
                      >
                        Atualizar E-mail
                      </button>
                    </div>
                    {emailStatus && <p className="text-[13px] text-[#30D158] font-medium">{emailStatus}</p>}
                    {emailError && <p className="text-[13px] text-[#FF453A] font-medium">{emailError}</p>}
                  </form>
                )}
              </div>
            </section>

            {/* Android APK & Servidor Hospedado */}
            <section>
              <p className="text-[12px] font-semibold oneui-text-muted uppercase px-3 mb-2.5 tracking-wider">
                Aplicativo Android (APK)
              </p>
              <div className="oneui-card p-5 space-y-4">
                {runningNative ? (
                  <form onSubmit={handleSaveServerUrl} className="space-y-4">
                    <div className="flex items-start gap-3.5">
                      <div className="w-10 h-10 rounded-[13px] bg-[#30D158]/15 text-[#30D158] flex items-center justify-center shrink-0">
                        <Server size={19} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[15px] font-semibold oneui-text">
                          Servidor da API (IA & Login Social)
                        </p>
                        <p className="text-[12px] oneui-text-muted mt-0.5 leading-relaxed">
                          Pacote nativo <strong className="oneui-text">{ANDROID_APP_ID}</strong>. Configure o endereço do servidor Capitalyx caso hospede em outro domínio.
                        </p>
                      </div>
                    </div>
                    <input
                      type="url"
                      value={serverUrlInput}
                      onChange={(e) => setServerUrlInput(e.target.value)}
                      placeholder={DEFAULT_HOSTED_API_URL}
                      className="w-full oneui-surface-2 px-4 py-3 text-[13px] oneui-text placeholder:opacity-45 focus:outline-none font-mono"
                    />
                    <div className="flex flex-wrap gap-2.5">
                      <button
                        type="submit"
                        className="oneui-accent-btn px-4 py-2.5 min-h-[42px] rounded-[14px] text-[13px] font-semibold active:scale-95 transition-all"
                      >
                        Salvar Servidor
                      </button>
                      <button
                        type="button"
                        onClick={handleResetServerUrl}
                        className="oneui-surface-2 oneui-hover px-4 py-2.5 min-h-[42px] rounded-[14px] text-[13px] font-semibold oneui-text-secondary active:scale-95 transition-all"
                      >
                        Usar Padrão
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-start gap-3.5 min-w-0">
                      <div className="w-10 h-10 rounded-[13px] bg-[#30D158]/15 text-[#30D158] flex items-center justify-center shrink-0">
                        <Smartphone size={20} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[15px] font-semibold oneui-text">
                          Capitalyx para Android (Debug APK)
                        </p>
                        <p className="text-[12px] oneui-text-muted mt-0.5 leading-relaxed">
                          {apkInfo?.available
                            ? `Pacote ${apkInfo.appId} · v${apkInfo.version} (${(
                                (apkInfo.sizeBytes || 0) /
                                (1024 * 1024)
                              ).toFixed(2)} MB) pronto para instalar e depurar via ADB.`
                            : `Pacote ${ANDROID_APP_ID} configurado com Capacitor nativo.`}
                        </p>
                      </div>
                    </div>

                    {apkInfo?.available && (
                      <a
                        href={apkInfo.downloadUrl || '/api/apk/download'}
                        download="capitalyx-debug.apk"
                        className="oneui-accent-btn px-4 py-2.5 min-h-[44px] rounded-[16px] text-[13px] font-semibold flex items-center justify-center gap-2 shadow-sm active:scale-95 transition-all whitespace-nowrap shrink-0"
                      >
                        <Download size={16} />
                        <span>Baixar APK</span>
                      </a>
                    )}
                  </div>
                )}
              </div>
            </section>
          </div>
        )}
      </motion.div>
    </div>
  );
};

export default Settings;
