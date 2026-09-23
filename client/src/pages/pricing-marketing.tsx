import { useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, ArrowRight, Zap } from "lucide-react";
import MarketingNav, { MarketingFooter } from "@/components/marketing/nav";

const plans = [
  {
    id: "starter",
    name: "Starter",
    monthlyPrice: 29,
    yearlyPrice: 290,
    description: "Up to 3 users",
    color: "border-gray-200",
    ctaColor: "bg-gray-800 hover:bg-gray-700 text-white",
    features: [
      "All 8 staff scorecard modules",
      "Weekly performance tracking",
      "Up to 50 clients",
      "Basic dashboards and charts",
      "Email support",
    ],
  },
  {
    id: "growth",
    name: "Growth",
    monthlyPrice: 69,
    yearlyPrice: 690,
    description: "Up to 8 users",
    highlight: true,
    color: "border-blue-500 border-2",
    ctaColor: "bg-blue-600 hover:bg-blue-700 text-white",
    features: [
      "Everything in Starter",
      "Up to 8 users",
      "Up to 150 clients",
      "Client Value Manager",
      "AI-powered performance analysis",
      "Strategic Planning tools",
      "Multi-team and pod management",
      "Priority email support",
    ],
  },
  {
    id: "scale",
    name: "Scale",
    monthlyPrice: 129,
    yearlyPrice: 1290,
    description: "Up to 20 users",
    color: "border-gray-200",
    ctaColor: "bg-indigo-700 hover:bg-indigo-600 text-white",
    features: [
      "Everything in Growth",
      "Up to 20 users",
      "Up to 500 clients",
      "Advanced analytics",
      "Priority support",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    monthlyPrice: 199,
    yearlyPrice: 1990,
    description: "Unlimited users",
    color: "border-gray-200",
    ctaColor: "bg-slate-900 hover:bg-slate-800 text-white",
    features: [
      "Everything in Scale",
      "Unlimited users",
      "Unlimited clients",
      "Dedicated onboarding",
      "Dedicated support",
    ],
  },
];

const faqs = [
  { q: "Is there a free trial?", a: "We're currently launching — register your interest and we'll be in touch about early access options and any introductory offers when we go live." },
  { q: "Do prices include VAT?", a: "No — all prices shown are exclusive of VAT. 20% UK VAT will be added at checkout. Your Stripe invoice will show a full VAT breakdown." },
  { q: "Can I switch plans?", a: "Yes, you can upgrade or downgrade at any time from within the app. Upgrades take effect immediately with prorated billing. Downgrades take effect at your next renewal date." },
  { q: "What payment methods are accepted?", a: "We accept all major credit and debit cards through our Stripe-powered checkout. Your billing details are stored securely by Stripe — we never see your card number." },
  { q: "When will it be available?", a: "We're in the final stages of launch. Register your interest and you'll be among the first to know when Practice Toolbox goes live." },
  { q: "Do you offer discounts for annual billing?", a: "Yes — choosing annual billing gives you roughly 2 months free compared to paying monthly. The discount is applied automatically when you select the yearly option at checkout." },
];

export default function PricingMarketingPage() {
  const [annual, setAnnual] = useState(false);

  return (
    <div className="min-h-screen bg-white">
      <MarketingNav />

      {/* ── Hero ─────────────────────────────────────────────── */}
      <section className="bg-gradient-to-br from-slate-900 to-blue-950 py-20 text-center">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <Badge className="mb-4 bg-blue-600/20 text-blue-300 border-blue-700/50">Pricing</Badge>
          <h1 className="text-4xl sm:text-5xl font-extrabold text-white leading-tight">
            Simple, transparent pricing
          </h1>
          <p className="mt-5 text-lg text-slate-300">
            Launching soon. Register your interest to be first in line.
          </p>

          {/* Toggle */}
          <div className="mt-8 inline-flex items-center gap-3 bg-slate-800 rounded-full p-1">
            <button
              onClick={() => setAnnual(false)}
              className={`px-5 py-2 rounded-full text-sm font-medium transition-all ${!annual ? "bg-white text-gray-900 shadow-sm" : "text-slate-400 hover:text-white"}`}
            >
              Monthly
            </button>
            <button
              onClick={() => setAnnual(true)}
              className={`px-5 py-2 rounded-full text-sm font-medium transition-all flex items-center gap-2 ${annual ? "bg-white text-gray-900 shadow-sm" : "text-slate-400 hover:text-white"}`}
            >
              Annual
              <span className="text-xs bg-green-500 text-white px-2 py-0.5 rounded-full font-semibold">Save ~17%</span>
            </button>
          </div>
        </div>
      </section>

      {/* ── Valuation banner ─────────────────────────────────── */}
      <div className="bg-teal-50 border-b border-teal-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 text-center text-sm text-teal-800">
          Not sure if Practice Toolbox is right for you? Start with our free{" "}
          <Link href="/valuation-tool" className="font-semibold underline underline-offset-2 hover:text-teal-600">
            valuation calculator
          </Link>{" "}
          — no login required.
        </div>
      </div>

      {/* ── Plans ────────────────────────────────────────────── */}
      <section className="py-16 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
            {plans.map((plan) => {
              const displayMonthly = annual ? Math.round(plan.yearlyPrice / 12) : plan.monthlyPrice;
              return (
                <div
                  key={plan.id}
                  className={`relative flex flex-col bg-white rounded-2xl border p-7 shadow-sm ${plan.color}`}
                >
                  {plan.highlight && (
                    <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                      <span className="inline-flex items-center gap-1.5 bg-blue-600 text-white text-xs font-bold px-3 py-1.5 rounded-full shadow">
                        <Zap className="h-3 w-3" /> Most Popular
                      </span>
                    </div>
                  )}

                  <div className="mb-5">
                    <h3 className="text-xl font-bold text-gray-900">{plan.name}</h3>
                    <p className="text-sm text-gray-500 mt-0.5">{plan.description}</p>
                  </div>

                  <div className="mb-2">
                    <span className="text-4xl font-extrabold text-gray-900">£{displayMonthly}</span>
                    <span className="text-gray-500 ml-1">/mo + VAT</span>
                  </div>
                  {annual ? (
                    <p className="text-xs text-gray-400 mb-6">£{plan.yearlyPrice}/year + VAT billed annually</p>
                  ) : (
                    <p className="text-xs text-gray-400 mb-6">Billed monthly</p>
                  )}

                  <ul className="space-y-2.5 flex-1 mb-7">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start gap-2 text-sm text-gray-700">
                        <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                        {f}
                      </li>
                    ))}
                  </ul>

                  <Link href="/register-interest" className="block">
                    <Button className={`w-full ${plan.ctaColor} shadow-sm`}>
                      Register Interest
                    </Button>
                  </Link>
                </div>
              );
            })}
          </div>

          <p className="text-center text-sm text-gray-500 mt-6">
            Launching soon — register your interest and we'll be in touch when we're ready.
          </p>
        </div>
      </section>

      {/* ── What's included in all plans ─────────────────────── */}
      <section className="py-16 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Included in every plan</h2>
          <p className="text-gray-600 mb-10">No matter which plan you choose, you get access to the full Practice Toolbox platform.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-left">
            {[
              "8 operational staff scorecard modules",
              "Weekly performance tracking",
              "Charts and trend visualisation",
              "Multi-team / multi-pod structure",
              "Role-based access control",
              "AI-powered analysis",
              "Strategic Planning (rocks, values, targets)",
              "Date-validated data entry",
              "CSV data export",
              "User invitations by email",
              "Organisation-level data isolation",
              "Early access for registered interest",
            ].map((item) => (
              <div key={item} className="flex items-center gap-3 p-3 bg-green-50 rounded-lg border border-green-100">
                <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0" />
                <span className="text-sm text-gray-800">{item}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ──────────────────────────────────────────────── */}
      <section className="py-16 bg-slate-50">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-10 text-center">Frequently asked questions</h2>
          <div className="space-y-6">
            {faqs.map((faq) => (
              <div key={faq.q} className="bg-white rounded-xl p-6 border border-gray-200">
                <h3 className="font-semibold text-gray-900 mb-2">{faq.q}</h3>
                <p className="text-sm text-gray-600 leading-relaxed">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────────────── */}
      <section className="py-20 bg-gradient-to-br from-blue-600 to-blue-800 text-center">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-white mb-4">Launching soon — be first in line.</h2>
          <p className="text-blue-100 mb-8 text-lg">
            Tell us about your practice and we'll be in touch with early access and pricing details.
          </p>
          <Link href="/register-interest">
            <Button size="lg" className="bg-white text-blue-700 hover:bg-blue-50 px-10">
              Register Your Interest
            </Button>
          </Link>
        </div>
      </section>

      <MarketingFooter />
    </div>
  );
}
