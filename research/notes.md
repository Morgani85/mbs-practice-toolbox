# Research Notes: No-retention email classification

**Status:** complete
**Depth:** Quick

## Plan

- **Question:** Which practical processor and configuration can classify transient client-email content with zero or minimum retention?
- **Scope:** Provider retention, training use, processing location, cost/setup implications, and local deterministic pre-classification. No Microsoft permission or content-access changes.
- **Audience:** Practice Toolbox owner and technical implementer
- **Deliverable:** Decision report with a ranked recommendation and implementation implications

## Focus Areas

| # | Area | Status | Sources |
|---|---|---|---|
| 1 | Default no-storage cloud AI platforms | done | AWS, Microsoft, Google |
| 2 | Contractual ZDR APIs and Replit-managed routes | done | OpenAI, Anthropic, OpenRouter, Replit |
| 3 | Local deterministic rules and project fit | done | Microsoft Graph and email standards |

## Coverage Checklist

- [x] Which options provide default no-retention or contractual ZDR?
- [x] Is customer content used for model training?
- [x] Can processing be confined to London, the UK, or the EU?
- [x] What setup, contract, and cost implications apply?
- [x] Can deterministic rules safely reduce external AI processing?
- [x] Which option best fits this project?

## Findings Log

- AWS Bedrock now exposes an explicit `data_retention_mode: none`, but eligibility and support are account-and-model specific.
- Azure modified abuse monitoring removes the standard abuse-monitoring storage and human-review path for approved managed customers; regional or EU DataZone deployment controls processing geography.
- Direct OpenAI and Anthropic ZDR require provider approval or agreement and are not ordinary self-service defaults.
- Replit-managed AI has no published ZDR or UK/EU processing guarantee.
- Deterministic local rules can identify standardized automatic-reply headers and exact simple acknowledgements before an AI call, but must remain shadow-only until validated.

## Conflicts & Open Questions

- AWS documentation describes Bedrock's historical default as no input/output storage while newer retention-mode documentation makes behavior model-specific. The explicit `none` mode, confirmed through model metadata, should be required rather than relying on a default.
- AWS account and candidate model access are needed to confirm ZDR eligibility and London availability.
- Contractual DPA and procurement suitability require MBS approval even where technical no-retention is available.

## Gaps

- No cloud account has been connected, so model-specific ZDR eligibility and live pricing have not been tested.