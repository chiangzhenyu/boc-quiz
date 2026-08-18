const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

const EXCEL_PATH = path.join(__dirname, '..', '2025-2-6-综合服务经理知识点汇编.xlsx');
const OUTPUT_DIR = path.join(__dirname, 'data');

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// Load workbook
const workbook = XLSX.readFile(EXCEL_PATH);

/**
 * Parse question sheets (sheets 2-5)
 * 
 * Three types of questions:
 * 1. 判断题 (True/False): No option rows. Answer is "是"/"否" in column C
 * 2. 单选题 (Single Choice): Options in subsequent rows, one "是" in column C
 * 3. 多选题 (Multiple Choice): Options in subsequent rows, multiple "是" in column C
 */
function parseQuestionSheet(worksheet, categoryName) {
  const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
  const questions = [];
  
  let currentQuestion = null;
  
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;
    
    const colA = String(row[0] || '').trim();
    const colB = String(row[1] || '').trim();
    const colC = String(row[2] || '').trim();
    const colD = String(row[3] || '').trim();
    const colE = String(row[4] || '').trim();
    
    // Skip title/header rows
    if (!colA && !colB) continue;
    if (colB.includes('题库') || colB.includes('从业资格')) continue;
    if (colA === '序号' || colA === '题号') continue;
    
    // Check if this is a question row (has number in col A)
    const isQuestionRow = /^\d+$/.test(colA) && colB.length > 0;
    
    if (isQuestionRow) {
      // Save previous question
      if (currentQuestion && currentQuestion.options.length > 0) {
        finalizeQuestion(currentQuestion);
        questions.push(currentQuestion);
      }
      
      // Determine type and difficulty
      let type = colD || '单选题';
      let difficulty = colE || '';
      
      // For sheet 2 (国内结算), the structure is slightly different
      if (categoryName === '国内结算资格') {
        type = colD || '单选题';
        difficulty = '';
      }
      
      currentQuestion = {
        id: parseInt(colA),
        category: categoryName,
        type: type,
        difficulty: difficulty,
        question: colB,
        options: [],
        answer: [],
        explanation: ''
      };
      
      // Check if this is a 判断题 (True/False)
      // 判断题 has "判断题" in type column AND answer ("是"/"否") in column C
      if (type.includes('判断题') || (colC === '是' || colC === '否')) {
        currentQuestion.type = '判断题';
        currentQuestion.options = ['正确', '错误'];
        currentQuestion.answer = (colC === '是') ? 0 : 1;
      }
    } else if (currentQuestion && colB.length > 0) {
      // This is an option row (only for 单选题/多选题)
      if (currentQuestion.type !== '判断题') {
        const isCorrect = colC === '是' || colC === '正确' || colC === '√';
        const optionIndex = currentQuestion.options.length;
        currentQuestion.options.push(colB);
        
        if (isCorrect) {
          currentQuestion.answer.push(optionIndex);
        }
      }
    }
  }
  
  // Don't forget the last question
  if (currentQuestion && currentQuestion.options.length > 0) {
    finalizeQuestion(currentQuestion);
    questions.push(currentQuestion);
  }
  
  return questions;
}

/**
 * Finalize question - convert answer array to appropriate format
 */
function finalizeQuestion(q) {
  if (q.type === '判断题') {
    // Answer is already a single number
    return;
  }
  
  if (Array.isArray(q.answer)) {
    if (q.answer.length === 1) {
      q.answer = q.answer[0]; // Single choice: store as number
    } else if (q.answer.length === 0) {
      q.answer = -1; // No answer found
    }
    // If length > 1, keep as array (multi-choice)
  }
}

/**
 * Parse knowledge point sheet (sheet 1)
 */
function parseKnowledgeSheet(worksheet) {
  const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
  const knowledgePoints = [];
  
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;
    
    const colA = String(row[0] || '').trim();
    const colB = String(row[1] || '').trim();
    const colC = String(row[2] || '').trim();
    const colD = String(row[3] || '').trim();
    const colE = String(row[4] || '').trim();
    
    // Skip header
    if (colA === '序号') continue;
    if (!colA && !colB) continue;
    
    knowledgePoints.push({
      id: parseInt(colA) || (i),
      category: colB,
      businessType: colC,
      knowledge: colD,
      remark: colE
    });
  }
  
  return knowledgePoints;
}

// Process each sheet
const allData = {
  categories: [],
  knowledgePoints: []
};

// Sheet 1: Knowledge points
const sheet1 = workbook.Sheets['厅堂管理兼服务、厅堂服务题库'];
if (sheet1) {
  const kp = parseKnowledgeSheet(sheet1);
  allData.knowledgePoints = kp;
  fs.writeFileSync(path.join(OUTPUT_DIR, 'knowledge.json'), JSON.stringify(kp, null, 2), 'utf-8');
  console.log(`✓ 知识点: ${kp.length} 条`);
}

// Sheets 2-5: Questions
const questionSheets = [
  { name: '国内结算资格题库', key: '国内结算资格' },
  { name: '支付清算资格题库', key: '支付清算资格' },
  { name: '电子银行对公资格题库', key: '电子银行对公' },
  { name: '电子银行对私题库', key: '电子银行对私' }
];

let totalQuestions = 0;
let totalSingleChoice = 0;
let totalMultiChoice = 0;
let totalTrueFalse = 0;

for (const sheet of questionSheets) {
  const ws = workbook.Sheets[sheet.name];
  if (ws) {
    const questions = parseQuestionSheet(ws, sheet.key);
    
    // Count by type
    const singleChoice = questions.filter(q => q.type === '单选题').length;
    const multiChoice = questions.filter(q => q.type === '多选题').length;
    const trueFalse = questions.filter(q => q.type === '判断题').length;
    
    totalSingleChoice += singleChoice;
    totalMultiChoice += multiChoice;
    totalTrueFalse += trueFalse;
    
    // Validate: check for questions with no answer
    const noAnswer = questions.filter(q => q.answer === -1 || (Array.isArray(q.answer) && q.answer.length === 0));
    if (noAnswer.length > 0) {
      console.log(`⚠ ${sheet.key}: ${noAnswer.length} 题无答案`);
    }
    
    allData.categories.push({
      key: sheet.key,
      name: sheet.key,
      count: questions.length,
      questions: questions
    });
    
    totalQuestions += questions.length;
    
    fs.writeFileSync(
      path.join(OUTPUT_DIR, `${sheet.key}.json`),
      JSON.stringify(questions, null, 2),
      'utf-8'
    );
    console.log(`✓ ${sheet.key}: ${questions.length} 题 (单选 ${singleChoice}, 多选 ${multiChoice}, 判断 ${trueFalse})`);
  } else {
    console.log(`✗ ${sheet.key}: 未找到`);
  }
}

// Save combined data
fs.writeFileSync(
  path.join(OUTPUT_DIR, 'all.json'),
  JSON.stringify(allData, null, 2),
  'utf-8'
);

console.log('\n=== 解析完成 ===');
console.log(`总题目数: ${totalQuestions}`);
console.log(`单选题: ${totalSingleChoice}`);
console.log(`多选题: ${totalMultiChoice}`);
console.log(`判断题: ${totalTrueFalse}`);
console.log(`知识点数: ${allData.knowledgePoints.length}`);
