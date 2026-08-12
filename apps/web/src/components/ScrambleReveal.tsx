"use client";

import { useEffect, useState } from "react";
import { Text } from "@radix-ui/themes";
import { stagger, useReducedMotion } from "motion/react";
import { ScrambleText } from "@motionplus/core/react";

const GLYPHS = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";

/**
 * Reduced-motion fallback: statically scrambled, deterministic so the server
 * render and hydration agree. Word lengths survive; letters do not.
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

/**
 * Spoiler protection: the synopsis renders scrambled until `revealed` flips
 * true — which the seen toggle drives, because "I have watched this" is
 * exactly when spoilers stop mattering; there is deliberately no separate
 * reveal control. Motion+'s ScrambleText plays a staggered per-character
 * reveal, and un-marking animates the scramble back in.
 *
 * The huge `interval` keeps the mask still while it waits (a feed full of
 * perpetually flickering rows would be exhausting); the animation happens on
 * the transitions. Until the client takes over, SSR shows the deterministic
 * static scramble — never the real words, which also keeps them out of
 * screen readers and copy-paste while masked.
 */
export function ScrambleReveal({ text, revealed }: { text: string; revealed: boolean }) {
  const reduceMotion = useReducedMotion();
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setHydrated(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <Text
      as="div"
      size="1"
      color="gray"
      className="clamp-2-lines"
      aria-hidden={!revealed}
      style={revealed ? undefined : { userSelect: "none" }}
    >
      {!hydrated || reduceMotion ? (
        revealed ? text : staticScramble(text)
      ) : (
        <ScrambleText
          active={!revealed}
          duration={Infinity}
          delay={stagger(0.6 / Math.max(text.length, 1))}
          chars={GLYPHS}
        >
          {text}
        </ScrambleText>
      )}
    </Text>
  );
}
