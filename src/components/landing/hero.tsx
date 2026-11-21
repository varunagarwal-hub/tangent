"use client";

import { useRef } from "react";
import { PersonaButton } from "@/components/brand/persona-button";
import { gsap, useGSAP, SplitText, MOTION_OK } from "./gsap";
import { HeroScene } from "./hero-scene";

export function Hero() {
  const root = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add(MOTION_OK, () => {
        const q = gsap.utils.selector(root);
        const split = SplitText.create(q(".hero-headline")[0], {
          type: "words",
          mask: "words",
          autoSplit: true,
          onSplit: (self) => {
            gsap.set(self.elements, { autoAlpha: 1 });
            return gsap.from(self.words, { yPercent: 110, duration: 0.8, ease: "power3.out", stagger: 0.05, delay: 0.1 });
          },
        });
        gsap.from(q(".hero-rise"), { autoAlpha: 0, y: 14, duration: 0.6, ease: "power2.out", stagger: 0.1, delay: 0.75 });
        return () => split.revert();
      });
      return () => mm.revert();
    },
    { scope: root },
  );

  return (
    <section
      ref={root}
      className="grid items-center gap-x-12 gap-y-8 pt-10 sm:pt-16 lg:grid-cols-[1.05fr_1fr] lg:grid-rows-[auto_auto] lg:pt-20"
      aria-labelledby="hero-title"
    >
      <div className="lg:self-end">
        <p className="hero-rise font-hand text-2xl text-redpen sm:text-[1.7rem]">
          Catches the exact moment your thinking goes off on a tangent.
        </p>
        <h1
          id="hero-title"
          className="hero-headline landing-reveal mt-3 text-[2.9rem] leading-[1.02] text-ink sm:text-6xl xl:text-7xl"
        >
          Your answer was wrong. Let&apos;s find where you went <span className="italic text-redpen">off on a tangent.</span>
        </h1>
      </div>

      <figure className="relative lg:col-start-2 lg:row-span-2 lg:row-start-1" aria-label="How Tangent marks up rough work">
        <div className="landing-hero-card paper-card graph-paper relative overflow-hidden p-3 sm:p-5">
          <HeroScene />
        </div>
        <span
          aria-hidden="true"
          className="absolute -top-3 right-6 rotate-3 rounded-sm bg-highlighter px-2 py-0.5 font-hand text-lg text-ink shadow-sm"
        >
          the classic CAT slip
        </span>
      </figure>

      <div className="lg:self-start">
        <p className="hero-rise max-w-xl text-lg leading-relaxed text-ink-soft">
          Tangent reads your rough work, typed, drawn or photographed, and puts the red pen on the one line where your
          reasoning veered off. Then it rebuilds your CAT Quant prep around that exact point.
        </p>
        <div className="hero-rise mt-7 flex flex-col gap-3 sm:flex-row">
          <PersonaButton persona="riya" className="py-4 text-lg">
            Try as Riya (student)
          </PersonaButton>
          <PersonaButton persona="mehta" variant="secondary" className="py-4 text-lg">
            Try as Prof. Mehta (teacher)
          </PersonaButton>
        </div>
        <p className="hero-rise mt-4 text-sm text-ink-soft">
          or{" "}
          <PersonaButton persona="new" variant="link">
            start fresh as a new student
          </PersonaButton>{" "}
          with a 12-question diagnostic. No sign-up.
        </p>
      </div>
    </section>
  );
}
