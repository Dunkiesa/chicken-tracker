## Problem Statement
The user needs a system to track the eggs laid by individual chickens in a small backyard flock, including specific details like weight, date, chicken demographics (breed, origin, etc.), and a chronological notes log.

## Solution
A dual-interface system consisting of a mobile web app for quick egg entry and a desktop tool for chicken enrollment and data analysis. The system will use a unified RESTful API connected to a SQL Server Express database hosted on a personal Ubuntu server via Docker.

## User Stories
1. As an admin, I want to add new chickens with unique IDs, so that I can track each bird individually.
2. As an admin, I want to select from dynamic lists for Breed, Origin, and Acquisition Type, so that data remains consistent but flexible.
3. As an admin, I want to upload photos of chickens with free-form descriptions, so that I can see their growth stages.
4. As an admin, I want to maintain a chronological log of notes for each chicken, so that I can track vet visits and medications.
5. As a viewer, I want to log the weight and date of an egg, so that I can track daily production.
6. As a viewer, I want a "Quick Log" button on the mobile app, so that I can enter data easily while in the coop.
7. As an admin, I want to see a dashboard with metrics like production over time, average weight, and dry periods, so that I can monitor flock health.

## Implementation Decisions
- **Database**: SQL Server Express in a Docker container.
- **Backend**: Unified RESTful API.
- **Frontend**: Mobile web app (React/Next.js) and Desktop tool.
- **Image Storage**: Local folder on the server with paths stored in the database.
- **Authentication**: Google Login with Admin and Viewer roles.
- **Data Schema**: Support for unique IDs, dynamic lists, and chronological note entries.

## Testing Decisions
- Test external behavior of the API endpoints.
- Verify Google Auth roles (Admin vs Viewer).
- Verify mobile UI responsiveness and "Quick Log" functionality.
- Verify data consistency between desktop enrollment and mobile logging.

## Out of Scope
- IoT sensors or automatic feeders.
- External marketplace integration.
- Real-time chat between users.

## Further Notes
- The system is intended for a single flock.
- The "Other" reason for leaving includes a text field for specific details.
