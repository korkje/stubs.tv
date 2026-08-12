"use client";

import { useEffect, useRef, useState } from "react";
import { Text } from "@radix-ui/themes";
import { useReducedMotion } from "motion/react";

const GLYPHS = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";

/**
 * Same shape as the original, none of the meaning: word lengths survive,
 * letters do not. Deterministic (seeded xorshift), so the server render and
 * hydration agree on the resting mask — and varying the seed per animation
 * frame is what makes the scrambled region flicker while a sweep runs.
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
 * Spoiler protection, hand-rolled: Motion+'s ScrambleText is a flicker
 * effect that plays over visible text, which kept fighting this use — a
 * still mask with short, directional transitions. Here the mask rests as
 * deterministic gibberish; flipping the seen toggle on sweeps the real text
 * in from the start of the synopsis, and flipping it off sweeps the
 * gibberish back in the same direction. Under reduced motion both switches
 * are instant. The real words stay out of the rendered DOM (and screen
 * readers, and copy-paste) while masked.
 */
export function ScrambleReveal({ text, revealed }: { text: string; revealed: boolean }) {
  const [display, setDisplay] = useState(() => (revealed ? text : scramble(text)));
  const wasRevealed = useRef(revealed);
  const frame = useRef(0);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (revealed === wasRevealed.current) return;
    wasRevealed.current = revealed;
    cancelAnimationFrame(frame.current);

    const duration = reduceMotion ? 0 : Math.min(400 + text.length * 3, 1200);
    const start = performance.now();
    const tick = (now: number) => {
      const progress = duration === 0 ? 1 : Math.min((now - start) / duration, 1);
      const cut = Math.floor(text.length * progress);
      if (revealed) {
        // Real text grows from the start; the tail flickers until reached.
        setDisplay(
          progress >= 1 ? text : text.slice(0, cut) + scramble(text.slice(cut), cut + 2)
        );
      } else {
        // Gibberish grows from the start; settles on the resting mask so the
        // end state matches what a fresh render would show.
        setDisplay(
          progress >= 1
            ? scramble(text)
            : scramble(text.slice(0, cut), cut + 3) + text.slice(cut)
        );
      }
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
