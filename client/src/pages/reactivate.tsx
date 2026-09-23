import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RefreshCw, AlertCircle } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { Link } from "wouter";

export default function ReactivatePage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const userAny = user as any;
  const org = userAny?.organisation;

  const reactivateMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("/api/stripe/checkout", "POST", {
        planKey: org?.subscriptionPlan || "starter",
        interval: org?.subscriptionInterval || "monthly",
      });
      if (!res.ok) {
        const e = await res.json();
        throw new Error(e.message || "Failed to start reactivation");
      }
      return res.json();
    },
    onSuccess: (data) => {
      if (data.url) window.location.href = data.url;
    },
    onError: (e: Error) =>
      toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const statusLabel =
    org?.subscriptionStatus === "paused" ? "paused" : "cancelled";

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 p-3 bg-orange-100 rounded-full w-fit">
            <AlertCircle className="h-8 w-8 text-orange-500" />
          </div>
          <CardTitle className="text-2xl">Your subscription is {statusLabel}</CardTitle>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          <p className="text-gray-600">
            Your Practice Toolbox subscription has been {statusLabel}. Reactivate to regain access to all features.
          </p>
          {org?.subscriptionPlan && (
            <div className="bg-gray-50 rounded-lg p-3 text-sm text-gray-700">
              Previous plan:{" "}
              <span className="font-semibold capitalize">{org.subscriptionPlan}</span>
              {org.subscriptionInterval && ` (${org.subscriptionInterval === "yearly" ? "annual" : "monthly"})`}
            </div>
          )}
          <Button
            className="w-full bg-blue-600 hover:bg-blue-700 text-white"
            onClick={() => reactivateMutation.mutate()}
            disabled={reactivateMutation.isPending}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            {reactivateMutation.isPending ? "Redirecting to Stripe..." : "Reactivate Subscription"}
          </Button>
          <p className="text-xs text-gray-400">
            Or choose a different plan on the{" "}
            <Link href="/choose-plan" className="text-blue-600 hover:underline">
              plans page
            </Link>
            .
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
