import { and, asc, desc, eq, gte, inArray, lt, notInArray, sql } from "drizzle-orm";
import { db } from "./db";
import {
  emailAnalyticsContacts,
  emailAnalyticsConversations,
  emailAnalyticsMessages,
  emailAnalyticsResponseEventAudit,
  emailAnalyticsResponseEventExceptionAudit,
  emailAnalyticsResponseEventExceptions,
  emailAnalyticsResponseEvents,
  emailAnalyticsSettings,
  emailAnalyticsSyncRuns,
  users,
} from "@shared/schema";
import { emailSlaDeadline, slaElapsedMilliseconds } from "./email-analytics";

type Message = typeof emailAnalyticsMessages.$inferSelect;
type DerivedEvent = {
  canonicalConversationId: number;
  clientContactId: number | null;
  triggeringClientMessageId: number;
  latestClientMessageId: number;
  clientMessageCount: number;
  receivedAt: Date;
  latestClientMessageAt: Date;
  deadlineAt: Date;
  responseMessageId: number | null;
  responseAt: Date | null;
  outcome: "pending" | "pass_email_response" | "fail_late_response";
  backfillConfidence: "reliable_boundary" | "boundary_uncertain";
};
type ManualBoundary = {
  canonicalConversationId: number;
  triggeringClientMessageId: number;
  handledAt: Date | null;
};

function logicalMessageKey(message: Message) {
  const internetMessageId = message.internetMessageId?.trim().toLowerCase();
  return internetMessageId
    ? `internet:${internetMessageId}`
    : `mailbox:${message.mailboxId}:graph:${message.graphMessageId}`;
}

export function deriveResponseEvents(messages: Message[], contactByConversation: Map<number, number | null>, manualBoundaries: ManualBoundary[] = [], measurementStartAt?: Date): DerivedEvent[] {
  const unique = new Map<string, Message>();
  for (const message of messages) {
    const key = logicalMessageKey(message);
    const current = unique.get(key);
    if (!current || message.id < current.id) unique.set(key, message);
  }
  const byConversation = new Map<number, Message[]>();
  for (const message of unique.values()) {
    const current = byConversation.get(message.canonicalConversationId) || [];
    current.push(message);
    byConversation.set(message.canonicalConversationId, current);
  }
  const events: DerivedEvent[] = [];
  const manualByTrigger = new Map(manualBoundaries.map(event => [event.triggeringClientMessageId, event]));
  for (const [canonicalConversationId, conversationMessages] of byConversation) {
    conversationMessages.sort((a, b) => a.receivedAt.getTime() - b.receivedAt.getTime() || a.id - b.id);
    let open: DerivedEvent | null = null;
    let reliableBoundaryObserved = false;
    for (const message of conversationMessages) {
      const manualBoundary = open ? manualByTrigger.get(open.triggeringClientMessageId) : undefined;
      if (open && manualBoundary?.handledAt && message.receivedAt > manualBoundary.handledAt) open = null;
      if (message.direction === "inbound_client") {
        if (!open) {
          open = {
            canonicalConversationId,
            clientContactId: contactByConversation.get(canonicalConversationId) || null,
            triggeringClientMessageId: message.id,
            latestClientMessageId: message.id,
            clientMessageCount: 1,
            receivedAt: message.receivedAt,
            latestClientMessageAt: message.receivedAt,
            deadlineAt: emailSlaDeadline(message.receivedAt),
            responseMessageId: null,
            responseAt: null,
            outcome: "pending",
            backfillConfidence: !measurementStartAt || message.receivedAt < measurementStartAt || reliableBoundaryObserved ? "reliable_boundary" : "boundary_uncertain",
          };
          events.push(open);
        } else {
          open.latestClientMessageId = message.id;
          open.latestClientMessageAt = message.receivedAt;
          open.clientMessageCount += 1;
        }
      } else if (message.direction === "outbound_mbs" && open) {
        open.responseMessageId = message.id;
        open.responseAt = message.receivedAt;
        open.outcome = slaElapsedMilliseconds(open.receivedAt, message.receivedAt) <= 24 * 3_600_000
          ? "pass_email_response"
          : "fail_late_response";
        open = null;
        reliableBoundaryObserved = true;
      } else if (message.direction === "outbound_mbs") {
        reliableBoundaryObserved = true;
      }
    }
  }
  return events;
}

const responseEventLocks = new Map<number, Promise<unknown>>();

export function withResponseEventOrganisationLock<T>(organisationId: number, operation: () => Promise<T>): Promise<T> {
  const previous = responseEventLocks.get(organisationId) || Promise.resolve();
  const run = previous.catch(() => undefined).then(operation);
  responseEventLocks.set(organisationId, run);
  return run.finally(() => {
    if (responseEventLocks.get(organisationId) === run) responseEventLocks.delete(organisationId);
  });
}

export function materializeResponseEvents(organisationId: number) {
  return withResponseEventOrganisationLock(organisationId, async () => {
    const [run] = await db.insert(emailAnalyticsSyncRuns).values({ organisationId, kind: "response_events", status: "running", attempts: 1 }).returning();
    try {
      const result = await db.transaction(async transaction => {
        const [settings] = await transaction.select().from(emailAnalyticsSettings).where(eq(emailAnalyticsSettings.organisationId, organisationId));
        if (!settings?.responseEventMeasurementStartAt) return { createdOrUpdated: 0, measurementStartAt: null };
    const conversations = await transaction.select({
      id: emailAnalyticsConversations.id,
      clientContactId: emailAnalyticsConversations.clientContactId,
      disposition: emailAnalyticsConversations.disposition,
    }).from(emailAnalyticsConversations).where(eq(emailAnalyticsConversations.organisationId, organisationId));
    const active = conversations.filter(conversation => conversation.disposition !== "merged");
    const activeIds = new Set(active.map(conversation => conversation.id));
    const boundaryLookbackAt = new Date(settings.responseEventMeasurementStartAt.getTime() - 7 * 86_400_000);
    const messages = (await transaction.select().from(emailAnalyticsMessages).where(and(
      eq(emailAnalyticsMessages.organisationId, organisationId),
      gte(emailAnalyticsMessages.receivedAt, boundaryLookbackAt),
    )).orderBy(asc(emailAnalyticsMessages.receivedAt), asc(emailAnalyticsMessages.id)))
      .filter(message => activeIds.has(message.canonicalConversationId) && ["inbound_client", "outbound_mbs"].includes(message.direction));
    const handledBoundaryEvents = await transaction.select({
      canonicalConversationId: emailAnalyticsResponseEvents.canonicalConversationId,
      triggeringClientMessageId: emailAnalyticsResponseEvents.triggeringClientMessageId,
      handledAt: emailAnalyticsResponseEvents.handledAt,
    }).from(emailAnalyticsResponseEvents).where(and(
      eq(emailAnalyticsResponseEvents.organisationId, organisationId),
      inArray(emailAnalyticsResponseEvents.handlingSource, ["manual", "auto_triage"]),
    ));
    const derived = deriveResponseEvents(messages, new Map(active.map(conversation => [conversation.id, conversation.clientContactId])), handledBoundaryEvents, settings.responseEventMeasurementStartAt)
      .filter(event => event.receivedAt >= settings.responseEventMeasurementStartAt);
    const auditRows = await transaction.select({ responseEventId: emailAnalyticsResponseEventAudit.responseEventId })
      .from(emailAnalyticsResponseEventAudit)
      .where(eq(emailAnalyticsResponseEventAudit.organisationId, organisationId));
    const auditedIds = [...new Set(auditRows.map(row => row.responseEventId))];
    const automaticEvents = await transaction.select().from(emailAnalyticsResponseEvents).where(and(
      eq(emailAnalyticsResponseEvents.organisationId, organisationId),
      eq(emailAnalyticsResponseEvents.handlingSource, "automatic"),
    ));
    const auditedAutomatic = automaticEvents.filter(event => auditedIds.includes(event.id));
    if (auditedAutomatic.length) {
      await transaction.update(emailAnalyticsResponseEvents).set({ outcome: "retired", updatedAt: new Date() }).where(inArray(emailAnalyticsResponseEvents.id, auditedAutomatic.map(event => event.id)));
      await transaction.delete(emailAnalyticsResponseEvents).where(and(
        eq(emailAnalyticsResponseEvents.organisationId, organisationId),
        eq(emailAnalyticsResponseEvents.handlingSource, "automatic"),
        notInArray(emailAnalyticsResponseEvents.id, auditedAutomatic.map(event => event.id)),
      ));
    } else {
      await transaction.delete(emailAnalyticsResponseEvents).where(and(
        eq(emailAnalyticsResponseEvents.organisationId, organisationId),
        eq(emailAnalyticsResponseEvents.handlingSource, "automatic"),
      ));
    }
    for (let offset = 0; offset < derived.length; offset += 250) {
      await transaction.insert(emailAnalyticsResponseEvents)
        .values(derived.slice(offset, offset + 250).map(event => ({ organisationId, ...event })))
        .onConflictDoNothing();
    }
    const auditedAutomaticByTrigger = new Map(auditedAutomatic.map(event => [event.triggeringClientMessageId, event]));
    for (const event of derived) {
      const existing = auditedAutomaticByTrigger.get(event.triggeringClientMessageId);
      if (existing) await transaction.update(emailAnalyticsResponseEvents).set({ ...event, handlingSource: "automatic", manualClassification: null, handledAt: null, handledByUserId: null, updatedAt: new Date() }).where(eq(emailAnalyticsResponseEvents.id, existing.id));
    }
    const classifiedOutcomes = await transaction.select().from(emailAnalyticsResponseEvents).where(and(
      eq(emailAnalyticsResponseEvents.organisationId, organisationId),
      inArray(emailAnalyticsResponseEvents.handlingSource, ["manual", "auto_triage"]),
      inArray(emailAnalyticsResponseEvents.outcome, ["excluded_no_response_required", "pass_handled_elsewhere", "pass_resolved_phone_meeting"]),
    ));
    const derivedExceptionEventIds = new Set<number>();
    for (const event of classifiedOutcomes) {
      const nextInbound = messages.find(message => message.canonicalConversationId === event.canonicalConversationId && message.direction === "inbound_client" && message.receivedAt > event.latestClientMessageAt);
      const response = messages.find(message =>
        message.canonicalConversationId === event.canonicalConversationId
        && message.direction === "outbound_mbs"
        && message.receivedAt > event.latestClientMessageAt
        && (!nextInbound || message.receivedAt < nextInbound.receivedAt)
      );
      if (response) {
        derivedExceptionEventIds.add(event.id);
        await transaction.insert(emailAnalyticsResponseEventExceptions).values({
          organisationId,
          responseEventId: event.id,
          subsequentResponseMessageId: response.id,
          subsequentResponseAt: response.receivedAt,
          responseWithinDeadline: response.receivedAt <= event.deadlineAt,
        }).onConflictDoUpdate({
          target: emailAnalyticsResponseEventExceptions.responseEventId,
          set: {
            subsequentResponseMessageId: response.id,
            subsequentResponseAt: response.receivedAt,
            responseWithinDeadline: response.receivedAt <= event.deadlineAt,
            status: sql`CASE WHEN ${emailAnalyticsResponseEventExceptions.status} = 'superseded' THEN 'open' ELSE ${emailAnalyticsResponseEventExceptions.status} END`,
            resolvedAt: sql`CASE WHEN ${emailAnalyticsResponseEventExceptions.status} = 'superseded' THEN NULL ELSE ${emailAnalyticsResponseEventExceptions.resolvedAt} END`,
            updatedAt: new Date(),
          },
        });
      }
    }
    const openExceptions = await transaction.select().from(emailAnalyticsResponseEventExceptions).where(and(
      eq(emailAnalyticsResponseEventExceptions.organisationId, organisationId),
      eq(emailAnalyticsResponseEventExceptions.status, "open"),
    ));
    const staleExceptionIds = openExceptions.filter(exception => !derivedExceptionEventIds.has(exception.responseEventId)).map(exception => exception.id);
    if (staleExceptionIds.length) {
      await transaction.update(emailAnalyticsResponseEventExceptions).set({ status: "superseded", resolvedAt: new Date(), updatedAt: new Date() }).where(inArray(emailAnalyticsResponseEventExceptions.id, staleExceptionIds));
    }
    await transaction.update(emailAnalyticsSettings).set({ responseEventLastBuiltAt: new Date(), updatedAt: new Date() }).where(eq(emailAnalyticsSettings.organisationId, organisationId));
        return { createdOrUpdated: derived.length, measurementStartAt: settings.responseEventMeasurementStartAt };
      });
      await db.update(emailAnalyticsSyncRuns).set({ status: "succeeded", completedAt: new Date() }).where(eq(emailAnalyticsSyncRuns.id, run.id));
      return result;
    } catch (error: any) {
      await db.update(emailAnalyticsSyncRuns).set({
        status: "failed",
        error: error?.message?.slice(0, 1000) || "Response-event materialization failed",
        completedAt: new Date(),
      }).where(eq(emailAnalyticsSyncRuns.id, run.id));
      throw error;
    }
  });
}

export async function responseEventShadowKpis(organisationId: number, from: Date, to: Date, asOf = new Date()) {
  const [settings] = await db.select().from(emailAnalyticsSettings).where(eq(emailAnalyticsSettings.organisationId, organisationId));
  const measurementStartAt = settings?.responseEventMeasurementStartAt || null;
  const effectiveFrom = measurementStartAt && measurementStartAt > from ? measurementStartAt : from;
  const events = measurementStartAt ? await db.select().from(emailAnalyticsResponseEvents).where(and(
    eq(emailAnalyticsResponseEvents.organisationId, organisationId),
    gte(emailAnalyticsResponseEvents.receivedAt, effectiveFrom),
    lt(emailAnalyticsResponseEvents.receivedAt, to),
  )) : [];
  const cohort = events.filter(event => event.outcome !== "retired");
  const certain = cohort.filter(event => event.backfillConfidence !== "boundary_uncertain");
  const boundaryUncertain = cohort.length - certain.length;
  const successes = certain.filter(event => ["pass_email_response", "pass_handled_elsewhere", "pass_resolved_phone_meeting"].includes(event.outcome)).length;
  const explicitFailures = certain.filter(event => ["fail_late_response", "fail_late_handling", "fail_dismissed", "fail_unanswered"].includes(event.outcome)).length;
  const pending = certain.filter(event => event.outcome === "pending" && event.deadlineAt > asOf).length;
  const unanswered = certain.filter(event => event.outcome === "pending" && event.deadlineAt <= asOf).length;
  const excluded = certain.filter(event => event.outcome === "excluded_no_response_required").length;
  const denominator = successes + explicitFailures + unanswered;
  return {
    from: from.toISOString(),
    effectiveFrom: effectiveFrom.toISOString(),
    to: to.toISOString(),
    asOf: asOf.toISOString(),
    measurementStartAt: measurementStartAt?.toISOString() || null,
    measurementCoverageComplete: !measurementStartAt || from >= measurementStartAt,
    successes,
    failures: explicitFailures + unanswered,
    unanswered,
    denominator,
    pending,
    excluded,
    boundaryUncertain,
    percent: denominator ? Math.round((successes / denominator) * 1000) / 10 : null,
  };
}

export async function overdueResponseEvents(organisationId: number, asOf = new Date()) {
  return db.select({
    id: emailAnalyticsResponseEvents.id,
    canonicalConversationId: emailAnalyticsResponseEvents.canonicalConversationId,
    subject: emailAnalyticsConversations.subject,
    receivedAt: emailAnalyticsResponseEvents.receivedAt,
    deadlineAt: emailAnalyticsResponseEvents.deadlineAt,
    clientMessageCount: emailAnalyticsResponseEvents.clientMessageCount,
    clientName: emailAnalyticsContacts.name,
    organisationName: emailAnalyticsContacts.organisationName,
  }).from(emailAnalyticsResponseEvents)
    .leftJoin(emailAnalyticsConversations, eq(emailAnalyticsResponseEvents.canonicalConversationId, emailAnalyticsConversations.id))
    .leftJoin(emailAnalyticsContacts, eq(emailAnalyticsResponseEvents.clientContactId, emailAnalyticsContacts.id))
    .where(and(
      eq(emailAnalyticsResponseEvents.organisationId, organisationId),
      eq(emailAnalyticsResponseEvents.outcome, "pending"),
      eq(emailAnalyticsResponseEvents.backfillConfidence, "reliable_boundary"),
      lt(emailAnalyticsResponseEvents.deadlineAt, asOf),
    )).orderBy(asc(emailAnalyticsResponseEvents.deadlineAt));
}

export async function responseEventExceptions(organisationId: number) {
  return db.select({
    id: emailAnalyticsResponseEventExceptions.id,
    responseEventId: emailAnalyticsResponseEvents.id,
    status: emailAnalyticsResponseEventExceptions.status,
    subject: emailAnalyticsConversations.subject,
    clientName: emailAnalyticsContacts.name,
    organisationName: emailAnalyticsContacts.organisationName,
    receivedAt: emailAnalyticsResponseEvents.receivedAt,
    deadlineAt: emailAnalyticsResponseEvents.deadlineAt,
    outcome: emailAnalyticsResponseEvents.outcome,
    handledAt: emailAnalyticsResponseEvents.handledAt,
    classifiedAt: emailAnalyticsResponseEvents.updatedAt,
    classifiedByFirstName: users.firstName,
    classifiedByLastName: users.lastName,
    classifiedByEmail: users.email,
    subsequentResponseAt: emailAnalyticsResponseEventExceptions.subsequentResponseAt,
    responseWithinDeadline: emailAnalyticsResponseEventExceptions.responseWithinDeadline,
  }).from(emailAnalyticsResponseEventExceptions)
    .innerJoin(emailAnalyticsResponseEvents, eq(emailAnalyticsResponseEventExceptions.responseEventId, emailAnalyticsResponseEvents.id))
    .leftJoin(emailAnalyticsConversations, eq(emailAnalyticsResponseEvents.canonicalConversationId, emailAnalyticsConversations.id))
    .leftJoin(emailAnalyticsContacts, eq(emailAnalyticsResponseEvents.clientContactId, emailAnalyticsContacts.id))
    .leftJoin(users, eq(emailAnalyticsResponseEvents.handledByUserId, users.id))
    .where(and(eq(emailAnalyticsResponseEventExceptions.organisationId, organisationId), eq(emailAnalyticsResponseEventExceptions.status, "open")))
    .orderBy(desc(emailAnalyticsResponseEventExceptions.createdAt));
}

export async function classifyResponseEvent(organisationId: number, eventId: number, userId: number, outcome: string, handledAt?: Date) {
  const allowed = ["excluded_no_response_required", "pass_handled_elsewhere", "pass_resolved_phone_meeting", "fail_dismissed", "fail_unanswered"];
  if (!allowed.includes(outcome)) throw new Error("Invalid response-event outcome");
  return withResponseEventOrganisationLock(organisationId, () => db.transaction(async transaction => {
    const now = new Date();
    const [event] = await transaction.select().from(emailAnalyticsResponseEvents).where(and(eq(emailAnalyticsResponseEvents.id, eventId), eq(emailAnalyticsResponseEvents.organisationId, organisationId)));
    if (!event) throw new Error("Response event not found");
    if (event.outcome !== "pending" || event.backfillConfidence !== "reliable_boundary" || event.deadlineAt > now) throw new Error("Only reliable overdue unanswered events can be classified");
    const effectiveHandledAt = outcome === "fail_unanswered" ? now : handledAt || now;
    if (effectiveHandledAt < event.latestClientMessageAt || effectiveHandledAt.getTime() > Date.now() + 5 * 60_000) throw new Error("Invalid handling time");
    const finalOutcome = ["pass_handled_elsewhere", "pass_resolved_phone_meeting"].includes(outcome) && effectiveHandledAt > event.deadlineAt ? "fail_late_handling" : outcome;
    const manualClassification = outcome === "excluded_no_response_required" ? "no_response_required" : outcome === "pass_handled_elsewhere" ? "handled_elsewhere" : outcome === "pass_resolved_phone_meeting" ? "resolved_phone_meeting" : outcome === "fail_dismissed" ? "dismissed" : "genuinely_unanswered";
    await transaction.update(emailAnalyticsResponseEvents).set({ outcome: finalOutcome, handlingSource: "manual", manualClassification, handledAt: effectiveHandledAt, handledByUserId: userId, updatedAt: new Date() }).where(eq(emailAnalyticsResponseEvents.id, eventId));
    await transaction.insert(emailAnalyticsResponseEventAudit).values({ organisationId, responseEventId: eventId, previousOutcome: event.outcome, outcome: finalOutcome, handledAt: effectiveHandledAt, performedByUserId: userId });
  }));
}

export async function resolveResponseEventException(organisationId: number, exceptionId: number, userId: number, outcome?: string, handledAt?: Date) {
  return withResponseEventOrganisationLock(organisationId, () => db.transaction(async transaction => {
    const [row] = await transaction.select({ exception: emailAnalyticsResponseEventExceptions, event: emailAnalyticsResponseEvents })
      .from(emailAnalyticsResponseEventExceptions)
      .innerJoin(emailAnalyticsResponseEvents, eq(emailAnalyticsResponseEventExceptions.responseEventId, emailAnalyticsResponseEvents.id))
      .where(and(eq(emailAnalyticsResponseEventExceptions.id, exceptionId), eq(emailAnalyticsResponseEventExceptions.organisationId, organisationId)));
    if (!row) throw new Error("Classification exception not found");
    if (row.exception.status !== "open") throw new Error("Classification exception has already been resolved");
    const [actor] = await transaction.select({ id: users.id }).from(users).where(and(eq(users.id, userId), eq(users.organisationId, organisationId)));
    if (!actor) throw new Error("User is not authorised for this organisation");
    const allowed = ["pass_email_response", "fail_late_response", "excluded_no_response_required", "pass_handled_elsewhere", "pass_resolved_phone_meeting", "fail_dismissed", "fail_unanswered"];
    if (outcome && !allowed.includes(outcome)) throw new Error("Invalid corrected outcome");
    const requestedEmailOutcome = outcome && ["pass_email_response", "fail_late_response"].includes(outcome);
    const derivedEmailOutcome = row.exception.responseWithinDeadline ? "pass_email_response" : "fail_late_response";
    let nextOutcome = requestedEmailOutcome ? derivedEmailOutcome : outcome || row.event.outcome;
    if (outcome) {
      const now = new Date();
      const usesDetectedEmail = !!requestedEmailOutcome;
      const effectiveHandledAt = nextOutcome === "fail_unanswered" ? now : handledAt || row.event.handledAt || now;
      if (!usesDetectedEmail && (effectiveHandledAt < row.event.latestClientMessageAt || effectiveHandledAt.getTime() > now.getTime() + 5 * 60_000)) throw new Error("Invalid handling time");
      if (["pass_handled_elsewhere", "pass_resolved_phone_meeting"].includes(nextOutcome) && effectiveHandledAt > row.event.deadlineAt) nextOutcome = "fail_late_handling";
      await transaction.update(emailAnalyticsResponseEvents).set({
        outcome: nextOutcome,
        manualClassification: usesDetectedEmail ? null : nextOutcome === "excluded_no_response_required" ? "no_response_required" : outcome === "pass_handled_elsewhere" ? "handled_elsewhere" : outcome === "pass_resolved_phone_meeting" ? "resolved_phone_meeting" : nextOutcome === "fail_dismissed" ? "dismissed" : nextOutcome === "fail_unanswered" ? "genuinely_unanswered" : row.event.manualClassification,
        handledAt: usesDetectedEmail ? null : effectiveHandledAt,
        handledByUserId: userId,
        handlingSource: "manual",
        responseMessageId: usesDetectedEmail ? row.exception.subsequentResponseMessageId : row.event.responseMessageId,
        responseAt: usesDetectedEmail ? row.exception.subsequentResponseAt : row.event.responseAt,
        updatedAt: new Date(),
      }).where(eq(emailAnalyticsResponseEvents.id, row.event.id));
      await transaction.insert(emailAnalyticsResponseEventAudit).values({ organisationId, responseEventId: row.event.id, previousOutcome: row.event.outcome, outcome: nextOutcome, handledAt: usesDetectedEmail ? null : effectiveHandledAt, performedByUserId: userId });
    }
    const action = outcome ? "correct" : "confirm_original";
    await transaction.update(emailAnalyticsResponseEventExceptions).set({ status: outcome ? "corrected" : "confirmed", resolvedByUserId: userId, resolvedAt: new Date(), updatedAt: new Date() }).where(eq(emailAnalyticsResponseEventExceptions.id, exceptionId));
    await transaction.insert(emailAnalyticsResponseEventExceptionAudit).values({ organisationId, exceptionId, action, previousOutcome: row.event.outcome, outcome: nextOutcome, performedByUserId: userId });
  }));
}