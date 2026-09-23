import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

export default function AppServerError() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 text-center">
      <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-red-50 mb-6">
        <AlertTriangle className="h-8 w-8 text-red-500" />
      </div>

      <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-3">
        Something went wrong
      </h1>
      <p className="text-gray-500 mb-8 max-w-sm">
        We're working to fix this. Your data is safe.
      </p>

      <Link href="/">
        <Button className="bg-blue-600 hover:bg-blue-700 text-white">
          Go to dashboard
        </Button>
      </Link>

      <p className="mt-6 text-sm text-gray-400">
        If the problem persists please contact{" "}
        <a href="mailto:hello@practicetoolbox.co.uk" className="text-blue-600 hover:underline">
          hello@practicetoolbox.co.uk
        </a>
      </p>
    </div>
  );
}
