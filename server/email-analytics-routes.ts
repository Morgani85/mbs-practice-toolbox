import type { Express } from "express";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { db } from "./db";
import { requireOrganisation } from "./auth";
import {
  emailAnalyticsContacts, emailAnalyticsConversations, emailAnalyticsDispositionAudit,
  emailAnalyticsMailboxes, emailAnalyticsMessages, emailAnalyticsSettings, emailAnalyticsSyncRuns, users,
} from "@shared/schema";
import { DISPOSITIONS, ensureSettings, queueForOrganisation, setConversationFlag, setDisposition, slaCategory, syncEmailAnalytics } from "./email-analytics";
import { classifyResponseEvent, materializeResponseEvents, overdueResponseEvents, resolveResponseEventException, responseEventExceptions, responseEventShadowKpis } from "./email-analytics-response-events";
import { acknowledgeAutoTriageValidation, activateAutomaticTriage, AUTO_TRIAGE_MIN_CONFIDENCE, autoTriageStatus, autoTriageValidationReport } from "./email-analytics-triage";

const administratorsOnly = (req: any, res: any, next: any) =>
  ["admin", "manager"].includes(req.user?.role) ? next() : res.status(403).json({ message: "Email Analytics administration access is required" });

function legacyConversationKpiPercent(
  conversations: (typeof emailAnalyticsConversations.$inferSelect)[],
  settings: Awaited<ReturnType<typeof ensureSettings>>,
  from: Date,
  to: Date,
) {
  const relevant = conversations.filter(conversation =>
    conversation.latestClientMessageAt
    && conversation.latestClientMessageAt >= from
    && conversation.latestClientMessageAt < to
    && !["no_response_required", "handled_elsewhere", "resolved_phone_meeting"].includes(conversation.disposition || "")
  );
  if (!relevant.length) return null;
  const pass = relevant.filter(conversation =>
    !conversation.disposition
    && conversation.latestMbsResponseAt
    && conversation.latestMbsResponseAt >= conversation.latestClientMessageAt!
    && slaCategory(conversation.latestClientMessageAt!, conversation.latestMbsResponseAt, settings).slaElapsedMilliseconds <= 24 * 3_600_000
  ).length;
  return Math.round((pass / relevant.length) * 1000) / 10;
}

export function registerEmailAnalyticsRoutes(app: Express) {
  const base = "/api/communication/email-analytics";
  app.get(`${base}/settings`, requireOrganisation, async (req: any, res) => {
    const settings = await ensureSettings(req.organisationId);
    const mailboxes = await db.select().from(emailAnalyticsMailboxes).where(eq(emailAnalyticsMailboxes.organisationId, req.organisationId));
    res.json({ settings, mailboxes });
  });
  app.put(`${base}/settings`, requireOrganisation, administratorsOnly, async (req: any, res) => {
    const input = req.body || {};
    for (const key of ["workdayStartMinutes", "workdayEndMinutes", "fridayEndMinutes"]) {
      if (input[key] !== undefined && (!Number.isInteger(input[key]) || input[key] < 0 || input[key] > 1440)) return res.status(400).json({ message: `Invalid ${key}` });
    }
    if ((input.workdayStartMinutes ?? 0) >= (input.workdayEndMinutes ?? 1440)) return res.status(400).json({ message: "Workday end must be after its start" });
    if (input.contactTypes !== undefined && (!Array.isArray(input.contactTypes) || input.contactTypes.some((v: unknown) => typeof v !== "string"))) return res.status(400).json({ message: "contactTypes must be an array of names" });
    await ensureSettings(req.organisationId);
    if (input.syncIntervalMinutes !== undefined && (!Number.isInteger(input.syncIntervalMinutes) || input.syncIntervalMinutes < 30 || input.syncIntervalMinutes > 1440)) return res.status(400).json({ message: "Sync interval must be between 30 and 1,440 minutes" });
    if (input.autoTriageMode !== undefined && !["disabled", "shadow"].includes(input.autoTriageMode)) return res.status(400).json({ message: "Automatic triage can only be enabled through the reviewed activation control" });
    if (input.autoTriageConfidenceThreshold !== undefined && (!Number.isFinite(input.autoTriageConfidenceThreshold) || input.autoTriageConfidenceThreshold < AUTO_TRIAGE_MIN_CONFIDENCE || input.autoTriageConfidenceThreshold > 1)) {
      return res.status(400).json({ message: `Auto-triage confidence must be between ${AUTO_TRIAGE_MIN_CONFIDENCE} and 1` });
    }
    const allowed = ["enabled", "automaticRefreshEnabled", "contactTypes", "workdayStartMinutes", "workdayEndMinutes", "fridayEndMinutes", "syncIntervalMinutes", "autoTriageMode", "autoTriageConfidenceThreshold"] as const;
    const patch = Object.fromEntries(allowed.filter(k => input[k] !== undefined).map(k => [k, input[k]]));
    if (input.autoTriageMode && input.autoTriageMode !== "automatic") Object.assign(patch, {
      autoTriageActivationApprovedAt: null,
      autoTriageActivationApprovedByUserId: null,
    });
    const [settings] = await db.update(emailAnalyticsSettings).set({ ...patch, updatedAt: new Date() }).where(eq(emailAnalyticsSettings.organisationId, req.organisationId)).returning();
    res.json(settings);
  });
  app.get(`${base}/auto-triage/status`, requireOrganisation, administratorsOnly, async (req: any, res) => {
    await ensureSettings(req.organisationId);
    res.json(await autoTriageStatus(req.organisationId));
  });
  app.get(`${base}/auto-triage/validation`, requireOrganisation, administratorsOnly, async (req: any, res) => {
    res.json(await autoTriageValidationReport(req.organisationId));
  });
  app.post(`${base}/auto-triage/validation/review`, requireOrganisation, administratorsOnly, async (req: any, res) => {
    if (req.body?.acknowledged !== true) return res.status(400).json({ message: "Confirm that you have reviewed the validation results" });
    try {
      await acknowledgeAutoTriageValidation(req.organisationId, req.user.id);
      res.sendStatus(204);
    } catch (error: any) {
      res.status(400).json({ message: error?.message || "The validation report cannot be approved" });
    }
  });
  app.post(`${base}/auto-triage/activate`, requireOrganisation, administratorsOnly, async (req: any, res) => {
    if (req.body?.confirmation !== "ENABLE_AUTOMATIC_EXCLUSIONS") return res.status(400).json({ message: "Type the required confirmation before enabling automatic exclusions" });
    try {
      await activateAutomaticTriage(req.organisationId, req.user.id, Number(req.body?.confidenceThreshold));
      res.sendStatus(204);
    } catch (error: any) {
      res.status(400).json({ message: error?.message || "Automatic triage cannot be enabled" });
    }
  });
  app.post(`${base}/mailboxes`, requireOrganisation, administratorsOnly, async (req: any, res) => {
    const address = String(req.body?.address || "").trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) return res.status(400).json({ message: "A valid mailbox address is required" });
    const [mailbox] = await db.insert(emailAnalyticsMailboxes).values({ organisationId: req.organisationId, address, displayName: req.body?.displayName || null, enabled: req.body?.enabled !== false }).onConflictDoUpdate({ target: [emailAnalyticsMailboxes.organisationId, emailAnalyticsMailboxes.address], set: { enabled: req.body?.enabled !== false, displayName: req.body?.displayName || null, updatedAt: new Date() } }).returning();
    res.status(201).json(mailbox);
  });
  app.patch(`${base}/mailboxes/:id`, requireOrganisation, administratorsOnly, async (req: any, res) => {
    const id = Number(req.params.id);
    const [mailbox] = await db.update(emailAnalyticsMailboxes).set({ enabled: !!req.body?.enabled, updatedAt: new Date() }).where(and(eq(emailAnalyticsMailboxes.id, id), eq(emailAnalyticsMailboxes.organisationId, req.organisationId))).returning();
    if (!mailbox) return res.status(404).json({ message: "Mailbox not found" });
    res.json(mailbox);
  });
  app.get(`${base}/queue`, requireOrganisation, async (req: any, res) => {
    let queue = await queueForOrganisation(req.organisationId, req.query.includeResolved === "true");
    const category = req.query.category as string | undefined;
    if (category) queue = queue.filter(item => item.category === category);
    res.json(queue);
  });
  app.get(`${base}/kpis`, requireOrganisation, async (req: any, res) => {
    const queue = await queueForOrganisation(req.organisationId);
    // Denominator: genuine client conversations that genuinely required an email
    // response. Legitimate manual outcomes are excluded; dismissed conversations
    // remain in the denominator and count as failures.
    const all = await db.select().from(emailAnalyticsConversations).where(eq(emailAnalyticsConversations.organisationId, req.organisationId));
    const settings = await ensureSettings(req.organisationId);
    const now = new Date();
    const percent = (days: number) => {
      const after = new Date(now.getTime() - days * 86400000);
      return legacyConversationKpiPercent(all, settings, after, now);
    };
    res.json({ responseTargetPercent: 95, awaitingResponse: queue.length, over24WorkingHours: queue.filter(q => q.category !== "within_target").length, over48WorkingHours: queue.filter(q => q.category === "over_48").length, oldestOutstanding: queue[0]?.latestClientMessageAt || null, withinSlaLast7DaysPercent: percent(7), withinSlaLast30DaysPercent: percent(30), denominator: "Genuine client conversations with a latest client message in the period that required an email response. No response required, Handled elsewhere, and Resolved by phone/meeting are excluded. Dismissed conversations remain in the denominator and count as failures." });
  });
  app.get(`${base}/response-events/shadow-kpis`, requireOrganisation, administratorsOnly, async (req: any, res) => {
    const now = new Date();
    const parseDate = (value: unknown) => typeof value === "string" && value ? new Date(value) : null;
    const requestedFrom = parseDate(req.query.from);
    const requestedTo = parseDate(req.query.to);
    if ((requestedFrom && Number.isNaN(requestedFrom.getTime())) || (requestedTo && Number.isNaN(requestedTo.getTime()))) return res.status(400).json({ message: "from and to must be valid ISO dates" });
    if ((requestedFrom && !requestedTo) || (!requestedFrom && requestedTo)) return res.status(400).json({ message: "from and to must be provided together" });
    if (requestedFrom && requestedTo && requestedFrom >= requestedTo) return res.status(400).json({ message: "from must be before to" });
    const to = requestedTo || now;
    const periods = requestedFrom
      ? [{ key: "custom", from: requestedFrom, to }]
      : [
          { key: "sevenDays", from: new Date(now.getTime() - 7 * 86_400_000), to },
          { key: "previousSevenDays", from: new Date(now.getTime() - 14 * 86_400_000), to: new Date(now.getTime() - 7 * 86_400_000) },
          { key: "thirtyDays", from: new Date(now.getTime() - 30 * 86_400_000), to },
          { key: "previousThirtyDays", from: new Date(now.getTime() - 60 * 86_400_000), to: new Date(now.getTime() - 30 * 86_400_000) },
        ];
    const [settings] = await db.select().from(emailAnalyticsSettings).where(eq(emailAnalyticsSettings.organisationId, req.organisationId));
    const conversations = await db.select().from(emailAnalyticsConversations).where(eq(emailAnalyticsConversations.organisationId, req.organisationId));
    const results = await Promise.all(periods.map(async period => {
      const result = await responseEventShadowKpis(req.organisationId, period.from, period.to, now);
      return [period.key, {
        ...result,
        legacyPercent: legacyConversationKpiPercent(conversations, settings, period.from, period.to),
      }] as const;
    }));
    res.json({
      mode: "shadow",
      cohortDefinition: "Response events received in the period; pending not-yet-due events are excluded from numerator and denominator.",
      measurementStartAt: settings?.responseEventMeasurementStartAt || null,
      lastBuiltAt: settings?.responseEventLastBuiltAt || null,
      periods: Object.fromEntries(results),
    });
  });
  app.get(`${base}/response-events/overdue-review`, requireOrganisation, administratorsOnly, async (req: any, res) => {
    res.json(await overdueResponseEvents(req.organisationId));
  });
  app.post(`${base}/response-events/:id/classify`, requireOrganisation, administratorsOnly, async (req: any, res) => {
    const handledAt = req.body?.handledAt ? new Date(req.body.handledAt) : undefined;
    if (handledAt && Number.isNaN(handledAt.getTime())) return res.status(400).json({ message: "handledAt must be a valid date and time" });
    try {
      await classifyResponseEvent(req.organisationId, Number(req.params.id), req.user.id, String(req.body?.outcome || ""), handledAt);
      res.sendStatus(204);
    } catch (error: any) {
      console.error("[email-analytics] Failed to classify response event", { organisationId: req.organisationId, eventId: req.params.id, error: error?.message });
      res.status(error?.message === "Response event not found" ? 404 : 400).json({ message: error?.message || "The response event could not be classified" });
    }
  });
  app.get(`${base}/response-events/exceptions`, requireOrganisation, administratorsOnly, async (req: any, res) => {
    res.json(await responseEventExceptions(req.organisationId));
  });
  app.post(`${base}/response-events/exceptions/:id/resolve`, requireOrganisation, administratorsOnly, async (req: any, res) => {
    const handledAt = req.body?.handledAt ? new Date(req.body.handledAt) : undefined;
    if (handledAt && Number.isNaN(handledAt.getTime())) return res.status(400).json({ message: "handledAt must be a valid date and time" });
    try {
      await resolveResponseEventException(req.organisationId, Number(req.params.id), req.user.id, req.body?.outcome || undefined, handledAt);
      res.sendStatus(204);
    } catch (error: any) {
      console.error("[email-analytics] Failed to resolve classification exception", { organisationId: req.organisationId, exceptionId: req.params.id, error: error?.message });
      res.status(error?.message === "Classification exception not found" ? 404 : 400).json({ message: error?.message || "The exception could not be resolved" });
    }
  });
  app.post(`${base}/response-events/rebuild`, requireOrganisation, administratorsOnly, async (req: any, res) => {
    try {
      res.json(await materializeResponseEvents(req.organisationId));
    } catch (error: any) {
      console.error("[email-analytics] Response-event shadow rebuild failed", { organisationId: req.organisationId, error: error?.message });
      res.status(500).json({ message: "The shadow response events could not be rebuilt." });
    }
  });
  app.post(`${base}/conversations/:id/disposition`, requireOrganisation, administratorsOnly, async (req: any, res) => {
    const disposition = req.body?.disposition;
    if (!DISPOSITIONS.includes(disposition)) return res.status(400).json({ message: "Invalid disposition" });
    const handledAt = req.body?.handledAt ? new Date(req.body.handledAt) : undefined;
    if (handledAt && Number.isNaN(handledAt.getTime())) return res.status(400).json({ message: "handledAt must be a valid date and time" });
    try {
      await setDisposition(req.organisationId, Number(req.params.id), req.user.id, disposition, handledAt);
      res.sendStatus(204);
    } catch (error: any) {
      console.error("[email-analytics] Failed to record disposition", { organisationId: req.organisationId, conversationId: req.params.id, userId: req.user?.id, disposition, error: error?.message });
      const notFound = error?.message === "Conversation not found";
      res.status(notFound ? 404 : 500).json({ message: notFound ? "Conversation not found" : "The outcome could not be recorded. Please try again." });
    }
  });
  app.post(`${base}/conversations/:id/reopen`, requireOrganisation, administratorsOnly, async (req: any, res) => {
    try {
      await setDisposition(req.organisationId, Number(req.params.id), req.user.id, null);
      res.sendStatus(204);
    } catch (error: any) {
      console.error("[email-analytics] Failed to reopen conversation", { organisationId: req.organisationId, conversationId: req.params.id, userId: req.user?.id, error: error?.message });
      const notFound = error?.message === "Conversation not found";
      res.status(notFound ? 404 : 500).json({ message: notFound ? "Conversation not found" : "The conversation could not be reopened. Please try again." });
    }
  });
  app.patch(`${base}/conversations/:id/flag`, requireOrganisation, administratorsOnly, async (req: any, res) => {
    if (typeof req.body?.isFlagged !== "boolean") return res.status(400).json({ message: "isFlagged must be true or false" });
    try {
      await setConversationFlag(req.organisationId, Number(req.params.id), req.user.id, req.body.isFlagged);
      res.sendStatus(204);
    } catch (error: any) {
      console.error("[email-analytics] Failed to update conversation flag", { organisationId: req.organisationId, conversationId: req.params.id, userId: req.user?.id, isFlagged: req.body.isFlagged, error: error?.message });
      const notFound = error?.message === "Conversation not found";
      res.status(notFound ? 404 : 500).json({ message: notFound ? "Conversation not found" : "The flag could not be updated. Please try again." });
    }
  });
  app.get(`${base}/conversations/:id/audit`, requireOrganisation, async (req: any, res) => {
    res.json(await db.select({
      id: emailAnalyticsDispositionAudit.id,
      previousDisposition: emailAnalyticsDispositionAudit.previousDisposition,
      disposition: emailAnalyticsDispositionAudit.disposition,
      action: emailAnalyticsDispositionAudit.action,
      performedAt: emailAnalyticsDispositionAudit.performedAt,
      performedByUserId: emailAnalyticsDispositionAudit.performedByUserId,
      performedByFirstName: users.firstName,
      performedByLastName: users.lastName,
      performedByEmail: users.email,
    }).from(emailAnalyticsDispositionAudit)
      .leftJoin(users, eq(emailAnalyticsDispositionAudit.performedByUserId, users.id))
      .where(and(eq(emailAnalyticsDispositionAudit.organisationId, req.organisationId), eq(emailAnalyticsDispositionAudit.canonicalConversationId, Number(req.params.id))))
      .orderBy(desc(emailAnalyticsDispositionAudit.performedAt)));
  });
  app.post(`${base}/refresh`, requireOrganisation, administratorsOnly, async (req: any, res) => {
    try {
      await syncEmailAnalytics(req.organisationId);
      res.status(200).json({ message: "Email metadata refresh completed" });
    } catch (error: any) {
      console.error("[email-analytics] Manual refresh failed", { organisationId: req.organisationId, error: error?.message });
      res.status(500).json({ message: "Email metadata refresh could not be completed. Check mailbox configuration and try again." });
    }
  });
  app.post(`${base}/refresh-if-due`, requireOrganisation, async (req: any, res) => {
    try {
      const settings = await ensureSettings(req.organisationId);
      if (!settings.automaticRefreshEnabled) return res.json({ status: "disabled" });
      const intervalMinutes = Math.max(30, settings.syncIntervalMinutes);
      if (settings.syncIntervalMinutes !== intervalMinutes) {
        await db.update(emailAnalyticsSettings).set({ syncIntervalMinutes: intervalMinutes, updatedAt: new Date() }).where(eq(emailAnalyticsSettings.id, settings.id));
      }
      const due = !settings.lastMailboxSyncAt || Date.now() - settings.lastMailboxSyncAt.getTime() >= intervalMinutes * 60_000;
      if (!due) return res.json({ status: "current", lastMailboxSyncAt: settings.lastMailboxSyncAt });
      const [activeRun] = await db.select({ id: emailAnalyticsSyncRuns.id, startedAt: emailAnalyticsSyncRuns.startedAt })
        .from(emailAnalyticsSyncRuns)
        .where(and(
          eq(emailAnalyticsSyncRuns.organisationId, req.organisationId),
          eq(emailAnalyticsSyncRuns.kind, "mailbox"),
          eq(emailAnalyticsSyncRuns.status, "running"),
          sql`${emailAnalyticsSyncRuns.startedAt} >= now() - interval '30 minutes'`
        ))
        .orderBy(desc(emailAnalyticsSyncRuns.startedAt))
        .limit(1);
      if (activeRun) return res.json({ status: "already_running", startedAt: activeRun.startedAt });
      await syncEmailAnalytics(req.organisationId);
      res.json({ status: "refreshed", completedAt: new Date() });
    } catch (error: any) {
      console.error("[email-analytics] Automatic refresh failed", { organisationId: req.organisationId, error: error?.message });
      res.status(500).json({ message: "Automatic mailbox refresh could not be completed" });
    }
  });
  app.get(`${base}/sync-status`, requireOrganisation, async (req: any, res) => {
    const [latest] = await db.select().from(emailAnalyticsSyncRuns).where(eq(emailAnalyticsSyncRuns.organisationId, req.organisationId)).orderBy(desc(emailAnalyticsSyncRuns.startedAt)).limit(1);
    res.json({ settings: await ensureSettings(req.organisationId), latestRun: latest || null });
  });
  app.get(`${base}/unmatched-senders`, requireOrganisation, administratorsOnly, async (req: any, res) => {
    const rows = await db.execute(sql`SELECT sender_email AS email, max(sender_name) AS "displayName", count(*)::int AS "messageCount", array_agg(DISTINCT m.address) AS mailboxes, max(received_at) AS "lastMessageAt" FROM email_analytics_messages em JOIN email_analytics_mailboxes m ON m.id = em.mailbox_id WHERE em.organisation_id = ${req.organisationId} AND em.direction = 'external_unmatched' GROUP BY sender_email ORDER BY count(*) DESC, max(received_at) DESC`);
    res.json(rows.rows);
  });
}