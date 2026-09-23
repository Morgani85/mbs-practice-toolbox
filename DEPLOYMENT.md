# Practice Toolbox - Deployment Guide

## Deploying to app.practicetoolbox.co.uk

This guide covers deploying Practice Toolbox to Vercel with your custom subdomain.

### Prerequisites

1. GitHub account with your code repository
2. Vercel account (free tier works)
3. Access to DNS settings for practicetoolbox.co.uk
4. PostgreSQL database (Neon, Supabase, or similar)

### Step 1: Prepare Repository

1. Push your code to GitHub:
   ```bash
   git init
   git add .
   git commit -m "Initial commit: Practice Toolbox with user invitation system"
   git branch -M main
   git remote add origin https://github.com/yourusername/practice-toolbox.git
   git push -u origin main
   ```

### Step 2: Deploy to Vercel

1. Go to [vercel.com](https://vercel.com) and sign in
2. Click "New Project"
3. Import your GitHub repository
4. Configure project settings:
   - **Project Name**: `practice-toolbox`
   - **Framework Preset**: Other
   - **Build Command**: `npm run vercel-build`
   - **Output Directory**: `client/dist`
   - **Install Command**: `npm install`

### Step 3: Environment Variables

Add these environment variables in Vercel dashboard:

```env
DATABASE_URL=your_postgresql_connection_string
SESSION_SECRET=your_secure_session_secret_key
NODE_ENV=production
PGHOST=your_db_host
PGPORT=5432
PGUSER=your_db_user
PGPASSWORD=your_db_password
PGDATABASE=your_db_name
```

### Step 4: Custom Domain Setup

1. In Vercel dashboard, go to your project settings
2. Navigate to "Domains" section
3. Add domain: `app.practicetoolbox.co.uk`
4. Vercel will provide DNS records to configure

### Step 5: DNS Configuration

Add these records to your DNS provider for practicetoolbox.co.uk:

```
Type: CNAME
Name: app
Value: cname.vercel-dns.com
TTL: 300 (or your provider's default)
```

### Step 6: Database Setup

If using a new database:

1. Create PostgreSQL database (recommend Neon or Supabase)
2. Run database migrations:
   ```bash
   npm run db:push
   ```
3. Create master admin user through the registration form
4. Update user role to 'admin' in database

### Step 7: SSL Certificate

Vercel automatically provisions SSL certificates for custom domains. This usually takes 5-15 minutes after DNS propagation.

### Step 8: Test Deployment

1. Wait for DNS propagation (up to 24 hours, usually much faster)
2. Visit `https://app.practicetoolbox.co.uk`
3. Test login with your admin account
4. Verify user invitation system works
5. Test all core functionality

### Troubleshooting

#### Common Issues:

1. **Domain not resolving**: Check DNS propagation at whatsmydns.net
2. **Build failures**: Check Vercel build logs for errors
3. **Database connection**: Verify DATABASE_URL format and credentials
4. **Session issues**: Ensure SESSION_SECRET is set and consistent

#### Build Requirements:

- Node.js 18+ (automatically handled by Vercel)
- All dependencies listed in package.json
- Environment variables properly configured

### Maintenance

#### Regular Updates:
1. Push changes to GitHub main branch
2. Vercel automatically deploys new versions
3. Database migrations run via `npm run db:push` if needed

#### Monitoring:
- Monitor Vercel analytics dashboard
- Check application logs in Vercel dashboard
- Set up uptime monitoring if desired

### Security Notes

- All environment variables are encrypted at rest
- HTTPS enforced automatically
- Session cookies secured in production
- Database connections use SSL by default

Your Practice Toolbox will be available at:
**https://app.practicetoolbox.co.uk**