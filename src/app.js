#!/usr/bin/env node

import repl from 'repl';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import readline from 'readline';
import { encryptData, decryptData } from './crypto-utils.js';
import os from "os";


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const notesDir = process.env.AJI_NOTES_DIR || path.join(os.homedir(), ".aji-notes");

console.log('Welcome to the AJI Note App REPL!');
// call .help here for available commands

const ajinotes = repl.start('aji-note-app(version 0.0)> ');

// make the selected file mutable so .setNotesFile can update it
let selectedNotesFile = 'defaultNotes';
let defaultNotesPath = path.join(notesDir, selectedNotesFile);

let password = '';

// helpers for file/notes operations
function ensureDir(dir) {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function ensureFile(filePath) {
    ensureDir(path.dirname(filePath));
    if (!fs.existsSync(filePath)) fs.writeFileSync(filePath, '', 'utf8');
}

function readNotes(filePath = defaultNotesPath) {
    if (!fs.existsSync(filePath)) return [];
    const raw = fs.readFileSync(filePath, 'utf8').trim();
    if (!raw) return [];

    // detect crypto-utils encrypted format (JSON with salt,iv,data)
    let parsed;
    try {
        parsed = JSON.parse(raw);
    } catch (e) {
        parsed = null;
    }

    if (parsed && parsed.salt && parsed.iv && parsed.data) {
        if (!password) {
            console.log(`File ${path.basename(filePath)} is encrypted. Run .getPassword to provide the password for this session.`);
            return [];
        }
        try {
            const decrypted = decryptData(raw, password);
            if (!Array.isArray(decrypted)) return [];
            return decrypted.map(line => String(line).trim()).filter(Boolean);
        } catch (err) {
            console.log('Failed to decrypt file:', err.message);
            return [];
        }
    }

    // plaintext: split lines
    return raw.split('\n').map(line => line.trim()).filter(Boolean);
}

function isEncryptedFile(filePath = defaultNotesPath) {
    if (!fs.existsSync(filePath)) return false;
    const raw = fs.readFileSync(filePath, 'utf8').trim();
    if (!raw) return false;
    let parsed;
    try { parsed = JSON.parse(raw); } catch (e) { return false; }
    return parsed && parsed.salt && parsed.iv && parsed.data;
}

// helper to prompt hidden input
function promptHidden(query) {
    return new Promise((resolve) => {
        const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
        rl.stdoutMuted = true;
        const _write = rl._writeToOutput;
        rl._writeToOutput = function (stringToWrite) {
            if (rl.stdoutMuted) rl.output.write('*');
            else _write.call(rl, stringToWrite);
        };
        rl.question(query, (answer) => {
            rl._writeToOutput = _write;
            rl.close();
            rl.output.write('\n');
            resolve(answer);
        });
    });
}

ajinotes.defineCommand('getPassword', {
    help: 'Provide a password for encrypted notes: .getPassword <password> (or run without args to be prompted)',
    async action(pw) {
        let newPassword = (pw || '').trim();
        if (!newPassword) {
            // prompt hidden
            try {
                newPassword = (await promptHidden('Password: ')).trim();
            } catch (e) {
                console.log('Failed to read password.');
                this.displayPrompt();
                return;
            }
        }

        if (!newPassword) {
            console.log('No password provided.');
            this.displayPrompt();
            return;
        }

        password = newPassword;
        console.log('Password set for this REPL session.');

        // optional: attempt to read/decrypt current file to validate password
        const filePath = defaultNotesPath;
        if (fs.existsSync(filePath)) {
            const raw = fs.readFileSync(filePath, 'utf8').trim();
            let parsed;
            try { parsed = JSON.parse(raw); } catch (e) { parsed = null; }
            if (parsed && parsed.salt && parsed.iv && parsed.data) {
                try {
                    // validate by attempting decrypt
                    decryptData(raw, password);
                } catch (err) {
                    console.log('Warning: password did not decrypt current file:', err.message);
                }
            }
        }

        this.displayPrompt();
    }
});

// alias without leading dot
ajinotes.defineCommand('gp', {
    help: 'Alias for .getPassword',
    action(pw) {
        this.commands.getPassword.action.call(this, pw);
    }
});

function writeNotes(notes = [], filePath = defaultNotesPath) {
    // if the file is currently encrypted, we must write encrypted content
    if (isEncryptedFile(filePath)) {
        if (!verifyPasswordForFile(filePath, password)) {
            throw new Error('Cannot write: file is encrypted and session password is missing or incorrect.');
        }
        // encrypt using session password and persist
        const encrypted = encryptData(Array.isArray(notes) ? notes : [], password);
        fs.writeFileSync(filePath, encrypted, 'utf8');
        return;
    }

    // plaintext file behavior
    if (!Array.isArray(notes) || notes.length === 0) {
        fs.writeFileSync(filePath, '', 'utf8');
    } else {
        fs.writeFileSync(filePath, notes.join('\n') + '\n', 'utf8');
    }
}

function appendNote(note, filePath = defaultNotesPath) {
    ensureFile(filePath);

    const encrypted = isEncryptedFile(filePath);

    if (encrypted) {
        if (!password) {
            throw new Error('Encrypted file: no session password set.');
        }
        if (!verifyPasswordForFile(filePath, password)) {
            throw new Error('Encrypted file: wrong password.');
        }
    }

    const notes = encrypted
        ? readNotes(filePath)                   // decrypted array
        : readPlainNotes(filePath);             // raw file → split to array

    notes.push(String(note).trim());

    if (encrypted) {
        writeEncryptedNotes(notes, filePath);   // always encrypt
    } else {
        fs.appendFileSync(filePath, notes.at(-1) + '\n', 'utf8');
    }
}

function readPlainNotes(filePath) {
    if (!fs.existsSync(filePath)) return [];
    const raw = fs.readFileSync(filePath, 'utf8').trim();
    return raw ? raw.split('\n').map(x => x.trim()).filter(Boolean) : [];
}

function writeEncryptedNotes(notes, filePath) {
    const encrypted = encryptData(notes, password);
    fs.writeFileSync(filePath, encrypted, 'utf8');
}

function verifyPasswordForFile(filePath, pw) {
    const raw = fs.readFileSync(filePath, 'utf8').trim();
    try {
        decryptData(raw, pw);
        return true;
    } catch {
        return false;
    }
}

function deleteNoteByIndex(index, filePath = defaultNotesPath) {
    // deny when file is encrypted and session password is missing/incorrect
    if (isEncryptedFile(filePath) && !verifyPasswordForFile(filePath, password)) {
        throw new Error('Cannot delete note: file is encrypted and session password is missing or incorrect.');
    }

    const notesArray = readNotes(filePath);
    if (index < 0 || index >= notesArray.length) return null;
    const [deleted] = notesArray.splice(index, 1);
    writeNotes(notesArray, filePath);
    return deleted;
}

// ensure base notes dir and default file exist
ensureDir(notesDir);
ensureFile(defaultNotesPath);

ajinotes.defineCommand('help', {
    help: 'Show available commands and usage',
    action() {
        console.log('AJI Note App - commands:');
        console.log('.addNote <text>           Add a new note');
        console.log('.an <text>                Alias for .addNote');
        console.log('.listNotes                List all notes');
        console.log('.ln                      Alias for .listNotes');
        console.log('.listFile                 List all note files');
        console.log('.lf                      Alias for .listFile');
        console.log('.deleteNote <number>      Delete a specific note by its number');
        console.log('.deleteAll                Delete all notes');
        console.log('.deleteFile <file>        Delete a note file (confirmation; requires password if encrypted)');
        console.log('.df                      Alias for .deleteFile');
        console.log('.setNotesFile <file>      Switch notes file (created if missing)');
        console.log('.setPassword <password>   Set password for current file and encrypt existing notes');
        console.log('.getPassword <password>   Provide session password (masked prompt if omitted)');
        console.log('.clearPassword            Clear in-memory session password');
        console.log('.help                     Show this help');
        console.log('.exit                     Exit REPL');
        this.displayPrompt();
    }
});

ajinotes.defineCommand('addNote', {
    help: 'Add a new note: .addNote <note text>',
    action(text = '') {
        const note = text.trim();
        if (note) {
            appendNote(note);
            console.log('Note added:', note);
        } else {
            console.log('Please provide a note to add. Usage: .addNote <note text>');
        }
        this.displayPrompt();
    },
});

ajinotes.defineCommand('an', {
    help: 'Alias for .addNote',
    action(text) {
        this.commands.addNote.action.call(this, text);
    }
});

ajinotes.defineCommand('listNotes', {
    help: 'List all notes',
    action() {
        const notes = readNotes();
        if (notes.length === 0) {
            console.log('No notes.');
        } else {
            console.log('Your notes:');
            notes.forEach((note, index) => {
                console.log(`${index + 1}: ${note}`);
            });
        }
        this.displayPrompt();
    },
});

// Short alias
ajinotes.defineCommand('ln', {
    help: 'Alias for .listNotes',
    action() {
        this.commands.listNotes.action.call(this);
    }
});

ajinotes.defineCommand('deleteAll', {
    help: 'Delete all notes',
    action() {
        writeNotes([], defaultNotesPath);
        console.log('All notes have been deleted.');
        this.displayPrompt();
    },
});

ajinotes.defineCommand('da', {
    help: 'Alias for .deleteAll',
    action() {
        this.commands.deleteAll.action.call(this);
    }
});

ajinotes.defineCommand('deleteNote', {
    help: 'Delete a specific note by its number: .deleteNote <number>',
    action(number) {
        const id = parseInt((number || '').trim(), 10);
        if (Number.isNaN(id)) {
            console.log('Please provide a valid note number. Usage: .deleteNote <number>');
            this.displayPrompt();
            return;
        }
        const deleted = deleteNoteByIndex(id - 1);
        if (deleted === null) {
            console.log('Invalid note number.');
        } else {
            console.log('Deleted note:', deleted);
        }
        this.displayPrompt();
    },
});

ajinotes.defineCommand('dn', {
    help: 'Alias for .deleteNote',
    action(number) {
        this.commands.deleteNote.action.call(this, number);
    }
});

ajinotes.defineCommand('setNotesFile', {
    help: 'Set the notes file to use: .setNotesFile <filename>',
    action(fileName) {
        const newFileName = (fileName || '').trim();
        if (newFileName) {
            selectedNotesFile = newFileName;
            defaultNotesPath = path.join(notesDir, selectedNotesFile);
            ensureFile(defaultNotesPath);
            console.log('Notes file set to:', selectedNotesFile);
        } else {
            console.log('Please provide a valid file name. Usage: .setNotesFile <filename>');
        }
        this.displayPrompt();
    },
});

ajinotes.defineCommand('sn', {
    help: 'Alias for .setNotesFile',
    action(fileName) {
        this.commands.setNotesFile.action.call(this, fileName);
    }
});

ajinotes.defineCommand('setPassword', {
    help: 'Set password for the current notes file and encrypt existing notes: .setPassword <password>',
    async action(pw) {
        let newPassword = (pw || '').trim();
        if (!newPassword) {
            try {
                newPassword = (await promptHidden('New password: ')).trim();
            } catch (e) {
                console.log('Failed to read password.');
                this.displayPrompt();
                return;
            }
        }

        if (!newPassword) {
            console.log('No password provided.');
            this.displayPrompt();
            return;
        }

        const filePath = defaultNotesPath;
        ensureFile(filePath);
        const raw = fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8').trim() : '';

        // decide existing notes to carry forward into encryption
        let notesToEncrypt = [];
        let parsed = null;
        try { parsed = raw ? JSON.parse(raw) : null; } catch (e) { parsed = null; }

        if (parsed && parsed.salt && parsed.iv && parsed.data) {
            // file already encrypted -> require current session password to decrypt before re-encrypting
            if (!password) {
                console.log('File is already encrypted. Provide current password with .getPassword before setting a new password.');
                this.displayPrompt();
                return;
            }
            try {
                const decrypted = decryptData(raw, password);
                if (Array.isArray(decrypted)) notesToEncrypt = decrypted;
                else if (typeof decrypted === 'string' && decrypted.trim()) notesToEncrypt = decrypted.split('\n').map(l => l.trim()).filter(Boolean);
                else notesToEncrypt = [];
            } catch (err) {
                console.log('Current session password does not decrypt the file. Cannot set new password.');
                this.displayPrompt();
                return;
            }
        } else {
            // plaintext file -> read lines
            notesToEncrypt = raw ? raw.split('\n').map(l => l.trim()).filter(Boolean) : [];
        }

        try {
            const encrypted = encryptData(notesToEncrypt, newPassword);
            fs.writeFileSync(filePath, encrypted, 'utf8');
            // set session password so subsequent operations use it
            password = newPassword;
            console.log(`Password set and ${path.basename(filePath)} encrypted (${notesToEncrypt.length} notes).`);
        } catch (err) {
            console.log('Failed to encrypt file:', (err && err.message) || err);
        }

        this.displayPrompt();
    }
});

ajinotes.defineCommand('listFile', {
    help: 'List all note files in the notes directory: .listFile',
    action() {
        try {
            ensureDir(notesDir);
            const entries = fs.readdirSync(notesDir, { withFileTypes: true });
            const files = entries.filter(e => e.isFile()).map(e => e.name);

            if (files.length === 0) {
                console.log(`No note files found in ${notesDir}`);
                this.displayPrompt();
                return;
            }

            console.log(`Note files in ${notesDir}:`);
            files.forEach((name) => {
                const filePath = path.join(notesDir, name);
                const encMark = isEncryptedFile(filePath) ? '[enc]' : '     ';
                const selMark = name === selectedNotesFile ? '*' : ' ';
                console.log(`${selMark} ${encMark} ${name}`);
            });
        } catch (err) {
            console.log('Failed to list files:', err.message || err);
        }
        this.displayPrompt();
    }
});

ajinotes.defineCommand('lf', {
    help: 'Alias for .listFile',
    action() { this.commands.listFile.action.call(this); }
});

function prompt(query) {
    return new Promise((resolve) => {
        const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
        rl.question(query, (answer) => { rl.close(); resolve(answer); });
    });
}

ajinotes.defineCommand('deleteFile', {
    help: 'Delete a note file: .deleteFile <filename> (asks for confirmation; will require password if file is encrypted)',
    async action(fileName) {
        const name = (fileName || '').trim();
        if (!name) {
            console.log('Provide filename. Usage: .deleteFile <filename>');
            this.displayPrompt();
            return;
        }

        const filePath = path.join(notesDir, name);
        if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
            console.log('File not found:', name);
            this.displayPrompt();
            return;
        }

        // If encrypted, require password confirmation before allowing deletion
        if (isEncryptedFile(filePath)) {
            try {
                const supplied = (await promptHidden('Password for file: ')).trim();
                if (!verifyPasswordForFile(filePath, supplied)) {
                    console.log('Incorrect password. Aborting delete.');
                    this.displayPrompt();
                    return;
                }
            } catch (err) {
                console.log('Failed to read password. Aborting.');
                this.displayPrompt();
                return;
            }
        }

        const answer = (await prompt(`Delete "${name}"? Type "yes" to confirm: `)).trim().toLowerCase();
        if (answer !== 'yes') {
            console.log('Aborted.');
            this.displayPrompt();
            return;
        }

        try {
            fs.unlinkSync(filePath);
            console.log('Deleted', name);

            // if the deleted file was the selected notes file, switch to default
            if (selectedNotesFile === name) {
                selectedNotesFile = 'defaultNotes';
                defaultNotesPath = path.join(notesDir, selectedNotesFile);
                ensureFile(defaultNotesPath);
                console.log('Switched to', selectedNotesFile);
            }
        } catch (err) {
            console.log('Failed to delete file:', err.message || err);
        }

        this.displayPrompt();
    }
});


ajinotes.defineCommand('df', {
    help: 'Alias for .deleteFile',
    action(fileName) { this.commands.deleteFile.action.call(this, fileName); }
});

ajinotes.on('exit', () => {
    console.log('Exiting AJI Note App REPL. Goodbye!');
    process.exit();
});

ajinotes.commands.help.action.call(ajinotes);