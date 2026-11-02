import type {
  CategoryName,
  ExceptionCode,
  MatchStatus,
  PaymentSource,
  StatementLine,
} from "@/core/schemas";
import { createRng, intBetween, type Rng, shuffle } from "./rng";
import type {
  BaselineSubset,
  FileKind,
  GroundTruthReceipt,
  IntakeReceipt,
  Splits,
  TestCaseId,
} from "./schema";

// One synthetic month. Every vendor, person, and amount is fictional
// (docs/sprint/06-evaluation-plan.md, "Dataset").

export const MONTH_KEY = "2026-10";
export const SEED = 20261001;

export type Layout = "cafe" | "airline" | "invoice" | "hardware" | "adplatform" | "coworking";

export interface Vendor {
  name: string;
  address: string[];
  locale: "au" | "us" | "eu";
  abn?: string;
  phone?: string;
}

interface LineDef {
  lagDays: number; // days from receipt date to statement posting date
  description: string;
  account?: "company_card" | "bank";
  chargedCents?: number; // AUD amount charged when it differs from the receipt
}

interface ScenarioDef {
  id: string;
  testCases?: TestCaseId[];
  layout: Layout;
  file: FileKind;
  photoSize?: [number, number];
  vendor: Vendor;
  date: string;
  items: [string, number][]; // description, cents
  currency?: "AUD" | "USD";
  category: CategoryName;
  submitterId: string;
  paymentSource?: PaymentSource;
  businessPurpose: string;
  line: LineDef | null;
  expect?: {
    matchStatus: MatchStatus;
    exceptions: ExceptionCode[];
    afterMatchChoice?: ExceptionCode[]; // what fires once a human chooses the correct line
  };
  note?: string;
}

interface DuplicateDef {
  id: string;
  of: string;
  mode: "exact" | "rephoto";
  testCases: TestCaseId[];
  submitterId: string;
  businessPurpose: string;
  note: string;
}

interface NoiseLineDef {
  date: string;
  description: string;
  amountCents: number;
  note: string;
}

const AU_ADDRESS = ["Sample City NSW 2000"];

const V = {
  sampleCafe: {
    name: "Sample Café",
    address: ["18 Example Street", ...AU_ADDRESS],
    locale: "au",
    abn: "11 222 333 444",
    phone: "(02) 5550 0101",
  },
  harbourCafe: {
    name: "Harbour Lane Cafe",
    address: ["3 Harbour Lane", ...AU_ADDRESS],
    locale: "au",
    abn: "22 333 444 555",
    phone: "(02) 5550 0102",
  },
  kioskCafe: {
    name: "Station Kiosk Cafe",
    address: ["Platform 1, Central Station", ...AU_ADDRESS],
    locale: "au",
    abn: "33 444 555 666",
  },
  bistro: {
    name: "Corner Bistro Restaurant",
    address: ["101 Example Road", "Example Bay VIC 3000"],
    locale: "au",
    abn: "44 555 666 777",
    phone: "(03) 5550 0104",
  },
  catering: {
    name: "Bayside Catering Co.",
    address: ["7 Sample Parade", ...AU_ADDRESS],
    locale: "au",
    abn: "55 666 777 888",
    phone: "(02) 5550 0105",
  },
  taxi: {
    name: "Metro Taxi Co.",
    address: ["Sample City NSW"],
    locale: "au",
    abn: "66 777 888 999",
    phone: "13 55 50",
  },
  airline: {
    name: "Test Airline",
    address: ["Terminal 2, Sample City Airport NSW 2020"],
    locale: "au",
    abn: "77 888 999 000",
  },
  hotel: {
    name: "Sample Harbour Hotel",
    address: ["1 Wharf Street", "Example Bay VIC 3000"],
    locale: "au",
    abn: "88 999 000 111",
    phone: "(03) 5550 0108",
  },
  nimbus: {
    name: "Nimbus Compute Inc.",
    address: ["500 Example Avenue, Suite 200", "Sample Town, CA 94000, USA"],
    locale: "us",
  },
  pixelboard: {
    name: "Pixelboard Inc.",
    address: ["22 Demo Street", "Sample Town, NY 10000, USA"],
    locale: "us",
  },
  vectorly: {
    name: "Vectorly Inc.",
    address: ["9 Placeholder Blvd", "Sample Town, WA 98000, USA"],
    locale: "us",
  },
  teamline: {
    name: "Teamline Inc.",
    address: ["400 Sample Street", "Sample Town, CA 94000, USA"],
    locale: "us",
  },
  nordhavn: {
    name: "Nordhavn Analytics GmbH",
    address: ["Beispielstraße 4", "10115 Berlin, Germany"],
    locale: "eu",
  },
  demoCloud: {
    name: "Demo Cloud Pty Ltd",
    address: ["Level 5, 60 Example Street", ...AU_ADDRESS],
    locale: "au",
    abn: "99 000 111 222",
  },
  telco: {
    name: "Example Telco Pty Ltd",
    address: ["PO Box 100", ...AU_ADDRESS],
    locale: "au",
    abn: "10 203 040 506",
  },
  energy: {
    name: "Example Energy Pty Ltd",
    address: ["PO Box 200", ...AU_ADDRESS],
    locale: "au",
    abn: "20 304 050 607",
  },
  appStore: {
    name: "Sample App Store",
    address: ["Sample City NSW"],
    locale: "au",
    abn: "30 405 060 708",
  },
  ads: {
    name: "Brightreach Ads Pty Ltd",
    address: ["Level 12, 1 Sample Plaza", ...AU_ADDRESS],
    locale: "au",
    abn: "40 506 070 809",
  },
  coworking: {
    name: "Hub Coworking",
    address: ["Level 3, 25 Example Lane", ...AU_ADDRESS],
    locale: "au",
    abn: "50 607 080 910",
    phone: "(02) 5550 0120",
  },
  hardware: {
    name: "Ironbark Hardware",
    address: ["88 Trade Road", "Sample City NSW 2010"],
    locale: "au",
    abn: "60 708 091 011",
    phone: "(02) 5550 0121",
  },
  stationers: {
    name: "Sample Stationers",
    address: ["12 Example Arcade", ...AU_ADDRESS],
    locale: "au",
    abn: "70 809 101 112",
  },
  repairs: {
    name: "QuickFix Repairs",
    address: ["5 Workshop Way", "Sample City NSW 2015"],
    locale: "au",
    abn: "80 910 111 213",
    phone: "0400 555 013",
  },
} satisfies Record<string, Vendor>;

const SCENARIOS: ScenarioDef[] = [
  {
    id: "R01",
    testCases: ["TC01"],
    layout: "cafe",
    file: "pdf",
    vendor: V.sampleCafe,
    date: "2026-10-02",
    items: [
      ["Flat white", 550],
      ["Ham & cheese croissant", 850],
      ["Banana bread", 450],
    ],
    category: "Meals & Entertainment",
    submitterId: "staff-a",
    businessPurpose: "Coffee with prospective client",
    line: { lagDays: 0, description: "SQ *SAMPLE CAFE SAMPLE CITY AU" },
  },
  {
    id: "R02",
    testCases: ["TC02"],
    layout: "invoice",
    file: "pdf",
    vendor: V.nimbus,
    date: "2026-10-05",
    currency: "USD",
    items: [["Compute plan: Team (October 2026)", 4900]],
    category: "AI & Cloud",
    submitterId: "staff-b",
    businessPurpose: "Model hosting for internal tools",
    line: { lagDays: 1, description: "NIMBUS COMPUTE INC 800-555-0100 US" },
    note: "Statement shows USD 49.00 original plus AUD charge including a 3% foreign transaction fee. Match on the USD amount (R-CUR-4).",
  },
  {
    id: "R03",
    testCases: ["TC03"],
    layout: "invoice",
    file: "pdf",
    vendor: V.nordhavn,
    date: "2026-10-06",
    items: [["Analytics dashboard licence: October", 8900]],
    category: "Software",
    submitterId: "staff-b",
    businessPurpose: "Marketing analytics dashboard",
    line: { lagDays: 1, description: "NORDHAVN ANALYTICS BERLIN DE" },
    note: "Foreign vendor that bills in AUD (printed 'AUD 89.00'). Must stay AUD and count in totals (R-CUR-1, E2 regression).",
  },
  {
    id: "R04",
    testCases: ["TC04"],
    layout: "hardware",
    file: "pdf",
    vendor: V.repairs,
    date: "2026-10-08",
    items: [
      ["Call-out and labour: replace office door closer", 32000],
      ["Door closer unit", 18000],
    ],
    category: "Repairs & Maintenance",
    submitterId: "staff-c",
    businessPurpose: "Fix office front door closer",
    line: { lagDays: 2, description: "QUICKFIX REPAIRS SAMPLE CITY", chargedCents: 56000 },
    expect: {
      matchStatus: "ambiguous",
      exceptions: ["AMBIGUOUS_MATCH"],
      afterMatchChoice: ["AMOUNT_DIFFERS_OVER_THRESHOLD"],
    },
    note: "Receipt 500.00, charged 560.00 (12%, over the 10% threshold). Never auto-paired; the 560.00 line is a candidate. Choosing it fires the over-threshold flag (R-AMT-2, confirmed 2026-11-02).",
  },
  {
    id: "R05",
    testCases: ["TC05"],
    layout: "cafe",
    file: "photo",
    vendor: V.harbourCafe,
    date: "2026-10-09",
    items: [
      ["Lunch special x2", 3600],
      ["Long black x2", 600],
    ],
    category: "Meals & Entertainment",
    submitterId: "staff-c",
    businessPurpose: "Lunch with contractor during site visit",
    line: { lagDays: 1, description: "HARBOUR LANE CAFE SAMPLE CITY", chargedCents: 4400 },
    note: "Receipt 42.00, charged 44.00 (tip added on the terminal). Within threshold: a normal match with a +2.00 difference badge (R-AMT-3, confirmed 2026-11-02).",
  },
  {
    id: "R06",
    testCases: ["TC06"],
    layout: "cafe",
    file: "photo",
    vendor: V.taxi,
    date: "2026-10-12",
    items: [
      ["Fare", 3240],
      ["Booking fee", 400],
    ],
    category: "Travel",
    submitterId: "staff-d",
    businessPurpose: "",
    line: { lagDays: 0, description: "METRO TAXI CO SAMPLE CITY" },
    expect: { matchStatus: "matched", exceptions: ["MISSING_PURPOSE"] },
    note: "Blank business purpose.",
  },
  {
    id: "R07",
    testCases: ["TC06"],
    layout: "hardware",
    file: "photo",
    vendor: V.stationers,
    date: "2026-10-13",
    items: [
      ["A4 copy paper, 5 ream box", 2495],
      ["Ballpoint pens, 10 pack", 300],
    ],
    category: "Office Supplies",
    submitterId: "staff-e",
    businessPurpose: "n/a",
    line: { lagDays: 1, description: "SAMPLE STATIONERS SAMPLE CITY" },
    expect: { matchStatus: "matched", exceptions: ["MISSING_PURPOSE"] },
    note: "Placeholder business purpose 'n/a'.",
  },
  {
    id: "R08",
    testCases: ["TC07"],
    layout: "invoice",
    file: "pdf",
    vendor: V.catering,
    date: "2026-10-15",
    items: [
      ["Working lunch platter (12 people)", 26400],
      ["Juice and sparkling water", 4800],
    ],
    category: "Meals & Entertainment",
    submitterId: "staff-a",
    businessPurpose: "Quarterly planning workshop lunch",
    line: { lagDays: 1, description: "BAYSIDE CATERING CO SAMPLE CITY" },
    note: "Original of the duplicate pair R09 (same file) and R10 (re-photographed).",
  },
  {
    id: "R11",
    testCases: ["TC08"],
    layout: "cafe",
    file: "photo",
    photoSize: [900, 1200],
    vendor: V.bistro,
    date: "2026-10-16",
    items: [
      ["Grilled barramundi", 3450],
      ["Caesar salad", 2200],
      ["Sparkling water", 900],
    ],
    category: "Meals & Entertainment",
    submitterId: "staff-b",
    businessPurpose: "Dinner while travelling for client onsite",
    line: { lagDays: 1, description: "CORNER BISTRO RESTAURANT EXAMPLE BAY" },
    note: "Portrait phone photo, 900 x 1200, skewed. Must pass the gate (R-QUA-1, E5).",
  },
  {
    id: "R12",
    testCases: ["TC09"],
    layout: "airline",
    file: "pdf",
    vendor: V.airline,
    date: "2026-10-04",
    items: [
      ["Fare: Sample City to Example Bay, Economy", 34900],
      ["Seat selection", 2000],
      ["Checked bag 23 kg", 2000],
    ],
    category: "Travel",
    submitterId: "staff-c",
    businessPurpose: "Flight to client workshop",
    line: { lagDays: 0, description: "TEST AIRLINE SAMPLE CITY" },
    note: "Crisp digital PDF with large white areas. Blur check must be skipped (R-QUA-2, E5).",
  },
  {
    id: "R13",
    testCases: ["TC10"],
    layout: "cafe",
    file: "photo",
    vendor: V.kioskCafe,
    date: "2026-10-20",
    items: [
      ["Cappuccino", 520],
      ["Toasted sandwich", 950],
    ],
    category: "Meals & Entertainment",
    submitterId: "staff-d",
    paymentSource: "personal_card",
    businessPurpose: "Coffee during off-site meeting",
    line: null,
    note: "Personal card, no statement line. Offer reimbursement; not an error (R-MAT-3).",
  },
  {
    id: "R14",
    testCases: ["TC10"],
    layout: "cafe",
    file: "photo",
    vendor: V.taxi,
    date: "2026-10-21",
    items: [
      ["Fare", 4810],
      ["Booking fee", 400],
    ],
    category: "Travel",
    submitterId: "staff-e",
    paymentSource: "personal_card",
    businessPurpose: "Taxi home after late client event",
    line: null,
    note: "Personal card, no statement line. Offer reimbursement; not an error (R-MAT-3).",
  },
  {
    id: "R15",
    testCases: ["TC11"],
    layout: "invoice",
    file: "png",
    vendor: V.appStore,
    date: "2026-10-14",
    items: [["Pro subscription: monthly", 1999]],
    category: "Software",
    submitterId: "staff-a",
    businessPurpose: "Design asset app for social posts",
    line: { lagDays: 0, description: "SAMPLE APP STORE SAMPLE CITY" },
    expect: { matchStatus: "ambiguous", exceptions: ["AMBIGUOUS_MATCH"] },
    note: "Two identical 19.99 lines on adjacent days (see noise line on 2026-10-15). Never auto-pick (R-MAT-2).",
  },
  {
    id: "R16",
    testCases: ["TC12"],
    layout: "adplatform",
    file: "pdf",
    vendor: V.ads,
    date: "2026-10-07",
    items: [
      ["Campaign: Spring promo (clicks)", 52000],
      ["Campaign: Brand awareness (impressions)", 23000],
    ],
    category: "Advertising & Marketing",
    submitterId: "staff-b",
    businessPurpose: "October paid social campaigns",
    line: { lagDays: 1, description: "BRIGHTREACH ADS SAMPLE CITY" },
    note: "Ad-platform invoice. Must not land in 'Other' (E3).",
  },
  {
    id: "R17",
    testCases: ["TC12"],
    layout: "invoice",
    file: "pdf",
    vendor: V.demoCloud,
    date: "2026-10-03",
    items: [
      ["Cloud compute (September usage)", 13400],
      ["Object storage", 3200],
      ["Data transfer", 1640],
    ],
    category: "AI & Cloud",
    submitterId: "staff-b",
    businessPurpose: "Hosting for customer portal",
    line: { lagDays: 2, description: "DEMO CLOUD PTY LTD SAMPLE CITY" },
    note: "Cloud bill. Must be AI & Cloud, not Software (E3).",
  },
  {
    id: "R18",
    testCases: ["TC12"],
    layout: "coworking",
    file: "pdf",
    vendor: V.coworking,
    date: "2026-10-19",
    items: [["Day pass x3", 13500]],
    category: "Rent & Workspace",
    submitterId: "staff-c",
    businessPurpose: "Desk space for interstate team visit",
    line: { lagDays: 0, description: "HUB COWORKING SAMPLE CITY" },
    note: "Coworking pass. Must be Rent & Workspace, not Utilities (E3).",
  },
  {
    id: "R19",
    testCases: ["TC12"],
    layout: "hardware",
    file: "photo",
    vendor: V.hardware,
    date: "2026-10-22",
    items: [["Ergonomic office chair, mesh back", 42900]],
    category: "Equipment",
    submitterId: "staff-d",
    businessPurpose: "Chair for new team member",
    line: { lagDays: 1, description: "IRONBARK HARDWARE SAMPLE CITY" },
    note: "Office chair from a hardware store. Must be Equipment, not Office Supplies (E3).",
  },
  {
    id: "R20",
    layout: "invoice",
    file: "pdf",
    vendor: V.hotel,
    date: "2026-10-31",
    items: [
      ["Room: 1 night, standard king", 23900],
      ["Breakfast", 2900],
    ],
    category: "Travel",
    submitterId: "staff-c",
    businessPurpose: "Overnight stay for early client meeting",
    line: null,
    expect: { matchStatus: "unmatched", exceptions: ["NO_PAYMENT_FOUND"] },
    note: "Company card charge posts after the statement period ends, so there is no line.",
  },
  {
    id: "R21",
    layout: "invoice",
    file: "png",
    vendor: V.teamline,
    date: "2026-10-03",
    currency: "USD",
    items: [["Team plan: 1 seat (monthly)", 1200]],
    category: "Software",
    submitterId: "staff-e",
    paymentSource: "unknown",
    businessPurpose: "Team chat seat for new contractor",
    line: { lagDays: 1, description: "TEAMLINE INC SAMPLE TOWN US" },
    note: "Payment source unknown: allowed, visible, editable (R-REQ-2, E8). Not an exception.",
  },
  {
    id: "R22",
    layout: "invoice",
    file: "png",
    vendor: V.teamline,
    date: "2026-10-17",
    currency: "USD",
    items: [["Team plan: 1 seat (monthly)", 1200]],
    category: "Software",
    submitterId: "staff-e",
    businessPurpose: "Team chat seat for second contractor",
    line: { lagDays: 1, description: "TEAMLINE INC SAMPLE TOWN US" },
    note: "Same vendor and amount as R21 on a different date. Not a duplicate (R-DUP-2).",
  },
  // Routine items: one obvious payment, no exceptions.
  {
    id: "R23",
    layout: "invoice",
    file: "pdf",
    vendor: V.pixelboard,
    date: "2026-10-01",
    currency: "USD",
    items: [["Design workspace: Pro (monthly)", 1500]],
    category: "Software",
    submitterId: "staff-a",
    businessPurpose: "Design tool subscription",
    line: { lagDays: 1, description: "PIXELBOARD INC SAMPLE TOWN US" },
  },
  {
    id: "R24",
    layout: "invoice",
    file: "pdf",
    vendor: V.telco,
    date: "2026-10-10",
    items: [["Business internet 100: October", 8995]],
    category: "Utilities",
    submitterId: "staff-b",
    paymentSource: "bank",
    businessPurpose: "Office internet",
    line: { lagDays: 0, description: "DIRECT DEBIT EXAMPLE TELCO", account: "bank" },
    note: "Paid from the business bank account by direct debit (R-REQ-3).",
  },
  {
    id: "R25",
    layout: "cafe",
    file: "photo",
    vendor: V.sampleCafe,
    date: "2026-10-23",
    items: [["Flat white x4", 2200]],
    category: "Meals & Entertainment",
    submitterId: "staff-c",
    businessPurpose: "Coffee for stand-up with visiting client",
    line: { lagDays: 0, description: "SQ *SAMPLE CAFE SAMPLE CITY AU" },
    note: "A different Sample Café charge of 19.00 posts the next day (distractor).",
  },
  {
    id: "R26",
    layout: "airline",
    file: "pdf",
    vendor: V.airline,
    date: "2026-10-26",
    items: [["Fare: Example Bay to Sample City, Economy", 21400]],
    category: "Travel",
    submitterId: "staff-c",
    businessPurpose: "Return flight from client workshop",
    line: { lagDays: 0, description: "TEST AIRLINE SAMPLE CITY" },
  },
  {
    id: "R27",
    layout: "cafe",
    file: "photo",
    vendor: V.taxi,
    date: "2026-10-27",
    items: [
      ["Fare", 2470],
      ["Booking fee", 400],
    ],
    category: "Travel",
    submitterId: "staff-a",
    businessPurpose: "Taxi to client office",
    line: { lagDays: 0, description: "METRO TAXI CO SAMPLE CITY" },
    note: "Another Metro Taxi charge of 31.20 posts the same day (distractor within the amount threshold).",
  },
  {
    id: "R28",
    layout: "invoice",
    file: "pdf",
    vendor: V.hotel,
    date: "2026-10-25",
    items: [["Room: 1 night, standard queen", 18900]],
    category: "Travel",
    submitterId: "staff-c",
    businessPurpose: "Accommodation for client workshop",
    line: { lagDays: 1, description: "SAMPLE HARBOUR HOTEL EXAMPLE BAY" },
  },
  {
    id: "R29",
    layout: "hardware",
    file: "photo",
    vendor: V.hardware,
    date: "2026-10-11",
    items: [
      ["Printer ink cartridge, black", 4290],
      ["A4 copy paper, 2 ream", 1195],
      ["Sticky notes, 12 pack", 1000],
    ],
    category: "Office Supplies",
    submitterId: "staff-e",
    businessPurpose: "Printer supplies for office",
    line: { lagDays: 1, description: "IRONBARK HARDWARE SAMPLE CITY" },
  },
  {
    id: "R30",
    layout: "adplatform",
    file: "pdf",
    vendor: V.ads,
    date: "2026-10-28",
    items: [["Campaign: Retargeting (clicks)", 42000]],
    category: "Advertising & Marketing",
    submitterId: "staff-b",
    businessPurpose: "Retargeting campaign",
    line: { lagDays: 1, description: "BRIGHTREACH ADS SAMPLE CITY" },
  },
  {
    id: "R31",
    layout: "invoice",
    file: "pdf",
    vendor: V.nimbus,
    date: "2026-10-18",
    currency: "USD",
    items: [["GPU inference credits", 11240]],
    category: "AI & Cloud",
    submitterId: "staff-b",
    businessPurpose: "Inference credits for document pilot",
    line: { lagDays: 1, description: "NIMBUS COMPUTE INC 800-555-0100 US" },
  },
  {
    id: "R32",
    layout: "invoice",
    file: "pdf",
    vendor: V.catering,
    date: "2026-10-29",
    items: [["Morning tea platter (8 people)", 15600]],
    category: "Meals & Entertainment",
    submitterId: "staff-a",
    businessPurpose: "Client onboarding session morning tea",
    line: { lagDays: 1, description: "BAYSIDE CATERING CO SAMPLE CITY" },
    note: "Same amount as R40 (156.00) but a different vendor and date.",
  },
  {
    id: "R33",
    layout: "coworking",
    file: "pdf",
    vendor: V.coworking,
    date: "2026-10-09",
    items: [["Meeting room: 2 hours", 6000]],
    category: "Rent & Workspace",
    submitterId: "staff-d",
    businessPurpose: "Meeting room for candidate interviews",
    line: { lagDays: 0, description: "HUB COWORKING SAMPLE CITY" },
  },
  {
    id: "R34",
    layout: "cafe",
    file: "photo",
    vendor: V.bistro,
    date: "2026-10-30",
    items: [
      ["Set menu x2", 7800],
      ["Soft drinks x2", 1020],
    ],
    category: "Meals & Entertainment",
    submitterId: "staff-b",
    businessPurpose: "Dinner with partner agency",
    line: { lagDays: 1, description: "CORNER BISTRO RESTAURANT EXAMPLE BAY" },
  },
  {
    id: "R35",
    layout: "hardware",
    file: "photo",
    vendor: V.stationers,
    date: "2026-10-06",
    items: [
      ["Whiteboard markers, 8 pack", 1450],
      ["Spiral notebooks, 5 pack", 1680],
      ["Desk organiser", 1000],
    ],
    category: "Office Supplies",
    submitterId: "staff-e",
    businessPurpose: "Stationery restock",
    line: { lagDays: 1, description: "SAMPLE STATIONERS SAMPLE CITY" },
  },
  {
    id: "R36",
    layout: "hardware",
    file: "pdf",
    vendor: V.repairs,
    date: "2026-10-20",
    items: [
      ["Laptop screen replacement: labour", 9000],
      ["Replacement screen panel", 13000],
    ],
    category: "Repairs & Maintenance",
    submitterId: "staff-d",
    businessPurpose: "Repair cracked laptop screen",
    line: { lagDays: 2, description: "QUICKFIX REPAIRS SAMPLE CITY" },
  },
  {
    id: "R37",
    layout: "invoice",
    file: "pdf",
    vendor: V.energy,
    date: "2026-10-14",
    items: [["Electricity: September billing period", 14655]],
    category: "Utilities",
    submitterId: "staff-b",
    paymentSource: "bank",
    businessPurpose: "Office electricity",
    line: { lagDays: 0, description: "DIRECT DEBIT EXAMPLE ENERGY", account: "bank" },
  },
  {
    id: "R38",
    layout: "cafe",
    file: "photo",
    vendor: V.harbourCafe,
    date: "2026-10-05",
    items: [
      ["Long black", 450],
      ["Blueberry muffin", 650],
      ["English breakfast tea", 450],
    ],
    category: "Meals & Entertainment",
    submitterId: "staff-d",
    businessPurpose: "Coffee meeting with supplier",
    line: { lagDays: 0, description: "HARBOUR LANE CAFE SAMPLE CITY" },
  },
  {
    id: "R39",
    layout: "invoice",
    file: "pdf",
    vendor: V.vectorly,
    date: "2026-10-12",
    currency: "USD",
    items: [["Vector editor: Individual (monthly)", 2400]],
    category: "Software",
    submitterId: "staff-a",
    businessPurpose: "Illustration tool for marketing",
    line: { lagDays: 1, description: "VECTORLY INC SAMPLE TOWN US" },
  },
  {
    id: "R40",
    layout: "airline",
    file: "pdf",
    vendor: V.airline,
    date: "2026-10-19",
    items: [["Fare: Sample City to Example Bay, Economy", 15600]],
    category: "Travel",
    submitterId: "staff-e",
    businessPurpose: "Flight for trade expo",
    line: { lagDays: 1, description: "TEST AIRLINE SAMPLE CITY" },
  },
];

const DUPLICATES: DuplicateDef[] = [
  {
    id: "R09",
    of: "R08",
    mode: "exact",
    testCases: ["TC07"],
    submitterId: "staff-a",
    businessPurpose: "Quarterly planning workshop lunch",
    note: "Byte-identical re-upload of R08 (same file hash).",
  },
  {
    id: "R10",
    of: "R08",
    mode: "rephoto",
    testCases: ["TC07"],
    submitterId: "staff-c",
    businessPurpose: "Workshop catering",
    note: "Phone photo of the printed R08 invoice: different file, same vendor, date, total, and currency.",
  },
];

// Statement lines with no receipt. Some are deliberate distractors for matching.
const NOISE_LINES: NoiseLineDef[] = [
  {
    date: "2026-10-15",
    description: "SAMPLE APP STORE SAMPLE CITY",
    amountCents: 1999,
    note: "TC11 twin: same amount as R15, one day later.",
  },
  {
    date: "2026-10-24",
    description: "SQ *SAMPLE CAFE SAMPLE CITY AU",
    amountCents: 1900,
    note: "Distractor for R25.",
  },
  {
    date: "2026-10-27",
    description: "METRO TAXI CO SAMPLE CITY",
    amountCents: 3120,
    note: "Distractor for R27, within the amount threshold, same day.",
  },
  {
    date: "2026-10-08",
    description: "SAMPLE PARKING STATION",
    amountCents: 1800,
    note: "No receipt.",
  },
  {
    date: "2026-10-16",
    description: "SAMPLE PETROL SAMPLE CITY",
    amountCents: 7520,
    note: "No receipt.",
  },
  { date: "2026-10-31", description: "MONTHLY CARD FEE", amountCents: 1000, note: "Bank fee." },
  { date: "2026-10-21", description: "SAMPLE BOOKSHOP", amountCents: 3495, note: "No receipt." },
  {
    date: "2026-10-13",
    description: "SAMPLE COURIER SERVICES",
    amountCents: 2350,
    note: "No receipt.",
  },
  { date: "2026-10-02", description: "SAMPLE PHARMACY", amountCents: 1240, note: "No receipt." },
];

const BASELINE_SUBSET: Record<string, string> = {
  R04: "TC04 amount over threshold (required)",
  R06: "TC06 blank purpose (required)",
  R07: "TC06 'n/a' purpose (required)",
  R08: "TC07 original (required)",
  R09: "TC07 exact duplicate (required)",
  R10: "TC07 re-photographed duplicate (required)",
  R15: "TC11 ambiguous match (required)",
  R05: "TC05 small tip difference",
  R13: "TC10 personal card, reimbursement",
  R20: "No payment found (statement cut-off)",
  R02: "TC02 USD subscription with FX fee",
  R03: "TC03 foreign vendor billing in AUD",
  R11: "TC08 portrait phone photo",
  R16: "TC12 ad-platform invoice (category)",
  R19: "TC12 office chair from hardware store (category)",
  R01: "Routine",
  R23: "Routine (USD)",
  R27: "Routine with a same-day distractor line",
  R32: "Routine, shares an amount with another receipt",
  R24: "Routine, bank direct debit",
};

const COMPANY_CARD_LINE = "Visa ****4821";
const PERSONAL_CARD_LINE = "Mastercard ****7350";
const PHOTO_SIZES: [number, number][] = [
  [900, 1200],
  [810, 1080],
  [750, 1000],
];
const FOREIGN_FEE = 1.03;

export interface DatasetReceipt {
  id: string;
  uploadOrder: number;
  layout: Layout;
  fileKind: FileKind;
  fileName: string;
  mime: IntakeReceipt["file"]["mime"];
  photo?: { width: number; height: number; angle: number; noiseSeed: number };
  vendor: Vendor;
  date: string;
  time: string;
  docNumber: string;
  items: { description: string; cents: number }[];
  currency: "AUD" | "USD";
  totalCents: number;
  taxCents: number | null;
  paymentLine: string;
  duplicate?: { of: string; mode: "exact" | "rephoto" };
  intake: Omit<IntakeReceipt, "file">;
  truth: GroundTruthReceipt;
}

export type DatasetLine = StatementLine & { receiptId: string | null; note?: string };

export interface Dataset {
  monthKey: string;
  seed: number;
  receipts: DatasetReceipt[];
  statementLines: DatasetLine[];
  splits: Splits;
  baselineSubset: BaselineSubset;
}

export function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (y === undefined || m === undefined || d === undefined) throw new Error(`Bad date ${iso}`);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

// Synthetic card-network rate. The system uses ECB rates from the FX API, so ground
// truth asserts the statement's AUD charge as the ledger amount, never this rate.
function syntheticAudPerUsd(iso: string): number {
  const day = Number(iso.slice(8, 10));
  return 1.52 + ((day * 7) % 5) * 0.004;
}

const toMajor = (cents: number) => Math.round(cents) / 100;

function gstIncluded(totalCents: number): number {
  return Math.round(totalCents / 11);
}

function docNumberFor(layout: Layout, rng: Rng): string {
  const n = intBetween(rng, 10000, 99999);
  const prefix: Record<Layout, string> = {
    cafe: "",
    airline: "TA-",
    invoice: "INV-",
    hardware: "TI-",
    adplatform: "BR-",
    coworking: "HC-",
  };
  return `${prefix[layout]}${n}`;
}

function photoFor(rng: Rng, fixed?: [number, number]) {
  const size = fixed ?? PHOTO_SIZES[intBetween(rng, 0, PHOTO_SIZES.length - 1)];
  if (!size) throw new Error("no photo size");
  const sign = rng() < 0.5 ? -1 : 1;
  const angle = Math.round(sign * (3 + rng() * 5) * 10) / 10;
  return { width: size[0], height: size[1], angle, noiseSeed: intBetween(rng, 1, 1_000_000) };
}

function extensionFor(kind: FileKind): { ext: string; mime: IntakeReceipt["file"]["mime"] } {
  if (kind === "pdf") return { ext: "pdf", mime: "application/pdf" };
  if (kind === "png") return { ext: "png", mime: "image/png" };
  return { ext: "jpg", mime: "image/jpeg" };
}

export function buildDataset(): Dataset {
  const rng = createRng(SEED);

  // Statement lines first, so receipts can reference their ids.
  type PendingLine = Omit<DatasetLine, "id">;
  const pending: PendingLine[] = [];
  const lineIndexByReceipt = new Map<string, number>();

  for (const s of SCENARIOS) {
    if (!s.line) continue;
    const totalCents = s.items.reduce((sum, [, cents]) => sum + cents, 0);
    const date = addDays(s.date, s.line.lagDays);
    const account = s.line.account ?? "company_card";
    const isUsd = s.currency === "USD";
    const audCents = isUsd
      ? Math.round(totalCents * syntheticAudPerUsd(date) * FOREIGN_FEE)
      : (s.line.chargedCents ?? totalCents);
    lineIndexByReceipt.set(s.id, pending.length);
    pending.push({
      date,
      description: s.line.description,
      amountAud: toMajor(audCents),
      ...(isUsd ? { originalAmount: { amount: toMajor(totalCents), currency: "USD" } } : {}),
      account,
      receiptId: s.id,
    });
  }
  for (const n of NOISE_LINES) {
    pending.push({
      date: n.date,
      description: n.description,
      amountAud: toMajor(n.amountCents),
      account: "company_card",
      receiptId: null,
      note: n.note,
    });
  }

  const order = pending
    .map((line, index) => ({ line, index }))
    .sort(
      (a, b) =>
        a.line.date.localeCompare(b.line.date) ||
        a.line.description.localeCompare(b.line.description) ||
        a.line.amountAud - b.line.amountAud,
    );
  const idByPendingIndex = new Map<number, string>();
  const statementLines: DatasetLine[] = order.map(({ line, index }, position) => {
    const id = `L${String(position + 1).padStart(2, "0")}`;
    idByPendingIndex.set(index, id);
    return { id, ...line };
  });

  const byId = new Map(SCENARIOS.map((s) => [s.id, s]));
  const allIds = [...SCENARIOS.map((s) => s.id), ...DUPLICATES.map((d) => d.id)].sort();
  const printedById = new Map<string, { docNumber: string; time: string }>();

  const receipts: DatasetReceipt[] = allIds.map((id, i) => {
    const dup = DUPLICATES.find((d) => d.id === id);
    const s = byId.get(dup ? dup.of : id);
    if (!s) throw new Error(`Unknown scenario ${id}`);

    const fileKind: FileKind = dup ? (dup.mode === "exact" ? s.file : "photo") : s.file;
    const { ext, mime } = extensionFor(fileKind);
    const currency = s.currency ?? "AUD";
    const items = s.items.map(([description, cents]) => ({ description, cents }));
    const totalCents = items.reduce((sum, item) => sum + item.cents, 0);
    const taxCents =
      currency === "AUD" && s.vendor.locale === "au" ? gstIncluded(totalCents) : null;
    const paymentSource = dup ? "company_card" : (s.paymentSource ?? "company_card");
    const lineIndex = dup ? undefined : lineIndexByReceipt.get(s.id);
    const line = lineIndex === undefined ? undefined : pending[lineIndex];
    const statementLineId =
      lineIndex === undefined ? null : (idByPendingIndex.get(lineIndex) ?? null);

    const reimbursement = !dup && !s.line && paymentSource === "personal_card";
    const expected = dup
      ? { matchStatus: "unmatched" as const, exceptions: ["DUPLICATE" as const] }
      : (s.expect ??
        (s.line
          ? { matchStatus: "matched" as const, exceptions: [] }
          : { matchStatus: "unmatched" as const, exceptions: [] }));

    let ledgerAmountAud: number | null = null;
    if (line) ledgerAmountAud = line.amountAud;
    else if (reimbursement && currency === "AUD") ledgerAmountAud = toMajor(totalCents);

    // Charged minus receipt, for the R-AMT-3 badge. Foreign purchases compare on the
    // original amount (R-CUR-4), so the bank's FX fee is not a difference.
    let amountDifferenceAud: number | null = null;
    if (line && s.line) {
      amountDifferenceAud =
        currency === "AUD" ? toMajor((s.line.chargedCents ?? totalCents) - totalCents) : 0;
    }

    // A duplicate shows the same printed document as its original.
    const printed = (dup && printedById.get(dup.of)) || {
      docNumber: docNumberFor(s.layout, rng),
      time: `${String(intBetween(rng, 7, 20)).padStart(2, "0")}:${String(intBetween(rng, 0, 59)).padStart(2, "0")}`,
    };
    printedById.set(id, printed);
    const { docNumber, time } = printed;
    const photo = fileKind === "photo" ? photoFor(rng, s.photoSize) : undefined;

    const accountForLine = s.line?.account ?? "company_card";
    const paymentLine =
      accountForLine === "bank"
        ? "Paid by direct debit"
        : paymentSource === "personal_card"
          ? PERSONAL_CARD_LINE
          : COMPANY_CARD_LINE;

    const purpose = dup ? dup.businessPurpose : s.businessPurpose;
    const testCases = dup ? dup.testCases : (s.testCases ?? []);

    return {
      id,
      uploadOrder: i + 1,
      layout: s.layout,
      fileKind,
      fileName: `${id}.${ext}`,
      mime,
      ...(photo ? { photo } : {}),
      vendor: s.vendor,
      date: s.date,
      time,
      docNumber,
      items,
      currency,
      totalCents,
      taxCents,
      paymentLine,
      ...(dup ? { duplicate: { of: dup.of, mode: dup.mode } } : {}),
      intake: {
        id,
        monthKey: MONTH_KEY,
        submitterId: dup ? dup.submitterId : s.submitterId,
        paymentSource,
        businessPurpose: purpose,
        uploadOrder: i + 1,
      },
      truth: {
        id,
        testCases,
        fileKind,
        fields: {
          vendor: s.vendor.name,
          date: s.date,
          total: toMajor(totalCents),
          currency,
          tax: taxCents === null ? null : toMajor(taxCents),
          summary: items.map((item) => item.description).join("; "),
        },
        isReceipt: true,
        category: s.category,
        statementLineId,
        matchStatus: expected.matchStatus,
        exceptions: [...expected.exceptions],
        ...("afterMatchChoice" in expected && expected.afterMatchChoice
          ? { exceptionsAfterMatchChoice: [...expected.afterMatchChoice] }
          : {}),
        reimbursement,
        excludedFromTotals: Boolean(dup),
        ledgerAmountAud,
        amountDifferenceAud,
        duplicateOf: dup ? dup.of : null,
        ...((dup?.note ?? s.note) ? { note: dup?.note ?? s.note } : {}),
      },
    };
  });

  return {
    monthKey: MONTH_KEY,
    seed: SEED,
    receipts,
    statementLines,
    splits: buildSplits(rng, receipts),
    baselineSubset: {
      receiptIds: Object.keys(BASELINE_SUBSET).sort(),
      why: BASELINE_SUBSET,
    },
  };
}

// About 60% tuning, 40% holdout, stratified so holdout gets its share of hard cases
// (an unstratified shuffle put every hard matching case in tuning). A duplicate and
// its original always share a split.
function buildSplits(rng: Rng, receipts: DatasetReceipt[]): Splits {
  const groups = new Map<string, DatasetReceipt[]>();
  for (const r of receipts) {
    const key = r.duplicate?.of ?? r.id;
    groups.set(key, [...(groups.get(key) ?? []), r]);
  }
  const isHard = (group: DatasetReceipt[]) =>
    group.some((r) => r.truth.exceptions.length > 0 || r.truth.matchStatus !== "matched");
  const all = [...groups.values()];

  const tuning: string[] = [];
  const holdout: string[] = [];
  for (const stratum of [all.filter(isHard), all.filter((g) => !isHard(g))]) {
    const size = stratum.reduce((n, g) => n + g.length, 0);
    const target = Math.round(size * 0.6);
    let taken = 0;
    for (const group of shuffle(rng, stratum)) {
      const ids = group.map((r) => r.id);
      if (taken + ids.length <= target) {
        tuning.push(...ids);
        taken += ids.length;
      } else {
        holdout.push(...ids);
      }
    }
  }
  return { tuning: tuning.sort(), holdout: holdout.sort() };
}
