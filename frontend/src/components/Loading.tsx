"use client";

import { Terminal } from "lucide-react";

interface LoadingProps {
  message?: string;
  fullScreen?: boolean;
}

export default function Loading({ message = "Loading...", fullScreen = false }: LoadingProps) {
  const content = (
    <div className="flex flex-col items-center justify-center gap-4">
      <div className="relative">
        <div className="w-12 h-12 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
        <div className="absolute inset-0 flex items-center justify-center">
          <Terminal size={20} className="text-indigo-400" />
        </div>
      </div>
      {message && (
        <p className="text-sm text-slate-400 font-medium">{message}</p>
      )}
    </div>
  );

  if (fullScreen) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center">
        {content}
      </div>
    );
  }

  return <div className="py-12">{content}</div>;
}
