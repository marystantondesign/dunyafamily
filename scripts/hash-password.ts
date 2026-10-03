import { hashPassword } from "../lib/password";

const pw = process.argv[2];
if (!pw) {
  console.error('Usage: npm run hash-password -- "the password"');
  process.exit(1);
}
console.log(hashPassword(pw));
