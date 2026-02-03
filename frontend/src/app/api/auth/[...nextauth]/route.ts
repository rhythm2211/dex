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

const handler = NextAuth({
  providers,
  secret: process.env.NEXTAUTH_SECRET,
  // Note: NEXTAUTH_URL is automatically used by NextAuth from environment variables
  // No need to set it explicitly in the config - NextAuth v4 reads it automatically
  pages: {
    signIn: '/login', 
  },
  callbacks: {
    async jwt({ token, user, account, profile }) {
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
        
        // For credentials provider, user.id is already available
        if (user.id) {
          token.id = user.id;
        } else if (userEmail) {
          // For OAuth providers, use email as id and fetch user id from database
          try {
            const apiUrl = process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
            const response = await fetch(`${apiUrl}/api/v1/users/email/${encodeURIComponent(userEmail)}`);
            if (response.ok) {
              const userData = await response.json();
              token.id = userData.id || userEmail; // Use database id or email as fallback
            } else {
              token.id = userEmail; // Fallback to email
            }
          } catch (error) {
            console.error("Failed to fetch user id:", error);
            token.id = userEmail; // Fallback to email on error
          }
        } else {
          // No email found - this shouldn't happen but handle gracefully
          console.error("No email found for user:", user);
          token.id = user.id || (user as any).sub || `user_${Date.now()}`;
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
          const apiUrl = process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
          console.log(`[NextAuth] API URL: ${apiUrl}`);
          console.log(`[NextAuth] Attempting to save user: ${userEmail}`);
          console.log(`[NextAuth] User name: ${userName}`);
          console.log(`[NextAuth] Provider: ${account?.provider}`);
          
          // Check if user exists
          const checkResponse = await fetch(`${apiUrl}/api/v1/users/email/${encodeURIComponent(userEmail)}`);
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
            fetch(`${apiUrl}/api/v1/users/email/${encodeURIComponent(userEmail)}/update-login`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
            }).catch((error) => {
              console.error("Failed to update login timestamp:", error);
            });
            
            // Send welcome email only for new users
            if (wasNew) {
              fetch(`${apiUrl}/api/v1/users/email/${encodeURIComponent(userEmail)}/send-welcome-email`, {
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
            apiUrl: process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000",
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
      
      // Add user profile completion status to session
      // Use email from token (which was extracted from OAuth profile)
      const userEmail = session?.user?.email || token.email as string;
      if (userEmail) {
        try {
          const apiUrl = process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
          const response = await fetch(`${apiUrl}/api/v1/users/email/${encodeURIComponent(userEmail)}`);
          
          if (response.ok) {
            const userData = await response.json();
            (session.user as any).profile_completed = userData.profile_completed || false;
            // Ensure id is set from database if not already in token
            if (!session.user.id && userData.id) {
              session.user.id = userData.id;
            }
            // Ensure email is set from database
            if (!session.user.email && userData.email) {
              session.user.email = userData.email;
            }
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