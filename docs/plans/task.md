# Task Checklist - Provider Deletion and Restoration

| Task | Status | Notes |
| :--- | :---: | :--- |
| Task 1: Backend: Remove openrouter from builtInProviders list | [x] | Update server.ts builtInProviders |
| Task 2: Backend: Handle deletion and restoration of default providers | [x] | Update DELETE and POST configure routes |
| Task 3: Backend: Filter deleted providers in models list & checks | [x] | Filter GET /api/models and isModelAndProviderEnabled |
| Task 4: Frontend: Enable Delete button for default providers | [x] | Modify isCustomProvider check and UI |
| Task 5: Frontend: Implement Restore Default Providers UI | [x] | Render restore section at the bottom of settings |
| Task 6: Rebuild, restart, and verify the changes | [ ] | Run builds, check endpoints, manually verify functionality |
