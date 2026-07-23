"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  isFreighterConnected,
  connectFreighter,
  getFreighterNetwork,
  assertExpectedNetwork,
} from "../lib/wallet/freighter";
import { useToast } from "./ToastProvider";

export const WALLET_STATES = {
  DISCONNECTED: "disconnected",
  CONNECTING: "connecting",
  CONNECTED: "connected",
  ERROR: "error",
  WRONG_NETWORK: "wrong_network",
  NO_WALLET: "no_wallet",
};

const STORAGE_KEY = "liquifact-wallet-snapshot";
const SNAPSHOT_VERSION = 1;
const VALID_NETWORKS = ["public", "testnet"];

const IDLE_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes
const IDLE_WARNING_MS = 60 * 1000; // warn 60s before disconnecting

const WalletContext = createContext(null);

export function isBrowser() {
  return typeof window !== "undefined";
}

export function truncateAddress(address) {
  if (!address || typeof address !== "string") return "";
  if (address.includes("...")) return address; // already truncated
  if (address.length <= 12) return address;
  return `${address.slice(0, 4)}...${address.slice(-6)}`;
}

export function sanitizeSnapshot(payload) {
  if (!payload || typeof payload !== "object") return null;
  const { version, state, address, network } = payload;

  if (version !== SNAPSHOT_VERSION) return null;
  if (state !== WALLET_STATES.CONNECTED) return null;
  if (!address || typeof address !== "string") return null;
  if (!VALID_NETWORKS.includes(network)) return null;
  // Reject anything that looks like a secret key rather than a public address
  if (address.length > 40 && !address.includes("...")) return null;

  return {
    version: SNAPSHOT_VERSION,
    state: WALLET_STATES.CONNECTED,
    address: truncateAddress(address),
    network,
  };
}

export function readStoredSnapshot() {
  if (!isBrowser()) return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return sanitizeSnapshot(parsed);
  } catch {
    return null;
  }
}

export function writeStoredSnapshot(state, data) {
  if (!isBrowser()) return;
  if (state !== WALLET_STATES.CONNECTED || !data) {
    clearStoredSnapshot();
    return;
  }
  const snapshot = sanitizeSnapshot({
    version: SNAPSHOT_VERSION,
    state,
    address: data.address,
    network: data.network,
  });
  if (snapshot) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
  } else {
    clearStoredSnapshot();
  }
}

export function clearStoredSnapshot() {
  if (!isBrowser()) return;
  localStorage.removeItem(STORAGE_KEY);
}

export function WalletProvider({ children }) {
  const [state, setState] = useState(WALLET_STATES.DISCONNECTED);
  const [walletData, setWalletData] = useState(null);
  const [error, setError] = useState(null);

  const toast = useToast();
  const idleTimerRef = useRef(null);
  const warningTimerRef = useRef(null);

  // Rehydrate a persisted connected snapshot after mount (SSR-safe).
  useEffect(() => {
    const snapshot = readStoredSnapshot();
    if (snapshot) {
      setState(WALLET_STATES.CONNECTED);
      setWalletData({ address: snapshot.address, network: snapshot.network });
    }
  }, []);

  const disconnect = useCallback(() => {
    setState(WALLET_STATES.DISCONNECTED);
    setWalletData(null);
    setError(null);
    clearStoredSnapshot();
  }, []);

  const connect = useCallback(async () => {
    setState(WALLET_STATES.CONNECTING);
    setError(null);

    try {
      const hasWallet = await isFreighterConnected();
      if (!hasWallet) {
        setState(WALLET_STATES.NO_WALLET);
        clearStoredSnapshot();
        return;
      }

      const address = await connectFreighter();
      await assertExpectedNetwork();
      const network = await getFreighterNetwork();

      const nextData = { address: truncateAddress(address), network };
      setState(WALLET_STATES.CONNECTED);
      setWalletData(nextData);
      writeStoredSnapshot(WALLET_STATES.CONNECTED, nextData);
    } catch (err) {
      const message = err?.message || "Failed to connect wallet";
      clearStoredSnapshot();
      if (message.toLowerCase().includes("network")) {
        setState(WALLET_STATES.WRONG_NETWORK);
      } else {
        setState(WALLET_STATES.ERROR);
      }
      setError(message);
    }
  }, []);

  // --- Idle auto-disconnect ---

  const clearIdleTimers = useCallback(() => {
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
  }, []);

  const scheduleIdleTimers = useCallback(() => {
    clearIdleTimers();

    warningTimerRef.current = setTimeout(() => {
      toast.info(
        "You'll be disconnected in 60s due to inactivity. Move your mouse or press a key to stay connected.",
        "Session expiring soon"
      );
    }, IDLE_TIMEOUT_MS - IDLE_WARNING_MS);

    idleTimerRef.current = setTimeout(() => {
      disconnect();
    }, IDLE_TIMEOUT_MS);
  }, [clearIdleTimers, disconnect, toast]);

  useEffect(() => {
    if (state !== WALLET_STATES.CONNECTED) {
      clearIdleTimers();
      return undefined;
    }

    const resetIdleTimer = () => scheduleIdleTimers();
    const handleVisibility = () => {
      if (document.visibilityState === "visible") resetIdleTimer();
    };

    window.addEventListener("pointerdown", resetIdleTimer);
    window.addEventListener("keydown", resetIdleTimer);
    document.addEventListener("visibilitychange", handleVisibility);

    scheduleIdleTimers();

    return () => {
      window.removeEventListener("pointerdown", resetIdleTimer);
      window.removeEventListener("keydown", resetIdleTimer);
      document.removeEventListener("visibilitychange", handleVisibility);
      clearIdleTimers();
    };
  }, [state, scheduleIdleTimers, clearIdleTimers]);

  const value = {
    state,
    walletData,
    error,
    connect,
    disconnect,
  };

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWallet() {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error("useWallet must be used within a WalletProvider");
  }
  return context;
}