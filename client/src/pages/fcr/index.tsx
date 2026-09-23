import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import { apiRequest } from "@/lib/queryClient";
import { Plus, Trash2, ChevronRight, Building2 } from "lucide-react";
import { format } from "date-fns";

type Review = {
  id: number;
  businessName: string | null;
  contact: string | null;
  adviser: string | null;
  reviewDate: string | null;
  chaosStatus: string | null;
  clarityStatus: string | null;
  performanceStatus: string | null;
  leadershipStatus: string | null;
  recommendedNextStep: string | null;
  createdAt: string;
};

function TrafficDot({ status }: { status: string | null }) {
  if (!status) return <span className="w-2.5 h-2.5 rounded-full bg-gray-200 inline-block" />;
  const colour =
    status === "green" ? "bg-emerald-500" :
    status === "amber" ? "bg-amber-400" :
    status === "red" ? "bg-red-500" : "bg-gray-200";
  return <span className={`w-2.5 h-2.5 rounded-full ${colour} inline-block`} />;
}

const NEXT_STEP_LABELS: Record<string, string> = {
  remain: "Remain as they are",
  diy: "DIY implementation",
  control_chaos: "Control the Chaos",
  create_clarity: "Create Financial Clarity",
  build_performance: "Build Better Performance",
  lead_confidence: "Lead with Confidence",
  other: "Other",
};

export default function FcrIndex() {
  const [, navigate] = useLocation();
  const qc = useQueryClient();

  const { data: reviews = [], isLoading } = useQuery<Review[]>({
    queryKey: ["/api/fcr"],
    queryFn: () => apiRequest("/api/fcr", "GET").then((r) => r.json()),
  });

  const createMutation = useMutation({
    mutationFn: () => apiRequest("/api/fcr", "POST").then((r) => r.json()),
    onSuccess: (review: Review) => {
      qc.invalidateQueries({ queryKey: ["/api/fcr"] });
      navigate(`/fcr/${review.id}`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest(`/api/fcr/${id}`, "DELETE"),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/fcr"] }),
  });

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Financial Clarity Review™</h1>
          <p className="text-sm text-gray-500 mt-1">
            Capture structured insights and identify where clients sit on the Chaos to Clarity journey.
          </p>
        </div>
        <Button
          onClick={() => createMutation.mutate()}
          disabled={createMutation.isPending}
          className="gap-2"
        >
          <Plus size={16} />
          New Review
        </Button>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="text-sm text-gray-400 py-12 text-center">Loading reviews…</div>
      ) : reviews.length === 0 ? (
        <Card>
          <CardContent className="py-16 flex flex-col items-center gap-4 text-center">
            <Building2 size={40} className="text-gray-300" />
            <div>
              <p className="font-medium text-gray-700">No reviews yet</p>
              <p className="text-sm text-gray-400 mt-1">
                Start a new review and complete it live during the meeting.
              </p>
            </div>
            <Button
              onClick={() => createMutation.mutate()}
              disabled={createMutation.isPending}
              variant="outline"
              className="gap-2"
            >
              <Plus size={14} />
              Start first review
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {reviews.map((review) => (
            <Card
              key={review.id}
              className="hover:shadow-sm transition-shadow cursor-pointer group"
              onClick={() => navigate(`/fcr/${review.id}`)}
            >
              <CardContent className="py-4 px-5 flex items-center gap-4">
                {/* Business info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900 truncate">
                      {review.businessName || <span className="text-gray-400 italic">Unnamed business</span>}
                    </span>
                    {review.recommendedNextStep && (
                      <Badge variant="secondary" className="text-xs shrink-0">
                        {NEXT_STEP_LABELS[review.recommendedNextStep] ?? review.recommendedNextStep}
                      </Badge>
                    )}
                  </div>
                  <div className="text-sm text-gray-500 mt-0.5 flex items-center gap-3">
                    {review.contact && <span>{review.contact}</span>}
                    {review.adviser && <span>· {review.adviser}</span>}
                    {review.reviewDate && (
                      <span>
                        · {format(new Date(review.reviewDate), "d MMM yyyy")}
                      </span>
                    )}
                  </div>
                </div>

                {/* Traffic lights */}
                <div className="flex items-center gap-1.5 shrink-0" title="Chaos · Clarity · Performance · Leadership">
                  <TrafficDot status={review.chaosStatus} />
                  <TrafficDot status={review.clarityStatus} />
                  <TrafficDot status={review.performanceStatus} />
                  <TrafficDot status={review.leadershipStatus} />
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-gray-400 hover:text-red-500"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Trash2 size={14} />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete review?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will permanently delete the Financial Clarity Review for{" "}
                          <strong>{review.businessName || "this business"}</strong>. This cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          className="bg-red-600 hover:bg-red-700"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteMutation.mutate(review.id);
                          }}
                        >
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                  <ChevronRight size={16} className="text-gray-400" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
