"use client";

import React from "react";
import { motion } from "framer-motion";
import FlowArt, { FlowSection } from "@/components/ui/story-scroll";
import { STORY_PANELS, type StoryHeadlineKey, type StoryPanel } from "./story-panels";
import { StoryVisual } from "./StoryVisuals";

const F = {
  serif: "var(--dex-serif)",
  mono: "var(--dex-mono)",
};

function StoryHeadline({ panelKey }: { panelKey: StoryHeadlineKey }) {
  const hClass =
    "text-[clamp(2.25rem,7vw,5.5rem)] font-bold leading-[0.9] uppercase tracking-tight text-white";

  switch (panelKey) {
    case "growing":
      return (
        <h2 className={hClass}>
          Codebases
          <br />
          <span className="text-transparent bg-clip-text bg-gradient-to-b from-white via-slate-300 to-slate-500">
            keep
          </span>
          <br />
          <span className="text-slate-300">growing.</span>
        </h2>
      );
    case "rag":
      return (
        <h2 className={hClass}>
          Vector
          <br />
          search
          <br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-rose-300 via-fuchsia-200 to-violet-300">
            isn&apos;t enough.
          </span>
        </h2>
      );
    case "ast":
      return (
        <h2 className={hClass}>
          <span className="text-transparent bg-clip-text bg-gradient-to-b from-slate-200 via-white to-sky-200">
            AST.
          </span>
          <br />
          Graph.
          <br />
          <span className="text-slate-200">Truth.</span>
        </h2>
      );
    case "citations":
      return (
        <h2 className={hClass}>
          Real
          <br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-200 via-teal-100 to-cyan-200">
            file
          </span>
          <br />
          references.
        </h2>
      );
    case "index":
      return (
        <h2 className={hClass}>
          Index
          <br />
          your
          <br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-white via-slate-200 to-white">
            repo.
          </span>
        </h2>
      );
    default:
      return null;
  }
}

function StoryPanelBody({ panel }: { panel: StoryPanel }) {
  return (
    <div className="grid w-full items-center gap-10 lg:grid-cols-2 lg:gap-14">
      <div data-flow-content className="flex flex-col justify-center">
        <div className="flex items-center justify-between gap-4">
          <p className={`text-[11px] font-bold uppercase tracking-[0.25em] ${panel.labelClass}`}>
            {panel.step} &mdash; {panel.eyebrow}
          </p>
          <p
            className={`hidden font-mono text-[10px] uppercase tracking-widest sm:block ${panel.monoClass}`}
          >
            {panel.mono}
          </p>
        </div>
        <hr className={`my-5 border-none border-t ${panel.borderClass}`} />
        <StoryHeadline panelKey={panel.headlineKey} />
        <hr className={`my-5 border-none border-t ${panel.borderClass}`} />
        <p className="max-w-[52ch] text-[clamp(1rem,1.8vw,1.25rem)] font-light leading-relaxed text-slate-400">
          {panel.lead}
        </p>

        {panel.bullets && panel.bullets.length > 0 && (
          <>
            <hr className={`my-5 border-none border-t ${panel.borderClass}`} />
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
              {panel.bullets.map((b) => (
                <div key={b.title} className="min-w-0">
                  <p className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">
                    {b.title}
                  </p>
                  <p className="text-sm leading-relaxed text-slate-500">{b.body}</p>
                  {b.code && (
                    <p className="mt-1 font-mono text-[11px] text-slate-400">{b.code}</p>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      <div className="lg:pl-2">
        <StoryVisual kind={panel.visual} />
      </div>
    </div>
  );
}

/** Bridge into the pinned scroll */
function StoryIntro() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.6 }}
      className="relative mx-auto max-w-2xl px-6 pb-12 pt-16 text-center"
    >
      <p
        className="text-[11px] font-bold uppercase tracking-[0.28em] text-slate-500"
        style={{ fontFamily: F.mono }}
      >
        Why DEX
      </p>
      <p
        className="mt-3 text-slate-400 text-sm leading-relaxed"
        style={{ fontFamily: F.serif, fontSize: "clamp(18px, 2.2vw, 22px)" }}
      >
        How DEX moves from repository structure to verified, cited answers.
      </p>
    </motion.div>
  );
}

const HomeStoryScroll: React.FC = () => {
  return (
    <div id="story" className="relative scroll-mt-24">
      <StoryIntro />
      <FlowArt embedded id="story-scroll" aria-label="How DEX understands your codebase">
        {STORY_PANELS.map((panel) => (
          <FlowSection
            key={panel.id}
            compact
            aria-label={panel.eyebrow}
            style={{ backgroundColor: panel.bg, color: "#fff" }}
          >
            <StoryPanelBody panel={panel} />
          </FlowSection>
        ))}
      </FlowArt>
    </div>
  );
};

export default HomeStoryScroll;
