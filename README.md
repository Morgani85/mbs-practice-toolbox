# Practice Toolbox - Team Performance Module

A comprehensive AI-powered business performance analysis system built specifically for accounting practices.

## 🚀 Live Application

**Production URL**: [https://app.practicetoolbox.co.uk](https://app.practicetoolbox.co.uk)

## ✨ Features

### Authentication & User Management
- **Secure Authentication**: Email/password login with session management
- **Role-Based Access**: Admin, Manager, User, and Viewer permissions
- **User Invitations**: Admins can invite new users with secure token system
- **Beautiful UI**: Two-column authentication page with modern design

### Core Business Modules
- **Accounts Module**: Track account preparation targets and results
- **VAT Module**: Monitor VAT return preparation and submissions  
- **Bookkeeping**: MBS and Client bookkeeping task tracking
- **Health Checks**: Monitor completion rates and due items
- **Confirmation Statements**: Track preparation and turnaround times
- **Tax Module**: Personal and business tax completion tracking

### AI-Powered Analytics
- **Performance Analysis**: AI-driven insights using Anthropic Claude
- **Risk Assessment**: Automated risk level identification
- **Trend Analysis**: Identify patterns and performance gaps
- **Recommendations**: Actionable improvement suggestions
- **Clarifying Questions**: AI asks relevant follow-up questions

### Admin Features
- **User Management**: Complete CRUD operations for user accounts
- **Role Assignment**: Flexible permission management
- **System Monitoring**: Track user activity and system performance
- **Data Analytics**: Comprehensive reporting and insights

## 🛠 Technology Stack

### Frontend
- **React 18** with TypeScript
- **Radix UI** components with shadcn/ui styling
- **Tailwind CSS** for responsive design
- **TanStack React Query** for server state management
- **Wouter** for client-side routing
- **Vite** for fast development and building

### Backend
- **Node.js 20** with Express.js
- **TypeScript** for type safety
- **PostgreSQL** with Drizzle ORM
- **Session-based authentication** with connect-pg-simple
- **Anthropic Claude API** for AI analysis

### Database
- **PostgreSQL 16** with connection pooling
- **Drizzle ORM** for type-safe database operations
- **Automated migrations** with drizzle-kit

## 🏗 Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   React Client  │────│  Express API    │────│  PostgreSQL DB  │
│                 │    │                 │    │                 │
│ • Authentication│    │ • REST Routes   │    │ • User Data     │
│ • Role-based UI │    │ • Session Mgmt  │    │ • Performance   │
│ • Data Forms    │    │ • AI Integration│    │ • Analytics     │
│ • Analytics     │    │ • File Serving  │    │ • Sessions      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## 🚀 Quick Start

### Prerequisites
- Node.js 18 or higher
- PostgreSQL database
- npm or yarn

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/practice-toolbox.git
   cd practice-toolbox
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your database credentials and session secret
   ```

4. **Set up the database**
   ```bash
   npm run db:push
   ```

5. **Start development server**
   ```bash
   npm run dev
   ```

6. **Visit the application**
   Open [http://localhost:5000](http://localhost:5000)

### First-Time Setup

1. **Create Admin Account**: Register through the auth page
2. **Set Admin Role**: Update user role to 'admin' in database
3. **Invite Users**: Use the admin panel to invite team members
4. **Configure Modules**: Set up teams and targets for each business module

## 📋 Environment Variables

```env
# Database Configuration
DATABASE_URL=postgresql://user:password@host:port/database
PGHOST=your_postgresql_host
PGPORT=5432
PGUSER=your_database_user
PGPASSWORD=your_database_password
PGDATABASE=your_database_name

# Session Configuration
SESSION_SECRET=your_very_secure_random_session_secret_key_here

# Application Environment
NODE_ENV=development

# Optional: Email Service (for user invitations)
SENDGRID_API_KEY=your_sendgrid_api_key_here
```

## 🔐 User Roles & Permissions

| Role | Dashboard | Reports | Data Entry | Team Mgmt | User Mgmt | System Admin |
|------|-----------|---------|------------|-----------|-----------|--------------|
| **Viewer** | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| **User** | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Manager** | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| **Admin** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

## 📊 Key Metrics

The system tracks performance across multiple dimensions:

- **Weekly/Monthly Targets**: Set and track completion goals
- **Achievement Rates**: Monitor actual vs. target performance
- **Trend Analysis**: Identify improving or declining areas
- **Risk Indicators**: Early warning system for potential issues
- **Quality Metrics**: Track accuracy and efficiency measures

## 🤖 AI Integration

Powered by Anthropic Claude for:

- **Performance Analysis**: Deep insights into team and individual performance
- **Risk Assessment**: Automated identification of potential issues
- **Trend Identification**: Pattern recognition in performance data
- **Recommendations**: Actionable suggestions for improvement
- **Follow-up Questions**: AI-generated queries for better context

## 🎨 Design System

Built with a modern, professional design system:

- **Color Palette**: Professional blues and grays optimized for business use
- **Typography**: Clear, readable fonts with proper hierarchy
- **Components**: Consistent, accessible UI components
- **Responsive**: Works seamlessly on desktop, tablet, and mobile
- **Dark Mode**: Automatic theme switching (coming soon)

## 🚀 Deployment

See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed deployment instructions to production.

### Quick Deploy to Vercel

1. **Push to GitHub**
2. **Connect to Vercel**
3. **Configure environment variables**
4. **Set up custom domain**: `app.practicetoolbox.co.uk`

## 🔧 Development

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run build:client` - Build client only
- `npm run start` - Start production server
- `npm run db:push` - Apply database schema changes
- `npm run check` - Type checking

### Project Structure

```
practice-toolbox/
├── client/                 # React frontend
│   ├── src/
│   │   ├── components/     # Reusable UI components
│   │   ├── pages/          # Page components
│   │   ├── hooks/          # Custom React hooks
│   │   └── lib/            # Utility functions
├── server/                 # Express backend
│   ├── routes.ts           # API route definitions
│   ├── auth.ts             # Authentication logic
│   ├── storage.ts          # Database operations
│   └── ai-analysis.ts      # AI integration
├── shared/                 # Shared code
│   └── schema.ts           # Database schema & types
└── vercel.json             # Deployment configuration
```

## 📝 License

This project is proprietary software developed for Practice Toolbox.

## 🤝 Support

For support, contact: support@practicetoolbox.co.uk

---

**Practice Toolbox** - Empowering accounting practices with intelligent performance analytics.