import { PDFDocument, rgb, StandardFonts } from "pdf-lib";

interface ValuationData {
  id: number;
  valuationType: string;
  firmName: string;
  firstName: string;
  lastName: string;
  grf: number;
  clientCount: number;
  ebitdaPercent: number;
  technicalDependency: string;
  relationshipDependency: string;
  ownerHoursPerWeek: string;
  teamStructure: string;
  niche: string;
  nicheOther?: string | null;
  clientTenure?: number | null;
  churnRate?: number | null;
  conservativeValuation: number;
  midValuation: number;
  optimisticValuation: number;
  adjustedMultiple: number;
  technicalNormalisationAmount: number;
  ownerDrawingsNormalisationAmount?: number;
  relationshipRiskDiscount: number;
  normalisedEbitda: number;
  method?: string;
  methodLabel?: string;
  keyFactors: string[];
  improvementActions: { title: string; impact: string; ptHelp: string }[];
  benchmarkData?: {
    count: number;
    avgMid: number;
    avgGrf: number;
    avgEbitda: number;
    topAction: string | null;
  };
}

function formatCurrency(n: number): string {
  const rounded = Math.round(n / 1000) * 1000;
  return "£" + rounded.toLocaleString("en-GB");
}

const NICHE_LABELS: Record<string, string> = {
  general: "General Practice",
  medical_dental: "Medical & Dental",
  property_developers: "Property & Real Estate",
  technology: "Technology & Startups",
  hospitality_leisure: "Hospitality & Leisure",
  construction_trades: "Construction & Trades",
  professional_services: "Professional Services",
  retail_ecommerce: "Retail & E-commerce",
  charities_nfp: "Charities & Not-for-Profit",
};

function formatNiche(niche: string, nicheOther?: string | null): string {
  if (niche === "Other") return nicheOther || "Other";
  return NICHE_LABELS[niche] || niche;
}

function wrapText(text: string, maxWidth: number, font: any, fontSize: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const test = current ? current + " " + word : word;
    const width = font.widthOfTextAtSize(test, fontSize);
    if (width > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);
  return lines;
}

export async function generateValuationPdf(data: ValuationData): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontReg = await pdfDoc.embedFont(StandardFonts.Helvetica);

  const addPage = () => {
    const page = pdfDoc.addPage([595, 842]);
    return { page, y: 800 };
  };

  const BLUE = rgb(3 / 255, 92 / 255, 130 / 255);
  const DARK = rgb(0.1, 0.1, 0.1);
  const GRAY = rgb(0.5, 0.5, 0.5);
  const LIGHT_BLUE_BG = rgb(0.93, 0.97, 1.0);
  const YELLOW_BG = rgb(1.0, 0.97, 0.88);
  const WHITE = rgb(1, 1, 1);
  const GREEN = rgb(0.05, 0.6, 0.3);
  const RED_BG = rgb(1.0, 0.93, 0.93);
  const AMBER_BG = rgb(1.0, 0.97, 0.88);
  const GREEN_BG = rgb(0.90, 1.0, 0.93);
  const RED_TEXT = rgb(0.7, 0.15, 0.1);
  const AMBER_TEXT = rgb(0.55, 0.35, 0.0);
  const GREEN_TEXT = rgb(0.05, 0.45, 0.2);

  const pageW = 595;
  const margin = 50;
  const contentW = pageW - margin * 2;

  let { page, y } = addPage();

  const newPage = () => {
    const added = addPage();
    page = added.page;
    y = added.y;
  };

  const checkY = (needed: number) => {
    if (y - needed < 60) newPage();
  };

  // Header bar
  page.drawRectangle({ x: 0, y: 810, width: pageW, height: 32, color: BLUE });
  page.drawText("Practice Toolbox", { x: margin, y: 820, size: 14, font: fontBold, color: WHITE });
  page.drawText("www.practicetoolbox.co.uk", { x: pageW - margin - 130, y: 822, size: 9, font: fontReg, color: rgb(0.8, 0.9, 1) });

  y = 785;

  // Report title
  const isAcquisition = data.valuationType === "acquisition_target";
  const reportTitle = isAcquisition ? "Acquisition Valuation Report" : "Practice Valuation Report";
  page.drawText(reportTitle, { x: margin, y, size: 22, font: fontBold, color: BLUE });
  y -= 24;

  page.drawText(data.firmName, { x: margin, y, size: 16, font: fontBold, color: DARK });
  y -= 18;

  const month = new Date().toLocaleString("en-GB", { month: "long", year: "numeric" });
  page.drawText(`Prepared: ${month}  ·  ${data.firstName} ${data.lastName}`, { x: margin, y, size: 10, font: fontReg, color: GRAY });
  y -= 14;

  if (data.methodLabel) {
    const methodLines = wrapText(`Methodology: ${data.methodLabel}`, contentW, fontReg, 9);
    for (const line of methodLines) {
      page.drawText(line, { x: margin, y, size: 9, font: fontReg, color: GRAY });
      y -= 11;
    }
  }

  y -= 8;

  // Divider
  page.drawRectangle({ x: margin, y, width: contentW, height: 1, color: BLUE });
  y -= 20;

  // --- VALUATION RANGE BOX ---
  const boxH = 110;
  page.drawRectangle({ x: margin, y: y - boxH, width: contentW, height: boxH, color: LIGHT_BLUE_BG, borderColor: BLUE, borderWidth: 1 });

  page.drawText("Estimated Valuation Range", { x: margin + 12, y: y - 18, size: 11, font: fontBold, color: BLUE });

  const colW = contentW / 3;
  const labels = ["Conservative", "Mid-Market", "Optimistic"];
  const values = [data.conservativeValuation, data.midValuation, data.optimisticValuation];

  labels.forEach((label, i) => {
    const cx = margin + i * colW + colW / 2;
    const isMid = i === 1;
    page.drawText(label, { x: cx - fontReg.widthOfTextAtSize(label, 9) / 2, y: y - 38, size: 9, font: fontReg, color: GRAY });
    const valStr = formatCurrency(values[i]);
    const valSize = isMid ? 19 : 15;
    const valFont = isMid ? fontBold : fontReg;
    const valColor = isMid ? BLUE : DARK;
    page.drawText(valStr, { x: cx - valFont.widthOfTextAtSize(valStr, valSize) / 2, y: y - 60, size: valSize, font: valFont, color: valColor });
    if (isMid) {
      page.drawText(">> Primary estimate", { x: cx - fontReg.widthOfTextAtSize(">> Primary estimate", 8) / 2, y: y - 76, size: 8, font: fontReg, color: BLUE });
    }
  });

  page.drawText(`Based on current market conditions for UK accounting practices · ${month}`, {
    x: margin + 12, y: y - boxH + 8, size: 8, font: fontReg, color: GRAY,
  });

  y -= boxH + 20;

  // --- KEY INPUTS ---
  page.drawText("Key Inputs", { x: margin, y, size: 13, font: fontBold, color: DARK });
  y -= 16;

  const rawEbitda = data.grf * (data.ebitdaPercent / 100);
  const inputs: [string, string][] = [
    ["Gross Recurring Fees (GRF)", formatCurrency(data.grf)],
    ["Number of Clients", data.clientCount.toString()],
    ["Adjusted EBITDA Margin", `${data.ebitdaPercent}%`],
    ["Raw Adjusted EBITDA", formatCurrency(rawEbitda)],
  ];

  if ((data.ownerDrawingsNormalisationAmount ?? 0) > 0) {
    inputs.push(["Owner Drawings Normalisation", `-£${(data.ownerDrawingsNormalisationAmount!).toLocaleString("en-GB")} (market-rate owner salary)`]);
  }
  if (data.technicalNormalisationAmount > 0) {
    inputs.push(["Technical Normalisation", `-£${data.technicalNormalisationAmount.toLocaleString("en-GB")} (owner replacement cost)`]);
  }
  if ((data.ownerDrawingsNormalisationAmount ?? 0) > 0 || data.technicalNormalisationAmount > 0) {
    inputs.push(["Normalised Adjusted EBITDA", formatCurrency(data.normalisedEbitda)]);
  }

  if (data.relationshipRiskDiscount > 0) {
    inputs.push(["Relationship Risk Discount", `-${data.relationshipRiskDiscount.toFixed(2)}x from Adjusted EBITDA multiple`]);
  }

  inputs.push(["Adjusted Multiple Applied", `${data.adjustedMultiple.toFixed(2)}x`]);
  inputs.push(["Niche", formatNiche(data.niche, data.nicheOther)]);

  inputs.forEach(([label, value]) => {
    checkY(14);
    page.drawText(`${label}:`, { x: margin + 8, y, size: 10, font: fontReg, color: DARK });
    page.drawText(value, { x: margin + 220, y, size: 10, font: fontBold, color: DARK });
    y -= 14;
  });

  if (data.technicalNormalisationAmount > 0 || data.relationshipRiskDiscount > 0) {
    checkY(24);
    const noteText = "This reflects the cost of replacing the owner's technical work and the risk of client attrition during transition.";
    const noteLines = wrapText(noteText, contentW - 16, fontReg, 8);
    for (const line of noteLines) {
      page.drawText(line, { x: margin + 8, y, size: 8, font: fontReg, color: GRAY });
      y -= 11;
    }
  }

  y -= 16;

  // --- KEY FACTORS ---
  checkY(40);
  page.drawText("What's Affecting Your Valuation", { x: margin, y, size: 13, font: fontBold, color: DARK });
  y -= 16;

  if (data.keyFactors.length === 0) {
    page.drawText("Your practice has strong fundamentals. The main opportunity is continued growth in fees and team depth.", {
      x: margin + 8, y, size: 10, font: fontReg, color: GREEN,
    });
    y -= 16;
  } else {
    for (const factor of data.keyFactors) {
      checkY(30);
      const lines = wrapText(`• ${factor}`, contentW - 20, fontReg, 10);
      for (const line of lines) {
        page.drawText(line, { x: margin + 8, y, size: 10, font: fontReg, color: rgb(0.7, 0.2, 0.1) });
        y -= 14;
      }
      y -= 2;
    }
  }

  y -= 16;

  // --- IMPROVEMENT ACTIONS ---
  checkY(50);
  page.drawText("How to Increase Your Valuation", { x: margin, y, size: 13, font: fontBold, color: DARK });
  y -= 16;

  for (let i = 0; i < data.improvementActions.length; i++) {
    const action = data.improvementActions[i];
    checkY(80);

    page.drawText(`${i + 1}. ${action.title}`, { x: margin, y, size: 11, font: fontBold, color: BLUE });
    y -= 15;

    const impactLines = wrapText(action.impact, contentW - 16, fontReg, 10);
    for (const line of impactLines) {
      checkY(14);
      page.drawText(line, { x: margin + 8, y, size: 10, font: fontReg, color: DARK });
      y -= 14;
    }
    y -= 4;

    const ptLines = wrapText(`Practice Toolbox: ${action.ptHelp}`, contentW - 24, fontReg, 9);
    const boxH2 = ptLines.length * 13 + 12;
    checkY(boxH2 + 10);
    page.drawRectangle({ x: margin, y: y - boxH2, width: contentW, height: boxH2, color: YELLOW_BG, borderColor: rgb(0.95, 0.8, 0.3), borderWidth: 1 });
    let ly = y - 10;
    for (const line of ptLines) {
      page.drawText(line, { x: margin + 8, y: ly, size: 9, font: fontReg, color: rgb(0.4, 0.3, 0) });
      ly -= 13;
    }
    y -= boxH2 + 14;
  }

  // --- ACQUISITION RISK ASSESSMENT (acquisition targets only) ---
  if (isAcquisition) {
    checkY(60);
    newPage();

    page.drawRectangle({ x: 0, y: 810, width: pageW, height: 32, color: BLUE });
    page.drawText("Practice Toolbox", { x: margin, y: 820, size: 14, font: fontBold, color: WHITE });
    page.drawText("www.practicetoolbox.co.uk", { x: pageW - margin - 130, y: 822, size: 9, font: fontReg, color: rgb(0.8, 0.9, 1) });

    page.drawText("Acquisition Risk Assessment", { x: margin, y, size: 16, font: fontBold, color: BLUE });
    y -= 14;
    page.drawText(`${data.firmName}  ·  ${month}`, { x: margin, y, size: 10, font: fontReg, color: GRAY });
    y -= 20;
    page.drawRectangle({ x: margin, y, width: contentW, height: 1, color: BLUE });
    y -= 20;

    // RAG ratings
    type RagLevel = "High" | "Medium" | "Low";

    const isSmallAcquisition = data.grf < 200000 && data.valuationType === "acquisition_target";

    function techRisk(): RagLevel {
      // Small practices being absorbed into an existing firm: High → Medium
      // The buyer's team absorbs the technical work with a handover period, no senior hire needed
      if (data.technicalDependency === "yes") return isSmallAcquisition ? "Medium" : "High";
      if (data.technicalDependency === "partial") return "Medium";
      return "Low";
    }
    function relRisk(): RagLevel {
      if (data.relationshipDependency === "owner") return "High";
      if (data.relationshipDependency === "mixed") return "Medium";
      return "Low";
    }
    function finRisk(): RagLevel {
      const ddBad = data.ebitdaPercent < 15;
      return ddBad ? "High" : data.ebitdaPercent < 25 ? "Medium" : "Low";
    }

    const ragItems: { label: string; level: RagLevel; mitigation: string }[] = [
      {
        label: "Technical Risk",
        level: techRisk(),
        mitigation: techRisk() === "High"
          ? "Budget £30–40k for a senior hire. Build a 3–6 month handover period into the deal structure."
          : techRisk() === "Medium"
          ? isSmallAcquisition
            ? "At this size technical work can typically be absorbed into an existing practice with minimal additional cost. Allow a 3–6 month handover period for knowledge transfer."
            : "Budget £10,000 for additional senior resource. Plan a structured handover of technical review work."
          : "",
      },
      {
        label: "Relationship Risk",
        level: relRisk(),
        mitigation: relRisk() === "High"
          ? "Consider an earnout structure where part of the purchase price is paid over 12–24 months based on client retention. Structure a formal introduction programme for all key clients within the first 90 days."
          : relRisk() === "Medium"
          ? "Identify owner-led clients and build a transition plan to introduce team members before completion."
          : "",
      },
      {
        label: "Financial Risk",
        level: finRisk(),
        mitigation: finRisk() === "High"
          ? "Prioritise moving clients to Direct Debit within the first 60 days. Review all fees against market rates within 90 days."
          : finRisk() === "Medium"
          ? "Review client fee rates against market benchmarks and identify underpriced accounts to address post-acquisition."
          : "",
      },
    ];

    const ragColor = (level: RagLevel) => {
      if (level === "High") return RED_BG;
      if (level === "Medium") return AMBER_BG;
      return GREEN_BG;
    };
    const ragTextColor = (level: RagLevel) => {
      if (level === "High") return RED_TEXT;
      if (level === "Medium") return AMBER_TEXT;
      return GREEN_TEXT;
    };

    for (const item of ragItems) {
      checkY(60);
      const mitigLines = item.mitigation ? wrapText(`Recommended action: ${item.mitigation}`, contentW - 24, fontReg, 9) : [];
      const itemH = 28 + (mitigLines.length > 0 ? mitigLines.length * 13 + 14 : 0);
      page.drawRectangle({ x: margin, y: y - itemH, width: contentW, height: itemH, color: ragColor(item.level), borderColor: rgb(0.85, 0.85, 0.85), borderWidth: 0.5 });

      // Label and level pill
      page.drawText(item.label, { x: margin + 10, y: y - 16, size: 11, font: fontBold, color: DARK });
      const pillLabel = item.level;
      const pillW = fontBold.widthOfTextAtSize(pillLabel, 10) + 16;
      page.drawRectangle({ x: pageW - margin - pillW - 10, y: y - 22, width: pillW, height: 16, color: ragTextColor(item.level) });
      page.drawText(pillLabel, { x: pageW - margin - pillW - 10 + 8, y: y - 16, size: 10, font: fontBold, color: WHITE });

      if (mitigLines.length > 0) {
        let my = y - 34;
        for (const line of mitigLines) {
          page.drawText(line, { x: margin + 10, y: my, size: 9, font: fontReg, color: DARK });
          my -= 13;
        }
      }

      y -= itemH + 8;
    }

    y -= 10;

    // Buyer's perspective note
    checkY(50);
    page.drawText("Buyer's Perspective — What to Focus On", { x: margin, y, size: 13, font: fontBold, color: DARK });
    y -= 16;

    page.drawText("Areas where the asking price may be inflated:", { x: margin + 8, y, size: 10, font: fontBold, color: DARK });
    y -= 14;
    page.drawText("• Multiples above 6x for general practices without systemisation", { x: margin + 12, y, size: 10, font: fontReg, color: DARK });
    y -= 13;
    page.drawText("• Owner-dependent practices priced as if the owner stays long-term", { x: margin + 12, y, size: 10, font: fontReg, color: DARK });
    y -= 13;
    // Only show EBITDA normalisation bullet for non-GRF-method practices (blended/EBITDA).
    // For small GRF-method practices the EBITDA method does not apply — this bullet is misleading.
    if (data.method !== "grf") {
      page.drawText("• EBITDA figures that have not been normalised for owner salary/replacement", { x: margin + 12, y, size: 10, font: fontReg, color: DARK });
      y -= 13;
    }
    y -= 7;

    // Clawback recommendation: show for acquisition targets where relationship risk is High or Medium
    if (relRisk() === "High" || relRisk() === "Medium") {
      checkY(60);
      const clawbackText = "Client retention risk: A clawback clause is strongly recommended. Structure the deal so that 20-30% of the purchase price is held back for 12 months and adjusted based on actual client retention. This protects the buyer against the natural client attrition that occurs during ownership transition. Without a clawback you are paying for clients who may not transfer.";
      const clawLines = wrapText(clawbackText, contentW - 24, fontReg, 9);
      const clawH = clawLines.length * 12 + 16;
      page.drawRectangle({ x: margin, y: y - clawH, width: contentW, height: clawH, color: rgb(1, 0.97, 0.93), borderColor: rgb(0.9, 0.6, 0.2), borderWidth: 0.75 });
      let cy = y - 10;
      for (const line of clawLines) {
        page.drawText(line, { x: margin + 10, y: cy, size: 9, font: fontReg, color: DARK });
        cy -= 12;
      }
      y -= clawH + 8;
    }
    y -= 5;
  }

  // --- BENCHMARKING SECTION (only if 10+ confirmed submissions) ---
  if (data.benchmarkData && data.benchmarkData.count >= 10) {
    const bm = data.benchmarkData;
    checkY(120);
    y -= 10;
    page.drawText("How Your Practice Compares", { x: margin, y, size: 13, font: fontBold, color: DARK });
    y -= 14;
    const basedOnLine = `Based on ${bm.count} practices that have used this tool:`;
    page.drawText(basedOnLine, { x: margin + 8, y, size: 10, font: fontReg, color: GRAY });
    y -= 16;

    const benchRows: [string, string][] = [
      ["Average practice valuation", formatCurrency(bm.avgMid)],
      ["Average recurring fees", formatCurrency(bm.avgGrf)],
      ["Average profit margin", `${Math.round(bm.avgEbitda)}%`],
    ];
    if (bm.topAction) benchRows.push(["Most common improvement opportunity", bm.topAction]);

    for (const [label, value] of benchRows) {
      checkY(14);
      page.drawText(`${label}:`, { x: margin + 8, y, size: 10, font: fontReg, color: DARK });
      page.drawText(value, { x: margin + 260, y, size: 10, font: fontBold, color: DARK });
      y -= 14;
    }

    y -= 6;
    const yourMid = formatCurrency(data.midValuation);
    const avgMid = formatCurrency(bm.avgMid);
    const comparison = data.midValuation >= bm.avgMid ? "above" : "below";
    const compColor = data.midValuation >= bm.avgMid ? GREEN : rgb(0.7, 0.2, 0.1);
    const compLine = `Your mid-market valuation of ${yourMid} is ${comparison} the average of ${avgMid}`;
    const compLines = wrapText(compLine, contentW - 16, fontReg, 10);
    for (const line of compLines) {
      checkY(14);
      page.drawText(line, { x: margin + 8, y, size: 10, font: fontBold, color: compColor });
      y -= 14;
    }
    y -= 16;
  }

  // --- CTA ---
  checkY(60);
  y -= 10;
  page.drawRectangle({ x: margin, y: y - 50, width: contentW, height: 50, color: BLUE });
  const ctaText = "Practice Toolbox helps accounting firms improve the metrics that drive practice value.";
  const ctaLines = wrapText(ctaText, contentW - 24, fontReg, 10);
  let ctaY = y - 14;
  for (const line of ctaLines) {
    page.drawText(line, { x: margin + 12, y: ctaY, size: 10, font: fontReg, color: WHITE });
    ctaY -= 14;
  }
  page.drawText("Visit www.practicetoolbox.co.uk", { x: margin + 12, y: ctaY, size: 10, font: fontBold, color: rgb(0.8, 0.9, 1) });
  y -= 64;

  // Disclaimer
  checkY(30);
  y -= 6;
  const disclaimer = "This valuation is an estimate based on publicly available market data for UK accounting practice sales. It is not a formal valuation and should not be relied upon for legal or financial purposes.";
  const disclaimerLines = wrapText(disclaimer, contentW, fontReg, 8);
  for (const line of disclaimerLines) {
    page.drawText(line, { x: margin, y, size: 8, font: fontReg, color: GRAY });
    y -= 11;
  }

  return await pdfDoc.save();
}
