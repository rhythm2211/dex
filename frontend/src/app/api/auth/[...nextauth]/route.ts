import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GithubProvider from "next-auth/providers/github";
import GoogleProvider from "next-auth/providers/google";
import AzureADProvider from "next-auth/providers/azure-ad";
import {
  fetchBackend,
  resolveServerV1Base,
  userByEmailUrl,
} from "@/lib/server-backend";

// Build providers array conditionally based on available credentials
const providers = [];

// 0. Credentials (Email/Password)
providers.push(
  CredentialsProvider({
    name: "Credentials",
    credentials: {
      email: { label: "Email", type: "email" },
      password: { label: "Password", type: "password" }
    },
    async authorize(credentials) {
      if (!credentials?.email || !credentials?.password) {
        return null;
      }

      try {
        const apiBase = resolveServerV1Base();
        const response = await fetchBackend(`${apiBase}/users/verify-credentials`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email: credentials.email,
            password: credentials.password,
          }),
        });

        if (!response.ok) {
          return null;
        }

        const data = await response.json();
        const user = data.user;

        return {
          id: user.id,
          email: user.email,
          name: user.name || user.email,
        };
      } catch (error) {
        console.error("Credentials verification error:", error);
        return null;
      }
    }
  })
);

// 1. GitHub
if (process.env.GITHUB_ID && process.env.GITHUB_SECRET) {
  providers.push(
    GithubProvider({
      clientId: process.env.GITHUB_ID,
      clientSecret: process.env.GITHUB_SECRET,
      // Request email scope explicitly
      authorization: {
        params: {
          scope: "read:user user:email",
        },
      },
    })
  );
}

// 2. Google
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  providers.push(
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      // Google includes email by default, but we can be explicit
      authorization: {
        params: {
          prompt: "consent",
          access_type: "offline",
          response_type: "code",
        },
      },
    })
  );
}

// 3. Microsoft (Azure AD)
if (process.env.AZURE_AD_CLIENT_ID && process.env.AZURE_AD_CLIENT_SECRET) {
  providers.push(
    AzureADProvider({
      clientId: process.env.AZURE_AD_CLIENT_ID,
      clientSecret: process.env.AZURE_AD_CLIENT_SECRET,
      tenantId: process.env.AZURE_AD_TENANT_ID ?? "common",
      // Request email scope
      authorization: {
        params: {
          scope: "openid profile email",
        },
      },
    })
  );
}

// Ensure auth runs in Node (not edge) — avoids Turbopack/edge fetch issues on Next 15+.
export const runtime = "nodejs";

const handler = NextAuth({
  providers,
  secret: process.env.NEXTAUTH_SECRET,
  // NEXTAUTH_URL must match the URL in your browser (scheme + host + port).
  pages: {
    signIn: '/login', 
  },
  callbacks: {
    async jwt({ token, user, account, profile, trigger, session }) {
      if (trigger === "update" && session) {
        const updated = session as { profile_completed?: boolean };
        if (typeof updated.profile_completed === "boolean") {
          token.profile_completed = updated.profile_completed;
        }
      }

      // Add user id to token when user signs in
      if (user) {
        // Extract email from user object or profile (for OAuth providers)
        let userEmail = user.email;
        
        // For OAuth providers, email might be in profile instead of user object
        if (!userEmail && profile) {
          // GitHub: email might be in profile.email or profile.email_address
          if (account?.provider === 'github') {
            userEmail = (profile as any).email || (profile as any).email_address || (profile as any).login + '@users.noreply.github.com';
          }
          // Google: email is usually in profile.email
          else if (account?.provider === 'google') {
            userEmail = (profile as any).email || (profile as any).email_address;
          }
          // Azure AD: email might be in profile.email or profile.unique_name
          else if (account?.provider === 'azure-ad') {
            userEmail = (profile as any).email || (profile as any).unique_name || (profile as any).upn;
          }
        }
        
        // If still no email, try to get from account
        if (!userEmail && account) {
          // Some providers store email in account
          userEmail = (account as any).email;
        }
        
        const emailForLookup = userEmail || user.email;
        if (user.id) {
          token.id = user.id;
        } else if (emailForLookup) {
          token.id = emailForLookup;
        } else {
          // No email found - this shouldn't happen but handle gracefully
          console.error("No email found for user:", user);
          token.id = user.id || (user as any).sub || `user_${Date.now()}`;
        }

        if (emailForLookup) {
          try {
            const response = await fetchBackend(userByEmailUrl(emailForLookup));
            if (response.ok) {
              const userData = await response.json();
              if (userData.id) token.id = userData.id;
              token.profile_completed = Boolean(userData.profile_completed);
            }
          } catch (error) {
            console.error("Failed to fetch user profile for token:", error);
          }
        }
        
        token.email = userEmail || user.email;
        token.name = user.name || (profile as any)?.name || (profile as any)?.displayName;
      }
      return token;
    },
    async signIn({ account, profile, user }) {
      if (account) {
        console.log(`[NextAuth] User logged in via ${account.provider}`);
      }
      
      // Extract email from user object or profile (for OAuth providers)
      let userEmail = user?.email;
      
      // For OAuth providers, email might be in profile instead of user object
      if (!userEmail && profile) {
        // GitHub: email might be in profile.email or profile.email_address
        if (account?.provider === 'github') {
          userEmail = (profile as any).email || (profile as any).email_address;
          // If GitHub doesn't provide email (private), use a placeholder
          if (!userEmail) {
            const login = (profile as any).login;
            userEmail = login ? `${login}@users.noreply.github.com` : null;
            console.warn(`[NextAuth] GitHub user ${login} has private email, using placeholder`);
          }
        }
        // Google: email is usually in profile.email
        else if (account?.provider === 'google') {
          userEmail = (profile as any).email || (profile as any).email_address;
        }
        // Azure AD: email might be in profile.email, profile.unique_name, or profile.upn
        else if (account?.provider === 'azure-ad') {
          userEmail = (profile as any).email || (profile as any).unique_name || (profile as any).upn;
        }
      }
      
      // If still no email, try to get from account
      if (!userEmail && account) {
        userEmail = (account as any).email;
      }
      
      // Extract name from user or profile
      let userName = user?.name;
      if (!userName && profile) {
        userName = (profile as any).name || (profile as any).displayName || (profile as any).login;
      }
      
      // Save user to database on sign in
      if (userEmail) {
        try {
          const apiBase = resolveServerV1Base();
          console.log(`[NextAuth] API base: ${apiBase}`);
          console.log(`[NextAuth] Attempting to save user: ${userEmail}`);
          console.log(`[NextAuth] User name: ${userName}`);
          console.log(`[NextAuth] Provider: ${account?.provider}`);
          
          // Check if user exists
          const checkResponse = await fetchBackend(userByEmailUrl(userEmail));
          console.log(`[NextAuth] Check user response status: ${checkResponse.status}`);
          
          // Use upsert endpoint to always update user info, even if profile not completed
          // Extract GitHub username if logging in with GitHub
          let githubUsername = null;
          if (account?.provider === "github" && profile && 'login' in profile) {
            githubUsername = (profile as any).login;
          }
          
          // Always upsert user to ensure they're updated on every login
          const upsertResponse = await fetchBackend(`${apiBase}/users/upsert`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              email: userEmail,
              name: userName || null,
              github_username: githubUsername,
            }),
          });
          
          console.log(`[NextAuth] Upsert user response status: ${upsertResponse.status}`);
          
          if (upsertResponse.ok) {
            const wasNew = !checkResponse.ok;
            console.log(`${wasNew ? '✅ Created' : '✅ Updated'} user profile for: ${userEmail}`);
            
            // Update last_login timestamp for all logins
            fetchBackend(`${apiBase}/users/email/${encodeURIComponent(userEmail)}/update-login`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
            }).catch((error) => {
              console.error("Failed to update login timestamp:", error);
            });
            
            // Send welcome email only for new users
            if (wasNew) {
              fetchBackend(`${apiBase}/users/email/${encodeURIComponent(userEmail)}/send-welcome-email`, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                },
              }).catch(() => {
                // Silently fail - email sending is non-critical
                console.log("Welcome email will be sent by backend");
              });
            }
          } else {
            const errorText = await upsertResponse.text();
            console.error(`❌ Failed to upsert user: ${userEmail}`, errorText);
          }
        } catch (error) {
          // Log error but don't block sign in
          console.error("❌ Failed to save user to database:", error);
          console.error("❌ Error details:", {
            message: error instanceof Error ? error.message : String(error),
            apiBase: resolveServerV1Base(),
            userEmail: userEmail,
            provider: account?.provider,
          });
        }
      } else {
        console.error(`❌ No email found for user. Provider: ${account?.provider}, User:`, user, "Profile:", profile);
        // Don't block sign in, but log the issue
      }
      
      return true;
    },
    async session({ session, token }) {
      // Add user id to session from token
      if (session.user && token) {
        session.user.id = (token.id as string) || (token.email as string);
        session.user.email = (token.email as string) || null;
        session.user.name = (token.name as string) || null;
      }
      
      // Profile status is cached in JWT at sign-in (avoids backend hit every session poll).
      (session.user as { profile_completed?: boolean }).profile_completed =
        typeof token.profile_completed === "boolean"
          ? token.profile_completed
          : false;
      return session;
    },
  },
  debug: process.env.NODE_ENV === "development",
});

export { handler as GET, handler as POST };