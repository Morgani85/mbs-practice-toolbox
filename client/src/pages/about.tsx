import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Lightbulb, Heart, Users, TrendingUp } from "lucide-react";
import MarketingNav, { MarketingFooter } from "@/components/marketing/nav";

const values = [
  {
    icon: Lightbulb,
    title: "Built by practitioners",
    desc: "Practice Toolbox was conceived and built by people who have been running an accounting firm since 2019 — refining the methodology manually for years before writing a line of code.",
  },
  {
    icon: Heart,
    title: "Designed for simplicity",
    desc: "We believe powerful software doesn't have to be complicated. Every feature in Practice Toolbox was designed to be set up in minutes, not months — no implementation consultants, no lengthy onboarding projects.",
  },
  {
    icon: Users,
    title: "Team-first thinking",
    desc: "Accounting practices succeed through their people. Practice Toolbox is designed to support team accountability, celebrate performance, and give every pod a clear picture of how they're tracking.",
  },
  {
    icon: TrendingUp,
    title: "Always improving",
    desc: "Practice Toolbox is actively developed. New modules, features, and improvements are released regularly, informed directly by the practices using it day-to-day.",
  },
];

const timeline = [
  { year: "2019", event: "Scorecard methodology first developed and used manually at MBS Accountants, tracking operational performance across the team" },
  { year: "January 2025", event: "Scorecards digitised and built into Practice Toolbox, covering Accounts, VAT, Tax, Bookkeeping, Confirmation Statements and more" },
  { year: "Mid 2025", event: "AI-powered analysis integrated, providing automated performance insights and risk alerts" },
  { year: "Late 2025", event: "Client Value Manager launched, helping practices identify underpriced clients and manage their CCR pipeline" },
  { year: "Early 2026", event: "Strategic Planning tools added. Platform rebuilt as a proper multi-tenant SaaS ready for other practices" },
  { year: "2026 onwards", event: "Opening to accounting practices across the UK" },
];

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-white">
      <MarketingNav />

      {/* ── Hero ─────────────────────────────────────────────── */}
      <section className="bg-gradient-to-br from-slate-900 to-blue-950 py-20 text-center">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <Badge className="mb-4 bg-blue-600/20 text-blue-300 border-blue-700/50">About Us</Badge>
          <h1 className="text-4xl sm:text-5xl font-extrabold text-white leading-tight">
            We built the tool we always needed
          </h1>
          <p className="mt-5 text-lg text-slate-300 leading-relaxed">
            Practice Toolbox started as a manual scorecard system at MBS Accountants in 2019. Seven years of real-world practice management later, it became a software platform — built by accountants, for accountants.
          </p>
        </div>
      </section>

      {/* ── Our story ────────────────────────────────────────── */}
      <section className="py-20 bg-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <Badge className="mb-3 bg-blue-100 text-blue-700 border-0">Our Story</Badge>
          <h2 className="text-3xl font-bold text-gray-900 mb-6">From internal spreadsheets to a full platform</h2>
          <div className="space-y-5 text-gray-600 leading-relaxed text-lg">
            <p>
              Running a busy accounting practice means keeping track of hundreds of clients, multiple service lines, and teams of people working to tight statutory deadlines. For years, like most firms, we tracked all of this in spreadsheets and gut feel. Performance conversations happened after the fact, not before problems escalated.
            </p>
            <p>
              In 2019 we started developing our own scorecard methodology at MBS Accountants — tracking the metrics that actually matter across accounts, VAT, tax, bookkeeping, and client health. We ran it manually for years, refining what we measured and how we used it. It worked. Our team performance improved, our conversations got sharper, and we stopped being surprised by problems.
            </p>
            <p>
              By January 2025 we digitised it into a proper application. Then we added dashboards, AI-powered analysis, and a Client Value Manager that shows us exactly which clients are underpriced and how much revenue we're leaving on the table. In early 2026 we rebuilt it as a multi-tenant SaaS platform — because we realised every ambitious practice deserves the same visibility we'd built for ourselves.
            </p>
          </div>
        </div>
      </section>

      {/* ── Who built this ───────────────────────────────────── */}
      <section className="py-16 bg-slate-50">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <Badge className="mb-3 bg-purple-100 text-purple-700 border-0">Who Built This</Badge>
          <h2 className="text-3xl font-bold text-gray-900 mb-6">Who built this</h2>
          <div className="space-y-5 text-gray-600 leading-relaxed text-lg">
            <p>
              I'm Ian, founder of MBS Accountants in Gloucester. I built Practice Toolbox because I needed it — and nothing in the market did what I needed. The scorecard methodology we use has been running and evolving in our own practice since 2019. The software has been live internally since January 2025. It has already changed how we manage team performance, fee reviews, and client relationships.
            </p>
            <p>
              In early 2026 we opened it up to other firms. If you run a practice and recognise the problems we have described, this was built for you.
            </p>
            <p>
              We also built a{" "}
              <Link href="/valuation-tool" className="text-blue-600 underline underline-offset-2 hover:text-blue-800">
                free valuation calculator
              </Link>{" "}
              so any practice owner can understand what their firm is worth and what moves the number — before committing to anything.
            </p>
          </div>
        </div>
      </section>

      {/* ── Timeline ─────────────────────────────────────────── */}
      <section className="py-16 bg-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <Badge className="mb-3 bg-blue-100 text-blue-700 border-0">Our Journey</Badge>
          <h2 className="text-3xl font-bold text-gray-900 mb-8">How we got here</h2>
          <div className="space-y-0">
            {timeline.map((item, i) => (
              <div key={i} className="flex gap-4">
                <div className="flex flex-col items-center">
                  <div className="w-3 h-3 rounded-full bg-blue-600 mt-1.5 flex-shrink-0" />
                  {i < timeline.length - 1 && <div className="w-0.5 bg-blue-200 flex-1 mt-1" />}
                </div>
                <div className="pb-6">
                  <p className="text-xs font-bold text-blue-600 uppercase tracking-widest">{item.year}</p>
                  <p className="text-sm text-gray-700 mt-0.5 leading-relaxed">{item.event}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Values ───────────────────────────────────────────── */}
      <section className="py-20 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <Badge className="mb-3 bg-green-100 text-green-700 border-0">Our Principles</Badge>
            <h2 className="text-3xl font-bold text-gray-900">What guides everything we build</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {values.map((v) => (
              <div key={v.title} className="bg-white rounded-xl p-7 border border-gray-200 hover:shadow-md transition-shadow">
                <div className="p-2.5 bg-blue-50 rounded-lg w-fit mb-4">
                  <v.icon className="h-5 w-5 text-blue-600" />
                </div>
                <h3 className="font-bold text-gray-900 text-lg mb-2">{v.title}</h3>
                <p className="text-gray-600 leading-relaxed">{v.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Who it's for ─────────────────────────────────────── */}
      <section className="py-20 bg-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <Badge className="mb-3 bg-orange-100 text-orange-700 border-0">Who It's For</Badge>
            <h2 className="text-3xl font-bold text-gray-900">Practice Toolbox is built for firms like yours</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { title: "Growing practices", desc: "You've got multiple teams and multiple service lines — and you need one system that shows you where everything stands without chasing spreadsheets." },
              { title: "Partner-led firms", desc: "You want real-time visibility across pods so you can focus on exceptions, not routine status updates. Practice Toolbox surfaces problems before they become crises." },
              { title: "Ambitious managers", desc: "You care about performance, accountability, and giving your team the tools to hit targets. Practice Toolbox makes that possible without adding admin overhead." },
            ].map((item) => (
              <div key={item.title} className="bg-orange-50 rounded-xl p-6 border border-orange-100">
                <CheckCircle2 className="h-5 w-5 text-orange-600 mb-3" />
                <h3 className="font-semibold text-gray-900 mb-2">{item.title}</h3>
                <p className="text-sm text-gray-600 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────────────── */}
      <section className="py-20 bg-gradient-to-br from-blue-600 to-blue-800 text-center">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-white mb-4">Want to find out more?</h2>
          <p className="text-blue-100 mb-8 text-lg">
            Register your interest and we will be in touch when we are ready to onboard new firms.
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
