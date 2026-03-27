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

/* ════════════════════════════════════════════════════════════
   SECTION 2 — Algorithme (chiffrement / déchiffrement)
════════════════════════════════════════════════════════════ */

/**
 * CHIFFREMENT — Transforme un message clair en texte chiffré (Base64).
 *
 * Étapes dans l'ordre :
 *   1. Vigenère Unicode : cp += cle[i % cle.length]  (décalage par clé)
 *   2. Décalage pos.    : cp += i * 3                 (décalage par position)
 *   3. Inversion        : array.reverse()
 *   4. Base64           : toBase64(fromCodePoints(reversed))
 *
 * @param {string} texte — Message en clair (supporte tout l'Unicode)
 * @param {string} cle   — Clé secrète (au moins 1 caractère)
 * @returns {string}      — Message chiffré encodé en Base64
 */
const chiffrerMessage = (texte, cle) => {
  // Convertit le message et la clé en tableaux de code points
  const points    = toCodePoints(texte);
  const clePoints = toCodePoints(cle);

  // ── Étapes 1 & 2 : Vigenère Unicode + décalage positionnel ──
  const shifted = points.map((cp, i) => {
    const vigShift = clePoints[i % clePoints.length]; // clé cyclée
    const posShift = i * 3;                           // décalage unique par position
    return cp + vigShift + posShift;                  // nouveau code point décalé
  });

  // ── Étape 3 : Inversion du tableau de code points ──
  const reversed = shifted.reverse();

  // ── Étape 4 : Reconversion en chaîne puis encodage Base64 ──
  return toBase64(fromCodePoints(reversed));
};

/**
 * DÉCHIFFREMENT — Reconstruit le message original depuis le texte chiffré.
 *
 * Étapes en ordre INVERSE du chiffrement :
 *   4. Décodage Base64  : fromBase64()
 *   3. Inversion        : array.reverse()  (retrouve l'ordre original)
 *   2. Retrait pos.     : cp -= i * 3
 *   1. Vigenère inverse : cp -= cle[i % cle.length]
 *
 *     Une mauvaise clé produira un texte corrompu sans lever d'exception.
 *     La validation visuelle est assurée côté UI.
 *
 * @param {string} texteChiffre — Texte chiffré en Base64
 * @param {string} cle          — Clé secrète utilisée lors du chiffrement
 * @returns {string}             — Message en clair original
 */
const dechiffrerMessage = (texteChiffre, cle) => {
  // ── Étape 4 inverse : décodage Base64 → chaîne ──
  const decoded = fromBase64(texteChiffre);
  const clePoints = toCodePoints(cle);

  // ── Étape 3 inverse : inversion pour retrouver l'ordre du chiffrement ──
  const reversed = toCodePoints(decoded).reverse();

  // ── Étapes 2 & 1 inverses : retrait décalage pos. + Vigenère inverse ──
  const original = reversed.map((cp, i) => {
    const vigShift = clePoints[i % clePoints.length]; // même clé cyclée
    const posShift = i * 3;                           // même calcul de position
    return cp - vigShift - posShift;                  // on soustrait ce qui a été ajouté
  });

  return fromCodePoints(original);
};


