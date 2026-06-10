# Salesforce Portfolio Site

A public portfolio/resume website built **on Salesforce** — Experience Cloud (LWR),
Apex, and Lightning Web Components. The site itself is the work sample.

**Live site:** https://chap-dev-ed.my.site.com/

## Why Salesforce for a portfolio?

Because the medium demonstrates the skill. Every part of this repo is the kind of
work a Salesforce developer does daily: data modeling, a secured Apex service layer,
custom LWCs with no framework crutches, and guest-user security done properly.

## How it works

Content is **100% data-driven**. Every section of the site renders from custom object
records — updating the portfolio means editing records in the org, never touching code.

```
Records ──> PortfolioController (Apex, cacheable) ──> LWCs ──> public LWR site
```

### Data model

Seven custom objects, each with `Display_Order__c` (ordering) and `Is_Active__c`
(visibility — also the criteria for guest sharing rules):

| Object | Drives | Notes |
|---|---|---|
| `Portfolio_Profile__c` | Hero section | Photo via URL with initials fallback |
| `Experience__c` | Job timeline | Blank end date renders "Present" |
| `Project__c` | Project cards | Child of Experience (`Job__c` lookup) |
| `Skill_Group__c` | Skill chips | One record per category, `;`-delimited list |
| `Certification__c` | Cert cards | Optional credential verification link |
| `Education__c` | Education | |
| `Award__c` | Awards | |

### Apex

One controller — [`PortfolioController`](force-app/main/default/classes/PortfolioController.cls):
`with sharing`, all methods `@AuraEnabled(cacheable=true)`, typed DTO inner classes,
parent-child subquery for projects (no SOQL in loops), null-safe empty states.
The profile `Phone__c` field is **never queried** — the site is public, so the
controller can't leak it by design.

Tests: [`PortfolioControllerTest`](force-app/main/default/classes/PortfolioControllerTest.cls) —
filtering, ordering, nesting, delimiter parsing, and empty-data paths. 100% coverage
on the controller.

### LWC

One component per section — hero, experience timeline (with nested project cards),
skills, certifications, education, awards. Mobile-first custom CSS (LWR sites don't
load full SLDS, so no utility-class dependence), zero external JavaScript libraries,
and loading/empty/error states in every component.

### Guest access

Public visibility is deliberate and minimal:

- Guest profile: object **Read** + field-level read on rendered fields only
- Criteria-based **guest sharing rules**: `Is_Active__c = TRUE → Read` per object
  (guest org-wide defaults are Private; sharing rules are the only door in)
- Unchecking `Is_Active__c` on any record removes it from the public site instantly

## Deploying your own

```bash
sf org login web -a portfolio
sf project deploy start -o portfolio
sf org assign permset -n Portfolio_Admin -o portfolio
sf apex run test -o portfolio -l RunLocalTests -w 10 -c
```

Then create an Experience Cloud "Build Your Own (LWR)" site, drop the six portfolio
components onto the home page, configure guest access, and load your own records.

---

Built by [Venkata Chaitanya Bhimisetty](https://www.linkedin.com/in/venkatachaitanya-bhimisetty/) ·
[GitHub](https://github.com/bv-chaitanya)
