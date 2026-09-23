import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { db } from "./db";
import {
  emailAnalyticsContacts, emailAnalyticsConversationGroups, emailAnalyticsConversations,
  emailAnalyticsDispositionAudit, emailAnalyticsMailboxes, emailAnalyticsMessages,
  emailAnalyticsResponseEventAudit, emailAnalyticsResponseEvents, emailAnalyticsSettings, emailAnalyticsSyncRuns, emailAnalyticsTriagePredictions, users,
} from "@shared/schema";

export const DISPOSITIONS = ["no_response_required", "handled_elsewhere", "resolved_phone_meeting", "dismissed"] as const;
export type Disposition = typeof DISPOSITIONS[number];
const graphFields = "id,conversationId,internetMessageId,subject,receivedDateTime,sentDateTime,from,sender,webLink";
const syncLocks = new Map<number, Promise<void>>();
const messageLocks = new Map<string, Promise<void>>();
const UK_TIME_ZONE = "Europe/London";
const ukDateFormatter = new Intl.DateTimeFormat("en-GB", { timeZone: UK_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit", weekday: "short" });
type MessageClassificationContext = {
  contactByEmail: Map<string, typeof emailAnalyticsContacts.$inferSelect>;
  mbsAddresses: Set<string>;
};

function ukDateParts(date: Date) {
  return ukDateFormatter.formatToParts(date).reduce<Record<string, string>>((parts, part) => (parts[part.type] = part.value, parts), {});
}

function ukOffsetMinutes(date: Date) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: UK_TIME_ZONE, timeZoneName: "shortOffset" }).formatToParts(date);
  const value = parts.find(part => part.type === "timeZoneName")?.value || "GMT";
  const match = value.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/);
  return match ? (match[1] === "+" ? 1 : -1) * ((+match[2] * 60) + +(match[3] || 0)) : 0;
}

function ukMidnight(year: number, month: number, day: number) {
  const approximate = new Date(Date.UTC(year, month - 1, day, 12));
  return new Date(Date.UTC(year, month - 1, day) - ukOffsetMinutes(approximate) * 60_000);
}

function nextUkMidnight(date: Date) {
  const parts = ukDateParts(date);
  const next = new Date(Date.UTC(+parts.year, +parts.month - 1, +parts.day + 1, 12));
  const nextParts = ukDateParts(next);
  return ukMidnight(+nextParts.year, +nextParts.month, +nextParts.day);
}

function isUkWeekend(date: Date) {
  const weekday = ukDateParts(date).weekday;
  return weekday === "Sat" || weekday === "Sun";
}

function nextUkWorkingDayStart(date: Date) {
  let cursor = date;
  while (isUkWeekend(cursor)) cursor = nextUkMidnight(cursor);
  return cursor;
}

export function workingMilliseconds(from: Date, to: Date, startMinutes = 570, endMinutes = 1050, fridayEndMinutes = 870): number {
  if (to <= from || startMinutes < 0 || endMinutes > 1440 || startMinutes >= endMinutes || fridayEndMinutes <= startMinutes) return 0;
  // Convert each UK local weekday's configured working window to an instant. The
  // offset is obtained from Intl, so BST transitions are respected.
  const uk = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit", weekday: "short" });
  const offsetAt = (d: Date) => {
    const parts = new Intl.DateTimeFormat("en-US", { timeZone: "Europe/London", timeZoneName: "shortOffset" }).formatToParts(d);
    const value = parts.find(p => p.type === "timeZoneName")?.value || "GMT";
    const match = value.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/);
    return match ? (match[1] === "+" ? 1 : -1) * ((+match[2] * 60) + +(match[3] || 0)) : 0;
  };
  const first = uk.formatToParts(from).reduce<Record<string, string>>((o, p) => (o[p.type] = p.value, o), {});
  let day = Date.UTC(+first.year, +first.month - 1, +first.day);
  let total = 0;
  while (day < to.getTime() + 86_400_000) {
    const noon = new Date(day + 12 * 3_600_000);
    const parts = uk.formatToParts(noon).reduce<Record<string, string>>((o, p) => (o[p.type] = p.value, o), {});
    if (parts.weekday !== "Sat" && parts.weekday !== "Sun") {
      const localBase = Date.UTC(+parts.year, +parts.month - 1, +parts.day);
      const offset = offsetAt(noon) * 60_000;
      const opening = new Date(localBase + startMinutes * 60_000 - offset);
      const closingMinutes = parts.weekday === "Fri" ? fridayEndMinutes : endMinutes;
      const closing = new Date(localBase + closingMinutes * 60_000 - offset);
      total += Math.max(0, Math.min(to.getTime(), closing.getTime()) - Math.max(from.getTime(), opening.getTime()));
    }
    day += 86_400_000;
  }
  return total;
}

export function slaElapsedMilliseconds(from: Date, to: Date) {
  if (to <= from) return 0;
  let cursor = nextUkWorkingDayStart(from);
  let total = 0;
  while (cursor < to) {
    if (isUkWeekend(cursor)) {
      cursor = nextUkWorkingDayStart(cursor);
      continue;
    }
    const dayEnd = nextUkMidnight(cursor);
    total += Math.max(0, Math.min(to.getTime(), dayEnd.getTime()) - cursor.getTime());
    cursor = nextUkWorkingDayStart(dayEnd);
  }
  return total;
}

export function emailSlaDeadline(received: Date, allowanceHours = 24) {
  let cursor = nextUkWorkingDayStart(received);
  let remaining = allowanceHours * 3_600_000;
  while (remaining > 0) {
    const dayEnd = nextUkMidnight(cursor);
    const available = dayEnd.getTime() - cursor.getTime();
    if (remaining <= available) return new Date(cursor.getTime() + remaining);
    remaining -= available;
    cursor = nextUkWorkingDayStart(dayEnd);
  }
  return cursor;
}

export function slaCategory(received: Date, now: Date, _settings?: { workdayStartMinutes: number; workdayEndMinutes: number; fridayEndMinutes: number }) {
  const slaElapsed = slaElapsedMilliseconds(received, now);
  return {
    elapsedMilliseconds: now.getTime() - received.getTime(),
    slaElapsedMilliseconds: slaElapsed,
    workingMilliseconds: slaElapsed,
    deadlineAt: emailSlaDeadline(received),
    category: slaElapsed > 48 * 3_600_000 ? "over_48" : slaElapsed > 24 * 3_600_000 ? "over_24" : "within_target",
  };
}

async function graphToken() {
  const { MICROSOFT_TENANT_ID: tenant, MICROSOFT_CLIENT_ID: client, MICROSOFT_CLIENT_SECRET: secret } = process.env;
  if (!tenant || !client || !secret) throw new Error("Microsoft Graph credentials are not configured");
  const body = new URLSearchParams({ client_id: client, client_secret: secret, grant_type: "client_credentials", scope: "https://graph.microsoft.com/.default" });
  const response = await fetch(`https://login.microsoftonline.com/${encodeURIComponent(tenant)}/oauth2/v2.0/token`, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body });
  if (!response.ok) throw new Error(`Microsoft token request failed (${response.status})`);
  return (await response.json()).access_token as string;
}

async function retry<T>(operation: () => Promise<T>, attempts = 3): Promise<T> {
  let error: unknown;
  for (let i = 0; i < attempts; i++) try { return await operation(); } catch (e) {
    error = e; if (i < attempts - 1) await new Promise(resolve => setTimeout(resolve, 500 * 2 ** i));
  }
  throw error;
}

export async function ensureSettings(organisationId: number) {
  const [existing] = await db.select().from(emailAnalyticsSettings).where(eq(emailAnalyticsSettings.organisationId, organisationId));
  if (existing) return existing;
  const [created] = await db.insert(emailAnalyticsSettings).values({ organisationId }).returning();
  return created;
}

async function recordMessageUnlocked(organisationId: number, mailbox: typeof emailAnalyticsMailboxes.$inferSelect, item: any, context?: MessageClassificationContext) {
  const sender = item?.from?.emailAddress || item?.sender?.emailAddress;
  if (!item?.id || (!item.receivedDateTime && !item.sentDateTime) || !sender?.address) return;
  const [duplicate] = await db.select({ id: emailAnalyticsMessages.id }).from(emailAnalyticsMessages).where(and(eq(emailAnalyticsMessages.mailboxId, mailbox.id), eq(emailAnalyticsMessages.graphMessageId, item.id)));
  if (duplicate) {
    if (item.webLink) await db.update(emailAnalyticsMessages).set({ webLink: item.webLink }).where(eq(emailAnalyticsMessages.id, duplicate.id));
    return;
  }
  const senderEmail = String(sender.address).toLowerCase();
  const contact = context?.contactByEmail.get(senderEmail) || (await db.select().from(emailAnalyticsContacts).where(and(eq(emailAnalyticsContacts.organisationId, organisationId), eq(emailAnalyticsContacts.email, senderEmail), eq(emailAnalyticsContacts.active, true))))[0];
  const mbsAddresses = context?.mbsAddresses || new Set((await db.select({ address: emailAnalyticsMailboxes.address }).from(emailAnalyticsMailboxes).where(and(eq(emailAnalyticsMailboxes.organisationId, organisationId), eq(emailAnalyticsMailboxes.enabled, true)))).map(m => m.address.toLowerCase()));
  const direction = mbsAddresses.has(senderEmail) ? "outbound_mbs" : contact ? "inbound_client" : "external_unmatched";
  const internetMessageId = item.internetMessageId ? String(item.internetMessageId).toLowerCase() : null;
  const [sameInternet] = internetMessageId ? await db.select({ canonicalConversationId: emailAnalyticsMessages.canonicalConversationId }).from(emailAnalyticsMessages).where(and(eq(emailAnalyticsMessages.organisationId, organisationId), eq(emailAnalyticsMessages.internetMessageId, internetMessageId))).limit(1) : [];
  const [localGroup] = item.conversationId ? await db.select().from(emailAnalyticsConversationGroups).where(and(eq(emailAnalyticsConversationGroups.mailboxId, mailbox.id), eq(emailAnalyticsConversationGroups.graphConversationId, item.conversationId))) : [];
  let canonicalId = sameInternet?.canonicalConversationId || localGroup?.canonicalConversationId;
  if (!canonicalId) {
    const [conversation] = await db.insert(emailAnalyticsConversations).values({ organisationId, subject: item.subject || null, clientContactId: contact?.id }).returning();
    canonicalId = conversation.id;
  }
  // If an internet-id discovers two prior local groups, merge the newer group into
  // the existing canonical record; all historical messages remain durable.
  if (sameInternet && localGroup && sameInternet.canonicalConversationId !== localGroup.canonicalConversationId) {
    const [target] = await db.select().from(emailAnalyticsConversations).where(eq(emailAnalyticsConversations.id, sameInternet.canonicalConversationId));
    const [source] = await db.select().from(emailAnalyticsConversations).where(eq(emailAnalyticsConversations.id, localGroup.canonicalConversationId));
    await db.update(emailAnalyticsConversations).set({
      latestClientMessageAt: [target?.latestClientMessageAt, source?.latestClientMessageAt].filter(Boolean).sort((a, b) => b!.getTime() - a!.getTime())[0] || null,
      latestMbsResponseAt: [target?.latestMbsResponseAt, source?.latestMbsResponseAt].filter(Boolean).sort((a, b) => b!.getTime() - a!.getTime())[0] || null,
      clientContactId: target?.clientContactId || source?.clientContactId || null,
      subject: target?.subject || source?.subject || null,
      isFlagged: !!target?.isFlagged || !!source?.isFlagged,
      updatedAt: new Date(),
    }).where(eq(emailAnalyticsConversations.id, sameInternet.canonicalConversationId));
    await db.update(emailAnalyticsMessages).set({ canonicalConversationId: sameInternet.canonicalConversationId }).where(eq(emailAnalyticsMessages.canonicalConversationId, localGroup.canonicalConversationId));
    await db.update(emailAnalyticsConversationGroups).set({ canonicalConversationId: sameInternet.canonicalConversationId }).where(eq(emailAnalyticsConversationGroups.canonicalConversationId, localGroup.canonicalConversationId));
    await db.update(emailAnalyticsConversations).set({ latestClientMessageAt: null, latestMbsResponseAt: null, clientContactId: null, disposition: "merged", updatedAt: new Date() }).where(eq(emailAnalyticsConversations.id, localGroup.canonicalConversationId));
    canonicalId = sameInternet.canonicalConversationId;
  }
  if (item.conversationId && !localGroup) await db.insert(emailAnalyticsConversationGroups).values({ organisationId, mailboxId: mailbox.id, graphConversationId: item.conversationId, canonicalConversationId: canonicalId });
  const receivedAt = new Date(direction === "outbound_mbs" ? (item.sentDateTime || item.receivedDateTime) : (item.receivedDateTime || item.sentDateTime));
  await db.insert(emailAnalyticsMessages).values({ organisationId, mailboxId: mailbox.id, canonicalConversationId: canonicalId, graphMessageId: item.id, graphConversationId: item.conversationId || null, internetMessageId, direction, senderEmail, senderName: sender.name || null, subject: item.subject || null, webLink: item.webLink || null, receivedAt });
  const [current] = await db.select().from(emailAnalyticsConversations).where(eq(emailAnalyticsConversations.id, canonicalId));
  const patch = direction === "inbound_client"
    ? { latestClientMessageAt: !current?.latestClientMessageAt || receivedAt > current.latestClientMessageAt ? receivedAt : current.latestClientMessageAt, clientContactId: contact!.id, subject: item.subject || current?.subject || null, updatedAt: new Date() }
    : direction === "outbound_mbs" ? { latestMbsResponseAt: !current?.latestMbsResponseAt || receivedAt > current.latestMbsResponseAt ? receivedAt : current.latestMbsResponseAt, updatedAt: new Date() } : { updatedAt: new Date() };
  await db.update(emailAnalyticsConversations).set(patch).where(eq(emailAnalyticsConversations.id, canonicalId));
}

export async function recordMessage(organisationId: number, mailbox: typeof emailAnalyticsMailboxes.$inferSelect, item: any, context?: MessageClassificationContext) {
  const normalizedInternetId = item?.internetMessageId ? String(item.internetMessageId).trim().toLowerCase() : "";
  const keys = [
    normalizedInternetId ? `${organisationId}:internet:${normalizedInternetId}` : "",
    item?.conversationId ? `${organisationId}:mailbox:${mailbox.id}:conversation:${item.conversationId}` : "",
  ].filter(Boolean).sort();
  if (!keys.length) keys.push(`${organisationId}:mailbox:${mailbox.id}:message:${item?.id || "unknown"}`);
  const previous = keys.map(key => messageLocks.get(key) || Promise.resolve());
  const current = Promise.all(previous.map(promise => promise.catch(() => undefined))).then(() => recordMessageUnlocked(organisationId, mailbox, item, context));
  for (const key of keys) messageLocks.set(key, current);
  try {
    await current;
  } finally {
    for (const key of keys) if (messageLocks.get(key) === current) messageLocks.delete(key);
  }
}

export async function syncMailbox(organisationId: number, mailbox: typeof emailAnalyticsMailboxes.$inferSelect, context?: MessageClassificationContext, historicalBoundaryBackfill = false) {
  const token = await retry(graphToken);
  const overlapStart = mailbox.lastSyncedAt && !historicalBoundaryBackfill
    ? new Date(mailbox.lastSyncedAt.getTime() - 48 * 3_600_000)
    : new Date(Date.now() - 67 * 86_400_000);
  const filter = `receivedDateTime ge ${overlapStart.toISOString()}`;
  let url: string | undefined = `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(mailbox.address)}/messages?$filter=${encodeURIComponent(filter)}&$select=${encodeURIComponent(graphFields)}&$top=100`;
  while (url) {
    const page = await retry(async () => {
      const response = await fetch(url, { headers: { authorization: `Bearer ${token}` } });
      if (!response.ok) throw new Error(`Graph mailbox ${mailbox.address} failed (${response.status})`);
      return response.json();
    });
    const items = (page.value || []).filter((item: any) => !item["@removed"]);
    for (let offset = 0; offset < items.length; offset += 8) {
      await Promise.all(items.slice(offset, offset + 8).map((item: any) => recordMessage(organisationId, mailbox, item, context)));
    }
    url = page["@odata.nextLink"];
  }
  await db.update(emailAnalyticsMailboxes).set({ lastSyncedAt: new Date(), lastSyncError: null, updatedAt: new Date() }).where(eq(emailAnalyticsMailboxes.id, mailbox.id));
}

export async function syncOrganisationMailboxes(organisationId: number) {
  const settings = await ensureSettings(organisationId);
  const historicalBoundaryBackfill = !settings.responseEventLastBuiltAt;
  await db.update(emailAnalyticsSyncRuns).set({
    status: "failed",
    error: "Previous mailbox sync did not complete before the application process stopped",
    completedAt: new Date(),
  }).where(and(
    eq(emailAnalyticsSyncRuns.organisationId, organisationId),
    eq(emailAnalyticsSyncRuns.kind, "mailbox"),
    eq(emailAnalyticsSyncRuns.status, "running"),
    sql`${emailAnalyticsSyncRuns.startedAt} < now() - interval '30 minutes'`,
  ));
  const [run] = await db.insert(emailAnalyticsSyncRuns).values({ organisationId, kind: "mailbox", status: "running", attempts: 1 }).returning();
  let runFinalized = false;
  try {
    let mailboxes = await db.select().from(emailAnalyticsMailboxes).where(and(eq(emailAnalyticsMailboxes.organisationId, organisationId), eq(emailAnalyticsMailboxes.enabled, true)));
    if (!mailboxes.length) mailboxes = await discoverMailboxes(organisationId);
    const contacts = await db.select().from(emailAnalyticsContacts).where(and(eq(emailAnalyticsContacts.organisationId, organisationId), eq(emailAnalyticsContacts.active, true)));
    const context: MessageClassificationContext = {
      contactByEmail: new Map(contacts.map(contact => [contact.email.toLowerCase(), contact])),
      mbsAddresses: new Set(mailboxes.map(mailbox => mailbox.address.toLowerCase())),
    };
    const failures: { address: string; error: string }[] = [];
    let nextMailbox = 0;
    const workers = Array.from({ length: Math.min(4, mailboxes.length) }, async () => {
      while (nextMailbox < mailboxes.length) {
        const mailbox = mailboxes[nextMailbox++];
        try {
          await syncMailbox(organisationId, mailbox, context, historicalBoundaryBackfill);
        } catch (error: any) {
          const message = error?.message?.slice(0, 1000) || "Mailbox sync failed";
          failures.push({ address: mailbox.address, error: message });
          await db.update(emailAnalyticsMailboxes).set({ lastSyncError: message, updatedAt: new Date() }).where(eq(emailAnalyticsMailboxes.id, mailbox.id));
        }
      }
    });
    await Promise.all(workers);
    if (failures.length) {
      await db.update(emailAnalyticsSyncRuns).set({
        status: "partial",
        error: failures.map(failure => `${failure.address}: ${failure.error}`).join("; ").slice(0, 1000),
        completedAt: new Date(),
      }).where(eq(emailAnalyticsSyncRuns.id, run.id));
      runFinalized = true;
      throw new Error(`Mailbox sync incomplete: ${failures.map(failure => failure.address).join(", ")}`);
    }
    await db.update(emailAnalyticsSyncRuns).set({
      status: "succeeded",
      error: null,
      completedAt: new Date(),
    }).where(eq(emailAnalyticsSyncRuns.id, run.id));
    runFinalized = true;
  } catch (error: any) {
    if (!runFinalized) {
      await db.update(emailAnalyticsSyncRuns).set({ status: "failed", error: error.message?.slice(0, 1000) || "Sync failed", completedAt: new Date() }).where(eq(emailAnalyticsSyncRuns.id, run.id));
    }
    throw error;
  }
}

// User.Read.All is deliberately optional. Mail.Read application/RBAC access is
// sufficient for administrator-configured addresses; discovery is only a safe
// convenience for tenants that already grant directory listing access.
export async function discoverMailboxes(organisationId: number) {
  const configured = process.env.EMAIL_ANALYTICS_DEFAULT_MAILBOXES?.split(",").map(v => v.trim().toLowerCase()).filter(Boolean) || [];
  let candidates = configured;
  if (!candidates.length) {
    try {
      const token = await graphToken();
      const response = await fetch("https://graph.microsoft.com/v1.0/users?$select=mail,userPrincipalName,displayName,accountEnabled&$top=999", { headers: { authorization: `Bearer ${token}` } });
      if (response.ok) candidates = ((await response.json()).value || []).filter((u: any) => u.accountEnabled !== false).map((u: any) => u.mail || u.userPrincipalName).filter(Boolean);
      // A 403 is expected in least-privilege deployments and is intentionally not
      // treated as a sync failure. Administrators can always configure addresses.
    } catch { /* discovery must never block configured mailbox syncing */ }
  }
  for (const address of candidates) await db.insert(emailAnalyticsMailboxes).values({ organisationId, address: String(address).toLowerCase(), enabled: true }).onConflictDoNothing();
  return db.select().from(emailAnalyticsMailboxes).where(and(eq(emailAnalyticsMailboxes.organisationId, organisationId), eq(emailAnalyticsMailboxes.enabled, true)));
}

/** Synchronises only the Karbon identity fields needed for client matching. */
export async function syncKarbonContacts(organisationId: number) {
  const settings = await ensureSettings(organisationId);
  const apiKey = process.env.KARBON_API_KEY;
  const accessKey = process.env.KARBON_ACCESS_KEY;
  if (!apiKey || !accessKey) throw new Error("Karbon credentials are not configured");
  const [run] = await db.insert(emailAnalyticsSyncRuns).values({ organisationId, kind: "karbon", status: "running", attempts: 1 }).returning();
  try {
    // Fetch each configured active type and follow Karbon's OData next links.
    const contacts: any[] = [];
    for (const configuredType of settings.contactTypes) {
      let url: string | undefined = `https://api.karbonhq.com/v3/Contacts?$filter=${encodeURIComponent(`ContactType eq '${configuredType.replaceAll("'", "''")}'`)}`;
      while (url) {
        const page: any = await retry(() => fetch(url!, {
          headers: { Authorization: `Bearer ${apiKey}`, "AccessKey": accessKey, Accept: "application/json" },
        }).then(async r => { if (!r.ok) throw new Error(`Karbon contacts request failed (${r.status})`); return r.json(); }));
        contacts.push(...(Array.isArray(page) ? page : page.value || page.data || []));
        url = page["@odata.nextLink"];
      }
    }
    await db.update(emailAnalyticsContacts).set({ active: false }).where(eq(emailAnalyticsContacts.organisationId, organisationId));
    for (const source of contacts) {
      const type = source.ContactType || source.contactType?.name || source.contactType || source.contactTypeName;
      const email = source.EmailAddress || source.emailAddress || source.email || source.emailAddresses?.[0]?.address;
      const id = source.ContactKey || source.id || source.contactId;
      if (!id || !email) continue;
      const name = source.FullName || source.name || [source.FirstName || source.firstName, source.LastName || source.lastName].filter(Boolean).join(" ") || email;
      const manager = source.ClientManager?.FullName || source.ClientManager?.name || source.ClientManager || source.ClientOwner?.FullName || source.ClientOwner?.name || source.ClientOwner || null;
      await db.insert(emailAnalyticsContacts).values({
        organisationId, karbonContactId: String(id), name, organisationName: source.OrganizationName || source.organisation?.name || source.organisationName || null,
        email: String(email).toLowerCase(), contactType: type, clientManager: manager, active: true, syncedAt: new Date(),
      }).onConflictDoUpdate({ target: [emailAnalyticsContacts.organisationId, emailAnalyticsContacts.karbonContactId], set: {
        name, organisationName: source.OrganizationName || source.organisation?.name || source.organisationName || null, email: String(email).toLowerCase(), contactType: type,
        clientManager: manager, active: true, syncedAt: new Date(),
      } });
    }
    // Reclassify retained metadata after every contact refresh so newly corrected
    // Karbon addresses enter the queue and removed client types leave it.
    await db.execute(sql`
      UPDATE email_analytics_messages em
      SET direction = CASE
        WHEN EXISTS (
          SELECT 1 FROM email_analytics_mailboxes mb
          WHERE mb.organisation_id = ${organisationId} AND mb.enabled = true
            AND lower(mb.address) = lower(em.sender_email)
        ) THEN 'outbound_mbs'
        WHEN EXISTS (
          SELECT 1 FROM email_analytics_contacts ec
          WHERE ec.organisation_id = ${organisationId} AND ec.active = true
            AND lower(ec.email) = lower(em.sender_email)
        ) THEN 'inbound_client'
        ELSE 'external_unmatched'
      END
      WHERE em.organisation_id = ${organisationId}
    `);
    await db.execute(sql`
      UPDATE email_analytics_conversations c SET
        latest_client_message_at = (
          SELECT max(m.received_at) FROM email_analytics_messages m
          WHERE m.canonical_conversation_id = c.id AND m.direction = 'inbound_client'
        ),
        latest_mbs_response_at = (
          SELECT max(m.received_at) FROM email_analytics_messages m
          WHERE m.canonical_conversation_id = c.id AND m.direction = 'outbound_mbs'
        ),
        client_contact_id = (
          SELECT ec.id FROM email_analytics_messages m
          JOIN email_analytics_contacts ec
            ON ec.organisation_id = m.organisation_id
           AND ec.active = true
           AND lower(ec.email) = lower(m.sender_email)
          WHERE m.canonical_conversation_id = c.id AND m.direction = 'inbound_client'
          ORDER BY m.received_at DESC LIMIT 1
        ),
        updated_at = now()
      WHERE c.organisation_id = ${organisationId} AND c.disposition IS DISTINCT FROM 'merged'
    `);
    await db.update(emailAnalyticsSettings).set({ lastKarbonSyncAt: new Date(), updatedAt: new Date() }).where(eq(emailAnalyticsSettings.organisationId, organisationId));
    await db.update(emailAnalyticsSyncRuns).set({ status: "succeeded", completedAt: new Date() }).where(eq(emailAnalyticsSyncRuns.id, run.id));
  } catch (error: any) {
    await db.update(emailAnalyticsSyncRuns).set({ status: "failed", error: error.message?.slice(0, 1000) || "Karbon sync failed", completedAt: new Date() }).where(eq(emailAnalyticsSyncRuns.id, run.id));
    throw error;
  }
}

export async function queueForOrganisation(organisationId: number, includeResolved = false) {
  const settings = await ensureSettings(organisationId);
  const conversations = await db.select().from(emailAnalyticsConversations).where(eq(emailAnalyticsConversations.organisationId, organisationId)).orderBy(emailAnalyticsConversations.latestClientMessageAt);
  const selected = conversations.filter(c => c.latestClientMessageAt && (
    includeResolved
      ? !!c.disposition && c.disposition !== "merged"
      : !c.disposition && (!c.latestMbsResponseAt || c.latestMbsResponseAt < c.latestClientMessageAt)
  ));
  if (!selected.length) return [];
  const conversationIds = selected.map(conversation => conversation.id);
  const contactIds = selected.map(conversation => conversation.clientContactId).filter((id): id is number => id !== null);
  const contacts = contactIds.length
    ? await db.select().from(emailAnalyticsContacts).where(and(eq(emailAnalyticsContacts.organisationId, organisationId), inArray(emailAnalyticsContacts.id, contactIds)))
    : [];
  const contactsById = new Map(contacts.map(contact => [contact.id, contact]));
  const mailboxRows = await db.select({
      canonicalConversationId: emailAnalyticsConversationGroups.canonicalConversationId,
      id: emailAnalyticsMailboxes.id,
      address: emailAnalyticsMailboxes.address,
      displayName: emailAnalyticsMailboxes.displayName,
  }).from(emailAnalyticsConversationGroups)
    .innerJoin(emailAnalyticsMailboxes, eq(emailAnalyticsConversationGroups.mailboxId, emailAnalyticsMailboxes.id))
    .where(and(eq(emailAnalyticsConversationGroups.organisationId, organisationId), inArray(emailAnalyticsConversationGroups.canonicalConversationId, conversationIds)));
  const mailboxesByConversation = new Map<number, { id: number; address: string; displayName: string | null }[]>();
  for (const mailbox of mailboxRows) {
    const current = mailboxesByConversation.get(mailbox.canonicalConversationId) || [];
    if (!current.some(item => item.id === mailbox.id)) current.push({ id: mailbox.id, address: mailbox.address, displayName: mailbox.displayName });
    mailboxesByConversation.set(mailbox.canonicalConversationId, current);
  }
  const clientMessages = await db.select({
    canonicalConversationId: emailAnalyticsMessages.canonicalConversationId,
    webLink: emailAnalyticsMessages.webLink,
    receivedAt: emailAnalyticsMessages.receivedAt,
  }).from(emailAnalyticsMessages)
    .where(and(inArray(emailAnalyticsMessages.canonicalConversationId, conversationIds), eq(emailAnalyticsMessages.direction, "inbound_client")))
    .orderBy(desc(emailAnalyticsMessages.receivedAt));
  const latestWebLinkByConversation = new Map<number, string | null>();
  for (const message of clientMessages) {
    if (!latestWebLinkByConversation.has(message.canonicalConversationId)) latestWebLinkByConversation.set(message.canonicalConversationId, message.webLink);
  }
  return selected.map(c => {
    const contact = c.clientContactId ? contactsById.get(c.clientContactId) : undefined;
    const categoryAt = c.dispositionAt || new Date();
    return {
      ...c,
      client: contact ? { name: contact.organisationName || contact.name, email: contact.email } : null,
      contact: contact ? { name: contact.name, email: contact.email, contactType: contact.contactType } : null,
      clientManager: contact?.clientManager ? { name: contact.clientManager } : null,
      mailboxes: mailboxesByConversation.get(c.id) || [],
      outlookWebLink: latestWebLinkByConversation.get(c.id) || null,
      ...slaCategory(c.latestClientMessageAt!, categoryAt, settings),
    };
  });
}

export function syncEmailAnalytics(organisationId: number) {
  const existing = syncLocks.get(organisationId);
  if (existing) return existing;
  const run = (async () => {
    await syncKarbonContacts(organisationId);
    await syncOrganisationMailboxes(organisationId);
    const { materializeResponseEvents } = await import("./email-analytics-response-events");
    await materializeResponseEvents(organisationId);
    await db.update(emailAnalyticsSettings).set({ lastMailboxSyncAt: new Date(), updatedAt: new Date() }).where(eq(emailAnalyticsSettings.organisationId, organisationId));
  })().finally(() => syncLocks.delete(organisationId));
  syncLocks.set(organisationId, run);
  return run;
}

export async function setDisposition(organisationId: number, conversationId: number, userId: number, disposition: Disposition | null, actualHandledAt?: Date) {
  const { materializeResponseEvents, withResponseEventOrganisationLock } = await import("./email-analytics-response-events");
  await materializeResponseEvents(organisationId);
  await withResponseEventOrganisationLock(organisationId, () => db.transaction(async transaction => {
    const [conversation] = await transaction.select().from(emailAnalyticsConversations).where(and(eq(emailAnalyticsConversations.id, conversationId), eq(emailAnalyticsConversations.organisationId, organisationId)));
    if (!conversation) throw new Error("Conversation not found");
    const [actor] = await transaction.select({ id: users.id }).from(users).where(and(eq(users.id, userId), eq(users.organisationId, organisationId)));
    if (!actor) throw new Error("User is not authorised for this organisation");
    const [updated] = await transaction.update(emailAnalyticsConversations).set({ disposition, dispositionAt: disposition ? new Date() : null, dispositionByUserId: disposition ? userId : null, updatedAt: new Date() }).where(and(eq(emailAnalyticsConversations.id, conversationId), eq(emailAnalyticsConversations.organisationId, organisationId))).returning({ id: emailAnalyticsConversations.id });
    if (!updated) throw new Error("Conversation not found");
    await transaction.insert(emailAnalyticsDispositionAudit).values({ organisationId, canonicalConversationId: conversationId, previousDisposition: conversation.disposition, disposition: disposition || null, action: disposition ? "set" : "reopen", performedByUserId: userId });
    const [event] = await transaction.select().from(emailAnalyticsResponseEvents).where(and(
      eq(emailAnalyticsResponseEvents.organisationId, organisationId),
      eq(emailAnalyticsResponseEvents.canonicalConversationId, conversationId),
    )).orderBy(desc(emailAnalyticsResponseEvents.receivedAt)).limit(1);
    const [settings] = await transaction.select({
      measurementStartAt: emailAnalyticsSettings.responseEventMeasurementStartAt,
    }).from(emailAnalyticsSettings).where(eq(emailAnalyticsSettings.organisationId, organisationId));
    if (!event && conversation.latestClientMessageAt && settings?.measurementStartAt && conversation.latestClientMessageAt >= settings.measurementStartAt) {
      throw new Error("Response event could not be materialized");
    }
    if (event && (event.outcome === "pending" || event.handlingSource === "manual" || event.handlingSource === "auto_triage")) {
      if (disposition) {
        const handledAt = actualHandledAt || new Date();
        if (handledAt < event.receivedAt) throw new Error("Handling time cannot be before the client email");
        if (handledAt < event.latestClientMessageAt) throw new Error("Handling time cannot be before the latest client email in this response event");
        if (handledAt.getTime() > Date.now() + 5 * 60_000) throw new Error("Handling time cannot be in the future");
        const outcome = disposition === "no_response_required"
          ? "excluded_no_response_required"
          : disposition === "dismissed"
            ? "fail_dismissed"
            : slaElapsedMilliseconds(event.receivedAt, handledAt) <= 24 * 3_600_000
              ? disposition === "handled_elsewhere" ? "pass_handled_elsewhere" : "pass_resolved_phone_meeting"
              : "fail_late_handling";
        await transaction.update(emailAnalyticsResponseEvents).set({ outcome, handlingSource: "manual", manualClassification: disposition, handledAt, handledByUserId: userId, updatedAt: new Date() }).where(eq(emailAnalyticsResponseEvents.id, event.id));
        await transaction.insert(emailAnalyticsResponseEventAudit).values({ organisationId, responseEventId: event.id, previousOutcome: event.outcome, outcome, handledAt, performedByUserId: userId });
      } else {
        const outcome = event.responseAt && slaElapsedMilliseconds(event.receivedAt, event.responseAt) <= 24 * 3_600_000 ? "pass_email_response" : event.responseAt ? "fail_late_response" : "pending";
        await transaction.update(emailAnalyticsResponseEvents).set({ outcome, handlingSource: "automatic", manualClassification: null, handledAt: null, handledByUserId: null, updatedAt: new Date() }).where(eq(emailAnalyticsResponseEvents.id, event.id));
        await transaction.insert(emailAnalyticsResponseEventAudit).values({ organisationId, responseEventId: event.id, previousOutcome: event.outcome, outcome, handledAt: null, performedByUserId: userId });
      }
    }
    await transaction.update(emailAnalyticsTriagePredictions).set({
      status: disposition ? "superseded" : "reopened",
      updatedAt: new Date(),
    }).where(and(
      eq(emailAnalyticsTriagePredictions.organisationId, organisationId),
      eq(emailAnalyticsTriagePredictions.canonicalConversationId, conversationId),
      eq(emailAnalyticsTriagePredictions.status, "applied"),
    ));
  }));
}

export async function setConversationFlag(organisationId: number, conversationId: number, userId: number, isFlagged: boolean) {
  await db.transaction(async transaction => {
    const [actor] = await transaction.select({ id: users.id }).from(users).where(and(eq(users.id, userId), eq(users.organisationId, organisationId)));
    if (!actor) throw new Error("User is not authorised for this organisation");
    const [updated] = await transaction.update(emailAnalyticsConversations)
      .set({ isFlagged, updatedAt: new Date() })
      .where(and(eq(emailAnalyticsConversations.id, conversationId), eq(emailAnalyticsConversations.organisationId, organisationId)))
      .returning({ id: emailAnalyticsConversations.id });
    if (!updated) throw new Error("Conversation not found");
  });
}
