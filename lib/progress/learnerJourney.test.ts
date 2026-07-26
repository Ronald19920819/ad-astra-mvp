import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateOverallSubjectAverage,
  countActiveApprovedSubjects,
  getLearnerAchievement,
} from "./learnerJourney";

test("profile average ignores null, pending and inactive subject marks", () => {
  assert.equal(
    calculateOverallSubjectAverage([
      { overallMark: 74, status: "approved", isActive: true },
      { overallMark: 68, status: "approved", isActive: true },
      { overallMark: 82, status: "approved", isActive: true },
      { overallMark: null, status: "approved", isActive: true },
      { overallMark: 99, status: "pending", isActive: false },
      { overallMark: 100, status: "approved", isActive: false },
    ]),
    224 / 3,
  );
  assert.equal(
    calculateOverallSubjectAverage([
      { overallMark: null, status: "approved", isActive: true },
    ]),
    null,
  );
});

test("active subjects counts only approved active enrolments", () => {
  assert.equal(
    countActiveApprovedSubjects([
      { status: "approved", isActive: true },
      { status: "approved", isActive: false },
      { status: "pending", isActive: false },
      { status: "declined", isActive: false },
    ]),
    1,
  );
});

test("achievement boundaries follow the profile journey rules", () => {
  assert.equal(getLearnerAchievement(null), "Mission Not Started");
  assert.equal(getLearnerAchievement(49), "Launchpad Learner");
  assert.equal(getLearnerAchievement(50), "Orbit Builder");
  assert.equal(getLearnerAchievement(74), "Orbit Builder");
  assert.equal(getLearnerAchievement(75), "Stellar Achiever");
});
