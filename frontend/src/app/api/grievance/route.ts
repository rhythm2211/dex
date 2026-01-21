import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, email, subject, message } = body;

    // Validate required fields
    if (!name || !email || !subject || !message) {
      return NextResponse.json(
        { message: "All fields are required" },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { message: "Invalid email format" },
        { status: 400 }
      );
    }

    // Check if Resend API key is configured
    const resendApiKey = process.env.RESEND_API_KEY;

    if (!resendApiKey) {
      console.error("Resend API key not configured. Please set RESEND_API_KEY environment variable.");
      return NextResponse.json(
        { 
          message: "Email service is not configured. Please contact the administrator or use the direct email link below." 
        },
        { status: 503 }
      );
    }

    // Initialize Resend
    const resend = new Resend(resendApiKey);

    // Helper function to escape HTML
    const escapeHtml = (text: string) => {
      const map: { [key: string]: string } = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;',
      };
      return text.replace(/[&<>"']/g, (m) => map[m]);
    };

    // Send email using Resend
    // Use the user's email as the "from" address (they're logged in)
    const fromEmail = process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev"; // Default Resend domain for testing
    const fromName = name || "DEX User";

    const { data, error } = await resend.emails.send({
      from: `${fromName} <${fromEmail}>`,
      replyTo: email, // Replies will go to the user's email
      to: "rhythmsuthar123@gmail.com",
      subject: `[DEX Grievance] ${subject}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f5f5f5;">
          <div style="background-color: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            <h2 style="color: #333; margin-top: 0;">New Grievance/Contact Form Submission</h2>
            <div style="margin-top: 20px;">
              <p style="color: #666; margin: 10px 0;"><strong style="color: #333;">Name:</strong> ${escapeHtml(name)}</p>
              <p style="color: #666; margin: 10px 0;"><strong style="color: #333;">Email:</strong> <a href="mailto:${escapeHtml(email)}" style="color: #4f46e5;">${escapeHtml(email)}</a></p>
              <p style="color: #666; margin: 10px 0;"><strong style="color: #333;">Subject:</strong> ${escapeHtml(subject)}</p>
              <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #e5e5e5;">
                <p style="color: #333; font-weight: bold; margin-bottom: 10px;">Message:</p>
                <p style="color: #666; line-height: 1.6; white-space: pre-wrap;">${escapeHtml(message)}</p>
              </div>
            </div>
            <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e5e5; text-align: center;">
              <p style="color: #999; font-size: 12px;">This message was sent from the DEX contact form</p>
              <p style="color: #999; font-size: 12px; margin-top: 5px;">Reply to: ${escapeHtml(email)}</p>
            </div>
          </div>
        </div>
      `,
      text: `
New Grievance/Contact Form Submission

Name: ${name}
Email: ${email}
Subject: ${subject}

Message:
${message}

---
This message was sent from the DEX contact form
Reply to: ${email}
      `,
    });

    if (error) {
      console.error("Resend error:", error);
      return NextResponse.json(
        { message: error.message || "Failed to send email" },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { message: "Message sent successfully" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error sending email:", error);
    return NextResponse.json(
      { 
        message: error instanceof Error ? error.message : "Failed to send message. Please try again later." 
      },
      { status: 500 }
    );
  }
}
