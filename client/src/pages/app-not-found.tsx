import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { FileQuestion } from "lucide-react";

export default function AppNotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 text-center">
      <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gray-100 mb-6">
        <FileQuestion className="h-8 w-8 text-gray-400" />
      </div>

      <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-3">
        Page not found
      </h1>
      <p className="text-gray-500 mb-8 max-w-sm">
        The page you're looking for doesn't exist or you may not have permission to view it.
      </p>

      <Link href="/">
        <Button className="bg-blue-600 hover:bg-blue-700 text-white">
          Go to dashboard
        </Button>
      </Link>
    </div>
  );
}
