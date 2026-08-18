// ===== State =====
const state = {
  questions: [],
  currentIndex: 0,
  score: 0,
  userAnswers: [], // { questionId, selected, correct }
  wrongBook: [],
  categoryMode: null, // null = mixed, string = category key, 'wrong' = wrong book practice
};

const STORAGE_KEY = 'boc_quiz_progress';

// ===== Storage =====
function saveProgress() {
  const progress = {
    wrongBook: state.wrongBook,
    totalAttempted: state.userAnswers.length,
    totalCorrect: state.userAnswers.filter(a => a.correct).length,
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
}

function loadProgress() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const progress = JSON.parse(saved);
      state.wrongBook = progress.wrongBook || [];
    }
  } catch (e) {
    state.wrongBook = [];
  }
}

// ===== Navigation =====
function showPage(pageId) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById(pageId).classList.add('active');
}

function goHome() {
  showPage('home');
  loadCategories();
  updateWrongCount();
}

// ===== Load Categories =====
async function loadCategories() {
  try {
    const res = await fetch('/api/categories');
    const categories = await res.json();
    const container = document.getElementById('category-list');
    container.innerHTML = categories.map(cat => `
      <div class="category-card" onclick="startCategory('${cat.key}')">
        <div class="category-info">
          <h3>${cat.name}</h3>
          <p>${cat.count} 题</p>
        </div>
        <span class="category-arrow">→</span>
      </div>
    `).join('');
  } catch (e) {
    console.error('Failed to load categories:', e);
  }
}

// ===== Quiz Logic =====
async function startCategory(category) {
  state.categoryMode = category;
  try {
    const res = await fetch(`/api/questions/${category}`);
    const questions = await res.json();
    state.questions = shuffleArray(questions);
    resetQuiz();
    showPage('quiz');
    renderQuestion();
  } catch (e) {
    console.error('Failed to start category:', e);
  }
}

async function startMixedMode() {
  state.categoryMode = null;
  try {
    const res = await fetch('/api/questions');
    const questions = await res.json();
    state.questions = shuffleArray(questions);
    resetQuiz();
    showPage('quiz');
    renderQuestion();
  } catch (e) {
    console.error('Failed to start mixed mode:', e);
  }
}

function startWrongPractice() {
  if (state.wrongBook.length === 0) {
    alert('错题本为空，先去做题吧！');
    return;
  }
  state.categoryMode = 'wrong';
  state.questions = shuffleArray([...state.wrongBook]);
  resetQuiz();
  showPage('quiz');
  renderQuestion();
}

function resetQuiz() {
  state.currentIndex = 0;
  state.score = 0;
  state.userAnswers = [];
}

function renderQuestion() {
  const q = state.questions[state.currentIndex];
  if (!q) return;

  // Update progress
  document.getElementById('current-num').textContent = state.currentIndex + 1;
  document.getElementById('total-num').textContent = state.questions.length;
  document.getElementById('score-count').textContent = state.score;

  // Update meta
  const categoryEl = document.getElementById('q-category');
  categoryEl.textContent = q.category || '未知分类';
  
  const difficultyEl = document.getElementById('q-difficulty');
  if (q.difficulty) {
    difficultyEl.textContent = q.difficulty;
    difficultyEl.style.display = 'inline-block';
  } else {
    difficultyEl.style.display = 'none';
  }

  const typeEl = document.getElementById('q-type');
  typeEl.textContent = q.type || '单选题';

  // Question text
  document.getElementById('question-text').textContent = q.question;

  // Options
  const optionsList = document.getElementById('options-list');
  const letters = ['A', 'B', 'C', 'D', 'E', 'F'];
  optionsList.innerHTML = q.options.map((opt, i) => `
    <div class="option" data-index="${i}" onclick="selectOption(${i})">
      <span class="option-letter">${letters[i]}</span>
      <span>${opt}</span>
    </div>
  `).join('');

  // Hide feedback
  document.getElementById('answer-feedback').style.display = 'none';

  // Update buttons
  document.getElementById('btn-prev').style.display = state.currentIndex > 0 ? 'block' : 'none';
  const nextBtn = document.getElementById('btn-next');
  if (state.currentIndex === state.questions.length - 1) {
    nextBtn.textContent = '查看结果';
  } else {
    nextBtn.textContent = '下一题';
  }
}

function selectOption(index) {
  const q = state.questions[state.currentIndex];
  const options = document.querySelectorAll('.option');
  
  // Check if already answered
  if (state.userAnswers[state.currentIndex]) return;

  const isCorrect = index === q.answer;
  
  // Record answer
  state.userAnswers[state.currentIndex] = {
    questionId: q.id,
    selected: index,
    correct: isCorrect,
    category: q.category,
  };

  if (isCorrect) {
    state.score++;
    document.getElementById('score-count').textContent = state.score;
  } else {
    // Add to wrong book
    const existing = state.wrongBook.find(wb => wb.id === q.id);
    if (!existing) {
      state.wrongBook.push(q);
    }
  }

  // Update UI
  options.forEach((opt, i) => {
    opt.classList.add('disabled');
    if (i === q.answer) {
      opt.classList.add('correct');
    } else if (i === index && !isCorrect) {
      opt.classList.add('wrong');
    }
  });

  // Show feedback
  const feedback = document.getElementById('answer-feedback');
  feedback.style.display = 'block';
  feedback.className = `answer-feedback ${isCorrect ? 'correct' : 'wrong'}`;
  
  document.getElementById('feedback-icon').textContent = isCorrect ? '✅' : '❌';
  document.getElementById('feedback-text').textContent = isCorrect ? '回答正确！' : '回答错误';
  
  const correctIdx = q.answer;
  const letters = ['A', 'B', 'C', 'D', 'E', 'F'];
  document.getElementById('correct-answer').textContent = `正确答案：${letters[correctIdx]} ${q.options[correctIdx]}`;

  // Save progress
  saveProgress();
  updateWrongCount();
}

function prevQuestion() {
  if (state.currentIndex > 0) {
    state.currentIndex--;
    renderQuestion();
  }
}

function nextQuestion() {
  if (state.currentIndex < state.questions.length - 1) {
    state.currentIndex++;
    renderQuestion();
  } else {
    showResult();
  }
}

function showResult() {
  const total = state.questions.length;
  const correct = state.score;
  const wrong = total - correct;
  const rate = Math.round((correct / total) * 100);

  document.getElementById('result-total').textContent = total;
  document.getElementById('result-correct').textContent = correct;
  document.getElementById('result-wrong').textContent = wrong;
  document.getElementById('result-rate').textContent = rate + '%';

  let icon, title;
  if (rate >= 90) {
    icon = '🏆'; title = '优秀！';
  } else if (rate >= 70) {
    icon = '🎉'; title = '不错！';
  } else if (rate >= 60) {
    icon = '👍'; title = '及格！';
  } else {
    icon = '💪'; title = '继续努力！';
  }
  document.getElementById('result-icon').textContent = icon;
  document.getElementById('result-title').textContent = title;

  // Update retry button visibility
  const retryBtn = document.querySelector('.result-actions .btn-secondary');
  retryBtn.style.display = wrong > 0 ? 'block' : 'none';

  showPage('result');
}

function retryWrong() {
  if (state.wrongBook.length === 0) {
    goHome();
    return;
  }
  startWrongPractice();
}

// ===== Knowledge Page =====
async function showKnowledgePage() {
  showPage('knowledge');
  try {
    const res = await fetch('/api/knowledge');
    const data = await res.json();
    document.getElementById('knowledge-count').textContent = `${data.length} 条`;
    
    const container = document.getElementById('knowledge-list');
    container.innerHTML = data.map(item => `
      <div class="knowledge-item">
        <h4>${item.knowledge.slice(0, 60)}${item.knowledge.length > 60 ? '...' : ''}</h4>
        <p>${item.knowledge}</p>
        <div class="knowledge-meta">
          <span class="tag">${item.businessType}</span>
          <span class="tag">${item.remark}</span>
        </div>
      </div>
    `).join('');
  } catch (e) {
    console.error('Failed to load knowledge:', e);
  }
}

// ===== Wrong Book =====
function showWrongBook() {
  showPage('wrongbook');
  const container = document.getElementById('wrongbook-list');
  const count = state.wrongBook.length;
  
  document.getElementById('wrongbook-count').textContent = `${count} 道`;
  
  if (count === 0) {
    container.innerHTML = '<div class="knowledge-item"><p>暂无错题，继续加油！</p></div>';
    document.getElementById('wrongbook-actions').style.display = 'none';
  } else {
    document.getElementById('wrongbook-actions').style.display = 'flex';
    container.innerHTML = state.wrongBook.map((q, i) => `
      <div class="knowledge-item">
        <h4>${q.question.slice(0, 50)}...</h4>
        <p>${q.question}</p>
        <div class="knowledge-meta">
          <span class="tag">${q.category}</span>
          <span class="tag">第 ${i + 1} 题</span>
        </div>
      </div>
    `).join('');
  }
}

function clearWrongBook() {
  if (confirm('确定要清空错题本吗？')) {
    state.wrongBook = [];
    saveProgress();
    updateWrongCount();
    showWrongBook();
  }
}

function updateWrongCount() {
  document.getElementById('wrong-count').textContent = `${state.wrongBook.length} 道错题`;
}

// ===== Stats Page =====
function showStats() {
  showPage('stats');
  const attempted = state.userAnswers.length;
  const correct = state.userAnswers.filter(a => a.correct).length;
  const rate = attempted > 0 ? Math.round((correct / attempted) * 100) : 0;
  
  // Category breakdown
  const categories = {};
  state.userAnswers.forEach(a => {
    if (!categories[a.category]) {
      categories[a.category] = { total: 0, correct: 0 };
    }
    categories[a.category].total++;
    if (a.correct) categories[a.category].correct++;
  });

  let categoryHtml = '';
  for (const [cat, stats] of Object.entries(categories)) {
    const catRate = Math.round((stats.correct / stats.total) * 100);
    categoryHtml += `
      <div class="knowledge-item">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <span style="font-weight:600;">${cat}</span>
          <span class="tag">${stats.correct}/${stats.total} (${catRate}%)</span>
        </div>
      </div>
    `;
  }

  document.getElementById('stats-content').innerHTML = `
    <div class="stat-card">
      <h3>总答题数</h3>
      <div class="value">${attempted}</div>
      <div class="label">道题</div>
    </div>
    <div class="stat-card">
      <h3>正确率</h3>
      <div class="value">${rate}%</div>
      <div class="label">${correct} / ${attempted}</div>
    </div>
    <div class="stat-card">
      <h3>错题数</h3>
      <div class="value">${state.wrongBook.length}</div>
      <div class="label">道题</div>
    </div>
    ${categoryHtml ? '<h3 style="margin-top:16px;font-size:14px;color:var(--text-muted);">分类统计</h3>' + categoryHtml : ''}
  `;
}

// ===== Utilities =====
function shuffleArray(arr) {
  const shuffled = [...arr];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

// ===== Init =====
loadProgress();
goHome();
