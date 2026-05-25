"use client";

import { useState, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";

// Global Styles for Animations
const GlobalStyles = () => (
  <style jsx global>{`
    @keyframes fade-in-up { 
      0% { opacity: 0; transform: translate3d(0, 20px, 0); } 
      100% { opacity: 1; transform: translate3d(0, 0, 0); } 
    }
    .animate-fade-in { 
      animation: fade-in-up 0.6s cubic-bezier(0.4, 0, 0.2, 1) forwards; 
      opacity: 0;
    }
    .hover-lift {
      transition: transform 0.2s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    }
    .hover-lift:hover {
      transform: translate3d(0, -4px, 0);
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4);
    }
  `}</style>
);
import { messageFromApiErrorBody, publicApiUrl } from "@/lib/api";
import {
  Github, Edit2, Save, X, User, Mail, Building2, Briefcase,
  Calendar, FileText, GitBranch, GitCommit, Code, TreePine,
  Activity, TrendingUp, Sparkles, Star, GitMerge, Clock,
  CheckCircle, AlertCircle, ArrowLeft, Settings as SettingsIcon
} from "lucide-react";

interface UserProfile {
  id: string;
  email: string;
  name: string | null;
  age: number | null;
  company: string | null;
  role: string | null;
  bio: string | null;
  github_username: string | null;
  profile_completed: boolean;
  is_active: boolean;
  last_login: string | null;
  created_at: string | null;
  updated_at: string | null;
}

interface GitHubContributions {
  contributions: number[];
  total_contributions: number;
  repositories_count: number;
}

interface GitHubStats {
  username: string;
  name: string;
  bio: string;
  avatar_url: string;
  public_repos: number;
  followers: number;
  following: number;
  total_stars: number;
  total_forks: number;
  languages: Record<string, number>;
}

interface ContributionFolder {
  name: string;
  commits: number;
  files: number;
  color: string;
}

interface ActivityItem {
  type: string;
  message: string;
  time: string;
  repo: string;
}

// GitHub-style Contribution Graph Component
const ContributionGraph = ({ contributions, loading }: { contributions: number[] | null; loading: boolean }) => {
  const weeks = 52;
  const daysPerWeek = 7;
  const totalDays = weeks * daysPerWeek;
  const [hoveredDay, setHoveredDay] = useState<number | null>(null);
  
  // Use real data or generate placeholder
  const contributionData = contributions || Array(totalDays).fill(0);
  
  const getIntensity = (count: number) => {
    if (count === 0) return "bg-slate-800";
    if (count === 1) return "bg-emerald-500/20";
    if (count === 2) return "bg-emerald-500/40";
    return "bg-emerald-500/60";
  };
  
  return (
    <div className="rounded-xl border border-white/10 bg-[#0A0A0A] p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
          <Activity size={16} className="text-indigo-400" />
          Contribution Activity
        </h3>
        <span className="text-xs text-slate-500">Last {weeks} weeks</span>
      </div>
      {loading ? (
        <div className="flex items-center justify-center h-32">
          <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="flex gap-1 overflow-x-auto pb-2">
          {Array.from({ length: weeks }).map((_, weekIndex) => (
            <div key={weekIndex} className="flex flex-col gap-1">
              {Array.from({ length: daysPerWeek }).map((_, dayIndex) => {
                const dayNum = weekIndex * daysPerWeek + dayIndex;
                const count = contributionData[dayNum] || 0;
                return (
                  <div
                    key={dayIndex}
                    className={`w-3 h-3 rounded ${getIntensity(count)} border border-white/5 transition-all hover:scale-125 hover:border-indigo-500/50 cursor-pointer`}
                    onMouseEnter={() => setHoveredDay(dayNum)}
                    onMouseLeave={() => setHoveredDay(null)}
                    title={`${count} contribution${count !== 1 ? 's' : ''} on ${new Date(Date.now() - (totalDays - dayNum - 1) * 24 * 60 * 60 * 1000).toLocaleDateString()}`}
                  />
                );
              })}
            </div>
          ))}
        </div>
      )}
      <div className="flex items-center justify-between mt-4 text-xs text-slate-500">
        <span>Less</span>
        <div className="flex gap-1">
          <div className="w-3 h-3 rounded bg-slate-800 border border-white/5" />
          <div className="w-3 h-3 rounded bg-emerald-500/20 border border-white/5" />
          <div className="w-3 h-3 rounded bg-emerald-500/40 border border-white/5" />
          <div className="w-3 h-3 rounded bg-emerald-500/60 border border-white/5" />
        </div>
        <span>More</span>
      </div>
    </div>
  );
};

// Codebase Contribution Tree
const ContributionTree = ({ folders, loading }: { folders: ContributionFolder[] | null; loading: boolean }) => {
  const treeData = folders || [];
  const maxCommits = treeData.length > 0 ? Math.max(...treeData.map(f => f.commits)) : 1;
  
  return (
    <div className="rounded-xl border border-white/10 bg-[#0A0A0A] p-6">
      <div className="flex items-center gap-2 mb-4">
        <TreePine size={18} className="text-indigo-400" />
        <h3 className="text-sm font-semibold text-white">Codebase Contributions</h3>
      </div>
      {loading ? (
        <div className="flex items-center justify-center h-32">
          <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : treeData.length > 0 ? (
        <div className="space-y-3">
          {treeData.map((folder, index) => (
            <div
              key={folder.name}
              className="animate-fade-in delay-100"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded"
                    style={{ backgroundColor: folder.color }}
                  />
                  <span className="text-sm font-mono text-slate-300">{folder.name}/</span>
                </div>
                <div className="flex items-center gap-4 text-xs text-slate-500">
                  <span className="flex items-center gap-1">
                    <GitCommit size={12} />
                    {folder.commits}
                  </span>
                  <span className="flex items-center gap-1">
                    <Code size={12} />
                    {folder.files}
                  </span>
                </div>
              </div>
              <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${(folder.commits / maxCommits) * 100}%`,
                    backgroundColor: folder.color,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-slate-500 text-center py-8">No contribution data available</p>
      )}
    </div>
  );
};

// Stats Cards
const StatsCard = ({ icon: Icon, label, value, color }: { icon: any; label: string; value: string | number; color: string }) => (
  <div className="rounded-xl border border-white/10 bg-[#0A0A0A] p-4 hover:border-indigo-500/30 transition-all hover-lift">
    <div className="flex items-center justify-between mb-2">
      <Icon size={18} className={color} />
      <span className="text-2xl font-bold text-white">{value}</span>
    </div>
    <p className="text-xs text-slate-500">{label}</p>
  </div>
);

export default function ProfilePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  
  const [editData, setEditData] = useState({
    name: "",
    age: "",
    company: "",
    role: "",
    bio: "",
    github_username: "",
  });

  // GitHub data state
  const [githubContributions, setGithubContributions] = useState<number[] | null>(null);
  const [githubStats, setGithubStats] = useState<GitHubStats | null>(null);
  const [contributionTree, setContributionTree] = useState<ContributionFolder[] | null>(null);
  const [githubActivity, setGithubActivity] = useState<ActivityItem[] | null>(null);
  const [loadingGithub, setLoadingGithub] = useState(false);

  // Redirect if not authenticated
  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  // Fetch user profile
  useEffect(() => {
    const fetchProfile = async () => {
      if (!session?.user) return;

      if (!session.user.email) {
        setLoading(false);
        setError("Your account has no email on file. Try signing out and back in.");
        return;
      }

      try {
        setLoading(true);
        setError(null);
        const response = await fetch(
          publicApiUrl(`users/email/${encodeURIComponent(session.user.email)}`)
        );

        if (response.ok) {
          const data = await response.json();
          setProfile(data);
          setEditData({
            name: data.name || "",
            age: data.age?.toString() || "",
            company: data.company || "",
            role: data.role || "",
            bio: data.bio || "",
            github_username: data.github_username || "",
          });
        } else {
          const detail = await response.text();
          setError(
            response.status === 404
              ? "No profile found for this account yet. The backend may still be provisioning your user."
              : `Could not load profile (${response.status}). ${detail.slice(0, 120)}`
          );
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Failed to load profile";
        setError(
          `${message} — check NEXT_PUBLIC_API_URL and that the API is running.`
        );
      } finally {
        setLoading(false);
      }
    };

    if (session?.user) {
      fetchProfile();
    }
  }, [session]);

  // Fetch GitHub data when profile is loaded and has GitHub username
  useEffect(() => {
    const fetchGithubData = async () => {
      if (!profile?.github_username || !profile?.id) return;
      
      try {
        setLoadingGithub(true);
        // Fetch all GitHub data in parallel
        const [contributionsRes, statsRes, treeRes, activityRes] = await Promise.allSettled([
          fetch(publicApiUrl(`users/${encodeURIComponent(profile.id)}/github/contributions`)),
          fetch(publicApiUrl(`users/${encodeURIComponent(profile.id)}/github/stats`)),
          fetch(publicApiUrl(`users/${encodeURIComponent(profile.id)}/github/contribution-tree`)),
          fetch(publicApiUrl(`users/${encodeURIComponent(profile.id)}/github/activity?limit=10`)),
        ]);
        
        if (contributionsRes.status === "fulfilled" && contributionsRes.value.ok) {
          const contributionsData = await contributionsRes.value.json();
          setGithubContributions(contributionsData.contributions || []);
        }
        
        if (statsRes.status === "fulfilled" && statsRes.value.ok) {
          const statsData = await statsRes.value.json();
          setGithubStats(statsData);
        }
        
        if (treeRes.status === "fulfilled" && treeRes.value.ok) {
          const treeData = await treeRes.value.json();
          setContributionTree(treeData.folders || []);
        }
        
        if (activityRes.status === "fulfilled" && activityRes.value.ok) {
          const activityData = await activityRes.value.json();
          setGithubActivity(activityData.activity || []);
        }
      } catch (err: any) {
        console.error("Failed to fetch GitHub data:", err);
        // Don't show error to user, just log it
      } finally {
        setLoadingGithub(false);
      }
    };

    if (profile?.github_username) {
      fetchGithubData();
    }
  }, [profile?.github_username, profile?.id]);

  const handleSave = async () => {
    if (!session?.user?.email || !profile) return;
    
    try {
      setSaving(true);
      setError(null);
      setSuccess(false);
      
      const response = await fetch(
        publicApiUrl(`users/${encodeURIComponent(profile.id)}`),
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: editData.name || null,
            age: editData.age ? parseInt(editData.age) : null,
            company: editData.company || null,
            role: editData.role || null,
            bio: editData.bio || null,
            github_username: editData.github_username || null,
          }),
        }
      );

      if (response.ok) {
        const updated = await response.json();
        setProfile(updated);
        setIsEditing(false);
        setSuccess(true);
        setTimeout(() => setSuccess(false), 3000);
      } else {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(messageFromApiErrorBody(errorData, "Failed to save profile"));
      }
    } catch (err: any) {
      setError(err.message || "Failed to save profile");
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    if (profile) {
      setEditData({
        name: profile.name || "",
        age: profile.age?.toString() || "",
        company: profile.company || "",
        role: profile.role || "",
        bio: profile.bio || "",
        github_username: profile.github_username || "",
      });
    }
    setIsEditing(false);
    setError(null);
  };

  if (status === "loading" || (status === "authenticated" && loading)) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (status === "unauthenticated" || !session?.user) {
    return null;
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-[#050505] text-slate-200 flex flex-col items-center justify-center px-6">
        <div className="max-w-md w-full rounded-2xl border border-white/10 bg-[#0a0a0c] p-8 text-center space-y-4">
          <h1 className="text-lg font-semibold text-white">Profile unavailable</h1>
          <p className="text-sm text-slate-400 leading-relaxed">
            {error ||
              "We couldn’t load your profile from the API. This page used to go blank — here’s what went wrong instead."}
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
            <button
              type="button"
              onClick={() => {
                setError(null);
                setLoading(true);
                void (async () => {
                  if (!session.user?.email) return;
                  try {
                    const response = await fetch(
                      publicApiUrl(`users/email/${encodeURIComponent(session.user.email)}`)
                    );
                    if (response.ok) {
                      const data = await response.json();
                      setProfile(data);
                      setEditData({
                        name: data.name || "",
                        age: data.age?.toString() || "",
                        company: data.company || "",
                        role: data.role || "",
                        bio: data.bio || "",
                        github_username: data.github_username || "",
                      });
                      setError(null);
                    } else {
                      setError(`Still failing (${response.status}). Check API / user record.`);
                    }
                  } catch (e: unknown) {
                    setError(e instanceof Error ? e.message : "Retry failed");
                  } finally {
                    setLoading(false);
                  }
                })();
              }}
              className="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-500"
            >
              Retry
            </button>
            <Link
              href="/app"
              className="rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-medium text-slate-200 hover:bg-white/10"
            >
              Back to app
            </Link>
            <Link href="/" className="rounded-xl border border-white/15 px-4 py-2.5 text-sm font-medium text-slate-400 hover:text-white hover:bg-white/5">
              Home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] text-slate-200">
      <GlobalStyles />
      {/* Background Effects */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-indigo-500/10 rounded-full blur-[120px] mix-blend-screen" />
        <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-emerald-500/5 rounded-full blur-[120px] mix-blend-screen" />
      </div>
      <div className="fixed inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:32px_32px] [mask-image:radial-gradient(ellipse_60%_60%_at_50%_50%,#000_70%,transparent_100%)] pointer-events-none z-0" />

      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 border-b border-white/5 bg-[#050505]/80 backdrop-blur-sm">
        <div className="mx-auto max-w-7xl px-6 h-16 flex items-center justify-between">
          <Link href="/app" className="flex items-center gap-3 group hover:scale-105 transition-transform">
            <span className="p-2.5 bg-indigo-500/10 rounded-xl border border-indigo-500/20">
              <ArrowLeft size={16} className="text-indigo-400" />
            </span>
            <span className="text-sm font-semibold text-slate-300">Back to app</span>
          </Link>
          <div className="flex items-center gap-3">
            {success && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
                <CheckCircle size={14} className="text-emerald-400" />
                <span className="text-xs text-emerald-400">Profile saved!</span>
              </div>
            )}
            <Link
              href="/settings"
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 text-xs font-semibold transition-all"
            >
              <SettingsIcon size={14} />
              Settings
            </Link>
            {!isEditing ? (
              <button
                onClick={() => setIsEditing(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-all"
              >
                <Edit2 size={14} />
                Edit Profile
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  onClick={handleCancel}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 text-xs font-semibold transition-all"
                >
                  <X size={14} />
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-all disabled:opacity-50"
                >
                  <Save size={14} />
                  {saving ? "Saving..." : "Save"}
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="relative pt-24 pb-20 max-w-7xl mx-auto px-6">
        {/* Profile Header */}
        <div className="mb-8 animate-fade-in">
          <div className="flex items-start gap-6">
            {/* Avatar */}
            <div className="relative">
              <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border-2 border-indigo-500/30 flex items-center justify-center">
                <User size={40} className="text-indigo-400" />
              </div>
              <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-emerald-500 border-2 border-[#050505] flex items-center justify-center">
                <CheckCircle size={12} className="text-white" />
              </div>
            </div>

            {/* User Info */}
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-3xl font-bold text-white">
                  {isEditing ? (
                    <input
                      type="text"
                      value={editData.name}
                      onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                      className="bg-white/5 border border-white/10 rounded-lg px-3 py-1 text-3xl font-bold text-white focus:outline-none focus:border-indigo-500/50"
                      placeholder="Your Name"
                    />
                  ) : (
                    profile.name || "Anonymous User"
                  )}
                </h1>
                {profile.is_active && (
                  <span className="px-2 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-400">
                    Active
                  </span>
                )}
              </div>
              <p className="text-slate-400 mb-4 flex items-center gap-2">
                <Mail size={14} />
                {profile.email}
              </p>
              {isEditing ? (
                <textarea
                  value={editData.bio}
                  onChange={(e) => setEditData({ ...editData, bio: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-300 focus:outline-none focus:border-indigo-500/50 resize-none"
                  placeholder="Tell us about yourself..."
                  rows={3}
                />
              ) : (
                <p className="text-slate-300 text-sm">
                  {profile.bio || "No bio yet. Click Edit Profile to add one."}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center gap-2 animate-fade-in">
            <AlertCircle size={16} className="text-red-400" />
            <span className="text-sm text-red-400">{error}</span>
          </div>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <StatsCard
            icon={GitCommit}
            label="Total Commits"
            value={githubContributions ? githubContributions.reduce((a, b) => a + b, 0) : githubStats?.total_stars || 0}
            color="text-indigo-400"
          />
          <StatsCard
            icon={Code}
            label="Repositories"
            value={githubStats?.public_repos || 0}
            color="text-emerald-400"
          />
          <StatsCard
            icon={Star}
            label="Total Stars"
            value={githubStats?.total_stars || 0}
            color="text-yellow-400"
          />
          <StatsCard
            icon={GitBranch}
            label="Forks"
            value={githubStats?.total_forks || 0}
            color="text-purple-400"
          />
        </div>

        {/* Main Content Grid */}
        <div className="grid md:grid-cols-3 gap-6">
          {/* Left Column - Profile Details */}
          <div className="md:col-span-1 space-y-6">
            {/* Profile Information */}
            <div className="rounded-xl border border-white/10 bg-[#0A0A0A] p-6">
              <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                <User size={16} className="text-indigo-400" />
                Profile Information
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">Company</label>
                  {isEditing ? (
                    <input
                      type="text"
                      value={editData.company}
                      onChange={(e) => setEditData({ ...editData, company: e.target.value })}
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500/50"
                      placeholder="Your Company"
                    />
                  ) : (
                    <p className="text-sm text-slate-300 flex items-center gap-2">
                      <Building2 size={14} className="text-slate-500" />
                      {profile.company || "Not specified"}
                    </p>
                  )}
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">Role</label>
                  {isEditing ? (
                    <input
                      type="text"
                      value={editData.role}
                      onChange={(e) => setEditData({ ...editData, role: e.target.value })}
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500/50"
                      placeholder="Your Role"
                    />
                  ) : (
                    <p className="text-sm text-slate-300 flex items-center gap-2">
                      <Briefcase size={14} className="text-slate-500" />
                      {profile.role || "Not specified"}
                    </p>
                  )}
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">Age</label>
                  {isEditing ? (
                    <input
                      type="number"
                      value={editData.age}
                      onChange={(e) => setEditData({ ...editData, age: e.target.value })}
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500/50"
                      placeholder="Your Age"
                    />
                  ) : (
                    <p className="text-sm text-slate-300 flex items-center gap-2">
                      <Calendar size={14} className="text-slate-500" />
                      {profile.age || "Not specified"}
                    </p>
                  )}
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">Member Since</label>
                  <p className="text-sm text-slate-300 flex items-center gap-2">
                    <Clock size={14} className="text-slate-500" />
                    {profile.created_at
                      ? new Date(profile.created_at).toLocaleDateString()
                      : "N/A"}
                  </p>
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">Last Login</label>
                  <p className="text-sm text-slate-300 flex items-center gap-2">
                    <Activity size={14} className="text-slate-500" />
                    {profile.last_login
                      ? new Date(profile.last_login).toLocaleDateString()
                      : "Never"}
                  </p>
                </div>
              </div>
            </div>

            {/* GitHub Integration */}
            <div className="rounded-xl border border-white/10 bg-[#0A0A0A] p-6">
              <div className="flex items-center gap-2 mb-4">
                <Github size={18} className="text-indigo-400" />
                <h3 className="text-sm font-semibold text-white">GitHub</h3>
              </div>
              {profile.github_username ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
                    <div className="flex items-center gap-2">
                      <CheckCircle size={14} className="text-emerald-400" />
                      <span className="text-sm text-emerald-400 font-medium">@{profile.github_username}</span>
                    </div>
                  </div>
                  {isEditing ? (
                    <input
                      type="text"
                      value={editData.github_username}
                      onChange={(e) => setEditData({ ...editData, github_username: e.target.value })}
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500/50"
                      placeholder="GitHub Username"
                    />
                  ) : (
                    <a
                      href={`https://github.com/${profile.github_username}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block w-full px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-sm text-slate-300 transition-all flex items-center justify-center gap-2"
                    >
                      <Github size={14} />
                      View on GitHub
                    </a>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  {isEditing ? (
                    <div className="space-y-2">
                      <input
                        type="text"
                        value={editData.github_username}
                        onChange={(e) => setEditData({ ...editData, github_username: e.target.value })}
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500/50"
                        placeholder="Enter GitHub Username"
                      />
                      <p className="text-xs text-slate-400 leading-relaxed">
                        Enter your GitHub username to import your repositories, contributions, and activity data.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="p-4 rounded-lg bg-indigo-500/10 border border-indigo-500/20">
                        <div className="flex items-start gap-3">
                          <div className="mt-0.5">
                            <Github size={16} className="text-indigo-400" />
                          </div>
                          <div className="flex-1 space-y-2">
                            <p className="text-sm font-medium text-white">Connect Your GitHub</p>
                            <p className="text-xs text-slate-400 leading-relaxed">
                              Click on <span className="text-indigo-400 font-semibold">Edit Profile</span> above and add your GitHub username to import your repositories, contributions, and activity data.
                            </p>
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => setIsEditing(true)}
                        className="w-full px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-sm text-white font-medium transition-all flex items-center justify-center gap-2"
                      >
                        <Edit2 size={14} />
                        Go to Edit Profile
                      </button>
                      <p className="text-xs text-slate-500 text-center">
                        Or sign in with GitHub to automatically connect
                      </p>
                      <button
                        onClick={() => router.push("/login")}
                        className="w-full px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-sm text-slate-300 transition-all flex items-center justify-center gap-2"
                      >
                        <Github size={14} />
                        Sign in with GitHub
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Right Column - Activity & Contributions */}
          <div className="md:col-span-2 space-y-6">
            {profile.github_username ? (
              <>
                <ContributionGraph contributions={githubContributions} loading={loadingGithub} />
                <ContributionTree folders={contributionTree} loading={loadingGithub} />
              </>
            ) : (
              <div className="rounded-xl border border-white/10 bg-[#0A0A0A] p-8 text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-indigo-500/10 border border-indigo-500/20 mb-4">
                  <Github size={32} className="text-indigo-400" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">Connect Your GitHub</h3>
                <p className="text-sm text-slate-400 mb-4 max-w-md mx-auto">
                  Import your repositories, contributions, and activity data to get insights into your coding journey.
                </p>
                <div className="flex flex-col sm:flex-row gap-3 justify-center items-center">
                  <button
                    onClick={() => setIsEditing(true)}
                    className="px-6 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-sm text-white font-medium transition-all flex items-center gap-2"
                  >
                    <Edit2 size={14} />
                    Edit Profile & Add Username
                  </button>
                  <button
                    onClick={() => router.push("/login")}
                    className="px-6 py-2.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-sm text-slate-300 transition-all flex items-center gap-2"
                  >
                    <Github size={14} />
                    Sign in with GitHub
                  </button>
                </div>
                <p className="text-xs text-slate-500 mt-4">
                  Click <span className="text-indigo-400 font-semibold">Edit Profile</span> in the header, then add your GitHub username
                </p>
              </div>
            )}
            
            {/* Recent Activity */}
            <div className="rounded-xl border border-white/10 bg-[#0A0A0A] p-6">
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp size={18} className="text-indigo-400" />
                <h3 className="text-sm font-semibold text-white">Recent Activity</h3>
              </div>
              {loadingGithub ? (
                <div className="flex items-center justify-center py-8">
                  <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : githubActivity && githubActivity.length > 0 ? (
                <div className="space-y-3">
                  {githubActivity.map((activity, index) => {
                    const timeAgo = new Date(activity.time).toLocaleDateString();
                    const colors: Record<string, string> = {
                      push: "#10b981",
                      pullrequest: "#8b5cf6",
                      issue: "#3b82f6",
                      create: "#f59e0b",
                    };
                    const color = colors[activity.type] || "#6366f1";
                    
                    return (
                      <div
                        key={index}
                        className="flex items-center gap-3 p-3 rounded-lg bg-white/5 border border-white/5 hover:border-indigo-500/30 transition-all animate-fade-in"
                        style={{ animationDelay: `${index * 0.1}s` }}
                      >
                        <div
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: color }}
                        />
                        <div className="flex-1">
                          <p className="text-sm text-slate-300">{activity.message}</p>
                          <p className="text-xs text-slate-500">{timeAgo}</p>
                        </div>
                        {activity.type === "push" && <GitCommit size={14} className="text-slate-500" />}
                        {activity.type === "pullrequest" && <GitMerge size={14} className="text-slate-500" />}
                      </div>
                    );
                  })}
                </div>
              ) : profile.github_username ? (
                <p className="text-sm text-slate-500 text-center py-8">No recent activity</p>
              ) : (
                <p className="text-sm text-slate-500 text-center py-8">Connect GitHub to see activity</p>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
