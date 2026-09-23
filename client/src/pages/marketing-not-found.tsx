import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { BarChart3, Home, Zap, PoundSterling } from "lucide-react";
import MarketingNav, { MarketingFooter } from "@/components/marketing/nav";

export default function MarketingNotFound() {
  return (
    <div className="min-h-screen bg-white flex flex-col">
      <MarketingNav />

      <main className="flex-1 flex flex-col items-center justify-center px-4 py-24 text-center">
        <div className="max-w-lg mx-auto">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-blue-50 mb-6">
            <span className="text-3xl font-black text-blue-600">404</span>
          </div>

          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
            Page not found
          </h1>
          <p className="text-lg text-gray-500 mb-10">
            The page you're looking for doesn't exist or may have moved.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center mb-10">
            <Link href="/">
              <Button size="lg" className="bg-blue-600 hover:bg-blue-700 text-white w-full sm:w-auto">
                Go to homepage
              </Button>
            </Link>
          </div>

          <div className="border-t border-gray-100 pt-8">
            <p className="text-sm text-gray-400 mb-4 font-medium uppercase tracking-wide">
              Helpful links
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/" className="flex items-center gap-2 text-sm text-gray-600 hover:text-blue-600 transition-colors justify-center">
                <Home className="h-4 w-4" />
                Home
              </Link>
              <Link href="/features" className="flex items-center gap-2 text-sm text-gray-600 hover:text-blue-600 transition-colors justify-center">
                <Zap className="h-4 w-4" />
                Features
              </Link>
              <Link href="/valuation-tool" className="flex items-center gap-2 text-sm text-gray-600 hover:text-blue-600 transition-colors justify-center">
                <PoundSterling className="h-4 w-4" />
                Value My Practice
              </Link>
            </div>
          </div>
        </div>
      </main>

      <MarketingFooter />
    </div>
  );
}
