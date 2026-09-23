/**
 * Puppeteer-ready HTML Report Template — v2
 * A4 pages (794×1123px), all styles inline, no external deps.
 */

const NAVY  = "#1B2B4B";
const TEAL  = "#0F9B8E";
const BLUE  = "#3B82F6";
const AMBER = "#F59E0B";
const RED   = "#EF4444";
const GREEN = "#10B981";
const GREY_BG = "#F8F9FA";
const BORDER  = "#E5E7EB";
const MID_GREY = "#6B7280";

// ── Formatters ─────────────────────────────────────────────────────────────────
function fmt(n: number | undefined | null): string {
  if (n == null || n === undefined) return "—";
  const abs = Math.round(Math.abs(n)).toLocaleString("en-GB");
  return n < 0 ? `(£${abs})` : `£${abs}`;
}
function fmtK(n: number | undefined | null): string {
  if (n == null) return "—";
  const abs = Math.abs(n);
  if (abs >= 1000) return `${n < 0 ? "(" : ""}£${Math.round(abs / 1000)}k${n < 0 ? ")" : ""}`;
  return fmt(n);
}
function fmtPct(n: number | undefined | null): string {
  if (n == null) return "—";
  return `${n}%`;
}
function ragDot(rag: string): string {
  const c = rag === "red" ? RED : rag === "amber" ? AMBER : GREEN;
  return `<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${c};vertical-align:middle;margin-right:5px;flex-shrink:0;"></span>`;
}
function ragLabel(rag: string): string {
  return rag === "red" ? "RED" : rag === "amber" ? "AMBER" : "GREEN";
}
function movementArrow(n: number | undefined | null, goodIsUp = true): string {
  if (n == null) return "";
  const up = n > 0;
  const good = goodIsUp ? up : !up;
  const c = good ? GREEN : RED;
  const arrow = up ? "↑" : "↓";
  const sign  = up ? "+" : "";
  return `<span style="color:${c};font-size:11px;font-weight:600;">${arrow} ${sign}${fmt(n)}</span>`;
}

// ── Page shell ─────────────────────────────────────────────────────────────────
function pageHeader(company: string, periodLabel: string): string {
  return `<div style="height:28px;background:#F9FAFB;border-bottom:1px solid ${BORDER};display:flex;align-items:center;justify-content:space-between;padding:0 40px;flex-shrink:0;">
    <span style="font-size:8.5px;color:${MID_GREY};font-family:sans-serif;">${company} | MI Pack — ${periodLabel} | MBS Accountants | Confidential</span>
  </div>`;
}
function pageFooter(num: number, total: number, company: string): string {
  return `<div style="height:26px;border-top:1px solid ${BORDER};display:flex;align-items:center;justify-content:center;flex-shrink:0;">
    <span style="font-size:9px;color:${MID_GREY};font-family:sans-serif;">${num === 1 ? "" : `${company} | MI Pack — `}Page ${num} of ${total} | MBS Accountants | Confidential</span>
  </div>`;
}
function page(content: string, company: string, periodLabel: string, num: number, total: number): string {
  return `<div style="width:794px;min-height:1123px;page-break-after:always;overflow:hidden;display:flex;flex-direction:column;background:#fff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
  ${pageHeader(company, periodLabel)}
  <div style="flex:1;overflow:hidden;">${content}</div>
  ${pageFooter(num, total, company)}
</div>`;
}

// ── Horizontal SVG bar chart (for profitability page) ─────────────────────────
function buildHBarChart(items: Array<{ label: string; value: number; colour: string }>): string {
  if (!items.length) return "";
  const valid = items.filter(i => typeof i.value === "number");
  const maxVal = Math.max(...valid.map(i => Math.abs(i.value)), 1);
  const rowH = 28; const gap = 8; const labelW = 110; const barW = 320; const valW = 90;
  const svgH = valid.length * (rowH + gap) + 4;
  const bars = valid.map((item, i) => {
    const y = i * (rowH + gap) + 2;
    const bW = Math.max(3, (Math.abs(item.value) / maxVal) * barW);
    const valStr = fmt(item.value);
    return `
      <text x="${labelW - 8}" y="${y + rowH / 2 + 4}" text-anchor="end" font-size="11" fill="#374151" font-family="sans-serif">${item.label}</text>
      <rect x="${labelW}" y="${y}" width="${bW}" height="${rowH}" fill="${item.colour}" rx="3"/>
      <text x="${labelW + bW + 6}" y="${y + rowH / 2 + 4}" font-size="11.5" fill="#111" font-weight="600" font-family="sans-serif">${valStr}</text>`;
  }).join("");
  return `<svg width="${labelW + barW + valW}" height="${svgH}" xmlns="http://www.w3.org/2000/svg">${bars}</svg>`;
}

// ── Vertical grouped bar chart (revenue by stream, 4 periods) ─────────────────
function buildVBarChart(streams: any[], height = 130): string {
  if (!streams.length) return "";
  const chartW = 680; const chartH = height;
  const barW = Math.min(40, chartW / streams.length - 12);
  const spacing = chartW / streams.length;
  const maxVal = Math.max(...streams.map((s: any) => Math.max(s.this_period || 0, s.prior_period || 0)), 1);
  const colours = [TEAL, NAVY, BLUE, AMBER];

  const bars = streams.slice(0, 8).map((s: any, i: number) => {
    const x = i * spacing + (spacing - barW) / 2;
    const bH = Math.max(2, ((s.this_period || 0) / maxVal) * (chartH - 24));
    const pBH = s.prior_period ? Math.max(2, (s.prior_period / maxVal) * (chartH - 24)) : 0;
    const col = colours[i % colours.length];
    const label = (s.name || "").slice(0, 12);
    return `
      ${pBH ? `<rect x="${x - barW / 4}" y="${chartH - 24 - pBH}" width="${barW * 0.7}" height="${pBH}" fill="${col}" opacity="0.3" rx="2"/>` : ""}
      <rect x="${x}" y="${chartH - 24 - bH}" width="${barW}" height="${bH}" fill="${col}" rx="2"/>
      <text x="${x + barW / 2}" y="${chartH - 8}" text-anchor="middle" font-size="9" fill="${MID_GREY}" font-family="sans-serif">${label}</text>`;
  }).join("");

  return `<svg width="${chartW}" height="${chartH}" xmlns="http://www.w3.org/2000/svg">
    <line x1="0" y1="${chartH - 24}" x2="${chartW}" y2="${chartH - 24}" stroke="${BORDER}" stroke-width="1"/>
    ${bars}
  </svg>`;
}

// ── Cashflow waterfall SVG ─────────────────────────────────────────────────────
function buildCashWaterfallSvg(wf: any): string {
  if (!wf) return "";
  const items = [
    { label: "Opening",    value: wf.opening_cash || 0,               cumStart: 0,                           isTotal: true },
    { label: "GP Earned",  value: wf.gp_earned || 0,                  cumStart: wf.opening_cash || 0,        isTotal: false },
    { label: "Overheads",  value: -(wf.overheads_paid || 0),          cumStart: (wf.opening_cash || 0) + (wf.gp_earned || 0), isTotal: false },
    { label: "Debt Svc",   value: -(wf.debt_service || 0),            cumStart: 0,                           isTotal: false },
    { label: "Grants",     value: wf.grant_received || 0,             cumStart: 0,                           isTotal: false },
    { label: "Assets",     value: -(wf.asset_purchases || 0),         cumStart: 0,                           isTotal: false },
    { label: "WC",         value: wf.working_capital_movement || 0,   cumStart: 0,                           isTotal: false },
    { label: "Closing",    value: wf.closing_cash || 0,               cumStart: 0,                           isTotal: true },
  ];

  const allVals = items.map(i => i.value);
  const minV = Math.min(...allVals, 0);
  const maxV = Math.max(...allVals, 0);
  const range = maxV - minV || 1;
  const chartH = 100; const chartW = 640; const barW = 56; const spacing = chartW / items.length;
  const zero = chartH * (maxV / range);

  const bars = items.map((item, i) => {
    const x = i * spacing + (spacing - barW) / 2;
    const col = item.isTotal ? NAVY : item.value >= 0 ? GREEN : RED;
    const h = Math.max(3, (Math.abs(item.value) / range) * chartH);
    const y = item.value >= 0 ? zero - h : zero;
    return `
      <rect x="${x}" y="${y}" width="${barW}" height="${h}" fill="${col}" rx="2"/>
      <text x="${x + barW / 2}" y="${chartH + 14}" text-anchor="middle" font-size="9" fill="${MID_GREY}" font-family="sans-serif">${item.label}</text>
      <text x="${x + barW / 2}" y="${Math.max(y - 2, 10)}" text-anchor="middle" font-size="9" fill="#111" font-weight="600" font-family="sans-serif">${fmtK(item.value)}</text>`;
  }).join("");

  return `<svg width="${chartW}" height="${chartH + 22}" xmlns="http://www.w3.org/2000/svg">
    <line x1="0" y1="${zero}" x2="${chartW}" y2="${zero}" stroke="${BORDER}" stroke-width="1"/>
    ${bars}
  </svg>`;
}

// ── P&L waterfall bar chart (always rendered when IS data present) ────────────
function buildPlWaterfallSvg(is: any, grantTotal = 0): string {
  const rev  = is.total_revenue    || 0;
  const cos  = -(is.cost_of_sales  || 0);
  const gp   = is.gross_profit     || 0;
  const exp  = -(is.total_expenses || 0);
  const op   = is.operating_profit || 0;
  const grant = grantTotal > 0 ? grantTotal : 0;
  const net  = is.net_profit       || 0;

  const items: Array<{ label: string; value: number; isTotal: boolean; colour?: string }> = [
    { label: "Revenue",  value: rev,  isTotal: true,  colour: NAVY  },
    { label: "CoS",      value: cos,  isTotal: false, colour: AMBER },
    { label: "GP",       value: gp,   isTotal: true,  colour: TEAL  },
    { label: "Overheads", value: exp, isTotal: false, colour: AMBER },
    { label: "Op Profit", value: op,  isTotal: true,  colour: op >= 0 ? GREEN : RED },
    ...(grant > 0 ? [{ label: "Grant", value: grant, isTotal: false, colour: TEAL }] : []),
    { label: "Net",       value: net, isTotal: true,  colour: net >= 0 ? GREEN : RED },
  ].filter(i => i.value !== 0);

  if (!items.length) return "";

  const chartW = 680; const chartH = 110;
  const barW = Math.min(60, chartW / items.length - 14);
  const spacing = chartW / items.length;
  const allAbs = items.map(i => Math.abs(i.value));
  const maxAbs = Math.max(...allAbs, 1);

  const bars = items.map((item, i) => {
    const x = i * spacing + (spacing - barW) / 2;
    const bH = Math.max(4, (Math.abs(item.value) / maxAbs) * (chartH - 28));
    const y  = chartH - 24 - bH;
    const col = item.colour || (item.value >= 0 ? GREEN : RED);
    const label = item.label;
    const val   = fmtK(item.value);
    return `
      <rect x="${x}" y="${y}" width="${barW}" height="${bH}" fill="${col}" rx="3" opacity="${item.isTotal ? "1" : "0.75"}"/>
      <text x="${x + barW / 2}" y="${y - 3}" text-anchor="middle" font-size="9.5" fill="#111" font-weight="600" font-family="sans-serif">${val}</text>
      <text x="${x + barW / 2}" y="${chartH - 8}" text-anchor="middle" font-size="9" fill="${MID_GREY}" font-family="sans-serif">${label}</text>`;
  }).join("");

  return `<svg width="${chartW}" height="${chartH}" xmlns="http://www.w3.org/2000/svg">
    <line x1="0" y1="${chartH - 24}" x2="${chartW}" y2="${chartH - 24}" stroke="${BORDER}" stroke-width="1"/>
    ${bars}
  </svg>`;
}

// ── PAGE 1: COVER ──────────────────────────────────────────────────────────────
function renderCover(report: any, client: any, structure: any, periodLabel: string): string {
  const coreQs = getCoreQuestions(report, structure);
  const score  = report.aiHealthScore;
  const status = report.aiHealthStatus || "";

  // Build review cycle table from period data if available
  const periodStart = report.period?.periodStart;
  const periodEnd   = report.period?.periodEnd;

  const questionCards = coreQs.slice(0, 3).map((q: any, i: number) => `
    <div style="display:flex;align-items:flex-start;gap:14px;background:#F0FAFA;border-left:4px solid ${TEAL};border-radius:6px;padding:13px 18px;margin-bottom:10px;">
      <div style="background:${NAVY};color:#fff;width:26px;height:26px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;flex-shrink:0;line-height:26px;text-align:center;">${i + 1}</div>
      <div>
        <p style="margin:0;font-size:13px;font-weight:700;color:${NAVY};">${q.question || q.question_text || ["How profitable are we?","Is our capital deployed correctly?","Can / should we look to borrow more?"][i]}</p>
        <p style="margin:3px 0 0;font-size:11px;color:${MID_GREY};">${[
          "Gross margin, operating performance, cost analysis.",
          "Asset efficiency, working capital, balance sheet movement.",
          "Debt levels, interest burden, lending headroom."
        ][i]}</p>
      </div>
    </div>`).join("");

  const dateSubtitle = periodStart && periodEnd
    ? `${fmtDateLong(periodStart)} to ${fmtDateLong(periodEnd)}`
    : periodLabel;

  const coverContent = `
    <div style="height:430px;background:${NAVY};padding:40px 48px;display:flex;flex-direction:column;justify-content:space-between;">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;">
        <div>
          <div style="font-size:32px;font-weight:900;color:${TEAL};letter-spacing:-1px;line-height:1;">mbs</div>
          <div style="font-size:12px;color:rgba(255,255,255,0.55);letter-spacing:1.5px;margin-top:2px;text-transform:uppercase;">accountants</div>
        </div>
        <div style="text-align:right;">
          <p style="font-size:10px;color:rgba(255,255,255,0.45);text-transform:uppercase;letter-spacing:1px;margin:0 0 3px;">Prepared for</p>
          <p style="font-size:15px;color:#fff;font-weight:700;margin:0;">${client.companyName || client.clientName}</p>
        </div>
      </div>
      <div style="text-align:center;">
        <p style="font-size:11px;color:rgba(255,255,255,0.45);text-transform:uppercase;letter-spacing:2px;margin:0 0 10px;">Management Information Pack</p>
        <h1 style="font-size:34px;font-weight:800;color:#fff;margin:0 0 8px;line-height:1.1;">${client.companyName || client.clientName}</h1>
        <p style="font-size:16px;color:${TEAL};font-weight:600;margin:0 0 4px;">${periodLabel}</p>
        <p style="font-size:12px;color:rgba(255,255,255,0.5);margin:0;">${dateSubtitle}</p>
        ${score != null ? `
        <div style="display:inline-flex;align-items:center;gap:16px;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.15);border-radius:10px;padding:10px 22px;margin-top:16px;">
          <div><p style="color:rgba(255,255,255,0.45);font-size:10px;text-transform:uppercase;letter-spacing:1px;margin:0 0 1px;">Health Score</p><p style="color:${TEAL};font-size:26px;font-weight:800;margin:0;">${score}</p></div>
          <div style="width:1px;height:30px;background:rgba(255,255,255,0.2);"></div>
          <div><p style="color:rgba(255,255,255,0.45);font-size:10px;text-transform:uppercase;letter-spacing:1px;margin:0 0 1px;">Status</p><p style="color:${TEAL};font-size:15px;font-weight:700;margin:0;">${status}</p></div>
        </div>` : ""}
      </div>
      <p style="color:rgba(255,255,255,0.3);font-size:9.5px;margin:0;border-top:1px solid rgba(255,255,255,0.1);padding-top:14px;">Prepared by MBS Accountants · April 2026 · Confidential · Not for redistribution</p>
    </div>
    <div style="padding:22px 48px 16px;">
      <p style="font-size:11px;font-weight:700;color:${MID_GREY};text-transform:uppercase;letter-spacing:.8px;margin:0 0 12px;">This pack addresses three core questions:</p>
      ${questionCards}
    </div>`;

  return coverContent;
}

// ── PAGE 2: DASHBOARD ──────────────────────────────────────────────────────────
function renderDashboard(report: any, client: any): string {
  const fd  = report.financialData || {};
  const is  = fd.income_statement  || {};
  const cf  = fd.cashflow          || {};
  const bs  = fd.balance_sheet     || {};
  const kpi = fd.kpis              || {};
  const debtSchedule: any[] = fd.debt_schedule || [];
  const dlas: any[] = fd.director_loan_accounts || [];
  const grantIncome: any[] = fd.grant_income || [];

  const totalDebt = debtSchedule.reduce((s: number, d: any) => s + (d.close_balance || 0), 0);
  const totalDebtOpen = debtSchedule.reduce((s: number, d: any) => s + (d.open_balance || 0), 0);
  const totalGrant = grantIncome.reduce((s: number, g: any) => s + (g.amount || 0), 0);
  const totalDLA = dlas.reduce((s: number, d: any) => s + (d.close_balance || 0), 0);
  const totalDLAOpen = dlas.reduce((s: number, d: any) => s + (d.open_balance || 0), 0);
  const interestPaid = debtSchedule.reduce((s: number, d: any) => s + (d.interest_paid || 0), 0);

  // Derive prior revenue if available
  const priorRev = is.prior_revenue;
  const revChange = priorRev ? Math.round(((is.total_revenue - priorRev) / priorRev) * 100) : null;
  const cashMove = cf.opening_balance != null ? (cf.closing_balance || 0) - cf.opening_balance : null;
  const netAssetsMove = bs.prior_net_assets != null ? (bs.net_assets || 0) - bs.prior_net_assets : null;

  // ── Headline metric groups (4 per row, 3 rows like reference) ─────────────
  function metricCard(label: string, value: string, sub: string, subColor = MID_GREY): string {
    const isNeg = value.startsWith("(");
    return `<div style="flex:1;min-width:0;background:${GREY_BG};border:1px solid ${BORDER};border-radius:8px;padding:12px 14px;">
      <p style="margin:0 0 3px;font-size:9.5px;color:${MID_GREY};text-transform:uppercase;letter-spacing:.4px;">${label}</p>
      <p style="margin:0;font-size:18px;font-weight:700;color:${isNeg ? RED : NAVY};line-height:1.2;">${value}</p>
      ${sub ? `<p style="margin:3px 0 0;font-size:10px;color:${subColor};">${sub}</p>` : ""}
    </div>`;
  }

  const gpInterestRatio = (is.gross_profit && interestPaid) ? Math.round((interestPaid / is.gross_profit) * 1000) / 10 : null;
  const netProfit = totalGrant ? (is.net_profit || 0) - totalGrant : null;

  // ── Scorecard with prior period column ────────────────────────────────────
  function scorecardRAG(key: string): string {
    switch (key) {
      case "rev":    return priorRev ? ((is.total_revenue || 0) >= priorRev ? "green" : "amber") : "green";
      case "gp":     return (is.gross_margin_pct || 0) >= 25 ? "green" : (is.gross_margin_pct || 0) >= 20 ? "amber" : "red";
      case "op":     return (is.operating_profit || 0) > 0 ? "green" : (is.operating_profit || 0) > -5000 ? "amber" : "red";
      case "np":     return (is.net_profit || 0) >= 0 ? "green" : "red";
      case "cash":   { const b = cf.closing_balance || 0; return b >= 10000 ? "green" : b >= 5000 ? "amber" : "red"; }
      case "dd":     return (kpi.debtor_days || 0) <= 14 ? "green" : (kpi.debtor_days || 0) <= 30 ? "amber" : "red";
      case "intgp":  return gpInterestRatio != null ? (gpInterestRatio <= 20 ? "green" : gpInterestRatio <= 30 ? "amber" : "red") : "grey";
      case "debt":   return totalDebt < totalDebtOpen ? "green" : totalDebt === totalDebtOpen ? "amber" : "red";
      case "dla":    return totalDLA < totalDLAOpen ? "green" : "amber";
      case "wc":     { const wc = (bs.current_assets || 0) - (bs.current_liabilities || 0);
                       const wcOpen = (bs.prior_current_assets || 0) - (bs.prior_current_liabilities || 0);
                       return wc > wcOpen ? "green" : wc > 0 ? "amber" : "red"; }
      default: return "grey";
    }
  }

  const scorecardRows = [
    { label: "Revenue",              actual: fmt(is.total_revenue),          prior: fmt(is.prior_revenue),         target: "Increasing",   key: "rev" },
    { label: "Gross Profit %",       actual: fmtPct(is.gross_margin_pct),    prior: fmtPct(is.prior_gp_pct),       target: "≥ 25%",        key: "gp"  },
    { label: "Operating Profit",     actual: fmt(is.operating_profit),       prior: fmt(is.prior_op_profit),       target: "Improving",    key: "op"  },
    { label: "Net Profit",           actual: fmt(is.net_profit),             prior: fmt(is.prior_net_profit),      target: "Positive",     key: "np"  },
    { label: "Cash Balance",         actual: fmt(cf.closing_balance),        prior: fmt(cf.opening_balance),       target: "≥ £10,000",    key: "cash"},
    ...(kpi.debtor_days > 0 ? [{ label: "Debtor Days", actual: `${kpi.debtor_days} days`, prior: kpi.prior_debtor_days != null ? `${kpi.prior_debtor_days} days` : "—", target: "≤ 14 days", key: "dd" }] : []),
    ...(gpInterestRatio != null ? [{ label: "Interest / GP", actual: `${gpInterestRatio}%`, prior: "—", target: "≤ 20%", key: "intgp" }] : []),
    ...(debtSchedule.length ? [{ label: "Total Debt", actual: fmtK(totalDebt), prior: fmtK(totalDebtOpen), target: "Decreasing", key: "debt" }] : []),
    ...(dlas.length ? [{ label: "DLA Balances", actual: fmt(totalDLA), prior: fmt(totalDLAOpen), target: "Decreasing", key: "dla" }] : []),
  ].filter(r => r.actual !== "—");

  const scRows = scorecardRows.map((r, i) => {
    const rag = scorecardRAG(r.key);
    const c = rag === "red" ? RED : rag === "amber" ? AMBER : GREEN;
    return `<tr style="background:${i % 2 === 0 ? "#fff" : GREY_BG};">
      <td style="padding:7px 10px;font-size:11px;color:#374151;">${r.label}</td>
      <td style="padding:7px 10px;font-size:11px;font-weight:600;color:#111;">${r.actual}</td>
      <td style="padding:7px 10px;font-size:11px;color:${MID_GREY};">${r.prior}</td>
      <td style="padding:7px 10px;font-size:11px;color:${MID_GREY};">${r.target}</td>
      <td style="padding:7px 10px;font-size:11px;white-space:nowrap;"><span style="display:inline-block;width:9px;height:9px;border-radius:50%;background:${c};vertical-align:middle;margin-right:4px;"></span>${ragLabel(rag)}</td>
    </tr>`;
  }).join("");

  const goingWell: string[] = report.aiGoingWell || [];
  const concerns: string[]  = report.aiConcerns  || [];

  const wc = (bs.current_assets || 0) - (bs.current_liabilities || 0);

  return `
    <div style="padding:20px 40px 16px;">
      <div style="background:${NAVY};padding:12px 20px;border-radius:6px;margin-bottom:16px;display:flex;justify-content:space-between;align-items:center;">
        <div>
          <p style="margin:0;font-size:10px;color:rgba(255,255,255,0.5);text-transform:uppercase;letter-spacing:1px;">Period Dashboard</p>
          <h2 style="margin:0;font-size:18px;font-weight:800;color:#fff;">At-a-glance summary</h2>
        </div>
        <p style="font-size:11px;color:rgba(255,255,255,0.5);margin:0;">${client.companyName || client.clientName}</p>
      </div>

      <p style="font-size:9.5px;font-weight:700;color:${MID_GREY};text-transform:uppercase;letter-spacing:.6px;margin:0 0 6px;">Profitability</p>
      <div style="display:flex;gap:8px;margin-bottom:12px;">
        ${metricCard("Revenue", fmt(is.total_revenue), revChange != null ? `${revChange > 0 ? "+" : ""}${revChange}% on prior` : "", revChange != null ? (revChange >= 0 ? GREEN : RED) : MID_GREY)}
        ${metricCard("Gross Profit", fmt(is.gross_profit), `${is.gross_margin_pct || 0}% margin`)}
        ${metricCard("Operating Profit", fmt(is.operating_profit), `${is.operating_margin_pct || 0}% margin`)}
        ${metricCard("Net Profit", fmt(is.net_profit), totalGrant ? `After £${Math.round(totalGrant).toLocaleString("en-GB")} grant` : "")}
      </div>

      <p style="font-size:9.5px;font-weight:700;color:${MID_GREY};text-transform:uppercase;letter-spacing:.6px;margin:0 0 6px;">Balance Sheet & Cash</p>
      <div style="display:flex;gap:8px;margin-bottom:12px;">
        ${metricCard("Cash (Close)", fmt(cf.closing_balance), cashMove != null ? `${cashMove >= 0 ? "↑" : "↓"} from ${fmt(cf.opening_balance)}` : "", cashMove != null ? (cashMove >= 0 ? GREEN : RED) : MID_GREY)}
        ${metricCard("Debtors", fmt(bs.debtors || bs.trade_debtors), kpi.debtor_days > 0 ? `${kpi.debtor_days} debtor days` : "")}
        ${metricCard("Fixed Assets", fmt(bs.fixed_assets || bs.non_current_assets), "")}
        ${metricCard("Net Assets", fmt(bs.net_assets), netAssetsMove != null ? `${netAssetsMove >= 0 ? "↑" : "↓"} ${fmt(Math.abs(netAssetsMove))} in period` : "", netAssetsMove != null ? (netAssetsMove >= 0 ? GREEN : RED) : MID_GREY)}
      </div>

      <p style="font-size:9.5px;font-weight:700;color:${MID_GREY};text-transform:uppercase;letter-spacing:.6px;margin:0 0 6px;">Debt & Working Capital</p>
      <div style="display:flex;gap:8px;margin-bottom:14px;">
        ${metricCard("Total Debt", fmtK(totalDebt), totalDebt > totalDebtOpen ? `↑ ${fmtK(totalDebt - totalDebtOpen)} new debt` : totalDebt < totalDebtOpen ? `↓ ${fmtK(totalDebtOpen - totalDebt)} reduced` : "Unchanged", totalDebt <= totalDebtOpen ? GREEN : RED)}
        ${interestPaid ? metricCard("Interest Paid", fmt(interestPaid), is.total_revenue ? `${Math.round((interestPaid / is.total_revenue) * 1000) / 10}% of revenue` : "") : metricCard("Working Capital", fmt(wc), "")}
        ${gpInterestRatio != null ? metricCard("Interest / GP%", `${gpInterestRatio}%`, gpInterestRatio > 20 ? "Unsustainable" : "Manageable", gpInterestRatio > 20 ? RED : GREEN) : metricCard("Current Ratio", kpi.current_ratio ? kpi.current_ratio.toString() : "—", "")}
        ${dlas.length ? metricCard("DLA Balances", fmt(totalDLA), totalDLA < totalDLAOpen ? `↓ ${fmt(totalDLAOpen - totalDLA)} — reducing` : "", totalDLA < totalDLAOpen ? GREEN : AMBER) : metricCard("Total Assets", fmt(bs.total_assets), "")}
      </div>

      <table style="width:100%;border-collapse:collapse;font-size:11px;">
        <thead>
          <tr style="background:${NAVY};">
            <th style="padding:7px 10px;color:#fff;text-align:left;font-weight:600;font-size:10.5px;">Metric</th>
            <th style="padding:7px 10px;color:#fff;text-align:left;font-weight:600;font-size:10.5px;">This Period</th>
            <th style="padding:7px 10px;color:#fff;text-align:left;font-weight:600;font-size:10.5px;">Prior Period</th>
            <th style="padding:7px 10px;color:#fff;text-align:left;font-weight:600;font-size:10.5px;">Target</th>
            <th style="padding:7px 10px;color:#fff;text-align:left;font-weight:600;font-size:10.5px;">Status</th>
          </tr>
        </thead>
        <tbody>${scRows}</tbody>
      </table>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:12px;">
        <div style="background:#F0FDF9;border:1px solid #CCFBF1;border-radius:7px;padding:11px 14px;">
          <p style="font-size:10px;font-weight:700;color:${TEAL};margin:0 0 7px;text-transform:uppercase;letter-spacing:.5px;">● Trading improving</p>
          ${goingWell.length ? goingWell.slice(0,3).map(w => `<p style="font-size:10.5px;color:#374151;margin:0 0 4px;padding-left:8px;border-left:2px solid ${TEAL};">${w}</p>`).join("") : `<p style="font-size:10.5px;color:${MID_GREY};">—</p>`}
        </div>
        <div style="background:#FFF7F7;border:1px solid #FECACA;border-radius:7px;padding:11px 14px;">
          <p style="font-size:10px;font-weight:700;color:${RED};margin:0 0 7px;text-transform:uppercase;letter-spacing:.5px;">● Priority action</p>
          ${concerns.length ? concerns.slice(0,3).map(c => `<p style="font-size:10.5px;color:#374151;margin:0 0 4px;padding-left:8px;border-left:2px solid ${RED};">${c}</p>`).join("") : `<p style="font-size:10.5px;color:${MID_GREY};">—</p>`}
        </div>
      </div>
    </div>`;
}

// ── PAGE 3: PROFITABILITY ──────────────────────────────────────────────────────
function renderProfitability(report: any, client: any): string {
  const fd   = report.financialData || {};
  const is   = fd.income_statement  || {};
  const cosDetail: any[]     = fd.cost_of_sales_detail  || [];
  const revenueStreams: any[] = fd.revenue_streams       || [];
  const overheadItems: any[] = fd.overhead_breakdown    || [];
  const grantIncome: any[]   = fd.grant_income          || [];
  const breakeven: any       = fd.breakeven             || {};

  const q1 = getQuestionAnswer(report, 1);
  const verdict  = q1?.verdict || report.aiThreeCoreQuestions?.profitability_verdict || "";
  const findings: string[] = q1?.key_findings || [];

  const totalGrant = grantIncome.reduce((s: number, g: any) => s + (g.amount || 0), 0);

  // Revenue by stream chart — use fd.revenue_streams first, fall back to income_statement.revenue_breakdown
  const streamData = revenueStreams.length > 0
    ? revenueStreams
    : (is.revenue_breakdown || []).map((r: any) => ({ name: r.name, this_period: r.amount, prior_period: null }));
  const streamChart = streamData.length > 0 ? buildVBarChart(streamData, 110) : "";

  // P&L waterfall bar chart — always render when income statement has data
  const hasIsData = (is.total_revenue || 0) > 0 || (is.gross_profit || 0) !== 0;
  const plWaterfallChart = hasIsData ? buildPlWaterfallSvg(is, totalGrant) : "";

  // P&L summary table (like reference — with prior + % rev + note)
  const plRows: Array<{ label: string; val: number | null; prior: number | null; note: string; bold?: boolean; indent?: boolean }> = [
    { label: "Revenue",         val: is.total_revenue,    prior: is.prior_revenue,    note: is.prior_revenue ? `${Math.round(((is.total_revenue - is.prior_revenue) / is.prior_revenue) * 100) > 0 ? "+" : ""}${Math.round(((is.total_revenue - is.prior_revenue) / is.prior_revenue) * 100)}%` : "" },
    ...cosDetail.map((c: any) => ({ label: c.name || c.category || "CoS", val: c.this_period ?? c.amount, prior: c.prior_period ?? null, note: c.note || "", indent: true })),
    { label: "Gross Profit",    val: is.gross_profit,     prior: is.prior_gp,         note: is.gross_margin_pct != null ? `GP% ${is.gross_margin_pct}%` : "", bold: true },
    { label: "Total Overhead",  val: is.total_expenses,   prior: is.prior_expenses,   note: overheadItems.length ? overheadItems.slice(0,2).map((o:any) => o.category).join(" + ") : "" },
    { label: "Operating Profit", val: is.operating_profit, prior: is.prior_op_profit, note: is.operating_margin_pct != null ? `${is.operating_margin_pct}% margin` : "", bold: true },
    ...(totalGrant ? [{ label: "Grant Income", val: totalGrant, prior: null, note: "Non-recurring — cannot be relied upon" }] : []),
    { label: "Net Profit",       val: is.net_profit,      prior: is.prior_net_profit, note: is.net_margin_pct != null ? `${is.net_margin_pct}% margin` : "", bold: true },
  ].filter(r => r.val != null);

  const plTableRows = plRows.map((r, i) => {
    const pct = is.total_revenue && r.val ? Math.round((Math.abs(r.val) / is.total_revenue) * 1000) / 10 : null;
    const isNeg = (r.val || 0) < 0;
    return `<tr style="background:${r.bold ? GREY_BG : i % 2 === 0 ? "#fff" : "#FAFAFA"};">
      <td style="padding:7px 10px;font-size:11px;color:#374151;${r.bold ? "font-weight:700;" : ""}${r.indent ? "padding-left:22px;color:" + MID_GREY + ";" : ""}">${r.label}</td>
      <td style="padding:7px 10px;font-size:11px;font-weight:${r.bold ? "700" : "600"};color:${isNeg ? RED : "#111"};text-align:right;">${fmt(r.val)}</td>
      <td style="padding:7px 10px;font-size:11px;color:${MID_GREY};text-align:right;">${r.prior != null ? `${pct != null ? pct + "%" : ""}` : ""}</td>
      <td style="padding:7px 10px;font-size:11px;color:${MID_GREY};text-align:right;">${r.prior != null ? fmt(r.prior) : "—"}</td>
      <td style="padding:7px 10px;font-size:11px;color:${MID_GREY};">${r.note}</td>
    </tr>`;
  }).join("");

  return `
    <div style="padding:20px 40px 16px;">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px;">
        <div style="background:${NAVY};color:#fff;width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;flex-shrink:0;">1</div>
        <div>
          <p style="margin:0;font-size:9.5px;color:${MID_GREY};text-transform:uppercase;letter-spacing:1px;">How Profitable Are We?</p>
          <h2 style="margin:0;font-size:17px;font-weight:800;color:${NAVY};">Revenue, gross margin, and overhead analysis</h2>
        </div>
      </div>

      ${verdict ? `<div style="background:#F0FAFA;border-left:4px solid ${TEAL};border-radius:6px;padding:11px 16px;margin-bottom:12px;">
        <p style="margin:0;font-size:12px;color:#0F4C45;line-height:1.6;">${verdict}</p>
        ${findings.slice(0,2).map(f => `<p style="margin:4px 0 0;font-size:11px;color:#374151;padding-left:10px;border-left:2px solid ${TEAL};">${f}</p>`).join("")}
      </div>` : ""}

      ${plWaterfallChart ? `
      <p style="font-size:9.5px;font-weight:700;color:${MID_GREY};text-transform:uppercase;letter-spacing:.5px;margin:0 0 6px;">Gross Profit Trend &amp; Overhead Breakdown</p>
      <div style="margin-bottom:12px;overflow:hidden;">${plWaterfallChart}</div>` : ""}

      ${streamChart ? `
      <p style="font-size:9.5px;font-weight:700;color:${MID_GREY};text-transform:uppercase;letter-spacing:.5px;margin:0 0 6px;">Revenue by Stream</p>
      <div style="margin-bottom:12px;overflow:hidden;">${streamChart}</div>` : ""}

      <p style="font-size:9.5px;font-weight:700;color:${MID_GREY};text-transform:uppercase;letter-spacing:.5px;margin:0 0 6px;">Cost of Sales &amp; Key Metrics</p>
      <table style="width:100%;border-collapse:collapse;margin-bottom:${breakeven.note ? "10px" : "0"};">
        <thead>
          <tr style="background:${NAVY};">
            <th style="padding:7px 10px;font-size:10.5px;color:#fff;text-align:left;font-weight:600;width:28%;">Line Item</th>
            <th style="padding:7px 10px;font-size:10.5px;color:#fff;text-align:right;font-weight:600;width:16%;">This Period</th>
            <th style="padding:7px 10px;font-size:10.5px;color:#fff;text-align:right;font-weight:600;width:12%;">% Revenue</th>
            <th style="padding:7px 10px;font-size:10.5px;color:#fff;text-align:right;font-weight:600;width:16%;">Prior Period</th>
            <th style="padding:7px 10px;font-size:10.5px;color:#fff;text-align:left;font-weight:600;">Note</th>
          </tr>
        </thead>
        <tbody>${plTableRows || `<tr><td colspan="5" style="padding:12px;font-size:11px;color:${MID_GREY};text-align:center;">Enter financial data to populate this section.</td></tr>`}</tbody>
      </table>

      ${breakeven.note ? `
      <div style="background:#FFF8E1;border-left:4px solid ${AMBER};border-radius:5px;padding:10px 14px;display:flex;gap:10px;align-items:flex-start;">
        <p style="margin:0;font-size:10px;font-weight:700;color:${AMBER};text-transform:uppercase;min-width:64px;">Breakeven</p>
        <p style="margin:0;font-size:11px;color:#374151;line-height:1.55;">${breakeven.note}</p>
      </div>` : ""}
    </div>`;
}

// ── PAGE 4: CAPITAL ────────────────────────────────────────────────────────────
function renderCapital(report: any, client: any): string {
  const fd   = report.financialData || {};
  const bs   = fd.balance_sheet     || {};
  const cf   = fd.cashflow          || {};
  const is   = fd.income_statement  || {};
  const dlas: any[] = fd.director_loan_accounts || [];
  const grantIncome: any[] = fd.grant_income || [];
  const totalGrant = grantIncome.reduce((s: number, g: any) => s + (g.amount || 0), 0);

  // Use explicit cashflow_waterfall if provided, otherwise build from basic cashflow + IS data
  const rawWf = fd.cashflow_waterfall;
  const wf = rawWf || (cf.opening_balance != null ? {
    opening_cash: cf.opening_balance,
    gp_earned: is.gross_profit || 0,
    overheads_paid: is.total_expenses || 0,
    debt_service: 0,
    grant_received: totalGrant,
    asset_purchases: 0,
    working_capital_movement: 0,
    closing_cash: cf.closing_balance || 0,
  } : null);

  const q2 = getQuestionAnswer(report, 2);
  const verdict  = q2?.verdict || report.aiThreeCoreQuestions?.capital_verdict || "";
  const findings: string[] = q2?.key_findings || [];
  const watchPoints: string[] = report.aiWatchPoints || [];

  // Balance sheet movement table like reference (open, close, movement, RAG)
  const bsLines = [
    { label: "Fixed Assets",      open: bs.prior_fixed_assets,             close: bs.fixed_assets || bs.non_current_assets, goodUp: true  },
    { label: "Cash",              open: bs.prior_cash || null,             close: bs.cash,                                   goodUp: true  },
    { label: "Debtors",           open: bs.prior_debtors,                  close: bs.debtors || bs.trade_debtors,            goodUp: true  },
    { label: "Stock",             open: bs.prior_stock,                    close: bs.stock,                                  goodUp: true  },
    { label: "Prepayments",       open: bs.prior_prepayments,              close: bs.prepayments,                            goodUp: false },
    { label: "Current Assets",    open: bs.prior_current_assets,           close: bs.current_assets,                         goodUp: true  },
    { label: "Current Liabilities", open: bs.prior_current_liabilities,   close: bs.current_liabilities,                    goodUp: false },
    { label: "Working Capital",   open: bs.prior_working_capital,          close: (bs.current_assets || 0) - (bs.current_liabilities || 0), goodUp: true },
    { label: "LT Debt",           open: bs.prior_lt_debt,                  close: bs.lt_debt || bs.total_debt,               goodUp: false },
    { label: "Net Assets",        open: bs.prior_net_assets,               close: bs.net_assets,                             goodUp: true  },
  ].filter(r => r.close != null && r.close !== 0);

  const bsRows = bsLines.map((r, i) => {
    const movement = (r.open != null && r.close != null) ? r.close - r.open : null;
    const isNegClose = (r.close || 0) < 0;
    const isNegMove  = (movement || 0) < 0;
    const rag = movement == null ? "grey" : (r.goodUp ? movement >= 0 : movement <= 0) ? "green" : movement === 0 ? "amber" : "red";
    const ragC = rag === "green" ? GREEN : rag === "red" ? RED : AMBER;
    return `<tr style="background:${i % 2 === 0 ? "#fff" : GREY_BG};">
      <td style="padding:7px 10px;font-size:11px;color:#374151;">${r.label}</td>
      <td style="padding:7px 10px;font-size:11px;color:${MID_GREY};text-align:right;">${r.open != null ? fmt(r.open) : "—"}</td>
      <td style="padding:7px 10px;font-size:11px;font-weight:600;color:${isNegClose ? RED : "#111"};text-align:right;">${fmt(r.close)}</td>
      <td style="padding:7px 10px;font-size:11px;color:${isNegMove ? RED : GREEN};text-align:right;">${movement != null ? (movement > 0 ? `+${fmt(movement)}` : fmt(movement)) : "—"}</td>
      <td style="padding:7px 10px;"><span style="display:inline-flex;align-items:center;gap:4px;font-size:10px;color:${ragC};font-weight:600;">
        <span style="width:9px;height:9px;border-radius:50%;background:${ragC};display:inline-block;"></span>${ragLabel(rag)}
      </span></td>
    </tr>`;
  }).join("");

  const dlaRows = dlas.map((d: any, i: number) => {
    const movement = (d.close_balance || 0) - (d.open_balance || 0);
    const reducing = d.direction === "owed_to_company" ? movement < 0 : movement > 0;
    return `<tr style="background:${i % 2 === 0 ? "#fff" : GREY_BG};">
      <td style="padding:7px 10px;font-size:11px;color:#374151;">${d.name || "—"}</td>
      <td style="padding:7px 10px;font-size:11px;color:${MID_GREY};text-align:right;">${fmt(d.open_balance)} <span style="font-size:9.5px;">${d.direction === "owed_to_company" ? "owed to Co." : "owed by Co."}</span></td>
      <td style="padding:7px 10px;font-size:11px;font-weight:600;text-align:right;">${fmt(d.close_balance)} <span style="font-size:9.5px;">${d.direction === "owed_to_company" ? "owed to Co." : "owed by Co."}</span></td>
      <td style="padding:7px 10px;font-size:11px;color:${movement > 0 ? RED : GREEN};text-align:right;">${movement > 0 ? `+${fmt(movement)}` : fmt(movement)}</td>
      <td style="padding:7px 10px;font-size:11px;color:${reducing ? GREEN : AMBER};">${d.status || (reducing ? "Reducing ✓" : "Watch")}</td>
    </tr>`;
  }).join("");

  const totalDLAOpen = dlas.reduce((s: number, d: any) => s + (d.open_balance || 0), 0);
  const totalDLAClose = dlas.reduce((s: number, d: any) => s + (d.close_balance || 0), 0);

  return `
    <div style="padding:20px 40px 16px;">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px;">
        <div style="background:${NAVY};color:#fff;width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;flex-shrink:0;">2</div>
        <div>
          <p style="margin:0;font-size:9.5px;color:${MID_GREY};text-transform:uppercase;letter-spacing:1px;">Is Our Capital Deployed Correctly?</p>
          <h2 style="margin:0;font-size:17px;font-weight:800;color:${NAVY};">Balance sheet movement, working capital, assets</h2>
        </div>
      </div>

      ${verdict ? `<div style="background:#EFF6FF;border-left:4px solid ${BLUE};border-radius:6px;padding:10px 14px;margin-bottom:12px;">
        <p style="margin:0;font-size:12px;color:#1E40AF;line-height:1.6;">${verdict}</p>
        ${findings.slice(0,2).map(f => `<p style="margin:4px 0 0;font-size:11px;color:#374151;padding-left:10px;border-left:2px solid ${BLUE};">${f}</p>`).join("")}
      </div>` : ""}

      ${wf ? `
      <p style="font-size:9.5px;font-weight:700;color:${MID_GREY};text-transform:uppercase;letter-spacing:.5px;margin:0 0 6px;">Cash Movement</p>
      <div style="margin-bottom:12px;">${buildCashWaterfallSvg(wf)}</div>` : ""}

      ${bsLines.length ? `
      <p style="font-size:9.5px;font-weight:700;color:${MID_GREY};text-transform:uppercase;letter-spacing:.5px;margin:0 0 6px;">Balance Sheet Movement</p>
      <table style="width:100%;border-collapse:collapse;margin-bottom:12px;">
        <thead>
          <tr style="background:${NAVY};">
            <th style="padding:7px 10px;font-size:10.5px;color:#fff;text-align:left;font-weight:600;"></th>
            <th style="padding:7px 10px;font-size:10.5px;color:#fff;text-align:right;font-weight:600;">Opening</th>
            <th style="padding:7px 10px;font-size:10.5px;color:#fff;text-align:right;font-weight:600;">Closing</th>
            <th style="padding:7px 10px;font-size:10.5px;color:#fff;text-align:right;font-weight:600;">Movement</th>
            <th style="padding:7px 10px;font-size:10.5px;color:#fff;text-align:left;font-weight:600;">RAG</th>
          </tr>
        </thead>
        <tbody>${bsRows}</tbody>
      </table>` : `<p style="font-size:11px;color:${MID_GREY};margin-bottom:12px;">No balance sheet data entered — populate the data entry form to see this section.</p>`}

      ${dlas.length ? `
      <p style="font-size:9.5px;font-weight:700;color:${MID_GREY};text-transform:uppercase;letter-spacing:.5px;margin:0 0 6px;">Director Loan Accounts</p>
      <table style="width:100%;border-collapse:collapse;">
        <thead>
          <tr style="background:${NAVY};">
            <th style="padding:7px 10px;font-size:10.5px;color:#fff;text-align:left;font-weight:600;">Director</th>
            <th style="padding:7px 10px;font-size:10.5px;color:#fff;text-align:right;font-weight:600;">Opening Balance</th>
            <th style="padding:7px 10px;font-size:10.5px;color:#fff;text-align:right;font-weight:600;">Closing Balance</th>
            <th style="padding:7px 10px;font-size:10.5px;color:#fff;text-align:right;font-weight:600;">Movement</th>
            <th style="padding:7px 10px;font-size:10.5px;color:#fff;text-align:left;font-weight:600;">Status</th>
          </tr>
        </thead>
        <tbody>
          ${dlaRows}
          ${dlas.length > 1 ? `<tr style="background:${GREY_BG};border-top:2px solid ${BORDER};">
            <td style="padding:7px 10px;font-size:11px;font-weight:700;color:${NAVY};">Total</td>
            <td style="padding:7px 10px;font-size:11px;font-weight:700;text-align:right;">${fmt(totalDLAOpen)}</td>
            <td style="padding:7px 10px;font-size:11px;font-weight:700;text-align:right;">${fmt(totalDLAClose)}</td>
            <td style="padding:7px 10px;font-size:11px;font-weight:700;color:${totalDLAClose < totalDLAOpen ? GREEN : RED};text-align:right;">${totalDLAClose < totalDLAOpen ? `-${fmt(totalDLAOpen - totalDLAClose)}` : `+${fmt(totalDLAClose - totalDLAOpen)}`}</td>
            <td></td>
          </tr>` : ""}
        </tbody>
      </table>` : ""}

      ${watchPoints.length ? `
      <div style="background:#FFF8E1;border-left:4px solid ${AMBER};border-radius:5px;padding:9px 14px;margin-top:10px;">
        <p style="margin:0 0 4px;font-size:10px;font-weight:700;color:${AMBER};text-transform:uppercase;">New Assets</p>
        <p style="margin:0;font-size:11px;color:#374151;line-height:1.5;">${watchPoints[0]}</p>
      </div>` : ""}
    </div>`;
}

// ── PAGE 5: BORROWING ──────────────────────────────────────────────────────────
function renderBorrowing(report: any, client: any): string {
  const fd = report.financialData || {};
  const debtSchedule: any[] = fd.debt_schedule || [];
  const is = fd.income_statement || {};

  const q3 = getQuestionAnswer(report, 3);
  const verdict  = q3?.verdict || report.aiThreeCoreQuestions?.borrowing_verdict || "";
  const findings: string[] = q3?.key_findings || [];
  const watchPoints: string[] = report.aiWatchPoints || [];

  const totalOpen  = debtSchedule.reduce((s: number, d: any) => s + (d.open_balance || 0), 0);
  const totalClose = debtSchedule.reduce((s: number, d: any) => s + (d.close_balance || 0), 0);
  const totalMove  = totalClose - totalOpen;

  const newFacilities = debtSchedule.filter((d: any) => d.is_new_this_period || (!d.open_balance && d.close_balance));

  const debtRows = debtSchedule.map((d: any, i: number) => {
    const movement = (d.close_balance || 0) - (d.open_balance || 0);
    const isNew = d.is_new_this_period || (!d.open_balance && d.close_balance);
    const rag = d.rag || "amber";
    const ragC = rag === "red" ? RED : rag === "amber" ? AMBER : GREEN;
    return `<tr style="background:${isNew ? "#FEF2F2" : i % 2 === 0 ? "#fff" : GREY_BG};">
      <td style="padding:7px 10px;font-size:11px;color:#111;font-weight:500;">${d.facility || "—"}${isNew ? ` <span style="font-size:9.5px;color:${RED};font-weight:700;">NEW this period</span>` : ""}</td>
      <td style="padding:7px 10px;font-size:11px;color:${MID_GREY};text-align:right;">${d.open_balance ? fmt(d.open_balance) : "—"}</td>
      <td style="padding:7px 10px;font-size:11px;font-weight:600;text-align:right;">${fmt(d.close_balance)}</td>
      <td style="padding:7px 10px;font-size:11px;color:#374151;">${d.type || "—"}</td>
      <td style="padding:7px 10px;"><span style="display:inline-flex;align-items:center;gap:3px;font-size:10px;font-weight:600;color:${ragC};">
        <span style="width:9px;height:9px;border-radius:50%;background:${ragC};display:inline-block;"></span>${ragLabel(rag)}
      </span></td>
    </tr>`;
  }).join("");

  return `
    <div style="padding:20px 40px 16px;">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px;">
        <div style="background:${NAVY};color:#fff;width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;flex-shrink:0;">3</div>
        <div>
          <p style="margin:0;font-size:9.5px;color:${MID_GREY};text-transform:uppercase;letter-spacing:1px;">Can / Should We Look to Borrow More?</p>
          <h2 style="margin:0;font-size:17px;font-weight:800;color:${NAVY};">Debt position, interest burden, serviceability</h2>
        </div>
      </div>

      ${verdict ? `
      <div style="background:${NAVY};border-radius:8px;padding:14px 18px;margin-bottom:14px;display:flex;gap:12px;">
        <p style="margin:0;font-size:10px;font-weight:700;color:${TEAL};text-transform:uppercase;min-width:56px;padding-top:2px;">VERDICT</p>
        <p style="margin:0;font-size:12px;color:rgba(255,255,255,0.92);line-height:1.65;">${verdict}
          ${findings.map(f => `<br/><span style="font-size:11px;color:rgba(255,255,255,0.65);">· ${f}</span>`).join("")}
        </p>
      </div>` : ""}

      ${debtSchedule.length ? `
      <div style="display:flex;gap:10px;margin-bottom:12px;">
        <div style="background:${GREY_BG};border:1px solid ${BORDER};border-radius:7px;padding:10px 14px;flex:1;text-align:center;">
          <p style="margin:0 0 2px;font-size:9px;color:${MID_GREY};text-transform:uppercase;letter-spacing:.5px;">Opening Debt</p>
          <p style="margin:0;font-size:17px;font-weight:700;color:${NAVY};">${fmtK(totalOpen)}</p>
        </div>
        <div style="background:${GREY_BG};border:1px solid ${BORDER};border-radius:7px;padding:10px 14px;flex:1;text-align:center;">
          <p style="margin:0 0 2px;font-size:9px;color:${MID_GREY};text-transform:uppercase;letter-spacing:.5px;">Closing Debt</p>
          <p style="margin:0;font-size:17px;font-weight:700;color:${NAVY};">${fmtK(totalClose)}</p>
        </div>
        <div style="background:${totalMove > 0 ? "#FEF2F2" : "#F0FDF9"};border:1px solid ${totalMove > 0 ? "#FECACA" : "#CCFBF1"};border-radius:7px;padding:10px 14px;flex:1;text-align:center;">
          <p style="margin:0 0 2px;font-size:9px;color:${MID_GREY};text-transform:uppercase;letter-spacing:.5px;">Net Movement</p>
          <p style="margin:0;font-size:17px;font-weight:700;color:${totalMove > 0 ? RED : GREEN};">${totalMove > 0 ? "+" : ""}${fmtK(totalMove)}</p>
        </div>
        ${newFacilities.length ? `
        <div style="background:#FEF2F2;border:1px solid #FECACA;border-radius:7px;padding:10px 14px;flex:1;text-align:center;">
          <p style="margin:0 0 2px;font-size:9px;color:${MID_GREY};text-transform:uppercase;letter-spacing:.5px;">New Facilities</p>
          <p style="margin:0;font-size:17px;font-weight:700;color:${RED};">${newFacilities.length}</p>
        </div>` : ""}
      </div>

      <p style="font-size:9.5px;font-weight:700;color:${MID_GREY};text-transform:uppercase;letter-spacing:.5px;margin:0 0 6px;">Debt Breakdown &amp; Schedule</p>
      <table style="width:100%;border-collapse:collapse;margin-bottom:12px;">
        <thead>
          <tr style="background:${NAVY};">
            <th style="padding:7px 10px;font-size:10.5px;color:#fff;text-align:left;font-weight:600;width:30%;">Facility</th>
            <th style="padding:7px 10px;font-size:10.5px;color:#fff;text-align:right;font-weight:600;width:18%;">Open Balance</th>
            <th style="padding:7px 10px;font-size:10.5px;color:#fff;text-align:right;font-weight:600;width:18%;">Close Balance</th>
            <th style="padding:7px 10px;font-size:10.5px;color:#fff;text-align:left;font-weight:600;width:20%;">Type</th>
            <th style="padding:7px 10px;font-size:10.5px;color:#fff;text-align:left;font-weight:600;width:14%;">RAG</th>
          </tr>
        </thead>
        <tbody>
          ${debtRows}
          <tr style="background:${GREY_BG};border-top:2px solid ${BORDER};">
            <td style="padding:7px 10px;font-size:11px;font-weight:700;color:${NAVY};">TOTAL (excl DLA)</td>
            <td style="padding:7px 10px;font-size:11px;font-weight:700;text-align:right;">~${fmtK(totalOpen)}</td>
            <td style="padding:7px 10px;font-size:11px;font-weight:700;text-align:right;">${fmtK(totalClose)}</td>
            <td colspan="2"></td>
          </tr>
        </tbody>
      </table>` : `<p style="font-size:12px;color:${MID_GREY};margin:8px 0;">No debt schedule entered for this period.</p>`}

      ${watchPoints.length > 0 ? `
      <div style="background:#FFF8E1;border-left:4px solid ${AMBER};border-radius:5px;padding:10px 14px;">
        <p style="margin:0 0 4px;font-size:10px;font-weight:700;color:${AMBER};text-transform:uppercase;letter-spacing:.5px;">Watch Points</p>
        ${watchPoints.map((w: string) => `<p style="margin:0 0 4px;font-size:11px;color:#374151;line-height:1.5;">· ${w}</p>`).join("")}
      </div>` : ""}
    </div>`;
}

// ── PAGE 6: ACTIONS & DISCUSSION ───────────────────────────────────────────────
function renderActions(report: any, client: any): string {
  const actions: any[]       = report.aiActionSteps || [];
  const discussion: string[] = report.aiDiscussionPoints || [];
  const nextMetrics: any[]   = report.financialData?.next_period_metrics || [];
  const nextFocus: string    = report.aiNextPeriodFocus || "";
  const period               = report.period || {};

  const priorityC = (p: string) => p === "high" || p === "red" ? RED : p === "medium" || p === "amber" ? AMBER : "#9CA3AF";

  const actionCards = actions.map((a: any, i: number) => {
    const c = priorityC(a.priority);
    return `
    <div style="display:flex;align-items:flex-start;gap:10px;background:#fff;border:1px solid ${BORDER};border-left:5px solid ${c};border-radius:6px;padding:11px 14px;margin-bottom:8px;">
      <div style="background:${NAVY};color:#fff;width:22px;height:22px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;flex-shrink:0;line-height:22px;text-align:center;">${i + 1}</div>
      <div style="flex:1;">
        <p style="margin:0 0 3px;font-size:12.5px;font-weight:600;color:#111;">${a.action}</p>
        ${a.why ? `<p style="margin:0;font-size:11px;color:#374151;line-height:1.45;">${a.why}</p>` : ""}
        ${a.metricImpact ? `<p style="margin:3px 0 0;font-size:11px;color:${TEAL};font-weight:500;">Impact: ${a.metricImpact}</p>` : ""}
        ${a.linksToGoal ? `<span style="display:inline-block;margin-top:4px;background:#F0FAFA;color:${TEAL};font-size:9.5px;padding:2px 9px;border-radius:99px;border:1px solid #CCFBF1;">🎯 ${a.linksToGoal}</span>` : ""}
      </div>
    </div>`;
  }).join("");

  const ragC = (r: string) => r === "red" ? RED : r === "amber" ? AMBER : GREEN;

  const metricRows = nextMetrics.map((m: any, i: number) => `
    <tr style="background:${i % 2 === 0 ? "#fff" : GREY_BG};">
      <td style="padding:7px 10px;font-size:11px;font-weight:500;color:#111;">${m.metric}</td>
      <td style="padding:7px 10px;font-size:11px;color:#374151;">${m.why || "—"}</td>
      <td style="padding:7px 10px;"><span style="display:inline-flex;align-items:center;gap:4px;font-size:10px;font-weight:600;color:${ragC(m.priority || "amber")};">
        <span style="width:9px;height:9px;border-radius:50%;background:${ragC(m.priority || "amber")};display:inline-block;"></span>${ragLabel(m.priority || "amber")}
      </span></td>
    </tr>`).join("");

  return `
    <div style="padding:20px 40px 16px;">
      <div style="background:${NAVY};padding:12px 20px;border-radius:6px;margin-bottom:14px;display:flex;justify-content:space-between;align-items:center;">
        <div>
          <p style="margin:0;font-size:9.5px;color:rgba(255,255,255,0.5);text-transform:uppercase;letter-spacing:1px;">Actions &amp; Focus</p>
          <h2 style="margin:0;font-size:17px;font-weight:800;color:#fff;">Key priorities coming out of this review</h2>
        </div>
        <p style="font-size:11px;color:rgba(255,255,255,0.5);margin:0;">${client.companyName || client.clientName}</p>
      </div>

      ${actions.length ? `
      <p style="font-size:9.5px;font-weight:700;color:${MID_GREY};text-transform:uppercase;letter-spacing:.5px;margin:0 0 8px;">Recommended Actions for Next Period</p>
      ${actionCards}` : ""}

      ${discussion.length ? `
      <p style="font-size:9.5px;font-weight:700;color:${MID_GREY};text-transform:uppercase;letter-spacing:.5px;margin:10px 0 7px;">Discussion Points</p>
      ${discussion.map((p: string, i: number) => `
        <div style="display:flex;align-items:flex-start;gap:10px;padding:10px 12px;background:${GREY_BG};border-radius:7px;margin-bottom:6px;">
          <div style="background:${TEAL};color:#fff;width:20px;height:20px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;flex-shrink:0;">${i + 1}</div>
          <p style="margin:0;font-size:11.5px;color:#374151;line-height:1.45;">${p}</p>
        </div>`).join("")}` : ""}

      ${nextMetrics.length ? `
      <p style="font-size:9.5px;font-weight:700;color:${MID_GREY};text-transform:uppercase;letter-spacing:.5px;margin:10px 0 7px;">Metrics to Introduce Next Period</p>
      <table style="width:100%;border-collapse:collapse;margin-bottom:10px;">
        <thead>
          <tr style="background:${NAVY};">
            <th style="padding:7px 10px;font-size:10.5px;color:#fff;text-align:left;font-weight:600;width:30%;">Metric</th>
            <th style="padding:7px 10px;font-size:10.5px;color:#fff;text-align:left;font-weight:600;">Why</th>
            <th style="padding:7px 10px;font-size:10.5px;color:#fff;text-align:left;font-weight:600;width:14%;">Priority</th>
          </tr>
        </thead>
        <tbody>${metricRows}</tbody>
      </table>` : ""}

      ${(nextFocus || period.nextPeriodLabel) ? `
      <div style="background:#F0FAFA;border:1px solid #CCFBF1;border-radius:7px;padding:12px 16px;">
        <p style="font-size:10px;font-weight:700;color:${TEAL};text-transform:uppercase;letter-spacing:.5px;margin:0 0 5px;">Next Period Focus</p>
        ${period.nextPeriodLabel ? `<p style="margin:0 0 3px;font-size:11px;color:${NAVY};font-weight:600;">${period.nextPeriodLabel}</p>` : ""}
        ${nextFocus ? `<p style="margin:0;font-size:11px;color:#374151;line-height:1.5;">${nextFocus}</p>` : ""}
      </div>` : ""}
    </div>`;
}

// ── HELPERS ────────────────────────────────────────────────────────────────────
function getCoreQuestions(report: any, structure: any): any[] {
  if (report.aiCoreQuestionAnswers?.length) return report.aiCoreQuestionAnswers;
  if (structure?.coreQuestions?.length) return structure.coreQuestions;
  return [
    { question_number: 1, question: "How profitable are we?",              focus: "profitability" },
    { question_number: 2, question: "Is our capital deployed correctly?",   focus: "capital" },
    { question_number: 3, question: "Can / should we look to borrow more?", focus: "borrowing" },
  ];
}

function getQuestionAnswer(report: any, num: number): any {
  const answers: any[] = report.aiCoreQuestionAnswers || [];
  return answers.find(a => a.question_number === num) || null;
}

function fmtDateLong(s: string | undefined | null): string {
  if (!s) return "";
  try {
    const d = new Date(s);
    const months = ["January","February","March","April","May","June","July","August","September","October","November","December"];
    const days = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
    return `${days[d.getUTCDay()]} ${d.getUTCDate()} ${months[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
  } catch { return s; }
}

// ── MAIN EXPORT ────────────────────────────────────────────────────────────────
export function generateReportHTML(report: any, client: any, structure: any): string {
  const periodLabel  = report.period?.periodLabel || (report as any).periodLabel || "";
  const companyName  = client.companyName || client.clientName || "Client";
  const totalPages   = 6;

  const pages = [
    page(renderCover(report, client, structure, periodLabel),   companyName, periodLabel, 1, totalPages),
    page(renderDashboard(report, client),                       companyName, periodLabel, 2, totalPages),
    page(renderProfitability(report, client),                   companyName, periodLabel, 3, totalPages),
    page(renderCapital(report, client),                         companyName, periodLabel, 4, totalPages),
    page(renderBorrowing(report, client),                       companyName, periodLabel, 5, totalPages),
    page(renderActions(report, client),                         companyName, periodLabel, 6, totalPages),
  ];

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>MI Pack — ${companyName}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
    background: #e5e7eb;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  @media print {
    body { background: #fff; }
    .rpt-page { page-break-after: always; }
  }
</style>
</head>
<body>
${pages.map(p => `<div class="rpt-page" style="margin:0 auto 8px;box-shadow:0 2px 8px rgba(0,0,0,0.1);">${p}</div>`).join("\n")}
</body>
</html>`;
}

// Legacy stubs — keep for any remaining import consumers
export { renderActionCards, renderDiscussionPoints, renderMetricCards, renderScorecardTable, renderBarChart, renderCoreQuestionSection, renderGoalTracker, renderDebtSchedule, renderBenchmarkComparison, renderVerdictBox };
function renderActionCards(_: any[]): string { return ""; }
function renderDiscussionPoints(_: string[]): string { return ""; }
function renderMetricCards(_: any[]): string { return ""; }
function renderScorecardTable(_: any[]): string { return ""; }
function renderBarChart(_: any[], __: any): string { return ""; }
function renderCoreQuestionSection(_: any): string { return ""; }
function renderGoalTracker(_: any[]): string { return ""; }
function renderDebtSchedule(_: any[]): string { return ""; }
function renderBenchmarkComparison(_: any[], __: any[]): string { return ""; }
function renderVerdictBox(_: string, __: string): string { return ""; }
