import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  auth,
  firebaseConfig,
  onAuthStateChanged,
  firebaseInitializationError,
  loginWithGoogle,
  loginWithGithub,
  signInWithNativeOAuthTokens,
  addTransaction as firebaseAddTx,
  deleteTransaction as firebaseDeleteTx,
  subscribeToTransactions,
  registerWithEmail,
  loginWithEmail,
  resetPassword,
  subscribeToStats,
  addGoal as firebaseAddGoal,
  updateGoal as firebaseUpdateGoal,
  deleteGoal as firebaseDeleteGoal,
  subscribeToGoals,
  markAIUsage,
  getUserProfileData,
  logout as firebaseLogout,
  saveUserProfileToDB,
  setAuthPersistence,
} from './services/firebase';
import {
  UserProfile,
  Transaction,
  TransactionType,
  Achievement,
  UserStats,
  FinancialGoal,
  AIAnalysisResult,
  AppSettings,
  ToastMessage,
} from './types';
import { generateFinancialInsights } from './services/geminiService';
import {
  exitAndroidApp,
  isNativePlatform,
  openExternalSocialAuth,
  subscribeNativeBackButton,
  subscribeNativeDeepLinkAuth,
  syncNativeSystemBars,
} from './services/nativeAndroid';
import {
  Github,
  Chrome,
  Plus,
  AlertTriangle,
  Mail,
  Lock,
  ArrowLeft,
  X,
  Target,
  WifiOff,
  ChevronRight,
} from 'lucide-react';
import { motion, AnimatePresence, MotionConfig } from 'framer-motion';

// Import Components
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import TransactionList from './components/TransactionList';
import TransactionForm from './components/TransactionForm';
import AIInsights from './components/AIInsights';
import Achievements from './components/Achievements';
import Goals from './components/Goals';
import Settings from './components/Settings';
import Profile from './components/Profile';
import MobileAuthBridge from './components/MobileAuthBridge';
import { LogoIcon } from './components/LogoIcon';

// --- Constants ---
const DEFAULT_SETTINGS: AppSettings = {
  performance: {
    fps: 'medium',
    highPerformanceMode: false,
  },
  visual: {
    theme: 'default',
    layoutMode: 'default',
    scale: 1.0,
    autoHideDock: true,
  },
  account: {
    autoLogin: true,
  },
};

const loadInitialSettings = (): AppSettings => {
  try {
    const saved = localStorage.getItem('capitalyx_settings');
    if (!saved) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(saved);
    return {
      performance: {
        fps: parsed?.performance?.fps || DEFAULT_SETTINGS.performance.fps,
        highPerformanceMode: Boolean(parsed?.performance?.highPerformanceMode),
      },
      visual: {
        theme: parsed?.visual?.theme || DEFAULT_SETTINGS.visual.theme,
        layoutMode: parsed?.visual?.layoutMode || DEFAULT_SETTINGS.visual.layoutMode,
        scale:
          typeof parsed?.visual?.scale === 'number' &&
          parsed.visual.scale >= 0.8 &&
          parsed.visual.scale <= 1.2
            ? parsed.visual.scale
            : DEFAULT_SETTINGS.visual.scale,
        autoHideDock:
          typeof parsed?.visual?.autoHideDock === 'boolean'
            ? parsed.visual.autoHideDock
            : DEFAULT_SETTINGS.visual.autoHideDock,
      },
      account: {
        autoLogin:
          typeof parsed?.account?.autoLogin === 'boolean'
            ? parsed.account.autoLogin
            : DEFAULT_SETTINGS.account.autoLogin,
      },
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
};

type AuthMode = 'login' | 'register' | 'forgot-pass';

// --- Custom Hooks ---

const useToast = () => {
  const [toast, setToast] = useState<ToastMessage | null>(null);

  const showToast = useCallback((message: string, type: ToastMessage['type'] = 'info') => {
    const id = Date.now().toString();
    setToast({ id, message, type });
    setTimeout(() => {
      setToast((current) => (current?.id === id ? null : current));
    }, 4500);
  }, []);

  const closeToast = useCallback(() => setToast(null), []);

  return { toast, showToast, closeToast };
};

const useAuthSystem = (showToast: (msg: string, type?: ToastMessage['type']) => void) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [authMode, setAuthMode] = useState<AuthMode>('login');
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    if (!auth) {
      setLoading(false);
      return;
    }

    let isMounted = true;
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!isMounted) return;

      if (firebaseUser) {
        const baseUser: UserProfile = {
          uid: firebaseUser.uid,
          displayName: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'Usuário',
          email: firebaseUser.email || null,
          emailVerified: firebaseUser.emailVerified,
          photoURL: firebaseUser.photoURL || null,
        };

        try {
          await saveUserProfileToDB(firebaseUser);
          const dbProfile = await getUserProfileData(firebaseUser.uid);
          if (isMounted) {
            setUser(dbProfile ? { ...baseUser, ...dbProfile } : baseUser);
          }
        } catch (err) {
          console.error('Erro ao sincronizar perfil inicial:', err);
          if (isMounted) {
            setUser(baseUser);
          }
        }
      } else {
        setUser(null);
      }

      if (isMounted) {
        setLoading(false);
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  const formatAuthError = (err: any): string => {
    const code = err?.code || '';
    const message = err?.message || '';
    if (code === 'auth/invalid-credential' || message.includes('invalid-credential')) {
      return 'E-mail ou senha incorretos. Se ainda não possui conta neste projeto, clique na aba "Cadastrar".';
    }
    if (code === 'auth/user-not-found' || message.includes('user-not-found')) {
      return 'Usuário não cadastrado. Crie uma conta para acessar.';
    }
    if (code === 'auth/wrong-password' || message.includes('wrong-password')) {
      return 'Senha incorreta. Tente novamente ou recupere sua senha.';
    }
    if (code === 'auth/email-already-in-use' || message.includes('email-already-in-use')) {
      return 'Este e-mail já está cadastrado. Faça login na sua conta existente.';
    }
    if (code === 'auth/weak-password' || message.includes('weak-password')) {
      return 'A senha deve conter pelo menos 6 caracteres.';
    }
    if (code === 'auth/invalid-email' || message.includes('invalid-email')) {
      return 'Formato de e-mail inválido.';
    }
    if (code === 'auth/popup-closed-by-user') {
      return 'Janela de autenticação fechada antes da conclusão.';
    }
    if (code === 'auth/popup-blocked') {
      return 'O navegador bloqueou o popup de login. Permita popups e tente novamente.';
    }
    if (code === 'auth/account-exists-with-different-credential') {
      return 'Já existe uma conta com este e-mail vinculada a outro provedor de login.';
    }
    if (code === 'auth/too-many-requests') {
      return 'Muitas tentativas sem sucesso. Aguarde alguns instantes.';
    }
    if (code === 'auth/operation-not-allowed' || message.includes('operation-not-allowed')) {
      return `Este método de login precisa ser ativado no Firebase Console (projeto ${firebaseConfig.projectId} > Authentication > Sign-in method). O login com Google já vem pronto por padrão.`;
    }
    return message || 'Erro na autenticação. Verifique suas credenciais.';
  };

  const loginEmail = useCallback(async (email: string, pass: string) => {
    setProcessing(true);
    setError(null);
    try {
      await loginWithEmail(email, pass);
    } catch (err: any) {
      console.error('Login Error:', err);
      setError(formatAuthError(err));
    } finally {
      setProcessing(false);
    }
  }, []);

  const registerEmail = useCallback(
    async (email: string, pass: string) => {
      setProcessing(true);
      setError(null);
      try {
        await registerWithEmail(email, pass);
        showToast('Conta criada com sucesso!', 'success');
      } catch (err: any) {
        console.error('Register Error:', err);
        setError(formatAuthError(err));
      } finally {
        setProcessing(false);
      }
    },
    [showToast]
  );

  const sendPasswordReset = useCallback(async (email: string) => {
    setProcessing(true);
    setError(null);
    try {
      await resetPassword(email);
      return true;
    } catch (err: any) {
      setError(formatAuthError(err));
      return false;
    } finally {
      setProcessing(false);
    }
  }, []);

  const loginSocial = useCallback(async (provider: 'google' | 'github') => {
    setProcessing(true);
    setError(null);
    try {
      if (isNativePlatform()) {
        await openExternalSocialAuth(provider);
        showToast(
          `Conclua o login com ${provider === 'google' ? 'Google' : 'GitHub'} no navegador para voltar ao app.`,
          'info'
        );
        return;
      }
      if (provider === 'google') await loginWithGoogle();
      if (provider === 'github') await loginWithGithub();
    } catch (err: any) {
      setError(formatAuthError(err));
    } finally {
      setProcessing(false);
    }
  }, [showToast]);

  // Listen for Android Deep Link OAuth callback (com.capitalyx.finance://auth#...)
  useEffect(() => {
    const unsubscribe = subscribeNativeDeepLinkAuth(async (payload) => {
      if (payload.error) {
        setError(payload.error);
        showToast('Não foi possível concluir o login externo.', 'error');
        return;
      }
      if (!payload.provider) return;
      setProcessing(true);
      setError(null);
      try {
        await signInWithNativeOAuthTokens({
          provider: payload.provider,
          idToken: payload.idToken,
          accessToken: payload.accessToken,
        });
        showToast('Login concluído com sucesso!', 'success');
      } catch (err: any) {
        setError(formatAuthError(err));
        showToast('Erro ao validar credencial no aplicativo.', 'error');
      } finally {
        setProcessing(false);
      }
    });
    return unsubscribe;
  }, [showToast]);

  const performLogout = useCallback(async () => {
    await firebaseLogout();
  }, []);

  return {
    user,
    setUser,
    loading,
    authMode,
    setAuthMode,
    error,
    setError,
    processing,
    loginSocial,
    loginEmail,
    registerEmail,
    sendPasswordReset,
    performLogout,
  };
};

const useFinancialData = (
  user: UserProfile | null,
  showToast: (msg: string, type?: ToastMessage['type']) => void
) => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [goals, setGoals] = useState<FinancialGoal[]>([]);
  const [stats, setStats] = useState<UserStats>({});

  useEffect(() => {
    if (user?.uid) {
      const handleListenerError = () => {
        showToast('Erro de sincronização com o banco de dados. Verifique sua conexão.', 'error');
      };
      const unsubTx = subscribeToTransactions(user.uid, setTransactions, handleListenerError);
      const unsubGoals = subscribeToGoals(user.uid, setGoals, handleListenerError);
      const unsubStats = subscribeToStats(user.uid, setStats, handleListenerError);
      return () => {
        unsubTx();
        unsubGoals();
        unsubStats();
      };
    } else {
      setTransactions([]);
      setGoals([]);
      setStats({});
    }
  }, [user?.uid, showToast]);

  const addTx = useCallback(
    async (data: Omit<Transaction, 'id' | 'createdAt'>) => {
      if (!user) return;
      await firebaseAddTx(user.uid, data);
    },
    [user]
  );

  const removeTx = useCallback(
    async (id: string) => {
      if (!user) return;
      try {
        await firebaseDeleteTx(user.uid, id);
        showToast('Transação removida.', 'info');
      } catch {
        showToast('Não foi possível remover a transação.', 'error');
      }
    },
    [user, showToast]
  );

  const addGoal = useCallback(
    async (data: Omit<FinancialGoal, 'id'>) => {
      if (!user) return;
      try {
        await firebaseAddGoal(user.uid, data);
        showToast('Meta adicionada com sucesso!', 'success');
      } catch (err: any) {
        showToast(
          err?.message?.startsWith('{')
            ? 'Erro ao salvar meta no banco de dados.'
            : err?.message || 'Erro ao criar meta.',
          'error'
        );
        throw err;
      }
    },
    [user, showToast]
  );

  const updateGoal = useCallback(
    async (id: string, updates: Partial<FinancialGoal>) => {
      if (!user) return;
      try {
        await firebaseUpdateGoal(user.uid, id, {
          currentAmount: updates.currentAmount,
          isCompleted: updates.isCompleted,
        });
        if (updates.isCompleted) {
          showToast('Parabéns! Meta concluída!', 'success');
        }
      } catch {
        showToast('Não foi possível atualizar a meta.', 'error');
      }
    },
    [user, showToast]
  );

  const removeGoal = useCallback(
    async (id: string) => {
      if (!user) return;
      try {
        await firebaseDeleteGoal(user.uid, id);
        showToast('Meta removida.', 'info');
      } catch {
        showToast('Não foi possível remover a meta.', 'error');
      }
    },
    [user, showToast]
  );

  return { transactions, goals, stats, addTx, removeTx, addGoal, updateGoal, removeGoal };
};

// --- Main Component ---

function App() {
  const mobileAuthParams = useMemo(() => {
    if (typeof window === 'undefined' || isNativePlatform()) return null;
    const params = new URLSearchParams(window.location.search);
    const provider = params.get('mobileAuth');
    if (provider === 'google' || provider === 'github') {
      return {
        provider,
        scheme: params.get('scheme') || undefined,
      };
    }
    return null;
  }, []);

  if (mobileAuthParams) {
    return (
      <MobileAuthBridge
        provider={mobileAuthParams.provider}
        scheme={mobileAuthParams.scheme}
      />
    );
  }

  if (firebaseInitializationError || !auth) {
    return (
      <div
        className="min-h-screen flex items-center justify-center p-6 text-center font-sans"
        style={{ backgroundColor: 'var(--app-bg)', color: 'var(--app-text)' }}
      >
        <div className="max-w-md oneui-card p-8">
          <div className="bg-[#FF453A]/15 p-4 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-6 border border-[#FF453A]/25">
            <WifiOff className="text-[#FF453A]" size={36} />
          </div>
          <h1 className="text-2xl font-bold mb-3 oneui-text">Sistema Indisponível</h1>
          <p className="oneui-text-secondary mb-6 leading-relaxed text-[14px]">
            Não foi possível conectar aos servidores do Firebase. Verifique a configuração do projeto e tente novamente.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="oneui-accent-btn px-6 py-3 rounded-[16px] font-bold w-full transition-all"
          >
            Recarregar Aplicação
          </button>
        </div>
      </div>
    );
  }

  const { toast, showToast, closeToast } = useToast();
  const {
    user,
    loading: authLoading,
    authMode,
    setAuthMode,
    error: authError,
    setError: setAuthError,
    processing,
    loginSocial,
    loginEmail,
    registerEmail,
    performLogout,
    setUser,
    sendPasswordReset,
  } = useAuthSystem(showToast);

  const { transactions, goals, stats: userStats, addTx, removeTx, addGoal, updateGoal, removeGoal } =
    useFinancialData(user, showToast);

  // App State
  const [activeTab, setActiveTab] = useState('dashboard');
  const [aiInsight, setAiInsight] = useState<AIAnalysisResult | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [txInitialType, setTxInitialType] = useState<TransactionType>(TransactionType.EXPENSE);
  const [isGoalFormOpen, setIsGoalFormOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [settings, setSettings] = useState<AppSettings>(loadInitialSettings);
  const lastBackPressRef = useRef<number>(0);

  // Apply Visual & Performance Settings to Root Document
  useEffect(() => {
    try {
      localStorage.setItem('capitalyx_settings', JSON.stringify(settings));
    } catch {
      // Ignore storage quota errors
    }

    const root = document.documentElement;
    const theme = settings.visual.theme === 'ios' ? 'default' : settings.visual.theme;
    const layout = settings.visual.layoutMode === 'ios' ? 'default' : settings.visual.layoutMode;

    root.dataset.theme = theme;
    root.dataset.layout = layout;
    root.dataset.perf = settings.performance.highPerformanceMode ? 'high' : 'std';
    root.dataset.fps = settings.performance.fps;

    if (theme === 'oneui-light') {
      root.classList.remove('dark');
      root.classList.add('light');
    } else {
      root.classList.remove('light');
      root.classList.add('dark');
    }

    root.style.fontSize = `${Math.round(settings.visual.scale * 1600) / 100}px`;

    const themeColors: Record<string, string> = {
      default: '#0c0c12',
      'oneui-light': '#f3f4f9',
      'ios-midnight': '#000000',
      cyberpunk: '#0d0a18',
      ocean: '#06101c',
      sunset: '#140c0c',
    };
    let metaTheme = document.querySelector('meta[name="theme-color"]');
    if (!metaTheme) {
      metaTheme = document.createElement('meta');
      metaTheme.setAttribute('name', 'theme-color');
      document.head.appendChild(metaTheme);
    }
    metaTheme.setAttribute('content', themeColors[theme] || '#0c0c12');
    syncNativeSystemBars(theme);
  }, [settings]);

  // Android Hardware Back Button Cascade
  useEffect(() => {
    const unsubscribe = subscribeNativeBackButton(() => {
      if (isFormOpen) {
        setIsFormOpen(false);
        return;
      }
      if (isGoalFormOpen) {
        setIsGoalFormOpen(false);
        return;
      }
      if (isMobileMenuOpen) {
        setIsMobileMenuOpen(false);
        return;
      }
      if (user && activeTab !== 'dashboard') {
        setActiveTab('dashboard');
        return;
      }
      const now = Date.now();
      if (now - lastBackPressRef.current < 2000) {
        exitAndroidApp();
      } else {
        lastBackPressRef.current = now;
        showToast('Pressione Voltar novamente para sair do Capitalyx.', 'info');
      }
    });
    return unsubscribe;
  }, [isFormOpen, isGoalFormOpen, isMobileMenuOpen, user, activeTab, showToast]);

  // Sync Auto-Login with Firebase Auth Persistence
  useEffect(() => {
    setAuthPersistence(settings.account.autoLogin).catch((err) => {
      console.error('Erro ao atualizar persistência de autenticação:', err);
    });
  }, [settings.account.autoLogin]);

  // Lock body scroll & Escape dismiss for Goal Modal
  useEffect(() => {
    if (!isGoalFormOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsGoalFormOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);

    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [isGoalFormOpen]);

  // Auth Form Inputs
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Goal Form Inputs
  const [newGoalData, setNewGoalData] = useState({ title: '', amount: '', date: '' });

  const openTransactionModal = useCallback((initialType: TransactionType = TransactionType.EXPENSE) => {
    setTxInitialType(initialType);
    setIsFormOpen(true);
  }, []);

  const handleResetSettings = useCallback(() => {
    setSettings(DEFAULT_SETTINGS);
    showToast('Configurações restauradas para o padrão One UI 9.', 'success');
  }, [showToast]);

  // --- Shared AI Analysis Logic ---
  const handleGenerateAI = useCallback(async () => {
    if (!user) return;
    if (transactions.length === 0 && goals.length === 0) {
      const msg = 'Adicione ao menos uma transação ou meta antes de gerar o diagnóstico IA.';
      setAiError(msg);
      showToast(msg, 'warning');
      return;
    }

    setAiLoading(true);
    setAiError(null);
    try {
      const result = await generateFinancialInsights(transactions, goals);
      setAiInsight(result);
      markAIUsage(user.uid).catch((err) => console.error('Falha ao registrar uso da IA:', err));
      showToast('Diagnóstico financeiro atualizado!', 'success');
    } catch (err: any) {
      const msg = err?.message || 'Não foi possível gerar a análise de IA.';
      console.error('AI Gen failed:', err);
      setAiError(msg);
      showToast(msg, 'error');
    } finally {
      setAiLoading(false);
    }
  }, [user, transactions, goals, showToast]);

  // --- Achievements ---
  const achievements = useMemo<Achievement[]>(
    () => [
      {
        id: 'first_expense',
        title: 'Poupador Iniciante',
        description: 'Adicione sua primeira despesa no aplicativo.',
        iconName: 'FirstExpense',
        isUnlocked: transactions.some((t) => t.type === TransactionType.EXPENSE),
      },
      {
        id: 'first_income',
        title: 'Renda Extra',
        description: 'Adicione sua primeira fonte de renda.',
        iconName: 'FirstIncome',
        isUnlocked: transactions.some((t) => t.type === TransactionType.INCOME),
      },
      {
        id: 'first_ai',
        title: 'Visão do Futuro',
        description: 'Gere seu primeiro relatório de inteligência artificial.',
        iconName: 'FirstAI',
        isUnlocked: Boolean(userStats.hasUsedAI),
      },
      {
        id: 'data_master',
        title: 'Mestre dos Dados',
        description: 'Acumule mais de 10 transações na plataforma.',
        iconName: 'DataMaster',
        isUnlocked: transactions.length >= 10,
      },
      {
        id: 'saver_king',
        title: 'Grande Poupador',
        description: 'Tenha mais entradas do que saídas registradas.',
        iconName: 'Saver',
        isUnlocked:
          transactions.length > 5 &&
          transactions.filter((t) => t.type === TransactionType.INCOME).length >
            transactions.filter((t) => t.type === TransactionType.EXPENSE).length,
      },
    ],
    [transactions, userStats]
  );

  // --- Form Handlers ---
  const handleTransactionSubmit = useCallback(
    async (data: {
      description: string;
      amount: number;
      type: TransactionType;
      category: string;
      date: string;
    }) => {
      try {
        await addTx(data);
        showToast('Transação adicionada!', 'success');
      } catch (err: any) {
        console.error('Erro ao salvar transação:', err);
        showToast(
          err?.message?.startsWith('{')
            ? 'Erro ao salvar transação no banco de dados.'
            : err?.message || 'Erro ao adicionar transação.',
          'error'
        );
        throw err;
      }
    },
    [addTx, showToast]
  );

  const handleGoalSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const parsedAmount = parseFloat(newGoalData.amount);
      if (!newGoalData.title.trim() || !Number.isFinite(parsedAmount) || parsedAmount <= 0 || !newGoalData.date) {
        showToast('Preencha título, valor alvo maior que zero e prazo válido.', 'warning');
        return;
      }
      try {
        await addGoal({
          title: newGoalData.title.trim(),
          targetAmount: parsedAmount,
          currentAmount: 0,
          deadline: newGoalData.date,
          isAI: false,
          isCompleted: false,
        });
        setIsGoalFormOpen(false);
        setNewGoalData({ title: '', amount: '', date: '' });
      } catch {
        // Error toast already displayed by addGoal
      }
    },
    [newGoalData, addGoal, showToast]
  );

  const handleLogout = useCallback(() => {
    performLogout();
    setActiveTab('dashboard');
    setAiInsight(null);
    setAiError(null);
  }, [performLogout]);

  const motionConfig = useMemo(() => {
    if (settings.performance.fps === 'low') {
      return { reducedMotion: 'always' as const, transition: { duration: 0 } };
    }
    if (settings.performance.fps === 'high') {
      return { transition: { type: 'spring' as const, stiffness: 460, damping: 32, mass: 0.6 } };
    }
    return { transition: { type: 'spring' as const, stiffness: 220, damping: 24 } };
  }, [settings.performance.fps]);

  if (authLoading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ backgroundColor: 'var(--app-bg)', color: 'var(--app-text)' }}
      >
        <div className="flex flex-col items-center gap-4">
          <div
            className="w-11 h-11 border-[3.5px] border-t-transparent rounded-full animate-spin"
            style={{ borderColor: 'var(--app-accent)', borderTopColor: 'transparent' }}
          />
          <p className="oneui-text-secondary font-medium text-[14px]">Carregando Capitalyx...</p>
        </div>
      </div>
    );
  }

  // --- Auth Screens ---
  if (!user) {
    return (
      <div
        className="min-h-[100dvh] w-full max-w-full flex flex-col items-center justify-center p-4 sm:p-6 relative overflow-y-auto font-sans"
        style={{ backgroundColor: 'var(--app-bg)', color: 'var(--app-text)' }}
      >
        <div
          className="fixed -top-32 -left-24 w-[520px] h-[520px] rounded-full blur-[150px] pointer-events-none"
          style={{ background: 'radial-gradient(circle, var(--app-glow-1) 0%, transparent 72%)' }}
        />
        <div
          className="fixed -bottom-32 -right-24 w-[520px] h-[520px] rounded-full blur-[150px] pointer-events-none"
          style={{ background: 'radial-gradient(circle, var(--app-glow-2) 0%, transparent 72%)' }}
        />

        <div className="z-10 w-full max-w-md oneui-card p-6 sm:p-8">
          <div className="flex flex-col mb-6 text-center">
            <motion.div
              initial={{ scale: 0.92, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.35 }}
              className="w-14 h-14 bg-gradient-to-tr from-[#2F6BFF] via-[#7C5CFF] to-[#30D158] rounded-[18px] p-0.5 shadow-lg mb-4 flex items-center justify-center mx-auto"
            >
              <div
                className="w-full h-full rounded-[16px] flex items-center justify-center"
                style={{ backgroundColor: 'var(--app-surface)' }}
              >
                <LogoIcon size={30} className="oneui-text" />
              </div>
            </motion.div>
            <h1 className="text-2xl sm:text-3xl font-extrabold oneui-text tracking-tight mb-1">
              {authMode === 'login'
                ? 'Bem-vindo'
                : authMode === 'register'
                ? 'Criar Conta'
                : 'Recuperar Acesso'}
            </h1>
            <p className="oneui-text-secondary text-[14px]">Capitalyx · Gestão Financeira Inteligente</p>
          </div>

          <div className="w-full">
            <AnimatePresence mode="wait">
              {(authMode === 'login' || authMode === 'register') && (
                <motion.div
                  key="email-auth"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="space-y-4"
                >
                  <div className="oneui-surface-2 p-1 rounded-[16px] flex mb-4">
                    <button
                      type="button"
                      onClick={() => {
                        setAuthMode('login');
                        setAuthError(null);
                      }}
                      className={`flex-1 min-h-[40px] py-1.5 text-[13px] font-semibold rounded-[12px] transition-all ${
                        authMode === 'login' ? 'oneui-accent-btn shadow-sm' : 'oneui-text-secondary'
                      }`}
                    >
                      Entrar
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setAuthMode('register');
                        setAuthError(null);
                      }}
                      className={`flex-1 min-h-[40px] py-1.5 text-[13px] font-semibold rounded-[12px] transition-all ${
                        authMode === 'register' ? 'oneui-accent-btn shadow-sm' : 'oneui-text-secondary'
                      }`}
                    >
                      Cadastrar
                    </button>
                  </div>

                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (authMode === 'login') loginEmail(email, password);
                      else registerEmail(email, password);
                    }}
                    className="space-y-4"
                  >
                    <div className="oneui-surface-2 oneui-divider overflow-hidden">
                      <div className="relative">
                        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 oneui-text-muted" size={17} />
                        <input
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          className="w-full bg-transparent py-3.5 pl-11 pr-4 text-[15px] oneui-text placeholder:opacity-45 focus:outline-none"
                          placeholder="E-mail"
                          required
                        />
                      </div>
                      <div className="relative">
                        <Lock className="absolute left-4 top-1/2 -translate-y-1/2 oneui-text-muted" size={17} />
                        <input
                          type="password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          className="w-full bg-transparent py-3.5 pl-11 pr-4 text-[15px] oneui-text placeholder:opacity-45 focus:outline-none"
                          placeholder="Senha"
                          required
                          minLength={6}
                        />
                      </div>
                    </div>

                    {authMode === 'login' && (
                      <div className="flex justify-end">
                        <button
                          type="button"
                          onClick={() => {
                            setAuthMode('forgot-pass');
                            setAuthError(null);
                          }}
                          className="text-[13px] hover:underline font-medium transition-colors"
                          style={{ color: 'var(--app-accent)' }}
                        >
                          Esqueceu a senha?
                        </button>
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={processing}
                      className="w-full oneui-accent-btn font-semibold text-[15px] py-3.5 rounded-[18px] transition-all active:scale-[0.98] flex items-center justify-center gap-2 shadow-md disabled:opacity-60"
                    >
                      {processing ? (
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      ) : authMode === 'login' ? (
                        'Entrar'
                      ) : (
                        'Criar Conta'
                      )}
                    </button>
                  </form>

                  {/* Social Login Options */}
                  <div className="oneui-surface-2 oneui-divider overflow-hidden mt-4">
                    <button
                      type="button"
                      disabled={processing}
                      onClick={() => loginSocial('google')}
                      className="w-full flex items-center justify-between p-3.5 oneui-hover transition-colors disabled:opacity-60"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-[10px] bg-red-500/15 flex items-center justify-center">
                          <Chrome size={16} className="text-red-500" />
                        </div>
                        <span className="text-[14px] oneui-text font-medium">Continuar com Google</span>
                      </div>
                      <ChevronRight size={16} className="oneui-text-muted" />
                    </button>
                    <button
                      type="button"
                      disabled={processing}
                      onClick={() => loginSocial('github')}
                      className="w-full flex items-center justify-between p-3.5 oneui-hover transition-colors disabled:opacity-60"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className="w-8 h-8 rounded-[10px] flex items-center justify-center"
                          style={{ backgroundColor: 'var(--app-surface-3)' }}
                        >
                          <Github size={16} className="oneui-text" />
                        </div>
                        <span className="text-[14px] oneui-text font-medium">Continuar com GitHub</span>
                      </div>
                      <ChevronRight size={16} className="oneui-text-muted" />
                    </button>
                  </div>
                  {isNativePlatform() && (
                    <p className="text-[11px] oneui-text-muted text-center px-2 pt-1 leading-relaxed">
                      E-mail e senha funcionam diretamente no app. Google e GitHub abrem o navegador seguro e retornam automaticamente.
                    </p>
                  )}
                </motion.div>
              )}

              {authMode === 'forgot-pass' && (
                <motion.div
                  key="forgot-auth"
                  initial={{ opacity: 0, x: 16 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -16 }}
                  className="space-y-5"
                >
                  <button
                    type="button"
                    onClick={() => {
                      setAuthMode('login');
                      setAuthError(null);
                    }}
                    className="hover:opacity-80 flex items-center gap-1 text-[14px] font-medium -ml-1 py-1"
                    style={{ color: 'var(--app-accent)' }}
                  >
                    <ArrowLeft size={17} /> Voltar
                  </button>
                  <div>
                    <h2 className="text-2xl font-bold oneui-text mb-1.5">Recuperar Senha</h2>
                    <p className="text-[14px] oneui-text-secondary">
                      Informe seu e-mail para receber um link de redefinição.
                    </p>
                  </div>
                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      const success = await sendPasswordReset(email);
                      if (success) {
                        showToast('Link de redefinição enviado!', 'success');
                        setAuthMode('login');
                      }
                    }}
                    className="space-y-4"
                  >
                    <div className="oneui-surface-2 relative overflow-hidden">
                      <Mail className="absolute left-4 top-1/2 -translate-y-1/2 oneui-text-muted" size={18} />
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full bg-transparent py-3.5 pl-12 pr-4 text-[15px] oneui-text placeholder:opacity-45 focus:outline-none"
                        placeholder="E-mail da conta"
                        required
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={processing}
                      className="w-full oneui-accent-btn font-semibold text-[15px] py-3.5 rounded-[18px] transition-all active:scale-[0.98] disabled:opacity-60"
                    >
                      {processing ? 'Enviando...' : 'Enviar Link'}
                    </button>
                  </form>
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence>
              {authError && (
                <motion.div
                  initial={{ opacity: 0, height: 0, marginTop: 0 }}
                  animate={{ opacity: 1, height: 'auto', marginTop: 16 }}
                  exit={{ opacity: 0, height: 0, marginTop: 0 }}
                  className="overflow-hidden"
                >
                  <div className="bg-[#FF453A]/12 border border-[#FF453A]/25 rounded-[16px] p-3.5 flex items-start gap-2.5">
                    <AlertTriangle className="text-[#FF453A] shrink-0 mt-0.5" size={16} />
                    <p className="text-[13px] oneui-text leading-relaxed">{authError}</p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        <AnimatePresence>
          {toast && (
            <motion.div
              initial={{ opacity: 0, y: -40 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -40 }}
              className="fixed top-6 max-w-[90%] oneui-dock px-5 py-3 rounded-full flex items-center gap-3 z-[80]"
            >
              <div
                className={`w-2 h-2 rounded-full ${
                  toast.type === 'success'
                    ? 'bg-[#30D158]'
                    : toast.type === 'warning'
                    ? 'bg-[#FF9F0A]'
                    : 'bg-[#FF453A]'
                }`}
              />
              <span className="font-medium text-[14px] oneui-text">{toast.message}</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  const goalModalPortal =
    typeof document !== 'undefined'
      ? createPortal(
          <AnimatePresence>
            {isGoalFormOpen && (
              <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center p-0 sm:p-4">
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setIsGoalFormOpen(false)}
                  className="oneui-modal-backdrop fixed inset-0 backdrop-blur-md"
                  style={{ backgroundColor: 'var(--app-backdrop)' }}
                />
                <motion.div
                  initial={{ y: '100%', opacity: 0.9 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: '100%', opacity: 0 }}
                  transition={{ type: 'spring', damping: 28, stiffness: 320 }}
                  className="relative z-10 w-full max-w-md rounded-t-[30px] sm:rounded-[30px] shadow-2xl p-6 pb-safe"
                  style={{
                    backgroundColor: 'var(--app-surface)',
                    border: '1px solid var(--app-border-strong)',
                    color: 'var(--app-text)',
                  }}
                >
                  <div
                    className="w-11 h-1.5 rounded-full mx-auto mb-3 sm:hidden"
                    style={{ backgroundColor: 'var(--app-border-strong)' }}
                  />

                  <div
                    className="flex justify-between items-center mb-5 pb-3.5"
                    style={{ borderBottom: '1px solid var(--app-divider)' }}
                  >
                    <h2 className="text-[18px] font-bold oneui-text tracking-tight">Nova Meta Financeira</h2>
                    <button
                      type="button"
                      onClick={() => setIsGoalFormOpen(false)}
                      className="w-8 h-8 rounded-full oneui-surface-2 flex items-center justify-center oneui-text-secondary active:scale-95"
                      aria-label="Fechar"
                    >
                      <X size={16} />
                    </button>
                  </div>

                  <form onSubmit={handleGoalSubmit} className="space-y-5">
                    <div className="oneui-surface-2 oneui-divider overflow-hidden">
                      <div className="px-4 py-3.5 flex items-center justify-between gap-3">
                        <label className="text-[14px] font-medium oneui-text-secondary min-w-[85px]">Título</label>
                        <input
                          type="text"
                          maxLength={120}
                          value={newGoalData.title}
                          onChange={(e) => setNewGoalData({ ...newGoalData, title: e.target.value })}
                          className="w-full bg-transparent text-right text-[15px] oneui-text placeholder:opacity-40 focus:outline-none"
                          placeholder="Ex: Viagem, Reserva"
                          required
                          autoFocus
                        />
                      </div>

                      <div className="px-4 py-3.5 flex items-center justify-between gap-3">
                        <label className="text-[14px] font-medium oneui-text-secondary min-w-[85px]">Alvo (R$)</label>
                        <input
                          type="number"
                          step="0.01"
                          min="0.01"
                          value={newGoalData.amount}
                          onChange={(e) => setNewGoalData({ ...newGoalData, amount: e.target.value })}
                          className="w-full bg-transparent text-right text-[15px] oneui-text placeholder:opacity-40 focus:outline-none tabular-nums font-bold"
                          placeholder="0.00"
                          required
                        />
                      </div>

                      <div className="px-4 py-3.5 flex items-center justify-between gap-3">
                        <label className="text-[14px] font-medium oneui-text-secondary min-w-[85px]">Prazo</label>
                        <input
                          type="date"
                          value={newGoalData.date}
                          onChange={(e) => setNewGoalData({ ...newGoalData, date: e.target.value })}
                          className="bg-transparent text-right text-[15px] oneui-text focus:outline-none cursor-pointer tabular-nums"
                          required
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      className="w-full min-h-[48px] bg-[#30D158] hover:brightness-105 text-black font-bold py-3.5 rounded-[18px] shadow-md active:scale-[0.98] transition-all text-[15px]"
                    >
                      Criar Meta
                    </button>
                  </form>
                </motion.div>
              </div>
            )}
          </AnimatePresence>,
          document.body
        )
      : null;

  const toastPortal =
    typeof document !== 'undefined'
      ? createPortal(
          <AnimatePresence>
            {toast && (
              <motion.div
                initial={{ opacity: 0, y: 30, x: '-50%' }}
                animate={{ opacity: 1, y: 0, x: '-50%' }}
                exit={{ opacity: 0, y: 30, x: '-50%' }}
                className="fixed bottom-24 md:bottom-8 left-1/2 z-[80] oneui-dock px-5 py-3 rounded-full flex items-center gap-3 min-w-[260px] max-w-[92vw]"
              >
                <span
                  className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                    toast.type === 'success'
                      ? 'bg-[#30D158]'
                      : toast.type === 'error'
                      ? 'bg-[#FF453A]'
                      : toast.type === 'warning'
                      ? 'bg-[#FF9F0A]'
                      : 'bg-[#4C7BFF]'
                  }`}
                />
                <span className="flex-1 font-medium text-[13px] oneui-text">{toast.message}</span>
                <button
                  type="button"
                  onClick={closeToast}
                  className="oneui-text-muted hover:opacity-100 p-0.5"
                  aria-label="Fechar aviso"
                >
                  <X size={14} />
                </button>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body
        )
      : null;

  // --- Main Application UI ---
  return (
    <MotionConfig {...motionConfig}>
      <Layout
        user={user}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        settings={settings}
        onLogout={handleLogout}
        onOpenTransaction={() => openTransactionModal(TransactionType.EXPENSE)}
        isOverlayOpen={isFormOpen || isGoalFormOpen}
        mobileMenuOpen={isMobileMenuOpen}
        onMobileMenuOpenChange={setIsMobileMenuOpen}
      >
        <div className="space-y-6 relative w-full max-w-full">
          <header className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
            <div>
              <h1 className="text-[26px] md:text-[32px] font-extrabold oneui-text tracking-tight leading-tight">
                {activeTab === 'dashboard' && 'Visão Geral'}
                {activeTab === 'transactions' && 'Transações'}
                {activeTab === 'goals' && 'Metas Financeiras'}
                {activeTab === 'analytics' && 'Inteligência Artificial'}
                {activeTab === 'achievements' && 'Conquistas'}
                {activeTab === 'settings' && 'Ajustes'}
                {activeTab === 'profile' && 'Perfil'}
              </h1>
              <p className="text-[13px] oneui-text-secondary font-medium mt-0.5">
                Olá, {user.displayName?.split(' ')[0] || 'Usuário'} ·{' '}
                {new Date().toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric', month: 'short' })}
              </p>
            </div>

            <div className="flex items-center gap-2.5 w-full sm:w-auto">
              {(activeTab === 'dashboard' || activeTab === 'goals') && (
                <button
                  type="button"
                  onClick={() => setIsGoalFormOpen(true)}
                  className="oneui-card oneui-hover oneui-text px-4 py-2.5 min-h-[44px] rounded-[18px] text-[13px] font-semibold flex items-center gap-2 transition-all active:scale-95 flex-1 sm:flex-none justify-center"
                >
                  <Target size={16} className="text-[#FF9F0A]" />
                  <span>Nova Meta</span>
                </button>
              )}

              {!['analytics', 'achievements', 'goals', 'settings', 'profile'].includes(activeTab) && (
                <button
                  type="button"
                  onClick={() => openTransactionModal(TransactionType.EXPENSE)}
                  className="oneui-accent-btn px-5 py-2.5 min-h-[44px] rounded-[18px] text-[13px] font-semibold shadow-md flex items-center gap-2 transition-all active:scale-95 flex-1 sm:flex-none justify-center"
                >
                  <Plus size={16} strokeWidth={2.6} />
                  <span>Nova Transação</span>
                </button>
              )}
            </div>
          </header>

          <div className="min-h-[60vh]">
            {activeTab === 'dashboard' && (
              <Dashboard
                transactions={transactions}
                aiInsight={aiInsight}
                aiLoading={aiLoading}
                onGenerateAI={handleGenerateAI}
                goals={goals}
                onOpenTransaction={openTransactionModal}
              />
            )}
            {activeTab === 'transactions' && (
              <TransactionList
                transactions={transactions}
                onDelete={removeTx}
                onAdd={() => openTransactionModal(TransactionType.EXPENSE)}
              />
            )}
            {activeTab === 'goals' && (
              <Goals
                goals={goals}
                onAddGoal={addGoal}
                onUpdateGoal={updateGoal}
                onDeleteGoal={removeGoal}
                onOpenNewGoal={() => setIsGoalFormOpen(true)}
                suggestions={aiInsight?.suggestedGoals}
              />
            )}
            {activeTab === 'analytics' && (
              <AIInsights
                transactions={transactions}
                goals={goals}
                insight={aiInsight}
                loading={aiLoading}
                error={aiError}
                onAnalyze={handleGenerateAI}
              />
            )}
            {activeTab === 'achievements' && <Achievements achievements={achievements} />}
            {activeTab === 'profile' && (
              <Profile
                user={user}
                transactions={transactions}
                onUpdateUser={setUser}
                onShowToast={(msg, type = 'success') => showToast(msg, type)}
              />
            )}
            {activeTab === 'settings' && (
              <Settings
                user={user}
                settings={settings}
                onUpdateSettings={setSettings}
                onResetSettings={handleResetSettings}
                onShowToast={(msg, type = 'info') => showToast(msg, type)}
              />
            )}
          </div>
        </div>
      </Layout>

      {/* Portal Modals & Toast */}
      <TransactionForm
        isOpen={isFormOpen}
        initialType={txInitialType}
        onClose={() => setIsFormOpen(false)}
        onSubmit={handleTransactionSubmit}
      />
      {goalModalPortal}
      {toastPortal}
    </MotionConfig>
  );
}

export default App;