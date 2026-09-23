import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Check, Zap, ArrowLeft } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { Link, useLocation } from "wouter";

const PLAN_ORDER = ["starter", "growth", "scale", "pro"] as const;

export default function ChoosePlanPage() {
  const [annual, setAnnual] = useState(false);
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();
  const userAny = user as any;

  const { data: plansArray, isLoading } = useQuery<Array<{
    id: string;
    name: string;
    monthlyPrice: number;
    yearlyPrice: number;
    features: string[];
    limits: { users: number | null; clients: number | null };
    highlight: boolean;
  }>>({
    queryKey: ["/api/stripe/plans"],
  });

  const checkoutMutation = useMutation({
    mutationFn: async ({ planKey, interval }: { planKey: string; interval: string }) => {
      const res = await apiRequest("/api/stripe/checkout", "POST", { planKey, interval });
      if (!res.ok) {
        const e = await res.json();
        throw new Error(e.message || "Failed to create checkout session");
      }
      return res.json();
    },
    onSuccess: (data) => {
      if (data.url) {
        window.location.href = data.url;
      }
    },
    onError: (e: Error) =>
      toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const org = userAny?.organisation;
  const trialEndsAt = org?.trialEndsAt ? new Date(org.trialEndsAt) : null;
  const trialDaysLeft = trialEndsAt
    ? Math.max(0, Math.ceil((trialEndsAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : null;

  // Convert array to keyed map for existing rendering logic
  const plans = Object.fromEntries((plansArray || []).map(p => [p.id, p]));

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 py-12">
        {/* Header */}
        <div className="text-center mb-10">
          {userAny?.organisation && (
            <Link href="/" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-6">
              <ArrowLeft className="h-4 w-4" />
              Back to app
            </Link>
          )}
          <h1 className="text-4xl font-bold text-gray-900 mt-4 mb-3">Choose your plan</h1>
          {trialDaysLeft !== null && trialDaysLeft > 0 ? (
            <div className="inline-flex items-center gap-2 bg-amber-50 border border-amber-200 text-amber-800 px-4 py-2 rounded-lg text-sm font-medium mb-4">
              Your free trial ends in {trialDaysLeft} day{trialDaysLeft !== 1 ? "s" : ""}. Subscribe now to keep access.
            </div>
          ) : trialDaysLeft === 0 ? (
            <div className="inline-flex items-center gap-2 bg-red-50 border border-red-200 text-red-800 px-4 py-2 rounded-lg text-sm font-medium mb-4">
              Your free trial has ended. Subscribe to restore access.
            </div>
          ) : null}
          <p className="text-gray-500 text-lg">
            Simple, transparent pricing. Cancel anytime.
          </p>

          {/* Monthly / Annual toggle */}
          <div className="flex items-center justify-center gap-3 mt-8">
            <Label htmlFor="billing-toggle" className={!annual ? "font-semibold text-gray-900" : "text-gray-500"}>
              Monthly
            </Label>
            <Switch
              id="billing-toggle"
              checked={annual}
              onCheckedChange={setAnnual}
            />
            <Label htmlFor="billing-toggle" className={annual ? "font-semibold text-gray-900" : "text-gray-500"}>
              Annual
              <Badge className="ml-2 bg-green-100 text-green-800 text-xs">2 months free</Badge>
            </Label>
          </div>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="bg-white rounded-xl border h-96 animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {PLAN_ORDER.map((planKey) => {
              const plan = plans[planKey];
              if (!plan) return null;
              const monthlyEq = annual
                ? Math.round(plan.yearlyPrice / 12)
                : plan.monthlyPrice;
              const fullPrice = annual ? plan.yearlyPrice : plan.monthlyPrice;
              const interval = annual ? "yearly" : "monthly";
              const isPro = planKey === "pro";
              const isPopular = plan.highlight;

              return (
                <Card
                  key={planKey}
                  className={`relative flex flex-col ${
                    isPopular
                      ? "border-blue-500 border-2 shadow-lg"
                      : "border-gray-200"
                  }`}
                >
                  {isPopular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <Badge className="bg-blue-600 text-white px-3 py-1">Most Popular</Badge>
                    </div>
                  )}

                  <CardHeader className="pb-4">
                    <CardTitle className="text-xl font-bold text-gray-900">{plan.name}</CardTitle>
                    <div className="mt-2">
                      <span className="text-3xl font-extrabold text-gray-900">
                        £{isPro ? (annual ? "166" : "199") : monthlyEq}
                      </span>
                      <span className="text-gray-500 ml-1">/mo + VAT</span>
                      {annual && (
                        <p className="text-sm text-gray-400 mt-1">
                          £{isPro ? "1,990" : fullPrice}/year + VAT billed annually
                        </p>
                      )}
                    </div>
                    <div className="text-sm text-gray-600 mt-2">
                      {plan.limits.users ? `Up to ${plan.limits.users} users` : "Unlimited users"} ·{" "}
                      {plan.limits.clients ? `Up to ${plan.limits.clients} clients` : "Unlimited clients"}
                    </div>
                  </CardHeader>

                  <CardContent className="flex flex-col flex-1">
                    <ul className="space-y-2 flex-1 mb-6">
                      {(plan.features || []).map((feature: string, i: number) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                          <Check className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                          {feature}
                        </li>
                      ))}
                    </ul>

                    <Button
                      className={`w-full ${
                        isPopular
                          ? "bg-blue-600 hover:bg-blue-700 text-white"
                          : "bg-gray-900 hover:bg-gray-800 text-white"
                      }`}
                      onClick={() =>
                        checkoutMutation.mutate({ planKey, interval })
                      }
                      disabled={checkoutMutation.isPending}
                    >
                      {checkoutMutation.isPending ? (
                        "Redirecting..."
                      ) : (
                        <>
                          <Zap className="h-4 w-4 mr-1" />
                          Subscribe
                        </>
                      )}
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        <p className="text-center text-sm text-gray-400 mt-8">
          Prices in GBP. Cancel anytime. Secure payments via Stripe.
        </p>
      </div>
    </div>
  );
}
