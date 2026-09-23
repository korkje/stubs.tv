import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { confirmLinkType } from "./email-links";

const TEMPLATES = join(import.meta.dirname, "../../../../../supabase/templates");

describe("confirmLinkType", () => {
  it("accepts every type the email templates send to /auth/confirm", () => {
    const sent = readdirSync(TEMPLATES).flatMap((file) =>
      [
        ...readFileSync(join(TEMPLATES, file), "utf8").matchAll(
          /\/auth\/confirm\?[^"]*?type=([a-z_]+)/g
        ),
      ].map((match) => match[1])
    );
    expect(sent.length).toBeGreaterThan(0);
    for (const type of sent) {
      expect(confirmLinkType(type), type).toBe(type);
    }
  });

  it("refuses recovery, which only /auth/reset-password may spend", () => {
    expect(confirmLinkType("recovery")).toBeNull();
  });

  it("refuses anything else", () => {
    for (const value of ["signup", "invite", "EMAIL", "", null, undefined, 1]) {
      expect(confirmLinkType(value), String(value)).toBeNull();
    }
  });
});
