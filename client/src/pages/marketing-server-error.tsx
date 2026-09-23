import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import MarketingNav, { MarketingFooter } from "@/components/marketing/nav";

export default function MarketingServerError() {
  return (
    <div className="min-h-screen bg-white flex flex-col">
      <MarketingNav />

      <main className="flex-1 flex flex-col items-center justify-center px-4 py-24 text-center">
        <div className="max-w-lg mx-auto">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-red-50 mb-6">
            <span className="text-3xl font-black text-red-500">500</span>
          </div>

          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
            Something went wrong
          </h1>
          <p className="text-lg text-gray-500 mb-10">
            We're aware of the issue and working to fix it. Please try again in a few minutes.
          </p>

          <Link href="/">
            <Button size="lg" className="bg-blue-600 hover:bg-blue-700 text-white">
              Go to homepage
            </Button>
          </Link>

          <p className="mt-8 text-sm text-gray-400">
            If the problem persists please contact us at{" "}
            <a href="mailto:hello@practicetoolbox.co.uk" className="text-blue-600 hover:underline">
              hello@practicetoolbox.co.uk
            </a>
          </p>
        </div>
      </main>

      <MarketingFooter />
    </div>
  );
}
