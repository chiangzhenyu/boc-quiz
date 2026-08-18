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
 * Pattern: question row has number in col A, followed by option rows
 * Option rows have "是" in col C to mark correct answer
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
        questions.push(currentQuestion);
      }
      
      // Determine type and difficulty
      let type = colD || '单选题';
      let difficulty = colE || '';
      
      // For sheet 2 (国内结算), the structure is slightly different
      // col D is type, no difficulty column
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
        answer: -1,
        explanation: ''
      };
    } else if (currentQuestion && colB.length > 0) {
      // This is an option row
      const isCorrect = colC === '是' || colC === '正确' || colC === '√';
      const optionIndex = currentQuestion.options.length;
      currentQuestion.options.push(colB);
      
      if (isCorrect) {
        currentQuestion.answer = optionIndex;
      }
    }
  }
  
  // Don't forget the last question
  if (currentQuestion && currentQuestion.options.length > 0) {
    questions.push(currentQuestion);
  }
  
  return questions;
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

for (const sheet of questionSheets) {
  const ws = workbook.Sheets[sheet.name];
  if (ws) {
    const questions = parseQuestionSheet(ws, sheet.key);
    
    // Validate: check for questions with no answer
    const noAnswer = questions.filter(q => q.answer === -1);
    if (noAnswer.length > 0) {
      console.log(`⚠ ${sheet.key}: ${noAnswer.length} 题无答案 (共 ${questions.length} 题)`);
    }
    
    allData.categories.push({
      key: sheet.key,
      name: sheet.key,
      count: questions.length,
      questions: questions
    });
    
    fs.writeFileSync(
      path.join(OUTPUT_DIR, `${sheet.key}.json`),
      JSON.stringify(questions, null, 2),
      'utf-8'
    );
    console.log(`✓ ${sheet.key}: ${questions.length} 题`);
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
console.log(`总题目数: ${allData.categories.reduce((sum, c) => sum + c.count, 0)}`);
console.log(`知识点数: ${allData.knowledgePoints.length}`);
