import type { Metadata } from "next";
import { FoundationClient } from "./foundation-client";

export const metadata: Metadata = { title: "Foundation check · Tangent" };

export default function FoundationPage() {
  return <FoundationClient />;
}
