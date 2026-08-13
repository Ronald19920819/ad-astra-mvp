"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateTeacherReviewScore = calculateTeacherReviewScore;
function calculateTeacherReviewScore(entries) {
    let earnedMarks = 0;
    let maximumMarks = 0;
    for (const entry of entries) {
        if (!Number.isInteger(entry.maximumMarks) ||
            entry.maximumMarks < 0 ||
            !Number.isInteger(entry.teacherMark) ||
            entry.teacherMark < 0 ||
            entry.teacherMark > entry.maximumMarks) {
            throw new RangeError("A teacher mark is outside the allowed range.");
        }
        earnedMarks += entry.teacherMark;
        maximumMarks += entry.maximumMarks;
    }
    return {
        earnedMarks,
        maximumMarks,
        percentage: maximumMarks > 0 ? Number(((earnedMarks / maximumMarks) * 100).toFixed(2)) : 0,
    };
}
