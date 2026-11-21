"use client";

import { useRef } from "react";
import { gsap, useGSAP, ScrollTrigger, MOTION_OK } from "./gsap";

/**
 * Hero animation on graph paper:
 * a reasoning curve draws in, a tangent veers off it, the red pen circles the touch point,
 * then the scene crossfades into a handwritten solution with the wrong line circled.
 * Server HTML renders the END state (the marked-up solution), so reduced motion and no-JS both see it.
 */
export function HeroScene() {
  const root = useRef<SVGSVGElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add(MOTION_OK, () => {
        const q = gsap.utils.selector(root);
        const tl = gsap.timeline({ repeat: -1, defaults: { ease: "power2.out" } });
        tl.set(root.current, { autoAlpha: 1 })
          .set(q(".hs-scene1"), { autoAlpha: 1 })
          .set(q(".hs-scene2"), { autoAlpha: 0 })
          .set(q(".hs-draw"), { drawSVG: "0%" })
          .set(q(".hs-tangent"), { drawSVG: "19% 19%" })
          .set(q(".hs-fade"), { autoAlpha: 0 })
          .set(q(".hs-dot"), { scale: 0, transformOrigin: "50% 50%" })
          // 1. the reasoning curve
          .to(q(".hs-axes"), { autoAlpha: 1, duration: 0.4 })
          .to(q(".hs-curve"), { drawSVG: "100%", duration: 1.6, ease: "power1.inOut" }, "<0.1")
          .to(q(".hs-label-curve"), { autoAlpha: 1, y: 0, duration: 0.4 }, "-=0.5")
          // 2. the tangent veers off
          .to(q(".hs-tangent"), { drawSVG: "0% 100%", duration: 0.9, ease: "power2.inOut" }, "+=0.15")
          .to(q(".hs-label-tangent"), { autoAlpha: 1, duration: 0.35 }, "-=0.25")
          // 3. red pen finds the point
          .to(q(".hs-dot"), { scale: 1, duration: 0.35, ease: "back.out(3)" }, "+=0.1")
          .to(q(".hs-ring"), { drawSVG: "100%", duration: 0.75, ease: "power1.inOut" }, "<0.05")
          .to(q(".hs-label-point"), { autoAlpha: 1, x: 0, duration: 0.35 }, "-=0.2")
          .to({}, { duration: 1.5 })
          // 4. crossfade into the handwritten solution
          .to(q(".hs-scene1"), { autoAlpha: 0, scale: 0.97, transformOrigin: "40% 60%", duration: 0.6, ease: "power2.in" })
          .to(q(".hs-scene2"), { autoAlpha: 1, duration: 0.5 }, "-=0.2")
          .from(q(".hs-line"), { autoAlpha: 0, x: -10, duration: 0.45, stagger: 0.32 }, "<")
          .to(q(".hs-sol-ring"), { drawSVG: "100%", duration: 0.9, ease: "power1.inOut" }, "+=0.2")
          .to(q(".hs-arrow"), { drawSVG: "100%", duration: 0.35 }, "-=0.1")
          .to(q(".hs-note"), { autoAlpha: 1, y: 0, rotate: -2, duration: 0.45, ease: "back.out(2)" }, "-=0.05")
          .to(q(".hs-fix"), { autoAlpha: 1, x: 0, duration: 0.45 }, "+=0.35")
          .to({}, { duration: 3.2 })
          .to(q(".hs-scene2"), { autoAlpha: 0, duration: 0.5 })
          .set(q(".hs-scene1"), { scale: 1 });

        // set initial offsets for the label tweens
        gsap.set(q(".hs-label-curve"), { y: 8 });
        gsap.set(q(".hs-label-point"), { x: -8 });
        gsap.set(q(".hs-note"), { y: 10, rotate: 2 });
        gsap.set(q(".hs-fix"), { x: -10 });

        // save battery: pause while the hero is off screen
        const st = ScrollTrigger.create({
          trigger: root.current,
          start: "top bottom",
          end: "bottom top",
          onToggle: (self) => (self.isActive ? tl.resume() : tl.pause()),
        });
        return () => st.kill();
      });
      return () => mm.revert();
    },
    { scope: root },
  );

  return (
    <svg
      ref={root}
      viewBox="0 0 640 440"
      className="landing-reveal block h-auto w-full"
      role="img"
      aria-labelledby="hero-scene-title"
    >
      <title id="hero-scene-title">
        A reasoning curve with a tangent line veering off it, circled in red pen; then a handwritten solution where the
        line &quot;Discount = 20% + 10% = 30%&quot; is circled with the note: successive discounts multiply, 0.8 × 0.9, not 30%.
      </title>

      {/* ── Scene 1: the curve and the tangent ── */}
      <g className="hs-scene1" style={{ opacity: 0, visibility: "hidden" }}>
        <g className="hs-axes hs-fade stroke-ink" strokeOpacity="0.35" strokeWidth="1.5" fill="none" strokeLinecap="round">
          <path d="M34 418 L 614 418" />
          <path d="M34 418 L 34 26" />
          <path d="M606 412 L 616 418 L 606 424" />
          <path d="M28 34 L 34 24 L 40 34" />
        </g>
        <path
          className="hs-curve hs-draw stroke-ink"
          d="M34 400 C 124 392, 200 340, 250 270 C 290 214, 360 130, 612 110"
          fill="none"
          strokeWidth="4.5"
          strokeLinecap="round"
        />
        <path className="hs-tangent stroke-ink" d="M209 327 L 424 26" fill="none" strokeWidth="2.5" strokeLinecap="round" strokeOpacity="0.7" />
        <text className="hs-label-curve hs-fade font-hand fill-ink-soft" x="470" y="152" fontSize="28" transform="rotate(-4 470 152)">
          your reasoning
        </text>
        <text className="hs-label-tangent hs-fade font-hand fill-ink-soft" x="436" y="44" fontSize="28">
          off on a tangent
        </text>
        <path
          className="hs-ring hs-draw stroke-redpen"
          d="M224 256 C 228 234, 270 230, 282 254 C 294 280, 262 302, 236 295 C 212 288, 210 262, 238 246"
          fill="none"
          strokeWidth="3.5"
          strokeLinecap="round"
        />
        <circle className="hs-dot fill-redpen" cx="250" cy="270" r="6.5" />
        <text className="hs-label-point hs-fade font-hand fill-redpen" x="292" y="316" fontSize="30">
          ← the tangent point
        </text>
      </g>

      {/* ── Scene 2: the handwritten solution, marked up (server-rendered end state) ── */}
      <g className="hs-scene2">
        <text className="font-sans fill-ink-soft" x="40" y="52" fontSize="16">
          Q. A ₹2000 jacket gets successive discounts of 20% and 10%.
        </text>
        <text className="font-sans fill-ink-soft" x="40" y="74" fontSize="16">
          What does it sell for?
        </text>
        <g className="font-hand fill-ink" fontSize="36">
          <text className="hs-line" x="44" y="138">
            1.  MP = ₹2000
          </text>
          <text className="hs-line" x="44" y="198">
            2.  Discount = 20% + 10% = 30%
          </text>
          <text className="hs-line" x="44" y="258">
            3.  SP = 2000 × 0.7 = ₹1400
          </text>
        </g>
        <path
          className="hs-sol-ring hs-draw stroke-redpen"
          d="M58 170 C 130 150, 420 146, 484 168 C 516 182, 498 216, 424 222 C 300 232, 108 228, 58 208 C 30 196, 40 176, 96 162"
          fill="none"
          strokeWidth="3.5"
          strokeLinecap="round"
        />
        <path
          className="hs-arrow hs-draw stroke-redpen"
          d="M316 300 C 296 286, 300 254, 330 230 M330 230 L 318 233 M330 230 L 329 242"
          fill="none"
          strokeWidth="3"
          strokeLinecap="round"
        />
        <g className="hs-note hs-fade font-hand fill-redpen" fontSize="30" transform="rotate(-2 330 330)">
          <text x="300" y="330">Successive discounts multiply:</text>
          <text x="300" y="362">0.8 × 0.9, not 30%</text>
        </g>
        <text className="hs-fix hs-fade font-hand fill-redpen" x="44" y="414" fontSize="34">
          SP = 2000 × 0.72 = ₹1440 ✓
        </text>
      </g>
    </svg>
  );
}
