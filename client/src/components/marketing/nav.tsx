import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Menu, X, BarChart3 } from "lucide-react";
import { APP_ORIGIN } from "@/lib/domains";

const links = [
  { href: "/", label: "Home" },
  { href: "/features", label: "Features" },
  { href: "/pricing", label: "Pricing" },
  { href: "/about", label: "About" },
  { href: "/valuation-tool", label: "Value My Practice", free: true },
];

export default function MarketingNav() {
  const [open, setOpen] = useState(false);
  const [location] = useLocation();

  return (
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="p-1.5 bg-blue-600 rounded-lg group-hover:bg-blue-700 transition-colors">
              <BarChart3 className="h-5 w-5 text-white" />
            </div>
            <span className="text-lg font-bold text-gray-900">Practice Toolbox</span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-8">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className={`flex items-center gap-1.5 text-sm font-medium transition-colors ${
                  location === l.href
                    ? "text-blue-600"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                {l.label}
                {l.free && (
                  <span className="text-[10px] font-bold bg-teal-100 text-teal-700 px-1.5 py-0.5 rounded-full leading-none">
                    Free
                  </span>
                )}
              </Link>
            ))}
          </nav>

          {/* Desktop CTAs */}
          <div className="hidden md:flex items-center gap-3">
            <a href={`${APP_ORIGIN}/auth`}>
              <Button variant="ghost" size="sm" className="text-gray-600 hover:text-gray-900">
                Sign In
              </Button>
            </a>
            <Link href="/register-interest">
              <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white shadow-sm">
                Register Interest
              </Button>
            </Link>
          </div>

          {/* Mobile toggle */}
          <button
            className="md:hidden p-2 text-gray-600 hover:text-gray-900"
            onClick={() => setOpen(!open)}
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {open && (
        <div className="md:hidden bg-white border-t border-gray-100 px-4 py-4 space-y-1">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`flex items-center gap-2 text-sm font-medium py-2 px-3 rounded-lg transition-colors ${
                location === l.href ? "text-blue-600 bg-blue-50" : "text-gray-700 hover:bg-gray-50"
              }`}
              onClick={() => setOpen(false)}
            >
              {l.label}
              {l.free && (
                <span className="text-[10px] font-bold bg-teal-100 text-teal-700 px-1.5 py-0.5 rounded-full leading-none">
                  Free
                </span>
              )}
            </Link>
          ))}
          <div className="pt-3 border-t border-gray-100 space-y-2">
            <a href={`${APP_ORIGIN}/auth`} className="block">
              <Button variant="outline" size="sm" className="w-full">Sign In</Button>
            </a>
            <Link href="/register-interest" onClick={() => setOpen(false)}>
              <Button size="sm" className="w-full bg-blue-600 hover:bg-blue-700 text-white">
                Register Interest
              </Button>
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}

export function MarketingFooter() {
  return (
    <footer className="bg-slate-900 text-gray-400">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="md:col-span-2">
            <div className="flex items-center gap-2 mb-3">
              <div className="p-1.5 bg-blue-600 rounded-lg">
                <BarChart3 className="h-4 w-4 text-white" />
              </div>
              <span className="text-white font-bold">Practice Toolbox</span>
            </div>
            <p className="text-sm leading-relaxed max-w-xs">
              Built by accountants who needed it. Now available to practices across the UK.
            </p>
          </div>
          <div>
            <h4 className="text-white text-sm font-semibold mb-3">Product</h4>
            <ul className="space-y-2 text-sm">
              <li><Link href="/features" className="hover:text-white transition-colors">Features</Link></li>
              <li><Link href="/pricing" className="hover:text-white transition-colors">Pricing</Link></li>
              <li><Link href="/register-interest" className="hover:text-white transition-colors">Register Interest</Link></li>
              <li>
                <Link href="/valuation-tool" className="hover:text-white transition-colors inline-flex items-center gap-1.5">
                  Value My Practice
                  <span className="text-[10px] font-bold bg-teal-800 text-teal-200 px-1.5 py-0.5 rounded-full leading-none">Free</span>
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <h4 className="text-white text-sm font-semibold mb-3">Company</h4>
            <ul className="space-y-2 text-sm">
              <li><Link href="/about" className="hover:text-white transition-colors">About Us</Link></li>
              <li><Link href="/register-interest" className="hover:text-white transition-colors">Register Interest</Link></li>
              <li><a href={`${APP_ORIGIN}/auth`} className="hover:text-white transition-colors">Sign In</a></li>
            </ul>
          </div>
        </div>
        <div className="border-t border-slate-800 mt-10 pt-6 flex flex-col sm:flex-row justify-between items-center gap-3 text-xs">
          <p>© {new Date().getFullYear()} Practice Toolbox. All rights reserved.</p>
          <p>Built for accounting practices · <a href="https://www.practicetoolbox.co.uk" className="hover:text-white transition-colors">www.practicetoolbox.co.uk</a></p>
        </div>
      </div>
    </footer>
  );
}
