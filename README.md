# AJI Note App

A simple encrypted note-taking CLI with REPL support.

## Features
- Interactive REPL for managing notes.
- Per-file password protection (AES + PBKDF2 via crypto-utils).
- Multiple note files stored in a notes directory.
- Commands for listing, adding, deleting notes and files.
- Docker-friendly with development bind-mounts to avoid rebuilding.

## Install / Run locally
Requires Node 18+.

Clone and install:
```bash
git clone <repo>
cd ajinoteapp
npm install
```

Run the REPL:
```bash
npm start
# or directly
node src/app.js
```

## Docker
Build and run interactively:
```bash
docker build -t aji-note-app:1.0 .
docker run -it --rm aji-note-app:1.0
```
For development without rebuilding, mount the project:
```bash
docker run -it --rm -v "$(pwd):/app" -w /app node:24-alpine sh -c "npm install && node src/app.js"
```

## Notes directory
Default notes directory: `~/.aji-notes`  
Override via environment variable:
```bash
export AJI_NOTES_DIR="/path/to/notes"
```

## REPL commands (examples)
Use commands with a leading dot. Aliases exist for many commands.

- .help — Show help
- .addNote <text> or .an <text> — Add a note
- .listNotes or .ln — List notes in current file
- .deleteNote <number> — Delete a note by index
- .deleteAll or .da — Delete all notes (respects encryption)
- .setNotesFile <filename> — Switch/create a notes file
- .listFile or .lf — List files in notes directory
- .deleteFile <filename> or .df — Delete a file (prompts and requires password if encrypted)
- .setPassword <password> — Encrypt current file with given password (encrypts existing notes)
- .getPassword <password> or .gp — Provide session password (masked prompt if omitted)
- .clearPassword — Clear in-memory session password
- .exit — Exit REPL

Important: encrypted files store a single encrypted JSON blob. If a file is encrypted, you must provide the correct session password with `.getPassword` before adding, deleting, or listing notes. Attempts to mutate an encrypted file without a valid session password will be denied.

## Encryption behavior
- crypto-utils implements symmetric encryption (AES-256-CBC with PBKDF2-derived key).
- When you run `.setPassword`, existing plaintext notes are read and re-encrypted.
- Once a file is encrypted, all writes will preserve encryption. The session password is kept in memory only.

Security note: AES-CBC is not authenticated — consider switching to AES-GCM or adding an HMAC if you require tamper protection.

## Development tips
- Use a bind-mount to avoid rebuilding Docker image for each code change.
- Add `nodemon` for automatic restarts during development:
```json
"scripts": { "dev": "nodemon --watch src --exec node src/app.js" }
```

## Contributing
Open issues or PRs for bugs and improvements. Test encryption/decryption flows carefully.

## License
MIT
```// filepath: /Users/jithinaji/Developer/Node/ajinoteapp/README.md
# AJI Note App

A simple encrypted note-taking CLI with REPL support.

## Features
- Interactive REPL for managing notes.
- Per-file password protection (AES + PBKDF2 via crypto-utils).
- Multiple note files stored in a notes directory.
- Commands for listing, adding, deleting notes and files.
- Docker-friendly with development bind-mounts to avoid rebuilding.

## Install / Run locally
Requires Node 18+.

Clone and install:
```bash
git clone <repo>
cd ajinoteapp
npm install
```

Run the REPL:
```bash
npm start
# or directly
node src/app.js
```

## Docker
Build and run interactively:
```bash
docker build -t aji-note-app:1.0 .
docker run -it --rm aji-note-app:1.0
```
For development without rebuilding, mount the project:
```bash
docker run -it --rm -v "$(pwd):/app" -w /app node:24-alpine sh -c "npm install && node src/app.js"
```

## Notes directory
Default notes directory: `~/.aji-notes`  
Override via environment variable:
```bash
export AJI_NOTES_DIR="/path/to/notes"
```

## REPL commands (examples)
Use commands with a leading dot. Aliases exist for many commands.

- .help — Show help
- .addNote <text> or .an <text> — Add a note
- .listNotes or .ln — List notes in current file
- .deleteNote <number> — Delete a note by index
- .deleteAll or .da — Delete all notes (respects encryption)
- .setNotesFile <filename> — Switch/create a notes file
- .listFile or .lf — List files in notes directory
- .deleteFile <filename> or .df — Delete a file (prompts and requires password if encrypted)
- .setPassword <password> — Encrypt current file with given password (encrypts existing notes)
- .getPassword <password> or .gp — Provide session password (masked prompt if omitted)
- .clearPassword — Clear in-memory session password
- .exit — Exit REPL

Important: encrypted files store a single encrypted JSON blob. If a file is encrypted, you must provide the correct session password with `.getPassword` before adding, deleting, or listing notes. Attempts to mutate an encrypted file without a valid session password will be denied.

## Encryption behavior
- crypto-utils implements symmetric encryption (AES-256-CBC with PBKDF2-derived key).
- When you run `.setPassword`, existing plaintext notes are read and re-encrypted.
- Once a file is encrypted, all writes will preserve encryption. The session password is kept in memory only.

Security note: AES-CBC is not authenticated — consider switching to AES-GCM or adding an HMAC if you require tamper protection.

## Development tips
- Use a bind-mount to avoid rebuilding Docker image for each code change.
- Add `nodemon` for automatic restarts during development:
```json
"scripts": { "dev": "nodemon --watch src --exec node src/app.js" }
```

## Contributing
Open issues or PRs for bugs and improvements. Test encryption/decryption flows carefully.

## License
MIT