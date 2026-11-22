import type { Metadata } from "next";
import { MockClient } from "./mock-client";

export const metadata: Metadata = { title: "CAT sectional mock · Tangent" };

export default function MockPage() {
  return <MockClient />;
}
