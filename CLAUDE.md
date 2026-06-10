# CLAUDE.md — Salesforce Portfolio Site

Public portfolio/resume website hosted on a personal Salesforce Developer Edition org.
Everything renders from records — content updates happen by editing records, never code.

## Org & repo

- **Alias**: `portfolio` | **Org**: `chap-dev-ed.my.salesforce.com` (Developer Edition, API 66.0)
- **GitHub**: https://github.com/bv-chaitanya/salesforce-portfolio-site (public, personal account).
  The remote URL embeds `bv-chaitanya@` so pushes use the personal token even though the
  machine's active `gh` account is the work one (`rax-chaitu`) — don't "fix" the remote URL.
- Deploy directly (no scratch orgs): `sf project deploy start -o portfolio`
- Run tests: `sf apex run test -o portfolio -l RunLocalTests -w 10 -r human -c`
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
   skills, certifications, education, awards). Custom mobile-first CSS, no SLDS utility
   classes (LWR doesn't load full SLDS), no external JS. Rich text renders via
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
- [ ] Phase 4 — guest access config (needs site to exist first — see decision 5)
- [ ] Phase 5 — data load (parsed content review → anonymous Apex insert)
- [ ] Phase 6 — manual site creation + page composition checklist

## Conventions

- Placeholders only in code/tests — no real personal data, org IDs, or credentials.
- New content section = new object (follow the conventions above) + DTO + controller
  method + LWC + guest sharing rule + permset entries.
