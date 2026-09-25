# Database Storage Directory

This directory stores the application database file (`data.json`).

## Security & Privacy Notice
- **`data.json` is strictly personal**: It stores your accounts, transactions, balances, and registered credentials.
- **Git Ignore Protection**: `data.json`, `data.backup.json`, and any other local `.db` / `.sqlite` files in this directory are ignored by git and will **never** be committed or uploaded to GitHub.
- **Automatic Initialization**: When someone clones this repository and starts the server for the first time:
  1. The server automatically creates a fresh, empty personal `data.json` based on `data.example.json`.
  2. Each user maintains their own completely private local database.
