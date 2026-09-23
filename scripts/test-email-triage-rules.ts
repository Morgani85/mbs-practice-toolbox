import { assessBedrockTriageReadiness, classifyTransientEmailLocally } from "../server/email-analytics-triage";

const availableModel = {
  modelDetails: {
    modelId: "amazon.nova-micro-v1:0",
    inferenceTypesSupported: ["ON_DEMAND"],
  },
};
const available = { authorizationStatus: "AUTHORIZED", regionAvailability: "AVAILABLE", entitlementAvailability: "AVAILABLE" };

const verified = assessBedrockTriageReadiness({ accountRetentionMode: "none", model: availableModel, availability: available });
if (!verified.ready || !verified.retentionSafetyBasis) throw new Error("Expected the documented account-none Runtime guarantee to be accepted");
const runtimeOnlyModel = assessBedrockTriageReadiness({
  accountRetentionMode: "none",
  model: { modelDetails: { modelId: "amazon.nova-micro-v1:0", inferenceTypesSupported: ["ON_DEMAND"] } },
  availability: available,
});
if (!runtimeOnlyModel.ready) throw new Error("A Runtime-only model must not require the Mantle-only allowed_modes field");
const inheritedRetention = assessBedrockTriageReadiness({ accountRetentionMode: "inherit", model: availableModel, availability: available });
if (inheritedRetention.ready) throw new Error("Inherited account retention must fail closed");
const missingEntitlement = assessBedrockTriageReadiness({ accountRetentionMode: "none", model: availableModel, availability: { authorizationStatus: "AUTHORIZED", regionAvailability: "AVAILABLE" } });
if (missingEntitlement.ready) throw new Error("Missing entitlement availability must fail closed");

if (classifyTransientEmailLocally("Automatic reply: I am out of the office", ["Auto-Submitted: auto-replied"])?.label !== "no_response_required") throw new Error("Expected standards-compliant OOO result");
if (classifyTransientEmailLocally("Many thanks")?.label !== "no_response_required") throw new Error("Expected exact social closure result");
if (classifyTransientEmailLocally("Please find the attached documents.")?.label !== "acknowledgement_recommended") throw new Error("Expected acknowledgement recommendation");
if (classifyTransientEmailLocally("Could you please confirm the payment position?") !== null) throw new Error("Open questions must be sent to the model, not ruled locally");

console.log("Email triage fail-closed and local-rule checks passed.");