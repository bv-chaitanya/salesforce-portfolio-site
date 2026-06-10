# Portfolio Site — Design Spec (2026-06-10)

## Goal

Public, data-driven portfolio/resume site on a personal Developer Edition org
(`chap-dev-ed`, alias `portfolio`). Experience Cloud LWR site with guest access.
All content from records; updating the portfolio = editing records.

## Source analysis

Schema derived from 3 resume versions (2026 v2 PERSONAL — newest, wins conflicts;
2026 v1; Sep 2024). Content types found: profile/contact, professional summary,
8 skill categories, 4 jobs, 12 nested projects (with clients, impact metrics,
tech stacks), 2 certifications, 1 education entry, 1 award.

## Data model (7 objects)

Every object: `Display_Order__c` (Number 4,0) + `Is_Active__c` (Checkbox, default TRUE).
Internal sharing ReadWrite, external Private (guest access only via sharing rules).

| Object | Name field | Custom fields |
|---|---|---|
| `Portfolio_Profile__c` | Full Name | Headline (Text 255), Summary (RichText), Email, Phone, Location (Text 120), LinkedIn_URL (URL), Photo_URL (URL) |
| `Experience__c` | Job Title | Company (120), Location (120), Start_Date, End_Date, Is_Current |
| `Project__c` | Project Name | Job (Lookup→Experience, rel `Projects`), Client (120), Description (RichText), Tech_Stack (255, `;`-delim), Impact (255), Project_URL (URL) |
| `Skill_Group__c` | Category | Skills (LongText, `;`-delimited) |
| `Certification__c` | Certification Name | Issuer (120), Status (40), Credential_URL (URL) |
| `Education__c` | Degree | Institution (150), Location (120) |
| `Award__c` | Award Title | Year (10), Description (255) |

Rejected alternatives: per-skill records (55+ records, category-order plumbing);
merged Credential object with Type picklist (worse editing UX).

## Apex

`PortfolioController` — `with sharing`, all methods `@AuraEnabled(cacheable=true)`,
typed inner DTO classes, active-only + Display_Order ordering, no SOQL in loops,
null-safe (null profile / empty lists). Projects fetched via parent-child subquery.
**Phone is never queried** — privacy by design on a public site.
`PortfolioControllerTest` covers filtering, ordering, nesting, delimiter parsing,
blank/empty paths.

## LWC (one per section)

`portfolioHero`, `portfolioExperience` (timeline, nested project cards),
`portfolioSkills` (chip grid), `portfolioCertifications`, `portfolioEducation`,
`portfolioAwards`. All exposed to `lightningCommunity__Page` + `__Default`.
Mobile-first custom CSS (shared palette tokens per component), no SLDS utilities,
no external libraries. States: loading / ready / empty / error. Hero photo = plain
`<img>` + `onerror` fallback to initials.

## Guest access (Phase 4 — after site creation)

- Guest profile: object Read ×7, FLS Read on rendered fields, `PortfolioController` access.
- Criteria-based guest sharing rules ×7: `Is_Active__c = TRUE` → Read.
- Constraint: guest user/profile exists only once the LWR site is created → site
  creation precedes Phase 4 deploy.

## Data load (Phase 5)

Parsed resume content presented for review first, then anonymous Apex insert
(ordered: Experience before Project for lookups). Phone seeded into the record
(harmless — never rendered); user may leave it blank instead.

## Out of scope

Custom domain (not practical on Dev Edition), SEO optimization, contact form,
multi-language. Site creation/page composition is manual (Phase 6 checklist).
