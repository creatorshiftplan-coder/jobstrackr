import {
  EligibilityQualificationLevel,
  EligibilityQualificationStream,
} from "@/types/job";

export type EligibilityFixtureBucket = "can_apply" | "skills_gap" | "not_eligible" | "review_needed";

export interface EligibilityParserFixture {
  id: string;
  title: string;
  eligibility: string;
  expectedBucket: EligibilityFixtureBucket;
  expectedFlags?: string[];
  expectedTags?: string[];
  expectedGlobalRegistrations?: string[];
  expectedGlobalLanguages?: string[];
  expectedGlobalResidencyRules?: string[];
  expectedNegativeConstraints?: string[];
  expectedAlternativeCount?: number;
  expectedAlternativeLevels?: EligibilityQualificationLevel[][];
  expectedAlternativeStreams?: EligibilityQualificationStream[][];
  notes?: string;
}

export const ELIGIBILITY_PARSER_FIXTURES: EligibilityParserFixture[] = [
  {
    id: "junior-engineer-civil-degree-or-diploma",
    title: "Junior Engineer (Civil)",
    eligibility:
      "Degree in Civil Engineering from a recognized university OR Three years Diploma in Civil Engineering from a recognized university/Board/Institute plus two years' experience in planning, execution and maintenance of civil engineering works.",
    expectedBucket: "can_apply",
    expectedFlags: ["multiple_paths"],
    expectedTags: [
      "qual_stream:engineering",
      "qual_specialization:civil_engineering",
      "qual_level:graduation",
      "qual_level:diploma",
      "experience:min_2_years",
      "quality:multiple_paths",
    ],
    expectedAlternativeCount: 2,
    expectedAlternativeLevels: [["graduation"], ["diploma"]],
    expectedAlternativeStreams: [["engineering"], ["engineering"]],
    notes: "Canonical OR-branch case where experience belongs only to the diploma path.",
  },
  {
    id: "staff-nurse-pnrc-punjabi",
    title: "BFUHS Staff Nurse",
    eligibility:
      "10+2 (Senior Secondary) or equivalent from a recognized board. | Diploma in General Nursing & Midwifery (GNM) or B.Sc Nursing from a recognized university/institution. | Must be registered as Nurse and Midwife with Punjab Nurses Registration Council (PNRC), Chandigarh. | Candidate must have passed Punjabi as a subject at Matriculation (10th) level. | Minimum age: 18 years. | Maximum age: 37 years. | SC / BC candidates: Relaxation up to 5 years. | Persons with Disabilities (PwD): Relaxation up to 10 years.",
    expectedBucket: "skills_gap",
    expectedFlags: ["multiple_paths"],
    expectedTags: [
      "registration:nursing_council",
      "language:punjabi",
      "qual_stream:nursing",
      "quality:multiple_paths",
    ],
    expectedGlobalRegistrations: ["nursing_council"],
    expectedGlobalLanguages: ["punjabi"],
    expectedAlternativeCount: 2,
    expectedAlternativeLevels: [["diploma"], ["graduation"]],
    expectedAlternativeStreams: [["nursing"], ["nursing"]],
    notes: "Registration and Punjabi requirement should stay global while qualification remains route-based.",
  },
  {
    id: "law-bar-council-bengali",
    title: "Civil Judge",
    eligibility:
      "1. A degree in Law from any University or Institution affiliated to any University recognized by the State Government or the Central Government; 2. Enrolment as an advocate in the roll of Bar Council of any State or Union Territory in India on the date of advertisement for the examination; 3. Ability to read, write and speak in Bengali (not required for those candidates whose mother tongue is Nepali).",
    expectedBucket: "skills_gap",
    expectedTags: [
      "qual_stream:law",
      "registration:bar_council",
      "language:bengali",
    ],
    expectedGlobalRegistrations: ["bar_council"],
    expectedGlobalLanguages: ["bengali"],
    expectedAlternativeCount: 1,
    expectedAlternativeLevels: [["graduation"]],
    expectedAlternativeStreams: [["law"]],
    notes: "Registration and language must be preserved as first-class global constraints.",
  },
  {
    id: "anganwadi-female-village-resident",
    title: "Anganwadi Worker",
    eligibility:
      "10+2 Intermediate Exam Passed OR Equivalent Eligibility From Any Recognized Board/ Institutions in India. Candidate should be a resident of the Village Assembly/Ward (in case of urban areas) where the Anganwadi Centre is located. Only female candidates are eligible.",
    expectedBucket: "review_needed",
    expectedFlags: ["multiple_paths"],
    expectedTags: [
      "qual_level:12th",
      "restriction:female_only",
      "restriction:residency:same_village_or_ward",
    ],
    expectedGlobalResidencyRules: ["same_village_or_ward"],
    expectedNegativeConstraints: ["female_only"],
    expectedAlternativeCount: 2,
    expectedAlternativeLevels: [["12th"], []],
    notes: "Conservative bucket because residency plus gender restriction should never silently pass when user data is incomplete.",
  },
  {
    id: "scr-apprentice-higher-qualification-not-allowed",
    title: "South Central Railway Act Apprentice",
    eligibility:
      "10th class/SSC passed under 10+2 system with minimum 50% aggregate marks from a recognised board. ITI certificate in the relevant notified trade from an institute recognised by NCVT/SCVT. Engineering graduates and diploma holders are not eligible for this Act Apprentice notification.",
    expectedBucket: "review_needed",
    expectedTags: [
      "qual_level:10th",
      "qual_level:iti",
      "qualification_status:recognized_institution_required",
      "restriction:higher_qualification_not_allowed",
    ],
    expectedNegativeConstraints: ["higher_qualification_not_allowed"],
    expectedAlternativeCount: 1,
    expectedAlternativeLevels: [["10th", "iti"]],
    expectedAlternativeStreams: [["general"]],
    notes: "Negative constraint case where higher qualifications disqualify the candidate.",
  },
  {
    id: "uidai-aadhaar-operator-certificate",
    title: "Aadhaar Operator",
    eligibility:
      "Applicant must be a citizen of India. Minimum age is 18 years. Educational qualification requires one of the following: 12th (Intermediate / Senior Secondary) pass, OR Matriculation + 2 Years ITI, OR Matriculation + 3 Years Polytechnic Diploma. Additionally, a mandatory Aadhaar Operator / Supervisor Certificate issued by a UIDAI authorized agency is required.",
    expectedBucket: "skills_gap",
    expectedFlags: ["multiple_paths"],
    expectedTags: [
      "registration:uidai",
      "qual_level:12th",
      "qual_level:10th",
      "qual_level:iti",
      "qual_level:diploma",
      "quality:multiple_paths",
    ],
    expectedGlobalRegistrations: ["uidai"],
    expectedAlternativeCount: 3,
    expectedAlternativeLevels: [["12th"], ["10th", "iti"], ["10th", "diploma"]],
    notes: "Global certificate constraint with three qualification routes.",
  },
  {
    id: "office-assistant-local-language-computer-district",
    title: "Office Assistant",
    eligibility:
      "Graduate viz. BSW/BA/B.Com with computer knowledge. Shall be fluent in spoken and written local language. Fluency in Hindi/English would be an added qualification. Shall be proficient in MS Office (Word and Excel), Tally & Internet. Candidate should be resident of the same district/residing at the head quarter of RSETI centre.",
    expectedBucket: "skills_gap",
    expectedTags: [
      "qual_level:graduation",
      "skill:computer",
      "language:local_language",
      "language:hindi",
      "language:english",
      "restriction:residency:same_district",
    ],
    expectedGlobalLanguages: ["local_language", "hindi", "english"],
    expectedGlobalResidencyRules: ["same_district"],
    expectedAlternativeCount: 1,
    expectedAlternativeLevels: [["graduation"]],
    notes: "Local language and residency should stay visible instead of collapsing into a generic graduate job.",
  },
  {
    id: "data-entry-hindi-typing-and-computer-diploma",
    title: "Data Entry Operator",
    eligibility:
      "10+2 passed from recognized board OR old Higher Secondary + first year graduation, One-year Diploma/Certificate in Data Entry Operator/Programming from recognized institute, Hindi typing speed of 5000 key depressions per hour on computer, Certificate of Hindi/English typing speed 5000 key depressions per hour from recognized board/CG Shorthand & Typewriting Council",
    expectedBucket: "skills_gap",
    expectedFlags: ["multiple_paths"],
    expectedTags: [
      "qual_level:12th",
      "qual_level:graduation",
      "qual_specialization:data_entry_operator",
      "language:hindi",
      "language:english",
      "skill:typing_hindi",
      "skill:computer",
      "qual_mode:certificate",
    ],
    expectedAlternativeCount: 2,
    expectedAlternativeLevels: [["12th"], ["graduation"]],
    notes: "Typing and certificate requirements should remain structured gaps, not generic free-text skill noise.",
  },
  {
    id: "norcet-nursing-registration-dual-route",
    title: "NORCET Nursing Officer",
    eligibility:
      "Candidates must possess one of the following qualifications and be registered with the State/Indian Nursing Council: (a) B.Sc. (Hons.) Nursing / B.Sc. Nursing / Post-Basic B.Sc. Nursing from an Indian Nursing Council/State Nursing Council recognized Institute/University. OR (b) Diploma in General Nursing Midwifery (GNM) from an Indian Nursing Council/State Nursing Council recognized Institute/Board or Council AND Registered as Nurses & Midwife in State / Indian Nursing Council AND Two Years' Experience in a minimum 50 bedded hospital after acquiring the educational qualification.",
    expectedBucket: "skills_gap",
    expectedFlags: ["multiple_paths"],
    expectedTags: [
      "registration:nursing_council",
      "qual_stream:nursing",
      "qual_level:graduation",
      "qual_level:diploma",
      "experience:min_2_years",
      "quality:multiple_paths",
    ],
    expectedGlobalRegistrations: ["nursing_council"],
    expectedAlternativeCount: 2,
    expectedAlternativeLevels: [["graduation"], ["diploma"]],
    expectedAlternativeStreams: [["nursing"], ["nursing"]],
    notes: "Registration is global while experience should remain branch-local to the GNM route.",
  },
  {
    id: "works-foreman-manual-review",
    title: "Works Foreman",
    eligibility:
      "Refer to Advertisement No.: R/Works Foreman/2/2026 for details of eligibility, Scale of Pay, other conditions, Advertisement etc.",
    expectedBucket: "review_needed",
    expectedFlags: ["manual_review", "review_needed"],
    expectedTags: ["quality:manual_review", "quality:review_needed"],
    expectedAlternativeCount: 1,
    notes: "Reference-only notices must never be promoted into Can Apply.",
  },
  {
    id: "mmrda-post-wise-mixed-notice",
    title: "MMRDA Assistant Engineer, Junior Engineer & Other Posts",
    eligibility:
      "Eligibility criteria vary by post. For Assistant Engineer (Civil/Railway/Signal & Telecom), a Degree in relevant engineering is required. For Deputy Planner, a Degree in Planning is needed. Assistant Engineer Class-2 / Junior Engineer posts require a Diploma / Degree in Engineering. Assistant Legal Officer requires an LLB. Horticulture Assistant needs a Degree / Diploma in Horticulture. Shorthand Typist needs SSC + Shorthand. Surveyor needs SSC + Surveyor Course. Computer Technician needs SSC + ITI.",
    expectedBucket: "review_needed",
    expectedFlags: ["manual_review", "review_needed", "post_wise_eligibility"],
    expectedTags: [
      "quality:manual_review",
      "quality:review_needed",
      "quality:post_wise_eligibility",
    ],
    expectedAlternativeCount: 1,
    notes: "Multi-post eligibility should be forced into review until post-level splitting is implemented.",
  },
  {
    id: "special-education-rci-jtet",
    title: "Special Education Teacher",
    eligibility:
      "10+2 with D. Ed. Special Education (for Class 1-5) or Graduation with B. Ed. Special Education (for Class 6-8) and valid RCI CRR number. JTET Exam Passed is also required.",
    expectedBucket: "skills_gap",
    expectedFlags: ["multiple_paths"],
    expectedTags: [
      "qual_stream:teaching",
      "registration:rci",
      "registration:cet",
      "qual_specialization:special_education",
      "quality:multiple_paths",
    ],
    expectedGlobalRegistrations: ["rci", "cet"],
    expectedAlternativeCount: 2,
    expectedAlternativeLevels: [["12th", "diploma"], ["graduation"]],
    expectedAlternativeStreams: [["teaching"], ["teaching"]],
    notes: "RCI and JTET are global registration-like checks layered on top of route-specific qualifications.",
  },
  {
    id: "medical-specialty-md-or-diploma",
    title: "Specialist Doctor",
    eligibility:
      "A recognized Bachelor of Medicine and Bachelor of Surgery (M.B.B.S.) degree qualification. Post graduate degree or diploma in the concerned specialty, specifically Doctor of Medicine (Medicine) or Doctor of Medicine (General Medicine). Three years experience in the concerned specialty or super specialty after obtaining the first postgraduate degree or five years experience after the postgraduate diploma.",
    expectedBucket: "can_apply",
    expectedTags: [
      "qual_stream:medical",
      "qual_level:graduation",
      "qual_level:post_graduation",
      "experience:min_3_years",
    ],
    expectedAlternativeCount: 1,
    expectedAlternativeLevels: [["graduation", "post_graduation", "diploma"]],
    expectedAlternativeStreams: [["medical"]],
    notes: "Medical specialization route with postgraduate and experience requirements should remain medical-specific, not generic postgraduate.",
  },
];
