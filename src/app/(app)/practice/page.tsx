import type { Metadata } from "next";
import { PracticeClient } from "./practice-client";

export const metadata: Metadata = { title: "Practice · Tangent" };

export default function PracticePage() {
  return <PracticeClient />;
}
