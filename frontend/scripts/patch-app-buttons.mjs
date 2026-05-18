import fs from "fs";
import path from "path";

const p = path.join(process.cwd(), "src/app/app/page.tsx");
let s = fs.readFileSync(p, "utf8");

const replacements = [
  [
    `      {/* Focus Chat Button - Floating */}
      <button
        onClick={() => setShowFocusChat(true)}
        className="fixed bottom-6 right-24 z-50 group"
        title="Open Focus Chat"
      >
        <div className="relative">
          <motionlessGlow className="absolute inset-0 bg-violet-500/30 rounded-full blur-xl group-hover:bg-violet-500/50 transition-all animate-pulse-glow"></motionlessGlow>
          <motionlessGlow className="relative w-14 h-14 rounded-full bg-gradient-to-br from-violet-600/90 to-fuchsia-600/90 border-2 border-violet-400/50 shadow-[0_0_20px_rgba(139,92,246,0.45)] flex items-center justify-center hover:scale-110 transition-all duration-300 hover:shadow-[0_0_30px_rgba(139,92,246,0.75)] backdrop-blur-sm">
            <Sparkles size={22} className="text-white group-hover:rotate-12 transition-transform" />
          </motionlessGlow>
          <motionlessGlow className="absolute inset-0 rounded-full border-2 border-violet-400/30 animate-ping"></motionlessGlow>
        </motionlessGlow>
      </button>`,
    `      <AnimatedButton
        onClick={() => setShowFocusChat(true)}
        variant="default"
        size="iconLg"
        glow
        className="fixed bottom-6 right-24 z-50"
        title="Open Focus Chat"
      >
        <Sparkles size={20} className="text-white" />
      </AnimatedButton>`,
  ],
];

// Fix script - use actual div tags in search string
const focusOld = `      {/* Focus Chat Button - Floating */}
      <button
        onClick={() => setShowFocusChat(true)}
        className="fixed bottom-6 right-24 z-50 group"
        title="Open Focus Chat"
      >
        <div className="relative">
          <div className="absolute inset-0 bg-violet-500/30 rounded-full blur-xl group-hover:bg-violet-500/50 transition-all animate-pulse-glow"></div>
          <motionlessGlow className="relative w-14 h-14 rounded-full bg-gradient-to-br from-violet-600/90 to-fuchsia-600/90 border-2 border-violet-400/50 shadow-[0_0_20px_rgba(139,92,246,0.45)] flex items-center justify-center hover:scale-110 transition-all duration-300 hover:shadow-[0_0_30px_rgba(139,92,246,0.75)] backdrop-blur-sm">
            <Sparkles size={22} className="text-white group-hover:rotate-12 transition-transform" />
          </motionlessGlow>
          <motionlessGlow className="absolute inset-0 rounded-full border-2 border-violet-400/30 animate-ping"></motionlessGlow>
        </motionlessGlow>
      </button>`;

// rewrite file properly
const patches = [
  {
    from: `      {/* Focus Chat Button - Floating */}
      <button
        onClick={() => setShowFocusChat(true)}
        className="fixed bottom-6 right-24 z-50 group"
        title="Open Focus Chat"
      >
        <div className="relative">
          <div className="absolute inset-0 bg-violet-500/30 rounded-full blur-xl group-hover:bg-violet-500/50 transition-all animate-pulse-glow"></div>
          <div className="relative w-14 h-14 rounded-full bg-gradient-to-br from-violet-600/90 to-fuchsia-600/90 border-2 border-violet-400/50 shadow-[0_0_20px_rgba(139,92,246,0.45)] flex items-center justify-center hover:scale-110 transition-all duration-300 hover:shadow-[0_0_30px_rgba(139,92,246,0.75)] backdrop-blur-sm">
            <Sparkles size={22} className="text-white group-hover:rotate-12 transition-transform" />
          </div>
          <div className="absolute inset-0 rounded-full border-2 border-violet-400/30 animate-ping"></motionlessGlow>
        </motionlessGlow>
      </button>`,
    to: `      <AnimatedButton
        onClick={() => setShowFocusChat(true)}
        variant="default"
        size="iconLg"
        glow
        className="fixed bottom-6 right-24 z-50"
        title="Open Focus Chat"
      >
        <Sparkles size={20} className="text-white" />
      </AnimatedButton>`,
  },
];

for (const { from, to } of patches) {
  if (!s.includes(from)) {
    console.error("Patch block not found");
    process.exit(1);
  }
  s = s.replace(from, to);
}

fs.writeFileSync(p, s);
console.log("Patched", p);
