import { Link, useLocation } from "wouter";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import {
  ChevronDown,
  ChevronRight,
  BarChart3,
  Target,
  Edit3,
  TrendingDown,
  Users,
  Calculator,
  FileText,
  BookOpen,
  ClipboardCheck,
  Receipt,
  Heart,
  Settings,
  TrendingUp,
  Compass,
  DollarSign,
  Home,
  BarChart2,
  Lightbulb,
  SearchCheck,
  Mail,
} from "lucide-react";

type LeafItem = {
  label: string;
  path: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
};

type ModuleGroup = {
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  pathPrefix: string;
  children: LeafItem[];
};

const scorecardsItems: (LeafItem | ModuleGroup)[] = [
  { label: "Overview", path: "/overview", icon: BarChart3 },
  {
    label: "Accounts",
    icon: Calculator,
    pathPrefix: "/accounts/",
    children: [
      { label: "Dashboard", path: "/accounts/dashboard", icon: BarChart3 },
      { label: "Set Targets", path: "/accounts/targets", icon: Target },
      { label: "Accounts Prepared", path: "/accounts/results", icon: Edit3 },
      { label: "Accounts Due", path: "/accounts/accounts-due", icon: TrendingDown },
    ],
  },
  {
    label: "VAT",
    icon: FileText,
    pathPrefix: "/vat/",
    children: [
      { label: "Dashboard", path: "/vat/dashboard", icon: BarChart3 },
      { label: "VAT Due", path: "/vat/due", icon: TrendingDown },
      { label: "Turnover Checks", path: "/vat/turnover-checks", icon: Edit3 },
    ],
  },
  {
    label: "Management Accounts",
    icon: Heart,
    pathPrefix: "/health-checks/",
    children: [
      { label: "Dashboard", path: "/health-checks/dashboard", icon: BarChart3 },
      { label: "Enter Data", path: "/health-checks/data-entry", icon: Edit3 },
    ],
  },
  {
    label: "Internal Bookkeeping",
    icon: BookOpen,
    pathPrefix: "/mbs-bookkeeping/",
    children: [
      { label: "Dashboard", path: "/mbs-bookkeeping/dashboard", icon: BarChart3 },
      { label: "BK Quality Score", path: "/mbs-bookkeeping/dext-precision", icon: Target },
      { label: "Oldest Items", path: "/mbs-bookkeeping/oldest-items", icon: TrendingDown },
    ],
  },
  {
    label: "Client Bookkeeping",
    icon: BookOpen,
    pathPrefix: "/client-bookkeeping/",
    children: [
      { label: "Dashboard", path: "/client-bookkeeping/dashboard", icon: BarChart3 },
      { label: "BK Quality Score", path: "/client-bookkeeping/dext-precision", icon: Target },
      { label: "Oldest Items", path: "/client-bookkeeping/oldest-items", icon: TrendingDown },
    ],
  },
  {
    label: "Confirmation Statements",
    icon: ClipboardCheck,
    pathPrefix: "/confirmation-statements/",
    children: [
      { label: "Dashboard", path: "/confirmation-statements/dashboard", icon: BarChart3 },
      { label: "Enter Data", path: "/confirmation-statements/data-entry", icon: Edit3 },
    ],
  },
  {
    label: "Tax",
    icon: Receipt,
    pathPrefix: "/tax/",
    children: [
      { label: "Dashboard", path: "/tax/dashboard", icon: BarChart3 },
      { label: "Enter Data", path: "/tax/data-entry", icon: Edit3 },
      { label: "Set Targets", path: "/tax/targets", icon: Target },
    ],
  },
  {
    label: "Communication",
    icon: Mail,
    pathPrefix: "/communication/",
    children: [
      { label: "Email Analytics", path: "/communication/email-analytics", icon: Mail },
    ],
  },
];

const practiceItems: (LeafItem & { comingSoon?: boolean })[] = [
  { label: "Client Value Manager", path: "/practice-performance/client-value-manager", icon: Users },
  { label: "Revenue Analytics", path: "/practice-performance/revenue-analytics", icon: BarChart3, comingSoon: true },
  { label: "Cash & Cashflow", path: "/practice-performance/cash-cashflow", icon: DollarSign, comingSoon: true },
  { label: "Upgrades", path: "/practice-performance/upgrades", icon: TrendingUp, comingSoon: true },
  { label: "Marketing", path: "/practice-performance/marketing", icon: Target, comingSoon: true },
  { label: "Sales", path: "/practice-performance/sales", icon: TrendingUp, comingSoon: true },
];

const strategicItems: LeafItem[] = [
  { label: "Long Term Targets", path: "/strategic-planning/long-term-targets", icon: Target },
  { label: "Values", path: "/strategic-planning/values", icon: Heart },
  { label: "Quarterly Goals", path: "/strategic-planning/quarterly-goals", icon: ClipboardCheck },
];

const adminItems: LeafItem[] = [
  { label: "Settings", path: "/admin/settings", icon: Settings },
  { label: "User Management", path: "/admin/users", icon: Users },
];

const mgmtReportsItems: LeafItem[] = [
  { label: "Clients", path: "/management-reports", icon: Users },
];

function matchesPrefixes(path: string, prefixes: string[]): boolean {
  return prefixes.some((p) => path === p || path.startsWith(p));
}

const scorecardsPathPrefixes = [
  "/overview",
  "/accounts/",
  "/vat/",
  "/health-checks/",
  "/mbs-bookkeeping/",
  "/client-bookkeeping/",
  "/confirmation-statements/",
  "/tax/",
  "/communication/",
];

function getInitialOpenSections(location: string): Set<string> {
  const open = new Set<string>();
  if (matchesPrefixes(location, scorecardsPathPrefixes)) open.add("staff-scorecards");
  if (location.startsWith("/practice-performance/")) open.add("practice-performance");
  if (location.startsWith("/strategic-planning/")) open.add("strategic-planning");
  if (location.startsWith("/admin/")) open.add("admin");
  if (location.startsWith("/management-reports")) open.add("management-reports");
  if (location.startsWith("/coaching")) open.add("coaching");
  if (location.startsWith("/fcr")) open.add("fcr");
  return open;
}

function getInitialOpenModules(location: string): Set<string> {
  const open = new Set<string>();
  for (const item of scorecardsItems) {
    if ("pathPrefix" in item && location.startsWith(item.pathPrefix)) {
      open.add(item.pathPrefix);
    }
  }
  return open;
}

function NavLink({
  path,
  label,
  icon: Icon,
  depth = 0,
  location,
}: {
  path: string;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  depth?: number;
  location: string;
}) {
  const isActive = location === path;
  return (
    <Link href={path}>
      <div
        className={cn(
          "flex items-center gap-2 py-1.5 pr-3 text-sm rounded-md cursor-pointer transition-colors truncate",
          depth === 0 && "px-3",
          depth === 1 && "pl-6 pr-3",
          depth === 2 && "pl-9 pr-3",
          isActive
            ? "bg-blue-50 text-blue-700 font-medium border-l-2 border-blue-600"
            : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
        )}
      >
        <Icon size={14} className="shrink-0" />
        <span className="truncate">{label}</span>
      </div>
    </Link>
  );
}

function SectionToggle({
  id,
  label,
  icon: Icon,
  isOpen,
  onToggle,
}: {
  id: string;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  isOpen: boolean;
  onToggle: (id: string) => void;
}) {
  return (
    <button
      onClick={() => onToggle(id)}
      className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider hover:text-gray-600 transition-colors rounded-md hover:bg-gray-50"
    >
      <div className="flex items-center gap-2">
        <Icon size={13} />
        <span>{label}</span>
      </div>
      {isOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
    </button>
  );
}

function ModuleToggle({
  mod,
  isOpen,
  hasActive,
  onToggle,
}: {
  mod: ModuleGroup;
  isOpen: boolean;
  hasActive: boolean;
  onToggle: (prefix: string) => void;
}) {
  const Icon = mod.icon;
  return (
    <button
      onClick={() => onToggle(mod.pathPrefix)}
      className={cn(
        "w-full flex items-center justify-between pl-6 pr-3 py-1.5 text-sm rounded-md transition-colors",
        hasActive
          ? "text-blue-700 font-medium"
          : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
      )}
    >
      <div className="flex items-center gap-2 min-w-0">
        <Icon size={14} className="shrink-0" />
        <span className="truncate">{mod.label}</span>
      </div>
      {isOpen ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
    </button>
  );
}

export default function Navigation() {
  const [location] = useLocation();
  const { user } = useAuth();

  const [openSections, setOpenSections] = useState<Set<string>>(() =>
    getInitialOpenSections(location)
  );
  const [openModules, setOpenModules] = useState<Set<string>>(() =>
    getInitialOpenModules(location)
  );

  useEffect(() => {
    if (matchesPrefixes(location, scorecardsPathPrefixes)) {
      setOpenSections((prev) => new Set([...prev, "staff-scorecards"]));
      for (const item of scorecardsItems) {
        if ("pathPrefix" in item && location.startsWith(item.pathPrefix)) {
          setOpenModules((prev) => new Set([...prev, item.pathPrefix]));
          break;
        }
      }
    }
    if (location.startsWith("/practice-performance/")) {
      setOpenSections((prev) => new Set([...prev, "practice-performance"]));
    }
    if (location.startsWith("/strategic-planning/")) {
      setOpenSections((prev) => new Set([...prev, "strategic-planning"]));
    }
    if (location.startsWith("/admin/")) {
      setOpenSections((prev) => new Set([...prev, "admin"]));
    }
    if (location.startsWith("/management-reports")) {
      setOpenSections((prev) => new Set([...prev, "management-reports"]));
    }
  }, [location]);

  const toggleSection = (id: string) => {
    setOpenSections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleModule = (prefix: string) => {
    setOpenModules((prev) => {
      const next = new Set(prev);
      if (next.has(prefix)) next.delete(prefix);
      else next.add(prefix);
      return next;
    });
  };

  const scorecardsSectionOpen = openSections.has("staff-scorecards");
  const practiceSectionOpen = openSections.has("practice-performance");
  const strategicSectionOpen = openSections.has("strategic-planning");
  const adminSectionOpen = openSections.has("admin");
  const mgmtReportsSectionOpen = openSections.has("management-reports");
  const coachingSectionOpen = openSections.has("coaching");
  const fcrSectionOpen = openSections.has("fcr");

  return (
    <nav className="fixed left-0 top-[76px] w-64 h-[calc(100vh-76px)] bg-white border-r border-gray-200 overflow-y-auto z-20 flex flex-col">
      <div className="flex-1 py-2 px-2 space-y-0.5">
        {/* Home */}
        <NavLink path="/" label="Home" icon={Home} depth={0} location={location} />

        <div className="pt-2">
          {/* ── Staff Scorecards ─────────────────────────── */}
          <SectionToggle
            id="staff-scorecards"
            label="Staff Scorecards"
            icon={Users}
            isOpen={scorecardsSectionOpen}
            onToggle={toggleSection}
          />
          {scorecardsSectionOpen && (
            <div className="mt-0.5 space-y-0.5">
              {scorecardsItems.map((item) => {
                if (!("pathPrefix" in item)) {
                  return (
                    <NavLink
                      key={item.path}
                      path={item.path}
                      label={item.label}
                      icon={item.icon}
                      depth={1}
                      location={location}
                    />
                  );
                }
                const mod = item as ModuleGroup;
                const isModOpen = openModules.has(mod.pathPrefix);
                const hasActive = location.startsWith(mod.pathPrefix);
                return (
                  <div key={mod.pathPrefix}>
                    <ModuleToggle
                      mod={mod}
                      isOpen={isModOpen}
                      hasActive={hasActive}
                      onToggle={toggleModule}
                    />
                    {isModOpen && (
                      <div className="mt-0.5 space-y-0.5">
                        {mod.children.map((child) => (
                          <NavLink
                            key={child.path}
                            path={child.path}
                            label={child.label}
                            icon={child.icon}
                            depth={2}
                            location={location}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Practice Performance ─────────────────────── */}
        <div className="pt-1 border-t border-gray-100 mt-1">
          <SectionToggle
            id="practice-performance"
            label="Practice Performance"
            icon={TrendingUp}
            isOpen={practiceSectionOpen}
            onToggle={toggleSection}
          />
          {practiceSectionOpen && (
            <div className="mt-0.5 space-y-0.5">
              {practiceItems.map((item) =>
                item.comingSoon ? (
                  <div
                    key={item.path}
                    className="flex items-center justify-between pl-6 pr-3 py-1.5 text-sm rounded-md cursor-not-allowed"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <item.icon size={14} className="shrink-0 text-gray-300" />
                      <span className="truncate text-gray-300">{item.label}</span>
                    </div>
                    <span className="text-[10px] text-gray-300 shrink-0">Soon</span>
                  </div>
                ) : (
                  <NavLink
                    key={item.path}
                    path={item.path}
                    label={item.label}
                    icon={item.icon}
                    depth={1}
                    location={location}
                  />
                )
              )}
            </div>
          )}
        </div>

        {/* ── Strategic Planning ───────────────────────── */}
        <div className="pt-1 border-t border-gray-100 mt-1">
          <SectionToggle
            id="strategic-planning"
            label="Strategic Planning"
            icon={Compass}
            isOpen={strategicSectionOpen}
            onToggle={toggleSection}
          />
          {strategicSectionOpen && (
            <div className="mt-0.5 space-y-0.5">
              {strategicItems.map((item) => (
                <NavLink
                  key={item.path}
                  path={item.path}
                  label={item.label}
                  icon={item.icon}
                  depth={1}
                  location={location}
                />
              ))}
            </div>
          )}
        </div>

        {/* ── Management Reports ───────────────────────── */}
        <div className="pt-1 border-t border-gray-100 mt-1">
          <SectionToggle
            id="management-reports"
            label="Management Reports"
            icon={BarChart2}
            isOpen={mgmtReportsSectionOpen}
            onToggle={toggleSection}
          />
          {mgmtReportsSectionOpen && (
            <div className="mt-0.5 space-y-0.5">
              <NavLink path="/management-reports" label="Clients" icon={Users} depth={1} location={location} />
            </div>
          )}
        </div>

        {/* ── Coaching Tool ────────────────────────────── */}
        {(user?.role === "admin" || user?.role === "manager" || user?.role === "user") && (
          <div className="pt-1 border-t border-gray-100 mt-1">
            <SectionToggle
              id="coaching"
              label="Coaching"
              icon={Lightbulb}
              isOpen={coachingSectionOpen}
              onToggle={toggleSection}
            />
            {coachingSectionOpen && (
              <div className="mt-0.5 space-y-0.5">
                <NavLink path="/coaching" label="Clients" icon={Users} depth={1} location={location} />
              </div>
            )}
          </div>
        )}

        {/* ── Financial Clarity Review ─────────────────── */}
        {(user?.role === "admin" || user?.role === "manager" || user?.role === "user") && (
          <div className="pt-1 border-t border-gray-100 mt-1">
            <SectionToggle
              id="fcr"
              label="Financial Clarity"
              icon={SearchCheck}
              isOpen={fcrSectionOpen}
              onToggle={toggleSection}
            />
            {fcrSectionOpen && (
              <div className="mt-0.5 space-y-0.5">
                <NavLink path="/fcr" label="Reviews" icon={SearchCheck} depth={1} location={location} />
              </div>
            )}
          </div>
        )}

        {/* ── Admin (admin role only) ───────────────────── */}
        {user?.role === "admin" && (
          <div className="pt-1 border-t border-gray-100 mt-1">
            <SectionToggle
              id="admin"
              label="Admin"
              icon={Settings}
              isOpen={adminSectionOpen}
              onToggle={toggleSection}
            />
            {adminSectionOpen && (
              <div className="mt-0.5 space-y-0.5">
                {adminItems.map((item) => (
                  <NavLink
                    key={item.path}
                    path={item.path}
                    label={item.label}
                    icon={item.icon}
                    depth={1}
                    location={location}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </nav>
  );
}
