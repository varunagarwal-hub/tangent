import type { Metadata } from "next";
import { TeacherClient } from "./teacher-client";

export const metadata: Metadata = { title: "Teacher dashboard · Tangent" };

export default function TeacherPage() {
  return <TeacherClient />;
}
