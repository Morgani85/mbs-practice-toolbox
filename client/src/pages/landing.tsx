import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ArrowRight, CheckCircle2, BarChart3, Users, TrendingUp, Brain,
  PoundSterling, Target, Shield, Zap, ChevronRight,
} from "lucide-react";
import MarketingNav, { MarketingFooter } from "@/components/marketing/nav";
import dashboardImg from "@assets/Screenshot_2026-03-26_at_20.25.32_1774559830128.png";
import overviewImg from "@assets/Screenshot_2026-03-26_at_20.25.53_1774559830128.png";
import weeklyTrendImg from "@assets/Screenshot_2026-03-26_at_20.26.11_1774559830127.png";
import monthlyPerfImg from "@assets/Screenshot_2026-03-26_at_20.26.39_1774559830127.png";
import clientValueImg from "@assets/Screenshot_2026-03-26_at_20.27.03_1774559830126.png";

const highlights = [
  { icon: BarChart3, label: "Staff Scorecards", desc: "Real-time performance metrics across every team and module" },
  { icon: PoundSterling, label: "Client Value Manager", desc: "Track fees, identify under-charged clients, and close the revenue gap" },
  { icon: Brain, label: "AI-Powered Analysis", desc: "AI analyses your performance data and surfaces risks automatically" },
  { icon: TrendingUp, label: "Strategic Planning", desc: "Quarterly goals, long-term targets, and practice values in one place" },
];

const modules = [
  "Accounts", "VAT", "Management Accounts", "Internal Bookkeeping",
  "Client Bookkeeping", "Confirmation Statements", "Tax", "Health Checks",
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white">
      <MarketingNav />

      {/* ── Hero ─────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_rgba(59,130,246,0.15),_transparent_60%)]" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-12 text-center">
          <Badge className="mb-5 bg-blue-600/20 text-blue-300 border-blue-700/50 hover:bg-blue-600/20">
            Built for accounting practices
          </Badge>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-white leading-tight tracking-tight max-w-4xl mx-auto">
            The operating system for{" "}
            <span className="text-blue-400">ambitious accounting firms</span>
          </h1>
          <p className="mt-6 text-lg sm:text-xl text-slate-300 max-w-2xl mx-auto leading-relaxed">
            Built by accountants who needed better visibility of their team, their fees, and their commercial health. Practice Toolbox brings it all into one place — so you always know where to focus.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/register-interest">
              <Button size="lg" className="bg-blue-600 hover:bg-blue-500 text-white px-8 h-12 text-base font-semibold shadow-lg shadow-blue-900/40">
                Register Interest <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <Link href="/features">
              <Button size="lg" variant="outline" className="border-slate-600 text-white hover:bg-slate-800 px-8 h-12 text-base bg-transparent">
                See the Features
              </Button>
            </Link>
          </div>
          <p className="mt-4 text-sm text-slate-500">Currently in private beta · Join the waitlist for early access</p>

          {/* Hero screenshot */}
          <div className="mt-16 relative mx-auto max-w-5xl">
            <div className="absolute -inset-4 bg-blue-500/10 rounded-2xl blur-2xl" />
            <div className="relative rounded-xl overflow-hidden border border-slate-700 shadow-2xl shadow-black/50">
              <img
                src={dashboardImg}
                alt="Practice Toolbox dashboard"
                className="w-full h-auto"
              />
            </div>
          </div>
        </div>
      </section>

      {/* ── Trusted by message ──────────────────────────────── */}
      <section className="bg-slate-50 border-b border-gray-200 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p className="text-sm font-medium text-gray-500 uppercase tracking-widest mb-4">Covers every area of your practice</p>
          <div className="flex flex-wrap justify-center gap-3">
            {modules.map((m) => (
              <span key={m} className="inline-flex items-center gap-1.5 bg-white border border-gray-200 rounded-full px-4 py-1.5 text-sm font-medium text-gray-700 shadow-sm">
                <CheckCircle2 className="h-3.5 w-3.5 text-blue-500" /> {m}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ── Key highlights ───────────────────────────────────── */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900">
              Everything you need to run a high-performance practice
            </h2>
            <p className="mt-4 text-lg text-gray-600 max-w-2xl mx-auto">
              Stop relying on spreadsheets and gut feel. Practice Toolbox brings all your key data into one place — updated weekly, analysed daily.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {highlights.map((h) => (
              <div key={h.label} className="bg-slate-50 rounded-xl p-6 border border-gray-100 hover:border-blue-200 hover:shadow-md transition-all">
                <div className="p-2.5 bg-blue-100 rounded-lg w-fit mb-4">
                  <h.icon className="h-5 w-5 text-blue-600" />
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">{h.label}</h3>
                <p className="text-sm text-gray-600 leading-relaxed">{h.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Screenshot: Performance Overview ────────────────── */}
      <section className="py-20 bg-gradient-to-br from-slate-50 to-blue-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <Badge className="mb-4 bg-blue-100 text-blue-700 border-0">Staff Scorecards</Badge>
              <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 leading-tight">
                See exactly how every team is performing
              </h2>
              <p className="mt-4 text-lg text-gray-600 leading-relaxed">
                Track Accounts, VAT, Tax, Bookkeeping, Confirmation Statements, and more across multiple teams — all in a single performance overview. Short-term, medium-term, and long-term views at a glance.
              </p>
              <ul className="mt-6 space-y-3">
                {["Compare teams side by side", "Weekly, monthly, and quarterly targets", "AI-generated risk alerts and recommendations", "Track progress vs target in real time"].map((t) => (
                  <li key={t} className="flex items-start gap-2.5 text-gray-700">
                    <CheckCircle2 className="h-5 w-5 text-blue-500 mt-0.5 flex-shrink-0" />
                    <span>{t}</span>
                  </li>
                ))}
              </ul>
              <Link href="/features">
                <Button variant="outline" className="mt-8 border-blue-300 text-blue-700 hover:bg-blue-50">
                  See all features <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
              </Link>
            </div>
            <div className="rounded-xl overflow-hidden border border-gray-200 shadow-xl">
              <img src={overviewImg} alt="Performance overview" className="w-full h-auto" />
            </div>
          </div>
        </div>
      </section>

      {/* ── Screenshot: Charts ───────────────────────────────── */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div className="order-2 lg:order-1 space-y-4">
              <div className="rounded-xl overflow-hidden border border-gray-200 shadow-lg">
                <img src={weeklyTrendImg} alt="Weekly performance trend chart" className="w-full h-auto" />
              </div>
              <div className="rounded-xl overflow-hidden border border-gray-200 shadow-lg">
                <img src={monthlyPerfImg} alt="Monthly performance chart" className="w-full h-auto" />
              </div>
            </div>
            <div className="order-1 lg:order-2">
              <Badge className="mb-4 bg-purple-100 text-purple-700 border-0">Visual Analytics</Badge>
              <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 leading-tight">
                Charts that tell the story at a glance
              </h2>
              <p className="mt-4 text-lg text-gray-600 leading-relaxed">
                From weekly trend bars to monthly completion curves, every module has rich visual reporting built in. Spot patterns, identify bottlenecks, and celebrate wins — without digging through spreadsheets.
              </p>
              <ul className="mt-6 space-y-3">
                {["Weekly performance trend charts", "Monthly progress vs target curves", "Accounts due, in progress, and completed", "Multi-team comparison views"].map((t) => (
                  <li key={t} className="flex items-start gap-2.5 text-gray-700">
                    <CheckCircle2 className="h-5 w-5 text-purple-500 mt-0.5 flex-shrink-0" />
                    <span>{t}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ── Screenshot: Client Value Manager ─────────────────── */}
      <section className="py-20 bg-gradient-to-br from-green-50 to-teal-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <Badge className="mb-4 bg-green-100 text-green-700 border-0">Practice Performance</Badge>
              <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 leading-tight">
                Find the revenue you didn't know you were missing
              </h2>
              <p className="mt-4 text-lg text-gray-600 leading-relaxed">
                The Client Value Manager tracks every client's fees, service levels, and CCR pipeline. It automatically flags under-charged clients, calculates your opportunity gap, and shows you exactly where to focus pricing conversations.
              </p>
              <ul className="mt-6 space-y-3">
                {["Automatic Fee Quality Score per client", "Opportunity gap vs target MRR", "Pricing alerts: undercharged, overcharged, review overdue", "Full client list with CSV export"].map((t) => (
                  <li key={t} className="flex items-start gap-2.5 text-gray-700">
                    <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                    <span>{t}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-xl overflow-hidden border border-gray-200 shadow-xl">
              <img src={clientValueImg} alt="Client Value Manager" className="w-full h-auto" />
            </div>
          </div>
        </div>
      </section>

      {/* ── Valuation CTA ────────────────────────────────────── */}
      <section className="py-20 bg-gradient-to-br from-teal-50 to-cyan-50 border-y border-teal-100">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
            Start by finding out what your practice is worth
          </h2>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto mb-8 leading-relaxed">
            Our free Practice Valuation Calculator gives you an instant estimate of your firm's market value — with a personalised PDF report and three specific actions to increase it. No login required.
          </p>
          <Link href="/valuation-tool">
            <Button size="lg" className="bg-teal-600 hover:bg-teal-700 text-white px-8 h-12 text-base font-semibold shadow-md shadow-teal-200">
              Calculate My Practice Value <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </section>

      {/* ── Feature pillars ──────────────────────────────────── */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900">Why practices choose Practice Toolbox</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { icon: Zap, title: "Set up in minutes", desc: "Create your organisation, invite your team, set targets, and start recording results the same day. No implementation project required.", color: "text-yellow-500", bg: "bg-yellow-50" },
              { icon: Users, title: "Multi-team, multi-pod", desc: "Whether you run one team or ten pods, Practice Toolbox handles all of them — with team-level access control built in.", color: "text-blue-500", bg: "bg-blue-50" },
              { icon: Shield, title: "Secure by design", desc: "Role-based access, organisation-level data isolation, and enterprise-grade session management keep your practice data safe.", color: "text-green-500", bg: "bg-green-50" },
              { icon: Brain, title: "AI analysis built in", desc: "Claude AI analyses your performance data and surfaces actionable insights, risk alerts, and recommendations — automatically.", color: "text-purple-500", bg: "bg-purple-50" },
              { icon: Target, title: "Targets and accountability", desc: "Set targets per team, per module, and per week. Record actuals, track variance, and hold every pod accountable with data.", color: "text-red-500", bg: "bg-red-50" },
              { icon: BarChart3, title: "Strategic clarity", desc: "Long-term targets, quarterly rocks, and practice values all in one place — so your strategy connects to your day-to-day operations.", color: "text-indigo-500", bg: "bg-indigo-50" },
            ].map((f) => (
              <div key={f.title} className="flex gap-4 p-5 rounded-xl border border-gray-100 hover:border-gray-200 hover:shadow-sm transition-all">
                <div className={`${f.bg} p-2.5 rounded-lg h-fit`}>
                  <f.icon className={`h-5 w-5 ${f.color}`} />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 mb-1">{f.title}</h3>
                  <p className="text-sm text-gray-600 leading-relaxed">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pricing teaser ───────────────────────────────────── */}
      <section className="py-16 bg-slate-50 border-y border-gray-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-3">Simple, transparent pricing</h2>
          <p className="text-gray-600 mb-8">Plans from <strong>£29/month + VAT</strong>. Launching soon — register your interest to be first in line.</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/pricing">
              <Button size="lg" variant="outline" className="border-blue-300 text-blue-700 hover:bg-blue-50 px-8">
                View full pricing
              </Button>
            </Link>
            <Link href="/register-interest">
              <Button size="lg" className="bg-blue-600 hover:bg-blue-700 text-white px-8">
                Register Interest <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* ── Final CTA ────────────────────────────────────────── */}
      <section className="py-24 bg-gradient-to-br from-blue-600 to-blue-800">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
            Ready to transform how your practice operates?
          </h2>
          <p className="text-blue-100 text-lg mb-10 max-w-2xl mx-auto">
            Built and used daily at MBS Accountants, Gloucester. Opening to new firms in 2026.
          </p>
          <Link href="/register-interest">
            <Button size="lg" className="bg-white text-blue-700 hover:bg-blue-50 px-10 h-12 font-semibold shadow-lg">
              Register Interest
            </Button>
          </Link>
        </div>
      </section>

      <MarketingFooter />
    </div>
  );
}
