# CLAUDE.md — Salesforce Portfolio Site

Public portfolio/resume website hosted on a personal Salesforce Developer Edition org.
Everything renders from records — content updates happen by editing records, never code.

## Org & repo

- **Alias**: `portfolio` | **Org**: `chap-dev-ed.my.salesforce.com` (Developer Edition, API 66.0)
- **GitHub**: https://github.com/bv-chaitanya/salesforce-portfolio-site (public, personal account).
  This machine's active `gh` account is the work one (`rax-chaitu`), so this repo has a
  **repo-local** `credential.helper` that pulls the personal token via
  `gh auth token -u bv-chaitanya` (see `.git/config`). Don't "fix" the remote URL or the
  helper, and don't `gh auth logout bv-chaitanya` — pushes here depend on it.
- Deploy directly (no scratch orgs): `sf project deploy start -o portfolio`
- Run tests: `sf apex run test -o portfolio -l RunLocalTests -w 10 -r human -c`
- Lint LWC (official Salesforce config): `npm run lint` — keep at 0 problems; the only
  suppressions allowed are the documented `no-document-query`/`no-async-operation` ones
  in `portfolioNav` (cross-component page coordination).
- Target site: Experience Cloud **LWR** ("Build Your Own (LWR)" template), public guest access

## Architecture decisions

1. **Schema derived from resume analysis** (3 versions in `resumes/`, gitignored — they
   contain personal contact details). 7 objects, all with `Display_Order__c` (Number) and
   `Is_Active__c` (Checkbox, default TRUE) driving ordering + guest sharing rule criteria:
   - `Portfolio_Profile__c` — hero/identity (singleton). `Photo_URL__c` renders via plain
     `<img>` with initials fallback on empty/broken URL.
   - `Experience__c` — jobs. Blank `End_Date__c` or `Is_Current__c` renders "Present".
   - `Project__c` — child of Experience via `Job__c` lookup (rel name `Projects`).
   - `Skill_Group__c` — one record per category; `Skills__c` is a **semicolon-delimited**
     list rendered as chips (same delimiter convention for `Project__c.Tech_Stack__c`).
   - `Certification__c`, `Education__c`, `Award__c` — simple lists.
2. **Privacy**: `Phone__c` exists on the profile object but is *never queried or exposed*
   by `PortfolioController` — the site is public. Email + LinkedIn are rendered.
3. **Apex**: single `PortfolioController` (`with sharing`, cacheable methods, typed inner
   DTOs). Record visibility for guests comes from criteria-based guest sharing rules;
   FLS comes from the guest profile. Skill splitting happens in Apex, not JS.
4. **LWC**: one component per section (hero, experience timeline w/ nested projects,
   skills, certifications, education, awards), composed as a tabbed 360 view:
   `portfolio360` renders the sections as panels (hash deep links #experience etc.,
   passes `hide-title` to children), and `portfolioNav` — the floating liquid-glass
   bottom dock — is the single nav: it dispatches `portfolio360navigate` window events
   to switch tabs, scrolls to hero for About, and shows a name chip once the hero name
   scrolls away. `portfolioAdmin` (+ `PortfolioAdminController`, FlexiPage
   `Portfolio_Admin`, tab "Portfolio Admin") is the internal content manager: per-object
   datatables, inline edit incl. Is_Active toggle, delete, create. Never grant
   PortfolioAdminController to the guest profile. Liquid-glass design system: gradient mesh page background (site styles.css),
   translucent cards (rgba white + inset highlight — backdrop-filter only on the dock and
   hero summary for performance), custom mobile-first CSS, no SLDS utilities, no external JS. Rich text renders via
   `lightning-formatted-rich-text` (LWR-supported base component). Every component has
   loading/empty/error states.
5. **Guest access** (Phase 4): the site guest user profile + guest sharing rules can only
   be deployed **after** the Experience site exists (the guest user is created with the
   site). Order: deploy code → create site manually → deploy guest profile + sharing
   rules (`Is_Active__c = TRUE → Read` per object).
6. `Portfolio_Admin` permission set grants the admin user object/field access + tabs for
   record editing in the org UI. Assign once:
   `sf org assign permset -n Portfolio_Admin -o portfolio`

## Phase status

- [x] Phase 1 — resume analysis + schema approved
- [x] Phase 2 — objects, Apex, tests (deployed 2026-06-10; 16/16 pass, controller 100% coverage)
- [x] Phase 3 — LWCs (deployed)
- [x] Phase 4 — guest access config (deployed 2026-06-10: guest profile read-only perms, no Phone FLS, 7 guest sharing rules `Is_Active__c=TRUE → Read`, site name `Portfolio`)
- [x] Phase 5 — data loaded 2026-06-10 via anonymous Apex (script kept out of repo — real contact data). Content edits now happen via object tabs in the org.
- [x] Phase 6 — site `Portfolio` created manually; page composition done AS CODE via DigitalExperienceBundle (home view JSON = 6 stacked components), Home route `pageAccess: Public`, theme header region emptied + footer hidden (kills default grey strip), branding `BackgroundColor #f6f8fb`, `<title>` set in mainAppPage. Publish with: `sf community publish --name Portfolio -o portfolio`. Live: https://chap-dev-ed.my.site.com/  — pending: Photo_URL__c on the profile record.

## Conventions

- Placeholders only in code/tests — no real personal data, org IDs, or credentials.
- New content section = new object (follow the conventions above) + DTO + controller
  method + LWC + guest sharing rule + permset entries.
