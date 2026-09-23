import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle2, BarChart3, FileText, Receipt, BookOpen, ClipboardCheck,
  PoundSterling, TrendingUp, Brain, Users, Shield, Target, Zap, ArrowRight,
  Building2, Heart, Calculator,
} from "lucide-react";
import MarketingNav, { MarketingFooter } from "@/components/marketing/nav";
import overviewImg from "@assets/Screenshot_2026-03-26_at_20.25.53_1774559830128.png";
import weeklyTrendImg from "@assets/Screenshot_2026-03-26_at_20.26.11_1774559830127.png";
import clientValueImg from "@assets/Screenshot_2026-03-26_at_20.27.03_1774559830126.png";

const scorecardsModules = [
  { icon: FileText, name: "Accounts", desc: "Track accounts in progress, due, and completed vs weekly target." },
  { icon: Receipt, name: "VAT", desc: "Monitor VAT returns due, filed, and overdue across all clients." },
  { icon: BookOpen, name: "Management Accounts", desc: "Track monthly management accounts with clear 1st-to-15th deadline visibility." },
  { icon: BookOpen, name: "Internal Bookkeeping", desc: "Monitor bookkeeping status, Dext scores, and oldest unresolved items." },
  { icon: Building2, name: "Client Bookkeeping", desc: "Client bookkeeping dashboards with Dext data and team metrics." },
  { icon: ClipboardCheck, name: "Confirmation Statements", desc: "Track confirmation statements due, filed on time, and overdue." },
  { icon: Calculator, name: "Tax", desc: "Full tax return pipeline with targets, actuals, and completion rates." },
  { icon: Heart, name: "Health Checks", desc: "Track annual health check completion rates by team and overall." },
];

const practiceModules = [
  { icon: PoundSterling, name: "Client Value Manager", desc: "Track every client's fees, service level, and CCR pipeline. Automatic Fee Quality Scores, opportunity gap analysis, pricing alerts, and a full sortable/filterable client list with CSV export.", highlight: true },
  { icon: BarChart3, name: "Revenue Analytics", desc: "Coming soon — practice-wide revenue trends, MRR tracking, and growth analysis.", soon: true },
  { icon: TrendingUp, name: "Upgrades Pipeline", desc: "Coming soon — track upgrade conversations, CCR status, and fee increase opportunities.", soon: true },
];

const strategicModules = [
  { icon: Target, name: "Quarterly Goals (Rocks)", desc: "Set and track quarterly OKRs / rocks for the practice. Review progress weekly with built-in reminder dialogs." },
  { icon: TrendingUp, name: "Long-Term Targets", desc: "Define where you want the practice to be in 3–5 years. Connect long-term vision to quarterly execution." },
  { icon: Heart, name: "Practice Values", desc: "Document and share your practice values so every team member understands what you stand for." },
];

export default function FeaturesPage() {
  return (
    <div className="min-h-screen bg-white">
      <MarketingNav />

      {/* ── Hero ─────────────────────────────────────────────── */}
      <section className="bg-gradient-to-br from-slate-900 to-blue-950 py-20 text-center">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <Badge className="mb-4 bg-blue-600/20 text-blue-300 border-blue-700/50">Platform Features</Badge>
          <h1 className="text-4xl sm:text-5xl font-extrabold text-white leading-tight">
            Every tool your practice needs to perform, grow, and scale — in one place
          </h1>
          <p className="mt-5 text-lg text-slate-300 max-w-2xl mx-auto leading-relaxed">
            Eight operational modules, AI analysis, client value management, strategic planning, and full multi-team support — all in one platform.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/register-interest">
              <Button size="lg" className="bg-blue-600 hover:bg-blue-500 text-white px-8">
                Register Interest <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <Link href="/pricing">
              <Button size="lg" variant="outline" className="border-slate-600 text-white hover:bg-slate-800 bg-transparent px-8">
                See Pricing
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* ── Valuation Tool promo ─────────────────────────────── */}
      <section className="py-16 bg-gradient-to-br from-teal-50 to-cyan-50 border-b border-teal-100">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row sm:items-center gap-6">
            <div className="flex-1">
              <Badge className="mb-3 bg-teal-100 text-teal-700 border-0">Free Tool</Badge>
              <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-3">
                Start with your valuation — then improve it
              </h2>
              <p className="text-gray-600 leading-relaxed">
                The Practice Toolbox Valuation Calculator shows you what your firm is worth today and exactly what moves the number. Then Practice Toolbox gives you the tools to action every improvement.
              </p>
            </div>
            <div className="shrink-0">
              <Link href="/valuation-tool">
                <Button size="lg" className="bg-teal-600 hover:bg-teal-700 text-white px-7 whitespace-nowrap">
                  Try the free valuation tool <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── Staff Scorecards ─────────────────────────────────── */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-14 items-start">
            <div>
              <Badge className="mb-3 bg-blue-100 text-blue-700 border-0">Staff Scorecards</Badge>
              <h2 className="text-3xl font-bold text-gray-900 mb-4">Eight operational modules tracked in one place</h2>
              <p className="text-gray-600 leading-relaxed mb-8">
                The Staff Scorecards section covers every core service line in an accounting practice. Set targets by team, record weekly actuals, and compare performance across pods — all from a single performance overview dashboard.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {scorecardsModules.map((m) => (
                  <div key={m.name} className="bg-slate-50 rounded-lg p-4 border border-gray-100">
                    <div className="flex items-center gap-2 mb-2">
                      <m.icon className="h-4 w-4 text-blue-600" />
                      <h4 className="font-semibold text-gray-900 text-sm">{m.name}</h4>
                    </div>
                    <p className="text-xs text-gray-600 leading-relaxed">{m.desc}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="space-y-4 lg:sticky lg:top-24">
              <div className="rounded-xl overflow-hidden border border-gray-200 shadow-lg">
                <img src={overviewImg} alt="Performance Overview" className="w-full h-auto" />
              </div>
              <div className="rounded-xl overflow-hidden border border-gray-200 shadow-lg">
                <img src={weeklyTrendImg} alt="Weekly trend chart" className="w-full h-auto" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Practice Performance ─────────────────────────────── */}
      <section className="py-20 bg-gradient-to-br from-green-50 to-teal-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <Badge className="mb-3 bg-green-100 text-green-700 border-0">Practice Performance</Badge>
            <h2 className="text-3xl font-bold text-gray-900">Find the revenue hiding in your client list</h2>
            <p className="mt-3 text-gray-600 max-w-2xl mx-auto">
              Where Staff Scorecards track operational delivery, Practice Performance tracks the financial health and revenue of your firm.
            </p>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-12">
            {practiceModules.map((m) => (
              <div key={m.name} className={`rounded-xl p-6 border ${m.highlight ? "border-green-300 bg-white shadow-md" : "border-gray-200 bg-white/60"} ${m.soon ? "opacity-60" : ""}`}>
                <div className="flex items-center gap-2 mb-3">
                  <m.icon className="h-5 w-5 text-green-600" />
                  <h3 className="font-semibold text-gray-900">{m.name}</h3>
                  {m.soon && <Badge variant="outline" className="text-xs text-gray-400 border-gray-300 ml-auto">Coming soon</Badge>}
                  {m.highlight && <Badge className="bg-green-100 text-green-700 border-0 text-xs ml-auto">Live</Badge>}
                </div>
                <p className="text-sm text-gray-600 leading-relaxed">{m.desc}</p>
              </div>
            ))}
          </div>
          <div className="rounded-xl overflow-hidden border border-gray-200 shadow-xl max-w-4xl mx-auto">
            <img src={clientValueImg} alt="Client Value Manager" className="w-full h-auto" />
          </div>
        </div>
      </section>

      {/* ── Strategic Planning ───────────────────────────────── */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <Badge className="mb-3 bg-purple-100 text-purple-700 border-0">Strategic Planning</Badge>
            <h2 className="text-3xl font-bold text-gray-900">Connect your long-term vision to your daily operations</h2>
            <p className="mt-3 text-gray-600 max-w-2xl mx-auto">
              Strategic Planning gives your leadership team a structured place to set direction, communicate values, and track progress against annual goals.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {strategicModules.map((m) => (
              <div key={m.name} className="bg-purple-50 rounded-xl p-6 border border-purple-100">
                <m.icon className="h-6 w-6 text-purple-600 mb-3" />
                <h3 className="font-semibold text-gray-900 mb-2">{m.name}</h3>
                <p className="text-sm text-gray-600 leading-relaxed">{m.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── What's included checklist ────────────────────────── */}
      <section className="py-16 bg-slate-50 border-t border-gray-100">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-8 text-center">Everything included in your subscription</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              "Staff Scorecards (8 modules)",
              "Client Value Manager",
              "AI performance analysis",
              "Strategic Planning tools",
              "Multi-team / multi-pod support",
              "Role-based access control",
              "Weekly trend charts and dashboards",
              "Quarterly goals tracking",
              "Unlimited target and result entries",
              "CSV data export",
              "User invitations by email",
              "All features included",
              "No implementation required",
              "Cancel anytime",
            ].map((item) => (
              <div key={item} className="flex items-center gap-3 py-2 px-3 rounded-lg bg-green-50 border border-green-100">
                <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0" />
                <span className="text-sm text-gray-800">{item}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────────────── */}
      <section className="py-20 bg-gradient-to-br from-blue-600 to-blue-800 text-center">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-white mb-4">Ready to see it in action?</h2>
          <p className="text-blue-100 mb-8 text-lg">
            Join the waitlist and be first to know when Practice Toolbox opens to new firms.
          </p>
          <Link href="/register-interest">
            <Button size="lg" className="bg-white text-blue-700 hover:bg-blue-50 px-10">
              Register Interest
            </Button>
          </Link>
        </div>
      </section>

      <MarketingFooter />
    </div>
  );
}
