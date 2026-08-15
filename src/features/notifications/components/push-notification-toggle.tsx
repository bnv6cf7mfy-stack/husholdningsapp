"use client";

import { useEffect, useMemo, useState } from "react";

type PermissionState = "unsupported" | "default" | "granted" | "denied";

function base64UrlToUint8Array(base64Url: string) {
  const padding = "=".repeat((4 - (base64Url.length % 4)) % 4);
  const base64 = (base64Url + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; i += 1) {
    outputArray[i] = rawData.charCodeAt(i);
  }

  return outputArray;
}

export function PushNotificationToggle() {
  const [permission, setPermission] = useState<PermissionState>("default");
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const publicVapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

  const supported = useMemo(() => {
    return typeof window !== "undefined" && "Notification" in window && "serviceWorker" in navigator;
  }, []);

  async function syncSubscriptionState() {
    if (!supported) {
      setPermission("unsupported");
      return;
    }

    setPermission(Notification.permission as PermissionState);

    const registration = await navigator.serviceWorker.ready;
    const existing = await registration.pushManager.getSubscription();
    setIsSubscribed(Boolean(existing));
  }

  useEffect(() => {
    async function boot() {
      if (!supported) {
        setPermission("unsupported");
        return;
      }

      await navigator.serviceWorker.register("/sw.js");
      await syncSubscriptionState();
    }

    void boot();
  }, [supported]);

  async function enableNotifications() {
    if (!supported || !publicVapidKey) {
      setMessage("Push er ikke tilgjengelig ennå på denne enheten.");
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const registration = await navigator.serviceWorker.ready;
      const permissionResult = await Notification.requestPermission();
      setPermission(permissionResult as PermissionState);

      if (permissionResult !== "granted") {
        setMessage("Varslinger er blokkert i nettleseren.");
        return;
      }

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: base64UrlToUint8Array(publicVapidKey)
      });

      const response = await fetch("/api/notifications/subscribe", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ subscription: subscription.toJSON() })
      });

      if (!response.ok) {
        setMessage("Kunne ikke lagre varslinger for denne enheten.");
        return;
      }

      setIsSubscribed(true);
      setMessage("Varslinger er aktivert.");
    } finally {
      setLoading(false);
    }
  }

  async function disableNotifications() {
    if (!supported) {
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const registration = await navigator.serviceWorker.ready;
      const existing = await registration.pushManager.getSubscription();

      if (!existing) {
        setIsSubscribed(false);
        return;
      }

      await fetch("/api/notifications/unsubscribe", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ endpoint: existing.endpoint })
      });

      await existing.unsubscribe();
      setIsSubscribed(false);
      setMessage("Varslinger er slått av.");
    } finally {
      setLoading(false);
    }
  }

  if (permission === "unsupported") {
    return <p className="text-xs text-slate-500">Varslinger støttes ikke på denne enheten.</p>;
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={isSubscribed ? disableNotifications : enableNotifications}
        disabled={loading}
        className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 disabled:opacity-60"
      >
        {loading ? "Oppdaterer..." : isSubscribed ? "Skru av varslinger" : "Skru på varslinger"}
      </button>
      {message ? <p className="text-[11px] text-slate-500">{message}</p> : null}
    </div>
  );
}