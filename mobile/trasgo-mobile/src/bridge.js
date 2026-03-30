import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useState } from 'react';
import { fallbackStatus } from './fallback';

const STORAGE_KEY = '@trasgo-mobile/bridge-url';
const DEFAULT_BRIDGE_URL = (process.env.EXPO_PUBLIC_TRASGO_BRIDGE_URL || 'http://127.0.0.1:8787').replace(/\/+$/, '');

const BridgeContext = createContext(null);

function normalizeBaseUrl(value) {
  return String(value || '').trim().replace(/\/+$/, '');
}

function joinUrl(baseUrl, endpoint) {
  const trimmed = normalizeBaseUrl(baseUrl || DEFAULT_BRIDGE_URL);
  const path = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  return `${trimmed}${path}`;
}

export async function requestBridge(baseUrl, endpoint, options = {}) {
  const controller = new AbortController();
  const timeoutMs = options.timeoutMs ?? 5000;
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  try {
    const response = await fetch(joinUrl(baseUrl, endpoint), {
      method: options.method || 'GET',
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal: controller.signal,
    });

    const text = await response.text();
    let data = null;
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = text;
      }
    }

    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        error: data?.error || data?.message || `http ${response.status}`,
        data,
      };
    }

    return {
      ok: true,
      status: response.status,
      data,
    };
  } catch (error) {
    return {
      ok: false,
      error: error.name === 'AbortError' ? 'timeout' : error.message,
    };
  } finally {
    clearTimeout(timer);
  }
}

export function BridgeProvider({ children }) {
  const [baseUrl, setBaseUrl] = useState(DEFAULT_BRIDGE_URL);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let mounted = true;
    AsyncStorage.getItem(STORAGE_KEY)
      .then(value => {
        if (!mounted) return;
        if (value) {
          setBaseUrl(normalizeBaseUrl(value));
        }
      })
      .finally(() => {
        if (mounted) {
          setReady(true);
        }
      });
    return () => {
      mounted = false;
    };
  }, []);

  async function updateBaseUrl(nextValue) {
    const normalized = normalizeBaseUrl(nextValue);
    setBaseUrl(normalized);
    await AsyncStorage.setItem(STORAGE_KEY, normalized);
    return normalized;
  }

  async function call(endpoint, options) {
    return requestBridge(baseUrl, endpoint, options);
  }

  const value = {
    ready,
    baseUrl,
    setBaseUrl: updateBaseUrl,
    call,
    fallbackStatus,
  };

  return <BridgeContext.Provider value={value}>{children}</BridgeContext.Provider>;
}

export function useBridge() {
  const value = useContext(BridgeContext);
  if (!value) {
    throw new Error('useBridge must be used inside BridgeProvider');
  }
  return value;
}

export function normalizeBridgeUrl(value) {
  return normalizeBaseUrl(value);
}
