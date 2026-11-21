import type { Metadata } from "next";
import { MapClient } from "./map-client";

export const metadata: Metadata = { title: "Mastery Map · Tangent" };

export default function MapPage() {
  return <MapClient />;
}
