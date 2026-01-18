import NextAuth from "next-auth";
import GithubProvider from "next-auth/providers/github";
import GoogleProvider from "next-auth/providers/google";
import AzureADProvider from "next-auth/providers/azure-ad";

// Build providers array conditionally based on available credentials
const providers = [];

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
            const createResponse = await fetch(`${apiUrl}/api/v1/users`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                email: user.email,
                name: user.name || null,
                profile_completed: false,
              }),
            });
            
            if (createResponse.ok) {
              console.log(`Created user profile for: ${user.email}`);
            }
          } else {
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