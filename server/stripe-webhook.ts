import Stripe from "stripe";
import { stripe, getPlanFromPrice } from "./stripe-service";
import { storage } from "./storage";

export async function handleStripeWebhook(event: Stripe.Event): Promise<void> {
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      console.log(`[Stripe Webhook] checkout.session.completed — raw metadata:`, JSON.stringify(session.metadata));
      console.log(`[Stripe Webhook] checkout.session.completed — customer=${session.customer}, subscription=${session.subscription}, payment_status=${session.payment_status}`);

      const orgId = session.metadata?.pt_org_id ? parseInt(session.metadata.pt_org_id) : null;
      if (!orgId) {
        console.error("[Stripe Webhook] checkout.session.completed: NO pt_org_id in metadata — cannot update org");
        break;
      }
      console.log(`[Stripe Webhook] checkout.session.completed — resolved orgId=${orgId}`);

      const customerId = typeof session.customer === "string" ? session.customer : null;
      const subscriptionId = typeof session.subscription === "string" ? session.subscription : null;

      if (!subscriptionId) {
        console.error(`[Stripe Webhook] checkout.session.completed: no subscriptionId for org ${orgId} — skipping`);
        break;
      }
      console.log(`[Stripe Webhook] checkout.session.completed — fetching subscription ${subscriptionId} from Stripe`);

      const subscription = await stripe!.subscriptions.retrieve(subscriptionId);
      console.log(`[Stripe Webhook] checkout.session.completed — subscription status=${subscription.status}, period_end=${subscription.current_period_end}`);

      const priceId = subscription.items.data[0]?.price?.id;
      console.log(`[Stripe Webhook] checkout.session.completed — priceId=${priceId}`);

      const { plan, interval } = priceId ? await getPlanFromPrice(priceId) : { plan: null, interval: null };
      console.log(`[Stripe Webhook] checkout.session.completed — resolved plan=${plan}, interval=${interval}`);

      const updatePayload = {
        stripeCustomerId: customerId || undefined,
        stripeSubscriptionId: subscriptionId,
        subscriptionStatus: "active",
        subscriptionPlan: plan || undefined,
        subscriptionInterval: interval || undefined,
        currentPeriodEndsAt: subscription.current_period_end
          ? new Date(subscription.current_period_end * 1000)
          : undefined,
      };
      console.log(`[Stripe Webhook] checkout.session.completed — writing to DB for org ${orgId}:`, JSON.stringify(updatePayload));

      const updated = await storage.updateOrganisation(orgId, updatePayload as any);
      if (updated) {
        console.log(`[Stripe Webhook] checkout.session.completed — SUCCESS: org ${orgId} now subscriptionStatus=${updated.subscriptionStatus}, plan=${(updated as any).subscriptionPlan}`);
      } else {
        console.error(`[Stripe Webhook] checkout.session.completed — WARNING: updateOrganisation returned undefined for org ${orgId} (org may not exist)`);
      }
      break;
    }

    case "customer.subscription.updated": {
      const subscription = event.data.object as Stripe.Subscription;
      console.log(`[Stripe Webhook] customer.subscription.updated — subscription ${subscription.id}, status=${subscription.status}`);

      const orgId = subscription.metadata?.pt_org_id
        ? parseInt(subscription.metadata.pt_org_id)
        : null;

      const resolvedOrgId = orgId || await findOrgBySubscriptionId(subscription.id);
      if (!resolvedOrgId) {
        console.error(`[Stripe Webhook] customer.subscription.updated: no org found for subscription ${subscription.id}`);
        break;
      }
      console.log(`[Stripe Webhook] customer.subscription.updated — resolved orgId=${resolvedOrgId}`);

      const priceId = subscription.items.data[0]?.price?.id;
      const { plan, interval } = priceId ? await getPlanFromPrice(priceId) : { plan: null, interval: null };

      const statusMap: Record<string, string> = {
        active: "active",
        past_due: "past_due",
        canceled: "cancelled",
        paused: "paused",
        trialing: "trialling",
        unpaid: "past_due",
      };

      const newStatus = statusMap[subscription.status] || subscription.status;
      await storage.updateOrganisation(resolvedOrgId, {
        subscriptionStatus: newStatus,
        subscriptionPlan: plan || undefined,
        subscriptionInterval: interval || undefined,
        currentPeriodEndsAt: subscription.current_period_end
          ? new Date(subscription.current_period_end * 1000)
          : undefined,
      } as any);
      console.log(`[Stripe Webhook] customer.subscription.updated — org ${resolvedOrgId} updated: status=${newStatus}, plan=${plan}`);
      break;
    }

    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      console.log(`[Stripe Webhook] customer.subscription.deleted — subscription ${subscription.id}`);

      const resolvedOrgId = await findOrgBySubscriptionId(subscription.id);
      if (!resolvedOrgId) {
        console.error(`[Stripe Webhook] customer.subscription.deleted: no org found for subscription ${subscription.id}`);
        break;
      }
      await storage.updateOrganisation(resolvedOrgId, { subscriptionStatus: "cancelled" } as any);
      console.log(`[Stripe Webhook] customer.subscription.deleted — org ${resolvedOrgId} set to cancelled`);
      break;
    }

    case "invoice.payment_succeeded": {
      const invoice = event.data.object as Stripe.Invoice;
      console.log(`[Stripe Webhook] invoice.payment_succeeded — invoice ${invoice.id}, amount=${invoice.amount_paid}`);

      const subscriptionId = typeof invoice.subscription === "string" ? invoice.subscription : null;
      if (!subscriptionId) {
        console.log("[Stripe Webhook] invoice.payment_succeeded: no subscriptionId, skipping");
        break;
      }
      const resolvedOrgId = await findOrgBySubscriptionId(subscriptionId);
      if (!resolvedOrgId) {
        console.log(`[Stripe Webhook] invoice.payment_succeeded: no org found for subscription ${subscriptionId}`);
        break;
      }
      await storage.updateOrganisation(resolvedOrgId, { subscriptionStatus: "active" } as any);
      console.log(`[Stripe Webhook] invoice.payment_succeeded — org ${resolvedOrgId} confirmed active (amount: ${invoice.amount_paid}, invoice: ${invoice.id})`);
      break;
    }

    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;
      console.log(`[Stripe Webhook] invoice.payment_failed — invoice ${invoice.id}, attempt=${invoice.attempt_count}`);

      const subscriptionId = typeof invoice.subscription === "string" ? invoice.subscription : null;
      if (!subscriptionId) {
        console.log("[Stripe Webhook] invoice.payment_failed: no subscriptionId, skipping");
        break;
      }
      const resolvedOrgId = await findOrgBySubscriptionId(subscriptionId);
      if (!resolvedOrgId) {
        console.log(`[Stripe Webhook] invoice.payment_failed: no org found for subscription ${subscriptionId}`);
        break;
      }
      await storage.updateOrganisation(resolvedOrgId, { subscriptionStatus: "past_due" } as any);
      console.log(`[Stripe Webhook] invoice.payment_failed — org ${resolvedOrgId} set to past_due (invoice: ${invoice.id}, attempt: ${invoice.attempt_count})`);
      break;
    }

    default:
      console.log(`[Stripe Webhook] Unhandled event type: ${event.type}`);
      break;
  }
}

async function findOrgBySubscriptionId(subscriptionId: string): Promise<number | null> {
  const orgs = await storage.getAllOrganisations();
  const org = orgs.find((o) => (o as any).stripeSubscriptionId === subscriptionId);
  return org ? org.id : null;
}
