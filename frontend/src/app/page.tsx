import type { Metadata } from "next";
import DemoHomeView from "@/components/dex/DemoHomeView";

export const metadata: Metadata = {
  title: "DEX — Map-first code intelligence",
  description:
    "Understand any repository at a glance: AST + dependency graph, grounded answers with file:line citations, impact analysis, and team insights.",
  openGraph: {
    title: "DEX — Map-first code intelligence",
    description:
      "Instant intelligence for complex codebases. Index your repo, explore the graph, and ask anything — with citations you can verify.",
    type: "website",
  },
};

export default function HomePage() {
  return <DemoHomeView />;
}
