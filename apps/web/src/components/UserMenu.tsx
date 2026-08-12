"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { Avatar, DropdownMenu, IconButton } from "@radix-ui/themes";
import { signout } from "@/app/login/actions";

/**
 * The account menu: settings, invites, theme, sign out. Theme selection
 * lives here rather than on the profile — people legitimately want dark on
 * one machine and light on another, so it stays a device preference
 * (next-themes/localStorage), not a synced setting.
 */
export function UserMenu({ initial }: { initial: string }) {
  const { theme, setTheme } = useTheme();
  const router = useRouter();

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger>
        <IconButton variant="ghost" radius="full" aria-label="Account menu">
          <Avatar size="2" radius="full" fallback={initial} variant="soft" color="amber" />
        </IconButton>
      </DropdownMenu.Trigger>
      <DropdownMenu.Content align="end">
        <DropdownMenu.Item asChild>
          <Link href="/app/settings">Settings</Link>
        </DropdownMenu.Item>
        <DropdownMenu.Item asChild>
          <Link href="/app/invites">Invites</Link>
        </DropdownMenu.Item>
        <DropdownMenu.Separator />
        <DropdownMenu.Label>Theme</DropdownMenu.Label>
        <DropdownMenu.RadioGroup value={theme} onValueChange={setTheme}>
          <DropdownMenu.RadioItem value="system">System</DropdownMenu.RadioItem>
          <DropdownMenu.RadioItem value="light">Light</DropdownMenu.RadioItem>
          <DropdownMenu.RadioItem value="dark">Dark</DropdownMenu.RadioItem>
        </DropdownMenu.RadioGroup>
        <DropdownMenu.Separator />
        <DropdownMenu.Item
          onSelect={async () => {
            await signout();
            router.refresh();
          }}
        >
          Sign out
        </DropdownMenu.Item>
      </DropdownMenu.Content>
    </DropdownMenu.Root>
  );
}
