import "next-auth";

declare module "next-auth" {
  interface User {
    id: string;
    email?: string | null;
    name?: string | null;
    image?: string | null;
  }

  interface Session {
    user: {
      id: string;
      email?: string | null;
      name?: string | null;
      image?: string | null;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    email?: string | null;
    name?: string | null;
  }
}
