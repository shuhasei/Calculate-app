const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

const screens = {
  setup: $('#setup-screen'),
  game: $('#game-screen'),
  result: $('#result-screen')
};

const els = {
  headerBest: $('#header-best'),
  start: $('#start-button'),
  setupError: $('#setup-error'),
  gameTime: $('#game-time'),
  score: $('#score'),
  streak: $('#streak'),
  gameProgress: $('#game-progress'),
  questionNumber: $('#question-number'),
  questionTime: $('#question-time'),
  questionProgress: $('#question-progress'),
  problem: $('#problem'),
  answerDisplay: $('#answer-display'),
  feedback: $('#feedback'),
  resultScore: $('#result-score'),
  resultCorrect: $('#result-correct'),
  resultTotal: $('#result-total'),
  resultAccuracy: $('#result-accuracy'),
  resultAverage: $('#result-average'),
  resultStreak: $('#result-streak'),
  resultBest: $('#result-best'),
  reviewWrap: $('#review-wrap'),
  reviewList: $('#review-list'),
  retry: $('#retry-button'),
  settings: $('#settings-button')
};

const symbols = { add: '＋', sub: '−', mul: '×', div: '÷' };

let state = null;
let animationFrame = null;
let lastSettings = null;

function showScreen(name) {
  Object.entries(screens).forEach(([key, node]) => node.classList.toggle('hidden', key !== name));
}

function getBest() {
  return Number(localStorage.getItem('mentalMathBest') || 0);
}

function setBest(value) {
  localStorage.setItem('mentalMathBest', String(value));
  els.headerBest.textContent = value;
}

function readSettings() {
  const difficulty = $('input[name="difficulty"]:checked').value;
  const duration = Number($('input[name="duration"]:checked').value);
  const questionLimit = Number($('input[name="question-limit"]:checked').value);
  const operations = $$('input[name="operation"]:checked').map((node) => node.value);
  return { difficulty, duration, questionLimit, operations };
}

function rand(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function difficultyRange(level, operation) {
  if (level === 'easy') {
    if (operation === 'mul' || operation === 'div') return [2, 9];
    return [1, 20];
  }
  if (level === 'normal') {
    if (operation === 'mul' || operation === 'div') return [2, 12];
    return [5, 100];
  }
  if (operation === 'mul' || operation === 'div') return [6, 25];
  return [20, 300];
}

function makeQuestion() {
  const operation = state.settings.operations[rand(0, state.settings.operations.length - 1)];
  const [min, max] = difficultyRange(state.settings.difficulty, operation);
  let a;
  let b;
  let answer;

  if (operation === 'add') {
    a = rand(min, max);
    b = rand(min, max);
    answer = a + b;
  } else if (operation === 'sub') {
    a = rand(min, max);
    b = rand(min, max);
    if (state.settings.difficulty !== 'hard' && b > a) [a, b] = [b, a];
    answer = a - b;
  } else if (operation === 'mul') {
    a = rand(min, max);
    b = rand(min, max);
    answer = a * b;
  } else {
    b = rand(min, max);
    answer = rand(min, max);
    a = b * answer;
  }

  return { a, b, operation, answer, text: `${a} ${symbols[operation]} ${b}` };
}

function startGame(settings = readSettings()) {
  if (!settings.operations.length) {
    els.setupError.textContent = '出題する計算を1つ以上選んでください。';
    return;
  }
  els.setupError.textContent = '';
  cancelAnimationFrame(animationFrame);
  lastSettings = { ...settings, operations: [...settings.operations] };
  const now = performance.now();
  state = {
    settings,
    startTime: now,
    endTime: now + settings.duration * 1000,
    questionStartedAt: now,
    questionDeadline: now + settings.questionLimit * 1000,
    question: null,
    input: '',
    score: 0,
    correct: 0,
    total: 0,
    streak: 0,
    maxStreak: 0,
    questionCount: 0,
    answerTimes: [],
    mistakes: [],
    locked: false,
    active: true
  };
  showScreen('game');
  nextQuestion();
  animationFrame = requestAnimationFrame(tick);
}

function nextQuestion() {
  if (!state?.active) return;
  const now = performance.now();
  state.question = makeQuestion();
  state.input = '';
  state.locked = false;
  state.questionCount += 1;
  state.questionStartedAt = now;
  state.questionDeadline = Math.min(now + state.settings.questionLimit * 1000, state.endTime);

  els.questionNumber.textContent = `第${state.questionCount}問`;
  els.problem.textContent = state.question.text;
  els.answerDisplay.textContent = '?';
  els.feedback.textContent = '答えを入力して Enter';
  els.feedback.className = 'feedback';
  updateStats();
}

function updateStats() {
  els.score.textContent = state.score;
  els.streak.textContent = state.streak;
}

function appendInput(value) {
  if (!state?.active || state.locked) return;
  if (value === 'minus') {
    if (!state.input) state.input = '-';
  } else if (value === 'backspace') {
    state.input = state.input.slice(0, -1);
  } else if (/^\d$/.test(value)) {
    if (state.input.length < 8) state.input += value;
  }
  els.answerDisplay.textContent = state.input || '?';
}

function submitAnswer(timedOut = false) {
  if (!state?.active || state.locked) return;
  if (!timedOut && (state.input === '' || state.input === '-')) return;

  state.locked = true;
  state.total += 1;
  const elapsed = Math.max(0, (performance.now() - state.questionStartedAt) / 1000);
  state.answerTimes.push(Math.min(elapsed, state.settings.questionLimit));
  const given = timedOut ? null : Number(state.input);
  const correct = given === state.question.answer;

  if (correct) {
    state.correct += 1;
    state.streak += 1;
    state.maxStreak = Math.max(state.maxStreak, state.streak);
    const speedBonus = Math.max(0, Math.ceil((state.settings.questionLimit - elapsed) * 2));
    const streakBonus = Math.min(state.streak - 1, 10);
    state.score += 10 + speedBonus + streakBonus;
    els.feedback.textContent = `正解！ +${10 + speedBonus + streakBonus}点`;
    els.feedback.className = 'feedback correct';
  } else {
    state.streak = 0;
    state.mistakes.push({ ...state.question, given, timedOut });
    els.feedback.textContent = timedOut
      ? `時間切れ！ 正解は ${state.question.answer}`
      : `おしい！ 正解は ${state.question.answer}`;
    els.feedback.className = 'feedback wrong';
  }

  updateStats();
  setTimeout(() => {
    if (state?.active && performance.now() < state.endTime) nextQuestion();
  }, 320);
}

function tick(now) {
  if (!state?.active) return;
  const remainingGame = Math.max(0, (state.endTime - now) / 1000);
  const remainingQuestion = Math.max(0, (state.questionDeadline - now) / 1000);

  els.gameTime.textContent = remainingGame.toFixed(1);
  els.questionTime.textContent = remainingQuestion.toFixed(1);
  els.gameProgress.style.width = `${(remainingGame / state.settings.duration) * 100}%`;
  els.questionProgress.style.width = `${(remainingQuestion / state.settings.questionLimit) * 100}%`;

  if (remainingGame <= 0) {
    endGame();
    return;
  }
  if (remainingQuestion <= 0 && !state.locked) submitAnswer(true);
  animationFrame = requestAnimationFrame(tick);
}

function endGame() {
  if (!state?.active) return;
  state.active = false;
  cancelAnimationFrame(animationFrame);
  const accuracy = state.total ? Math.round((state.correct / state.total) * 100) : 0;
  const average = state.answerTimes.length
    ? state.answerTimes.reduce((sum, value) => sum + value, 0) / state.answerTimes.length
    : 0;
  const previousBest = getBest();
  const best = Math.max(previousBest, state.score);
  if (best !== previousBest) setBest(best);

  els.resultScore.textContent = state.score;
  els.resultCorrect.textContent = state.correct;
  els.resultTotal.textContent = state.total;
  els.resultAccuracy.textContent = `${accuracy}%`;
  els.resultAverage.textContent = `${average.toFixed(1)}秒`;
  els.resultStreak.textContent = state.maxStreak;
  els.resultBest.textContent = best;

  renderReview();
  showScreen('result');
}

function renderReview() {
  els.reviewList.innerHTML = '';
  if (!state.mistakes.length) {
    els.reviewWrap.classList.add('hidden');
    return;
  }
  els.reviewWrap.classList.remove('hidden');
  state.mistakes.slice(0, 10).forEach((item) => {
    const row = document.createElement('div');
    row.className = 'review-item';
    const yourAnswer = item.timedOut ? '時間切れ' : item.given;
    row.innerHTML = `<strong>${item.text} = ${item.answer}</strong><span>あなた: ${yourAnswer}</span>`;
    els.reviewList.appendChild(row);
  });
}

els.start.addEventListener('click', () => startGame());
els.retry.addEventListener('click', () => startGame(lastSettings));
els.settings.addEventListener('click', () => showScreen('setup'));

$$('.keypad button').forEach((button) => {
  button.addEventListener('click', () => {
    const key = button.dataset.key;
    if (key === 'enter') submitAnswer(false);
    else appendInput(key);
  });
});

document.addEventListener('keydown', (event) => {
  if (!state?.active) return;
  if (/^\d$/.test(event.key)) appendInput(event.key);
  else if (event.key === '-' || event.key === 'Subtract') appendInput('minus');
  else if (event.key === 'Backspace') appendInput('backspace');
  else if (event.key === 'Enter') submitAnswer(false);
});

els.headerBest.textContent = getBest();
showScreen('setup');
