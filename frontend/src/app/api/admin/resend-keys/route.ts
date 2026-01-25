import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";

/**
 * API route to list Resend API keys
 * WARNING: This should be protected/restricted in production!
 * Only use for testing/admin purposes.
 */
export async function GET(request: NextRequest) {
  try {
    // Get API key from environment
    const resendApiKey = process.env.RESEND_API_KEY;

    if (!resendApiKey) {
      return NextResponse.json(
        { error: "RESEND_API_KEY not configured" },
        { status: 503 }
      );
    }

    // Initialize Resend
    const resend = new Resend(resendApiKey);

    // List all API keys
    // Note: This requires the API key to have permissions to list keys
    const { data, error } = await resend.apiKeys.list();

    if (error) {
      console.error("Resend API error:", error);
      return NextResponse.json(
        { error: error.message || "Failed to list API keys" },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { 
        message: "API keys retrieved successfully",
        keys: data 
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error listing Resend API keys:", error);
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : "Failed to list API keys" 
      },
      { status: 500 }
    );
  }
}
