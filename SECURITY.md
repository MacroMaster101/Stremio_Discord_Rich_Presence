# Security Policy

## Supported versions

Only the **latest release** receives security fixes. The app auto-updates from
[GitHub Releases](https://github.com/MacroMaster101/Stremio_Discord_Rich_Presence/releases/latest),
so staying on the newest version is the fix for any reported issue.

| Version | Supported |
| ------- | --------- |
| Latest release | ✅ |
| Older releases | ❌ |

## Reporting a vulnerability

**Please do not open a public issue for security problems.**

Report privately through GitHub:
**[Report a vulnerability](https://github.com/MacroMaster101/Stremio_Discord_Rich_Presence/security/advisories/new)**
(Security tab → *Report a vulnerability*).

Helpful details to include:

- The app version (tray menu → **About**) and your Windows version.
- What the issue is and what an attacker could do with it.
- Steps to reproduce, or a proof of concept.

This is a hobby project maintained on a best-effort basis. You'll get an
acknowledgement as soon as possible, and fixes ship as a new release that
existing installs pick up through auto-update. Reporters are credited in the
advisory unless they prefer otherwise.

## Scope

In scope:

- The app's own code in `src/` and the installer script in `build/`.
- The update pipeline (GitHub Releases, `latest.yml`, and the release workflow).

Out of scope:

- Vulnerabilities in Discord, Stremio, or Cinemeta themselves — report those upstream.
- Issues that require an attacker to already run code on the user's machine.
