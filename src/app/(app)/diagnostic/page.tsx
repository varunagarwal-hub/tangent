import type { Metadata } from "next";
import { DiagnosticClient } from "./diagnostic-client";

export const metadata: Metadata = { title: "Diagnostic · Tangent" };

export default function DiagnosticPage() {
  return <DiagnosticClient />;
}
