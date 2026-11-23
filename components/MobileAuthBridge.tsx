import React, { useEffect, useState } from 'react';
import {
  consumeExternalBrowserAuthRedirect,
  runExternalBrowserAuthBridge,
} from '../services/firebase';
import { ANDROID_DEEP_LINK_SCHEME } from '../services/nativeAndroid';
import { LogoIcon } from './LogoIcon';
import { AlertTriangle, ExternalLink, Loader2, ShieldCheck } from 'lucide-react';

interface MobileAuthBridgeProps {
  provider: 'google' | 'github';
  scheme?: string;
}

const MobileAuthBridge: React.FC<MobileAuthBridgeProps> = ({
  provider,
  scheme = ANDROID_DEEP_LINK_SCHEME,
}) => {
  const [status, setStatus] = useState<'loading' | 'ready' | 'redirecting' | 'error'>('loading');
  const [message, setMessage] = useState('Preparando autenticação segura...');
  const [deepLinkUrl, setDeepLinkUrl] = useState<string | null>(null);

  const safeScheme = scheme.startsWith('com.capitalyx.finance://')
    ? scheme
    : ANDROID_DEEP_LINK_SCHEME;

  const sendBackToApp = (params: Record<string, string>) => {
    const query = new URLSearchParams(params).toString();
    const target = `${safeScheme}#${query}`;
    setDeepLinkUrl(target);
    setStatus('redirecting');
    setMessage('Autenticação concluída! Retornando ao aplicativo Capitalyx...');
    window.location.replace(target);
  };

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const redirectResult = await consumeExternalBrowserAuthRedirect();
        if (!active) return;
        if (redirectResult) {
          sendBackToApp({
            provider: redirectResult.provider,
            ...(redirectResult.idToken ? { idToken: redirectResult.idToken } : {}),
            ...(redirectResult.accessToken ? { accessToken: redirectResult.accessToken } : {}),
          });
          return;
        }
        setStatus('ready');
        setMessage(
          `Continue com sua conta ${provider === 'google' ? 'Google' : 'GitHub'} para entrar no aplicativo Android.`
        );
      } catch (err: any) {
        if (!active) return;
        setStatus('error');
        setMessage(err?.message || 'Não foi possível validar o retorno do login.');
      }
    })();

    return () => {
      active = false;
    };
  }, [provider]);

  const handleStartOAuth = async () => {
    setStatus('loading');
    setMessage(`Conectando com ${provider === 'google' ? 'Google' : 'GitHub'}...`);
    try {
      const tokens = await runExternalBrowserAuthBridge(provider);
      if (tokens) {
        sendBackToApp({
          provider: tokens.provider,
          ...(tokens.idToken ? { idToken: tokens.idToken } : {}),
          ...(tokens.accessToken ? { accessToken: tokens.accessToken } : {}),
        });
      }
    } catch (err: any) {
      setStatus('error');
      setMessage(err?.message || 'Erro durante a autenticação externa.');
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-5 font-sans"
      style={{ backgroundColor: 'var(--app-bg)', color: 'var(--app-text)' }}
    >
      <div className="w-full max-w-md oneui-card p-6 sm:p-8 text-center space-y-5">
        <div className="w-14 h-14 mx-auto rounded-[18px] bg-gradient-to-tr from-[#2F6BFF] via-[#7C5CFF] to-[#30D158] p-0.5 flex items-center justify-center shadow-lg">
          <div
            className="w-full h-full rounded-[16px] flex items-center justify-center"
            style={{ backgroundColor: 'var(--app-surface)' }}
          >
            <LogoIcon size={28} className="oneui-text" />
          </div>
        </div>

        <div>
          <h1 className="text-[22px] font-extrabold oneui-text tracking-tight">
            Login Seguro · Capitalyx Android
          </h1>
          <p className="text-[14px] oneui-text-secondary mt-1.5 leading-relaxed">{message}</p>
        </div>

        {status === 'loading' && (
          <div className="py-4 flex justify-center">
            <Loader2 size={28} className="animate-spin" style={{ color: 'var(--app-accent)' }} />
          </div>
        )}

        {status === 'ready' && (
          <button
            type="button"
            onClick={handleStartOAuth}
            className="w-full oneui-accent-btn min-h-[48px] py-3.5 px-5 rounded-[18px] font-semibold text-[15px] flex items-center justify-center gap-2 shadow-md active:scale-[0.98] transition-all"
          >
            <ShieldCheck size={18} />
            <span>Continuar com {provider === 'google' ? 'Google' : 'GitHub'}</span>
          </button>
        )}

        {status === 'redirecting' && deepLinkUrl && (
          <div className="space-y-3">
            <a
              href={deepLinkUrl}
              className="w-full oneui-accent-btn min-h-[48px] py-3.5 px-5 rounded-[18px] font-semibold text-[15px] flex items-center justify-center gap-2 shadow-md"
            >
              <ExternalLink size={17} />
              <span>Abrir Capitalyx Agora</span>
            </a>
            <p className="text-[12px] oneui-text-muted">
              Se o aplicativo não abrir automaticamente, toque no botão acima.
            </p>
          </div>
        )}

        {status === 'error' && (
          <div className="space-y-3">
            <div className="bg-[#FF453A]/12 border border-[#FF453A]/25 rounded-[16px] p-3.5 flex items-start gap-2.5 text-left">
              <AlertTriangle size={16} className="text-[#FF453A] shrink-0 mt-0.5" />
              <p className="text-[13px] oneui-text">{message}</p>
            </div>
            <button
              type="button"
              onClick={handleStartOAuth}
              className="w-full oneui-accent-btn min-h-[46px] py-3 rounded-[16px] font-semibold text-[14px]"
            >
              Tentar Novamente
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default MobileAuthBridge;
