"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const node_test_1 = __importDefault(require("node:test"));
const teacherReviewScoring_1 = require("./teacherReviewScoring");
(0, node_test_1.default)("calculateTeacherReviewScore sums marks and percentage", () => {
    const result = (0, teacherReviewScoring_1.calculateTeacherReviewScore)([
        { maximumMarks: 4, teacherMark: 3 },
        { maximumMarks: 6, teacherMark: 5 },
    ]);
    strict_1.default.deepEqual(result, {
        earnedMarks: 8,
        maximumMarks: 10,
        percentage: 80,
    });
});
(0, node_test_1.default)("calculateTeacherReviewScore rejects marks above the maximum", () => {
    strict_1.default.throws(() => (0, teacherReviewScoring_1.calculateTeacherReviewScore)([{ maximumMarks: 4, teacherMark: 5 }]), /outside the allowed range/i);
});
(0, node_test_1.default)("calculateTeacherReviewScore rejects negative marks", () => {
    strict_1.default.throws(() => (0, teacherReviewScoring_1.calculateTeacherReviewScore)([{ maximumMarks: 4, teacherMark: -1 }]), /outside the allowed range/i);
});
