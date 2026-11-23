/// <reference types="vite/client" />
import { Capacitor } from '@capacitor/core';
import { App as CapApp } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { Keyboard } from '@capacitor/keyboard';
import { StatusBar, Style } from '@capacitor/status-bar';

export const ANDROID_APP_ID = 'com.capitalyx.finance';
export const ANDROID_DEEP_LINK_SCHEME = `${ANDROID_APP_ID}://auth`;
export const DEFAULT_HOSTED_API_URL =
  import.meta.env.VITE_API_BASE_URL ||
  'https://ais-pre-4mckqqovt7ozybtqrs3wqu-21427059060.us-west2.run.app';

const API_URL_STORAGE_KEY = 'capitalyx_api_base_url';

export const isNativePlatform = (): boolean => {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
};

export const isAndroidNative = (): boolean => {
  try {
    return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
  } catch {
    return false;
  }
};

export const getHostedApiBaseUrl = (): string => {
  try {
    const saved = localStorage.getItem(API_URL_STORAGE_KEY);
    if (saved && /^https?:\/\/.+/.test(saved.trim())) {
      return saved.trim().replace(/\/+$/, '');
    }
  } catch {
    // Ignore storage read errors
  }
  return DEFAULT_HOSTED_API_URL.replace(/\/+$/, '');
};

export const setHostedApiBaseUrl = (url: string): string => {
  const cleaned = url.trim().replace(/\/+$/, '');
  if (!cleaned) {
    try {
      localStorage.removeItem(API_URL_STORAGE_KEY);
    } catch {
      // Ignore
    }
    return DEFAULT_HOSTED_API_URL.replace(/\/+$/, '');
  }
  if (!/^https?:\/\/.+/.test(cleaned)) {
    throw new Error('A URL do servidor deve começar com https:// ou http://');
  }
  try {
    localStorage.setItem(API_URL_STORAGE_KEY, cleaned);
  } catch {
    // Ignore
  }
  return cleaned;
};

export const resolveApiUrl = (path: string): string => {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  if (!isNativePlatform()) {
    return normalizedPath;
  }
  return `${getHostedApiBaseUrl()}${normalizedPath}`;
};

const THEME_STATUSBAR_HEX: Record<string, { color: string; isLight: boolean }> = {
  default: { color: '#0C0C12', isLight: false },
  ios: { color: '#0C0C12', isLight: false },
  'oneui-light': { color: '#F3F4F9', isLight: true },
  'ios-midnight': { color: '#000000', isLight: false },
  cyberpunk: { color: '#0D0A18', isLight: false },
  ocean: { color: '#06101C', isLight: false },
  sunset: { color: '#140C0C', isLight: false },
};

export const syncNativeSystemBars = async (theme: string): Promise<void> => {
  if (!isNativePlatform()) return;
  const spec = THEME_STATUSBAR_HEX[theme] || THEME_STATUSBAR_HEX.default;
  try {
    await StatusBar.setOverlaysWebView({ overlay: false });
    await StatusBar.setBackgroundColor({ color: spec.color });
    await StatusBar.setStyle({ style: spec.isLight ? Style.Light : Style.Dark });
  } catch {
    // Non-fatal on unsupported devices
  }
};

export const triggerHaptic = async (intensity: 'light' | 'medium' = 'light'): Promise<void> => {
  if (!isNativePlatform()) return;
  try {
    await Haptics.impact({
      style: intensity === 'medium' ? ImpactStyle.Medium : ImpactStyle.Light,
    });
  } catch {
    // Ignore haptics errors
  }
};

export const openExternalSocialAuth = async (provider: 'google' | 'github'): Promise<void> => {
  const baseUrl = getHostedApiBaseUrl();
  const bridgeUrl = `${baseUrl}/?mobileAuth=${encodeURIComponent(provider)}&scheme=${encodeURIComponent(
    ANDROID_DEEP_LINK_SCHEME
  )}`;
  await Browser.open({
    url: bridgeUrl,
    presentationStyle: 'fullscreen',
    toolbarColor: '#0C0C12',
  });
};

export const closeExternalAuthBrowser = async (): Promise<void> => {
  if (!isNativePlatform()) return;
  try {
    await Browser.close();
  } catch {
    // Browser may already be closed
  }
};

export interface NativeDeepLinkAuthPayload {
  provider?: 'google' | 'github';
  idToken?: string;
  accessToken?: string;
  error?: string;
}

export const parseAuthDeepLink = (rawUrl: string): NativeDeepLinkAuthPayload | null => {
  if (!rawUrl || !rawUrl.startsWith(ANDROID_DEEP_LINK_SCHEME)) return null;
  try {
    const hashIndex = rawUrl.indexOf('#');
    const queryIndex = rawUrl.indexOf('?');
    const paramString =
      hashIndex >= 0
        ? rawUrl.slice(hashIndex + 1)
        : queryIndex >= 0
        ? rawUrl.slice(queryIndex + 1)
        : '';
    const params = new URLSearchParams(paramString);
    const provider = params.get('provider');
    return {
      provider: provider === 'google' || provider === 'github' ? provider : undefined,
      idToken: params.get('idToken') || undefined,
      accessToken: params.get('accessToken') || undefined,
      error: params.get('error') || undefined,
    };
  } catch {
    return null;
  }
};

export const subscribeNativeDeepLinkAuth = (
  onPayload: (payload: NativeDeepLinkAuthPayload) => void
): (() => void) => {
  if (!isNativePlatform()) return () => {};
  let removed = false;
  let listenerHandle: { remove: () => Promise<void> } | null = null;

  CapApp.addListener('appUrlOpen', ({ url }) => {
    if (removed) return;
    const payload = parseAuthDeepLink(url);
    if (payload) {
      closeExternalAuthBrowser();
      onPayload(payload);
    }
  })
    .then((handle) => {
      if (removed) handle.remove();
      else listenerHandle = handle;
    })
    .catch(() => {});

  return () => {
    removed = true;
    listenerHandle?.remove().catch(() => {});
  };
};

export const subscribeNativeBackButton = (handler: () => void): (() => void) => {
  if (!isAndroidNative()) return () => {};
  let removed = false;
  let listenerHandle: { remove: () => Promise<void> } | null = null;

  CapApp.addListener('backButton', () => {
    if (!removed) handler();
  })
    .then((handle) => {
      if (removed) handle.remove();
      else listenerHandle = handle;
    })
    .catch(() => {});

  return () => {
    removed = true;
    listenerHandle?.remove().catch(() => {});
  };
};

export const exitAndroidApp = async (): Promise<void> => {
  if (!isAndroidNative()) return;
  try {
    await CapApp.exitApp();
  } catch {
    // Ignore
  }
};

export const subscribeNativeKeyboard = (
  onVisibilityChange: (visible: boolean) => void
): (() => void) => {
  if (!isNativePlatform()) return () => {};
  let removed = false;
  const handles: Array<{ remove: () => Promise<void> }> = [];

  const register = async () => {
    try {
      const h1 = await Keyboard.addListener('keyboardWillShow', () => {
        if (!removed) onVisibilityChange(true);
      });
      const h2 = await Keyboard.addListener('keyboardDidShow', () => {
        if (!removed) onVisibilityChange(true);
      });
      const h3 = await Keyboard.addListener('keyboardWillHide', () => {
        if (!removed) onVisibilityChange(false);
      });
      const h4 = await Keyboard.addListener('keyboardDidHide', () => {
        if (!removed) onVisibilityChange(false);
      });
      if (removed) {
        [h1, h2, h3, h4].forEach((h) => h.remove().catch(() => {}));
      } else {
        handles.push(h1, h2, h3, h4);
      }
    } catch {
      // Ignore keyboard plugin unavailability
    }
  };

  register();

  return () => {
    removed = true;
    handles.forEach((h) => h.remove().catch(() => {}));
  };
};
