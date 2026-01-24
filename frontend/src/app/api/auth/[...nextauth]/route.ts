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
          
          // Check if user exists
          const checkResponse = await fetch(`${apiUrl}/api/v1/users/email/${encodeURIComponent(user.email)}`);
          
          if (!checkResponse.ok) {
            // User doesn't exist, create new profile
            // Extract GitHub username if logging in with GitHub
            let githubUsername = null;
            if (account?.provider === "github" && profile && 'login' in profile) {
              githubUsername = (profile as any).login;
            }
            
            const createResponse = await fetch(`${apiUrl}/api/v1/users`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                email: user.email,
                name: user.name || null,
                github_username: githubUsername,
                profile_completed: false,
              }),
            });
            
            if (createResponse.ok) {
              console.log(`Created user profile for: ${user.email}`);
              // Send welcome email for new social login users
              // This is done asynchronously on the backend, so we don't wait for it
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
            // User exists - update GitHub username if logging in with GitHub
            if (account?.provider === "github" && profile && 'login' in profile) {
              const userData = await checkResponse.json();
              // Update GitHub username if not set
              if (!userData.github_username) {
                fetch(`${apiUrl}/api/v1/users/${encodeURIComponent(userData.id)}`, {
                  method: "PUT",
                  headers: {
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify({
                    github_username: (profile as any).login,
                  }),
                }).catch(() => {
                  console.log("Failed to update GitHub username");
                });
              }
            }
            console.log(`User profile exists for: ${user.email}`);
          }
        } catch (error) {
          // Log error but don't block sign in
          console.error("Failed to save user to database:", error);
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