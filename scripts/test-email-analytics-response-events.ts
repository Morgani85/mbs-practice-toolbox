import assert from "node:assert/strict";
import { deriveResponseEvents } from "../server/email-analytics-response-events";

const at = (value: string) => new Date(value);
const message = (
  id: number,
  canonicalConversationId: number,
  mailboxId: number,
  direction: "inbound_client" | "outbound_mbs",
  receivedAt: string,
  internetMessageId?: string,
) => ({
  id,
  organisationId: 1,
  mailboxId,
  canonicalConversationId,
  graphMessageId: `graph-${mailboxId}-${id}`,
  graphConversationId: `conversation-${mailboxId}`,
  internetMessageId: internetMessageId || null,
  direction,
  senderEmail: direction === "inbound_client" ? "client@example.test" : "staff@example.test",
  senderName: null,
  subject: null,
  receivedAt: at(receivedAt),
  createdAt: at(receivedAt),
  webLink: null,
} as any);

const contactByConversation = new Map([[100, 10]]);
const measurementStart = at("2026-07-11T00:00:00Z");

{
  const events = deriveResponseEvents([
    message(1, 100, 1, "outbound_mbs", "2026-07-10T12:00:00Z", "<boundary@example.test>"),
    message(2, 100, 1, "inbound_client", "2026-07-12T09:00:00Z", "<client-1@example.test>"),
    message(3, 100, 2, "inbound_client", "2026-07-12T09:00:00Z", "<client-1@example.test>"),
    message(4, 100, 2, "inbound_client", "2026-07-12T10:00:00Z", "<client-2@example.test>"),
    message(5, 100, 2, "outbound_mbs", "2026-07-12T11:00:00Z", "<staff-1@example.test>"),
    message(6, 100, 1, "inbound_client", "2026-07-13T09:00:00Z", "<client-3@example.test>"),
  ], contactByConversation, [], measurementStart);

  assert.equal(events.length, 2, "a later client email after a response must open a new event");
  assert.equal(events[0].clientMessageCount, 2, "duplicate cross-mailbox copies must not inflate the client-message count");
  assert.equal(events[0].responseMessageId, 5, "an MBS response must close the open response event");
  assert.equal(events[0].outcome, "pass_email_response");
  assert.equal(events[0].backfillConfidence, "reliable_boundary");
  assert.equal(events[1].outcome, "pending");
}

{
  const events = deriveResponseEvents([
    message(10, 100, 1, "inbound_client", "2026-07-12T09:00:00Z", "<first-after-start@example.test>"),
  ], contactByConversation, [], measurementStart);
  assert.equal(events[0].backfillConfidence, "boundary_uncertain", "an event without an observed historical boundary must remain excluded from KPI reporting");
}

{
  const input = [
    message(20, 100, 1, "outbound_mbs", "2026-07-10T12:00:00Z", "<prior-boundary@example.test>"),
    message(21, 100, 1, "inbound_client", "2026-07-12T09:00:00Z", "<stable@example.test>"),
  ];
  assert.deepEqual(
    deriveResponseEvents(input, contactByConversation, [], measurementStart),
    deriveResponseEvents(input, contactByConversation, [], measurementStart),
    "rebuilding the same metadata must derive the same response events",
  );
}

console.log("Email Analytics response-event tests passed");