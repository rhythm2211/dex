# Email Service Setup Guide

## Overview

The DEX application now includes a welcome email service that automatically sends a branded welcome email to users when they register. The email includes:

- DEX branding with logo and theme colors
- Personalized greeting
- Feature highlights
- Call-to-action button to get started

## Setup Instructions

### 1. Install Dependencies

The Resend Python SDK has been added to `requirements.txt`. Install it by running:

```bash
cd app
pip install -r requirements.txt
```

Or if using Docker, rebuild your backend container:

```bash
docker-compose build backend
```

### 2. Configure Environment Variables

Add the following environment variables to your backend `.env` file (located in `app/.env` or `app/backend/.env`):

```bash
# Resend Email Service Configuration
RESEND_API_KEY=re_your_api_key_here
RESEND_FROM_EMAIL=noreply@yourdomain.com  # Optional: defaults to onboarding@resend.dev
RESEND_FROM_NAME=DEX                      # Optional: defaults to "DEX"
FRONTEND_URL=http://localhost:3000        # Optional: defaults to http://localhost:3000
```

**Note:** If you don't have a Resend account yet:
1. Sign up at [https://resend.com](https://resend.com)
2. Get your API key from the dashboard
3. Verify your domain (or use the default `onboarding@resend.dev` for testing)

### 3. How It Works

The email service is automatically triggered when:

1. **Email/Password Signup**: User registers via `/api/v1/users/signup` endpoint
2. **Social Login Signup**: User signs up via GitHub, Google, or Microsoft OAuth (first time only)

The email is sent asynchronously, so it won't block the registration process. If email sending fails, it will be logged but won't prevent user registration.

### 4. Email Template

The welcome email template:
- Matches DEX's dark theme (#050505 background, indigo accents)
- Includes the DEX logo (Terminal icon with "DEX" text)
- Features a responsive design that works on all email clients
- Includes a "Get Started" button linking to the app dashboard

### 5. Testing

To test the email service:

1. Make sure `RESEND_API_KEY` is set in your backend `.env` file
2. Register a new user through the signup page
3. Check the user's email inbox for the welcome email
4. Check backend logs for email sending status

If the API key is not configured, the service will log a warning but won't break the registration flow.

## Troubleshooting

### Email not being sent?

1. **Check API Key**: Verify `RESEND_API_KEY` is correctly set in your `.env` file
2. **Check Logs**: Look for email-related log messages in your backend logs
3. **Verify Domain**: If using a custom domain, ensure it's verified in Resend
4. **Check Spam**: The email might be in the spam folder

### Email service disabled?

If you see "Email service not configured" warnings:
- The service will gracefully degrade - registration will still work
- Users just won't receive welcome emails
- This is intentional to prevent registration failures if email is misconfigured

## Customization

To customize the email template, edit:
- `app/backend/app/services/email_service.py` - `_get_welcome_email_template()` method

To customize email settings, update the environment variables:
- `RESEND_FROM_EMAIL`: The "from" email address
- `RESEND_FROM_NAME`: The sender name
- `FRONTEND_URL`: Base URL for links in emails
