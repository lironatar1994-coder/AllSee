// Creates (or replaces) the AllSee admin password.
//   node tools/set-password.mjs          random password
//   node tools/set-password.mjs --ask    type your own
// Writes .data/admin.env (hash + session secret, read by the server and uploaded by deploy.ps1)
// and .data/admin-password.txt (the password itself, kept only on this computer).
// Changing the password signs out every open session. Run .\deploy.ps1 -Target Prod to apply it live.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline/promises';
import { fileURLToPath } from 'node:url';

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '.data');
fs.mkdirSync(dir, { recursive: true });

let password;
if (process.argv.includes('--ask')) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  password = (await rl.question('New password (at least 10 characters): ')).trim();
  rl.close();
  if (password.length < 10) { console.error('Too short. Nothing changed.'); process.exit(1); }
} else {
  password = crypto.randomBytes(12).toString('base64url');
}

const salt = crypto.randomBytes(16);
const hash = crypto.scryptSync(password.normalize('NFC'), salt, 32);
const env = [
  `ALLSEE_PASSWORD_HASH=scrypt:${salt.toString('base64')}:${hash.toString('base64')}`,
  `ALLSEE_SECRET=${crypto.randomBytes(32).toString('base64url')}`,
  '',
].join('\n');
fs.writeFileSync(path.join(dir, 'admin.env'), env, { mode: 0o600 });
fs.writeFileSync(path.join(dir, 'admin-password.txt'), `AllSee admin password (https://lawebs.co.il/allsee/admin)\n${password}\n`, { mode: 0o600 });
console.log(`Saved. The password is in ${path.join(dir, 'admin-password.txt')}`);
