import type { Metadata } from "next";
import { UnderTheHoodClient } from "./uth-client";

export const metadata: Metadata = { title: "Under the hood · Tangent" };

export default function UnderTheHoodPage() {
  return <UnderTheHoodClient />;
}
