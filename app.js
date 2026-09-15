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
  courseDescription: $('#course-description'),
  gameTime: $('#game-time'),
  score: $('#score'),
  streak: $('#streak'),
  gameProgress: $('#game-progress'),
  questionNumber: $('#question-number'),
  questionType: $('#question-type'),
  questionTime: $('#question-time'),
  questionProgress: $('#question-progress'),
  problem: $('#problem'),
  answerHint: $('#answer-hint'),
  answerDisplay: $('#answer-display'),
  feedback: $('#feedback'),
  resultCourse: $('#result-course'),
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

let state = null;
let animationFrame = null;
let lastSettings = null;

function showScreen(name) {
  Object.entries(screens).forEach(([key, node]) => node.classList.toggle('hidden', key !== name));
}

function getBest(course = 'elementary') {
  return Number(localStorage.getItem(`mentalMathBest-${course}`) || 0);
}

function setBest(course, value) {
  localStorage.setItem(`mentalMathBest-${course}`, String(value));
  els.headerBest.textContent = value;
}

function readSettings() {
  return {
    course: $('input[name="course"]:checked').value,
    difficulty: $('input[name="difficulty"]:checked').value,
    duration: Number($('input[name="duration"]:checked').value),
    questionLimit: Number($('input[name="question-limit"]:checked').value)
  };
}

function rand(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function choose(items) {
  return items[rand(0, items.length - 1)];
}

function gcd(a, b) {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b) [a, b] = [b, a % b];
  return a || 1;
}

function normalizeFraction(numerator, denominator) {
  if (denominator < 0) {
    numerator *= -1;
    denominator *= -1;
  }
  const d = gcd(numerator, denominator);
  return { n: numerator / d, d: denominator / d };
}

function fractionText(n, d) {
  const f = normalizeFraction(n, d);
  if (f.d === 1) return String(f.n);
  return `${f.n}/${f.d}`;
}

function parseAnswer(input) {
  const value = input.trim().replace(/−/g, '-');
  if (/^-?\d+$/.test(value)) return { valid: true, value: Number(value) };
  const match = value.match(/^(-?\d+)\/(\d+)$/);
  if (!match || Number(match[2]) === 0) return { valid: false, value: NaN };
  return { valid: true, value: Number(match[1]) / Number(match[2]) };
}

function elementaryRange(level, operation) {
  if (level === 'easy') return operation === 'mul' || operation === 'div' ? [2, 9] : [1, 20];
  if (level === 'normal') return operation === 'mul' || operation === 'div' ? [2, 12] : [10, 100];
  return operation === 'mul' || operation === 'div' ? [3, 20] : [25, 500];
}

function makeElementaryQuestion() {
  const operation = choose(['add', 'sub', 'mul', 'div']);
  const [min, max] = elementaryRange(state.settings.difficulty, operation);
  let a, b, answer, text;

  if (operation === 'add') {
    a = rand(min, max);
    b = rand(min, max);
    answer = a + b;
    text = `${a} ＋ ${b}`;
  } else if (operation === 'sub') {
    a = rand(min, max);
    b = rand(min, a);
    answer = a - b;
    if (answer <= 0) {
      a += 1;
      answer = a - b;
    }
    text = `${a} − ${b}`;
  } else if (operation === 'mul') {
    a = rand(min, max);
    b = rand(min, max);
    answer = a * b;
    text = `${a} × ${b}`;
  } else {
    b = rand(min, max);
    answer = rand(min, max);
    a = b * answer;
    text = `${a} ÷ ${b}`;
  }

  return {
    type: '四則演算',
    text,
    answerValue: answer,
    answerText: String(answer),
    hint: '正の整数で答えてください'
  };
}

function makeSignedQuestion(level) {
  const range = level === 'easy' ? 10 : level === 'normal' ? 20 : 50;
  const a = rand(-range, range) || 1;
  const b = rand(-range, range) || -2;
  const op = choose(['＋', '−', '×']);
  let answer;
  if (op === '＋') answer = a + b;
  else if (op === '−') answer = a - b;
  else answer = a * b;
  return {
    type: '正負の数',
    text: `${a} ${op} (${b})`,
    answerValue: answer,
    answerText: String(answer),
    hint: '整数で答えてください'
  };
}

function makeFractionQuestion(level) {
  const maxDen = level === 'easy' ? 8 : level === 'normal' ? 12 : 20;
  const d1 = rand(2, maxDen);
  const d2 = rand(2, maxDen);
  const n1 = rand(1, d1 - 1);
  const n2 = rand(1, d2 - 1);
  const op = choose(['＋', '−', '×']);
  let n, d;
  if (op === '＋') {
    n = n1 * d2 + n2 * d1;
    d = d1 * d2;
  } else if (op === '−') {
    const left = n1 / d1;
    const right = n2 / d2;
    if (left < right) return makeFractionQuestion(level);
    n = n1 * d2 - n2 * d1;
    d = d1 * d2;
  } else {
    n = n1 * n2;
    d = d1 * d2;
  }
  const f = normalizeFraction(n, d);
  return {
    type: '分数',
    text: `${n1}/${d1} ${op} ${n2}/${d2}`,
    answerValue: f.n / f.d,
    answerText: fractionText(f.n, f.d),
    hint: '約分した分数（例 3/4）で答えてください'
  };
}

function makeExponentQuestion(level) {
  const baseMax = level === 'easy' ? 6 : level === 'normal' ? 10 : 15;
  const exponent = level === 'hard' ? choose([2, 3]) : 2;
  const a = rand(2, baseMax);
  const b = rand(1, level === 'easy' ? 20 : 50);
  const op = choose(['＋', '−']);
  const power = a ** exponent;
  const answer = op === '＋' ? power + b : power - b;
  return {
    type: '指数',
    text: `${a}<sup>${exponent}</sup> ${op} ${b}`,
    html: true,
    answerValue: answer,
    answerText: String(answer),
    hint: '整数で答えてください'
  };
}

function makeAlgebraQuestion(level) {
  const x = rand(-9, 9) || 2;
  const a = rand(2, level === 'hard' ? 12 : 8);
  const b = rand(-15, 15);
  const result = a * x + b;
  const sign = b >= 0 ? `＋ ${b}` : `− ${Math.abs(b)}`;
  const style = choose(['equation', 'substitute']);

  if (style === 'substitute') {
    return {
      type: '文字式',
      text: `x = ${x} のとき　${a}x ${sign}`,
      answerValue: result,
      answerText: String(result),
      hint: '式に代入して整数で答えてください'
    };
  }

  return {
    type: '一次方程式',
    text: `${a}x ${sign} = ${result}`,
    answerValue: x,
    answerText: String(x),
    hint: 'x の値を答えてください'
  };
}

function makeJuniorQuestion() {
  const level = state.settings.difficulty;
  const factories = [
    () => makeSignedQuestion(level),
    () => makeFractionQuestion(level),
    () => makeExponentQuestion(level),
    () => makeAlgebraQuestion(level)
  ];
  return choose(factories)();
}

function makeQuestion() {
  return state.settings.course === 'elementary'
    ? makeElementaryQuestion()
    : makeJuniorQuestion();
}

function startGame(settings = readSettings()) {
  els.setupError.textContent = '';
  cancelAnimationFrame(animationFrame);
  lastSettings = { ...settings };
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
  els.headerBest.textContent = getBest(settings.course);
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
  els.questionType.textContent = state.question.type;
  if (state.question.html) els.problem.innerHTML = state.question.text;
  else els.problem.textContent = state.question.text;
  els.answerHint.textContent = state.question.hint;
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
  } else if (value === 'slash') {
    if (state.input && !state.input.includes('/')) state.input += '/';
  } else if (value === 'backspace') {
    state.input = state.input.slice(0, -1);
  } else if (/^\d$/.test(value)) {
    if (state.input.length < 12) state.input += value;
  }
  els.answerDisplay.textContent = state.input || '?';
}

function submitAnswer(timedOut = false) {
  if (!state?.active || state.locked) return;
  if (!timedOut && (state.input === '' || state.input === '-')) return;

  const parsed = timedOut ? { valid: false, value: NaN } : parseAnswer(state.input);
  if (!timedOut && !parsed.valid) {
    els.feedback.textContent = '入力形式を確認してください';
    els.feedback.className = 'feedback wrong';
    return;
  }

  state.locked = true;
  state.total += 1;
  const elapsed = Math.max(0, (performance.now() - state.questionStartedAt) / 1000);
  state.answerTimes.push(Math.min(elapsed, state.settings.questionLimit));
  const correct = !timedOut && Math.abs(parsed.value - state.question.answerValue) < 1e-10;

  if (correct) {
    state.correct += 1;
    state.streak += 1;
    state.maxStreak = Math.max(state.maxStreak, state.streak);
    const speedBonus = Math.max(0, Math.ceil((state.settings.questionLimit - elapsed) * 2));
    const streakBonus = Math.min(state.streak - 1, 10);
    const courseBonus = state.settings.course === 'junior' ? 5 : 0;
    const points = 10 + speedBonus + streakBonus + courseBonus;
    state.score += points;
    els.feedback.textContent = `正解！ +${points}点`;
    els.feedback.className = 'feedback correct';
  } else {
    state.streak = 0;
    state.mistakes.push({
      ...state.question,
      given: timedOut ? null : state.input,
      timedOut
    });
    els.feedback.textContent = timedOut
      ? `時間切れ！ 正解は ${state.question.answerText}`
      : `おしい！ 正解は ${state.question.answerText}`;
    els.feedback.className = 'feedback wrong';
  }

  updateStats();
  setTimeout(() => {
    if (state?.active && performance.now() < state.endTime) nextQuestion();
  }, 360);
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
  const previousBest = getBest(state.settings.course);
  const best = Math.max(previousBest, state.score);
  if (best !== previousBest) setBest(state.settings.course, best);

  els.resultCourse.textContent = state.settings.course === 'elementary' ? '小学生コース' : '中学生コース';
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
    const problem = item.html ? item.text : item.text.replace(/</g, '&lt;').replace(/>/g, '&gt;');
    row.innerHTML = `<strong>${problem} = ${item.answerText}</strong><span>あなた: ${yourAnswer}</span>`;
    els.reviewList.appendChild(row);
  });
}

function updateCourseDescription() {
  const course = $('input[name="course"]:checked').value;
  els.courseDescription.textContent = course === 'elementary'
    ? 'たし算・ひき算・かけ算・わり算を毎問ランダムに出題します。使う数と答えは正の整数だけです。'
    : '正負の数・分数・指数・文字式／一次方程式を毎問ランダムに出題します。問題の種類も数値も毎回変わります。';
  els.headerBest.textContent = getBest(course);
}

els.start.addEventListener('click', () => startGame());
els.retry.addEventListener('click', () => startGame(lastSettings));
els.settings.addEventListener('click', () => {
  showScreen('setup');
  updateCourseDescription();
});

$$('input[name="course"]').forEach((input) => input.addEventListener('change', updateCourseDescription));

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
  else if (event.key === '/') appendInput('slash');
  else if (event.key === 'Backspace') appendInput('backspace');
  else if (event.key === 'Enter') submitAnswer(false);
});

updateCourseDescription();
showScreen('setup');
