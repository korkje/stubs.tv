"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Link as RadixLink } from "@radix-ui/themes";

const LINKS = [
  { href: "/app", label: "Home", isActive: (path: string) => path === "/app" },
  {
    href: "/app/search",
    label: "Search",
    isActive: (path: string) => path.startsWith("/app/search"),
  },
];

/**
 * The header nav, with an amber line under the section you are on
 * (spelled --amber-9: the gray color prop on the link remaps --accent-9) — the
 * same language as the active tab underline. Detail pages light up neither:
 * they are reached from both.
 */
export function NavLinks() {
  const pathname = usePathname();

  return (
    <>
      {LINKS.map(({ href, label, isActive }) => {
        const active = isActive(pathname);

        return (
          <RadixLink
            key={href}
            asChild
            size="2"
            color="gray"
            highContrast
            underline="hover"
            style={
              active
                ? { boxShadow: "0 2px 0 0 var(--amber-9)" }
                : undefined
            }
          >
            <Link href={href} aria-current={active ? "page" : undefined}>
              {label}
            </Link>
          </RadixLink>
        );
      })}
    </>
  );
}
