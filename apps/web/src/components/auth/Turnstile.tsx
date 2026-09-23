"use client";

import { Text } from "@radix-ui/themes";
import { MotionConfig, motion } from "motion/react";
import { useTheme } from "next-themes";
import { useEffect, useRef, useState } from "react";

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

/** How long a submit waits for the invisible check before going ahead. */
const HOLD_LIMIT_MS = 8_000;

/**
 * Cloudflare Turnstile for the anonymous auth forms (ADR-0024). The widget
 * writes its token into a hidden `captcha_token` field of the surrounding
 * form, and the server action forwards it to GoTrue. Rendered explicitly so
 * it also appears after client-side navigation; renders nothing without a
 * site key (CAPTCHA off: local dev, most self-hosted instances).
 *
 * It runs invisibly (`interaction-only`) and only opens, animated, for the
 * visitors Cloudflare wants to click, in the app's own light or dark theme.
 * A submit that beats the invisible check (autofill plus Enter) waits for
 * the token rather than failing, up to HOLD_LIMIT_MS. Place it directly
 * above the submit row, outside any flex gap: closed, it takes no space,
 * and open, it brings its own spacing.
 */
export function Turnstile({ siteKey }: { siteKey: string | null }) {
  const container = useRef<HTMLDivElement>(null);
  const { resolvedTheme } = useTheme();
  // Turnstile decides when it is visible; the container's height says so.
  const [shown, setShown] = useState(false);
  const [holding, setHolding] = useState(false);

  useEffect(() => {
    const el = container.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) =>
      setShown(entry.contentRect.height > 0)
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const el = container.current;
    const form = el?.closest("form");
    // resolvedTheme is only known after mount; waiting for it avoids
    // rendering the widget twice.
    if (!siteKey || !el || !form || !resolvedTheme) return;

    let widgetId: string | undefined;
    let cancelled = false;
    let token: string | null = null;
    let failed = false;
    let held: { submitter: HTMLElement | null; timer: number } | null = null;

    const release = () => {
      if (!held) return;
      const { submitter, timer } = held;
      held = null;
      window.clearTimeout(timer);
      setHolding(false);
      form.requestSubmit(submitter);
    };

    // Runs before React's own submit handling (delegated to the root), and
    // React skips a form action whose submit event was default-prevented.
    const onSubmit = (event: SubmitEvent) => {
      if (token || failed) return;
      event.preventDefault();
      if (held) return;
      held = {
        submitter: event.submitter,
        timer: window.setTimeout(() => {
          failed = true;
          release();
        }, HOLD_LIMIT_MS),
      };
      setHolding(true);
    };
    form.addEventListener("submit", onSubmit);

    loadTurnstile()
      .then((turnstile) => {
        if (cancelled) return;
        widgetId = turnstile.render(el, {
          sitekey: siteKey,
          theme: resolvedTheme === "dark" ? "dark" : "light",
          appearance: "interaction-only",
          size: "flexible",
          "response-field-name": "captcha_token",
          callback: (value: string) => {
            token = value;
            release();
          },
          "expired-callback": () => {
            token = null;
          },
          "error-callback": () => {
            // Let submits through: GoTrue refuses a missing token with a
            // message the page explains, rather than hanging here.
            failed = true;
            release();
          },
        });
      })
      .catch(() => {
        failed = true;
        release();
      });

    return () => {
      cancelled = true;
      form.removeEventListener("submit", onSubmit);
      if (held) window.clearTimeout(held.timer);
      if (widgetId) window.turnstile?.remove(widgetId);
    };
  }, [siteKey, resolvedTheme]);

  if (!siteKey) return null;
  const open = shown || holding;
  return (
    <MotionConfig reducedMotion="user">
      <motion.div
        initial={false}
        animate={open ? { height: "auto", opacity: 1 } : { height: 0, opacity: 0 }}
        transition={{ duration: 0.25, ease: "easeOut" }}
        style={{ overflow: "hidden" }}
      >
        <div style={{ paddingBottom: "var(--space-3)" }}>
          <div ref={container} />
          {holding && !shown && (
            <Text as="p" size="2" color="gray" role="status">
              One moment, checking that you&apos;re not a bot…
            </Text>
          )}
        </div>
      </motion.div>
    </MotionConfig>
  );
}
