import Anthropic from "@anthropic-ai/sdk";
import { getIndustryDefault } from "./defaultStructures";

const client = new Anthropic();

function getIndustryFocus(industry: string): string {
  switch (industry) {
    case "hospitality_retail":
      return "Focus particularly on GP%, labour costs as a % of revenue, average spend per cover/transaction, and stock/waste levels. Flag any labour cost above 35% of revenue as critical. For hospitality businesses, comment on seasonal patterns and interest as a % of gross profit if debt schedule is present.";
    case "professional_services":
      return "Focus particularly on utilisation rate, recovery rate, WIP levels, debtor days, and fee per head. Flag any WIP older than 60 days.";
    case "property":
      return "Focus particularly on yield, void rates, maintenance as % of rental income, and net return on equity. Flag any void rate above 10%.";
    case "manufacturing":
      return "Focus particularly on production efficiency, raw material costs, overhead absorption, and stock turnover. Flag any gross margin below 30%.";
    default:
      return "Focus particularly on owner salary replacement, working capital cycle, revenue growth rate vs target, and debt to equity ratio.";
  }
}

function buildExtendedFinancialSummary(financialData: Record<string, any>): string {
  const is = financialData.income_statement || {};
  const cf = financialData.cashflow || {};
  const bs = financialData.balance_sheet || {};
  const kpis = financialData.kpis || {};
  const periodType = financialData.period_type || "monthly";
  const is12Weekly = periodType === "12_weekly";
  const periodWord = is12Weekly ? "this period" : "this month";

  let summary = `
PERIOD TYPE: ${is12Weekly ? "12-weekly" : "Monthly"}

INCOME STATEMENT:
Revenue: £${(is.total_revenue || 0).toLocaleString("en-GB")}
Cost of Sales: £${(is.cost_of_sales || 0).toLocaleString("en-GB")}
Gross Profit: £${(is.gross_profit || 0).toLocaleString("en-GB")} (${is.gross_margin_pct || 0}%)
Total Expenses: £${(is.total_expenses || 0).toLocaleString("en-GB")}
Operating Profit: £${(is.operating_profit || 0).toLocaleString("en-GB")} (${is.operating_margin_pct || 0}%)
Net Profit: £${(is.net_profit || 0).toLocaleString("en-GB")} (${is.net_margin_pct || 0}%)

CASHFLOW:
Opening Balance: £${(cf.opening_balance || 0).toLocaleString("en-GB")}
Cash In: £${(cf.cash_in || 0).toLocaleString("en-GB")}
Cash Out: £${(cf.cash_out || 0).toLocaleString("en-GB")}
Net Cashflow: £${(cf.net_cashflow || 0).toLocaleString("en-GB")}
Closing Balance: £${(cf.closing_balance || 0).toLocaleString("en-GB")}

BALANCE SHEET:
Total Assets: £${(bs.total_assets || 0).toLocaleString("en-GB")}
Current Assets: £${(bs.current_assets || 0).toLocaleString("en-GB")}
Current Liabilities: £${(bs.current_liabilities || 0).toLocaleString("en-GB")}
Net Assets: £${(bs.net_assets || 0).toLocaleString("en-GB")}
Total Debt: £${(bs.total_debt || 0).toLocaleString("en-GB")}

KPIs:
Debtor Days: ${kpis.debtor_days || 0}
Creditor Days: ${kpis.creditor_days || 0}
Current Ratio: ${kpis.current_ratio || 0}
Cash Balance: £${(kpis.cash_balance || 0).toLocaleString("en-GB")}
`;

  if (financialData.revenue_streams?.length > 0) {
    summary += `\nREVENUE STREAMS:\n`;
    for (const rs of financialData.revenue_streams) {
      summary += `- ${rs.name}: £${(rs.this_period || 0).toLocaleString("en-GB")} (${rs.pct_of_revenue || 0}% of revenue)\n`;
    }
  }

  if (financialData.cost_of_sales_detail?.length > 0) {
    summary += `\nCOST OF SALES DETAIL:\n`;
    for (const cs of financialData.cost_of_sales_detail) {
      summary += `- ${cs.name}: £${(cs.this_period || 0).toLocaleString("en-GB")} (${cs.pct_of_revenue || 0}% of revenue)${cs.note ? ` — ${cs.note}` : ""}\n`;
    }
  }

  if (financialData.overhead_breakdown?.length > 0) {
    summary += `\nOVERHEAD BREAKDOWN:\n`;
    for (const oh of financialData.overhead_breakdown) {
      summary += `- ${oh.category}: £${(oh.amount || 0).toLocaleString("en-GB")} (${oh.pct_of_revenue || 0}% of revenue)\n`;
    }
  }

  if (financialData.debt_schedule?.length > 0) {
    const totalDebt = financialData.debt_schedule.reduce((s: number, d: any) => s + (d.close_balance || 0), 0);
    summary += `\nDEBT SCHEDULE (${is12Weekly ? "period" : "month"}-end balances):\n`;
    for (const d of financialData.debt_schedule) {
      summary += `- ${d.facility} (${d.type}): Opening £${(d.open_balance || 0).toLocaleString("en-GB")}, Closing £${(d.close_balance || 0).toLocaleString("en-GB")} [${d.rag?.toUpperCase()}]${d.is_new_this_period ? " — NEW this period" : ""}${d.note ? ` — ${d.note}` : ""}\n`;
    }
    summary += `Total debt: £${totalDebt.toLocaleString("en-GB")}\n`;
    if (is.gross_profit > 0) {
      const interestEstimate = financialData.debt_schedule.reduce((s: number, d: any) => s + (d.open_balance + d.close_balance) / 2 * 0.08 / (is12Weekly ? 4.33 : 12), 0);
      summary += `Estimated interest this period: £${Math.round(interestEstimate).toLocaleString("en-GB")} (estimated)\n`;
    }
  }

  if (financialData.director_loan_accounts?.length > 0) {
    const totalDla = financialData.director_loan_accounts.reduce((s: number, d: any) => s + (d.close_balance || 0), 0);
    summary += `\nDIRECTOR LOAN ACCOUNTS:\n`;
    for (const d of financialData.director_loan_accounts) {
      summary += `- ${d.name}: Opening £${(d.open_balance || 0).toLocaleString("en-GB")}, Closing £${(d.close_balance || 0).toLocaleString("en-GB")} (${d.direction?.replace(/_/g, " ")}) — Status: ${d.status}\n`;
    }
    summary += `Total DLA: £${totalDla.toLocaleString("en-GB")}\n`;
  }

  if (financialData.grant_income?.length > 0) {
    summary += `\nGRANT INCOME:\n`;
    for (const g of financialData.grant_income) {
      summary += `- ${g.name}: £${(g.amount || 0).toLocaleString("en-GB")} (${g.recurring ? "recurring" : "non-recurring"})${g.note ? ` — ${g.note}` : ""}\n`;
    }
  }

  if (financialData.cashflow_waterfall) {
    const wf = financialData.cashflow_waterfall;
    summary += `\nCASHFLOW WATERFALL:\nOpening: £${(wf.opening_cash || 0).toLocaleString("en-GB")} → GP earned: £${(wf.gp_earned || 0).toLocaleString("en-GB")} → Overheads: (£${(wf.overheads_paid || 0).toLocaleString("en-GB")}) → Debt service: (£${(wf.debt_service || 0).toLocaleString("en-GB")}) → Grants: £${(wf.grant_received || 0).toLocaleString("en-GB")} → Assets: (£${(wf.asset_purchases || 0).toLocaleString("en-GB")}) → Closing: £${(wf.closing_cash || 0).toLocaleString("en-GB")}\n`;
  }

  if (financialData.breakeven) {
    summary += `\nBREAKEVEN:\nRequired GP: £${(financialData.breakeven.required_gross_profit || 0).toLocaleString("en-GB")}\nRequired revenue at current margin: £${(financialData.breakeven.required_revenue_at_current_margin || 0).toLocaleString("en-GB")}\n`;
    if (financialData.breakeven.note) summary += `Note: ${financialData.breakeven.note}\n`;
  }

  return summary;
}

export interface AiReportResult {
  executive_summary: string;
  going_well: string[];
  concerns: string[];
  action_steps: Array<{ action: string; why: string; priority: string; links_to_goal?: string; metric_impact?: string }>;
  goal_commentary: Array<{ goal: string; current_financial_position: string; gap: string; on_track: boolean }>;
  discussion_points: string[];
  watch_points: string[];
  next_period_focus: string;
  health_score: number;
  health_status: string;
  core_question_answers?: Array<{
    question_number: number;
    question: string;
    verdict: string;
    key_findings: string[];
    benchmark_commentary: string;
  }>;
  three_core_questions?: { profitability_verdict: string; capital_verdict: string; borrowing_verdict: string };
}

export async function generateAiReport(params: {
  financialData: Record<string, any>;
  customData: Record<string, any>;
  strategicPlan: any | null;
  industry: string;
  reportFrequency: string;
  clientName: string;
  companyName: string;
  periodLabel: string;
  reportStructure?: any | null;
  clientContext?: string | null;
  clientProfile?: {
    businessDescription?: string | null;
    ownerProfile?: string | null;
    keyRelationships?: any[] | null;
    historicalContext?: string | null;
    standingInstructions?: string | null;
    keyRisks?: any[] | null;
    keyOpportunities?: any[] | null;
    sectorNotes?: string | null;
  } | null;
  periodContext?: {
    context?: string | null;
    decisionsPending?: string | null;
    ownerConcerns?: string | null;
    oneOffs?: string | null;
  } | null;
}): Promise<AiReportResult> {
  const { financialData, customData, strategicPlan, industry, clientName, companyName, periodLabel, reportStructure, clientContext, clientProfile, periodContext } = params;

  const industryFocus = getIndustryFocus(industry);
  const is12Weekly = financialData?.period_type === "12_weekly";
  const periodWord = is12Weekly ? "this period" : "this month";
  const hasDebt = (financialData?.debt_schedule?.length || 0) > 0;
  const hasDla = (financialData?.director_loan_accounts?.length || 0) > 0;
  const hasGrant = (financialData?.grant_income?.length || 0) > 0;

  const financialSummary = buildExtendedFinancialSummary(financialData || {});

  const strategicContext = strategicPlan ? `
STRATEGIC PLAN:
Long-term goals:
${(strategicPlan.longTermGoals || []).map((g: any) => `- Goal: "${g.goal}" | Current position: "${g.currentPosition}"`).join("\n")}

Quick wins in progress:
${(strategicPlan.quickWins || []).map((w: string) => `- ${w}`).join("\n")}

SMART actions:
${(strategicPlan.smartActions || []).map((a: any) => `- ${a.action} (due: ${a.targetDate || "TBD"})`).join("\n")}

SWOT:
Strengths: ${(strategicPlan.swot?.strengths || []).join(", ")}
Weaknesses: ${(strategicPlan.swot?.weaknesses || []).join(", ")}
Opportunities: ${(strategicPlan.swot?.opportunities || []).join(", ")}
Threats: ${(strategicPlan.swot?.threats || []).join(", ")}
` : "No strategic plan on file for this client.";

  const additionalContext = customData?.notes ? `\nAccountant notes / additional context:\n${customData.notes}` : "";
  const clientContextSection = clientContext ? `\nCLIENT CONTEXT:\n${clientContext}\n` : "";

  const profileSection = clientProfile ? `
CLIENT PROFILE:
${clientProfile.businessDescription ? `Business: ${clientProfile.businessDescription}` : ""}
${clientProfile.ownerProfile ? `Owner: ${clientProfile.ownerProfile}` : ""}
${clientProfile.historicalContext ? `Historical context: ${clientProfile.historicalContext}` : ""}
${clientProfile.sectorNotes ? `Sector notes: ${clientProfile.sectorNotes}` : ""}
${clientProfile.keyRisks?.length ? `Key risks:\n${clientProfile.keyRisks.map((r: any) => `- ${r.risk} (likelihood: ${r.likelihood}, impact: ${r.impact})`).join("\n")}` : ""}
${clientProfile.keyOpportunities?.length ? `Key opportunities:\n${clientProfile.keyOpportunities.map((o: any) => `- ${o.opportunity} (timeline: ${o.timeline}, potential: ${o.potential_impact})`).join("\n")}` : ""}
${clientProfile.keyRelationships?.length ? `Key relationships:\n${clientProfile.keyRelationships.map((r: any) => `- ${r.type}: ${r.name} — ${r.description}`).join("\n")}` : ""}
` : "";

  const standingInstructionsSection = clientProfile?.standingInstructions ? `
STANDING INSTRUCTIONS (follow these in every report):
${clientProfile.standingInstructions}
` : "";

  const periodContextSection = periodContext ? `
THIS PERIOD'S CONTEXT:
${periodContext.context ? `What happened this period: ${periodContext.context}` : ""}
${periodContext.decisionsPending ? `Decisions the owner is facing: ${periodContext.decisionsPending}` : ""}
${periodContext.ownerConcerns ? `Owner's current concerns: ${periodContext.ownerConcerns}` : ""}
${periodContext.oneOffs ? `One-off items to note: ${periodContext.oneOffs}` : ""}
` : "";

  const debtInstructions = hasDebt ? `
- Calculate interest as % of gross profit and flag if >20% — this is unsustainable
- Identify highest-cost or highest-risk debt facilities  
- Assess whether total debt is serviceable from the operating surplus
- Comment on any new debt added this period and its purpose
` : "";

  const dlaInstructions = hasDla ? `
- Assess the DLA position — is it increasing or reducing?
- Flag if DLA owed to company is increasing (director drawing more than earnings support)
- Note whether the trend is positive (reducing) or concerning (increasing)
` : "";

  const grantInstructions = hasGrant ? `
- Comment on grant income reliability — distinguish recurring vs non-recurring
- Flag if the business is reliant on non-recurring grant income to show a profit
` : "";

  // Build structure-aware core questions
  let coreQuestionsToAnswer: Array<{ number: number; question: string; focus: string }> = [];
  let keyMetricsContext = "";

  if (reportStructure?.status === "approved" && reportStructure.coreQuestions?.length > 0) {
    coreQuestionsToAnswer = reportStructure.coreQuestions;
    if (reportStructure.keyMetrics?.length > 0) {
      keyMetricsContext = `\nKEY METRICS TO BENCHMARK (client-specific targets):\n${reportStructure.keyMetrics.map((m: any) => `- ${m.label}: target ${m.target} [${m.importance}]`).join("\n")}\n`;
    }
  } else {
    const defaults = getIndustryDefault(industry);
    coreQuestionsToAnswer = defaults.core_questions;
    keyMetricsContext = `\nINDUSTRY BENCHMARK METRICS:\n${defaults.key_metrics.map(m => `- ${m.label}: target ${m.target} [${m.importance}]`).join("\n")}\n`;
  }

  const coreQuestionsPrompt = coreQuestionsToAnswer.map(q =>
    `    {\n      "question_number": ${q.number},\n      "question": "${q.question}",\n      "verdict": "2-3 sentence direct answer using specific numbers. Focus on: ${q.focus}",\n      "key_findings": ["specific finding with number", "specific finding with number"],\n      "benchmark_commentary": "compare to target/industry benchmark"\n    }`
  ).join(",\n");

  const systemPrompt = `You are an experienced management accountant writing a management accounts report for a client. 
Write as a trusted advisor speaking directly to the business owner. Be specific with numbers. Do not hedge.
If something is a problem, say so clearly. Be honest but constructive.
Always link commentary back to the client's personal goals where a strategic plan exists.
${industryFocus}
${debtInstructions}
${dlaInstructions}
${grantInstructions}
${is12Weekly ? "This is a 12-weekly period report. Reference 'this period' not 'this month' throughout." : ""}
You must return ONLY valid JSON. No markdown, no prose outside the JSON.`;

  const userPrompt = `Prepare a management accounts report for:
Client: ${clientName} (${companyName})
Period: ${periodLabel}
Industry: ${industry}

FINANCIAL DATA:
${financialSummary}

${keyMetricsContext}
${strategicContext}
${additionalContext}
${clientContextSection}
${profileSection}
${standingInstructionsSection}
${periodContextSection}

Return JSON in exactly this structure:
{
  "executive_summary": "2-3 paragraph narrative summarising performance ${periodWord}, key movements, and outlook. Be specific with numbers.",
  "going_well": ["3 specific positives with numbers"],
  "concerns": ["3 specific concerns with numbers"],
  "core_question_answers": [
${coreQuestionsPrompt}
  ],
  "action_steps": [
    {
      "action": "specific, numbered action to take",
      "why": "reason linked directly to the financial data with specific numbers",
      "priority": "high|medium|low",
      "links_to_goal": "which strategic goal this helps (or null if none)",
      "metric_impact": "which metric this action moves and by how much (e.g. 'improves labour % from 38% toward 30% target')"
    }
  ],
  "goal_commentary": [
    {
      "goal": "the client's stated long-term goal",
      "current_financial_position": "what the numbers say about progress toward this goal",
      "gap": "what needs to happen financially to achieve it",
      "on_track": true or false
    }
  ],
  "discussion_points": [
    "Specific question or talking point for the client meeting — use their actual numbers"
  ],
  "watch_points": [
    "Things to monitor next period — leading indicators or risks worth flagging"
  ],
  "next_period_focus": "One paragraph on the single most important thing to focus on next period and why",
  "three_core_questions": {
    "profitability_verdict": "2-3 sentence direct verdict on profitability. Be punchy. Use specific numbers. Do not hedge.",
    "capital_verdict": "2-3 sentence direct verdict on capital efficiency and balance sheet position. Specific numbers only.",
    "borrowing_verdict": "2-3 sentence direct verdict on the borrowing position. Should we borrow more? Specific and direct."
  },
  "health_score": 0-100,
  "health_status": "Strong|Good|Needs attention|Critical"
}`;

  const message = await client.messages.create({
    model: "claude-opus-4-5",
    max_tokens: 6000,
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
  });

  const content = message.content[0];
  if (content.type !== "text") throw new Error("Unexpected AI response type");

  let jsonText = content.text.trim();
  jsonText = jsonText.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");

  return JSON.parse(jsonText);
}

// ─── Generate Report Structure ─────────────────────────────────────────────────

export interface GeneratedStructure {
  core_questions: Array<{ number: number; question: string; focus: string }>;
  key_metrics: Array<{ key: string; label: string; target: string; importance: string }>;
  section_order: string[];
  focus_areas: string[];
  rationale: string;
}

export async function generateReportStructure(params: {
  clientName: string;
  companyName: string;
  industry: string;
  clientContext: string;
  strategicPlan: any | null;
}): Promise<GeneratedStructure> {
  const { clientName, companyName, industry, clientContext, strategicPlan } = params;
  const defaults = getIndustryDefault(industry);

  const strategicContext = strategicPlan ? `
STRATEGIC PLAN GOALS:
${(strategicPlan.longTermGoals || []).map((g: any) => `- ${g.goal}`).join("\n")}
SWOT Weaknesses: ${(strategicPlan.swot?.weaknesses || []).join(", ")}
` : "";

  const systemPrompt = `You are an expert management accountant designing a custom report structure for an accountancy client. 
Your job is to tailor the management accounts report format to exactly what matters for this specific client.
Start from industry defaults but modify them based on the client context and goals.
Return ONLY valid JSON. No markdown, no prose outside the JSON.`;

  const userPrompt = `Design a custom report structure for:
Client: ${clientName} (${companyName})
Industry: ${industry}

CLIENT CONTEXT:
${clientContext}

${strategicContext}

INDUSTRY DEFAULTS TO START FROM:
Core questions: ${defaults.core_questions.map(q => q.question).join(" | ")}
Key metrics: ${defaults.key_metrics.map(m => `${m.label} (target: ${m.target})`).join(" | ")}

Based on the client context above, customise these defaults. You may:
- Reword questions to be more specific to this client
- Add a new question if the context reveals something critical not covered by defaults
- Adjust metric targets based on the client's situation
- Remove a metric that is clearly irrelevant to this client

Return JSON in exactly this structure:
{
  "core_questions": [
    {
      "number": 1,
      "question": "client-specific question",
      "focus": "what the AI should focus on when answering this question — specific metrics and aspects"
    }
  ],
  "key_metrics": [
    {
      "key": "snake_case_key",
      "label": "Human Readable Label",
      "target": "specific target e.g. >=65% or <=30 days",
      "importance": "critical|high|medium"
    }
  ],
  "section_order": ["profitability", "cashflow", "debt", "goals", "actions"],
  "focus_areas": ["2-4 specific focus areas for this client"],
  "rationale": "2-3 sentences explaining why this structure was chosen for this client"
}`;

  const message = await client.messages.create({
    model: "claude-opus-4-5",
    max_tokens: 3000,
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
  });

  const content = message.content[0];
  if (content.type !== "text") throw new Error("Unexpected AI response type");

  let jsonText = content.text.trim();
  jsonText = jsonText.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");

  return JSON.parse(jsonText);
}
