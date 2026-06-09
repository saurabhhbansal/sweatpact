```markdown
# sweatpact Development Patterns

> Auto-generated skill from repository analysis

## Overview
This skill teaches the core development patterns, coding conventions, and workflows used in the `sweatpact` TypeScript codebase. It covers file naming, import/export styles, commit message conventions, and testing patterns. Use this as a reference for contributing to or maintaining the repository.

## Coding Conventions

### File Naming
- Use **camelCase** for file names.
  - Example: `userProfile.ts`, `apiClient.ts`

### Import Style
- Use **alias imports** for modules.
  - Example:
    ```typescript
    import { fetchData as getData } from './apiClient';
    ```

### Export Style
- Use **named exports** exclusively.
  - Example:
    ```typescript
    // In userProfile.ts
    export function getUserProfile(id: string) { ... }
    export const USER_ROLE = 'admin';
    ```

### Commit Messages
- Freeform style, no strict prefixes.
- Average commit message length: ~66 characters.
  - Example:
    ```
    Fix bug in user authentication flow
    ```

## Workflows

_No automated workflows detected in this repository._

## Testing Patterns

- Test files use the `*.test.*` naming pattern.
  - Example: `userProfile.test.ts`
- Testing framework is **unknown**; check existing test files for patterns.
- Example test file structure:
  ```typescript
  // userProfile.test.ts
  import { getUserProfile } from './userProfile';

  describe('getUserProfile', () => {
    it('returns user data for valid id', () => {
      // test implementation
    });
  });
  ```

## Commands
| Command | Purpose |
|---------|---------|
| _No commands defined_ | _No automated workflows or CLI commands detected_ |
```
