"use client";

import { useEffect, useRef } from "react";

interface TurnstileApi {
  render: (container: HTMLElement, options: Record<string, unknown>) => string;
  remove: (widgetId: string) => void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const SCRIPT_SRC =
  "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

let scriptLoad: Promise<TurnstileApi> | null = null;

function loadTurnstile(): Promise<TurnstileApi> {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  scriptLoad ??= new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = SCRIPT_SRC;
    script.async = true;
    script.onload = () =>
      window.turnstile
        ? resolve(window.turnstile)
        : reject(new Error("Turnstile did not load"));
    script.onerror = () => {
      scriptLoad = null;
      reject(new Error("Turnstile did not load"));
    };
    document.head.appendChild(script);
  });
  return scriptLoad;
}

/**
 * Cloudflare Turnstile for the anonymous auth forms (ADR-0024). The widget
 * writes its token into a hidden `captcha_token` field of the surrounding
 * form, and the server action forwards it to GoTrue. Rendered explicitly so
 * it also appears after client-side navigation; renders nothing without a
 * site key (CAPTCHA off: local dev, most self-hosted instances).
 */
export function Turnstile({ siteKey }: { siteKey: string | null }) {
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = container.current;
    if (!siteKey || !el) return;
    let widgetId: string | undefined;
    let cancelled = false;
    loadTurnstile()
      .then((turnstile) => {
        if (cancelled) return;
        widgetId = turnstile.render(el, {
          sitekey: siteKey,
          "response-field-name": "captcha_token",
          size: "flexible",
        });
      })
      .catch(() => {
        // The form still submits without it; GoTrue then refuses the
        // request with a CAPTCHA error, which the page explains.
      });
    return () => {
      cancelled = true;
      if (widgetId) window.turnstile?.remove(widgetId);
    };
  }, [siteKey]);

  if (!siteKey) return null;
  return <div ref={container} />;
}
