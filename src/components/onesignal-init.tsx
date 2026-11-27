"use client";

import { useEffect } from "react";
import Script from "next/script";

export interface OneSignalClientApi {
  init: (options: Record<string, unknown>) => Promise<void>;
  login: (externalId: string) => Promise<void>;
  logout: () => Promise<void>;
  Notifications: {
    permission: boolean;
    permissionNative?: NotificationPermission;
    requestPermission: () => Promise<void>;
    addEventListener?: (event: string, cb: () => void) => void;
    removeEventListener?: (event: string, cb: () => void) => void;
  };
  User: {
    addTags: (tags: Record<string, string>) => Promise<void>;
    PushSubscription: {
      id?: string | null;
      token?: string | null;
      optedIn?: boolean;
      optIn: () => Promise<void>;
      optOut: () => Promise<void>;
      addEventListener?: (event: string, cb: () => void) => void;
      removeEventListener?: (event: string, cb: () => void) => void;
    };
  };
}

declare global {
  interface Window {
    OneSignalDeferred?: Array<(oneSignal: OneSignalClientApi) => void | Promise<void>>;
    __zanimaOneSignalReady?: Promise<OneSignalClientApi>;
    __zanimaOneSignalResolve?: (os: OneSignalClientApi) => void;
    __zanimaOneSignalUserId?: string | null;
  }
}

export function getOneSignalClient(): Promise<OneSignalClientApi> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("OneSignal unavailable on server"));
  }
  if (!window.__zanimaOneSignalReady) {
    window.__zanimaOneSignalReady = new Promise<OneSignalClientApi>((resolve) => {
      window.__zanimaOneSignalResolve = resolve;
    });
  }
  return window.__zanimaOneSignalReady;
}

export function OneSignalInit({
  appId,
  safariWebId,
}: {
  appId: string;
  safariWebId?: string;
}) {
  useEffect(() => {
    if (!appId || typeof window === "undefined") return;
    getOneSignalClient();
    window.OneSignalDeferred = window.OneSignalDeferred || [];
    window.OneSignalDeferred.push(async (OneSignal) => {
      try {
        await OneSignal.init({
          appId,
          ...(safariWebId ? { safari_web_id: safariWebId } : {}),
          serviceWorkerPath: "/OneSignalSDKWorker.js",
          serviceWorkerParam: { scope: "/" },
          notifyButton: { enable: false },
          allowLocalhostAsSecureOrigin: true,
        });
      } catch {
        // Already initialized
      } finally {
        window.__zanimaOneSignalResolve?.(OneSignal);
      }
    });
  }, [appId, safariWebId]);

  if (!appId) return null;

  return (
    <Script
      src="https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js"
      strategy="afterInteractive"
    />
  );
}

export function OneSignalUserSync({
  userId,
  role,
}: {
  userId: string;
  role: string;
}) {
  useEffect(() => {
    if (!userId) return;
    let active = true;
    getOneSignalClient()
      .then(async (OneSignal) => {
        if (!active) return;
        if (window.__zanimaOneSignalUserId !== userId) {
          await OneSignal.login(userId);
          window.__zanimaOneSignalUserId = userId;
        }
        await OneSignal.User.addTags({
          role,
          userId,
          channel: role === "CLIENT" ? "client" : "admin",
        });
      })
      .catch(() => {});

    return () => {
      active = false;
    };
  }, [userId, role]);

  return null;
}
