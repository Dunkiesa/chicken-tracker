# Plan: Add Acquisition Date to Chicken Enrollment

**Commit:** edcf654

## Summary

Add an `acquisition_date` field to track when a chicken was acquired/enrolled. This field should be:
- Optional (nullable) — not all users will know the exact date
- Stored as a DATE type in SQL Server
- Editable via the existing chicken edit form
- Visible in the chicken profile display

## Files to Modify

### 1. Database Migration (`src/lib/db.ts`)
- Add `acquisition_date DATE NULL` column to `chickens` table in `runMigrations()`
- Place after `acquisition_type_id` column for logical grouping

### 2. Type Definitions (`src/lib/chickens.ts`)
- Add `acquisition_date: string | null` to `Chicken` type (line 7-23)
- Add `acquisition_date?: string | null` to `CreateChickenInput` (line 25-31)
- Add `acquisition_date?: string | null` to `UpdateChickenInput` (line 33-42)
- Update `LIST_JOIN_SQL` to select `CONVERT(varchar, c.acquisition_date, 23) AS acquisition_date`
- Update `createChicken()` to accept and insert `acquisition_date`
- Update `updateChicken()` to handle `acquisition_date` updates

### 3. Create Chicken API (`src/app/api/chickens/route.ts`)
- Accept `acquisition_date` in POST body
- Pass through to `createChicken()`

### 4. Update Chicken API (`src/app/api/chickens/[id]/route.ts`)
- No changes needed — already passes full body to `updateChicken()`

### 5. Chicken Profile Page (`src/app/chickens/[id]/page.tsx`)
- Add `acquisition_date` to `Chicken` type (line 7-19)
- Add `editAcquisitionDate` state
- Add acquisition date field to edit form (in the edit section, after Acquisition Type)
- Display acquisition date in the profile view (after Acquisition Type row)
- Initialize `editAcquisitionDate` in `startEditChicken()`

### 6. Integration Tests (`tests/chickens.integration.test.ts`)
- Test creating chicken with acquisition date
- Test creating chicken without acquisition date (null)
- Test updating acquisition date
- Test that acquisition date appears in list/get results

## Verification Commands

```bash
# Run integration tests
npm run test:integration -- tests/chickens.integration.test.ts

# Run lint
npm run lint

# Type check
npx tsc --noEmit
```

## Done Criteria

- [ ] Migration adds `acquisition_date` column to `chickens` table
- [ ] `Chicken` type includes `acquisition_date: string | null`
- [ ] `CreateChickenInput` and `UpdateChickenInput` accept optional `acquisition_date`
- [ ] `createChicken()` stores acquisition date
- [ ] `updateChicken()` updates acquisition date
- [ ] API routes pass acquisition date through
- [ ] Profile page displays acquisition date (when set)
- [ ] Profile page edit form includes acquisition date field
- [ ] All integration tests pass
- [ ] Lint and typecheck pass

## Out of Scope

- Batch import / CSV upload (separate feature)
- Acquisition date validation beyond DATE format (e.g., future dates)
- Analytics/reporting on acquisition dates

## Maintenance Notes

- The `acquisition_date` column is nullable — existing chickens will have NULL
- Date format in API: ISO 8601 (YYYY-MM-DD)
- SQL Server stores as DATE; returned as YYYY-MM-DD string via CONVERT(..., 23)
- Future: consider adding index on `acquisition_date` if querying by date range becomes common