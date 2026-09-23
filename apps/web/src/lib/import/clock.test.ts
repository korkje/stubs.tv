import { describe, expect, it } from "vitest";
import { jobClock } from "./clock";

const RESERVE = 5_000;

/** A worker invocation with a hand-driven clock. */
function invocation(budgetMs: number) {
  let t = 0;
  return {
    advance: (ms: number) => {
      t += ms;
    },
    now: () => t,
    timeLeft: () => budgetMs - t,
  };
}

describe("jobClock", () => {
  it("gives a lone job the whole invocation, as before", () => {
    const run = invocation(20_000);
    const clock = jobClock(run.timeLeft, 1, RESERVE, run.now);
    run.advance(14_900);
    expect(clock()).toBe(run.timeLeft());
    run.advance(200);
    expect(clock()).toBeLessThan(RESERVE);
  });

  it("splits what is left evenly between the waiting jobs", () => {
    const run = invocation(20_000);
    const first = jobClock(run.timeLeft, 3, RESERVE, run.now);
    run.advance(4_900);
    expect(first()).toBeGreaterThanOrEqual(RESERVE);
    run.advance(200);
    expect(first()).toBeLessThan(RESERVE);

    // The second share comes out of what is actually left: (14.9s - 5s) / 2.
    const second = jobClock(run.timeLeft, 2, RESERVE, run.now);
    run.advance(4_900);
    expect(second()).toBeGreaterThanOrEqual(RESERVE);
    run.advance(100);
    expect(second()).toBeLessThan(RESERVE);

    // The last job takes the remainder, down to the invocation's reserve.
    const third = jobClock(run.timeLeft, 1, RESERVE, run.now);
    expect(third()).toBe(run.timeLeft());
  });

  it("hands an early finisher's unused time to the jobs after it", () => {
    const run = invocation(20_000);
    jobClock(run.timeLeft, 3, RESERVE, run.now);
    run.advance(1_000);
    // (19s - 5s) / 2 = 7s, not the 5s a fixed split would give.
    const second = jobClock(run.timeLeft, 2, RESERVE, run.now);
    run.advance(6_900);
    expect(second()).toBeGreaterThanOrEqual(RESERVE);
    run.advance(200);
    expect(second()).toBeLessThan(RESERVE);
  });

  it("starts below the reserve when the invocation has nothing left", () => {
    const run = invocation(3_000);
    expect(jobClock(run.timeLeft, 2, RESERVE, run.now)()).toBeLessThan(RESERVE);
  });
});
