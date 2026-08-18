'use strict';

/* ---------- Persistance ---------- */

const STORAGE_KEY = 'stockPlanches:v3';

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { records: [], currentLongueur: null, currentEpaisseur: null };
    const parsed = JSON.parse(raw);
    return {
      records: Array.isArray(parsed.records) ? parsed.records : [],
      currentLongueur: parsed.currentLongueur ?? null,
      currentEpaisseur: parsed.currentEpaisseur ?? null,
    };
  } catch (e) {
    return { records: [], currentLongueur: null, currentEpaisseur: null };
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    records: state.records,
    currentLongueur: state.currentLongueur,
    currentEpaisseur: state.currentEpaisseur,
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

const EPAISSEUR_VALUES = [18, 27, 38, 50, 63, 75];

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
const currentLongueurLabelEpaisseur = document.getElementById('current-longueur-label-epaisseur');
const currentLongueurEpaisseurLabel = document.getElementById('current-longueur-epaisseur-label');
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
  currentLongueurEpaisseurLabel.textContent = state.currentLongueur && state.currentEpaisseur !== null
    ? `${formatLongueur(state.currentLongueur)} · ${formatNumberFR(state.currentEpaisseur)} mm`
    : '—';
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

  for (const value of EPAISSEUR_VALUES) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'tile';
    btn.textContent = formatNumberFR(value);
    btn.addEventListener('click', () => selectEpaisseur(value));
    gridEpaisseur.appendChild(btn);
  }

  const btnAutre = document.createElement('button');
  btnAutre.type = 'button';
  btnAutre.className = 'tile tile-autre tile-full';
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
  saveState();
  goToPieces();
}

function buildPiecesGrid() {
  gridPieces.innerHTML = '';

  for (const option of PIECES_OPTIONS) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'tile';
    btn.textContent = option.label;
    btn.addEventListener('click', () => recordCombination(option));
    gridPieces.appendChild(btn);
  }

  const btnAutre = document.createElement('button');
  btnAutre.type = 'button';
  btnAutre.className = 'tile tile-autre tile-full';
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

/* ---------- Enregistrement des combinaisons ---------- */

function recordCombination(pieces) {
  if (state.currentLongueur === null || state.currentEpaisseur === null) {
    goToLongueur();
    return;
  }
  const lg = state.currentLongueur;
  const ep = state.currentEpaisseur;
  const existing = state.records.find((r) => r.lg === lg && r.ep === ep && r.pcKey === pieces.key);
  if (existing) {
    existing.nb += 1;
  } else {
    state.records.push({ lg, ep, pcKey: pieces.key, pcLabel: pieces.label, pcRank: pieces.rank, nb: 1 });
  }
  saveState();
  const nb = existing ? existing.nb : 1;
  showToast(`${formatLongueur(lg)} · ${formatNumberFR(ep)}mm · ${pieces.label} pièces/couche — Nb : ${nb}`);
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

document.getElementById('btn-reset').addEventListener('click', () => {
  if (state.records.length === 0) return;
  const confirmed = window.confirm('Réinitialiser tout le stock enregistré ? Cette action est irréversible.');
  if (!confirmed) return;
  state.records = [];
  saveState();
  renderResults();
  showToast('Stock réinitialisé');
});

/* ---------- Liaisons navigation ---------- */

document.getElementById('btn-go-results').addEventListener('click', goToResultats);
document.getElementById('btn-back-to-longueur-from-epaisseur').addEventListener('click', goToLongueur);
document.getElementById('btn-back-to-epaisseur').addEventListener('click', goToEpaisseur);
document.getElementById('btn-back-from-results').addEventListener('click', () => {
  if (state.currentLongueur !== null && state.currentEpaisseur !== null) {
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
buildPiecesGrid();

if (state.currentLongueur !== null && state.currentEpaisseur !== null) {
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
