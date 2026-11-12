# Signed-in account identity

The sidebar previously hard-coded Bobby/BZ, and the dashboard reused that name.
Both now read the authenticated session's displayName through one identity helper.
Missing display names fall back to that account's email, then a generic account
label. Signed-out/local sessions use Guest and an unpersonalized greeting.
Account names are rendered as text or escaped before Settings markup is built.
Initials, the settings button's accessible label and its tooltip update together.
Long sidebar names truncate visually while the full name remains in the button
label/tooltip; greeting and Settings text can wrap.

Verification on an isolated local Worker/database:

- Alice Johnson / AJ appeared in sidebar, Settings and dashboard after sign-in.
- Reload restored Alice's session and name.
- Sign-out cleared the previous name/initials and restored Guest / ?.
- Signing in as Priya Shah changed all labels and the greeting to Priya / PS.
- The profile button opened Settings using Enter.
- Dashboard layouts at 1280×900 and 390×844 had no horizontal overflow.
- Task creation/editing and next/previous calendar navigation still worked;
  no browser console errors were recorded.
- All 34 focused account/store/Worker/PWA tests passed, including new fallback,
  Unicode-initial and signed-out identity cases. JavaScript syntax/diff checks pass.

The screenshots use fictional local accounts: desktop.jpg and mobile.jpg.
This change does not change account creation or verify a person's legal identity.
Password accounts currently receive an email-based display name from the backend;
Google accounts use their stored provider name. No profile-name editing UI was added.
The PWA cache version is advanced to refresh the changed app shell after release.
This is a local implementation; no public deployment is included.
