import crypto from 'crypto';
import fs from 'fs';

const algorithm = 'aes-256-cbc';
const iterations = 100000;

export function deriveKey(password, salt) {
    return crypto.pbkdf2Sync(password, salt, iterations, 32, 'sha256');
}

export function encryptData(data, password) {
    const salt = crypto.randomBytes(16);
    const key = deriveKey(password, salt);
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(algorithm, key, iv);

    const encrypted = Buffer.concat([
        cipher.update(JSON.stringify(data), 'utf8'),
        cipher.final(),
    ]);

    return JSON.stringify({
        salt: salt.toString('hex'),
        iv: iv.toString('hex'),
        data: encrypted.toString('hex'),
    });
}

export function decryptData(encryptedJSON, password) {
    const { salt, iv, data } = JSON.parse(encryptedJSON);
    const key = deriveKey(password, Buffer.from(salt, 'hex'));
    const decipher = crypto.createDecipheriv(algorithm, key, Buffer.from(iv, 'hex'));

    const decrypted = Buffer.concat([
        decipher.update(Buffer.from(data, 'hex')),
        decipher.final(),
    ]);

    return JSON.parse(decrypted.toString('utf8'));
}