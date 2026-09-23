# Practice Toolbox - Team Performance Module

## Overview
Practice Toolbox is a comprehensive analytics system for accounting practices, focusing on a Team Performance module. Its core purpose is to provide real-time tracking, AI-powered analysis, and risk assessment across various accounting operations (Accounts, VAT, Bookkeeping, Health Checks, Confirmation Statements, and Tax). The system aims to enhance practice efficiency, identify risks, and enable informed decision-making through aggregated performance data and AI-driven insights, ultimately improving profitability and service quality. It includes robust user authentication and role-based authorization.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend
- **Framework**: React with TypeScript
- **UI**: Radix UI components with shadcn/ui styling, Tailwind CSS
- **State Management**: TanStack React Query
- **Routing**: Wouter
- **Build Tool**: Vite

### Backend
- **Runtime**: Node.js 20 with TypeScript
- **Framework**: Express.js (REST API)
- **Database**: PostgreSQL 16 with Drizzle ORM
- **Authentication**: Replit Auth with OpenID Connect, session management
- **Authorization**: Role-based permissions (Admin, Manager, User, Viewer, Superadmin)
- **AI**: Anthropic Claude API for performance analysis
- **Caching**: In-memory LRU cache
- **SaaS Architecture**: Multi-tier organization structure with superadmin dashboard for platform management.
- **Multi-Tenancy**: All data tables include `organisationId` FK, with global API middleware for tenant isolation.

### Database Design
- **ORM**: Drizzle ORM for PostgreSQL.
- **Schema**: Tables for organisations, teams, targets, results, analytics, users, sessions, and various operational data, all linked by `organisationId`.
- **Connection**: Neon serverless PostgreSQL with connection pooling.

### Core Modules & Features
- **Authentication & Authorization**: Replit Auth, PostgreSQL-backed sessions, role-based access control (Admin, Manager, User, Viewer, Superadmin), user management, and team-level access control. Includes org suspension checks and user onboarding.
- **Executive Overview**: Comprehensive dashboard with team filtering and insights.
- **Operational Modules**: Accounts, VAT, Bookkeeping (MBS & Client), Health Checks, Confirmation Statements, and Tax module tracking.
- **AI Analysis Engine**: Utilizes Anthropic Claude for performance analysis, risk assessment, trend identification, and automated recommendations.
- **Client Value Manager**: Tracks client fees, service levels, CCR pipeline, and revenue opportunities, including client listing, detailed forms, and an analytical dashboard. Features include client archiving, turnover tracking, and Dext integration foundation.
- **Strategic Planning**: Sections for Long Term Targets, Values, and Quarterly Goals.
- **Practice Standards**: Per-organisation configurable settings for key operational parameters (e.g., VAT completion day, bookkeeping thresholds, platform).
- **Practice Valuation Calculator**: A marketing lead-generation tool with a multi-step form, three-tier valuation methodology, and PDF report generation.
- **Management Reports Module**: Full MI Pack module for accountancy clients. Features: report client management, strategic plan editor (goals, SWOT, SMART actions), monthly/quarterly/12-weekly period tracking, extended financial data entry (P&L, cashflow, balance sheet, KPIs, revenue streams, CoS detail, overhead breakdown, debt schedule, DLA, grant income, cashflow waterfall, breakeven, three core questions, next period metrics), AI commentary via Anthropic Claude (executive summary, going well/concerns, action steps, goal commentary, discussion points, health score, three core questions verdicts, watch_points, next_period_focus, core_question_answers, metric_impact), recharts visualisations (ComposedChart GP trend, cashflow waterfall, overhead horizontal bar, debt pie), **Puppeteer-based PDF generation** (6 pages: cover, dashboard, sections 1-3, actions — all inline styles, print-exact colour, SVG bar charts), Report Type selector (Standard/MI Pack) in client settings. **Client Profile Tab**: per-client permanent context (business description, owner profile, key relationships, historical context, standing AI instructions, key risks/opportunities, sector notes) passed to AI on every generation. Per-report period context fields (context, decisions pending, owner concerns, one-offs). Tables: `report_clients` (profile columns), `strategic_plans`, `management_report_periods`, `management_reports` (aiThreeCoreQuestions, aiCoreQuestionAnswers, aiWatchPoints, aiNextPeriodFocus, periodContext columns), `report_structures`. AI service: `server/management-reports-ai.ts`. HTML template: `server/report-html-template.ts`. PDF service: `server/management-reports-pdf.ts`. Pages under `client/src/pages/management-reports/`. Demo data seeded: "Got Crabs Ltd" (hospitality) with March 2026 report, approved structure, and full profile.
- **Data Tracking**: All data entry tables track `submitted_by` user and `updatedAt` timestamps.
- **Date Validation System**: Comprehensive week-ending date validation (Sundays, 1st, 15th, or last day of month) across major data entry forms.
- **UI/UX Decisions**: Consistent branding, integrated company logo, professional email templates, and responsive UI.
- **Technical Implementations**: Custom Vite configurations, esbuild for server bundling, secure password hashing, token-based invitation system, comprehensive API request handling, and cache invalidation.

## External Dependencies

- **@anthropic-ai/sdk**: AI analysis and recommendations.
- **@neondatabase/serverless**: PostgreSQL database connection.
- **@tanstack/react-query**: Client-side data fetching and caching.
- **drizzle-orm**: Type-safe database operations.
- **openid-client**: Replit Auth OpenID Connect integration.
- **passport**: Authentication middleware.
- **express-session**: Session management.
- **connect-pg-simple**: PostgreSQL session store.
- **@radix-ui/react-***: UI components.
- **tailwindcss**: CSS styling.
- **recharts**: Data visualization and charting.
- **Resend**: Email delivery.
- **pdf-lib**: Server-side PDF generation (valuation PDFs).
- **puppeteer**: Chromium-based server-side PDF generation for MI Pack reports.