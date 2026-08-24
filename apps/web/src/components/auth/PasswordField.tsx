"use client";

import { useState } from "react";
import { IconButton, TextField } from "@radix-ui/themes";
import { EyeClosedIcon, EyeOpenIcon } from "@radix-ui/react-icons";

/**
 * The password input shared by every form that asks for one. The reveal
 * toggle exists instead of a confirm-password field, by design: seeing what
 * you typed *prevents* the typo a confirm field only detects, password
 * managers fill both fields of a confirm pair identically anyway, and a
 * mistyped password is recoverable through the reset flow regardless. Don't
 * add a confirm field.
 */
export function PasswordField({
  name = "password",
  autoComplete,
}: {
  name?: string;
  autoComplete: "new-password" | "current-password";
}) {
  const [visible, setVisible] = useState(false);

  return (
    // size 3 is 16px: anything smaller makes iOS Safari zoom in when the
    // field is focused.
    <TextField.Root
      name={name}
      type={visible ? "text" : "password"}
      autoComplete={autoComplete}
      size="3"
      required
    >
      <TextField.Slot side="right">
        <IconButton
          type="button"
          size="2"
          variant="ghost"
          color="gray"
          aria-label={visible ? "Hide password" : "Show password"}
          aria-pressed={visible}
          onClick={() => setVisible((v) => !v)}
        >
          {visible ? <EyeOpenIcon /> : <EyeClosedIcon />}
        </IconButton>
      </TextField.Slot>
    </TextField.Root>
  );
}
