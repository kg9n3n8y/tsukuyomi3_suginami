// 状態保存用のキー
const STORAGE_KEY = 'tsukuyomi_state_v3_suginami';
const LEGACY_STORAGE_KEY = 'tsukuyomi_state_v1_suginami';
const REQUIRED_SYMBOL_COUNT = 5;
const SYMBOL_SETS = {
  left: ['ア', 'イ', 'ウ', 'エ', 'オ', 'カ', 'キ', 'ク', 'ケ', 'コ'],
  center: ['サ', 'シ', 'ス', 'セ', 'ソ', 'タ', 'チ', 'ツ', 'テ', 'ト'],
  right: ['ナ', 'ニ', 'ヌ', 'ネ', 'ノ', 'ハ', 'ヒ', 'フ', 'ヘ', 'ホ'],
};
const INITIAL_CHARACTERS = [
  '1字',
  'う',
  'つ',
  'し',
  'も',
  'ゆ',
  'い',
  'ち',
  'ひ',
  'き',
  'は',
  'や',
  'よ',
  'か',
  'み',
  'た',
  'こ',
  'お',
  'わ',
  'な',
  'あ',
];

function clamp(value, min, max) {
  if (value < min) {
    return min;
  }
  if (value > max) {
    return max;
  }
  return value;
}

function shuffleArray(source) {
  const array = [...source];
  for (let i = array.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

function isValidSymbolSide(value) {
  return value === 'left' || value === 'center' || value === 'right';
}

function addNumberTags(array) {
  return array.map((item, index) => {
    if (index < 2 || index >= array.length - 1) {
      return { ...item };
    }

    const tag = `<span class='num'>${index - 1}</span>`;
    return {
      ...item,
      kaminoku: tag + item.kaminoku,
      shimonoku: tag + item.shimonoku,
    };
  });
}

function loadState() {
  if (typeof localStorage === 'undefined') {
    return null;
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
    const legacyRaw = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (legacyRaw) {
      const migrated = migrateLegacyState(JSON.parse(legacyRaw));
      if (migrated) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
        localStorage.removeItem(LEGACY_STORAGE_KEY);
        return migrated;
      }
    }
  } catch (error) {
    console.warn('状態の読み込みに失敗しました。', error);
  }
  return null;
}

function migrateLegacyState(state) {
  if (
    !state ||
    !Array.isArray(state.yomifudalist) ||
    typeof state.currentIndex !== 'number'
  ) {
    return null;
  }
  const order = state.yomifudalist
    .slice(2, Math.max(state.yomifudalist.length - 1, 0))
    .map(item => item.no)
    .filter(no => typeof no === 'number');
  return {
    version: 2,
    currentIndex: clamp(state.currentIndex, 0, order.length + 1),
    order,
    selectedCardNumbers: order,
    manualAdditionNumbers: [],
  };
}

function persistState() {
  if (typeof localStorage === 'undefined') {
    return;
  }
  try {
    const payload = {
      version: 2,
      currentIndex,
      order: currentPlayableOrder,
      selectedCardNumbers: Array.from(selectedCardNumbers),
      manualAdditionNumbers: Array.from(manualAdditionNumbers),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch (error) {
    console.warn('状態の保存に失敗しました。', error);
  }
}

function clearState() {
  if (typeof localStorage === 'undefined') {
    return;
  }
  try {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(LEGACY_STORAGE_KEY);
  } catch (error) {
    console.warn('状態の削除に失敗しました。', error);
  }
}

function isStateValid(state) {
  if (
    !state ||
    !Array.isArray(state.order) ||
    !Array.isArray(state.selectedCardNumbers) ||
    !Array.isArray(state.manualAdditionNumbers)
  ) {
    return false;
  }
  const hasUnknownNumbers = state.order.some(no => !baseCardMap.has(no));
  if (hasUnknownNumbers) {
    return false;
  }
  return true;
}

const specialPrefixIndexes = [0, 1];
const specialSuffixIndex = fudalist.length - 1;
const baseCards = fudalist.filter(card => card.no > 0 && card.no < 101);
const baseCardMap = new Map(baseCards.map(card => [card.no, card]));
const allCardNumbers = baseCards.map(card => card.no);

let selectedCardNumbers = new Set(allCardNumbers);
let manualAdditionNumbers = new Set();
let currentPlayableOrder = [];
let yomifudalist = [];
let currentIndex = 0;
let lastPlayableIndex = 0;

let draftSelection = null;
let draftManualAdditions = null;

const shimonokuElement = document.getElementById('shimonoku');
const kaminokuElement = document.getElementById('kaminoku');
const middleButton = document.getElementById('middle-button');
const cardCounterElement = document.getElementById('card-counter');

const openSettingsButton = document.getElementById('open-settings-button');
const shuffleButton = document.getElementById('shuffle-button');
const selectionModal = document.getElementById('selection-modal');
const closeSettingsButton = document.getElementById('close-settings-button');
const cancelSettingsButton = document.getElementById('cancel-settings-button');
const applySettingsButton = document.getElementById('apply-settings-button');
const selectAllButton = document.getElementById('select-all-button');
const selectNoneButton = document.getElementById('select-none-button');
const openSymbolSelectorButton = document.getElementById('open-symbol-selector-button');
const openInitialSelectorButton = document.getElementById('open-initial-selector-button');
const cardListElement = document.getElementById('card-list');
const selectedCountIndicator = document.getElementById('selected-count-indicator');

const symbolSelector = document.getElementById('symbol-selector');
const closeSymbolSelectorButton = document.getElementById('close-symbol-selector-button');
const applySymbolSelectionButton = document.getElementById('apply-symbol-selection-button');
const cancelSymbolSelectionButton = document.getElementById('cancel-symbol-selection-button');
const symbolButtonsContainer = document.getElementById('symbol-buttons');
const symbolRandomAddCountInput = document.getElementById('symbol-random-add-count');
const symbolSideInputs = document.querySelectorAll('input[name="symbol-side"]');

const initialSelector = document.getElementById('initial-selector');
const closeInitialSelectorButton = document.getElementById('close-initial-selector-button');
const applyInitialSelectionButton = document.getElementById('apply-initial-selection-button');
const cancelInitialSelectionButton = document.getElementById('cancel-initial-selection-button');
const initialButtonsContainer = document.getElementById('initial-buttons');
const initialRandomAddCountInput = document.getElementById('initial-random-add-count');

const cardListRefs = new Map();

let currentSymbolSide = 'left';
const symbolSelectedValues = new Set();
const initialSelectedValues = new Set();

initialize();

function initialize() {
  buildCardList();
  const initialSideInput = document.querySelector('input[name="symbol-side"]:checked');
  currentSymbolSide = isValidSymbolSide(initialSideInput?.value) ? initialSideInput.value : 'left';
  buildSymbolButtons(currentSymbolSide);
  buildInitialButtons();
  attachMainEventListeners();
  attachModalEventListeners();

  const savedState = loadState();
  if (isStateValid(savedState)) {
    restoreState(savedState);
  } else {
    clearState();
    resetToDefault();
  }

  updateDisplay();
  showMiddleButton();
  updateCardListSelectionState(selectedCardNumbers, manualAdditionNumbers);
  updateProgressIndicator();
  updateSelectedCountIndicator(selectedCardNumbers);
}

function restoreState(state) {
  selectedCardNumbers = new Set(
    state.selectedCardNumbers.filter(no => baseCardMap.has(no))
  );
  manualAdditionNumbers = new Set(
    state.manualAdditionNumbers.filter(no => selectedCardNumbers.has(no))
  );
  const order = state.order.filter(no => selectedCardNumbers.has(no));
  currentPlayableOrder =
    order.length > 0 ? order.slice() : Array.from(selectedCardNumbers).sort((a, b) => a - b);
  rebuildYomifudalistFromOrder(currentPlayableOrder);
  lastPlayableIndex = Math.max(0, yomifudalist.length - 2);
  currentIndex = clamp(
    typeof state.currentIndex === 'number' ? state.currentIndex : 0,
    0,
    lastPlayableIndex
  );
}

function resetToDefault() {
  selectedCardNumbers = new Set(allCardNumbers);
  manualAdditionNumbers = new Set();
  shuffleWithCurrentSelection();
}

function buildCardList() {
  if (!cardListElement) {
    return;
  }
  cardListElement.innerHTML = '';
  baseCards.forEach(card => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'card-item';
    button.dataset.no = String(card.no);

    const kimarijiSpan = document.createElement('span');
    kimarijiSpan.className = 'card-kimariji';
    kimarijiSpan.textContent = card.kimariji || '';

    const manualSpan = document.createElement('span');
    manualSpan.className = 'card-manual';
    manualSpan.textContent = '空';
    manualSpan.style.display = 'none';

    button.appendChild(kimarijiSpan);
    button.appendChild(manualSpan);

    button.addEventListener('click', () => {
      toggleCardSelection(Number(button.dataset.no));
    });

    cardListElement.appendChild(button);
    cardListRefs.set(card.no, { button, manualSpan });
  });
}

function buildSymbolButtons(side) {
  if (!symbolButtonsContainer) {
    return;
  }
  const symbols = SYMBOL_SETS[side] ?? [];
  symbolButtonsContainer.innerHTML = '';
  symbols.forEach(symbol => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'symbol-button';
    button.dataset.value = symbol;
    button.textContent = symbol;
    button.addEventListener('click', () => {
      toggleSymbolSelection(button, symbol);
    });
    symbolButtonsContainer.appendChild(button);
  });
}

function buildInitialButtons() {
  if (!initialButtonsContainer) {
    return;
  }
  initialButtonsContainer.innerHTML = '';
  INITIAL_CHARACTERS.forEach(char => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'initial-button';
    button.dataset.value = char;
    button.textContent = char;
    button.addEventListener('click', () => {
      toggleInitialSelection(button, char);
    });
    initialButtonsContainer.appendChild(button);
  });
}

function attachMainEventListeners() {
  if (shuffleButton) {
    shuffleButton.addEventListener('click', handleShuffleClick);
  }

  if (openSettingsButton) {
    openSettingsButton.addEventListener('click', () => openSelectionModal());
  }

  if (kaminokuElement) {
    kaminokuElement.addEventListener('click', () => {
      if (currentIndex < lastPlayableIndex) {
        currentIndex += 1;
        updateDisplay();
        showMiddleButton();
      }
    });
  }

  if (shimonokuElement) {
    shimonokuElement.addEventListener('click', () => {
      if (currentIndex > 0) {
        currentIndex -= 1;
        updateDisplay();
        showMiddleButton();
      }
    });
  }
}

function attachModalEventListeners() {
  if (closeSettingsButton) {
    closeSettingsButton.addEventListener('click', () => closeSelectionModal());
  }
  if (cancelSettingsButton) {
    cancelSettingsButton.addEventListener('click', () => closeSelectionModal());
  }
  if (applySettingsButton) {
    applySettingsButton.addEventListener('click', handleApplySettings);
  }
  if (selectAllButton) {
    selectAllButton.addEventListener('click', () => {
      if (!draftSelection) {
        return;
      }
      draftSelection = new Set(allCardNumbers);
      draftManualAdditions = new Set();
      updateCardListSelectionState(draftSelection, draftManualAdditions);
    });
  }
  if (selectNoneButton) {
    selectNoneButton.addEventListener('click', () => {
      if (!draftSelection) {
        return;
      }
      draftSelection.clear();
      draftManualAdditions.clear();
      updateCardListSelectionState(draftSelection, draftManualAdditions);
    });
  }
  if (openSymbolSelectorButton) {
    openSymbolSelectorButton.addEventListener('click', () => openSubModal(symbolSelector));
  }
  if (openInitialSelectorButton) {
    openInitialSelectorButton.addEventListener('click', () => openSubModal(initialSelector));
  }
  if (closeSymbolSelectorButton) {
    closeSymbolSelectorButton.addEventListener('click', () => closeSubModal(symbolSelector, true));
  }
  if (cancelSymbolSelectionButton) {
    cancelSymbolSelectionButton.addEventListener('click', () => closeSubModal(symbolSelector, true));
  }
  if (applySymbolSelectionButton) {
    applySymbolSelectionButton.addEventListener('click', handleApplySymbolSelection);
  }
  if (symbolSideInputs.length > 0) {
    symbolSideInputs.forEach(input => {
      input.addEventListener('change', () => {
        if (!isValidSymbolSide(input.value)) {
          return;
        }
        currentSymbolSide = input.value;
        symbolSelectedValues.clear();
        buildSymbolButtons(currentSymbolSide);
      });
    });
  }
  if (closeInitialSelectorButton) {
    closeInitialSelectorButton.addEventListener('click', () => closeSubModal(initialSelector, true));
  }
  if (cancelInitialSelectionButton) {
    cancelInitialSelectionButton.addEventListener('click', () => closeSubModal(initialSelector, true));
  }
  if (applyInitialSelectionButton) {
    applyInitialSelectionButton.addEventListener('click', handleApplyInitialSelection);
  }
}

function openSelectionModal() {
  draftSelection = new Set(selectedCardNumbers);
  draftManualAdditions = new Set(manualAdditionNumbers);
  updateCardListSelectionState(draftSelection, draftManualAdditions);
  showModal(selectionModal);
}

function closeSelectionModal() {
  hideModal(selectionModal);
  draftSelection = null;
  draftManualAdditions = null;
  symbolSelectedValues.clear();
  initialSelectedValues.clear();
  resetSelectionButtons(symbolButtonsContainer);
  resetSelectionButtons(initialButtonsContainer);
  updateCardListSelectionState(selectedCardNumbers, manualAdditionNumbers);
}

function showModal(modal) {
  if (!modal) {
    return;
  }
  modal.classList.remove('hidden');
  modal.setAttribute('aria-hidden', 'false');
}

function hideModal(modal) {
  if (!modal) {
    return;
  }
  modal.classList.add('hidden');
  modal.setAttribute('aria-hidden', 'true');
}

function openSubModal(modal) {
  if (!modal || !draftSelection) {
    return;
  }
  if (modal === symbolSelector && symbolRandomAddCountInput) {
    symbolRandomAddCountInput.value = '35';
  } else if (modal === initialSelector && initialRandomAddCountInput) {
    initialRandomAddCountInput.value = '0';
  }
  showModal(modal);
}

function closeSubModal(modal, resetButtons = false) {
  if (!modal) {
    return;
  }
  hideModal(modal);
  if (resetButtons) {
    if (modal === symbolSelector) {
      symbolSelectedValues.clear();
      resetSelectionButtons(symbolButtonsContainer);
      if (symbolRandomAddCountInput) {
        symbolRandomAddCountInput.value = '35';
      }
    } else if (modal === initialSelector) {
      initialSelectedValues.clear();
      resetSelectionButtons(initialButtonsContainer);
      if (initialRandomAddCountInput) {
        initialRandomAddCountInput.value = '0';
      }
    }
  }
}

function resetSelectionButtons(container) {
  if (!container) {
    return;
  }
  container.querySelectorAll('button').forEach(button => {
    button.classList.remove('selected');
  });
}

function toggleCardSelection(cardNo) {
  if (!draftSelection || !draftManualAdditions) {
    return;
  }
  if (draftSelection.has(cardNo)) {
    draftSelection.delete(cardNo);
    draftManualAdditions.delete(cardNo);
  } else {
    draftSelection.add(cardNo);
  }
  updateCardListSelectionState(draftSelection, draftManualAdditions);
}

function updateCardListSelectionState(selectionSet, manualSet) {
  cardListRefs.forEach(({ button, manualSpan }, cardNo) => {
    const isSelected = selectionSet.has(cardNo);
    button.classList.toggle('selected', isSelected);
    if (manualSpan) {
      const isManual = manualSet.has(cardNo);
      manualSpan.style.display = isManual ? 'block' : 'none';
    }
  });
  updateSelectedCountIndicator(selectionSet);
}

function applyRandomAddition(count) {
  if (!draftSelection || !draftManualAdditions) {
    return;
  }
  if (!Number.isInteger(count) || count <= 0) {
    return;
  }
  draftManualAdditions.forEach(no => {
    draftSelection.delete(no);
  });
  draftManualAdditions.clear();

  const selectionInitials = new Set(
    [...draftSelection]
      .map(no => baseCardMap.get(no)?.initial)
      .filter(initial => typeof initial === 'string' && initial.length > 0)
  );

  const preferredCandidates = [];
  const fallbackCandidates = [];

  baseCards.forEach(card => {
    if (draftSelection.has(card.no)) {
      return;
    }
    if (selectionInitials.has(card.initial)) {
      preferredCandidates.push(card.no);
    } else {
      fallbackCandidates.push(card.no);
    }
  });

  const totalCandidates = preferredCandidates.length + fallbackCandidates.length;
  if (totalCandidates === 0) {
    window.alert('追加できる札がありません。');
    return;
  }

  const shuffledPreferred = shuffleArray(preferredCandidates);
  const shuffledFallback = shuffleArray(fallbackCandidates);
  const actualCount = Math.min(count, totalCandidates);
  const preferredTake = Math.min(actualCount, shuffledPreferred.length);
  const fallbackTake = Math.max(0, actualCount - preferredTake);
  const selectedNos = [
    ...shuffledPreferred.slice(0, preferredTake),
    ...shuffledFallback.slice(0, fallbackTake),
  ];

  selectedNos.forEach(no => {
    draftSelection.add(no);
    draftManualAdditions.add(no);
  });

  if (actualCount < count) {
    window.alert(`追加可能な札は${actualCount}枚のみでした。`);
  }
}

function toggleSymbolSelection(button, value) {
  if (!button) {
    return;
  }
  if (symbolSelectedValues.has(value)) {
    symbolSelectedValues.delete(value);
    button.classList.remove('selected');
    return;
  }
  if (symbolSelectedValues.size >= REQUIRED_SYMBOL_COUNT) {
    window.alert(`選択できる記号は${REQUIRED_SYMBOL_COUNT}つまでです。`);
    return;
  }
  symbolSelectedValues.add(value);
  button.classList.add('selected');
}

function handleApplySymbolSelection() {
  if (!draftSelection || !draftManualAdditions) {
    closeSubModal(symbolSelector, true);
    return;
  }
  if (symbolSelectedValues.size !== REQUIRED_SYMBOL_COUNT) {
    window.alert(`${REQUIRED_SYMBOL_COUNT}つの記号を選択してください。`);
    return;
  }
  const selectedSymbols = Array.from(symbolSelectedValues);
  const sideInput = document.querySelector('input[name="symbol-side"]:checked');
  const side = isValidSymbolSide(sideInput?.value) ? sideInput.value : null;

  if (!side) {
    window.alert('左側・中央・右側のいずれかを選択してください。');
    return;
  }

  const matches = baseCards.filter(card => {
    const targetSymbol = card?.[side];
    return typeof targetSymbol === 'string' && selectedSymbols.includes(targetSymbol);
  });

  if (matches.length === 0) {
    window.alert('条件に合致する札がありませんでした。');
    return;
  }

  draftSelection = new Set(matches.map(card => card.no));
  draftManualAdditions = new Set();
  const randomCount = Number(symbolRandomAddCountInput?.value ?? 0);
  applyRandomAddition(randomCount);
  updateCardListSelectionState(draftSelection, draftManualAdditions);
  closeSubModal(symbolSelector, true);
}

function toggleInitialSelection(button, initialChar) {
  if (!button) {
    return;
  }
  if (initialSelectedValues.has(initialChar)) {
    initialSelectedValues.delete(initialChar);
    button.classList.remove('selected');
    return;
  }
  initialSelectedValues.add(initialChar);
  button.classList.add('selected');
}

function handleApplyInitialSelection() {
  if (!draftSelection || !draftManualAdditions) {
    closeSubModal(initialSelector, true);
    return;
  }
  if (initialSelectedValues.size === 0) {
    window.alert('一文字目を少なくとも1つ選択してください。');
    return;
  }
  const matches = baseCards.filter(card => initialSelectedValues.has(card.initial));
  if (matches.length === 0) {
    window.alert('条件に合致する札がありませんでした。');
    return;
  }
  draftSelection = new Set(matches.map(card => card.no));
  draftManualAdditions = new Set();
  const randomCount = Number(initialRandomAddCountInput?.value ?? 0);
  applyRandomAddition(randomCount);
  updateCardListSelectionState(draftSelection, draftManualAdditions);
  closeSubModal(initialSelector, true);
}

function handleApplySettings() {
  if (!draftSelection || !draftManualAdditions) {
    closeSelectionModal();
    return;
  }
  if (draftSelection.size === 0) {
    window.alert('少なくとも1枚以上の札を選択してください。');
    return;
  }

  selectedCardNumbers = new Set(draftSelection);
  manualAdditionNumbers = new Set(
    [...draftManualAdditions].filter(no => selectedCardNumbers.has(no))
  );
  closeSelectionModal();

  shuffleWithCurrentSelection();
  updateCardListSelectionState(selectedCardNumbers, manualAdditionNumbers);
  updateProgressIndicator();
  persistState();
}

function shuffleWithCurrentSelection() {
  if (selectedCardNumbers.size === 0) {
    return;
  }
  const selectionArray = Array.from(selectedCardNumbers);
  currentPlayableOrder = shuffleArray(selectionArray);
  rebuildYomifudalistFromOrder(currentPlayableOrder);
  lastPlayableIndex = Math.max(0, yomifudalist.length - 2);
  currentIndex = 0;
  hideMiddleButton();
  updateDisplay();
  updateSelectedCountIndicator(selectedCardNumbers);
}

function rebuildYomifudalistFromOrder(order) {
  const prefix = specialPrefixIndexes
    .map(index => ({ ...fudalist[index] }))
    .filter(Boolean);
  const suffix = [{ ...fudalist[specialSuffixIndex] }];

  const cards = order
    .map(no => {
      const base = baseCardMap.get(no);
      if (!base) {
        return null;
      }
      return {
        ...base,
        kaminoku: base.kaminoku,
        shimonoku: base.shimonoku,
        isManualAddition: manualAdditionNumbers.has(no),
      };
    })
    .filter(Boolean);

  yomifudalist = addNumberTags([...prefix, ...cards, ...suffix]);
  lastPlayableIndex = Math.max(0, yomifudalist.length - 2);
}

function updateDisplay() {
  if (!shimonokuElement || !kaminokuElement || yomifudalist.length === 0) {
    return;
  }

  const currentCard = yomifudalist[currentIndex];
  const nextCard = yomifudalist[Math.min(currentIndex + 1, yomifudalist.length - 1)];

  renderCard(shimonokuElement, currentCard, 'shimonoku');
  renderCard(kaminokuElement, nextCard, 'kaminoku');

  updateProgressIndicator();
  persistState();
}

function renderCard(element, card, type) {
  if (!element) {
    return;
  }
  if (!card) {
    element.innerHTML = '';
    element.classList.remove('manual-addition');
    return;
  }

  if (type === 'shimonoku') {
    element.innerHTML = card.shimonoku || '';
  } else {
    element.innerHTML = card.kaminoku || '';
  }

  if (card.isManualAddition) {
    element.classList.add('manual-addition');
  } else {
    element.classList.remove('manual-addition');
  }
}

function getPlayableCardCount() {
  return currentPlayableOrder.length;
}

function updateProgressIndicator() {
  if (!cardCounterElement) {
    return;
  }
  const total = getPlayableCardCount();
  cardCounterElement.textContent = `選択数: ${total}枚`;
}

function updateSelectedCountIndicator(selectionSet) {
  if (!selectedCountIndicator) {
    return;
  }
  const targetSet = selectionSet || selectedCardNumbers;
  selectedCountIndicator.textContent = `選択中: ${targetSet.size}枚`;
}

function handleShuffleClick() {
  if (selectedCardNumbers.size === 0) {
    window.alert('使う札が選択されていません。設定から札を選択してください。');
    return;
  }
  const shouldShuffle = window.confirm('読み札をシャッフルしますが，いいですか？');
  if (shouldShuffle) {
    shuffleWithCurrentSelection();
    updateProgressIndicator();
    persistState();
  }
}

function showMiddleButton() {
  if (middleButton) {
    middleButton.style.display = 'block';
  }
}

function hideMiddleButton() {
  if (middleButton) {
    middleButton.style.display = 'none';
  }
}

// タイマー
document.addEventListener('DOMContentLoaded', () => {
  const buttons = document.querySelectorAll('.float-button');

  buttons.forEach(button => {
    button.addEventListener('click', () => {
      const circle = button.querySelector('circle') || button.querySelector('.main-circle');
      const quarterCircle = button.querySelector('.quarter-circle');

      switch (button.id) {
        case 'middle-button':
          animateMiddleButton(circle, quarterCircle, button);
          break;
        default:
          break;
      }
    });
  });

  const floatButtons = document.querySelector('.float-buttons');
  const toggleButton = document.getElementById('toggle-button');

  if (toggleButton && floatButtons) {
    toggleButton.addEventListener('click', () => {
      floatButtons.classList.toggle('visible');
    });
  }
});

function animateCircle(circle, duration) {
  if (!circle) {
    return;
  }
  circle.style.animation = `disappear ${duration}s linear forwards`;

  setTimeout(() => {
    circle.style.animation = '';
  }, duration * 1000);
}

function animateMiddleButton(mainCircle, quarterCircle, button) {
  if (!mainCircle || !quarterCircle || !button) {
    return;
  }
  mainCircle.style.animation = 'disappear-main 4s linear forwards';

  setTimeout(() => {
    quarterCircle.style.animation = 'disappear-quarter 1s linear forwards';

    setTimeout(() => {
      mainCircle.style.animation = '';
      quarterCircle.style.animation = '';
      button.style.display = 'none';
    }, 1000);
  }, 3000);
}
