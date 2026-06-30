# Photos & Gallery

## What to build

Photo support for chicken records. An admin uploads a photo with a free-form description; the image file is stored in the server's local image folder and its path is recorded in the database. The chicken's profile shows a gallery of all its photos in chronological order, each with its description and timestamp.

End-to-end: the UI upload flow, the API saving the file to the local folder and persisting the path + description + timestamp, and the gallery rendering them chronologically.

## Acceptance criteria

- [ ] An admin can upload a photo with a free-form description for a chicken
- [ ] The image file is stored in the server's local folder with its path saved in the database
- [ ] The chicken profile displays a gallery of all photos in chronological order
- [ ] Each gallery item shows its description and timestamp
- [ ] Automated tests cover the upload + path-persistence behavior

## Blocked by

- `.scratch/full-enrollment-dynamic-lists/issue.md`

Triage: ready-for-agent
