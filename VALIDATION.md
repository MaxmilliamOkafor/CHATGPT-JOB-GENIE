# Validation record — 2026-09-07

## Automated checks

- 53 Node tests pass.
- 33 registry entries tested for host resolution and fallback selector availability. This checks registry logic, not live DOM compatibility.
- Regression tests cover JSON-LD recovery, cross-posting field mixing, keyword false positives, punctuated technical terms, duplicate keywords, explicit screening answers, no residence-to-authorization inference, phone-prefix handling, and opt-in submission/email defaults.
- Manifest/resource checks validate 69 packaged entry-point resources and JavaScript syntax. Store description length passes. Missing icons are restored; missing vendor bundle references are removed. Placeholder Gmail OAuth is removed, with a clear configuration error for unconfigured API sending.
- `git diff --check` passes.

## Live browser inspections

These are read-only form inspections, NOT end-to-end extension/autofill or resume parsing passes. No personal data was entered, files uploaded, accounts created, or applications submitted.

| Employer / platform | Observed result | Remaining test |
| --- | --- | --- |
| Warp / Greenhouse | Software Engineer posting rendered. `.job__description.body` contained 7,422 characters. Application exposes name, email, phone, resume upload, required custom questions and optional demographic fields. Many mandatory fields use `aria-required`, not native `required`. | Execute the extension on an authorized test application; verify custom combobox selections and upload text extraction. |
| Stripe / custom careers + Greenhouse iframe | AI Engineer posting rendered with requirements. Apply page embeds the Greenhouse form, including required location/school/degree comboboxes, country checkboxes, authorization/sponsorship questions, resume and cover-letter controls. This prompted `/careers/` matching and all-frame autofill injection fixes. | Verify injected execution and dropdown completion in the embedded frame; validate CV parsing after upload. |
| NVIDIA / Workday | Senior Software Test Development Engineer posting rendered. Apply opens choices for resume autofill/manual application. Resume autofill leads to a six-step flow, with sign-in before upload. | Authenticated upload, populated field comparison, multi-step continuation and final review remain untested. |

Inspected posting URLs:
- https://job-boards.greenhouse.io/warp/jobs/4324888004
- https://stripe.com/careers/listing/ai-engineer/8044460
- https://nvidia.wd5.myworkdayjobs.com/en-US/NVIDIAExternalCareerSite/job/Senior-Software-Test-Development-Engineer_JR2012897

## Coverage limitations / release gates

The browser security policy blocked local and self-contained popup preview navigation. Visual QA did not pass; it was not completed. No workaround was attempted after the explicit policy denial.

The extension was not loaded into the live browser. Real AI tailoring, profile authentication, actual PDF/DOCX rendering and extraction, uploads, React-controlled field state, delayed dropdowns, cancellation while filling, and repeated dynamic-page transitions require an authorized browser smoke test. A click on a custom option is still only a best-effort action; it is not proof of backend acceptance.

The missing proprietary vendor bundle was replaced with local profile autofill. Vendor AI sidebar behavior and proprietary answer generation are not reproduced. Unknown personal facts are deliberately left for review. The shared engine powers the separate LinkedIn/Indeed helpers too, so their existing flows require regression smoke tests.

Other employers and ATS installations have not been tested live in this change. No claim of universal parsing, universal autofill, top-1% ranking, or guaranteed callbacks is supported by these checks.

Personal signature and portfolio literals were removed from the changed follow-up/popup code; follow-up signatures now use candidate-profile tokens.

## Contact extraction and enrichment

Six additional tests cover purpose-specific inbox rejection, recruiting-context selection, name/address association, own-email exclusion, mailto context, and the Apollo search-to-enrichment request/response contract. All addresses in these fixtures use reserved `.invalid` domains. Apollo lookup was checked against official documentation; no paid provider request was made and real credential/credit behavior remains untested. Suggestions require recipient review before automatic follow-up.
