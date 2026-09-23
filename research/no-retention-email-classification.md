# No-retention processor options for shadow email classification

**Research date:** 10 September 2026  
**Scope:** Shadow classification of the latest relevant inbound client email only. No automatic queue exclusion.  
**Decision status:** Research only. No Microsoft permission, mailbox-content access, or external AI processing has been enabled.

## Executive recommendation

Use a two-stage shadow classifier:

1. **Local deterministic pass inside Practice Toolbox.** Process the latest inbound message transiently in server memory. Detect only narrow, high-confidence patterns such as standards-compliant out-of-office replies and exact simple acknowledgements. Store only the fixed prediction fields already specified. Do not send these clear cases to an AI provider.
2. **AWS Bedrock fallback using `data_retention_mode: none` in `eu-west-2` (London).** Proceed only after the selected model's metadata and the MBS AWS account confirm that `none` is an allowed mode. Avoid cross-region inference. If AWS/model eligibility cannot be obtained, use **Azure OpenAI in a suitable regional or EU DataZone deployment with approved modified abuse monitoring**.

This best matches the requested preference order. It minimizes external disclosure, offers an explicit technical no-durable-storage mode for the AI fallback, and can keep processing in London when the selected model supports that region. AWS documentation says eligibility is account-and-model specific, so this recommendation still requires an AWS account and provider confirmation before implementation. [[1]](https://docs.aws.amazon.com/bedrock/latest/userguide/data-retention.html) [[2]](https://docs.aws.amazon.com/bedrock/latest/userguide/models-regions.html)

Do not use Replit-managed Anthropic for this email-content workload under the currently documented standard route. It is easy to integrate, but there is no published Zero Data Retention or UK/EU processing guarantee for that path. [[3]](https://docs.replit.com/legal-and-security-info/model-improvement.md)

## Option comparison

| Option | Retention and training | Processing location | Practical implications | Assessment |
|---|---|---|---|---|
| **Local deterministic rules** | No external processor. Content exists only transiently in Practice Toolbox memory and is discarded after classification. | Current Practice Toolbox hosting location; no AI-provider transfer. | Small application-compute cost. Requires careful normalization and validation. Cannot safely resolve nuanced messages. | **Use first for narrow patterns.** |
| **AWS Bedrock, explicit `none` mode** | AWS says `none` writes no request or response data to durable storage and does not share it with the model provider. Support and eligibility are model/account specific. Do not rely on `store: false` or a provider default as a substitute. [[1]](https://docs.aws.amazon.com/bedrock/latest/userguide/data-retention.html) | Use a supported model through a regional `eu-west-2` endpoint and disable cross-region inference. Model availability must be checked. [[2]](https://docs.aws.amazon.com/bedrock/latest/userguide/models-regions.html) | Requires an AWS account, IAM configuration, model access, a provider/DPA review, and confirmation of ZDR eligibility. Usage is billed per model input/output; no separate ZDR surcharge was identified in the published documentation. | **Preferred AI fallback if eligibility is confirmed.** |
| **Azure OpenAI with modified abuse monitoring** | Models are stateless and customer content is not used to train base models. Standard abuse monitoring can store flagged content for review. Approved managed customers can use modified abuse monitoring, under which the standard storage and human-review process is not performed. [[4]](https://learn.microsoft.com/en-us/legal/cognitive-services/openai/data-privacy) [[5]](https://learn.microsoft.com/en-us/azure/ai-foundry/openai/concepts/abuse-monitoring) | Regional deployments process in the selected geography; EU DataZone processing occurs within EU member nations. Global deployments are unsuitable for a strict location requirement. [[4]](https://learn.microsoft.com/en-us/legal/cognitive-services/openai/data-privacy) | Requires an Azure subscription/resource, model deployment and an application for modified abuse monitoring. This may fit existing Microsoft governance, but the current Microsoft Graph app does not itself provide Azure AI access. Token and deployment charges apply. | **Best Microsoft-aligned fallback.** |
| **Direct OpenAI API with ZDR** | ZDR excludes eligible customer content from abuse-monitoring logs; API data is not used for training by default. ZDR requires prior approval and additional requirements. Some endpoints/features remain ineligible. [[6]](https://developers.openai.com/api/docs/guides/your-data) | Regional processing is available only for eligible configurations. Non-US residency requires approved data controls. | Requires a direct OpenAI commercial relationship and approval. Eligible newer models using data residency have a published 10% uplift. | **Strong contractual option, but procurement-gated.** |
| **Direct Anthropic API with ZDR** | Standard API retention is up to 30 days. ZDR is a separately agreed, feature-scoped arrangement; commercial API content is not used for training by default. [[7]](https://platform.claude.com/docs/en/manage-claude/api-and-data-retention.md) | Anthropic's published inference geography controls describe global or US processing, not a UK/EU inference option. [[8]](https://platform.claude.com/docs/en/manage-claude/data-residency.md) | Requires a direct agreement and scope confirmation. No published ZDR surcharge was identified. | **No-retention is possible, but location is a weaker fit.** |
| **OpenRouter** | OpenRouter says prompt/response logging is opt-in and off by default, but downstream model-provider retention still applies. Metadata is retained. [[9]](https://openrouter.ai/docs/guides/privacy/data-collection) | Routing geography depends on the selected downstream provider and is not guaranteed universally. | Easy model choice, but adds another processor and requires route-level provider controls. | **Not equivalent to end-to-end ZDR by itself.** |
| **Replit-managed AI** | Published controls cover training opt-out/no-training by plan, not Zero Data Retention. Replit still processes content to provide, secure and troubleshoot the service. [[3]](https://docs.replit.com/legal-and-security-info/model-improvement.md) | No published fixed UK/EU processing guarantee for the managed AI route. | Lowest integration effort and Replit-credit billing, but does not meet the preferred retention/location standard on current public terms. | **Do not use for this workload unless requirements change.** |
| **Google Vertex AI** | Google documents no training on customer prompts without permission, but no-training is not the same as blanket ZDR; feature-specific safety and retention controls apply. | Regional services exist, including European locations, but model and feature support varies. | Requires a Google Cloud project, IAM and region/model validation. | **Not shortlisted without a clearer explicit ZDR configuration.** |

## Deterministic processing before AI

The local stage can materially reduce the content sent to any processor, but it should be intentionally narrow.

### Automated replies

Microsoft Graph does not provide a reliable `isOutOfOffice` property. The strongest standards-based signal is the Internet header `Auto-Submitted: auto-replied`, which RFC 3834 and the vacation-response standard expect automated replies to use. [[10]](https://www.rfc-editor.org/rfc/rfc3834)

Use that as a high-confidence shadow signal only when:

- the header is syntactically valid;
- corroborating subject or header signals are consistent;
- the message contains no clear request, deadline or required action; and
- retrieval or parsing did not fail.

Do not treat `X-Auto-Response-Suppress`, a `no-reply` sender, a subject prefix, or bulk/list headers as independently decisive. Automatic messages can still contain operationally important information.

### Exact simple acknowledgements

After removing HTML, quoted history and obvious signatures in memory, an exact allowlist can classify phrases such as “Thanks”, “Thank you”, “Perfect, thank you”, and “That’s great, have a good weekend” as high-confidence `no_response_required` shadow predictions.

The rule must reject the deterministic path if any of the following appears:

- additional non-signature text;
- a question mark, request, instruction, complaint or deadline;
- an attachment;
- language such as “please”, “can you”, “could you”, “need”, “when”, “urgent”, “by Friday”, or equivalent;
- parsing uncertainty, encryption/protection, unsupported language, or truncated content.

“Here is the receipt”, “Attached are the records”, and “I’ve done that now” should be deterministic `acknowledgement_recommended`, not `no_response_required`.

All deterministic predictions remain shadow results. They must be included in the same validation report and dangerous-false-exclusion count as AI predictions.

## Microsoft Graph implications

The current application retrieves and stores metadata only. `Mail.ReadBasic` excludes body, body preview, attachments and extended properties. Content classification requires `Mail.Read`; Internet message headers should also be treated as requiring that permission. [[11]](https://learn.microsoft.com/en-us/graph/permissions-reference#mail-permissions)

If implementation is approved later:

- keep Exchange application RBAC restricted to the configured mailboxes;
- fetch only the latest relevant inbound message after metadata logic proves it is still outstanding;
- request text content and only the fields needed for classification;
- do not request attachment bytes or thread history;
- use attachment presence/type metadata only when needed to distinguish acknowledgements;
- process the content in memory, discard it immediately, and persist only classification, confidence, fixed reason code, classifier/model version and timestamp;
- default to `uncertain` on a Graph error, model error, parse failure or provider-control mismatch.

No Graph permission or content-access change was made during this research.

## Validation dataset caveat

The existing manual outcomes are authoritative, but not every outcome is a direct semantic label for email content. `no_response_required` maps cleanly to the classifier label. `genuinely_unanswered` normally maps to `response_required`. However, `handled_elsewhere` and `resolved_phone_meeting` describe how an obligation was completed, not necessarily whether the original email required a response.

Before calculating “correct/incorrect”, define a fixed mapping:

- `no_response_required` → human `no_response_required`;
- `genuinely_unanswered` or dismissed after review → human `response_required`, unless the reviewer explicitly recorded otherwise;
- `handled_elsewhere` and `resolved_phone_meeting` → normally human `response_required`, but report these separately as outcome-derived labels;
- receipt/document-supplied examples should be manually mapped to `acknowledgement_recommended`.

The validation report should distinguish direct human semantic labels from labels inferred from operational outcomes. This avoids making the classifier look inaccurate because the historical field answered a different question.

## Cost and implementation impact

The local deterministic stage adds negligible runtime cost but requires careful test coverage and a versioned rule set. The AI stage will incur low per-token inference charges because only one cleaned inbound message is sent and the output is a small structured enum. The larger cost differences are organizational:

- **AWS:** account, IAM, Bedrock model access, ZDR eligibility confirmation and DPA review;
- **Azure:** subscription/resource plus modified-abuse-monitoring approval;
- **OpenAI/Anthropic direct:** provider sales, contractual approval and possibly residency uplifts;
- **Replit-managed:** easiest billing and implementation, but does not currently meet the preferred ZDR/location requirement.

Because message volume and final model are not yet fixed, a reliable monthly figure cannot be calculated. Once a provider account and model are selected, run the historical validation as a bounded batch and record token usage without recording message content.

## Decision gate

The next safe step is to determine whether MBS already has an AWS or Azure commercial account:

- If **AWS**, verify a suitable low-cost model supports `data_retention_mode: none` in `eu-west-2`.
- If **Azure**, check eligibility for modified abuse monitoring and choose a regional/EU DataZone deployment.
- If neither is available, obtain direct OpenAI ZDR eligibility before reconsidering a standard-retention route.

Do not enable `Mail.Read`, fetch email content, or run historical classification until the selected processor configuration and contractual terms are approved.

## Sources

1. [Data retention in Amazon Bedrock](https://docs.aws.amazon.com/bedrock/latest/userguide/data-retention.html)
2. [Model support by AWS Region](https://docs.aws.amazon.com/bedrock/latest/userguide/models-regions.html)
3. [Replit model improvement and training](https://docs.replit.com/legal-and-security-info/model-improvement.md)
4. [Data, privacy, and security for Azure Direct Models](https://learn.microsoft.com/en-us/legal/cognitive-services/openai/data-privacy)
5. [Azure abuse monitoring](https://learn.microsoft.com/en-us/azure/ai-foundry/openai/concepts/abuse-monitoring)
6. [OpenAI API data controls](https://developers.openai.com/api/docs/guides/your-data)
7. [Anthropic API and data retention](https://platform.claude.com/docs/en/manage-claude/api-and-data-retention.md)
8. [Anthropic data residency](https://platform.claude.com/docs/en/manage-claude/data-residency.md)
9. [OpenRouter data collection](https://openrouter.ai/docs/guides/privacy/data-collection)
10. [RFC 3834: automatic email responses](https://www.rfc-editor.org/rfc/rfc3834)
11. [Microsoft Graph permissions reference](https://learn.microsoft.com/en-us/graph/permissions-reference#mail-permissions)
12. [Abuse detection in Amazon Bedrock](https://docs.aws.amazon.com/bedrock/latest/userguide/abuse-detection.html)