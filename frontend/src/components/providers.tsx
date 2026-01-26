"use client";

import { SessionProvider, useSession } from "next-auth/react";
import { useEffect } from "react";
import { dexApi } from "@/lib/api";

// Component to set up API client session getter
function ApiSessionSetup() {
  const { data: session } = useSession();
  
  useEffect(() => {
    if (typeof window !== 'undefined') {
      // Set up session getter for API client
      // This ensures all API calls have authentication headers
      dexApi.setUserSessionGetter(async () => {
        if (!session || !session.user) {
          return { user: null };
        }
        return {
          user: {
            email: session.user.email ?? undefined,
            id: (session.user as any).id ?? undefined,
          }
        };
      });
    }
  }, [session]);
  
  return null; // This component doesn't render anything
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <ApiSessionSetup />
      {children}
    </SessionProvider>
  );
}
