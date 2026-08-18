const express = require('express');
const path = require('path');
const fs = require('fs');
const supabaseLib = require('./lib/supabase');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// API: Get all categories and question counts
app.get('/api/categories', (req, res) => {
  const dataDir = path.join(__dirname, 'data');
  const categories = [];
  
  const files = fs.readdirSync(dataDir).filter(f => f.endsWith('.json') && f !== 'all.json' && f !== 'knowledge.json');
  
  for (const file of files) {
    const filePath = path.join(dataDir, file);
    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    categories.push({
      key: file.replace('.json', ''),
      name: file.replace('.json', ''),
      count: data.length
    });
  }
  
  res.json(categories);
});

// API: Get questions by category
app.get('/api/questions/:category', (req, res) => {
  const category = req.params.category;
  const filePath = path.join(__dirname, 'data', `${category}.json`);
  
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Category not found' });
  }
  
  const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  res.json(data);
});

// API: Get knowledge points
app.get('/api/knowledge', (req, res) => {
  const filePath = path.join(__dirname, 'data', 'knowledge.json');
  
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Knowledge points not found' });
  }
  
  const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  res.json(data);
});

// API: Get all questions (for mixed mode)
app.get('/api/questions', (req, res) => {
  const dataDir = path.join(__dirname, 'data');
  const allQuestions = [];
  
  const files = fs.readdirSync(dataDir).filter(f => f.endsWith('.json') && f !== 'all.json' && f !== 'knowledge.json');
  
  for (const file of files) {
    const filePath = path.join(dataDir, file);
    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    allQuestions.push(...data);
  }
  
  res.json(allQuestions);
});

// ===== Sync APIs =====

// API: Check sync status
app.get('/api/sync/status', (req, res) => {
  res.json({
    enabled: supabaseLib.isConfigured,
    message: supabaseLib.isConfigured ? '同步功能已启用' : '同步功能未配置',
  });
});

// API: Save progress
app.post('/api/sync', async (req, res) => {
  try {
    const { syncCode, wrongBook, stats } = req.body;
    
    if (!syncCode) {
      return res.status(400).json({ error: '同步码不能为空' });
    }
    
    if (!supabaseLib.isConfigured) {
      return res.status(503).json({ error: '同步功能未配置' });
    }
    
    const data = await supabaseLib.saveProgress(syncCode, wrongBook || [], stats || {});
    res.json({ success: true, data });
  } catch (error) {
    console.error('Sync save error:', error);
    res.status(500).json({ error: '保存失败: ' + error.message });
  }
});

// API: Load progress
app.get('/api/sync/:code', async (req, res) => {
  try {
    const syncCode = req.params.code;
    
    if (!syncCode) {
      return res.status(400).json({ error: '同步码不能为空' });
    }
    
    if (!supabaseLib.isConfigured) {
      return res.status(503).json({ error: '同步功能未配置' });
    }
    
    const data = await supabaseLib.loadProgress(syncCode);
    
    if (!data) {
      return res.status(404).json({ error: '未找到该同步码对应的数据' });
    }
    
    res.json({ success: true, data });
  } catch (error) {
    console.error('Sync load error:', error);
    res.status(500).json({ error: '加载失败: ' + error.message });
  }
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  const isRailway = process.env.RAILWAY_ENVIRONMENT;
  if (isRailway) {
    console.log(`\n🚀 Railway 部署成功！`);
    console.log(`🌐 访问地址: https://${process.env.RAILWAY_STATIC_URL || process.env.RAILWAY_PUBLIC_DOMAIN}\n`);
  } else {
    console.log(`\n🚀 答题网站已启动！`);
    console.log(`💻 电脑访问: http://localhost:${PORT}`);
    console.log(`📱 手机访问: http://<电脑IP>:${PORT}`);
    console.log(`\n按 Ctrl+C 停止服务器\n`);
  }
});
