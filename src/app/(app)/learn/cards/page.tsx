import type { Metadata } from "next";
import { CardsClient } from "./cards-client";

export const metadata: Metadata = { title: "Formula flashcards · Tangent" };

export default function CardsPage() {
  return <CardsClient />;
}
