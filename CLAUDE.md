@AGENTS.md

## Git workflow

- **Never commit directly to `develop` or `main`.** All work goes on a feature branch (`feat/...`, `fix/...`, `refactor/...`) created from `develop`, and reaches `develop`/`main` only by merge/PR.
- If you find uncommitted work sitting on `develop` or `main`, move it to a feature branch (`git switch -c <branch>`, which carries the working tree) before committing.
