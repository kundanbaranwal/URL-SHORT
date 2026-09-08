// Base62 alphabet: 0-9, a-z, A-Z (62 characters total)
const ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
const BASE = ALPHABET.length; // 62

/**
 * Encodes a positive integer (e.g. an auto-incrementing DB id) into a
 * short Base62 string.
 *
 * Why this instead of Math.random()?
 * - It's collision-free by construction: two different ids can never
 *   produce the same code, so we never need a "check if code exists,
 *   retry if not" loop under load.
 * - It's compact: id 1,000,000 becomes just "4c92" (4 chars) instead of
 *   needing a long random string to keep collision probability low.
 * - It's still not easily guessable in sequence when combined with a
 *   starting offset, unlike exposing the raw numeric id in the URL.
 */
function encode(num) {
  if (num === 0) return ALPHABET[0];
  let encoded = "";
  while (num > 0) {
    encoded = ALPHABET[num % BASE] + encoded;
    num = Math.floor(num / BASE);
  }
  return encoded;
}

function decode(str) {
  let num = 0;
  for (const char of str) {
    num = num * BASE + ALPHABET.indexOf(char);
  }
  return num;
}

module.exports = { encode, decode };
