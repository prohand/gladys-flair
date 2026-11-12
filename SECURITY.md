# Security policy

## Supported versions

Only the latest release of the Flair integration receives security fixes.
Update the integration from the Gladys store before reporting an issue.

| Version      | Supported |
| ------------ | --------- |
| 1.x (latest) | Yes       |
| older        | No        |

## Reporting a vulnerability

Please do **not** open a public issue for a security problem.

Report it privately through GitHub: open the **Security** tab of
[prohand/gladys-flair](https://github.com/prohand/gladys-flair/security), then
**Report a vulnerability**.

No such button? Private reporting is not enabled yet: open an issue that only
asks the maintainers for a private contact, without any detail of the problem.

Include, when you can:

- the version of the integration and of Gladys;
- what an attacker can do, and the steps to reproduce it;
- any log line that helps (remove the Flair client ID, client secret, tokens
  and addresses first).

You should get a first answer within 7 days. A fix is released as a new version of
the integration, and the advisory is published once users can update.

## Scope

In scope: the code of this repository and the Docker image it publishes.

Out of scope: Gladys Assistant itself (report to
[GladysAssistant/Gladys](https://github.com/GladysAssistant/Gladys/security)), the
Flair cloud API and the Flair devices (report to Flair).

## How the integration handles secrets

- The Flair client secret is stored by Gladys in a `secret` field; the
  integration never logs it, nor the access token it obtains.
- The token lives in memory only, nothing is written to disk.
- The integration only talks to `https://api.flair.co`, over HTTPS.
- It asks Flair for the scopes it needs (structures, vents, pucks: view and
  edit), nothing more.

## Good practices for users

- Keep the client ID and secret in the integration's fields only; ask Flair
  for new credentials if they leak.
- Keep Gladys and the integration up to date.
