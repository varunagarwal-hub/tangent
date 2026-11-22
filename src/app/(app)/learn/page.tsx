import type { Metadata } from "next";
import { lessonIndex } from "@/lib/lessons";
import { LearnIndex } from "./learn-index";

export const metadata: Metadata = { title: "Learn · Tangent" };

export default function LearnPage() {
  return <LearnIndex lessons={lessonIndex()} />;
}
