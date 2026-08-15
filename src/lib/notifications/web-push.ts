import webpush from "web-push";

export type WebPushSubscription = {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
};

let vapidConfigured = false;

function getPushEnv() {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;

  if (!publicKey || !privateKey || !subject) {
    return null;
  }

  return { publicKey, privateKey, subject };
}

function ensureVapidConfiguration() {
  const config = getPushEnv();

  if (!config) {
    return false;
  }

  if (!vapidConfigured) {
    webpush.setVapidDetails(config.subject, config.publicKey, config.privateKey);
    vapidConfigured = true;
  }

  return true;
}

export async function sendWebPushNotification(params: {
  subscription: WebPushSubscription;
  title: string;
  body: string;
  url: string;
}) {
  if (!ensureVapidConfiguration()) {
    return { ok: false as const, reason: "missing_vapid" as const };
  }

  const payload = JSON.stringify({
    title: params.title,
    body: params.body,
    url: params.url
  });

  try {
    await webpush.sendNotification(params.subscription, payload, {
      TTL: 300,
      urgency: "normal"
    });

    return { ok: true as const };
  } catch (error) {
    const statusCode =
      typeof error === "object" && error && "statusCode" in error
        ? Number((error as { statusCode?: number }).statusCode)
        : undefined;

    return {
      ok: false as const,
      reason: "send_failed" as const,
      statusCode
    };
  }
}