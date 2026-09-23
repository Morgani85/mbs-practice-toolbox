import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ShieldOff } from "lucide-react";

export default function AppForbidden() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 text-center">
      <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-amber-50 mb-6">
        <ShieldOff className="h-8 w-8 text-amber-500" />
      </div>

      <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-3">
        Access denied
      </h1>
      <p className="text-gray-500 mb-8 max-w-sm">
        You don't have permission to view this page.
      </p>

      <Link href="/">
        <Button className="bg-blue-600 hover:bg-blue-700 text-white">
          Go to dashboard
        </Button>
      </Link>
    </div>
  );
}
