/**
 * BEAMweb reference data — inline copies of small, static reference datasets
 * so the app never has to fetch them at runtime and the CSV files can be deleted.
 *
 * Sources (now deleted from docs/csv files from BEAM/):
 *   ENERGY_GHG: MCE² "Energy GHG" sheet (Nov 2023). Province-by-province
 *     GHG intensity factors for the five MCE² energy sources. This tab is
 *     not in BEAM itself; BEAMweb re-adds it as an informational reference.
 *   GLOSSARY:  BEAM / MCE² "Glossary" sheet. 48 terms and definitions.
 *
 * When we get a newer Canadian National Inventory Report update, bump the
 * numbers in place. Project-level overrides will land in Phase 1 once the
 * state manager is in (user can override any province or add a custom row).
 */

export const ENERGY_GHG = {
  units: {
    electricity: "kgCO2e per kWh",
    natural_gas: "kgCO2e per m³",
    oil:         "kgCO2e per L",
    propane:     "kgCO2e per L",
    wood:        "kgCO2e per kg",
  },
  source: "MCE² Nov 2023 workbook · Canadian grid + fuel intensities",
  factors: [
      {
          "province": "Newfoundland and Labrador",
          "electricity_kgco2e_per_kwh": 3.4e-05,
          "natural_gas_kgco2e_per_m3": 0.001912355,
          "oil_kgco2e_per_l": 0.002755438,
          "propane_kgco2e_per_l": 0.001547859,
          "wood_kgco2e_per_kg": 0.00035826
      },
      {
          "province": "Prince Edward Island",
          "electricity_kgco2e_per_kwh": 0.000276,
          "natural_gas_kgco2e_per_m3": 0.001912355,
          "oil_kgco2e_per_l": 0.002755438,
          "propane_kgco2e_per_l": 0.001547859,
          "wood_kgco2e_per_kg": 0.00035826
      },
      {
          "province": "Nova Scotia",
          "electricity_kgco2e_per_kwh": 0.00074,
          "natural_gas_kgco2e_per_m3": 0.001912355,
          "oil_kgco2e_per_l": 0.002755438,
          "propane_kgco2e_per_l": 0.001547859,
          "wood_kgco2e_per_kg": 0.00035826
      },
      {
          "province": "New Brunswick",
          "electricity_kgco2e_per_kwh": 0.000276,
          "natural_gas_kgco2e_per_m3": 0.001912355,
          "oil_kgco2e_per_l": 0.002755438,
          "propane_kgco2e_per_l": 0.001547859,
          "wood_kgco2e_per_kg": 0.00035826
      },
      {
          "province": "Quebec",
          "electricity_kgco2e_per_kwh": 1.62e-06,
          "natural_gas_kgco2e_per_m3": 0.001898355,
          "oil_kgco2e_per_l": 0.002755438,
          "propane_kgco2e_per_l": 0.001547859,
          "wood_kgco2e_per_kg": 0.00035826
      },
      {
          "province": "Ontario",
          "electricity_kgco2e_per_kwh": 3.4e-05,
          "natural_gas_kgco2e_per_m3": 0.001899355,
          "oil_kgco2e_per_l": 0.002755438,
          "propane_kgco2e_per_l": 0.001547859,
          "wood_kgco2e_per_kg": 0.00035826
      },
      {
          "province": "Manitoba",
          "electricity_kgco2e_per_kwh": 2.66e-06,
          "natural_gas_kgco2e_per_m3": 0.001897355,
          "oil_kgco2e_per_l": 0.002755438,
          "propane_kgco2e_per_l": 0.001547859,
          "wood_kgco2e_per_kg": 0.00035826
      },
      {
          "province": "Saskatchewan",
          "electricity_kgco2e_per_kwh": 0.000752,
          "natural_gas_kgco2e_per_m3": 0.001840355,
          "oil_kgco2e_per_l": 0.002755438,
          "propane_kgco2e_per_l": 0.001547859,
          "wood_kgco2e_per_kg": 0.00035826
      },
      {
          "province": "Alberta",
          "electricity_kgco2e_per_kwh": 0.000802,
          "natural_gas_kgco2e_per_m3": 0.001939355,
          "oil_kgco2e_per_l": 0.002755438,
          "propane_kgco2e_per_l": 0.001547859,
          "wood_kgco2e_per_kg": 0.00035826
      },
      {
          "province": "British Columbia",
          "electricity_kgco2e_per_kwh": 1.158e-05,
          "natural_gas_kgco2e_per_m3": 0.001937355,
          "oil_kgco2e_per_l": 0.002755438,
          "propane_kgco2e_per_l": 0.001547859,
          "wood_kgco2e_per_kg": 0.00035826
      },
      {
          "province": "Yukon",
          "electricity_kgco2e_per_kwh": 5.36e-05,
          "natural_gas_kgco2e_per_m3": 0.001912355,
          "oil_kgco2e_per_l": 0.002755438,
          "propane_kgco2e_per_l": 0.001547859,
          "wood_kgco2e_per_kg": 0.00035826
      },
      {
          "province": "Northwest Territories",
          "electricity_kgco2e_per_kwh": 0.000232,
          "natural_gas_kgco2e_per_m3": 0.001912355,
          "oil_kgco2e_per_l": 0.002755438,
          "propane_kgco2e_per_l": 0.001547859,
          "wood_kgco2e_per_kg": 0.00035826
      },
      {
          "province": "Nunavut",
          "electricity_kgco2e_per_kwh": 0.000782,
          "natural_gas_kgco2e_per_m3": 0.001912355,
          "oil_kgco2e_per_l": 0.002755438,
          "propane_kgco2e_per_l": 0.001547859,
          "wood_kgco2e_per_kg": 0.00035826
      }
  ],
};

export const GLOSSARY = [
  {
    "abbr": "Assemblies",
    "full": "Building envelope assemblies",
    "desc": "Assembly of building materials to form a wall, floor or roof unit. Can be prefabricated or site-built. May or may not include vapor, air, and water barriers."
  },
  {
    "abbr": "BfCA",
    "full": "Builders for Climate Action",
    "desc": "A non-profit division of the Endeavour Centre and the developers of this tool."
  },
  {
    "abbr": "Carbon Storage or CO2e Storage",
    "full": "Biogenic carbon dioxide equivalent storage",
    "desc": "The amount of uptake of the element carbon (C) from the atmosphere during a biological process, such as photosynthesis. Each mole of carbon (molar mass = 12) can be equated to one mole of carbon dioxide (molar mass = 44) removed from the atmosphere for the purpose of carbon accounting. Thus 1 carbon element contained in biomass represents 44/12, (approximately 3.67) molecules of biogenic CO2 sequestered from the atmosphere. The transformation of biomass (and its embodied “biogenic” carbon) into products represents in effect a removal of CO2, via its continued storage in the product over a period of time. These are counted as negative emissions."
  },
  {
    "abbr": "CLT",
    "full": "Cross-Laminated Timber",
    "desc": ""
  },
  {
    "abbr": "CMU",
    "full": "Concrete Masonry Unit",
    "desc": ""
  },
  {
    "abbr": "CO2e Emissions or \"Carbon\"",
    "full": "Carbon dioxide equivalent emissions",
    "desc": "\"Carbon\", shorthand for carbon dioxide equivalent emissions, is the standard for measuring GWP attributed to a person, object, process or system with defined boundaries. In general, the term \"carbon\" may reference material carbon emissions, operational carbon emissions, or the sum of both. The unit is kilograms of CO2 equivalent by total mass or mass per unit (e.g. kg CO2e/m2). For any amount of any greenhouse gas in the atmosphere, it is the amount of CO2 which would warm the Earth as much as the amount of that particular gas. The GWP for CO2 is 1, since it is the baseline reference. For example, the GWP20 of HFC-23 gas is 12,000 kg CO2e, meaning 1 kg of HFC-23 in the atmosphere for 20 years has the same GWP as 12,000 kg of carbon dioxide gas. In this calculator the cradle-to-gate carbon attributed to the building or project is reported as a total and by unit floor area."
  },
  {
    "abbr": "Cob",
    "full": "",
    "desc": "A traditional building material composed of clay-based soil, sand, and chopped straw. Cob walls are a vapour-open, monolithic, structural assembly, usually plastered on both sides with clay or lime plaster."
  },
  {
    "abbr": "Cradle-to-Gate",
    "full": "EPD phases A1-A3",
    "desc": "Essentially the manufacturing phase, the cradle-to-gate lifecycle phases of a product or material include resource extraction/collection, transportation of materials to be processed, processing/manufacturing and packaging."
  },
  {
    "abbr": "CRMCA",
    "full": "Canadian Ready-Mixed Concrete Association",
    "desc": ""
  },
  {
    "abbr": "DLT",
    "full": "Dowel Laminated Timber",
    "desc": ""
  },
  {
    "abbr": "EC3",
    "full": "Embodied Carbon in Construction Calculator",
    "desc": "An online carbon calculator tool from Building Transparency, developed by C-Change Labs. EC3 is used for counting and comparing embodied carbon of building materials with available EPDs."
  },
  {
    "abbr": "Energy Consumption",
    "full": "Operational energy consumption",
    "desc": "The quantity of energy consumed annually (kW·h/yr) to operate the building over a given time period, usually a year. Operational energy typically includes, but is not limited to, heating, cooling, refrigeration, hot water, ventilation lighting, mechanical equipment and electronics. Often non-electric energy consumption is expressed as a mass or volume of fuel (e.g. wood, natural gas, propane, etc.) required to provide the energy consumed in that period."
  },
  {
    "abbr": "EPD",
    "full": "Environmental Product Declaration",
    "desc": "A transparent, independently verified delaration that quantifies the environmental impacts of the life cycle of a product to enable comparisons between products fulfilling the same function. The EPD methodology is based on the Life Cycle Assessment (LCA) tool that follows International Organization for Standardization (ISO) standards and product category rules (PCRs). This calculator uses the GWP values for phases A1-A3 from EPDs unless otherwise specified."
  },
  {
    "abbr": "FA",
    "full": "Fly Ash",
    "desc": "A byproduct of coal-fired power production. It is used as a Supplementary Cementitious Material (SCM) to replace cement content in concrete production."
  },
  {
    "abbr": "FSC",
    "full": "Forest Stewardship Council",
    "desc": "FSC is an international non-profit, multistakeholder organization that has developed rigorous procedures and global standards for voluntary forest certification systems established for forests and forest products."
  },
  {
    "abbr": "GHG",
    "full": "Greenhouse Gas (Emissions)",
    "desc": "Gases responsible for radiative forcing that traps heat in the atmosphere causing increased global temperatures. Units: kg CO2e"
  },
  {
    "abbr": "GLT or Glulam",
    "full": "Glue Laminated Timber",
    "desc": ""
  },
  {
    "abbr": "GU",
    "full": "General Use cement type",
    "desc": ""
  },
  {
    "abbr": "GWP",
    "full": "Global Warming Potential",
    "desc": "The impact of GHGs attributed to a material, process or system measured in units of kg of CO2e. (See Carbon dioxide equivalent)"
  },
  {
    "abbr": "Hempcrete",
    "full": "",
    "desc": "A building material made with lime (CaO), water and hemp hurd. Hempcrete performs as a vapour-open, insulative-dominant material, with thermal mass properties. Performance and properties change with density and binder formulations. It can be used as infill insulation in walls, floors and roofs, or pre-formed into panels or blocks."
  },
  {
    "abbr": "HFC",
    "full": "Hydroflurocarbons",
    "desc": ""
  },
  {
    "abbr": "HFO",
    "full": "Hydrofluoroolefins",
    "desc": ""
  },
  {
    "abbr": "ICE",
    "full": "Inventory of Carbon and Energy",
    "desc": "Database of embodied energy and carbon of building materials from the University of Bath (UK), Sustainable Energy Research Team. (https://www.bath.ac.uk/teams/sustainable-energy-research-team/)"
  },
  {
    "abbr": "ICF",
    "full": "Insulated Concrete Forms",
    "desc": ""
  },
  {
    "abbr": "ISO",
    "full": "International Organization for Standardization",
    "desc": "An international standard-setting body composed of representatives from various national standards organizations"
  },
  {
    "abbr": "kW·h",
    "full": "Kilowatt-hours",
    "desc": "A metric system unit – power (kJ/s) multiplied by time (hours)  – used to measure electrical energy consumption."
  },
  {
    "abbr": "LCA",
    "full": "Life Cycle Assessment",
    "desc": "Also known as life-cycle analysis, it is a methodology for assessing environmental impacts associated with all the stages of the life-cycle of a product, process, or service. For instance, in the case of a manufactured product, environmental impacts are assessed from raw material extraction and processing (cradle), through the product's manufacturing (gate), distribution and use, and recycling or final disposal of the materials (grave)."
  },
  {
    "abbr": "LSL",
    "full": "Laminated Strand Lumber",
    "desc": ""
  },
  {
    "abbr": "LVL",
    "full": "Laminated Veneer Lumber",
    "desc": ""
  },
  {
    "abbr": "MCE",
    "full": "Material Carbon Emissions",
    "desc": "MCE is sometimes referred to informally as embodied carbon.  MCEs differ from embodied carbon in that MCEs include the emissions only from the product manufacturing stages (A1 to A3) of the building lifecycle (with a few exceptions), while embodied carbon includes all phases of the lifecycle except B6 (operational emissions) and B7 (operational water use).  This Materials Carbon Emissions Estimator calculates estimated MCEs"
  },
  {
    "abbr": "MgO",
    "full": "Magnesium Oxide",
    "desc": ""
  },
  {
    "abbr": "MPa",
    "full": "Megapascals",
    "desc": ""
  },
  {
    "abbr": "N. Gas",
    "full": "Natural Gas",
    "desc": ""
  },
  {
    "abbr": "NZC",
    "full": "Net Zero Carbon",
    "desc": "For embodied carbon, NZC means a parity has been reached of embodied carbon emissions (+) and biogenic carbon storage (-), resulting in a net zero balance of CO2e exchange with the atmosphere. For operational carbon, NZC means any carbon emissions from generating offsite energy consumed annually by the building are offset with carbon credits. Typically a NZ operating carbon building design will prioritize reducing energy consumption and produce on-site energy generation to meet all demand. Definitions and criteria will vary from these descriptions between certification systems and sources."
  },
  {
    "abbr": "Off-gassing",
    "full": "VOC evaporation",
    "desc": "Volatile organic compounds (VOCs) evaporate from some building materials over time, releasing them into the indoor and/or outdoor environment, potentially causing indoor air quality and climate concerns. Off-gassing also refers to the gases that release from some insulation types which use high GHG blowing-agents that leak from the cells during use."
  },
  {
    "abbr": "Operational Carbon",
    "full": "Operational carbon emissions",
    "desc": "Also known as operating carbon, carbon emissions, or simply emissions or carbon, terms that may implicitly exclude embodied carbon. Operation carbon is the mass quantity of CO2e emitted to generate (and sometimes transport) the operational energy consumed in the operation of the building. (see Energy Consumption)"
  },
  {
    "abbr": "PSL",
    "full": "Parallel Strand Lumber",
    "desc": ""
  },
  {
    "abbr": "RSI",
    "full": "Thermal Resistance per area in SI units",
    "desc": "A measure per unit area of resistance to heat flow through a material or assembly of materials in metric/SI units (m2·K/W or m2·°C/W)."
  },
  {
    "abbr": "R-Value",
    "full": "Thermal Resistance in U.S./imperial units",
    "desc": "A measure per unit area of resistance to heat flow through a material or assembly of materials in I-P units (ft2·°F·h/BTU) in the U.S. and Canada, where I-P stands for Inches and Pounds. R-Value is often communicated as R-value per inch of material thickness, or R per inch."
  },
  {
    "abbr": "SL",
    "full": "Slag",
    "desc": "A glass-like byproduct of smelting or refining ore. It is used as a Supplementary Cementitious Material (SCM) to replace cement content in concrete production."
  },
  {
    "abbr": "SPF",
    "full": "Spruce, Pine, Fir",
    "desc": "A group of similar tree species predominantly used for softwood lumber products in various regions of North America, particularly in the East of the continent."
  },
  {
    "abbr": "SPFA",
    "full": "Spray Polyurethane Foam Association",
    "desc": ""
  },
  {
    "abbr": "t",
    "full": "tonne or metric tonne",
    "desc": "One metric tonne, abbrebiated to 't', is a unit equivalent to 1000 kg. This is distinct from US Tons, Short Tons, etc."
  },
  {
    "abbr": "W Section",
    "full": "Structural steel wide flange I-beam",
    "desc": "W-sections form a category of steel beam section profiles with a wide flanged I shape."
  },
  {
    "abbr": "Cradle-to-grave",
    "full": "EPD phases A, B, and C",
    "desc": "Includes the full life cycle from extraction of raw materials from the Earth (the cradle, phase A1 – raw material supply) to the end of the end-of-life process (the grave, phase C4 – disposal).  Does not include phase D – benefits and loads beyond the lifecycle (e.g. recycling)."
  },
  {
    "abbr": "EC",
    "full": "Embodied Carbon",
    "desc": "The lifecycle carbon emissions of the building materials.  Includes emissions from all lifecycle phases of the building except for B6 (operational emissions) and B7 (operational water use)."
  },
  {
    "abbr": "© His Majesty the King in Right of Canada, as represented by the Minister of Natural Resources, 2023",
    "full": "",
    "desc": ""
  },
  {
    "abbr": "© Sa Majesté le Roi du chef du Canada, représentée par le ministre de Ressources naturelles, 2023",
    "full": "",
    "desc": ""
  }
];
