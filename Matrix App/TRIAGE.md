# TRIAGE — Open Questions for Role/Phase Refinement

> **Instructions:** Pre-filled answers are marked with `[PRE-FILLED]`. Review and change to `[CONFIRMED]`, `[CORRECTED: ...]`, or `[DISCUSS]` as needed. Return this file for data model updates.

---

## Three-Tier Visual Model (for Flow View)

**Tier 1 (top row) — Statutory Roles**
Roles required by building code regardless of EC. Always present for the building type/size.

**Tier 2 (middle row) — EC Assessment Activity**
Roles specifically authorized to undertake embodied carbon / wbLCA work.

**Tier 3 (bottom row) — Voluntary Standards**
Optional certifications layered on top: PHI (CPHD/CPHC), LEED (LEED AP), CaGBC ZCB, CHBA Net Zero, ENERGY STAR, etc.

Some roles appear on multiple tiers (e.g., AR is Tier 1 statutory on Part 3, AND Tier 2 EC practitioner if trained).

---

## Phase Mapping

Standard Canadian project phases (RAIC Handbook of Practice / OAA Document 600) vs. our app phases:

| RAIC Phase | Abbrev | App Phase | Mapping |
|---|---|---|---|
| Pre-Design / Programming / Feasibility | PD | p1 | Direct |
| Schematic Design | SD | p2 (early) | Compressed into p2 |
| Design Development | DD | p2 (mid) | Compressed into p2 |
| Construction Documents / Permit Application | CD | p2 (late) / p3 | Permit app is end of p2; AHJ review is p3 |
| Construction Contract Administration | CA | p4 | Direct — includes AR/PE General Review |
| Occupancy / Post-Occupancy / Commissioning | O/PO | p5 + p6 | p5 = Occupancy/Cx; p6 = Post-Occupancy |

> **Note:** Our 6-phase model compresses SD+DD+CD into p2 and splits O/PO across p5+p6. This is acceptable for the EC mapping purpose but should be documented.

---

## SECTION A — Statutory Baseline (Tier 1)

### Q1. Part 9 — Statutory actors by phase

`[PRE-FILLED]` Based on: Part 9 exemption means AR/PE not required but not prohibited. BO statutory role begins at permit application.

| Phase | Tier 1 Actors (Part 9) | Status |
|---|---|---|
| p1 Pre-Design | OB (or DT), optionally AR if engaged | `[PRE-FILLED]` |
| p2 Design/Permit | OB/DT (prescriptive) or EA (performance); AR if voluntarily engaged | `[PRE-FILLED]` |
| p3 Permit Review | **BO** (statutory — permit issuance) | `[PRE-FILLED]` |
| p4 Construction | **CT, BO** (statutory inspections: footings, framing, insulation/VB, plumbing rough-in, HVAC, final) | `[PRE-FILLED]` |
| p5 Occupancy | **BO** (statutory — occupancy permit issuance). Commissioning rare on Part 9 except PH/high-perf. | `[PRE-FILLED]` |
| p6 Post-Occupancy | No statutory actor. EA if EnerGuide post-reno. | `[PRE-FILLED]` |

### Q2. Part 3 — Statutory actors by phase

`[PRE-FILLED]` Based on: PEO/OAA Joint Bulletin — AR + PE required from project inception. General Review during CA.

| Phase | Tier 1 Actors (Part 3) | Status |
|---|---|---|
| p1 Pre-Design | **DEV, AR, PE** (AR/PE engaged from inception per Architects Act / Engineers Act) | `[PRE-FILLED]` |
| p2 Design/Permit | **AR, PE** (stamp mandatory), EA (if NECB performance path energy modelling) | `[PRE-FILLED]` |
| p3 Permit Review | **BO, Fire Marshal** (statutory multi-discipline review) | `[PRE-FILLED]` |
| p4 Construction | **CT, BO** (inspections), **AR** (General Review — Schedules A/B/C or equivalent), **PE** (General Review for structural/mechanical) | `[PRE-FILLED]` |
| p5 Occupancy | **AR, PE** (Letters of Assurance / final Schedules), **BO** (occupancy permit). Commissioning (CxA) standard on institutional/major commercial. | `[PRE-FILLED]` |
| p6 Post-Occupancy | DEV (if incentives). CaGBC ZCB-Performance requires 12-month operational data. | `[PRE-FILLED]` |

### Q3. Should Tier 1 actors appear even in "No EC Activity" phases?

`[PRE-FILLED]` **Answer: Yes (Option A).** Add Tier 1 actors to all phases. This prevents the misleading impression that BO/AR/PE have no role in construction or occupancy. The status remains NONE for non-EC phases — the actors are there but the EC status is unchanged.

---

## SECTION B — EC Assessment Roles (Tier 2)

### Q4. Vancouver Part 9 (COV Appendix II) — Qualified Practitioner

`[PRE-FILLED]` Based on: Vancouver EA-only QP is an oversight. AR/PE should be eligible. AIBC and BfCA have been advised.

| Question | Pre-filled Answer | Status |
|---|---|---|
| Can AR (AIBC) with BEAM/MCE2 training be the QP? | **Should be yes** — currently excluded by COV wording (oversight). AR has broader scope than EA. | `[PRE-FILLED]` |
| Can PE (EGBC) with BEAM/MCE2 training be the QP? | **Should be yes** — same reasoning. | `[PRE-FILLED]` |
| Should AR appear in p1/p2/p5 as Tier 2 actor? | **Yes** — AR can do EC work on all building types. In this row, AR appears as both Tier 1 (if voluntarily engaged) and Tier 2 (EC practitioner if BEAM/MCE2 trained). Note the COV wording discrepancy. | `[PRE-FILLED]` |
| What is AR's role if NOT the QP under COV wording? | Design coordination, permit drawings, seal on non-EC documents. But this is the oversight — AR *should* be eligible as QP. | `[PRE-FILLED]` |

### Q5. Vancouver Part 3 (COV Addendum v1.0)

`[PRE-FILLED]` Based on: Addendum says "the user" with no QP restriction. AR/PE can do EC work on Part 3.

| Question | Pre-filled Answer | Status |
|---|---|---|
| Who prepares the wbLCA for Building Permit? | SC/LCA Practitioner typically, but AR or PE can also prepare it. No formal restriction in Addendum v1.0. | `[PRE-FILLED]` |
| Does the ECDR require AR or PE seal? | Not stated in Addendum. ECDR is submitted alongside permit drawings (which do require AR/PE seal for Part 3). | `[PRE-FILLED]` |
| Is there a QP definition for Part 3 EC? | No — Addendum just says "the user". Open practice area. | `[PRE-FILLED]` |
| Can EA do Part 3 EC work? | **No** — EA scope is Part 9 / EnerGuide workflow only. EA cannot be QP on Part 3. | `[PRE-FILLED]` |

### Q6. Toronto TGS

`[PRE-FILLED]` Based on: TGS does not define a formal QP. WLC submitted to City Planning, not Building Dept.

| Question | Pre-filled Answer | Status |
|---|---|---|
| Who prepares the WLC assessment? | SC typically, AR or PE can also. No formal QP definition in TGS. | `[PRE-FILLED]` |
| Does TGS specify a QP? | No formal definition. | `[PRE-FILLED]` |
| Is WLC submitted under AR/PE seal? | No — submitted to City Planning as development permit condition, separate from building permit. | `[PRE-FILLED]` |

### Q7. Federal (Treasury Board Standard)

`[PRE-FILLED]` Based on: NRC Practitioner's Guide is normative. AR/PE/SC/QP all listed.

| Question | Pre-filled Answer | Status |
|---|---|---|
| Must EC Design Report be sealed by AR or PE? | Likely yes for federal Part 3 projects (submitted with permit package). NRC Guide doesn't explicitly state seal requirement. | `[PRE-FILLED]` |
| Can SC submit independently? | Unclear — SC likely prepares the ECDR but submission is under the project's AR/PE. | `[PRE-FILLED]` |
| Does NRC Guide define a QP? | Not explicitly. References "the practitioner" without formal qualification criteria. | `[PRE-FILLED]` |

### Q8. CMHC Programs

`[PRE-FILLED]` Based on: User confirmed CMHC QP = AR, PE, or EA (self-attestation). EA limited to Part 9.

| Question | Pre-filled Answer | Status |
|---|---|---|
| CMHC QP definition | AR, PE, or EA (self-attestation) | `[PRE-FILLED]` |
| Can EA be QP on Part 3 CMHC? | **No** — EA limited to Part 9 scope | `[PRE-FILLED]` |
| Should NBC baseline rows have Tier 2 actors? | No EC requirement = no Tier 2 actors. But note SC/AR could voluntarily undertake EC. | `[PRE-FILLED]` |

---

## SECTION C — Specific Row Fixes

### Q9. Part 9 rows where AR appears

`[PRE-FILLED]` AR can work on ALL project types. Part 9 exemption = not required, not prohibited.

| Row | AR appears in | Pre-filled Resolution | Status |
|---|---|---|---|
| nc_p9_nbc_prescriptive | p2 | AR as Tier 1 (voluntarily engaged). Not doing EC. Keep. | `[PRE-FILLED]` |
| nc_p9_on_sb12 | p2 | AR as Tier 1 (voluntarily engaged). Not doing EC. Keep. | `[PRE-FILLED]` |
| nc_p9_muni_tgs | p1, p2, p5 | AR as Tier 1 + Tier 2 (EC work at Tier 3-4). Keep, clarify tier. | `[PRE-FILLED]` |
| nc_p9_muni_van | p1, p2, p5 | AR as Tier 1 + Tier 2 (should be eligible as QP — COV oversight). Keep. | `[PRE-FILLED]` |
| nc_p9_vol_ph | p1, p2, p6 | AR as Tier 1 (design lead on PH). Tier 3 (voluntary PH cert). Keep. | `[PRE-FILLED]` |
| nc_p9_vol_leed | p1 | AR as Tier 1 (Integrative Process). Tier 3 (LEED). Keep. | `[PRE-FILLED]` |

### Q10. Add BO to p4/p5 where missing

`[PRE-FILLED]` BO has statutory role at construction inspections (p4) and occupancy permit (p5) for all permitted work.

| Row type | Add BO to p4? | Add BO to p5? | Status |
|---|---|---|---|
| All Part 9 permitted rows | **Yes** — inspections | **Yes** — occupancy permit | `[PRE-FILLED]` |
| All Part 3 rows | **Yes** — inspections | **Yes** — occupancy permit | `[PRE-FILLED]` |
| No-permit rows | No | No | `[PRE-FILLED]` |
| Demolition rows | **Yes** (p4 demo inspections) | **Yes** (site clearance) | `[PRE-FILLED]` |

### Q11. Add AR/PE to p4 (General Review) for Part 3

`[PRE-FILLED]` AR/PE do General Review during construction on all Part 3 projects — this is statutory, not optional.

| Row type | Add AR/PE to p4? | Status |
|---|---|---|
| All Part 3 NBC baseline rows | **Yes** — General Review is mandatory | `[PRE-FILLED]` |
| All Part 3 TGS/Vancouver/Federal rows | **Yes** — alongside existing SC/CT actors | `[PRE-FILLED]` |
| Part 3 LEED rows | **Yes** — General Review still mandatory even on voluntary cert | `[PRE-FILLED]` |
| Part 3 Addition/Alteration rows | **Yes** — follows the rule for the building type | `[PRE-FILLED]` |

---

## SECTION D — Display / UX (Three-Tier Flow)

### Q12. How should the three tiers appear in the Flow View?

`[PRE-FILLED]` Three horizontal rows per phase node:

```
┌─────────────────────────────────────┐
│ Phase Name          Status Badge    │
├─────────────────────────────────────┤
│ TIER 1: STATUTORY                   │
│ [BO] [AR] [PE] [CT]                │
│ Inspections, General Review, etc.   │
├─────────────────────────────────────┤
│ TIER 2: EC ACTIVITY                 │
│ [SC] [EA] [AR]  Status: MANDATORY  │
│ ECDR submitted, wbLCA, tools...     │
├─────────────────────────────────────┤
│ TIER 3: VOLUNTARY STANDARDS         │
│ [CPHD] PHI certification            │
│ (only if applicable to this row)    │
└─────────────────────────────────────┘
```

Tier 1 = subtle/muted styling (always present, not the focus).
Tier 2 = primary styling (the EC content — the point of the app).
Tier 3 = accent styling (only shows when a voluntary cert applies).

### Q13. Actor Lens behaviour with three tiers

`[PRE-FILLED]` When a lens is active (e.g., AR):
- **Highlight ALL tiers where actor appears** — both Tier 1 (statutory) and Tier 2 (EC work)
- **Visually distinguish** the two: Tier 1 highlight = subtle (light outline), Tier 2 highlight = strong (bold outline, as current purple)
- The "Your Role" banner should say something like: "Active in 5 of 6 phases: P1-P5 (statutory) · P1, P2, P5 (EC assessment)"

### Q14. noEC phases in Flow Model

`[PRE-FILLED]` noEC phases should show Tier 1 actors (BO, AR/PE) with a muted appearance. They should NOT be collapsible — the statutory activity is real, just not EC-related.

---

## SECTION E — Data Integrity

### Q15. Actors used but not in ACTORS_LIST

`[PRE-FILLED]` Recommendation: formalize the following into ACTORS_LIST:

| Actor | Proposed code | Tier | Add? | Status |
|---|---|---|---|---|
| Certified Passive House Designer | CPHD | Tier 3 | **Yes** — appears in PH rows | `[PRE-FILLED]` |
| Certified Passive House Consultant | CPHC | Tier 3 | **Yes** — CPHC can also prepare PHPP submissions (not just CPHD) | `[PRE-FILLED]` |
| LEED AP / Green Rater | LEED AP | Tier 3 | **Yes** — appears in LEED rows | `[PRE-FILLED]` |
| LCA Practitioner | (use SC) | Tier 2 | **No** — merge into SC (Sustainability Consultant / LCA Practitioner) | `[PRE-FILLED]` |
| Fire Marshal | FM | Tier 1 | **Yes** — statutory role on Part 3, distinct from BO | `[PRE-FILLED]` |
| Commissioning Agent | CxA | Tier 1 | **Consider** — increasingly standard on Part 3. Could be added to p5. | `[PRE-FILLED]` |
| City Planning Dept. | (keep as label) | Tier 1 | **No** — leave as ad-hoc label, not a formal actor code | `[PRE-FILLED]` |
| CHBA verifier | (keep as label) | Tier 3 | **No** — leave as ad-hoc label | `[PRE-FILLED]` |

### Q16. Missing program contexts?

| Program | Relevance | Add? | Status |
|---|---|---|---|
| R-2000 (NRCan legacy) | Predecessor to current EnerGuide/Net Zero. Largely superseded. | Probably not | `[PRE-FILLED]` |
| BC Housing (social housing) | May have specific EC requirements via CMHC ACLP. | Possible future row | `[PRE-FILLED]` |
| Indigenous housing (CIRNAC/ISC) | Federal EC mandate may extend via contribution agreements. Already noted in Federal row. | Covered | `[PRE-FILLED]` |
| CaGBC ZCB-Performance | Distinct from ZCB-Design — requires 12-month post-occupancy operational data. | **Yes — worth adding as separate row** | `[PRE-FILLED]` |
| WELL Building Standard | No EC component. | No | `[PRE-FILLED]` |

### Q17. Phase label refinement?

Current app phases vs. industry terminology — should we add sub-labels?

| App Phase | Current Label | Proposed Refined Label | Status |
|---|---|---|---|
| p1 | Pre-Design / Concept | Pre-Design / Concept (PD) | `[PRE-FILLED]` |
| p2 | Design / Permit Submission | Design (SD/DD/CD) + Permit Application | `[PRE-FILLED]` |
| p3 | Permit Review (AHJ) | Permit Review (AHJ) | `[PRE-FILLED]` — no change |
| p4 | Construction | Construction Administration (CA) + Inspections | `[PRE-FILLED]` |
| p5 | Occupancy / Close-out | Occupancy / Commissioning (Cx) | `[PRE-FILLED]` |
| p6 | Post-Occupancy / Incentives | Post-Occupancy / Performance Validation | `[PRE-FILLED]` |

---

## Key Clarifications from Research

1. **EA regulation:** EAs hold NRCan certification (federal) but are NOT a regulated profession under any provincial act. NRCan can operate a federal certification program (energy policy mandate), but cannot create a provincially-regulated profession. No province has chosen to regulate EAs.

2. **Passive House:** Both CPHD and CPHC can prepare PHPP submissions. PHI certification requires a blower door test (construction verification), so it is not purely modelling — but there is no construction inspection regime comparable to building code inspections.

3. **EnerGuide post-reno:** Confirmed modelling-based (HOT2000 model update + blower door test). Does NOT review utility bills. Rating is asset-based (standard operating conditions), not operational.

4. **Commissioning:** Not mandated by NBC/NECB as standalone requirement. Increasingly standard on institutional/major commercial Part 3. Required by LEED and CaGBC ZCB. CxA is typically an independent P.Eng. or specialized professional.

5. **CaGBC ZCB-Design vs ZCB-Performance:** ZCB-D = modelling/design only. ZCB-P = requires 12 months post-occupancy operational data + renewable energy validation. Both require wbLCA.

---

*Generated 2026-03-18 from ec_matrix_step14.html audit + web research + user guidance. Review `[PRE-FILLED]` answers and return for data model updates.*
