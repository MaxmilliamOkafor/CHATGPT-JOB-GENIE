# Validation record — 2026-09-07

## Automated checks

- 63 Node tests pass.
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

## Second hardening pass

- Connected popup scoring to DynamicScore (the earlier popup method still used substring matching).
- Removed automatic score-targeted keyword injection and qualification-gap stuffing from the popup pipeline. Missing requirements remain review items.
- Candidate header location now comes from the saved profile, not the employer's location.
- Added actual popup-method regression tests via an isolated VM.
- Added autofill lifecycle tests for disabled state, cancellation during profile loading, concurrent runs, password-page exclusion and rescanning new controls during an active pass.
- DOCX exports pass ZIP CRC, XML parsing, selectable text preservation (technical punctuation and Unicode), no-layout-table/no-textbox checks, and preservation of the last paragraph in a long fixture. These checks do not prove visual rendering or vendor ATS parsing.

The extension has still not been installed into the managed browser. Existing browser-policy restrictions and authenticated upload/API gates remain unresolved. This is not a deployment certification.

## Popup readability pass

Added a dedicated final stylesheet with a 480px popup, 14px body text, 13px help text, 44px minimum controls, 50px primary action, opaque input backgrounds, readable placeholders, and explicit status colors. Calculated contrast for the selected body, muted, button, placeholder and status text pairs ranges from 8.82:1 to 13.98:1. These are palette calculations, not a full rendered accessibility audit. The manifest/resource check now covers 70 entry-point resources. The managed browser's visual-review limitation remains.

## Popup and export follow-up (September 8, 2026)

70 automated tests pass. Packaged-resource and syntax checks cover 71 resources.
The actual gauge method now derives coverage from matched/total counts: 8/19 displays 42%, and 0/0 is unmeasured. Earlier scoring tests did not exercise the gauge and therefore missed its hardcoded success display.

The popup is 600px wide with four task views, violet/teal actions, and an explicit screening-answer editor. Settings and diagnostics no longer precede the main action. Browser preview was attempted again and blocked with ERR_BLOCKED_BY_CLIENT; navigation and loaded-extension interaction remain manual release gates.

Autofill now discovers button-based listboxes and multiple ARIA-owned listboxes. It requires committed selection evidence and checks native select values after events. A mocked dropdown regression verifies that clicking alone does not count as success. This is not live Greenhouse or Workday validation.

DOCX formatting no longer adds phone digits, removes repeated contact location components, and strips XML-invalid controls. Failed/missing DOCX rebuilds clear old artifacts. Added cover-letter text-preservation tests. The user-supplied CV and cover letter were rendered for inspection; those files show duplicated location components and the cover letter contains an awkward phrase. The generated text still requires candidate review. No new employer upload was performed, and PDF/preview parity remains unverified.

LOVABLE_UPDATE_PROMPT.md contains the requested implementation prompt. It does not mean the Lovable app itself has been updated. The extension remains a draft release candidate.
