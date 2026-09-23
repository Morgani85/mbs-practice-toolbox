import { PDFDocument, rgb, StandardFonts, PDFFont, PDFPage } from "pdf-lib";

// ─── Sanitise — replace all non-WinAnsi characters ────────────────────────────
function san(text: string): string {
  if (!text) return "";
  return text
    .replace(/≥/g, ">=").replace(/≤/g, "<=").replace(/→/g, "->").replace(/←/g, "<-")
    .replace(/•/g, "-").replace(/·/g, "-").replace(/×/g, "x").replace(/÷/g, "/")
    .replace(/≠/g, "!=").replace(/±/g, "+/-").replace(/²/g, "^2").replace(/³/g, "^3")
    .replace(/½/g, "1/2").replace(/¼/g, "1/4").replace(/¾/g, "3/4")
    .replace(/…/g, "...").replace(/–/g, "-").replace(/—/g, "-")
    .replace(/\u2018/g, "'").replace(/\u2019/g, "'")
    .replace(/\u201C/g, '"').replace(/\u201D/g, '"')
    .replace(/\u00A0/g, " ").replace(/[^\x00-\xFF]/g, "?");
}

// ─── Formatters ───────────────────────────────────────────────────────────────
function fmt(n: number | undefined | null): string {
  if (n == null || isNaN(n as number)) return "-";
  const abs = Math.round(Math.abs(n as number)).toLocaleString("en-GB");
  return (n as number) < 0 ? `(£${abs})` : `£${abs}`;
}
function fmtPct(n: number | undefined | null): string {
  if (n == null) return "-";
  return `${n}%`;
}
function fmtDate(s: string | undefined): string {
  if (!s) return "";
  try {
    const d = new Date(s);
    const months = ["January","February","March","April","May","June","July","August","September","October","November","December"];
    return `${d.getUTCDate()} ${months[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
  } catch { return s; }
}

// ─── Safe text draw (sanitises before calling pdf-lib) ────────────────────────
function pt(page: PDFPage, text: string, x: number, y: number,
  size: number, font: PDFFont, color: ReturnType<typeof rgb>) {
  const safe = san(String(text ?? ""));
  if (!safe) return;
  try { page.drawText(safe, { x, y, size, font, color }); } catch (_) { /* skip */ }
}

// ─── Word-wrap helper — returns array of lines, never truncates ───────────────
function wrapLines(text: string, font: PDFFont, size: number, maxW: number): string[] {
  const words = san(text || "").split(" ").filter(Boolean);
  if (!words.length) return [""];
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const test = cur ? cur + " " + w : w;
    if (cur && font.widthOfTextAtSize(test, size) > maxW) { lines.push(cur); cur = w; }
    else cur = test;
  }
  if (cur) lines.push(cur);
  return lines;
}

// ─── RAG dot (Fix 2 — exact spec pattern) ─────────────────────────────────────
function drawRagDot(page: PDFPage, x: number, y: number, status: string) {
  const colors: Record<string, ReturnType<typeof rgb>> = {
    green: rgb(0.063, 0.725, 0.506),
    amber: rgb(0.961, 0.620, 0.043),
    red:   rgb(0.937, 0.267, 0.267),
    grey:  rgb(0.6, 0.6, 0.6),
    gray:  rgb(0.6, 0.6, 0.6),
  };
  page.drawCircle({ x, y, size: 5, color: colors[status] ?? colors.grey });
}

// ─── Verdict box (Fix 3 — exact spec pattern) ─────────────────────────────────
function drawVerdictBox(
  page: PDFPage,
  text: string,
  x: number,
  y: number,
  availableWidth: number,
  font: PDFFont,
  boldFont: PDFFont,
  tint: "teal" | "blue" | "navy"
): number {
  const tints: Record<string, ReturnType<typeof rgb>> = {
    teal:  rgb(0.906, 0.980, 0.969),
    blue:  rgb(0.906, 0.933, 0.980),
    navy:  rgb(0.106, 0.169, 0.294),
  };
  const textColors: Record<string, ReturnType<typeof rgb>> = {
    teal:  rgb(0.1, 0.1, 0.1),
    blue:  rgb(0.1, 0.1, 0.1),
    navy:  rgb(1, 1, 1),
  };

  const lineHeight = 14;
  const padding = 14;
  const maxLineWidth = availableWidth - padding * 2 - (tint !== "navy" ? 8 : 0);

  const words = san(text || "").split(" ").filter(Boolean);
  const lines: string[] = [];
  let cur = "";
  for (const word of words) {
    const test = cur ? cur + " " + word : word;
    if (cur && font.widthOfTextAtSize(test, 10) > maxLineWidth) { lines.push(cur); cur = word; }
    else cur = test;
  }
  if (cur) lines.push(cur);

  const boxHeight = Math.max(60, lines.length * lineHeight + padding * 2 + 18);

  // Background fill
  page.drawRectangle({
    x, y: y - boxHeight,
    width: availableWidth, height: boxHeight,
    color: tints[tint],
    ...(tint !== "navy" ? { borderColor: rgb(0.059, 0.608, 0.557), borderWidth: 0.5 } : {}),
  });

  // Left accent bar (teal, not for navy)
  if (tint !== "navy") {
    page.drawRectangle({
      x, y: y - boxHeight,
      width: 4, height: boxHeight,
      color: rgb(0.059, 0.608, 0.557),
    });
  }

  // "VERDICT" label
  pt(page, "VERDICT",
    x + (tint !== "navy" ? padding + 6 : padding),
    y - padding - 10,
    8, boldFont,
    tint === "navy" ? rgb(0.8, 0.9, 0.95) : rgb(0.059, 0.608, 0.557));

  // Wrapped body text
  const textX = x + (tint !== "navy" ? padding + 6 : padding);
  lines.forEach((line, i) => {
    pt(page, line, textX, y - padding - 24 - i * lineHeight, 10, font, textColors[tint]);
  });

  return boxHeight;
}

// ─── Vertical bar chart (Fix 5) ───────────────────────────────────────────────
function drawVerticalBarChart(
  page: PDFPage,
  data: Array<{ label: string; value: number; color: ReturnType<typeof rgb> }>,
  x: number,
  y: number,
  chartWidth: number,
  chartHeight: number,
  font: PDFFont
) {
  const maxValue = Math.max(...data.map(d => Math.abs(d.value)), 1);
  const barWidth = Math.min(55, chartWidth / data.length - 16);
  const barSpacing = chartWidth / data.length;
  const axisX = x + 30;
  const axisY = y - chartHeight;

  // Y axis
  page.drawLine({ start: { x: axisX, y }, end: { x: axisX, y: axisY }, thickness: 0.5, color: rgb(0.8, 0.8, 0.8) });
  // X axis
  page.drawLine({ start: { x: axisX, y: axisY }, end: { x: x + chartWidth, y: axisY }, thickness: 0.5, color: rgb(0.8, 0.8, 0.8) });

  data.forEach((item, i) => {
    const barH = (Math.abs(item.value) / maxValue) * (chartHeight - 24);
    const barX = axisX + i * barSpacing + (barSpacing - barWidth) / 2;
    const barY = axisY;

    // Bar fill
    page.drawRectangle({ x: barX, y: barY, width: barWidth, height: barH, color: item.color });

    // Value label above bar
    const valueLabel = item.value >= 1000 ? `£${Math.round(item.value / 1000)}k` :
                       item.value >= 0 ? fmt(item.value) : fmt(item.value);
    const labelW = font.widthOfTextAtSize(san(valueLabel), 7.5);
    pt(page, valueLabel, barX + (barWidth - labelW) / 2, barY + barH + 3, 7.5, font, rgb(0.2, 0.2, 0.2));

    // Category label below axis
    const itemLabelW = font.widthOfTextAtSize(san(item.label.slice(0, 10)), 7);
    pt(page, item.label.slice(0, 10), barX + (barWidth - itemLabelW) / 2, axisY - 12, 7, font, rgb(0.4, 0.4, 0.4));
  });

  // Return bottom of chart area (below labels)
  return axisY - 20;
}

// ─── Table helpers ────────────────────────────────────────────────────────────
function drawTableHeader(
  page: PDFPage, headers: string[], colW: number[], x: number, y: number,
  rowH: number, fontBold: PDFFont
): number {
  const totalW = colW.reduce((a, b) => a + b, 0);
  page.drawRectangle({ x, y: y - rowH, width: totalW, height: rowH, color: rgb(0.106, 0.169, 0.294) });
  let cx = x;
  for (let i = 0; i < headers.length; i++) {
    pt(page, headers[i], cx + 4, y - rowH + 5, 7.5, fontBold, rgb(1, 1, 1));
    cx += colW[i];
  }
  return y - rowH;
}

// ─── Section title bar (pages 3–5) ────────────────────────────────────────────
function drawSectionTitle(
  page: PDFPage, num: string, title: string, subtitle: string,
  pageW: number, pageH: number, font: PDFFont, fontBold: PDFFont
): number {
  const barTop = pageH - 26;       // just below page top
  const barH = 52;

  // Light teal background strip
  page.drawRectangle({ x: 0, y: barTop - barH, width: pageW, height: barH, color: rgb(0.906, 0.980, 0.969) });
  // Teal left accent
  page.drawRectangle({ x: 0, y: barTop - barH, width: 5, height: barH, color: rgb(0.059, 0.608, 0.557) });
  // Navy number square
  page.drawRectangle({ x: 40, y: barTop - barH + 12, width: 28, height: 28, color: rgb(0.106, 0.169, 0.294) });

  const nw = fontBold.widthOfTextAtSize(san(num), 13);
  pt(page, num, 40 + (28 - nw) / 2, barTop - barH + 22, 13, fontBold, rgb(1, 1, 1));
  pt(page, title, 76, barTop - barH + 30, 12, fontBold, rgb(0.106, 0.169, 0.294));
  pt(page, subtitle, 76, barTop - barH + 16, 8, font, rgb(0.45, 0.45, 0.45));

  return barTop - barH - 10; // content starts here
}

// ─── Page header / footer ─────────────────────────────────────────────────────
const HDR_H = 26;
const FTR_H = 26;

function drawPageHeader(
  page: PDFPage, font: PDFFont,
  company: string, period: string, dateRange: string, pageW: number, pageH: number
) {
  page.drawRectangle({ x: 0, y: pageH - HDR_H, width: pageW, height: HDR_H, color: rgb(0.95, 0.96, 0.97) });
  page.drawLine({ start: { x: 0, y: pageH - HDR_H }, end: { x: pageW, y: pageH - HDR_H }, thickness: 0.5, color: rgb(0.85, 0.86, 0.87) });
  pt(page, san(`${company}  |  MI Pack - ${period}  |  ${dateRange}  |  MBS Accountants  |  Confidential`),
    40, pageH - HDR_H + 8, 7, font, rgb(0.45, 0.45, 0.45));
}

function drawPageFooter(page: PDFPage, font: PDFFont, pageNum: number, total: number, pageW: number) {
  page.drawRectangle({ x: 0, y: 0, width: pageW, height: FTR_H, color: rgb(0.95, 0.96, 0.97) });
  page.drawLine({ start: { x: 0, y: FTR_H }, end: { x: pageW, y: FTR_H }, thickness: 0.5, color: rgb(0.85, 0.86, 0.87) });
  const label = `Page ${pageNum} of ${total}`;
  const lw = font.widthOfTextAtSize(label, 7);
  pt(page, label, (pageW - lw) / 2, 9, 7, font, rgb(0.45, 0.45, 0.45));
}

// ─── Report data type ─────────────────────────────────────────────────────────
interface ReportData {
  client: { clientName?: string; companyName?: string; industry?: string };
  period: { periodLabel?: string; periodStart?: string; periodEnd?: string };
  financialData: Record<string, any>;
  aiExecutiveSummary?: string;
  aiGoingWell?: string[];
  aiConcerns?: string[];
  aiActionSteps?: any[];
  aiGoalCommentary?: any[];
  aiDiscussionPoints?: string[];
  aiThreeCoreQuestions?: { profitability_verdict?: string; capital_verdict?: string; borrowing_verdict?: string };
  aiHealthScore?: number;
  aiHealthStatus?: string;
  accountantNotes?: string;
}

// ─── Main export ──────────────────────────────────────────────────────────────
export async function generateManagementReportPdf(report: ReportData): Promise<Uint8Array> {
  // ── Diagnostic logs ───────────────────────────────────────────────────────
  console.log("[PDF] Starting generation for:", report.client?.companyName || report.client?.clientName);
  console.log("[PDF] pdf-lib version check — PDFDocument.create OK");

  const pdfDoc = await PDFDocument.create();
  const helvetica     = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const pageWidth  = 595.28;
  const pageHeight = 841.89;
  const leftMargin   = 40;
  const contentWidth = pageWidth - leftMargin * 2;

  console.log("[PDF] Fonts embedded. Page:", pageWidth, "x", pageHeight);

  function newPage(): PDFPage { return pdfDoc.addPage([pageWidth, pageHeight]); }

  // ── Extract data ─────────────────────────────────────────────────────────
  const fd   = report.financialData || {};
  const is   = fd.income_statement  || {};
  const cf   = fd.cashflow          || {};
  const bs   = fd.balance_sheet     || {};
  const kpis = fd.kpis              || {};
  const debtSchedule:    any[] = fd.debt_schedule           || [];
  const dlas:            any[] = fd.director_loan_accounts   || [];
  const overheadItems:   any[] = fd.overhead_breakdown       || [];
  const cosDetail:       any[] = fd.cost_of_sales_detail     || [];
  const grantIncome:     any[] = fd.grant_income             || [];
  const cfWaterfall             = fd.cashflow_waterfall as any;
  const nextPeriodMetrics: any[] = fd.next_period_metrics    || [];
  const threeCore = (report.aiThreeCoreQuestions || fd.three_core_questions || {}) as any;
  const actions:    any[] = report.aiActionSteps             || [];
  const discPoints: string[] = report.aiDiscussionPoints     || [];

  const company     = san(report.client?.companyName || report.client?.clientName || "Client");
  const periodLabel = report.period?.periodLabel || "Report";
  const dateRange   = report.period?.periodStart && report.period?.periodEnd
    ? `${fmtDate(report.period.periodStart)} - ${fmtDate(report.period.periodEnd)}`
    : periodLabel;

  const totalDebt = debtSchedule.reduce((s: number, d: any) => s + (d.close_balance || 0), 0);

  // ═══════════════════════════════════════════════════════════════════════════
  // PAGE 1 — COVER (Fix 1 — exact spec code pattern)
  // ═══════════════════════════════════════════════════════════════════════════
  console.log("[PDF] Drawing page 1 — cover");
  const page1 = newPage();

  // Dark navy top section — 38% of page height
  const navyHeight = pageHeight * 0.38;
  console.log("[PDF] Drawing cover navy rect: 0,", pageHeight - navyHeight, pageWidth, navyHeight);
  page1.drawRectangle({
    x: 0,
    y: pageHeight - navyHeight,
    width: pageWidth,
    height: navyHeight,
    color: rgb(0.106, 0.169, 0.294),
  });

  // MBS Accountants — white top-left
  page1.drawText("MBS Accountants", {
    x: leftMargin, y: pageHeight - 40,
    size: 14, font: helveticaBold, color: rgb(1, 1, 1),
  });

  // Confidential sub-label
  page1.drawText("Confidential - Management Information Pack", {
    x: leftMargin, y: pageHeight - 58,
    size: 8, font: helvetica, color: rgb(0.75, 0.85, 0.9),
  });

  // Client name — white top-right (Fix 1 spec pattern)
  const clientText = company;
  const clientTextWidth = helveticaBold.widthOfTextAtSize(clientText, 12);
  page1.drawText(clientText, {
    x: pageWidth - leftMargin - clientTextWidth,
    y: pageHeight - 40,
    size: 12, font: helveticaBold, color: rgb(1, 1, 1),
  });

  // Thin divider line inside navy
  page1.drawLine({
    start: { x: leftMargin, y: pageHeight - 66 },
    end:   { x: pageWidth - leftMargin, y: pageHeight - 66 },
    thickness: 0.5, color: rgb(0.3, 0.4, 0.55),
  });

  // Main title centred in navy
  const titleText = "Management Information Pack";
  const titleWidth = helveticaBold.widthOfTextAtSize(titleText, 22);
  page1.drawText(titleText, {
    x: (pageWidth - titleWidth) / 2,
    y: pageHeight - navyHeight / 2 - 10,
    size: 22, font: helveticaBold, color: rgb(1, 1, 1),
  });

  // Period label centred below title
  const periodTextWidth = helvetica.widthOfTextAtSize(san(periodLabel), 13);
  page1.drawText(san(periodLabel), {
    x: (pageWidth - periodTextWidth) / 2,
    y: pageHeight - navyHeight / 2 + 22,
    size: 13, font: helvetica, color: rgb(0.8, 0.9, 0.95),
  });

  // Date range centred below period
  const drW = helvetica.widthOfTextAtSize(san(dateRange), 9);
  page1.drawText(san(dateRange), {
    x: (pageWidth - drW) / 2,
    y: pageHeight - navyHeight / 2 - 28,
    size: 9, font: helvetica, color: rgb(0.72, 0.82, 0.88),
  });

  // ── White content area below navy ─────────────────────────────────────────
  let coverY = pageHeight - navyHeight - 24;

  // "Prepared by" line
  pt(page1, `Prepared by MBS Accountants  |  ${periodLabel}  |  Confidential`,
    leftMargin, coverY, 9, helvetica, rgb(0.5, 0.5, 0.5));
  coverY -= 22;

  // Section heading
  pt(page1, "This report addresses three core questions:", leftMargin, coverY, 10, helveticaBold, rgb(0.106, 0.169, 0.294));
  coverY -= 16;

  const questions = [
    { n: "1", q: "How profitable are we?",           sub: "Gross margin, operating performance, cost analysis." },
    { n: "2", q: "Is our capital deployed correctly?", sub: "Asset efficiency, working capital, balance sheet movement." },
    { n: "3", q: "Can / should we look to borrow more?", sub: "Debt levels, interest burden, lending headroom." },
  ];

  for (const { n, q, sub } of questions) {
    const cardH = 52;
    // Card background — light grey
    page1.drawRectangle({ x: leftMargin, y: coverY - cardH, width: contentWidth, height: cardH, color: rgb(0.97, 0.97, 0.97) });
    // Teal left border
    page1.drawRectangle({ x: leftMargin, y: coverY - cardH, width: 4, height: cardH, color: rgb(0.059, 0.608, 0.557) });
    // Navy number circle
    page1.drawCircle({ x: leftMargin + 22, y: coverY - cardH / 2, size: 12, color: rgb(0.106, 0.169, 0.294) });
    const nw = helveticaBold.widthOfTextAtSize(n, 11);
    pt(page1, n, leftMargin + 22 - nw / 2, coverY - cardH / 2 - 4, 11, helveticaBold, rgb(1, 1, 1));
    pt(page1, q,   leftMargin + 44, coverY - 16, 11, helveticaBold, rgb(0.106, 0.169, 0.294));
    pt(page1, sub, leftMargin + 44, coverY - 30,  8, helvetica,     rgb(0.45, 0.45, 0.45));
    coverY -= cardH + 10;
  }

  drawPageFooter(page1, helvetica, 1, 6, pageWidth);
  console.log("[PDF] Page 1 done");

  // ═══════════════════════════════════════════════════════════════════════════
  // PAGE 2 — DASHBOARD
  // ═══════════════════════════════════════════════════════════════════════════
  console.log("[PDF] Drawing page 2 — dashboard");
  const page2 = newPage();

  // Full-width navy header bar
  page2.drawRectangle({ x: 0, y: pageHeight - 54, width: pageWidth, height: 54, color: rgb(0.106, 0.169, 0.294) });
  pt(page2, "Dashboard",                              leftMargin, pageHeight - 28, 16, helveticaBold, rgb(1, 1, 1));
  pt(page2, `At-a-glance summary - ${dateRange}`,    leftMargin, pageHeight - 44,  8, helvetica,    rgb(0.7, 0.85, 0.9));

  let dashY = pageHeight - 70;

  // ── 3 x 2 metric cards ────────────────────────────────────────────────────
  const cardData = [
    { label: "Revenue",          value: fmt(is.total_revenue),             sub: is.gross_margin_pct != null ? `GP ${is.gross_margin_pct}%` : "" },
    { label: "Gross Profit",     value: fmt(is.gross_profit),              sub: fmtPct(is.gross_margin_pct) },
    { label: "Operating Profit", value: fmt(is.operating_profit),          sub: fmtPct(is.operating_margin_pct) },
    { label: "Net Profit",       value: fmt(is.net_profit),                sub: fmtPct(is.net_margin_pct) },
    { label: "Cash (Close)",     value: fmt(cf.closing_balance ?? kpis.cash_balance), sub: cf.opening_balance != null ? `Open: ${fmt(cf.opening_balance)}` : "" },
    { label: "Total Debt",       value: fmt(bs.total_debt ?? totalDebt),   sub: kpis.debtor_days > 0 ? `${kpis.debtor_days}d debtor` : "" },
  ];
  const cardW   = (contentWidth - 16) / 3;
  const cardH   = 55;
  const cardGap = 8;

  for (let row = 0; row < 2; row++) {
    for (let col = 0; col < 3; col++) {
      const i = row * 3 + col;
      if (i >= cardData.length) break;
      const cd = cardData[i];
      const cx = leftMargin + col * (cardW + cardGap);
      const cy = dashY - row * (cardH + cardGap);
      // White card with light grey border
      page2.drawRectangle({
        x: cx, y: cy - cardH, width: cardW, height: cardH,
        color: rgb(1, 1, 1), borderColor: rgb(0.878, 0.878, 0.878), borderWidth: 0.7,
      });
      pt(page2, cd.label, cx + 8, cy - 14, 8.5, helvetica, rgb(0.45, 0.45, 0.45));
      const isNeg = cd.value.startsWith("(");
      pt(page2, cd.value, cx + 8, cy - 32, 14, helveticaBold, isNeg ? rgb(0.937, 0.267, 0.267) : rgb(0.106, 0.169, 0.294));
      if (cd.sub) pt(page2, cd.sub, cx + 8, cy - 46, 7.5, helvetica, rgb(0.5, 0.5, 0.5));
    }
  }
  dashY -= 2 * (cardH + cardGap) + 14;

  // ── Financial Health Scorecard ────────────────────────────────────────────
  pt(page2, "Financial Health Scorecard", leftMargin, dashY, 11, helveticaBold, rgb(0.106, 0.169, 0.294));
  dashY -= 14;

  const scCols = [contentWidth * 0.42, contentWidth * 0.2, contentWidth * 0.2, contentWidth * 0.18];
  dashY = drawTableHeader(page2, ["Metric", "This Period", "Target", "Status"], scCols, leftMargin, dashY, 16, helveticaBold);

  // RAG logic for scorecard
  function scoreRAG(key: string): { status: string; target: string } {
    switch (key) {
      case "rev":  return { status: (is.total_revenue || 0) >= (is.prior_revenue || 0) ? "green" : "amber", target: "Increasing" };
      case "gp":   return { status: (is.gross_margin_pct || 0) >= 25 ? "green" : (is.gross_margin_pct || 0) >= 20 ? "amber" : "red", target: ">= 25%" };
      case "op":   return { status: (is.operating_profit || 0) >= 0 ? "green" : "red", target: "Positive" };
      case "np":   return { status: (is.net_profit || 0) >= 0 ? "green" : "red", target: "Positive" };
      case "cash": { const cb = cf.closing_balance || 0; return { status: cb >= 10000 ? "green" : cb >= 5000 ? "amber" : "red", target: ">= £10,000" }; }
      case "dd":   return { status: (kpis.debtor_days || 0) <= 14 ? "green" : (kpis.debtor_days || 0) <= 30 ? "amber" : "red", target: "<= 14 days" };
      default:     return { status: "grey", target: "" };
    }
  }

  const scorecardRows = [
    { label: "Revenue",          value: fmt(is.total_revenue),             key: "rev" },
    { label: "Gross Profit %",   value: fmtPct(is.gross_margin_pct),       key: "gp"  },
    { label: "Operating Profit", value: fmt(is.operating_profit),          key: "op"  },
    { label: "Net Profit",       value: fmt(is.net_profit),                key: "np"  },
    { label: "Cash Balance",     value: fmt(cf.closing_balance),           key: "cash"},
    ...(kpis.debtor_days > 0 ? [{ label: "Debtor Days", value: `${kpis.debtor_days} days`, key: "dd" }] : []),
  ];

  for (let i = 0; i < scorecardRows.length; i++) {
    const row  = scorecardRows[i];
    const rag  = scoreRAG(row.key);
    const rowH = 16;
    const totalW = scCols.reduce((a, b) => a + b, 0);

    // Row background
    page2.drawRectangle({
      x: leftMargin, y: dashY - rowH,
      width: totalW, height: rowH,
      color: i % 2 === 0 ? rgb(1, 1, 1) : rgb(0.976, 0.980, 0.984),
      borderColor: rgb(0.878, 0.878, 0.878), borderWidth: 0.3,
    });

    pt(page2, row.label, leftMargin + 4, dashY - rowH + 5, 8, helvetica, rgb(0.1, 0.1, 0.1));
    const isNeg = row.value.startsWith("(");
    pt(page2, row.value, leftMargin + scCols[0] + 4, dashY - rowH + 5, 8, helvetica, isNeg ? rgb(0.937, 0.267, 0.267) : rgb(0.1, 0.1, 0.1));
    pt(page2, rag.target, leftMargin + scCols[0] + scCols[1] + 4, dashY - rowH + 5, 8, helvetica, rgb(0.45, 0.45, 0.45));

    // RAG dot in status column (Fix 2)
    const dotX = leftMargin + scCols[0] + scCols[1] + scCols[2] + scCols[3] / 2;
    const dotY = dashY - rowH / 2;
    drawRagDot(page2, dotX, dotY, rag.status);

    dashY -= rowH;
  }

  drawPageHeader(page2, helvetica, company, periodLabel, dateRange, pageWidth, pageHeight);
  drawPageFooter(page2, helvetica, 2, 6, pageWidth);
  console.log("[PDF] Page 2 done");

  // ═══════════════════════════════════════════════════════════════════════════
  // PAGE 3 — PROFITABILITY
  // ═══════════════════════════════════════════════════════════════════════════
  console.log("[PDF] Drawing page 3 — profitability");
  const page3 = newPage();
  let y3 = drawSectionTitle(page3, "1", "How Profitable Are We?",
    `Revenue, gross margin, overhead analysis - ${dateRange}`, pageWidth, pageHeight, helvetica, helveticaBold);

  // ── Teal verdict box (Fix 3 — tint: "teal") ──────────────────────────────
  if (threeCore.profitability_verdict) {
    console.log("[PDF] Drawing profitability verdict box");
    const vBoxH = drawVerdictBox(page3, threeCore.profitability_verdict,
      leftMargin, y3, contentWidth, helvetica, helveticaBold, "teal");
    y3 -= vBoxH + 8;
  }

  // ── Vertical bar chart — Revenue, GP, Expenses, Net Profit (Fix 5) ───────
  pt(page3, "Revenue & Performance Overview", leftMargin, y3, 10, helveticaBold, rgb(0.106, 0.169, 0.294));
  y3 -= 10;

  const chartData = [
    { label: "Revenue",    value: is.total_revenue   || 0, color: rgb(0.059, 0.608, 0.557) },
    { label: "Gross Prof", value: is.gross_profit    || 0, color: rgb(0.106, 0.169, 0.294) },
    { label: "Expenses",   value: is.total_expenses  || 0, color: rgb(0.961, 0.620, 0.043) },
    { label: "Net Profit", value: is.net_profit      || 0, color: is.net_profit < 0 ? rgb(0.937, 0.267, 0.267) : rgb(0.063, 0.725, 0.506) },
  ].filter(d => d.value !== 0 || d.label === "Net Profit");

  const chartBottom = drawVerticalBarChart(page3, chartData, leftMargin, y3, contentWidth, 100, helvetica);
  y3 = chartBottom - 8;

  // ── CoS table ─────────────────────────────────────────────────────────────
  pt(page3, "Cost of Sales & Key Metrics", leftMargin, y3, 10, helveticaBold, rgb(0.106, 0.169, 0.294));
  y3 -= 12;

  const cosCols = [contentWidth * 0.36, contentWidth * 0.18, contentWidth * 0.14, contentWidth * 0.18, contentWidth * 0.14];
  y3 = drawTableHeader(page3, ["Line Item", "This Period", "% Rev", "Prior Period", "Note"], cosCols, leftMargin, y3, 14, helveticaBold);

  const cosRows: Array<{ label: string; tp: number | undefined; pct: number | null; pp: number | null; note: string; bold: boolean }> = [
    { label: "Revenue",        tp: is.total_revenue,    pct: null, pp: null,               note: "", bold: true  },
    ...cosDetail.map((cs: any) => ({ label: cs.name, tp: cs.this_period, pct: cs.pct_of_revenue ?? null, pp: cs.prior_period ?? null, note: cs.note || "", bold: false })),
    { label: "Gross Profit",   tp: is.gross_profit,     pct: is.gross_margin_pct ?? null,  pp: null, note: "", bold: true  },
    { label: "Total Overhead", tp: is.total_expenses,   pct: is.total_revenue > 0 ? Math.round(is.total_expenses / is.total_revenue * 100) : null, pp: null, note: "", bold: false },
    ...grantIncome.map((g: any) => ({ label: "Grant Income", tp: g.amount, pct: null, pp: null, note: g.recurring ? "Recurring" : "One-off", bold: false })),
    { label: is.operating_profit < 0 ? "Operating Loss" : "Operating Profit", tp: is.operating_profit, pct: is.operating_margin_pct ?? null, pp: null, note: "", bold: true  },
    { label: is.net_profit < 0 ? "Net Loss" : "Net Profit", tp: is.net_profit, pct: is.net_margin_pct ?? null, pp: null, note: "", bold: true  },
  ];

  for (let i = 0; i < cosRows.length; i++) {
    const r = cosRows[i];
    const rowH = 13;
    const totalW = cosCols.reduce((a, b) => a + b, 0);
    page3.drawRectangle({
      x: leftMargin, y: y3 - rowH, width: totalW, height: rowH,
      color: r.bold ? rgb(0.940, 0.944, 0.952) : (i % 2 === 0 ? rgb(1, 1, 1) : rgb(0.976, 0.980, 0.984)),
      borderColor: rgb(0.878, 0.878, 0.878), borderWidth: 0.3,
    });
    const f = r.bold ? helveticaBold : helvetica;
    const isNeg = (r.tp ?? 0) < 0;
    pt(page3, r.label, leftMargin + 4, y3 - rowH + 4, 8, f, rgb(0.1, 0.1, 0.1));
    pt(page3, fmt(r.tp), leftMargin + cosCols[0] + 4, y3 - rowH + 4, 8, f, isNeg ? rgb(0.937, 0.267, 0.267) : rgb(0.1, 0.1, 0.1));
    pt(page3, r.pct != null ? `${r.pct}%` : "-", leftMargin + cosCols[0] + cosCols[1] + 4, y3 - rowH + 4, 8, helvetica, r.pct != null ? rgb(0.059, 0.608, 0.557) : rgb(0.5, 0.5, 0.5));
    pt(page3, r.pp != null ? fmt(r.pp) : "-", leftMargin + cosCols[0] + cosCols[1] + cosCols[2] + 4, y3 - rowH + 4, 8, helvetica, rgb(0.45, 0.45, 0.45));
    pt(page3, san((r.note || "").slice(0, 16)), leftMargin + cosCols[0] + cosCols[1] + cosCols[2] + cosCols[3] + 4, y3 - rowH + 4, 7.5, helvetica, rgb(0.5, 0.5, 0.5));
    y3 -= rowH;
  }

  drawPageHeader(page3, helvetica, company, periodLabel, dateRange, pageWidth, pageHeight);
  drawPageFooter(page3, helvetica, 3, 6, pageWidth);
  console.log("[PDF] Page 3 done");

  // ═══════════════════════════════════════════════════════════════════════════
  // PAGE 4 — CAPITAL
  // ═══════════════════════════════════════════════════════════════════════════
  console.log("[PDF] Drawing page 4 — capital");
  const page4 = newPage();
  let y4 = drawSectionTitle(page4, "2", "Is Our Capital Deployed Correctly?",
    `Balance sheet, working capital, assets - ${dateRange}`, pageWidth, pageHeight, helvetica, helveticaBold);

  // ── Blue verdict box (Fix 3 — tint: "blue") ───────────────────────────────
  if (threeCore.capital_verdict) {
    console.log("[PDF] Drawing capital verdict box");
    const vBoxH = drawVerdictBox(page4, threeCore.capital_verdict,
      leftMargin, y4, contentWidth, helvetica, helveticaBold, "blue");
    y4 -= vBoxH + 8;
  }

  // ── Cashflow waterfall ────────────────────────────────────────────────────
  if (cfWaterfall) {
    pt(page4, "Cash Movement This Period", leftMargin, y4, 10, helveticaBold, rgb(0.106, 0.169, 0.294));
    y4 -= 10;
    const wfBars = [
      { label: "Opening",   value: cfWaterfall.opening_cash || 0,                color: rgb(0.106, 0.169, 0.294) },
      { label: "GP Earned", value: cfWaterfall.gp_earned || 0,                   color: rgb(0.059, 0.608, 0.557) },
      { label: "Overheads", value: cfWaterfall.overheads_paid || 0,              color: rgb(0.937, 0.267, 0.267) },
      { label: "Debt Svc",  value: cfWaterfall.debt_service || 0,               color: rgb(0.937, 0.267, 0.267) },
      { label: "Wk Cap",    value: Math.abs(cfWaterfall.working_capital_movement || 0), color: (cfWaterfall.working_capital_movement || 0) >= 0 ? rgb(0.059, 0.608, 0.557) : rgb(0.937, 0.267, 0.267) },
      { label: "Closing",   value: cfWaterfall.closing_cash || 0,               color: rgb(0.059, 0.608, 0.557) },
    ].filter(b => b.value > 0);
    const chartB4 = drawVerticalBarChart(page4, wfBars, leftMargin, y4, contentWidth, 90, helvetica);
    y4 = chartB4 - 8;
  }

  // ── Balance Sheet table with RAG dots ─────────────────────────────────────
  pt(page4, "Balance Sheet Position", leftMargin, y4, 10, helveticaBold, rgb(0.106, 0.169, 0.294));
  y4 -= 12;

  const bsCols = [contentWidth * 0.52, contentWidth * 0.3, contentWidth * 0.18];
  y4 = drawTableHeader(page4, ["Item", "Amount", "Status"], bsCols, leftMargin, y4, 15, helveticaBold);

  const workingCap = (bs.current_assets || 0) - (bs.current_liabilities || 0);
  const debtRatio  = (bs.total_assets || 0) > 0 ? (bs.total_debt || 0) / bs.total_assets : 0;

  const bsRows = [
    { label: "Total Assets",        value: bs.total_assets,         rag: "green", bold: false },
    { label: "Current Assets",      value: bs.current_assets,       rag: "green", bold: false },
    { label: "Current Liabilities", value: bs.current_liabilities,  rag: (bs.current_liabilities || 0) > (bs.current_assets || 0) ? "red" : "amber", bold: false },
    { label: "Working Capital",     value: workingCap,              rag: workingCap >= 0 ? "green" : "red", bold: true },
    { label: "Total Debt",          value: bs.total_debt,           rag: debtRatio < 0.5 ? "green" : debtRatio < 0.8 ? "amber" : "red", bold: false },
    { label: "Net Assets",          value: bs.net_assets,           rag: (bs.net_assets || 0) >= 0 ? "green" : "red", bold: true },
  ];

  for (let i = 0; i < bsRows.length; i++) {
    const r = bsRows[i];
    const rowH = 15;
    const totalW = bsCols.reduce((a, b) => a + b, 0);
    page4.drawRectangle({
      x: leftMargin, y: y4 - rowH, width: totalW, height: rowH,
      color: r.bold ? rgb(0.940, 0.944, 0.952) : (i % 2 === 0 ? rgb(1, 1, 1) : rgb(0.976, 0.980, 0.984)),
      borderColor: rgb(0.878, 0.878, 0.878), borderWidth: 0.3,
    });
    const f = r.bold ? helveticaBold : helvetica;
    const isNeg = (r.value || 0) < 0;
    pt(page4, r.label, leftMargin + 4, y4 - rowH + 4, 8, f, rgb(0.1, 0.1, 0.1));
    pt(page4, fmt(r.value), leftMargin + bsCols[0] + 4, y4 - rowH + 4, 8, f, isNeg ? rgb(0.937, 0.267, 0.267) : rgb(0.1, 0.1, 0.1));
    // RAG dot (Fix 2)
    drawRagDot(page4, leftMargin + bsCols[0] + bsCols[1] + bsCols[2] / 2, y4 - rowH / 2, r.rag);
    y4 -= rowH;
  }
  y4 -= 8;

  // ── DLA table ─────────────────────────────────────────────────────────────
  if (dlas.length > 0) {
    pt(page4, "Director Loan Accounts", leftMargin, y4, 10, helveticaBold, rgb(0.106, 0.169, 0.294));
    y4 -= 12;
    const dlaCols = [contentWidth * 0.30, contentWidth * 0.175, contentWidth * 0.175, contentWidth * 0.175, contentWidth * 0.175];
    y4 = drawTableHeader(page4, ["Director", "Opening", "Closing", "Movement", "Status"], dlaCols, leftMargin, y4, 14, helveticaBold);
    for (let i = 0; i < dlas.length; i++) {
      const d = dlas[i];
      const rowH = 13;
      const totalW = dlaCols.reduce((a, b) => a + b, 0);
      page4.drawRectangle({
        x: leftMargin, y: y4 - rowH, width: totalW, height: rowH,
        color: i % 2 === 0 ? rgb(1, 1, 1) : rgb(0.976, 0.980, 0.984),
        borderColor: rgb(0.878, 0.878, 0.878), borderWidth: 0.3,
      });
      pt(page4, san(d.name || ""), leftMargin + 4, y4 - rowH + 4, 8, helveticaBold, rgb(0.1, 0.1, 0.1));
      pt(page4, fmt(d.open_balance),  leftMargin + dlaCols[0] + 4, y4 - rowH + 4, 8, helvetica, rgb(0.45, 0.45, 0.45));
      pt(page4, fmt(d.close_balance), leftMargin + dlaCols[0] + dlaCols[1] + 4, y4 - rowH + 4, 8, helvetica, rgb(0.1, 0.1, 0.1));
      const mov = d.movement || 0;
      pt(page4, (mov < 0 ? "-" : "+") + fmt(Math.abs(mov)), leftMargin + dlaCols[0] + dlaCols[1] + dlaCols[2] + 4, y4 - rowH + 4, 8, helvetica, mov < 0 ? rgb(0.063, 0.725, 0.506) : rgb(0.937, 0.267, 0.267));
      pt(page4, san(d.status || ""), leftMargin + dlaCols[0] + dlaCols[1] + dlaCols[2] + dlaCols[3] + 4, y4 - rowH + 4, 7.5, helvetica, rgb(0.45, 0.45, 0.45));
      y4 -= rowH;
    }
  }

  drawPageHeader(page4, helvetica, company, periodLabel, dateRange, pageWidth, pageHeight);
  drawPageFooter(page4, helvetica, 4, 6, pageWidth);
  console.log("[PDF] Page 4 done");

  // ═══════════════════════════════════════════════════════════════════════════
  // PAGE 5 — BORROWING
  // ═══════════════════════════════════════════════════════════════════════════
  console.log("[PDF] Drawing page 5 — borrowing");
  const page5 = newPage();
  let y5 = drawSectionTitle(page5, "3", "Can / Should We Look to Borrow More?",
    `Debt position, interest burden, serviceability - ${dateRange}`, pageWidth, pageHeight, helvetica, helveticaBold);

  // ── Full-width navy VERDICT box (Fix 3 — tint: "navy") ────────────────────
  if (threeCore.borrowing_verdict) {
    console.log("[PDF] Drawing borrowing verdict box (navy)");
    const vBoxH = drawVerdictBox(page5, threeCore.borrowing_verdict,
      leftMargin, y5, contentWidth, helvetica, helveticaBold, "navy");
    y5 -= vBoxH + 12;
  }

  // ── Stacked horizontal debt bar (3+ facilities) ───────────────────────────
  if (debtSchedule.length >= 3 && totalDebt > 0) {
    pt(page5, `Total Debt: ${fmt(totalDebt)}`, leftMargin, y5, 10, helveticaBold, rgb(0.106, 0.169, 0.294));
    y5 -= 12;
    const segColors = [
      rgb(0.059, 0.608, 0.557), rgb(0.106, 0.169, 0.294),
      rgb(0.961, 0.620, 0.043), rgb(0.937, 0.267, 0.267),
      rgb(0.063, 0.725, 0.506), rgb(0.6, 0.4, 0.8),
    ];
    let segX = leftMargin;
    const sBarH = 20;
    for (let i = 0; i < debtSchedule.length; i++) {
      const d = debtSchedule[i];
      const segW = (d.close_balance / totalDebt) * contentWidth;
      if (segW > 0) {
        page5.drawRectangle({ x: segX, y: y5 - sBarH, width: segW, height: sBarH, color: segColors[i % segColors.length] });
      }
      segX += segW;
    }
    y5 -= sBarH + 8;
    // Legend
    let legX = leftMargin;
    const legItemW = contentWidth / Math.min(debtSchedule.length, 4);
    for (let i = 0; i < Math.min(debtSchedule.length, 4); i++) {
      const d = debtSchedule[i];
      page5.drawRectangle({ x: legX, y: y5 - 8, width: 10, height: 8, color: segColors[i % segColors.length] });
      pt(page5, san(`${(d.facility || "").slice(0, 14)} ${fmt(d.close_balance)}`), legX + 14, y5, 7, helvetica, rgb(0.45, 0.45, 0.45));
      legX += legItemW;
    }
    y5 -= 18;
  }

  // ── Debt schedule table ───────────────────────────────────────────────────
  if (debtSchedule.length > 0) {
    pt(page5, "Debt Breakdown & Schedule", leftMargin, y5, 10, helveticaBold, rgb(0.106, 0.169, 0.294));
    y5 -= 12;
    const dsCols = [contentWidth * 0.33, contentWidth * 0.17, contentWidth * 0.17, contentWidth * 0.2, contentWidth * 0.13];
    y5 = drawTableHeader(page5, ["Facility", "Opening", "Closing", "Type", "RAG"], dsCols, leftMargin, y5, 15, helveticaBold);

    for (let i = 0; i < debtSchedule.length; i++) {
      const d = debtSchedule[i];
      const rowH = 15;
      const totalW = dsCols.reduce((a, b) => a + b, 0);
      page5.drawRectangle({
        x: leftMargin, y: y5 - rowH, width: totalW, height: rowH,
        color: d.is_new_this_period ? rgb(0.992, 0.941, 0.941) : (i % 2 === 0 ? rgb(1, 1, 1) : rgb(0.976, 0.980, 0.984)),
        borderColor: rgb(0.878, 0.878, 0.878), borderWidth: 0.3,
      });
      pt(page5, san((d.facility || "").slice(0, 22)), leftMargin + 4, y5 - rowH + 5, 8, helveticaBold, rgb(0.1, 0.1, 0.1));
      if (d.is_new_this_period) pt(page5, "NEW", leftMargin + dsCols[0] - 28, y5 - rowH + 5, 6.5, helveticaBold, rgb(0.961, 0.620, 0.043));
      pt(page5, d.open_balance > 0 ? fmt(d.open_balance) : "-", leftMargin + dsCols[0] + 4, y5 - rowH + 5, 8, helvetica, rgb(0.45, 0.45, 0.45));
      pt(page5, fmt(d.close_balance), leftMargin + dsCols[0] + dsCols[1] + 4, y5 - rowH + 5, 8, helvetica, rgb(0.1, 0.1, 0.1));
      pt(page5, san((d.type || "").slice(0, 16)), leftMargin + dsCols[0] + dsCols[1] + dsCols[2] + 4, y5 - rowH + 5, 7.5, helvetica, rgb(0.45, 0.45, 0.45));
      drawRagDot(page5, leftMargin + dsCols[0] + dsCols[1] + dsCols[2] + dsCols[3] + dsCols[4] / 2, y5 - rowH / 2, d.rag || "grey");
      y5 -= rowH;
    }

    // Totals row
    const dsTotalW = dsCols.reduce((a, b) => a + b, 0);
    page5.drawRectangle({ x: leftMargin, y: y5 - 15, width: dsTotalW, height: 15, color: rgb(0.906, 0.980, 0.969), borderColor: rgb(0.878, 0.878, 0.878), borderWidth: 0.3 });
    pt(page5, "TOTAL", leftMargin + 4, y5 - 10, 8, helveticaBold, rgb(0.1, 0.1, 0.1));
    pt(page5, fmt(totalDebt), leftMargin + dsCols[0] + dsCols[1] + 4, y5 - 10, 8, helveticaBold, rgb(0.106, 0.169, 0.294));
    y5 -= 15;
  }

  drawPageHeader(page5, helvetica, company, periodLabel, dateRange, pageWidth, pageHeight);
  drawPageFooter(page5, helvetica, 5, 6, pageWidth);
  console.log("[PDF] Page 5 done");

  // ═══════════════════════════════════════════════════════════════════════════
  // PAGE 6 — ACTIONS
  // ═══════════════════════════════════════════════════════════════════════════
  console.log("[PDF] Drawing page 6 — actions");
  const page6 = newPage();

  // Full-width navy header
  page6.drawRectangle({ x: 0, y: pageHeight - 54, width: pageWidth, height: 54, color: rgb(0.106, 0.169, 0.294) });
  pt(page6, "Actions & Focus for Next Period", leftMargin, pageHeight - 28, 14, helveticaBold, rgb(1, 1, 1));
  pt(page6, `${periodLabel}  |  ${company}`, leftMargin, pageHeight - 44, 8, helvetica, rgb(0.7, 0.85, 0.9));

  let y6 = pageHeight - 64;

  // ── Action cards (Fix 4 — exact spec pattern) ─────────────────────────────
  for (let i = 0; i < Math.min(actions.length, 5) && y6 > FTR_H + 50; i++) {
    const a = actions[i];
    const pri = (a.priority || "low").toLowerCase();
    const borderColor = (pri === "high" || pri === "red")
      ? rgb(0.937, 0.267, 0.267)
      : (pri === "medium" || pri === "med" || pri === "amber")
        ? rgb(0.961, 0.620, 0.043)
        : rgb(0.6, 0.6, 0.6);
    const badgeText = (pri === "high" || pri === "red") ? "HIGH" : (pri === "medium" || pri === "med" || pri === "amber") ? "MED" : "LOW";

    // Measure card height dynamically
    const actionLines = wrapLines(a.action || "", helveticaBold, 10, contentWidth - 52);
    const whyLines    = wrapLines(a.why    || "", helvetica,     8.5, contentWidth - 52);
    const goalLines   = a.linksToGoal ? wrapLines(`Goal: ${a.linksToGoal}`, helvetica, 8, contentWidth - 52) : [];
    const cardHeight  = Math.max(50, actionLines.length * 13 + whyLines.length * 12 + goalLines.length * 11 + 20);

    // Card background (white, grey border) — Fix 4 spec pattern
    page6.drawRectangle({
      x: leftMargin, y: y6 - cardHeight,
      width: contentWidth, height: cardHeight,
      color: rgb(1, 1, 1),
      borderColor: rgb(0.878, 0.878, 0.878), borderWidth: 0.5,
    });

    // Coloured left border — Fix 4 spec pattern
    page6.drawRectangle({
      x: leftMargin, y: y6 - cardHeight,
      width: 4, height: cardHeight,
      color: borderColor,
    });

    // Navy number circle
    page6.drawCircle({ x: leftMargin + 20, y: y6 - cardHeight / 2, size: 9, color: rgb(0.106, 0.169, 0.294) });
    const numW = helveticaBold.widthOfTextAtSize(String(i + 1), 9);
    pt(page6, String(i + 1), leftMargin + 20 - numW / 2, y6 - cardHeight / 2 - 4, 9, helveticaBold, rgb(1, 1, 1));

    // Priority badge top-right
    const badgeW = 28;
    page6.drawRectangle({ x: leftMargin + contentWidth - badgeW - 4, y: y6 - 16, width: badgeW, height: 14, color: borderColor });
    const bw = helveticaBold.widthOfTextAtSize(badgeText, 7);
    pt(page6, badgeText, leftMargin + contentWidth - badgeW - 4 + (badgeW - bw) / 2, y6 - 5, 7, helveticaBold, rgb(1, 1, 1));

    // Action text (no truncation — wraps)
    let ty = y6 - 13;
    for (const line of actionLines) { pt(page6, line, leftMargin + 36, ty, 10, helveticaBold, rgb(0.106, 0.169, 0.294)); ty -= 13; }
    for (const line of whyLines)    { pt(page6, line, leftMargin + 36, ty, 8.5, helvetica, rgb(0.35, 0.35, 0.35)); ty -= 12; }
    if (goalLines.length > 0) {
      page6.drawRectangle({ x: leftMargin + 36, y: ty - 12, width: Math.min(helvetica.widthOfTextAtSize(goalLines[0], 8) + 10, contentWidth - 60), height: 12, color: rgb(0.906, 0.980, 0.969) });
      for (const line of goalLines) { pt(page6, line, leftMargin + 40, ty, 8, helvetica, rgb(0.059, 0.608, 0.557)); ty -= 11; }
    }

    y6 -= cardHeight + 8;
  }

  // ── Discussion points ─────────────────────────────────────────────────────
  if (discPoints.length > 0 && y6 > FTR_H + 40) {
    pt(page6, "Discussion Points for Client Meeting", leftMargin, y6, 10, helveticaBold, rgb(0.106, 0.169, 0.294));
    y6 -= 12;

    // Section background
    const dpSectionTop = y6;
    const dpCards: Array<{ top: number; lines: string[] }> = [];
    let dpY = y6;
    for (let i = 0; i < Math.min(discPoints.length, 4) && dpY > FTR_H + 30; i++) {
      const lines = wrapLines(discPoints[i], helvetica, 8.5, contentWidth - 36);
      const h = Math.max(24, lines.length * 12 + 10);
      dpCards.push({ top: dpY, lines });
      dpY -= h + 6;
    }

    // Section background strip
    if (dpCards.length > 0) {
      const sectionH = dpSectionTop - dpY + 6;
      page6.drawRectangle({ x: leftMargin - 6, y: dpY, width: contentWidth + 12, height: sectionH, color: rgb(0.974, 0.976, 0.980) });

      for (let i = 0; i < dpCards.length; i++) {
        const dp = dpCards[i];
        const dph = Math.max(24, dp.lines.length * 12 + 10);
        // White card
        page6.drawRectangle({ x: leftMargin, y: dp.top - dph, width: contentWidth, height: dph, color: rgb(1, 1, 1), borderColor: rgb(0.878, 0.878, 0.878), borderWidth: 0.5 });
        // Teal number circle
        page6.drawCircle({ x: leftMargin + 12, y: dp.top - dph / 2, size: 8, color: rgb(0.059, 0.608, 0.557) });
        const nw = helveticaBold.widthOfTextAtSize(String(i + 1), 8);
        pt(page6, String(i + 1), leftMargin + 12 - nw / 2, dp.top - dph / 2 - 4, 8, helveticaBold, rgb(1, 1, 1));
        // Text
        let ty = dp.top - 9;
        for (const line of dp.lines) { pt(page6, line, leftMargin + 26, ty, 8.5, helvetica, rgb(0.1, 0.1, 0.1)); ty -= 12; }
      }
    }
  }

  // ── Next period metrics ───────────────────────────────────────────────────
  if (nextPeriodMetrics.length > 0 && y6 > FTR_H + 60) {
    pt(page6, "Metrics to Introduce Next Period", leftMargin, y6, 10, helveticaBold, rgb(0.106, 0.169, 0.294));
    y6 -= 12;
    const nmCols = [contentWidth * 0.3, contentWidth * 0.56, contentWidth * 0.14];
    y6 = drawTableHeader(page6, ["Metric", "Why", "Priority"], nmCols, leftMargin, y6, 13, helveticaBold);
    for (let i = 0; i < nextPeriodMetrics.length; i++) {
      const m = nextPeriodMetrics[i];
      const rowH = 13;
      const totalW = nmCols.reduce((a, b) => a + b, 0);
      page6.drawRectangle({ x: leftMargin, y: y6 - rowH, width: totalW, height: rowH, color: i % 2 === 0 ? rgb(1, 1, 1) : rgb(0.976, 0.980, 0.984), borderColor: rgb(0.878, 0.878, 0.878), borderWidth: 0.3 });
      pt(page6, san((m.metric || "").slice(0, 22)), leftMargin + 4, y6 - rowH + 4, 8, helveticaBold, rgb(0.1, 0.1, 0.1));
      pt(page6, san((m.why || "").slice(0, 55)), leftMargin + nmCols[0] + 4, y6 - rowH + 4, 8, helvetica, rgb(0.45, 0.45, 0.45));
      drawRagDot(page6, leftMargin + nmCols[0] + nmCols[1] + nmCols[2] / 2, y6 - rowH / 2, m.priority || "grey");
      y6 -= rowH;
    }
  }

  drawPageHeader(page6, helvetica, company, periodLabel, dateRange, pageWidth, pageHeight);
  drawPageFooter(page6, helvetica, 6, 6, pageWidth);
  console.log("[PDF] Page 6 done — saving...");

  const bytes = await pdfDoc.save();
  console.log("[PDF] Done. Size:", (bytes.length / 1024).toFixed(1), "KB");
  return bytes;
}
