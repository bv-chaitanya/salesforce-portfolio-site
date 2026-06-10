# CLAUDE.md — Salesforce Portfolio Site

Public portfolio/resume website on a personal Salesforce Developer Edition org.
Everything renders from records — content updates happen by editing records (via the
Portfolio Admin page), never code. Live: https://chap-dev-ed.my.site.com/

## Org, repo, auth

- **Org alias**: `portfolio` → `chap-dev-ed.my.salesforce.com` (Developer Edition, API 66.0).
  Deploy directly — no scratch orgs, no sandboxes. Log into the org at least monthly or
  Salesforce deactivates inactive Dev Editions (site dies with it).
- **GitHub**: https://github.com/bv-chaitanya/salesforce-portfolio-site (public, personal).
  This machine's active `gh` account is the work one (`rax-chaitu`); this repo has a
  **repo-local** `credential.helper` that pulls the personal token via
  `gh auth token -u bv-chaitanya` (see `.git/config`). Don't "fix" the remote URL or the
  helper, don't `gh auth logout bv-chaitanya`, don't `gh auth switch` globally.
- `resumes/` is gitignored (real contact details). The seed script was never committed
  for the same reason — content now lives in org records only.

## Commands

```bash
sf project deploy start -o portfolio                  # deploy (whole project is safe)
sf apex run test -o portfolio -l RunLocalTests -w 10 -r human -c
npm run test:unit                                     # LWC Jest (24 tests: nav/360/hero/experience/skills)
npm run lint                                          # official @salesforce/eslint-config-lwc — keep at 0
sf community publish --name Portfolio -o portfolio    # REQUIRED after any digitalExperiences change
```

Quality gates before pushing: lint 0 problems · Jest green · Apex tests green (both
controllers at 100% coverage). Only allowed lint suppressions: the documented
`no-document-query`/`no-async-operation` ones in `portfolioNav` (page-level coordination).

## Architecture

**Data (7 custom objects)** — all have `Display_Order__c` (Number) + `Is_Active__c`
(Checkbox, default TRUE; drives ordering and guest sharing rules). **Multi-profile**:
`Portfolio_Profile__c` is the parent persona; Experience/Skill_Group/Certification/
Education/Award each have a `Profile__c` lookup (Projects inherit via their Job).
Records with a blank Profile__c never render publicly — always set it.
`Portfolio_Profile__c` (hero/identity; `Photo_URL__c` → plain `<img>` with
initials fallback), `Experience__c` (jobs; blank end date or `Is_Current__c` renders
"Present"), `Project__c` (child of Experience via `Job__c`, rel name `Projects`),
`Skill_Group__c` (one per category; `Skills__c` is **semicolon-delimited** → chips, same
convention as `Project__c.Tech_Stack__c`), `Certification__c`, `Education__c`, `Award__c`.

**Apex**: `PortfolioController` — public site reads. `with sharing`, cacheable methods,
typed inner DTOs, active-only + Display_Order ordering, parent-child subquery for
projects. All section methods take `profileId`: null resolves to the FIRST active
profile; explicit ids are honored only when that profile is active; **no active
profiles = master kill switch: the hero shows ONE "No active profiles" glass card
and the dock, tabs, and every section hide entirely** (components share the
cacheable `getProfiles` wire to detect it). `getProfiles()` also feeds the switcher. **`Phone__c` is never queried — privacy by design on a public site.**
`PortfolioAdminController` — internal admin reads (ALL records incl. inactive),
object allowlist, never granted to the guest profile.

**Public site LWCs**: section components (`portfolioHero`, `portfolioExperience`,
`portfolioSkills`, `portfolioCertifications`, `portfolioEducation`, `portfolioAwards`)
each with loading/empty/error states and an `@api hideTitle`. Composition is a tabbed
360 view: `portfolio360` holds the panels (hash deep links `#experience` etc.);
`portfolioProfileSwitcher` — floating LEFT glass rail of circular avatar tabs, shown
only when 2+ profiles are active; clicking broadcasts `portfolioprofilechange` window
events and every profile-aware component (hero, nav chip, all sections) re-queries.
`portfolioNav` — the floating liquid-glass bottom dock — is the single nav: dispatches
`portfolio360navigate` window events, sliding active-pill indicator (FLIP transform),
scroll-spy ("About" only when `scrollY < 140`), and a name chip that appears when the
hero name scrolls out. Rich text renders via `lightning-formatted-rich-text`.

**Design system (liquid glass)**: vivid pastel mesh + hard-edged discs live in the
**mainAppPage `headMarkup` inline `<style>`** — glass needs color/edges behind it or
blur is invisible. White-frost surfaces (`backdrop-filter` blur 8–20px, reduced on
mobile), ink `#1d1d1f` monochrome accents, glass pill language shared by dock, name
chip, buttons, and section headers. Never animate `backdrop-filter`; hover shadows fade
a pre-rendered `::after` (opacity only). `prefers-reduced-motion` honored everywhere.

**Admin (internal only)**: App Launcher → "Portfolio Admin" (FlexiPage + tab).
`portfolioAdmin` LWC is **profile-scoped**: a searchable `lightning-record-picker` at
the top selects the working profile (+ New Profile button); the Profile tab edits that
profile directly, and every other tab lists only that profile's records (Projects scope
via `Job__r.Profile__c`). New records are auto-linked — Profile__c prefills with the
working profile on create forms. Left record picker (Inactive badges), right
`lightning-record-edit-form` — **describe-driven**: every editable custom field renders
automatically (Name first, Display_Order/Is_Active pinned last). In-place New, Delete
with confirm (profile delete warns that children lose their link). Targets
`lightning__AppPage`/`HomePage` only — it cannot be placed on the Experience site, and
the guest profile has no access to its controller.

**Guest security model**: guest profile = object Read ×7 + FLS on rendered fields only
(no Phone) + access to `PortfolioController` only. Criteria-based **guest sharing
rules** (`Is_Active__c = TRUE → Read`) are the only door through Private external OWD.
Unchecking `Is_Active__c` hides a record from the site instantly.

## Workflows

- **Edit content**: Portfolio Admin page → pick record → edit → Save. No deploys.
- **New FIELD**: create field + Portfolio_Admin permset FLS. Admin form picks it up with
  zero code. If shown publicly: guest profile FLS + PortfolioController query/DTO + the
  section LWC markup.
- **New SIMPLE section — ZERO code**: add `Portfolio_Item__c` records in the admin
  page ("More Items" tab) with a `Section__c` name ("Publications", "Speaking"…).
  Same Section name groups into one site section under the "More" dock tab (which
  appears/disappears automatically with items). `Section_Order__c` orders sections;
  `Display_Order__c` orders items; fields: Subtitle, rich-text Description, Date Label,
  Link URL/Label, Tags (semicolon → chips). Only build a dedicated object when the
  content needs a bespoke layout (like the Experience timeline):
- **New DEDICATED section (object)**: object w/ the two convention fields + guest sharing rule +
  permset entries + DTO/controller method + section LWC + panel in `portfolio360` +
  dock item in `portfolioNav` + admin: tab entry in `portfolioAdmin` OBJECTS + entry in
  `PortfolioAdminController.ALLOWED_OBJECTS`.
- **Anything under `digitalExperiences/`** (head markup, branding, home view JSON, theme):
  deploy, then **publish** (`sf community publish`), then hard-refresh (guest CDN cache).

## Hard-won gotchas (do not relearn these)

1. `{ styles/styles.css }` in headMarkup **never resolves** on the published site — the
   file deploys but is not served. Global canvas CSS lives INLINE in mainAppPage
   `headMarkup` (with `!important`). `sfdc_cms__styles/styles_css` is effectively dead.
2. `html, body { height: 100% }` caps the body's background paint box at one viewport —
   full-width color seam exactly one screen down. Use `min-height`.
3. Blur over a flat background is invisible — keep color/edges behind glass surfaces.
4. LWR injects base link styles into shadow roots; `a:hover` (0-1-1) beats a lone class
   (0-1-0). Every anchor must pin color/text-decoration on
   hover/focus/active/visited (all four anchors in the site do).
5. `onactive` fires on `lightning-tab`, NOT on `lightning-tabset`.
6. `document.startViewTransition` + waiting on rAF inside the update callback =
   deadlock (rendering is paused, rAF never fires; page freezes ~4s per click).
7. `sharingGuestRules` metadata rejects `includeRecordsOwnedByAll`.
8. Guest profile + guest sharing rules can only deploy AFTER the site exists
   (site creation spawns the guest user). Site name for `<guestUser>` is `Portfolio`.
9. App-page FlexiPage template is `flexipage:defaultAppHomeTemplate`; FlexiPage custom
   tabs require `<label>`.
10. `lightning-tab` content swaps need the spy to be scroll-position based — short
    panels can't push the hero fully out, so hero-visibility checks steal active state.
11. Buttons don't inherit `font-family`; set it explicitly (dock/chip do).
12. Apex `@wire` with a reactive config param that is `undefined` NEVER calls the
    server (component hangs in loading). Initialize reactive params to `null`
    (`profileId = null`) — null reaches Apex and resolves the default.
13. Photo is an org `StaticResource` (`profilePhoto`, 512px JPEG) served at
    `https://chap-dev-ed.my.site.com/sfsites/c/resource/profilePhoto` — same origin, no
    CSP concerns. OG link-preview meta tags live in headMarkup.

## Disaster recovery (org loss)

The repo holds everything deployable: schema, code, site bundle, guest profile +
sharing rules, `networks/` + `sites/` (site container settings). Org-side-only:
the org/domain itself and the data records. Rebuild: new Dev Edition → enable Digital
Experiences → create "Build Your Own (LWR)" site named **Portfolio** (recreates the
guest user) → `sf project deploy start` → re-seed records from the resumes (script was
deliberately never committed) → set Photo_URL to the static resource URL → publish.

## Status

All phases complete (2026-06-10): schema, Apex (46/46 tests, 100% coverage both
controllers), LWCs (+ Jest 24/24, lint 0), guest access verified by SOQL, data loaded,
site live with liquid-glass tabbed UI, admin page, photo, OG tags. No open items beyond
monthly org login.
