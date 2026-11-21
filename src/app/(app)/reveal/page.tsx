import type { Metadata } from "next";
import { RevealClient } from "./reveal-client";

export const metadata: Metadata = { title: "Your Mastery Map · Tangent" };

export default function RevealPage() {
  return <RevealClient />;
}
