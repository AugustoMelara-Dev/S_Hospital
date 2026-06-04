# Rate limit safety evidence - 2026-06-03

Decision: `PASSED`.

Scope:

- Verify that critical cashier write operations use per-user rate limiting,
  not only shared-IP throttling.
- Protect LAN operation where several cashier computers may appear behind the
  same local IP/NAT path.
- Keep rate-limit errors human and non-technical for operators.

Commands run:

```powershell
docker compose exec -T backend php artisan test --filter=ThrottleByUserTest
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\validate_rate_limit_safety.ps1
```

Observed result:

- `ThrottleByUserTest` passed.
- `RATE_LIMIT_SAFETY: YES`.
- `ThrottleByUser` keys authenticated requests by user id, with IP fallback
  for unauthenticated requests.
- The 429 response says: `Demasiadas solicitudes locales para su usuario. Por favor espere antes de repetir.`
- Invoice create, invoice void, invoice reverse, payment registration,
  payment void, cashbox open and cashbox close use `throttle.user`.
- Tests confirm one cashier exceeding the limit does not block another cashier
  on the same LAN IP.

Safety notes:

- No `.env` file was deleted or printed.
- No database volume was reset.
- No production data was restored over.
- No push was performed.
- This evidence does not replace final LAN/client validation or final
  production preflight.
