"use client";

import { useEffect, useRef, useState } from "react";
import { Text } from "@radix-ui/themes";
import { useReducedMotion } from "motion/react";

const GLYPHS = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";

/**
 * Same shape as the original, none of the meaning. Word lengths survive so
 * the scrambled block occupies honest space; letters do not.
 *
 * Deterministic (a seeded xorshift instead of Math.random): the component
 * renders scrambled on the server, and hydration must reproduce the exact
 * same nonsense or React rejects the tree. Re-scrambles during the reveal
 * sweep vary the seed for the flicker effect — by then hydration is over.
 */
function scramble(text: string, seed = 1): string {
  let state = seed >>> 0 || 1;
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

/**
 * Spoiler protection: the synopsis renders scrambled until `revealed` flips
 * true — which the seen toggle drives, because "I have watched this" is
 * exactly when spoilers stop mattering; there is deliberately no separate
 * reveal control. Revealing sweeps left to right, unscrambling as it goes;
 * un-marking re-scrambles instantly. Under reduced motion both are instant.
 *
 * The real words stay out of the DOM (and screen readers, and copy-paste)
 * until revealed.
 */
export function ScrambleReveal({ text, revealed }: { text: string; revealed: boolean }) {
  const [display, setDisplay] = useState(() => (revealed ? text : scramble(text)));
  const frame = useRef(0);
  const wasRevealed = useRef(revealed);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (revealed === wasRevealed.current) return;
    wasRevealed.current = revealed;
    cancelAnimationFrame(frame.current);

    if (!revealed) {
      frame.current = requestAnimationFrame(() => setDisplay(scramble(text)));
      return;
    }
    const start = performance.now();
    const duration = reduceMotion ? 0 : Math.min(400 + text.length * 3, 1200);
    const tick = (now: number) => {
      const progress = duration === 0 ? 1 : Math.min((now - start) / duration, 1);
      const cut = Math.floor(text.length * progress);
      setDisplay(
        progress < 1 ? text.slice(0, cut) + scramble(text.slice(cut), cut + 2) : text
      );
      if (progress < 1) frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame.current);
  }, [revealed, text, reduceMotion]);

  return (
    <Text
      as="div"
      size="1"
      color="gray"
      className="clamp-2-lines"
      aria-hidden={!revealed}
      style={revealed ? undefined : { userSelect: "none" }}
    >
      {display}
    </Text>
  );
}
