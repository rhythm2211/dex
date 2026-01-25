import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GithubProvider from "next-auth/providers/github";
import GoogleProvider from "next-auth/providers/google";
import AzureADProvider from "next-auth/providers/azure-ad";

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
        const apiUrl = process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
        const response = await fetch(`${apiUrl}/api/v1/users/verify-credentials`, {
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
    })
  );
}

// 2. Google
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  providers.push(
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
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
    })
  );
}

const handler = NextAuth({
  providers,
  secret: process.env.NEXTAUTH_SECRET,
  pages: {
    signIn: '/login', 
  },
  callbacks: {
    async signIn({ account, profile, user }) {
      if (account) {
        console.log(`User logged in via ${account.provider}`);
      }
      
      // Save user to database on sign in
      if (user?.email) {
        try {
          const apiUrl = process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
          console.log(`[NextAuth] API URL: ${apiUrl}`);
          console.log(`[NextAuth] Attempting to save user: ${user.email}`);
          
          // Check if user exists
          const checkResponse = await fetch(`${apiUrl}/api/v1/users/email/${encodeURIComponent(user.email)}`);
          console.log(`[NextAuth] Check user response status: ${checkResponse.status}`);
          
          // Use upsert endpoint to always update user info, even if profile not completed
          // Extract GitHub username if logging in with GitHub
          let githubUsername = null;
          if (account?.provider === "github" && profile && 'login' in profile) {
            githubUsername = (profile as any).login;
          }
          
          // Always upsert user to ensure they're updated on every login
          const upsertResponse = await fetch(`${apiUrl}/api/v1/users/upsert`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              email: user.email,
              name: user.name || null,
              github_username: githubUsername,
            }),
          });
          
          console.log(`[NextAuth] Upsert user response status: ${upsertResponse.status}`);
          
          if (upsertResponse.ok) {
            const wasNew = !checkResponse.ok;
            console.log(`${wasNew ? '✅ Created' : '✅ Updated'} user profile for: ${user.email}`);
            
            // Update last_login timestamp for all logins
            fetch(`${apiUrl}/api/v1/users/email/${encodeURIComponent(user.email)}/update-login`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
            }).catch((error) => {
              console.error("Failed to update login timestamp:", error);
            });
            
            // Send welcome email only for new users
            if (wasNew) {
              fetch(`${apiUrl}/api/v1/users/email/${encodeURIComponent(user.email)}/send-welcome-email`, {
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
            console.error(`❌ Failed to upsert user: ${user.email}`);
          }
        } catch (error) {
          // Log error but don't block sign in
          console.error("❌ Failed to save user to database:", error);
          console.error("❌ Error details:", {
            message: error instanceof Error ? error.message : String(error),
            apiUrl: process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000",
            userEmail: user?.email,
          });
        }
      }
      
      return true;
    },
    async session({ session, token }) {
      // Add user profile completion status to session
      if (session?.user?.email) {
        try {
          const apiUrl = process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
          const response = await fetch(`${apiUrl}/api/v1/users/email/${encodeURIComponent(session.user.email)}`);
          
          if (response.ok) {
            const userData = await response.json();
            (session.user as any).profile_completed = userData.profile_completed || false;
          }
        } catch (error) {
          console.error("Failed to fetch user profile:", error);
        }
      }
      return session;
    },
  },
  debug: process.env.NODE_ENV === "development",
});

export { handler as GET, handler as POST };