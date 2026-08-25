'use strict';

/* ---------- Persistance ---------- */

const STORAGE_KEY = 'stockPlanches:v9';
const HISTORY_LIMIT = 6;

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { records: [], history: [], currentLongueur: null, currentEpaisseur: null, epaisseurDual: false, pieceDisplayMode: 'pieces', chevronEpaisseur: null, grade27Open: false };
    const parsed = JSON.parse(raw);
    return {
      records: Array.isArray(parsed.records) ? parsed.records : [],
      history: Array.isArray(parsed.history) ? parsed.history : [],
      currentLongueur: parsed.currentLongueur ?? null,
      currentEpaisseur: parsed.currentEpaisseur ?? null,
      epaisseurDual: parsed.epaisseurDual === true,
      pieceDisplayMode: parsed.pieceDisplayMode === 'converted' ? 'converted' : 'pieces',
      chevronEpaisseur: parsed.chevronEpaisseur ?? null,
      grade27Open: parsed.grade27Open === true,
    };
  } catch (e) {
    return { records: [], history: [], currentLongueur: null, currentEpaisseur: null, epaisseurDual: false, pieceDisplayMode: 'pieces', chevronEpaisseur: null, grade27Open: false };
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    records: state.records,
    history: state.history,
    currentLongueur: state.currentLongueur,
    currentEpaisseur: state.currentEpaisseur,
    epaisseurDual: state.epaisseurDual,
    pieceDisplayMode: state.pieceDisplayMode,
    chevronEpaisseur: state.chevronEpaisseur,
    grade27Open: state.grade27Open,
  }));
}

const state = loadState();

/* ---------- Formatage ---------- */

function formatLongueur(value) {
  const intPart = Math.trunc(value);
  const fracRaw = Math.round((value - intPart) * 100);
  if (fracRaw === 0) return `${intPart}m`;
  return `${intPart}m${String(fracRaw).padStart(2, '0')}`;
}

function formatNumberFR(value) {
  if (Number.isInteger(value)) return String(value);
  return String(value).replace('.', ',');
}

/* ---------- Config des boutons ---------- */

const LONGUEUR_VALUES = [3, 3.5, 4, 4.5, 5, 5.5, 6];

const EPAISSEUR_SINGLE_VALUES = [18, 27, 38, 50];

// Bouton combiné : sur la page pièces/couche, permet de choisir entre
// 63 et 75 sans revenir sur la page épaisseur (voir buildPiecesGridDual).
const EPAISSEUR_DUAL_VALUES = [63, 75];
const EPAISSEUR_DUAL_LABEL = '63/75';

// "5." (avec un point) est un libellé distinct de "5", demandé tel quel —
// ce n'est pas 5,5. Le rang sert uniquement au tri croissant et place "5."
// juste après "5" puisque les deux représentent la même quantité.
const PIECES_OPTIONS = [
  { key: '5', label: '5', rank: 5 },
  { key: '5.', label: '5.', rank: 5.01 },
  { key: '6', label: '6', rank: 6 },
  { key: '7', label: '7', rank: 7 },
  { key: '10', label: '10', rank: 10 },
  { key: '11', label: '11', rank: 11 },
];

// Affichage alternatif des boutons pièces/couche (bouton en haut à droite
// de la page 2). Purement visuel : l'enregistrement, l'historique et les
// résultats continuent toujours d'utiliser la valeur pièces/couche réelle.
const PIECES_DISPLAY_CONVERSION = {
  '5': '200',
  '5.': '225',
  '6': '175',
  '7': '150',
  '10': '110',
  '11': '100',
};

function pieceButtonLabel(option) {
  if (state.pieceDisplayMode === 'converted') {
    return PIECES_DISPLAY_CONVERSION[option.key] ?? option.label;
  }
  return option.label;
}

// Chevrons : raccourci depuis la page longueur. Chaque section fixe une
// épaisseur et un pièces/couche de 14 ; seule la longueur reste à choisir,
// sur une page dédiée qui reprend les boutons de la page longueur.
const CHEVRON_SECTIONS = [
  { label: '63x75', ep: 63 },
  { label: '75x75', ep: 75 },
];
const CHEVRON_PIECES = { key: '14', label: '14', rank: 14 };

// Page pc, épaisseur 27 uniquement : bouton "27qual" ouvrant pagegrade27,
// qui fixe le pièces/couche selon 3 colonnes qualité et propose 3 grades
// (3 / 3A / 3B) par colonne ; le choix enregistre directement.
const GRADE27_EPAISSEUR = 27;
const GRADE27_QUALITIES = [
  { key: '150', label: '150 qual', pieces: { key: '7', label: '7', rank: 7 } },
  { key: '200', label: '200 qual', pieces: { key: '5', label: '5', rank: 5 } },
  { key: '250', label: '250 qual', pieces: { key: '4', label: '4', rank: 4 } },
  { key: '305', label: '305 qual', pieces: { key: '3', label: '3', rank: 3 } },
];
const GRADE27_OPTIONS = [
  { key: '3', label: '3' },
  { key: '3A', label: '3A' },
  { key: '3B', label: '3B' },
];

// Page pc, épaisseur 38 uniquement : bouton supplémentaire "63." — un
// libellé distinct (comme "5.") qui correspond en réalité à 16 pièces/couche.
const EP38_EPAISSEUR = 38;
const EP38_EXTRA_PIECES = { key: '63.', label: '63.', rank: 16 };

// Préfixe épaisseur en gris clair sur les boutons d'enregistrement
// (ex. "63 x 5."), pour rappeler l'épaisseur déjà fixée sans revenir en
// arrière. La valeur pièces/couche (ou longueur, ou grade) garde sa
// couleur habituelle.
function setTileEpLabel(btn, ep, label) {
  btn.textContent = '';
  const prefix = document.createElement('span');
  prefix.className = 'tile-ep-prefix';
  prefix.textContent = `${formatNumberFR(ep)} x`;
  const value = document.createElement('span');
  value.textContent = label;
  btn.appendChild(prefix);
  btn.appendChild(value);
}

/* ---------- Références DOM ---------- */

const pages = {
  longueur: document.getElementById('page-longueur'),
  chevronSection: document.getElementById('page-chevron-section'),
  lgChevrons: document.getElementById('page-lg-chevrons'),
  epaisseur: document.getElementById('page-epaisseur'),
  pieces: document.getElementById('page-pieces'),
  grade27: document.getElementById('page-grade27'),
  resultats: document.getElementById('page-resultats'),
};

const gridLongueur = document.getElementById('grid-longueur');
const gridChevronSection = document.getElementById('grid-chevron-section');
const gridLgChevrons = document.getElementById('grid-lg-chevrons');
const lgChevronsMain = document.getElementById('lg-chevrons-main');
const gridEpaisseur = document.getElementById('grid-epaisseur');
const gridPieces = document.getElementById('grid-pieces');
const gridGrade27 = document.getElementById('grid-grade27');
const grade27Sub = document.getElementById('grade27-sub');
const grade27Main = document.getElementById('grade27-main');
let historyPanel = null;
const currentLongueurLabelEpaisseur = document.getElementById('current-longueur-label-epaisseur');
const currentLongueurEpaisseurLabel = document.getElementById('current-longueur-epaisseur-label');
const btnUndoLast = document.getElementById('btn-undo-last');
const btnTogglePiecesDisplay = document.getElementById('btn-toggle-pieces-display');
const resultsBody = document.getElementById('results-body');
const resultsEmptyRow = document.getElementById('results-empty');
const resultsTotal = document.getElementById('results-total');

const modalOverlay = document.getElementById('modal-overlay');
const modalTitle = document.getElementById('modal-title');
const modalHint = document.getElementById('modal-hint');
const modalInput = document.getElementById('modal-input');
const modalConfirm = document.getElementById('modal-confirm');
const modalCancel = document.getElementById('modal-cancel');

const toastEl = document.getElementById('toast');

/* ---------- Navigation ---------- */

function showPage(name) {
  for (const key of Object.keys(pages)) {
    pages[key].hidden = key !== name;
  }
}

function goToLongueur() {
  showPage('longueur');
}

function goToChevronSection() {
  showPage('chevronSection');
}

function goToLgChevrons() {
  lgChevronsMain.textContent = state.chevronEpaisseur !== null
    ? `${formatNumberFR(state.chevronEpaisseur)} mm`
    : '—';
  buildLgChevronsGrid();
  showPage('lgChevrons');
}

function goToEpaisseur() {
  currentLongueurLabelEpaisseur.textContent = state.currentLongueur
    ? formatLongueur(state.currentLongueur)
    : '—';
  showPage('epaisseur');
}

function goToPieces() {
  if (state.currentLongueur === null) {
    currentLongueurEpaisseurLabel.textContent = '—';
  } else if (state.epaisseurDual) {
    currentLongueurEpaisseurLabel.textContent = `${formatLongueur(state.currentLongueur)} · ${EPAISSEUR_DUAL_LABEL} mm`;
  } else if (state.currentEpaisseur !== null) {
    currentLongueurEpaisseurLabel.textContent = `${formatLongueur(state.currentLongueur)} · ${formatNumberFR(state.currentEpaisseur)} mm`;
  } else {
    currentLongueurEpaisseurLabel.textContent = '—';
  }
  buildPiecesGrid();
  showPage('pieces');
}

function goToGrade27() {
  grade27Sub.textContent = state.currentLongueur !== null ? '27mm' : '—';
  grade27Main.textContent = state.currentLongueur !== null ? formatLongueur(state.currentLongueur) : '—';
  showPage('grade27');
}

function openGrade27() {
  state.grade27Open = true;
  saveState();
  goToGrade27();
}

function backFromGrade27() {
  state.grade27Open = false;
  saveState();
  goToPieces();
}

function goToResultats() {
  renderResults();
  showPage('resultats');
}

/* ---------- Toast ---------- */

let toastTimer = null;
function showToast(message) {
  toastEl.textContent = message;
  toastEl.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toastEl.hidden = true; }, 1100);
}

/* ---------- Modale "Autre" ---------- */

let modalResolve = null;

function openModal({ title, hint }) {
  modalTitle.textContent = title;
  modalHint.textContent = hint;
  modalInput.value = '';
  modalOverlay.hidden = false;
  setTimeout(() => modalInput.focus(), 50);
  return new Promise((resolve) => { modalResolve = resolve; });
}

function closeModal(value) {
  modalOverlay.hidden = true;
  if (modalResolve) {
    modalResolve(value);
    modalResolve = null;
  }
}

modalCancel.addEventListener('click', () => closeModal(null));
modalOverlay.addEventListener('click', (e) => {
  if (e.target === modalOverlay) closeModal(null);
});
modalConfirm.addEventListener('click', () => {
  const value = parseFloat(modalInput.value.replace(',', '.'));
  if (!isFinite(value) || value <= 0) {
    modalInput.focus();
    return;
  }
  closeModal(value);
});
modalInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') modalConfirm.click();
});

/* ---------- Modale de confirmation (remplace window.confirm, bloqué
   dans certains contextes sandboxés comme l'aperçu embarqué) ---------- */

const confirmOverlay = document.getElementById('confirm-overlay');
const confirmTitle = document.getElementById('confirm-title');
const confirmMessage = document.getElementById('confirm-message');
const confirmCancelBtn = document.getElementById('confirm-cancel');
const confirmOkBtn = document.getElementById('confirm-ok');

let confirmResolve = null;

function openConfirm({ title, message, confirmLabel }) {
  confirmTitle.textContent = title;
  confirmMessage.textContent = message;
  confirmOkBtn.textContent = confirmLabel || 'Confirmer';
  confirmOverlay.hidden = false;
  return new Promise((resolve) => { confirmResolve = resolve; });
}

function closeConfirm(result) {
  confirmOverlay.hidden = true;
  if (confirmResolve) {
    confirmResolve(result);
    confirmResolve = null;
  }
}

confirmCancelBtn.addEventListener('click', () => closeConfirm(false));
confirmOverlay.addEventListener('click', (e) => {
  if (e.target === confirmOverlay) closeConfirm(false);
});
confirmOkBtn.addEventListener('click', () => closeConfirm(true));

/* ---------- Geste d'enregistrement : tap normal = "normal",
   appui + glissement vers le bas au-delà du seuil = "declasse".
   Le grade se décide au relâchement, selon la position du doigt à ce
   moment (l'utilisateur peut remonter pour annuler avant de lâcher). */

const DECLASSE_DRAG_THRESHOLD = 150;
const DECLASSE_DRAG_RELEASE = 90; // hystérésis pour désarmer en remontant
const DECLASSE_VISUAL_CAP = 22;

function bindRecordGesture(el, onRecord) {
  let pointerId = null;
  let startY = 0;
  let armed = false;

  function setArmed(next) {
    if (next === armed) return;
    armed = next;
    el.classList.toggle('tile-armed', armed);
  }

  function cleanup() {
    el.classList.remove('tile-pressing');
    el.classList.remove('tile-armed');
    el.style.transform = '';
    pointerId = null;
    armed = false;
  }

  el.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    pointerId = e.pointerId;
    startY = e.clientY;
    armed = false;
    el.classList.add('tile-pressing');
    try { el.setPointerCapture(pointerId); } catch (err) { /* ignore */ }
  });

  el.addEventListener('pointermove', (e) => {
    if (pointerId === null || e.pointerId !== pointerId) return;
    const dy = e.clientY - startY;
    if (!armed && dy > DECLASSE_DRAG_THRESHOLD) setArmed(true);
    else if (armed && dy < DECLASSE_DRAG_RELEASE) setArmed(false);
    el.style.transform = `translateY(${Math.max(0, Math.min(dy, DECLASSE_VISUAL_CAP))}px)`;
  });

  el.addEventListener('pointerup', (e) => {
    if (pointerId === null || e.pointerId !== pointerId) return;
    const grade = armed ? 'declasse' : 'normal';
    cleanup();
    onRecord(grade);
  });

  el.addEventListener('pointercancel', (e) => {
    if (pointerId === null || e.pointerId !== pointerId) return;
    cleanup();
  });
}

/* ---------- Construction des grilles ---------- */

function buildLongueurGrid() {
  gridLongueur.innerHTML = '';

  for (const value of LONGUEUR_VALUES) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'tile';
    btn.textContent = formatLongueur(value);
    btn.addEventListener('click', () => selectLongueur(value));
    gridLongueur.appendChild(btn);
  }

  const btnChevrons = document.createElement('button');
  btnChevrons.type = 'button';
  btnChevrons.className = 'tile';
  btnChevrons.textContent = 'Chevrons';
  btnChevrons.addEventListener('click', goToChevronSection);
  gridLongueur.appendChild(btnChevrons);

  const btnAutre = document.createElement('button');
  btnAutre.type = 'button';
  btnAutre.className = 'tile tile-autre tile-full';
  btnAutre.textContent = 'Autre';
  btnAutre.addEventListener('click', async () => {
    const value = await openModal({
      title: 'Longueur personnalisée',
      hint: 'Saisissez la longueur en mètres (ex. 7,25)',
    });
    if (value === null) return;
    selectLongueur(value);
  });
  gridLongueur.appendChild(btnAutre);
}

function selectLongueur(value) {
  state.currentLongueur = value;
  saveState();
  goToEpaisseur();
}

function buildChevronSectionGrid() {
  gridChevronSection.innerHTML = '';
  for (const section of CHEVRON_SECTIONS) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'tile';
    btn.textContent = section.label;
    btn.addEventListener('click', () => selectChevronSection(section));
    gridChevronSection.appendChild(btn);
  }
}

function selectChevronSection(section) {
  state.chevronEpaisseur = section.ep;
  saveState();
  goToLgChevrons();
}

function buildLgChevronsGrid() {
  gridLgChevrons.innerHTML = '';

  for (const value of LONGUEUR_VALUES) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'tile';
    setTileEpLabel(btn, state.chevronEpaisseur, formatLongueur(value));
    bindRecordGesture(btn, (grade) => recordChevronCombination(value, grade));
    gridLgChevrons.appendChild(btn);
  }

  const btnAutre = document.createElement('button');
  btnAutre.type = 'button';
  btnAutre.className = 'tile tile-autre';
  setTileEpLabel(btnAutre, state.chevronEpaisseur, 'Autre');
  bindRecordGesture(btnAutre, async (grade) => {
    const value = await openModal({
      title: 'Longueur personnalisée',
      hint: 'Saisissez la longueur en mètres (ex. 7,25)',
    });
    if (value === null) return;
    recordChevronCombination(value, grade);
  });
  gridLgChevrons.appendChild(btnAutre);
}

function recordChevronCombination(lgValue, grade) {
  recordCombination(CHEVRON_PIECES, state.chevronEpaisseur, lgValue, grade);
}

function buildEpaisseurGrid() {
  gridEpaisseur.innerHTML = '';

  for (const value of EPAISSEUR_SINGLE_VALUES) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'tile';
    btn.textContent = formatNumberFR(value);
    btn.addEventListener('click', () => selectEpaisseur(value));
    gridEpaisseur.appendChild(btn);
  }

  const btnDual = document.createElement('button');
  btnDual.type = 'button';
  btnDual.className = 'tile';
  btnDual.textContent = EPAISSEUR_DUAL_LABEL;
  btnDual.addEventListener('click', () => selectEpaisseurDual());
  gridEpaisseur.appendChild(btnDual);

  const btnAutre = document.createElement('button');
  btnAutre.type = 'button';
  btnAutre.className = 'tile tile-autre';
  btnAutre.textContent = 'Autre';
  btnAutre.addEventListener('click', async () => {
    const value = await openModal({
      title: 'Épaisseur personnalisée',
      hint: 'Saisissez l\'épaisseur en mm',
    });
    if (value === null) return;
    selectEpaisseur(value);
  });
  gridEpaisseur.appendChild(btnAutre);
}

function selectEpaisseur(value) {
  state.currentEpaisseur = value;
  state.epaisseurDual = false;
  saveState();
  goToPieces();
}

function selectEpaisseurDual() {
  state.currentEpaisseur = null;
  state.epaisseurDual = true;
  saveState();
  goToPieces();
}

function buildPiecesGrid() {
  gridPieces.innerHTML = '';
  gridPieces.classList.toggle('grid-4col', state.epaisseurDual);
  gridPieces.classList.toggle('grid-2col', !state.epaisseurDual);

  if (state.epaisseurDual) {
    buildPiecesGridDual();
  } else {
    buildPiecesGridSingle();
  }

  historyPanel = document.createElement('div');
  historyPanel.className = state.epaisseurDual ? 'history-panel tile-full' : 'history-panel';
  historyPanel.setAttribute('aria-live', 'polite');
  gridPieces.appendChild(historyPanel);
  renderHistory();
}

function buildPiecesGridSingle() {
  for (const option of PIECES_OPTIONS) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'tile';
    setTileEpLabel(btn, state.currentEpaisseur, pieceButtonLabel(option));
    bindRecordGesture(btn, (grade) => recordCombination(option, undefined, undefined, grade));
    gridPieces.appendChild(btn);
  }

  const btnAutre = document.createElement('button');
  btnAutre.type = 'button';
  btnAutre.className = 'tile tile-autre';
  setTileEpLabel(btnAutre, state.currentEpaisseur, 'Autre');
  bindRecordGesture(btnAutre, async (grade) => {
    const value = await openModal({
      title: 'Pièces / couche personnalisé',
      hint: 'Saisissez le nombre de pièces par couche',
    });
    if (value === null) return;
    const label = formatNumberFR(value);
    recordCombination({ key: label, label, rank: value }, undefined, undefined, grade);
  });
  gridPieces.appendChild(btnAutre);

  // Spécifique à l'épaisseur 27 : raccourci ouvrant pagegrade27 (voir
  // buildGrade27Grid), en plus de "Autre".
  if (state.currentEpaisseur === GRADE27_EPAISSEUR) {
    const btnQual = document.createElement('button');
    btnQual.type = 'button';
    btnQual.className = 'tile';
    btnQual.textContent = '27qual';
    btnQual.addEventListener('click', openGrade27);
    gridPieces.appendChild(btnQual);
  }

  // Spécifique à l'épaisseur 38 : bouton "63." (16 pièces/couche).
  if (state.currentEpaisseur === EP38_EPAISSEUR) {
    const btnEp38 = document.createElement('button');
    btnEp38.type = 'button';
    btnEp38.className = 'tile';
    setTileEpLabel(btnEp38, state.currentEpaisseur, EP38_EXTRA_PIECES.label);
    bindRecordGesture(btnEp38, (grade) => recordCombination(EP38_EXTRA_PIECES, undefined, undefined, grade));
    gridPieces.appendChild(btnEp38);
  }
}

// Grille 4 colonnes : les 2 premières colonnes pour l'épaisseur 63,
// les 2 dernières pour l'épaisseur 75 — bascule sans repasser par la
// page épaisseur.
function buildPiecesGridDual() {
  for (const ep of EPAISSEUR_DUAL_VALUES) {
    const label = document.createElement('div');
    label.className = 'dual-ep-label';
    label.textContent = `${formatNumberFR(ep)} mm`;
    gridPieces.appendChild(label);
  }

  const pairs = [
    [PIECES_OPTIONS[0], PIECES_OPTIONS[1]],
    [PIECES_OPTIONS[2], PIECES_OPTIONS[3]],
    [PIECES_OPTIONS[4], PIECES_OPTIONS[5]],
  ];

  for (const [left, right] of pairs) {
    for (const option of [left, right]) {
      appendPiecesTile(option, EPAISSEUR_DUAL_VALUES[0]);
    }
    for (const option of [left, right]) {
      appendPiecesTile(option, EPAISSEUR_DUAL_VALUES[1]);
    }
  }

  for (const ep of EPAISSEUR_DUAL_VALUES) {
    const btnAutre = document.createElement('button');
    btnAutre.type = 'button';
    btnAutre.className = 'tile tile-autre tile-half-span';
    setTileEpLabel(btnAutre, ep, 'Autre');
    bindRecordGesture(btnAutre, async (grade) => {
      const value = await openModal({
        title: `Pièces / couche personnalisé — ${formatNumberFR(ep)} mm`,
        hint: 'Saisissez le nombre de pièces par couche',
      });
      if (value === null) return;
      const label = formatNumberFR(value);
      recordCombination({ key: label, label, rank: value }, ep, undefined, grade);
    });
    gridPieces.appendChild(btnAutre);
  }
}

function appendPiecesTile(option, ep) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'tile';
  setTileEpLabel(btn, ep, pieceButtonLabel(option));
  bindRecordGesture(btn, (grade) => recordCombination(option, ep, undefined, grade));
  gridPieces.appendChild(btn);
}

// 3 colonnes qualité (chacune fixant un pièces/couche), 3 lignes de grade
// (3 / 3A / 3B) : les boutons sont créés grade par grade pour que
// l'ordre du DOM place chaque colonne sous son en-tête dans la grille.
function buildGrade27Grid() {
  gridGrade27.innerHTML = '';

  for (const quality of GRADE27_QUALITIES) {
    const label = document.createElement('div');
    label.className = 'dual-ep-label';
    label.textContent = `${quality.label} · ${quality.pieces.label} pcs/couche`;
    gridGrade27.appendChild(label);
  }

  for (const option of GRADE27_OPTIONS) {
    for (const quality of GRADE27_QUALITIES) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'tile';
      setTileEpLabel(btn, GRADE27_EPAISSEUR, option.label);
      bindRecordGesture(btn, (grade) => recordCombination(quality.pieces, GRADE27_EPAISSEUR, undefined, grade, option));
      gridGrade27.appendChild(btn);
    }
  }
}

/* ---------- Historique des derniers enregistrements ---------- */

function renderHistory() {
  btnUndoLast.disabled = state.history.length === 0;
  if (!historyPanel) return;
  if (state.history.length === 0) {
    historyPanel.innerHTML = '<p class="history-empty">Aucun enregistrement</p>';
    return;
  }
  // state.history est stocké du plus récent au plus ancien (pratique pour
  // le retrait via undoLastEntry) ; on l'inverse à l'affichage pour que le
  // plus récent apparaisse tout en bas, comme un journal qui s'allonge.
  historyPanel.innerHTML = [...state.history]
    .reverse()
    .map((h) => `<p class="history-line">${formatLongueur(h.lg)} ${formatNumberFR(h.ep)} - ${h.pcLabel}${gradeSuffixText(h)}</p>`)
    .join('');
}

// Libellé de grade affiché en complément (historique, toast, résultats) :
// - qualityGrade présent (page pc, épaisseur 27) → "3", "3A Déclassé", etc.
// - sinon, seul le drapeau Déclassé compte → " · Déclassé" ou rien.
function gradeSuffixText(record) {
  if (record.qualityGrade) {
    return record.declasse ? ` · ${record.qualityGradeLabel} Déclassé` : ` · ${record.qualityGradeLabel}`;
  }
  return record.declasse ? ' · Déclassé' : '';
}

/* ---------- Enregistrement des combinaisons ---------- */

function recordCombination(pieces, epOverride, lgOverride, grade, qualityGrade) {
  const ep = epOverride !== undefined ? epOverride : state.currentEpaisseur;
  const lg = lgOverride !== undefined ? lgOverride : state.currentLongueur;
  const declasse = grade === 'declasse';
  const qKey = qualityGrade ? qualityGrade.key : null;
  const qLabel = qualityGrade ? qualityGrade.label : null;
  if (lg === null || ep === null) {
    goToLongueur();
    return;
  }
  const existing = state.records.find(
    (r) => r.lg === lg && r.ep === ep && r.pcKey === pieces.key && r.declasse === declasse && r.qualityGrade === qKey
  );
  if (existing) {
    existing.nb += 1;
  } else {
    state.records.push({
      lg, ep, pcKey: pieces.key, pcLabel: pieces.label, pcRank: pieces.rank,
      declasse, qualityGrade: qKey, qualityGradeLabel: qLabel, nb: 1,
    });
  }
  const historyEntry = { lg, ep, pcKey: pieces.key, pcLabel: pieces.label, declasse, qualityGrade: qKey, qualityGradeLabel: qLabel };
  state.history.unshift(historyEntry);
  state.history = state.history.slice(0, HISTORY_LIMIT);
  saveState();
  renderHistory();
  const nb = existing ? existing.nb : 1;
  showToast(`${formatLongueur(lg)} · ${formatNumberFR(ep)}mm · ${pieces.label} pièces/couche — Nb : ${nb}${gradeSuffixText(historyEntry)}`);
}

function undoLastEntry() {
  if (state.history.length === 0) return;
  const last = state.history.shift();
  const existing = state.records.find(
    (r) => r.lg === last.lg && r.ep === last.ep && r.pcKey === last.pcKey && r.declasse === last.declasse && r.qualityGrade === last.qualityGrade
  );
  if (existing) {
    existing.nb -= 1;
    if (existing.nb <= 0) {
      state.records = state.records.filter((r) => r !== existing);
    }
  }
  saveState();
  renderHistory();
  showToast(`Annulé : ${formatLongueur(last.lg)} · ${formatNumberFR(last.ep)}mm · ${last.pcLabel} pièces/couche${gradeSuffixText(last)}`);
}

/* ---------- Résultats ---------- */

function getSortedRecords() {
  return [...state.records].sort((a, b) => {
    if (a.lg !== b.lg) return a.lg - b.lg;
    if (a.ep !== b.ep) return a.ep - b.ep;
    if (a.pcRank !== b.pcRank) return a.pcRank - b.pcRank;
    if (a.pcLabel !== b.pcLabel) return a.pcLabel.localeCompare(b.pcLabel);
    const qa = a.qualityGrade || '';
    const qb = b.qualityGrade || '';
    if (qa !== qb) return qa.localeCompare(qb);
    return (a.declasse ? 1 : 0) - (b.declasse ? 1 : 0);
  });
}

function renderResults() {
  const sorted = getSortedRecords();

  resultsBody.innerHTML = '';

  if (sorted.length === 0) {
    resultsBody.appendChild(resultsEmptyRow);
    resultsTotal.textContent = '0';
    return;
  }

  let total = 0;
  for (const record of sorted) {
    total += record.nb;
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${formatLongueur(record.lg)}</td>
      <td>${formatNumberFR(record.ep)}</td>
      <td>${record.pcLabel}</td>
      <td>${renderGradeCell(record)}</td>
      <td>${record.nb}</td>
    `;
    resultsBody.appendChild(tr);
  }
  resultsTotal.textContent = String(total);
}

// Libellé de grade en texte brut (sans balisage), réutilisé pour la cellule
// HTML du tableau et pour l'export XLSX.
function gradeCellText(record) {
  if (record.qualityGrade) {
    return record.declasse ? `${record.qualityGradeLabel} Déclassé` : record.qualityGradeLabel;
  }
  return record.declasse ? 'Déclassé' : '';
}

function renderGradeCell(record) {
  const text = gradeCellText(record);
  if (!text) return '';
  const cls = record.declasse ? 'grade-badge' : 'grade-plain';
  return `<span class="${cls}">${text}</span>`;
}

/* ---------- Export XLSX ----------
   Génère un classeur .xlsx minimal (OOXML) directement en JS, sans
   dépendance externe : un ZIP non compressé ("store") contenant les
   parties XML requises, avec chaînes en inlineStr (pas de sharedStrings).
*/

function crc32(bytes) {
  if (!crc32.table) {
    const table = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      table[n] = c >>> 0;
    }
    crc32.table = table;
  }
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < bytes.length; i++) {
    crc = crc32.table[(crc ^ bytes[i]) & 0xFF] ^ (crc >>> 8);
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function u16(n) { return [n & 0xFF, (n >> 8) & 0xFF]; }
function u32(n) { return [n & 0xFF, (n >> 8) & 0xFF, (n >> 16) & 0xFF, (n >>> 24) & 0xFF]; }

function buildZip(files) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;
  const encoder = new TextEncoder();

  for (const file of files) {
    const nameBytes = encoder.encode(file.name);
    const data = file.data;
    const crc = crc32(data);

    const localHeader = new Uint8Array([
      ...u32(0x04034b50), ...u16(20), ...u16(0), ...u16(0), ...u16(0), ...u16(0),
      ...u32(crc), ...u32(data.length), ...u32(data.length),
      ...u16(nameBytes.length), ...u16(0), ...nameBytes,
    ]);
    localParts.push(localHeader, data);

    const centralHeader = new Uint8Array([
      ...u32(0x02014b50), ...u16(20), ...u16(20), ...u16(0), ...u16(0), ...u16(0), ...u16(0),
      ...u32(crc), ...u32(data.length), ...u32(data.length),
      ...u16(nameBytes.length), ...u16(0), ...u16(0), ...u16(0), ...u16(0), ...u32(0),
      ...u32(offset), ...nameBytes,
    ]);
    centralParts.push(centralHeader);

    offset += localHeader.length + data.length;
  }

  const centralDirStart = offset;
  const centralDirSize = centralParts.reduce((sum, part) => sum + part.length, 0);

  const eocd = new Uint8Array([
    ...u32(0x06054b50), ...u16(0), ...u16(0),
    ...u16(files.length), ...u16(files.length),
    ...u32(centralDirSize), ...u32(centralDirStart), ...u16(0),
  ]);

  return new Blob([...localParts, ...centralParts, eocd], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

function xmlEscape(str) {
  return String(str).replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;',
  }[ch]));
}

function colLetter(index) {
  let n = index + 1;
  let s = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    s = String.fromCharCode(65 + rem) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

function buildSheetXml(rows) {
  let rowsXml = '';
  rows.forEach((row, rIdx) => {
    const r = rIdx + 1;
    let cellsXml = '';
    row.forEach((cell, cIdx) => {
      const ref = `${colLetter(cIdx)}${r}`;
      if (cell.type === 'n') {
        cellsXml += `<c r="${ref}"><v>${cell.value}</v></c>`;
      } else {
        cellsXml += `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${xmlEscape(cell.value)}</t></is></c>`;
      }
    });
    rowsXml += `<row r="${r}">${cellsXml}</row>`;
  });
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${rowsXml}</sheetData></worksheet>`;
}

function exportResultsXlsx() {
  if (state.records.length === 0) {
    showToast('Aucune donnée à exporter');
    return;
  }

  const rows = [[
    { type: 's', value: 'Lg' },
    { type: 's', value: 'Ep (mm)' },
    { type: 's', value: 'Pièces/Couche' },
    { type: 's', value: 'Grade' },
    { type: 's', value: 'Nb' },
  ]];
  for (const record of getSortedRecords()) {
    rows.push([
      { type: 's', value: formatLongueur(record.lg) },
      { type: 'n', value: record.ep },
      { type: 's', value: record.pcLabel },
      { type: 's', value: gradeCellText(record) },
      { type: 'n', value: record.nb },
    ]);
  }

  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>`;

  const rootRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;

  const workbookRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;

  const workbook = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    <sheet name="Resultats" sheetId="1" r:id="rId1"/>
  </sheets>
</workbook>`;

  const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="1"><font><sz val="11"/><name val="Calibri"/></font></fonts>
  <fills count="1"><fill><patternFill patternType="none"/></fill></fills>
  <borders count="1"><border/></borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/></cellXfs>
  <cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;

  const sheet = buildSheetXml(rows);

  const encoder = new TextEncoder();
  const files = [
    { name: '[Content_Types].xml', data: encoder.encode(contentTypes) },
    { name: '_rels/.rels', data: encoder.encode(rootRels) },
    { name: 'xl/workbook.xml', data: encoder.encode(workbook) },
    { name: 'xl/_rels/workbook.xml.rels', data: encoder.encode(workbookRels) },
    { name: 'xl/styles.xml', data: encoder.encode(styles) },
    { name: 'xl/worksheets/sheet1.xml', data: encoder.encode(sheet) },
  ];

  const blob = buildZip(files);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'stock-planches.xlsx';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/* ---------- Réinitialisation ---------- */

document.getElementById('btn-reset').addEventListener('click', async () => {
  if (state.records.length === 0) return;
  const confirmed = await openConfirm({
    title: 'Réinitialiser le stock',
    message: 'Tout le stock enregistré sera effacé. Cette action est irréversible.',
    confirmLabel: 'Réinitialiser',
  });
  if (!confirmed) return;
  state.records = [];
  state.history = [];
  saveState();
  renderResults();
  renderHistory();
  showToast('Stock réinitialisé');
});

/* ---------- Liaisons navigation ---------- */

document.getElementById('btn-export-xlsx').addEventListener('click', exportResultsXlsx);
document.getElementById('btn-go-results').addEventListener('click', goToResultats);
document.getElementById('btn-back-to-longueur-from-epaisseur').addEventListener('click', goToLongueur);
document.getElementById('btn-back-to-epaisseur').addEventListener('click', goToEpaisseur);
document.getElementById('btn-back-to-longueur-from-chevron-section').addEventListener('click', goToLongueur);
document.getElementById('btn-back-to-chevron-section').addEventListener('click', goToChevronSection);
document.getElementById('btn-back-to-pieces-from-grade27').addEventListener('click', backFromGrade27);
btnUndoLast.addEventListener('click', undoLastEntry);
btnTogglePiecesDisplay.addEventListener('click', () => {
  state.pieceDisplayMode = state.pieceDisplayMode === 'converted' ? 'pieces' : 'converted';
  saveState();
  updateTogglePiecesDisplayButton();
  buildPiecesGrid();
  showToast(state.pieceDisplayMode === 'converted' ? 'Affichage : valeurs converties' : 'Affichage : pièces/couche');
});

function updateTogglePiecesDisplayButton() {
  const active = state.pieceDisplayMode === 'converted';
  btnTogglePiecesDisplay.setAttribute('aria-pressed', String(active));
}
// Résultats n'est accessible que depuis la page Longueur (bouton en haut
// à droite) : le retour ramène donc toujours directement à cette page,
// plutôt que de deviner où reprendre.
document.getElementById('btn-back-from-results').addEventListener('click', goToLongueur);

/* ---------- Initialisation ---------- */

buildLongueurGrid();
buildChevronSectionGrid();
buildLgChevronsGrid();
buildEpaisseurGrid();
buildGrade27Grid();
updateTogglePiecesDisplayButton();

if (state.chevronEpaisseur !== null) {
  goToLgChevrons();
} else if (state.grade27Open) {
  goToGrade27();
} else if (state.currentLongueur !== null && (state.currentEpaisseur !== null || state.epaisseurDual)) {
  goToPieces();
} else if (state.currentLongueur !== null) {
  goToEpaisseur();
} else {
  goToLongueur();
}

/* ---------- Service worker (PWA hors-ligne) ---------- */

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('service-worker.js').catch(() => {});
  });
}
