import type { Metadata } from "next";
import { Theme } from "@radix-ui/themes";
import "@radix-ui/themes/styles.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "stubs",
  description: "Keep your ticket stubs — track the movies and TV shows you watch.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <Theme accentColor="amber" grayColor="sand" radius="large">
          {children}
        </Theme>
      </body>
    </html>
  );
}
