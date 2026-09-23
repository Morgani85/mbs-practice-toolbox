import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertTeamSchema, type InsertTeam, type Team } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { Plus, Edit, Trash2, Users, Settings, Shield, ArrowLeft, Building2, Phone, MapPin, Globe, CreditCard, Zap, ExternalLink, CheckCircle, SlidersHorizontal, Plug } from "lucide-react";
import { Link, useLocation } from "wouter";
import type { Organisation } from "@shared/schema";

const PRACTICE_TYPES = [
  "General Practice",
  "Tax Specialist",
  "Audit & Assurance",
  "Payroll & HR",
  "Bookkeeping",
  "Business Advisory",
  "Corporate Finance",
  "Mixed Practice",
  "Other",
];

const PLAN_LABELS: Record<string, string> = {
  trialling: "Free Trial",
  starter: "Starter",
  growth: "Growth",
  scale: "Scale",
  pro: "Pro",
  cancelled: "Cancelled",
  past_due: "Past Due",
};

const PLAN_COLORS: Record<string, string> = {
  trialling: "bg-blue-100 text-blue-800",
  starter: "bg-gray-100 text-gray-800",
  growth: "bg-purple-100 text-purple-800",
  scale: "bg-indigo-100 text-indigo-800",
  pro: "bg-amber-100 text-amber-800",
  cancelled: "bg-red-100 text-red-800",
  past_due: "bg-orange-100 text-orange-800",
};

const PLAN_ORDER = ["starter", "growth", "scale", "pro"];

function BillingTab() {
  const { toast } = useToast();
  const [verifying, setVerifying] = useState(false);
  const [billingInterval, setBillingInterval] = useState<"monthly" | "yearly">("monthly");
  const [changingPlan, setChangingPlan] = useState<string | null>(null);

  // When Stripe redirects back after checkout, the URL contains ?session_id=xxx.
  // Verify immediately so the DB is updated without waiting for a webhook.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get("session_id");
    if (!sessionId) return;

    setVerifying(true);
    apiRequest(`/api/stripe/checkout/verify?session_id=${encodeURIComponent(sessionId)}`, "GET")
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          queryClient.invalidateQueries({ queryKey: ["/api/stripe/subscription"] });
          queryClient.invalidateQueries({ queryKey: ["/api/user"] });
          toast({ title: "Subscription activated!", description: `You're now on the ${data.plan} plan.` });
        }
      })
      .catch((err) => console.error("[BillingTab] Verify error:", err))
      .finally(() => {
        setVerifying(false);
        const clean = new URLSearchParams(window.location.search);
        clean.delete("session_id");
        const newSearch = clean.toString();
        window.history.replaceState({}, "", newSearch ? `?${newSearch}` : window.location.pathname);
      });
  }, []);

  const { data: subscription, isLoading } = useQuery<{
    plan: string;
    interval: string | null;
    status: string;
    trialEndsAt: string | null;
    currentPeriodEndsAt: string | null;
    hasStripeSubscription: boolean;
  }>({ queryKey: ["/api/stripe/subscription"] });

  const { data: plans } = useQuery<Array<{
    id: string;
    name: string;
    description: string;
    monthlyPrice: number;
    yearlyPrice: number;
    features: string[];
    limits: { users: number | null; clients: number | null };
    highlight: boolean;
  }>>({ queryKey: ["/api/stripe/plans"] });

  const portalMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("/api/stripe/billing-portal", "POST", { returnUrl: window.location.href });
      return res.json() as Promise<{ url: string }>;
    },
    onSuccess: (data) => { window.location.href = data.url; },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const checkoutMutation = useMutation({
    mutationFn: async (payload: { planId: string; interval: string }) => {
      const res = await apiRequest("/api/stripe/checkout", "POST", {
        ...payload,
        successUrl: `${window.location.origin}/admin/settings?session_id={CHECKOUT_SESSION_ID}&billing=1`,
        cancelUrl: window.location.href,
      });
      return res.json() as Promise<{ url: string }>;
    },
    onSuccess: (data) => { window.location.href = data.url; },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const changePlanMutation = useMutation({
    mutationFn: async (payload: { planId: string; interval: "monthly" | "yearly" }) => {
      setChangingPlan(payload.planId);
      const res = await apiRequest("/api/stripe/subscription/change", "POST", payload);
      return res.json() as Promise<{ success: boolean; isUpgrade: boolean; plan: string; interval: string }>;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/stripe/subscription"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      if (data.isUpgrade) {
        toast({ title: "Plan upgraded!", description: `You're now on the ${data.plan} plan. Your card has been charged for the prorated difference.` });
      } else {
        toast({ title: "Plan change scheduled", description: `You'll move to the ${data.plan} plan at your next renewal date.` });
      }
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
    onSettled: () => setChangingPlan(null),
  });

  // Sync interval toggle to current subscription interval when data loads
  useEffect(() => {
    if (subscription?.interval) {
      setBillingInterval(subscription.interval === "year" ? "yearly" : "monthly");
    }
  }, [subscription?.interval]);

  if (verifying || isLoading) return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-gray-500">
      <div className="animate-spin h-8 w-8 rounded-full border-4 border-blue-500 border-t-transparent" />
      <p className="text-sm">{verifying ? "Activating your subscription…" : "Loading billing…"}</p>
    </div>
  );
  if (!subscription) return null;

  const plan = subscription.plan || "trialling";
  const daysLeft = subscription.trialEndsAt
    ? Math.max(0, Math.ceil((new Date(subscription.trialEndsAt).getTime() - Date.now()) / 86400000))
    : null;
  const isTrialling = plan === "trialling";
  const isPaid = PLAN_ORDER.includes(plan);
  const currentRank = PLAN_ORDER.indexOf(plan);
  const isBusy = checkoutMutation.isPending || changePlanMutation.isPending;

  return (
    <div className="space-y-6">
      {/* Current Subscription Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Current Subscription
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <span className={`px-3 py-1 rounded-full text-sm font-semibold ${PLAN_COLORS[plan] || PLAN_COLORS.starter}`}>
              {PLAN_LABELS[plan] || plan}
            </span>
            {subscription.interval && (
              <span className="text-sm text-gray-500 capitalize">{subscription.interval}ly billing</span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
            {isTrialling && daysLeft !== null && (
              <div className="flex items-start gap-2">
                <Zap className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">Trial ends in</p>
                  <p className={`text-base font-semibold ${daysLeft <= 3 ? "text-red-600" : "text-gray-900"}`}>
                    {daysLeft} day{daysLeft !== 1 ? "s" : ""}
                  </p>
                </div>
              </div>
            )}
            {subscription.currentPeriodEndsAt && isPaid && (
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">Next billing date</p>
                <p className="text-sm font-medium text-gray-900">
                  {new Date(subscription.currentPeriodEndsAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
                </p>
              </div>
            )}
            {subscription.hasStripeSubscription && (
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">Status</p>
                <p className="text-sm font-medium text-gray-900 capitalize">{subscription.status}</p>
              </div>
            )}
          </div>

          {subscription.hasStripeSubscription && (
            <div className="pt-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => portalMutation.mutate()}
                disabled={portalMutation.isPending}
                className="flex items-center gap-2"
              >
                <ExternalLink className="h-4 w-4" />
                {portalMutation.isPending ? "Opening..." : "View Invoices & Payment Details"}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Plan Selection — always visible */}
      {plans && (
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="h-5 w-5" />
                  {isPaid ? "Change Plan" : "Choose a Plan"}
                </CardTitle>
                <CardDescription className="mt-1">
                  {isPaid
                    ? "Upgrades take effect immediately. Downgrades apply at your next renewal."
                    : "Select the plan that fits your practice. Cancel anytime."}
                </CardDescription>
              </div>
              {/* Monthly / Yearly toggle */}
              <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1 self-start sm:self-auto">
                <button
                  onClick={() => setBillingInterval("monthly")}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${billingInterval === "monthly" ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-700"}`}
                >
                  Monthly
                </button>
                <button
                  onClick={() => setBillingInterval("yearly")}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${billingInterval === "yearly" ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-700"}`}
                >
                  Yearly
                  <span className="ml-1.5 text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full font-semibold">Save ~17%</span>
                </button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
              {plans.map((p) => {
                const isCurrent = p.id === plan && subscription.interval === (billingInterval === "yearly" ? "year" : "month");
                const isCurrentPlan = p.id === plan;
                const thisRank = PLAN_ORDER.indexOf(p.id);
                const isUpgrade = thisRank > currentRank || (isCurrentPlan && billingInterval === "yearly" && subscription.interval !== "year");
                const isDowngrade = thisRank < currentRank || (isCurrentPlan && billingInterval === "monthly" && subscription.interval === "year");
                const displayPrice = billingInterval === "yearly" ? p.yearlyPrice : p.monthlyPrice;
                const isThisChanging = changingPlan === p.id && changePlanMutation.isPending;

                let buttonLabel = `Subscribe — ${p.name}`;
                let buttonVariant: "default" | "outline" | "ghost" = "outline";
                let buttonNote = "";
                let buttonDisabled = isBusy;

                if (isCurrent) {
                  buttonLabel = "Current Plan";
                  buttonVariant = "ghost";
                  buttonDisabled = true;
                  buttonNote = "";
                } else if (isPaid && isUpgrade) {
                  buttonLabel = isThisChanging ? "Upgrading…" : `Upgrade to ${p.name}`;
                  buttonVariant = "default";
                  buttonNote = "Takes effect immediately";
                } else if (isPaid && isDowngrade) {
                  buttonLabel = isThisChanging ? "Scheduling…" : `Downgrade to ${p.name}`;
                  buttonVariant = "outline";
                  buttonNote = "Takes effect at next renewal";
                } else if (isPaid) {
                  buttonLabel = isThisChanging ? "Changing…" : `Switch to ${p.name}`;
                  buttonVariant = "outline";
                  buttonNote = "Takes effect immediately";
                } else {
                  buttonLabel = checkoutMutation.isPending ? "Loading..." : `Subscribe — ${p.name}`;
                  buttonVariant = p.highlight ? "default" : "outline";
                }

                return (
                  <div
                    key={p.id}
                    className={`border rounded-lg p-4 space-y-3 relative transition-all ${
                      isCurrent
                        ? "border-green-500 ring-2 ring-green-100 bg-green-50/30"
                        : isCurrentPlan && !isCurrent
                          ? "border-blue-400 ring-1 ring-blue-100"
                          : p.highlight
                            ? "border-blue-300 ring-1 ring-blue-100"
                            : "border-gray-200"
                    }`}
                  >
                    {isCurrent && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                        <span className="bg-green-500 text-white text-xs font-semibold px-3 py-1 rounded-full flex items-center gap-1">
                          <CheckCircle className="h-3 w-3" /> Current Plan
                        </span>
                      </div>
                    )}
                    {!isCurrent && p.highlight && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                        <span className="bg-blue-500 text-white text-xs font-semibold px-3 py-1 rounded-full">
                          Most Popular
                        </span>
                      </div>
                    )}

                    <div className={isCurrent || p.highlight ? "mt-2" : ""}>
                      <p className="font-semibold text-gray-900">{p.name}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{p.description}</p>
                    </div>

                    <div>
                      <span className="text-2xl font-bold text-gray-900">
                        £{billingInterval === "yearly" ? Math.round(p.yearlyPrice / 12) : p.monthlyPrice}
                      </span>
                      <span className="text-sm text-gray-500">/month + VAT</span>
                      {billingInterval === "yearly" && (
                        <p className="text-xs text-gray-400 mt-0.5">£{p.yearlyPrice}/year + VAT billed annually</p>
                      )}
                    </div>

                    <ul className="space-y-1.5">
                      {p.features.slice(0, 5).map((f, i) => (
                        <li key={i} className="flex items-start gap-1.5 text-sm text-gray-700">
                          <CheckCircle className="h-3.5 w-3.5 text-green-500 mt-0.5 flex-shrink-0" />
                          {f}
                        </li>
                      ))}
                    </ul>

                    <div className="pt-1 space-y-1.5">
                      <Button
                        className="w-full"
                        variant={buttonVariant}
                        size="sm"
                        disabled={buttonDisabled}
                        onClick={() => {
                          if (isCurrent) return;
                          if (isPaid) {
                            changePlanMutation.mutate({ planId: p.id, interval: billingInterval });
                          } else {
                            checkoutMutation.mutate({ planId: p.id, interval: billingInterval });
                          }
                        }}
                      >
                        {buttonLabel}
                      </Button>
                      {buttonNote && (
                        <p className="text-xs text-center text-gray-400">{buttonNote}</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default function AdminSettings() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("billing") === "1" ? "billing" : "organisation";
  });
  const [showTeamForm, setShowTeamForm] = useState(false);
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [orgEditing, setOrgEditing] = useState(false);
  const [standardsEditing, setStandardsEditing] = useState(false);
  const [standardsFields, setStandardsFields] = useState({
    vatCompletionDay: 28,
    mgmtAccountsDay: 15,
    bookkeepingUpperThreshold: 85,
    bookkeepingLowerThreshold: 70,
    bookkeepingPlatform: "Dext Precision",
    bookkeepingPlatformCustom: "",
  });
  const [orgFields, setOrgFields] = useState({
    name: "",
    phone: "",
    address: "",
    city: "",
    postcode: "",
    website: "",
    practiceType: "",
  });

  const isAdmin = user?.role === 'admin';

  const { data: teams, isLoading: teamsLoading } = useQuery({
    queryKey: ['/api/teams'],
  });

  const { data: org, isLoading: orgLoading } = useQuery<Organisation>({
    queryKey: ['/api/organisation'],
    enabled: isAdmin,
  });

  const form = useForm<InsertTeam>({
    resolver: zodResolver(insertTeamSchema),
    defaultValues: {
      name: "",
      description: "",
    },
  });

  const updateOrgMutation = useMutation({
    mutationFn: async (data: typeof orgFields) => {
      const res = await apiRequest("/api/organisation", "PUT", {
        name: data.name,
        phone: data.phone || null,
        address: data.address || null,
        city: data.city || null,
        postcode: data.postcode || null,
        website: data.website || null,
        practiceType: data.practiceType || null,
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.message); }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Practice details updated" });
      queryClient.invalidateQueries({ queryKey: ["/api/organisation"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      setOrgEditing(false);
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updateStandardsMutation = useMutation({
    mutationFn: async (data: typeof standardsFields) => {
      const res = await apiRequest("/api/organisation", "PUT", {
        vatCompletionDay: data.vatCompletionDay,
        mgmtAccountsDay: data.mgmtAccountsDay,
        bookkeepingUpperThreshold: data.bookkeepingUpperThreshold,
        bookkeepingLowerThreshold: data.bookkeepingLowerThreshold,
        bookkeepingPlatform: data.bookkeepingPlatform,
        bookkeepingPlatformCustom: data.bookkeepingPlatformCustom || null,
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.message); }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Practice Standards saved" });
      queryClient.invalidateQueries({ queryKey: ["/api/organisation"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      setStandardsEditing(false);
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const createTeamMutation = useMutation({
    mutationFn: async (data: InsertTeam) => {
      const response = await apiRequest("/api/teams", "POST", data);
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Team created successfully", description: "The new team has been added." });
      queryClient.invalidateQueries({ queryKey: ["/api/teams"] });
      form.reset();
      setShowTeamForm(false);
    },
    onError: () => {
      toast({ title: "Error creating team", description: "Please try again.", variant: "destructive" });
    },
  });

  const updateTeamMutation = useMutation({
    mutationFn: async (data: InsertTeam & { id: number }) => {
      const { id, ...updateData } = data;
      const response = await apiRequest(`/api/teams/${id}`, "PUT", updateData);
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Team updated successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/teams"] });
      form.reset();
      setEditingTeam(null);
      setShowTeamForm(false);
    },
    onError: () => {
      toast({ title: "Error updating team", description: "Please try again.", variant: "destructive" });
    },
  });

  const deleteTeamMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await apiRequest(`/api/teams/${id}`, "DELETE");
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Failed to delete team");
      return data;
    },
    onSuccess: () => {
      toast({ title: "Team deleted successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/teams"] });
    },
    onError: (error: Error) => {
      let title = "Error deleting team";
      let errorMessage = error.message;
      if (error.message.includes("existing data")) {
        title = "Cannot delete team";
        errorMessage = "This team has existing performance data. All associated records must be removed before the team can be deleted.";
      }
      toast({ title, description: errorMessage, variant: "destructive" });
    },
  });

  const handleEdit = (team: Team) => {
    setEditingTeam(team);
    form.reset({ name: team.name, description: team.description || "" });
    setShowTeamForm(true);
  };

  const onSubmit = (data: InsertTeam) => {
    if (editingTeam) {
      updateTeamMutation.mutate({ ...data, id: editingTeam.id });
    } else {
      createTeamMutation.mutate(data);
    }
  };

  function subscriptionLabel(status: string | null) {
    if (!status) return "Unknown";
    if (status === 'trialling') return "Free Trial";
    if (status === 'active') return "Active";
    if (status === 'cancelled') return "Cancelled";
    return status.charAt(0).toUpperCase() + status.slice(1);
  }

  function subscriptionVariant(status: string | null): "default" | "secondary" | "destructive" | "outline" {
    if (status === 'active') return "default";
    if (status === 'trialling') return "secondary";
    if (status === 'cancelled') return "destructive";
    return "outline";
  }

  if (teamsLoading) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="h-8 bg-gray-200 rounded w-1/3"></div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-48 bg-gray-200 rounded"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <Link href="/">
          <Button variant="outline" size="sm" className="mb-4">
            <ArrowLeft className="mr-2" size={16} />
            Back to Practice Toolbox
          </Button>
        </Link>
        <div className="bg-gray-50 border-l-4 border-gray-400 p-4 mb-4 rounded-r-md">
          <h1 className="text-3xl font-bold text-gray-900 mb-1">ADMIN & SETTINGS</h1>
          <h2 className="text-xl font-semibold text-gray-800 mb-2">System Administration</h2>
          <p className="text-gray-700">Manage your organisation, teams, users, and settings</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className={`grid w-full ${isAdmin ? 'grid-cols-6' : 'grid-cols-3'}`}>
          {isAdmin && (
            <TabsTrigger value="organisation" className="flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              Organisation
            </TabsTrigger>
          )}
          <TabsTrigger value="teams" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Team Management
          </TabsTrigger>
          <TabsTrigger value="users" className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            User Management
          </TabsTrigger>
          {isAdmin && (
            <TabsTrigger value="standards" className="flex items-center gap-2">
              <SlidersHorizontal className="h-4 w-4" />
              Practice Standards
            </TabsTrigger>
          )}
          {isAdmin && (
            <TabsTrigger value="integrations" className="flex items-center gap-2">
              <Plug className="h-4 w-4" />
              Integrations
            </TabsTrigger>
          )}
          <TabsTrigger value="billing" className="flex items-center gap-2">
            <CreditCard className="h-4 w-4" />
            Billing
          </TabsTrigger>
        </TabsList>

        {/* Organisation Tab (admin only) */}
        {isAdmin && (
          <TabsContent value="organisation" className="space-y-6">
            {orgLoading ? (
              <div className="animate-pulse h-32 bg-gray-100 rounded-lg" />
            ) : org ? (
              <>
                {/* Practice Details Card */}
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center gap-2">
                        <Building2 className="h-5 w-5" />
                        Practice Details
                      </CardTitle>
                      {!orgEditing && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setOrgFields({
                              name: org.name || "",
                              phone: (org as any).phone || "",
                              address: (org as any).address || "",
                              city: (org as any).city || "",
                              postcode: (org as any).postcode || "",
                              website: (org as any).website || "",
                              practiceType: (org as any).practiceType || "",
                            });
                            setOrgEditing(true);
                          }}
                        >
                          <Edit className="h-3 w-3 mr-1" /> Edit
                        </Button>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    {orgEditing ? (
                      <div className="space-y-4">
                        {/* Firm name + type */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="sm:col-span-2">
                            <label className="text-sm font-medium text-gray-700">Firm Name <span className="text-red-500">*</span></label>
                            <Input
                              value={orgFields.name}
                              onChange={(e) => setOrgFields({ ...orgFields, name: e.target.value })}
                              placeholder="e.g. Smith & Partners Accountants"
                              className="mt-1"
                            />
                          </div>
                          <div className="sm:col-span-2">
                            <label className="text-sm font-medium text-gray-700">Type of Practice</label>
                            <Select
                              value={orgFields.practiceType}
                              onValueChange={(v) => setOrgFields({ ...orgFields, practiceType: v })}
                            >
                              <SelectTrigger className="mt-1">
                                <SelectValue placeholder="Select a practice type..." />
                              </SelectTrigger>
                              <SelectContent>
                                {PRACTICE_TYPES.map((t) => (
                                  <SelectItem key={t} value={t}>{t}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>

                        {/* Contact */}
                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <Phone className="h-4 w-4 text-gray-400" />
                            <span className="text-sm font-medium text-gray-700">Contact Details</span>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                              <label className="text-sm font-medium text-gray-700">Phone</label>
                              <Input
                                value={orgFields.phone}
                                onChange={(e) => setOrgFields({ ...orgFields, phone: e.target.value })}
                                placeholder="01234 567890"
                                className="mt-1"
                              />
                            </div>
                            <div>
                              <label className="text-sm font-medium text-gray-700">Website</label>
                              <div className="relative mt-1">
                                <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                                <Input
                                  value={orgFields.website}
                                  onChange={(e) => setOrgFields({ ...orgFields, website: e.target.value })}
                                  placeholder="www.yourfirm.co.uk"
                                  className="pl-9"
                                />
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Address */}
                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <MapPin className="h-4 w-4 text-gray-400" />
                            <span className="text-sm font-medium text-gray-700">Office Address</span>
                          </div>
                          <div className="space-y-3">
                            <div>
                              <label className="text-sm font-medium text-gray-700">Street Address</label>
                              <Input
                                value={orgFields.address}
                                onChange={(e) => setOrgFields({ ...orgFields, address: e.target.value })}
                                placeholder="e.g. 12 High Street"
                                className="mt-1"
                              />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <label className="text-sm font-medium text-gray-700">Town / City</label>
                                <Input
                                  value={orgFields.city}
                                  onChange={(e) => setOrgFields({ ...orgFields, city: e.target.value })}
                                  placeholder="e.g. Manchester"
                                  className="mt-1"
                                />
                              </div>
                              <div>
                                <label className="text-sm font-medium text-gray-700">Postcode</label>
                                <Input
                                  value={orgFields.postcode}
                                  onChange={(e) => setOrgFields({ ...orgFields, postcode: e.target.value })}
                                  placeholder="e.g. M1 1AE"
                                  className="mt-1"
                                />
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="flex justify-end gap-3 pt-2">
                          <Button variant="outline" onClick={() => setOrgEditing(false)}>
                            Cancel
                          </Button>
                          <Button
                            onClick={() => updateOrgMutation.mutate(orgFields)}
                            disabled={updateOrgMutation.isPending || !orgFields.name.trim()}
                          >
                            {updateOrgMutation.isPending ? "Saving..." : "Save changes"}
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4">
                          <div>
                            <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">Firm Name</p>
                            <p className="text-base font-semibold text-gray-900 mt-0.5">{org.name}</p>
                          </div>
                          {(org as any).practiceType && (
                            <div>
                              <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">Type of Practice</p>
                              <p className="text-base text-gray-900 mt-0.5">{(org as any).practiceType}</p>
                            </div>
                          )}
                          {(org as any).phone && (
                            <div className="flex items-start gap-2">
                              <Phone className="h-4 w-4 text-gray-400 mt-0.5" />
                              <div>
                                <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">Phone</p>
                                <p className="text-base text-gray-900 mt-0.5">{(org as any).phone}</p>
                              </div>
                            </div>
                          )}
                          {(org as any).website && (
                            <div className="flex items-start gap-2">
                              <Globe className="h-4 w-4 text-gray-400 mt-0.5" />
                              <div>
                                <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">Website</p>
                                <a
                                  href={(org as any).website.startsWith('http') ? (org as any).website : `https://${(org as any).website}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-base text-blue-600 hover:underline mt-0.5 block"
                                >
                                  {(org as any).website}
                                </a>
                              </div>
                            </div>
                          )}
                          {((org as any).address || (org as any).city || (org as any).postcode) && (
                            <div className="flex items-start gap-2 sm:col-span-2">
                              <MapPin className="h-4 w-4 text-gray-400 mt-0.5" />
                              <div>
                                <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">Address</p>
                                <p className="text-base text-gray-900 mt-0.5">
                                  {[(org as any).address, (org as any).city, (org as any).postcode].filter(Boolean).join(', ')}
                                </p>
                              </div>
                            </div>
                          )}
                          <div>
                            <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">Slug</p>
                            <p className="text-sm text-gray-500 mt-0.5 font-mono bg-gray-50 px-2 py-1 rounded border inline-block">{org.slug || '—'}</p>
                          </div>
                        </div>
                        {!(org as any).phone && !(org as any).address && !(org as any).website && !(org as any).practiceType && (
                          <p className="text-sm text-gray-400 italic">No contact details added yet. Click Edit to add them.</p>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Subscription */}
                <Card>
                  <CardHeader>
                    <CardTitle>Subscription</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-3">
                      <Badge variant={subscriptionVariant(org.subscriptionStatus)}>
                        {subscriptionLabel(org.subscriptionStatus)}
                      </Badge>
                      <span className="text-sm text-gray-500">
                        Member since {new Date(org.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500 mt-3">
                      To manage your subscription, upgrade, or view invoices, visit the{" "}
                      <button
                        onClick={() => setActiveTab("billing")}
                        className="text-blue-600 hover:underline font-medium"
                      >
                        Billing tab
                      </button>.
                    </p>
                  </CardContent>
                </Card>
              </>
            ) : (
              <Card>
                <CardContent className="py-8 text-center text-gray-500">
                  Could not load organisation details.
                </CardContent>
              </Card>
            )}
          </TabsContent>
        )}

        {/* Teams Tab */}
        <TabsContent value="teams" className="space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Team Management</h3>
              <p className="text-gray-600">Create and manage accounting teams for performance tracking</p>
            </div>
            <Button
              onClick={() => {
                setEditingTeam(null);
                form.reset({ name: "", description: "" });
                setShowTeamForm(!showTeamForm);
              }}
              className="bg-primary hover:bg-blue-700"
            >
              <Plus className="mr-2" size={16} />
              Add Team
            </Button>
          </div>

          {showTeamForm && (
            <Card>
              <CardHeader>
                <CardTitle>{editingTeam ? "Edit Team" : "Create New Team"}</CardTitle>
              </CardHeader>
              <CardContent>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                    <FormField
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Team Name</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g., Pod 1, Team Alpha" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="description"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Description (Optional)</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="Team description or notes..."
                              {...field}
                              value={field.value || ""}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="flex gap-2">
                      <Button type="submit" disabled={createTeamMutation.isPending || updateTeamMutation.isPending}>
                        {(createTeamMutation.isPending || updateTeamMutation.isPending) ? "Saving..." :
                          editingTeam ? "Update Team" : "Create Team"}
                      </Button>
                      <Button type="button" variant="outline" onClick={() => { setShowTeamForm(false); setEditingTeam(null); form.reset(); }}>
                        Cancel
                      </Button>
                    </div>
                  </form>
                </Form>
              </CardContent>
            </Card>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {(teams as Team[])?.map((team) => (
              <Card key={team.id} className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-lg">{team.name}</CardTitle>
                      {team.description && (
                        <p className="text-sm text-gray-600 mt-1">{team.description}</p>
                      )}
                    </div>
                    <div className="flex gap-1">
                      <Button size="sm" variant="outline" onClick={() => handleEdit(team)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button size="sm" variant="outline" className="text-red-600 hover:text-red-700 hover:bg-red-50">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Team</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to delete "{team.name}"? This cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => deleteTeamMutation.mutate(team.id)} className="bg-red-600 hover:bg-red-700">
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="text-sm text-gray-500">Created: {new Date(team.createdAt).toLocaleDateString()}</div>
                  <Badge variant="secondary" className="mt-2">Active Team</Badge>
                </CardContent>
              </Card>
            ))}
          </div>

          {!(teams as Team[])?.length && (
            <Card>
              <CardContent className="text-center py-8">
                <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600 mb-4">No teams created yet</p>
                <Button onClick={() => { setEditingTeam(null); form.reset({ name: "", description: "" }); setShowTeamForm(true); }}>
                  <Plus className="mr-2" size={16} />
                  Create Your First Team
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Users Tab */}
        <TabsContent value="users" className="space-y-6">
          <Card>
            <CardContent className="text-center py-12">
              <Shield className="h-16 w-16 text-blue-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">User Management</h3>
              <p className="text-gray-600 mb-6">
                Manage user accounts, roles, and permissions. Access the full user management interface.
              </p>
              <Link href="/admin/users">
                <Button className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Go to User Management
                </Button>
              </Link>
              <div className="mt-6 text-sm text-gray-500">
                <p>Available features:</p>
                <ul className="text-left space-y-1 max-w-md mx-auto mt-2">
                  <li>• User account management</li>
                  <li>• Role-based access control</li>
                  <li>• User invitations</li>
                  <li>• Permission administration</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Practice Standards Tab */}
        {isAdmin && (
          <TabsContent value="standards" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <SlidersHorizontal className="h-5 w-5" />
                    Practice Standards
                  </CardTitle>
                  {!standardsEditing && org && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setStandardsFields({
                          vatCompletionDay: (org as any).vatCompletionDay ?? 28,
                          mgmtAccountsDay: (org as any).mgmtAccountsDay ?? 15,
                          bookkeepingUpperThreshold: (org as any).bookkeepingUpperThreshold ?? 85,
                          bookkeepingLowerThreshold: (org as any).bookkeepingLowerThreshold ?? 70,
                          bookkeepingPlatform: (org as any).bookkeepingPlatform ?? "Dext Precision",
                          bookkeepingPlatformCustom: (org as any).bookkeepingPlatformCustom ?? "",
                        });
                        setStandardsEditing(true);
                      }}
                    >
                      <Edit className="h-3 w-3 mr-1" /> Edit
                    </Button>
                  )}
                </div>
                <CardDescription>
                  Configure thresholds and milestones used across your scorecard modules. These defaults are based on industry best practice.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {orgLoading ? (
                  <div className="animate-pulse h-32 bg-gray-100 rounded-lg" />
                ) : standardsEditing ? (
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="text-sm font-medium">VAT Completion Day</label>
                        <p className="text-xs text-muted-foreground">Target day of month for 100% VAT return completion (e.g. 28)</p>
                        <Input
                          type="number"
                          min={1}
                          max={31}
                          value={standardsFields.vatCompletionDay}
                          onChange={(e) => setStandardsFields({ ...standardsFields, vatCompletionDay: parseInt(e.target.value) || 28 })}
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Management Accounts Day</label>
                        <p className="text-xs text-muted-foreground">Target day of month for management accounts completion (e.g. 15)</p>
                        <Input
                          type="number"
                          min={1}
                          max={31}
                          value={standardsFields.mgmtAccountsDay}
                          onChange={(e) => setStandardsFields({ ...standardsFields, mgmtAccountsDay: parseInt(e.target.value) || 15 })}
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Bookkeeping Upper Threshold %</label>
                        <p className="text-xs text-muted-foreground">Clients with scores below this are flagged (e.g. 85)</p>
                        <Input
                          type="number"
                          min={1}
                          max={100}
                          value={standardsFields.bookkeepingUpperThreshold}
                          onChange={(e) => setStandardsFields({ ...standardsFields, bookkeepingUpperThreshold: parseInt(e.target.value) || 85 })}
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Bookkeeping Lower Threshold %</label>
                        <p className="text-xs text-muted-foreground">Clients below this are considered high risk (e.g. 70)</p>
                        <Input
                          type="number"
                          min={1}
                          max={100}
                          value={standardsFields.bookkeepingLowerThreshold}
                          onChange={(e) => setStandardsFields({ ...standardsFields, bookkeepingLowerThreshold: parseInt(e.target.value) || 70 })}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Bookkeeping Quality Platform</label>
                      <p className="text-xs text-muted-foreground">The platform used to measure bookkeeping quality scores</p>
                      <Select
                        value={standardsFields.bookkeepingPlatform}
                        onValueChange={(v) => setStandardsFields({ ...standardsFields, bookkeepingPlatform: v })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Dext Precision">Dext Precision</SelectItem>
                          <SelectItem value="AutoEntry">AutoEntry</SelectItem>
                          <SelectItem value="Hubdoc">Hubdoc</SelectItem>
                          <SelectItem value="Receipt Bank">Receipt Bank</SelectItem>
                          <SelectItem value="Other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {standardsFields.bookkeepingPlatform === "Other" && (
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Custom Platform Name</label>
                        <Input
                          value={standardsFields.bookkeepingPlatformCustom}
                          onChange={(e) => setStandardsFields({ ...standardsFields, bookkeepingPlatformCustom: e.target.value })}
                          placeholder="Enter platform name"
                        />
                      </div>
                    )}
                    <div className="flex gap-3">
                      <Button
                        onClick={() => updateStandardsMutation.mutate(standardsFields)}
                        disabled={updateStandardsMutation.isPending}
                      >
                        {updateStandardsMutation.isPending ? "Saving..." : "Save Standards"}
                      </Button>
                      <Button variant="outline" onClick={() => setStandardsEditing(false)}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : org ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div>
                      <p className="text-sm text-muted-foreground">VAT Completion Day</p>
                      <p className="font-medium">{(org as any).vatCompletionDay ?? 28}th of the month</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Management Accounts Day</p>
                      <p className="font-medium">{(org as any).mgmtAccountsDay ?? 15}th of the month</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Bookkeeping Upper Threshold</p>
                      <p className="font-medium">{(org as any).bookkeepingUpperThreshold ?? 85}%</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Bookkeeping Lower Threshold</p>
                      <p className="font-medium">{(org as any).bookkeepingLowerThreshold ?? 70}%</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Bookkeeping Quality Platform</p>
                      <p className="font-medium">
                        {(org as any).bookkeepingPlatform === "Other"
                          ? (org as any).bookkeepingPlatformCustom || "Other"
                          : (org as any).bookkeepingPlatform ?? "Dext Precision"}
                      </p>
                    </div>
                  </div>
                ) : null}
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* Integrations Tab (admin only) */}
        {isAdmin && (
          <TabsContent value="integrations" className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-1">Integrations</h2>
              <p className="text-sm text-gray-500">Connect third-party tools to automate data sync and unlock new features.</p>
            </div>

            {/* Dext Integration Card */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-orange-100 flex items-center justify-center">
                      <Plug className="h-5 w-5 text-orange-600" />
                    </div>
                    <div>
                      <CardTitle className="text-base">Dext Precision</CardTitle>
                      <CardDescription className="text-sm">Bookkeeping quality &amp; client data</CardDescription>
                    </div>
                  </div>
                  <Badge variant="secondary" className="text-xs bg-gray-100 text-gray-600 border border-gray-200">
                    Not connected
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-gray-600">
                  Connect Dext Precision to automatically sync client turnover data. When connected, clients matched to their Dext record will have their annual revenue updated automatically — powering the Turnover Mismatch section in Client Value Manager.
                </p>
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                  <p className="text-xs text-amber-800 font-medium">What you'll get when connected:</p>
                  <ul className="text-xs text-amber-700 mt-1.5 space-y-1 list-disc list-inside">
                    <li>Automatic client matching via Dext Client ID</li>
                    <li>Annual revenue synced to Current Known Turnover field</li>
                    <li>Turnover Last Updated date set automatically</li>
                    <li>Turnover Mismatch alerts kept up to date without manual entry</li>
                  </ul>
                </div>
                <Button
                  variant="outline"
                  disabled
                  className="opacity-50 cursor-not-allowed"
                >
                  <Plug className="mr-2 h-4 w-4" />
                  Coming soon — contact us to join the beta
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* Billing Tab */}
        <TabsContent value="billing" className="space-y-6">
          <BillingTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
