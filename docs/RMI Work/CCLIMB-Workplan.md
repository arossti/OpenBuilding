Carbon & Climate Impact Model for Materials and Buildings (C-CLIMB)
Methodology for Time-Explicit Climate Interpretation of Carbon Storage and Release from Building Products
Draft for Working Group Review
Carbon & Climate Impact Model for Materials and Buildings (C-CLIMB)	1
1: Orientation	2
1.1. Rationale	2
1.2. Scope and Application	5
2: Methodology Overview	7
2.1 How This Methodology Works	7
2.2 Inputs overview	8
2.3 Outputs overview	8
2.4 Interpretation overview	9
3. Inputs	9
3.1 Inventory Requirements	9
3.2. Feedstock Categorization Framework	10
4. Modeling Logic	12
4.1 Climate Interpretation – Reference Trajectory	12
4.1.1. Standardized Reference Trajectory Archetypes	13
4.2 Climate Interpretation – Radiative Forcing, Temperature Change, and Completeness	14
5. Reporting of results	16
Critical Note (must accompany table)	17
6. Minimum Requirements for Climate Calculation Engines	18
6.1 Scope and Role of the Calculator	18
6.2 Scientific Basis	18
6.3 Climate System Parameters	19
6.4 Gas Coverage	19
6.5 Input Requirements	19
6.6 Temporal Treatment	19
6.7 Output Requirements	20
6.8 Transparency and Documentation	20
6.9 Consistency and Completeness	20
6.10 Scenario Treatment	21
Section 7. Implementation Guidelines	22
7.1 Worked Examples	22
Section 8. Boundaries and Transparency	23
8.1 Limitations and Assumptions	23
Section 9. Reference Material	24
9.1. Definitions	24
9.2 Appendices	24
Use in PCRs and EPDs	25
Appendix	30
Draft Reference Trajectories for Tier 2	32
5.2 Tiered Approach for Category D	32


1: Orientation[1.1]
1.1. Rationale
What is the climate impact of using long-lived, carbon-storing products in the built environment? Even though storing carbon in buildings has the potential to create a significant new, gigatonne-sized planetary carbon sink ,  and provide a major climate mitigation opportunity, this question has not yet been answered in a consistent, consensus-based manner. As a result, the sector has seen divergent claims — ranging from assertions that durable carbon storage is climate-neutral to arguments that it delivers significant mitigation benefits. The methodology presented here applies climate science to clarify this question, not to presume that the mere presence of carbon storage in buildings is inherently beneficial or detrimental to our climate trajectory, but to identify the conditions under which either outcome occurs and to illuminate the product and building characteristics with the strongest climate impact.
Life cycle assessment (LCA) has become the default approach for measuring the embodied carbon emissions of building products and buildings. The global warming potential (GWP) results for products and buildings are expressed in kilograms of carbon dioxide equivalent (CO2e) over a 100-year period and are the key reporting metric for most embodied carbon standards, incentives and policies.
Embedded in current LCA standards is the reporting of “negative emissions” for atmospheric carbon uptake during feedstock growth and/or product manufacturing. However, the prevailing –1/+1 approach treats all biogenic carbon removals at the beginning of the life cycle as fully balanced by emissions at end-of-life, without regard to the timing of either flow. This convention preserves carbon mass balance at the inventory level but does not interpret how the timing of removals and emissions affects atmospheric carbon concentrations or related climate impacts such as radiative forcing and temperature change.
Current LCA standards do not provide a mechanism for interpreting the climate significance of carbon stored in products or buildings over time. By collapsing uptake and release into a single accounting balance, the –1/+1 approach obscures the potential climate value of delayed emissions.
This simplified treatment contrasts with climate science literature demonstrating that carbon stored for a limited duration can influence peak temperature and cumulative radiative forcing, even if storage is not permanent. Temporary storage alters the atmospheric trajectory of carbon relative to a reference trajectory in which emissions occur earlier. Such temporary storage contributes to climate mitigation at large spatial and temporal scales, because any carbon kept out of the atmosphere for a period contributes to reduced warming during that time. 
The IPCC acknowledges that this type of “CDR [carbon dioxide removal] is required to achieve global and national targets of net zero CO₂ and greenhouse gas (GHG) emissions… and is part of all modelled scenarios that limit global warming to 2°C or lower by 2100.”  While the IPCC does not prescribe accounting methods for building products, its findings establish that atmospheric removals — including those stored in terrestrial and product reservoirs — play a necessary role in mitigation pathways consistent with temperature targets.
The Greenhouse Gas Protocol’s Land Sector and Removals Standard (a supplement to the GHG Protocol Corporate Standard and Scope 3 Standard) similarly recognizes that “Products that contain biogenic or TCDR-based carbon can keep carbon out of the atmosphere for the duration of the product's lifetime. Therefore, maintaining storage in product carbon pools and preventing its release can help to reduce GHG emissions, depending on the product’s durability and end-of-life fate.” 
Dynamic LCA (dLCA) introduces temporal variation into both inventory modeling and impact characterization. Its core insight is that the timing of emissions influences atmospheric concentration pathways and therefore climate impact. However, existing dynamic LCA approaches to measuring carbon storage in building products and buildings vary in scope, assumptions, and treatment of system boundaries, and no single method has achieved consensus adoption or widespread use. These approaches currently require bespoke calculations that are outside of current industry norms and not in clear alignment with accepted LCA standards  and practices.
The absence of a user-friendly, market-aligned method to dynamically account for and demonstrate the potential climate benefits of carbon stored in buildings hinders product development, industry demand, recognition in green building certification programs, and creation of strong signals from regulators. This slows the development of the carbon-storing building product sector at a time when its benefits could prove critical to meeting broader climate goals.
The Carbon & Climate Impact Model for Materials and Buildings (CCLIMB) methodology provides a broadly applicable and user-friendly method for defining and calculating the climate benefit of carbon storing products and buildings over time. It aligns with leading approaches to dLCA and has been developed in collaboration with a cohort of industry participants. The methodology focus is identifying and quantifying key temporal aspects of flows of stored carbon, including feedstock characterization, manufacturing and installation, product lifespan, and end-of-life considerations. This approach is not intended to replace conventional LCA but to overlay a time-explicit climate interpretation onto inventory-defined carbon flows and more precisely models product and location-dependent end-of-life scenarios.
This methodology will help users understand how the inclusion of carbon-storing products in buildings affects the climate over time, by comparing the timing of carbon removals and emissions under clearly defined reference trajectories and providing time-explicit changes to radiative forcing and temperature to enable users to clearly demonstrate the climate impact of products and buildings that store significant amounts of carbon over their intended lifespans.
By advancing a standardized dynamic LCA method applicable across building LCAs performed under various standards, this work aims to provide clarity, consistency, and rigor to claims regarding biogenic carbon storage in products and buildings. This will support more informed product development, policy, design, and investment decisions in alignment with regional, national and international climate goals.
1.2. Scope and Application
The CCLIMB methodology is intended to demonstrate the climate impact of products and buildings that store significant amounts of carbon over their intended lifespans by modeling the timing of carbon removals and emissions and the resulting climate responses: time-dependent impacts to radiative forcing and temperature. These insights are intended to inform the decision-making of a range of building sector stakeholders, including but not limited to:
	LCA practitioners
	Product manufacturers
	Building designers & specifiers
	Building owners 
	Carbon reporting & standards regulators
	Policy analysts
CCLIMB can be applied to carbon storage in individual products for which a verified LCA or EPD have been produced and buildings containing carbon storing products for which a completed whole building life cycle assessment (WBLCA) exists. 
Carbon that is present in a biogenic feedstock and/or intentionally incorporated into a product during manufacturing or construction and is quantifiable at the time of installation is considered in scope (referenced as ‘carbon flows’). Gradual atmospheric uptake occurring during the service life of the product/building (e.g., ambient carbonation of concrete) is excluded.
CCLIMB is not intended to provide dynamic interpretation of non-carbon emissions (such as N2[2.1]O, CFCs, HFCs) from LCAs, EPDs or WBLCAs.
CCLIMB is not intended to certify products or buildings, perform forestry or agricultural carbon accounting or issue carbon credits.
 
2: Methodology Overview
2.1 How This Methodology Works
 Step 1: 
Collect and input relevant LCA/EPD data (all carbon flows into and out of the product system, including A1, A3, A5 and C4, as per Section 3.
Note: All flows in B4 may be captured as A and C flows for the replacement product at the appropriate year.
Step 2:
Identify the feedstock category(s) for each product as per Section 4. This will associate a default reference trajectory for each feedstock.
Step 3:
Identify the Reference Trajectory for each feedstock category(s) as per Section 5.
Step 4:
Enter all CO2 withdrawals and emissions in the appropriate year of occurrence into an approved dLCA calculator as per Section 6.
Note: C-module defaults will be available for dLCA calculator.
Step 5:
Run simulation in dLCA calculator and generate results for the complete reference timeline as per Section 8.
Step 6:
Create report, including required outputs and any custom outputs as per Section 8.
2.2 Inputs overview
Inputs from LCA and EPD: The first step to calculating C-CLIMB is to gather product data from LCAs, EPDs, and/or WBLCAs. This data includes the carbon removals and emissions associated with the product throughout its life cycle, to inform climate interpretation formulas used in the methodology. See section 3.1 for full details of EPD/LCA inventory requirements.
Feedstock characterization: In addition to gathering product-specific carbon flow data, the carbon-bearing feedstocks in the product must be categorized by typology. Typologies are determined by whether the carbon-bearing feedstock, when processed for product development, changes the timing of atmospheric carbon exchange (Tier 1), or changes the trajectory of an existing carbon stock (Tier 2). The type of climate interpretation calculations performed are reliant on this categorization. See section 3.2 for full details on feedstock categorization and sub-categories for support in identifying appropriate categories.
Reference trajectories: To accurately assess climate interpretation, the alternative pathway of the carbon-based feedstocks must be determined. This alternative pathway, known as the reference trajectory, defines the carbon flow (delay and emissions) that would have happened if the product(s) were not developed. Comparing the reference trajectory to the product trajectory illuminates the carbon flow and resulting climate impacts that are present due solely to the product(s). 
Where feedstock delay (e.g. growth) and decay information is known, CCLIMB users may refer to Reference Trajectory B (RT-B), to input specific delay and decay information. Otherwise, the default reference trajectory (RT-A) may be used, inferring feedstocks within Tier 1 to be within a default delay and decay rate timescale. 
See section 4.1 and 4.2 for full details on reference trajectory computations.
2.3 Outputs overview
After inputting relevant carbon flow data across the lifecycle of a product or building, computations are performed [3.1]to determine time-dependent climate impacts from changes to carbon flows associated with the product(s).
Climate interpretation metrics: The climate impacts of product and building carbon trajectories over time are determined by calculating the change in temperature and change in radiative forcing from the product development, using the reference trajectory as a baseline comparison. See section 4.4 for full details on temperature and radiative forcing metric formulas.
Completeness: In order to accurately show the full scope of climate impact across time, a completeness metric is derived to be reported alongside any time-specific climate impact metrics. See section 4.4 for full details on completeness metric computation.
2.4 Interpretation overview
The time-dependent climate response data reported from CCLIMB includes changes to radiative forcing and temperature. Climate response data must be reported with transparency into the completeness of the data in relation to time. Results may be reported in graph or table form. Radiative forcing response results at 100 years may be compared to GWP100-based reporting. See section 5 for full details on reporting and interpretation of time-dependent climate response. 
3. Inputs
3.1 Inventory Requirements[4.1]
Module-specific carbon flows are required for calculating climate impacts, sourced from product LCAs, Environmental Product Declarations (EPDs), and/or WBLCAs, as per Table XX . Data source(s) shall be declared according to the provisions of Section [reporting specifications section]. 
CCLIMB interprets carbon removals and emissions as physical events defined by:
	The life-cycle module in which they occur (LCA/EPD modules A1, A3, A5, C4),
	The quantity of carbon involved (converted to CO₂ equivalent),
	The associated end-of-life pathway(s) (reuse, decay, disposal, combustion).
CCLIMB calculations shall define Year 0 as the actual or intended year of product installation or building construction. All removals and emissions occurring in product modules (A1-3) are modeled as occurring prior to Year 0 and those occurring in the construction, use and end-of-life modules are modeled as occurring in relation to Year 0 (e.g. A product with a declared lifespan of 35 years shall be modeled as reaching end-of-life at Year 35).
Table XX: Inventory sources
Inventory Source	LCA module/Year
LCA/EPD modules	A1 
Carbon removal (GWPbiogenic or product carbon content)	A3
Emissions from feedstock / processing waste 	Year 

0	A5
Emissions from construction waste	B4
Replacement year	C4
EoL year, Carbon emission from end of life
Additional factors from CCLIMB	Feedstock category & Reference trajectory (defaults or custom)			Disposal pathway calculations (defaults or custom)	Repeat A-C modules for timeframe of study	EoL pathway calculations (defaults or custom)

3.2. Feedstock Categorization Framework
This section defines the classification of carbon-bearing feedstocks used in building products to distinguish between different physical mechanisms governing climate impact (e.g. changes to radiative forcing or temperature) and provide clear guidance on when counterfactual modeling is required.
This classification only applies to the carbon-bearing feedstock component(s) of a product, not the full product or its non-carbon constituents.
Feedstocks shall be classified into one of two primary tiers based on their governing climate mechanism: whether the use of the feedstock changes the timing of atmospheric carbon exchange (Tier 1) or alters a standing carbon stock trajectory (Tier 2). These two mechanisms are physically distinct and require different interpretive approaches. 
Tier 1 — Timing-Driven Systems[5.1][5.2][5.3]
Timing-driven systems are feedstocks for which climate impact is governed primarily by timing effects rather than changes in standing carbon stocks. For these feedstocks, carbon is part of a short-cycle system or a previously mobilized carbon flow within the technosphere or biosphere, the reference trajectory returns carbon to the atmosphere in the near term, and use of the feedstock does not alter a persistent carbon stock trajectory.
For Tier 1 feedstocks, climate impact is governed by:
ΔRF(t) = RF_reference(t) − RF_project(t)
Where: 
RF is instantaneous radiative forcing[6.1][6.2]
t is time
This includes delayed emissions, and/or atmospheric removal followed by storage and eventual release.
Tier 1 Sub-Categories [7.1]
Feedstock sub-categories are intended to provide transparency and interpretive clarity. They do not alter the computational method.
Sub-category	System	Reference Trajectory
A — Waste / Secondary Feedstocks 	Carbon circulating within technosphere (e.g. recycled paper, demolition wood)	Near-term emission (decay, incineration)
B — Short-Rotation By-products and Residues	Agricultural by-products (e.g. straw, hulls, shells)	Near-term emission within annual cycle
C — Perennial Regrowth Systems	Rapidly regenerating harvests from rhizomes (e.g. bamboo, coppice)	Continuous uptake with minimal stock loss
D – Harvest without depletion	Harvest occurs without loss of stock (e.g. cork, rubber) 	Continuous harvest without depletion
E — Engineered Atmospheric Uptake	CO₂ captured through industrial processes (e.g. mineralization)	CO₂ remains in atmosphere
 
Tier 1 feedstocks shall be evaluated using radiative forcing and temperature change data, without explicit modeling of opportunity cost as the carbon flows of these feedstocks are characterized by atmospheric exchange dynamics occurring within approximately 5 years, including near-term emissions from waste or residues, rapid regrowth cycles for short-rotation or perennial systems, and near-term removal or storage dynamics for engineered carbon uptake systems.
The 5-year horizon shall be interpreted as a practical default for categorization criteria to enable consistent treatment of Tier 1 feedstocks within a simplified modeling framework. This horizon is not intended to define a universal scientific boundary but has been tested to ensure relative accuracy to feedstocks within this category. 
Feedstocks outside this 10-year horizon may still be valid for analysis but shall require either case-specific justification for inclusion in Tier 1, or classification under Tier 2.
These sub-category distinctions shall be documented by CCLIMB users to ensure transparency regarding relevant system parameters, including but not limited to emissions arising from land use and land use change (LULUC).
FOR v2: Tier 2 — Stock-Based Systems
Reference-driven systems are feedstocks for which carbon is sourced from a standing biological stock, use of the feedstock alters the magnitude and/or trajectory of that stock, and the reference trajectory includes continued storage and/or continued sequestration. The most common example of a reference-driven system is long-rotation woody biomass (timber).
For Tier 2 feedstocks, climate impact is governed by:
ΔRF(t) = RF_feedstock trajectory(t) − RF_reference  trajectory(t)
Where:
RF =      instantaneous radiative forcing
t = time
This method of determining climate impact accounts for forgone carbon storage and forgone future sequestration, due to the use of the feedstock.
Calculation Requirement: To be determined in v2.
Combined Feedstocks
Products containing multiple feedstocks shall classify each feedstock independently and evaluate each according to its assigned tier.

4. Modeling Logic
4.1 Climate Interpretation – Reference Trajectory
Climate interpretation under CCLIMB is based on a comparison between the product or building carbon use trajectory (Project Case)[8.1][9.1][9.2] and one or more counterfactual carbon flow trajectories for the carbon-based feedstocks that the product or building is comprised of, defined here as Reference Trajectories (RTs). This trajectory describes the net flux of CO₂ to the atmosphere that would occur in the absence of the project.
A Reference Trajectory (RT) is defined as a time-explicit counterfactual emissions trajectory:
E_RT(t)
Where:
E_RT(t) = emissions under the Reference Trajectory at time t
RT = Reference Trajectory
t = time
4.1.1. Standardized Reference Trajectory Archetypes
CCLIMB defines standardized RT archetypes representing common counterfactual pathways.
Tier 1 Reference Trajectory Archetypes
RT-A: Near-Term Emission[10.1]
RT-A is the default reference trajectory for Tier 1 feedstocks, including a default timescale for the delay period (e.g. feedstock growth) and decay rate. Tier 1 feedstocks include waste, by-products, short-rotation crops, perennial systems, and engineered carbon uptake systems where the reference trajectory is near-term return of carbon to the atmosphere.
E_RT(t) = C₀ · k · e^(−k t)
Where:
E_RT(t) = emissions under the Reference Trajectory
C₀ = initial carbon stock
k = decay constant
t = time
e = base of natural logarithm

k = 1 / τ
Where:
k = decay constant
τ[11.1][12.1] = characteristic decay time (within 5 years)[13.1][14.1]
RT-B: Custom Scenarios
RT-B may be applied to any Tier 1 feedstock for which accurate information is available regarding the delay period (e.g. feedstock growth) and decay rate. 
E_RT(t) = 0    	for t < t_d
E_RT(t) = C₀ · k · e^(−k (t − t_d))   for t ≥ t_d
Where:
E_RT(t) = emissions under the Reference Trajectory
C₀ = initial carbon stock
k = decay constant
t = time
t_d = delay period
Tier 2 feedstocks are not included in this version of CCLIMB.

4.2 Climate Interpretation – Radiative Forcing, Temperature Change, and Completeness
Metrics to determine climate impact under CCLIMB include radiative forcing, temperature change, and completeness[15.1]. Additionally, these metrics are used to inform a result for cumulative[16.1][17.1][18.1][19.1][20.1] radiative forcing at year 100 as a means providing a comparison with product/building GWP100, a metric commonly used in life cycle assessment reporting. 
Climate impact in CCLIMB is interpreted as the difference in radiative forcing between the Project Case and the Reference Trajectory, with contextual comparison to the difference in temperature change between the Project Case and the Reference Trajectory.
Detailed below are formulas to derive results for integrated radiative forcing – utilizing radiative forcing response and impulse response formulas – as well as temperature change response and completeness.
4.2.1 Integrated radiative forcing 
Integrated radiative forcing represents the cumulative physical climate forcing over the reporting horizon. This metric is directly comparable to the underlying basis of global warming potential (GWP), a common metric used to determine climate impact of greenhouse gas emissions, but is time-explicit and counterfactual-dependent in alignment with CCLIMB. 
Impulse response
Radiative forcing is derived from emissions using an impulse response function (IRF):
RF(t) = ∫₀ᵗ E(τ) · IRF(t − τ) dτ
Where:
RF(t) = radiative forcing at time t
E(τ) = emissions at time τ
IRF(t − τ) = impulse response function
t = time
τ = time of emission
Radiative Forcing Response
To calculate the radiative forcing response of a product or building:
ΔRF(t) = RF_project(t) − RF_RT(t)
Where:
ΔRF(t) = difference in radiative forcing at time t
RF_project(t) = radiative forcing of the Project Case
RF_RT(t) = radiative forcing of the Reference Trajectory
t = time
4.2.2 Temperature change response
Temperature change response represents the cumulative climate system response of carbon flow associated with a product or building. To calculate the temperature change response of a product or building:
ΔT(t) = T_project(t) − T_RT(t)
Where:
ΔT(t) = difference in temperature change at time t
T_project(t) = temperature change of the Project Case
T_RT(t) = temperature change of the Reference Trajectory
t = time
4.2.3 Completeness
Completeness represents the fraction of total modeled climate impact captured within the reporting horizon. Reporting a completeness metric ensures that the reported climate response of a product or building is provided in the context of the timing of emissions trajectories. For instance, reporting on the 50-year impact of a product with a 60-year lifespan will omit the end of life impacts, producing an incomplete insight. 
5. Reporting of results
2.3.1 Purpose of Outputs
Reporting on climate impact of buildings and products with the CCLIMB methodology enables comparison across standard and custom reporting horizons, and explicitly discloses the fraction of total modeled impact captured within any selected time horizon. CCLIMB outputs represent the time-dependent climate response resulting from carbon flows defined in inventory methods, expressed relative to a specified Reference Trajectory (RT). All reported results shall be defined relative to a reference completeness horizon, 𝑇𝑟𝑒𝑓, representing the time period over which climate response is considered substantially complete (provisionally 250 years). 
These outputs describe how the climate system responds over time to the difference between the two trajectories. They quantify the magnitude of climate response, the timing of that response, and the degree to which it is captured within reporting horizons. 
2.3.3 Graphical Representation
Figure X — Time-Explicit Climate Response[21.1] Sample Graph
[GRAPH HERE]
Results of temperature change response and radiative forcing response shall be presented graphically, including a reference trajectory line in addition to the response results,[22.1] clearly marked reporting horizons (e.g. 20, 50, 100 years), and indication of warming versus cooling effects. These visualizations communicate the time-dependency of climate impacts, duration of storage effects, and delayed emissions behavior.
2.3.4 Tabular Reporting of Results
Results must be summarized using Table X — Time-Dependent Climate Response Summary.
Table X — Time-Dependent Climate Response Summary
Metric	Unit	20 years (optional)	50 years (optional)[23.1]	100 years (required)	Full (T_ref)
Integrated Radiative Forcing ∫₀ᴴ ΔRF(t) dt
W·m⁻²·year	[ ]	[ ]	[ ]	[reference total]
Integrated Temperature Response ∫₀ᴴ ΔT(t) dt	°C·year	[ ]	[ ]	[ ]	[reference total]
Completeness C(H)	–	[ ]	[ ]	[ ]	1.0
Residual (1 – C(H))	–	[ ]	[ ]	[ ]	0
Direction of Effect	–	Cooling / Warming	Cooling / Warming	Cooling / Warming	–

Key Definitions
C(H)=(∫_0^H ΔT(t) dt)/(∫_0^(T_ref) ΔT(t) dt) Cumulative RF(H)=∫_0^H ΔRF(t) dt
Where:
	ΔRF(t) = difference in radiative forcing between Project Case and Reference Trajectory 
	ΔT(t) = difference in temperature response 
	H = reporting horizon 
	T_ref= reference completeness horizon (~250 years, provisional) 
Critical Note (must accompany table)
“Cumulative radiative forcing values represent integrated climate forcing and are the closest equivalent to conventional GWP-based metrics used in LCA and EPDs. However, they are not CO₂e values and must not be interpreted as carbon quantities or credits.”
Required Interpretation Statement
All reported results must include:
“Results represent the difference in climate response between the Project Case and the specified Reference Trajectory. Values at each time horizon represent partial realizations of the modeled climate response. Completeness indicates the fraction of total impact captured within the reporting horizon relative to T_ref, and residual indicates the proportion occurring beyond the reporting horizon.”
2.3.7 Use of 100-Year Results
A 100-year result may be reported for enabling comparison with GWP100-based reporting, aligned with LCA and EPD conventions. However, this 100-year result is a partial representation of climate response and must be interpreted alongside completeness.  
6. Minimum Requirements for Climate Calculation Engines 
6.1 Scope and Role of the Calculator
A climate calculation engine [24.1][25.1][26.1][27.1]shall:
	Operate as a climate response model only,
	Accept externally defined carbon inventories, and
	Produce time-explicit climate impact outputs, including radiative forcing and temperature change.
The calculator shall not:
	Define or modify carbon inventories,
	Implicitly assign climate benefit, or
	Embed counterfactual assumptions.
6.2 Scientific Basis
The calculator shall implement a climate impact formulation consistent with the physical chain:
Emissions → Atmospheric concentration → Radiative forcing → Temperature 
This structure shall be consistent with the treatment of emissions metrics and climate impacts described in IPCC AR6 Working Group I (Chapter 7).
The calculator should:
	Use a reduced-complexity climate model or equivalent formulation consistent with current scientific understanding (e.g., impulse-response or emulator-based models).
6.3 Climate System Parameters
The calculator shall be calibrated to climate system behavior consistent with IPCC AR6 assessed ranges, including:
	Equilibrium Climate Sensitivity (ECS)
	Transient Climate Response (TCR)
The calculator shall document:
	The ECS and TCR values or distributions used, and
	The source of calibration (e.g., AR6-consistent parameterization).
6.4 Gas Coverage
The calculator shall explicitly model, at minimum:
	Carbon dioxide (CO₂)
	Methane (CH₄)
The calculator may include additional greenhouse gases and forcing agents where supported by the underlying model.
6.5 Input Requirements
The calculator shall accept:
	Time-resolved greenhouse gas flows Fgas(t)
	With a minimum resolution of one year
	Including both:
	positive emissions
	negative emissions (removals)
The calculator shall require the definition of a temporal reference point (time zero).

6.6 Temporal Treatment
The calculator shall:
	Preserve the timing of emissions and removals without aggregation
	Apply climate response functions consistently across all time steps
The calculator shall not:
	Apply fixed time horizons internally that truncate climate response without disclosure
The calculator should:
	Allow evaluation across flexible reporting horizons (e.g., 20, 50, 100 years)
6.7 Output Requirements
The calculator shall provide, at minimum:
	Instantaneous radiative forcing RF(t)
	Cumulative radiative forcing ∫RF(t)dt
	Temperature response (e.g., ΔT(t))
	Optional relative metrics (e.g., CO₂-equivalent values)
All outputs shall be time-explicit.
6.8 Transparency and Documentation
The calculator shall disclose:
	The underlying climate model or equations used
	Parameter values and their sources
	The IPCC assessment basis (e.g., AR6 alignment)
	Any assumptions related to:
	atmospheric decay
	radiative efficiency
	carbon cycle behavior
6.9 Consistency and Completeness
The calculator shall:
	Apply consistent climate response modeling across all emissions
	Avoid omission of emissions or impacts within the modeled time domain
	Enable assessment over extended time horizons sufficient to capture long-term climate response
6.10 Use of Scenarios in Model CalibrationScenario Treatment
6.10.1 Use of Scenarios in Model Calibration
The calculator should:
	Be calibrated against scenarios or datasets consistent with IPCC AR6 (e.g., SSP-based ensembles).,
	Use such scenarios only for model validation,  and parameterization, and sensitivity analysis, not for determining results. The calculator may provide scenario-dependent outputs where explicitly requested.
	Not prescribe a specific global climate scenario (e.g., 1.5°C, SSP2-4.5, or 2.6 W/m²) as a required basis for calculation.
6.10.2 Prohibition on Fixed Scenario Selection
CCLIMB shall not prescribe a specific global climate scenario (e.g., 1.5°C, SSP2-4.5, or 2.6 W/m²) as a required basis for calculation.
The calculator shall:
	Produce results that are independent of any single assumed future pathway,
	Reflect the physical response to the input emissions trajectory only.
6.10.23 Optional Scenario Use
The calculator may:
	Allow users to run alternative background scenarios for sensitivity analysis,
	Provide scenario-dependent outputs where explicitly requested.
Such scenario-based outputs shall be clearly identified as sensitivity or exploratory results, not primary outputs.


 
Section 7. Implementation Guidelines
7.1 Worked Examples
Include 1-2 products/scenarios from Interface?
Include bio-based panel or whole building LCA from Meta data center?
Does Arup have a particular use case to explore/share?[28.1][29.1]

 
Section 8. Boundaries and Transparency
8.1 Limitations[30.1][31.1] and Assumptions
CCLIMB makes structural assumptions explicit and interprets climate response within defined comparison frameworks. 
CCLIMB does not:
	CCLIMB does not guarantee permanence of atmospheric removal nor predict long-term systemic forest equilibrium responses.
	Eliminate uncertainty associated with reference trajectory selection.

 
Section 9. Reference Material
9.1. Definitions
Reference trajectory (RT): the net flux of CO₂ to the atmosphere that would occur in the absence of the project (carbon-storing product or building). See Section 5 for full calculation and definition.
Product [in relation to CCLIMB]: A biogenic feedstock that has carbon present and/or a product with carbon intentionally incorporated during manufacturing or construction, that is quantifiable at the time of building installation.
Timing-driven systems: feedstocks for which carbon is part of a short-term system, and climate impact is governed primarily by timing effects rather than changes in standing carbon stocks.
Reference-driven systems: feedstocks for which carbon is sourced from a standing biological stock, and use of the feedstock alters the magnitude and/or trajectory of that stock, and the reference trajectory includes continued storage and/or continued sequestration. 
Radiative forcing (RF): The quantified energy (W/m2) gained or lost by the Earth system following an imposed atmospheric perturbation. 
Integrated radiative forcing: The accumulated change in energy from an imposed atmospheric perturbation (carbon emission) within a distinct period of time. Often used as a comparative metric relative to radiative forcing of CO2 (also known as global warming potential or GWP).  
Instantaneous radiative forcing: The immediate change in energy (W/m2) following an imposed atmospheric perturbation (carbon emission), at a distinct time.  Also called ‘effective radiative forcing.’
9.2 Appendices

Use in PCRs and EPDs
(Informative Annex — not part of the declared environmental performance)   A.1 Scope and Purpose
This annex defines a Carbon & Climate Impact Model for Materials and Buildings (CCLIMB) to supplement Environmental Product Declarations (EPDs) for products containing biogenic carbon.
The purpose of this annex is to:
	provide a time-explicit interpretation of climate effects associated with the temporal displacement of biogenic carbon,
	enable comparison between product systems using cumulative climate metrics consistent in logic with GWP100-based assessments,
	improve transparency regarding the climate implications of carbon storage and delayed emissions.
This annex does not modify or replace inventory-based environmental indicators reported in accordance with ISO 14025, EN 15804, or ISO 21930.
A.2 Normative Position within EPDs
A.2.1 General
Results derived using the CCLIMB methodology:
	shall be reported as supplementary information only,
	shall not be included within the core environmental impact indicator tables,
	shall not be used to adjust, offset, or reinterpret declared GWP values.
A.2.2 Relationship to
 Declared Indicators
The Climate Interpretation Overlay:
	does not alter life cycle inventory results,
	does not constitute an environmental impact category under existing LCIA methods,
provides an interpretative layer describing the climate response to inventory-defined carbon flows.
A.3 Definitions
For the purposes of this annex:
A.3.1 Counterfactual trajectory
 The atmospheric carbon pathway representing the most plausible fate of the same biogenic carbon in the absence of the product system.
A.3.2 Product trajectory
 The atmospheric carbon pathway resulting from the production, use, and end-of-life of the declared product.
A.3.3 ΔCRF (100y)
 The difference in cumulative radiative forcing over 100 years between the product trajectory and the counterfactual trajectory.
ΔCRF100=∫0100(RFproduct(t)−RFcounterfactual(t))dt\Delta CRF_{100} = \int_{0}^{100} \left(RF_{product}(t) - RF_{counterfactual}(t)\right) dtΔCRF100=∫0100(RFproduct(t)−RFcounterfactual(t))dt
A.3.4 Climate response pattern
 A qualitative classification describing the temporal behavior of climate forcing (e.g., temporary cooling with reversal).
A.4 Methodological Requirements
A.4.1 General principle
Climate benefit or burden shall be interpreted as:
the difference in climate response between the product trajectory and a defined counterfactual trajectory.
Carbon storage alone shall not be interpreted as a climate benefit.
A.4.2 Counterfactual definition
A counterfactual scenario shall be defined for all products reporting ΔCRF (100y).
The counterfactual shall:
	represent the most plausible atmospheric fate of the same biogenic carbon,
	be consistent with the material category of the product,
	be transparently documented.
A.4.3 Default counterfactuals (where applicable)
Where product category permits, the following default counterfactuals may be used:
Material category	Default counterfactual
Residues / waste streams	Near-term atmospheric return via decomposition or conventional use
Short-rotation crops	Continued short-cycle carbon turnover
Perennial regenerative systems	Continued standing biomass trajectory
Long-rotation woody biomass	Explicit forest counterfactual required (no default permitted)
A.4.4 Time horizon
ΔCRF shall be calculated over a 100-year time horizon to enable comparability with GWP100-based assessments.
A.4.5 System boundaries
The product trajectory shall be based on the life cycle inventory reported in the EPD.
The counterfactual shall represent the same carbon mass outside the product system boundary.
A.5 Reporting Requirements
A.5.1 Mandatory reporting elements
The following information shall be reported when applying CCLIMB:
Item	Requirement
Counterfactual description	Required
ΔCRF (100y) value	Required
Climate response pattern	Required
Statement of interpretation limitations	Required

A.5.2 Recommended reporting format
CCLIMB results shall be reported in a clearly separated section titled:
“Climate Interpretation Overlay (CCLIMB) — Informative Results”
A.5.3 Standard reporting table
Item	Result
Counterfactual definition	___
ΔCRF (100y)	___
Climate response pattern	___
Time-dependent graph available	Yes / No

A.5.4 Required interpretative statement
The following statement shall be included verbatim or with equivalent meaning:
ΔCRF (100y) represents cumulative radiative forcing relative to a defined counterfactual scenario. It is comparable in logic to GWP100-based cumulative assessment but is not a carbon footprint metric and shall not be used as a substitute for GWP100.
A.6 Limitations and Conditions of Use
A.6.1 Non-substitution of GWP
ΔCRF (100y):
	shall not replace GWP100,
	shall not be used as a carbon footprint indicator,
	shall not be used for regulatory compliance or benchmarking purposes without explicit approval.
A.6.2 No crediting or neutrality claims
Results derived under this annex:
	shall not be used to claim carbon neutrality,
	shall not be used as offsets or removal credits,
	shall not be interpreted as permanent carbon sequestration.
A.6.3 Comparability constraints
ΔCRF values shall only be compared when:
	functional units are equivalent,
	system boundaries are consistent,
	counterfactual assumptions are materially equivalent.
A.6.4 Interpretation requirement
ΔCRF (100y) shall not be reported or interpreted without:
	an accompanying counterfactual definition, and
	a qualitative climate response pattern.
A.7 Optional Supplementary Information
The following may be provided:
	time-dependent radiative forcing curves (ΔRF(t)),
	temperature response curves (ΔT(t)),
	additional time horizons (e.g., 20y, 50y),
	impact completeness relative to a long reference horizon.
A.8 Statement of Role
The Climate Interpretation Overlay:
	provides insight into timing-dependent climate response,
	complements existing LCA results,
	does not constitute a certification, accounting, or crediting framework.


Appendix
Feedstock categorization table, detailed
Category	Feedstock source	Feedstock examples	Opportunity cost
A	Residues, co-products and waste/recycling streams		Agricultural by-products (straw, hulls, shells, chaff, stems, meal)
	Forestry by-products (slash, bark, root mass, sawdust/chips, trees removed during non-harvest thinning, urban tree removal)
	Recycling streams (wood, paper, cardboard, textiles)
	Waste streams (sewage, food waste)	
Category A includes feedstocks whose reference trajectory is near-term release of stored carbon and whose diversion does not materially reduce ongoing carbon sink capacity at the ecosystem scale. Burden allocation, durability and end-of-life scenarios are to be derived from inventory source data. 	None
B	Purpose-grown, short-rotation crops		Agricultural crops (hemp, flax, 
	Perennial crops (switchgrass, 
	Algae	
Category B includes purpose-grown crops harvested on annual or near-annual cycles, where carbon uptake and release are part of a short biological turnover and are largely reset each harvest cycle. Burden allocation, durability and end-of-life scenarios are to be derived from inventory source data.	Minimal
C	Perennial crops - primary products		Bamboo
	Cork[32.1][33.1]
	Rubber
	Coconut (fiber, oil)
	Fast-growing woody crops (willow, etc)	
Category C includes feedstocks derived from perennial regenerative systems where harvest does not materially reduce standing carbon stocks (root systems, perennial structures) remain intact and continue net carbon uptake independent of harvest cycles.	Minimal
D	Timber 		All timber species 	
Category D includes long-rotation woody biomass harvested from standing forests where removal reduces the existing forest carbon stock and creates an opportunity cost relative to continued forest growth.	Significant
E	Engineered Atmospheric Carbon Uptake		Carbonated feedstocks from natural sources including algae and microbes
	Carbonated feedstocks sourced from industrial carbon dioxide removal
	Polymers	
Category E includes products in which carbon is intentionally incorporated into material systems during manufacturing or installation through engineered processes, independent of ongoing land-based ecosystem carbon cycling. Does not include gradual atmospheric uptake occurring during the service life of the building (e.g., ambient carbonation of concrete).	None



Draft Reference Trajectories for Tier 2
5.1.2 RT-Low (Optimistic Bound)
Represents a plausible trajectory in which carbon would return to the atmosphere earlier absent building use.
Purpose:
	Demonstrate maximum plausible timing benefit from storage.
5.1.3 RT-High (Conservative Bound)
Represents a plausible trajectory in which carbon would remain out of the atmosphere longer [34.1][35.1]absent building use.
Purpose:
	Expose Provide baseline for opportunity cost of not storing carbon in materials.
	Prevent automatic overstatement of climate benefit claims.
Pending decision: The precise structure and parameterization of RT-Low and RT-High remain subject to working group review.
5.2 Tiered Approach for Category D
For products utilizing Category D[36.1][37.1] (virgin timber) feedstocks, a tiered approach to selecting reference trajectories is suggested. Virgin timber requires structured reference trajectory governance due to:
	Significant potential opportunity cost,
	Scale mismatch between forest carbon systems and product use,
	Baseline instability,
	High sensitivity to timing.
Timber Counterfactual Modeling Tiers (Category D Only)
Tier	Reference Trajectory (RT)	RT-Low	RT-High	Evidentiary Requirements	Intended Use Context
Tier 1 – Commodity Timber (Default)	Harvest-occurs / typical product allocation	Fast-return alternative	Delayed harvest (generic conservative bound)	Minimal sourcing detail required	Expected to apply to most projects and users. Designed to lower barriers to implementation while preserving structured interpretation.
Tier 2 – Managed Regional Context	Business-as-usual (BAU) managed forest trajectory, regionally evidenced	Harvest-occurs fast-return	Regionally parameterized delayed harvest	• Regional forest carbon trend evidence 
• Identification of sourcing region	Appropriate where regional forest management context is known and defensible but stand-level data are unavailable.
Tier 3 – Stand-Specific Sourcing	Documented stand- or ownership-level forest trajectory	Required	Required	• Stand-level or ownership-level forest carbon modeling 
• Explicit documentation of baseline and alternative scenarios	Highest evidentiary rigor. Appropriate where project-level forest data are available and traceable.


 
Next Steps
Outstanding decisions for working group:
	Gross vs net carbon storage treatment (or both),
	Final material categorization,
	Reference trajectory governance details,
	Climate model selection,
	T-ref calibration,
	Governance model for companion documents.



