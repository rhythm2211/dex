"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, Settings as SettingsIcon, Bell, Shield, Key, User, 
  Moon, Sun, Globe, Save, CheckCircle, AlertCircle, Trash2,
  Mail, Lock, Eye, EyeOff, Database, Server, Activity
} from "lucide-react";

export default function SettingsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'account' | 'security' | 'notifications' | 'preferences' | 'data'>('account');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  
  // Form states
  const [accountData, setAccountData] = useState({
    name: "",
    email: "",
    bio: "",
  });
  
  const [securityData, setSecurityData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false,
  });
  
  const [notifications, setNotifications] = useState({
    email: true,
    push: false,
    digest: true,
    updates: true,
  });
  
  const [preferences, setPreferences] = useState({
    theme: 'dark',
    language: 'en',
    timezone: 'UTC',
  });

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login?redirect=/settings");
    }
  }, [status, router]);

  useEffect(() => {
    if (session?.user) {
      setAccountData({
        name: session.user.name || "",
        email: session.user.email || "",
        bio: "",
      });
    }
  }, [session]);

  const handleSaveAccount = async () => {
    setSaving(true);
    setError(null);
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      setError(err.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveSecurity = async () => {
    if (securityData.newPassword !== securityData.confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    if (securityData.newPassword.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    
    setSaving(true);
    setError(null);
    try {
      await new Promise(resolve => setTimeout(resolve, 1000));
      setSuccess(true);
      setSecurityData({ currentPassword: "", newPassword: "", confirmPassword: "" });
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      setError(err.message || "Failed to update password");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!confirm("Are you sure you want to delete your account? This action cannot be undone.")) {
      return;
    }
    // Implement account deletion
  };

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!session) return null;

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
          <Link href="/app" className="flex items-center gap-3 group hover:scale-105 transition-transform">
            <span className="p-2.5 bg-indigo-500/10 rounded-xl border border-indigo-500/20">
              <ArrowLeft size={16} className="text-indigo-400" />
            </span>
            <span className="text-sm font-semibold text-slate-300">Back to Dashboard</span>
          </Link>
          <div className="flex items-center gap-3">
            {success && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
                <CheckCircle size={14} className="text-emerald-400" />
                <span className="text-xs text-emerald-400">Saved!</span>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="relative pt-24 pb-20 max-w-7xl mx-auto px-6">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2.5 bg-indigo-500/10 rounded-xl border border-indigo-500/20">
              <SettingsIcon size={24} className="text-indigo-400" />
            </div>
            <h1 className="text-3xl font-bold text-white">Settings</h1>
          </div>
          <p className="text-slate-400">Manage your account settings and preferences</p>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center gap-2">
            <AlertCircle size={16} className="text-red-400" />
            <span className="text-sm text-red-400">{error}</span>
          </div>
        )}

        <div className="grid md:grid-cols-4 gap-6">
          {/* Sidebar */}
          <div className="md:col-span-1">
            <div className="sticky top-24 space-y-1">
              {[
                { id: 'account', label: 'Account', icon: User },
                { id: 'security', label: 'Security', icon: Shield },
                { id: 'notifications', label: 'Notifications', icon: Bell },
                { id: 'preferences', label: 'Preferences', icon: Globe },
                { id: 'data', label: 'Data & Privacy', icon: Database },
              ].map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all text-left ${
                      activeTab === tab.id
                        ? 'bg-indigo-500/20 border border-indigo-500/30 text-white'
                        : 'bg-white/5 border border-white/5 text-slate-400 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    <Icon size={18} />
                    <span className="text-sm font-medium">{tab.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Content */}
          <div className="md:col-span-3">
            <div className="rounded-xl border border-white/10 bg-[#0A0A0A] p-6">
              {/* Account Tab */}
              {activeTab === 'account' && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-xl font-bold text-white mb-6">Account Settings</h2>
                    <div className="space-y-4">
                      <div>
                        <label className="text-xs text-slate-500 mb-1 block">Name</label>
                        <input
                          type="text"
                          value={accountData.name}
                          onChange={(e) => setAccountData({ ...accountData, name: e.target.value })}
                          className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500/50"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-slate-500 mb-1 block">Email</label>
                        <input
                          type="email"
                          value={accountData.email}
                          disabled
                          className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-400 cursor-not-allowed"
                        />
                        <p className="text-xs text-slate-500 mt-1">Email cannot be changed</p>
                      </div>
                      <div>
                        <label className="text-xs text-slate-500 mb-1 block">Bio</label>
                        <textarea
                          value={accountData.bio}
                          onChange={(e) => setAccountData({ ...accountData, bio: e.target.value })}
                          rows={4}
                          className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500/50 resize-none"
                        />
                      </div>
                      <button
                        onClick={handleSaveAccount}
                        disabled={saving}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition-all disabled:opacity-50"
                      >
                        <Save size={14} />
                        {saving ? "Saving..." : "Save Changes"}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Security Tab */}
              {activeTab === 'security' && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-xl font-bold text-white mb-6">Security Settings</h2>
                    <div className="space-y-4">
                      <div>
                        <label className="text-xs text-slate-500 mb-1 block">Current Password</label>
                        <div className="relative">
                          <input
                            type={showPasswords.current ? "text" : "password"}
                            value={securityData.currentPassword}
                            onChange={(e) => setSecurityData({ ...securityData, currentPassword: e.target.value })}
                            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 pr-10 text-sm text-white focus:outline-none focus:border-indigo-500/50"
                          />
                          <button
                            onClick={() => setShowPasswords({ ...showPasswords, current: !showPasswords.current })}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                          >
                            {showPasswords.current ? <EyeOff size={16} /> : <Eye size={16} />}
                          </button>
                        </div>
                      </div>
                      <div>
                        <label className="text-xs text-slate-500 mb-1 block">New Password</label>
                        <div className="relative">
                          <input
                            type={showPasswords.new ? "text" : "password"}
                            value={securityData.newPassword}
                            onChange={(e) => setSecurityData({ ...securityData, newPassword: e.target.value })}
                            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 pr-10 text-sm text-white focus:outline-none focus:border-indigo-500/50"
                          />
                          <button
                            onClick={() => setShowPasswords({ ...showPasswords, new: !showPasswords.new })}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                          >
                            {showPasswords.new ? <EyeOff size={16} /> : <Eye size={16} />}
                          </button>
                        </div>
                      </div>
                      <div>
                        <label className="text-xs text-slate-500 mb-1 block">Confirm New Password</label>
                        <div className="relative">
                          <input
                            type={showPasswords.confirm ? "text" : "password"}
                            value={securityData.confirmPassword}
                            onChange={(e) => setSecurityData({ ...securityData, confirmPassword: e.target.value })}
                            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 pr-10 text-sm text-white focus:outline-none focus:border-indigo-500/50"
                          />
                          <button
                            onClick={() => setShowPasswords({ ...showPasswords, confirm: !showPasswords.confirm })}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                          >
                            {showPasswords.confirm ? <EyeOff size={16} /> : <Eye size={16} />}
                          </button>
                        </div>
                      </div>
                      <button
                        onClick={handleSaveSecurity}
                        disabled={saving}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition-all disabled:opacity-50"
                      >
                        <Lock size={14} />
                        {saving ? "Updating..." : "Update Password"}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Notifications Tab */}
              {activeTab === 'notifications' && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-xl font-bold text-white mb-6">Notification Preferences</h2>
                    <div className="space-y-4">
                      {Object.entries(notifications).map(([key, value]) => (
                        <div key={key} className="flex items-center justify-between p-4 rounded-lg bg-white/5 border border-white/10">
                          <div>
                            <p className="text-sm font-medium text-white capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</p>
                            <p className="text-xs text-slate-500 mt-1">
                              {key === 'email' && 'Receive email notifications'}
                              {key === 'push' && 'Receive browser push notifications'}
                              {key === 'digest' && 'Receive daily digest emails'}
                              {key === 'updates' && 'Receive product updates'}
                            </p>
                          </div>
                          <button
                            onClick={() => setNotifications({ ...notifications, [key]: !value })}
                            className={`relative w-12 h-6 rounded-full transition-colors ${
                              value ? 'bg-indigo-600' : 'bg-white/10'
                            }`}
                          >
                            <div className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform ${
                              value ? 'translate-x-6' : 'translate-x-0'
                            }`} />
                          </button>
                        </div>
                      ))}
                      <button
                        onClick={() => {
                          setSuccess(true);
                          setTimeout(() => setSuccess(false), 3000);
                        }}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition-all"
                      >
                        <Save size={14} />
                        Save Preferences
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Preferences Tab */}
              {activeTab === 'preferences' && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-xl font-bold text-white mb-6">Preferences</h2>
                    <div className="space-y-4">
                      <div>
                        <label className="text-xs text-slate-500 mb-1 block">Theme</label>
                        <select
                          value={preferences.theme}
                          onChange={(e) => setPreferences({ ...preferences, theme: e.target.value })}
                          className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500/50"
                        >
                          <option value="dark">Dark</option>
                          <option value="light">Light</option>
                          <option value="system">System</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-xs text-slate-500 mb-1 block">Language</label>
                        <select
                          value={preferences.language}
                          onChange={(e) => setPreferences({ ...preferences, language: e.target.value })}
                          className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500/50"
                        >
                          <option value="en">English</option>
                          <option value="es">Spanish</option>
                          <option value="fr">French</option>
                          <option value="de">German</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-xs text-slate-500 mb-1 block">Timezone</label>
                        <select
                          value={preferences.timezone}
                          onChange={(e) => setPreferences({ ...preferences, timezone: e.target.value })}
                          className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500/50"
                        >
                          <option value="UTC">UTC</option>
                          <option value="America/New_York">Eastern Time</option>
                          <option value="America/Chicago">Central Time</option>
                          <option value="America/Denver">Mountain Time</option>
                          <option value="America/Los_Angeles">Pacific Time</option>
                        </select>
                      </div>
                      <button
                        onClick={() => {
                          setSuccess(true);
                          setTimeout(() => setSuccess(false), 3000);
                        }}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition-all"
                      >
                        <Save size={14} />
                        Save Preferences
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Data & Privacy Tab */}
              {activeTab === 'data' && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-xl font-bold text-white mb-6">Data & Privacy</h2>
                    <div className="space-y-4">
                      <div className="p-4 rounded-lg bg-white/5 border border-white/10">
                        <h3 className="text-sm font-medium text-white mb-2">Export Data</h3>
                        <p className="text-xs text-slate-400 mb-3">Download a copy of your account data</p>
                        <button className="px-4 py-2 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/30 text-indigo-300 text-sm font-medium transition-all">
                          Export Data
                        </button>
                      </div>
                      <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/30">
                        <h3 className="text-sm font-medium text-red-400 mb-2 flex items-center gap-2">
                          <AlertCircle size={16} />
                          Danger Zone
                        </h3>
                        <p className="text-xs text-slate-400 mb-3">Permanently delete your account and all associated data</p>
                        <button
                          onClick={handleDeleteAccount}
                          className="px-4 py-2 rounded-lg bg-red-600/20 hover:bg-red-600/30 border border-red-500/30 text-red-400 text-sm font-medium transition-all flex items-center gap-2"
                        >
                          <Trash2 size={14} />
                          Delete Account
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
