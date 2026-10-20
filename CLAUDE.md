@AGENTS.md

## Git workflow

- **Never commit directly to `develop` or `main`.** All work goes on a feature branch (`feat/...`, `fix/...`, `refactor/...`) created from `develop`, and reaches `develop`/`main` only by merge/PR.
- If you find uncommitted work sitting on `develop` or `main`, move it to a feature branch (`git switch -c <branch>`, which carries the working tree) before committing.

## Customer signup/login contract (Oct 2026)

The admin Customers area and the backend customer endpoints were reworked in Oct 2026. **This storefront was not changed**, and its signup/login must keep working exactly as before. Full details: `docs/customers-identity-model.md` in the **fype-backend** repo.

- Customers are one `Customer` document per **merchant** (`userId = store.userId`) with a slice per store. Backend login looks up `{ phone | email, userId: store.userId }`.
- `components/shared/AuthModal.tsx` sends the phone as typed with whitespace removed and the `+<country code>` kept (`phone.replace(/\s/g, "")`, e.g. `+971501234567`). The admin creates customers with the identical stored format, so an admin-created customer is found by webstore login. **Do not change this phone format here without changing the backend in the same release**, or logins will create duplicate customers.
- Addresses saved on the storefront stay per store. A merchant only ever sees customers created under them (admin or their own webstore).
- Planned, not built: after OTP login, offer the same verified phone's addresses saved at other Fype stores (copied into this store only when the customer picks one; end-customer convenience only, needs privacy wording). Never add cross-merchant reads for merchants.
- If a storefront login suddenly creates a second customer for a known person, compare the exact stored `phone` string and `Customer.userId` with `store.userId` (see the debugging playbook in the backend doc).
