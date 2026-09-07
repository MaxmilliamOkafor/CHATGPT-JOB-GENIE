# Job Genie 3.4.1

Chrome extension for tailoring CVs and cover letters, reviewing keyword coverage, and filling application fields from a candidate profile.

## Install for testing

1. Clone this repository.
2. Open `chrome://extensions`, enable Developer mode, and choose **Load unpacked**.
3. Select the repository root (the folder containing `manifest.json`).
4. Sign in to the configured profile service, review your profile, and choose automation settings.
5. Open a job posting, tailor your documents, and review all facts before applying.

## Changes in this release

- Consistent Job Genie branding, restrained colors, readable spacing, collapsible automation preferences, keyboard focus, and reduced-motion support.
- Restored missing packaged icons and shortened the extension description.
- Replaced references to an absent vendor autofill bundle with the included local profile engine. This autofill path makes no AI calls, handles newly rendered controls, and runs in permitted frames.
- Removed guessed personal screening answers and made automatic submission/follow-up opt-in by default. Existing explicit preferences are preserved.
- Dropdown matching avoids ambiguous partial options. Unmatched combobox searches no longer count as completed selections.
- Keyword coverage rejects substring false positives and handles C++, C#, .NET, duplicate keywords, and line-wrapped phrases.
- Structured job extraction no longer combines fields from separate incomplete job postings.
- Stripe's current `/careers/` paths are included.

## Hiring contact lookup

Published addresses are filtered using nearby job/recruiting context. Accommodation and technical-support inboxes are excluded. Recipient names are tied to the selected address rather than an unrelated name elsewhere in the posting.

Configure an existing Hunter or Apollo account in preferences for optional business-contact enrichment. Apollo now searches people and resolves up to two IDs through its enrichment endpoint; provider costs and account permissions apply. The extension can work with these APIs directly; installing a ChatGPT plugin does not supply an API credential to the extension. No provider can guarantee a contact for every listing or identify the assigned hiring manager without evidence. Review suggestions before sending.

Provider references: https://hunter.io/api-documentation and https://docs.apollo.io/reference/people-enrichment

## Compatibility and test scope

Run `node --test tests/*.test.cjs` and `node scripts/check-release.cjs --strict` with Node 22 or later. No dependency installation is needed for these checks.

See [VALIDATION.md](VALIDATION.md) for the exact automated and live inspection coverage. Registered host detection is not proof that all forms on a platform work. Employer custom questions, sign-in, CAPTCHA, closed shadow DOM, file-upload policies, and site updates can require manual completion.

Keyword coverage is an internal text comparison, not a vendor ATS ranking, a hiring probability, or a guarantee of interviews. Only include skills and accomplishments supported by your experience. Follow each employer's file instructions and verify the final exported document and form fields.

## Gmail and data

The invalid placeholder OAuth client was removed. Optional Gmail API sending requires the user's OAuth configuration in preferences; **Open in Gmail** provides a manual review/send alternative. See [GMAIL_SETUP.md](GMAIL_SETUP.md).

The extension uses local storage for preferences/profile data and includes connections to a profile service, configured AI providers, contact-enrichment providers, and optional Gmail features. API keys in extension storage are not a secure server-side secret vault. Publish a privacy policy that accurately describes the enabled services and their data flows before distribution.

## Release status

This branch is a release candidate, not a claim of store approval or universal ATS certification. Before public deployment:

- Complete a loaded-extension smoke test with the real profile service and configured AI provider.
- Visually review the popup, expanded preferences, document previews, and error states.
- Validate PDF/DOCX text extraction and actual resume upload on authorized employer test forms.
- Verify the master toggle cancels in-flight autofill and test multi-step navigation in Chrome.
- Review broad host permissions, authentication, external data flows, privacy policy, and store disclosures.

Chrome manifest reference: https://developer.chrome.com/docs/extensions/reference/manifest/description
Greenhouse parsing guidance: https://support.greenhouse.io/hc/en-us/articles/200989175-Unsuccessful-resume-parse
