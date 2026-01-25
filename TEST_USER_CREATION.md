# Testing User Creation and Login Updates

## Current Status
✅ **Table Structure**: The `users` table exists and is properly structured
⚠️ **No Users Yet**: The table is empty because no users have signed up or logged in yet

## How Users Are Created

### 1. **Signup (Credentials)**
- User signs up via `/signup` page
- Creates account with email/password
- Endpoint: `POST /api/v1/users/signup`
- User is created immediately with `is_active=True`, `last_login=None`

### 2. **OAuth Login (GitHub/Google/Azure)**
- User logs in via OAuth provider
- NextAuth callback creates user if doesn't exist
- Endpoint: `POST /api/v1/users` (called from NextAuth)
- Then calls: `POST /api/v1/users/email/{email}/update-login`
- User is created with `last_login` set immediately

### 3. **Credentials Login**
- User logs in with email/password
- Endpoint: `POST /api/v1/users/verify-credentials`
- Updates `last_login` if user exists
- Does NOT create user (must signup first)

## Testing the System

### Option 1: Test via Signup Page
1. Go to your frontend signup page: `http://localhost:3000/signup` (or your deployed URL)
2. Create a test account with email/password
3. Check database:
   ```sql
   SELECT email, name, is_active, last_login, created_at 
   FROM users 
   ORDER BY created_at DESC;
   ```

### Option 2: Test via API Directly
```bash
# Create a test user
curl -X POST http://localhost:8000/api/v1/users/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "testpassword123",
    "name": "Test User"
  }'
```

Then check:
```sql
SELECT email, name, is_active, last_login, created_at 
FROM users 
WHERE email = 'test@example.com';
```

### Option 3: Test OAuth Login
1. Go to login page
2. Click "Sign in with GitHub" (or Google/Azure)
3. Complete OAuth flow
4. Check database - user should be created with `last_login` set

## Verify Table Structure

Run this in Neon SQL Editor to verify all columns exist:

```sql
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'users'
ORDER BY ordinal_position;
```

Expected columns:
- `id` (text, NOT NULL, PRIMARY KEY)
- `email` (text, NOT NULL, UNIQUE)
- `password_hash` (text, nullable)
- `name` (text, nullable)
- `age` (integer, nullable)
- `company` (text, nullable)
- `role` (text, nullable)
- `bio` (text, nullable)
- `github_username` (text, nullable)
- `profile_completed` (boolean, default false)
- `is_active` (boolean, default true)
- `last_login` (timestamp, nullable)
- `created_at` (timestamp, default now)
- `updated_at` (timestamp, default now)

## Verify Indexes

```sql
SELECT 
    indexname, 
    indexdef 
FROM pg_indexes 
WHERE tablename = 'users';
```

Should show indexes on:
- `email` (unique index)
- `is_active`
- `last_login`
- `github_username`

## Test Login Update

After creating a user, test that login updates work:

1. **Credentials Login**:
   ```bash
   curl -X POST http://localhost:8000/api/v1/users/verify-credentials \
     -H "Content-Type: application/json" \
     -d '{
       "email": "test@example.com",
       "password": "testpassword123"
     }'
   ```

2. **Check last_login updated**:
   ```sql
   SELECT email, last_login, is_active, updated_at 
   FROM users 
   WHERE email = 'test@example.com';
   ```

3. **OAuth Login Update**:
   ```bash
   curl -X POST http://localhost:8000/api/v1/users/email/test@example.com/update-login \
     -H "Content-Type: application/json"
   ```

## Troubleshooting

### If users aren't being created:

1. **Check backend logs** for errors:
   - Look for database connection errors
   - Check for validation errors
   - Verify API endpoints are accessible

2. **Check frontend console**:
   - Open browser DevTools
   - Look for API call errors
   - Check Network tab for failed requests

3. **Verify database connection**:
   ```sql
   SELECT current_database(), current_user;
   ```

4. **Test API endpoint directly**:
   ```bash
   curl http://localhost:8000/api/v1/users/email/test@example.com
   ```
   Should return 404 if user doesn't exist (this confirms API is working)

### If last_login isn't updating:

1. **Check NextAuth callback** is calling update-login endpoint
2. **Verify API URL** in frontend `.env.local`:
   ```
   INTERNAL_API_URL=http://localhost:8000
   NEXT_PUBLIC_API_URL=http://localhost:8000
   ```
3. **Check backend logs** for update-login endpoint calls

## Summary

The empty table is **normal** - it means:
- ✅ Database connection is working
- ✅ Table structure is correct
- ✅ System is ready for users

Just need to create a user via signup or OAuth login to populate it!
