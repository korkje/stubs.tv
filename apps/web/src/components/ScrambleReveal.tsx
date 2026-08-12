"use client";

import { useEffect, useRef, useState } from "react";
import { Text } from "@radix-ui/themes";
import { stagger, useReducedMotion } from "motion/react";
import { ScrambleText } from "@motionplus/core/react";

const GLYPHS = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";

/**
 * A still mask: deterministic (seeded, so server render and hydration
 * agree), same shape as the original, none of the meaning.
 */
function staticScramble(text: string): string {
  let state = 1;
  for (let i = 0; i < text.length; i++) {
    state = (state ^ text.charCodeAt(i)) >>> 0;
  }
  const next = () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    state >>>= 0;
    return state / 4294967296;
  };
  let out = "";
  for (const char of text) {
    out += /\s/.test(char) ? char : GLYPHS[Math.floor(next() * GLYPHS.length)];
  }
  return out;
}

type Anim =
  | { phase: "masked" | "revealed" | "masking"; active?: undefined }
  | { phase: "revealing"; active: boolean };

/**
 * Spoiler protection: the synopsis is masked by a STILL scramble at rest —
 * a feed of perpetually flickering rows is exhausting — and Motion+'s
 * ScrambleText mounts only for the transitions. Revealing mounts it
 * scrambling and releases it a frame later, so the characters sweep into
 * the real text; masking mounts it scrambling over the real text and
 * settles to the still mask once the sweep is done (that direction has no
 * completion callback, hence the timer). The seen toggle is the only
 * control; "I have watched this" is exactly when spoilers stop mattering.
 * Under reduced motion both switches are instant.
 *
 * The effect depends on `revealed` alone: transitions advance through
 * guarded functional updates, so internal phase changes never re-run the
 * effect — an earlier version cleaned up its own settle timer that way and
 * froze the mask-back halfway.
 */
export function ScrambleReveal({ text, revealed }: { text: string; revealed: boolean }) {
  const reduceMotion = useReducedMotion();
  const [anim, setAnim] = useState<Anim>({ phase: revealed ? "revealed" : "masked" });
  const pending = useRef<{ raf: number; timer?: ReturnType<typeof setTimeout> }>({
    raf: 0,
  });

  useEffect(() => {
    const work = pending.current;
    work.raf = requestAnimationFrame(() => {
      if (reduceMotion) {
        setAnim({ phase: revealed ? "revealed" : "masked" });
        return;
      }
      if (revealed) {
        setAnim((prev) =>
          prev.phase === "revealed" || prev.phase === "revealing"
            ? prev
            : { phase: "revealing", active: true }
        );
        work.raf = requestAnimationFrame(() => {
          setAnim((prev) =>
            prev.phase === "revealing" ? { phase: "revealing", active: false } : prev
          );
        });
      } else {
        setAnim((prev) =>
          prev.phase === "masked" || prev.phase === "masking"
            ? prev
            : { phase: "masking" }
        );
        work.timer = setTimeout(() => {
          setAnim((prev) => (prev.phase === "masking" ? { phase: "masked" } : prev));
        }, 1800);
      }
    });
    return () => {
      cancelAnimationFrame(work.raf);
      if (work.timer) clearTimeout(work.timer);
    };
  }, [revealed, reduceMotion]);

  return (
    <Text
      as="div"
      size="1"
      color="gray"
      className="clamp-2-lines"
      aria-hidden={!revealed}
      style={revealed ? undefined : { userSelect: "none" }}
    >
      {anim.phase === "masked" && staticScramble(text)}
      {anim.phase === "revealed" && text}
      {(anim.phase === "revealing" || anim.phase === "masking") && (
        <ScrambleText
          active={anim.phase === "masking" ? true : anim.active}
          duration={Infinity}
          delay={stagger(0.8 / Math.max(text.length, 1))}
          chars={GLYPHS}
          onComplete={
            anim.phase === "revealing"
              ? () => setAnim({ phase: "revealed" })
              : undefined
          }
        >
          {text}
        </ScrambleText>
      )}
    </Text>
  );
}
