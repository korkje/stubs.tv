"use client";

import { useEffect, useRef } from "react";
import { TextField } from "@radix-ui/themes";

/**
 * The email field shared by the sign-in, sign-up and forgot-password pages.
 * What you type follows you between them: it is typical to fill in the
 * wrong page first and only notice on submit, and retyping the address on
 * every hop is the kind of friction that loses sign-ups.
 *
 * The value lives in sessionStorage — per-tab and gone when the tab closes —
 * never in the URL, where an email would leak into history, logs and
 * referrers (docs/PRIVACY.md). The input stays uncontrolled: the stored
 * value is restored imperatively after mount (the server render is empty,
 * so hydration never mismatches), and typing writes straight through.
 */
const STORAGE_KEY = "stubs.auth-email";

export function AuthEmailField() {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      const stored = sessionStorage.getItem(STORAGE_KEY);
      // Don't fight the browser: if autofill or bfcache already put
      // something in the field, that value wins.
      if (stored && inputRef.current && !inputRef.current.value) {
        inputRef.current.value = stored;
      }
    } catch {
      // Storage can be unavailable (privacy modes); the field still works.
    }
  }, []);

  return (
    // size 3 is 16px: anything smaller makes iOS Safari zoom in when the
    // field is focused.
    <TextField.Root
      ref={inputRef}
      name="email"
      type="email"
      autoComplete="email"
      size="3"
      required
      onChange={(event) => {
        try {
          sessionStorage.setItem(STORAGE_KEY, event.currentTarget.value);
        } catch {
          // Same privacy-mode caveat as above.
        }
      }}
    />
  );
}
