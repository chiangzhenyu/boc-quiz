// ===== State =====
const state = {
  questions: [],
  currentIndex: 0,
  score: 0,
  userAnswers: [],
  wrongBook: [],
  categoryMode: null,
  knowledgeIndex: 0,
  knowledgeData: [],
  isMultiAnswer: false,
  // Sync state
  syncCode: '',
  syncEnabled: false,
  syncStatus: 'unknown',
  // Cumulative stats
  cumulativeStats: {
    totalAttempted: 0,
    totalCorrect: 0,
    categoryStats: {},
  },
  statsRefreshInterval: null,
  // Settings
  autoAdvance: false, // 答对后自动跳转到下一题
  autoAdvanceTimeout: null, // 自动跳转的定时器
};

const STORAGE_KEY = 'boc_quiz_progress';
const SYNC_CODE_KEY = 'boc_quiz_sync_code';
const SYNC_STATUS_KEY = 'boc_quiz_sync_enabled';
const CUMULATIVE_STATS_KEY = 'boc_quiz_cumulative_stats';
const SESSION_KEY = 'boc_quiz_session';
const AUTO_ADVANCE_KEY = 'boc_quiz_auto_advance';

// ===== Storage =====
function saveProgress() {
  const progress = {
    wrongBook: state.wrongBook,
    totalAttempted: state.userAnswers.length,
    totalCorrect: state.userAnswers.filter(a => a.correct).length,
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  localStorage.setItem(CUMULATIVE_STATS_KEY, JSON.stringify(state.cumulativeStats));
}

// ===== Session Persistence =====
function saveSession() {
  if (state.categoryMode && state.questions.length > 0) {
    const session = {
      categoryMode: state.categoryMode,
      currentIndex: state.currentIndex,
      questions: state.questions,
      userAnswers: state.userAnswers,
      score: state.score,
      savedAt: new Date().toISOString(),
    };
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  }
}

function loadSession() {
  try {
    const saved = localStorage.getItem(SESSION_KEY);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (e) {
    return null;
  }
  return null;
}

function hasValidSession() {
  const session = loadSession();
  if (session && session.questions && session.questions.length > 0 && session.currentIndex < session.questions.length) {
    return true;
  }
  return false;
}

function continueSession() {
  const session = loadSession();
  if (session) {
    state.categoryMode = session.categoryMode;
    state.currentIndex = session.currentIndex;
    state.questions = session.questions;
    state.userAnswers = session.userAnswers;
    state.score = session.score;
    showPage('quiz');
    renderQuestion();
  }
}

function clearSession() {
  localStorage.removeItem(SESSION_KEY);
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
  
  // Load sync code
  state.syncCode = localStorage.getItem(SYNC_CODE_KEY) || '';
  const syncEnabled = localStorage.getItem(SYNC_STATUS_KEY);
  state.syncEnabled = syncEnabled === 'true';
  
  // Load cumulative stats
  try {
    const savedStats = localStorage.getItem(CUMULATIVE_STATS_KEY);
    if (savedStats) {
      state.cumulativeStats = JSON.parse(savedStats);
    }
  } catch (e) {
    state.cumulativeStats = {
      totalAttempted: 0,
      totalCorrect: 0,
      categoryStats: {},
    };
  }
  
  // Load auto-advance setting
  state.autoAdvance = localStorage.getItem(AUTO_ADVANCE_KEY) === 'true';
}

// ===== Sync Functions =====
async function checkSyncStatus() {
  try {
    const res = await fetch('/api/sync/status');
    const data = await res.json();
    state.syncStatus = data.enabled ? 'enabled' : 'disabled';
    state.syncEnabled = data.enabled;
    localStorage.setItem(SYNC_STATUS_KEY, data.enabled ? 'true' : 'false');
    return data.enabled;
  } catch (e) {
    state.syncStatus = 'disabled';
    state.syncEnabled = false;
    return false;
  }
}

async function generateSyncCode() {
  try {
    const res = await fetch('/api/sync/status');
    const data = await res.json();
    if (!data.enabled) {
      alert('同步功能未配置，请联系管理员');
      return null;
    }
    
    // Generate a random 8-character code
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let code = '';
    for (let i = 0; i < 8; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
    
    state.syncCode = code;
    localStorage.setItem(SYNC_CODE_KEY, code);
    
    // Save initial progress
    await syncToCloud();
    
    return code;
  } catch (e) {
    alert('生成同步码失败: ' + e.message);
    return null;
  }
}

async function syncToCloud() {
  if (!state.syncEnabled || !state.syncCode) return;
  
  try {
    const stats = {
      totalAttempted: state.userAnswers.length,
      totalCorrect: state.userAnswers.filter(a => a.correct).length,
    };
    
    const res = await fetch('/api/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        syncCode: state.syncCode,
        wrongBook: state.wrongBook,
        stats: stats,
      }),
    });
    
    const data = await res.json();
    if (data.success) {
      console.log('✅ 同步成功');
      return true;
    } else {
      console.error('❌ 同步失败:', data.error);
      return false;
    }
  } catch (e) {
    console.error('❌ 同步错误:', e);
    return false;
  }
}

async function syncFromCloud(syncCode) {
  if (!state.syncEnabled) {
    alert('同步功能未配置');
    return false;
  }
  
  try {
    const res = await fetch(`/api/sync/${syncCode}`);
    const data = await res.json();
    
    if (data.success) {
      // Restore progress
      state.wrongBook = data.data.wrong_book || [];
      state.syncCode = syncCode;
      localStorage.setItem(SYNC_CODE_KEY, syncCode);
      
      // Save to localStorage too
      saveProgress();
      
      return true;
    } else {
      alert('未找到该同步码对应的数据');
      return false;
    }
  } catch (e) {
    alert('同步失败: ' + e.message);
    return false;
  }
}

// ===== Navigation =====
function showPage(pageId) {
  // Clear auto-advance timeout when navigating to any page
  clearAutoAdvanceTimeout();
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById(pageId).classList.add('active');
  window.scrollTo(0, 0); // Scroll to top when navigating
}

function clearAutoAdvanceTimeout() {
  if (state.autoAdvanceTimeout) {
    clearTimeout(state.autoAdvanceTimeout);
    state.autoAdvanceTimeout = null;
  }
}

function goHome() {
  // Clear stats refresh interval
  if (state.statsRefreshInterval) {
    clearInterval(state.statsRefreshInterval);
    state.statsRefreshInterval = null;
  }
  clearAutoAdvanceTimeout(); // Clear auto-advance timeout
  showPage('home');
  loadCategories();
  updateWrongCount();
  updateSyncUI();
  
  // Show/hide continue button based on saved session
  const continueSection = document.getElementById('continue-section');
  if (continueSection) {
    if (hasValidSession()) {
      continueSection.style.display = 'block';
    } else {
      continueSection.style.display = 'none';
    }
  }
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
  clearSession(); // 清除上次的进度
  clearAutoAdvanceTimeout(); // Clear auto-advance timeout
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
  clearSession(); // 清除上次的进度
  clearAutoAdvanceTimeout(); // Clear auto-advance timeout
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
  clearAutoAdvanceTimeout(); // Clear auto-advance timeout
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

function isMultiChoice(q) {
  return q.type === '多选题' || Array.isArray(q.answer);
}

function isTrueFalse(q) {
  return q.type === '判断题';
}

function renderQuestion() {
  const q = state.questions[state.currentIndex];
  if (!q) return;

  // Update progress
  document.getElementById('current-num').textContent = state.currentIndex + 1;
  document.getElementById('total-num').textContent = state.questions.length;
  document.getElementById('score-count').textContent = state.score;

  // Update auto-advance toggle state
  const autoAdvanceCheckbox = document.getElementById('auto-advance-checkbox');
  if (autoAdvanceCheckbox) {
    autoAdvanceCheckbox.checked = state.autoAdvance;
  }

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
  state.isMultiAnswer = isMultiChoice(q);
  
  if (isTrueFalse(q)) {
    optionsList.innerHTML = q.options.map((opt, i) => `
      <div class="option" data-index="${i}" onclick="selectOption(${i})">
        <span class="option-letter">${letters[i]}</span>
        <span>${opt}</span>
      </div>
    `).join('');
  } else if (state.isMultiAnswer) {
    optionsList.innerHTML = q.options.map((opt, i) => `
      <div class="option multi" data-index="${i}" onclick="toggleMultiOption(${i})">
        <span class="option-check">${letters[i]}</span>
        <span>${opt}</span>
      </div>
    `).join('');
    optionsList.innerHTML += `
      <button class="btn btn-primary" onclick="confirmMultiAnswer()" style="margin-top: 12px;">确认选择</button>
    `;
  } else {
    optionsList.innerHTML = q.options.map((opt, i) => `
      <div class="option" data-index="${i}" onclick="selectOption(${i})">
        <span class="option-letter">${letters[i]}</span>
        <span>${opt}</span>
      </div>
    `).join('');
  }

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

  // Update question jumper input
  const jumperInput = document.getElementById('question-jumper');
  if (jumperInput) {
    jumperInput.value = state.currentIndex + 1;
    jumperInput.max = state.questions.length;
  }
}

function toggleAutoAdvance() {
  state.autoAdvance = !state.autoAdvance;
  localStorage.setItem(AUTO_ADVANCE_KEY, state.autoAdvance ? 'true' : 'false');
}

function selectOption(index) {
  const q = state.questions[state.currentIndex];
  if (state.userAnswers[state.currentIndex]) return;

  const isCorrect = index === q.answer;
  
  recordAnswer(index, isCorrect);
  showAnswerFeedback(q, index, isCorrect);
  
  // Auto-advance to next question if enabled and answer is correct
  if (state.autoAdvance && isCorrect && state.currentIndex < state.questions.length - 1) {
    state.autoAdvanceTimeout = setTimeout(() => {
      state.autoAdvanceTimeout = null;
      nextQuestion();
    }, 1000);
  }
}

function toggleMultiOption(index) {
  const q = state.questions[state.currentIndex];
  if (state.userAnswers[state.currentIndex]) return;

  const options = document.querySelectorAll('.option.multi');
  options[index].classList.toggle('selected');
}

function confirmMultiAnswer() {
  const q = state.questions[state.currentIndex];
  if (state.userAnswers[state.currentIndex]) return;

  const selected = [];
  const options = document.querySelectorAll('.option.multi');
  options.forEach((opt, i) => {
    if (opt.classList.contains('selected')) {
      selected.push(i);
    }
  });

  if (selected.length === 0) {
    alert('请至少选择一个选项！');
    return;
  }

  const correctAnswers = Array.isArray(q.answer) ? q.answer : [q.answer];
  const isCorrect = selected.length === correctAnswers.length && 
    selected.every(s => correctAnswers.includes(s));

  recordAnswer(selected, isCorrect);
  showMultiAnswerFeedback(q, selected, correctAnswers, isCorrect);
  
  // Auto-advance to next question if enabled and answer is correct
  if (state.autoAdvance && isCorrect && state.currentIndex < state.questions.length - 1) {
    state.autoAdvanceTimeout = setTimeout(() => {
      state.autoAdvanceTimeout = null;
      nextQuestion();
    }, 1000);
  }
}

function recordAnswer(selected, isCorrect) {
  const q = state.questions[state.currentIndex];
  
  state.userAnswers[state.currentIndex] = {
    questionId: q.id,
    selected: selected,
    correct: isCorrect,
    category: q.category,
  };

  // Update cumulative stats
  state.cumulativeStats.totalAttempted++;
  if (isCorrect) {
    state.score++;
    state.cumulativeStats.totalCorrect++;
    document.getElementById('score-count').textContent = state.score;
  } else {
    const existing = state.wrongBook.find(wb => wb.id === q.id);
    if (!existing) {
      state.wrongBook.push(q);
    }
  }

  // Update category stats
  if (!state.cumulativeStats.categoryStats[q.category]) {
    state.cumulativeStats.categoryStats[q.category] = { total: 0, correct: 0 };
  }
  state.cumulativeStats.categoryStats[q.category].total++;
  if (isCorrect) {
    state.cumulativeStats.categoryStats[q.category].correct++;
  }

  saveProgress();
  updateWrongCount();
  saveSession(); // 保存当前进度，支持断点续做
  
  // Auto-sync to cloud
  syncToCloud();
}

function showAnswerFeedback(q, selected, isCorrect) {
  const options = document.querySelectorAll('.option');
  options.forEach((opt, i) => {
    opt.classList.add('disabled');
    if (i === q.answer) {
      opt.classList.add('correct');
    } else if (i === selected && !isCorrect) {
      opt.classList.add('wrong');
    }
  });

  const feedback = document.getElementById('answer-feedback');
  feedback.style.display = 'block';
  feedback.className = `answer-feedback ${isCorrect ? 'correct' : 'wrong'}`;
  
  document.getElementById('feedback-icon').textContent = isCorrect ? '✅' : '❌';
  document.getElementById('feedback-text').textContent = isCorrect ? '回答正确！' : '回答错误';
  
  const correctIdx = q.answer;
  const letters = ['A', 'B', 'C', 'D', 'E', 'F'];
  document.getElementById('correct-answer').textContent = `正确答案：${letters[correctIdx]} ${q.options[correctIdx]}`;
}

function showMultiAnswerFeedback(q, selected, correctAnswers, isCorrect) {
  const options = document.querySelectorAll('.option.multi');
  options.forEach((opt, i) => {
    opt.classList.add('disabled');
    if (correctAnswers.includes(i)) {
      opt.classList.add('correct');
    } else if (selected.includes(i) && !isCorrect) {
      opt.classList.add('wrong');
    }
  });

  const feedback = document.getElementById('answer-feedback');
  feedback.style.display = 'block';
  feedback.className = `answer-feedback ${isCorrect ? 'correct' : 'wrong'}`;
  
  document.getElementById('feedback-icon').textContent = isCorrect ? '✅' : '❌';
  document.getElementById('feedback-text').textContent = isCorrect ? '回答正确！' : '回答错误';
  
  const letters = ['A', 'B', 'C', 'D', 'E', 'F'];
  const correctStr = correctAnswers.map(i => letters[i] + ' ' + q.options[i]).join('、');
  document.getElementById('correct-answer').textContent = `正确答案：${correctStr}`;
}

function prevQuestion() {
  clearAutoAdvanceTimeout(); // Clear auto-advance timeout
  if (state.currentIndex > 0) {
    state.currentIndex--;
    renderQuestion();
  }
}

function jumpToQuestion() {
  clearAutoAdvanceTimeout(); // Clear auto-advance timeout
  const input = document.getElementById('question-jumper');
  if (input) {
    const num = parseInt(input.value);
    if (num >= 1 && num <= state.questions.length) {
      state.currentIndex = num - 1;
      renderQuestion();
    }
  }
}

function nextQuestion() {
  clearAutoAdvanceTimeout(); // Clear auto-advance timeout
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
    state.knowledgeData = data;
    state.knowledgeIndex = 0;
    document.getElementById('knowledge-count').textContent = `${data.length} 条`;
    renderKnowledge();
  } catch (e) {
    console.error('Failed to load knowledge:', e);
  }
}

function renderKnowledge() {
  const container = document.getElementById('knowledge-list');
  const item = state.knowledgeData[state.knowledgeIndex];
  
  if (!item) {
    container.innerHTML = '<div class="knowledge-item"><p>暂无知识点</p></div>';
    return;
  }

  container.innerHTML = `
    <div class="knowledge-card">
      <div class="knowledge-header">
        <span class="knowledge-counter">${state.knowledgeIndex + 1} / ${state.knowledgeData.length}</span>
      </div>
      <div class="knowledge-body">
        <h4>${item.businessType}</h4>
        <p>${item.knowledge}</p>
      </div>
      <div class="knowledge-meta">
        <span class="tag">${item.remark}</span>
      </div>
      <div class="knowledge-nav">
        <button class="btn btn-secondary" onclick="prevKnowledge()" ${state.knowledgeIndex === 0 ? 'disabled' : ''}>上一个</button>
        <button class="btn btn-primary" onclick="nextKnowledge()">${state.knowledgeIndex === state.knowledgeData.length - 1 ? '完成' : '下一个'}</button>
      </div>
    </div>
  `;
}

function prevKnowledge() {
  if (state.knowledgeIndex > 0) {
    state.knowledgeIndex--;
    renderKnowledge();
  }
}

function nextKnowledge() {
  if (state.knowledgeIndex < state.knowledgeData.length - 1) {
    state.knowledgeIndex++;
    renderKnowledge();
  } else {
    goHome();
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
    container.innerHTML = state.wrongBook.map((q, i) => {
      const correctStr = Array.isArray(q.answer) ? 
        q.answer.map((a, idx) => `${['A','B','C','D','E','F'][a]}`).join('、') :
        ['A','B','C','D','E','F'][q.answer];
      return `
        <div class="knowledge-item">
          <h4>${q.question.slice(0, 50)}...</h4>
          <p>${q.question}</p>
          <div class="knowledge-meta">
            <span class="tag">${q.category}</span>
            <span class="tag">正确答案：${correctStr}</span>
          </div>
        </div>
      `;
    }).join('');
  }
}

function clearWrongBook() {
  if (confirm('确定要清空错题本吗？')) {
    state.wrongBook = [];
    saveProgress();
    updateWrongCount();
    syncToCloud();
    showWrongBook();
  }
}

function updateWrongCount() {
  document.getElementById('wrong-count').textContent = `${state.wrongBook.length} 道错题`;
}

// ===== Sync UI =====
function updateSyncUI() {
  // Add sync UI to home page if not already there
  const syncSection = document.getElementById('sync-section');
  if (!syncSection) {
    const container = document.querySelector('#home .container');
    const syncHtml = `
      <div id="sync-section" class="section">
        <h2 class="section-title">☁️ 云端同步</h2>
        <div class="sync-card">
          <div id="sync-status-off" style="display:none;">
            <p style="color:var(--text-muted);margin-bottom:12px;">开启云端同步，在任何设备都能恢复你的错题本和进度</p>
            <button class="btn btn-primary" onclick="enableSync()">开启同步</button>
          </div>
          <div id="sync-status-on" style="display:none;">
            <div class="sync-info">
              <span class="sync-label">同步码</span>
              <span class="sync-code" id="sync-code-display"></span>
            </div>
            <p style="color:var(--text-muted);font-size:12px;margin-top:8px;">在新设备上输入此同步码即可恢复进度</p>
            <div class="sync-actions">
              <button class="btn btn-secondary" onclick="copySyncCode()">复制同步码</button>
              <button class="btn btn-secondary" onclick="showSyncInput()">同步到其他设备</button>
            </div>
          </div>
          <div id="sync-status-loading">
            <p style="color:var(--text-muted);">检查同步状态...</p>
          </div>
        </div>
      </div>
    `;
    container.insertAdjacentHTML('beforeend', syncHtml);
  }
  
  updateSyncDisplay();
}

function updateSyncDisplay() {
  const offEl = document.getElementById('sync-status-off');
  const onEl = document.getElementById('sync-status-on');
  const loadingEl = document.getElementById('sync-status-loading');
  const codeDisplay = document.getElementById('sync-code-display');
  
  if (!offEl || !onEl || !loadingEl) return;
  
  loadingEl.style.display = 'none';
  
  if (state.syncEnabled && state.syncCode) {
    offEl.style.display = 'none';
    onEl.style.display = 'block';
    if (codeDisplay) codeDisplay.textContent = state.syncCode;
  } else if (state.syncEnabled) {
    // Sync enabled but no code yet
    offEl.style.display = 'block';
    onEl.style.display = 'none';
  } else {
    // Sync not configured
    offEl.style.display = 'none';
    onEl.style.display = 'none';
    loadingEl.style.display = 'block';
    loadingEl.innerHTML = '<p style="color:var(--text-muted);">同步功能未配置（服务器端 Supabase 未设置）</p>';
  }
}

async function enableSync() {
  if (!state.syncEnabled) {
    alert('服务器未配置 Supabase，无法开启同步功能');
    return;
  }
  
  const code = await generateSyncCode();
  if (code) {
    updateSyncDisplay();
    alert(`同步已开启！\n你的同步码是：${code}\n\n请牢记此码，换设备时输入即可恢复进度。`);
  }
}

function copySyncCode() {
  if (state.syncCode) {
    navigator.clipboard.writeText(state.syncCode).then(() => {
      alert('同步码已复制到剪贴板！');
    }).catch(() => {
      prompt('请复制以下同步码：', state.syncCode);
    });
  }
}

function showSyncInput() {
  const code = prompt('请输入同步码：');
  if (code && code.length === 8) {
    syncFromCloud(code).then(success => {
      if (success) {
        alert('同步成功！错题本已恢复。');
        updateSyncDisplay();
      }
    });
  } else if (code) {
    alert('同步码格式不正确，应为8位字符');
  }
}

// ===== Stats Page =====
function showStats() {
  showPage('stats');
  renderStats();
}

function renderStats() {
  // 从 localStorage 重新加载累计统计，确保数据最新
  try {
    const savedStats = localStorage.getItem(CUMULATIVE_STATS_KEY);
    if (savedStats) {
      state.cumulativeStats = JSON.parse(savedStats);
    }
  } catch (e) {
    // 忽略解析错误
  }
  
  const attempted = state.cumulativeStats.totalAttempted;
  const correct = state.cumulativeStats.totalCorrect;
  const rate = attempted > 0 ? Math.round((correct / attempted) * 100) : 0;
  
  const categories = state.cumulativeStats.categoryStats || {};

  let categoryHtml = '';
  for (const [cat, stats] of Object.entries(categories)) {
    const catRate = stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0;
    categoryHtml += `
      <div class="knowledge-item">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <span style="font-weight:600;">${cat}</span>
          <span class="tag">${stats.correct}/${stats.total} (${catRate}%)</span>
        </div>
      </div>
    `;
  }

  const content = `
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
    <div style="margin-top:16px;text-align:center;">
      <button class="btn btn-secondary" onclick="renderStats()">🔄 刷新统计</button>
    </div>
  `;
  
  const container = document.getElementById('stats-content');
  if (container) {
    container.innerHTML = content;
  }
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
checkSyncStatus().then(() => {
  goHome();
});
