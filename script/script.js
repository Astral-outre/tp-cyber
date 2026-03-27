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


/* ════════════════════════════════════════════════════════════
   SECTION 3 — Utilitaire UI (Toast)
════════════════════════════════════════════════════════════ */

/**
 * Affiche une notification toast temporaire en bas à droite.
 * La classe CSS `.visible` déclenche l'animation d'apparition.
 * Un timer masque automatiquement le toast après 3 secondes.
 *
 * @param {string} message        — Texte à afficher
 * @param {'success'|'error'|''} type — Variante colorée (optionnel)
 */
const showToast = (message, type = '') => {
  const toast = document.getElementById('toast');

  toast.textContent = message;
  toast.className = `toast visible ${type}`; // applique les classes de style

  // Annule un éventuel timer précédent pour éviter la superposition
  clearTimeout(toast._timer);

  // Cache le toast après 3 secondes
  toast._timer = setTimeout(() => {
    toast.className = 'toast'; // retire .visible → déclenche l'animation de sortie
  }, 3000);
};
/*════════════════════════════════════════════════════════════
   SECTION 4 â€” Initialisation et gestion des Ã©vÃ©nements DOM
════════════════════════════════════════════════════════════ */

// Attend que le DOM soit entiÃ¨rement chargÃ© avant de chercher les Ã©lÃ©ments
document.addEventListener('DOMContentLoaded', () => {

  /* â”€â”€ RÃ©cupÃ©ration des Ã©lÃ©ments du DOM â”€â”€ */
  const keyInput        = document.getElementById('keyInput');        // champ clÃ©
  const plainText       = document.getElementById('plainText');       // textarea message clair
  const cipherText      = document.getElementById('cipherText');      // textarea message chiffrÃ©
  const encryptBtn      = document.getElementById('encryptBtn');      // bouton Chiffrer
  const decryptBtn      = document.getElementById('decryptBtn');      // bouton DÃ©chiffrer
  const resultSection   = document.getElementById('resultSection');   // section rÃ©sultat (cachÃ©e)
  const decryptedResult = document.getElementById('decryptedResult'); // div rÃ©sultat dÃ©chiffrÃ©
  const infoToggle      = document.getElementById('infoToggle');      // bouton toggle accordÃ©on
  const infoContent     = document.getElementById('infoContent');     // contenu accordÃ©on


  /* â”€â”€ AccordÃ©on : affiche/masque l'explication de l'algorithme â”€â”€ */
  infoToggle.addEventListener('click', () => {
    // Lit l'Ã©tat courant depuis l'attribut ARIA (accessibilitÃ©)
    const expanded = infoToggle.getAttribute('aria-expanded') === 'true';

    // Inverse l'Ã©tat
    infoToggle.setAttribute('aria-expanded', String(!expanded));

    // L'attribut HTML `hidden` gÃ¨re la visibilitÃ© sans CSS supplÃ©mentaire
    infoContent.hidden = expanded;
  });


  /* â”€â”€ Bouton Chiffrer â”€â”€ */
  encryptBtn.addEventListener('click', () => {
    const message = plainText.value.trim(); // rÃ©cupÃ¨re et nettoie le message
    const cle     = keyInput.value.trim();  // rÃ©cupÃ¨re et nettoie la clÃ©

    // Validation : message vide
    if (!message) {
      showToast(' Veuillez saisir un message.', 'error');
      return;
    }

    // Validation : clÃ© vide (nÃ©cessaire pour l'algorithme)
    if (!cle) {
      showToast('ï¸ Veuillez entrer une clÃ© secrÃ¨te.', 'error');
      return;
    }

    try {
      // Appel de l'algorithme de chiffrement
      const resultat = chiffrerMessage(message, cle);

      // Affiche le rÃ©sultat dans le textarea readonly
      cipherText.value = resultat;

      // Masque l'Ã©ventuel rÃ©sultat de dÃ©chiffrement prÃ©cÃ©dent
      resultSection.hidden = true;
      decryptedResult.textContent = '';

      showToast(' Message chiffrÃ© avec succÃ¨s !', 'success');

    } catch (err) {
      // Capture les erreurs inattendues (ex. : caractÃ¨re invalide)
      showToast(' Erreur lors du chiffrement.', 'error');
      console.error('[VigShift+] Erreur chiffrement :', err);
    }
  });


  /* â”€â”€ Bouton DÃ©chiffrer â”€â”€ */
  decryptBtn.addEventListener('click', () => {
    const chiffre = cipherText.value.trim(); // rÃ©cupÃ¨re le texte chiffrÃ©
    const cle     = keyInput.value.trim();   // rÃ©cupÃ¨re la clÃ©

    // Validation : rien Ã  dÃ©chiffrer
    if (!chiffre) {
      showToast(' Aucun message chiffrÃ© Ã  dÃ©chiffrer.', 'error');
      return;
    }

    // Validation : clÃ© manquante
    if (!cle) {
      showToast(' Veuillez entrer la clÃ© secrÃ¨te.', 'error');
      return;
    }

    try {
      // Appel de l'algorithme de dÃ©chiffrement
      const resultat = dechiffrerMessage(chiffre, cle);

      // Injecte le rÃ©sultat dans la div de vÃ©rification
      decryptedResult.textContent = resultat;

      // Rend visible la section rÃ©sultat
      resultSection.hidden = false;

      showToast(' Message dÃ©chiffrÃ© avec succÃ¨s !', 'success');

    } catch (err) {
      // Erreur frÃ©quente : Base64 invalide si la clÃ© est mauvaise
      showToast(' ClÃ© incorrecte ou message corrompu.', 'error');
      console.error('[VigShift+] Erreur dÃ©chiffrement :', err);
    }
  });


  /* â”€â”€ Raccourcis clavier : Ctrl + EntrÃ©e â”€â”€ */

  // Dans le textarea message clair â†’ dÃ©clenche le chiffrement
  plainText.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.key === 'Enter') encryptBtn.click();
  });

  // Dans le textarea message chiffrÃ© â†’ dÃ©clenche le dÃ©chiffrement
  cipherText.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.key === 'Enter') decryptBtn.click();
  });

});