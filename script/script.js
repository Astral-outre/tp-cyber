/**
 * ============================================================
 *  cipher.js — VigShift+ Encryption Module
 *  Algorithme custom combinant :
 *    1. Vigenère Unicode  (décalage par clé cyclée)
 *    2. Décalage pos.     (index * 3 ajouté au code point)
 *    3. Inversion         (tableau de points inversé)
 *    4. Base64            (encodage UTF-8 → Base64)
 * ============================================================
 */

'use strict';


/* ════════════════════════════════════════════════════════════
   SECTION 1 — Utilitaires Unicode & Base64
════════════════════════════════════════════════════════════ */

/**
 * Convertit une chaîne en tableau de code points Unicode.
 * Utilise le spread [...str] pour gérer correctement les
 * emojis et caractères hors-BMP (surrogates pairs).
 *
 * Exemple : toCodePoints("A") → [65, 128512]
 *
 * @param {string} str — Chaîne source
 * @returns {number[]}  — Tableau de code points
 */
const toCodePoints = (str) => [...str].map(c => c.codePointAt(0));

/**
 * Reconvertit un tableau de code points en chaîne lisible.
 * Utilise String.fromCodePoint pour supporter tout l'Unicode.
 *
 * Exemple : fromCodePoints([65, 128512]) → "A"
 *
 * @param {number[]} points — Tableau de code points
 * @returns {string}
 */
const fromCodePoints = (points) => points.map(p => String.fromCodePoint(p)).join('');

/**
 * Encode une chaîne en Base64 en passant par un encodage UTF-8.
 * Contrairement à btoa() natif, cette version gère correctement
 * les caractères multi-octets (accents, emojis, etc.).
 *
 * Flux : string → TextEncoder (UTF-8 bytes) → binary string → btoa()
 *
 * @param {string} str — Chaîne à encoder
 * @returns {string}    — Chaîne Base64
 */
const toBase64 = (str) => {
  // Encode la chaîne en bytes UTF-8
  const bytes = new TextEncoder().encode(str);

  // Convertit les bytes en chaîne binaire compatible btoa()
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);

  return btoa(binary);
};

/**
 * Décode une chaîne Base64 en texte UTF-8.
 * Opération inverse de toBase64().
 *
 * Flux : Base64 → atob() → binary string → Uint8Array → TextDecoder
 *
 * @param {string} b64 — Chaîne Base64 à décoder
 * @returns {string}    — Chaîne UTF-8 d'origine
 */
const fromBase64 = (b64) => {
  // Décode le Base64 en chaîne binaire brute
  const binary = atob(b64);

  // Convertit la chaîne binaire en tableau d'octets
  const bytes = Uint8Array.from(binary, c => c.charCodeAt(0));

  // Décode les octets UTF-8 en chaîne JavaScript
  return new TextDecoder().decode(bytes);
};

