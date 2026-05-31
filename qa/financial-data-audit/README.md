# Financial data audit capture

These helpers capture local browser evidence during operational audits. They are
safe to commit because credentials are supplied only through environment
variables. Generated JSON and screenshots stay local and are ignored by git.

Required variables:

- `FINANCIAL_AUDIT_USER`
- `FINANCIAL_AUDIT_PASSWORD`

Optional variables:

- `FINANCIAL_AUDIT_BASE_URL`, default `http://localhost:5173`
- `FINANCIAL_AUDIT_API_BASE_URL`, default `http://localhost:8000`

Example:

```powershell
$env:FINANCIAL_AUDIT_USER='usuario.validacion'
$env:FINANCIAL_AUDIT_PASSWORD='password-temporal'
$env:FINANCIAL_AUDIT_BASE_URL='http://localhost:5173'
node qa\financial-data-audit\capture-current-ui.mjs
```

Use a temporary validation user or a disposable training environment. Do not use
known demo credentials or production staff passwords in scripts.
