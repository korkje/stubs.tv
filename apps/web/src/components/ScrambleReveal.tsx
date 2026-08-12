"use client";

import { useEffect, useRef, useState } from "react";
import { Text } from "@radix-ui/themes";
import { useReducedMotion } from "motion/react";

const GLYPHS = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";

/** How often the scrambled region re-rolls its glyphs during a sweep. At
 * every animation frame it reads as a blur; ~11 times a second reads as
 * letters shuffling. */
const FLICKER_MS = 90;

/**
 * The glyph for one masked character: a hash of its position and the
 * current flicker tick, so glyphs are stable within a tick (no blur), roll
 * on the next one, and tick 0 — the resting mask — is fully deterministic
 * for SSR and hydration. Whitespace survives, so word shapes stay honest.
 */
function maskChar(char: string, index: number, tick: number): string {
  if (/\s/.test(char)) return char;
  let h = ((index + 1) * 2654435761) ^ ((tick + 1) * 340573321);
  h >>>= 0;
  h ^= h >>> 16;
  h = (h * 2246822519) >>> 0;
  // Bitwise ops yield SIGNED 32-bit values: without the final >>> 0 the
  // index can go negative and GLYPHS[-n] pastes literal "undefined".
  h = (h ^ (h >>> 13)) >>> 0;
  return GLYPHS[h % GLYPHS.length];
}

/** text with positions [from, to) masked, the rest left real. */
function maskRange(text: string, from: number, to: number, tick: number): string {
  let out = text.slice(0, from);
  for (let i = from; i < to; i++) out += maskChar(text[i], i, tick);
  return out + text.slice(to);
}

/**
 * Spoiler protection, hand-rolled: a still deterministic mask at rest, and
 * short sweeps on the seen toggle. Directions differ on purpose: revealing
 * runs left to right (stable real text grows as a prefix), re-masking runs
 * right to left (the mask grows from the end) — either way the flickering
 * region, whose glyphs have unstable widths, sits AFTER the stable text, so
 * nothing ahead of it shakes. Both settle on the same resting mask. Under
 * reduced motion the switches are instant. The real words stay out of the
 * rendered DOM (and screen readers, and copy-paste) while masked.
 */
export function ScrambleReveal({ text, revealed }: { text: string; revealed: boolean }) {
  const [display, setDisplay] = useState(() =>
    revealed ? text : maskRange(text, 0, text.length, 0)
  );
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
      // Settled states use tick 0, so the sweep's final frame IS the
      // resting mask (or the plain text) — no terminal re-roll.
      const flicker = progress >= 1 ? 0 : 1 + Math.floor((now - start) / FLICKER_MS);
      setDisplay(
        revealed
          ? maskRange(text, cut, text.length, flicker)
          : maskRange(text, text.length - cut, text.length, flicker)
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
