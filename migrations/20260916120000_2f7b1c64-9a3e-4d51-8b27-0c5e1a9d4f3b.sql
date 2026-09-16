-- KEYWORDS THE OWNER HAS DECIDED NOT TO CARRY.
--
-- The extension used to hold these in chrome.storage.local, which dies
-- with the extension: uninstall it, switch machine, or let Chrome clear
-- site data, and every standing decision is gone. They belong on the
-- account.
--
-- Shape, held as jsonb so a synonym group can travel with its entry:
--   [{ "id": "<taxonomy key>", "term": "Salesforce",
--      "covers": ["Salesforce", "SFDC"], "note": "", "at": "<iso8601>" }]
--
-- Existing RLS on public.profiles already restricts a row to its owner,
-- so no new policy is needed; this column is read and written through
-- the same self-scoped select and update as the rest of the profile.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS excluded_keywords jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.profiles.excluded_keywords IS
  'Keywords the user never wants tailored into a CV, as [{id, term, covers, note, at}].';
