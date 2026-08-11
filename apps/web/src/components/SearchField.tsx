"use client";

import { useEffect, useRef } from "react";
import { TextField } from "@radix-ui/themes";
import { MagnifyingGlassIcon } from "@radix-ui/react-icons";

/**
 * The search box, focused on arrival — but only where that helps.
 *
 * iOS opens the keyboard only for a focus() that runs synchronously inside a
 * trusted tap handler. Focusing after a page navigation is far too late, so on
 * a phone autofocus produces a field that looks ready to type in and isn't,
 * which is worse than leaving it alone. Restricting it to devices with a fine
 * pointer means a desktop visitor can start typing immediately and a phone
 * visitor gets an honest, untouched field.
 */
export function SearchField({ defaultValue }: { defaultValue: string }) {
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (window.matchMedia("(pointer: fine)").matches) {
      ref.current?.focus();
    }
  }, []);

  return (
    <TextField.Root
      ref={ref}
      name="q"
      defaultValue={defaultValue}
      // Short enough to survive a phone-width field: the icon and the button
      // already say "search", so the placeholder only has to say what is
      // searchable.
      placeholder="Movies and TV shows"
      size="3"
    >
      <TextField.Slot>
        <MagnifyingGlassIcon height="18" width="18" />
      </TextField.Slot>
    </TextField.Root>
  );
}
