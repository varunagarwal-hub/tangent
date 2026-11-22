import type { Metadata } from "next";
import { SpotClient } from "./spot-client";

export const metadata: Metadata = { title: "Spot the Tangent · Tangent" };

export default function SpotPage() {
  return <SpotClient />;
}
