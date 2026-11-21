import type { Metadata } from "next";
import { StrategyClient } from "./strategy-client";

export const metadata: Metadata = { title: "Strategy · Tangent" };

export default function StrategyPage() {
  return <StrategyClient />;
}
