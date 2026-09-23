import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated, requirePermission, requireTeamAccess, requireOrganisation, requireSuperAdmin } from "./auth";
import express from "express";
import { insertTeamSchema, insertWeeklyTargetSchema, insertWeeklyResultSchema, insertAccountsDueSchema, insertVatTargetSchema, insertVatResultSchema, insertVatDueSchema, insertVatTurnoverChecksSchema, insertHealthChecksTargetSchema, insertHealthChecksResultSchema, insertHealthChecksDueSchema, insertMbsDextPrecisionSchema, insertMbsOldestItemsSchema, insertClientDextPrecisionSchema, insertClientOldestItemsSchema, insertConfirmationStatementsTargetSchema, insertConfirmationStatementsResultSchema, insertConfirmationStatementsDueSchema, insertConfirmationStatementTurnaroundSchema, insertTaxDataSchema, insertRevenueAnalyticsTargetSchema, insertRevenueAnalyticsResultSchema, insertRiskAnalysisSchema, insertActionRecommendationSchema, insertClarifyingQuestionSchema, insertTeamResponseSchema, insertUserInvitationSchema, insertQuarterlyGoalSchema, insertQuarterlyTargetSchema, insertValueSchema, insertRockReminderDismissalSchema, insertClientValueClientSchema, insertReportClientSchema, insertStrategicPlanSchema, insertManagementReportPeriodSchema, insertManagementReportSchema, insertCoachingActionSchema } from "@shared/schema";
import { z } from "zod";
import { getCacheKey, getFromCache, setInCache, invalidateCache } from "./cache";
import { aiAnalysisService } from "./ai-analysis";
import { sendInvitationEmail } from "./email-service";
import { sendTestEmail } from "./test-email";
import { getCurrentTaxYear, formatTaxYear } from "./tax-year-utils";
import { stripe, PLANS, getPlanLimits, getUpgradeMessage, ensureStripeProducts, getOrCreateStripeCustomer, getPlanFromPrice } from "./stripe-service";
import { generateValuationPdf } from "./valuation-pdf";
import { generateAiReport, generateReportStructure } from "./management-reports-ai";
import { generateManagementReportPdf } from "./management-reports-pdf";
import { generatePDFBuffer } from "./pdf-service";
import { registerEmailAnalyticsRoutes } from "./email-analytics-routes";

/** Strip sensitive DB columns before sending a user record to the client. */
function safeUser(user: Record<string, any>) {
  const { password, invitationToken, invitationExpires, resetToken, resetExpires, ...rest } = user;
  return rest;
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Set up CORS and other middleware
  app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    if (req.method === "OPTIONS") {
      return res.sendStatus(200);
    }
    next();
  });

  app.use(express.json());

  // Auth middleware
  await setupAuth(app);

  // Global authentication middleware for all /api/* routes
  // Excludes public auth routes that don't require login
  const publicRoutes: Array<{ method: string; path: string }> = [
    { method: 'POST', path: '/api/login' },
    { method: 'POST', path: '/api/logout' },
    { method: 'POST', path: '/api/register' },
    { method: 'POST', path: '/api/forgot-password' },
    { method: 'POST', path: '/api/reset-password' },
    { method: 'POST', path: '/api/complete-invitation' },
    { method: 'POST', path: '/api/signup' },
    { method: 'POST', path: '/api/waitlist' },
    { method: 'POST', path: '/api/valuation/submit' },
    { method: 'POST', path: '/api/valuation/confirm' },
    { method: 'POST', path: '/api/valuation/event' },
    { method: 'GET', path: '/api/valuation/pdf/:id' },
    { method: 'HEAD', path: '/api/valuation/pdf/:id' },
  ];

  app.use('/api', (req: any, res, next) => {
    // Normalize path: remove trailing slash and get the full API path
    const requestPath = '/api' + req.path.replace(/\/$/, '');
    
    // Check if this is a public route (supports exact match and :param patterns)
    const isPublicRoute = publicRoutes.some(route => {
      if (route.method !== req.method) return false;
      // Convert :param segments to a regex for matching
      const pattern = route.path.replace(/:[^/]+/g, '[^/]+');
      return new RegExp(`^${pattern}$`, 'i').test(requestPath);
    });
    
    if (isPublicRoute) {
      return next();
    }
    
    // Require authentication for all other /api routes
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    // Attach organisationId from the authenticated user to the request
    if (req.user?.organisationId) {
      req.organisationId = req.user.organisationId;
    }
    
    next();
  });

  registerEmailAnalyticsRoutes(app);

  // ── Platform Admin Routes (superadmin only) ──────────────────────────────
  // ── Public waitlist endpoint ──────────────────────────────────────────
  app.post('/api/waitlist', async (req, res) => {
    try {
      const { firstName, lastName, firmName, email, phone, practiceSize, message } = req.body;
      if (!firstName || !lastName || !firmName || !email) {
        return res.status(400).json({ message: "First name, last name, firm name, and email are required" });
      }
      const existing = await storage.getWaitlistRegistrationByEmail(email.toLowerCase().trim());
      if (existing) {
        return res.status(409).json({ duplicate: true, message: "Email already registered" });
      }
      const reg = await storage.createWaitlistRegistration({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        firmName: firmName.trim(),
        email: email.toLowerCase().trim(),
        phone: phone?.trim() || null,
        practiceSize: practiceSize || null,
        message: message?.trim() || null,
      });


      return res.status(201).json(reg);
    } catch (err: any) {
      console.error("Waitlist registration error:", err);
      return res.status(500).json({ message: "Failed to save registration" });
    }
  });

  app.get('/api/platform-admin/waitlist', requireSuperAdmin, async (_req, res) => {
    try {
      const regs = await storage.getAllWaitlistRegistrations();
      return res.json(regs.reverse());
    } catch (err) {
      console.error('[route]', err);
      return res.status(500).json({ message: "Failed to fetch waitlist" });
    }
  });

  app.delete('/api/platform-admin/waitlist/:id', requireSuperAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid id" });
      await storage.deleteWaitlistRegistration(id);
      return res.json({ success: true });
    } catch (err) {
      console.error('[route]', err);
      return res.status(500).json({ message: "Failed to delete registration" });
    }
  });

  // ── Valuation Tool ──────────────────────────────────────────────────────────

  // ── Valuation calculation logic (updated methodology) ────────────────────────
  type ValuationMethod = 'grf' | 'ebitda' | 'blended';
  type NicheType = 'general' | 'niche' | 'dental';

  function getNicheType(niche: string): NicheType {
    if (niche === 'general') return 'general';
    if (niche === 'medical_dental') return 'dental';
    return 'niche';
  }

  function getDerivedOwnerDep(hoursPerWeek: string, relDep: string): string {
    if (hoursPerWeek === 'under_20' && relDep === 'team') return '1_7';
    if (hoursPerWeek === '60_plus' || hoursPerWeek === '45_60') return '30_plus';
    return '8_30';
  }

  function determineMethod(grf: number, derivedOwnerDep: string, teamStructure: string): ValuationMethod {
    if (grf < 200_000) return 'grf';
    if (grf >= 500_000) return 'ebitda';
    // 200k–500k: depends on dependency and team
    const lowDep = derivedOwnerDep === '1_7';
    const strongTeam = teamStructure === '2_plus_managers';
    if (lowDep || strongTeam) return 'ebitda';
    return 'blended';
  }

  function getMethodLabel(method: ValuationMethod): string {
    if (method === 'grf') return 'Valued on recurring fee multiple. At this size practices typically trade based on recurring fee income regardless of owner involvement — buyers either run the practice themselves or absorb it into an existing firm.';
    if (method === 'ebitda') return 'Valued on EBITDA multiple — standard for established practices with management teams';
    return 'Blended valuation — reflects transition between owner-led and team-led practice';
  }

  function getGrfBaseMultiple(nicheType: NicheType): number {
    if (nicheType === 'dental') return 1.2;
    if (nicheType === 'niche') return 1.1;
    return 0.9;
  }

  function getEbitdaBaseMultiple(nicheType: NicheType): number {
    if (nicheType === 'dental') return 7;
    if (nicheType === 'niche') return 6;
    return 5;
  }

  function getDDGrfAdj(ddRate: string): number {
    if (ddRate === '90_plus') return 0.1;
    if (ddRate === '70_90') return 0;
    if (ddRate === '50_70') return -0.1;
    if (ddRate === 'under_50') return -0.2;
    if (ddRate === 'not_sure') return -0.05;
    return 0;
  }

  // Small practices (under £200k GRF): DD penalties applied at reduced weight.
  // A buyer absorbing the practice can fix DD collection quickly, so the penalty is lower.
  function getDDGrfAdjSmall(ddRate: string): number {
    if (ddRate === '90_plus') return 0.1;    // unchanged — reward for good DD
    if (ddRate === '70_90') return 0;        // unchanged
    if (ddRate === '50_70') return -0.05;    // reduced from -0.10
    if (ddRate === 'under_50') return -0.1;  // reduced from -0.20
    if (ddRate === 'not_sure') return -0.05; // unchanged
    return 0;
  }

  function getDDEbitdaAdj(ddRate: string): number {
    if (ddRate === '90_plus') return 0.25;
    if (ddRate === '70_90') return 0;
    if (ddRate === '50_70') return -0.25;
    if (ddRate === 'under_50') return -0.5;
    if (ddRate === 'not_sure') return -0.1;
    return 0;
  }

  function getTeamEbitdaAdj(teamStructure: string): number {
    if (teamStructure === '2_plus_managers') return 0.5;
    if (teamStructure === 'solo') return -0.5;
    return 0;
  }

  function getTechNormCost(techDep: string, hours: string): number {
    if (techDep === 'yes') {
      if (hours === '60_plus') return 40_000;
      if (hours === '45_60') return 25_000;
      if (hours === '35_45') return 15_000;
      return 10_000; // under_20 or 20_35 but still doing most technical work
    }
    if (techDep === 'partial') return 10_000;
    return 0;
  }

  function getRelEbitdaDiscount(relDep: string): number {
    if (relDep === 'owner') return -0.75;
    if (relDep === 'mixed') return -0.25;
    return 0;
  }

  function getRelGrfDiscount(relDep: string): number {
    if (relDep === 'owner') return -0.10;
    if (relDep === 'mixed') return -0.03;
    return 0;
  }

  // Small practice (under £200k): owner extraction is a positive signal, not a liability
  function getSmallPracticeOwnerAdj(hours: string): number {
    if (hours === 'under_20' || hours === '20_35') return 0.2; // well extracted — commands a premium
    if (hours === '35_45') return 0.1; // partially extracted — small premium
    return 0; // 45_60 or 60_plus — high involvement, no adjustment
  }

  // Owner drawings normalisation: if EBITDA is stated BEFORE owner drawings and owner works 35+ hrs,
  // subtract a market-rate salary to get a true picture of profitability.
  function getOwnerDrawingsNormalisation(ebitdaPrePost: string, hours: string): number {
    if (ebitdaPrePost !== 'before_drawings') return 0;
    if (hours === '60_plus') return 65_000;
    if (hours === '45_60') return 55_000;
    if (hours === '35_45') return 45_000;
    return 0; // under_20 / 20_35 — owner is not full-time; no normalisation applied
  }

  // Client concentration: multiple discount for revenue concentration in one client
  function getClientConcentrationAdj(concentration: string): number {
    if (concentration === '10_20') return -0.1;
    if (concentration === '20_30') return -0.25;
    if (concentration === '30_40') return -0.5;
    if (concentration === 'over_40') return -0.75;
    return 0; // under_10
  }

  // Cloud adoption: multiple adjustment for proportion of clients on cloud software
  function getCloudAdoptionAdj(adoption: string): number {
    if (adoption === '90_plus') return 0.15;
    if (adoption === '50_70') return -0.15;
    if (adoption === 'under_50') return -0.35;
    if (adoption === 'not_sure') return -0.1;
    return 0; // 70_90 — neutral
  }

  function calculateValuation(data: {
    grf: number; ebitdaPercent: number;
    technicalDependency: string; relationshipDependency: string; ownerHoursPerWeek: string;
    teamStructure: string; niche: string; ddCollectionRate: string;
    ebitdaPrePostDrawings: string; clientConcentration: string; cloudAdoptionPercent: string;
  }) {
    const nicheType = getNicheType(data.niche);
    const derivedOwnerDep = getDerivedOwnerDep(data.ownerHoursPerWeek, data.relationshipDependency);
    const method = determineMethod(data.grf, derivedOwnerDep, data.teamStructure);

    const rawEbitda = data.grf * (data.ebitdaPercent / 100);
    const techNormCost = getTechNormCost(data.technicalDependency, data.ownerHoursPerWeek);
    const ownerDrawingsNorm = getOwnerDrawingsNormalisation(data.ebitdaPrePostDrawings, data.ownerHoursPerWeek);
    const relEbitdaDisc = getRelEbitdaDiscount(data.relationshipDependency);
    const relGrfDisc = getRelGrfDiscount(data.relationshipDependency);
    const concAdj = getClientConcentrationAdj(data.clientConcentration);
    const cloudAdj = getCloudAdoptionAdj(data.cloudAdoptionPercent);

    let mid: number;
    let adjustedMultiple: number;
    let grfComponent: number | undefined;
    let ebitdaComponent: number | undefined;
    // Track amounts actually applied (differ by tier)
    let appliedTechNorm = 0;
    let appliedOwnerDrawingsNorm = 0;
    let appliedRelEbitdaDisc = 0;

    if (method === 'grf') {
      // Under £200k: no tech normalisation, no relationship risk discount.
      // Owner involvement signals profit potential for a self-employed buyer — use simple extraction adj.
      // DD penalty is reduced (buyer can fix DD collection quickly after absorption).
      const base = getGrfBaseMultiple(nicheType);
      const ddAdj = getDDGrfAdjSmall(data.ddCollectionRate);
      const ownerAdj = getSmallPracticeOwnerAdj(data.ownerHoursPerWeek);
      adjustedMultiple = Math.max(0.3, base + ddAdj + ownerAdj + concAdj + cloudAdj);
      mid = data.grf * adjustedMultiple;
      // No normalisation applied for small practices
      appliedTechNorm = 0;
      appliedOwnerDrawingsNorm = 0;
      appliedRelEbitdaDisc = 0;
    } else if (method === 'ebitda') {
      // Over £500k: full normalisation adjustments — standalone business valuation
      appliedTechNorm = techNormCost;
      appliedOwnerDrawingsNorm = ownerDrawingsNorm;
      appliedRelEbitdaDisc = relEbitdaDisc;
      const normEbitda = Math.max(0, rawEbitda - appliedTechNorm - appliedOwnerDrawingsNorm);
      const base = getEbitdaBaseMultiple(nicheType);
      const teamAdj = getTeamEbitdaAdj(data.teamStructure);
      const ddAdj = getDDEbitdaAdj(data.ddCollectionRate);
      const totalMultiple = Math.max(1, base + teamAdj + ddAdj + appliedRelEbitdaDisc + concAdj + cloudAdj);
      adjustedMultiple = totalMultiple;
      mid = normEbitda * totalMultiple;
    } else {
      // Blended £200k–£500k: normalisation adjustments at 50% of full value
      // (some buyers will absorb, some will standalone)
      appliedTechNorm = techNormCost * 0.5;
      appliedOwnerDrawingsNorm = ownerDrawingsNorm * 0.5;
      appliedRelEbitdaDisc = relEbitdaDisc * 0.5;
      const blendedRelGrfDisc = relGrfDisc * 0.5;
      const normEbitdaBlended = Math.max(0, rawEbitda - appliedTechNorm - appliedOwnerDrawingsNorm);

      const grfBase = getGrfBaseMultiple(nicheType);
      const grfDDAdj = getDDGrfAdj(data.ddCollectionRate);
      const grfMultiple = Math.max(0.3, grfBase + grfDDAdj + blendedRelGrfDisc + concAdj + cloudAdj);
      grfComponent = data.grf * grfMultiple;

      const ebitdaBase = getEbitdaBaseMultiple(nicheType);
      const ebitdaTeamAdj = getTeamEbitdaAdj(data.teamStructure);
      const ebitdaDDAdj = getDDEbitdaAdj(data.ddCollectionRate);
      const ebitdaMultiple = Math.max(1, ebitdaBase + ebitdaTeamAdj + ebitdaDDAdj + appliedRelEbitdaDisc + concAdj + cloudAdj);
      ebitdaComponent = normEbitdaBlended * ebitdaMultiple;

      mid = (grfComponent + ebitdaComponent) / 2;
      adjustedMultiple = mid / data.grf;
    }

    const conservative = mid * 0.85;
    const optimistic = mid * 1.15;
    const methodLabel = getMethodLabel(method);
    const normalisedEbitda = Math.max(0, rawEbitda - appliedTechNorm - appliedOwnerDrawingsNorm);

    return {
      method,
      methodLabel,
      adjustedMultiple,
      conservativeValuation: conservative,
      midValuation: mid,
      optimisticValuation: optimistic,
      grfComponent,
      ebitdaComponent,
      technicalNormalisationAmount: appliedTechNorm,
      ownerDrawingsNormalisationAmount: appliedOwnerDrawingsNorm,
      relationshipRiskDiscount: Math.abs(appliedRelEbitdaDisc),
      normalisedEbitda,
    };
  }

  function getKeyFactors(data: {
    grf: number; ebitdaPercent: number;
    technicalDependency: string; relationshipDependency: string; ownerHoursPerWeek: string;
    teamStructure: string; ddCollectionRate: string; method: ValuationMethod;
    midValuation: number; adjustedMultiple: number;
    technicalNormalisationAmount: number; relationshipRiskDiscount: number;
    clientConcentration: string; cloudAdoptionPercent: string;
    ebitdaPrePostDrawings: string; ownerDrawingsNormalisationAmount: number;
  }): string[] {
    const factors: string[] = [];
    const isSmallPractice = data.method === 'grf';

    if (isSmallPractice) {
      // Small practices (under £200k): owner involvement is a profit signal, not a liability.
      // Show extraction premium if applicable; suppress owner/technical dependency negatives.
      if (data.ownerHoursPerWeek === 'under_20' || data.ownerHoursPerWeek === '20_35') {
        factors.push('Good owner extraction — the owner works under 35 hours per week. At this size, a well-extracted practice commands a small premium on the GRF multiple, as it signals the business can run without full-time owner involvement.');
      } else if (data.ownerHoursPerWeek === '35_45') {
        factors.push('Partial owner extraction — the owner works 35–45 hours per week. Reducing involvement further would improve the GRF multiple applied.');
      }
    } else {
      // Blended and EBITDA: show full relationship and technical dependency factors
      if (data.relationshipDependency === 'owner') {
        factors.push('High relationship dependency — clients are loyal to the owner personally. This is the most significant risk factor in any acquisition. Budget for a structured handover period of 12–24 months and consider an earnout structure to protect against client attrition.');
      } else if (data.relationshipDependency === 'mixed') {
        factors.push('Mixed relationship dependency — some clients are owner-led. Structuring a formal client introduction programme to team members before sale will improve buyer confidence.');
      }

      if (data.technicalDependency === 'yes') {
        factors.push(`Technical dependency — the owner delivers most of the client work. Replacing this requires a hire at £25–40k depending on the level of work involved. A technical normalisation of £${data.technicalNormalisationAmount.toLocaleString('en-GB')} has been applied to reflect this cost.`);
      } else if (data.technicalDependency === 'partial') {
        factors.push(`Technical dependency (partial) — the owner still reviews and signs off client work. A £${data.technicalNormalisationAmount.toLocaleString('en-GB')} normalisation has been applied for the cost of hiring additional senior resource to cover this.`);
      }
    }

    // Team structure (relevant for all tiers)
    if (!isSmallPractice && data.teamStructure === 'solo') {
      factors.push('No management team — solo practices carry higher transition risk and buyers typically apply a larger discount');
    }

    // EBITDA
    if (data.ebitdaPercent < 15) {
      factors.push('Below-average profitability — EBITDA margin under 15% compresses the valuation multiple significantly');
    }

    // DD collection rate (negative)
    if (data.ddCollectionRate === 'under_50' || data.ddCollectionRate === '50_70') {
      const ddAdj = data.method === 'grf' ? getDDGrfAdjSmall(data.ddCollectionRate) : getDDEbitdaAdj(data.ddCollectionRate);
      const bestAdj = data.method === 'grf' ? getDDGrfAdjSmall('90_plus') : getDDEbitdaAdj('90_plus');
      const ebitda = data.grf * (data.ebitdaPercent / 100);
      const uplift = data.method === 'grf'
        ? data.grf * (bestAdj - ddAdj)
        : ebitda * (bestAdj - ddAdj);
      factors.push(`Low Direct Debit collection rate — buyers pay a premium for predictable recurring income. Moving to 90%+ DD collection could add ${formatCurrencyFactor(uplift)} to your valuation`);
    } else if (data.ddCollectionRate === 'not_sure') {
      factors.push('Uncertain Direct Debit collection rate — not knowing your DD rate is itself a risk signal. Tracking and improving this could add meaningfully to your valuation');
    }

    // Client concentration
    if (data.clientConcentration === 'over_40') {
      factors.push('Critical risk — client concentration: your largest client represents over 40% of revenue. Buyers will significantly discount the price or make a large portion of the consideration subject to that client being retained post-acquisition.');
    } else if (data.clientConcentration === '30_40') {
      factors.push('High client concentration — your largest client represents 30–40% of revenue. Buyers apply a significant discount for this concentration risk, as losing that client post-sale would materially impact profitability.');
    } else if (data.clientConcentration === '20_30') {
      factors.push('Elevated client concentration — your largest client represents 20–30% of revenue. Buyers will apply a moderate discount; reducing this dependency before a sale would improve the valuation meaningfully.');
    }

    // Cloud adoption (negative)
    if (data.cloudAdoptionPercent === 'under_50') {
      factors.push('Low cloud adoption — fewer than half your clients use cloud accounting software. Buyers factor in the cost and disruption of migrating the client base, applying a meaningful discount to the multiple.');
    } else if (data.cloudAdoptionPercent === 'not_sure') {
      factors.push('Uncertain cloud adoption level — not tracking your cloud adoption rate signals operational immaturity to buyers. Quantify and improve this before going to market.');
    }

    // Owner drawings normalisation
    if (data.ebitdaPrePostDrawings === 'before_drawings' && data.ownerDrawingsNormalisationAmount > 0) {
      factors.push(`Adjusted EBITDA normalised for owner drawings — your EBITDA was stated before owner drawings. A market-rate owner salary of £${data.ownerDrawingsNormalisationAmount.toLocaleString('en-GB')} has been deducted to reflect the true economic profitability a buyer would inherit.`);
    }

    return factors;
  }

  function formatCurrencyFactor(n: number): string {
    if (n >= 1_000_000) return `£${(n / 1_000_000).toFixed(2)}m`;
    if (n >= 1_000) return `£${Math.round(n / 1_000)}k`;
    return `£${Math.round(n)}`;
  }

  function getPositiveFactors(data: {
    technicalDependency: string; relationshipDependency: string; ownerHoursPerWeek: string;
    teamStructure: string; ddCollectionRate: string; ebitdaPercent: number;
    clientConcentration: string; cloudAdoptionPercent: string;
  }): string[] {
    const positives: string[] = [];
    if (data.ddCollectionRate === '90_plus') {
      positives.push('High DD collection rate — strong recurring revenue profile commands buyer confidence');
    }
    if (data.relationshipDependency === 'team') {
      positives.push('Low relationship dependency — clients have strong relationships with the team, not just the owner. Buyers pay a premium for this.');
    }
    if (data.technicalDependency === 'no') {
      positives.push('Team delivers all technical work independently — no replacement cost required. This significantly de-risks the acquisition.');
    }
    if (data.teamStructure === '2_plus_managers') {
      positives.push('Strong management team — 2+ managers signals a scalable, buyer-ready business');
    }
    if (data.ebitdaPercent >= 35) {
      positives.push('Strong profitability margin — EBITDA above 35% puts you in the top tier for practice valuations');
    }
    if (data.cloudAdoptionPercent === '90_plus') {
      positives.push('Excellent cloud adoption — 90%+ of clients on cloud software. This is a premium signal for buyers: lower migration costs, better data quality, and a more scalable practice.');
    } else if (data.cloudAdoptionPercent === '70_90') {
      positives.push('Strong cloud adoption — 70–90% of clients on cloud software signals a modern, buyer-ready practice.');
    }
    if (data.clientConcentration === 'under_10') {
      positives.push('Low client concentration — no single client represents more than 10% of revenue. A diversified client base is a strong positive signal for buyers.');
    }
    return positives;
  }

  function getImprovementActions(data: {
    grf: number; ebitdaPercent: number;
    technicalDependency: string; relationshipDependency: string; ownerHoursPerWeek: string;
    teamStructure: string; ddCollectionRate: string; method: ValuationMethod;
  }) {
    const actions: { title: string; impact: string; ptHelp: string }[] = [];

    // DD collection rate improvement (highest priority if below 70%)
    if (['under_50', '50_70', 'not_sure'].includes(data.ddCollectionRate)) {
      const currentAdj = data.method === 'grf' ? getDDGrfAdjSmall(data.ddCollectionRate) : getDDEbitdaAdj(data.ddCollectionRate);
      const bestAdj = data.method === 'grf' ? getDDGrfAdjSmall('90_plus') : getDDEbitdaAdj('90_plus');
      const ebitda = data.grf * (data.ebitdaPercent / 100);
      const uplift = data.method === 'grf' ? data.grf * (bestAdj - currentAdj) : ebitda * (bestAdj - currentAdj);
      actions.push({
        title: 'Move Clients to Direct Debit',
        impact: `Increasing your DD collection rate to 90%+ could add approximately ${formatCurrencyFactor(uplift)} to your mid-market valuation. Buyers pay a premium for predictable, recurring income that doesn't require chasing.`,
        ptHelp: 'Practice Toolbox helps you track client payment profiles, making it easier to identify and migrate clients to recurring payment arrangements.'
      });
    }

    const isSmallPractice = data.method === 'grf';

    // Relationship and technical dependency actions only apply to larger practices
    if (!isSmallPractice) {
      if (data.relationshipDependency === 'owner' || data.relationshipDependency === 'mixed') {
        actions.push({
          title: data.relationshipDependency === 'owner' ? 'Transition Client Relationships to the Team' : 'Strengthen Team-Led Client Relationships',
          impact: data.relationshipDependency === 'owner'
            ? 'Moving from owner-held to team-held relationships removes the single biggest buyer risk and removes the 0.75x relationship discount from your EBITDA multiple. This is the highest-value action you can take.'
            : 'Moving from mixed to team-led relationships removes the 0.25x relationship discount from your EBITDA multiple and significantly improves buyer confidence during transition.',
          ptHelp: 'Practice Toolbox tracks team performance so you can identify high performers ready to take on client relationships.'
        });
      }

      if (data.technicalDependency === 'yes') {
        actions.push({
          title: 'Build a Senior Technical Team',
          impact: 'Hiring a qualified accountant or senior bookkeeper to deliver the technical work the owner currently does removes the technical normalisation cost from your valuation and increases the effective EBITDA multiple.',
          ptHelp: "Practice Toolbox's performance dashboards help you build accountability into your team structure and identify who is ready for technical leadership."
        });
      }

      if (data.teamStructure !== '2_plus_managers') {
        actions.push({
          title: data.teamStructure === 'solo' ? 'Build Your First Management Layer' : 'Develop a Second Manager',
          impact: 'Having 2+ managers in place can qualify your practice for EBITDA-based valuation at the £200k–£500k GRF range, which often delivers a significantly higher outcome.',
          ptHelp: "Practice Toolbox's dashboards create team visibility and accountability, making it easier to develop managers from within."
        });
      }
    }

    // Profitability
    if (data.ebitdaPercent < 25) {
      actions.push({
        title: 'Improve Profitability Margin',
        impact: 'A 10-percentage-point improvement in EBITDA margin directly increases the EBITDA figure that your multiple is applied to, compounding the effect on valuation.',
        ptHelp: 'The Client Value Manager helps you identify low-margin clients and quantify fee improvement opportunities.'
      });
    }

    return actions.slice(0, 3);
  }

  // ── PDF generation helper — called from submit and from retry scheduler ──
  async function generateAndStorePdfForSubmission(subId: number): Promise<string> {
    const sub = await storage.getValuationSubmission(subId);
    if (!sub) throw new Error(`Submission ${subId} not found`);

    const grfNum = parseFloat(String(sub.grf));
    const ebitdaNum = parseFloat(String(sub.ebitdaPercent));
    const tenureNum = sub.clientTenure ? parseFloat(String(sub.clientTenure)) : null;
    const churnNum = sub.churnRate ? parseFloat(String(sub.churnRate)) : null;
    const techDep = (sub as any).technicalDependency || 'partial';
    const relDep = (sub as any).relationshipDependency || 'mixed';
    const hoursPerWeek = (sub as any).ownerHoursPerWeek || '35_45';
    const ddRate = (sub as any).ddCollectionRate || '70_90';
    const ebitdaPrePost = (sub as any).ebitdaPrePostDrawings || 'after_drawings';
    const clientConc = (sub as any).clientConcentration || 'under_10';
    const cloudAdopt = (sub as any).cloudAdoptionPercent || '70_90';
    const teamStr = sub.teamStructure;

    const calcResult = calculateValuation({
      grf: grfNum, ebitdaPercent: ebitdaNum,
      technicalDependency: techDep, relationshipDependency: relDep, ownerHoursPerWeek: hoursPerWeek,
      teamStructure: teamStr, niche: sub.niche, ddCollectionRate: ddRate,
      ebitdaPrePostDrawings: ebitdaPrePost, clientConcentration: clientConc, cloudAdoptionPercent: cloudAdopt,
    });
    const { method, methodLabel, relationshipRiskDiscount, normalisedEbitda } = calcResult;
    const conservativeValuation = Math.round(calcResult.conservativeValuation);
    const midValuation = Math.round(calcResult.midValuation);
    const optimisticValuation = Math.round(calcResult.optimisticValuation);
    const adjustedMultiple = Math.round(calcResult.adjustedMultiple * 100) / 100;
    const technicalNormalisationAmount = Math.round(calcResult.technicalNormalisationAmount);
    const ownerDrawingsNormAmt = Math.round(calcResult.ownerDrawingsNormalisationAmount);

    const keyFactors = getKeyFactors({
      grf: grfNum, ebitdaPercent: ebitdaNum, technicalDependency: techDep, relationshipDependency: relDep,
      ownerHoursPerWeek: hoursPerWeek, teamStructure: teamStr, ddCollectionRate: ddRate,
      method, midValuation, adjustedMultiple, technicalNormalisationAmount, relationshipRiskDiscount,
      clientConcentration: clientConc, cloudAdoptionPercent: cloudAdopt,
      ebitdaPrePostDrawings: ebitdaPrePost, ownerDrawingsNormalisationAmount: ownerDrawingsNormAmt,
    });
    const improvementActions = getImprovementActions({
      grf: grfNum, ebitdaPercent: ebitdaNum, technicalDependency: techDep, relationshipDependency: relDep,
      ownerHoursPerWeek: hoursPerWeek, teamStructure: teamStr, ddCollectionRate: ddRate, method,
    });

    const benchmarks = await storage.getConfirmedValuationBenchmarks();
    const appBaseUrl = process.env.APP_URL || 'https://app.practicetoolbox.co.uk';

    const pdfBytes = await generateValuationPdf({
      id: subId, valuationType: sub.valuationType, firmName: sub.firmName,
      firstName: sub.firstName, lastName: sub.lastName,
      grf: grfNum, clientCount: sub.clientCount, ebitdaPercent: ebitdaNum,
      technicalDependency: techDep, relationshipDependency: relDep, ownerHoursPerWeek: hoursPerWeek,
      teamStructure: teamStr, niche: sub.niche, nicheOther: sub.nicheOther,
      clientTenure: tenureNum, churnRate: churnNum,
      conservativeValuation, midValuation, optimisticValuation,
      adjustedMultiple, technicalNormalisationAmount, ownerDrawingsNormalisationAmount: ownerDrawingsNormAmt,
      relationshipRiskDiscount, normalisedEbitda,
      method, methodLabel, keyFactors, improvementActions,
      benchmarkData: benchmarks.count >= 10 ? benchmarks : undefined,
    });

    const pdfBase64 = Buffer.from(pdfBytes).toString('base64');
    const pdfRelUrl = `/valuations/${subId}.pdf`;
    const pdfFullUrl = `${appBaseUrl}${pdfRelUrl}`;

    await storage.updateValuationSubmission(subId, { pdfUrl: pdfRelUrl, pdfData: pdfBase64 } as any);
    console.log(`[PDF] Generated and stored in DB for id=${subId}`);
    return pdfFullUrl;
  }

  // ── Retry PDF generation in background up to 3 times, 60s apart ──
  function schedulePdfRetry(subId: number, attempt: number = 1): void {
    if (attempt > 3) {
      console.error(`[PDF Retry] Giving up after 3 attempts for id=${subId}`);
      return;
    }
    setTimeout(async () => {
      try {
        console.log(`[PDF Retry] Attempt ${attempt} for id=${subId}`);
        await generateAndStorePdfForSubmission(subId);
        console.log(`[PDF Retry] Success on attempt ${attempt} for id=${subId}`);
      } catch (err) {
        console.error(`[PDF Retry] Attempt ${attempt} failed for id=${subId}:`, err);
        schedulePdfRetry(subId, attempt + 1);
      }
    }, 60_000);
  }

  // ── PDF status endpoint (used by frontend polling) ──
  app.get('/api/valuation/pdf-status/:id', async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: 'Invalid id' });
    const sub = await storage.getValuationSubmission(id);
    if (!sub) return res.status(404).json({ message: 'Not found' });
    const appBaseUrl = process.env.APP_URL || 'https://app.practicetoolbox.co.uk';
    return res.json({ pdfReady: !!sub.pdfUrl, pdfUrl: sub.pdfUrl ? `${appBaseUrl}${sub.pdfUrl}` : null });
  });

  app.post('/api/valuation/submit', async (req, res) => {
    try {
      const {
        valuationType, firstName, lastName, email, phone, firmName,
        grf, clientCount, ebitdaPercent,
        technicalDependency, relationshipDependency, ownerHoursPerWeek,
        teamStructure, niche, nicheOther, ddCollectionRate, clientTenure, churnRate, consentGiven,
        ebitdaPrePostDrawings, clientConcentration, cloudAdoptionPercent,
      } = req.body;

      // Basic validation
      if (!firstName || !lastName || !email || !firmName || !grf || !clientCount || !ebitdaPercent
        || !technicalDependency || !relationshipDependency || !ownerHoursPerWeek
        || !teamStructure || !niche || !ddCollectionRate
        || !ebitdaPrePostDrawings || !clientConcentration || !cloudAdoptionPercent) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      const grfNum = parseFloat(grf);
      const clientCountNum = parseInt(clientCount);
      const ebitdaNum = parseFloat(ebitdaPercent);
      const tenureNum = clientTenure ? parseFloat(clientTenure) : undefined;
      const churnNum = churnRate !== undefined && churnRate !== null && churnRate !== '' ? parseFloat(churnRate) : undefined;

      const calcResult = calculateValuation({
        grf: grfNum, ebitdaPercent: ebitdaNum,
        technicalDependency, relationshipDependency, ownerHoursPerWeek,
        teamStructure, niche, ddCollectionRate,
        ebitdaPrePostDrawings, clientConcentration, cloudAdoptionPercent,
      });

      const { method, methodLabel, relationshipRiskDiscount, normalisedEbitda } = calcResult;
      const conservativeValuation = Math.round(calcResult.conservativeValuation);
      const midValuation = Math.round(calcResult.midValuation);
      const optimisticValuation = Math.round(calcResult.optimisticValuation);
      const adjustedMultiple = Math.round(calcResult.adjustedMultiple * 100) / 100;
      const technicalNormalisationAmount = Math.round(calcResult.technicalNormalisationAmount);
      const ownerDrawingsNormalisationAmount = Math.round(calcResult.ownerDrawingsNormalisationAmount);

      const keyFactors = getKeyFactors({
        grf: grfNum, ebitdaPercent: ebitdaNum,
        technicalDependency, relationshipDependency, ownerHoursPerWeek,
        teamStructure, ddCollectionRate, method, midValuation, adjustedMultiple,
        technicalNormalisationAmount, relationshipRiskDiscount,
        clientConcentration, cloudAdoptionPercent, ebitdaPrePostDrawings,
        ownerDrawingsNormalisationAmount,
      });
      const positiveFactors = getPositiveFactors({
        technicalDependency, relationshipDependency, ownerHoursPerWeek,
        teamStructure, ddCollectionRate, ebitdaPercent: ebitdaNum,
        clientConcentration, cloudAdoptionPercent,
      });
      const improvementActions = getImprovementActions({
        grf: grfNum, ebitdaPercent: ebitdaNum,
        technicalDependency, relationshipDependency, ownerHoursPerWeek,
        teamStructure, ddCollectionRate, method,
      });

      const sub = await storage.createValuationSubmission({
        valuationType: valuationType || 'own_practice',
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.toLowerCase().trim(),
        phone: phone?.trim() || null,
        firmName: firmName.trim(),
        grf: grfNum.toString(),
        clientCount: clientCountNum,
        ebitdaPercent: ebitdaNum.toString(),
        ownerDependency: null,
        technicalDependency,
        relationshipDependency,
        ownerHoursPerWeek,
        teamStructure,
        niche,
        nicheOther: nicheOther?.trim() || null,
        ddCollectionRate,
        clientTenure: tenureNum?.toString() || null,
        churnRate: churnNum?.toString() || null,
        conservativeValuation: String(conservativeValuation),
        midValuation: String(midValuation),
        optimisticValuation: String(optimisticValuation),
        adjustedMultiple: String(adjustedMultiple),
        technicalNormalisationAmount: String(technicalNormalisationAmount),
        relationshipRiskDiscount: String(Math.round(relationshipRiskDiscount * 10000) / 10000),
        pdfUrl: null,
        consentGiven: !!consentGiven,
        improvementAction1: improvementActions[0]?.title || null,
        improvementAction2: improvementActions[1]?.title || null,
        improvementAction3: improvementActions[2]?.title || null,
        ebitdaPrePostDrawings: ebitdaPrePostDrawings || null,
        clientConcentration: clientConcentration || null,
        cloudAdoptionPercent: cloudAdoptionPercent || null,
        ownerDrawingsNormalisationAmount: ownerDrawingsNormalisationAmount > 0 ? String(ownerDrawingsNormalisationAmount) : null,
      });

      await storage.logValuationEvent(sub.id, 'form_submitted');

      // ── Generate PDF immediately — stored in DB, URL returned in response ──
      let pdfFullUrl: string | null = null;
      try {
        pdfFullUrl = await generateAndStorePdfForSubmission(sub.id);
      } catch (pdfErr) {
        console.error(`[PDF] Generation failed on submit for id=${sub.id}:`, pdfErr);
        // Schedule background retries until the PDF is generated and stored.
        schedulePdfRetry(sub.id);
      }


      return res.status(201).json({
        id: sub.id,
        email: sub.email,
        pdfUrl: pdfFullUrl,
        method,
        methodLabel,
        adjustedMultiple,
        conservativeValuation,
        midValuation,
        optimisticValuation,
        technicalNormalisationAmount,
        ownerDrawingsNormalisationAmount,
        relationshipRiskDiscount,
        normalisedEbitda,
        keyFactors,
        positiveFactors,
        improvementActions,
      });
    } catch (err: any) {
      console.error('Valuation submit error:', err);
      return res.status(500).json({ message: 'Failed to process valuation' });
    }
  });

  // ── Confirm valuation email ─────────────────────────────────────────────
  app.post('/api/valuation/confirm', async (req, res) => {
    try {
      const { submissionId, confirmedEmail } = req.body;
      if (!submissionId || !confirmedEmail) {
        return res.status(400).json({ message: 'submissionId and confirmedEmail required' });
      }

      const sub = await storage.getValuationSubmission(Number(submissionId));
      if (!sub) return res.status(404).json({ message: 'Submission not found' });

      const normalised = confirmedEmail.toLowerCase().trim();
      const sameEmail = normalised === sub.email.toLowerCase().trim();

      if (sameEmail) {
        // Email unchanged — the PDF is already generated.
        await storage.logValuationEvent(sub.id, 'email_confirmed_same');
        return res.json({ ok: true, sameEmail: true });
      }

      // Different email — retain the corrected email on the submission.
      const appBaseUrl = process.env.APP_URL || 'https://app.practicetoolbox.co.uk';
      const pdfFullUrl = sub.pdfUrl ? `${appBaseUrl}${sub.pdfUrl}` : null;

      await storage.updateValuationSubmission(sub.id, {
        emailConfirmed: true,
        confirmedEmail: normalised,
      } as any);

      await storage.logValuationEvent(sub.id, 'email_confirmed');

      return res.json({ ok: true, sameEmail: false, pdfUrl: pdfFullUrl });
    } catch (err: any) {
      console.error('Valuation confirm error:', err);
      return res.status(500).json({ message: 'Failed to process confirmation' });
    }
  });

  app.post('/api/valuation/event', async (req, res) => {
    try {
      const { submissionId, eventType } = req.body;
      if (!eventType) return res.status(400).json({ message: 'eventType required' });
      await storage.logValuationEvent(submissionId || null, eventType);
      return res.json({ ok: true });
    } catch (err) {
      console.error('[route]', err);
      return res.status(500).json({ message: 'Failed to log event' });
    }
  });

  // Legacy redirect — kept for backward compatibility
  app.get('/api/valuation/pdf/:id', (req, res) => {
    res.redirect(`/valuations/${req.params.id}.pdf`);
  });

  // Public PDF endpoint — serves PDF bytes from database, no auth required
  app.get('/valuations/:id.pdf', async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).send('Invalid id');

      const sub = await storage.getValuationSubmission(id);
      if (!sub) return res.status(404).send('Submission not found');

      const pdfData = (sub as any).pdfData as string | null;
      if (!pdfData) {
        return res.status(404).send('PDF not yet generated. Please use the "Send my report" button to generate your PDF.');
      }

      const pdfBuffer = Buffer.from(pdfData, 'base64');
      await storage.logValuationEvent(id, 'pdf_downloaded');

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="valuation-${id}.pdf"`);
      res.setHeader('Content-Length', pdfBuffer.length);
      return res.send(pdfBuffer);
    } catch (err) {
      console.error('[PDF] Error serving pdf:', err);
      return res.status(500).send('Failed to retrieve PDF');
    }
  });

  app.get('/api/platform-admin/valuations', requireSuperAdmin, async (_req, res) => {
    try {
      const subs = await storage.getAllValuationSubmissions();
      return res.json(subs);
    } catch (err) {
      console.error('[route]', err);
      return res.status(500).json({ message: 'Failed to fetch valuations' });
    }
  });

  app.delete('/api/platform-admin/valuations/:id', requireSuperAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid id" });
      await storage.deleteValuationSubmission(id);
      return res.json({ success: true });
    } catch (err) {
      console.error('[route]', err);
      return res.status(500).json({ message: "Failed to delete submission" });
    }
  });

  // Regenerate PDF for a specific submission (superadmin only)
  app.post('/api/platform-admin/valuations/:id/regenerate-pdf', requireSuperAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: 'Invalid id' });
      const pdfFullUrl = await generateAndStorePdfForSubmission(id);
      return res.json({ ok: true, pdfUrl: pdfFullUrl });
    } catch (err) {
      console.error('[PDF] Error regenerating PDF:', err);
      return res.status(500).json({ message: 'Failed to regenerate PDF' });
    }
  });

  // ── End Valuation Tool ───────────────────────────────────────────────────────

  app.get('/api/platform-admin/organisations', requireSuperAdmin, async (_req, res) => {
    try {
      const orgs = await storage.getOrganisationsWithStats();
      res.json(orgs);
    } catch (error) {
      console.error("Error fetching organisations:", error);
      res.status(500).json({ message: "Failed to fetch organisations" });
    }
  });

  app.post('/api/platform-admin/organisations', requireSuperAdmin, async (req, res) => {
    try {
      const { name } = req.body;
      if (!name) return res.status(400).json({ message: "Organisation name is required" });
      const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      const existing = await storage.getOrganisationBySlug(slug);
      const finalSlug = existing ? `${slug}-${Date.now()}` : slug;
      const org = await storage.createOrganisation({ name, slug: finalSlug, subscriptionStatus: 'trialling', isOnboardingComplete: true, isSuspended: false });
      res.status(201).json(org);
    } catch (error) {
      console.error("Error creating organisation:", error);
      res.status(500).json({ message: "Failed to create organisation" });
    }
  });

  app.patch('/api/platform-admin/organisations/:id/exempt', requireSuperAdmin, async (req, res) => {
    try {
      const { isExempt, exemptionReason } = req.body;
      const updated = await storage.updateOrganisation(Number(req.params.id), { isExempt, exemptionReason } as any);
      res.json(updated);
    } catch (error) {
      console.error("Error updating exemption:", error);
      res.status(500).json({ message: "Failed to update exemption" });
    }
  });

  app.patch('/api/platform-admin/organisations/:id/suspend', requireSuperAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { isSuspended } = req.body;
      const org = await storage.updateOrganisation(id, { isSuspended });
      if (!org) return res.status(404).json({ message: "Organisation not found" });
      res.json(org);
    } catch (error) {
      console.error("Error suspending organisation:", error);
      res.status(500).json({ message: "Failed to update organisation" });
    }
  });

  app.delete('/api/platform-admin/organisations/:id', requireSuperAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteOrganisation(id);
      res.sendStatus(204);
    } catch (error) {
      console.error("Error deleting organisation:", error);
      res.status(500).json({ message: "Failed to delete organisation" });
    }
  });

  // ── Organisation settings (admin of the org) ─────────────────────────────
  app.get('/api/organisation', isAuthenticated, async (req: any, res) => {
    try {
      if (req.user.role === 'superadmin') return res.status(403).json({ message: "Superadmin has no org" });
      const org = await storage.getOrganisation(req.user.organisationId);
      if (!org) return res.status(404).json({ message: "Organisation not found" });
      res.json(org);
    } catch (error) {
      console.error('[route]', error);
      res.status(500).json({ message: "Failed to fetch organisation" });
    }
  });

  app.put('/api/organisation', requirePermission('manage_users'), async (req: any, res) => {
    try {
      const {
        name, logoUrl, phone, address, city, postcode, website, practiceType,
        vatCompletionDay, mgmtAccountsDay, bookkeepingUpperThreshold, bookkeepingLowerThreshold,
        bookkeepingPlatform, bookkeepingPlatformCustom,
      } = req.body;
      const updateData: any = { name, logoUrl, phone, address, city, postcode, website, practiceType };
      if (vatCompletionDay !== undefined) updateData.vatCompletionDay = Number(vatCompletionDay);
      if (mgmtAccountsDay !== undefined) updateData.mgmtAccountsDay = Number(mgmtAccountsDay);
      if (bookkeepingUpperThreshold !== undefined) updateData.bookkeepingUpperThreshold = Number(bookkeepingUpperThreshold);
      if (bookkeepingLowerThreshold !== undefined) updateData.bookkeepingLowerThreshold = Number(bookkeepingLowerThreshold);
      if (bookkeepingPlatform !== undefined) updateData.bookkeepingPlatform = bookkeepingPlatform;
      if (bookkeepingPlatformCustom !== undefined) updateData.bookkeepingPlatformCustom = bookkeepingPlatformCustom || null;
      const org = await storage.updateOrganisation(req.organisationId, updateData);
      if (!org) return res.status(404).json({ message: "Organisation not found" });
      res.json(org);
    } catch (error) {
      console.error('[route]', error);
      res.status(500).json({ message: "Failed to update organisation" });
    }
  });

  // ── Onboarding ───────────────────────────────────────────────────────────
  app.post('/api/onboarding/complete', isAuthenticated, async (req: any, res) => {
    try {
      if (!req.user.organisationId) return res.status(403).json({ message: "No organisation" });
      await storage.completeOnboarding(req.user.organisationId);
      res.json({ success: true });
    } catch (error) {
      console.error('[route]', error);
      res.status(500).json({ message: "Failed to complete onboarding" });
    }
  });

  // Create first team during onboarding
  app.post('/api/onboarding/team', isAuthenticated, async (req: any, res) => {
    try {
      if (!req.user.organisationId) return res.status(403).json({ message: "No organisation" });
      const { name, description } = req.body;
      if (!name) return res.status(400).json({ message: "Team name is required" });
      const team = await storage.createTeam({ name, description: description || null, organisationId: req.user.organisationId });
      res.status(201).json(team);
    } catch (error) {
      console.error('[route]', error);
      res.status(500).json({ message: "Failed to create team" });
    }
  });

  // User management routes (admin only)
  app.get('/api/users', requirePermission('manage_users'), async (req: any, res) => {
    try {
      const users = await storage.getAllUsers(req.organisationId);
      res.json(users.map(safeUser));
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  // Slim member list for assignment dropdowns — available to all authenticated users
  app.get('/api/users/members', requirePermission('view_dashboard'), async (req: any, res) => {
    try {
      const users = await storage.getAllUsers(req.organisationId);
      res.json(users.map(({ id, firstName, lastName }) => ({ id, firstName, lastName })));
    } catch (error) {
      console.error("Error fetching members:", error);
      res.status(500).json({ message: "Failed to fetch members" });
    }
  });

  // Create user invitation (admin only)
  app.post('/api/users/invite', requirePermission('manage_users'), async (req: any, res) => {
    try {
      console.log("Received invitation request:", req.body);

      // Plan limit enforcement (skipped for exempt orgs)
      const orgId = req.organisationId;
      if (orgId) {
        const org = await storage.getOrganisation(orgId);
        if (org && !(org as any).isExempt) {
          const limits = getPlanLimits((org as any).subscriptionPlan, org.subscriptionStatus);
          if (limits.userLimit !== null) {
            const existingUsers = await storage.getAllUsers(orgId);
            if (existingUsers.length >= limits.userLimit) {
              return res.status(403).json({
                message: getUpgradeMessage((org as any).subscriptionPlan, "user"),
                limitReached: true,
              });
            }
          }
        }
      }

      const userData = insertUserInvitationSchema.parse(req.body);
      console.log("Parsed user data:", userData);
      
      // Check if user already exists
      const existingUser = await storage.getUserByEmail(userData.email);
      let user;
      if (existingUser && (!orgId || existingUser.organisationId !== null)) {
        console.log("User already exists:", userData.email);
        return res.status(400).json({ message: "User with this email already exists" });
      } else if (existingUser) {
        console.log("Reissuing invitation for unassigned user:", userData.email);
        user = await storage.reissueUserInvitation(existingUser.id, {
          ...userData,
          organisationId: orgId,
        });
        if (!user) {
          return res.status(409).json({ message: "This user was assigned elsewhere. Refresh the user list and try again." });
        }
      } else {
        console.log("Creating user invitation...");
        user = await storage.createUserInvitation({ ...userData, organisationId: orgId ?? undefined });
      }

      console.log("User invitation created:", user.email);
      
      // Send invitation email
      console.log("Sending invitation email...");
      const emailSent = await sendInvitationEmail({
        to: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        invitationToken: user.invitationToken!,
        inviterName: req.user?.firstName ? `${req.user.firstName} ${req.user.lastName || ''}`.trim() : 'Practice Toolbox Admin'
      });
      
      if (!emailSent) {
        console.error("Failed to send invitation email to:", user.email);
        // Still return success since user was created, just mention email issue
        return res.status(201).json({ 
          message: "User invitation created successfully, but email delivery failed. Please contact the user directly with their invitation details.",
          user: {
            id: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            role: user.role,
            isActive: user.isActive,
          },
          emailSent: false
        });
      }
      
      console.log("Invitation email sent successfully to:", user.email);
      res.status(201).json({ 
        message: "User invitation created and email sent successfully",
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          isActive: user.isActive,
        },
        emailSent: true
      });
    } catch (error) {
      console.error("Error creating user invitation:", error);
      if (error instanceof Error) {
        console.error("Error message:", error.message);
        console.error("Error stack:", error.stack);
      }
      res.status(500).json({ 
        message: "Failed to create user invitation",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Complete invitation endpoint
  app.post("/api/complete-invitation", async (req, res) => {
    try {
      const { token, password } = req.body;
      
      if (!token || !password) {
        return res.status(400).json({ message: "Token and password are required" });
      }

      const result = await storage.completeInvitation(token, password);
      
      if (!result) {
        return res.status(400).json({ message: "Invalid or expired invitation token" });
      }

      res.json({ message: "Account setup completed successfully! You can now log in." });
    } catch (error) {
      console.error("Error completing invitation:", error);
      res.status(500).json({ message: "Failed to complete account setup" });
    }
  });

  // Test email endpoint (admin only)
  app.post("/api/test-email", requirePermission('manage_users'), async (req, res) => {
    try {
      const { email } = req.body;
      
      if (!email) {
        return res.status(400).json({ message: "Email address is required" });
      }

      console.log(`Admin ${req.user?.email} requesting test email to: ${email}`);
      const emailSent = await sendTestEmail(email);
      
      if (!emailSent) {
        return res.status(500).json({ message: "Failed to send test email" });
      }

      res.json({ message: "Test email sent successfully" });
    } catch (error) {
      console.error("Error sending test email:", error);
      res.status(500).json({ message: "Failed to send test email" });
    }
  });

  app.put('/api/users/:id', requirePermission('manage_users'), async (req, res) => {
    try {
      const { id } = req.params;
      const { role, isActive, permissions } = req.body;
      
      const updatedUser = await storage.updateUser(parseInt(id), {
        role,
        isActive,
        permissions,
      });
      
      if (!updatedUser) {
        return res.status(404).json({ message: "User not found" });
      }
      
      res.json(safeUser(updatedUser as any));
    } catch (error) {
      console.error("Error updating user:", error);
      res.status(500).json({ message: "Failed to update user" });
    }
  });

  app.delete('/api/users/:id', requirePermission('manage_users'), async (req: any, res) => {
    try {
      const targetId = parseInt(req.params.id);
      if (isNaN(targetId)) return res.status(400).json({ message: "Invalid user ID" });

      // Prevent self-deletion
      if (req.user.id === targetId) {
        return res.status(400).json({ message: "You cannot delete your own account" });
      }

      // Ensure the target user belongs to the same organisation
      const targetUser = await storage.getUser(targetId);
      if (!targetUser) return res.status(404).json({ message: "User not found" });
      if (targetUser.organisationId !== req.user.organisationId) {
        return res.status(403).json({ message: "You can only delete users in your own organisation" });
      }

      await storage.deleteUser(targetId);
      res.json({ message: "User deleted successfully" });
    } catch (error) {
      console.error("Error deleting user:", error);
      res.status(500).json({ message: "Failed to delete user" });
    }
  });

  // Teams Routes (require view_dashboard permission)
  app.get("/api/teams", requirePermission('view_dashboard'), async (req: any, res) => {
    try {
      const orgId = req.organisationId;
      const cacheKey = getCacheKey(orgId ? `teams_org_${orgId}` : "teams");
      let teams = getFromCache(cacheKey);
      
      if (!teams) {
        teams = await storage.getAllTeams(orgId);
        setInCache(cacheKey, teams);
      }
      
      res.json(teams);
    } catch (error) {
      console.error("Error fetching teams:", error);
      res.status(500).json({ message: "Failed to fetch teams" });
    }
  });

  app.get("/api/teams/:id", requirePermission('view_dashboard'), requireTeamAccess(['paramsId']), async (req, res) => {
    try {
      const teamId = parseInt(req.params.id);
      const team = await storage.getTeam(teamId);
      if (!team) {
        return res.status(404).json({ message: "Team not found" });
      }
      res.json(team);
    } catch (error) {
      console.error('[route]', error);
      res.status(500).json({ message: "Failed to fetch team" });
    }
  });

  app.post("/api/teams", requirePermission('manage_teams'), async (req: any, res) => {
    try {
      const validatedData = insertTeamSchema.parse(req.body);
      const team = await storage.createTeam({ ...validatedData, organisationId: req.organisationId ?? null });
      res.status(201).json(team);
    } catch (error) {
      console.error('[route]', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create team" });
    }
  });

  app.put("/api/teams/:id", requirePermission('manage_teams'), requireTeamAccess(['paramsId']), async (req, res) => {
    try {
      const teamId = parseInt(req.params.id);
      const validatedData = insertTeamSchema.partial().parse(req.body);
      const updated = await storage.updateTeam(teamId, validatedData);
      
      if (!updated) {
        return res.status(404).json({ message: "Team not found" });
      }
      
      res.json(updated);
    } catch (error) {
      console.error('[route]', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update team" });
    }
  });

  app.delete("/api/teams/:id", requirePermission('manage_teams'), requireTeamAccess(['paramsId']), async (req, res) => {
    try {
      const teamId = parseInt(req.params.id);
      const team = await storage.getTeam(teamId);
      
      if (!team) {
        return res.status(404).json({ message: "Team not found" });
      }
      
      // Check for related data before deletion
      const hasWeeklyTargets = (await storage.getAllWeeklyTargets(teamId)).length > 0;
      const hasWeeklyResults = (await storage.getAllWeeklyResults(teamId)).length > 0;
      const hasAccountsDue = (await storage.getAllAccountsDue(teamId)).length > 0;
      const hasVatDue = (await storage.getAllVatDue(teamId)).length > 0;
      const hasHealthChecksData = (await storage.getAllHealthChecksDue(teamId)).length > 0;
      const hasConfirmationData = (await storage.getAllConfirmationStatementsDue(teamId)).length > 0;
      
      if (hasWeeklyTargets || hasWeeklyResults || hasAccountsDue || hasVatDue || hasHealthChecksData || hasConfirmationData) {
        return res.status(400).json({ 
          message: "Cannot delete team with existing data. Please remove all associated records first.",
          details: {
            weeklyTargets: hasWeeklyTargets,
            weeklyResults: hasWeeklyResults,
            accountsDue: hasAccountsDue,
            vatDue: hasVatDue,
            healthChecksData: hasHealthChecksData,
            confirmationData: hasConfirmationData
          }
        });
      }
      
      await storage.deleteTeam(teamId);
      res.json({ message: "Team deleted successfully" });
    } catch (error) {
      console.error("Delete team error:", error);
      res.status(500).json({ message: "Failed to delete team", error: error instanceof Error ? error.message : String(error) });
    }
  });

  // Overview Stats API - Aggregates performance metrics across all modules
  app.get("/api/overview-stats", requirePermission('view_dashboard'), async (req: any, res) => {
    try {
      const teams = await storage.getAllTeams(req.organisationId);
      
      // Get most recent completed week (previous Sunday if today is Sunday, otherwise most recent Sunday)
      const today = new Date();
      const dayOfWeek = today.getDay();
      const thisWeekEnd = new Date(today);
      // If today is Sunday (0), use previous Sunday to get completed week data
      const daysBack = dayOfWeek === 0 ? 7 : dayOfWeek;
      thisWeekEnd.setDate(today.getDate() - daysBack);
      const thisWeekStr = thisWeekEnd.toISOString().split('T')[0];
      
      // Short-term: previous week (7 days ago)
      const lastWeekEnd = new Date(thisWeekEnd);
      lastWeekEnd.setDate(lastWeekEnd.getDate() - 7);
      const lastWeekStr = lastWeekEnd.toISOString().split('T')[0];
      
      // Medium-term: 4 weeks ago (reliable week-based calculation)
      const oneMonthAgoEnd = new Date(thisWeekEnd);
      oneMonthAgoEnd.setDate(oneMonthAgoEnd.getDate() - 28); // 4 weeks
      const oneMonthAgoStr = oneMonthAgoEnd.toISOString().split('T')[0];
      
      // Long-term: 12 weeks ago (reliable week-based calculation)
      const threeMonthsAgoEnd = new Date(thisWeekEnd);
      threeMonthsAgoEnd.setDate(threeMonthsAgoEnd.getDate() - 84); // 12 weeks
      const threeMonthsAgoStr = threeMonthsAgoEnd.toISOString().split('T')[0];
      
      // Fetch all required data
      const [
        accountsDueData,
        taxDataAll,
        vatDueData,
        mbsDextData,
        clientDextData,
        confirmationTurnaround,
        healthChecksDueData
      ] = await Promise.all([
        storage.getAllAccountsDue(undefined, (req as any).organisationId),
        storage.getAllTaxData(undefined, (req as any).organisationId),
        storage.getAllVatDue(undefined, (req as any).organisationId),
        storage.getAllMbsDextPrecision(undefined, (req as any).organisationId),
        storage.getAllClientDextPrecision(undefined, (req as any).organisationId),
        storage.getAllConfirmationStatementTurnaround(undefined, (req as any).organisationId),
        storage.getAllHealthChecksDue(undefined, (req as any).organisationId)
      ]);
      
      // Helper to get most recent data for each team, with optional target week filter
      const getMostRecentByTeam = <T extends { weekEnding: string; teamId: number }>(
        data: T[], 
        beforeOrEqualWeek?: string
      ): Map<number, T> => {
        const teamMap = new Map<number, T>();
        const sorted = [...data].sort((a, b) => 
          new Date(b.weekEnding).getTime() - new Date(a.weekEnding).getTime()
        );
        for (const item of sorted) {
          if (beforeOrEqualWeek && item.weekEnding > beforeOrEqualWeek) continue;
          if (!teamMap.has(item.teamId)) {
            teamMap.set(item.teamId, item);
          }
        }
        return teamMap;
      };
      
      // Get most recent data up to thisWeek and lastWeek for comparison
      const thisWeekAccountsMap = getMostRecentByTeam(accountsDueData, thisWeekStr);
      const lastWeekAccountsMap = getMostRecentByTeam(accountsDueData, lastWeekStr);
      
      // For tax, we need cumulative totals per team for the current tax year
      const currentTaxYear = getCurrentTaxYear();
      const currentTaxYearStart = currentTaxYear.taxYearStart.toISOString().split('T')[0];
      
      // Calculate cumulative tax completed per team for current tax year (single-pass)
      const getTaxCumulativeByTeam = (data: typeof taxDataAll, beforeOrEqualWeek: string) => {
        const teamTotals = new Map<number, { completed: number; target: number; latestWeek: string }>();
        
        for (const item of data) {
          // Only include data from current tax year and before/equal to target week
          if (item.taxYearStart !== currentTaxYearStart || item.weekEnding > beforeOrEqualWeek) continue;
          
          const existing = teamTotals.get(item.teamId);
          if (!existing) {
            teamTotals.set(item.teamId, { 
              completed: item.personalTaxCompletedThisWeek || 0, 
              target: item.personalTaxTotalToComplete || 0,
              latestWeek: item.weekEnding 
            });
          } else {
            existing.completed += item.personalTaxCompletedThisWeek || 0;
            // Update target only if this is a more recent entry
            if (item.weekEnding > existing.latestWeek) {
              existing.target = item.personalTaxTotalToComplete || 0;
              existing.latestWeek = item.weekEnding;
            }
          }
        }
        return teamTotals;
      };
      
      const thisWeekTaxCumulative = getTaxCumulativeByTeam(taxDataAll, thisWeekStr);
      const lastWeekTaxCumulative = getTaxCumulativeByTeam(taxDataAll, lastWeekStr);
      const oneMonthTaxCumulative = getTaxCumulativeByTeam(taxDataAll, oneMonthAgoStr);
      const threeMonthsTaxCumulative = getTaxCumulativeByTeam(taxDataAll, threeMonthsAgoStr);
      
      const thisWeekVatMap = getMostRecentByTeam(vatDueData, thisWeekStr);
      const lastWeekVatMap = getMostRecentByTeam(vatDueData, lastWeekStr);
      const oneMonthVatMap = getMostRecentByTeam(vatDueData, oneMonthAgoStr);
      const threeMonthsVatMap = getMostRecentByTeam(vatDueData, threeMonthsAgoStr);
      
      const thisWeekMbsMap = getMostRecentByTeam(mbsDextData, thisWeekStr);
      const lastWeekMbsMap = getMostRecentByTeam(mbsDextData, lastWeekStr);
      const oneMonthMbsMap = getMostRecentByTeam(mbsDextData, oneMonthAgoStr);
      const threeMonthsMbsMap = getMostRecentByTeam(mbsDextData, threeMonthsAgoStr);
      
      const thisWeekClientMap = getMostRecentByTeam(clientDextData, thisWeekStr);
      const lastWeekClientMap = getMostRecentByTeam(clientDextData, lastWeekStr);
      const oneMonthClientMap = getMostRecentByTeam(clientDextData, oneMonthAgoStr);
      const threeMonthsClientMap = getMostRecentByTeam(clientDextData, threeMonthsAgoStr);
      
      const thisWeekTurnMap = getMostRecentByTeam(confirmationTurnaround, thisWeekStr);
      const lastWeekTurnMap = getMostRecentByTeam(confirmationTurnaround, lastWeekStr);
      const oneMonthTurnMap = getMostRecentByTeam(confirmationTurnaround, oneMonthAgoStr);
      const threeMonthsTurnMap = getMostRecentByTeam(confirmationTurnaround, threeMonthsAgoStr);
      
      const thisWeekHealthMap = getMostRecentByTeam(healthChecksDueData, thisWeekStr);
      const lastWeekHealthMap = getMostRecentByTeam(healthChecksDueData, lastWeekStr);
      const oneMonthHealthMap = getMostRecentByTeam(healthChecksDueData, oneMonthAgoStr);
      const threeMonthsHealthMap = getMostRecentByTeam(healthChecksDueData, threeMonthsAgoStr);
      
      // Medium and long term accounts data
      const oneMonthAccountsMap = getMostRecentByTeam(accountsDueData, oneMonthAgoStr);
      const threeMonthsAccountsMap = getMostRecentByTeam(accountsDueData, threeMonthsAgoStr);
      
      // Helper to sum a field from a Map's values
      const sumMapField = <T>(map: Map<number, T>, field: keyof T) => 
        Array.from(map.values()).reduce((sum, item) => sum + (Number(item[field]) || 0), 0);
      
      // Helper function to build stats for a given comparison period
      const buildTeamStats = (
        prevAccountsMap: Map<number, any>,
        prevVatMap: Map<number, any>,
        prevMbsMap: Map<number, any>,
        prevClientMap: Map<number, any>,
        prevTurnMap: Map<number, any>,
        prevHealthMap: Map<number, any>,
        prevTaxCumulative: Map<number, { completed: number; target: number; latestWeek: string }>
      ) => {
        const teamStats: Record<number, any> = {};
        for (const team of teams) {
          const teamThisWeekAccounts = thisWeekAccountsMap.get(team.id);
          const teamPrevAccounts = prevAccountsMap.get(team.id);
          const teamThisWeekVat = thisWeekVatMap.get(team.id);
          const teamPrevVat = prevVatMap.get(team.id);
          const teamThisWeekMbs = thisWeekMbsMap.get(team.id);
          const teamPrevMbs = prevMbsMap.get(team.id);
          const teamThisWeekClient = thisWeekClientMap.get(team.id);
          const teamPrevClient = prevClientMap.get(team.id);
          const teamThisWeekTurn = thisWeekTurnMap.get(team.id);
          const teamPrevTurn = prevTurnMap.get(team.id);
          const teamThisWeekHealth = thisWeekHealthMap.get(team.id);
          const teamPrevHealth = prevHealthMap.get(team.id);
          
          const teamTaxThis = thisWeekTaxCumulative.get(team.id);
          const teamTaxPrev = prevTaxCumulative.get(team.id);
          const taxCompleted = teamTaxThis?.completed || 0;
          const taxTotal = teamTaxThis?.target || 0;
          const taxPercent = taxTotal > 0 ? Math.round((taxCompleted / taxTotal) * 100) : 0;
          const prevTaxCompleted = teamTaxPrev?.completed || 0;
          const prevTaxTotal = teamTaxPrev?.target || 0;
          const prevTaxPercent = prevTaxTotal > 0 ? Math.round((prevTaxCompleted / prevTaxTotal) * 100) : 0;
          
          teamStats[team.id] = {
            teamName: team.name,
            accountsDue: teamThisWeekAccounts?.accountsDue || 0,
            accountsDuePrev: teamPrevAccounts?.accountsDue || 0,
            accountsDueInProgress: teamThisWeekAccounts?.accountsDueInProgress || 0,
            accountsDueInProgressPrev: teamPrevAccounts?.accountsDueInProgress || 0,
            taxPercent,
            taxPercentPrev: prevTaxPercent,
            taxStillToDo: taxTotal - taxCompleted,
            taxStillToDoPrev: prevTaxTotal - prevTaxCompleted,
            vatStillToFile: teamThisWeekVat?.vatDue || 0,
            vatStillToFilePrev: teamPrevVat?.vatDue || 0,
            mbsBelow85: teamThisWeekMbs?.clientsBelow85Percent || 0,
            mbsBelow85Prev: teamPrevMbs?.clientsBelow85Percent || 0,
            mbsBelow70: teamThisWeekMbs?.clientsBelow70Percent || 0,
            mbsBelow70Prev: teamPrevMbs?.clientsBelow70Percent || 0,
            clientBelow85: teamThisWeekClient?.clientsBelow85Percent || 0,
            clientBelow85Prev: teamPrevClient?.clientsBelow85Percent || 0,
            csTurnaround: teamThisWeekTurn?.turnaroundTimeDays || 0,
            csTurnaroundPrev: teamPrevTurn?.turnaroundTimeDays || 0,
            healthChecksDue: teamThisWeekHealth?.healthChecksDue || 0,
            healthChecksDuePrev: teamPrevHealth?.healthChecksDue || 0,
          };
        }
        return teamStats;
      };
      
      // Helper function to build overall stats for a given comparison period
      const buildOverallStats = (
        prevAccountsMap: Map<number, any>,
        prevVatMap: Map<number, any>,
        prevMbsMap: Map<number, any>,
        prevClientMap: Map<number, any>,
        prevTurnMap: Map<number, any>,
        prevHealthMap: Map<number, any>,
        prevTaxCumulative: Map<number, { completed: number; target: number; latestWeek: string }>
      ) => {
        const stats = {
          accountsDue: sumMapField(thisWeekAccountsMap, 'accountsDue'),
          accountsDuePrev: sumMapField(prevAccountsMap, 'accountsDue'),
          accountsDueInProgress: sumMapField(thisWeekAccountsMap, 'accountsDueInProgress'),
          accountsDueInProgressPrev: sumMapField(prevAccountsMap, 'accountsDueInProgress'),
          taxPercent: 0,
          taxPercentPrev: 0,
          taxStillToDo: 0,
          taxStillToDoPrev: 0,
          vatStillToFile: sumMapField(thisWeekVatMap, 'vatDue'),
          vatStillToFilePrev: sumMapField(prevVatMap, 'vatDue'),
          mbsBelow85: sumMapField(thisWeekMbsMap, 'clientsBelow85Percent'),
          mbsBelow85Prev: sumMapField(prevMbsMap, 'clientsBelow85Percent'),
          mbsBelow70: sumMapField(thisWeekMbsMap, 'clientsBelow70Percent'),
          mbsBelow70Prev: sumMapField(prevMbsMap, 'clientsBelow70Percent'),
          clientBelow85: sumMapField(thisWeekClientMap, 'clientsBelow85Percent'),
          clientBelow85Prev: sumMapField(prevClientMap, 'clientsBelow85Percent'),
          csTurnaround: thisWeekTurnMap.size > 0 
            ? Math.round(sumMapField(thisWeekTurnMap, 'turnaroundTimeDays') / thisWeekTurnMap.size) 
            : 0,
          csTurnaroundPrev: prevTurnMap.size > 0 
            ? Math.round(sumMapField(prevTurnMap, 'turnaroundTimeDays') / prevTurnMap.size) 
            : 0,
          healthChecksDue: sumMapField(thisWeekHealthMap, 'healthChecksDue'),
          healthChecksDuePrev: sumMapField(prevHealthMap, 'healthChecksDue'),
        };
        
        let totalTaxCompleted = 0;
        let totalTaxTarget = 0;
        Array.from(thisWeekTaxCumulative.values()).forEach(val => {
          totalTaxCompleted += val.completed;
          totalTaxTarget += val.target;
        });
        stats.taxPercent = totalTaxTarget > 0 ? Math.round((totalTaxCompleted / totalTaxTarget) * 100) : 0;
        stats.taxStillToDo = totalTaxTarget - totalTaxCompleted;
        
        let prevTotalTaxCompleted = 0;
        let prevTotalTaxTarget = 0;
        Array.from(prevTaxCumulative.values()).forEach(val => {
          prevTotalTaxCompleted += val.completed;
          prevTotalTaxTarget += val.target;
        });
        stats.taxPercentPrev = prevTotalTaxTarget > 0 ? Math.round((prevTotalTaxCompleted / prevTotalTaxTarget) * 100) : 0;
        stats.taxStillToDoPrev = prevTotalTaxTarget - prevTotalTaxCompleted;
        
        return stats;
      };
      
      // Build short-term (week-over-week) comparison
      const shortTermTeamStats = buildTeamStats(lastWeekAccountsMap, lastWeekVatMap, lastWeekMbsMap, lastWeekClientMap, lastWeekTurnMap, lastWeekHealthMap, lastWeekTaxCumulative);
      const shortTermOverall = buildOverallStats(lastWeekAccountsMap, lastWeekVatMap, lastWeekMbsMap, lastWeekClientMap, lastWeekTurnMap, lastWeekHealthMap, lastWeekTaxCumulative);
      
      // Build medium-term (1 month ago) comparison
      const mediumTermTeamStats = buildTeamStats(oneMonthAccountsMap, oneMonthVatMap, oneMonthMbsMap, oneMonthClientMap, oneMonthTurnMap, oneMonthHealthMap, oneMonthTaxCumulative);
      const mediumTermOverall = buildOverallStats(oneMonthAccountsMap, oneMonthVatMap, oneMonthMbsMap, oneMonthClientMap, oneMonthTurnMap, oneMonthHealthMap, oneMonthTaxCumulative);
      
      // Build long-term (3 months ago) comparison
      const longTermTeamStats = buildTeamStats(threeMonthsAccountsMap, threeMonthsVatMap, threeMonthsMbsMap, threeMonthsClientMap, threeMonthsTurnMap, threeMonthsHealthMap, threeMonthsTaxCumulative);
      const longTermOverall = buildOverallStats(threeMonthsAccountsMap, threeMonthsVatMap, threeMonthsMbsMap, threeMonthsClientMap, threeMonthsTurnMap, threeMonthsHealthMap, threeMonthsTaxCumulative);
      
      res.json({
        thisWeek: thisWeekStr,
        lastWeek: lastWeekStr,
        oneMonthAgo: oneMonthAgoStr,
        threeMonthsAgo: threeMonthsAgoStr,
        teams: teams.map(t => ({ id: t.id, name: t.name })),
        shortTerm: {
          overall: shortTermOverall,
          byTeam: shortTermTeamStats
        },
        mediumTerm: {
          overall: mediumTermOverall,
          byTeam: mediumTermTeamStats
        },
        longTerm: {
          overall: longTermOverall,
          byTeam: longTermTeamStats
        },
        // Keep backwards compatibility
        overall: shortTermOverall,
        byTeam: shortTermTeamStats
      });
    } catch (error) {
      console.error("Error fetching overview stats:", error);
      res.status(500).json({ message: "Failed to fetch overview stats" });
    }
  });

  // Weekly Targets Routes
  app.get("/api/targets", requirePermission('view_dashboard'), requireTeamAccess(['queryTeamId']), async (req, res) => {
    try {
      const teamId = req.query.teamId ? parseInt(req.query.teamId as string) : undefined;
      const targets = await storage.getAllWeeklyTargets(teamId, (req as any).organisationId);
      res.json(targets);
    } catch (error) {
      console.error('[route]', error);
      res.status(500).json({ message: "Failed to fetch targets" });
    }
  });

  app.get("/api/targets/:teamId/:weekEnding", requirePermission('view_dashboard'), requireTeamAccess(['paramsTeamId']), async (req, res) => {
    try {
      const teamId = parseInt(req.params.teamId);
      const weekEnding = req.params.weekEnding;
      
      let target = await storage.getWeeklyTarget(teamId, weekEnding);
      
      if (!target) {
        // Target doesn't exist, try to find the most recent target for this team
        const allTargets = await storage.getAllWeeklyTargets(teamId);
        
        if (allTargets.length > 0) {
          // Sort targets by date descending to get the most recent
          const sortedTargets = allTargets.sort((a, b) => 
            new Date(b.weekEnding).getTime() - new Date(a.weekEnding).getTime()
          );
          
          const previousTarget = sortedTargets[0];
          
          // Create a new target using the previous week's target value
          const carryForwardTarget = await storage.createWeeklyTarget({
            teamId: teamId,
            weekEnding: weekEnding,
            rollingFourWeekTarget: previousTarget.rollingFourWeekTarget,
            organisationId: (req as any).organisationId ?? previousTarget.organisationId
          });
          
          target = carryForwardTarget;
        } else {
          return res.status(404).json({ message: "Target not found" });
        }
      }
      
      res.json(target);
    } catch (error) {
      console.error('[route]', error);
      res.status(500).json({ message: "Failed to fetch target" });
    }
  });

  // Sync all teams' targets to the current completed week (carry forward)
  app.post("/api/targets/sync-all", requirePermission('manage_data'), async (req: any, res) => {
    try {
      const teams = await storage.getAllTeams(req.organisationId);
      
      // Calculate the most recent completed week ending (last Sunday)
      const today = new Date();
      const dayOfWeek = today.getDay();
      let daysToSubtract;
      if (dayOfWeek === 0) { // Sunday
        daysToSubtract = 7; // Show previous Sunday
      } else if (dayOfWeek === 1) { // Monday
        daysToSubtract = 1; // Show yesterday (Sunday)
      } else { // Tuesday-Saturday
        daysToSubtract = dayOfWeek; // Show most recent Sunday
      }
      
      const currentWeekEnding = new Date(today);
      currentWeekEnding.setDate(today.getDate() - daysToSubtract);
      const weekEndingStr = currentWeekEnding.toISOString().split('T')[0];
      
      const syncedTeams = [];
      
      for (const team of teams) {
        // Check if target already exists for this week
        const existingTarget = await storage.getWeeklyTarget(team.id, weekEndingStr);
        
        if (!existingTarget) {
          // Find most recent target for this team
          const allTargets = await storage.getAllWeeklyTargets(team.id);
          
          if (allTargets.length > 0) {
            const sortedTargets = allTargets.sort((a, b) => 
              new Date(b.weekEnding).getTime() - new Date(a.weekEnding).getTime()
            );
            
            const previousTarget = sortedTargets[0];
            
            // Only carry forward if the previous target is older than the current week
            if (new Date(previousTarget.weekEnding) < currentWeekEnding) {
              await storage.createWeeklyTarget({
                teamId: team.id,
                weekEnding: weekEndingStr,
                rollingFourWeekTarget: previousTarget.rollingFourWeekTarget,
                organisationId: (req as any).organisationId ?? previousTarget.organisationId
              });
              syncedTeams.push(team.name);
            }
          }
        }
      }
      
      res.json({ 
        message: `Synced targets to ${weekEndingStr}`,
        syncedTeams,
        weekEnding: weekEndingStr
      });
    } catch (error) {
      console.error("Target sync error:", error);
      res.status(500).json({ message: "Failed to sync targets" });
    }
  });

  app.post("/api/targets", requirePermission('manage_data'), requireTeamAccess(['bodyTeamId']), async (req, res) => {
    try {
      console.log("Targets POST request body:", req.body);
      const validatedData = insertWeeklyTargetSchema.parse(req.body);
      console.log("Validated data:", validatedData);
      
      // Check if target already exists for this team and week
      const existing = await storage.getWeeklyTarget(validatedData.teamId, validatedData.weekEnding);
      if (existing) {
        // Update existing target
        const updated = await storage.updateWeeklyTarget(validatedData.teamId, validatedData.weekEnding, validatedData);
        res.json(updated);
      } else {
        // Create new target
        const target = await storage.createWeeklyTarget({ ...validatedData, organisationId: (req as any).organisationId, submittedBy: (req as any).user?.id });
        res.status(201).json(target);
      }
    } catch (error) {
      console.error("Target creation error:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create/update target", error: (error as Error).message });
    }
  });

  // Weekly Results Routes
  app.get("/api/results", requirePermission('view_dashboard'), requireTeamAccess(['queryTeamId']), async (req, res) => {
    try {
      const teamId = req.query.teamId ? parseInt(req.query.teamId as string) : undefined;
      const results = await storage.getAllWeeklyResults(teamId, (req as any).organisationId);
      res.json(results);
    } catch (error) {
      console.error('[route]', error);
      res.status(500).json({ message: "Failed to fetch results" });
    }
  });

  app.get("/api/results/:teamId/:weekEnding", requirePermission('view_dashboard'), requireTeamAccess(['paramsTeamId']), async (req, res) => {
    try {
      const teamId = parseInt(req.params.teamId);
      const result = await storage.getWeeklyResult(teamId, req.params.weekEnding);
      if (!result) {
        return res.status(404).json({ message: "Result not found" });
      }
      res.json(result);
    } catch (error) {
      console.error('[route]', error);
      res.status(500).json({ message: "Failed to fetch result" });
    }
  });

  app.post("/api/results", requirePermission('manage_data'), requireTeamAccess(['bodyTeamId']), async (req, res) => {
    try {
      console.log("Results POST request body:", req.body);
      const validatedData = insertWeeklyResultSchema.parse(req.body);
      console.log("Validated results data:", validatedData);
      
      // Check if result already exists for this team and week
      const existing = await storage.getWeeklyResult(validatedData.teamId, validatedData.weekEnding);
      if (existing) {
        // Update existing result
        const updated = await storage.updateWeeklyResult(validatedData.teamId, validatedData.weekEnding, validatedData);
        res.json(updated);
      } else {
        // Create new result
        const result = await storage.createWeeklyResult({ ...validatedData, organisationId: (req as any).organisationId, submittedBy: (req as any).user?.id });
        res.status(201).json(result);
      }
    } catch (error) {
      console.error("Results creation error:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create/update result", error: (error as Error).message });
    }
  });

  app.delete("/api/results/:id", requirePermission('manage_data'), requireTeamAccess(['queryTeamId']), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteWeeklyResult(id);
      res.json({ message: "Weekly result deleted successfully" });
    } catch (error) {
      console.error("Error deleting weekly result:", error);
      res.status(500).json({ message: "Failed to delete weekly result" });
    }
  });

  // Accounts Due Routes
  app.get("/api/accounts-due", requirePermission('view_dashboard'), requireTeamAccess(['queryTeamId']), async (req, res) => {
    try {
      const teamId = req.query.teamId ? parseInt(req.query.teamId as string) : undefined;
      const accountsDue = await storage.getAllAccountsDue(teamId, (req as any).organisationId);
      res.json(accountsDue);
    } catch (error) {
      console.error('[route]', error);
      res.status(500).json({ message: "Failed to fetch accounts due" });
    }
  });

  app.post("/api/accounts-due", requirePermission('manage_data'), requireTeamAccess(['bodyTeamId']), async (req, res) => {
    try {
      console.log("Received accounts due data:", req.body);
      const validatedData = insertAccountsDueSchema.parse(req.body);
      console.log("Validated accounts due data:", validatedData);
      
      // Check if accounts due already exists for this team and week
      const existing = await storage.getAccountsDue(validatedData.teamId, validatedData.weekEnding);
      if (existing) {
        console.log("Updating existing accounts due entry");
        // Update existing accounts due
        const updated = await storage.updateAccountsDue(validatedData.teamId, validatedData.weekEnding, validatedData);
        res.json(updated);
      } else {
        console.log("Creating new accounts due entry");
        // Create new accounts due entry
        const accountsDue = await storage.createAccountsDue({ ...validatedData, organisationId: (req as any).organisationId, submittedBy: (req as any).user?.id });
        res.status(201).json(accountsDue);
      }
    } catch (error) {
      console.error("Error in accounts due POST route:", error);
      if (error instanceof z.ZodError) {
        console.error("Validation errors:", error.errors);
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create/update accounts due" });
    }
  });

  // Dashboard Data Route - Optimized with caching
  app.get("/api/dashboard", requirePermission('view_dashboard'), requireTeamAccess(['queryTeamId']), async (req, res) => {
    try {
      console.log("Dashboard API called");
      const teamId = req.query.teamId ? parseInt(req.query.teamId as string) : undefined;
      const weekEnding = req.query.weekEnding as string;
      const includeHistory = req.query.includeHistory === 'true';
      
      // Create cache key based on parameters
      const cacheKey = getCacheKey("dashboard", teamId, weekEnding, includeHistory?.toString());
      let cachedResult = getFromCache(cacheKey);
      
      if (cachedResult) {
        console.log("Returning cached result");
        return res.json(cachedResult);
      }
      
      console.log("Fetching performance data...");
      let performanceData = await storage.getTeamPerformanceData(teamId, (req as any).organisationId);
      
      // Filter data based on request type
      if (weekEnding && includeHistory) {
        // For history view, show the most recent 8 weeks for each team
        // This ensures Pod 2 and other teams always show their latest data
        const teamDataMap = new Map<number, any[]>();
        
        // Group data by team
        performanceData.forEach(p => {
          if (!teamDataMap.has(p.teamId)) {
            teamDataMap.set(p.teamId, []);
          }
          teamDataMap.get(p.teamId)!.push(p);
        });
        
        // Get the most recent 8 weeks for each team
        const filteredData: any[] = [];
        teamDataMap.forEach((teamData, teamId) => {
          const sortedTeamData = teamData.sort((a, b) => 
            new Date(b.weekEnding).getTime() - new Date(a.weekEnding).getTime()
          );
          filteredData.push(...sortedTeamData.slice(0, 8));
        });
        
        performanceData = filteredData.sort((a, b) => 
          new Date(b.weekEnding).getTime() - new Date(a.weekEnding).getTime()
        );
      } else if (weekEnding) {
        // For single week view, show only the specified week
        performanceData = performanceData.filter(p => p.weekEnding === weekEnding);
      }
      
      // Calculate summary metrics by team
      const teamSummaries = new Map();
      
      performanceData.forEach((week: any) => {
        if (!teamSummaries.has(week.teamId)) {
          teamSummaries.set(week.teamId, {
            teamId: week.teamId,
            teamName: week.teamName,
            totalCompleted: 0,
            currentWeekTarget: 0,
            currentWeekActual: 0,
            currentAccountsDue: 0,
            currentAccountsDueInProgress: 0,
            currentAccountsDueNotes: null,
            weeks: []
          });
        }
        
        const summary = teamSummaries.get(week.teamId);
        summary.totalCompleted += week.weeklyActual || 0;
        summary.weeks.push(week);
      });

      // Get accounts due data for the target week
      const accountsDueData = await storage.getAllAccountsDue(undefined, (req as any).organisationId);
      const targetWeekAccountsDue = accountsDueData.filter(ad => ad.weekEnding === weekEnding);

      // Sort weeks by date and use most recent for current metrics
      teamSummaries.forEach((summary) => {
        summary.weeks.sort((a: any, b: any) => new Date(b.weekEnding).getTime() - new Date(a.weekEnding).getTime());
        const latestWeek = summary.weeks[0];
        if (latestWeek) {
          summary.currentWeekTarget = latestWeek.rollingFourWeekTarget || 0;
          summary.currentWeekActual = latestWeek.rollingFourWeekActual || 0;
        }
        
        // Get accounts due from dedicated table for accuracy
        const teamAccountsDue = targetWeekAccountsDue.find(ad => ad.teamId === summary.teamId);
        summary.currentAccountsDue = teamAccountsDue ? teamAccountsDue.accountsDue : 0;
        summary.currentAccountsDueInProgress = teamAccountsDue ? teamAccountsDue.accountsDueInProgress : 0;
        summary.currentAccountsDueNotes = teamAccountsDue?.notes || null;
      });

      const teams = Array.from(teamSummaries.values()).map((team: any) => ({
        ...team,
        achievementRate: team.currentWeekTarget > 0 && team.currentWeekActual > 0
          ? Math.round((team.currentWeekActual / team.currentWeekTarget) * 100)
          : 0
      }));

      // Calculate overall summary by aggregating all teams
      const overallSummary = teams.reduce((acc, team) => ({
        teamId: 0,
        teamName: "All Teams",
        totalCompleted: acc.totalCompleted + team.totalCompleted,
        currentWeekTarget: acc.currentWeekTarget + team.currentWeekTarget,
        currentWeekActual: acc.currentWeekActual + team.currentWeekActual,
        currentAccountsDue: acc.currentAccountsDue + team.currentAccountsDue,
        currentAccountsDueInProgress: acc.currentAccountsDueInProgress + team.currentAccountsDueInProgress,
        currentAccountsDueNotes: null, // Overall summary doesn't have notes (will be set for single team below)
        achievementRate: 0 // Will calculate after
      }), {
        teamId: 0,
        teamName: "All Teams",
        totalCompleted: 0,
        currentWeekTarget: 0,
        currentWeekActual: 0,
        currentAccountsDue: 0,
        currentAccountsDueInProgress: 0,
        currentAccountsDueNotes: null,
        achievementRate: 0
      });

      // If filtering to a single team, include that team's notes in the summary
      if (teams.length === 1) {
        overallSummary.currentAccountsDueNotes = teams[0].currentAccountsDueNotes;
        overallSummary.teamName = teams[0].teamName;
      }

      // Calculate overall achievement rate
      overallSummary.achievementRate = overallSummary.currentWeekTarget > 0 && overallSummary.currentWeekActual > 0
        ? Math.round((overallSummary.currentWeekActual / overallSummary.currentWeekTarget) * 100)
        : 0;
      
      const result = {
        performanceData,
        teams,
        summary: overallSummary
      };
      
      // Cache the result for 2 minutes
      setInCache(cacheKey, result);
      
      res.json(result);
    } catch (error) {
      console.error("Dashboard API Error:", error);
      res.status(500).json({ message: "Failed to fetch dashboard data" });
    }
  });

  // VAT Dashboard Data Route
  app.get("/api/vat/dashboard", requirePermission('view_dashboard'), requireTeamAccess(['queryTeamId']), async (req, res) => {
    try {
      const teamId = req.query.teamId ? parseInt(req.query.teamId as string) : undefined;
      const quarterEnding = req.query.quarterEnding as string;
      
      // Get VAT data - due data and teams data
      const vatDueData = await storage.getAllVatDue(teamId, (req as any).organisationId);
      const teamsData = await storage.getAllTeams((req as any).organisationId);
      
      // Filter by quarter ending if specified, otherwise show overview for previous month's quarter end
      let filteredVatDue;
      if (quarterEnding) {
        filteredVatDue = vatDueData.filter(vat => vat.quarterEnding === quarterEnding);
      } else {
        // Calculate the overview quarter ending (previous month)
        const currentDate = new Date();
        const currentMonth = currentDate.getMonth(); // 0-based
        const currentYear = currentDate.getFullYear();
        
        // Get previous month
        const prevMonth = currentMonth === 0 ? 11 : currentMonth - 1;
        const prevYear = currentMonth === 0 ? currentYear - 1 : currentYear;
        
        // Calculate last day of previous month
        const lastDayOfPrevMonth = new Date(prevYear, prevMonth + 1, 0).getDate();
        const overviewQuarterEnd = `${prevYear}-${String(prevMonth + 1).padStart(2, '0')}-${String(lastDayOfPrevMonth).padStart(2, '0')}`;
        
        // Filter for the overview quarter and get most recent data for each team
        const overviewData = vatDueData.filter(vat => vat.quarterEnding === overviewQuarterEnd);
        
        // Get most recent entry for each team for this quarter
        const teamLatestData = new Map();
        overviewData.forEach(vat => {
          const key = vat.teamId;
          if (!teamLatestData.has(key) || vat.weekEnding > teamLatestData.get(key).weekEnding) {
            teamLatestData.set(key, vat);
          }
        });
        
        filteredVatDue = Array.from(teamLatestData.values());
      }
      
      // Create performance data structure
      const performanceData = filteredVatDue.map(vat => ({
        teamId: vat.teamId,
        teamName: teamsData.find(t => t.id === vat.teamId)?.name || 'Unknown Team',
        weekEnding: vat.weekEnding,
        rollingFourWeekTarget: null,
        rollingFourWeekActual: null,
        weeklyActual: null,
        vatDue: vat.vatDue,
      }));

      // Calculate team summaries based on VAT due data (until targets/results are implemented)
      const teamSummaries = new Map();
      
      filteredVatDue.forEach((vat) => {
        const team = teamsData.find(t => t.id === vat.teamId);
        if (!team) return;
        
        if (!teamSummaries.has(vat.teamId)) {
          teamSummaries.set(vat.teamId, {
            teamId: vat.teamId,
            teamName: team.name,
            totalCompleted: 0,
            currentWeekTarget: 0,
            currentWeekActual: 0,
            currentVatDue: 0,
            achievementRate: 0
          });
        }
        
        const teamSummary = teamSummaries.get(vat.teamId);
        // Use most recent VAT due count
        if (!teamSummary.currentWeekEnding || vat.weekEnding > teamSummary.currentWeekEnding) {
          teamSummary.currentWeekEnding = vat.weekEnding;
          teamSummary.currentVatDue = vat.vatDue;
        }
      });

      const teams = Array.from(teamSummaries.values());

      // Calculate overall summary
      const summary = teams.reduce((acc: any, team: any) => ({
        teamId: 0,
        teamName: "All Teams",
        totalCompleted: acc.totalCompleted + team.totalCompleted,
        currentWeekTarget: acc.currentWeekTarget + team.currentWeekTarget,
        currentWeekActual: acc.currentWeekActual + team.currentWeekActual,
        currentVatDue: acc.currentVatDue + team.currentVatDue,
        achievementRate: 0
      }), {
        teamId: 0,
        teamName: "All Teams",
        totalCompleted: 0,
        currentWeekTarget: 0,
        currentWeekActual: 0,
        currentVatDue: 0,
        achievementRate: 0
      });

      // Get VAT returns remaining for current month (max 5 weeks)
      const currentDate = new Date();
      const currentYear = currentDate.getFullYear();
      const currentMonth = currentDate.getMonth();
      const firstDayOfMonth = new Date(currentYear, currentMonth, 1);
      const lastDayOfMonth = new Date(currentYear, currentMonth + 1, 0);
      
      const vatReturnsRemainingData = vatDueData.filter(vat => {
        const vatDate = new Date(vat.weekEnding);
        return vatDate >= firstDayOfMonth && vatDate <= lastDayOfMonth;
      });
      
      // Aggregate by week ending if no specific team selected
      let vatReturnsRemaining;
      if (teamId) {
        // Show individual team data
        vatReturnsRemaining = vatReturnsRemainingData.map(vat => ({
          teamId: vat.teamId,
          teamName: teamsData.find(t => t.id === vat.teamId)?.name || 'Unknown Team',
          weekEnding: vat.weekEnding,
          vatDue: vat.vatDue
        }));
      } else {
        // Combine all teams by week ending
        const weeklyAggregates = new Map();
        vatReturnsRemainingData.forEach(vat => {
          const existing = weeklyAggregates.get(vat.weekEnding) || { vatDue: 0, count: 0 };
          weeklyAggregates.set(vat.weekEnding, {
            vatDue: existing.vatDue + vat.vatDue,
            count: existing.count + 1
          });
        });
        
        vatReturnsRemaining = Array.from(weeklyAggregates.entries()).map(([weekEnding, data]) => ({
          teamId: 0,
          teamName: 'All Teams',
          weekEnding,
          vatDue: data.vatDue
        }));
      }

      // Generate the last 6 month-end dates (last day of each of the last 6 months)
      const monthEnds = [];
      const today = new Date();
      
      for (let i = 1; i <= 6; i++) {
        const monthEndDate = new Date(today.getFullYear(), today.getMonth() - i + 1, 0); // Last day of each month
        monthEnds.push(monthEndDate.toISOString().split('T')[0]);
      }
      
      let monthEndPositions;
      if (teamId) {
        // Show individual team data for the last 6 month-ends
        monthEndPositions = [];
        
        // For each month-end date, find the VAT position for the selected team
        for (const monthEndDate of monthEnds) {
          // Find data for this team on or before the month-end date
          const teamVatData = vatDueData
            .filter(vat => vat.teamId === teamId && new Date(vat.weekEnding) <= new Date(monthEndDate))
            .sort((a, b) => new Date(b.weekEnding).getTime() - new Date(a.weekEnding).getTime());
          
          // Take the most recent entry for this team on or before the month-end
          if (teamVatData.length > 0) {
            const mostRecentEntry = teamVatData[0];
            monthEndPositions.push({
              teamId: mostRecentEntry.teamId,
              teamName: teamsData.find(t => t.id === mostRecentEntry.teamId)?.name || 'Unknown Team',
              monthEnd: monthEndDate,
              quarterEnding: mostRecentEntry.quarterEnding,
              vatDue: mostRecentEntry.vatDue
            });
          }
        }
        
        // Sort by most recent month-end first
        monthEndPositions = monthEndPositions
          .sort((a, b) => new Date(b.monthEnd).getTime() - new Date(a.monthEnd).getTime());
      } else {
        // Calculate month-end positions for all teams combined
        monthEndPositions = [];
        
        // For each month-end date, find the VAT position
        for (const monthEndDate of monthEnds) {
          let totalVatDue = 0;
          
          // For each team, find their VAT position at this month-end
          for (const team of teamsData) {
            // Find data for this team on or before the month-end date
            const teamVatData = vatDueData
              .filter(vat => vat.teamId === team.id && new Date(vat.weekEnding) <= new Date(monthEndDate))
              .sort((a, b) => new Date(b.weekEnding).getTime() - new Date(a.weekEnding).getTime());
            
            // Take the most recent entry for this team on or before the month-end
            if (teamVatData.length > 0) {
              totalVatDue += teamVatData[0].vatDue;
            }
          }
          
          // Only include month-ends where we have data
          if (totalVatDue > 0 || vatDueData.some(vat => new Date(vat.weekEnding) <= new Date(monthEndDate))) {
            monthEndPositions.push({
              teamId: 0,
              teamName: 'All Teams',
              monthEnd: monthEndDate,
              quarterEnding: '', // Will be determined by the most recent entry
              vatDue: totalVatDue
            });
          }
        }
        
        // Sort by most recent month-end first and limit to 6
        monthEndPositions = monthEndPositions
          .sort((a, b) => new Date(b.monthEnd).getTime() - new Date(a.monthEnd).getTime())
          .slice(0, 6);
      }

      // Get VAT turnover checks data (last 6 weeks)
      const turnoverChecksRawData = await storage.getAllVatTurnoverChecks(teamId, (req as any).organisationId);
      
      // Get the 6 most recent distinct week endings
      const distinctWeeks = Array.from(new Set(turnoverChecksRawData.map(check => check.weekEnding)))
        .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())
        .slice(0, 6);
      
      const recentTurnoverChecks = turnoverChecksRawData.filter(check => 
        distinctWeeks.includes(check.weekEnding)
      );
      
      // Aggregate by week ending if no specific team selected
      let turnoverChecksData;
      if (teamId) {
        // Show individual team data
        turnoverChecksData = recentTurnoverChecks
          .map(check => ({
            teamId: check.teamId,
            teamName: teamsData.find(t => t.id === check.teamId)?.name || 'Unknown Team',
            weekEnding: check.weekEnding,
            percentageComplete: check.percentageComplete
          }))
          .sort((a, b) => new Date(b.weekEnding).getTime() - new Date(a.weekEnding).getTime())
          .slice(0, 6); // Most recent 6 weeks first (newest to oldest)
      } else {
        // Combine all teams by week ending (average percentage)
        const weeklyAggregates = new Map();
        recentTurnoverChecks.forEach(check => {
          const existing = weeklyAggregates.get(check.weekEnding) || { total: 0, count: 0 };
          weeklyAggregates.set(check.weekEnding, {
            total: existing.total + check.percentageComplete,
            count: existing.count + 1
          });
        });
        
        turnoverChecksData = distinctWeeks
          .map(weekEnding => {
            const weekData = weeklyAggregates.get(weekEnding);
            return {
              teamId: 0,
              teamName: 'All Teams',
              weekEnding,
              percentageComplete: weekData ? Math.round(weekData.total / weekData.count) : 0
            };
          }); // Show most recent first (newest to oldest)
      }

      res.json({
        performanceData,
        teams,
        summary,
        vatReturnsRemaining,
        monthEndPositions,
        turnoverChecksData
      });
    } catch (error) {
      console.error('[route]', error);
      res.status(500).json({ message: "Failed to fetch VAT dashboard data" });
    }
  });

  // VAT Targets Routes
  app.get("/api/vat/targets", requirePermission('view_dashboard'), requireTeamAccess(['queryTeamId']), async (req, res) => {
    try {
      res.json([]);
    } catch (error) {
      console.error('[route]', error);
      res.status(500).json({ message: "Failed to fetch VAT targets" });
    }
  });

  app.post("/api/vat/targets", requirePermission('manage_data'), requireTeamAccess(['bodyTeamId']), async (req, res) => {
    try {
      const validatedData = insertVatTargetSchema.parse(req.body);
      res.status(201).json({ id: 1, ...validatedData, createdAt: new Date(), updatedAt: new Date() });
    } catch (error) {
      console.error('[route]', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create VAT target" });
    }
  });

  // VAT Results Routes
  app.get("/api/vat/results", requirePermission('view_dashboard'), requireTeamAccess(['queryTeamId']), async (req, res) => {
    try {
      res.json([]);
    } catch (error) {
      console.error('[route]', error);
      res.status(500).json({ message: "Failed to fetch VAT results" });
    }
  });

  app.post("/api/vat/results", requirePermission('manage_data'), requireTeamAccess(['bodyTeamId']), async (req, res) => {
    try {
      const validatedData = insertVatResultSchema.parse(req.body);
      res.status(201).json({ id: 1, ...validatedData, createdAt: new Date(), updatedAt: new Date() });
    } catch (error) {
      console.error('[route]', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create VAT result" });
    }
  });

  // VAT Due Routes
  app.get("/api/vat/due", requirePermission('view_dashboard'), requireTeamAccess(['queryTeamId']), async (req, res) => {
    try {
      const teamId = req.query.teamId ? parseInt(req.query.teamId as string) : undefined;
      const vatDue = await storage.getAllVatDue(teamId, (req as any).organisationId);
      res.json(vatDue);
    } catch (error) {
      console.error('[route]', error);
      res.status(500).json({ message: "Failed to fetch VAT due data" });
    }
  });

  app.post("/api/vat/due", requirePermission('manage_data'), requireTeamAccess(['bodyTeamId']), async (req, res) => {
    try {
      const validatedData = insertVatDueSchema.parse(req.body);
      
      // Check if VAT due already exists for this team, week, and quarter
      const existing = await storage.getVatDue(validatedData.teamId, validatedData.weekEnding, validatedData.quarterEnding);
      
      if (existing) {
        // Update existing VAT due entry
        const updated = await storage.updateVatDue(validatedData.teamId, validatedData.weekEnding, validatedData.quarterEnding, validatedData);
        res.json(updated);
      } else {
        // Create new VAT due entry
        const vatDue = await storage.createVatDue({ ...validatedData, organisationId: (req as any).organisationId, submittedBy: (req as any).user?.id });
        res.status(201).json(vatDue);
      }
    } catch (error) {
      console.error('[route]', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create/update VAT due entry" });
    }
  });

  app.put("/api/vat/due/:id", requirePermission('manage_data'), requireTeamAccess(['bodyTeamId']), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const validatedData = insertVatDueSchema.parse(req.body);
      
      // Update the VAT due entry by ID
      const updated = await storage.updateVatDue(validatedData.teamId, validatedData.weekEnding, validatedData.quarterEnding, validatedData);
      if (updated) {
        res.json(updated);
      } else {
        res.status(404).json({ message: "VAT due entry not found" });
      }
    } catch (error) {
      console.error('[route]', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update VAT due entry" });
    }
  });

  app.delete("/api/vat/due/:id", requirePermission('manage_data'), requireTeamAccess(['queryTeamId']), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      
      // Actually delete the database record
      await storage.deleteVatDue(id);
      res.status(204).send();
    } catch (error) {
      console.error('[route]', error);
      res.status(500).json({ message: "Failed to delete VAT due entry" });
    }
  });

  // VAT Turnover Checks Routes
  app.get("/api/vat/turnover-checks", requirePermission('view_dashboard'), requireTeamAccess(['queryTeamId']), async (req, res) => {
    try {
      const teamId = req.query.teamId ? parseInt(req.query.teamId as string) : undefined;
      const vatTurnoverChecks = await storage.getAllVatTurnoverChecks(teamId, (req as any).organisationId);
      res.json(vatTurnoverChecks);
    } catch (error) {
      console.error('[route]', error);
      res.status(500).json({ message: "Failed to fetch VAT turnover checks data" });
    }
  });

  app.post("/api/vat/turnover-checks", requirePermission('manage_data'), requireTeamAccess(['bodyTeamId']), async (req, res) => {
    try {
      const validatedData = insertVatTurnoverChecksSchema.parse(req.body);
      const vatTurnoverChecks = await storage.createVatTurnoverChecks({ ...validatedData, organisationId: (req as any).organisationId, submittedBy: (req as any).user?.id });
      res.status(201).json(vatTurnoverChecks);
    } catch (error) {
      console.error('[route]', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create/update VAT turnover checks entry" });
    }
  });

  app.put("/api/vat/turnover-checks/:id", requirePermission('manage_data'), requireTeamAccess(['bodyTeamId']), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const validatedData = insertVatTurnoverChecksSchema.parse(req.body);
      
      // Update the VAT turnover checks entry by ID
      const updated = await storage.updateVatTurnoverChecksById(id, validatedData);
      if (updated) {
        res.json(updated);
      } else {
        res.status(404).json({ message: "VAT turnover checks entry not found" });
      }
    } catch (error) {
      console.error('[route]', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update VAT turnover checks entry" });
    }
  });

  app.delete("/api/vat/turnover-checks/:id", requirePermission('manage_data'), requireTeamAccess(['queryTeamId']), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      
      // Delete the VAT turnover checks record
      await storage.deleteVatTurnoverChecks(id);
      res.status(204).send();
    } catch (error) {
      console.error('[route]', error);
      res.status(500).json({ message: "Failed to delete VAT turnover checks entry" });
    }
  });

  // Health Checks API Routes
  
  // Health Checks Dashboard
  app.get("/api/health-checks/dashboard", requirePermission('view_dashboard'), requireTeamAccess(['queryTeamId']), async (req, res) => {
    try {
      const teamId = req.query.teamId ? parseInt(req.query.teamId as string) : undefined;
      
      // Get current date and calculate monthly boundaries
      const currentDate = new Date();
      const currentYear = currentDate.getFullYear();
      const currentMonth = currentDate.getMonth();
      const firstOfMonth = new Date(currentYear, currentMonth, 1);
      const fifteenthOfMonth = new Date(currentYear, currentMonth, 15);
      
      // Get all health checks due data
      const healthChecksDueData = await storage.getAllHealthChecksDue(teamId, (req as any).organisationId);
      
      // Filter data for current month - include recent entries that are relevant to current month
      // Week ending dates often fall in previous month but represent current month work
      // Extend the range to ensure we capture the starting baseline for comparison
      const extendedStartDate = new Date(currentYear, currentMonth - 1, 15); // Include last 15 days of previous month for baseline
      const extendedEndDate = new Date(); // Include all data up to today so late-month submissions are never excluded
      const currentMonthData = healthChecksDueData.filter((item: any) => {
        const itemDate = new Date(item.weekEnding);
        return itemDate >= extendedStartDate && itemDate <= extendedEndDate;
      });
      
      console.log("All health checks due data:", healthChecksDueData.length, "items");
      console.log("Extended month boundaries:", extendedStartDate.toISOString(), "to", extendedEndDate.toISOString());
      console.log("Filtered current month data:", currentMonthData.length, "items");
      if (healthChecksDueData.length > 0) {
        console.log("Sample data item:", healthChecksDueData[0]);
      }
      
      // Generate 6-month history data (15th of each month for last 6 months)
      // Exclude current month unless we've passed the 15th
      const currentDayOfMonth = currentDate.getDate();
      const startMonthOffset = currentDayOfMonth >= 15 ? 0 : 1;
      
      const sixMonthHistory = [];
      for (let i = startMonthOffset; i < 6 + startMonthOffset; i++) {
        const historyDate = new Date(currentYear, currentMonth - i, 15);
        const monthName = historyDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
        
        // Find data closest to the 15th of each month
        const monthData = healthChecksDueData.filter((item: any) => {
          const itemDate = new Date(item.weekEnding);
          const monthStart = new Date(historyDate.getFullYear(), historyDate.getMonth(), 1);
          const monthEnd = new Date(historyDate.getFullYear(), historyDate.getMonth() + 1, 0);
          return itemDate >= monthStart && itemDate <= monthEnd;
        });
        
        if (teamId) {
          // Individual team data - get entry closest to 15th of the month
          const teamMonthData = monthData.filter((item: any) => item.teamId === teamId);
          const entryOn15th = teamMonthData.find((item: any) => {
            const itemDate = new Date(item.weekEnding);
            return itemDate.getDate() === 15;
          });
          
          // If no entry on 15th, get the latest entry before 15th, or closest after
          let closestEntry = entryOn15th;
          if (!closestEntry && teamMonthData.length > 0) {
            const entriesBefor15th = teamMonthData.filter((item: any) => {
              const itemDate = new Date(item.weekEnding);
              return itemDate.getDate() <= 15;
            });
            
            if (entriesBefor15th.length > 0) {
              closestEntry = entriesBefor15th.sort((a: any, b: any) => 
                new Date(b.weekEnding).getTime() - new Date(a.weekEnding).getTime()
              )[0];
            } else {
              closestEntry = teamMonthData.sort((a: any, b: any) => 
                new Date(a.weekEnding).getTime() - new Date(b.weekEnding).getTime()
              )[0];
            }
          }
          
          sixMonthHistory.push({
            month: monthName,
            monthEnding: historyDate.toISOString().split('T')[0],
            remainingChecks: closestEntry?.healthChecksDue || 0,
            teamId: teamId,
            teamName: 'Team ' + teamId
          });
        } else {
          // Combined team data - get all teams' data closest to 15th
          const teamSummaryMap = new Map();
          
          monthData.forEach((item: any) => {
            if (!teamSummaryMap.has(item.teamId)) {
              teamSummaryMap.set(item.teamId, []);
            }
            teamSummaryMap.get(item.teamId).push(item);
          });
          
          let totalRemainingOn15th = 0;
          teamSummaryMap.forEach((teamData: any[]) => {
            const entryOn15th = teamData.find((item: any) => {
              const itemDate = new Date(item.weekEnding);
              return itemDate.getDate() === 15;
            });
            
            let closestEntry = entryOn15th;
            if (!closestEntry && teamData.length > 0) {
              const entriesBefor15th = teamData.filter((item: any) => {
                const itemDate = new Date(item.weekEnding);
                return itemDate.getDate() <= 15;
              });
              
              if (entriesBefor15th.length > 0) {
                closestEntry = entriesBefor15th.sort((a: any, b: any) => 
                  new Date(b.weekEnding).getTime() - new Date(a.weekEnding).getTime()
                )[0];
              } else {
                closestEntry = teamData.sort((a: any, b: any) => 
                  new Date(a.weekEnding).getTime() - new Date(b.weekEnding).getTime()
                )[0];
              }
            }
            
            if (closestEntry) {
              totalRemainingOn15th += closestEntry.healthChecksDue || 0;
            }
          });
          
          sixMonthHistory.push({
            month: monthName,
            monthEnding: historyDate.toISOString().split('T')[0],
            remainingChecks: totalRemainingOn15th
          });
        }
      }
      
      // Calculate monthly performance summary
      let totalRemaining = 0;
      let totalCompleted = 0;
      let percentageComplete = 0;
      
      if (currentMonthData.length > 0) {
        if (teamId) {
          // Single team calculation
          const teamData = currentMonthData.filter((item: any) => item.teamId === teamId);
          if (teamData.length > 0) {
            const sortedTeamData = teamData.sort((a: any, b: any) => 
              new Date(a.weekEnding).getTime() - new Date(b.weekEnding).getTime()
            );
            
            const mostRecentEntry = sortedTeamData[sortedTeamData.length - 1];
            totalRemaining = mostRecentEntry.healthChecksDue || 0;
            
            // Find the first non-zero entry as the baseline (ignoring zero entries from previous periods)
            let startValue = 0;
            for (const entry of sortedTeamData) {
              if (entry.healthChecksDue > 0) {
                startValue = entry.healthChecksDue;
                break;
              }
            }
            
            // If no non-zero entries found, use the most recent entry
            if (startValue === 0) {
              startValue = totalRemaining;
            }
            
            totalCompleted = Math.max(0, startValue - totalRemaining);
            percentageComplete = startValue > 0 ? Math.round((totalCompleted / startValue) * 100) : 100;
            
            console.log(`Single team ${teamId} performance calculation:`, {
              startValue,
              totalRemaining,
              totalCompleted,
              percentageComplete,
              dataPoints: sortedTeamData.length
            });
          }
        } else {
          // All teams calculation - aggregate all teams' most recent data
          const teamLatestData = new Map();
          currentMonthData.forEach((item: any) => {
            const existing = teamLatestData.get(item.teamId);
            if (!existing || new Date(item.weekEnding) > new Date(existing.weekEnding)) {
              teamLatestData.set(item.teamId, item);
            }
          });
          
          // Sum up the most recent values from each team
          totalRemaining = Array.from(teamLatestData.values())
            .reduce((sum: number, item: any) => sum + (item.healthChecksDue || 0), 0);
          
          // For completion calculation, we need to track progress per team
          let totalStartValue = 0;
          teamLatestData.forEach((latestItem: any) => {
            // Find earliest entry for this team
            const teamItems = currentMonthData
              .filter((item: any) => item.teamId === latestItem.teamId)
              .sort((a: any, b: any) => new Date(a.weekEnding).getTime() - new Date(b.weekEnding).getTime());
            
            // Find the first non-zero entry for this team as the baseline
            let startValueForTeam = 0;
            for (const entry of teamItems) {
              if (entry.healthChecksDue > 0) {
                startValueForTeam = entry.healthChecksDue;
                break;
              }
            }
            
            // If no non-zero entries found, use the current value
            if (startValueForTeam === 0) {
              startValueForTeam = latestItem.healthChecksDue || 0;
            }
            
            const currentValue = latestItem.healthChecksDue || 0;
            
            totalStartValue += startValueForTeam;
            totalCompleted += Math.max(0, startValueForTeam - currentValue);
          });
          
          percentageComplete = totalStartValue > 0 ? Math.round((totalCompleted / totalStartValue) * 100) : 100;
          
          console.log("All teams performance calculation:", {
            totalStartValue,
            totalRemaining,
            totalCompleted,
            percentageComplete,
            teamsCount: teamLatestData.size
          });
        }
      }
      
      const monthlyPerformance = {
        totalCompleted,
        totalRemaining,
        percentageComplete,
        targetDate: fifteenthOfMonth.toISOString().split('T')[0]
      };
      
      // Prepare current month chart data
      const currentMonthChartData: any[] = [];
      if (teamId) {
        // Individual team data for current month
        const teamCurrentData = currentMonthData.filter((item: any) => item.teamId === teamId);
        teamCurrentData.forEach((item: any) => {
          currentMonthChartData.push({
            date: item.weekEnding,
            remainingChecks: item.healthChecksDue || 0,
            teamId: item.teamId,
            teamName: item.team?.name || 'Unknown Team'
          });
        });
      } else {
        // Aggregate by date for all teams
        const dateAggregates = new Map();
        currentMonthData.forEach((item: any) => {
          const existing = dateAggregates.get(item.weekEnding) || 0;
          dateAggregates.set(item.weekEnding, existing + (item.healthChecksDue || 0));
        });
        
        dateAggregates.forEach((remainingChecks, date) => {
          currentMonthChartData.push({
            date,
            remainingChecks
          });
        });
      }
      
      // Calculate team performance comparison
      const teams = [];
      if (teamId) {
        // Single team data
        const teamData = currentMonthData.filter((item: any) => item.teamId === teamId);
        const currentRemaining = teamData.reduce((sum: number, item: any) => sum + (item.healthChecksDue || 0), 0);
        const teamStartTotal = teamData.length > 0 ? 
          Math.max(...teamData.map((item: any) => item.healthChecksDue || 0)) : 0;
        const teamCompleted = Math.max(0, teamStartTotal - currentRemaining);
        const teamPercentage = teamStartTotal > 0 ? Math.round((teamCompleted / teamStartTotal) * 100) : 0;
        
        teams.push({
          teamId: teamId,
          teamName: 'Team ' + teamId,
          currentRemaining,
          monthlyTarget: 0, // Target is always 0
          percentageComplete: teamPercentage
        });
      } else {
        // All teams data
        const teamSummaries = new Map();
        currentMonthData.forEach((item: any) => {
          if (!teamSummaries.has(item.teamId)) {
            teamSummaries.set(item.teamId, {
              teamId: item.teamId,
              teamName: item.team?.name || 'Unknown Team',
              items: []
            });
          }
          teamSummaries.get(item.teamId).items.push(item);
        });
        
        teamSummaries.forEach((teamData: any) => {
          // Sort team items by date to get chronological order
          const sortedTeamItems = teamData.items.sort((a: any, b: any) => 
            new Date(a.weekEnding).getTime() - new Date(b.weekEnding).getTime()
          );
          
          // Get the most recent entry for current status
          const mostRecentEntry = sortedTeamItems[sortedTeamItems.length - 1];
          const currentRemaining = mostRecentEntry.healthChecksDue || 0;
          
          // Get earliest entry to calculate progress
          const earliestEntry = sortedTeamItems[0];
          const teamStartTotal = earliestEntry.healthChecksDue || 0;
          const teamCompleted = Math.max(0, teamStartTotal - currentRemaining);
          const teamPercentage = teamStartTotal > 0 ? Math.round((teamCompleted / teamStartTotal) * 100) : 0;
          
          console.log(`Team ${teamData.teamName} calculation:`, {
            currentRemaining,
            teamStartTotal,
            teamCompleted,
            teamPercentage,
            entriesCount: sortedTeamItems.length
          });
          
          teams.push({
            teamId: teamData.teamId,
            teamName: teamData.teamName,
            currentRemaining,
            monthlyTarget: 0, // Target is always 0
            percentageComplete: teamPercentage
          });
        });
      }

      res.json({
        monthlyPerformance,
        currentMonthData: currentMonthChartData.sort((a: any, b: any) => 
          new Date(b.date).getTime() - new Date(a.date).getTime()
        ), // Most recent first (reverse chronological)
        sixMonthHistory: sixMonthHistory, // Already in reverse order from loop
        teams: teams.sort((a: any, b: any) => b.percentageComplete - a.percentageComplete)
      });
    } catch (error) {
      console.error('[route]', error);
      res.status(500).json({ message: "Failed to fetch health checks dashboard data" });
    }
  });

  // Health Checks Targets
  app.get("/api/health-checks/targets", requirePermission('view_dashboard'), requireTeamAccess(['queryTeamId']), async (req, res) => {
    try {
      const teamId = req.query.teamId ? parseInt(req.query.teamId as string) : undefined;
      const targets = await storage.getAllHealthChecksTargets(teamId, (req as any).organisationId);
      res.json(targets);
    } catch (error) {
      console.error('[route]', error);
      res.status(500).json({ message: "Failed to fetch health checks targets" });
    }
  });

  app.post("/api/health-checks/targets", requirePermission('manage_data'), requireTeamAccess(['bodyTeamId']), async (req, res) => {
    try {
      const validatedData = insertHealthChecksTargetSchema.parse(req.body);
      
      // Check if target already exists for this team and week
      const existing = await storage.getHealthChecksTarget(validatedData.teamId, validatedData.weekEnding);
      
      if (existing) {
        // Update existing target
        const updated = await storage.updateHealthChecksTarget(validatedData.teamId, validatedData.weekEnding, validatedData);
        res.json(updated);
      } else {
        // Create new target
        const target = await storage.createHealthChecksTarget({ ...validatedData, organisationId: (req as any).organisationId, submittedBy: (req as any).user?.id });
        res.status(201).json(target);
      }
    } catch (error) {
      console.error('[route]', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create/update health checks target" });
    }
  });

  // Health Checks Results
  app.get("/api/health-checks/results", requirePermission('view_dashboard'), requireTeamAccess(['queryTeamId']), async (req, res) => {
    try {
      const teamId = req.query.teamId ? parseInt(req.query.teamId as string) : undefined;
      const results = await storage.getAllHealthChecksResults(teamId, (req as any).organisationId);
      res.json(results);
    } catch (error) {
      console.error('[route]', error);
      res.status(500).json({ message: "Failed to fetch health checks results" });
    }
  });

  app.get("/api/health-checks/results/:teamId/:weekEnding", requirePermission('view_dashboard'), requireTeamAccess(['paramsTeamId']), async (req, res) => {
    try {
      const teamId = parseInt(req.params.teamId);
      const weekEnding = req.params.weekEnding;
      
      const result = await storage.getHealthChecksResult(teamId, weekEnding);
      
      if (!result) {
        return res.status(404).json({ message: "Result not found" });
      }
      
      res.json(result);
    } catch (error) {
      console.error('[route]', error);
      res.status(500).json({ message: "Failed to fetch health checks result" });
    }
  });

  app.post("/api/health-checks/results", requirePermission('manage_data'), requireTeamAccess(['bodyTeamId']), async (req, res) => {
    try {
      const validatedData = insertHealthChecksResultSchema.parse(req.body);
      
      // Check if result already exists for this team and week
      const existing = await storage.getHealthChecksResult(validatedData.teamId, validatedData.weekEnding);
      
      if (existing) {
        // Update existing result
        const updated = await storage.updateHealthChecksResult(validatedData.teamId, validatedData.weekEnding, validatedData);
        res.json(updated);
      } else {
        // Create new result
        const result = await storage.createHealthChecksResult({ ...validatedData, organisationId: (req as any).organisationId, submittedBy: (req as any).user?.id });
        res.status(201).json(result);
      }
    } catch (error) {
      console.error('[route]', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create/update health checks result" });
    }
  });

  // Health Checks Due
  app.get("/api/health-checks/due", requirePermission('view_dashboard'), requireTeamAccess(['queryTeamId']), async (req, res) => {
    try {
      const teamId = req.query.teamId ? parseInt(req.query.teamId as string) : undefined;
      const healthChecksDue = await storage.getAllHealthChecksDue(teamId, (req as any).organisationId);
      res.json(healthChecksDue);
    } catch (error) {
      console.error('[route]', error);
      res.status(500).json({ message: "Failed to fetch health checks due" });
    }
  });

  app.post("/api/health-checks/due", requirePermission('manage_data'), requireTeamAccess(['bodyTeamId']), async (req, res) => {
    try {
      const validatedData = insertHealthChecksDueSchema.parse(req.body);
      
      // Check if health checks due already exists for this team and week
      const existing = await storage.getHealthChecksDue(validatedData.teamId, validatedData.weekEnding);
      
      if (existing) {
        // Update existing health checks due entry
        const updated = await storage.updateHealthChecksDue(validatedData.teamId, validatedData.weekEnding, validatedData);
        res.json(updated);
      } else {
        // Create new health checks due entry
        const healthChecksDue = await storage.createHealthChecksDue({ ...validatedData, organisationId: (req as any).organisationId, submittedBy: (req as any).user?.id });
        res.status(201).json(healthChecksDue);
      }
    } catch (error) {
      console.error('[route]', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create/update health checks due" });
    }
  });

  // PATCH specific health checks due entry by ID
  app.patch("/api/health-checks/due/:id", requirePermission('manage_data'), requireTeamAccess(['bodyTeamId']), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const validatedData = insertHealthChecksDueSchema.partial().parse(req.body);
      
      // Find the entry first to get team and week info
      const allEntries = await storage.getAllHealthChecksDue(undefined, (req as any).organisationId);
      const entry = allEntries.find((e: any) => e.id === id);
      
      if (!entry) {
        return res.status(404).json({ message: "Health checks due entry not found" });
      }
      
      // Update the entry
      const updated = await storage.updateHealthChecksDue(entry.teamId, entry.weekEnding, validatedData);
      
      if (!updated) {
        return res.status(404).json({ message: "Failed to update health checks due entry" });
      }
      
      res.json(updated);
    } catch (error) {
      console.error('[route]', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update health checks due entry" });
    }
  });

  // DELETE specific health checks due entry by ID
  app.delete("/api/health-checks/due/:id", requirePermission('manage_data'), requireTeamAccess(['queryTeamId']), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      
      // Find the entry first to get team and week info
      const allEntries = await storage.getAllHealthChecksDue(undefined, (req as any).organisationId);
      const entry = allEntries.find((e: any) => e.id === id);
      
      if (!entry) {
        return res.status(404).json({ message: "Health checks due entry not found" });
      }
      
      // For now, we'll use the existing update method to "delete" by setting values to 0
      // This maintains data integrity while effectively removing the entry
      await storage.updateHealthChecksDue(entry.teamId, entry.weekEnding, {
        healthChecksDue: 0,
        notes: ""
      });
      
      res.json({ message: "Health checks due entry deleted successfully" });
    } catch (error) {
      console.error('[route]', error);
      res.status(500).json({ message: "Failed to delete health checks due entry" });
    }
  });

  // MBS (Internal Bookkeeping) Results routes
  app.get("/api/mbs/results", requirePermission('view_dashboard'), requireTeamAccess(['queryTeamId']), async (req, res) => {
    try {
      const teamId = req.query.teamId ? parseInt(req.query.teamId as string) : undefined;
      const results = await storage.getAllMbsResults(teamId, (req as any).organisationId);
      res.json(results);
    } catch (error) {
      console.error("Error fetching MBS results:", error);
      res.status(500).json({ message: "Failed to fetch MBS results" });
    }
  });

  app.get("/api/mbs/results/:teamId/:weekEnding", requirePermission('view_dashboard'), requireTeamAccess(['paramsTeamId']), async (req, res) => {
    try {
      const teamId = parseInt(req.params.teamId);
      const weekEnding = req.params.weekEnding;
      const result = await storage.getMbsResult(teamId, weekEnding);
      if (!result) {
        return res.status(404).json({ message: "MBS result not found" });
      }
      res.json(result);
    } catch (error) {
      console.error("Error fetching MBS result:", error);
      res.status(500).json({ message: "Failed to fetch MBS result" });
    }
  });

  app.post("/api/mbs/results", requirePermission('manage_data'), requireTeamAccess(['bodyTeamId']), async (req, res) => {
    try {
      console.log("MBS Results POST request body:", req.body);
      const validatedData = insertWeeklyResultSchema.parse(req.body);
      console.log("Validated MBS results data:", validatedData);
      
      const result = await storage.createMbsResult({ ...validatedData, organisationId: (req as any).organisationId, submittedBy: (req as any).user?.id });
      res.status(201).json(result);
    } catch (error) {
      console.error("MBS Results creation error:", error);
      res.status(500).json({ 
        message: "Failed to create/update MBS result", 
        error: error instanceof Error ? error.message : "Unknown error" 
      });
    }
  });

  app.delete("/api/mbs/results/:id", requirePermission('manage_data'), requireTeamAccess(['queryTeamId']), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteMbsResult(id);
      res.json({ message: "MBS result deleted successfully" });
    } catch (error) {
      console.error("Error deleting MBS result:", error);
      res.status(500).json({ message: "Failed to delete MBS result" });
    }
  });

  // MBS Dext Precision routes
  app.get("/api/mbs-dext-precision", requirePermission('view_dashboard'), requireTeamAccess(['queryTeamId']), async (req, res) => {
    try {
      const teamId = req.query.teamId ? parseInt(req.query.teamId as string) : undefined;
      const data = await storage.getAllMbsDextPrecision(teamId, (req as any).organisationId);
      res.json(data);
    } catch (error) {
      console.error('[route]', error);
      res.status(500).json({ message: "Failed to fetch MBS Dext Precision data" });
    }
  });

  app.post("/api/mbs-dext-precision", requirePermission('manage_data'), requireTeamAccess(['bodyTeamId']), async (req, res) => {
    try {
      const { insertMbsDextPrecisionSchema } = await import("@shared/schema");
      const validatedData = insertMbsDextPrecisionSchema.parse(req.body);
      
      // Check if entry already exists for this team and week
      const existing = await storage.getMbsDextPrecision(validatedData.teamId, validatedData.weekEnding);
      
      if (existing) {
        // Update existing entry
        const updated = await storage.updateMbsDextPrecision(validatedData.teamId, validatedData.weekEnding, validatedData);
        res.json(updated);
      } else {
        // Create new entry
        const entry = await storage.createMbsDextPrecision({ ...validatedData, organisationId: (req as any).organisationId, submittedBy: (req as any).user?.id });
        res.status(201).json(entry);
      }
    } catch (error) {
      console.error('[route]', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create/update MBS Dext Precision data" });
    }
  });

  app.delete("/api/mbs-dext-precision/:id", requirePermission('manage_data'), requireTeamAccess(['queryTeamId']), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteMbsDextPrecision(id);
      res.status(204).send();
    } catch (error) {
      console.error('[route]', error);
      res.status(500).json({ message: "Failed to delete MBS Dext Precision entry" });
    }
  });

  // MBS Oldest Items routes
  app.get("/api/mbs-oldest-items", requirePermission('view_dashboard'), requireTeamAccess(['queryTeamId']), async (req, res) => {
    try {
      const teamId = req.query.teamId ? parseInt(req.query.teamId as string) : undefined;
      const data = await storage.getAllMbsOldestItems(teamId, (req as any).organisationId);
      res.json(data);
    } catch (error) {
      console.error('[route]', error);
      res.status(500).json({ message: "Failed to fetch MBS Oldest Items data" });
    }
  });

  app.post("/api/mbs-oldest-items", requirePermission('manage_data'), requireTeamAccess(['bodyTeamId']), async (req, res) => {
    try {
      const { insertMbsOldestItemsSchema } = await import("@shared/schema");
      const validatedData = insertMbsOldestItemsSchema.parse(req.body);
      
      // Check if entry already exists for this team and week
      const existing = await storage.getMbsOldestItems(validatedData.teamId, validatedData.weekEnding);
      
      if (existing) {
        // Update existing entry
        const updated = await storage.updateMbsOldestItems(validatedData.teamId, validatedData.weekEnding, validatedData);
        res.json(updated);
      } else {
        // Create new entry
        const entry = await storage.createMbsOldestItems({ ...validatedData, organisationId: (req as any).organisationId, submittedBy: (req as any).user?.id });
        res.status(201).json(entry);
      }
    } catch (error) {
      console.error('[route]', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create/update MBS Oldest Items data" });
    }
  });

  app.delete("/api/mbs-oldest-items/:id", requirePermission('manage_data'), requireTeamAccess(['queryTeamId']), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteMbsOldestItems(id);
      res.status(204).send();
    } catch (error) {
      console.error('[route]', error);
      res.status(500).json({ message: "Failed to delete MBS Oldest Items entry" });
    }
  });

  // Client Bookkeeping Results routes
  app.get("/api/client-bookkeeping/results", requirePermission('view_dashboard'), requireTeamAccess(['queryTeamId']), async (req, res) => {
    try {
      const teamId = req.query.teamId ? parseInt(req.query.teamId as string) : undefined;
      const results = await storage.getAllClientBookkeepingResults(teamId, (req as any).organisationId);
      res.json(results);
    } catch (error) {
      console.error("Error fetching Client Bookkeeping results:", error);
      res.status(500).json({ message: "Failed to fetch Client Bookkeeping results" });
    }
  });

  app.get("/api/client-bookkeeping/results/:teamId/:weekEnding", requirePermission('view_dashboard'), requireTeamAccess(['paramsTeamId']), async (req, res) => {
    try {
      const teamId = parseInt(req.params.teamId);
      const weekEnding = req.params.weekEnding;
      const result = await storage.getClientBookkeepingResult(teamId, weekEnding);
      if (!result) {
        return res.status(404).json({ message: "Client Bookkeeping result not found" });
      }
      res.json(result);
    } catch (error) {
      console.error("Error fetching Client Bookkeeping result:", error);
      res.status(500).json({ message: "Failed to fetch Client Bookkeeping result" });
    }
  });

  app.post("/api/client-bookkeeping/results", requirePermission('manage_data'), requireTeamAccess(['bodyTeamId']), async (req, res) => {
    try {
      console.log("Client Bookkeeping Results POST request body:", req.body);
      const validatedData = insertWeeklyResultSchema.parse(req.body);
      console.log("Validated Client Bookkeeping results data:", validatedData);
      
      const result = await storage.createClientBookkeepingResult({ ...validatedData, organisationId: (req as any).organisationId, submittedBy: (req as any).user?.id });
      res.status(201).json(result);
    } catch (error) {
      console.error("Client Bookkeeping Results creation error:", error);
      res.status(500).json({ 
        message: "Failed to create/update Client Bookkeeping result", 
        error: error instanceof Error ? error.message : "Unknown error" 
      });
    }
  });

  app.delete("/api/client-bookkeeping/results/:id", requirePermission('manage_data'), requireTeamAccess(['queryTeamId']), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteClientBookkeepingResult(id);
      res.json({ message: "Client Bookkeeping result deleted successfully" });
    } catch (error) {
      console.error("Error deleting Client Bookkeeping result:", error);
      res.status(500).json({ message: "Failed to delete Client Bookkeeping result" });
    }
  });

  // Client Dext Precision routes
  app.get("/api/client-dext-precision", requirePermission('view_dashboard'), requireTeamAccess(['queryTeamId']), async (req, res) => {
    try {
      const teamId = req.query.teamId ? parseInt(req.query.teamId as string) : undefined;
      const cacheKey = getCacheKey("client-dext-precision", teamId);
      let data = getFromCache(cacheKey);
      
      if (!data) {
        data = await storage.getAllClientDextPrecision(teamId, (req as any).organisationId);
        setInCache(cacheKey, data);
      }
      
      res.json(data);
    } catch (error) {
      console.error('[route]', error);
      res.status(500).json({ message: "Failed to fetch Client Dext Precision data" });
    }
  });

  app.post("/api/client-dext-precision", requirePermission('manage_data'), requireTeamAccess(['bodyTeamId']), async (req, res) => {
    try {
      const { insertClientDextPrecisionSchema } = await import("@shared/schema");
      const validatedData = insertClientDextPrecisionSchema.parse(req.body);
      
      // Check if entry already exists for this team and week
      const existing = await storage.getClientDextPrecision(validatedData.teamId, validatedData.weekEnding);
      
      if (existing) {
        // Update existing entry
        const updated = await storage.updateClientDextPrecision(validatedData.teamId, validatedData.weekEnding, validatedData);
        res.json(updated);
      } else {
        // Create new entry
        const entry = await storage.createClientDextPrecision({ ...validatedData, organisationId: (req as any).organisationId, submittedBy: (req as any).user?.id });
        res.status(201).json(entry);
      }
    } catch (error) {
      console.error('[route]', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create/update Client Dext Precision data" });
    }
  });

  app.delete("/api/client-dext-precision/:id", requirePermission('manage_data'), requireTeamAccess(['queryTeamId']), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteClientDextPrecision(id);
      
      // Invalidate cache for all client dext precision queries
      invalidateCache("client-dext-precision");
      
      res.status(204).send();
    } catch (error) {
      console.error('[route]', error);
      res.status(500).json({ message: "Failed to delete Client Dext Precision entry" });
    }
  });

  // Client Oldest Items routes
  app.get("/api/client-oldest-items", requirePermission('view_dashboard'), requireTeamAccess(['queryTeamId']), async (req, res) => {
    try {
      const teamId = req.query.teamId ? parseInt(req.query.teamId as string) : undefined;
      const cacheKey = getCacheKey("client-oldest-items", teamId);
      let data = getFromCache(cacheKey);
      
      if (!data) {
        data = await storage.getAllClientOldestItems(teamId, (req as any).organisationId);
        setInCache(cacheKey, data);
      }
      
      res.json(data);
    } catch (error) {
      console.error('[route]', error);
      res.status(500).json({ message: "Failed to fetch Client Oldest Items data" });
    }
  });

  app.post("/api/client-oldest-items", requirePermission('manage_data'), requireTeamAccess(['bodyTeamId']), async (req, res) => {
    try {
      const { insertClientOldestItemsSchema } = await import("@shared/schema");
      const validatedData = insertClientOldestItemsSchema.parse(req.body);
      
      // Check if entry already exists for this team and week
      const existing = await storage.getClientOldestItems(validatedData.teamId, validatedData.weekEnding);
      
      if (existing) {
        // Update existing entry
        const updated = await storage.updateClientOldestItems(validatedData.teamId, validatedData.weekEnding, validatedData);
        res.json(updated);
      } else {
        // Create new entry
        const entry = await storage.createClientOldestItems({ ...validatedData, organisationId: (req as any).organisationId, submittedBy: (req as any).user?.id });
        res.status(201).json(entry);
      }
    } catch (error) {
      console.error('[route]', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create/update Client Oldest Items data" });
    }
  });

  app.delete("/api/client-oldest-items/:id", requirePermission('manage_data'), requireTeamAccess(['queryTeamId']), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteClientOldestItems(id);
      
      // Invalidate cache for all client oldest items queries
      invalidateCache("client-oldest-items");
      
      res.status(204).send();
    } catch (error) {
      console.error('[route]', error);
      res.status(500).json({ message: "Failed to delete Client Oldest Items entry" });
    }
  });

  // Confirmation Statements Due Routes
  app.get("/api/confirmation-statements-due", requirePermission('view_dashboard'), requireTeamAccess(['queryTeamId']), async (req, res) => {
    try {
      const teamId = req.query.teamId ? parseInt(req.query.teamId as string) : undefined;
      const data = await storage.getAllConfirmationStatementsDue(teamId, (req as any).organisationId);
      res.json(data);
    } catch (error) {
      console.error('[route]', error);
      res.status(500).json({ message: "Failed to fetch confirmation statements due" });
    }
  });

  app.post("/api/confirmation-statements-due", requirePermission('manage_data'), requireTeamAccess(['bodyTeamId']), async (req, res) => {
    try {
      const validatedData = insertConfirmationStatementsDueSchema.parse(req.body);
      const data = await storage.createConfirmationStatementsDue({ ...validatedData, organisationId: (req as any).organisationId, submittedBy: (req as any).user?.id });
      res.status(201).json(data);
    } catch (error) {
      console.error('[route]', error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid data", errors: error.errors });
      } else {
        res.status(500).json({ message: "Failed to create confirmation statements due entry" });
      }
    }
  });

  app.put("/api/confirmation-statements-due/:id", requirePermission('manage_data'), requireTeamAccess(['bodyTeamId']), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const validatedData = insertConfirmationStatementsDueSchema.partial().parse(req.body);
      
      // Get existing entry to find teamId and weekEnding
      const allEntries = await storage.getAllConfirmationStatementsDue(undefined, (req as any).organisationId);
      const existing = allEntries.find(entry => entry.id === id);
      
      if (!existing) {
        res.status(404).json({ message: "Entry not found" });
        return;
      }
      
      const data = await storage.updateConfirmationStatementsDue(existing.teamId, existing.weekEnding, validatedData);
      res.json(data);
    } catch (error) {
      console.error('[route]', error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid data", errors: error.errors });
      } else {
        res.status(500).json({ message: "Failed to update confirmation statements due entry" });
      }
    }
  });

  // Confirmation Statements Dashboard Route
  app.get("/api/confirmation-statements/dashboard", requirePermission('view_dashboard'), requireTeamAccess(['queryTeamId']), async (req, res) => {
    try {
      const teamId = req.query.teamId ? parseInt(req.query.teamId as string) : undefined;
      const weekEnding = req.query.weekEnding as string;

      if (!weekEnding) {
        res.status(400).json({ message: "weekEnding parameter is required" });
        return;
      }

      // Get confirmation statements due data
      const confirmationStatementsDueData = await storage.getAllConfirmationStatementsDue(teamId, (req as any).organisationId);
      
      // Get current date info
      const currentDate = new Date();
      const currentYear = currentDate.getFullYear();
      const currentMonth = currentDate.getMonth();
      
      // Calculate 15th of current month
      const fifteenthOfMonth = new Date(currentYear, currentMonth, 15);
      const firstOfMonth = new Date(currentYear, currentMonth, 1);
      
      // Filter data for current month (1st to today so late-month submissions are never excluded)
      const currentMonthData = confirmationStatementsDueData.filter((item: any) => {
        const itemDate = new Date(item.weekEnding);
        return itemDate >= firstOfMonth && itemDate <= currentDate;
      });
      
      // Generate 6-month history data (15th of each month for last 6 months)
      const currentDayOfMonth = currentDate.getDate();
      const startMonthOffset = currentDayOfMonth >= 15 ? 0 : 1;
      
      const sixMonthHistory = [];
      for (let i = startMonthOffset; i < 6 + startMonthOffset; i++) {
        const historyDate = new Date(currentYear, currentMonth - i, 15);
        const monthName = historyDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
        
        // Find data closest to the 15th of each month
        const monthData = confirmationStatementsDueData.filter((item: any) => {
          const itemDate = new Date(item.weekEnding);
          const monthStart = new Date(historyDate.getFullYear(), historyDate.getMonth(), 1);
          const monthEnd = new Date(historyDate.getFullYear(), historyDate.getMonth() + 1, 0);
          return itemDate >= monthStart && itemDate <= monthEnd;
        });
        
        if (teamId) {
          // Individual team data
          const teamMonthData = monthData.filter((item: any) => item.teamId === teamId);
          const entryOn15th = teamMonthData.find((item: any) => {
            const itemDate = new Date(item.weekEnding);
            return itemDate.getDate() === 15;
          });
          
          let closestEntry = entryOn15th;
          if (!closestEntry && teamMonthData.length > 0) {
            const entriesBefor15th = teamMonthData.filter((item: any) => {
              const itemDate = new Date(item.weekEnding);
              return itemDate.getDate() <= 15;
            });
            
            if (entriesBefor15th.length > 0) {
              closestEntry = entriesBefor15th.sort((a: any, b: any) => 
                new Date(b.weekEnding).getTime() - new Date(a.weekEnding).getTime()
              )[0];
            } else {
              closestEntry = teamMonthData.sort((a: any, b: any) => 
                new Date(a.weekEnding).getTime() - new Date(b.weekEnding).getTime()
              )[0];
            }
          }
          
          sixMonthHistory.push({
            month: monthName,
            monthEnding: historyDate.toISOString().split('T')[0],
            remainingStatements: closestEntry?.statementsDue || 0,
            teamId: teamId,
            teamName: 'Team ' + teamId
          });
        } else {
          // Combined team data
          const teamSummaryMap = new Map();
          
          monthData.forEach((item: any) => {
            if (!teamSummaryMap.has(item.teamId)) {
              teamSummaryMap.set(item.teamId, []);
            }
            teamSummaryMap.get(item.teamId).push(item);
          });
          
          let totalRemainingOn15th = 0;
          teamSummaryMap.forEach((teamData: any[]) => {
            const entryOn15th = teamData.find((item: any) => {
              const itemDate = new Date(item.weekEnding);
              return itemDate.getDate() === 15;
            });
            
            let closestEntry = entryOn15th;
            if (!closestEntry && teamData.length > 0) {
              const entriesBefor15th = teamData.filter((item: any) => {
                const itemDate = new Date(item.weekEnding);
                return itemDate.getDate() <= 15;
              });
              
              if (entriesBefor15th.length > 0) {
                closestEntry = entriesBefor15th.sort((a: any, b: any) => 
                  new Date(b.weekEnding).getTime() - new Date(a.weekEnding).getTime()
                )[0];
              } else {
                closestEntry = teamData.sort((a: any, b: any) => 
                  new Date(a.weekEnding).getTime() - new Date(b.weekEnding).getTime()
                )[0];
              }
            }
            
            if (closestEntry) {
              totalRemainingOn15th += closestEntry.statementsDue || 0;
            }
          });
          
          sixMonthHistory.push({
            month: monthName,
            monthEnding: historyDate.toISOString().split('T')[0],
            remainingStatements: totalRemainingOn15th
          });
        }
      }
      
      // Calculate monthly performance summary
      const currentMonthTotal = currentMonthData.reduce((sum: number, item: any) => sum + (item.statementsDue || 0), 0);
      const startOfMonthTotal = currentMonthData.length > 0 ? 
        Math.max(...currentMonthData.map((item: any) => item.statementsDue || 0)) : 0;
      const totalCompleted = Math.max(0, startOfMonthTotal - currentMonthTotal);
      const percentageComplete = startOfMonthTotal > 0 ? Math.round((totalCompleted / startOfMonthTotal) * 100) : 0;
      
      const monthlyPerformance = {
        totalCompleted,
        totalRemaining: currentMonthTotal,
        percentageComplete,
        targetDate: fifteenthOfMonth.toISOString().split('T')[0]
      };
      
      // Prepare current month chart data
      const currentMonthChartData: any[] = [];
      if (teamId) {
        const teamCurrentData = currentMonthData.filter((item: any) => item.teamId === teamId);
        teamCurrentData.forEach((item: any) => {
          currentMonthChartData.push({
            date: item.weekEnding,
            remainingStatements: item.statementsDue || 0
          });
        });
      } else {
        // Aggregate all teams by date
        const dateMap = new Map();
        currentMonthData.forEach((item: any) => {
          const date = item.weekEnding;
          if (!dateMap.has(date)) {
            dateMap.set(date, 0);
          }
          dateMap.set(date, dateMap.get(date) + (item.statementsDue || 0));
        });
        
        dateMap.forEach((total, date) => {
          currentMonthChartData.push({
            date,
            remainingStatements: total
          });
        });
      }
      
      // Team performance summary
      const teams: any[] = [];
      if (!teamId) {
        const teamMap = new Map();
        currentMonthData.forEach((item: any) => {
          if (!teamMap.has(item.teamId)) {
            teamMap.set(item.teamId, []);
          }
          teamMap.get(item.teamId).push(item);
        });
        
        teamMap.forEach((teamData: any[], teamId: number) => {
          const currentRemaining = teamData.reduce((sum, item) => sum + (item.statementsDue || 0), 0);
          const teamStartTotal = teamData.length > 0 ? 
            Math.max(...teamData.map((item: any) => item.statementsDue || 0)) : 0;
          const teamCompleted = Math.max(0, teamStartTotal - currentRemaining);
          const teamPercentage = teamStartTotal > 0 ? Math.round((teamCompleted / teamStartTotal) * 100) : 0;
          
          teams.push({
            teamId: teamId,
            teamName: 'Team ' + teamId,
            currentRemaining,
            monthlyTarget: 0, // Target is always 0
            percentageComplete: teamPercentage
          });
        });
      }

      res.json({
        monthlyPerformance,
        currentMonthData: currentMonthChartData.sort((a: any, b: any) => 
          new Date(b.date).getTime() - new Date(a.date).getTime()
        ),
        sixMonthHistory: sixMonthHistory,
        teams: teams.sort((a: any, b: any) => b.percentageComplete - a.percentageComplete)
      });
    } catch (error) {
      console.error('[route]', error);
      res.status(500).json({ message: "Failed to fetch confirmation statements dashboard data" });
    }
  });

  // Confirmation Statement Turnaround Routes
  app.get("/api/confirmation-statement-turnaround", requirePermission('view_dashboard'), requireTeamAccess(['queryTeamId']), async (req, res) => {
    try {
      const teamId = req.query.teamId ? parseInt(req.query.teamId as string) : undefined;
      const data = await storage.getAllConfirmationStatementTurnaround(teamId, (req as any).organisationId);
      res.json(data);
    } catch (error) {
      console.error('[route]', error);
      res.status(500).json({ message: "Failed to fetch confirmation statement turnaround data" });
    }
  });

  app.post("/api/confirmation-statement-turnaround", requirePermission('manage_data'), requireTeamAccess(['bodyTeamId']), async (req, res) => {
    try {
      const validatedData = insertConfirmationStatementTurnaroundSchema.parse(req.body);
      const data = await storage.createConfirmationStatementTurnaround({ ...validatedData, organisationId: (req as any).organisationId, submittedBy: (req as any).user?.id });
      res.status(201).json(data);
    } catch (error) {
      console.error('[route]', error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid data", errors: error.errors });
      } else {
        res.status(500).json({ message: "Failed to create confirmation statement turnaround entry" });
      }
    }
  });

  app.put("/api/confirmation-statement-turnaround/:id", requirePermission('manage_data'), requireTeamAccess(['bodyTeamId']), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const validatedData = insertConfirmationStatementTurnaroundSchema.partial().parse(req.body);
      
      // Get existing entry to find teamId and weekEnding
      const allEntries = await storage.getAllConfirmationStatementTurnaround(undefined, (req as any).organisationId);
      const existing = allEntries.find((entry: any) => entry.id === id);
      
      if (!existing) {
        res.status(404).json({ message: "Entry not found" });
        return;
      }
      
      const data = await storage.updateConfirmationStatementTurnaround(existing.teamId, existing.weekEnding, validatedData);
      res.json(data);
    } catch (error) {
      console.error('[route]', error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid data", errors: error.errors });
      } else {
        res.status(500).json({ message: "Failed to update confirmation statement turnaround entry" });
      }
    }
  });

  app.delete("/api/confirmation-statement-turnaround/:id", requirePermission('manage_data'), requireTeamAccess(['queryTeamId']), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      
      // Get existing entry to find teamId and weekEnding
      const allEntries = await storage.getAllConfirmationStatementTurnaround(undefined, (req as any).organisationId);
      const existing = allEntries.find((entry: any) => entry.id === id);
      
      if (!existing) {
        res.status(404).json({ message: "Entry not found" });
        return;
      }
      
      await storage.deleteConfirmationStatementTurnaround(existing.teamId, existing.weekEnding);
      res.json({ message: "Confirmation statement turnaround entry deleted successfully" });
    } catch (error) {
      console.error('[route]', error);
      res.status(500).json({ message: "Failed to delete confirmation statement turnaround entry" });
    }
  });

  // Risks and Actions Module Routes
  
  // AI Analysis Generation (requires manage_data since it writes analysis)
  app.post("/api/risks-actions/generate-analysis", requirePermission('manage_data'), requireTeamAccess(['bodyTeamId']), async (req, res) => {
    try {
      const { teamId, moduleType } = req.body;
      
      // Set timeout for the entire operation
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Analysis timeout')), 15000); // 15 second timeout
      });
      
      const analysisPromise = async () => {
        // Use comprehensive AI analysis with real performance data
        const performanceData = await aiAnalysisService.gatherPerformanceData(teamId, moduleType);
        const aiResult: any = await aiAnalysisService.analyzePerformance(performanceData, teamId, moduleType);
        
        // Store analysis in database
        const analysisData = {
          analysisDate: new Date().toISOString().split('T')[0],
          teamId: teamId || null,
          moduleType: moduleType || 'overall',
          analysisType: 'performance',
          dataSnapshot: JSON.stringify({ moduleCount: performanceData.length, analysisTimestamp: new Date().toISOString() }),
          aiAnalysis: aiResult.analysis,
          riskLevel: aiResult.riskLevel,
          keyFindings: aiResult.keyFindings,
          trends: aiResult.trends,
          underperformingAreas: aiResult.underperformingAreas,
          organisationId: (req as any).organisationId ?? null
        };
        
        const riskAnalysis = await storage.createRiskAnalysis(analysisData);
        
        // Store clarifying questions
        const questions = await Promise.all(
          aiResult.clarifyingQuestions.map((q: any) => 
            storage.createClarifyingQuestion({
              riskAnalysisId: riskAnalysis.id,
              question: q.question,
              context: q.context,
              category: q.category,
              priority: q.priority
            })
          )
        );
        
        // Store recommendations
        const recommendations = await Promise.all(
          aiResult.recommendations.map((r: any) => 
            storage.createActionRecommendation({
              riskAnalysisId: riskAnalysis.id,
              priority: r.priority,
              category: r.category,
              recommendation: r.recommendation,
              expectedImpact: r.expectedImpact,
              timeframe: r.timeframe,
              estimatedEffort: r.estimatedEffort
            })
          )
        );
        
        return {
          analysis: riskAnalysis,
          questions,
          recommendations
        };
      };
      
      const result = await Promise.race([analysisPromise(), timeoutPromise]);
      res.json(result);
      
    } catch (error) {
      console.error('Analysis generation error:', error);
      res.status(500).json({ message: "Failed to generate AI analysis" });
    }
  });

  // Analysis generation function
  async function generateFallbackAnalysis(dataCheck: any, teamId?: number, moduleType?: string) {
    // Get actual team name from the teams data
    const selectedTeam = teamId ? dataCheck.teams.find((t: any) => t.id === teamId) : null;
    const teamScope = selectedTeam ? selectedTeam.name : 'All Teams';
    const hasData = dataCheck.hasAccountsData || dataCheck.hasVatData || dataCheck.hasConfirmationData;
    
    // Generate diverse underperforming areas based on module type and data availability
    const moduleSpecificAreas = getModuleSpecificRisks(moduleType, dataCheck);
    const diverseFindings = generateDiverseFindings(moduleType, dataCheck);
    const adaptiveRecommendations = generateAdaptiveRecommendations(moduleType, hasData);
    
    return {
      riskLevel: hasData ? 'medium' : 'high',
      analysis: `Performance analysis for ${teamScope} reveals ${moduleSpecificAreas.length} key risk areas across ${moduleType === 'overall' ? 'multiple business modules' : `the ${moduleType} module`}. ${hasData ? 'While data collection is active, several operational inefficiencies and process gaps require immediate attention.' : 'Limited data availability indicates fundamental tracking and monitoring gaps that pose significant operational risks.'}`,
      keyFindings: diverseFindings,
      trends: hasData ? [
        'Workload distribution patterns showing potential resource constraints',
        'Compliance deadline clustering indicating scheduling optimization needs',
        'Cross-module dependencies creating bottleneck risks'
      ] : [
        'Data collection inconsistencies across reporting periods',
        'Missing baseline metrics preventing trend analysis',
        'Resource allocation patterns unclear due to tracking gaps'
      ],
      underperformingAreas: moduleSpecificAreas,
      clarifyingQuestions: [
        {
          question: 'What are the current team capacity constraints and peak workload periods?',
          context: 'Understanding resource limitations helps prioritize workflow optimization and prevent burnout',
          category: 'resource',
          priority: 'high'
        },
        {
          question: 'Are there recurring compliance deadlines that create predictable bottlenecks?',
          context: 'Identifying deadline clustering allows for proactive resource planning and workload smoothing',
          category: 'process',
          priority: 'high'
        },
        {
          question: 'What external factors (client demands, regulatory changes) impact performance metrics?',
          context: 'External influences help distinguish controllable vs uncontrollable performance variables',
          category: 'external_factor',
          priority: 'medium'
        }
      ],
      recommendations: adaptiveRecommendations
    };
  }

  function getModuleSpecificRisks(moduleType?: string, dataCheck?: any) {
    const risks = [];
    
    // Always generate comprehensive risks across ALL modules for overall analysis
    if (moduleType === 'overall') {
      // Accounts Module Risks - Always include regardless of data
      risks.push('Accounts due processing times exceeding optimal thresholds');
      risks.push('Client bookkeeping delivery delays impacting satisfaction');
      risks.push('Month-end reconciliation bottlenecks creating backlogs');
      
      // VAT Module Risks - Always include regardless of data  
      risks.push('VAT return preparation workflow bottlenecks');
      risks.push('HMRC deadline pressure points affecting accuracy');
      risks.push('Quarterly VAT submission coordination challenges');
      
      // Health Checks Module Risks - Always include
      risks.push('Health check protocols not consistently applied across teams');
      risks.push('Preventive monitoring gaps allowing issues to escalate');
      risks.push('Business health assessment scheduling inefficiencies');
      
      // Confirmation Statements Module Risks - Always include
      risks.push('Confirmation statement filing coordination challenges');
      risks.push('Companies House annual deadline clustering creating resource strain');
      risks.push('Corporate compliance tracking inconsistencies');
      
      // MBS Bookkeeping Module Risks - Always include
      risks.push('MBS Dext precision accuracy declining affecting data quality');
      risks.push('Oldest items accumulation in MBS workflows creating backlogs');
      risks.push('Management bookkeeping service delivery inconsistencies');
      
      // Client Bookkeeping Module Risks - Always include
      risks.push('Client bookkeeping data quality issues impacting accuracy');
      risks.push('Client-specific task completion rates below expectations');
      risks.push('Client communication gaps during bookkeeping processes');
      
      // Cross-Module Operational Risks
      risks.push('Cross-module coordination inefficiencies');
      risks.push('Resource allocation imbalances between high/low activity periods');
      risks.push('Skill specialization gaps across different compliance areas');
      risks.push('Client communication inconsistencies between different service areas');
    } else {
      // Module-specific analysis
      if (moduleType === 'accounts') {
        risks.push('Accounts due processing times exceeding optimal thresholds');
        risks.push('Client communication gaps during deadline periods');
        risks.push('Data quality issues in bookkeeping records');
      } else if (moduleType === 'vat') {
        risks.push('VAT return preparation workflow bottlenecks');
        risks.push('Quarterly deadline pressure points affecting quality');
        risks.push('HMRC compliance exposure risks');
      } else if (moduleType === 'health_checks') {
        risks.push('Health check protocols not consistently applied across teams');
        risks.push('Preventive monitoring gaps allowing issues to escalate');
        risks.push('Business assessment scheduling conflicts');
      } else if (moduleType === 'confirmation_statements') {
        risks.push('Confirmation statement filing coordination challenges');
        risks.push('Annual deadline clustering creating resource strain');
        risks.push('Companies House compliance tracking gaps');
      } else if (moduleType === 'mbs_bookkeeping') {
        risks.push('MBS Dext precision accuracy declining affecting data quality');
        risks.push('Oldest items accumulation in MBS workflows creating backlogs');
        risks.push('Management bookkeeping service delivery inconsistencies');
      } else if (moduleType === 'client_bookkeeping') {
        risks.push('Client bookkeeping data quality issues impacting accuracy');
        risks.push('Client-specific task completion rates below expectations');
        risks.push('Client communication gaps during bookkeeping processes');
      }
    }
    
    return risks.length > 0 ? risks : [
      'Limited performance data preventing comprehensive risk assessment',
      'Baseline measurement gaps hindering improvement tracking'
    ];
  }

  function generateDiverseFindings(moduleType?: string, dataCheck?: any) {
    const findings = [];
    
    if (dataCheck.hasAccountsData) {
      findings.push('Accounts processing shows active engagement but variable completion rates');
    }
    
    if (dataCheck.hasVatData) {
      findings.push('VAT compliance activities demonstrate structured approach with optimization potential');
    }
    
    if (dataCheck.hasConfirmationData) {
      findings.push('Confirmation statement workflows established but require efficiency improvements');
    }
    
    findings.push('Team performance metrics indicate capacity for growth with proper support systems');
    findings.push('Current monitoring establishes foundation for data-driven decision making');
    
    return findings.length > 2 ? findings : [
      'Limited historical data constrains comprehensive performance evaluation',
      'Monitoring infrastructure needs development for effective analysis',
      'Initial data collection efforts show promise for future insights'
    ];
  }

  function generateAdaptiveRecommendations(moduleType?: string, hasData?: boolean) {
    const recommendations = [];
    
    if (moduleType === 'overall') {
      // Module-specific recommendations for comprehensive business improvement
      
      // Accounts Module Recommendations
      recommendations.push({
        priority: 'high',
        category: 'process',
        recommendation: 'Implement automated accounts due tracking with client notification system',
        expectedImpact: 'Reduced manual follow-up, improved client satisfaction, faster collections',
        timeframe: 'short_term',
        estimatedEffort: 'medium'
      });
      
      // VAT Module Recommendations
      recommendations.push({
        priority: 'urgent',
        category: 'process',
        recommendation: 'Create VAT deadline calendar with automated preparation workflows',
        expectedImpact: 'Eliminated missed deadlines, reduced HMRC penalties, improved compliance',
        timeframe: 'immediate',
        estimatedEffort: 'medium'
      });
      
      // Health Checks Module Recommendations
      recommendations.push({
        priority: 'medium',
        category: 'training',
        recommendation: 'Standardize health check protocols with team-specific checklists',
        expectedImpact: 'Consistent quality, comprehensive coverage, reduced oversight gaps',
        timeframe: 'medium_term',
        estimatedEffort: 'low'
      });
      
      // Confirmation Statements Recommendations
      recommendations.push({
        priority: 'high',
        category: 'system',
        recommendation: 'Deploy Companies House filing management system with annual planning',
        expectedImpact: 'Proactive deadline management, reduced last-minute rushes, compliance assurance',
        timeframe: 'short_term',
        estimatedEffort: 'high'
      });
      
      // Cross-Module Recommendations
      recommendations.push({
        priority: 'medium',
        category: 'resource',
        recommendation: 'Establish cross-functional expertise development program',
        expectedImpact: 'Increased team flexibility, reduced bottlenecks, improved coverage',
        timeframe: 'long_term',
        estimatedEffort: 'high'
      });
      
      recommendations.push({
        priority: 'high',
        category: 'system',
        recommendation: 'Integrate module performance dashboards for unified oversight',
        expectedImpact: 'Holistic visibility, coordinated planning, resource optimization',
        timeframe: 'short_term',
        estimatedEffort: 'high'
      });
      
    } else {
      // Generic recommendations for single modules or no data scenarios
      if (hasData) {
        recommendations.push({
          priority: 'urgent',
          category: 'process',
          recommendation: 'Implement workload leveling to distribute peak period pressures',
          expectedImpact: 'Reduced stress, improved quality, better deadline management',
          timeframe: 'immediate',
          estimatedEffort: 'medium'
        });
        
        recommendations.push({
          priority: 'medium',
          category: 'training',
          recommendation: 'Develop module-specific efficiency protocols and best practices',
          expectedImpact: 'Standardized workflows, reduced variability, knowledge sharing',
          timeframe: 'medium_term',
          estimatedEffort: 'medium'
        });
      } else {
        recommendations.push({
          priority: 'urgent',
          category: 'system',
          recommendation: 'Implement comprehensive data collection across all modules',
          expectedImpact: 'Foundation for performance monitoring and improvement initiatives',
          timeframe: 'immediate',
          estimatedEffort: 'high'
        });
      }
    }
    
    return recommendations;
  }

  // Get Risk Analyses
  app.get("/api/risks-actions/analyses", requirePermission('view_reports'), requireTeamAccess(['queryTeamId']), async (req, res) => {
    try {
      const teamId = req.query.teamId ? parseInt(req.query.teamId as string) : undefined;
      const analyses = await storage.getAllRiskAnalyses((req as any).organisationId, teamId);
      res.json(analyses);
    } catch (error) {
      console.error('[route]', error);
      res.status(500).json({ message: "Failed to fetch risk analyses" });
    }
  });

  // Get specific Risk Analysis with related data
  app.get("/api/risks-actions/analyses/:id", requirePermission('view_reports'), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const analysis = await storage.getRiskAnalysis(id);
      
      if (!analysis) {
        res.status(404).json({ message: "Analysis not found" });
        return;
      }
      
      const questions = await storage.getAllClarifyingQuestions(id);
      const recommendations = await storage.getAllActionRecommendations(id);
      
      res.json({
        analysis,
        questions,
        recommendations
      });
    } catch (error) {
      console.error('[route]', error);
      res.status(500).json({ message: "Failed to fetch analysis details" });
    }
  });

  // Tax Data Routes
  app.get("/api/tax-data", requirePermission('view_dashboard'), requireTeamAccess(['queryTeamId']), async (req, res) => {
    try {
      const teamId = req.query.teamId ? parseInt(req.query.teamId as string) : undefined;
      const taxData = await storage.getAllTaxData(teamId, (req as any).organisationId);
      res.json(taxData);
    } catch (error) {
      console.error("Error fetching tax data:", error);
      res.status(500).json({ message: "Failed to fetch tax data" });
    }
  });

  app.get("/api/tax-data/:teamId/:weekEnding", requirePermission('view_dashboard'), requireTeamAccess(['paramsTeamId']), async (req, res) => {
    try {
      const teamId = parseInt(req.params.teamId);
      const weekEnding = req.params.weekEnding;
      const taxData = await storage.getTaxData(teamId, weekEnding);
      if (!taxData) {
        return res.status(404).json({ message: "Tax data not found" });
      }
      res.json(taxData);
    } catch (error) {
      console.error('[route]', error);
      res.status(500).json({ message: "Failed to fetch tax data" });
    }
  });

  app.post("/api/tax-data", requirePermission('manage_data'), requireTeamAccess(['bodyTeamId']), async (req, res) => {
    try {
      // Create validation schema that doesn't require taxYearStart since server will add it
      const taxDataInputSchema = insertTaxDataSchema.omit({ taxYearStart: true });
      const validatedData = taxDataInputSchema.parse(req.body);
      
      // Automatically set the tax year start date
      const currentTaxYear = getCurrentTaxYear();
      const taxDataWithYear = {
        ...validatedData,
        taxYearStart: currentTaxYear.taxYearStart.toISOString().split('T')[0] // Convert to YYYY-MM-DD format
      };
      
      const existing = await storage.getTaxData(validatedData.teamId, validatedData.weekEnding);
      
      if (existing) {
        const updated = await storage.updateTaxData(validatedData.teamId, validatedData.weekEnding, taxDataWithYear);
        // Invalidate cache for tax progress data
        invalidateCache("tax-progress");
        res.json(updated);
      } else {
        const created = await storage.createTaxData({ ...taxDataWithYear, organisationId: (req as any).organisationId, submittedBy: (req as any).user?.id });
        // Invalidate cache for tax progress data
        invalidateCache("tax-progress");
        res.status(201).json(created);
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        console.error("Tax data validation errors:", error.errors);
        console.error("Received data:", req.body);
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      console.error("Error saving tax data:", error);
      res.status(500).json({ message: "Failed to save tax data" });
    }
  });

  app.put("/api/tax-data/:teamId/:weekEnding", requirePermission('manage_data'), requireTeamAccess(['paramsTeamId']), async (req, res) => {
    try {
      const teamId = parseInt(req.params.teamId);
      const weekEnding = req.params.weekEnding;
      const validatedData = insertTaxDataSchema.partial().parse(req.body);
      
      const updated = await storage.updateTaxData(teamId, weekEnding, validatedData);
      if (!updated) {
        return res.status(404).json({ message: "Tax data not found" });
      }
      // Invalidate cache for tax progress data
      invalidateCache("tax-progress");
      res.json(updated);
    } catch (error) {
      console.error('[route]', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update tax data" });
    }
  });

  app.delete("/api/tax-data/:teamId/:weekEnding", requirePermission('manage_data'), requireTeamAccess(['paramsTeamId']), async (req, res) => {
    try {
      const teamId = parseInt(req.params.teamId);
      const weekEnding = req.params.weekEnding;
      await storage.deleteTaxData(teamId, weekEnding);
      // Invalidate cache for tax progress data
      invalidateCache("tax-progress");
      res.status(204).send();
    } catch (error) {
      console.error('[route]', error);
      res.status(500).json({ message: "Failed to delete tax data" });
    }
  });

  // Revenue Analytics Routes
  app.get("/api/revenue-analytics/targets", requirePermission('view_dashboard'), requireTeamAccess(['queryTeamId']), async (req, res) => {
    try {
      const teamId = req.query.teamId ? parseInt(req.query.teamId as string) : undefined;
      const targets = await storage.getAllRevenueAnalyticsTargets(teamId, (req as any).organisationId);
      res.json(targets);
    } catch (error) {
      console.error("Error fetching revenue analytics targets:", error);
      res.status(500).json({ message: "Failed to fetch revenue analytics targets" });
    }
  });

  app.post("/api/revenue-analytics/targets", requirePermission('manage_data'), requireTeamAccess(['bodyTeamId']), async (req, res) => {
    try {
      const validatedData = insertRevenueAnalyticsTargetSchema.parse(req.body);
      const target = await storage.createRevenueAnalyticsTarget({ ...validatedData, organisationId: (req as any).organisationId, submittedBy: (req as any).user?.id });
      res.status(201).json(target);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      console.error("Error creating revenue analytics target:", error);
      res.status(500).json({ message: "Failed to create revenue analytics target" });
    }
  });

  app.get("/api/revenue-analytics/results", requirePermission('view_dashboard'), requireTeamAccess(['queryTeamId']), async (req, res) => {
    try {
      const teamId = req.query.teamId ? parseInt(req.query.teamId as string) : undefined;
      const results = await storage.getAllRevenueAnalyticsResults(teamId, (req as any).organisationId);
      res.json(results);
    } catch (error) {
      console.error("Error fetching revenue analytics results:", error);
      res.status(500).json({ message: "Failed to fetch revenue analytics results" });
    }
  });

  app.post("/api/revenue-analytics/results", requirePermission('manage_data'), requireTeamAccess(['bodyTeamId']), async (req: any, res) => {
    try {
      const validatedData = insertRevenueAnalyticsResultSchema.parse(req.body);
      const result = await storage.createRevenueAnalyticsResult({ ...validatedData, organisationId: req.organisationId ?? null });
      res.status(201).json(result);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      console.error("Error creating revenue analytics result:", error);
      res.status(500).json({ message: "Failed to create revenue analytics result" });
    }
  });

  app.get("/api/revenue-analytics/performance", requirePermission('view_dashboard'), requireTeamAccess(['queryTeamId']), async (req, res) => {
    try {
      const teamId = req.query.teamId ? parseInt(req.query.teamId as string) : undefined;
      const performanceData = await storage.getRevenueAnalyticsPerformanceData(teamId, (req as any).organisationId);
      res.json(performanceData);
    } catch (error) {
      console.error("Error fetching revenue analytics performance data:", error);
      res.status(500).json({ message: "Failed to fetch revenue analytics performance data" });
    }
  });

  // Update Action Recommendation Status
  app.put("/api/risks-actions/recommendations/:id", requirePermission('manage_data'), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const validatedData = insertActionRecommendationSchema.partial().parse(req.body);
      
      const recommendation = await storage.updateActionRecommendation(id, validatedData);
      res.json(recommendation);
    } catch (error) {
      console.error('[route]', error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid data", errors: error.errors });
      } else {
        res.status(500).json({ message: "Failed to update recommendation" });
      }
    }
  });

  // Answer Clarifying Question
  app.put("/api/risks-actions/questions/:id/respond", requirePermission('manage_data'), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { response, respondedBy } = req.body;
      
      const updatedQuestion = await storage.updateClarifyingQuestion(id, {
        response,
        respondedBy,
        respondedAt: new Date()
      });
      
      res.json(updatedQuestion);
    } catch (error) {
      console.error('[route]', error);
      res.status(500).json({ message: "Failed to update question response" });
    }
  });

  // Add Comment to Analysis
  app.post("/api/risks-actions/analyses/:id/comments", requirePermission('manage_data'), async (req, res) => {
    try {
      const riskAnalysisId = parseInt(req.params.id);
      const { comment, commentType, commentedBy } = req.body;
      
      const validatedData = {
        riskAnalysisId,
        comment,
        commentType: commentType || 'feedback',
        commentedBy: commentedBy || 'Anonymous User'
      };
      
      const newComment = await storage.createAnalysisComment(validatedData);
      res.status(201).json(newComment);
    } catch (error) {
      console.error('[route]', error);
      res.status(500).json({ message: "Failed to add comment to analysis" });
    }
  });

  // Get Comments for Analysis
  app.get("/api/risks-actions/analyses/:id/comments", requirePermission('view_reports'), async (req, res) => {
    try {
      const riskAnalysisId = parseInt(req.params.id);
      const comments = await storage.getAllAnalysisComments(riskAnalysisId);
      res.json(comments);
    } catch (error) {
      console.error('[route]', error);
      res.status(500).json({ message: "Failed to fetch analysis comments" });
    }
  });

  // Update Analysis Comment
  app.put("/api/risks-actions/comments/:id", requirePermission('manage_data'), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { comment } = req.body;
      
      const updatedComment = await storage.updateAnalysisComment(id, { comment });
      res.json(updatedComment);
    } catch (error) {
      console.error('[route]', error);
      res.status(500).json({ message: "Failed to update comment" });
    }
  });

  // Delete Analysis Comment
  app.delete("/api/risks-actions/comments/:id", requirePermission('manage_data'), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteAnalysisComment(id);
      res.json({ message: "Comment deleted successfully" });
    } catch (error) {
      console.error('[route]', error);
      res.status(500).json({ message: "Failed to delete comment" });
    }
  });

  // Add Team Response to Question
  app.post("/api/risks-actions/questions/:questionId/team-responses", requirePermission('manage_data'), async (req, res) => {
    try {
      const questionId = parseInt(req.params.questionId);
      const validatedData = insertTeamResponseSchema.parse({
        ...req.body,
        questionId
      });
      
      const teamResponse = await storage.createTeamResponse(validatedData);
      res.status(201).json(teamResponse);
    } catch (error) {
      console.error('[route]', error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid data", errors: error.errors });
      } else {
        res.status(500).json({ message: "Failed to create team response" });
      }
    }
  });

  // Generate Follow-up Analysis (requires manage_data since it writes analysis)
  app.post("/api/risks-actions/follow-up-analysis", requirePermission('manage_data'), async (req, res) => {
    try {
      const { analysisId, moduleType } = req.body;
      
      // Get original analysis
      const originalAnalysis = await storage.getRiskAnalysis(analysisId);
      if (!originalAnalysis) {
        res.status(404).json({ message: "Original analysis not found" });
        return;
      }
      
      // Get team responses to questions
      const questions = await storage.getAllClarifyingQuestions(analysisId);
      const teamResponses = await Promise.all(
        questions.map(q => storage.getAllTeamResponses(q.id))
      );
      
      // Generate follow-up analysis
      const followUpResult = await aiAnalysisService.generateFollowUpAnalysis(
        originalAnalysis,
        teamResponses.flat(),
        moduleType
      );
      
      // Store new analysis
      const newAnalysisData = {
        analysisDate: new Date().toISOString().split('T')[0],
        teamId: originalAnalysis.teamId,
        moduleType: moduleType || 'overall',
        analysisType: 'follow_up',
        dataSnapshot: originalAnalysis.dataSnapshot,
        aiAnalysis: followUpResult.analysis,
        riskLevel: followUpResult.riskLevel,
        keyFindings: followUpResult.keyFindings,
        trends: followUpResult.trends,
        underperformingAreas: followUpResult.underperformingAreas
      };
      
      const newAnalysis = await storage.createRiskAnalysis(newAnalysisData);
      
      res.json(newAnalysis);
    } catch (error) {
      console.error('Follow-up analysis error:', error);
      res.status(500).json({ message: "Failed to generate follow-up analysis" });
    }
  });

  // Dashboard endpoint for overview
  app.get("/api/risks-actions/dashboard", requirePermission('view_reports'), requireTeamAccess(['queryTeamId']), async (req, res) => {
    try {
      const teamId = req.query.teamId ? parseInt(req.query.teamId as string) : undefined;
      
      // Get latest analyses by module
      const modules = ['overall', 'accounts', 'vat', 'health_checks', 'confirmation_statements'];
      const latestAnalyses = await Promise.all(
        modules.map(module => storage.getLatestRiskAnalysis(module, teamId))
      );
      
      // Get all recommendations grouped by status with priority-based limiting
      const allRecommendations = await storage.getAllActionRecommendations(undefined, (req as any).organisationId);
      
      // Priority sorting helper function
      const priorityOrder: Record<string, number> = { 'urgent': 4, 'high': 3, 'medium': 2, 'low': 1 };
      const sortByPriority = (items: any[]) => 
        items.sort((a, b) => {
          const aPriority = priorityOrder[a.priority as string] || 0;
          const bPriority = priorityOrder[b.priority as string] || 0;
          return bPriority - aPriority;
        });
      
      // Filter, sort by priority, and limit to top 5 for each category
      const pendingRecommendations = sortByPriority(
        allRecommendations.filter(r => r.status === 'pending')
      ).slice(0, 5);
      
      const activeRecommendations = sortByPriority(
        allRecommendations.filter(r => r.status === 'in_progress')
      ).slice(0, 5);
      
      const completedRecommendations = allRecommendations
        .filter(r => r.status === 'completed')
        .sort((a, b) => new Date(b.completedAt || 0).getTime() - new Date(a.completedAt || 0).getTime())
        .slice(0, 5);
      
      // Get unanswered questions, prioritized and limited to top 5
      const allQuestions = await storage.getAllClarifyingQuestions(undefined, (req as any).organisationId);
      const unansweredQuestions = sortByPriority(
        allQuestions.filter(q => !q.response)
      ).slice(0, 5);
      
      res.json({
        latestAnalyses: latestAnalyses.filter(Boolean),
        pendingRecommendations,
        activeRecommendations,
        completedRecommendations,
        unansweredQuestions,
        summaryStats: {
          totalAnalyses: latestAnalyses.filter(Boolean).length,
          highRiskAreas: latestAnalyses.filter(a => a && (a.riskLevel === 'high' || a.riskLevel === 'critical')).length,
          pendingActions: pendingRecommendations.length,
          activeActions: activeRecommendations.length,
          completedActions: completedRecommendations.length,
          openQuestions: unansweredQuestions.length
        }
      });
    } catch (error) {
      console.error('[route]', error);
      res.status(500).json({ message: "Failed to fetch dashboard data" });
    }
  });

  // Tax progress data with auto-calculated cumulative totals
  app.get("/api/tax-progress", requirePermission('view_dashboard'), requireTeamAccess(['queryTeamId']), async (req, res) => {
    try {
      const teamId = req.query.teamId ? parseInt(req.query.teamId as string) : undefined;
      const progressData = await storage.getTaxYearProgressData(teamId, (req as any).organisationId);
      
      // Add tax year information for display
      const currentTaxYear = getCurrentTaxYear();
      
      // Set cache headers to prevent stale data
      res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.set('Pragma', 'no-cache');
      res.set('Expires', '0');
      
      res.json({
        progressData,
        taxYearInfo: {
          taxYearDisplay: formatTaxYear(currentTaxYear.taxYearStart),
          taxYearStart: currentTaxYear.taxYearStart.toISOString().split('T')[0],
          filingDeadline: currentTaxYear.filingDeadline.toISOString().split('T')[0],
          resetDate: currentTaxYear.resetDate.toISOString().split('T')[0],
          isActive: currentTaxYear.isActive,
          isGracePeriod: currentTaxYear.isGracePeriod,
          shouldShowData: currentTaxYear.shouldShowData,
          label: currentTaxYear.label,
        }
      });
    } catch (error) {
      console.error("Error fetching tax progress data:", error);
      res.status(500).json({ message: "Failed to fetch tax progress data" });
    }
  });

  // Overview Dashboard API
  app.get("/api/overview", requirePermission('view_dashboard'), async (req: any, res) => {
    try {
      const teamId = req.query.teamId && req.query.teamId !== 'all' ? parseInt(req.query.teamId as string) : undefined;
      
      // Get all teams for context
      const allTeams = await storage.getAllTeams(req.organisationId);
      const filteredTeams = teamId ? allTeams.filter(team => team.id === teamId) : allTeams;
      
      // Helper function to calculate performance percentage
      const calculatePerformance = (completed: number, target: number): number => {
        if (target === 0) return 0;
        return Math.min(Math.round((completed / target) * 100), 100);
      };

      // Helper function to determine status based on performance
      const getStatus = (performance: number): 'excellent' | 'good' | 'warning' | 'critical' => {
        if (performance >= 90) return 'excellent';
        if (performance >= 75) return 'good';
        if (performance >= 60) return 'warning';
        return 'critical';
      };

      // Helper function to determine trend (simplified - would use historical data in real implementation)
      const getTrend = (performance: number): 'up' | 'down' | 'stable' => {
        if (performance >= 85) return 'up';
        if (performance <= 60) return 'down';
        return 'stable';
      };

      // Gather data from all modules
      const moduleData: any[] = [];

      // 1. Accounts Module
      try {
        const accountsTargets = await storage.getAllWeeklyTargets(teamId);
        const accountsResults = await storage.getAllWeeklyResults(teamId);
        const accountsDue = await storage.getAllAccountsDue(teamId);
        
        const totalAccountsTarget = accountsTargets.reduce((sum: number, t: any) => sum + t.rollingFourWeekTarget, 0);
        const totalAccountsCompleted = accountsResults.reduce((sum: number, r: any) => sum + (r.accountsCompleted || 0), 0);
        const accountsOverdue = accountsDue.filter((item: any) => new Date(item.dueDate) < new Date()).length;
        
        const accountsPerformance = calculatePerformance(totalAccountsCompleted, totalAccountsTarget);
        
        moduleData.push({
          moduleName: 'accounts',
          displayName: 'Accounts',
          icon: 'FileText',
          performance: accountsPerformance,
          trend: getTrend(accountsPerformance),
          status: getStatus(accountsPerformance),
          completedTargets: totalAccountsCompleted,
          totalTargets: totalAccountsTarget,
          keyMetric: accountsOverdue > 0 ? `${accountsOverdue} overdue accounts` : 'On track',
          lastUpdated: new Date().toISOString(),
        });
      } catch (error) {
        console.error("Error fetching accounts data:", error);
      }

      // 2. VAT Module
      try {
        const vatDue = await storage.getAllVatDue(teamId);
        const currentDate = new Date();
        const vatOverdue = vatDue.filter((item: any) => new Date(item.dueDate) < currentDate).length;
        
        // Simplified calculation for VAT performance
        const vatPerformance = vatDue.length > 0 ? Math.max(0, 100 - (vatOverdue * 20)) : 80;
        
        moduleData.push({
          moduleName: 'vat',
          displayName: 'VAT Returns',
          icon: 'DollarSign',
          performance: vatPerformance,
          trend: getTrend(vatPerformance),
          status: getStatus(vatPerformance),
          completedTargets: Math.max(0, vatDue.length - vatOverdue),
          totalTargets: vatDue.length || 1,
          keyMetric: vatOverdue > 0 ? `${vatOverdue} overdue returns` : 'All current',
          lastUpdated: new Date().toISOString(),
        });
      } catch (error) {
        console.error("Error fetching VAT data:", error);
      }

      // 3. Tax Module
      try {
        const taxData = await storage.getAllTaxData(teamId);
        const currentTaxYear = getCurrentTaxYear();
        
        // Filter for current tax year
        const currentYearTaxData = taxData.filter((item: any) => {
          const itemDate = new Date(item.weekEnding);
          return itemDate >= currentTaxYear.taxYearStart && itemDate <= currentTaxYear.taxYearEnd;
        });

        const totalTaxTarget = currentYearTaxData.reduce((sum: number, item: any) => sum + (item.personalTaxTarget || 0) + (item.businessTaxTarget || 0), 0);
        const totalTaxCompleted = currentYearTaxData.reduce((sum: number, item: any) => sum + (item.personalTaxCompleted || 0) + (item.businessTaxCompleted || 0), 0);
        
        const taxPerformance = calculatePerformance(totalTaxCompleted, totalTaxTarget);
        
        moduleData.push({
          moduleName: 'tax',
          displayName: 'Tax Returns',
          icon: 'Activity',
          performance: taxPerformance,
          trend: getTrend(taxPerformance),
          status: getStatus(taxPerformance),
          completedTargets: totalTaxCompleted,
          totalTargets: totalTaxTarget,
          keyMetric: `${totalTaxCompleted}/${totalTaxTarget} returns completed`,
          lastUpdated: new Date().toISOString(),
        });
      } catch (error) {
        console.error("Error fetching tax data:", error);
      }

      // 4. Health Checks (Management Accounts) Module
      try {
        const healthDue = await storage.getAllHealthChecksDue(teamId);
        const currentDate = new Date();
        const healthOverdue = healthDue.filter((item: any) => new Date(item.dueDate) < currentDate).length;
        
        // Simplified calculation for health checks performance
        const healthPerformance = healthDue.length > 0 ? Math.max(0, 100 - (healthOverdue * 15)) : 85;
        
        moduleData.push({
          moduleName: 'health-checks',
          displayName: 'Management Accounts',
          icon: 'Shield',
          performance: healthPerformance,
          trend: getTrend(healthPerformance),
          status: getStatus(healthPerformance),
          completedTargets: Math.max(0, healthDue.length - healthOverdue),
          totalTargets: healthDue.length || 1,
          keyMetric: healthOverdue > 0 ? `${healthOverdue} overdue items` : 'Up to date',
          lastUpdated: new Date().toISOString(),
        });
      } catch (error) {
        console.error("Error fetching health checks data:", error);
      }

      // 5. Confirmation Statements Module
      try {
        const csDue = await storage.getAllConfirmationStatementsDue(teamId);
        const currentDate = new Date();
        const csOverdue = csDue.filter((item: any) => new Date(item.dueDate) < currentDate).length;
        
        // Simplified calculation for confirmation statements performance
        const csPerformance = csDue.length > 0 ? Math.max(0, 100 - (csOverdue * 10)) : 90;
        
        moduleData.push({
          moduleName: 'confirmation-statements',
          displayName: 'Confirmation Statements',
          icon: 'Calendar',
          performance: csPerformance,
          trend: getTrend(csPerformance),
          status: getStatus(csPerformance),
          completedTargets: Math.max(0, csDue.length - csOverdue),
          totalTargets: csDue.length || 1,
          keyMetric: csOverdue > 0 ? `${csOverdue} overdue statements` : 'All current',
          lastUpdated: new Date().toISOString(),
        });
      } catch (error) {
        console.error("Error fetching confirmation statements data:", error);
      }

      // 6. Bookkeeping Module
      try {
        const mbsResults = await storage.getAllMbsResults(teamId);
        const clientResults = await storage.getAllClientBookkeepingResults(teamId);
        
        const totalBookkeepingItems = mbsResults.length + clientResults.length;
        const bookkeepingPerformance = totalBookkeepingItems > 0 ? 75 : 0;
        
        moduleData.push({
          moduleName: 'bookkeeping',
          displayName: 'Bookkeeping',
          icon: 'BookOpen',
          performance: bookkeepingPerformance,
          trend: getTrend(bookkeepingPerformance),
          status: getStatus(bookkeepingPerformance),
          completedTargets: totalBookkeepingItems,
          totalTargets: totalBookkeepingItems || 1,
          keyMetric: `${totalBookkeepingItems} entries tracked`,
          lastUpdated: new Date().toISOString(),
        });
      } catch (error) {
        console.error("Error fetching bookkeeping data:", error);
      }

      // Calculate overall performance
      const validModules = moduleData.filter(m => m.totalTargets > 0);
      const overallPerformance = validModules.length > 0 
        ? Math.round(validModules.reduce((sum, m) => sum + m.performance, 0) / validModules.length)
        : 0;

      // Generate team performance analysis
      const teamPerformance = filteredTeams.map(team => {
        const moduleScores: Record<string, number> = {};
        const improvements: string[] = [];
        const concerns: string[] = [];

        // Calculate team-specific scores for each module
        moduleData.forEach(module => {
          const score = module.performance;
          moduleScores[module.moduleName] = score;
          
          if (score >= 85) {
            improvements.push(`Excellent performance in ${module.displayName}`);
          } else if (score < 60) {
            concerns.push(`${module.displayName} needs attention`);
          }
        });

        const overallScore = Object.values(moduleScores).length > 0
          ? Math.round(Object.values(moduleScores).reduce((sum, score) => sum + score, 0) / Object.values(moduleScores).length)
          : 0;

        return {
          teamId: team.id,
          teamName: team.name,
          overallScore,
          moduleScores,
          improvements: improvements.slice(0, 3),
          concerns: concerns.slice(0, 3),
        };
      });

      // Generate performance analysis
      const excellentModules = moduleData.filter(m => m.status === 'excellent');
      const criticalModules = moduleData.filter(m => m.status === 'critical');
      const improvingModules = moduleData.filter(m => m.trend === 'up');

      const performanceAnalysis = {
        strengths: excellentModules.map(m => `${m.displayName} performing excellently at ${m.performance}%`),
        improvements: moduleData
          .filter(m => m.status === 'warning' || m.status === 'critical')
          .map(m => `${m.displayName} needs improvement (${m.performance}%)`),
        recentImprovements: improvingModules.map(m => `${m.displayName} showing positive trends`),
        riskAreas: criticalModules.map(m => `${m.displayName} requires immediate attention (${m.performance}%)`),
      };

      const response = {
        summary: {
          totalTeams: filteredTeams.length,
          totalModules: moduleData.length,
          overallPerformance,
          trendsDirection: overallPerformance >= 75 ? 'up' : overallPerformance <= 60 ? 'down' : 'stable' as 'up' | 'down' | 'stable',
        },
        modulePerformance: moduleData,
        teamPerformance,
        performanceAnalysis,
      };

      res.json(response);
    } catch (error) {
      console.error("Error fetching overview data:", error);
      res.status(500).json({ message: "Failed to fetch overview data" });
    }
  });

  // Quarterly Goals Routes
  app.get("/api/quarterly-goals", requirePermission('view_dashboard'), async (req: any, res) => {
    try {
      const goals = await storage.getAllQuarterlyGoals(req.organisationId);
      res.json(goals);
    } catch (error) {
      console.error("Error fetching quarterly goals:", error);
      res.status(500).json({ message: "Failed to fetch quarterly goals" });
    }
  });

  app.post("/api/quarterly-goals", requirePermission('manage_users'), async (req: any, res) => {
    try {
      const validatedData = insertQuarterlyGoalSchema.parse(req.body);
      const goal = await storage.createQuarterlyGoal({ ...validatedData, organisationId: req.organisationId ?? null });
      res.status(201).json(goal);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      console.error("Error creating quarterly goal:", error);
      res.status(500).json({ message: "Failed to create quarterly goal" });
    }
  });

  app.put("/api/quarterly-goals/:id", requirePermission('manage_data'), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const validatedData = insertQuarterlyGoalSchema.partial().parse(req.body);
      const goal = await storage.updateQuarterlyGoal(id, validatedData);
      if (!goal) {
        return res.status(404).json({ message: "Quarterly goal not found" });
      }
      res.json(goal);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      console.error("Error updating quarterly goal:", error);
      res.status(500).json({ message: "Failed to update quarterly goal" });
    }
  });

  app.delete("/api/quarterly-goals/:id", requirePermission('manage_users'), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteQuarterlyGoal(id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting quarterly goal:", error);
      res.status(500).json({ message: "Failed to delete quarterly goal" });
    }
  });

  // Quarterly Targets Routes
  app.get("/api/quarterly-targets", requirePermission('view_dashboard'), async (req: any, res) => {
    try {
      const quarterlyGoalId = req.query.quarterlyGoalId ? parseInt(req.query.quarterlyGoalId as string) : undefined;
      const targets = await storage.getAllQuarterlyTargets(quarterlyGoalId, req.organisationId);
      res.json(targets);
    } catch (error) {
      console.error("Error fetching quarterly targets:", error);
      res.status(500).json({ message: "Failed to fetch quarterly targets" });
    }
  });

  app.post("/api/quarterly-targets", requirePermission('view_dashboard'), async (req: any, res) => {
    try {
      const validatedData = insertQuarterlyTargetSchema.parse(req.body);
      const target = await storage.createQuarterlyTarget({ ...validatedData, organisationId: req.organisationId ?? null });
      res.status(201).json(target);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      console.error("Error creating quarterly target:", error);
      res.status(500).json({ message: "Failed to create quarterly target" });
    }
  });

  app.put("/api/quarterly-targets/:id", requirePermission('view_dashboard'), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const validatedData = insertQuarterlyTargetSchema.partial().parse(req.body);
      const target = await storage.updateQuarterlyTarget(id, validatedData);
      if (!target) {
        return res.status(404).json({ message: "Quarterly target not found" });
      }
      res.json(target);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      console.error("Error updating quarterly target:", error);
      res.status(500).json({ message: "Failed to update quarterly target" });
    }
  });

  app.delete("/api/quarterly-targets/:id", requirePermission('manage_users'), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteQuarterlyTarget(id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting quarterly target:", error);
      res.status(500).json({ message: "Failed to delete quarterly target" });
    }
  });

  // Rock Reminder Dismissals API routes
  app.get("/api/rock-reminders", requirePermission('view_dashboard'), async (req, res) => {
    try {
      const userId = (req.user as any).id;
      const dismissals = await storage.getRockReminderDismissals(userId);
      res.json(dismissals);
    } catch (error) {
      console.error("Error fetching rock reminders:", error);
      res.status(500).json({ message: "Failed to fetch rock reminders" });
    }
  });

  app.post("/api/rock-reminders/dismiss", requirePermission('view_dashboard'), async (req: any, res) => {
    try {
      const userId = (req.user as any).id;
      const { snooze, ...rest } = req.body;
      
      let snoozedUntil = null;
      if (snooze) {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        snoozedUntil = tomorrow.toISOString().split('T')[0];
      }
      
      const validatedData = insertRockReminderDismissalSchema.parse({
        ...rest,
        userId,
        snoozedUntil,
        organisationId: req.organisationId ?? null,
      });
      const dismissal = await storage.createRockReminderDismissal(validatedData);
      res.status(201).json(dismissal);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      console.error("Error dismissing rock reminder:", error);
      res.status(500).json({ message: "Failed to dismiss rock reminder" });
    }
  });

  // Values API routes
  app.get("/api/values", requirePermission('view_dashboard'), async (req: any, res) => {
    try {
      const values = await storage.getAllValues(req.organisationId);
      res.json(values);
    } catch (error) {
      console.error("Error fetching values:", error);
      res.status(500).json({ message: "Failed to fetch values" });
    }
  });

  app.post("/api/values", requirePermission('manage_users'), async (req: any, res) => {
    try {
      const validatedData = insertValueSchema.parse(req.body);
      const value = await storage.createValue({ ...validatedData, organisationId: req.organisationId ?? null });
      res.status(201).json(value);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      console.error("Error creating value:", error);
      res.status(500).json({ message: "Failed to create value" });
    }
  });

  app.put("/api/values/:id", requirePermission('manage_users'), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const validatedData = insertValueSchema.partial().parse(req.body);
      const value = await storage.updateValue(id, validatedData);
      if (!value) {
        return res.status(404).json({ message: "Value not found" });
      }
      res.json(value);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      console.error("Error updating value:", error);
      res.status(500).json({ message: "Failed to update value" });
    }
  });

  app.delete("/api/values/:id", requirePermission('manage_users'), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteValue(id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting value:", error);
      res.status(500).json({ message: "Failed to delete value" });
    }
  });

  // Client Value Manager routes
  app.get("/api/client-value-clients", requirePermission('view_dashboard'), async (req, res) => {
    try {
      const teamId = req.query.teamId ? parseInt(req.query.teamId as string) : undefined;
      const archivedOnly = req.query.archived === 'true';
      const clients = await storage.getAllClientValueClients(teamId, (req as any).organisationId, archivedOnly);
      res.json(clients);
    } catch (error) {
      console.error("Error fetching client value clients:", error);
      res.status(500).json({ message: "Failed to fetch clients" });
    }
  });

  app.get("/api/client-value-clients/:id", requirePermission('view_dashboard'), async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const client = await storage.getClientValueClient(id);
      if (!client) {
        return res.status(404).json({ message: "Client not found" });
      }
      // Enforce org isolation — reject if client belongs to a different organisation
      if (client.organisationId && req.organisationId && client.organisationId !== req.organisationId) {
        return res.status(403).json({ message: "Access denied" });
      }
      res.json(client);
    } catch (error) {
      console.error("Error fetching client:", error);
      res.status(500).json({ message: "Failed to fetch client" });
    }
  });

  app.post("/api/client-value-clients/import", requirePermission('manage_data'), async (req: any, res) => {
    try {
      const orgId = req.organisationId;
      const { clients: rows, teamId, duplicateAction = 'skip' } = req.body;

      if (!Array.isArray(rows) || !teamId) {
        return res.status(400).json({ message: "clients array and teamId are required" });
      }

      // Fetch existing active clients for duplicate detection
      const existing = await storage.getAllClientValueClients(undefined, orgId);
      const existingByName = new Map(existing.map(c => [c.clientName.toLowerCase().trim(), c]));

      const parseFee = (v: any): number => {
        if (v === null || v === undefined || v === '') return 0;
        return Math.round(parseFloat(String(v).replace(/[£,\s]/g, '')) || 0);
      };

      let imported = 0, updated = 0, skipped = 0;
      const errors: { row: number; name: string; reason: string }[] = [];

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const rowNum = i + 1;
        const name = String(row.clientName || '').trim();

        if (!name) {
          errors.push({ row: rowNum, name: '(blank)', reason: 'Client Name is required' });
          skipped++;
          continue;
        }

        const currentMonthlyFee = parseFee(row.currentMonthlyFee);
        const targetMonthlyFee = parseFee(row.targetMonthlyFee);

        const clientData = {
          teamId: Number(teamId),
          organisationId: orgId ?? null,
          clientName: name,
          clientCode: row.clientCode?.trim() || null,
          sector: row.sector?.trim() || null,
          pod: row.pod?.trim() || null,
          currentServiceLevel: row.currentServiceLevel?.trim() || null,
          targetServiceLevel: row.targetServiceLevel?.trim() || null,
          currentMonthlyFee,
          targetMonthlyFee,
          clientQuality: row.clientQuality?.trim() || null,
          notes: row.notes?.trim() || null,
          isArchived: false,
        };

        const existingClient = existingByName.get(name.toLowerCase());

        if (existingClient) {
          if (duplicateAction === 'skip') {
            skipped++;
            continue;
          }
          // Update existing
          await storage.updateClientValueClient(existingClient.id, clientData);
          updated++;
        } else {
          await storage.createClientValueClient(clientData);
          imported++;
        }
      }

      res.json({ imported, updated, skipped, errors });
    } catch (error) {
      console.error("Import error:", error);
      res.status(500).json({ message: "Import failed" });
    }
  });

  app.post("/api/client-value-clients", requirePermission('manage_data'), async (req: any, res) => {
    try {
      // Plan limit enforcement
      const orgId = req.organisationId;
      if (orgId) {
        const org = await storage.getOrganisation(orgId);
        if (org && !(org as any).isExempt) {
          const limits = getPlanLimits((org as any).subscriptionPlan, org.subscriptionStatus);
          if (limits.clientLimit !== null) {
            const existingClients = await storage.getAllClientValueClients(undefined, orgId);
            if (existingClients.length >= limits.clientLimit) {
              return res.status(403).json({
                message: getUpgradeMessage((org as any).subscriptionPlan, "client"),
                limitReached: true,
              });
            }
          }
        }
      }

      const validatedData = insertClientValueClientSchema.parse(req.body);
      const client = await storage.createClientValueClient({
        ...validatedData,
        organisationId: orgId ?? validatedData.organisationId ?? null,
      });
      res.status(201).json(client);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      console.error("Error creating client:", error);
      res.status(500).json({ message: "Failed to create client" });
    }
  });

  app.put("/api/client-value-clients/:id", requirePermission('manage_data'), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const validatedData = insertClientValueClientSchema.partial().parse(req.body);
      const client = await storage.updateClientValueClient(id, validatedData);
      if (!client) {
        return res.status(404).json({ message: "Client not found" });
      }
      res.json(client);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      console.error("Error updating client:", error);
      res.status(500).json({ message: "Failed to update client" });
    }
  });

  app.delete("/api/client-value-clients/:id", requirePermission('manage_data'), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteClientValueClient(id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting client:", error);
      res.status(500).json({ message: "Failed to delete client" });
    }
  });

  // ── Stripe / Subscription Routes ─────────────────────────────────────────

  // Initialise Stripe products (run once on startup, safe to call repeatedly)
  if (stripe) {
    ensureStripeProducts().catch((err) =>
      console.error("[Stripe] Failed to ensure products:", err.message)
    );
  }

  // Get all plans with their Stripe price IDs
  app.get("/api/stripe/plans", isAuthenticated, async (_req, res) => {
    try {
      const planArray = Object.entries(PLANS).map(([key, p]) => ({
        id: key,
        name: p.name,
        description: `Up to ${p.userLimit ?? "unlimited"} users`,
        monthlyPrice: Math.round((p as any).monthlyAmount / 100),
        yearlyPrice: Math.round((p as any).yearlyAmount / 100),
        features: [...p.features],
        limits: { users: p.userLimit ?? null, clients: p.clientLimit ?? null },
        highlight: !!(p as any).popular,
      }));
      res.json(planArray);
    } catch (error) {
      console.error("Error fetching plans:", error);
      res.status(500).json({ message: "Failed to fetch plans" });
    }
  });

  // Create Stripe Checkout session
  app.post("/api/stripe/checkout", isAuthenticated, async (req: any, res) => {
    try {
      if (!stripe) return res.status(503).json({ message: "Stripe not configured" });

      const { planId, planKey: planKeyBody, interval, successUrl, cancelUrl } = req.body;
      const planKey = planId || planKeyBody;
      if (!planKey || !interval) {
        return res.status(400).json({ message: "planId and interval are required" });
      }

      const orgId = req.organisationId;
      if (!orgId) return res.status(403).json({ message: "No organisation" });

      const org = await storage.getOrganisation(orgId);
      if (!org) return res.status(404).json({ message: "Organisation not found" });

      // Get or create Stripe customer
      const customerId = await getOrCreateStripeCustomer(orgId, org.name, req.user.email);

      // Get price ID
      const priceIds = await ensureStripeProducts();
      const priceId = priceIds[planKey]?.[interval as "monthly" | "yearly"];
      if (!priceId) return res.status(400).json({ message: "Invalid plan or interval" });

      // No Stripe-managed trial — our own 14-day in-app trial is tracked via trialEndsAt.
      // When users subscribe they are charged immediately.
      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        payment_method_types: ["card"],
        line_items: [{ price: priceId, quantity: 1 }],
        mode: "subscription",
        automatic_tax: { enabled: true },
        customer_update: { address: "auto" },
        subscription_data: { metadata: { pt_org_id: String(orgId) } },
        metadata: { pt_org_id: String(orgId) },
        success_url: successUrl || `${req.protocol}://${req.get("host")}/admin/settings?session_id={CHECKOUT_SESSION_ID}&billing=1`,
        cancel_url: cancelUrl || `${req.protocol}://${req.get("host")}/admin/settings`,
      });

      res.json({ url: session.url });
    } catch (error: any) {
      console.error("Error creating checkout session:", error.message);
      res.status(500).json({ message: "Failed to create checkout session" });
    }
  });

  // Change an existing subscription to a different plan or interval.
  // Upgrades take effect immediately (prorated invoice created).
  // Downgrades take effect at next renewal (no proration charge/credit).
  app.post("/api/stripe/subscription/change", isAuthenticated, async (req: any, res) => {
    try {
      if (!stripe) return res.status(503).json({ message: "Stripe not configured" });

      const orgId = req.organisationId;
      const { planId, interval } = req.body as { planId: string; interval: "monthly" | "yearly" };

      const org = await storage.getOrganisation(orgId);
      const orgAny = org as any;
      if (!orgAny.stripeSubscriptionId) {
        return res.status(400).json({ message: "No active subscription found. Please subscribe first." });
      }

      const priceIds = await ensureStripeProducts();
      const newPriceId = priceIds[planId as any]?.[interval];
      if (!newPriceId) return res.status(400).json({ message: "Invalid plan or interval" });

      const subscription = await stripe.subscriptions.retrieve(orgAny.stripeSubscriptionId);
      const currentItemId = subscription.items.data[0]?.id;

      const PLAN_ORDER = ["starter", "growth", "scale", "pro"];
      const currentRank = PLAN_ORDER.indexOf(orgAny.subscriptionPlan || "");
      const newRank = PLAN_ORDER.indexOf(planId);
      const isUpgrade = newRank > currentRank || (newRank === currentRank && interval === "yearly" && orgAny.subscriptionInterval === "monthly");

      console.log(`[Stripe] Subscription change for org ${orgId}: ${orgAny.subscriptionPlan} → ${planId} (${interval}), isUpgrade=${isUpgrade}`);

      const updated = await stripe.subscriptions.update(orgAny.stripeSubscriptionId, {
        items: [{ id: currentItemId, price: newPriceId }],
        proration_behavior: isUpgrade ? "always_invoice" : "none",
      });

      const { plan: resolvedPlan, interval: resolvedInterval } = await getPlanFromPrice(newPriceId);
      await storage.updateOrganisation(orgId, {
        subscriptionPlan: resolvedPlan || undefined,
        subscriptionInterval: resolvedInterval || undefined,
        subscriptionStatus: "active",
        currentPeriodEndsAt: updated.current_period_end ? new Date(updated.current_period_end * 1000) : undefined,
      } as any);

      console.log(`[Stripe] Subscription changed for org ${orgId}: plan=${resolvedPlan}, interval=${resolvedInterval}`);
      res.json({ success: true, isUpgrade, plan: resolvedPlan, interval: resolvedInterval });
    } catch (error: any) {
      console.error("Error changing subscription:", error.message);
      res.status(500).json({ message: error.message || "Failed to change subscription" });
    }
  });

  // Verify a completed checkout session and update org subscription immediately.
  // Called by the frontend when it detects ?session_id= in the URL after redirect from Stripe.
  app.get("/api/stripe/checkout/verify", isAuthenticated, async (req: any, res) => {
    try {
      if (!stripe) return res.status(503).json({ message: "Stripe not configured" });

      const sessionId = req.query.session_id as string;
      if (!sessionId) return res.status(400).json({ message: "Missing session_id" });

      console.log(`[Stripe Verify] Retrieving checkout session ${sessionId}`);
      const session = await stripe.checkout.sessions.retrieve(sessionId, {
        expand: ["subscription", "subscription.items.data.price.product"],
      });

      console.log(`[Stripe Verify] Session status=${session.status}, payment_status=${session.payment_status}`);

      if (session.payment_status !== "paid") {
        return res.status(400).json({ message: `Payment not complete (status: ${session.payment_status})` });
      }

      // Use pt_org_id from metadata — this is the authoritative source
      const orgId = session.metadata?.pt_org_id ? parseInt(session.metadata.pt_org_id) : req.organisationId;
      console.log(`[Stripe Verify] Updating org ${orgId}`);

      const subscription = session.subscription as any;
      const priceId = subscription?.items?.data?.[0]?.price?.id;
      const { plan, interval } = priceId ? await getPlanFromPrice(priceId) : { plan: null, interval: null };

      const customerId = typeof session.customer === "string" ? session.customer : null;
      const subscriptionId = typeof subscription?.id === "string" ? subscription.id : null;

      await storage.updateOrganisation(orgId, {
        stripeCustomerId: customerId || undefined,
        stripeSubscriptionId: subscriptionId || undefined,
        subscriptionStatus: "active",
        subscriptionPlan: plan || undefined,
        subscriptionInterval: interval || undefined,
        currentPeriodEndsAt: subscription?.current_period_end
          ? new Date(subscription.current_period_end * 1000)
          : undefined,
      } as any);

      console.log(`[Stripe Verify] SUCCESS — org ${orgId} updated to active, plan=${plan}, interval=${interval}`);
      res.json({ success: true, plan, interval });
    } catch (error: any) {
      console.error("[Stripe Verify] Error:", error.message);
      res.status(500).json({ message: "Failed to verify checkout session" });
    }
  });

  // Create Stripe Customer Portal session
  app.post("/api/stripe/billing-portal", isAuthenticated, async (req: any, res) => {
    try {
      if (!stripe) return res.status(503).json({ message: "Stripe not configured" });

      const orgId = req.organisationId;
      if (!orgId) return res.status(403).json({ message: "No organisation" });

      const org = await storage.getOrganisation(orgId);
      const customerId = (org as any)?.stripeCustomerId;

      if (!customerId) {
        return res.status(400).json({ message: "No Stripe customer found. Please subscribe first." });
      }

      const session = await stripe.billingPortal.sessions.create({
        customer: customerId,
        return_url: `${req.protocol}://${req.get("host")}/admin/settings`,
      });

      res.json({ url: session.url });
    } catch (error: any) {
      console.error("Error creating billing portal session:", error.message);
      res.status(500).json({ message: "Failed to create billing portal session" });
    }
  });

  // Get current subscription info
  app.get("/api/stripe/subscription", isAuthenticated, async (req: any, res) => {
    try {
      const orgId = req.organisationId;
      if (!orgId) return res.json({ plan: "trialling", interval: null, status: "trialling", trialEndsAt: null, currentPeriodEndsAt: null, hasStripeSubscription: false });
      const org = await storage.getOrganisation(orgId);
      if (!org) return res.status(404).json({ message: "Organisation not found" });
      const orgAny = org as any;

      // If we have a Stripe subscription but no plan stored, fetch it live from Stripe
      // and back-fill it into the database so we don't need to call Stripe every time.
      let resolvedPlan = orgAny.subscriptionPlan || null;
      let resolvedInterval = orgAny.subscriptionInterval || null;
      if (!resolvedPlan && orgAny.stripeSubscriptionId && stripe) {
        try {
          const sub = await stripe.subscriptions.retrieve(orgAny.stripeSubscriptionId);
          const priceId = sub.items.data[0]?.price?.id;
          if (priceId) {
            const result = await getPlanFromPrice(priceId);
            resolvedPlan = result.plan;
            resolvedInterval = result.interval;
            // Back-fill so we don't hit Stripe on every request
            if (resolvedPlan) {
              await storage.updateOrganisation(orgId, {
                subscriptionPlan: resolvedPlan,
                subscriptionInterval: resolvedInterval || undefined,
                currentPeriodEndsAt: sub.current_period_end ? new Date(sub.current_period_end * 1000) : undefined,
              } as any);
            }
          }
        } catch (e) {
          // Non-fatal — just log and continue without plan
          console.warn("[stripe/subscription] Could not resolve plan from Stripe:", (e as any).message);
        }
      }

      res.json({
        plan: resolvedPlan || org.subscriptionStatus || "trialling",
        interval: resolvedInterval,
        status: org.subscriptionStatus || "trialling",
        trialEndsAt: orgAny.trialEndsAt || null,
        currentPeriodEndsAt: orgAny.currentPeriodEndsAt || null,
        hasStripeSubscription: !!orgAny.stripeSubscriptionId,
      });
    } catch (error) {
      console.error('[route]', error);
      res.status(500).json({ message: "Failed to fetch subscription" });
    }
  });

  // ── Management Reports Module ────────────────────────────────────────────────

  // Report Clients
  app.get('/api/report-clients', isAuthenticated, requireOrganisation, async (req: any, res) => {
    try {
      const orgId = req.user.organisationId;
      const clients = await storage.getAllReportClients(orgId);
      res.json(clients);
    } catch (e) { res.status(500).json({ message: "Failed to fetch report clients" }); }
  });

  app.post('/api/report-clients', isAuthenticated, requireOrganisation, async (req: any, res) => {
    try {
      const orgId = req.user.organisationId;
      const data = insertReportClientSchema.parse({ ...req.body, organisationId: orgId });
      const client = await storage.createReportClient(data);
      res.status(201).json(client);
    } catch (e: any) { res.status(400).json({ message: e.message }); }
  });

  app.get('/api/report-clients/:id', isAuthenticated, requireOrganisation, async (req: any, res) => {
    try {
      const client = await storage.getReportClient(parseInt(req.params.id));
      if (!client || client.organisationId !== req.user.organisationId) return res.status(404).json({ message: "Client not found" });
      res.json(client);
    } catch (e) { res.status(500).json({ message: "Failed to fetch client" }); }
  });

  app.put('/api/report-clients/:id', isAuthenticated, requireOrganisation, async (req: any, res) => {
    try {
      const client = await storage.getReportClient(parseInt(req.params.id));
      if (!client || client.organisationId !== req.user.organisationId) return res.status(404).json({ message: "Client not found" });
      const updated = await storage.updateReportClient(parseInt(req.params.id), req.body);
      res.json(updated);
    } catch (e: any) { res.status(400).json({ message: e.message }); }
  });

  app.delete('/api/report-clients/:id', isAuthenticated, requireOrganisation, async (req: any, res) => {
    try {
      const client = await storage.getReportClient(parseInt(req.params.id));
      if (!client || client.organisationId !== req.user.organisationId) return res.status(404).json({ message: "Client not found" });
      await storage.deleteReportClient(parseInt(req.params.id));
      res.json({ ok: true });
    } catch (e) { res.status(500).json({ message: "Failed to delete client" }); }
  });

  // Strategic Plans
  app.get('/api/report-clients/:clientId/strategic-plan', isAuthenticated, requireOrganisation, async (req: any, res) => {
    try {
      const client = await storage.getReportClient(parseInt(req.params.clientId));
      if (!client || client.organisationId !== req.user.organisationId) return res.status(404).json({ message: "Client not found" });
      const plan = await storage.getStrategicPlanForClient(parseInt(req.params.clientId));
      res.json(plan || null);
    } catch (e) { res.status(500).json({ message: "Failed to fetch strategic plan" }); }
  });

  app.post('/api/report-clients/:clientId/strategic-plan', isAuthenticated, requireOrganisation, async (req: any, res) => {
    try {
      const orgId = req.user.organisationId;
      const client = await storage.getReportClient(parseInt(req.params.clientId));
      if (!client || client.organisationId !== orgId) return res.status(404).json({ message: "Client not found" });
      const data = insertStrategicPlanSchema.partial().parse({
        ...req.body,
        organisationId: orgId,
        clientId: parseInt(req.params.clientId),
      });
      const plan = await storage.upsertStrategicPlan(data as any);
      res.json(plan);
    } catch (e: any) { res.status(400).json({ message: e.message }); }
  });

  app.get('/api/strategic-plans/:id', isAuthenticated, requireOrganisation, async (req: any, res) => {
    try {
      const plan = await storage.getStrategicPlan(parseInt(req.params.id));
      if (!plan || plan.organisationId !== req.user.organisationId) return res.status(404).json({ message: "Plan not found" });
      res.json(plan);
    } catch (e) { res.status(500).json({ message: "Failed to fetch plan" }); }
  });

  // Reports for a client
  app.get('/api/report-clients/:clientId/reports', isAuthenticated, requireOrganisation, async (req: any, res) => {
    try {
      const orgId = req.user.organisationId;
      const client = await storage.getReportClient(parseInt(req.params.clientId));
      if (!client || client.organisationId !== orgId) return res.status(404).json({ message: "Client not found" });
      const reports = await storage.getAllReportsForClient(parseInt(req.params.clientId), orgId);
      res.json(reports);
    } catch (e) { res.status(500).json({ message: "Failed to fetch reports" }); }
  });

  app.post('/api/report-clients/:clientId/reports', isAuthenticated, requireOrganisation, async (req: any, res) => {
    try {
      const orgId = req.user.organisationId;
      const clientId = parseInt(req.params.clientId);
      const client = await storage.getReportClient(clientId);
      if (!client || client.organisationId !== orgId) return res.status(404).json({ message: "Client not found" });

      const { periodType, periodStart, periodEnd, periodLabel } = req.body;

      // Create the period first
      const period = await storage.createManagementReportPeriod({
        organisationId: orgId,
        clientId,
        periodType: periodType || client.reportFrequency,
        periodStart,
        periodEnd,
        periodLabel,
        xeroConnected: false,
      });

      // Get latest strategic plan
      const plan = await storage.getStrategicPlanForClient(clientId);

      const report = await storage.createManagementReport({
        organisationId: orgId,
        clientId,
        periodId: period.id,
        strategicPlanId: plan?.id ?? null,
        status: "draft",
        financialData: {
          period: { start: periodStart, end: periodEnd, label: periodLabel },
          income_statement: { total_revenue: 0, cost_of_sales: 0, gross_profit: 0, gross_margin_pct: 0, total_expenses: 0, operating_profit: 0, operating_margin_pct: 0, net_profit: 0, net_margin_pct: 0, revenue_breakdown: [], expense_breakdown: [] },
          cashflow: { opening_balance: 0, cash_in: 0, cash_out: 0, net_cashflow: 0, closing_balance: 0 },
          balance_sheet: { total_assets: 0, current_assets: 0, current_liabilities: 0, net_assets: 0, total_debt: 0 },
          kpis: { debtor_days: 0, creditor_days: 0, current_ratio: 0, cash_balance: 0 },
          monthly_trend: [],
        },
        customData: {},
        reportPeriodType: periodType || client.reportFrequency,
      });

      res.status(201).json({ ...report, period });
    } catch (e: any) { res.status(400).json({ message: e.message }); }
  });

  // Single report
  app.get('/api/reports/:id', isAuthenticated, requireOrganisation, async (req: any, res) => {
    try {
      const report = await storage.getManagementReport(parseInt(req.params.id));
      if (!report || report.organisationId !== req.user.organisationId) return res.status(404).json({ message: "Report not found" });
      res.json(report);
    } catch (e) { res.status(500).json({ message: "Failed to fetch report" }); }
  });

  app.put('/api/reports/:id', isAuthenticated, requireOrganisation, async (req: any, res) => {
    try {
      const report = await storage.getManagementReport(parseInt(req.params.id));
      if (!report || report.organisationId !== req.user.organisationId) return res.status(404).json({ message: "Report not found" });
      const updated = await storage.updateManagementReport(parseInt(req.params.id), req.body);
      res.json(updated);
    } catch (e: any) { res.status(400).json({ message: e.message }); }
  });

  app.put('/api/reports/:id/financial-data', isAuthenticated, requireOrganisation, async (req: any, res) => {
    try {
      const report = await storage.getManagementReport(parseInt(req.params.id));
      if (!report || report.organisationId !== req.user.organisationId) return res.status(404).json({ message: "Report not found" });
      const updated = await storage.updateManagementReport(parseInt(req.params.id), { financialData: req.body });
      res.json(updated);
    } catch (e: any) { res.status(400).json({ message: e.message }); }
  });

  app.put('/api/reports/:id/custom-data', isAuthenticated, requireOrganisation, async (req: any, res) => {
    try {
      const report = await storage.getManagementReport(parseInt(req.params.id));
      if (!report || report.organisationId !== req.user.organisationId) return res.status(404).json({ message: "Report not found" });
      const updated = await storage.updateManagementReport(parseInt(req.params.id), { customData: req.body });
      res.json(updated);
    } catch (e: any) { res.status(400).json({ message: e.message }); }
  });

  // Report Structures
  app.get('/api/report-clients/:clientId/structure', isAuthenticated, requireOrganisation, async (req: any, res) => {
    try {
      const client = await storage.getReportClient(parseInt(req.params.clientId));
      if (!client || client.organisationId !== req.user.organisationId) return res.status(404).json({ message: "Client not found" });
      const structure = await storage.getReportStructureForClient(parseInt(req.params.clientId));
      res.json(structure || null);
    } catch (e) { res.status(500).json({ message: "Failed to fetch structure" }); }
  });

  app.post('/api/report-clients/:clientId/generate-structure', isAuthenticated, requireOrganisation, async (req: any, res) => {
    try {
      const orgId = req.user.organisationId;
      const clientId = parseInt(req.params.clientId);
      const client = await storage.getReportClient(clientId);
      if (!client || client.organisationId !== orgId) return res.status(404).json({ message: "Client not found" });

      const { clientContext } = req.body;
      const contextToUse = clientContext || client.clientContext || "";

      // Save context if provided
      if (clientContext) {
        await storage.updateReportClient(clientId, { clientContext });
      }

      const strategicPlan = await storage.getStrategicPlanForClient(clientId);

      const generated = await generateReportStructure({
        clientName: client.clientName,
        companyName: client.companyName,
        industry: client.industry,
        clientContext: contextToUse,
        strategicPlan: strategicPlan || null,
      });

      const structure = await storage.upsertReportStructure({
        organisationId: orgId,
        clientId,
        coreQuestions: generated.core_questions,
        keyMetrics: generated.key_metrics,
        sectionOrder: generated.section_order,
        focusAreas: generated.focus_areas,
        status: "draft",
        aiGeneratedAt: new Date(),
      });

      res.json({ structure, rationale: generated.rationale });
    } catch (e: any) {
      console.error("[structure] Generate error:", e);
      res.status(500).json({ message: e.message || "Structure generation failed" });
    }
  });

  app.put('/api/report-clients/:clientId/structure', isAuthenticated, requireOrganisation, async (req: any, res) => {
    try {
      const orgId = req.user.organisationId;
      const clientId = parseInt(req.params.clientId);
      const client = await storage.getReportClient(clientId);
      if (!client || client.organisationId !== orgId) return res.status(404).json({ message: "Client not found" });

      const structure = await storage.upsertReportStructure({
        organisationId: orgId,
        clientId,
        ...req.body,
      });
      res.json(structure);
    } catch (e: any) { res.status(400).json({ message: e.message }); }
  });

  app.post('/api/report-clients/:clientId/structure/approve', isAuthenticated, requireOrganisation, async (req: any, res) => {
    try {
      const orgId = req.user.organisationId;
      const clientId = parseInt(req.params.clientId);
      const client = await storage.getReportClient(clientId);
      if (!client || client.organisationId !== orgId) return res.status(404).json({ message: "Client not found" });

      const structure = await storage.getReportStructureForClient(clientId);
      if (!structure) return res.status(404).json({ message: "No structure found" });

      const approved = await storage.approveReportStructure(structure.id);
      res.json(approved);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.put('/api/report-clients/:clientId/context', isAuthenticated, requireOrganisation, async (req: any, res) => {
    try {
      const orgId = req.user.organisationId;
      const clientId = parseInt(req.params.clientId);
      const client = await storage.getReportClient(clientId);
      if (!client || client.organisationId !== orgId) return res.status(404).json({ message: "Client not found" });

      const updated = await storage.updateReportClient(clientId, { clientContext: req.body.clientContext });
      res.json(updated);
    } catch (e: any) { res.status(400).json({ message: e.message }); }
  });

  // Client Profile — GET
  app.get('/api/report-clients/:clientId/profile', isAuthenticated, requireOrganisation, async (req: any, res) => {
    try {
      const orgId = req.user.organisationId;
      const clientId = parseInt(req.params.clientId);
      const client = await storage.getReportClient(clientId);
      if (!client || client.organisationId !== orgId) return res.status(404).json({ message: "Client not found" });
      const { businessDescription, ownerProfile, keyRelationships, historicalContext, standingInstructions, keyRisks, keyOpportunities, sectorNotes } = client as any;
      res.json({ businessDescription, ownerProfile, keyRelationships, historicalContext, standingInstructions, keyRisks, keyOpportunities, sectorNotes });
    } catch (e: any) { res.status(400).json({ message: e.message }); }
  });

  // Client Profile — PUT
  app.put('/api/report-clients/:clientId/profile', isAuthenticated, requireOrganisation, async (req: any, res) => {
    try {
      const orgId = req.user.organisationId;
      const clientId = parseInt(req.params.clientId);
      const client = await storage.getReportClient(clientId);
      if (!client || client.organisationId !== orgId) return res.status(404).json({ message: "Client not found" });

      const { businessDescription, ownerProfile, keyRelationships, historicalContext, standingInstructions, keyRisks, keyOpportunities, sectorNotes } = req.body;
      const updated = await storage.updateReportClient(clientId, {
        businessDescription, ownerProfile, keyRelationships, historicalContext, standingInstructions, keyRisks, keyOpportunities, sectorNotes,
      } as any);
      res.json(updated);
    } catch (e: any) { res.status(400).json({ message: e.message }); }
  });

  // AI Generation
  app.post('/api/reports/:id/generate-ai', isAuthenticated, requireOrganisation, async (req: any, res) => {
    try {
      const report = await storage.getManagementReport(parseInt(req.params.id));
      if (!report || report.organisationId !== req.user.organisationId) return res.status(404).json({ message: "Report not found" });

      const client = await storage.getReportClient(report.clientId);
      if (!client) return res.status(404).json({ message: "Client not found" });

      const [strategicPlan, reportStructure] = await Promise.all([
        report.strategicPlanId ? storage.getStrategicPlan(report.strategicPlanId) : storage.getStrategicPlanForClient(report.clientId),
        storage.getReportStructureForClient(report.clientId),
      ]);

      const aiResult = await generateAiReport({
        financialData: (report.financialData as any) || {},
        customData: (report.customData as any) || {},
        strategicPlan: strategicPlan || null,
        industry: client.industry,
        reportFrequency: client.reportFrequency,
        clientName: client.clientName,
        companyName: client.companyName,
        periodLabel: report.period.periodLabel,
        reportStructure: reportStructure || null,
        clientContext: client.clientContext || null,
        clientProfile: {
          businessDescription: (client as any).businessDescription || null,
          ownerProfile: (client as any).ownerProfile || null,
          keyRelationships: (client as any).keyRelationships || null,
          historicalContext: (client as any).historicalContext || null,
          standingInstructions: (client as any).standingInstructions || null,
          keyRisks: (client as any).keyRisks || null,
          keyOpportunities: (client as any).keyOpportunities || null,
          sectorNotes: (client as any).sectorNotes || null,
        },
        periodContext: {
          context: (report as any).periodContext || null,
          decisionsPending: (report as any).periodDecisionsPending || null,
          ownerConcerns: (report as any).periodOwnerConcerns || null,
          oneOffs: (report as any).periodOneOffs || null,
        },
      });

      const updatePayload: any = {
        aiExecutiveSummary: aiResult.executive_summary,
        aiGoingWell: aiResult.going_well,
        aiConcerns: aiResult.concerns,
        aiActionSteps: aiResult.action_steps.map((a: any) => ({
          action: a.action, why: a.why, priority: a.priority, linksToGoal: a.links_to_goal, metricImpact: a.metric_impact,
        })),
        aiGoalCommentary: aiResult.goal_commentary.map((g: any) => ({
          goal: g.goal, currentFinancialPosition: g.current_financial_position, gap: g.gap, onTrack: g.on_track,
        })),
        aiDiscussionPoints: aiResult.discussion_points,
        aiHealthScore: aiResult.health_score,
        aiHealthStatus: aiResult.health_status,
        aiWatchPoints: aiResult.watch_points || [],
        aiNextPeriodFocus: aiResult.next_period_focus || null,
        status: "ready",
      };
      if (aiResult.three_core_questions) {
        updatePayload.aiThreeCoreQuestions = aiResult.three_core_questions;
      }
      if (aiResult.core_question_answers) {
        updatePayload.aiCoreQuestionAnswers = aiResult.core_question_answers;
      }
      const updated = await storage.updateManagementReport(parseInt(req.params.id), updatePayload);

      res.json(updated);
    } catch (e: any) {
      console.error("[management-reports] AI generation error:", e);
      res.status(500).json({ message: e.message || "AI generation failed" });
    }
  });

  // Xero stub — populate with demo data
  app.post('/api/xero/connect/:clientId', isAuthenticated, requireOrganisation, async (req: any, res) => {
    try {
      const client = await storage.getReportClient(parseInt(req.params.clientId));
      if (!client || client.organisationId !== req.user.organisationId) return res.status(404).json({ message: "Client not found" });
      await storage.updateReportClient(parseInt(req.params.clientId), {
        xeroTenantId: "stub-tenant-" + Date.now(),
      });
      res.json({ ok: true, message: "Xero connected (demo mode)" });
    } catch (e: any) { res.status(400).json({ message: e.message }); }
  });

  app.post('/api/xero/sync/:clientId/:reportId', isAuthenticated, requireOrganisation, async (req: any, res) => {
    try {
      const report = await storage.getManagementReport(parseInt(req.params.reportId));
      if (!report || report.organisationId !== req.user.organisationId) return res.status(404).json({ message: "Report not found" });

      const client = await storage.getReportClient(parseInt(req.params.clientId));
      if (!client) return res.status(404).json({ message: "Client not found" });

      // Generate realistic demo data based on industry
      const isHospitality = client.industry === "hospitality_retail";
      const revenue = isHospitality ? 45000 : 68000;
      const cos = isHospitality ? 15750 : 12000;
      const gp = revenue - cos;
      const gpPct = Math.round((gp / revenue) * 100);
      const expenses = isHospitality ? 26000 : 38000;
      const opProfit = gp - expenses;
      const netProfit = opProfit - 1200;

      const demoFinancialData = {
        period: { start: report.period.periodStart, end: report.period.periodEnd, label: report.period.periodLabel },
        income_statement: {
          total_revenue: revenue,
          cost_of_sales: cos,
          gross_profit: gp,
          gross_margin_pct: gpPct,
          total_expenses: expenses,
          operating_profit: opProfit,
          operating_margin_pct: Math.round((opProfit / revenue) * 100),
          net_profit: netProfit,
          net_margin_pct: Math.round((netProfit / revenue) * 100),
          revenue_breakdown: [
            { name: isHospitality ? "Food" : "Fees", amount: Math.round(revenue * 0.7) },
            { name: isHospitality ? "Drinks" : "Consulting", amount: Math.round(revenue * 0.3) },
          ],
          expense_breakdown: [
            { name: "Staff costs", amount: Math.round(expenses * 0.55) },
            { name: "Rent & rates", amount: Math.round(expenses * 0.2) },
            { name: "Utilities", amount: Math.round(expenses * 0.1) },
            { name: "Other", amount: Math.round(expenses * 0.15) },
          ],
        },
        cashflow: {
          opening_balance: 8200,
          cash_in: revenue + 3100,
          cash_out: cos + expenses + 2400,
          net_cashflow: revenue + 3100 - cos - expenses - 2400,
          closing_balance: 8200 + (revenue + 3100 - cos - expenses - 2400),
        },
        balance_sheet: {
          total_assets: 45000,
          current_assets: 22000,
          current_liabilities: 18000,
          net_assets: 27000,
          total_debt: 12000,
        },
        kpis: {
          debtor_days: isHospitality ? 5 : 38,
          creditor_days: 22,
          current_ratio: parseFloat((22000 / 18000).toFixed(2)),
          cash_balance: 8200 + (revenue + 3100 - cos - expenses - 2400),
        },
        monthly_trend: [],
      };

      await storage.updateManagementReport(parseInt(req.params.reportId), { financialData: demoFinancialData });
      res.json({ ok: true, data: demoFinancialData });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // PDF generation — server-rendered via pdf-lib
  app.post('/api/reports/:id/generate-pdf', isAuthenticated, requireOrganisation, async (req: any, res) => {
    try {
      const report = await storage.getManagementReport(parseInt(req.params.id));
      if (!report || report.organisationId !== req.user.organisationId) return res.status(404).json({ message: "Report not found" });

      const client = await storage.getReportClient(report.clientId);
      if (!client) return res.status(404).json({ message: "Client not found" });

      const structure = await storage.getReportStructureForClient(report.clientId);

      const reportData = {
        period: {
          periodLabel: report.period.periodLabel,
          periodStart: report.period.periodStart || undefined,
          periodEnd: report.period.periodEnd || undefined,
        },
        financialData: (report.financialData as any) || {},
        aiExecutiveSummary: report.aiExecutiveSummary || undefined,
        aiGoingWell: (report.aiGoingWell as string[]) || [],
        aiConcerns: (report.aiConcerns as string[]) || [],
        aiActionSteps: (report.aiActionSteps as any[]) || [],
        aiGoalCommentary: (report.aiGoalCommentary as any[]) || [],
        aiDiscussionPoints: (report.aiDiscussionPoints as string[]) || [],
        aiThreeCoreQuestions: (report.aiThreeCoreQuestions as any) || undefined,
        aiCoreQuestionAnswers: (report.aiCoreQuestionAnswers as any[]) || [],
        aiHealthScore: report.aiHealthScore || undefined,
        aiHealthStatus: report.aiHealthStatus || undefined,
        aiWatchPoints: (report.aiWatchPoints as string[]) || [],
        aiNextPeriodFocus: report.aiNextPeriodFocus || undefined,
        accountantNotes: report.accountantNotes || undefined,
      };

      const clientData = {
        clientName: client.clientName,
        companyName: client.companyName,
        industry: client.industry,
      };

      const pdf = await generatePDFBuffer(reportData, clientData, structure);

      const companyClean = (client.companyName || client.clientName || "Report").replace(/[^a-zA-Z0-9]/g, "");
      const periodClean = (report.period.periodLabel || "").replace(/[^a-zA-Z0-9]/g, "");
      const filename = `${companyClean}_MIPack_${periodClean}.pdf`;

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.setHeader("Content-Length", pdf.length);
      res.send(pdf);
    } catch (e: any) {
      console.error("[management-reports] PDF generation error:", e);
      res.status(500).json({ message: e.message || "PDF generation failed" });
    }
  });

  // ─── Coaching Tool Routes ─────────────────────────────────────────────────

  // Helper: assert caller has access to this coaching client
  async function assertCoachingClientAccess(req: any, clientId: number): Promise<{ client: any; orgId: number } | null> {
    const client = await storage.getCoachingClient(clientId);
    if (!client) return null;
    if (req.user.role === 'coaching_client') {
      const linked = await storage.getCoachingClientByLinkedUser(req.user.id);
      if (!linked || linked.id !== clientId) return null;
    } else {
      if (client.organisationId !== req.user.organisationId) return null;
    }
    return { client, orgId: req.user.organisationId };
  }

  // GET /api/coaching/clients
  app.get('/api/coaching/clients', isAuthenticated, async (req: any, res) => {
    try {
      if (req.user.role === 'coaching_client') {
        const linked = await storage.getCoachingClientByLinkedUser(req.user.id);
        return res.json(linked ? [{ ...linked, lastSessionDate: null }] : []);
      }
      const [clients, lastDates] = await Promise.all([
        storage.getAllCoachingClients(req.user.organisationId),
        storage.getCoachingLastSessionDates(req.user.organisationId),
      ]);
      res.json(clients.map((c) => ({ ...c, lastSessionDate: lastDates[c.id] || null })));
    } catch (e) { res.status(500).json({ message: "Failed to fetch clients" }); }
  });

  // POST /api/coaching/clients
  app.post('/api/coaching/clients', requirePermission('manage_data'), async (req: any, res) => {
    try {
      const { name, companyName, email, phone, notes } = req.body;
      if (!name) return res.status(400).json({ message: "Name is required" });
      const client = await storage.createCoachingClient({
        organisationId: req.user.organisationId,
        name, companyName, email, phone, notes,
      });
      res.status(201).json(client);
    } catch (e) { res.status(500).json({ message: "Failed to create client" }); }
  });

  // GET /api/coaching/clients/:id
  app.get('/api/coaching/clients/:id', isAuthenticated, async (req: any, res) => {
    const id = parseInt(req.params.id);
    const access = await assertCoachingClientAccess(req, id);
    if (!access) return res.status(404).json({ message: "Not found" });
    res.json(access.client);
  });

  // PUT /api/coaching/clients/:id
  app.put('/api/coaching/clients/:id', requirePermission('manage_data'), async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const client = await storage.getCoachingClient(id);
      if (!client || client.organisationId !== req.user.organisationId) return res.status(404).json({ message: "Not found" });
      const updated = await storage.updateCoachingClient(id, req.body);
      res.json(updated);
    } catch (e) { res.status(500).json({ message: "Failed to update client" }); }
  });

  // DELETE /api/coaching/clients/:id
  app.delete('/api/coaching/clients/:id', requirePermission('manage_data'), async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const client = await storage.getCoachingClient(id);
      if (!client || client.organisationId !== req.user.organisationId) return res.status(404).json({ message: "Not found" });
      await storage.deleteCoachingClient(id);
      res.json({ message: "Deleted" });
    } catch (e) { res.status(500).json({ message: "Failed to delete client" }); }
  });

  // POST /api/coaching/clients/:id/invite — invite client to portal
  app.post('/api/coaching/clients/:id/invite', requirePermission('manage_teams'), async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const client = await storage.getCoachingClient(id);
      if (!client || client.organisationId !== req.user.organisationId) return res.status(404).json({ message: "Not found" });
      if (client.portalEnabled && client.linkedUserId) {
        return res.status(409).json({ message: "Portal already enabled for this client" });
      }
      const email = req.body.email || client.email;
      if (!email) return res.status(400).json({ message: "Email required" });

      const existingUser = await storage.getUserByEmail(email);
      if (existingUser && existingUser.organisationId === req.user.organisationId) {
        return res.status(409).json({ message: "A user with this email already exists in your organisation" });
      }

      const inviteUser = await storage.createUserInvitation({
        organisationId: req.user.organisationId,
        email,
        firstName: client.name.split(' ')[0] || client.name,
        lastName: client.name.split(' ').slice(1).join(' ') || '',
        role: 'coaching_client',
      });

      await storage.updateCoachingClient(id, { linkedUserId: inviteUser.id, portalEnabled: true });

      const emailSent = await sendInvitationEmail({
        to: email,
        firstName: inviteUser.firstName || client.name,
        invitationToken: inviteUser.invitationToken!,
        organisationName: (await storage.getOrganisation(req.user.organisationId))?.name || "Your coach",
        inviterName: `${req.user.firstName || ''} ${req.user.lastName || ''}`.trim(),
      });

      res.json({ message: "Invitation sent", emailSent });
    } catch (e: any) {
      console.error("[coaching] invite error:", e);
      res.status(500).json({ message: "Failed to send invitation" });
    }
  });

  // ── Coaching Session Notes ───────────────────────────────────────────────

  app.get('/api/coaching/clients/:id/notes', isAuthenticated, async (req: any, res) => {
    const id = parseInt(req.params.id);
    const access = await assertCoachingClientAccess(req, id);
    if (!access) return res.status(404).json({ message: "Not found" });
    const isPortalUser = req.user.role === 'coaching_client';
    const notes = await storage.getAllCoachingSessionNotes(id, isPortalUser);
    res.json(notes);
  });

  app.post('/api/coaching/clients/:id/notes', requirePermission('manage_data'), async (req: any, res) => {
    try {
      const clientId = parseInt(req.params.id);
      const client = await storage.getCoachingClient(clientId);
      if (!client || client.organisationId !== req.user.organisationId) return res.status(404).json({ message: "Not found" });
      const { noteDate, title, body } = req.body;
      if (!noteDate || !title) return res.status(400).json({ message: "noteDate and title required" });
      const note = await storage.createCoachingSessionNote({ organisationId: req.user.organisationId, clientId, noteDate, title, body: body || '' });
      res.status(201).json(note);
    } catch (e) { res.status(500).json({ message: "Failed to create note" }); }
  });

  app.put('/api/coaching/notes/:noteId', requirePermission('manage_data'), async (req: any, res) => {
    try {
      const noteId = parseInt(req.params.noteId);
      const note = await storage.getCoachingSessionNote(noteId);
      if (!note || note.organisationId !== req.user.organisationId) return res.status(404).json({ message: "Not found" });
      const updated = await storage.updateCoachingSessionNote(noteId, req.body);
      res.json(updated);
    } catch (e) { res.status(500).json({ message: "Failed to update note" }); }
  });

  app.delete('/api/coaching/notes/:noteId', requirePermission('manage_data'), async (req: any, res) => {
    try {
      const noteId = parseInt(req.params.noteId);
      const note = await storage.getCoachingSessionNote(noteId);
      if (!note || note.organisationId !== req.user.organisationId) return res.status(404).json({ message: "Not found" });
      await storage.deleteCoachingSessionNote(noteId);
      res.json({ message: "Deleted" });
    } catch (e) { res.status(500).json({ message: "Failed to delete note" }); }
  });

  // ── Coaching Strategic Goals ─────────────────────────────────────────────

  app.get('/api/coaching/clients/:id/strategic-goals', isAuthenticated, async (req: any, res) => {
    const id = parseInt(req.params.id);
    const access = await assertCoachingClientAccess(req, id);
    if (!access) return res.status(404).json({ message: "Not found" });
    const goals = await storage.getAllCoachingStrategicGoals(id);
    res.json(goals);
  });

  app.post('/api/coaching/clients/:id/strategic-goals', requirePermission('manage_data'), async (req: any, res) => {
    try {
      const clientId = parseInt(req.params.id);
      const client = await storage.getCoachingClient(clientId);
      if (!client || client.organisationId !== req.user.organisationId) return res.status(404).json({ message: "Not found" });
      const goal = await storage.createCoachingStrategicGoal({ ...req.body, organisationId: req.user.organisationId, clientId });
      res.status(201).json(goal);
    } catch (e) { res.status(500).json({ message: "Failed to create goal" }); }
  });

  app.put('/api/coaching/strategic-goals/:goalId', requirePermission('manage_data'), async (req: any, res) => {
    try {
      const goalId = parseInt(req.params.goalId);
      const goal = await storage.getCoachingStrategicGoal(goalId);
      if (!goal || goal.organisationId !== req.user.organisationId) return res.status(404).json({ message: "Not found" });
      const updated = await storage.updateCoachingStrategicGoal(goalId, req.body);
      res.json(updated);
    } catch (e) { res.status(500).json({ message: "Failed to update goal" }); }
  });

  app.delete('/api/coaching/strategic-goals/:goalId', requirePermission('manage_data'), async (req: any, res) => {
    try {
      const goalId = parseInt(req.params.goalId);
      const goal = await storage.getCoachingStrategicGoal(goalId);
      if (!goal || goal.organisationId !== req.user.organisationId) return res.status(404).json({ message: "Not found" });
      await storage.deleteCoachingStrategicGoal(goalId);
      res.json({ message: "Deleted" });
    } catch (e) { res.status(500).json({ message: "Failed to delete goal" }); }
  });

  // ── Coaching Quarterly Objectives ────────────────────────────────────────

  app.get('/api/coaching/clients/:id/objectives', isAuthenticated, async (req: any, res) => {
    const id = parseInt(req.params.id);
    const access = await assertCoachingClientAccess(req, id);
    if (!access) return res.status(404).json({ message: "Not found" });
    const q = req.query.quarter ? parseInt(req.query.quarter as string) : undefined;
    const y = req.query.year ? parseInt(req.query.year as string) : undefined;
    const objectives = await storage.getAllCoachingQuarterlyObjectives(id, q, y);
    res.json(objectives);
  });

  app.post('/api/coaching/clients/:id/objectives', requirePermission('manage_data'), async (req: any, res) => {
    try {
      const clientId = parseInt(req.params.id);
      const client = await storage.getCoachingClient(clientId);
      if (!client || client.organisationId !== req.user.organisationId) return res.status(404).json({ message: "Not found" });
      const obj = await storage.createCoachingQuarterlyObjective({ ...req.body, organisationId: req.user.organisationId, clientId });
      res.status(201).json(obj);
    } catch (e) { res.status(500).json({ message: "Failed to create objective" }); }
  });

  app.put('/api/coaching/objectives/:objId', requirePermission('manage_data'), async (req: any, res) => {
    try {
      const objId = parseInt(req.params.objId);
      const obj = await storage.getCoachingQuarterlyObjective(objId);
      if (!obj || obj.organisationId !== req.user.organisationId) return res.status(404).json({ message: "Not found" });
      const updated = await storage.updateCoachingQuarterlyObjective(objId, req.body);
      res.json(updated);
    } catch (e) { res.status(500).json({ message: "Failed to update objective" }); }
  });

  app.delete('/api/coaching/objectives/:objId', requirePermission('manage_data'), async (req: any, res) => {
    try {
      const objId = parseInt(req.params.objId);
      const obj = await storage.getCoachingQuarterlyObjective(objId);
      if (!obj || obj.organisationId !== req.user.organisationId) return res.status(404).json({ message: "Not found" });
      await storage.deleteCoachingQuarterlyObjective(objId);
      res.json({ message: "Deleted" });
    } catch (e) { res.status(500).json({ message: "Failed to delete objective" }); }
  });

  // POST /api/coaching/objectives/:objId/carry-forward
  app.post('/api/coaching/objectives/:objId/carry-forward', requirePermission('manage_data'), async (req: any, res) => {
    try {
      const objId = parseInt(req.params.objId);
      const obj = await storage.getCoachingQuarterlyObjective(objId);
      if (!obj || obj.organisationId !== req.user.organisationId) return res.status(404).json({ message: "Not found" });
      const copy = await storage.carryForwardCoachingObjective(objId);
      res.status(201).json(copy);
    } catch (e) { res.status(500).json({ message: "Failed to carry forward objective" }); }
  });

  // POST /api/coaching/clients/:id/sessions/start — get-or-create today's open session (London date)
  app.post('/api/coaching/clients/:id/sessions/start', requirePermission('manage_data'), async (req: any, res) => {
    try {
      const clientId = parseInt(req.params.id);
      const access = await assertCoachingClientAccess(req, clientId);
      if (!access) return res.status(404).json({ message: "Not found" });
      const londonDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London' }).format(new Date());
      const session = await storage.getOrCreateOpenSession(req.user.organisationId, clientId, londonDate);
      res.json(session);
    } catch (e) { res.status(500).json({ message: "Failed to start session" }); }
  });

  // GET /api/coaching/clients/:id/sessions
  app.get('/api/coaching/clients/:id/sessions', isAuthenticated, async (req: any, res) => {
    try {
      const clientId = parseInt(req.params.id);
      const access = await assertCoachingClientAccess(req, clientId);
      if (!access) return res.status(404).json({ message: "Not found" });
      const sharedOnly = req.user.role === 'coaching_client';
      const sessions = await storage.getAllCoachingSessions(clientId, sharedOnly);
      res.json(sessions);
    } catch (e) { res.status(500).json({ message: "Failed to fetch sessions" }); }
  });

  // GET /api/coaching/sessions/:sessionId
  app.get('/api/coaching/sessions/:sessionId', isAuthenticated, async (req: any, res) => {
    try {
      const sessionId = parseInt(req.params.sessionId);
      const session = await storage.getCoachingSession(sessionId);
      if (!session) return res.status(404).json({ message: "Not found" });
      const access = await assertCoachingClientAccess(req, session.clientId);
      if (!access) return res.status(404).json({ message: "Not found" });
      if (req.user.role === 'coaching_client' && !session.clientSummaryShared) {
        return res.status(404).json({ message: "Not found" });
      }
      res.json(session);
    } catch (e) { res.status(500).json({ message: "Failed to fetch session" }); }
  });

  // PUT /api/coaching/sessions/:sessionId — update status, summaries, sharing
  app.put('/api/coaching/sessions/:sessionId', requirePermission('manage_data'), async (req: any, res) => {
    try {
      const sessionId = parseInt(req.params.sessionId);
      const session = await storage.getCoachingSession(sessionId);
      if (!session || session.organisationId !== req.user.organisationId) return res.status(404).json({ message: "Not found" });
      const updated = await storage.updateCoachingSession(sessionId, req.body);
      res.json(updated);
    } catch (e) { res.status(500).json({ message: "Failed to update session" }); }
  });

  // POST /api/coaching/sessions/:sessionId/summarise — AI-powered summary from transcript/notes
  app.post('/api/coaching/sessions/:sessionId/summarise', requirePermission('manage_data'), async (req: any, res) => {
    try {
      const sessionId = parseInt(req.params.sessionId);
      const session = await storage.getCoachingSession(sessionId);
      if (!session || session.organisationId !== req.user.organisationId) return res.status(404).json({ message: "Not found" });

      const { text } = req.body;
      if (!text || typeof text !== 'string' || text.trim().length < 20) {
        return res.status(400).json({ message: "Please provide at least 20 characters of text to summarise" });
      }

      const Anthropic = (await import('@anthropic-ai/sdk')).default;
      const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

      const message = await anthropic.messages.create({
        model: 'claude-opus-4-5',
        max_tokens: 1024,
        messages: [{
          role: 'user',
          content: `You are a coaching session assistant. Extract structured insights from the following coaching session notes or transcript.

Return a JSON object with exactly these fields:
- "keyPoints": array of 3-6 concise strings summarising the main themes and insights from the session (suitable for sharing with the client)
- "internalNotes": array of 2-4 concise strings with coaching observations (for internal use only, not shared with client)
- "suggestedActions": array of 2-5 objects with { "description": string, "owner": "client"|"coach" } for follow-up actions

Keep each point brief (one sentence). Focus on what's actionable and useful for the next session.

Session notes/transcript:
---
${text.slice(0, 8000)}
---

Respond with valid JSON only, no extra text.`
        }]
      });

      const content = message.content[0];
      if (content.type !== 'text') throw new Error('Unexpected AI response type');

      let parsed: any;
      try {
        // Strip markdown code fences if present
        const clean = content.text.replace(/^```json?\s*/i, '').replace(/```\s*$/i, '').trim();
        parsed = JSON.parse(clean);
      } catch {
        return res.status(500).json({ message: "Failed to parse AI response" });
      }

      res.json({
        keyPoints: Array.isArray(parsed.keyPoints) ? parsed.keyPoints : [],
        internalNotes: Array.isArray(parsed.internalNotes) ? parsed.internalNotes : [],
        suggestedActions: Array.isArray(parsed.suggestedActions) ? parsed.suggestedActions : [],
      });
    } catch (e: any) {
      console.error("AI summarise error:", e);
      res.status(500).json({ message: "Failed to generate summary" });
    }
  });

  // GET /api/coaching/clients/:id/actions
  app.get('/api/coaching/clients/:id/actions', isAuthenticated, async (req: any, res) => {
    try {
      const clientId = parseInt(req.params.id);
      const access = await assertCoachingClientAccess(req, clientId);
      if (!access) return res.status(404).json({ message: "Not found" });
      // portal clients only see actions owned by 'client', enforced server-side
      const ownerFilter = req.user.role === 'coaching_client' ? 'client' : undefined;
      const actions = await storage.getAllCoachingActions(clientId, ownerFilter);
      res.json(actions);
    } catch (e) { res.status(500).json({ message: "Failed to fetch actions" }); }
  });

  // POST /api/coaching/sessions/:sessionId/actions
  app.post('/api/coaching/sessions/:sessionId/actions', requirePermission('manage_data'), async (req: any, res) => {
    try {
      const sessionId = parseInt(req.params.sessionId);
      const session = await storage.getCoachingSession(sessionId);
      if (!session || session.organisationId !== req.user.organisationId) return res.status(404).json({ message: "Not found" });
      const parsed = insertCoachingActionSchema.safeParse({
        ...req.body,
        organisationId: req.user.organisationId,
        clientId: session.clientId,
        sessionId,
      });
      if (!parsed.success) return res.status(400).json({ message: "Invalid data", errors: parsed.error.flatten() });
      const action = await storage.createCoachingAction(parsed.data);
      res.status(201).json(action);
    } catch (e) { res.status(500).json({ message: "Failed to create action" }); }
  });

  // PUT /api/coaching/actions/:actionId
  app.put('/api/coaching/actions/:actionId', requirePermission('manage_data'), async (req: any, res) => {
    try {
      const actionId = parseInt(req.params.actionId);
      const action = await storage.getCoachingAction(actionId);
      if (!action || action.organisationId !== req.user.organisationId) return res.status(404).json({ message: "Not found" });
      const updated = await storage.updateCoachingAction(actionId, req.body);
      res.json(updated);
    } catch (e) { res.status(500).json({ message: "Failed to update action" }); }
  });

  // DELETE /api/coaching/actions/:actionId
  app.delete('/api/coaching/actions/:actionId', requirePermission('manage_data'), async (req: any, res) => {
    try {
      const actionId = parseInt(req.params.actionId);
      const action = await storage.getCoachingAction(actionId);
      if (!action || action.organisationId !== req.user.organisationId) return res.status(404).json({ message: "Not found" });
      await storage.deleteCoachingAction(actionId);
      res.json({ message: "Deleted" });
    } catch (e) { res.status(500).json({ message: "Failed to delete action" }); }
  });

  // POST /api/coaching/actions/:actionId/carry-forward
  app.post('/api/coaching/actions/:actionId/carry-forward', requirePermission('manage_data'), async (req: any, res) => {
    try {
      const actionId = parseInt(req.params.actionId);
      const action = await storage.getCoachingAction(actionId);
      if (!action || action.organisationId !== req.user.organisationId) return res.status(404).json({ message: "Not found" });
      const { toSessionId } = req.body;
      if (!toSessionId) return res.status(400).json({ message: "toSessionId required" });
      const copy = await storage.carryForwardCoachingAction(actionId, parseInt(toSessionId));
      res.status(201).json(copy);
    } catch (e) { res.status(500).json({ message: "Failed to carry forward action" }); }
  });

  // ─── Financial Clarity Review Routes ────────────────────────────────────

  // GET /api/fcr — list all reviews for this org
  app.get('/api/fcr', requirePermission('manage_data'), async (req: any, res) => {
    try {
      const reviews = await storage.getAllFinancialClarityReviews(req.user.organisationId);
      res.json(reviews);
    } catch (e) { res.status(500).json({ message: "Failed to fetch reviews" }); }
  });

  // POST /api/fcr — create a new review
  app.post('/api/fcr', requirePermission('manage_data'), async (req: any, res) => {
    try {
      const review = await storage.createFinancialClarityReview({
        organisationId: req.user.organisationId,
        reviewDate: new Date().toISOString().split('T')[0],
        adviser: `${req.user.firstName} ${req.user.lastName}`.trim(),
      } as any);
      res.status(201).json(review);
    } catch (e) { res.status(500).json({ message: "Failed to create review" }); }
  });

  // GET /api/fcr/:id
  app.get('/api/fcr/:id', requirePermission('manage_data'), async (req: any, res) => {
    try {
      const review = await storage.getFinancialClarityReview(parseInt(req.params.id));
      if (!review || review.organisationId !== req.user.organisationId) return res.status(404).json({ message: "Not found" });
      res.json(review);
    } catch (e) { res.status(500).json({ message: "Failed to fetch review" }); }
  });

  // PATCH /api/fcr/:id — partial update (auto-save)
  app.patch('/api/fcr/:id', requirePermission('manage_data'), async (req: any, res) => {
    try {
      const review = await storage.getFinancialClarityReview(parseInt(req.params.id));
      if (!review || review.organisationId !== req.user.organisationId) return res.status(404).json({ message: "Not found" });
      const updated = await storage.updateFinancialClarityReview(parseInt(req.params.id), req.body);
      res.json(updated);
    } catch (e) { res.status(500).json({ message: "Failed to update review" }); }
  });

  // DELETE /api/fcr/:id
  app.delete('/api/fcr/:id', requirePermission('manage_data'), async (req: any, res) => {
    try {
      const review = await storage.getFinancialClarityReview(parseInt(req.params.id));
      if (!review || review.organisationId !== req.user.organisationId) return res.status(404).json({ message: "Not found" });
      await storage.deleteFinancialClarityReview(parseInt(req.params.id));
      res.status(204).send();
    } catch (e) { res.status(500).json({ message: "Failed to delete review" }); }
  });

  // POST /api/fcr/:id/generate-report — AI-powered Financial Clarity Summary
  app.post('/api/fcr/:id/generate-report', requirePermission('manage_data'), async (req: any, res) => {
    try {
      const review = await storage.getFinancialClarityReview(parseInt(req.params.id));
      if (!review || review.organisationId !== req.user.organisationId) return res.status(404).json({ message: "Not found" });

      const challenges = (() => {
        try { return JSON.parse(review.biggestChallenges || '[]'); } catch { return []; }
      })();

      const sectionSummary = `
SECTION 2 — Control the Chaos
Bookkeeping Quality: ${review.bookkeepingQuality || 'not set'}
Compliance Confidence: ${review.complianceConfidence || 'not set'}
VAT Up To Date: ${review.vatUpToDate || 'not set'}
Accounts Up To Date: ${review.accountsUpToDate || 'not set'}
Tax Surprises: ${review.taxSurprises || 'not set'}
Software Confidence: ${review.softwareConfidence || 'not set'}
Owner Confidence in Numbers (1-10): ${review.ownerConfidenceInNumbers ?? 'not set'}
Notes: ${review.chaosNotes || 'none'}
Overall Status: ${review.chaosStatus || 'not set'}

SECTION 3 — Financial Clarity
Management Accounts: ${review.managementAccounts || 'not set'}
KPIs: ${review.kpis || 'not set'}
Cashflow Visibility: ${review.cashflowVisibility || 'not set'}
Department Profitability: ${review.departmentProfitability || 'not set'}
Regular Review Meetings: ${review.regularReviewMeetings || 'not set'}
Financial Understanding: ${review.financialUnderstanding || 'not set'}
Decision Confidence (1-10): ${review.decisionConfidence ?? 'not set'}
Notes: ${review.clarityNotes || 'none'}
Overall Status: ${review.clarityStatus || 'not set'}

SECTION 4 — Business Performance
Business Goals: ${review.businessGoals || 'not set'}
Quarterly Reviews: ${review.quarterlyReviews || 'not set'}
Pricing Confidence: ${review.pricingConfidence || 'not set'}
Profit Focus: ${review.profitFocus || 'not set'}
Tax Planning: ${review.taxPlanning || 'not set'}
Accountability: ${review.accountability || 'not set'}
Overall Status: ${review.performanceStatus || 'not set'}
Notes: ${review.performanceNotes || 'none'}

SECTION 5 — Lead with Confidence
Budget: ${review.budget || 'not set'}
Cashflow Forecast: ${review.cashflowForecast || 'not set'}
Scenario Planning: ${review.scenarioPlanning || 'not set'}
Performance Dashboard: ${review.performanceDashboard || 'not set'}
Board Level Support: ${review.boardLevelSupport || 'not set'}
Exit Planning: ${review.exitPlanning || 'not set'}
Overall Status: ${review.leadershipStatus || 'not set'}
Notes: ${review.leadershipNotes || 'none'}

Biggest Challenges: ${challenges.join(', ') || 'none selected'}

Top Three Opportunities:
1. ${review.opportunity1 || 'not set'}
2. ${review.opportunity2 || 'not set'}
3. ${review.opportunity3 || 'not set'}

Recommended Next Step: ${review.recommendedNextStep || 'not set'}
`;

      const Anthropic = (await import('@anthropic-ai/sdk')).default;
      const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

      const message = await anthropic.messages.create({
        model: 'claude-opus-4-5',
        max_tokens: 2048,
        messages: [{
          role: 'user',
          content: `You are an adviser at MBS Accountants conducting a Financial Clarity Review for ${review.businessName || 'a business client'} (contact: ${review.contact || 'unknown'}, industry: ${review.industry || 'unknown'}, turnover: ${review.turnover || 'unknown'}).

The MBS philosophy: warm, professional, evidence-based, and never sales-focused. You care about the client's success and speak plainly.

Based on the structured review data below, produce a Financial Clarity Summary with these sections:

1. Executive Summary (2-3 sentences — where this business is on the Chaos to Clarity journey)
2. Current Position (brief overview of their financial maturity across the four stages)
3. Strengths (2-4 bullet points — what they are doing well)
4. Key Risks (2-4 bullet points — areas of concern that could hold them back)
5. Top Three Opportunities (match what was captured in the review)
6. Recommended Next Step (a clear, practical recommendation)
7. Suggested Services (which MBS service stages would benefit this client and why — keep it evidence-based, not promotional)
8. Meeting Summary (a short warm paragraph the adviser could share with the client after the meeting)

Review data:
${sectionSummary}

Write in plain, professional English. Be specific and evidence-based. Reference the actual data. No fluff.`
        }]
      });

      const content = message.content[0];
      if (content.type !== 'text') throw new Error('Unexpected AI response');
      const aiReport = content.text;

      const updated = await storage.updateFinancialClarityReview(parseInt(req.params.id), { aiReport });
      res.json({ aiReport, review: updated });
    } catch (e: any) {
      console.error("FCR AI report error:", e);
      res.status(500).json({ message: "Failed to generate report" });
    }
  });

  // POST /api/fcr/:id/generate-socket — Socket handover recommendation
  app.post('/api/fcr/:id/generate-socket', requirePermission('manage_data'), async (req: any, res) => {
    try {
      const review = await storage.getFinancialClarityReview(parseInt(req.params.id));
      if (!review || review.organisationId !== req.user.organisationId) return res.status(404).json({ message: "Not found" });

      const Anthropic = (await import('@anthropic-ai/sdk')).default;
      const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

      const message = await anthropic.messages.create({
        model: 'claude-opus-4-5',
        max_tokens: 1024,
        messages: [{
          role: 'user',
          content: `You are generating a structured Socket proposal handover note for an MBS Accountants adviser.

Socket is MBS's proposal tool. The adviser will copy this into Socket to generate the client proposal. Do NOT include any prices or fees.

Client: ${review.businessName || 'unknown'} | Contact: ${review.contact || 'unknown'} | Industry: ${review.industry || 'unknown'} | Turnover: ${review.turnover || 'unknown'}

Financial Clarity Review summary:
- Chaos Status: ${review.chaosStatus || 'unknown'}
- Clarity Status: ${review.clarityStatus || 'unknown'}
- Performance Status: ${review.performanceStatus || 'unknown'}
- Leadership Status: ${review.leadershipStatus || 'unknown'}
- Recommended Next Step: ${review.recommendedNextStep || 'unknown'}
- Biggest Challenges: ${(() => { try { return JSON.parse(review.biggestChallenges || '[]').join(', '); } catch { return 'none'; } })()}
- Top Opportunities: ${[review.opportunity1, review.opportunity2, review.opportunity3].filter(Boolean).join(' | ')}

Produce a structured Socket handover note with:
1. Client Context (2-3 sentences on who they are and where they are on their journey)
2. Service Stage Recommendation (which stage(s) to propose and a one-sentence rationale for each)
3. Key Talking Points (3-5 bullet points the adviser should use in the proposal conversation)
4. Any important context the account manager should know

Keep it concise, factual and practical. No prices.`
        }]
      });

      const content = message.content[0];
      if (content.type !== 'text') throw new Error('Unexpected AI response');
      const socketHandover = content.text;

      const updated = await storage.updateFinancialClarityReview(parseInt(req.params.id), { socketHandover });
      res.json({ socketHandover, review: updated });
    } catch (e: any) {
      console.error("FCR Socket handover error:", e);
      res.status(500).json({ message: "Failed to generate Socket handover" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
