import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { UserProfile, AppSettings } from '../types';
import { resendVerificationEmail, auth } from '../services/firebase';
import { subscribeNativeKeyboard, triggerHaptic } from '../services/nativeAndroid';
import {
  LayoutDashboard,
  ArrowLeftRight,
  LogOut,
  X,
  MailWarning,
  Award,
  Target,
  Settings,
  User,
  Plus,
  Sparkles,
  ChevronRight,
  CheckCircle2,
  SlidersHorizontal,
  Building2,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { LogoIcon } from './LogoIcon';

interface LayoutProps {
  children: React.ReactNode;
  user: UserProfile;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  settings: AppSettings;
  onLogout: () => void;
  onOpenTransaction?: () => void;
  isOverlayOpen?: boolean;
  mobileMenuOpen?: boolean;
  onMobileMenuOpenChange?: (open: boolean) => void;
}

const Layout: React.FC<LayoutProps> = ({
  children,
  user,
  activeTab,
  setActiveTab,
  settings,
  onLogout,
  onOpenTransaction,
  isOverlayOpen = false,
  mobileMenuOpen,
  onMobileMenuOpenChange,
}) => {
  const [internalMobileMenuOpen, setInternalMobileMenuOpen] = useState(false);
  const isMobileMenuOpen =
    typeof mobileMenuOpen === 'boolean' ? mobileMenuOpen : internalMobileMenuOpen;
  const setIsMobileMenuOpen = (open: boolean) => {
    if (onMobileMenuOpenChange) onMobileMenuOpenChange(open);
    else setInternalMobileMenuOpen(open);
  };

  const [verificationSent, setVerificationSent] = useState(false);
  const [isNavVisible, setIsNavVisible] = useState(true);
  const [isInputFocused, setIsInputFocused] = useState(false);
  const [isNativeKeyboardOpen, setIsNativeKeyboardOpen] = useState(false);
  const lastScrollY = useRef(0);

  const autoHideDockEnabled = settings.visual.autoHideDock !== false;
  const shouldHideDock =
    isOverlayOpen ||
    isMobileMenuOpen ||
    isInputFocused ||
    isNativeKeyboardOpen ||
    (autoHideDockEnabled && !isNavVisible);

  const handleTabSelect = (tabId: string) => {
    triggerHaptic('light');
    setActiveTab(tabId);
  };

  // Always reveal dock when changing tabs or turning auto-hide off
  useEffect(() => {
    setIsNavVisible(true);
    lastScrollY.current = window.scrollY || 0;
  }, [activeTab, autoHideDockEnabled]);

  // Lock body scroll & handle Escape when mobile sheet menu is open
  useEffect(() => {
    if (!isMobileMenuOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsMobileMenuOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);

    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [isMobileMenuOpen]);

  // Hide mobile floating capsule while typing in inputs (prevents keyboard/inline card crowding)
  useEffect(() => {
    const isTextControl = (el: EventTarget | null) => {
      if (!(el instanceof HTMLElement)) return false;
      const tag = el.tagName;
      if (tag === 'TEXTAREA' || tag === 'SELECT') return true;
      if (tag === 'INPUT') {
        const type = (el as HTMLInputElement).type;
        return !['range', 'checkbox', 'radio', 'button', 'submit'].includes(type);
      }
      return el.isContentEditable;
    };

    const handleFocusIn = (e: FocusEvent) => {
      if (window.innerWidth < 768 && isTextControl(e.target)) {
        setIsInputFocused(true);
      }
    };

    const handleFocusOut = () => {
      setTimeout(() => {
        if (!isTextControl(document.activeElement)) {
          setIsInputFocused(false);
        }
      }, 80);
    };

    document.addEventListener('focusin', handleFocusIn);
    document.addEventListener('focusout', handleFocusOut);
    const unsubscribeKeyboard = subscribeNativeKeyboard((visible) => {
      setIsNativeKeyboardOpen(visible);
    });
    return () => {
      document.removeEventListener('focusin', handleFocusIn);
      document.removeEventListener('focusout', handleFocusOut);
      unsubscribeKeyboard();
    };
  }, []);

  // Intelligent scroll auto-hide for mobile floating capsule
  useEffect(() => {
    if (!autoHideDockEnabled) {
      setIsNavVisible(true);
      return;
    }

    const handleScroll = () => {
      const currentScrollY = window.scrollY || document.documentElement.scrollTop;
      const scrollDiff = currentScrollY - lastScrollY.current;

      if (currentScrollY < 32) {
        setIsNavVisible(true);
        lastScrollY.current = currentScrollY;
        return;
      }

      const windowHeight = window.innerHeight;
      const documentHeight = document.documentElement.scrollHeight;
      if (currentScrollY + windowHeight >= documentHeight - 40) {
        setIsNavVisible(true);
        lastScrollY.current = currentScrollY;
        return;
      }

      if (scrollDiff > 12) {
        setIsNavVisible(false);
      } else if (scrollDiff < -8) {
        setIsNavVisible(true);
      }

      lastScrollY.current = currentScrollY;
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [autoHideDockEnabled]);

  const navItems = [
    { id: 'dashboard', label: 'Visão Geral', icon: LayoutDashboard, color: 'bg-[#2F6BFF]' },
    { id: 'transactions', label: 'Transações', icon: ArrowLeftRight, color: 'bg-[#30D158]' },
    { id: 'goals', label: 'Metas', icon: Target, color: 'bg-[#FF9F0A]' },
    { id: 'company', label: 'Empresa', icon: Building2, color: 'bg-[#0EA5E9]' },
    { id: 'analytics', label: 'Insights IA', icon: Sparkles, color: 'bg-[#9D7BFF]' },
    { id: 'achievements', label: 'Conquistas', icon: Award, color: 'bg-[#EAB308]' },
    { id: 'profile', label: 'Meu Perfil', icon: User, color: 'bg-[#38BDF8]' },
    { id: 'settings', label: 'Ajustes', icon: Settings, color: 'bg-[#64748B]' },
  ];

  const handleResendVerification = async () => {
    if (auth?.currentUser) {
      try {
        await resendVerificationEmail(auth.currentUser);
        setVerificationSent(true);
        setTimeout(() => setVerificationSent(false), 5000);
      } catch (error) {
        console.error('Erro ao reenviar email', error);
      }
    }
  };

  const showVerificationWarning = !user.emailVerified && user.email;
  const shouldReduceEffects =
    settings.performance.highPerformanceMode || settings.visual.layoutMode === 'minimal';

  const avatarUrl =
    user.photoURL ||
    `https://ui-avatars.com/api/?name=${encodeURIComponent(user.displayName || 'User')}&background=2F6BFF&color=fff`;

  const mobileSheetPortal =
    typeof document !== 'undefined'
      ? createPortal(
          <AnimatePresence>
            {isMobileMenuOpen && (
              <div className="fixed inset-0 z-[70] md:hidden flex items-end justify-center">
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="oneui-modal-backdrop fixed inset-0 backdrop-blur-md"
                  style={{ backgroundColor: 'var(--app-backdrop)' }}
                />
                <motion.div
                  initial={{ y: '100%' }}
                  animate={{ y: 0 }}
                  exit={{ y: '100%' }}
                  transition={{ type: 'spring', damping: 28, stiffness: 320 }}
                  className="relative z-10 w-full rounded-t-[30px] p-5 pb-safe max-h-[85vh] overflow-y-auto shadow-2xl"
                  style={{
                    backgroundColor: 'var(--app-surface)',
                    borderTop: '1px solid var(--app-border-strong)',
                  }}
                >
                  <div
                    className="w-11 h-1.5 rounded-full mx-auto mb-4"
                    style={{ backgroundColor: 'var(--app-border-strong)' }}
                  />

                  <div className="flex items-center justify-between mb-4 px-1">
                    <div>
                      <h3 className="text-[18px] font-bold oneui-text tracking-tight">Navegação</h3>
                      <p className="text-[12px] oneui-text-muted">Acesse todas as áreas do Capitalyx</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsMobileMenuOpen(false)}
                      className="w-9 h-9 rounded-full flex items-center justify-center oneui-surface-2 oneui-text-secondary active:scale-95 transition-transform"
                      aria-label="Fechar menu"
                    >
                      <X size={17} />
                    </button>
                  </div>

                  <div className="oneui-surface-2 overflow-hidden oneui-divider mb-5">
                    {navItems.map((item) => {
                      const isActive = activeTab === item.id;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => {
                            handleTabSelect(item.id);
                            setIsMobileMenuOpen(false);
                          }}
                          className="w-full flex items-center justify-between px-4 py-3.5 min-h-[52px] oneui-hover transition-colors text-left"
                        >
                          <div className="flex items-center gap-3.5">
                            <div
                              className={`w-9 h-9 rounded-[12px] ${item.color} text-white flex items-center justify-center shadow-sm`}
                            >
                              <item.icon size={17} strokeWidth={2.2} />
                            </div>
                            <span
                              className={`text-[15px] ${
                                isActive ? 'font-bold oneui-text' : 'font-medium oneui-text-secondary'
                              }`}
                            >
                              {item.label}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            {isActive && (
                              <span
                                className="w-2 h-2 rounded-full"
                                style={{ backgroundColor: 'var(--app-accent)' }}
                              />
                            )}
                            <ChevronRight size={17} className="oneui-text-muted" />
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setIsMobileMenuOpen(false);
                      onLogout();
                    }}
                    className="w-full min-h-[48px] py-3 rounded-[18px] bg-[#FF453A]/12 border border-[#FF453A]/25 text-[#FF453A] font-semibold text-[15px] flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
                  >
                    <LogOut size={17} />
                    <span>Encerrar Sessão</span>
                  </button>
                </motion.div>
              </div>
            )}
          </AnimatePresence>,
          document.body
        )
      : null;

  return (
    <div
      className="min-h-screen w-full max-w-full flex flex-col md:flex-row overflow-x-hidden font-sans relative"
      style={{ backgroundColor: 'var(--app-bg)', color: 'var(--app-text)' }}
    >
      {/* One UI 9.0 Subtle Ambient Aura */}
      {!shouldReduceEffects && (
        <div
          className="fixed inset-0 pointer-events-none z-0 overflow-hidden transition-opacity duration-300"
          style={{ opacity: 'var(--app-glow-opacity)' as any }}
        >
          <div
            className="absolute -top-44 left-[12%] w-[540px] h-[540px] rounded-full blur-[150px]"
            style={{ background: 'radial-gradient(circle, var(--app-glow-1) 0%, transparent 72%)' }}
          />
          <div
            className="absolute top-[20%] -right-32 w-[460px] h-[460px] rounded-full blur-[150px]"
            style={{ background: 'radial-gradient(circle, var(--app-glow-2) 0%, transparent 72%)' }}
          />
          <div
            className="absolute -bottom-44 left-[35%] w-[480px] h-[480px] rounded-full blur-[150px]"
            style={{ background: 'radial-gradient(circle, var(--app-glow-3) 0%, transparent 72%)' }}
          />
        </div>
      )}

      {/* DESKTOP SIDEBAR */}
      <aside className="hidden md:flex w-64 lg:w-72 flex-col oneui-bar border-r shrink-0 h-screen sticky top-0 z-20 select-none">
        <div
          className="px-6 py-5 flex items-center gap-3"
          style={{ borderBottom: '1px solid var(--app-divider)' }}
        >
          <LogoIcon size={38} className="shrink-0 shadow-md" />
          <div className="min-w-0">
            <h1 className="text-[20px] font-extrabold tracking-tight oneui-text leading-tight">Capitalyx</h1>
            <p className="text-[12px] oneui-text-muted font-medium mt-0.5">Gestão Financeira</p>
          </div>
        </div>

        <div className="px-4 py-4">
          <button
            type="button"
            onClick={() => (onOpenTransaction ? onOpenTransaction() : setActiveTab('transactions'))}
            className="w-full py-3 px-4 rounded-[18px] oneui-accent-btn active:scale-[0.98] transition-all font-semibold text-[14px] flex items-center justify-center gap-2 shadow-md"
          >
            <Plus size={18} strokeWidth={2.5} />
            <span>Nova Transação</span>
          </button>
        </div>

        <div className="px-5 text-[11px] font-semibold oneui-text-muted uppercase tracking-wider mb-2">
          Menu Principal
        </div>

        <nav className="flex-1 px-3 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className="w-full flex items-center justify-between px-3 py-2.5 rounded-[16px] text-[14px] font-medium transition-all duration-150 active:scale-[0.99] oneui-hover"
                style={
                  isActive
                    ? {
                        backgroundColor: 'var(--app-accent-soft)',
                        border: '1px solid var(--app-border-strong)',
                      }
                    : { border: '1px solid transparent' }
                }
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-8 h-8 rounded-[11px] ${item.color} text-white flex items-center justify-center shadow-sm`}
                  >
                    <item.icon size={15} strokeWidth={2.3} />
                  </div>
                  <span className={isActive ? 'oneui-text font-semibold' : 'oneui-text-secondary'}>
                    {item.label}
                  </span>
                </div>
                {isActive && (
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: 'var(--app-accent)' }}
                  />
                )}
              </button>
            );
          })}
        </nav>

        {/* User Profile Footer */}
        <div className="p-3" style={{ borderTop: '1px solid var(--app-divider)' }}>
          <div
            className="flex items-center gap-3 p-2.5 rounded-[18px] oneui-hover cursor-pointer transition-colors"
            onClick={() => setActiveTab('profile')}
          >
            <div className="relative shrink-0">
              <img
                src={avatarUrl}
                alt="User"
                referrerPolicy="no-referrer"
                className="w-10 h-10 rounded-full object-cover shadow-sm"
                style={{ border: '1px solid var(--app-border-strong)' }}
              />
              {user.emailVerified && (
                <div
                  className="absolute -bottom-0.5 -right-0.5 bg-[#30D158] text-white rounded-full p-0.5"
                  style={{ border: '2px solid var(--app-surface)' }}
                >
                  <CheckCircle2 size={10} strokeWidth={3} />
                </div>
              )}
            </div>
            <div className="flex-1 overflow-hidden min-w-0">
              <p className="text-[14px] font-semibold oneui-text truncate leading-tight">
                {user.displayName || 'Usuário'}
              </p>
              <p className="text-[12px] oneui-text-muted truncate">{user.email || 'Conta Capitalyx'}</p>
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onLogout();
              }}
              title="Sair"
              className="p-2 oneui-text-muted hover:text-[#FF453A] hover:bg-[#FF453A]/10 rounded-[12px] transition-colors shrink-0"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>

      {/* MOBILE TOP BAR (Safe-area aware for Android status/taskbar & notch) */}
      <header className="md:hidden fixed top-0 left-0 right-0 z-30 oneui-bar border-b pt-safe-header px-4 gpu-accelerated">
        <div className="h-14 w-full flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <LogoIcon size={28} className="shrink-0 shadow-sm" />
            <h1 className="text-[19px] font-extrabold tracking-tight oneui-text leading-none">Capitalyx</h1>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('profile')}
              className="w-9 h-9 rounded-full overflow-hidden active:scale-95 transition-transform"
              style={{ border: '1px solid var(--app-border-strong)' }}
              title="Meu Perfil"
            >
              <img
                src={avatarUrl}
                alt="Perfil"
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
              />
            </button>
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="w-9 h-9 rounded-full oneui-surface-2 flex items-center justify-center oneui-text active:scale-95 transition-transform"
              title="Menu"
              aria-label="Abrir navegação"
            >
              {isMobileMenuOpen ? <X size={16} /> : <SlidersHorizontal size={15} />}
            </button>
          </div>
        </div>
      </header>

      {/* PORTAL MOBILE SHEET MENU */}
      {mobileSheetPortal}

      {/* MAIN VIEWPORT */}
      <main className="flex-1 w-full max-w-full min-w-0 pt-[calc(4.35rem+env(safe-area-inset-top,0px))] pb-32 md:pt-7 md:pb-12 relative flex flex-col z-10 overflow-x-hidden">
        <AnimatePresence>
          {showVerificationWarning && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="px-3 sm:px-6 md:px-8 mb-4"
            >
              <div className="max-w-7xl mx-auto rounded-[20px] bg-[#FF9F0A]/12 border border-[#FF9F0A]/25 px-4 py-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <MailWarning className="text-[#FF9F0A] shrink-0" size={18} />
                  <p className="text-[13px] oneui-text">
                    Confirme seu e-mail ({user.email}) para ativar todos os recursos de segurança.
                  </p>
                </div>
                {verificationSent ? (
                  <span className="text-[12px] bg-[#30D158]/20 text-[#30D158] border border-[#30D158]/30 px-3 py-1 rounded-full font-semibold">
                    Link enviado
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={handleResendVerification}
                    className="text-[12px] bg-[#FF9F0A] hover:brightness-110 text-black font-semibold px-3.5 py-1.5 rounded-full transition-all active:scale-95 whitespace-nowrap"
                  >
                    Reenviar confirmação
                  </button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="px-3.5 sm:px-6 md:px-8 w-full max-w-7xl mx-auto flex-1 min-w-0">
          {children}
        </div>
      </main>

      {/* ONE UI 9.0 FLOATING TRANSLUCENT CAPSULE DOCK (MOBILE) */}
      <nav
        aria-label="Navegação inferior"
        className={`md:hidden fixed left-1/2 -translate-x-1/2 z-40 w-[calc(100%-1.5rem)] max-w-[410px] rounded-full oneui-dock px-2 py-1.5 select-none transition-all duration-300 ease-out ${
          shouldHideDock
            ? 'translate-y-[170%] opacity-0 pointer-events-none scale-95'
            : 'translate-y-0 opacity-100 pointer-events-auto scale-100'
        }`}
        style={{ bottom: 'max(0.85rem, env(safe-area-inset-bottom, 0px))' }}
      >
        <div className="grid grid-cols-5 items-center gap-0.5">
          {/* Início */}
          <button
            type="button"
            onClick={() => handleTabSelect('dashboard')}
            className="flex flex-col items-center justify-center min-h-[48px] rounded-full transition-all active:scale-95"
            style={
              activeTab === 'dashboard'
                ? { backgroundColor: 'var(--app-accent-soft)', color: 'var(--app-accent)' }
                : undefined
            }
          >
            <LayoutDashboard
              size={19}
              strokeWidth={activeTab === 'dashboard' ? 2.4 : 1.9}
              className={activeTab === 'dashboard' ? '' : 'oneui-text-muted'}
            />
            <span
              className={`text-[10px] mt-0.5 leading-none ${
                activeTab === 'dashboard' ? 'font-bold' : 'font-medium oneui-text-muted'
              }`}
            >
              Início
            </span>
          </button>

          {/* Transações */}
          <button
            type="button"
            onClick={() => handleTabSelect('transactions')}
            className="flex flex-col items-center justify-center min-h-[48px] rounded-full transition-all active:scale-95"
            style={
              activeTab === 'transactions'
                ? { backgroundColor: 'rgba(48, 209, 88, 0.14)', color: '#30D158' }
                : undefined
            }
          >
            <ArrowLeftRight
              size={19}
              strokeWidth={activeTab === 'transactions' ? 2.4 : 1.9}
              className={activeTab === 'transactions' ? '' : 'oneui-text-muted'}
            />
            <span
              className={`text-[10px] mt-0.5 leading-none ${
                activeTab === 'transactions' ? 'font-bold' : 'font-medium oneui-text-muted'
              }`}
            >
              Extrato
            </span>
          </button>

          {/* Center Quick Add Pill */}
          <div className="flex items-center justify-center">
            <button
              type="button"
              onClick={() => {
                triggerHaptic('medium');
                if (onOpenTransaction) onOpenTransaction();
                else setActiveTab('transactions');
              }}
              className="w-12 h-12 rounded-full oneui-accent-btn flex items-center justify-center shadow-lg active:scale-90 transition-transform"
              title="Nova Transação"
              aria-label="Nova Transação"
            >
              <Plus size={22} strokeWidth={2.7} />
            </button>
          </div>

          {/* Metas */}
          <button
            type="button"
            onClick={() => handleTabSelect('goals')}
            className="flex flex-col items-center justify-center min-h-[48px] rounded-full transition-all active:scale-95"
            style={
              activeTab === 'goals'
                ? { backgroundColor: 'rgba(255, 159, 10, 0.15)', color: '#FF9F0A' }
                : undefined
            }
          >
            <Target
              size={19}
              strokeWidth={activeTab === 'goals' ? 2.4 : 1.9}
              className={activeTab === 'goals' ? '' : 'oneui-text-muted'}
            />
            <span
              className={`text-[10px] mt-0.5 leading-none ${
                activeTab === 'goals' ? 'font-bold' : 'font-medium oneui-text-muted'
              }`}
            >
              Metas
            </span>
          </button>

          {/* Ajustes */}
          <button
            type="button"
            onClick={() => handleTabSelect('settings')}
            className="flex flex-col items-center justify-center min-h-[48px] rounded-full transition-all active:scale-95"
            style={
              activeTab === 'settings'
                ? { backgroundColor: 'var(--app-accent-soft)', color: 'var(--app-accent)' }
                : undefined
            }
          >
            <Settings
              size={19}
              strokeWidth={activeTab === 'settings' ? 2.4 : 1.9}
              className={activeTab === 'settings' ? '' : 'oneui-text-muted'}
            />
            <span
              className={`text-[10px] mt-0.5 leading-none ${
                activeTab === 'settings' ? 'font-bold' : 'font-medium oneui-text-muted'
              }`}
            >
              Ajustes
            </span>
          </button>
        </div>
      </nav>
    </div>
  );
};

export default Layout;
