// modules.js — All 9 module definitions for The Investor's Lens
// Each module contains: id, title, subtitle, intro, callout, and fields array.
// Field types: "textarea-short", "textarea-long", "table", "checklist"

const MODULES = [
  // ── Module 1 ──────────────────────────────────────────────────────────
  {
    id: 1,
    title: "Prospectus Summary",
    subtitle: "The Elevator Pitch",
    intro: "In a real S-1, the prospectus summary is a concise overview of the entire business — who you are, what you do, how you make money, and why someone should care. An investor reads this section first and decides in about 90 seconds whether to keep reading.",
    callout: "Can I understand what this firm does, who it serves, and why it wins — in under two minutes?",
    fields: [
      {
        id: "1.1",
        label: "Firm Overview",
        type: "textarea-long",
        hint: "Describe your firm in 3-4 sentences as if writing for someone who knows nothing about you. Include: when founded, where located, number of attorneys, core practice areas."
      },
      {
        id: "1.2",
        label: "Value Proposition",
        type: "textarea-short",
        hint: "In one sentence, why does a client choose your firm over the alternatives?"
      },
      {
        id: "1.3",
        label: "Key Metrics Snapshot",
        type: "table",
        columns: ["Metric", "Current Year", "Prior Year", "Trend"],
        prefillRows: [
          ["Total revenue", "", "", ""],
          ["Number of active clients", "", "", ""],
          ["Revenue per attorney", "", "", ""],
          ["Average matter value", "", "", ""],
          ["Client retention rate", "", "", ""],
          ["New client acquisition rate", "", "", ""]
        ]
      },
      {
        id: "1.4",
        label: "The 90-Second Pitch",
        type: "textarea-long",
        hint: "Imagine you are in an elevator with a potential investor. You have 90 seconds. Write what you would say."
      }
    ]
  },

  // ── Module 2 ──────────────────────────────────────────────────────────
  {
    id: 2,
    title: "Risk Factors",
    subtitle: "What Keeps You Up at Night",
    intro: "The risk factors section is where companies disclose everything that could go wrong. Investors read this carefully — not because they expect perfection, but because they want to know management understands its vulnerabilities.",
    callout: "Does the owner know what could break this business? And do they have a plan for it?",
    fields: [
      {
        id: "2.1",
        label: "Client Concentration",
        type: "textarea-short",
        hint: "What percentage of your revenue comes from your top 3 clients?"
      },
      {
        id: "2.1t",
        label: "Client Concentration Detail",
        type: "table",
        columns: ["Client (or type)", "Approx. % of Revenue", "Years as Client", "Risk if Lost"],
        prefillRows: [
          ["", "", "", ""],
          ["", "", "", ""],
          ["", "", "", ""],
          ["", "", "", ""],
          ["", "", "", ""]
        ]
      },
      {
        id: "2.2",
        label: "Key-Person Dependency",
        type: "textarea-long",
        hint: "If you were unable to work for 90 days, what would happen to the firm?"
      },
      {
        id: "2.3",
        label: "Other Key Personnel",
        type: "textarea-short",
        hint: "Are there other individuals whose departure would materially harm the firm?"
      },
      {
        id: "2.4c",
        label: "Risk Checklist",
        type: "checklist",
        items: [
          "Client concentration (>25% from one client/sector)",
          "Key-person dependency",
          "No documented processes or playbooks",
          "Cybersecurity gaps",
          "Malpractice exposure or claims history",
          "Regulatory/bar compliance concerns",
          "Technology disruption risk (AI/automation)",
          "Succession gap",
          "Cash flow volatility",
          "Reputational risk",
          "Geographic concentration",
          "Employee retention challenges"
        ],
        hasOther: true
      },
      {
        id: "2.4",
        label: "Top 3 Risks and Mitigation Plans",
        type: "textarea-long",
        hint: "For each, describe what you are doing about it — or should be doing."
      }
    ]
  },

  // ── Module 3 ──────────────────────────────────────────────────────────
  {
    id: 3,
    title: "Use of Proceeds",
    subtitle: "If You Had Capital Tomorrow",
    intro: "This section tells investors how the company plans to deploy capital. For this exercise: if someone handed you $250K–$1M in growth capital tomorrow, where would it go? Your answer reveals whether you have a real growth strategy.",
    callout: "Does this owner have a capital allocation strategy, or are they just covering overhead?",
    fields: [
      {
        id: "3.1",
        label: "Capital Allocation",
        type: "textarea-long",
        hint: "If you received $500,000 in growth capital, how would you allocate it?"
      },
      {
        id: "3.1t",
        label: "Allocation Breakdown",
        type: "table",
        columns: ["Investment Area", "Amount/%", "Expected Return/Impact", "Timeline"],
        prefillRows: [
          ["", "", "", ""],
          ["", "", "", ""],
          ["", "", "", ""],
          ["", "", "", ""],
          ["", "", "", ""],
          ["", "", "", ""]
        ]
      },
      {
        id: "3.2",
        label: "Deferred Investment",
        type: "textarea-short",
        hint: "What investment have you been putting off that would most change the trajectory of your firm?"
      },
      {
        id: "3.3",
        label: "Reinvestment Rate",
        type: "textarea-short",
        hint: "What percentage of annual profit do you reinvest vs. distribute as compensation? Is that ratio intentional?"
      }
    ]
  },

  // ── Module 4 ──────────────────────────────────────────────────────────
  {
    id: 4,
    title: "Market Opportunity",
    subtitle: "The Landscape",
    intro: "Investors want to know: Is this company fishing in a big pond or a small one? Is the pond growing or shrinking? For a small law firm, this means understanding your addressable market, competitive landscape, and growth vectors.",
    callout: "Is this firm in a growing market? Does the owner understand the competitive dynamics?",
    fields: [
      {
        id: "4.1",
        label: "Market Definition",
        type: "textarea-long",
        hint: "Who are your potential clients? How many are there? Be specific about geography, industry, and size."
      },
      {
        id: "4.2",
        label: "Market Trends",
        type: "textarea-long",
        hint: "Is your market growing, stable, or shrinking? What forces drive the change?"
      },
      {
        id: "4.2t",
        label: "Competitive Landscape",
        type: "table",
        columns: ["Competitor", "Size (approx.)", "Their Strength", "Their Weakness", "Your Edge"],
        prefillRows: [
          ["", "", "", "", ""],
          ["", "", "", "", ""],
          ["", "", "", "", ""],
          ["", "", "", "", ""],
          ["", "", "", "", ""]
        ]
      },
      {
        id: "4.3",
        label: "Market Share",
        type: "textarea-short",
        hint: "What is your realistic market share? What could it be in 3 years?"
      },
      {
        id: "4.4",
        label: "Growth Vectors",
        type: "textarea-long",
        hint: "Where is your next dollar of revenue most likely to come from?"
      },
      {
        id: "4.5",
        label: "Disruption Outlook",
        type: "textarea-long",
        hint: "What trends could fundamentally change your market in the next 5 years?"
      }
    ]
  },

  // ── Module 5 ──────────────────────────────────────────────────────────
  {
    id: 5,
    title: "Business Description",
    subtitle: "How the Machine Works",
    intro: "This is where a company explains its business model in detail — how it makes money, delivers value, acquires customers, and differentiates itself.",
    callout: "Is this a real business with repeatable processes, or just a talented person with a bar license?",
    fields: [
      {
        id: "5.0t",
        label: "Revenue Model",
        type: "table",
        columns: ["Fee Structure", "% of Revenue", "Avg. Matter Value", "Trend"],
        prefillRows: [
          ["Hourly", "", "", ""],
          ["Flat fee", "", "", ""],
          ["Contingency", "", "", ""],
          ["Retainer/subscription", "", "", ""],
          ["Hybrid", "", "", ""],
          ["Other", "", "", ""]
        ]
      },
      {
        id: "5.1",
        label: "Practice Area Breakdown",
        type: "textarea-short",
        hint: "List each practice area, its share of revenue, and whether it is growing or declining."
      },
      {
        id: "5.2",
        label: "Client Acquisition",
        type: "textarea-short",
        hint: "How do new clients find you? Rank your top 3 channels."
      },
      {
        id: "5.3",
        label: "Client Acquisition Cost",
        type: "textarea-short",
        hint: "What is your approximate cost to acquire a new client?"
      },
      {
        id: "5.4",
        label: "The Moat",
        type: "textarea-long",
        hint: "What is defensible about your firm? Relationships? Niche expertise? Geography? Brand? Systems? 'Nothing in particular' is a valid answer."
      },
      {
        id: "5.5",
        label: "Delivery Process",
        type: "textarea-long",
        hint: "Describe your typical matter workflow from intake to close. Are there documented processes?"
      }
    ]
  },

  // ── Module 6 ──────────────────────────────────────────────────────────
  {
    id: 6,
    title: "MD&A",
    subtitle: "The Financial Story",
    intro: "The MD&A is where management narrates the financial performance — not just the numbers, but the story behind them. Why did revenue change? What is management doing about it?",
    callout: "Does the owner actually understand the financial dynamics of their own firm?",
    fields: [
      {
        id: "6.1",
        label: "Revenue Trend",
        type: "textarea-long",
        hint: "Describe your revenue trajectory over the past 2-3 years. What is driving the growth or decline?"
      },
      {
        id: "6.1t",
        label: "Financial Metrics",
        type: "table",
        columns: ["Metric", "2 Years Ago", "Last Year", "Current Year", "Target Next Year"],
        prefillRows: [
          ["Gross revenue", "", "", "", ""],
          ["Operating expenses", "", "", "", ""],
          ["Owner compensation", "", "", "", ""],
          ["Net profit", "", "", "", ""],
          ["Realization rate", "", "", "", ""],
          ["Collection rate", "", "", "", ""],
          ["Revenue per attorney", "", "", "", ""],
          ["Overhead ratio", "", "", "", ""]
        ]
      },
      {
        id: "6.2",
        label: "Profitability",
        type: "textarea-short",
        hint: "What is your effective profit margin after reasonable owner compensation?"
      },
      {
        id: "6.3",
        label: "Cash Flow",
        type: "textarea-short",
        hint: "Describe your cash flow patterns. Seasonal swings? Average collection cycle?"
      },
      {
        id: "6.4",
        label: "Honest Assessment",
        type: "textarea-long",
        hint: "If a financial analyst looked at your books, what would concern them? What would impress them?"
      }
    ]
  },

  // ── Module 7 ──────────────────────────────────────────────────────────
  {
    id: 7,
    title: "Management & Governance",
    subtitle: "The Leadership Team",
    intro: "Investors bet on jockeys, not horses. For a small law firm, this is about whether the firm is a real institution or a one-person show.",
    callout: "Is there a team here, or just a founder? What happens if the founder gets hit by a bus?",
    fields: [
      {
        id: "7.0t",
        label: "Leadership Team",
        type: "table",
        columns: ["Name/Role", "Years at Firm", "Key Strengths", "Gaps/Development Needs"],
        prefillRows: [
          ["", "", "", ""],
          ["", "", "", ""],
          ["", "", "", ""],
          ["", "", "", ""],
          ["", "", "", ""]
        ]
      },
      {
        id: "7.1",
        label: "Organizational Structure",
        type: "textarea-long",
        hint: "How do decisions get made? Managing partner? Executive committee? Or does everything run through one person?"
      },
      {
        id: "7.2",
        label: "Advisory Resources",
        type: "textarea-short",
        hint: "Do you have outside advisors — accountant, business coach, peer group, advisory board?"
      },
      {
        id: "7.3",
        label: "Succession Plan",
        type: "textarea-long",
        hint: "If you wanted to retire in 5 years, what would need to be true? Have you identified successors?"
      },
      {
        id: "7.4",
        label: "Compensation Philosophy",
        type: "textarea-long",
        hint: "How do you determine compensation? Is it structured to attract and retain talent?"
      }
    ]
  },

  // ── Module 8 ──────────────────────────────────────────────────────────
  {
    id: 8,
    title: "Capitalization & Equity",
    subtitle: "Who Owns What and Why",
    intro: "For a law firm, this is about how equity, profit-sharing, and ownership transitions work. Many small firms have never formalized these arrangements.",
    callout: "Is ownership structured in a way that aligns incentives and enables transitions?",
    fields: [
      {
        id: "8.1",
        label: "Ownership Structure",
        type: "textarea-short",
        hint: "Who owns what? Entity type (LLC, PC, S-Corp)? Why?"
      },
      {
        id: "8.2",
        label: "Partner Economics",
        type: "textarea-short",
        hint: "How are profits distributed? Lockstep, eat-what-you-kill, formula-based, or subjective?"
      },
      {
        id: "8.3",
        label: "Buy-In/Buy-Out Terms",
        type: "textarea-long",
        hint: "What are the terms for a new partner buying in or a departing partner being paid out? If not documented, say so."
      },
      {
        id: "8.4",
        label: "Firm Valuation",
        type: "textarea-long",
        hint: "If you had to put a number on the value of your firm today — separate from your personal earning capacity — what would it be? 'No idea' is one of the most important gaps this exercise can reveal."
      }
    ]
  },

  // ── Module 9 ──────────────────────────────────────────────────────────
  {
    id: 9,
    title: "Financial Statements",
    subtitle: "The Numbers",
    intro: "You don't need GAAP-audited financials. You need to compile the core data that tells the story of your firm's health. Many owners have never assembled this in one place.",
    callout: "Show me the numbers. Not the story — the actual numbers.",
    fields: [
      {
        id: "9.1t",
        label: "Simplified Income Statement",
        type: "table",
        columns: ["Line Item", "Current Year", "Prior Year"],
        prefillRows: [
          ["Gross revenue (fees billed)", "", ""],
          ["Less: write-offs/discounts", "", ""],
          ["Net revenue collected", "", ""],
          ["Payroll (attorneys)", "", ""],
          ["Payroll (staff)", "", ""],
          ["Benefits", "", ""],
          ["Rent/occupancy", "", ""],
          ["Technology", "", ""],
          ["Insurance", "", ""],
          ["Marketing", "", ""],
          ["Other operating expenses", "", ""],
          ["Net operating income", "", ""]
        ]
      },
      {
        id: "9.2t",
        label: "Balance Sheet Snapshot",
        type: "table",
        columns: ["Item", "Amount", "Notes"],
        prefillRows: [
          ["Cash on hand", "", ""],
          ["Accounts receivable (WIP)", "", ""],
          ["Accounts receivable (billed)", "", ""],
          ["Line of credit balance", "", ""],
          ["Term loan balance", "", ""],
          ["Equipment/lease obligations", "", ""]
        ]
      },
      {
        id: "9.3t",
        label: "Key Ratios",
        type: "table",
        columns: ["Ratio", "Your Number", "Industry Benchmark", "Assessment"],
        prefillRows: [
          ["Overhead ratio", "", "40-50%", ""],
          ["Profit margin", "", "", ""],
          ["Realization rate", "", "85%+", ""],
          ["Collection rate", "", "90%+", ""],
          ["Revenue per attorney", "", "", ""],
          ["Accounts receivable as % of revenue", "", "", ""]
        ]
      }
    ]
  }
];

// Scorecard dimension definitions
const SCORECARD_DIMENSIONS = [
  { id: 1, label: "Strategic Clarity", description: "Can you clearly articulate what your firm does, for whom, and why it wins?" },
  { id: 2, label: "Risk Awareness", description: "Have you identified, documented, and begun mitigating your key risks?" },
  { id: 3, label: "Capital Strategy", description: "Do you have a clear plan for how you would deploy growth capital?" },
  { id: 4, label: "Market Position", description: "Do you understand your market size, competition, and growth trajectory?" },
  { id: 5, label: "Business Model", description: "Is your revenue model diversified, repeatable, and documented?" },
  { id: 6, label: "Financial Transparency", description: "Can you produce accurate, current financials on demand?" },
  { id: 7, label: "Leadership Depth", description: "Is there a team beyond you? Would the firm survive your absence?" },
  { id: 8, label: "Ownership Structure", description: "Is equity structured clearly with documented transition mechanisms?" },
  { id: 9, label: "Growth Trajectory", description: "Is the firm growing intentionally and sustainably?" },
  { id: 10, label: "Succession Readiness", description: "Could you exit in 3-5 years if you wanted to?" }
];
