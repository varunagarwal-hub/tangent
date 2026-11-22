import type { Metadata } from "next";
import { SprintClient } from "./sprint-client";

export const metadata: Metadata = { title: "CAT speed sprint · Tangent" };

export default function SprintPage() {
  return <SprintClient />;
}
