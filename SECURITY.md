# Security policy

## Reporting a vulnerability

Please **do not open a public issue** for security problems.

Email **security@eurobondmarkets.com** with:

- a description of the issue and its impact
- the affected files, endpoints or edge functions
- steps to reproduce and, if possible, a minimal proof of concept

We acknowledge reports within 5 business days and keep you informed until the issue is fixed. Please allow 90 days for a fix before any public disclosure.

Do not test against the hosted service at eurobondmarkets.com in ways that could affect live deal communications or other users' data.

## Scope notes

- The Supabase URL and anon key in `.env` are **publishable** values that ship in the browser bundle by design. Access to data is enforced by Postgres row-level security and by authorisation checks in the edge functions.
- Service-role keys and third-party API keys are held only as Lovable Cloud / Supabase secrets and must never be committed.
