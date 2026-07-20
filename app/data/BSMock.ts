
export const businessStudiesLessons = [
  {
    id: 6,
    lessonNumber: "Lesson 2.6",
    title: "Marketing Mix",
    videoUrl: "",
    readingTitle: "Marketing Mix Reading",
  },
  {
    id: 7,
    lessonNumber: "Lesson 2.7",
    title: "Market Changes",
    videoUrl: "",
    readingTitle: "Market Changes Reading",
  },
];

export const businessStudiesActivities = [
  {
    id: 6,
    title: "Activity 5",
    lesson: "Lesson 2.6",
    topic: "Marketing Mix",
    marks: 20,
    dueDate: "13 June 2026",
    status: "Published",
  },
  {
    id: 7,
    title: "Activity 6",
    lesson: "Lesson 2.7",
    topic: "Market Changes",
    marks: 20,
    dueDate: "20 June 2026",
    status: "Published",
  },
];

export const businessStudiesLearners = [
  {
    id: 1,
    name: "Danielle Coetzee Test",
    status: "On Track",
    engagement: "92%",
    activitiesCompleted: "7/8",
    averageMark: "78%",
    reviewsNeeded: "0",
  },
  
  {
    id: 2,
    name: "Liam Jacobs Test",
    status: "Needs Support",
    engagement: "71%",
    activitiesCompleted: "6/8",
    averageMark: "64%",
    reviewsNeeded: "2",
  },
  {
    id: 3,
    name: "Mia Botha",
    status: "At Risk",
    engagement: "38%",
    activitiesCompleted: "3/8",
    averageMark: "42%",
    reviewsNeeded: "3",
  },
];

export const businessStudiesLessonEngagement = [
  {
    lesson: "Lesson 2.7 Test",
    title: "Market Changes",
    open: true,
    learners: [
      {
        name: "Danielle Coetzee",
        video: "complete",
        reading: "complete",
        quiz: "complete",
        status: "On Track",
      },
      {
        name: "Liam Jacobs",
        video: "partial",
        reading: "complete",
        quiz: "complete",
        status: "Needs Support",
      },
      {
        name: "Mia Botha",
        video: "missing",
        reading: "missing",
        quiz: "missing",
        status: "At Risk",
      },
    ],
  },
  {
    lesson: "Lesson 2.6 Test",
    title: "Marketing Mix",
    open: false,
    learners: [
      {
        name: "Danielle Coetzee",
        video: "complete",
        reading: "complete",
        quiz: "complete",
        status: "On Track",
      },
      {
        name: "Liam Jacobs",
        video: "complete",
        reading: "partial",
        quiz: "complete",
        status: "On Track",
      },
      {
        name: "Mia Botha",
        video: "partial",
        reading: "complete",
        quiz: "partial",
        status: "Needs Support",
      },
    ],
  },
];

export const businessStudiesActivityReviews = [
  {
    activity: "Activity 7",
    title: "Market Changes",
    total: 30,
    open: true,
    learners: [
      {
        name: "Danielle Coetzee Test",
        submitted: true,
        aiReview: "24/30",
        teacherReview: "Pending",
      },
      {
        name: "Liam Jacobs Test",
        submitted: true,
        aiReview: "18/30",
        teacherReview: "Pending",
      },
      {
        name: "Mia Botha",
        submitted: false,
        aiReview: "No draft",
        teacherReview: "Missing",
      },
    ],
  },
  {
    activity: "Activity 6",
    title: "Marketing Mix",
    total: 30,
    open: false,
    learners: [
      {
        name: "Danielle Coetzee",
        submitted: true,
        aiReview: "26/30",
        teacherReview: "27/30",
      },
      {
        name: "Liam Jacobs",
        submitted: true,
        aiReview: "21/30",
        teacherReview: "22/30",
      },
      {
        name: "Mia Botha",
        submitted: true,
        aiReview: "17/30",
        teacherReview: "Pending",
      },
    ],
  },
];

export const businessStudiesActivityWorkspace = {
  activityTitle: "Activity 14 - Lesson 1.14",
  topic: "The Role of Management",
  totalMarks: 20,
  dueDate: "16/06/26",
  readingTitle: "Business Studies Reading",
  readingReference: "Lesson 1.14 - The Role of Management",
  questions: [
    {
      number: "Question 1",
      marks: 2,
      question: "Define the term management.",
    },
    {
      number: "Question 2",
      marks: 2,
      question: "Identify two functions of management.",
    },
    {
      number: "Question 3",
      marks: 4,
      question: "Explain why planning is important for a business.",
    },
  ],
};

export const businessStudiesMockSubmission = {
  learner: "Danielle Coetzee",
  activityTitle: "Activity 14 - Lesson 1.14",
  topic: "The Role of Management",
  totalMarks: 20,
  submittedAt: "16/06/26",
  status: "Submitted",
  answers: [
    {
      number: "Question 1",
      answer:
        "Management is a position taken up by the leaders in an organisation. Management exists to solve problems, organise employees and resources and to make important decisions.",
    },
    {
      number: "Question 2",
      answer: "Planning and Organising.",
    },
    {
      number: "Question 3",
      answer:
        "It provides direction for employees. Good planning allows businesses to prepare for challenges and use their resources effectively.",
    },
  ],
};

export const businessStudiesSubmissionReview = {
  learner: "Danielle Coetzee Test",
  activityTitle: "Activity 14 - Lesson 1.14",
  topic: "The Role of Management",
  totalMarks: 20,
  dueDate: "16/06/26",
  kingdomFinalMark: "19/20",
  kingdomPercentage: "95%",
  teacherFinalMarkPlaceholder: "19",
  questions: [
    {
      number: "Question 1",
      marks: 2,
      question: "Define the term management.",
      answer:
        "Management is a position taken up by the leaders in an organisation. Management exists to solve problems, organise employees and resources and to make important decisions.",
      kingdomComment:
        "Good definition. You include functions, but should clearly define management as a process rather than a position.",
      kingdomMark: "1/2",
    },
    {
      number: "Question 2",
      marks: 2,
      question: "Identify two functions of management.",
      answer: "Planning and Organising.",
      kingdomComment: "Correct identification of two valid functions.",
      kingdomMark: "2/2",
    },
    {
      number: "Question 3",
      marks: 4,
      question: "Explain why planning is important for a business.",
      answer:
        "It provides direction for employees. Good planning allows businesses to prepare for challenges and use their resources effectively.",
      kingdomComment:
        "Excellent explanation. Strong reasoning and clear link to business direction and preparation.",
      kingdomMark: "4/4",
    },
  ],
};