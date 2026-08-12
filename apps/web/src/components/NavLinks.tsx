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
