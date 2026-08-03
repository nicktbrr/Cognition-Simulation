// Placeholder studies returned by the PDF import flow while real parsing is
// switched off. Sample attributes reference ids from the shared attribute
// catalogue so the review step can show the same list and dropdowns as the
// Samples page.

import type { ParsedStudy } from "../components/PDFImportModal";

export const generateDummyParsedStudies = (): ParsedStudy[] => [
  {
    id: "study-1",
    title: "Social Media Usage and Psychological Well-being",
    briefDescription:
      "Examines the relationship between daily social media usage patterns and psychological well-being indicators among young adults aged 18-25, focusing on depression, anxiety, and life satisfaction outcomes.",
    studyIntroduction:
      "Welcome to our study on social media and well-being. In this research, we are investigating how different patterns of social media use relate to psychological health outcomes. You will be asked about your daily social media habits, the platforms you use most frequently, and how you feel about various aspects of your life. Your responses will help us understand the relationship between digital engagement and mental health.",
    isSelected: true,
    sample: {
      name: "Young Adult Social Media Users",
      attributes: [
        { attributeId: "age", optionIds: ["18", "25"] },
        { attributeId: "gender", optionIds: ["man", "woman", "non_binary"] },
        { attributeId: "country", optionIds: ["united_states"] },
        { attributeId: "social_media", optionIds: ["instagram", "tiktok", "twitter"] },
        { attributeId: "highest_education", optionIds: ["high_school_diploma", "undergraduate_degree"] },
      ],
    },
    measures: [
      {
        id: "m1",
        title: "Life Satisfaction",
        definition: "Overall satisfaction with one's current life circumstances and direction.",
        minValue: 1,
        maxValue: 7,
        valueAnchors: [
          { value: 1, label: "Extremely dissatisfied" },
          { value: 4, label: "Neutral" },
          { value: 7, label: "Extremely satisfied" },
        ],
      },
      {
        id: "m2",
        title: "Social Connectedness",
        definition: "Perceived closeness to and support from others in one's social network.",
        minValue: 1,
        maxValue: 5,
        valueAnchors: [
          { value: 1, label: "Not at all connected" },
          { value: 3, label: "Moderately connected" },
          { value: 5, label: "Very connected" },
        ],
      },
      {
        id: "m3",
        title: "Anxiety Symptoms",
        definition: "Self-reported frequency of anxiety symptoms over the past two weeks.",
        minValue: 0,
        maxValue: 10,
        valueAnchors: [
          { value: 0, label: "Never" },
          { value: 5, label: "Several days" },
          { value: 10, label: "Nearly every day" },
        ],
      },
    ],
    steps: [
      {
        id: "s1",
        label: "Consent",
        instruction:
          "Read the study description and confirm that you consent to take part before continuing.",
        temperature: 50,
        measureIds: [],
      },
      {
        id: "s2",
        label: "Usage Diary",
        instruction:
          "Describe your social media use yesterday: which platforms you opened, roughly how long you spent on each, and what prompted you to open them.",
        temperature: 50,
        measureIds: ["m2"],
      },
      {
        id: "s3",
        label: "Mood Check",
        instruction:
          "Think back to how you felt immediately after your longest session yesterday. Describe your mood and any thoughts you had about yourself at that moment.",
        temperature: 60,
        measureIds: ["m3"],
      },
      {
        id: "s4",
        label: "Life Evaluation",
        instruction:
          "Consider your life as a whole right now. Explain how satisfied you feel with it and what is driving that judgement.",
        temperature: 50,
        measureIds: ["m1"],
      },
      {
        id: "s5",
        label: "Reflection",
        instruction:
          "Reflect on whether your social media habits help or hinder your sense of connection to other people, and why.",
        temperature: 65,
        measureIds: ["m1", "m2", "m3"],
      },
    ],
  },
  {
    id: "study-2",
    title: "Decision Making Under Uncertainty and Risk",
    briefDescription:
      "Investigates cognitive processes and emotional factors influencing decision-making when individuals face uncertain outcomes, using hypothetical financial and health scenarios.",
    studyIntroduction:
      "In this study we are interested in how people make choices when the outcome is not guaranteed. You will read a series of short scenarios involving financial and health decisions, each with some degree of uncertainty. For each one you will be asked what you would do and how confident you feel about that choice. There are no right or wrong answers - we are interested in your reasoning.",
    isSelected: true,
    sample: {
      name: "General Adult Decision Makers",
      attributes: [
        { attributeId: "age", optionIds: ["25", "65"] },
        { attributeId: "employment_status", optionIds: ["full_time", "part_time"] },
        { attributeId: "highest_education", optionIds: ["high_school_diploma", "undergraduate_degree", "graduate_degree"] },
        { attributeId: "investment", optionIds: ["yes", "no"] },
      ],
    },
    measures: [
      {
        id: "m1",
        title: "Risk Tolerance",
        definition: "Willingness to accept uncertainty in pursuit of a potential gain.",
        minValue: 0,
        maxValue: 10,
        valueAnchors: [
          { value: 0, label: "Completely risk averse" },
          { value: 5, label: "Moderate risk tolerance" },
          { value: 10, label: "Highly risk seeking" },
        ],
      },
      {
        id: "m2",
        title: "Decision Confidence",
        definition: "Confidence in the quality of the decision just made.",
        minValue: 1,
        maxValue: 7,
        valueAnchors: [
          { value: 1, label: "Not at all confident" },
          { value: 4, label: "Somewhat confident" },
          { value: 7, label: "Extremely confident" },
        ],
      },
      {
        id: "m3",
        title: "Anticipated Regret",
        definition: "Expected regret if the decision leads to a poor outcome.",
        minValue: 1,
        maxValue: 5,
        valueAnchors: [
          { value: 1, label: "No anticipated regret" },
          { value: 3, label: "Moderate regret" },
          { value: 5, label: "Severe regret" },
        ],
      },
    ],
    steps: [
      {
        id: "s1",
        label: "Baseline",
        instruction:
          "Describe how you usually approach decisions where the outcome is uncertain, and give a recent example.",
        temperature: 50,
        measureIds: ["m1"],
      },
      {
        id: "s2",
        label: "Financial Scenario",
        instruction:
          "You are offered a guaranteed $500, or a coin flip for $1,200. State which you choose and explain your reasoning.",
        temperature: 50,
        measureIds: ["m1", "m2"],
      },
      {
        id: "s3",
        label: "Health Scenario",
        instruction:
          "A treatment cures 80% of patients but carries a 5% risk of serious side effects. Say whether you would take it and why.",
        temperature: 50,
        measureIds: ["m1", "m2"],
      },
      {
        id: "s4",
        label: "Regret Check",
        instruction:
          "Imagine your choice in the previous scenario turned out badly. Describe how you would feel about having made it.",
        temperature: 60,
        measureIds: ["m3"],
      },
      {
        id: "s5",
        label: "Reflection",
        instruction:
          "Looking back at all your choices, explain what mattered most to you when the outcome was uncertain.",
        temperature: 65,
        measureIds: ["m2", "m3"],
      },
    ],
  },
  {
    id: "study-3",
    title: "Sustainable Consumer Behavior Analysis",
    briefDescription:
      "Explores factors driving consumer preferences for eco-friendly and sustainable products, examining the gap between environmental attitudes and actual purchasing behavior.",
    studyIntroduction:
      "This study looks at how people shop for everyday products and what role sustainability plays in those choices. You will be shown product options that differ in price and environmental impact, and asked which you would buy. We are interested in the trade-offs you make and the reasons behind them.",
    isSelected: true,
    sample: {
      name: "Household Grocery Shoppers",
      attributes: [
        { attributeId: "age", optionIds: ["25", "54"] },
        { attributeId: "primary_grocery_shopper", optionIds: ["yes"] },
        { attributeId: "country", optionIds: ["united_states", "united_kingdom"] },
        { attributeId: "active_subscriptions", optionIds: ["food_drink_delivery", "products_shipped"] },
      ],
    },
    measures: [
      {
        id: "m1",
        title: "Purchase Intent",
        definition: "Likelihood of buying the more sustainable product option.",
        minValue: 1,
        maxValue: 7,
        valueAnchors: [
          { value: 1, label: "Definitely would not buy" },
          { value: 4, label: "Might buy" },
          { value: 7, label: "Definitely would buy" },
        ],
      },
      {
        id: "m2",
        title: "Price Sensitivity",
        definition: "Willingness to pay a premium for sustainable features, as a percentage.",
        minValue: 0,
        maxValue: 100,
        valueAnchors: [
          { value: 0, label: "No premium" },
          { value: 50, label: "50% premium" },
          { value: 100, label: "100% premium" },
        ],
      },
      {
        id: "m3",
        title: "Environmental Concern",
        definition: "Strength of stated concern about the environmental impact of consumption.",
        minValue: 1,
        maxValue: 5,
        valueAnchors: [
          { value: 1, label: "Not concerned" },
          { value: 3, label: "Somewhat concerned" },
          { value: 5, label: "Deeply concerned" },
        ],
      },
    ],
    steps: [
      {
        id: "s1",
        label: "Attitudes",
        instruction:
          "Describe how much the environmental impact of a product matters to you when you shop, and why.",
        temperature: 50,
        measureIds: ["m3"],
      },
      {
        id: "s2",
        label: "Product Choice",
        instruction:
          "You are choosing between two detergents: a standard one at $6 and a certified eco-friendly one at $9. Say which you pick and explain your reasoning.",
        temperature: 50,
        measureIds: ["m1", "m2"],
      },
      {
        id: "s3",
        label: "Premium Test",
        instruction:
          "The eco-friendly option rises to $12. State whether you would still choose it and what changed in your thinking.",
        temperature: 55,
        measureIds: ["m2"],
      },
      {
        id: "s4",
        label: "Reflection",
        instruction:
          "Explain any gap you notice between how much you say you care about sustainability and what you actually buy.",
        temperature: 65,
        measureIds: ["m1", "m3"],
      },
    ],
  },
  {
    id: "study-4",
    title: "Remote Work Productivity and Satisfaction",
    briefDescription:
      "Analyzes the impact of remote work arrangements on employee productivity, job satisfaction, work-life balance, and collaboration effectiveness compared to traditional office settings.",
    studyIntroduction:
      "Thank you for taking part in our study on remote work. Because you have experience with remote work, your insights are valuable for understanding the benefits and challenges of this work arrangement. You will be asked about your productivity levels, satisfaction with your work situation, and how you collaborate with colleagues. Your responses will help organizations better support remote workers.",
    isSelected: true,
    sample: {
      name: "Remote and Hybrid Knowledge Workers",
      attributes: [
        { attributeId: "employment_status", optionIds: ["full_time"] },
        { attributeId: "working_hours", optionIds: ["regular_9_5"] },
        { attributeId: "company_size", optionIds: ["50_249", "250_999", "1000_plus"] },
        { attributeId: "highest_education", optionIds: ["undergraduate_degree", "graduate_degree"] },
      ],
    },
    measures: [
      {
        id: "m1",
        title: "Perceived Productivity",
        definition: "Self-assessed productivity relative to a typical office day.",
        minValue: 1,
        maxValue: 10,
        valueAnchors: [
          { value: 1, label: "Far less productive" },
          { value: 5, label: "About the same" },
          { value: 10, label: "Far more productive" },
        ],
      },
      {
        id: "m2",
        title: "Job Satisfaction",
        definition: "Overall satisfaction with the current job and working arrangement.",
        minValue: 1,
        maxValue: 7,
        valueAnchors: [
          { value: 1, label: "Very dissatisfied" },
          { value: 4, label: "Neutral" },
          { value: 7, label: "Very satisfied" },
        ],
      },
      {
        id: "m3",
        title: "Collaboration Effectiveness",
        definition: "How well the participant feels they can work with colleagues remotely.",
        minValue: 1,
        maxValue: 5,
        valueAnchors: [
          { value: 1, label: "Very ineffective" },
          { value: 3, label: "Adequate" },
          { value: 5, label: "Very effective" },
        ],
      },
    ],
    steps: [
      {
        id: "s1",
        label: "Setup",
        instruction:
          "Describe your current working arrangement: where you work, how often, and what your workspace is like.",
        temperature: 50,
        measureIds: [],
      },
      {
        id: "s2",
        label: "Productivity",
        instruction:
          "Compare how much you got done on your last remote day with a typical day in the office, and explain the difference.",
        temperature: 50,
        measureIds: ["m1"],
      },
      {
        id: "s3",
        label: "Collaboration",
        instruction:
          "Describe your most recent piece of teamwork done remotely and how well the collaboration went.",
        temperature: 55,
        measureIds: ["m3"],
      },
      {
        id: "s4",
        label: "Balance",
        instruction:
          "Explain how your current arrangement affects the boundary between your work and personal life.",
        temperature: 60,
        measureIds: ["m2"],
      },
      {
        id: "s5",
        label: "Satisfaction",
        instruction:
          "Say how satisfied you are with your job overall right now and what would most improve it.",
        temperature: 55,
        measureIds: ["m2", "m3"],
      },
    ],
  },
  {
    id: "study-5",
    title: "Health Behavior Change Motivation",
    briefDescription:
      "Investigates psychological factors and motivational strategies that influence adoption and maintenance of healthy behaviors including exercise, nutrition, and stress management.",
    studyIntroduction:
      "This study explores what makes healthy habits stick. You will be asked about a health behavior you have tried to change, what motivated you, and what got in the way. We are interested in your own experience rather than in medical advice, so please answer as honestly as you can.",
    isSelected: true,
    sample: {
      name: "Adults Pursuing Health Changes",
      attributes: [
        { attributeId: "age", optionIds: ["30", "60"] },
        { attributeId: "health_insurance", optionIds: ["yes", "no"] },
        { attributeId: "prescription_meds", optionIds: ["no"] },
        { attributeId: "team_individual_sport", optionIds: ["non_team_sports_only", "both_team_non_team"] },
      ],
    },
    measures: [
      {
        id: "m1",
        title: "Motivation Strength",
        definition: "Strength of current motivation to maintain the target health behavior.",
        minValue: 1,
        maxValue: 10,
        valueAnchors: [
          { value: 1, label: "No motivation" },
          { value: 5, label: "Moderate motivation" },
          { value: 10, label: "Extremely motivated" },
        ],
      },
      {
        id: "m2",
        title: "Self-Efficacy",
        definition: "Confidence in being able to sustain the behavior over the next month.",
        minValue: 1,
        maxValue: 7,
        valueAnchors: [
          { value: 1, label: "Not at all confident" },
          { value: 4, label: "Moderately confident" },
          { value: 7, label: "Completely confident" },
        ],
      },
      {
        id: "m3",
        title: "Perceived Barriers",
        definition: "Extent to which obstacles are seen as blocking the behavior.",
        minValue: 0,
        maxValue: 10,
        valueAnchors: [
          { value: 0, label: "No barriers" },
          { value: 5, label: "Some barriers" },
          { value: 10, label: "Overwhelming barriers" },
        ],
      },
    ],
    steps: [
      {
        id: "s1",
        label: "Target Behavior",
        instruction:
          "Name one health behavior you have been trying to change and describe what changing it would look like day to day.",
        temperature: 50,
        measureIds: [],
      },
      {
        id: "s2",
        label: "Motivation",
        instruction: "Explain what is driving you to make this change and how strongly you feel it right now.",
        temperature: 55,
        measureIds: ["m1"],
      },
      {
        id: "s3",
        label: "Barriers",
        instruction: "Describe what has gotten in the way so far and how much of an obstacle it has been.",
        temperature: 55,
        measureIds: ["m3"],
      },
      {
        id: "s4",
        label: "Confidence",
        instruction:
          "Say how confident you are that you can keep this up for the next month, and what that confidence rests on.",
        temperature: 50,
        measureIds: ["m2"],
      },
      {
        id: "s5",
        label: "Plan",
        instruction:
          "Write a concrete plan for the coming week, including when and where you will carry out the behavior.",
        temperature: 65,
        measureIds: ["m1", "m2", "m3"],
      },
    ],
  },
];
