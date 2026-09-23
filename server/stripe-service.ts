import Stripe from "stripe";
import { storage } from "./storage";

if (!process.env.STRIPE_SECRET_KEY) {
  console.warn("STRIPE_SECRET_KEY not set — Stripe features will be disabled");
}

export const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2025-01-27.acacia" })
  : null;

export const PLANS = {
  starter: {
    name: "Starter",
    monthlyAmount: 2900,
    yearlyAmount: 29000,
    userLimit: 3,
    clientLimit: 50,
    features: [
      "Up to 3 users",
      "Up to 50 clients",
      "All performance modules",
      "AI analysis engine",
      "Email support",
    ],
  },
  growth: {
    name: "Growth",
    monthlyAmount: 6900,
    yearlyAmount: 69000,
    userLimit: 8,
    clientLimit: 150,
    features: [
      "Up to 8 users",
      "Up to 150 clients",
      "All performance modules",
      "AI analysis engine",
      "Priority email support",
      "Custom branding",
    ],
    popular: true,
  },
  scale: {
    name: "Scale",
    monthlyAmount: 12900,
    yearlyAmount: 129000,
    userLimit: 20,
    clientLimit: 500,
    features: [
      "Up to 20 users",
      "Up to 500 clients",
      "All performance modules",
      "AI analysis engine",
      "Priority support",
      "Custom branding",
      "Advanced analytics",
    ],
  },
  pro: {
    name: "Pro",
    monthlyAmount: 19900,
    yearlyAmount: 199000,
    userLimit: null,
    clientLimit: null,
    features: [
      "Unlimited users",
      "Unlimited clients",
      "All performance modules",
      "AI analysis engine",
      "Dedicated support",
      "Custom branding",
      "Advanced analytics",
      "API access",
    ],
  },
} as const;

export type PlanKey = keyof typeof PLANS;

export const TRIAL_USER_LIMIT = 3;
export const TRIAL_CLIENT_LIMIT = 10;

export function getPlanLimits(plan: string | null, status: string | null) {
  if (status === "trialling" || !plan) {
    return { userLimit: TRIAL_USER_LIMIT, clientLimit: TRIAL_CLIENT_LIMIT };
  }
  const p = PLANS[plan as PlanKey];
  if (!p) return { userLimit: 3, clientLimit: 50 };
  return { userLimit: p.userLimit, clientLimit: p.clientLimit };
}

export function getUpgradeMessage(plan: string | null, type: "user" | "client"): string {
  if (!plan || plan === "starter") return `You have reached your plan limit — upgrade to Growth to add more`;
  if (plan === "growth") return `You have reached your plan limit — upgrade to Scale to add more`;
  if (plan === "scale") return `You have reached your plan limit — upgrade to Pro to add more`;
  return "You have reached your plan limit";
}

/**
 * Ensures all four Practice Toolbox products & prices exist in Stripe.
 * Stores price IDs as Stripe metadata on the product for easy retrieval.
 * Safe to call on every startup (idempotent).
 */
export async function ensureStripeProducts(): Promise<Record<string, { monthly: string; yearly: string }>> {
  if (!stripe) return {};

  const priceIds: Record<string, { monthly: string; yearly: string }> = {};

  for (const [key, plan] of Object.entries(PLANS)) {
    // Find existing product
    const existing = await stripe.products.search({
      query: `metadata['pt_plan']:'${key}' AND active:'true'`,
    });

    let product: Stripe.Product;
    if (existing.data.length > 0) {
      product = existing.data[0];
    } else {
      product = await stripe.products.create({
        name: `Practice Toolbox — ${plan.name}`,
        metadata: { pt_plan: key },
      });
      console.log(`[Stripe] Created product: ${product.name} (${product.id})`);
    }

    // Find or create monthly price
    const allPrices = await stripe.prices.list({ product: product.id, active: true, limit: 20 });
    let monthly = allPrices.data.find((p) => p.recurring?.interval === "month");
    let yearly = allPrices.data.find((p) => p.recurring?.interval === "year");

    if (!monthly) {
      monthly = await stripe.prices.create({
        product: product.id,
        unit_amount: plan.monthlyAmount,
        currency: "gbp",
        recurring: { interval: "month" },
        metadata: { pt_plan: key, pt_interval: "month" },
      });
      console.log(`[Stripe] Created monthly price for ${key}: ${monthly.id}`);
    }

    if (!yearly) {
      yearly = await stripe.prices.create({
        product: product.id,
        unit_amount: plan.yearlyAmount,
        currency: "gbp",
        recurring: { interval: "year" },
        metadata: { pt_plan: key, pt_interval: "year" },
      });
      console.log(`[Stripe] Created yearly price for ${key}: ${yearly.id}`);
    }

    priceIds[key] = { monthly: monthly.id, yearly: yearly.id };
  }

  return priceIds;
}

/**
 * Derive the plan key from a Stripe price object.
 */
export async function getPlanFromPrice(priceId: string): Promise<{ plan: PlanKey | null; interval: "month" | "year" | null }> {
  if (!stripe) return { plan: null, interval: null };
  try {
    const price = await stripe.prices.retrieve(priceId, { expand: ["product"] });
    const product = price.product as Stripe.Product;
    const plan = (product.metadata?.pt_plan as PlanKey) || null;
    const interval = (price.recurring?.interval as "month" | "year") || null;
    return { plan, interval };
  } catch {
    return { plan: null, interval: null };
  }
}

/**
 * Create or retrieve a Stripe customer for an org.
 */
export async function getOrCreateStripeCustomer(orgId: number, orgName: string, adminEmail: string): Promise<string> {
  if (!stripe) throw new Error("Stripe not configured");

  const org = await storage.getOrganisation(orgId);
  if (org?.stripeCustomerId) return org.stripeCustomerId;

  const customer = await stripe.customers.create({
    email: adminEmail,
    name: orgName,
    metadata: { pt_org_id: String(orgId) },
  });

  await storage.updateOrganisation(orgId, { stripeCustomerId: customer.id });
  return customer.id;
}
