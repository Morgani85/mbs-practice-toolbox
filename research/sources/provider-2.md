Source: https://docs.aws.amazon.com/bedrock/latest/userguide/abuse-detection.html
Title: Amazon Bedrock abuse detection - Amazon Bedrock
Fetched: 2026-09-10T12:47:04.981Z

## Select your cookie preferences

We use essential cookies and similar tools that are necessary to provide our site and services. We use performance cookies to collect anonymous statistics, so we can understand how customers use our site and make improvements. Essential cookies cannot be deactivated, but you can choose “Customize” or “Decline” to decline performance cookies.

If you agree, AWS and approved third parties will also use cookies to provide useful site features, remember your preferences, and display relevant content, including relevant advertising. To accept or decline all non-essential cookies, choose “Accept” or “Decline.” To make more detailed choices, choose “Customize.”

AcceptDeclineCustomize

## Customize cookie preferences

We use cookies and similar tools (collectively, "cookies") for the following purposes.

### Essential

Essential cookies are necessary to provide our site and services and cannot be deactivated. They are usually set in response to your actions on the site, such as setting your privacy preferences, signing in, or filling in forms.

Allowed

### Performance

Performance cookies provide anonymous statistics about how customers navigate our site so we can improve site experience and performance. Approved third parties may perform analytics on our behalf, but they cannot use the data for their own purposes.

Allowed

### Functional

Functional cookies help us provide useful site features, remember your preferences, and display relevant content. Approved third parties may set these cookies to provide certain site features. If you do not allow these cookies, then some or all of these services may not function properly.

Allowed

### Advertising

Advertising cookies may be set through our site by us or our advertising partners and help us deliver relevant marketing content. If you do not allow these cookies, you will experience less relevant advertising.

Allowed

Blocking some types of cookies may impact your experience of our sites. You may review and change your choices at any time by selecting Cookie preferences in the footer of this site. We and selected third-parties use cookies or similar technologies as specified in the [AWS Cookie Notice](https://aws.amazon.com/legal/cookies/).

CancelSave preferences

## Your privacy choices

We and our advertising partners (“we”) may use information we collect from or about you to show you ads on other websites and online services. Under certain laws, this activity is referred to as “cross-context behavioral advertising” or “targeted advertising.”

To opt out of our use of cookies or similar technologies to engage in these activities, select “Opt out of cross-context behavioral ads” and “Save preferences” below. If you clear your browser cookies or visit this site from a different device or browser, you will need to make your selection again. For more information about cookies and how we use them, read our [Cookie Notice](https://aws.amazon.com/legal/cookies/).

Allow cross-context behavioral adsOpt out of cross-context behavioral ads

To opt out of the use of other identifiers, such as contact information, for these activities, fill out the form [here](https://pulse.aws/application/ZRPLWLL6?p=0).

For more information about how AWS handles your information, read the [AWS Privacy Notice](https://aws.amazon.com/privacy/).

CancelSave preferences

## Unable to save cookie preferences

We will only store essential cookies at this time, because we were unable to save your cookie preferences.

If you want to change your cookie preferences, try again later using the link in the AWS console footer, or contact support if the problem persists.

Dismiss

# Amazon Bedrock abuse detection

[PDF](https://docs.aws.amazon.com/pdfs/bedrock/latest/userguide/bedrock-ug.pdf#abuse-detection)

[RSS](https://docs.aws.amazon.com/bedrock/latest/userguide/bedrock-ug.rss)

[Markdown](https://docs.aws.amazon.com/bedrock/latest/userguide/abuse-detection.md "Download Markdown")

Agent SetupUp-to-date AWS docs, tested procedures, and IAM guardrails via a single setup prompt in your AI coding agent.

Focus mode

Amazon Bedrock abuse detection - Amazon Bedrock

[Open PDF](https://docs.aws.amazon.com/pdfs/bedrock/latest/userguide/bedrock-ug.pdf#abuse-detection "Open PDF")

As part of providing the Service, Amazon Bedrock may use automated abuse detection mechanisms
to detect activity that violates our, or third-party model providers', terms of service
or use policies.

Amazon Bedrock uses a zero operator access (ZOA) data security model. This means no operators
of the service can access model input or output. Also, Amazon Bedrock uses a zero data retention
(ZDR) data security model. This means that by default, Amazon Bedrock does not store model inputs
or outputs.

However, for specific abuse detection purposes related to the following models, we may be
required to store inputs and outputs:

- For OpenAI GPT-6 Astra, GPT-5.4, GPT-5.5, GPT-5.6 Sol, GPT-5.6 Terra, GPT-5.6 Luna, Daybreak Red: GPT-5.6 Cyber, and Daybreak Blue: GPT-5.6 Sol, classifier-flagged traffic will be retained for up to 30
days for automated offline abuse detection. Eligible customers may request full ZDR
through their AWS account team.

- For Anthropic Claude Fable 5 and Claude Fable 5.1, all traffic will be retained
for up to 30 days for automated offline abuse detection. Classifier-flagged traffic
will be subject to potential human review performed by AWS.



  - Customers that are eligible for the Enterprise Frontier Safeguards
     program will receive ZDR through December 31, 2026. After ZDR ends, all
     traffic will be retained for up to 30 days for automated offline abuse
     detection. The Enterprise Frontier Safeguards program plans to enable
     customer-managed encryption keys and bring your own bucket for storage for
     automated offline abuse detection.


Retained inputs and outputs are stored and processed by AWS and are not shared with third-party model providers. If cross-region inference is enabled for these models, retained inputs and outputs are stored in destination regions (i.e., the region where your inference request is processed).

You are responsible for the content you (and your end users) upload to Amazon Bedrock. To help
stop the dissemination of child sexual abuse material ("CSAM"), Amazon Bedrock may use
automated abuse detection mechanisms (such as hash matching technology or classifiers) to
detect apparent CSAM. If Amazon Bedrock detects apparent CSAM in your image inputs, Amazon Bedrock will
block the request and return a `ValidationException` (HTTP 400) error in the API
response. Amazon Bedrock may store and review the flagged input or output exclusively to determine
if it is CSAM and may also file a report with the National Center for Missing and Exploited
Children (NCMEC) or a relevant authority. We take CSAM seriously and will continue to review
our detection, blocking, and reporting mechanisms. You might be required by applicable laws
to take additional actions, and you are responsible for those actions.

If an abuse detection mechanism identifies potential violations, we may request
information about your use of Amazon Bedrock and compliance with relevant terms and policies.
These requests are sent to the email address associated with your AWS account, so ensure
that your account contact information is current and monitored. AWS may suspend your
access to any model or Amazon Bedrock if you fail to comply with applicable terms or policies or
are non-responsive.

Contact your AWS account team or AWS Support if you have additional
questions.

[Document Conventions](https://docs.aws.amazon.com/general/latest/gr/docconventions.html)

Configuration and vulnerability analysis in Amazon Bedrock

Prompt injection security

Did this page help you? - Yes

Thanks for letting us know we're doing a good job!

If you've got a moment, please tell us what we did right so we can do more of it.

Did this page help you? - No

Thanks for letting us know this page needs work. We're sorry we let you down.

If you've got a moment, please tell us how we can make the documentation better.

### View related pages

Abstracts generated by AI

- 1
- 2
- 3
- 4

Nova › userguide
[Deployment of Amazon Nova Forge Models in Amazon SageMaker Inference abuse detection![](https://prod.us-west-2.tcx-beacon.docs.aws.dev/recommendation-beacon/similar/impressions/null/avsWYrP5gVW2drhWbg597Ksi9v0qvMReK_jncrjSgntlrl8-rHlu2A==/https:%7C%7Cdocs.aws.amazon.com%7Cbedrock%7Clatest%7Cuserguide%7Cabuse-detection.html/https:%7C%7Cdocs.aws.amazon.com%7Cnova%7Clatest%7Cuserguide%7Cnova-sagemaker-inference-abuse-detection.html)](https://docs.aws.amazon.com/nova/latest/userguide/nova-sagemaker-inference-abuse-detection.html)
Learn about automated abuse detection mechanisms for Amazon Nova Forge models on Amazon SageMaker Inference, including content classification, pattern identification, and CSAM detection policies.

_February 24, 2026_

Bedrock › userguide
[Code domain support![](https://prod.us-west-2.tcx-beacon.docs.aws.dev/recommendation-beacon/similar/impressions/null/avsWYrP5gVW2drhWbg597Ksi9v0qvMReK_jncrjSgntlrl8-rHlu2A==/https:%7C%7Cdocs.aws.amazon.com%7Cbedrock%7Clatest%7Cuserguide%7Cabuse-detection.html/https:%7C%7Cdocs.aws.amazon.com%7Cbedrock%7Clatest%7Cuserguide%7Cguardrails-code-domain.html)](https://docs.aws.amazon.com/bedrock/latest/userguide/guardrails-code-domain.html)
Learn about Amazon Bedrock Guardrails code domain support, including detection of harmful content in natural language, code, and hybrid inputs across content filters, denied topics, and sensitive information policies.

_November 19, 2025_

Bedrock › userguide
[Detect and filter harmful content by using Amazon Bedrock Guardrails![](https://prod.us-west-2.tcx-beacon.docs.aws.dev/recommendation-beacon/similar/impressions/null/avsWYrP5gVW2drhWbg597Ksi9v0qvMReK_jncrjSgntlrl8-rHlu2A==/https:%7C%7Cdocs.aws.amazon.com%7Cbedrock%7Clatest%7Cuserguide%7Cabuse-detection.html/https:%7C%7Cdocs.aws.amazon.com%7Cbedrock%7Clatest%7Cuserguide%7Cguardrails.html)](https://docs.aws.amazon.com/bedrock/latest/userguide/guardrails.html)
Learn about Amazon Bedrock Guardrails, a service offering configurable safeguards including content filters, denied topics, word filters, PII protection, and contextual grounding checks for safe generative AI applications.

_April 23, 2024_

- ### Related resources





[Amazon Bedrock API Reference](https://docs.aws.amazon.com/bedrock/latest/APIReference/index.html)



[AWS CLI commands for Amazon Bedrock](https://docs.aws.amazon.com/cli/latest/reference/bedrock/)



[SDKs & Tools](https://aws.amazon.com/tools/)

- Recommended tasks






















### Learn about

















[AWS shared responsibility for data protection in Amazon…![](https://prod.us-west-2.tcx-beacon.docs.aws.dev/recommendation-beacon/journey/impressions/null/avsWYrP5gVW2drhWbg597Ksi9v0qvMReK_jncrjSgntlrl8-rHlu2A==/https:%7C%7Cdocs.aws.amazon.com%7Cbedrock%7Clatest%7Cuserguide%7Cabuse-detection.html/https:%7C%7Cdocs.aws.amazon.com%7Cbedrock%7Clatest%7Cuserguide%7Cdata-protection.html)](https://docs.aws.amazon.com/bedrock/latest/userguide/data-protection.html)



[protecting against prompt injection in Amazon Bedrock![](https://prod.us-west-2.tcx-beacon.docs.aws.dev/recommendation-beacon/journey/impressions/null/avsWYrP5gVW2drhWbg597Ksi9v0qvMReK_jncrjSgntlrl8-rHlu2A==/https:%7C%7Cdocs.aws.amazon.com%7Cbedrock%7Clatest%7Cuserguide%7Cabuse-detection.html/https:%7C%7Cdocs.aws.amazon.com%7Cbedrock%7Clatest%7Cuserguide%7Cprompt-injection.html)](https://docs.aws.amazon.com/bedrock/latest/userguide/prompt-injection.html)



[Understand AWS Organizations AI opt-out policies![](https://prod.us-west-2.tcx-beacon.docs.aws.dev/recommendation-beacon/journey/impressions/null/avsWYrP5gVW2drhWbg597Ksi9v0qvMReK_jncrjSgntlrl8-rHlu2A==/https:%7C%7Cdocs.aws.amazon.com%7Cbedrock%7Clatest%7Cuserguide%7Cabuse-detection.html/https:%7C%7Cdocs.aws.amazon.com%7Corganizations%7Clatest%7Cuserguide%7Corgs_manage_policies_ai-opt-out.html)](https://docs.aws.amazon.com/organizations/latest/userguide/orgs_manage_policies_ai-opt-out.html)



[Amazon Bedrock service endpoint and quota details![](https://prod.us-west-2.tcx-beacon.docs.aws.dev/recommendation-beacon/journey/impressions/null/avsWYrP5gVW2drhWbg597Ksi9v0qvMReK_jncrjSgntlrl8-rHlu2A==/https:%7C%7Cdocs.aws.amazon.com%7Cbedrock%7Clatest%7Cuserguide%7Cabuse-detection.html/https:%7C%7Cdocs.aws.amazon.com%7Cgeneral%7Clatest%7Cgr%7Cbedrock.html)](https://docs.aws.amazon.com/general/latest/gr/bedrock.html)

























### How to

















[configure Amazon Bedrock data retention settings![](https://prod.us-west-2.tcx-beacon.docs.aws.dev/recommendation-beacon/journey/impressions/null/avsWYrP5gVW2drhWbg597Ksi9v0qvMReK_jncrjSgntlrl8-rHlu2A==/https:%7C%7Cdocs.aws.amazon.com%7Cbedrock%7Clatest%7Cuserguide%7Cabuse-detection.html/https:%7C%7Cdocs.aws.amazon.com%7Cbedrock%7Clatest%7Cuserguide%7Cdata-retention.html)](https://docs.aws.amazon.com/bedrock/latest/userguide/data-retention.html)

- Recently added to this guide












  - [IAM permissions for user-managed setup (3LO)![](https://prod.us-west-2.tcx-beacon.docs.aws.dev/recommendation-beacon/new/impressions/null/avsWYrP5gVW2drhWbg597Ksi9v0qvMReK_jncrjSgntlrl8-rHlu2A==/https:%7C%7Cdocs.aws.amazon.com%7Cbedrock%7Clatest%7Cuserguide%7Cabuse-detection.html/https:%7C%7Cdocs.aws.amazon.com%7Cbedrock%7Clatest%7Cuserguide%7Ckb-managed-3lo-setup.html)](https://docs.aws.amazon.com/bedrock/latest/userguide/kb-managed-3lo-setup.html)



    _August 26, 2026_

  - [Connect a ServiceNow data source![](https://prod.us-west-2.tcx-beacon.docs.aws.dev/recommendation-beacon/new/impressions/null/avsWYrP5gVW2drhWbg597Ksi9v0qvMReK_jncrjSgntlrl8-rHlu2A==/https:%7C%7Cdocs.aws.amazon.com%7Cbedrock%7Clatest%7Cuserguide%7Cabuse-detection.html/https:%7C%7Cdocs.aws.amazon.com%7Cbedrock%7Clatest%7Cuserguide%7Ckb-managed-ds-servicenow-connect.html)](https://docs.aws.amazon.com/bedrock/latest/userguide/kb-managed-ds-servicenow-connect.html)



    _August 21, 2026_

  - [Troubleshoot a ServiceNow data source![](https://prod.us-west-2.tcx-beacon.docs.aws.dev/recommendation-beacon/new/impressions/null/avsWYrP5gVW2drhWbg597Ksi9v0qvMReK_jncrjSgntlrl8-rHlu2A==/https:%7C%7Cdocs.aws.amazon.com%7Cbedrock%7Clatest%7Cuserguide%7Cabuse-detection.html/https:%7C%7Cdocs.aws.amazon.com%7Cbedrock%7Clatest%7Cuserguide%7Ckb-managed-ds-servicenow-troubleshooting.html)](https://docs.aws.amazon.com/bedrock/latest/userguide/kb-managed-ds-servicenow-troubleshooting.html)



    _August 21, 2026_

  - View all


- Did this page help you?








Yes



No













[Provide feedback](https://docs.aws.amazon.com/feedback/doc-feedback.html?hidden_service_name=Bedrock&topic_url=https%3A%2F%2Fdocs.aws.amazon.com%2Fbedrock%2Flatest%2Fuserguide%2Fabuse-detection.html)


#### Next topic:

[Prompt injection security](https://docs.aws.amazon.com/bedrock/latest/userguide/prompt-injection.html)

#### Previous topic:

[Configuration and vulnerability analysis in Amazon Bedrock](https://docs.aws.amazon.com/bedrock/latest/userguide/vulnerability-analysis-and-management.html)