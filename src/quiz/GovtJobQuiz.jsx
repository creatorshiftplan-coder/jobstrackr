import { useState } from "react";

const EDUCATION_ORDER = ["10th", "12th", "diploma", "btech", "bsc", "ba", "bcom", "llb", "graduate", "pg"];

const EXAMS = [
  // ── UPSC ──
  { id:"upsc-cse", name:"UPSC Civil Services", body:"UPSC", tag:"IAS / IPS / IFS",
    minEducation:"graduate", minAge:21, maxAge:{general:32,obc:35,sc:37,st:37,ews:32},
    states:[], sectors:["administration","police","foreign"],
    interests:["gk","polity","history","geography"],
    salaryRange:[56100,250000], difficulty:"hard", languages:["english","hindi"],
    desc:"India's most prestigious exam. Entry to IAS, IPS, IFS and 22 other services.",
    educationTags:["Any Graduate"] },

  { id:"upsc-capf", name:"UPSC CAPF", body:"UPSC", tag:"Assistant Commandant",
    minEducation:"graduate", minAge:20, maxAge:{general:25,obc:28,sc:30,st:30,ews:25},
    states:[], sectors:["police","defence","paramilitary"],
    interests:["gk","polity","physical"],
    salaryRange:[56100,177500], difficulty:"hard", languages:["english","hindi"],
    desc:"Officer rank in BSF, CRPF, CISF, ITBP, SSB paramilitary forces.",
    educationTags:["Any Graduate"] },

  { id:"upsc-ese", name:"UPSC ESE / IES", body:"UPSC", tag:"Engineering Services",
    minEducation:"btech", minAge:21, maxAge:{general:30,obc:33,sc:35,st:35,ews:30},
    states:[], sectors:["engineering","technical","administration"],
    interests:["science","maths","technical"],
    salaryRange:[56100,177500], difficulty:"hard", languages:["english"],
    desc:"Engineer officers in railways, telecom, defence, CPWD. Engineering graduates only.",
    educationTags:["B.Tech / B.E"] },

  { id:"nda", name:"NDA / NA", body:"UPSC", tag:"Defence Officer",
    minEducation:"12th", minAge:16.5, maxAge:{general:19.5,obc:19.5,sc:19.5,st:19.5,ews:19.5},
    states:[], sectors:["defence","army","navy","airforce"],
    interests:["maths","gk","physical","science"],
    salaryRange:[56100,177500], difficulty:"medium", languages:["english","hindi"],
    desc:"Entry to Army, Navy, Air Force as officer. Only for 12th pass students.",
    educationTags:["12th Pass"] },

  { id:"cds", name:"CDS", body:"UPSC", tag:"Combined Defence Services",
    minEducation:"graduate", minAge:19, maxAge:{general:25,obc:25,sc:25,st:25,ews:25},
    states:[], sectors:["defence","army","navy","airforce"],
    interests:["gk","english","maths","physical"],
    salaryRange:[56100,177500], difficulty:"medium", languages:["english"],
    desc:"Officer entry into Army, Navy, Air Force for graduates.",
    educationTags:["Any Graduate"] },

  // ── SSC ──
  { id:"ssc-cgl", name:"SSC CGL", body:"SSC", tag:"Group B & C Central Govt",
    minEducation:"graduate", minAge:18, maxAge:{general:27,obc:30,sc:32,st:32,ews:27},
    states:[], sectors:["administration","tax","audit","statistics"],
    interests:["maths","reasoning","english","gk"],
    salaryRange:[25500,81100], difficulty:"medium", languages:["english","hindi"],
    desc:"Most popular central govt exam. Thousands of posts across all ministries.",
    educationTags:["Any Graduate"] },

  { id:"ssc-chsl", name:"SSC CHSL", body:"SSC", tag:"10+2 Level Posts",
    minEducation:"12th", minAge:18, maxAge:{general:27,obc:30,sc:32,st:32,ews:27},
    states:[], sectors:["administration","postal"],
    interests:["maths","reasoning","english","gk"],
    salaryRange:[19900,34800], difficulty:"easy", languages:["english","hindi"],
    desc:"LDC, JSA, PA, SA posts in central govt departments and ministries.",
    educationTags:["12th Pass"] },

  { id:"ssc-mts", name:"SSC MTS", body:"SSC", tag:"Multi Tasking Staff",
    minEducation:"10th", minAge:18, maxAge:{general:25,obc:28,sc:30,st:30,ews:25},
    states:[], sectors:["administration"],
    interests:["reasoning","gk"],
    salaryRange:[18000,22000], difficulty:"easy", languages:["english","hindi","regional"],
    desc:"Entry-level central govt posts. Only 10th pass required. Huge vacancies every year.",
    educationTags:["10th Pass"] },

  { id:"ssc-cpo", name:"SSC CPO", body:"SSC", tag:"Central Police Organisations",
    minEducation:"graduate", minAge:20, maxAge:{general:25,obc:28,sc:30,st:30,ews:25},
    states:[], sectors:["police","paramilitary"],
    interests:["gk","reasoning","physical","english"],
    salaryRange:[35400,112400], difficulty:"medium", languages:["english","hindi"],
    desc:"Sub-Inspector in Delhi Police, BSF, CRPF, CISF, SSB, ITBP.",
    educationTags:["Any Graduate"] },

  { id:"ssc-gd", name:"SSC GD Constable", body:"SSC", tag:"General Duty Constable",
    minEducation:"10th", minAge:18, maxAge:{general:23,obc:26,sc:28,st:28,ews:23},
    states:[], sectors:["police","paramilitary"],
    interests:["physical","gk","reasoning"],
    salaryRange:[21700,69100], difficulty:"easy", languages:["english","hindi","regional"],
    desc:"Constable in BSF, CRPF, CISF, SSB, ITBP, NIA. Largest vacancies in India.",
    educationTags:["10th Pass"] },

  { id:"ssc-je", name:"SSC JE", body:"SSC", tag:"Junior Engineer",
    minEducation:"diploma", minAge:18, maxAge:{general:32,obc:35,sc:37,st:37,ews:32},
    states:[], sectors:["engineering","technical"],
    interests:["science","maths","technical"],
    salaryRange:[35400,112400], difficulty:"medium", languages:["english","hindi"],
    desc:"Junior Engineer in CPWD, MES, CWC. Diploma or degree in engineering required.",
    educationTags:["Diploma / B.Tech"] },

  // ── Railways ──
  { id:"rrb-ntpc", name:"RRB NTPC", body:"Railway Recruitment Board", tag:"Non-Technical Popular Categories",
    minEducation:"12th", minAge:18, maxAge:{general:30,obc:33,sc:35,st:35,ews:30},
    states:[], sectors:["railways","administration"],
    interests:["maths","reasoning","gk"],
    salaryRange:[19900,35400], difficulty:"easy", languages:["english","hindi","regional"],
    desc:"Massive railway recruitment. Clerk, Goods Guard, ASM and more posts.",
    educationTags:["12th / Graduate"] },

  { id:"rrb-group-d", name:"RRB Group D", body:"Railway Recruitment Board", tag:"Level 1 Railways",
    minEducation:"10th", minAge:18, maxAge:{general:33,obc:36,sc:38,st:38,ews:33},
    states:[], sectors:["railways"],
    interests:["maths","reasoning","gk","science"],
    salaryRange:[18000,56900], difficulty:"easy", languages:["english","hindi","regional"],
    desc:"Track maintainer, helper, porter and other Level 1 railway posts.",
    educationTags:["10th Pass"] },

  { id:"rrb-je", name:"RRB JE", body:"Railway Recruitment Board", tag:"Junior Engineer Railways",
    minEducation:"diploma", minAge:18, maxAge:{general:33,obc:36,sc:38,st:38,ews:33},
    states:[], sectors:["railways","engineering","technical"],
    interests:["science","maths","technical"],
    salaryRange:[35400,112400], difficulty:"medium", languages:["english","hindi","regional"],
    desc:"Junior Engineer and Depot Material Superintendent in Indian Railways.",
    educationTags:["Diploma / B.Tech"] },

  { id:"rrb-alp", name:"RRB ALP", body:"Railway Recruitment Board", tag:"Assistant Loco Pilot",
    minEducation:"10th", minAge:18, maxAge:{general:28,obc:31,sc:33,st:33,ews:28},
    states:[], sectors:["railways","technical"],
    interests:["science","maths","technical"],
    salaryRange:[19900,62000], difficulty:"medium", languages:["english","hindi","regional"],
    desc:"Train driver cadre. ITI or diploma in relevant trade required.",
    educationTags:["10th + ITI / Diploma"] },

  // ── Banking ──
  { id:"rbi-grade-b", name:"RBI Grade B", body:"RBI", tag:"Officer Grade B",
    minEducation:"graduate", minAge:21, maxAge:{general:30,obc:33,sc:35,st:35,ews:30},
    states:[], sectors:["banking","finance","economics"],
    interests:["maths","reasoning","english","banking","gk"],
    salaryRange:[55000,96610], difficulty:"hard", languages:["english"],
    desc:"Officer at Reserve Bank of India. One of the most coveted banking roles in India.",
    educationTags:["Any Graduate"] },

  { id:"sbi-po", name:"SBI PO", body:"SBI", tag:"Probationary Officer",
    minEducation:"graduate", minAge:21, maxAge:{general:30,obc:33,sc:35,st:35,ews:30},
    states:[], sectors:["banking","finance"],
    interests:["maths","reasoning","english","banking"],
    salaryRange:[41960,66070], difficulty:"hard", languages:["english","hindi"],
    desc:"Most coveted banking job. Officer in India's largest public sector bank.",
    educationTags:["Any Graduate"] },

  { id:"sbi-clerk", name:"SBI Clerk", body:"SBI", tag:"Junior Associates",
    minEducation:"graduate", minAge:20, maxAge:{general:28,obc:31,sc:33,st:33,ews:28},
    states:[], sectors:["banking"],
    interests:["maths","reasoning","english"],
    salaryRange:[17900,47920], difficulty:"medium", languages:["english","hindi","regional"],
    desc:"Clerk posts in SBI branches across India. Local language proficiency required.",
    educationTags:["Any Graduate"] },

  { id:"ibps-po", name:"IBPS PO", body:"IBPS", tag:"Probationary Officer",
    minEducation:"graduate", minAge:20, maxAge:{general:30,obc:33,sc:35,st:35,ews:30},
    states:[], sectors:["banking","finance"],
    interests:["maths","reasoning","english","banking"],
    salaryRange:[36000,63840], difficulty:"medium", languages:["english","hindi"],
    desc:"Officer-level posts in 12 public sector banks across India.",
    educationTags:["Any Graduate"] },

  { id:"ibps-clerk", name:"IBPS Clerk", body:"IBPS", tag:"Bank Clerk",
    minEducation:"graduate", minAge:20, maxAge:{general:28,obc:31,sc:33,st:33,ews:28},
    states:[], sectors:["banking"],
    interests:["maths","reasoning","english","banking"],
    salaryRange:[11765,42020], difficulty:"easy", languages:["english","hindi","regional"],
    desc:"Entry-level banking jobs in 12 public sector banks. High job security.",
    educationTags:["Any Graduate"] },

  { id:"ibps-rrb-po", name:"IBPS RRB Officer", body:"IBPS", tag:"Regional Rural Bank PO",
    minEducation:"graduate", minAge:18, maxAge:{general:30,obc:33,sc:35,st:35,ews:30},
    states:["home_state"], sectors:["banking","rural"],
    interests:["maths","reasoning","regional","banking"],
    salaryRange:[29000,52000], difficulty:"medium", languages:["hindi","regional"],
    desc:"Officer in Regional Rural Banks. Strong preference for home state candidates.",
    educationTags:["Any Graduate"] },

  { id:"nabard-grade-a", name:"NABARD Grade A", body:"NABARD", tag:"Assistant Manager",
    minEducation:"graduate", minAge:21, maxAge:{general:30,obc:33,sc:35,st:35,ews:30},
    states:[], sectors:["banking","finance","rural","agriculture"],
    interests:["maths","reasoning","english","banking","gk"],
    salaryRange:[44500,89150], difficulty:"hard", languages:["english","hindi"],
    desc:"Assistant Manager in NABARD. Focus on agriculture and rural development finance.",
    educationTags:["Any Graduate"] },

  { id:"sebi-grade-a", name:"SEBI Grade A", body:"SEBI", tag:"Officer Grade A",
    minEducation:"graduate", minAge:21, maxAge:{general:30,obc:33,sc:35,st:35,ews:30},
    states:[], sectors:["finance","banking","law"],
    interests:["maths","reasoning","english","banking","gk","law"],
    salaryRange:[44500,89150], difficulty:"hard", languages:["english"],
    desc:"Officer at Securities and Exchange Board of India. Finance/law/CA background preferred.",
    educationTags:["Any Graduate / LLB / CA"] },

  { id:"lic-aao", name:"LIC AAO", body:"LIC", tag:"Assistant Administrative Officer",
    minEducation:"graduate", minAge:21, maxAge:{general:30,obc:33,sc:35,st:35,ews:30},
    states:[], sectors:["insurance","finance"],
    interests:["maths","reasoning","english","banking"],
    salaryRange:[32795,62315], difficulty:"medium", languages:["english","hindi"],
    desc:"Officer cadre in Life Insurance Corporation of India.",
    educationTags:["Any Graduate"] },

  // ── Law ──
  { id:"apo", name:"APO / District Judge", body:"State PSC / High Court", tag:"Law Officer",
    minEducation:"llb", minAge:21, maxAge:{general:35,obc:38,sc:40,st:40,ews:35},
    states:["home_state"], sectors:["law","administration","judiciary"],
    interests:["law","polity","english","gk"],
    salaryRange:[27700,144300], difficulty:"hard", languages:["english","hindi","regional"],
    desc:"Assistant Prosecution Officer or District Judge via state judiciary exams. LLB required.",
    educationTags:["LLB / LLM"] },

  { id:"upsc-law-officer", name:"UPSC Law Officer", body:"UPSC", tag:"Legal Officer Central Govt",
    minEducation:"llb", minAge:21, maxAge:{general:35,obc:38,sc:40,st:40,ews:35},
    states:[], sectors:["law","administration"],
    interests:["law","polity","english"],
    salaryRange:[44900,142400], difficulty:"hard", languages:["english"],
    desc:"Legal Officer posts in central government ministries and departments via UPSC.",
    educationTags:["LLB / LLM"] },

  // ── State PSC ──
  { id:"state-psc", name:"State PSC (PCS)", body:"State PSC", tag:"State Group A & B",
    minEducation:"graduate", minAge:21, maxAge:{general:35,obc:38,sc:40,st:40,ews:35},
    states:["home_state"], sectors:["administration","police","revenue"],
    interests:["gk","history","polity","regional"],
    salaryRange:[35400,112400], difficulty:"hard", languages:["english","hindi","regional"],
    desc:"State-level administrative services (SDM, DSP, BDO). Higher age limit, regional posting.",
    educationTags:["Any Graduate"] },

  { id:"state-si", name:"State Police SI", body:"State Police", tag:"Sub Inspector",
    minEducation:"graduate", minAge:20, maxAge:{general:25,obc:28,sc:30,st:30,ews:25},
    states:["home_state"], sectors:["police"],
    interests:["gk","reasoning","physical","polity"],
    salaryRange:[20000,60000], difficulty:"medium", languages:["hindi","regional"],
    desc:"Sub Inspector in state police. Physical test mandatory. State-specific exam.",
    educationTags:["Any Graduate"] },

  // ── Teaching ──
  { id:"ctet", name:"CTET", body:"CBSE", tag:"Central Teacher Eligibility Test",
    minEducation:"graduate", minAge:18, maxAge:{general:99,obc:99,sc:99,st:99,ews:99},
    states:[], sectors:["teaching","education"],
    interests:["english","reasoning","gk","regional"],
    salaryRange:[35400,80000], difficulty:"easy", languages:["english","hindi"],
    desc:"Eligibility certificate for central govt school teacher (Class 1–8). No upper age limit.",
    educationTags:["B.Ed / D.El.Ed"] },

  { id:"kvs-tgt-pgt", name:"KVS TGT / PGT", body:"KVS", tag:"Kendriya Vidyalaya Teacher",
    minEducation:"graduate", minAge:18, maxAge:{general:35,obc:38,sc:40,st:40,ews:35},
    states:[], sectors:["teaching","education"],
    interests:["english","gk","regional","science"],
    salaryRange:[44900,112400], difficulty:"medium", languages:["english","hindi"],
    desc:"Teacher posts in Kendriya Vidyalayas across India. CTET qualification required.",
    educationTags:["Graduate + B.Ed"] },

  // ── Technical / Science ──
  { id:"isro-scientist", name:"ISRO Scientist / Engineer", body:"ISRO", tag:"Scientist SC",
    minEducation:"btech", minAge:18, maxAge:{general:35,obc:38,sc:40,st:40,ews:35},
    states:[], sectors:["engineering","technical","science"],
    interests:["science","maths","technical"],
    salaryRange:[56100,177500], difficulty:"hard", languages:["english"],
    desc:"Scientist or Engineer in India's space agency ISRO. B.Tech in relevant discipline required.",
    educationTags:["B.Tech / B.E"] },

  { id:"drdo-ceptam", name:"DRDO CEPTAM", body:"DRDO", tag:"Technician / Admin",
    minEducation:"10th", minAge:18, maxAge:{general:28,obc:31,sc:33,st:33,ews:28},
    states:[], sectors:["technical","defence","engineering"],
    interests:["science","maths","technical","reasoning"],
    salaryRange:[25500,81100], difficulty:"medium", languages:["english","hindi"],
    desc:"Technician and admin posts in Defence R&D labs. Various education levels accepted.",
    educationTags:["10th / ITI / Diploma / Graduate"] },

  { id:"aai-atc", name:"AAI Junior Executive (ATC)", body:"Airports Authority of India", tag:"Air Traffic Control",
    minEducation:"btech", minAge:18, maxAge:{general:27,obc:30,sc:32,st:32,ews:27},
    states:[], sectors:["engineering","technical","science"],
    interests:["science","maths","technical","english"],
    salaryRange:[40000,140000], difficulty:"hard", languages:["english"],
    desc:"Air Traffic Controller cadre at AAI. B.Sc (PCM) or B.E/B.Tech with valid academic level required.",
    educationTags:["B.Sc (PCM) / B.E / B.Tech"] },

  // ── More Banking & Insurance ──
  { id:"rbi-assistant", name:"RBI Assistant", body:"RBI", tag:"Clerical / Support Staff",
    minEducation:"graduate", minAge:20, maxAge:{general:28,obc:31,sc:33,st:33,ews:28},
    states:[], sectors:["banking","finance"],
    interests:["maths","reasoning","english","banking","gk"],
    salaryRange:[20700,40000], difficulty:"medium", languages:["english","hindi","regional"],
    desc:"Support-staff cadre at the Reserve Bank of India. Great pay and prestige for a clerical role.",
    educationTags:["Any Graduate"] },

  { id:"ibps-rrb-clerk", name:"IBPS RRB Office Assistant", body:"IBPS", tag:"Regional Rural Bank Clerk",
    minEducation:"graduate", minAge:18, maxAge:{general:28,obc:31,sc:33,st:33,ews:28},
    states:["home_state"], sectors:["banking","rural"],
    interests:["maths","reasoning","regional","banking"],
    salaryRange:[15000,40000], difficulty:"easy", languages:["hindi","regional"],
    desc:"Clerk (Office Assistant) in Regional Rural Banks. Strong home-state and local-language preference.",
    educationTags:["Any Graduate"] },

  { id:"niacl-ao", name:"NIACL AO", body:"New India Assurance", tag:"Administrative Officer",
    minEducation:"graduate", minAge:21, maxAge:{general:30,obc:33,sc:35,st:35,ews:30},
    states:[], sectors:["insurance","finance"],
    interests:["maths","reasoning","english","banking","gk"],
    salaryRange:[50000,90000], difficulty:"medium", languages:["english"],
    desc:"Officer cadre in New India Assurance, India's largest general insurance company.",
    educationTags:["Any Graduate"] },

  { id:"lic-ado", name:"LIC ADO", body:"LIC", tag:"Apprentice Development Officer",
    minEducation:"graduate", minAge:21, maxAge:{general:30,obc:33,sc:35,st:35,ews:30},
    states:[], sectors:["insurance","finance"],
    interests:["english","reasoning","gk"],
    salaryRange:[35000,55000], difficulty:"medium", languages:["english","hindi","regional"],
    desc:"Field-officer cadre at LIC focused on building and managing the agency network.",
    educationTags:["Any Graduate"] },

  // ── More SSC & Central Staffing ──
  { id:"ssc-steno", name:"SSC Stenographer", body:"SSC", tag:"Steno Grade C & D",
    minEducation:"12th", minAge:18, maxAge:{general:30,obc:33,sc:35,st:35,ews:30},
    states:[], sectors:["administration"],
    interests:["english","reasoning","gk"],
    salaryRange:[25500,81100], difficulty:"easy", languages:["english","hindi"],
    desc:"Stenographer posts across central government ministries. Shorthand skill test required.",
    educationTags:["12th Pass"] },

  { id:"ssc-jht", name:"SSC Junior Hindi Translator", body:"SSC", tag:"Translator (JHT)",
    minEducation:"pg", minAge:18, maxAge:{general:30,obc:33,sc:35,st:35,ews:30},
    states:[], sectors:["administration","teaching"],
    interests:["english","regional","gk"],
    salaryRange:[35400,112400], difficulty:"medium", languages:["hindi","english"],
    desc:"Hindi/English translator posts in central departments. Master's in Hindi or English required.",
    educationTags:["Master's (Hindi / English)"] },

  { id:"ib-acio", name:"IB ACIO Grade-II", body:"Intelligence Bureau (MHA)", tag:"Intelligence Officer",
    minEducation:"graduate", minAge:18, maxAge:{general:27,obc:30,sc:32,st:32,ews:27},
    states:[], sectors:["administration","police"],
    interests:["gk","reasoning","english","polity"],
    salaryRange:[44900,142400], difficulty:"medium", languages:["english","hindi"],
    desc:"Assistant Central Intelligence Officer in India's internal intelligence agency.",
    educationTags:["Any Graduate"] },

  { id:"epfo-ssa", name:"EPFO SSA", body:"EPFO", tag:"Social Security Assistant",
    minEducation:"graduate", minAge:18, maxAge:{general:27,obc:30,sc:32,st:32,ews:27},
    states:[], sectors:["administration","finance"],
    interests:["maths","reasoning","english","gk"],
    salaryRange:[29200,92300], difficulty:"medium", languages:["english","hindi"],
    desc:"Social Security Assistant managing PF accounts and claims at the EPFO.",
    educationTags:["Any Graduate"] },

  { id:"fci-ag3", name:"FCI Assistant Grade-III", body:"Food Corporation of India", tag:"Assistant Grade III",
    minEducation:"graduate", minAge:18, maxAge:{general:27,obc:30,sc:32,st:32,ews:27},
    states:[], sectors:["administration","rural"],
    interests:["maths","reasoning","english","gk"],
    salaryRange:[25380,46220], difficulty:"easy", languages:["english","hindi"],
    desc:"General, technical and depot posts in the Food Corporation of India. Good work-life balance.",
    educationTags:["Any Graduate"] },

  { id:"post-gds", name:"India Post GDS", body:"India Post", tag:"Gramin Dak Sevak",
    minEducation:"10th", minAge:18, maxAge:{general:40,obc:43,sc:45,st:45,ews:40},
    states:["home_state"], sectors:["administration"],
    interests:["regional","reasoning"],
    salaryRange:[10000,24470], difficulty:"easy", languages:["english","hindi","regional"],
    desc:"Branch Postmaster and Dak Sevak posts. Merit-based (no exam), 10th pass, huge vacancies.",
    educationTags:["10th Pass"] },

  // ── Teaching & Research ──
  { id:"ugc-net", name:"UGC NET", body:"NTA / UGC", tag:"Assistant Professor & JRF",
    minEducation:"pg", minAge:18, maxAge:{general:99,obc:99,sc:99,st:99,ews:99},
    states:[], sectors:["teaching","education"],
    interests:["english","gk","reasoning","polity"],
    salaryRange:[57700,182400], difficulty:"medium", languages:["english","hindi"],
    desc:"Eligibility for Assistant Professor and JRF in universities and colleges. Post-graduation required.",
    educationTags:["Post Graduate (55%)"] },

  { id:"csir-net", name:"CSIR UGC NET", body:"NTA / CSIR", tag:"Science Lectureship & JRF",
    minEducation:"pg", minAge:18, maxAge:{general:99,obc:99,sc:99,st:99,ews:99},
    states:[], sectors:["teaching","education","engineering"],
    interests:["science","maths","technical"],
    salaryRange:[37000,182400], difficulty:"hard", languages:["english"],
    desc:"Lectureship and JRF in science streams (Physics, Chemistry, Life Sciences, Maths, Earth Sciences).",
    educationTags:["M.Sc / equivalent"] },

  // ── Defence: Agnipath & Coast Guard ──
  { id:"upsc-ifos", name:"UPSC IFoS", body:"UPSC", tag:"Indian Forest Service",
    minEducation:"graduate", minAge:21, maxAge:{general:32,obc:35,sc:37,st:37,ews:32},
    states:[], sectors:["administration","science"],
    interests:["science","gk","geography","maths"],
    salaryRange:[56100,225000], difficulty:"hard", languages:["english"],
    desc:"Forest Service officer managing India's forests and wildlife. Science or engineering graduates only.",
    educationTags:["Science / Engineering Graduate"] },

  { id:"agniveer-army", name:"Army Agniveer (GD)", body:"Indian Army", tag:"Agnipath General Duty",
    minEducation:"10th", minAge:17.5, maxAge:{general:21,obc:21,sc:21,st:21,ews:21},
    states:[], sectors:["defence","army"],
    interests:["physical","gk","reasoning"],
    salaryRange:[21000,40000], difficulty:"easy", languages:["english","hindi","regional"],
    desc:"Four-year Agniveer enrolment in the Indian Army. Physical fitness test and medical mandatory.",
    educationTags:["10th Pass"] },

  { id:"agniveer-airforce", name:"IAF Agniveer Vayu", body:"Indian Air Force", tag:"Agnipath Vayu",
    minEducation:"12th", minAge:17.5, maxAge:{general:21,obc:21,sc:21,st:21,ews:21},
    states:[], sectors:["defence","airforce"],
    interests:["science","maths","physical"],
    salaryRange:[21000,40000], difficulty:"medium", languages:["english","hindi"],
    desc:"Four-year Agniveer enrolment in the Indian Air Force. 12th with PCM or vocational stream.",
    educationTags:["12th (PCM / Vocational)"] },

  { id:"agniveer-navy", name:"Navy Agniveer (SSR)", body:"Indian Navy", tag:"Agnipath SSR",
    minEducation:"12th", minAge:17.5, maxAge:{general:21,obc:21,sc:21,st:21,ews:21},
    states:[], sectors:["defence","navy"],
    interests:["science","maths","physical"],
    salaryRange:[21000,40000], difficulty:"medium", languages:["english","hindi"],
    desc:"Four-year Agniveer enrolment in the Indian Navy (Senior Secondary Recruit). PCM in 12th required.",
    educationTags:["12th (PCM)"] },

  { id:"coast-guard-navik", name:"Coast Guard Navik (GD)", body:"Indian Coast Guard", tag:"Navik General Duty",
    minEducation:"12th", minAge:18, maxAge:{general:22,obc:22,sc:22,st:22,ews:22},
    states:[], sectors:["defence","navy"],
    interests:["science","maths","physical"],
    salaryRange:[21700,69100], difficulty:"medium", languages:["english","hindi"],
    desc:"Sailor entry into the Indian Coast Guard. 12th with Physics and Maths required.",
    educationTags:["12th (PCM)"] },
];

// Education hierarchy — anything at or above the index qualifies
function meetsEducation(exam, answers) {
  const hierarchy = EDUCATION_ORDER;
  const userIdx = hierarchy.indexOf(answers.education);
  const examIdx = hierarchy.indexOf(exam.minEducation);
  // graduate, pg, btech, bsc, ba, bcom, llb all satisfy "graduate" requirement
  const graduateGroup = ["btech","bsc","ba","bcom","llb","graduate","pg"];
  if (exam.minEducation === "graduate" && graduateGroup.includes(answers.education)) return true;
  // law-specific exams
  if (exam.minEducation === "llb") return answers.education === "llb" || answers.education === "pg";
  // engineering-specific exams
  if (exam.minEducation === "btech") return answers.education === "btech" || answers.education === "pg";
  return userIdx >= examIdx;
}

function meetsAge(exam, answers) {
  const age = parseFloat(answers.age);
  const maxAge = exam.maxAge[answers.category] ?? exam.maxAge.general;
  return age >= exam.minAge && age <= maxAge;
}

function scoreExam(exam, answers) {
  if (!meetsEducation(exam, answers)) return null;
  if (!meetsAge(exam, answers)) return null;
  let score = 50;
  if (exam.states.length === 0) score += 8;
  else if (answers.location === "home_state") score += 14;
  const sectorHits = (answers.sectors || []).filter(s => exam.sectors.includes(s)).length;
  score += sectorHits * 13;
  const interestHits = (answers.interests || []).filter(i => exam.interests.includes(i)).length;
  score += interestHits * 7;
  const minSalary = parseInt(answers.salary || "0");
  if (exam.salaryRange[0] >= minSalary) score += 10;
  else if (exam.salaryRange[1] >= minSalary) score += 4;
  if (exam.difficulty === answers.difficulty) score += 15;
  else if ((answers.difficulty==="medium"&&exam.difficulty==="easy")||(answers.difficulty==="hard"&&exam.difficulty==="medium")) score += 5;
  const hrs = parseInt(answers.studyTime || "3");
  if (exam.difficulty === "easy" && hrs <= 3) score += 6;
  if (exam.difficulty === "hard" && hrs >= 6) score += 6;
  if (answers.language === "any" || exam.languages.includes(answers.language)) score += 5;
  return Math.min(score, 99);
}

const QUESTIONS = [
  {
    id:"education", question:"What's your highest education?", emoji:"🎓", type:"single",
    options:[
      { value:"10th",     label:"10th Pass",              sub:"Matriculation" },
      { value:"12th",     label:"12th Pass",              sub:"Intermediate / HSC" },
      { value:"diploma",  label:"Diploma / ITI",          sub:"Polytechnic or trade certificate" },
      { value:"btech",    label:"B.Tech / B.E",           sub:"Engineering degree" },
      { value:"bsc",      label:"B.Sc",                   sub:"Science graduate" },
      { value:"ba",       label:"B.A",                    sub:"Arts / Humanities graduate" },
      { value:"bcom",     label:"B.Com / BBA / BCA",      sub:"Commerce / Management graduate" },
      { value:"llb",      label:"LLB / BA LLB",           sub:"Law degree" },
      { value:"graduate", label:"Other Graduate",         sub:"Any other bachelor's degree" },
      { value:"pg",       label:"Post Graduate / PhD",    sub:"Masters, M.Tech, LLM, MBA etc." },
    ],
  },
  {
    id:"age", question:"How old are you?", emoji:"🎂", type:"single",
    options:[
      { value:"17", label:"Under 18",  sub:"Currently in school / 12th" },
      { value:"19", label:"18 – 21",   sub:"Just started college or freshly graduated" },
      { value:"23", label:"22 – 25",   sub:"Recent graduate" },
      { value:"27", label:"26 – 30",   sub:"Working or preparing" },
      { value:"33", label:"31 – 35",   sub:"Experienced aspirant" },
      { value:"38", label:"36+",       sub:"SC/ST/OBC age relaxation may apply" },
    ],
  },
  {
    id:"category", question:"Your reservation category?", emoji:"📋", type:"single",
    options:[
      { value:"general", label:"General / UR", sub:"No reservation benefit" },
      { value:"obc",     label:"OBC",           sub:"+3 years age relaxation" },
      { value:"sc",      label:"SC",            sub:"+5 years age relaxation" },
      { value:"st",      label:"ST",            sub:"+5 years age relaxation" },
      { value:"ews",     label:"EWS",           sub:"Economically Weaker Section" },
    ],
  },
  {
    id:"location", question:"Where do you want to be posted?", emoji:"📍", type:"single",
    options:[
      { value:"home_state", label:"My home state only",   sub:"State PSC, RRB, state police" },
      { value:"any",        label:"Anywhere in India",    sub:"Central govt, UPSC, SSC" },
      { value:"metro",      label:"Metro city preferred", sub:"Banks, insurance, SEBI, RBI" },
    ],
  },
  {
    id:"sectors", question:"Which sectors interest you?", emoji:"🏛️", type:"multi",
    options:[
      { value:"administration", label:"Administration / Civil Services", sub:"IAS, SDM, BDO" },
      { value:"banking",        label:"Banking & Finance",               sub:"SBI, IBPS, RBI" },
      { value:"railways",       label:"Railways",                        sub:"RRB, Indian Railways" },
      { value:"defence",        label:"Defence / Armed Forces",          sub:"Army, Navy, Air Force" },
      { value:"police",         label:"Police / Paramilitary",           sub:"BSF, CRPF, State Police" },
      { value:"teaching",       label:"Teaching / Education",            sub:"KVS, NVS, CTET" },
      { value:"engineering",    label:"Engineering / Technical",         sub:"ISRO, DRDO, SSC JE" },
      { value:"law",            label:"Law / Judiciary",                 sub:"APO, Legal Officer" },
      { value:"insurance",      label:"Insurance",                       sub:"LIC, GIC" },
      { value:"rural",          label:"Rural / Agriculture",             sub:"NABARD, RRB" },
    ],
  },
  {
    id:"interests", question:"What subjects are you strong in?", emoji:"📚", type:"multi",
    options:[
      { value:"maths",     label:"Maths & Quantitative Aptitude", sub:"Numbers, data interpretation" },
      { value:"reasoning", label:"Logical Reasoning",             sub:"Puzzles, verbal non-verbal" },
      { value:"gk",        label:"General Knowledge",             sub:"Current affairs, static GK" },
      { value:"english",   label:"English",                       sub:"Reading, grammar, writing" },
      { value:"polity",    label:"Polity & Governance",           sub:"Constitution, public admin" },
      { value:"science",   label:"Science & Technology",          sub:"Physics, chemistry, bio" },
      { value:"law",       label:"Law & Legal Studies",           sub:"Constitution, IPC, contracts" },
      { value:"technical", label:"Engineering / Technical",       sub:"Core branch subjects" },
      { value:"physical",  label:"Physical Fitness",              sub:"Comfortable with PET/PST" },
    ],
  },
  {
    id:"salary", question:"Minimum monthly salary expected?", emoji:"💰", type:"single",
    options:[
      { value:"15000", label:"₹15,000+", sub:"Any govt job is fine" },
      { value:"25000", label:"₹25,000+", sub:"SSC, Railways level" },
      { value:"35000", label:"₹35,000+", sub:"Banking clerk / PO level" },
      { value:"50000", label:"₹50,000+", sub:"Group A / officer level" },
      { value:"70000", label:"₹70,000+", sub:"RBI, UPSC, ISRO level" },
    ],
  },
  {
    id:"studyTime", question:"How many hours can you study daily?", emoji:"⏰", type:"single",
    options:[
      { value:"1", label:"1–2 hours",       sub:"Side prep alongside job / college" },
      { value:"3", label:"3–4 hours",       sub:"Regular part-time preparation" },
      { value:"6", label:"5–6 hours",       sub:"Serious full-time preparation" },
      { value:"8", label:"7+ hours",        sub:"100% dedicated exam preparation" },
    ],
  },
  {
    id:"difficulty", question:"What's your timeline?", emoji:"🎯", type:"single",
    options:[
      { value:"easy",   label:"Get a job fast",       sub:"1–3 months prep, easy exam" },
      { value:"medium", label:"6–12 months prep",     sub:"Balanced effort and reward" },
      { value:"hard",   label:"2–3 years, top post",  sub:"Prestige over speed, UPSC-level" },
    ],
  },
  {
    id:"language", question:"Which language will you write the exam in?", emoji:"🗣️", type:"single",
    options:[
      { value:"hindi",    label:"Hindi",            sub:"Hindi medium preparation" },
      { value:"english",  label:"English",          sub:"English medium preparation" },
      { value:"regional", label:"Regional language", sub:"Odia, Tamil, Telugu, Marathi etc." },
      { value:"any",      label:"Flexible",          sub:"Comfortable in multiple languages" },
    ],
  },
];

// ─── Brand constants ──────────────────────────────────────────────────────────
const FONT = "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
const LOGO_SRC = "/icon-512x512.png";          // the real JobsTrackr app icon
const APP_URL = "https://www.jobstrackr.in/";

// ─── UI Components ────────────────────────────────────────────────────────────

// Wordmark with the real app icon. `light` adapts the text for dark backgrounds.
function JobsTrackrLogo({ size = 36, light = false, showWord = true }) {
  return (
    <div style={{ display:"flex", alignItems:"center", gap: size * 0.3 }}>
      <img
        src={LOGO_SRC} alt="JobsTrackr" width={size} height={size}
        style={{
          display:"block", borderRadius: size * 0.26,
          boxShadow: light ? "0 8px 22px rgba(4,12,40,0.5)" : "0 6px 16px rgba(15,37,87,0.2)",
        }}
      />
      {showWord && (
        <span style={{
          fontFamily: FONT, fontWeight: 800, fontSize: size * 0.52,
          letterSpacing: "-0.5px", lineHeight: 1,
          color: light ? "#fff" : "#0f2557",
        }}>
          Jobs<span style={{ color: light ? "#74B9FF" : "#2563EB" }}>Trackr</span>
        </span>
      )}
    </div>
  );
}

// "What is JobsTrackr?" blurb — shown on both the landing and results pages.
function AboutJobsTrackr({ light = false }) {
  const features = [
    ["🔔", "Live exam & job alerts"],
    ["🎯", "AI job recommendations"],
    ["✅", "Instant eligibility checks"],
    ["📝", "Form-filling assistant"],
  ];
  return (
    <div style={{
      borderRadius: 18, padding: "20px 18px", fontFamily: FONT,
      background: light ? "rgba(255,255,255,0.05)" : "#fff",
      border: light ? "1px solid rgba(147,197,253,0.18)" : "1px solid #E2E8F0",
      boxShadow: light ? "none" : "0 2px 14px rgba(15,37,87,0.05)",
    }}>
      <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:10 }}>
        <img src={LOGO_SRC} alt="" width={32} height={32} style={{ borderRadius:9 }} />
        <span style={{ fontWeight:800, fontSize:15, letterSpacing:"-0.3px", color: light ? "#fff" : "#0f2557" }}>
          What is JobsTrackr?
        </span>
      </div>
      <p style={{ margin:"0 0 14px", fontSize:13.5, lineHeight:1.7, color: light ? "#a7b6d6" : "#475569" }}>
        India's smartest companion for government job aspirants. Track every exam
        notification, get AI-powered matches for your profile, check eligibility in
        seconds, and never miss a deadline again — 100% free.
      </p>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:9 }}>
        {features.map(([ic, t]) => (
          <div key={t} style={{ display:"flex", alignItems:"center", gap:7, fontSize:12, fontWeight:600, color: light ? "#cdd8ee" : "#334155" }}>
            <span style={{ fontSize:14 }}>{ic}</span>{t}
          </div>
        ))}
      </div>
    </div>
  );
}

// Primary link button that opens the full JobsTrackr web app.
function OpenAppButton() {
  return (
    <a href={APP_URL} target="_blank" rel="noopener noreferrer" style={{
      display:"flex", alignItems:"center", justifyContent:"center", gap:9,
      textDecoration:"none", width:"100%", boxSizing:"border-box",
      padding:"15px 18px", borderRadius:14, fontFamily: FONT,
      background:"linear-gradient(90deg,#2F6BE0,#1A3FA0)",
      boxShadow:"0 10px 30px rgba(26,63,160,0.4)",
      fontWeight:800, fontSize:15, letterSpacing:"-0.2px", color:"#fff",
    }}>
      <img src={LOGO_SRC} alt="" width={22} height={22} style={{ borderRadius:6 }} />
      Open the JobsTrackr App →
    </a>
  );
}

function ProgressBar({ current, total }) {
  const pct = (current / total) * 100;
  return (
    <div style={{ flex:1 }}>
      <div style={{ display:"flex", justifyContent:"space-between", marginBottom:5 }}>
        <span style={{ fontSize:12, color:"#64748b", fontFamily:"Inter,sans-serif" }}>
          Question {current} of {total}
        </span>
        <span style={{ fontSize:12, fontWeight:700, fontFamily:"Inter,sans-serif",
          background:"linear-gradient(90deg,#4A90D9,#1A4FAF)",
          WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent" }}>
          {Math.round(pct)}%
        </span>
      </div>
      <div style={{ height:6, background:"#DBEAFE", borderRadius:99 }}>
        <div style={{
          height:6, width:`${pct}%`, borderRadius:99, transition:"width 0.45s ease",
          background:"linear-gradient(90deg,#74B9FF,#1A56DB)",
        }}/>
      </div>
    </div>
  );
}

function OptionBtn({ option, selected, onClick, multi }) {
  const on = multi ? (selected||[]).includes(option.value) : selected === option.value;
  return (
    <button onClick={() => onClick(option.value)} style={{
      width:"100%", padding:"13px 16px", marginBottom:9,
      border: on ? "2px solid #2563EB" : "2px solid #E2E8F0",
      borderRadius:12,
      background: on ? "#EFF6FF" : "#FAFBFF",
      cursor:"pointer", display:"flex", alignItems:"center", gap:12,
      transition:"all 0.15s", textAlign:"left",
      boxShadow: on ? "0 2px 12px rgba(37,99,235,0.15)" : "none",
    }}>
      {/* Checkbox / radio */}
      <span style={{
        width:20, height:20, flexShrink:0,
        borderRadius: multi ? 6 : "50%",
        border: on ? "none" : "2px solid #CBD5E1",
        background: on ? "linear-gradient(135deg,#4A90D9,#1A4FAF)" : "transparent",
        display:"flex", alignItems:"center", justifyContent:"center",
      }}>
        {on && <span style={{ color:"#fff", fontSize:11, fontWeight:800 }}>✓</span>}
      </span>
      {/* Text */}
      <span style={{ flex:1 }}>
        <span style={{
          display:"block", fontFamily:"Inter,sans-serif", fontSize:14, fontWeight: on ? 700 : 500,
          color: on ? "#1E3A8A" : "#1e293b", lineHeight:1.3,
        }}>{option.label}</span>
        {option.sub && (
          <span style={{
            display:"block", fontFamily:"Inter,sans-serif", fontSize:12,
            color: on ? "#3B82F6" : "#94a3b8", marginTop:2, lineHeight:1.3,
          }}>{option.sub}</span>
        )}
      </span>
    </button>
  );
}

function ScorePill({ score, rank }) {
  const colors = [
    ["#1D4ED8","#EFF6FF"],
    ["#1D4ED8","#EFF6FF"],
    ["#1D4ED8","#EFF6FF"],
  ];
  const [txt, bg] = colors[Math.min(rank, 2)];
  return (
    <div style={{
      background: rank === 0 ? "linear-gradient(135deg,#4A90D9,#1A4FAF)" : "#EFF6FF",
      color: rank === 0 ? "#fff" : "#1D4ED8",
      borderRadius:10, padding:"6px 12px", flexShrink:0, textAlign:"center",
      minWidth:52,
    }}>
      <div style={{ fontSize:18, fontWeight:800, lineHeight:1, fontFamily:"Inter,sans-serif" }}>{score}%</div>
      <div style={{ fontSize:10, fontWeight:600, opacity:0.8, fontFamily:"Inter,sans-serif" }}>match</div>
    </div>
  );
}

function ResultCard({ results, onRetake }) {
  const [expanded, setExpanded] = useState(null);
  const top = results.slice(0, 7);
  const medals = ["🥇","🥈","🥉","4️⃣","5️⃣","6️⃣","7️⃣"];

  const share = async () => {
    const text = `🎯 My Govt Job Matches — JobsTrackr.in\n\n${top.slice(0,5)
      .map((r,i) => `${i+1}. ${r.exam.name} — ${r.score}% match`)
      .join("\n")}\n\nFind your match 👉 jobstrackr.in/quiz`;
    if (navigator.share) await navigator.share({ text, title:"My Govt Job Matches" });
    else { await navigator.clipboard.writeText(text); alert("Copied! Paste on WhatsApp."); }
  };

  return (
    <div style={{ fontFamily: FONT }}>
      {/* Header */}
      <div style={{
        position:"relative", overflow:"hidden",
        background:"radial-gradient(120% 90% at 50% -20%, #1f4dad 0%, #112a63 50%, #0b1736 100%)",
        borderRadius:20, padding:"26px 20px", marginBottom:20, textAlign:"center",
        boxShadow:"0 14px 40px rgba(11,23,54,0.35)",
      }}>
        <div style={{ position:"absolute", top:-90, left:"50%", transform:"translateX(-50%)", width:260, height:260, background:"radial-gradient(circle, rgba(116,185,255,0.22), transparent 70%)", pointerEvents:"none" }} />
        <div style={{ position:"relative", display:"flex", justifyContent:"center" }}>
          <JobsTrackrLogo size={36} light />
        </div>
        <div style={{ position:"relative", fontSize:30, marginTop:16, marginBottom:6 }}>🎯</div>
        <h2 style={{ position:"relative", margin:0, fontSize:24, fontWeight:900, letterSpacing:"-0.7px", color:"#fff" }}>Your Top Matches</h2>
        <p style={{ position:"relative", margin:"7px 0 0", fontSize:13, fontWeight:500, color:"#9fc0ff" }}>
          {EXAMS.length} exams scanned · {results.length} you're eligible for
        </p>
      </div>

      {results.length === 0 ? (
        <div style={{
          background:"#fff", borderRadius:14, padding:24, textAlign:"center",
          border:"2px solid #DBEAFE",
        }}>
          <div style={{ fontSize:36 }}>🤔</div>
          <p style={{ color:"#64748b", marginTop:10, fontSize:14, lineHeight:1.6 }}>
            No matching exams found with these filters.<br/>
            Try adjusting your age or education — some criteria may be too restrictive.
          </p>
          <button onClick={onRetake} style={{
            marginTop:12, padding:"10px 24px", background:"linear-gradient(90deg,#4A90D9,#1A4FAF)",
            color:"#fff", border:"none", borderRadius:8, fontWeight:700, fontSize:14, cursor:"pointer",
          }}>Retake Quiz</button>
        </div>
      ) : top.map((result, i) => {
        const { exam, score } = result;
        const isOpen = expanded === exam.id;
        return (
          <div key={exam.id} style={{
            background: i === 0 ? "#EFF6FF" : "#fff",
            border: i === 0 ? "2px solid #2563EB" : "2px solid #E2E8F0",
            borderRadius:14, marginBottom:10, overflow:"hidden",
            boxShadow: i === 0 ? "0 4px 20px rgba(37,99,235,0.12)" : "0 1px 4px rgba(0,0,0,0.05)",
          }}>
            {/* Main row */}
            <div style={{ display:"flex", alignItems:"center", gap:12, padding:"14px 16px" }}>
              <span style={{ fontSize:22, flexShrink:0 }}>{medals[i]}</span>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontWeight:700, fontSize:15, color:"#0f172a" }}>{exam.name}</div>
                <div style={{ fontSize:12, color:"#64748b", marginTop:2 }}>{exam.body} · {exam.tag}</div>
                {/* Progress bar */}
                <div style={{ marginTop:8, height:5, background:"#DBEAFE", borderRadius:99 }}>
                  <div style={{
                    height:5, borderRadius:99, transition:"width 0.7s ease",
                    width:`${Math.round((score/top[0].score)*100)}%`,
                    background: i===0 ? "linear-gradient(90deg,#4A90D9,#1A4FAF)" : "#93C5FD",
                  }}/>
                </div>
              </div>
              <ScorePill score={score} rank={i} />
            </div>

            {/* Expand / collapse */}
            <button onClick={() => setExpanded(isOpen ? null : exam.id)} style={{
              width:"100%", padding:"8px 16px", background: i===0 ? "#DBEAFE" : "#F8FAFF",
              border:"none", borderTop: i===0 ? "1px solid #BFDBFE" : "1px solid #E2E8F0",
              cursor:"pointer", display:"flex", justifyContent:"space-between", alignItems:"center",
            }}>
              <span style={{ fontSize:12, color:"#3B82F6", fontWeight:600 }}>
                {isOpen ? "Hide details ▲" : "View details ▼"}
              </span>
              <span style={{ fontSize:12, color:"#059669", fontWeight:700 }}>
                💰 ₹{(exam.salaryRange[0]/1000).toFixed(0)}k–₹{(exam.salaryRange[1]/1000).toFixed(0)}k/mo
              </span>
            </button>

            {isOpen && (
              <div style={{ padding:"14px 16px", background:"#F0F6FF", borderTop:"1px solid #DBEAFE" }}>
                <p style={{ margin:"0 0 10px", fontSize:13, color:"#334155", lineHeight:1.6 }}>
                  {exam.desc}
                </p>
                <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
                  {exam.educationTags.map(t => (
                    <span key={t} style={{
                      background:"#DBEAFE", color:"#1D4ED8", borderRadius:99,
                      padding:"3px 10px", fontSize:11, fontWeight:600,
                    }}>{t}</span>
                  ))}
                  <span style={{
                    background:"#D1FAE5", color:"#065F46", borderRadius:99,
                    padding:"3px 10px", fontSize:11, fontWeight:600,
                  }}>
                    Age: {exam.minAge}–{exam.maxAge.general} yrs
                  </span>
                  <span style={{
                    background:"#FEF9C3", color:"#92400E", borderRadius:99,
                    padding:"3px 10px", fontSize:11, fontWeight:600,
                  }}>
                    {exam.difficulty === "easy" ? "⚡ Easy" : exam.difficulty === "medium" ? "🔥 Medium" : "💪 Hard"}
                  </span>
                </div>
              </div>
            )}
          </div>
        );
      })}

      {/* Share + Retake */}
      <div style={{ display:"flex", gap:10, marginTop:16 }}>
        <button onClick={share} style={{
          flex:1, padding:14, background:"#25D366", color:"#fff",
          border:"none", borderRadius:12, fontWeight:700, fontSize:14, cursor:"pointer",
          boxShadow:"0 6px 18px rgba(37,211,102,0.3)", fontFamily: FONT,
        }}>📲 Share on WhatsApp</button>
        <button onClick={onRetake} style={{
          flex:1, padding:14, background:"#fff", color:"#475569",
          border:"1px solid #E2E8F0", borderRadius:12, fontWeight:700, fontSize:14, cursor:"pointer",
          fontFamily: FONT,
        }}>🔄 Retake Quiz</button>
      </div>

      {/* About JobsTrackr + open the full app */}
      <div style={{ marginTop:24 }}>
        <AboutJobsTrackr />
        <div style={{ marginTop:14 }}>
          <OpenAppButton />
        </div>
        <p style={{ textAlign:"center", fontFamily: FONT, fontSize:11.5, color:"#94a3b8", margin:"14px 0 0" }}>
          jobstrackr.in · Smart App for Smart Aspirants
        </p>
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function GovtJobQuiz() {
  const [step, setStep] = useState(-1);
  const [answers, setAnswers] = useState({});
  const [results, setResults] = useState(null);
  const q = QUESTIONS[step];

  const handleAnswer = (val) => {
    if (!q) return;
    if (q.type === "multi") {
      const cur = answers[q.id] || [];
      setAnswers(p => ({ ...p, [q.id]: cur.includes(val) ? cur.filter(v => v !== val) : [...cur, val] }));
    } else {
      setAnswers(p => ({ ...p, [q.id]: val }));
      // Auto-advance on single select after short delay
      setTimeout(() => {
        if (step < QUESTIONS.length - 1) setStep(s => s + 1);
        else {
          const scored = EXAMS.map(exam => ({ exam, score: scoreExam(exam, answers) }))
            .filter(r => r.score !== null).sort((a, b) => b.score - a.score);
          setResults(scored);
          setStep(QUESTIONS.length);
        }
      }, 300);
    }
  };

  const handleNext = () => {
    if (step < QUESTIONS.length - 1) { setStep(s => s + 1); return; }
    const scored = EXAMS.map(exam => ({ exam, score: scoreExam(exam, answers) }))
      .filter(r => r.score !== null).sort((a, b) => b.score - a.score);
    setResults(scored);
    setStep(QUESTIONS.length);
  };

  const canNext = () => {
    if (!q) return false;
    const v = answers[q.id];
    return q.type === "multi" ? v && v.length > 0 : !!v;
  };

  const retake = () => { setStep(-1); setAnswers({}); setResults(null); };

  // ── Landing ──
  if (step === -1) return (
    <div style={{
      minHeight:"100vh", position:"relative", overflow:"hidden", fontFamily: FONT,
      background:"radial-gradient(125% 80% at 50% -8%, #16397f 0%, #0a1f4d 46%, #050f2b 100%)",
    }}>
      {/* ambient glow */}
      <div style={{ position:"absolute", top:-130, left:"50%", transform:"translateX(-50%)", width:440, height:440, background:"radial-gradient(circle, rgba(116,185,255,0.18), transparent 70%)", pointerEvents:"none" }} />

      <div style={{
        position:"relative", maxWidth:480, margin:"0 auto",
        padding:"clamp(40px,9vh,76px) 22px 40px",
        display:"flex", flexDirection:"column", alignItems:"center",
      }}>
        {/* App icon hero */}
        <div style={{ position:"relative", marginBottom:20 }}>
          <div style={{ position:"absolute", inset:-16, borderRadius:36, background:"radial-gradient(circle, rgba(116,185,255,0.4), transparent 70%)", filter:"blur(8px)" }} />
          <img src={LOGO_SRC} alt="JobsTrackr" width={92} height={92}
            style={{ position:"relative", borderRadius:24, boxShadow:"0 20px 52px rgba(4,12,40,0.6)" }} />
        </div>

        <div style={{ fontWeight:800, fontSize:19, letterSpacing:"-0.5px", color:"#fff", marginBottom:18 }}>
          Jobs<span style={{ color:"#74B9FF" }}>Trackr</span>
        </div>

        {/* eyebrow pill */}
        <div style={{ display:"inline-flex", alignItems:"center", gap:7, padding:"6px 14px", borderRadius:99, background:"rgba(116,185,255,0.1)", border:"1px solid rgba(116,185,255,0.25)", marginBottom:22 }}>
          <span style={{ width:7, height:7, borderRadius:99, background:"#4ade80", boxShadow:"0 0 8px #4ade80" }} />
          <span style={{ fontSize:12, fontWeight:600, color:"#bcd4ff", letterSpacing:"0.2px" }}>Free Career Quiz</span>
        </div>

        <h1 style={{ fontSize:"clamp(31px,8.5vw,47px)", fontWeight:900, color:"#fff", textAlign:"center", margin:"0 0 16px", lineHeight:1.08, letterSpacing:"-1.3px" }}>
          Which Govt Job<br/>
          <span style={{ background:"linear-gradient(100deg,#74B9FF,#BFDBFE)", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent" }}>suits you best?</span>
        </h1>

        <p style={{ color:"#9fb3d9", fontSize:15.5, textAlign:"center", maxWidth:344, lineHeight:1.7, margin:"0 0 30px" }}>
          Answer 10 quick questions and get a personalised, ranked list of the exams
          you're actually eligible for — and can crack.
        </p>

        {/* stat pills */}
        <div style={{ display:"flex", gap:10, marginBottom:30, flexWrap:"wrap", justifyContent:"center" }}>
          {[["50","Exams"],["10","Questions"],["2 min","To finish"]].map(([n,l]) => (
            <div key={l} style={{ padding:"11px 20px", borderRadius:14, background:"rgba(255,255,255,0.05)", border:"1px solid rgba(147,197,253,0.15)", textAlign:"center", minWidth:80 }}>
              <div style={{ fontSize:20, fontWeight:900, color:"#fff", letterSpacing:"-0.6px" }}>{n}</div>
              <div style={{ fontSize:11, color:"#7e93ba", marginTop:2, fontWeight:600 }}>{l}</div>
            </div>
          ))}
        </div>

        <button onClick={() => setStep(0)} style={{
          width:"100%", maxWidth:340, padding:"17px",
          background:"linear-gradient(90deg,#4A90D9,#1A4FAF)",
          color:"#fff", border:"none", borderRadius:15, fontSize:17, fontWeight:800,
          cursor:"pointer", boxShadow:"0 12px 36px rgba(26,80,175,0.55)",
          letterSpacing:"-0.3px", fontFamily: FONT,
        }}>
          Find My Match →
        </button>
        <p style={{ color:"#5f74a0", fontSize:12, margin:"14px 0 0", fontWeight:500 }}>No signup · Results in 2 minutes</p>

        {/* About JobsTrackr + open the full app */}
        <div style={{ width:"100%", marginTop:42, display:"flex", flexDirection:"column", gap:14 }}>
          <AboutJobsTrackr light />
          <OpenAppButton />
          <p style={{ textAlign:"center", fontSize:11.5, color:"#5f74a0", margin:0 }}>
            jobstrackr.in · Smart App for Smart Aspirants
          </p>
        </div>
      </div>
    </div>
  );

  // ── Results ──
  if (step === QUESTIONS.length && results) return (
    <div style={{ minHeight:"100vh", background:"#F0F6FF", padding:"20px 16px 48px" }}>
      <div style={{ maxWidth:500, margin:"0 auto" }}>
        <ResultCard results={results} onRetake={retake} />
      </div>
    </div>
  );

  // ── Quiz ──
  return (
    <div style={{ minHeight:"100vh", background:"#F0F6FF", padding:"18px 16px" }}>
      <div style={{ maxWidth:500, margin:"0 auto" }}>
        {/* Topbar */}
        <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:18 }}>
          <JobsTrackrLogo size={28} />
          {step > 0 && (
            <button onClick={() => setStep(s => s - 1)} style={{
              background:"#fff", border:"1px solid #DBEAFE",
              borderRadius:8, padding:"5px 10px", cursor:"pointer",
              color:"#3B82F6", fontSize:13, fontWeight:700, marginLeft:4,
            }}>← Back</button>
          )}
          <ProgressBar current={step + 1} total={QUESTIONS.length} />
        </div>

        {/* Question card */}
        <div style={{
          background:"#fff", borderRadius:20, padding:"26px 20px",
          boxShadow:"0 4px 24px rgba(37,99,235,0.1)",
          border:"1px solid #DBEAFE", marginBottom:14,
        }}>
          <div style={{ fontSize:36, marginBottom:10 }}>{q.emoji}</div>
          <h2 style={{
            margin:"0 0 6px", fontSize:19, fontWeight:800, color:"#0f172a", lineHeight:1.3,
          }}>
            {q.question}
          </h2>
          {q.type === "multi" && (
            <p style={{ margin:"0 0 18px", fontSize:13, color:"#64748b" }}>
              Select all that apply
            </p>
          )}
          {q.type !== "multi" && <div style={{ marginBottom:18 }} />}
          {q.options.map(opt => (
            <OptionBtn key={opt.value} option={opt}
              selected={answers[q.id]} onClick={handleAnswer} multi={q.type==="multi"} />
          ))}
        </div>

        {/* Next button — only shown for multi-select */}
        {q.type === "multi" && (
          <button onClick={handleNext} disabled={!canNext()} style={{
            width:"100%", padding:15,
            background: canNext() ? "linear-gradient(90deg,#4A90D9,#1A4FAF)" : "#E2E8F0",
            color: canNext() ? "#fff" : "#94a3b8",
            border:"none", borderRadius:12, fontSize:15, fontWeight:800,
            cursor: canNext() ? "pointer" : "not-allowed", transition:"all 0.2s",
            boxShadow: canNext() ? "0 4px 16px rgba(37,99,235,0.3)" : "none",
          }}>
            {step === QUESTIONS.length - 1 ? "See My Matches 🎯" : "Next →"}
          </button>
        )}

        {/* Single select hint */}
        {q.type === "single" && (
          <p style={{ textAlign:"center", fontSize:12, color:"#94a3b8", margin:"8px 0 0" }}>
            Tap an option to continue automatically
          </p>
        )}
      </div>
    </div>
  );
}
