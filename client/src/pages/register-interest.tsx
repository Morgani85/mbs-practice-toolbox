import { useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle2, Mail, Building2, User, MessageSquare, ArrowRight } from "lucide-react";
import MarketingNav, { MarketingFooter } from "@/components/marketing/nav";
import { apiRequest } from "@/lib/queryClient";

const benefits = [
  "Be among the first practices to access Practice Toolbox",
  "Personal onboarding walkthrough with the team",
  "Shape the product roadmap with your feedback",
  "Early adopter discount — locked in until our public launch",
];

export default function RegisterInterestPage() {
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "duplicate" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    firmName: "",
    email: "",
    phone: "",
    practiceSize: "",
    message: "",
  });

  const update = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("submitting");
    setErrorMsg("");
    try {
      const res = await apiRequest("/api/waitlist", "POST", form);
      if (res.status === 409) {
        setStatus("duplicate");
        return;
      }
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || "Submission failed");
      }
      setStatus("success");
    } catch (err: any) {
      setErrorMsg(err.message || "Something went wrong. Please try again.");
      setStatus("error");
    }
  };

  if (status === "success") {
    return (
      <div className="min-h-screen bg-white">
        <MarketingNav />
        <div className="max-w-lg mx-auto px-4 py-24 text-center">
          <div className="p-4 bg-green-100 rounded-full w-fit mx-auto mb-6">
            <CheckCircle2 className="h-10 w-10 text-green-600" />
          </div>
          <h2 className="text-3xl font-bold text-gray-900 mb-3">Thanks — you're on the list.</h2>
          <p className="text-gray-600 mb-4 leading-relaxed">
            We're currently selecting our first beta firms and will be in touch when we're ready to onboard new practices. In the meantime feel free to explore the features and try the free valuation calculator if you haven't already.
          </p>
          <p className="text-gray-500 mb-8 text-sm">— Ian, Practice Toolbox</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/features">
              <Button variant="outline" className="border-blue-300 text-blue-700 hover:bg-blue-50">
                Explore the features <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <Link href="/valuation-tool">
              <Button className="bg-teal-600 hover:bg-teal-700 text-white">
                Try the free valuation calculator <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
        <MarketingFooter />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <MarketingNav />

      {/* ── Hero ─────────────────────────────────────────────── */}
      <section className="bg-gradient-to-br from-slate-900 to-blue-950 py-16 text-center">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
          <Badge className="mb-4 bg-blue-600/20 text-blue-300 border-blue-700/50">Join the Waitlist</Badge>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-white leading-tight">
            Join the waitlist
          </h1>
          <p className="mt-4 text-slate-300 text-lg leading-relaxed">
            Tell us about your practice and we will be in touch to walk you through the platform and answer any questions.
          </p>
        </div>
      </section>

      {/* ── Form ─────────────────────────────────────────────── */}
      <section className="py-16 bg-slate-50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-12">
            {/* Benefits sidebar */}
            <div className="lg:col-span-2">
              <h3 className="font-bold text-gray-900 text-lg mb-5">Why register interest?</h3>
              <ul className="space-y-4 mb-8">
                {benefits.map((b) => (
                  <li key={b} className="flex items-start gap-3">
                    <CheckCircle2 className="h-5 w-5 text-blue-500 mt-0.5 flex-shrink-0" />
                    <span className="text-gray-700 text-sm leading-relaxed">{b}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-6 bg-white border border-gray-200 rounded-xl p-5">
                <p className="text-sm font-semibold text-gray-900 mb-1">Contact us directly</p>
                <a
                  href="mailto:hello@practicetoolbox.co.uk"
                  className="flex items-center gap-2 text-sm text-blue-600 hover:underline mt-2"
                >
                  <Mail className="h-4 w-4" />
                  hello@practicetoolbox.co.uk
                </a>
              </div>
            </div>

            {/* Form */}
            <div className="lg:col-span-3">
              <div className="mb-4 p-4 bg-teal-50 border border-teal-200 rounded-xl text-sm text-teal-800">
                Haven't tried the valuation tool yet?{" "}
                <Link href="/valuation-tool" className="font-semibold underline underline-offset-2 hover:text-teal-600">
                  Get your free practice valuation first.
                </Link>
              </div>
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8">
                <h3 className="font-bold text-gray-900 text-lg mb-6">Tell us about your practice</h3>

                {status === "duplicate" && (
                  <div className="mb-5 p-4 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
                    It looks like you've already registered with this email. We'll be in touch soon.
                  </div>
                )}
                {status === "error" && (
                  <div className="mb-5 p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                    {errorMsg}
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-5">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="firstName" className="text-gray-700 text-sm mb-1.5 block">
                        <User className="h-3.5 w-3.5 inline mr-1" /> First name *
                      </Label>
                      <Input
                        id="firstName"
                        required
                        value={form.firstName}
                        onChange={update("firstName")}
                        placeholder="Jane"
                        className="border-gray-300"
                      />
                    </div>
                    <div>
                      <Label htmlFor="lastName" className="text-gray-700 text-sm mb-1.5 block">Last name *</Label>
                      <Input
                        id="lastName"
                        required
                        value={form.lastName}
                        onChange={update("lastName")}
                        placeholder="Smith"
                        className="border-gray-300"
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="firmName" className="text-gray-700 text-sm mb-1.5 block">
                      <Building2 className="h-3.5 w-3.5 inline mr-1" /> Firm name *
                    </Label>
                    <Input
                      id="firmName"
                      required
                      value={form.firmName}
                      onChange={update("firmName")}
                      placeholder="e.g. Smith & Co Accountants"
                      className="border-gray-300"
                    />
                  </div>

                  <div>
                    <Label htmlFor="email" className="text-gray-700 text-sm mb-1.5 block">
                      <Mail className="h-3.5 w-3.5 inline mr-1" /> Email address *
                    </Label>
                    <Input
                      id="email"
                      type="email"
                      required
                      value={form.email}
                      onChange={update("email")}
                      placeholder="jane@smithaccountants.co.uk"
                      className="border-gray-300"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="phone" className="text-gray-700 text-sm mb-1.5 block">Phone number</Label>
                      <Input
                        id="phone"
                        type="tel"
                        value={form.phone}
                        onChange={update("phone")}
                        placeholder="01234 567890"
                        className="border-gray-300"
                      />
                    </div>
                    <div>
                      <Label htmlFor="practiceSize" className="text-gray-700 text-sm mb-1.5 block">Practice size</Label>
                      <select
                        id="practiceSize"
                        value={form.practiceSize}
                        onChange={update("practiceSize")}
                        className="w-full h-10 px-3 text-sm border border-gray-300 rounded-md bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value="">Select...</option>
                        <option value="under-50">Under 50 clients</option>
                        <option value="50-100">50–100 clients</option>
                        <option value="100-200">100–200 clients</option>
                        <option value="200-500">200–500 clients</option>
                        <option value="500+">500+ clients</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="message" className="text-gray-700 text-sm mb-1.5 block">
                      <MessageSquare className="h-3.5 w-3.5 inline mr-1" /> Anything else you'd like us to know?
                    </Label>
                    <Textarea
                      id="message"
                      value={form.message}
                      onChange={update("message")}
                      placeholder="Tell us about your current challenges, what tools you use today, or any specific questions you have..."
                      className="border-gray-300 resize-none"
                      rows={4}
                    />
                  </div>

                  <Button
                    type="submit"
                    disabled={status === "submitting"}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white h-11 text-base font-semibold"
                  >
                    {status === "submitting" ? "Registering..." : "Register my interest"}
                  </Button>
                </form>
              </div>
            </div>
          </div>
        </div>
      </section>

      <MarketingFooter />
    </div>
  );
}
