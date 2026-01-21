"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn, useSession } from "next-auth/react"; 
import { Terminal, ArrowRight, Github, Lock, Mail, X } from "lucide-react";

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
        style={{ opacity: isFocused ? 1 : 0, background: `radial-gradient(600px circle at ${position.x}px ${position.y}px, rgba(99,102,241,0.15), transparent 40%)` }}
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

export default function LoginPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showRegisteredMessage, setShowRegisteredMessage] = useState(false);
  
  // Check for registration success message
  useEffect(() => {
    const registered = searchParams.get('registered') === 'true';
    if (registered) {
      setShowRegisteredMessage(true);
      // Hide message after 3 seconds
      const timer = setTimeout(() => {
        setShowRegisteredMessage(false);
        // Clean up URL without page reload
        router.replace('/login', { scroll: false });
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [searchParams, router]);

  // Check profile completion and redirect if needed
  useEffect(() => {
    const checkProfileAndRedirect = async () => {
      if (status === "authenticated" && session?.user?.email) {
        try {
          const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
          const response = await fetch(`${apiUrl}/api/v1/users/email/${encodeURIComponent(session.user.email)}`);
          
          if (response.ok) {
            const userData = await response.json();
            if (!userData.profile_completed) {
              router.push("/onboarding");
            } else {
              router.push("/app");
            }
          } else {
            // User doesn't exist, redirect to onboarding
            router.push("/onboarding");
          }
        } catch (error) {
          console.error("Failed to check profile:", error);
          // On error, still redirect to onboarding to be safe
          router.push("/onboarding");
        }
      }
    };
    
    checkProfileAndRedirect();
  }, [status, session, router]);
  
  // --- REAL AUTH LOGIC ---
  const handleSocialLogin = async (provider: string) => {
    console.log(`Starting login with ${provider}...`); 
    
    // IMPORTANT: Map 'microsoft' to 'azure-ad' because that is the ID NextAuth uses internally
    const providerId = provider === 'microsoft' ? 'azure-ad' : provider;
    
    await signIn(providerId, { callbackUrl: '/onboarding' });
  };

  const handleCredentialsLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const result = await signIn('credentials', {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        setError('Invalid email or password');
      } else if (result?.ok) {
        // Success - the useEffect will handle redirect
        router.push('/onboarding');
      }
    } catch (err: any) {
      setError(err.message || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Get user's first name or username
  const getUserDisplayName = () => {
    if (!session?.user) return "";
    const name = session.user.name || session.user.email || "";
    // Extract first name if full name is provided
    const firstName = name.split(" ")[0];
    return firstName || name;
  };

  const isLoggedIn = status === "authenticated" && session?.user;

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

        {/* Card */}
        <SpotlightCard className="shadow-2xl w-full">
            <div className="p-8 relative z-10 backdrop-blur-sm bg-black/40">
                
                <div className="text-center mb-8">
                    <h1 className="text-xl font-semibold text-white mb-2">
                        {isLoggedIn ? `Welcome back, ${getUserDisplayName()}` : "Welcome back"}
                    </h1>
                    <p className="text-sm text-slate-400">
                        {isLoggedIn ? "You're already signed in. Continue to the app?" : "Enter your credentials to access the graph."}
                    </p>
                    {isLoggedIn && (
                        <div className="mt-4">
                            <p className="text-xs text-slate-500 mb-3">Checking your profile...</p>
                        </div>
                    )}
                </div>

                {!isLoggedIn && (
                <>
                    {showRegisteredMessage && (
                        <div className="mb-4 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs text-center">
                            User registered successfully! Please sign in.
                        </div>
                    )}
                    <form className="space-y-5" onSubmit={handleCredentialsLogin}>
                        {error && (
                            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-xs">
                                {error}
                            </div>
                        )}
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
                            <div className="flex justify-between items-center ml-1">
                                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Password</label>
                                <a href="#" className="text-[10px] text-indigo-400 hover:text-indigo-300 transition-colors">Forgot?</a>
                            </div>
                            <div className="relative group">
                                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-indigo-400 transition-colors">
                                    <Lock size={16} />
                                </div>
                                <input 
                                    type="password" 
                                    placeholder="••••••••"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                    className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/50 focus:bg-white/10 transition-all shadow-inner"
                                />
                            </div>
                        </div>

                        <button 
                            type="submit"
                            disabled={loading}
                            className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-bold py-3.5 rounded-xl transition-all shadow-[0_0_20px_rgba(79,70,229,0.3)] hover:shadow-[0_0_30px_rgba(79,70,229,0.5)] hover:-translate-y-0.5 flex items-center justify-center gap-2 mt-6 group"
                        >
                            {loading ? "Signing In..." : "Sign In"} 
                            {!loading && <ArrowRight size={16} className="group-hover:translate-x-0.5 transition-transform" />}
                        </button>
                    </form>
                </>
                )}

                {!isLoggedIn && (
                <>
                <div className="my-8 flex items-center gap-4">
                    <div className="h-px bg-white/10 flex-1" />
                    <span className="text-[10px] font-bold uppercase tracking-widest text-slate-600">Or continue with</span>
                    <div className="h-px bg-white/10 flex-1" />
                </div>

                {/* SOCIAL BUTTONS */}
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
                </>
                )}
            </div>
            
            <div className="p-5 bg-white/[0.02] border-t border-white/5 text-center">
                <p className="text-xs text-slate-500">
                    Don't have an account?{" "}
                    <Link href="/signup" className="text-indigo-400 hover:text-indigo-300 font-medium transition-colors">
                        Sign up
                    </Link>
                </p>
            </div>
        </SpotlightCard>
      </div>
    </div>
  );
}