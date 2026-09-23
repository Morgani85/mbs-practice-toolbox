import {
  BedrockClient,
  DataRetentionMode,
  GetAccountDataRetentionCommand,
  GetFoundationModelAvailabilityCommand,
  GetFoundationModelCommand,
} from "@aws-sdk/client-bedrock";
import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "./db";
import {
  emailAnalyticsConversations,
  emailAnalyticsDispositionAudit,
  emailAnalyticsResponseEventAudit,
  emailAnalyticsResponseEvents,
  emailAnalyticsSettings,
  emailAnalyticsTriagePredictions,
} from "@shared/schema";

export const AUTO_TRIAGE_REGION = "eu-west-2";
export const AUTO_TRIAGE_MODEL_ID = "amazon.nova-micro-v1:0";
export const AUTO_TRIAGE_LABELS = ["no_response_required", "acknowledgement_recommended", "response_required", "uncertain"] as const;
export const AUTO_TRIAGE_MODES = ["disabled", "shadow", "automatic"] as const;
export const AUTO_TRIAGE_MIN_CONFIDENCE = 0.95;
export const AUTO_TRIAGE_MIN_VALIDATED_EXAMPLES = 25;
export type AutoTriageLabel = typeof AUTO_TRIAGE_LABELS[number];
export type AutoTriageMode = typeof AUTO_TRIAGE_MODES[number];

type TriagePrediction = {
  label: AutoTriageLabel;
  confidence: number;
  reasonCode: string;
  classifierSource: "rule" | "bedrock";
  classifierVersion: string;
  modelId?: string | null;
};

type DirectOutcome = "no_response_required" | "response_required";

function isTriageLabel(value: unknown): value is AutoTriageLabel {
  return typeof value === "string" && (AUTO_TRIAGE_LABELS as readonly string[]).includes(value);
}

function normaliseText(value: string) {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

/**
 * A conservative pre-model classifier for use only on transient data received
 * after the separate Microsoft content-access approval. It never logs, stores,
 * or returns the original message content.
 */
export function classifyTransientEmailLocally(body: string, internetMessageHeaders: string[] = []): TriagePrediction | null {
  const text = normaliseText(body);
  const autoSubmitted = internetMessageHeaders.some(header => /^auto-submitted:\s*auto-replied\s*$/i.test(header.trim()));
  const explicitOutOfOffice = /^(?:automatic reply|out of office)(?::|\s|-)/i.test(body.trim())
    && /\b(?:out of (?:the )?office|away until|annual leave)\b/i.test(body);
  if (autoSubmitted && explicitOutOfOffice) {
    return { label: "no_response_required", confidence: 0.999, reasonCode: "standards_compliant_out_of_office", classifierSource: "rule", classifierVersion: "local-rules-v1" };
  }
  if (["thanks", "thank you", "many thanks", "cheers"].includes(text)) {
    return { label: "no_response_required", confidence: 0.995, reasonCode: "exact_social_closure", classifierSource: "rule", classifierVersion: "local-rules-v1" };
  }
  if (/\b(?:attached|attachment|enclosed|document|documents|invoice|statement|file|files|information|details)\b/i.test(body)) {
    return { label: "acknowledgement_recommended", confidence: 0.99, reasonCode: "information_or_document_supplied", classifierSource: "rule", classifierVersion: "local-rules-v1" };
  }
  return null;
}

export function assessBedrockTriageReadiness(input: {
  accountRetentionMode?: string | null;
  model?: unknown;
  availability?: { authorizationStatus?: string; regionAvailability?: string; entitlementAvailability?: string } | null;
}) {
  const modelDetails = (input.model as any)?.modelDetails;
  const blockers: string[] = [];
  if (input.accountRetentionMode !== DataRetentionMode.NONE) blockers.push("Bedrock account retention is not explicitly set to none.");
  if (modelDetails?.modelId !== AUTO_TRIAGE_MODEL_ID || !modelDetails?.inferenceTypesSupported?.includes("ON_DEMAND")) blockers.push("The selected direct regional model is not available for on-demand inference.");
  if (
    input.availability?.authorizationStatus !== "AUTHORIZED"
    || input.availability?.regionAvailability !== "AVAILABLE"
    || input.availability?.entitlementAvailability !== "AVAILABLE"
  ) blockers.push("The selected model is not authorized, entitled, and available in London.");
  return {
    ready: blockers.length === 0,
    region: AUTO_TRIAGE_REGION,
    modelId: AUTO_TRIAGE_MODEL_ID,
    accountRetentionMode: input.accountRetentionMode || null,
    modelAllowedModes: [] as string[],
    retentionSafetyBasis: input.accountRetentionMode === DataRetentionMode.NONE
      ? "AWS documents that account mode none blocks any Runtime request to a model requiring retention."
      : null,
    availability: input.availability || null,
    blockers,
  };
}

/**
 * This is deliberately fail-closed. Nova Micro is a bedrock-runtime-only model,
 * so it is not returned by the bedrock-mantle /v1/models API that exposes
 * allowed_modes. AWS documents that account mode none blocks any incompatible
 * Runtime invocation, so account mode, direct availability, and entitlement
 * are checked fresh before a future inference call.
 */
export async function getBedrockTriageReadiness() {
  const client = new BedrockClient({ region: AUTO_TRIAGE_REGION });
  try {
    const [accountRetention, model, availability] = await Promise.all([
      client.send(new GetAccountDataRetentionCommand({})),
      client.send(new GetFoundationModelCommand({ modelIdentifier: AUTO_TRIAGE_MODEL_ID })),
      client.send(new GetFoundationModelAvailabilityCommand({ modelId: AUTO_TRIAGE_MODEL_ID })),
    ]);
    return assessBedrockTriageReadiness({
      accountRetentionMode: accountRetention.mode,
      model,
      availability: {
        authorizationStatus: availability.authorizationStatus,
        regionAvailability: availability.regionAvailability,
        entitlementAvailability: availability.entitlementAvailability,
      },
    });
  } catch (error: any) {
    return {
      ready: false,
      region: AUTO_TRIAGE_REGION,
      modelId: AUTO_TRIAGE_MODEL_ID,
      accountRetentionMode: null,
      modelAllowedModes: [] as string[],
      retentionSafetyBasis: null,
      availability: null,
      blockers: [`Bedrock readiness check failed: ${error?.name || "unknown error"}`],
    };
  }
}

function directOutcomeFromManualClassification(value: string | null): DirectOutcome | null {
  if (value === "no_response_required") return "no_response_required";
  if (value === "dismissed" || value === "genuinely_unanswered") return "response_required";
  return null;
}

function emptyMatrix() {
  return Object.fromEntries(
    ["no_response_required", "response_required"].map(actual => [
      actual,
      Object.fromEntries(AUTO_TRIAGE_LABELS.map(predicted => [predicted, 0])),
    ]),
  ) as Record<DirectOutcome, Record<AutoTriageLabel, number>>;
}

export async function autoTriageValidationReport(organisationId: number) {
  const rows = await db.select({
    predictionId: emailAnalyticsTriagePredictions.id,
    label: emailAnalyticsTriagePredictions.label,
    status: emailAnalyticsTriagePredictions.status,
    classifiedAt: emailAnalyticsTriagePredictions.classifiedAt,
    manualClassification: emailAnalyticsResponseEvents.manualClassification,
  }).from(emailAnalyticsTriagePredictions)
    .leftJoin(emailAnalyticsResponseEvents, and(
      eq(emailAnalyticsTriagePredictions.organisationId, emailAnalyticsResponseEvents.organisationId),
      eq(emailAnalyticsTriagePredictions.clientMessageId, emailAnalyticsResponseEvents.latestClientMessageId),
    ))
    .where(eq(emailAnalyticsTriagePredictions.organisationId, organisationId));

  const matrix = emptyMatrix();
  let directLabeled = 0;
  let operationalOutcomeOnly = 0;
  let unresolved = 0;
  let dangerousFalseExclusions = 0;
  for (const row of rows) {
    const actual = directOutcomeFromManualClassification(row.manualClassification);
    if (actual && isTriageLabel(row.label)) {
      directLabeled += 1;
      matrix[actual][row.label] += 1;
      if (actual === "response_required" && row.label === "no_response_required") dangerousFalseExclusions += 1;
    } else if (row.manualClassification === "handled_elsewhere" || row.manualClassification === "resolved_phone_meeting") {
      // These are legitimate management outcomes, but do not establish whether
      // the email's text required a response, so they remain outside the matrix.
      operationalOutcomeOnly += 1;
    } else {
      unresolved += 1;
    }
  }
  const responseRequired = directLabeled ? Object.values(matrix.response_required).reduce((total, count) => total + count, 0) : 0;
  return {
    totalPredictions: rows.length,
    directLabeled,
    operationalOutcomeOnly,
    unresolved,
    minimumDirectLabels: AUTO_TRIAGE_MIN_VALIDATED_EXAMPLES,
    confusionMatrix: matrix,
    dangerousFalseExclusions,
    dangerousFalseExclusionRate: responseRequired ? Math.round((dangerousFalseExclusions / responseRequired) * 10000) / 100 : null,
  };
}

export async function autoTriageStatus(organisationId: number) {
  const [settings] = await db.select().from(emailAnalyticsSettings).where(eq(emailAnalyticsSettings.organisationId, organisationId));
  const [readiness, validation, statusRows] = await Promise.all([
    getBedrockTriageReadiness(),
    autoTriageValidationReport(organisationId),
    db.select({
      status: emailAnalyticsTriagePredictions.status,
      count: sql<number>`count(*)::int`,
    }).from(emailAnalyticsTriagePredictions)
      .where(eq(emailAnalyticsTriagePredictions.organisationId, organisationId))
      .groupBy(emailAnalyticsTriagePredictions.status),
  ]);
  const blockers = [
    ...readiness.blockers,
    "Microsoft Graph content access is not enabled.",
    ...(validation.directLabeled < AUTO_TRIAGE_MIN_VALIDATED_EXAMPLES
      ? [`At least ${AUTO_TRIAGE_MIN_VALIDATED_EXAMPLES} directly-labelled validation examples are required.`]
      : []),
    ...(validation.dangerousFalseExclusions > 0 ? ["Validation contains dangerous false exclusions."] : []),
    ...(!settings?.autoTriageValidationReviewedAt ? ["A manager must review the validation report."] : []),
  ];
  return {
    mode: settings?.autoTriageMode || "disabled",
    confidenceThreshold: Number(settings?.autoTriageConfidenceThreshold || "0.98"),
    validationReviewedAt: settings?.autoTriageValidationReviewedAt || null,
    activationApprovedAt: settings?.autoTriageActivationApprovedAt || null,
    lastRunAt: settings?.autoTriageLastRunAt || null,
    lastErrorCode: settings?.autoTriageLastErrorCode || null,
    contentAccess: "not_enabled" as const,
    readiness,
    validation,
    predictionStatuses: Object.fromEntries(statusRows.map(row => [row.status, Number(row.count)])),
    automaticActivationBlocked: blockers.length > 0,
    blockers,
  };
}

export async function saveTriagePrediction(organisationId: number, input: {
  canonicalConversationId: number;
  clientMessageId: number;
  prediction: TriagePrediction;
  status?: "shadow" | "blocked";
}) {
  if (!isTriageLabel(input.prediction.label)) throw new Error("Invalid triage label");
  if (!Number.isFinite(input.prediction.confidence) || input.prediction.confidence < 0 || input.prediction.confidence > 1) throw new Error("Invalid triage confidence");
  const now = new Date();
  const [prediction] = await db.insert(emailAnalyticsTriagePredictions).values({
    organisationId,
    canonicalConversationId: input.canonicalConversationId,
    clientMessageId: input.clientMessageId,
    label: input.prediction.label,
    confidence: input.prediction.confidence.toFixed(3),
    reasonCode: input.prediction.reasonCode,
    classifierSource: input.prediction.classifierSource,
    classifierVersion: input.prediction.classifierVersion,
    modelId: input.prediction.modelId || null,
    status: input.status || "shadow",
    classifiedAt: now,
    updatedAt: now,
  }).onConflictDoUpdate({
    target: [emailAnalyticsTriagePredictions.organisationId, emailAnalyticsTriagePredictions.clientMessageId],
    set: {
      label: input.prediction.label,
      confidence: input.prediction.confidence.toFixed(3),
      reasonCode: input.prediction.reasonCode,
      classifierSource: input.prediction.classifierSource,
      classifierVersion: input.prediction.classifierVersion,
      modelId: input.prediction.modelId || null,
      status: input.status || "shadow",
      classifiedAt: now,
      updatedAt: now,
    },
  }).returning();
  return prediction;
}

export async function acknowledgeAutoTriageValidation(organisationId: number, userId: number) {
  const report = await autoTriageValidationReport(organisationId);
  if (report.directLabeled < AUTO_TRIAGE_MIN_VALIDATED_EXAMPLES) throw new Error(`At least ${AUTO_TRIAGE_MIN_VALIDATED_EXAMPLES} directly-labelled validation examples are required`);
  if (report.dangerousFalseExclusions > 0) throw new Error("Validation contains dangerous false exclusions");
  await db.update(emailAnalyticsSettings).set({
    autoTriageValidationReviewedAt: new Date(),
    autoTriageValidationReviewedByUserId: userId,
    updatedAt: new Date(),
  }).where(eq(emailAnalyticsSettings.organisationId, organisationId));
}

export async function activateAutomaticTriage(organisationId: number, userId: number, confidenceThreshold: number) {
  if (!Number.isFinite(confidenceThreshold) || confidenceThreshold < AUTO_TRIAGE_MIN_CONFIDENCE || confidenceThreshold > 1) {
    throw new Error(`Confidence threshold must be between ${AUTO_TRIAGE_MIN_CONFIDENCE} and 1`);
  }
  const status = await autoTriageStatus(organisationId);
  if (status.automaticActivationBlocked) throw new Error(status.blockers[0] || "Automatic triage cannot be enabled");
  await db.update(emailAnalyticsSettings).set({
    autoTriageMode: "automatic",
    autoTriageConfidenceThreshold: confidenceThreshold.toFixed(3),
    autoTriageActivationApprovedAt: new Date(),
    autoTriageActivationApprovedByUserId: userId,
    updatedAt: new Date(),
  }).where(eq(emailAnalyticsSettings.organisationId, organisationId));
}

/**
 * Reserved for the separately approved content-access phase. This function
 * provides an auditable, system actor path for an eligible shadow prediction;
 * it is not called while Microsoft Graph remains metadata-only.
 */
export async function applyAutomaticNoResponsePrediction(organisationId: number, predictionId: number) {
  const status = await autoTriageStatus(organisationId);
  if (status.automaticActivationBlocked || status.mode !== "automatic") throw new Error(status.blockers[0] || "Automatic triage is not enabled");
  const [prediction] = await db.select().from(emailAnalyticsTriagePredictions).where(and(
    eq(emailAnalyticsTriagePredictions.id, predictionId),
    eq(emailAnalyticsTriagePredictions.organisationId, organisationId),
  ));
  if (!prediction || prediction.status !== "shadow" || prediction.label !== "no_response_required") throw new Error("Eligible shadow prediction not found");
  if (Number(prediction.confidence) < status.confidenceThreshold) throw new Error("Prediction is below the approved confidence threshold");

  const { materializeResponseEvents, withResponseEventOrganisationLock } = await import("./email-analytics-response-events");
  await materializeResponseEvents(organisationId);
  await withResponseEventOrganisationLock(organisationId, () => db.transaction(async transaction => {
    const [conversation] = await transaction.select().from(emailAnalyticsConversations).where(and(
      eq(emailAnalyticsConversations.id, prediction.canonicalConversationId),
      eq(emailAnalyticsConversations.organisationId, organisationId),
    ));
    if (!conversation || conversation.disposition || !conversation.latestClientMessageAt) throw new Error("Conversation is no longer eligible");
    const [manualAction] = await transaction.select({ id: emailAnalyticsDispositionAudit.id }).from(emailAnalyticsDispositionAudit).where(and(
      eq(emailAnalyticsDispositionAudit.organisationId, organisationId),
      eq(emailAnalyticsDispositionAudit.canonicalConversationId, prediction.canonicalConversationId),
      eq(emailAnalyticsDispositionAudit.actorKind, "user"),
    )).orderBy(desc(emailAnalyticsDispositionAudit.performedAt)).limit(1);
    if (manualAction) throw new Error("A manual outcome already exists for this conversation");

    await transaction.update(emailAnalyticsConversations).set({
      disposition: "no_response_required",
      dispositionAt: new Date(),
      dispositionByUserId: null,
      updatedAt: new Date(),
    }).where(eq(emailAnalyticsConversations.id, conversation.id));
    await transaction.insert(emailAnalyticsDispositionAudit).values({
      organisationId,
      canonicalConversationId: conversation.id,
      previousDisposition: conversation.disposition,
      disposition: "no_response_required",
      action: "set",
      performedByUserId: null,
      actorKind: "automatic_triage",
      triagePredictionId: prediction.id,
    });
    const [event] = await transaction.select().from(emailAnalyticsResponseEvents).where(and(
      eq(emailAnalyticsResponseEvents.organisationId, organisationId),
      eq(emailAnalyticsResponseEvents.canonicalConversationId, conversation.id),
      eq(emailAnalyticsResponseEvents.latestClientMessageId, prediction.clientMessageId),
    ));
    if (event?.outcome === "pending") {
      await transaction.update(emailAnalyticsResponseEvents).set({
        outcome: "excluded_no_response_required",
        handlingSource: "auto_triage",
        manualClassification: null,
        handledAt: new Date(),
        handledByUserId: null,
        updatedAt: new Date(),
      }).where(eq(emailAnalyticsResponseEvents.id, event.id));
      await transaction.insert(emailAnalyticsResponseEventAudit).values({
        organisationId,
        responseEventId: event.id,
        previousOutcome: event.outcome,
        outcome: "excluded_no_response_required",
        handledAt: new Date(),
        performedByUserId: null,
        actorKind: "automatic_triage",
        triagePredictionId: prediction.id,
      });
    }
    await transaction.update(emailAnalyticsTriagePredictions).set({ status: "applied", updatedAt: new Date() }).where(eq(emailAnalyticsTriagePredictions.id, prediction.id));
  }));
}