"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Terminal, ArrowLeft, Search, Book, MessageSquare, Code, 
  Network, Zap, HelpCircle, ChevronRight, ChevronDown,
  FileText, Settings, Database, GitBranch, BarChart3
} from "lucide-react";

const helpSections = [
  {
    id: "getting-started",
    title: "Getting Started",
    icon: Zap,
    items: [
      {
        question: "How do I ingest a repository?",
        answer: "Navigate to the app dashboard, enter a GitHub repository URL in the input field, and click the ingest button. The system will process the repository in the background and notify you when complete."
      },
      {
        question: "What repositories are supported?",
        answer: "DEX supports public GitHub repositories. Private repositories require authentication. The system processes 80+ file types across major programming languages."
      },
      {
        question: "How long does ingestion take?",
        answer: "Ingestion time depends on repository size. Small repositories (under 100 files) typically take 1-2 minutes, while larger repositories may take 5-10 minutes or more."
      }
    ]
  },
  {
    id: "features",
    title: "Features",
    icon: Code,
    items: [
      {
        question: "How does the AI assistant work?",
        answer: "The AI assistant uses a hybrid RAG (Retrieval-Augmented Generation) approach. It searches your codebase using semantic search, retrieves relevant code context, and uses Groq's Llama 3.3 70B model to generate accurate answers."
      },
      {
        question: "What is Blast Radius analysis?",
        answer: "Blast Radius shows the impact of changing a specific file or function. It visualizes all dependent files and calculates risk scores to help you understand the potential consequences of your changes."
      },
      {
        question: "How does the knowledge graph work?",
        answer: "The knowledge graph visualizes your codebase structure as an interactive tree. Click nodes to expand/collapse, view dependencies, and navigate through your code structure."
      }
    ]
  },
  {
    id: "troubleshooting",
    title: "Troubleshooting",
    icon: Settings,
    items: [
      {
        question: "Ingestion keeps failing",
        answer: "Check that the repository URL is correct and accessible. Ensure you have a stable internet connection. If the repository is private, make sure you're authenticated with the correct permissions."
      },
      {
        question: "Graph not loading",
        answer: "Ensure ingestion has completed successfully. Try refreshing the page. If the issue persists, check your browser console for errors and verify backend connectivity."
      },
      {
        question: "AI responses are slow",
        answer: "AI responses depend on codebase size and query complexity. Large codebases may take 10-30 seconds. Ensure your GROQ_API_KEY is configured correctly."
      }
    ]
  },
  {
    id: "api",
    title: "API & Integration",
    icon: Database,
    items: [
      {
        question: "Is there an API?",
        answer: "Yes! DEX provides a RESTful API. Visit /api/v1/docs when running the backend to see the full API documentation with interactive examples."
      },
      {
        question: "How do I authenticate API requests?",
        answer: "API requests require authentication via the X-User-ID header. This should be set to your user email. For OAuth users, this is handled automatically."
      },
      {
        question: "Can I integrate DEX with CI/CD?",
        answer: "Yes, you can trigger ingestion via API calls in your CI/CD pipeline. See the API documentation for endpoint details."
      }
    ]
  }
];

export default function HelpPage() {
  const [openSection, setOpenSection] = useState<string | null>(null);
  const [openItem, setOpenItem] = useState<string | null>(null);

  return (
    <div className="min-h-screen bg-[#050505] text-slate-200">
      {/* Background Effects */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-indigo-500/10 rounded-full blur-[120px] mix-blend-screen" />
        <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-emerald-500/5 rounded-full blur-[120px] mix-blend-screen" />
      </div>

      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 border-b border-white/5 bg-[#050505]/80 backdrop-blur-sm">
        <div className="mx-auto max-w-7xl px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 group hover:scale-105 transition-transform">
            <span className="p-2.5 bg-indigo-500/10 rounded-xl border border-indigo-500/20">
              <ArrowLeft size={16} className="text-indigo-400" />
            </span>
            <span className="text-sm font-semibold text-slate-300">Back to Home</span>
          </Link>
          <Link href="/" className="flex items-center gap-3 group hover:opacity-80 transition-opacity">
            <div className="p-1.5 bg-indigo-500/10 rounded-lg border border-indigo-500/20 shadow-[0_0_15px_rgba(99,102,241,0.2)] group-hover:border-indigo-500/40 transition-colors">
              <Terminal className="text-indigo-500" size={16} />
            </div>
            <span className="text-sm font-bold text-white tracking-widest">DEX</span>
          </Link>
        </div>
      </header>

      <main className="relative pt-24 pb-20 max-w-4xl mx-auto px-6">
        <div className="mb-12 text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 mb-6">
            <HelpCircle size={40} className="text-indigo-400" />
          </div>
          <h1 className="text-4xl font-bold text-white mb-4">Help & Documentation</h1>
          <p className="text-slate-400 text-lg">
            Everything you need to know about using DEX
          </p>
        </div>

        {/* Quick Links */}
        <div className="grid md:grid-cols-3 gap-4 mb-12">
          {[
            { icon: Book, label: "Documentation", href: "#getting-started" },
            { icon: MessageSquare, label: "Contact Support", href: "/grievance" },
            { icon: Settings, label: "Settings", href: "/settings" },
          ].map((link) => {
            const Icon = link.icon;
            return (
              <Link
                key={link.label}
                href={link.href}
                className="p-4 rounded-xl border border-white/10 bg-[#0A0A0A] hover:border-indigo-500/30 transition-all group"
              >
                <Icon size={24} className="text-indigo-400 mb-2 group-hover:scale-110 transition-transform" />
                <p className="text-sm font-medium text-white">{link.label}</p>
              </Link>
            );
          })}
        </div>

        {/* FAQ Sections */}
        <div className="space-y-4">
          {helpSections.map((section) => {
            const Icon = section.icon;
            const isOpen = openSection === section.id;
            return (
              <div key={section.id} className="rounded-xl border border-white/10 bg-[#0A0A0A] overflow-hidden">
                <button
                  onClick={() => setOpenSection(isOpen ? null : section.id)}
                  className="w-full flex items-center justify-between p-6 hover:bg-white/5 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="p-2.5 bg-indigo-500/10 rounded-lg border border-indigo-500/20">
                      <Icon size={20} className="text-indigo-400" />
                    </div>
                    <h2 className="text-xl font-bold text-white">{section.title}</h2>
                  </div>
                  {isOpen ? (
                    <ChevronDown size={20} className="text-slate-400" />
                  ) : (
                    <ChevronRight size={20} className="text-slate-400" />
                  )}
                </button>
                
                {isOpen && (
                  <div className="border-t border-white/10 p-6 space-y-4">
                    {section.items.map((item, index) => {
                      const itemId = `${section.id}-${index}`;
                      const isItemOpen = openItem === itemId;
                      return (
                        <div key={itemId} className="rounded-lg border border-white/5 bg-white/5 overflow-hidden">
                          <button
                            onClick={() => setOpenItem(isItemOpen ? null : itemId)}
                            className="w-full flex items-center justify-between p-4 hover:bg-white/5 transition-colors text-left"
                          >
                            <span className="text-sm font-medium text-white flex-1">{item.question}</span>
                            {isItemOpen ? (
                              <ChevronDown size={16} className="text-slate-400 flex-shrink-0 ml-4" />
                            ) : (
                              <ChevronRight size={16} className="text-slate-400 flex-shrink-0 ml-4" />
                            )}
                          </button>
                          {isItemOpen && (
                            <div className="px-4 pb-4 border-t border-white/5 pt-4">
                              <p className="text-sm text-slate-300 leading-relaxed">{item.answer}</p>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Additional Resources */}
        <div className="mt-12 p-6 rounded-xl border border-indigo-500/20 bg-indigo-500/5">
          <h3 className="text-lg font-bold text-white mb-4">Still need help?</h3>
          <p className="text-sm text-slate-300 mb-4">
            Can't find what you're looking for? Reach out to our support team.
          </p>
          <Link
            href="/grievance"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition-all"
          >
            <MessageSquare size={16} />
            Contact Support
          </Link>
        </div>
      </main>
    </div>
  );
}
