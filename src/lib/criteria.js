// Everything a review asks, in one place.
// The order of CRITERIA is the order of the rating screens.
// The keys must match the list inside supabase/setup.sql.

export const GROUPS = {
  property: { label: "The home", short: "Home" },
  area: { label: "The area", short: "Area" },
  management: { label: "Landlord and agent", short: "Landlord" },
};

export const CRITERIA = [
  { key: "damp", group: "property", icon: "💧", label: "Damp and mould", question: "How free of damp and mould was it?", hint: "Condensation, black mould, musty patches, anything that came back." },
  { key: "heating", group: "property", icon: "🔥", label: "Heating", question: "Did the heating keep you warm?", hint: "Think about the coldest weeks of winter." },
  { key: "epc_reality", group: "property", icon: "🌡️", label: "EPC vs reality", question: "Did the EPC rating match how it felt to live there?", hint: "Cold floors, draughts, or bills far above what the certificate suggested all count against it." },
  { key: "windows", group: "property", icon: "🪟", label: "Windows and insulation", question: "How good were the windows and insulation?", hint: "Single or double glazing, draughts, loft and wall insulation." },
  { key: "energy", group: "property", icon: "⚡", label: "Energy bills", question: "How affordable was it to heat and power?", hint: "Compared with similar homes you know." },
  { key: "security", group: "property", icon: "🔒", label: "Locks and security", question: "How secure did it feel?", hint: "Door and window locks, entry systems, lighting." },
  { key: "light", group: "property", icon: "☀️", label: "Natural light", question: "How much natural light did it get?", hint: "Could you go without lights on during the day?" },
  { key: "water", group: "property", icon: "🚿", label: "Water pressure", question: "How was the water pressure?", hint: "Kitchen and shower, at busy times too." },
  { key: "smell", group: "property", icon: "🌿", label: "Air and smell", question: "How fresh was the air?", hint: "Ventilation, lingering smells, drains." },
  { key: "space", group: "property", icon: "📐", label: "Space and storage", question: "Was there enough space and storage?", hint: "Room sizes against what was advertised." },
  { key: "pests", group: "property", icon: "🐭", label: "Pests", question: "How free of pests was it?", hint: "Mice, insects, anything that needed pest control." },
  { key: "cleanliness", group: "property", icon: "✨", label: "Clean at move-in", question: "How clean was it when you moved in?", hint: "Was it properly cleaned between tenants?" },
  { key: "noise", group: "area", icon: "🔇", label: "Quiet", question: "How quiet was it?", hint: "Neighbours, traffic, nightlife, thin walls." },
  { key: "neighbours", group: "area", icon: "🏘️", label: "Neighbours", question: "How considerate were the neighbours?", hint: "Any antisocial behaviour?" },
  { key: "safety", group: "area", icon: "🛡️", label: "Safety", question: "How safe did the area feel?", hint: "Day and night." },
  { key: "parking", group: "area", icon: "🅿️", label: "Parking", question: "How easy was parking?", hint: "If you did not drive, rate it for visitors or deliveries." },
  { key: "mobile_signal", group: "area", icon: "📶", label: "Mobile signal", question: "How good was mobile signal indoors?", hint: "", link: { href: "https://www.ofcom.org.uk/mobile-coverage-checker", text: "Check coverage on Ofcom" } },
  { key: "landlord", group: "management", icon: "👤", label: "Responsiveness", question: "How responsive was the landlord or agent?", hint: "Replies, respect, follow-through." },
  { key: "maintenance", group: "management", icon: "🔧", label: "Repairs", question: "How quickly were repairs done?", hint: "From reporting a problem to it being fixed properly." },
  { key: "rent_fairness", group: "management", icon: "📈", label: "Rent and increases", question: "How fair was the rent, including any increases?", hint: "Were increases reasonable and properly notified?" },
  { key: "value", group: "management", icon: "💷", label: "Value for money", question: "Was it worth the money overall?", hint: "" },
];

export const CRITERIA_KEYS = CRITERIA.map((c) => c.key);
export const CRITERION = Object.fromEntries(CRITERIA.map((c) => [c.key, c]));

export const SCORE_WORDS = { 1: "Awful", 2: "Poor", 3: "Okay", 4: "Good", 5: "Great" };

// Quick filters on search: label shown to people, criterion used to rank.
export const QUICK_FILTERS = [
  { key: "heating", label: "Warm in winter" },
  { key: "damp", label: "No damp" },
  { key: "landlord", label: "Good landlord" },
  { key: "maintenance", label: "Fast repairs" },
  { key: "noise", label: "Quiet" },
  { key: "epc_reality", label: "EPC holds up" },
  { key: "value", label: "Good value" },
];

export const PROPERTY_TYPES = [
  "Studio", "1-bed flat", "2-bed flat", "3+ bed flat", "Room in a shared house",
  "2-bed house", "3-bed house", "4+ bed house", "Other",
];

export const VERIFY_METHODS = [
  { value: "council_tax", label: "Council tax was in my name there" },
  { value: "utility", label: "I had bills in my name there" },
  { value: "electoral", label: "I was on the electoral roll there" },
];

// Set-up questions. type "one" = pick one, "many" = pick any, "text" = free text.
export const DETAILS = [
  { key: "epc_band", label: "EPC rating on the certificate", type: "one", options: ["A", "B", "C", "D", "E", "F", "G", "Not sure"], link: { href: "https://www.gov.uk/find-energy-certificate", text: "Look it up on GOV.UK" } },
  { key: "heating_type", label: "Heating type", type: "one", options: ["Gas boiler", "Electric heaters", "Storage heaters", "Heat pump", "Communal heating", "Not sure"] },
  { key: "furnished", label: "Furnished?", type: "one", options: ["Unfurnished", "Part-furnished", "Fully furnished"] },
  { key: "furniture_condition", label: "Condition of the furniture", type: "one", options: ["Excellent", "Good", "Worn", "Broken or damaged"], showIf: (d) => d.furnished && d.furnished !== "Unfurnished" },
  { key: "white_goods", label: "White goods provided", type: "one", options: ["None", "Some", "Full set"] },
  { key: "white_goods_condition", label: "Condition of the white goods", type: "one", options: ["New or nearly new", "Working well", "Old but working", "Faulty"], showIf: (d) => d.white_goods && d.white_goods !== "None" },
  { key: "water_billing", label: "Water billing", type: "one", options: ["Water meter", "Fixed rate", "Included in rent", "Not sure"] },
  { key: "repairs_managed_by", label: "Who handled repairs?", type: "one", options: ["Landlord", "Letting agent", "Management company", "Unclear"] },
  { key: "decorating_rules", label: "Could you decorate?", type: "one", options: ["Yes, freely", "Small changes only", "Nothing allowed", "Never asked"] },
  { key: "guest_policy", label: "Rules on guests staying long term", type: "one", options: ["No restrictions", "Informal limits", "Strict rules in the contract", "Not sure"] },
  { key: "flood_risk", label: "Flooding", type: "one", options: ["No issues", "Some risk nearby", "It flooded"] },
  { key: "crime_types", label: "If crime was a problem, what kind?", type: "text", placeholder: "For example bike theft or car break-ins" },
  { key: "deposit_returned", label: "Did you get your deposit back?", type: "one", options: ["All of it", "Part of it", "None of it", "Still waiting"] },
  { key: "deposit_issues", label: "What reasons were given for keeping it?", type: "text", placeholder: "For example cleaning charges or wear and tear", showIf: (d) => d.deposit_returned === "Part of it" || d.deposit_returned === "None of it" },
  { key: "left_clean", label: "How did you leave it?", type: "one", options: ["Professionally cleaned", "Cleaned thoroughly myself", "Reasonably clean"] },
];

// Energy upgrade (retrofit) questions, asked on their own screen.
export const RETROFIT_WORKS = [
  "Loft or wall insulation", "Floor insulation", "New windows or doors", "Draught-proofing",
  "New boiler", "Heat pump", "Solar panels", "Smarter heating controls",
];

export const RETROFIT = [
  { key: "retrofit_difference", label: "Did you notice a difference?", type: "one", options: ["Big improvement", "Some improvement", "No real difference", "Made things worse"] },
  { key: "retrofit_disruption", label: "How disruptive were the works?", type: "one", options: ["Barely noticed", "Some disruption", "Major disruption"] },
  { key: "retrofit_rent", label: "Did the rent change because of the works?", type: "one", options: ["No change", "Rent went up", "Not sure"] },
];

export const REPORT_REASONS = [
  { value: "false", label: "It contains false statements of fact" },
  { value: "personal", label: "It names or exposes a private person" },
  { value: "offensive", label: "It is abusive or offensive" },
  { value: "not_tenant", label: "The writer did not live there" },
  { value: "other", label: "Something else" },
];
