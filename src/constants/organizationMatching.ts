export interface OrganizationMatchEntry {
  name: string;
  short_forms: string[];
  aliases: string[];
}

export const normalizeOrganizationKey = (value: string): string =>
  value.toLowerCase().replace(/[^a-z0-9]/g, "");

const uniqueNormalizedKeys = (values: string[]): string[] => {
  const keys = new Set<string>();

  for (const value of values) {
    const normalized = normalizeOrganizationKey(value);
    if (normalized) {
      keys.add(normalized);
    }
  }

  return [...keys];
};

export const ORGANIZATION_MATCH_DATA: { organizations: OrganizationMatchEntry[] } = {
  organizations: [
    {
      name: "Institute of Chartered Accountants of India",
      short_forms: ["ICAI"],
      aliases: ["ICAI India", "CA Institute", "Chartered Accountants Institute"],
    },
    {
      name: "All India Institute of Medical Sciences",
      short_forms: ["AIIMS"],
      aliases: ["AIIMS Delhi", "AIIMS Recruitment", "AIIMS Hospital"],
    },
    {
      name: "Airports Authority of India",
      short_forms: ["AAI"],
      aliases: ["AAI India", "Airports Authority"],
    },
    {
      name: "Agricultural and Processed Food Products Export Development Authority",
      short_forms: ["APEDA"],
      aliases: ["APEDA India"],
    },
    {
      name: "Apparel Export Promotion Council",
      short_forms: ["AEPC"],
      aliases: ["AEPC India"],
    },
    {
      name: "Bar Council of India",
      short_forms: ["BCI"],
      aliases: ["Bar Council"],
    },
    {
      name: "Bhabha Atomic Research Centre",
      short_forms: ["BARC"],
      aliases: ["BARC India", "Atomic Research Centre"],
    },
    {
      name: "Bharat Heavy Electricals Limited",
      short_forms: ["BHEL"],
      aliases: ["BHEL India"],
    },
    {
      name: "Bharat Interface for Money",
      short_forms: ["BHIM"],
      aliases: ["BHIM App"],
    },
    {
      name: "Bharat Sanchar Nigam Limited",
      short_forms: ["BSNL"],
      aliases: ["BSNL India"],
    },
    {
      name: "Biotechnology Industry Research Assistance Council",
      short_forms: ["BIRAC"],
      aliases: ["BIRAC India"],
    },
    {
      name: "Bureau of Indian Standards",
      short_forms: ["BIS"],
      aliases: ["BIS Hallmark", "Bureau Standards India"],
    },
    {
      name: "Border Security Force",
      short_forms: ["BSF"],
      aliases: ["BSF India"],
    },
    {
      name: "Bureau of Police Research and Development",
      short_forms: ["BPRD"],
      aliases: ["Police Research Bureau"],
    },
    {
      name: "Capacity Building Commission",
      short_forms: ["CBC"],
      aliases: ["Capacity Building Commission India"],
    },
    {
      name: "Capital Goods Skill Council",
      short_forms: ["CGSC"],
      aliases: ["Skill Council Capital Goods"],
    },
    {
      name: "Central Board of Secondary Education",
      short_forms: ["CBSE"],
      aliases: ["CBSE Board"],
    },
    {
      name: "Central Bureau of Investigation",
      short_forms: ["CBI"],
      aliases: ["CBI India"],
    },
    {
      name: "Central Council for Research in Homoeopathy",
      short_forms: ["CCRH"],
      aliases: ["Homeopathy Research Council"],
    },
    {
      name: "Central Vigilance Commission",
      short_forms: ["CVC"],
      aliases: ["Vigilance Commission India"],
    },
    {
      name: "Centre for Development of Advanced Computing",
      short_forms: ["CDAC", "C-DAC"],
      aliases: ["CDAC India"],
    },
    {
      name: "Coal India Limited",
      short_forms: ["CIL"],
      aliases: ["Coal India"],
    },
    {
      name: "Common Services Centres",
      short_forms: ["CSC"],
      aliases: ["CSC India", "Digital Seva"],
    },
    {
      name: "Competition Commission of India",
      short_forms: ["CCI"],
      aliases: ["Competition Commission"],
    },
    {
      name: "Consortium for Educational Communication",
      short_forms: ["CEC"],
      aliases: ["CEC India"],
    },
    {
      name: "Controller of Certifying Authorities",
      short_forms: ["CCA"],
      aliases: ["Certifying Authority Controller"],
    },
    {
      name: "Council for Leather Exports",
      short_forms: ["CLE"],
      aliases: ["Leather Export Council"],
    },
    {
      name: "Council of Architecture",
      short_forms: ["COA"],
      aliases: ["Architecture Council India"],
    },
    {
      name: "Council of Scientific and Industrial Research",
      short_forms: ["CSIR"],
      aliases: ["CSIR India"],
    },
    {
      name: "Cochin Shipyard Training Institute",
      short_forms: ["CSTI"],
      aliases: ["CSTI India"],
    },
    {
      name: "Defence Research and Development Organisation",
      short_forms: ["DRDO"],
      aliases: ["DRDO India"],
    },
    {
      name: "Dental Council of India",
      short_forms: ["DCI"],
      aliases: ["Dental Council"],
    },
    {
      name: "Digital Tagging System",
      short_forms: ["Digitag"],
      aliases: ["Digitag India"],
    },
    {
      name: "DigitalNIC Services",
      short_forms: ["DigitalNIC"],
      aliases: ["NIC Digital"],
    },
    {
      name: "Direct Benefit Transfer",
      short_forms: ["DBT"],
      aliases: ["DBT Bharat"],
    },
    {
      name: "Education and Research Network of India",
      short_forms: ["ERNET"],
      aliases: ["ERNET India"],
    },
    {
      name: "Educational Consultants India Limited",
      short_forms: ["EdCIL"],
      aliases: ["EdCIL India"],
    },
    {
      name: "Election Commission of India",
      short_forms: ["ECI"],
      aliases: ["Election Commission"],
    },
    {
      name: "Electronics Corporation of India Limited",
      short_forms: ["ECIL"],
      aliases: ["ECIL India"],
    },
    {
      name: "Employees Provident Fund Organisation",
      short_forms: ["EPFO"],
      aliases: ["EPF India", "PF Office"],
    },
    {
      name: "Federation of Indian Chambers of Commerce and Industry",
      short_forms: ["FICCI"],
      aliases: ["FICCI India"],
    },
    {
      name: "Film and Television Institute of India",
      short_forms: ["FTII"],
      aliases: ["FTII Pune"],
    },
    {
      name: "Food Safety and Standards Authority of India",
      short_forms: ["FSSAI"],
      aliases: ["Food Authority India"],
    },
    {
      name: "Gas Authority of India Limited",
      short_forms: ["GAIL"],
      aliases: ["GAIL India"],
    },
    {
      name: "Indian Institutes of Management",
      short_forms: ["IIM"],
      aliases: ["IIM Ahmedabad", "IIM Bangalore", "IIM Calcutta", "IIM Lucknow"],
    },
    {
      name: "Indian Institutes of Technology",
      short_forms: ["IIT"],
      aliases: ["IIT Bombay", "IIT Delhi", "IIT Kharagpur", "IIT Madras"],
    },
    {
      name: "Indian Institutes of Science Education and Research",
      short_forms: ["IISER"],
      aliases: ["IISER Pune", "IISER Kolkata", "IISER Berhampur"],
    },
    {
      name: "Indian Institute of Science",
      short_forms: ["IISc"],
      aliases: ["IISc Bangalore"],
    },
    {
      name: "Indian Army",
      short_forms: ["Army"],
      aliases: ["Indian Army Recruitment"],
    },
    {
      name: "India Post",
      short_forms: ["Post Office"],
      aliases: ["India Post Office", "Postal Department"],
    },
    {
      name: "Indian Computer Emergency Response Team",
      short_forms: ["CERT-In"],
      aliases: ["CERT India"],
    },
    {
      name: "Indian Council of Medical Research",
      short_forms: ["ICMR"],
      aliases: ["Medical Research Council India"],
    },
    {
      name: "Indian Nursing Council",
      short_forms: ["INC"],
      aliases: ["Nursing Council India"],
    },
    {
      name: "Indian Oil Corporation Limited",
      short_forms: ["IOCL"],
      aliases: ["Indian Oil"],
    },
    {
      name: "Indian Railway Catering and Tourism Corporation",
      short_forms: ["IRCTC"],
      aliases: ["IRCTC India"],
    },
    {
      name: "Indian Space Research Organisation",
      short_forms: ["ISRO"],
      aliases: ["ISRO India"],
    },
    {
      name: "Indian Telephone Industries",
      short_forms: ["ITI"],
      aliases: ["ITI Limited"],
    },
    {
      name: "Indira Gandhi National Open University",
      short_forms: ["IGNOU"],
      aliases: ["IGNOU University"],
    },
    {
      name: "Industrial Training Institute",
      short_forms: ["ITI"],
      aliases: ["ITI Institute"],
    },
    {
      name: "Institute of Banking Personnel Selection",
      short_forms: ["IBPS"],
      aliases: ["IBPS Exam"],
    },
    {
      name: "Insurance Regulatory and Development Authority of India",
      short_forms: ["IRDAI"],
      aliases: ["Insurance Regulatory Authority"],
    },
    {
      name: "Intelligence Bureau",
      short_forms: ["IB"],
      aliases: ["IB India"],
    },
    {
      name: "Invest India",
      short_forms: ["Invest India"],
      aliases: ["Investment Promotion Agency"],
    },
    {
      name: "Kendriya Vidyalaya Sangathan",
      short_forms: ["KVS"],
      aliases: ["KVS Schools"],
    },
    {
      name: "Life Insurance Corporation of India",
      short_forms: ["LIC"],
      aliases: ["LIC India"],
    },
    {
      name: "Micro, Small and Medium Enterprises",
      short_forms: ["MSME"],
      aliases: ["MSME Ministry"],
    },
    {
      name: "National Bank for Agriculture and Rural Development",
      short_forms: ["NABARD"],
      aliases: ["NABARD Bank"],
    },
    {
      name: "National AIDS Control Organisation",
      short_forms: ["NACO"],
      aliases: ["AIDS Control Organisation"],
    },
    {
      name: "National Assessment and Accreditation Council",
      short_forms: ["NAAC"],
      aliases: ["NAAC India"],
    },
    {
      name: "National Council for Teacher Education",
      short_forms: ["NCTE"],
      aliases: ["Teacher Education Council"],
    },
    {
      name: "National Council of Educational Research and Training",
      short_forms: ["NCERT"],
      aliases: ["NCERT India"],
    },
    {
      name: "National Informatics Centre",
      short_forms: ["NIC"],
      aliases: ["NIC India"],
    },
    {
      name: "National Institute of Electronics and Information Technology",
      short_forms: ["NIELIT"],
      aliases: ["DOEACC"],
    },
    {
      name: "National Internet Exchange of India",
      short_forms: ["NIXI"],
      aliases: ["Internet Exchange India"],
    },
    {
      name: "National Projects Construction Corporation Limited",
      short_forms: ["NPCC"],
      aliases: ["NPCC India"],
    },
    {
      name: "National Skill Development Corporation",
      short_forms: ["NSDC"],
      aliases: ["Skill Development Corporation"],
    },
    {
      name: "National Testing Agency",
      short_forms: ["NTA"],
      aliases: ["NTA Exams"],
    },
    {
      name: "National Thermal Power Corporation",
      short_forms: ["NTPC"],
      aliases: ["NTPC Limited"],
    },
    {
      name: "Oil and Natural Gas Corporation",
      short_forms: ["ONGC"],
      aliases: ["ONGC India"],
    },
    {
      name: "Pharmaceuticals Export Promotion Council of India",
      short_forms: ["Pharmexcil"],
      aliases: ["Pharma Export Council"],
    },
    {
      name: "Power Finance Corporation",
      short_forms: ["PFC"],
      aliases: ["PFC India"],
    },
    {
      name: "Power Grid Corporation of India",
      short_forms: ["PGCIL"],
      aliases: ["PowerGrid"],
    },
    {
      name: "Press Council of India",
      short_forms: ["PCI"],
      aliases: ["Press Council"],
    },
    {
      name: "Public Service Commission",
      short_forms: ["PSC"],
      aliases: ["State PSC", "UPPSC", "WBPSC"],
    },
    {
      name: "Quality Council of India",
      short_forms: ["QCI"],
      aliases: ["Quality Council"],
    },
    {
      name: "Rail India Technical and Economic Service",
      short_forms: ["RITES"],
      aliases: ["RITES Limited"],
    },
    {
      name: "RailTel Corporation of India",
      short_forms: ["RailTel"],
      aliases: ["RailTel India"],
    },
    {
      name: "Railway Recruitment Board",
      short_forms: ["RRB"],
      aliases: ["Railway Jobs Board"],
    },
    {
      name: "Rehabilitation Council of India",
      short_forms: ["RCI"],
      aliases: ["Rehabilitation Council"],
    },
    {
      name: "Reserve Bank of India",
      short_forms: ["RBI"],
      aliases: ["RBI Bank"],
    },
    {
      name: "Right to Information",
      short_forms: ["RTI"],
      aliases: ["RTI Act"],
    },
    {
      name: "Society for Applied Microwave Electronics Engineering and Research",
      short_forms: ["SAMEER"],
      aliases: ["SAMEER India"],
    },
    {
      name: "Securities and Exchange Board of India",
      short_forms: ["SEBI"],
      aliases: ["SEBI India"],
    },
    {
      name: "Software Technology Parks of India",
      short_forms: ["STPI"],
      aliases: ["STPI India"],
    },
    {
      name: "Sports Authority of India",
      short_forms: ["SAI"],
      aliases: ["SAI India"],
    },
    {
      name: "Staff Selection Commission",
      short_forms: ["SSC"],
      aliases: ["SSC India"],
    },
    {
      name: "Standardisation Testing and Quality Certification",
      short_forms: ["STQC"],
      aliases: ["STQC India"],
    },
    {
      name: "State Bank of India",
      short_forms: ["SBI"],
      aliases: ["SBI Bank"],
    },
    {
      name: "Steel Authority of India Limited",
      short_forms: ["SAIL"],
      aliases: ["SAIL India"],
    },
    {
      name: "Union Public Service Commission",
      short_forms: ["UPSC"],
      aliases: ["UPSC Exams"],
    },
    {
      name: "University Grants Commission",
      short_forms: ["UGC"],
      aliases: ["UGC India"],
    },
  ],
};

/**
 * Helper: generates a standard alias entry for an organization.
 * Given a short form and a normalized full name, returns an array of candidate
 * keys that `resolveLogoFromCandidates` will try against the logoIndex.
 */
const _c = (shortForm: string, fullNorm: string, ...extras: string[]): string[] =>
  [shortForm, fullNorm, ...extras];

export const MANUAL_DEPARTMENT_ALIASES: Record<string, string[]> = {
  // ── SSC ────────────────────────────────────────────────
  ssc: _c("ssc", "staffselectioncommission"),
  staffselectioncommission: _c("ssc", "staffselectioncommission"),
  ssccgl: _c("ssc", "staffselectioncommission"),
  sscchsl: _c("ssc", "staffselectioncommission"),
  sscmts: _c("ssc", "staffselectioncommission"),
  sscgd: _c("ssc", "staffselectioncommission"),
  ssccpo: _c("ssc", "staffselectioncommission"),
  sscje: _c("ssc", "staffselectioncommission"),
  sscindia: _c("ssc", "staffselectioncommission"),

  // ── UPSC ───────────────────────────────────────────────
  upsc: _c("upsc", "unionpublicservicecommission"),
  unionpublicservicecommission: _c("upsc", "unionpublicservicecommission"),
  upscnda: _c("upsc", "unionpublicservicecommission"),
  upsccds: _c("upsc", "unionpublicservicecommission"),
  upscies: _c("upsc", "unionpublicservicecommission"),
  upsciss: _c("upsc", "unionpublicservicecommission"),
  upscese: _c("upsc", "unionpublicservicecommission"),
  upsccias: _c("upsc", "unionpublicservicecommission"),
  upscexams: _c("upsc", "unionpublicservicecommission"),

  // ── IBPS ───────────────────────────────────────────────
  ibps: _c("ibps", "instituteofbankingpersonnelselection"),
  instituteofbankingpersonnelselection: _c("ibps", "instituteofbankingpersonnelselection"),
  ibpspo: _c("ibps", "instituteofbankingpersonnelselection"),
  ibpsclerk: _c("ibps", "instituteofbankingpersonnelselection"),
  ibpsso: _c("ibps", "instituteofbankingpersonnelselection"),
  ibpsrrb: _c("ibps", "instituteofbankingpersonnelselection"),
  ibpsexam: _c("ibps", "instituteofbankingpersonnelselection"),

  // ── RRB ────────────────────────────────────────────────
  rrb: _c("rrb", "railwayrecruitmentboard"),
  railwayrecruitmentboard: _c("rrb", "railwayrecruitmentboard"),
  rrbntpc: _c("rrb", "railwayrecruitmentboard"),
  rrbalp: _c("rrb", "railwayrecruitmentboard"),
  rrbje: _c("rrb", "railwayrecruitmentboard"),
  rrbgroupd: _c("rrb", "railwayrecruitmentboard"),
  indianrailway: _c("rrb", "railwayrecruitmentboard"),
  indianrailways: _c("rrb", "railwayrecruitmentboard"),
  railwayjobsboard: _c("rrb", "railwayrecruitmentboard"),

  // ── SBI ────────────────────────────────────────────────
  sbi: _c("sbi", "statebankofindia"),
  sbipo: _c("sbi", "statebankofindia"),
  sbiclerk: _c("sbi", "statebankofindia"),
  sbiso: _c("sbi", "statebankofindia"),
  sbibank: _c("sbi", "statebankofindia"),
  statebankofindia: _c("sbi", "statebankofindia"),
  statebankofindiapo: _c("sbi", "statebankofindia"),

  // ── RBI ────────────────────────────────────────────────
  rbi: _c("rbi", "reservebankofindia"),
  reservebankofindia: _c("rbi", "reservebankofindia"),
  rbibank: _c("rbi", "reservebankofindia"),

  // ── DRDO ───────────────────────────────────────────────
  drdo: _c("drdo", "defenceresearchanddevelopmentorganisation"),
  defenceresearchanddevelopmentorganisation: _c("drdo", "defenceresearchanddevelopmentorganisation"),
  drdoindia: _c("drdo", "defenceresearchanddevelopmentorganisation"),

  // ── Indian Armed Forces ────────────────────────────────
  indianarmy: _c("indianarmy", "army"),
  army: _c("indianarmy", "army"),
  indianarmyrecruitment: _c("indianarmy", "army"),
  indiannavy: ["indiannavy"],
  indianairforce: ["indianairforce"],

  // ── CBSE ───────────────────────────────────────────────
  cbse: _c("cbse", "centralboardofsecondaryeducation"),
  centralboardofsecondaryeducation: _c("cbse", "centralboardofsecondaryeducation"),
  cbseboard: _c("cbse", "centralboardofsecondaryeducation"),

  // ── NTA ────────────────────────────────────────────────
  nta: _c("nta", "nationaltestingagency"),
  nationaltestingagency: _c("nta", "nationaltestingagency"),
  ntaneet: _c("nta", "nationaltestingagency"),
  ntajee: _c("nta", "nationaltestingagency"),
  ntaexams: _c("nta", "nationaltestingagency"),

  // ── LIC ────────────────────────────────────────────────
  lic: _c("lic", "lifeinsurancecorporationofindia"),
  lifeinsurancecorporationofindia: _c("lic", "lifeinsurancecorporationofindia"),
  licindia: _c("lic", "lifeinsurancecorporationofindia"),

  // ── State PSCs ─────────────────────────────────────────
  ossc: ["ossc"],
  odishastaff: ["ossc"],
  bpsc: ["bpsc"],
  biharpublicservicecommission: ["bpsc", "psc"],
  uppsc: ["uppsc"],
  uttarpradeshpublicservicecommission: ["uppsc", "psc"],
  mpsc: ["mpsc"],
  maharashtrapublicservicecommission: ["mpsc", "psc"],
  rpsc: ["rpsc"],
  rajasthanpublicservicecommission: ["rpsc", "psc"],
  appsc: ["appsc"],
  andhrapradeshpublicservicecommission: ["appsc", "psc"],
  tspsc: ["tspsc"],
  telanganapublicservicecommission: ["tspsc", "psc"],
  kpsc: ["kpsc"],
  kerelapublicservicecommission: ["kpsc", "psc"],
  wbpsc: ["wbpsc"],
  westbengalpublicservicecommission: ["wbpsc", "psc"],

  // ── ICAI ───────────────────────────────────────────────
  icai: _c("icai", "instituteofcharteredaccountantsofindia"),
  instituteofcharteredaccountantsofindia: _c("icai", "instituteofcharteredaccountantsofindia"),
  icaiindia: _c("icai", "instituteofcharteredaccountantsofindia"),
  cainstitute: _c("icai", "instituteofcharteredaccountantsofindia"),
  charteredaccountantsinstitute: _c("icai", "instituteofcharteredaccountantsofindia"),

  // ── AIIMS ──────────────────────────────────────────────
  aiims: _c("aiims", "allindiainstituteofmedicalsciences"),
  allindiainstituteofmedicalsciences: _c("aiims", "allindiainstituteofmedicalsciences"),
  aiimsdelhi: _c("aiims", "allindiainstituteofmedicalsciences"),
  aiimsrecruitment: _c("aiims", "allindiainstituteofmedicalsciences"),
  aiimshospital: _c("aiims", "allindiainstituteofmedicalsciences"),

  // ── AAI ────────────────────────────────────────────────
  aai: _c("aai", "airportsauthorityofindia"),
  airportsauthorityofindia: _c("aai", "airportsauthorityofindia"),
  aaiindia: _c("aai", "airportsauthorityofindia"),
  airportsauthority: _c("aai", "airportsauthorityofindia"),

  // ── APEDA ──────────────────────────────────────────────
  apeda: _c("apeda", "agriculturalandprocessedfoodproductsexportdevelopmentauthority"),
  agriculturalandprocessedfoodproductsexportdevelopmentauthority: _c("apeda", "agriculturalandprocessedfoodproductsexportdevelopmentauthority"),

  // ── AEPC ───────────────────────────────────────────────
  aepc: _c("aepc", "apparelexportpromotioncouncil"),
  apparelexportpromotioncouncil: _c("aepc", "apparelexportpromotioncouncil"),

  // ── BCI ────────────────────────────────────────────────
  bci: _c("bci", "barcouncilofindia"),
  barcouncilofindia: _c("bci", "barcouncilofindia"),
  barcouncil: _c("bci", "barcouncilofindia"),

  // ── BARC ───────────────────────────────────────────────
  barc: _c("barc", "bhabhaatomicresearchcentre"),
  bhabhaatomicresearchcentre: _c("barc", "bhabhaatomicresearchcentre"),
  barcindia: _c("barc", "bhabhaatomicresearchcentre"),
  atomicresearchcentre: _c("barc", "bhabhaatomicresearchcentre"),

  // ── BHEL ───────────────────────────────────────────────
  bhel: _c("bhel", "bharatheavyelectricalslimited"),
  bharatheavyelectricalslimited: _c("bhel", "bharatheavyelectricalslimited"),
  bhelindia: _c("bhel", "bharatheavyelectricalslimited"),

  // ── BHIM ───────────────────────────────────────────────
  bhim: _c("bhim", "bharatinterfaceformoney"),
  bharatinterfaceformoney: _c("bhim", "bharatinterfaceformoney"),
  bhimapp: _c("bhim", "bharatinterfaceformoney"),

  // ── BSNL ───────────────────────────────────────────────
  bsnl: _c("bsnl", "bharatsancharnigamlimited"),
  bharatsancharnigamlimited: _c("bsnl", "bharatsancharnigamlimited"),
  bsnlindia: _c("bsnl", "bharatsancharnigamlimited"),

  // ── BIRAC ──────────────────────────────────────────────
  birac: _c("birac", "biotechnologyindustryresearchassistancecouncil"),
  biotechnologyindustryresearchassistancecouncil: _c("birac", "biotechnologyindustryresearchassistancecouncil"),
  biracindia: _c("birac", "biotechnologyindustryresearchassistancecouncil"),

  // ── BIS ────────────────────────────────────────────────
  bis: _c("bis", "bureauofindianstandards"),
  bureauofindianstandards: _c("bis", "bureauofindianstandards"),
  bishallmark: _c("bis", "bureauofindianstandards"),

  // ── BSF ────────────────────────────────────────────────
  bsf: _c("bsf", "bordersecurityforce"),
  bordersecurityforce: _c("bsf", "bordersecurityforce"),
  bsfindia: _c("bsf", "bordersecurityforce"),

  // ── BPRD ───────────────────────────────────────────────
  bprd: _c("bprd", "bureauofpoliceresearchanddevelopment"),
  bureauofpoliceresearchanddevelopment: _c("bprd", "bureauofpoliceresearchanddevelopment"),

  // ── CBC ────────────────────────────────────────────────
  cbc: _c("cbc", "capacitybuildingcommission"),
  capacitybuildingcommission: _c("cbc", "capacitybuildingcommission"),

  // ── CGSC ───────────────────────────────────────────────
  cgsc: _c("cgsc", "capitalgoodsskillcouncil"),
  capitalgoodsskillcouncil: _c("cgsc", "capitalgoodsskillcouncil"),

  // ── CBI ────────────────────────────────────────────────
  cbi: _c("cbi", "centralbureauofinvestigation"),
  centralbureauofinvestigation: _c("cbi", "centralbureauofinvestigation"),
  cbiindia: _c("cbi", "centralbureauofinvestigation"),

  // ── CCRH ───────────────────────────────────────────────
  ccrh: _c("ccrh", "centralcouncilforresearchinhomoeopathy"),
  centralcouncilforresearchinhomoeopathy: _c("ccrh", "centralcouncilforresearchinhomoeopathy"),
  homeopathyresearchcouncil: _c("ccrh", "centralcouncilforresearchinhomoeopathy"),

  // ── CVC ────────────────────────────────────────────────
  cvc: _c("cvc", "centralvigilancecommission"),
  centralvigilancecommission: _c("cvc", "centralvigilancecommission"),

  // ── CDAC / C-DAC ───────────────────────────────────────
  cdac: _c("cdac", "centrefordevelopmentofadvancedcomputing"),
  centrefordevelopmentofadvancedcomputing: _c("cdac", "centrefordevelopmentofadvancedcomputing"),
  cdacindia: _c("cdac", "centrefordevelopmentofadvancedcomputing"),

  // ── CIL ────────────────────────────────────────────────
  cil: _c("cil", "coalindialimited", "coalindia"),
  coalindialimited: _c("cil", "coalindialimited", "coalindia"),
  coalindia: _c("cil", "coalindialimited", "coalindia"),

  // ── CSC ────────────────────────────────────────────────
  csc: _c("csc", "commonservicescentres"),
  commonservicescentres: _c("csc", "commonservicescentres"),
  cscindia: _c("csc", "commonservicescentres"),
  digitalseva: _c("csc", "commonservicescentres"),

  // ── CCI ────────────────────────────────────────────────
  cci: _c("cci", "competitioncommissionofindia"),
  competitioncommissionofindia: _c("cci", "competitioncommissionofindia"),
  competitioncommission: _c("cci", "competitioncommissionofindia"),

  // ── CEC ────────────────────────────────────────────────
  cec: _c("cec", "consortiumforeducationalcommunication"),
  consortiumforeducationalcommunication: _c("cec", "consortiumforeducationalcommunication"),

  // ── CCA ────────────────────────────────────────────────
  cca: _c("cca", "controllerofcertifyingauthorities"),
  controllerofcertifyingauthorities: _c("cca", "controllerofcertifyingauthorities"),

  // ── CLE ────────────────────────────────────────────────
  cle: _c("cle", "councilforleatherexports"),
  councilforleatherexports: _c("cle", "councilforleatherexports"),
  leatherexportcouncil: _c("cle", "councilforleatherexports"),

  // ── COA ────────────────────────────────────────────────
  coa: _c("coa", "councilofarchitecture"),
  councilofarchitecture: _c("coa", "councilofarchitecture"),

  // ── CSIR ───────────────────────────────────────────────
  csir: _c("csir", "councilofscientificandindustrialresearch"),
  councilofscientificandindustrialresearch: _c("csir", "councilofscientificandindustrialresearch"),
  csirindia: _c("csir", "councilofscientificandindustrialresearch"),
  csirnet: _c("csir", "councilofscientificandindustrialresearch"),
  csirugrnet: _c("csir", "councilofscientificandindustrialresearch"),
  csirgcnet: _c("csir", "councilofscientificandindustrialresearch"),

  // ── CSTI ───────────────────────────────────────────────
  csti: _c("csti", "cochinshipyardtraininginstitute"),
  cochinshipyardtraininginstitute: _c("csti", "cochinshipyardtraininginstitute"),

  // ── DCI ────────────────────────────────────────────────
  dci: _c("dci", "dentalcouncilofindia"),
  dentalcouncilofindia: _c("dci", "dentalcouncilofindia"),
  dentalcouncil: _c("dci", "dentalcouncilofindia"),

  // ── DBT ────────────────────────────────────────────────
  dbt: _c("dbt", "directbenefittransfer"),
  directbenefittransfer: _c("dbt", "directbenefittransfer"),
  dbtbharat: _c("dbt", "directbenefittransfer"),

  // ── ERNET ──────────────────────────────────────────────
  ernet: _c("ernet", "educationandresearchnetworkofindia"),
  educationandresearchnetworkofindia: _c("ernet", "educationandresearchnetworkofindia"),
  ernetindia: _c("ernet", "educationandresearchnetworkofindia"),

  // ── EdCIL ──────────────────────────────────────────────
  edcil: _c("edcil", "educationalconsultantsindialimited"),
  educationalconsultantsindialimited: _c("edcil", "educationalconsultantsindialimited"),
  edcilindia: _c("edcil", "educationalconsultantsindialimited"),

  // ── ECI ────────────────────────────────────────────────
  eci: _c("eci", "electioncommissionofindia"),
  electioncommissionofindia: _c("eci", "electioncommissionofindia"),
  electioncommission: _c("eci", "electioncommissionofindia"),

  // ── ECIL ───────────────────────────────────────────────
  ecil: _c("ecil", "electronicscorporationofindialimited"),
  electronicscorporationofindialimited: _c("ecil", "electronicscorporationofindialimited"),

  // ── EPFO ───────────────────────────────────────────────
  epfo: _c("epfo", "employeesprovidentfundorganisation"),
  employeesprovidentfundorganisation: _c("epfo", "employeesprovidentfundorganisation"),
  epfindia: _c("epfo", "employeesprovidentfundorganisation"),
  pfoffice: _c("epfo", "employeesprovidentfundorganisation"),

  // ── FICCI ──────────────────────────────────────────────
  ficci: _c("ficci", "federationofindianchambersofcommerceandindustry"),
  federationofindianchambersofcommerceandindustry: _c("ficci", "federationofindianchambersofcommerceandindustry"),
  ficciindia: _c("ficci", "federationofindianchambersofcommerceandindustry"),

  // ── FTII ───────────────────────────────────────────────
  ftii: _c("ftii", "filmandtelevisioninstituteofindia"),
  filmandtelevisioninstituteofindia: _c("ftii", "filmandtelevisioninstituteofindia"),
  ftiipune: _c("ftii", "filmandtelevisioninstituteofindia"),

  // ── FSSAI ──────────────────────────────────────────────
  fssai: _c("fssai", "foodsafetyandstandardsauthorityofindia"),
  foodsafetyandstandardsauthorityofindia: _c("fssai", "foodsafetyandstandardsauthorityofindia"),
  fssairecruitment: _c("fssai", "foodsafetyandstandardsauthorityofindia"),
  foodauthorityindia: _c("fssai", "foodsafetyandstandardsauthorityofindia"),

  // ── GAIL ───────────────────────────────────────────────
  gail: _c("gail", "gasauthorityofindialimited"),
  gasauthorityofindialimited: _c("gail", "gasauthorityofindialimited"),
  gailindia: _c("gail", "gasauthorityofindialimited"),

  // ── IIM ────────────────────────────────────────────────
  iim: _c("iim", "indianinstitutesofmanagement"),
  indianinstitutesofmanagement: _c("iim", "indianinstitutesofmanagement"),
  iimahmedabad: _c("iim", "indianinstitutesofmanagement"),
  iimbangalore: _c("iim", "indianinstitutesofmanagement"),
  iimcalcutta: _c("iim", "indianinstitutesofmanagement"),
  iimlucknow: _c("iim", "indianinstitutesofmanagement"),

  // ── IIT ────────────────────────────────────────────────
  iit: _c("iit", "indianinstitutesoftechnology"),
  indianinstitutesoftechnology: _c("iit", "indianinstitutesoftechnology"),
  iitbombay: _c("iit", "indianinstitutesoftechnology"),
  iitdelhi: _c("iit", "indianinstitutesoftechnology"),
  iitkharagpur: _c("iit", "indianinstitutesoftechnology"),
  iitmadras: _c("iit", "indianinstitutesoftechnology"),

  // ── IISER ──────────────────────────────────────────────
  iiser: _c("iiser", "indianinstitutesofscienceeducationandresearch"),
  indianinstitutesofscienceeducationandresearch: _c("iiser", "indianinstitutesofscienceeducationandresearch"),
  iiserpune: _c("iiser", "indianinstitutesofscienceeducationandresearch"),

  // ── IISc ───────────────────────────────────────────────
  iisc: _c("iisc", "indianinstituteofscience"),
  indianinstituteofscience: _c("iisc", "indianinstituteofscience"),
  iiscbangalore: _c("iisc", "indianinstituteofscience"),

  // ── India Post ─────────────────────────────────────────
  indiapost: _c("indiapost", "postoffice", "postaldepartment"),
  postoffice: _c("indiapost", "postoffice", "postaldepartment"),
  indiapostoffice: _c("indiapost", "postoffice", "postaldepartment"),
  postaldepartment: _c("indiapost", "postoffice", "postaldepartment"),

  // ── CERT-In ────────────────────────────────────────────
  certin: _c("certin", "indiancomputeremergencyresponseteam"),
  indiancomputeremergencyresponseteam: _c("certin", "indiancomputeremergencyresponseteam"),
  certindia: _c("certin", "indiancomputeremergencyresponseteam"),

  // ── ICMR ───────────────────────────────────────────────
  icmr: _c("icmr", "indiancouncilofmedicalresearch"),
  indiancouncilofmedicalresearch: _c("icmr", "indiancouncilofmedicalresearch"),

  // ── INC ────────────────────────────────────────────────
  inc: _c("inc", "indiannursingcouncil"),
  indiannursingcouncil: _c("inc", "indiannursingcouncil"),
  nursingcouncilindia: _c("inc", "indiannursingcouncil"),

  // ── IOCL / Indian Oil ──────────────────────────────────
  iocl: _c("iocl", "indianoilcorporationlimited", "indianoil"),
  indianoilcorporationlimited: _c("iocl", "indianoilcorporationlimited", "indianoil"),
  indianoil: _c("iocl", "indianoilcorporationlimited", "indianoil"),

  // ── IRCTC ──────────────────────────────────────────────
  irctc: _c("irctc", "indianrailwaycateringandtourismcorporation"),
  indianrailwaycateringandtourismcorporation: _c("irctc", "indianrailwaycateringandtourismcorporation"),
  irctcindia: _c("irctc", "indianrailwaycateringandtourismcorporation"),

  // ── ISRO ───────────────────────────────────────────────
  isro: _c("isro", "indianspaceresearchorganisation"),
  indianspaceresearchorganisation: _c("isro", "indianspaceresearchorganisation"),
  isroindia: _c("isro", "indianspaceresearchorganisation"),

  // ── IGNOU ──────────────────────────────────────────────
  ignou: _c("ignou", "indiragandhirationalopenuniversity"),
  indiragandhirationalopenuniversity: _c("ignou", "indiragandhirationalopenuniversity"),
  ignouuniversity: _c("ignou", "indiragandhirationalopenuniversity"),

  // ── IRDAI ──────────────────────────────────────────────
  irdai: _c("irdai", "insuranceregulatoryandevelopmentauthorityofindia"),
  insuranceregulatoryandevelopmentauthorityofindia: _c("irdai", "insuranceregulatoryandevelopmentauthorityofindia"),
  insuranceregulatoryauthority: _c("irdai", "insuranceregulatoryandevelopmentauthorityofindia"),

  // ── IB ─────────────────────────────────────────────────
  ib: _c("ib", "intelligencebureau"),
  intelligencebureau: _c("ib", "intelligencebureau"),
  ibindia: _c("ib", "intelligencebureau"),

  // ── Invest India ───────────────────────────────────────
  investindia: _c("investindia", "investmentpromotionagency"),
  investmentpromotionagency: _c("investindia", "investmentpromotionagency"),

  // ── KVS ────────────────────────────────────────────────
  kvs: _c("kvs", "kendriyavidyalayasangathan"),
  kendriyavidyalayasangathan: _c("kvs", "kendriyavidyalayasangathan"),
  kvsschools: _c("kvs", "kendriyavidyalayasangathan"),

  // ── MSME ───────────────────────────────────────────────
  msme: _c("msme", "microsmallandmediumenterprises"),
  microsmallandmediumenterprises: _c("msme", "microsmallandmediumenterprises"),
  msmeministry: _c("msme", "microsmallandmediumenterprises"),

  // ── NABARD ─────────────────────────────────────────────
  nabard: _c("nabard", "nationalbankforagricultureandruraldevdevelopment"),
  nationalbankforagricultureandruraldevelopment: _c("nabard", "nationalbankforagricultureandruraldevdevelopment"),
  nabardbank: _c("nabard", "nationalbankforagricultureandruraldevdevelopment"),

  // ── NACO ───────────────────────────────────────────────
  naco: _c("naco", "nationalaidscontrolorganisation"),
  nationalaidscontrolorganisation: _c("naco", "nationalaidscontrolorganisation"),
  aidscontrolorganisation: _c("naco", "nationalaidscontrolorganisation"),

  // ── NAAC ───────────────────────────────────────────────
  naac: _c("naac", "nationalassessmentandaccreditationcouncil"),
  nationalassessmentandaccreditationcouncil: _c("naac", "nationalassessmentandaccreditationcouncil"),

  // ── NCTE ───────────────────────────────────────────────
  ncte: _c("ncte", "nationalcouncilforteachereducation"),
  nationalcouncilforteachereducation: _c("ncte", "nationalcouncilforteachereducation"),
  teachereducationcouncil: _c("ncte", "nationalcouncilforteachereducation"),

  // ── NCERT ──────────────────────────────────────────────
  ncert: _c("ncert", "nationalcouncilofeducationalresearchandtraining"),
  nationalcouncilofeducationalresearchandtraining: _c("ncert", "nationalcouncilofeducationalresearchandtraining"),
  ncertindia: _c("ncert", "nationalcouncilofeducationalresearchandtraining"),

  // ── NIC ────────────────────────────────────────────────
  nic: _c("nic", "nationalinformaticscentre"),
  nationalinformaticscentre: _c("nic", "nationalinformaticscentre"),
  nicindia: _c("nic", "nationalinformaticscentre"),

  // ── NIELIT ─────────────────────────────────────────────
  nielit: _c("nielit", "nationalinstituteofelectronicsandinformationtechnology", "doeacc"),
  nationalinstituteofelectronicsandinformationtechnology: _c("nielit", "nationalinstituteofelectronicsandinformationtechnology", "doeacc"),
  doeacc: _c("nielit", "nationalinstituteofelectronicsandinformationtechnology", "doeacc"),

  // ── NIXI ───────────────────────────────────────────────
  nixi: _c("nixi", "nationalinternetexchangeofindia"),
  nationalinternetexchangeofindia: _c("nixi", "nationalinternetexchangeofindia"),

  // ── NPCC ───────────────────────────────────────────────
  npcc: _c("npcc", "nationalprojectsconstructioncorporationlimited"),
  nationalprojectsconstructioncorporationlimited: _c("npcc", "nationalprojectsconstructioncorporationlimited"),

  // ── NSDC ───────────────────────────────────────────────
  nsdc: _c("nsdc", "nationalskilldevelopmentcorporation"),
  nationalskilldevelopmentcorporation: _c("nsdc", "nationalskilldevelopmentcorporation"),
  skilldevelopmentcorporation: _c("nsdc", "nationalskilldevelopmentcorporation"),

  // ── NTPC ───────────────────────────────────────────────
  ntpc: _c("ntpc", "nationalthermalpowercorporation"),
  nationalthermalpowercorporation: _c("ntpc", "nationalthermalpowercorporation"),
  ntpclimited: _c("ntpc", "nationalthermalpowercorporation"),

  // ── ONGC ───────────────────────────────────────────────
  ongc: _c("ongc", "oilandnaturalgascorporation"),
  oilandnaturalgascorporation: _c("ongc", "oilandnaturalgascorporation"),
  ongcindia: _c("ongc", "oilandnaturalgascorporation"),

  // ── Pharmexcil ─────────────────────────────────────────
  pharmexcil: _c("pharmexcil", "pharmaceuticalsexportpromotioncouncilofindia"),
  pharmaceuticalsexportpromotioncouncilofindia: _c("pharmexcil", "pharmaceuticalsexportpromotioncouncilofindia"),
  pharmaexportcouncil: _c("pharmexcil", "pharmaceuticalsexportpromotioncouncilofindia"),

  // ── PFC ────────────────────────────────────────────────
  pfc: _c("pfc", "powerfinancecorporation"),
  powerfinancecorporation: _c("pfc", "powerfinancecorporation"),

  // ── PGCIL ──────────────────────────────────────────────
  pgcil: _c("pgcil", "powergridcorporationofindia", "powergrid"),
  powergridcorporationofindia: _c("pgcil", "powergridcorporationofindia", "powergrid"),
  powergrid: _c("pgcil", "powergridcorporationofindia", "powergrid"),

  // ── PCI ────────────────────────────────────────────────
  pci: _c("pci", "presscouncilofindia"),
  presscouncilofindia: _c("pci", "presscouncilofindia"),
  presscouncil: _c("pci", "presscouncilofindia"),

  // ── QCI ────────────────────────────────────────────────
  qci: _c("qci", "qualitycouncilofindia"),
  qualitycouncilofindia: _c("qci", "qualitycouncilofindia"),
  qualitycouncil: _c("qci", "qualitycouncilofindia"),

  // ── RITES ──────────────────────────────────────────────
  rites: _c("rites", "railindiatechnicalandeconomicservice"),
  railindiatechnicalandeconomicservice: _c("rites", "railindiatechnicalandeconomicservice"),
  riteslimited: _c("rites", "railindiatechnicalandeconomicservice"),

  // ── RailTel ────────────────────────────────────────────
  railtel: _c("railtel", "railtelcorporationofindia"),
  railtelcorporationofindia: _c("railtel", "railtelcorporationofindia"),
  railtelindia: _c("railtel", "railtelcorporationofindia"),

  // ── RCI ────────────────────────────────────────────────
  rci: _c("rci", "rehabilitationcouncilofindia"),
  rehabilitationcouncilofindia: _c("rci", "rehabilitationcouncilofindia"),
  rehabilitationcouncil: _c("rci", "rehabilitationcouncilofindia"),

  // ── RTI ────────────────────────────────────────────────
  rti: _c("rti", "righttoinformation"),
  righttoinformation: _c("rti", "righttoinformation"),

  // ── SAMEER ─────────────────────────────────────────────
  sameer: _c("sameer", "societyforappliedmicrowaveelectronicsengineeringandresearch"),
  societyforappliedmicrowaveelectronicsengineeringandresearch: _c("sameer", "societyforappliedmicrowaveelectronicsengineeringandresearch"),

  // ── SEBI ───────────────────────────────────────────────
  sebi: _c("sebi", "securitiesandexchangeboardofindia"),
  securitiesandexchangeboardofindia: _c("sebi", "securitiesandexchangeboardofindia"),
  sebiindia: _c("sebi", "securitiesandexchangeboardofindia"),

  // ── STPI ───────────────────────────────────────────────
  stpi: _c("stpi", "softwaretechnologyparksofindia"),
  softwaretechnologyparksofindia: _c("stpi", "softwaretechnologyparksofindia"),
  stpiindia: _c("stpi", "softwaretechnologyparksofindia"),

  // ── SAI ────────────────────────────────────────────────
  sai: _c("sai", "sportsauthorityofindia"),
  sportsauthorityofindia: _c("sai", "sportsauthorityofindia"),
  saiindia: _c("sai", "sportsauthorityofindia"),

  // ── STQC ───────────────────────────────────────────────
  stqc: _c("stqc", "standardisationtestingandqualitycertification"),
  standardisationtestingandqualitycertification: _c("stqc", "standardisationtestingandqualitycertification"),

  // ── SAIL ───────────────────────────────────────────────
  sail: _c("sail", "steelauthorityofindialimited"),
  steelauthorityofindialimited: _c("sail", "steelauthorityofindialimited"),
  sailindia: _c("sail", "steelauthorityofindialimited"),

  // ── UGC ────────────────────────────────────────────────
  ugc: _c("ugc", "universitygrantscommission"),
  universitygrantscommission: _c("ugc", "universitygrantscommission"),
  ugcindia: _c("ugc", "universitygrantscommission"),
};

const organizationCandidateLookup = new Map<string, string[]>();
const organizationOwners = new Map<string, Set<string>>();

for (const organization of ORGANIZATION_MATCH_DATA.organizations) {
  const candidateKeys = uniqueNormalizedKeys([
    organization.name,
    ...organization.short_forms,
    ...organization.aliases,
  ]);

  organizationCandidateLookup.set(organization.name, candidateKeys);

  for (const key of candidateKeys) {
    const owners = organizationOwners.get(key) || new Set<string>();
    owners.add(organization.name);
    organizationOwners.set(key, owners);
  }
}

export const ORGANIZATION_ALIAS_LOOKUP = new Map<string, string[]>();

for (const organization of ORGANIZATION_MATCH_DATA.organizations) {
  const candidateKeys = organizationCandidateLookup.get(organization.name) || [];

  for (const key of candidateKeys) {
    const owners = organizationOwners.get(key);
    if (owners?.size === 1) {
      ORGANIZATION_ALIAS_LOOKUP.set(key, candidateKeys);
    }
  }
}