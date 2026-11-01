# TrustChain – Transparent Donations (Demo with Backend)

> This is an interactive demonstration. Transactions and blockchain records are simulated; no real funds are transferred.

## Run
1. Install Node.js 16 or newer (only the presenter's machine; browsers need nothing).
2. In this folder run: `npm start` (or `node server.js`).
3. Open http://localhost:3000. Use `PORT=4000 npm start` to change the port.

No `npm install`, MetaMask, wallet or blockchain is needed: the backend uses only Node built-ins.

## Structure
- `server.js` – REST API, validation, SHA-256 hash-linked ledger, static file server.
- `public/index.html` – frontend (HTML, CSS, JS). Evidence files are hashed in the browser with Web Crypto.
- `data/ledger.json` – created on first run. Delete it (or use "Reset Demo") to restore the sample data.

## API
| Method | Route | Purpose |
|---|---|---|
| GET | /api/state | All ledger blocks |
| POST | /api/donate | `{camp, amount}` records a simulated donation |
| POST | /api/distribute | `{camp, amount, purpose, date, evName, evHash, evText?}` records a distribution; rejects amounts above the campaign balance |
| GET | /api/verify-chain | Recomputes every block hash and link |
| POST | /api/sample | Adds more sample records |
| POST | /api/reset | Restores the initial sample data |

## Limitations
- Records are simulated and stored in a local JSON file; this is not a real blockchain and anyone with file access can edit it.
- Evidence hash verification confirms file integrity only. It does not prove the expense is legitimate.
- Future enhancements: real blockchain integration, verified NGO onboarding, multi-party approval of distributions.
