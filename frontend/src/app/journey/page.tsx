import type { Metadata } from "next";
import JourneyView from "@/components/dex/JourneyView";

export const metadata: Metadata = {
  title: "The DEX Journey — From Repo to Grounded Answer",
  description:
    "Watch DEX's five-stage pipeline: ingest source files, parse to AST, link a dependency graph, embed for recall, and answer with file:line citations.",
};

export default function JourneyPage() {
  return <JourneyView />;
}
