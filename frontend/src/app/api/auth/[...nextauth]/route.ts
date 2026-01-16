import NextAuth from "next-auth";
import GithubProvider from "next-auth/providers/github";

const handler = NextAuth({
  providers: [
    GithubProvider({
      clientId: process.env.GITHUB_ID ?? "",
      clientSecret: process.env.GITHUB_SECRET ?? "",
    }),
  ],
  // This directs NextAuth to use your custom login page instead of the default one
  pages: {
    signIn: '/login', 
  },
});

export { handler as GET, handler as POST };