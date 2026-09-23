import { Card, CardContent } from "@/components/ui/card";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { Button } from "@/components/ui/button";
import { RefreshCw, AlertCircle } from "lucide-react";

interface PageLoadingProps {
  message?: string;
  timedOut?: boolean;
  onRetry?: () => void;
}

export function PageLoading({
  message = "Loading...",
  timedOut = false,
  onRetry,
}: PageLoadingProps) {
  const handleRetry = onRetry ?? (() => window.location.reload());

  if (timedOut) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="w-96">
          <CardContent className="flex flex-col items-center justify-center p-8">
            <AlertCircle className="h-10 w-10 text-amber-500 mb-4" />
            <p className="text-lg font-medium text-gray-700 mb-2 text-center">
              Taking longer than expected
            </p>
            <p className="text-sm text-gray-500 text-center mb-6">
              Please refresh the page to try again.
            </p>
            <Button onClick={handleRetry} className="flex items-center gap-2">
              <RefreshCw className="h-4 w-4" />
              Refresh page
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <Card className="w-96">
        <CardContent className="flex flex-col items-center justify-center p-8">
          <LoadingSpinner className="mb-4" />
          <p className="text-lg font-medium text-gray-700 mb-2">{message}</p>
          <p className="text-sm text-gray-500 text-center">
            Please wait while we load your data
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
