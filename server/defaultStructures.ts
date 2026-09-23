export interface KeyMetric {
  key: string;
  label: string;
  target: string;
  importance: "critical" | "high" | "medium";
}

export interface CoreQuestion {
  number: number;
  question: string;
  focus: string;
}

export interface IndustryDefault {
  core_questions: CoreQuestion[];
  key_metrics: KeyMetric[];
  section_order: string[];
  focus_areas: string[];
}

export const industryDefaults: Record<string, IndustryDefault> = {
  hospitality_retail: {
    core_questions: [
      {
        number: 1,
        question: "How profitable are we?",
        focus: "GP%, labour as % of revenue, average spend per cover/transaction, waste and stock levels",
      },
      {
        number: 2,
        question: "Is our cash position healthy?",
        focus: "Cash buffer in weeks, seasonal patterns, working capital cycle",
      },
      {
        number: 3,
        question: "Are we pricing and staffing correctly?",
        focus: "Labour cost %, average transaction value, rota efficiency, upsell performance",
      },
    ],
    key_metrics: [
      { key: "gross_margin_pct", label: "Gross Margin %", target: ">=65%", importance: "critical" },
      { key: "labour_pct", label: "Labour as % of Revenue", target: "<=30%", importance: "critical" },
      { key: "cash_buffer_weeks", label: "Cash Buffer (Weeks)", target: ">=6 weeks", importance: "high" },
      { key: "avg_transaction_value", label: "Average Transaction Value", target: "trending up", importance: "high" },
      { key: "stock_waste_pct", label: "Stock/Waste %", target: "<=3%", importance: "medium" },
    ],
    section_order: ["profitability", "cashflow", "labour", "debt", "goals", "actions"],
    focus_areas: [
      "Labour cost management",
      "GP% by revenue stream",
      "Seasonal cash planning",
      "Stock and waste control",
    ],
  },

  professional_services: {
    core_questions: [
      {
        number: 1,
        question: "Are we billing efficiently?",
        focus: "Utilisation rate, recovery rate, WIP levels, fee per head",
      },
      {
        number: 2,
        question: "Is our team the right size?",
        focus: "Headcount vs revenue, overhead per head, capacity vs demand",
      },
      {
        number: 3,
        question: "Are we growing the right clients?",
        focus: "Client mix, recurring vs project revenue, debtor days, fee concentration",
      },
    ],
    key_metrics: [
      { key: "utilisation_rate", label: "Utilisation Rate", target: ">=75%", importance: "critical" },
      { key: "recovery_rate", label: "Recovery Rate", target: ">=85%", importance: "critical" },
      { key: "debtor_days", label: "Debtor Days", target: "<=21 days", importance: "high" },
      { key: "revenue_per_head", label: "Revenue per Head", target: "trending up", importance: "high" },
      { key: "wip_days", label: "WIP Days Outstanding", target: "<=60 days", importance: "high" },
    ],
    section_order: ["profitability", "efficiency", "cashflow", "team", "goals", "actions"],
    focus_areas: [
      "Utilisation and recovery rate",
      "WIP management",
      "Debtor day reduction",
      "Fee per client analysis",
    ],
  },

  property: {
    core_questions: [
      {
        number: 1,
        question: "Is our portfolio performing?",
        focus: "Gross yield, net yield, void rate, maintenance as % of rental income",
      },
      {
        number: 2,
        question: "Is our debt correctly structured?",
        focus: "LTV ratio, interest cover, refinancing opportunities, debt maturity profile",
      },
      {
        number: 3,
        question: "Where is our next opportunity?",
        focus: "Portfolio gaps, equity release potential, development pipeline, market conditions",
      },
    ],
    key_metrics: [
      { key: "gross_yield", label: "Gross Yield", target: ">=6%", importance: "critical" },
      { key: "void_rate", label: "Void Rate", target: "<=5%", importance: "high" },
      { key: "ltv_ratio", label: "LTV Ratio", target: "<=70%", importance: "high" },
      { key: "maintenance_pct", label: "Maintenance as % of Rent", target: "<=15%", importance: "medium" },
      { key: "interest_cover", label: "Interest Cover Ratio", target: ">=2x", importance: "critical" },
    ],
    section_order: ["portfolio", "cashflow", "debt", "equity", "goals", "actions"],
    focus_areas: [
      "Portfolio yield optimisation",
      "Debt structure review",
      "Void management",
      "Capital recycling opportunities",
    ],
  },

  sme_general: {
    core_questions: [
      {
        number: 1,
        question: "Are we profitable enough?",
        focus: "Net margin %, owner salary vs profit, breakeven position",
      },
      {
        number: 2,
        question: "Is our cash position safe?",
        focus: "Cash buffer vs monthly costs, working capital cycle, debtor and creditor days",
      },
      {
        number: 3,
        question: "Are we on track for the owner's goals?",
        focus: "Progress toward stated financial goals, revenue growth rate, profit trajectory",
      },
    ],
    key_metrics: [
      { key: "net_margin_pct", label: "Net Margin %", target: ">=15%", importance: "critical" },
      { key: "cash_balance", label: "Cash Balance", target: ">=3 months costs", importance: "high" },
      { key: "owner_income", label: "Owner Income (salary + dividend)", target: "owner's stated goal", importance: "critical" },
      { key: "revenue_growth", label: "Revenue Growth", target: "trending up", importance: "high" },
      { key: "debtor_days", label: "Debtor Days", target: "<=30 days", importance: "medium" },
    ],
    section_order: ["profitability", "cashflow", "goals", "debt", "actions"],
    focus_areas: [
      "Owner income optimisation",
      "Cash buffer management",
      "Revenue growth trajectory",
      "Working capital efficiency",
    ],
  },

  manufacturing: {
    core_questions: [
      {
        number: 1,
        question: "Is production running efficiently?",
        focus: "Gross margin %, overhead absorption, production efficiency, stock turnover",
      },
      {
        number: 2,
        question: "Are our material costs under control?",
        focus: "Raw material as % of revenue, waste rates, supplier concentration, purchase price variance",
      },
      {
        number: 3,
        question: "Can we scale profitably?",
        focus: "Capacity utilisation, fixed vs variable cost split, contribution per unit",
      },
    ],
    key_metrics: [
      { key: "gross_margin_pct", label: "Gross Margin %", target: ">=30%", importance: "critical" },
      { key: "stock_turnover", label: "Stock Turnover Days", target: "<=45 days", importance: "high" },
      { key: "overhead_absorption", label: "Overhead Absorption Rate", target: ">=90%", importance: "high" },
      { key: "material_pct", label: "Raw Materials as % of Revenue", target: "<=40%", importance: "critical" },
      { key: "capacity_utilisation", label: "Capacity Utilisation", target: ">=75%", importance: "high" },
    ],
    section_order: ["production", "profitability", "cashflow", "stock", "goals", "actions"],
    focus_areas: [
      "Production efficiency",
      "Material cost control",
      "Stock management",
      "Overhead absorption",
    ],
  },
};

export function getIndustryDefault(industry: string): IndustryDefault {
  return industryDefaults[industry] || industryDefaults.sme_general;
}
