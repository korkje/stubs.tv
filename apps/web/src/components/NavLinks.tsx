"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Link as RadixLink } from "@radix-ui/themes";

const LINKS = [
  {
    href: "/app/library",
    label: "Library",
    isActive: (path: string) => path.startsWith("/app/library"),
  },
  {
    href: "/app/search",
    label: "Search",
    isActive: (path: string) => path.startsWith("/app/search"),
  },
];

/**
 * The header nav. The section you are on keeps the same underline the links
 * already show on hover — one visual, two meanings: "you can go here" and
 * "you are here". Detail pages light up neither: they are reached from both.
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
            underline={active ? "always" : "hover"}
            // The stock decoration color is built for body links and nearly
            // vanishes at this size — amber ink makes "you are here" legible
            // without changing the underline itself.
            style={active ? { textDecorationColor: "var(--amber-9)" } : undefined}
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
