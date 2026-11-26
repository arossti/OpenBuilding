/**
 * OBJECTIVE 4.0 reference data — the S22 Glossary, inline so the page never
 * fetches it. OBJECTIVE's own terms first (source: "OBJECTIVE"), then the
 * embodied-carbon vocabulary.
 */

export const GLOSSARY = [
  // OBJECTIVE 4.0's own terms (source: "OBJECTIVE"), then the BEAM vocabulary.
  {
    abbr: "TEUI",
    full: "Total Energy Use Intensity",
    desc: "A building's total annual energy use per m² of conditioned floor area, kWh/m²/yr. Key value T.3; worked out in S15.",
    source: "OBJECTIVE"
  },
  {
    abbr: "TEDI",
    full: "Thermal Energy Demand Intensity",
    desc: "The annual space-heating energy the envelope and ventilation demand, per m² of conditioned floor area, before the heating system's efficiency, kWh/m²/yr. S14.",
    source: "OBJECTIVE"
  },
  {
    abbr: "Lifetime Carbon",
    full: "Lifetime emissions intensity (T.1)",
    desc: "Embodied carbon spread over the service life, plus a year's operational emissions, per m² of floor area.",
    source: "OBJECTIVE"
  },
  {
    abbr: "Annual Carbon",
    full: "Annual operational emissions intensity (T.2)",
    desc: "A year's operational greenhouse-gas emissions per m² of floor area, kgCO2e/m²/yr.",
    source: "OBJECTIVE"
  },
  {
    abbr: "Reference",
    full: "Reference building",
    desc: "The same building built to the chosen reference standard. OBJECTIVE works it out beside the design, so every key value has a 100 % baseline.",
    source: "OBJECTIVE"
  },
  {
    abbr: "Target",
    full: "Targeted (design) building",
    desc: "The building as designed, from the values entered; its key values are read against the Reference.",
    source: "OBJECTIVE"
  },
  {
    abbr: "Actual",
    full: "Actual (utility bills)",
    desc: "The building's measured performance, worked out from its utility bills when the project's use type is Utility Bills.",
    source: "OBJECTIVE"
  },
  {
    abbr: "Facing",
    full: "Wall orientation",
    desc: "The compass direction a wall faces. In 4.0 every above-grade wall has one, and its windows' solar gains follow it.",
    source: "OBJECTIVE"
  },
  {
    abbr: "Hosted opening",
    full: "Window, door or skylight in its host",
    desc: "In 4.0 a window or door sits in a named wall, and a skylight in a roof: its area is its width × height, it faces the way its wall faces, and the wall's area is net of it.",
    source: "OBJECTIVE"
  },
  {
    abbr: "Overhang H / D",
    full: "Shading device height and depth",
    desc: "H is the overhang's height above the window head, D its projection from the wall. Together they set the window's summer shading by CSA F280 Annex A.",
    source: "OBJECTIVE"
  },
  {
    abbr: "CSA F280",
    full: "Required capacity of residential space heating and cooling appliances",
    desc: "The Canadian standard for sizing a house's heating and cooling equipment from its design heat loss and heat gain. S21.",
    source: "OBJECTIVE"
  },
  {
    abbr: "ASHRAE 140",
    full: "Method of test for building energy simulation programs",
    desc: "The standard test suite an hourly energy model is checked against; 4.0's bridge to hourly analysis aims at it.",
    source: "OBJECTIVE"
  },
  {
    abbr: "AIM-2",
    full: "Alberta Infiltration Model",
    desc: "The air-leakage model OBJECTIVE uses: it turns a measured airtightness into infiltration under wind and stack effect.",
    source: "OBJECTIVE"
  },
  {
    abbr: "BASESIMP",
    full: "Basement heat-loss correlations",
    desc: "The correlations OBJECTIVE uses for the heat lost through basements and slabs to the ground.",
    source: "OBJECTIVE"
  },
  {
    abbr: "WOMBAT",
    full: "3D Thermal Topology (S19)",
    desc: "S19's 3D view of the thermal envelope, drawn from the section inputs.",
    source: "OBJECTIVE"
  },
  {
    abbr: "Assemblies",
    full: "Building envelope assemblies",
    desc: "Assembly of building materials to form a wall, floor or roof unit. Can be prefabricated or site-built. May or may not include vapor, air, and water barriers."
  },
  {
    abbr: "Carbon Storage or CO2e Storage",
    full: "Biogenic carbon dioxide equivalent storage",
    desc: "The amount of uptake of the element carbon (C) from the atmosphere during a biological process, such as photosynthesis. Each mole of carbon (molar mass = 12) can be equated to one mole of carbon dioxide (molar mass = 44) removed from the atmosphere for the purpose of carbon accounting. Thus 1 carbon element contained in biomass represents 44/12, (approximately 3.67) molecules of biogenic CO2 sequestered from the atmosphere. The transformation of biomass (and its embodied “biogenic” carbon) into products represents in effect a removal of CO2, via its continued storage in the product over a period of time. These are counted as negative emissions."
  },
  {
    abbr: "CLT",
    full: "Cross-Laminated Timber",
    desc: ""
  },
  {
    abbr: "CMU",
    full: "Concrete Masonry Unit",
    desc: ""
  },
  {
    abbr: 'CO2e Emissions or "Carbon"',
    full: "Carbon dioxide equivalent emissions",
    desc: '"Carbon", shorthand for carbon dioxide equivalent emissions, is the standard for measuring GWP attributed to a person, object, process or system with defined boundaries. In general, the term "carbon" may reference material carbon emissions, operational carbon emissions, or the sum of both. The unit is kilograms of CO2 equivalent by total mass or mass per unit (e.g. kg CO2e/m2). For any amount of any greenhouse gas in the atmosphere, it is the amount of CO2 which would warm the Earth as much as the amount of that particular gas. The GWP for CO2 is 1, since it is the baseline reference. For example, the GWP20 of HFC-23 gas is 12,000 kg CO2e, meaning 1 kg of HFC-23 in the atmosphere for 20 years has the same GWP as 12,000 kg of carbon dioxide gas. In this calculator the cradle-to-gate carbon attributed to the building or project is reported as a total and by unit floor area.'
  },
  {
    abbr: "Cob",
    full: "",
    desc: "A traditional building material composed of clay-based soil, sand, and chopped straw. Cob walls are a vapour-open, monolithic, structural assembly, usually plastered on both sides with clay or lime plaster."
  },
  {
    abbr: "Cradle-to-Gate",
    full: "EPD phases A1-A3",
    desc: "Essentially the manufacturing phase, the cradle-to-gate lifecycle phases of a product or material include resource extraction/collection, transportation of materials to be processed, processing/manufacturing and packaging."
  },
  {
    abbr: "CRMCA",
    full: "Canadian Ready-Mixed Concrete Association",
    desc: ""
  },
  {
    abbr: "DLT",
    full: "Dowel Laminated Timber",
    desc: ""
  },
  {
    abbr: "EC3",
    full: "Embodied Carbon in Construction Calculator",
    desc: "An online carbon calculator tool from Building Transparency, developed by C-Change Labs. EC3 is used for counting and comparing embodied carbon of building materials with available EPDs."
  },
  {
    abbr: "Energy Consumption",
    full: "Operational energy consumption",
    desc: "The quantity of energy consumed annually (kW·h/yr) to operate the building over a given time period, usually a year. Operational energy typically includes, but is not limited to, heating, cooling, refrigeration, hot water, ventilation lighting, mechanical equipment and electronics. Often non-electric energy consumption is expressed as a mass or volume of fuel (e.g. wood, natural gas, propane, etc.) required to provide the energy consumed in that period."
  },
  {
    abbr: "EPD",
    full: "Environmental Product Declaration",
    desc: "A transparent, independently verified delaration that quantifies the environmental impacts of the life cycle of a product to enable comparisons between products fulfilling the same function. The EPD methodology is based on the Life Cycle Assessment (LCA) tool that follows International Organization for Standardization (ISO) standards and product category rules (PCRs). This calculator uses the GWP values for phases A1-A3 from EPDs unless otherwise specified."
  },
  {
    abbr: "FA",
    full: "Fly Ash",
    desc: "A byproduct of coal-fired power production. It is used as a Supplementary Cementitious Material (SCM) to replace cement content in concrete production."
  },
  {
    abbr: "FSC",
    full: "Forest Stewardship Council",
    desc: "FSC is an international non-profit, multistakeholder organization that has developed rigorous procedures and global standards for voluntary forest certification systems established for forests and forest products."
  },
  {
    abbr: "GHG",
    full: "Greenhouse Gas (Emissions)",
    desc: "Gases responsible for radiative forcing that traps heat in the atmosphere causing increased global temperatures. Units: kg CO2e"
  },
  {
    abbr: "GLT or Glulam",
    full: "Glue Laminated Timber",
    desc: ""
  },
  {
    abbr: "GU",
    full: "General Use cement type",
    desc: ""
  },
  {
    abbr: "GWP",
    full: "Global Warming Potential",
    desc: "The impact of GHGs attributed to a material, process or system measured in units of kg of CO2e. (See Carbon dioxide equivalent)"
  },
  {
    abbr: "Hempcrete",
    full: "",
    desc: "A building material made with lime (CaO), water and hemp hurd. Hempcrete performs as a vapour-open, insulative-dominant material, with thermal mass properties. Performance and properties change with density and binder formulations. It can be used as infill insulation in walls, floors and roofs, or pre-formed into panels or blocks."
  },
  {
    abbr: "HFC",
    full: "Hydroflurocarbons",
    desc: ""
  },
  {
    abbr: "HFO",
    full: "Hydrofluoroolefins",
    desc: ""
  },
  {
    abbr: "ICE",
    full: "Inventory of Carbon and Energy",
    desc: "Database of embodied energy and carbon of building materials from the University of Bath (UK), Sustainable Energy Research Team. (https://www.bath.ac.uk/teams/sustainable-energy-research-team/)"
  },
  {
    abbr: "ICF",
    full: "Insulated Concrete Forms",
    desc: ""
  },
  {
    abbr: "ISO",
    full: "International Organization for Standardization",
    desc: "An international standard-setting body composed of representatives from various national standards organizations"
  },
  {
    abbr: "kW·h",
    full: "Kilowatt-hours",
    desc: "A metric system unit – power (kJ/s) multiplied by time (hours)  – used to measure electrical energy consumption."
  },
  {
    abbr: "LCA",
    full: "Life Cycle Assessment",
    desc: "Also known as life-cycle analysis, it is a methodology for assessing environmental impacts associated with all the stages of the life-cycle of a product, process, or service. For instance, in the case of a manufactured product, environmental impacts are assessed from raw material extraction and processing (cradle), through the product's manufacturing (gate), distribution and use, and recycling or final disposal of the materials (grave)."
  },
  {
    abbr: "LSL",
    full: "Laminated Strand Lumber",
    desc: ""
  },
  {
    abbr: "LVL",
    full: "Laminated Veneer Lumber",
    desc: ""
  },
  {
    abbr: "MgO",
    full: "Magnesium Oxide",
    desc: ""
  },
  {
    abbr: "MPa",
    full: "Megapascals",
    desc: ""
  },
  {
    abbr: "N. Gas",
    full: "Natural Gas",
    desc: ""
  },
  {
    abbr: "NZC",
    full: "Net Zero Carbon",
    desc: "For embodied carbon, NZC means a parity has been reached of embodied carbon emissions (+) and biogenic carbon storage (-), resulting in a net zero balance of CO2e exchange with the atmosphere. For operational carbon, NZC means any carbon emissions from generating offsite energy consumed annually by the building are offset with carbon credits. Typically a NZ operating carbon building design will prioritize reducing energy consumption and produce on-site energy generation to meet all demand. Definitions and criteria will vary from these descriptions between certification systems and sources."
  },
  {
    abbr: "Off-gassing",
    full: "VOC evaporation",
    desc: "Volatile organic compounds (VOCs) evaporate from some building materials over time, releasing them into the indoor and/or outdoor environment, potentially causing indoor air quality and climate concerns. Off-gassing also refers to the gases that release from some insulation types which use high GHG blowing-agents that leak from the cells during use."
  },
  {
    abbr: "Operational Carbon",
    full: "Operational carbon emissions",
    desc: "Also known as operating carbon, carbon emissions, or simply emissions or carbon, terms that may implicitly exclude embodied carbon. Operation carbon is the mass quantity of CO2e emitted to generate (and sometimes transport) the operational energy consumed in the operation of the building. (see Energy Consumption)"
  },
  {
    abbr: "PSL",
    full: "Parallel Strand Lumber",
    desc: ""
  },
  {
    abbr: "RSI",
    full: "Thermal Resistance per area in SI units",
    desc: "A measure per unit area of resistance to heat flow through a material or assembly of materials in metric/SI units (m2·K/W or m2·°C/W)."
  },
  {
    abbr: "R-Value",
    full: "Thermal Resistance in U.S./imperial units",
    desc: "A measure per unit area of resistance to heat flow through a material or assembly of materials in I-P units (ft2·°F·h/BTU) in the U.S. and Canada, where I-P stands for Inches and Pounds. R-Value is often communicated as R-value per inch of material thickness, or R per inch."
  },
  {
    abbr: "SL",
    full: "Slag",
    desc: "A glass-like byproduct of smelting or refining ore. It is used as a Supplementary Cementitious Material (SCM) to replace cement content in concrete production."
  },
  {
    abbr: "SPF",
    full: "Spruce, Pine, Fir",
    desc: "A group of similar tree species predominantly used for softwood lumber products in various regions of North America, particularly in the East of the continent."
  },
  {
    abbr: "SPFA",
    full: "Spray Polyurethane Foam Association",
    desc: ""
  },
  {
    abbr: "t",
    full: "tonne or metric tonne",
    desc: "One metric tonne, abbrebiated to 't', is a unit equivalent to 1000 kg. This is distinct from US Tons, Short Tons, etc."
  },
  {
    abbr: "W Section",
    full: "Structural steel wide flange I-beam",
    desc: "W-sections form a category of steel beam section profiles with a wide flanged I shape."
  },
  {
    abbr: "Cradle-to-grave",
    full: "EPD phases A, B, and C",
    desc: "Includes the full life cycle from extraction of raw materials from the Earth (the cradle, phase A1 – raw material supply) to the end of the end-of-life process (the grave, phase C4 – disposal).  Does not include phase D – benefits and loads beyond the lifecycle (e.g. recycling)."
  },
  {
    abbr: "EC",
    full: "Embodied Carbon",
    desc: "The lifecycle carbon emissions of the building materials.  Includes emissions from all lifecycle phases of the building except for B6 (operational emissions) and B7 (operational water use)."
  }
];
