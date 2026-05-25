# Contributing to DEX

Thank you for your interest in contributing to DEX. This document explains how to get started and the terms under which contributions are accepted.

This repository is currently private. Contributions are coordinated with authorized collaborators rather than public forks.

## How to contribute

1. **Request or confirm repository access** with the maintainer.
2. **Create a branch** for your change (`git checkout -b feature/your-change`).
3. **Make your changes** with clear commits and a focused scope.
4. **Run tests** (see below) and fix any failures.
5. **Open a pull request** against the default branch with a clear description of what changed and why.

For substantial changes, open an issue first to discuss approach and avoid duplicate work.

## Coding style and tests

Match the style of the code you are editing:

- **Python (backend):** Follow existing patterns in `app/backend/`. Run tests from `app/backend` with `pytest` (see `app/backend/pytest.ini` for markers and coverage settings).
- **TypeScript/React (frontend):** Follow existing patterns in `frontend/`. Run `npm test` from `frontend/`.
- Keep changes minimal and focused on the problem you are solving.
- Do not commit secrets, API keys, or local `.env` files.

### Running tests

```bash
# Backend
cd app/backend
pytest

# Frontend
cd frontend
npm test
```

CI runs lint and tests on every push and pull request.

## Contributor License Agreement

By submitting a pull request to this repository, you agree that:

1. Your contribution is licensed under the **GNU Affero General Public License v3.0 (AGPL-3.0)**, the same license as this project; and

2. You **grant Rhythm Suthar** (project maintainer) the **right to relicense your contribution under different terms in the future, including commercial licenses, without additional consent or compensation**.

This inline agreement preserves the project's ability to offer commercial licensing while keeping contributions under AGPL-3.0 for authorized distributions. If you do not agree to these terms, do not submit a pull request.

For questions about contributing or licensing, contact **rhythmsuthar123@gmail.com**.
