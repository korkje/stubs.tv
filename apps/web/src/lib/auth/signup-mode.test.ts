import { beforeEach, describe, expect, it } from "vitest";
import { passwordChosenByEmail, resetPasswordModeCache } from "./signup-mode";
import { throwawayPassword } from "./password";

const settings = (body: unknown, ok = true) =>
  (async () => new Response(JSON.stringify(body), { status: ok ? 200 : 500 })) as typeof fetch;

describe("passwordChosenByEmail", () => {
  beforeEach(() => resetPasswordModeCache());

  it("is true when GoTrue sends confirmation mail", async () => {
    await expect(passwordChosenByEmail(settings({ mailer_autoconfirm: false }))).resolves.toBe(true);
  });

  it("is false when GoTrue confirms accounts without mail", async () => {
    await expect(passwordChosenByEmail(settings({ mailer_autoconfirm: true }))).resolves.toBe(false);
  });

  it("keeps the password on the form when GoTrue can't be asked", async () => {
    await expect(passwordChosenByEmail(settings({}, false))).resolves.toBe(false);
    const failing = (async () => {
      throw new Error("offline");
    }) as typeof fetch;
    await expect(passwordChosenByEmail(failing)).resolves.toBe(false);
    await expect(passwordChosenByEmail(settings({}))).resolves.toBe(false);
  });

  it("remembers the answer for five minutes", async () => {
    let calls = 0;
    const counting = (async () => {
      calls++;
      return new Response(JSON.stringify({ mailer_autoconfirm: false }));
    }) as typeof fetch;
    let t = 0;
    const now = () => t;
    await passwordChosenByEmail(counting, now);
    t = 4 * 60 * 1000;
    await passwordChosenByEmail(counting, now);
    expect(calls).toBe(1);
    t = 6 * 60 * 1000;
    await passwordChosenByEmail(counting, now);
    expect(calls).toBe(2);
  });
});

describe("throwawayPassword", () => {
  it("is long and different every time", () => {
    const a = throwawayPassword();
    expect(a.length).toBeGreaterThanOrEqual(40);
    expect(throwawayPassword()).not.toBe(a);
  });
});
