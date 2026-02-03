"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn, useSession } from "next-auth/react";
import { Terminal, ArrowRight, Github, Lock, Mail, User, X, CheckCircle } from "lucide-react";

// --- ICONS ---
const GoogleIcon = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" xmlns="http://www.w3.org/2000/svg">
    <g transform="matrix(1, 0, 0, 1, 0, 0)">
      <path d="M21.35,11.1H12v3.8h5.6c-0.5,2.1-2.4,3.4-5.6,3.4c-3.3,0-6-2.7-6-6s2.7-6,6-6c1.4,0,2.8,0.5,3.8,1.4l2.7-2.7C16.9,1.7,14.6,0.8,12,0.8c-6.2,0-11.2,5-11.2,11.2s5,11.2,11.2,11.2c6.5,0,10.8-4.5,10.8-10.8C22.8,11.8,21.35,11.1,21.35,11.1z" fill="currentColor" />
    </g>
  </svg>
);

const MicrosoftIcon = () => (
  <svg viewBox="0 0 23 23" width="20" height="20" xmlns="http://www.w3.org/2000/svg">
    <path fill="#f35325" d="M1 1h10v10H1z"/>
    <path fill="#81bc06" d="M12 1h10v10H12z"/>
    <path fill="#05a6f0" d="M1 12h10v10H1z"/>
    <path fill="#ffba08" d="M12 12h10v10H12z"/>
  </svg>
);

// --- SPOTLIGHT CARD ---
const SpotlightCard = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => {
  const divRef = useRef<HTMLDivElement>(null);
  const [isFocused, setIsFocused] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!divRef.current) return;
    const rect = divRef.current.getBoundingClientRect();
    setPosition({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  };

  return (
    <div
      ref={divRef}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setIsFocused(true)}
      onMouseLeave={() => setIsFocused(false)}
      className={`relative overflow-hidden rounded-2xl border border-white/10 bg-[#0a0a0a] ${className}`}
    >
      <div
        className="pointer-events-none absolute -inset-px opacity-0 transition duration-300"
        style={{ opacity: isFocused ? 1 : 0, background: `radial-gradient(600px circle at ${position.x}px ${position.y}px, rgba(99,102,241,0.1), transparent 40%)` }}
      />
      <div
        className="pointer-events-none absolute -inset-px opacity-0 transition duration-300"
        style={{
          opacity: isFocused ? 1 : 0,
          background: `radial-gradient(600px circle at ${position.x}px ${position.y}px, rgba(99,102,241,0.4), transparent 40%)`,
          maskImage: "linear-gradient(black, black) content-box, linear-gradient(black, black)",
          WebkitMaskComposite: "xor",
          maskComposite: "exclude",
        }}
      />
      {children}
    </div>
  );
};

export default function SignupPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  // Redirect if already authenticated
  useEffect(() => {
    if (status === "authenticated" && session?.user) {
      router.push("/app");
    }
  }, [status, session, router]);

  // --- REAL AUTH LOGIC ---
  const handleSocialLogin = async (provider: string) => {
    console.log(`Starting sign up with ${provider}...`); 
    
    // IMPORTANT: Map 'microsoft' to 'azure-ad' because that is the ID NextAuth uses internally
    const providerId = provider === 'microsoft' ? 'azure-ad' : provider;
    
    // Redirect to onboarding after signup
    await signIn(providerId, { callbackUrl: '/onboarding' });
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      
      // Create AbortController for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
      
      try {
        const response = await fetch(`${apiUrl}/api/v1/users/signup`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email,
            password,
            name: name || null,
          }),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ detail: "Signup failed" }));
          const errorMessage = errorData.detail || "Signup failed";
          
          // Check if user already exists
          if (errorMessage.toLowerCase().includes("already exists") || response.status === 400) {
            setError("User already exists. Please try logging in instead.");
            setLoading(false);
            return;
          }
          
          throw new Error(errorMessage);
        }

        setSuccess(true);
        // Wait a moment to show success message, then redirect
        setTimeout(() => {
          router.push('/login?registered=true');
        }, 1500);
      } catch (fetchError: any) {
        clearTimeout(timeoutId);
        if (fetchError.name === 'AbortError') {
          throw new Error("Request timed out. Please check your connection and try again.");
        }
        throw fetchError;
      }
    } catch (err: any) {
      setError(err.message || "Failed to create account. Please try again.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] text-slate-200 font-sans flex flex-col items-center justify-center relative overflow-hidden selection:bg-indigo-500/30 selection:text-white py-20 px-4 sm:px-6">
      
      {/* BACKGROUND */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-indigo-500/10 rounded-full blur-[120px] mix-blend-screen" />
        <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-emerald-500/5 rounded-full blur-[120px] mix-blend-screen" />
      </div>
      <div className="fixed inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:32px_32px] [mask-image:radial-gradient(ellipse_60%_60%_at_50%_50%,#000_70%,transparent_100%)] pointer-events-none z-0" />

      {/* NAV: Close Button */}
      <div className="absolute top-6 right-6 z-50">
        <Link href="/" className="p-2 rounded-full bg-white/5 border border-white/5 text-slate-400 hover:text-white hover:bg-white/10 transition-colors" title="Return Home">
            <X size={20} />
        </Link>
      </div>

      {/* CONTENT */}
      <div className="w-full max-w-md relative z-10 flex flex-col items-center">
        
        {/* Logo */}
        <div className="flex justify-center mb-10">
            <Link href="/" className="flex items-center gap-3 group hover:scale-105 transition-transform duration-300">
                <span className="p-2.5 bg-indigo-500/10 rounded-xl border border-indigo-500/20 shadow-[0_0_15px_rgba(99,102,241,0.3)]">
                    <Terminal className="text-indigo-400" size={24} />
                </span>
                <span className="text-2xl font-bold tracking-[0.2em] text-white">DEX</span>
            </Link>
        </div>

        <SpotlightCard className="shadow-2xl w-full">
            <div className="p-8 relative z-10 backdrop-blur-sm bg-black/40">
                
                <div className="text-center mb-8">
                    <h1 className="text-xl font-semibold text-white mb-2">Create an account</h1>
                    <p className="text-sm text-slate-400">Start mapping your codebase today.</p>
                </div>

                {success ? (
                    <div className="space-y-4 text-center py-8">
                        <div className="flex justify-center">
                            <div className="p-4 bg-emerald-500/20 rounded-full border border-emerald-500/30">
                                <CheckCircle size={32} className="text-emerald-400" />
                            </div>
                        </div>
                        <h2 className="text-lg font-semibold text-white">User Registered!</h2>
                        <p className="text-sm text-slate-400">Redirecting to sign in page...</p>
                    </div>
                ) : (
                    <form className="space-y-4" onSubmit={handleSignup}>
                        {error && (
                            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-xs space-y-2">
                                <p>{error}</p>
                                {error.toLowerCase().includes("already exists") && (
                                    <Link 
                                        href="/login" 
                                        className="inline-block mt-2 text-indigo-400 hover:text-indigo-300 underline text-xs font-medium"
                                    >
                                        Go to Login Page →
                                    </Link>
                                )}
                            </div>
                        )}
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">Full Name</label>
                            <div className="relative group">
                                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-indigo-400 transition-colors">
                                    <User size={16} />
                                </div>
                                <input 
                                    type="text" 
                                    placeholder="Jane Doe"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/50 focus:bg-white/10 transition-all shadow-inner"
                                />
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">Email</label>
                            <div className="relative group">
                                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-indigo-400 transition-colors">
                                    <Mail size={16} />
                                </div>
                                <input 
                                    type="email" 
                                    placeholder="engineer@corp.com"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                    className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/50 focus:bg-white/10 transition-all shadow-inner"
                                />
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">Password</label>
                            <div className="relative group">
                                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-indigo-400 transition-colors">
                                    <Lock size={16} />
                                </div>
                                <input 
                                    type="password" 
                                    placeholder="Create a strong password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                    minLength={6}
                                    className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/50 focus:bg-white/10 transition-all shadow-inner"
                                />
                            </div>
                        </div>

                        <button 
                            type="submit"
                            disabled={loading}
                            className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-bold py-3.5 rounded-xl transition-all shadow-[0_0_20px_rgba(79,70,229,0.3)] hover:shadow-[0_0_30px_rgba(79,70,229,0.5)] hover:-translate-y-0.5 flex items-center justify-center gap-2 mt-4 group"
                        >
                            {loading ? "Creating Account..." : "Get Started"} 
                            {!loading && <ArrowRight size={16} className="group-hover:translate-x-0.5 transition-transform" />}
                        </button>
                    </form>
                )}

                <div className="my-8 flex items-center gap-4">
                    <div className="h-px bg-white/10 flex-1" />
                    <span className="text-[10px] font-bold uppercase tracking-widest text-slate-600">Or</span>
                    <div className="h-px bg-white/10 flex-1" />
                </div>

                <div className="grid grid-cols-3 gap-3">
                    <button 
                        onClick={() => handleSocialLogin('github')} 
                        className="cursor-pointer active:scale-95 flex items-center justify-center py-2.5 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 hover:border-white/20 transition-all text-slate-300 hover:text-white" 
                        title="GitHub"
                    >
                        <Github size={20} />
                    </button>
                    <button 
                        onClick={() => handleSocialLogin('google')} 
                        className="cursor-pointer active:scale-95 flex items-center justify-center py-2.5 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 hover:border-white/20 transition-all text-slate-300 hover:text-white" 
                        title="Google"
                    >
                        <GoogleIcon />
                    </button>
                    <button 
                        onClick={() => handleSocialLogin('microsoft')} 
                        className="cursor-pointer active:scale-95 flex items-center justify-center py-2.5 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 hover:border-white/20 transition-all text-slate-300 hover:text-white" 
                        title="Microsoft"
                    >
                        <MicrosoftIcon />
                    </button>
                </div>
            </div>
            
            <div className="p-5 bg-white/[0.02] border-t border-white/5 space-y-2">
                <p className="text-xs text-slate-500 text-center">
                    Already have an account?{" "}
                    <Link href="/login" className="text-indigo-400 hover:text-indigo-300 font-medium transition-colors">
                        Sign in
                    </Link>
                </p>
                <p className="text-xs text-slate-500 text-center">
                    Need help?{" "}
                    <Link href="/help" className="text-indigo-400 hover:text-indigo-300 font-medium transition-colors">
                        Visit Help Center
                    </Link>
                </p>
            </div>
        </SpotlightCard>
      </div>
    </div>
  );
}