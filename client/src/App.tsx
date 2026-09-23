import { Switch, Route, Redirect, useLocation, Link } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { useNavigationLoading } from "@/hooks/use-navigation-loading";
import { PageLoading } from "@/components/ui/page-loading";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/use-auth";
import { useAuth } from "@/hooks/use-auth";
import Header from "@/components/layout/header";
import Navigation from "@/components/layout/navigation";
import AuthPage from "@/pages/auth-page";
import SignupPage from "@/pages/signup";
import OnboardingPage from "@/pages/onboarding";
import PlatformAdminPage from "@/pages/platform-admin";
import ChoosePlanPage from "@/pages/choose-plan";
import ReactivatePage from "@/pages/reactivate";
import UserManagement from "@/pages/admin/user-management";
import SectionSelector from "@/pages/section-selector";
import AreaSelector from "@/pages/area-selector";
import Dashboard from "@/pages/dashboard";
import Targets from "@/pages/targets";
import Results from "@/pages/results";
import AccountsDue from "@/pages/accounts-due";
import VatDashboard from "@/pages/vat-dashboard";
import VatDue from "@/pages/vat-due";
import VatTurnoverChecks from "@/pages/vat-turnover-checks";
import HealthChecksDashboard from "@/pages/health-checks-dashboard";
import HealthChecksTargets from "@/pages/health-checks-targets";
import HealthChecksResults from "@/pages/health-checks-results";
import HealthChecksDue from "@/pages/health-checks-due";
import AdminSettings from "@/pages/admin/settings";
import ConfirmationStatementsDashboard from "@/pages/confirmation-statements-dashboard";
import ConfirmationStatementsDataEntry from "@/pages/confirmation-statements-data-entry";
import MbsDextPrecision from "@/pages/mbs-dext-precision";
import MbsOldestItems from "@/pages/mbs-oldest-items";
import MbsDashboard from "@/pages/mbs-dashboard";
import ClientBookkeepingDashboard from "@/pages/client-bookkeeping-dashboard";
import ClientDextPrecision from "@/pages/client-dext-precision";
import ClientOldestItems from "@/pages/client-oldest-items";
import RisksActionsDashboard from "@/pages/risks-actions-dashboard";
import TaxDashboard from "@/pages/tax-dashboard";
import TaxDataEntry from "@/pages/tax-data-entry";
import TaxTargets from "@/pages/tax-targets";
import OverviewDashboard from "@/pages/overview-dashboard";
import StrategicPlanningSelector from "@/pages/strategic-planning/strategic-planning-selector";
import LongTermTargets from "@/pages/strategic-planning/long-term-targets";
import Values from "@/pages/strategic-planning/values";
import QuarterlyGoals from "@/pages/strategic-planning/quarterly-goals";
import PracticePerformanceSelector from "@/pages/practice-performance/practice-performance-selector";
import RevenueAnalytics from "@/pages/practice-performance/revenue-analytics";
import CashCashflow from "@/pages/practice-performance/cash-cashflow";
import Upgrades from "@/pages/practice-performance/upgrades";
import Marketing from "@/pages/practice-performance/marketing";
import Sales from "@/pages/practice-performance/sales";
import ClientValueManager from "@/pages/practice-performance/client-value-manager";
import ManagementReportsIndex from "@/pages/management-reports/index";
import NewReportClient from "@/pages/management-reports/new-client";
import ClientHub from "@/pages/management-reports/client-hub";
import StrategicPlanEdit from "@/pages/management-reports/strategic-plan-edit";
import NewReport from "@/pages/management-reports/new-report";
import DataEntry from "@/pages/management-reports/data-entry";
import ReportView from "@/pages/management-reports/report-view";
import StructureApproval from "@/pages/management-reports/structure-approval";
import CoachingIndex from "@/pages/coaching/index";
import CoachingClientHub from "@/pages/coaching/client-hub";
import CoachingPortal from "@/pages/coaching/portal";
import CoachingSession from "@/pages/coaching/session";
import FcrIndex from "@/pages/fcr/index";
import FcrReview from "@/pages/fcr/review";
import EmailAnalytics from "@/pages/communication/email-analytics";

import LandingPage from "@/pages/landing";
import FeaturesPage from "@/pages/features";
import AboutPage from "@/pages/about";
import PricingMarketingPage from "@/pages/pricing-marketing";
import RegisterInterestPage from "@/pages/register-interest";
import ValuationTool from "@/pages/valuation-tool";
import ValuationSubmissions from "@/pages/valuation-submissions";
import AppNotFound from "@/pages/app-not-found";
import AppForbidden from "@/pages/app-forbidden";
import AppServerError from "@/pages/app-server-error";
import MarketingNotFound from "@/pages/marketing-not-found";
import MarketingServerError from "@/pages/marketing-server-error";
import { ErrorBoundary } from "@/components/error-boundary";
import RockReminderDialog from "@/components/rock-reminder-dialog";
import { AlertTriangle, X } from "lucide-react";
import { useState, useEffect, useRef } from "react";

function SubscriptionBanner() {
  const { user } = useAuth();
  const [dismissed, setDismissed] = useState(false);
  const userAny = user as any;
  const org = userAny?.organisation;
  const [location] = useLocation();

  if (!org || dismissed) return null;

  const status = org.subscriptionStatus;
  const trialEndsAt = org.trialEndsAt ? new Date(org.trialEndsAt) : null;
  const trialDaysLeft = trialEndsAt
    ? Math.max(0, Math.ceil((trialEndsAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : null;

  // Hide banner on the choose-plan and reactivate pages themselves
  if (location === "/choose-plan" || location === "/reactivate") return null;

  if (status === "trialling" && trialEndsAt && trialDaysLeft !== null) {
    const urgency = trialDaysLeft <= 3;
    return (
      <div
        className={`fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4 py-2 text-sm font-medium ${
          urgency ? "bg-orange-500 text-white" : "bg-blue-600 text-white"
        }`}
      >
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 flex-shrink-0" />
          <span>
            {trialDaysLeft === 0
              ? "Your trial ends today."
              : `Your free trial ends in ${trialDaysLeft} day${trialDaysLeft !== 1 ? "s" : ""}.`}{" "}
            <Link href="/choose-plan" className="underline font-bold">
              Choose a plan to continue
            </Link>
          </span>
        </div>
        <button onClick={() => setDismissed(true)} className="p-1 hover:opacity-75">
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }

  if (status === "past_due") {
    return (
      <div className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4 py-2 text-sm font-medium bg-red-600 text-white">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 flex-shrink-0" />
          <span>
            Payment failed — please update your payment details.{" "}
            <Link href="/admin/settings" className="underline font-bold">
              Go to Billing
            </Link>
          </span>
        </div>
        <button onClick={() => setDismissed(true)} className="p-1 hover:opacity-75">
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return null;
}

const AUTH_TIMEOUT_MS = 8000;

function Router() {
  const { user, isLoading } = useAuth();
  const { isLoading: isNavigating, timedOut: navTimedOut, location } = useNavigationLoading();
  const userAny = user as any;

  // Timeout for the initial auth check — if /api/user hangs for > 8 s, show retry UI
  const [authTimedOut, setAuthTimedOut] = useState(false);
  const authTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (isLoading) {
      authTimeoutRef.current = setTimeout(() => setAuthTimedOut(true), AUTH_TIMEOUT_MS);
    } else {
      if (authTimeoutRef.current) clearTimeout(authTimeoutRef.current);
      setAuthTimedOut(false);
    }
    return () => {
      if (authTimeoutRef.current) clearTimeout(authTimeoutRef.current);
    };
  }, [isLoading]);

  // On www.practicetoolbox.co.uk serve only the marketing site — no app access.
  // Auth/signup links in the marketing nav point to app.practicetoolbox.co.uk.
  const isMarketingDomain = typeof window !== "undefined" &&
    window.location.hostname === "www.practicetoolbox.co.uk";

  if (isMarketingDomain) {
    return (
      <ErrorBoundary fallback={<MarketingServerError />}>
        <Switch>
          <Route path="/" component={LandingPage} />
          <Route path="/features" component={FeaturesPage} />
          <Route path="/about" component={AboutPage} />
          <Route path="/pricing" component={PricingMarketingPage} />
          <Route path="/register-interest" component={RegisterInterestPage} />
          <Route path="/valuation-tool" component={ValuationTool} />
          <Route component={MarketingNotFound} />
        </Switch>
      </ErrorBoundary>
    );
  }

  // Show loading spinner while checking authentication
  if (isLoading) {
    return (
      <PageLoading
        message="Checking your session..."
        timedOut={authTimedOut}
        onRetry={() => window.location.reload()}
      />
    );
  }

  // Unauthenticated on app domain: go straight to sign-in
  if (!user) {
    return (
      <Switch>
        <Route path="/signup" component={SignupPage} />
        <Route path="/auth" component={AuthPage} />
        <Route path="/valuation-tool" component={ValuationTool} />
        <Route>
          <Redirect to="/auth" />
        </Route>
      </Switch>
    );
  }

  // Coaching portal users: redirect to their read-only portal
  if (user.role === 'coaching_client') {
    return (
      <Switch>
        <Route path="/coaching/portal" component={CoachingPortal} />
        <Route>
          <Redirect to="/coaching/portal" />
        </Route>
      </Switch>
    );
  }

  // Superadmin: isolated platform dashboard, no access to regular app
  if (user.role === 'superadmin') {
    return (
      <Switch>
        <Route path="/platform-admin" component={PlatformAdminPage} />
        <Route path="/valuations" component={ValuationSubmissions} />
        <Route>
          <Redirect to="/platform-admin" />
        </Route>
      </Switch>
    );
  }

  // Onboarding: if org hasn't completed setup yet, redirect there
  if (userAny?.organisation && !userAny.organisation.isOnboardingComplete && location !== '/onboarding') {
    return (
      <Switch>
        <Route path="/onboarding" component={OnboardingPage} />
        <Route>
          <Redirect to="/onboarding" />
        </Route>
      </Switch>
    );
  }

  if (location === '/onboarding') {
    return <Route path="/onboarding" component={OnboardingPage} />;
  }

  // Subscription gating — exempt orgs bypass all checks entirely
  const org = userAny?.organisation;
  const isExempt = (org as any)?.isExempt === true;
  if (org && !isExempt) {
    const status = org.subscriptionStatus;
    const trialEndsAt = org.trialEndsAt ? new Date(org.trialEndsAt) : null;
    const trialExpired = status === "trialling" && trialEndsAt && trialEndsAt < new Date();
    const allowedPaths = ["/choose-plan", "/reactivate"];
    const onAllowedPath = allowedPaths.includes(location);

    if (!onAllowedPath) {
      if (trialExpired) {
        return (
          <Switch>
            <Route path="/choose-plan" component={ChoosePlanPage} />
            <Route path="/reactivate" component={ReactivatePage} />
            <Route>
              <Redirect to="/choose-plan" />
            </Route>
          </Switch>
        );
      }
      if (status === "cancelled" || status === "paused") {
        return (
          <Switch>
            <Route path="/choose-plan" component={ChoosePlanPage} />
            <Route path="/reactivate" component={ReactivatePage} />
            <Route>
              <Redirect to="/reactivate" />
            </Route>
          </Switch>
        );
      }
    }
  }

  // Show navigation loading overlay when switching between routes
  if ((isNavigating || navTimedOut) && user) {
    let moduleName = "page";
    if (location.includes("/vat/")) moduleName = "VAT Module";
    else if (location.includes("/accounts/")) moduleName = "Accounts Module";
    else if (location.includes("/health-checks/")) moduleName = "Health Checks Module";
    else if (location.includes("/mbs-bookkeeping/")) moduleName = "Internal Bookkeeping Module";
    else if (location.includes("/client-bookkeeping/")) moduleName = "Client Bookkeeping Module";
    else if (location.includes("/confirmation-statements/")) moduleName = "Confirmation Statements Module";
    else if (location.includes("/tax/")) moduleName = "Tax Module";
    else if (location.includes("/strategic-planning/")) moduleName = "Strategic Planning";
    else if (location.includes("/practice-performance/")) moduleName = "Practice Performance";
    else if (location.includes("/admin/")) moduleName = "Administration";
    else if (location.includes("/management-reports")) moduleName = "Management Reports";

    return (
      <PageLoading
        message={`Loading ${moduleName}...`}
        timedOut={navTimedOut}
        onRetry={() => window.location.reload()}
      />
    );
  }

  // Authenticated users see the full application
  return <AuthenticatedLayout />;
}

function AuthenticatedLayout() {
  return (
    <div className="min-h-screen bg-gray-50">
      <SubscriptionBanner />
      <Header />
      <RockReminderDialog />

      <div className="flex">
        <Navigation />

        <main className="flex-1 ml-64 p-6 pt-[100px] min-w-0 overflow-x-hidden">
          <ErrorBoundary fallback={<AppServerError />}>
          <Switch>
            <Route path="/choose-plan" component={ChoosePlanPage} />
            <Route path="/reactivate" component={ReactivatePage} />
            <Route path="/" component={SectionSelector} />
            <Route path="/staff-scorecards" component={AreaSelector} />
            <Route path="/overview" component={OverviewDashboard} />

            {/* Accounts Area Routes */}
            <Route path="/accounts/dashboard" component={Dashboard} />
            <Route path="/accounts/targets" component={Targets} />
            <Route path="/accounts/results" component={Results} />
            <Route path="/accounts/accounts-due" component={AccountsDue} />

            {/* VAT Area Routes */}
            <Route path="/vat/dashboard" component={VatDashboard} />
            <Route path="/vat/due" component={VatDue} />
            <Route path="/vat/turnover-checks" component={VatTurnoverChecks} />

            {/* Management Accounts Area Routes */}
            <Route path="/health-checks/dashboard" component={HealthChecksDashboard} />
            <Route path="/health-checks/data-entry" component={HealthChecksDue} />

            {/* Internal Bookkeeping Area Routes */}
            <Route path="/mbs-bookkeeping/dashboard" component={MbsDashboard} />
            <Route path="/mbs-bookkeeping/dext-precision" component={MbsDextPrecision} />
            <Route path="/mbs-bookkeeping/oldest-items" component={MbsOldestItems} />

            {/* Client Bookkeeping Area Routes */}
            <Route path="/client-bookkeeping/dashboard" component={ClientBookkeepingDashboard} />
            <Route path="/client-bookkeeping/dext-precision" component={ClientDextPrecision} />
            <Route path="/client-bookkeeping/oldest-items" component={ClientOldestItems} />

            {/* Confirmation Statements Area Routes */}
            <Route path="/confirmation-statements/dashboard" component={ConfirmationStatementsDashboard} />
            <Route path="/confirmation-statements/data-entry" component={ConfirmationStatementsDataEntry} />

            {/* Tax Area Routes */}
            <Route path="/tax/dashboard" component={TaxDashboard} />
            <Route path="/tax/data-entry" component={TaxDataEntry} />
            <Route path="/tax/targets" component={TaxTargets} />

            {/* Risks & Actions Route */}
            <Route path="/risks-actions" component={RisksActionsDashboard} />
            <Route path="/risks-actions-dashboard" component={RisksActionsDashboard} />

            {/* Strategic Planning Routes */}
            <Route path="/strategic-planning" component={StrategicPlanningSelector} />
            <Route path="/strategic-planning/long-term-targets" component={LongTermTargets} />
            <Route path="/strategic-planning/values" component={Values} />
            <Route path="/strategic-planning/quarterly-goals" component={QuarterlyGoals} />

            {/* Practice Performance Routes */}
            <Route path="/practice-performance" component={PracticePerformanceSelector} />
            <Route path="/practice-performance/revenue-analytics" component={RevenueAnalytics} />
            <Route path="/practice-performance/cash-cashflow" component={CashCashflow} />
            <Route path="/practice-performance/upgrades" component={Upgrades} />
            <Route path="/practice-performance/marketing" component={Marketing} />
            <Route path="/practice-performance/sales" component={Sales} />
            <Route path="/practice-performance/client-value-manager" component={ClientValueManager} />

            {/* Management Reports Routes */}
            <Route path="/management-reports" component={ManagementReportsIndex} />
            <Route path="/management-reports/clients/new" component={NewReportClient} />
            <Route path="/management-reports/clients/:id/strategic-plan/edit" component={StrategicPlanEdit} />
            <Route path="/management-reports/clients/:id/structure" component={StructureApproval} />
            <Route path="/management-reports/clients/:id" component={ClientHub} />
            <Route path="/management-reports/reports/new/:clientId" component={NewReport} />
            <Route path="/management-reports/reports/:id/data-entry" component={DataEntry} />
            <Route path="/management-reports/reports/:id" component={ReportView} />

            {/* Coaching Routes */}
            <Route path="/coaching" component={CoachingIndex} />
            <Route path="/coaching/portal" component={CoachingPortal} />
            <Route path="/coaching/clients/:clientId/sessions/:sessionId" component={CoachingSession} />
            <Route path="/coaching/clients/:id" component={CoachingClientHub} />

            {/* Financial Clarity Review Routes */}
            <Route path="/fcr" component={FcrIndex} />
            <Route path="/fcr/:id" component={FcrReview} />

            {/* Communication Routes */}
            <Route path="/communication/email-analytics" component={EmailAnalytics} />

            {/* Admin Routes */}
            <Route path="/admin/settings" component={AdminSettings} />
            <Route path="/admin/users" component={UserManagement} />

            {/* Legacy redirects for backward compatibility */}
            <Route path="/dashboard" component={Dashboard} />
            <Route path="/targets" component={Targets} />
            <Route path="/results" component={Results} />
            <Route path="/accounts-due" component={AccountsDue} />

            {/* 403 — regular users attempting superadmin-only areas */}
            <Route path="/platform-admin" component={AppForbidden} />
            <Route path="/valuations" component={AppForbidden} />

            {/* /auth while authenticated — redirect to home (avoids a flash of AppNotFound
                during the brief window between setQueryData and navigate("/") on login) */}
            <Route path="/auth"><Redirect to="/" /></Route>
            <Route path="/signup"><Redirect to="/" /></Route>

            <Route component={AppNotFound} />
          </Switch>
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Router />
          <Toaster />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
