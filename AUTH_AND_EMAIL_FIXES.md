# Authentication and Email Fixes

## Summary of Changes

This document outlines the fixes made to address:
1. Welcome emails not being sent to new users
2. Authentication UI issues (signup/login buttons showing when logged in)

## Changes Made

### 1. Welcome Email Fixes

#### Backend Changes (`app/backend/app/api/v1/endpoints/users.py`):
- **Added new endpoint** `/api/v1/users/email/{email}/send-welcome-email` to manually trigger welcome emails
- **Updated** `/api/v1/users` endpoint to send welcome emails asynchronously using background threads
- **Updated** `/api/v1/users/signup` endpoint to ensure emails are sent in background threads (already implemented)

#### Frontend Changes (`frontend/src/app/api/auth/[...nextauth]/route.ts`):
- **Added** welcome email sending for social login users (GitHub, Google, Microsoft)
- When a new user signs up via social login, the system now automatically sends a welcome email

### 2. Authentication UI Fixes

#### Main Page (`frontend/src/app/page.tsx`):
- **Conditionally hide** signup/login buttons when user is authenticated
- **Show** "Go to Dashboard" button instead of signup buttons when logged in
- **Updated** call-to-action sections to respect authentication state

#### Signup Page (`frontend/src/app/signup/page.tsx`):
- **Added** redirect logic to send authenticated users to `/app` instead of showing signup form
- **Prevents** logged-in users from accessing signup page

## Email Configuration

### Why Emails Might Not Be Sending

The most common reason welcome emails aren't being sent is that the `RESEND_API_KEY` environment variable is not configured.

### How to Configure Email Service

1. **Get a Resend API Key**:
   - Sign up at [https://resend.com](https://resend.com)
   - Navigate to API Keys in the dashboard
   - Create a new API key

2. **Add to Environment Variables**:
   
   Create or update `.env` file in `app/` directory (or `app/backend/`):
   
   ```bash
   # Resend Email Service Configuration
   RESEND_API_KEY=re_your_api_key_here
   RESEND_FROM_EMAIL=noreply@yourdomain.com  # Optional: defaults to onboarding@resend.dev
   RESEND_FROM_NAME=DEX                      # Optional: defaults to "DEX"
   FRONTEND_URL=http://localhost:3000        # Optional: defaults to http://localhost:3000
   ```

3. **Restart Backend**:
   - If running locally: Restart your backend server
   - If using Docker: `docker-compose restart backend` or rebuild: `docker-compose up --build backend`

### Testing Email Configuration

1. **Check Backend Logs**:
   - Look for: `"RESEND_API_KEY not configured. Email service will be disabled."`
   - If you see this, the API key is missing
   - If configured correctly, you should see: `"Welcome email sent successfully to {email}"`

2. **Test Signup**:
   - Register a new user via email/password signup
   - Check your email inbox (and spam folder)
   - Check backend logs for email sending status

3. **Test Social Login**:
   - Sign up with GitHub/Google/Microsoft
   - Check email for welcome message
   - Check backend logs

### Email Service Behavior

- **Asynchronous**: Emails are sent in background threads and won't block user registration
- **Non-blocking**: If email sending fails, user registration still succeeds
- **Logging**: All email attempts are logged (success and failures)
- **Automatic**: Welcome emails are sent automatically for:
  - Email/password signups
  - Social login signups (first time only)

## Authentication Flow

### Standard Flow:
1. User visits homepage → Sees "Sign up" and "Log in" buttons (if not authenticated)
2. User clicks "Sign up" → Redirected to `/signup`
3. User registers → Welcome email sent → Redirected to `/login`
4. User logs in → Session created → Redirected to `/app` or `/onboarding`
5. User visits homepage again → Sees "Go to Dashboard" button (signup/login hidden)

### When Already Authenticated:
- Homepage: Shows "Go to Dashboard" instead of signup/login buttons
- Signup page: Automatically redirects to `/app`
- Login page: Shows user info and redirects based on profile completion

## Troubleshooting

### Email Not Received After Signup

1. **Check RESEND_API_KEY**:
   ```bash
   # In your backend .env file
   grep RESEND_API_KEY app/.env
   ```

2. **Check Backend Logs**:
   ```bash
   # Look for email-related log messages
   docker-compose logs backend | grep -i email
   # Or if running locally, check your console output
   ```

3. **Verify Email Address**:
   - Check for typos in the email address
   - Check spam/junk folder
   - Verify the email service is enabled in Resend dashboard

4. **Test Email Endpoint**:
   ```bash
   # Manually trigger welcome email (replace {email} with actual email)
   curl -X POST http://localhost:8000/api/v1/users/email/{email}/send-welcome-email
   ```

### Authentication Issues

1. **Buttons Still Showing When Logged In**:
   - Clear browser cache and cookies
   - Check that NextAuth session is working: `http://localhost:3000/api/auth/session`
   - Verify `NEXTAUTH_SECRET` is set in frontend environment

2. **Redirect Loops**:
   - Check browser console for errors
   - Verify API endpoints are accessible
   - Check that user profile exists in database

## Files Modified

- `app/backend/app/api/v1/endpoints/users.py` - Added email endpoint and improved async email sending
- `frontend/src/app/api/auth/[...nextauth]/route.ts` - Added welcome email for social logins
- `frontend/src/app/page.tsx` - Conditional rendering based on auth state
- `frontend/src/app/signup/page.tsx` - Added redirect for authenticated users

## Next Steps

1. **Configure RESEND_API_KEY** in your `.env` file
2. **Restart backend** to load new configuration
3. **Test signup** with a new user account
4. **Verify email** is received
5. **Test authentication** by logging in and checking UI changes

For more details, see `EMAIL_SETUP.md`.
