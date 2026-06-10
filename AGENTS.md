# AGENTS.md

**Read `CLAUDE.md` first — it is the single source of truth for this repo** (org/auth
setup, commands, architecture, workflows, and a "hard-won gotchas" list that will save
you hours). This file exists so non-Claude tools (Codex, Kiro, Cursor, etc.) get the
same context.

Non-negotiables for any agent working here:

1. Org alias is `portfolio` (personal Dev Edition). Deploy with
   `sf project deploy start -o portfolio`; after touching anything under
   `force-app/main/default/digitalExperiences/`, also run
   `sf community publish --name Portfolio -o portfolio`.
2. Quality gates before pushing: `npm run lint` (0 problems), `npm run test:unit`
   (Jest), `sf apex run test -o portfolio -l RunLocalTests -w 10 -r human -c`.
3. Git pushes use a repo-local credential helper for the personal GitHub account
   (`bv-chaitanya`). Do not change the remote URL, the credential helper, or the
   machine's global `gh` account.
4. Never expose `Phone__c` or `PortfolioAdminController` to the public site / guest
   profile. The public read surface is `PortfolioController` only.
5. Global page CSS lives inline in mainAppPage `headMarkup` — the site stylesheet
   reference does not resolve on the published site (gotcha #1 in CLAUDE.md).
6. No real personal data, org IDs, or credentials in code or tests; `resumes/` stays
   gitignored.
