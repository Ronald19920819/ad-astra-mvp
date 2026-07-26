# AD Astra Tutor App
## MVP Roadmap and Project Constitution

**Version:** 1.0  
**Status:** Active Development  
**Current Sprint:** Learner-Ready MVP  
**Immediate Target:** Basic learner-ready structure by Monday  
**Reference Subject:** Business Studies  

---

# 1. Project Vision

AD Astra is a learner-focused tutoring and learning management platform designed to provide structured lessons, activities, personalised support, teacher feedback, progress tracking, and AI-assisted learning.

The platform must remain simple, calm, encouraging, and easy for learners to navigate.

AD Astra should not become a cluttered learning management system. Its purpose is to guide learners clearly from one learning task to the next.

## Core Principles

- Learners should always know what to do next.
- Every learning resource must belong to a lesson.
- Completion rules must adapt to the content attached to the lesson.
- Teachers retain control over generated content and final marking.
- AI supports the teaching process but does not replace teacher judgement.
- Features should be reusable across subjects.
- Business Studies is the master implementation before subject expansion.

---

# 2. Learner-Ready MVP Definition

The basic learner-ready system must allow a learner to:

1. Sign in successfully.
2. Access enrolled subjects.
3. Open a subject dashboard.
4. See the current lesson.
5. View lesson content.
6. Complete required lesson components.
7. Take the lesson quiz where one exists.
8. See whether the lesson is Current, Completed, or Attention Required.
9. Open the current activity.
10. Submit an activity.
11. View returned work and teacher feedback.
12. Navigate without broken links or confusing dead ends.

The MVP does not require every future feature to be complete.

## Intentionally Postponed

- Coins
- Stickers
- Advanced achievements
- Parent portal
- Voice tutoring
- Advanced analytics
- Marketplace features
- Full desktop redesign
- Realtime chat
- Notification system
- Large-scale multi-school support

---

# 3. Core Architecture

## Technology Stack

- Next.js App Router
- TypeScript
- Tailwind CSS
- Supabase
- OpenAI API

## Architecture Principles

- Use shared helpers for shared business rules.
- Do not duplicate lifecycle or completion logic in individual pages.
- Keep page components focused on rendering and orchestration.
- Reuse components across subjects wherever practical.
- Store persistent learner, lesson, activity, submission, and review data in Supabase.
- Keep sensitive API keys in environment variables.
- Apply database migrations through the Supabase SQL editor or migration workflow.
- Prefer clear and maintainable code over premature complexity.

---

# 4. User Interface Principles

## Learner Interface

The learner interface must be:

- Calm
- Spacious
- Encouraging
- Mobile-first
- Easy to scan
- Focused on the learner's next action

The learner should not be overwhelmed by administrative information.

## Teacher Interface

The teacher interface must be:

- Professional
- Efficient
- Workspace-oriented
- Clear about publishing, reviewing, and editing
- Consistent with the Activity Review visual style

## Typography

Use the established project fonts where appropriate:

- Oxanium
- Geist
- Indie Flower

## Colour Meaning

- Orange: Current or active
- Green: Completed or successful
- Red: Attention Required
- Neutral grey: Unavailable, not attached, or informational

Colours must communicate consistent meaning across the application.

## Responsive Behaviour

The current mobile-first interface is acceptable for the MVP.

A desktop enhancement pass will happen later. Desktop layouts should eventually use wider grids and two-column structures rather than leaving all content in a narrow mobile-width column.

---

# 5. Core Data Relationships

The intended structure is:

```text
School
 ├── Teachers
 ├── Learners
 └── Subjects
      ├── Enrolments
      └── Lessons
           ├── Reading
           ├── Video
           ├── Lesson Quiz
           └── Activities
                └── Submissions
                     └── Reviews
```

---

# 6. Phase 1 — Dynamic Learner and Teacher Profile System

**Status:** Implementation complete; Supabase migration and authenticated manual verification remain required before rollout.

- [x] Dynamic learner profile identity from the authenticated Supabase user.
- [x] Dynamic teacher profile identity from the authenticated Supabase user.
- [x] Shared initials avatars with optional real profile-image support.
- [x] Learner My AD Astra Journey card using shared subject progress.
- [x] Dynamic teacher Teaching Overview.
- [x] Secure authenticated password-reset actions.
- [x] Teacher Learner Approvals page.
- [x] Server-authorised approval and decline actions scoped to active teacher subject assignments.
- [ ] Apply `202607260001_dynamic_profiles_and_learner_approvals.sql` to Supabase and complete authenticated browser verification.

Still upcoming:

- Teacher Content Archive
- Learner public signup and email-verification onboarding
- Register for additional subjects
- Deregister or archive subject enrolments
- Learner account archive or deletion
- Avatar selection or profile-picture upload
- Full report-card system
- Coins and subscription functionality

---

# 7. Phase 3 — Learner Experience Polish

## Current Lesson Lifecycle

**Status:** Complete

- [x] Current Lesson lifecycle correction completed and manually tested.
- [x] The newest published incomplete lesson displays Current.
- [x] The Current Lesson card no longer displays Attention Required.

---

# 8. Phase 4 — Teacher Content Management

**Status:** Complete for the essential MVP scope

- [x] Edit published lessons.
- [x] Edit published activities.
- [x] Trash icon deletion actions.
- [x] Compact lesson content summary icons.

Advanced teacher features, including lesson preview and statistics, remain intentionally postponed.

---

# 9. Current Weekend Sprint

- [x] **Priority 1 — Current Lesson lifecycle correction:** Complete.
- [x] **Priority 3 — Teacher Editing Essentials:** Complete.
- [ ] **Next active priority:** Improve the learner subject overview and learner subject dashboard.

---

# 10. Known Issues

## Active

No active issue remains for the five manually tested Business Studies MVP tasks recorded in this update.

## Resolved

- The Current Lesson card incorrectly displayed the red Attention Required state for the newest published incomplete lesson. The newest incomplete lesson now displays Current, and the Current Lesson card is restricted to Current or Completed.

---

# Change Log

## July 2026

### Dynamic Profiles and Learner Approvals — Phase 1 Implemented

- Replaced live fixture profile identities with authenticated learner and teacher profile data and shared initials avatars.
- Added the learner My AD Astra Journey card, dynamic teacher Teaching Overview, verified-email password-reset actions, and teacher-scoped learner subject approvals.
- Automated TypeScript, targeted lint, focused tests, and production build passed.
- The focused Supabase migration and authenticated browser/email verification remain manual rollout steps.

### Teacher Content Management MVP Completed

- Corrected the shared Business Studies learner lesson lifecycle display so the newest incomplete lesson is Current, completed lessons remain Completed, and older incomplete lessons require attention.
- Added in-place editing for published Business Studies lessons and activities while preserving their record and question identifiers.
- Replaced lesson and activity text deletion actions with compact, confirmed trash-icon actions.
- Added efficient Reading, Video, Quiz, and Activity summaries to published lesson cards without per-card database queries.
- All five Business Studies MVP changes were manually tested successfully.

### Next Focus — Learner Subject Overview

- Connect the learner-facing Learning Overview and subject dashboard to real learner lesson and activity data.
