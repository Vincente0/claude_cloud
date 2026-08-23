'use strict';

/* ---------- Persistance ---------- */

const STORAGE_KEY = 'stockPlanches:v6';
const HISTORY_LIMIT = 6;

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { records: [], history: [], currentLongueur: null, currentEpaisseur: null, epaisseurDual: false, pieceDisplayMode: 'pieces' };
    const parsed = JSON.parse(raw);
    return {
      records: Array.isArray(parsed.records) ? parsed.records : [],
      history: Array.isArray(parsed.history) ? parsed.history : [],
      currentLongueur: parsed.currentLongueur ?? null,
      currentEpaisseur: parsed.currentEpaisseur ?? null,
      epaisseurDual: parsed.epaisseurDual === true,
      pieceDisplayMode: parsed.pieceDisplayMode === 'converted' ? 'converted' : 'pieces',
    };
  } catch (e) {
    return { records: [], history: [], currentLongueur: null, currentEpaisseur: null, epaisseurDual: false, pieceDisplayMode: 'pieces' };
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

/* ---------- Références DOM ---------- */

const pages = {
  longueur: document.getElementById('page-longueur'),
  epaisseur: document.getElementById('page-epaisseur'),
  pieces: document.getElementById('page-pieces'),
  resultats: document.getElementById('page-resultats'),
};

const gridLongueur = document.getElementById('grid-longueur');
const gridEpaisseur = document.getElementById('grid-epaisseur');
const gridPieces = document.getElementById('grid-pieces');
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

  const btnAutre = document.createElement('button');
  btnAutre.type = 'button';
  btnAutre.className = 'tile tile-autre';
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
    btn.textContent = pieceButtonLabel(option);
    btn.addEventListener('click', () => recordCombination(option));
    gridPieces.appendChild(btn);
  }

  const btnAutre = document.createElement('button');
  btnAutre.type = 'button';
  btnAutre.className = 'tile tile-autre';
  btnAutre.textContent = 'Autre';
  btnAutre.addEventListener('click', async () => {
    const value = await openModal({
      title: 'Pièces / couche personnalisé',
      hint: 'Saisissez le nombre de pièces par couche',
    });
    if (value === null) return;
    const label = formatNumberFR(value);
    recordCombination({ key: label, label, rank: value });
  });
  gridPieces.appendChild(btnAutre);
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
    btnAutre.textContent = `Autre ${formatNumberFR(ep)}`;
    btnAutre.addEventListener('click', async () => {
      const value = await openModal({
        title: `Pièces / couche personnalisé — ${formatNumberFR(ep)} mm`,
        hint: 'Saisissez le nombre de pièces par couche',
      });
      if (value === null) return;
      const label = formatNumberFR(value);
      recordCombination({ key: label, label, rank: value }, ep);
    });
    gridPieces.appendChild(btnAutre);
  }
}

function appendPiecesTile(option, ep) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'tile';
  btn.textContent = pieceButtonLabel(option);
  btn.addEventListener('click', () => recordCombination(option, ep));
  gridPieces.appendChild(btn);
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
    .map((h) => `<p class="history-line">${formatLongueur(h.lg)} ${formatNumberFR(h.ep)} - ${h.pcLabel}</p>`)
    .join('');
}

/* ---------- Enregistrement des combinaisons ---------- */

function recordCombination(pieces, epOverride) {
  const ep = epOverride !== undefined ? epOverride : state.currentEpaisseur;
  if (state.currentLongueur === null || ep === null) {
    goToLongueur();
    return;
  }
  const lg = state.currentLongueur;
  const existing = state.records.find((r) => r.lg === lg && r.ep === ep && r.pcKey === pieces.key);
  if (existing) {
    existing.nb += 1;
  } else {
    state.records.push({ lg, ep, pcKey: pieces.key, pcLabel: pieces.label, pcRank: pieces.rank, nb: 1 });
  }
  state.history.unshift({ lg, ep, pcKey: pieces.key, pcLabel: pieces.label });
  state.history = state.history.slice(0, HISTORY_LIMIT);
  saveState();
  renderHistory();
  const nb = existing ? existing.nb : 1;
  showToast(`${formatLongueur(lg)} · ${formatNumberFR(ep)}mm · ${pieces.label} pièces/couche — Nb : ${nb}`);
}

function undoLastEntry() {
  if (state.history.length === 0) return;
  const last = state.history.shift();
  const existing = state.records.find(
    (r) => r.lg === last.lg && r.ep === last.ep && r.pcKey === last.pcKey
  );
  if (existing) {
    existing.nb -= 1;
    if (existing.nb <= 0) {
      state.records = state.records.filter((r) => r !== existing);
    }
  }
  saveState();
  renderHistory();
  showToast(`Annulé : ${formatLongueur(last.lg)} · ${formatNumberFR(last.ep)}mm · ${last.pcLabel} pièces/couche`);
}

/* ---------- Résultats ---------- */

function renderResults() {
  const sorted = [...state.records].sort((a, b) => {
    if (a.lg !== b.lg) return a.lg - b.lg;
    if (a.ep !== b.ep) return a.ep - b.ep;
    if (a.pcRank !== b.pcRank) return a.pcRank - b.pcRank;
    return a.pcLabel.localeCompare(b.pcLabel);
  });

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
      <td>${record.nb}</td>
    `;
    resultsBody.appendChild(tr);
  }
  resultsTotal.textContent = String(total);
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

document.getElementById('btn-go-results').addEventListener('click', goToResultats);
document.getElementById('btn-back-to-longueur-from-epaisseur').addEventListener('click', goToLongueur);
document.getElementById('btn-back-to-epaisseur').addEventListener('click', goToEpaisseur);
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
document.getElementById('btn-back-from-results').addEventListener('click', () => {
  if (state.currentLongueur !== null && (state.currentEpaisseur !== null || state.epaisseurDual)) {
    goToPieces();
  } else if (state.currentLongueur !== null) {
    goToEpaisseur();
  } else {
    goToLongueur();
  }
});

/* ---------- Initialisation ---------- */

buildLongueurGrid();
buildEpaisseurGrid();
updateTogglePiecesDisplayButton();

if (state.currentLongueur !== null && (state.currentEpaisseur !== null || state.epaisseurDual)) {
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
