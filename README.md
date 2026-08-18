# BOC 题库练习网站

> 银行从业资格考试题库局域网/公网答题系统

---

## 📋 项目概述

本项目是一个基于 Node.js + Express 的在线答题系统，支持银行从业资格考试的刷题练习。题目数据来源于 Excel 题库，支持单选题、多选题、判断题三种题型，并提供知识点浏览、错题本、刷题统计、云端同步等功能。

**在线访问地址：** https://boc-quiz-production.up.railway.app

---

## 🛠️ 技术栈

| 层级 | 技术 |
|------|------|
| **后端** | Node.js + Express |
| **前端** | 原生 HTML / CSS / JavaScript |
| **数据库** | Supabase (PostgreSQL) |
| **部署** | Railway |
| **数据格式** | JSON |

---

## ✨ 功能特性

### 核心功能

| 功能 | 说明 |
|------|------|
| **分类刷题** | 按 5 个类别选择，支持混合刷题 |
| **三种题型** | 单选题、多选题、判断题 |
| **即时反馈** | 答题后立即显示对错和正确答案 |
| **错题本** | 自动收集错题，支持错题重做 |
| **知识点浏览** | 厅堂服务 326 条知识点汇编 |
| **刷题统计** | 总答题数、正确率、分类统计 |
| **云端同步** | 跨设备同步错题本和进度 |
| **断点续做** | 自动保存进度，下次继续上次答题 |
| **题号跳转** | 输入题号直接跳转到指定题目 |

### 题目数据

| 工作表 | 题量 | 单选 | 多选 | 判断 |
|--------|------|------|------|------|
| 国内结算资格 | 473 | 187 | 97 | 189 |
| 支付清算资格 | 300 | 140 | 90 | 70 |
| 电子银行对公 | 165 | 60 | 60 | 45 |
| 电子银行对私 | 57 | 20 | 15 | 22 |
| **总计** | **995** | **407** | **262** | **326** |

---

## 📁 项目结构

```
quiz-site/
├── server.js              # Express 服务器（入口文件）
├── parse-excel.js         # Excel → JSON 解析脚本
├── package.json           # 项目配置
├── .gitignore             # Git 忽略文件
├── lib/
│   └── supabase.js        # Supabase 客户端模块
├── data/                  # 题目数据（JSON 格式）
│   ├── 国内结算资格.json
│   ├── 支付清算资格.json
│   ├── 电子银行对公.json
│   ├── 电子银行对私.json
│   ├── knowledge.json     # 知识点数据
│   └── all.json           # 全部数据
└── public/                # 前端文件
    ├── index.html         # 主页面
    ├── style.css          # 样式
    └── app.js             # 前端交互逻辑
```

---

## 🚀 本地运行

### 1. 安装依赖

```bash
cd quiz-site
npm install
```

### 2. 启动服务器

```bash
npm start
```

### 3. 访问

- 电脑访问：http://localhost:3000
- 手机访问：http://<电脑IP>:3000（同一 WiFi）

---

## 🌐 部署到 Railway

### 1. 创建 Supabase 项目

1. 在 [supabase.com](https://supabase.com) 创建项目
2. 在 SQL Editor 中执行以下 SQL：

```sql
CREATE TABLE IF NOT EXISTS user_progress (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  sync_code TEXT UNIQUE NOT NULL,
  wrong_book JSONB DEFAULT '[]'::jsonb,
  stats JSONB DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE user_progress DISABLE ROW LEVEL SECURITY;
```

3. 获取 API 密钥（Settings → API）

### 2. 部署到 Railway

1. 代码推送到 GitHub
2. 在 [railway.app](https://railway.app) 创建项目 → 关联 GitHub 仓库
3. 设置环境变量：

| 变量名 | 值 |
|--------|-----|
| `SUPABASE_URL` | `https://xxxxx.supabase.co` |
| `SUPABASE_ANON_KEY` | `eyJhbGciOiJIUzI1NiIs...` |

4. Railway 自动部署完成

---

## 📡 API 接口

### 题目接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/categories` | 获取分类列表和题目数量 |
| GET | `/api/questions/:category` | 获取指定分类的题目 |
| GET | `/api/questions` | 获取全部题目（混合模式） |
| GET | `/api/knowledge` | 获取知识点列表 |

### 同步接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/sync/status` | 检查同步功能是否启用 |
| POST | `/api/sync` | 保存用户进度到云端 |
| GET | `/api/sync/:code` | 从云端加载用户进度 |

### 请求示例

**保存进度：**
```bash
curl -X POST https://boc-quiz-production.up.railway.app/api/sync \
  -H "Content-Type: application/json" \
  -d '{
    "syncCode": "abc12345",
    "wrongBook": [{"id": 1, "question": "...", "answer": [0,1]}],
    "stats": {"totalAttempted": 10, "totalCorrect": 8}
  }'
```

**加载进度：**
```bash
curl https://boc-quiz-production.up.railway.app/api/sync/abc12345
```

---

## 🔧 数据更新

### 修改题目后重新生成 JSON

1. 修改 Excel 文件
2. 运行解析脚本：

```bash
node parse-excel.js
```

3. 推送到 GitHub：

```bash
git add . && git commit -m "更新题目" && git push
```

4. Railway 自动重新部署

---

## ⚠️ 已知问题与修复

### 问题 1：Excel 解析漏掉判断题

**原因：** 原解析器只识别纵向排列的选项，没有识别判断题（答案直接在题目行）

**修复：** 增加判断题识别逻辑：
```javascript
// 判断题特征：type 为 "判断题" 或答案为 "是"/"否"
if (type.includes('判断题') || (colC === '是' || colC === '否')) {
  currentQuestion.type = '判断题';
  currentQuestion.options = ['正确', '错误'];
  currentQuestion.answer = (colC === '是') ? 0 : 1;
}
```

### 问题 2：多选题答案只记录一个

**原因：** 原解析器用 `currentQuestion.answer = optionIndex` 覆盖之前的值

**修复：** 改用数组收集所有正确答案：
```javascript
// 初始化为数组
answer: []

// 收集所有正确答案
if (isCorrect) {
  currentQuestion.answer.push(optionIndex);
}

// 最终处理：单元素数组转为数字
if (q.answer.length === 1) {
  q.answer = q.answer[0];
}
```

### 问题 3：统计页面数据不更新

**原因：** `state.cumulativeStats` 可能和 localStorage 数据不同步

**修复：** 每次 `renderStats()` 时从 localStorage 重新加载：
```javascript
function renderStats() {
  const savedStats = localStorage.getItem(CUMULATIVE_STATS_KEY);
  if (savedStats) {
    state.cumulativeStats = JSON.parse(savedStats);
  }
  // ...
}
```

### 问题 4：分类统计只在答错时更新

**原因：** 分类统计更新代码放在了 `else` 分支里

**修复：** 将分类统计更新移到 `if/else` 外面：
```javascript
// 更新 category stats
if (!state.cumulativeStats.categoryStats[q.category]) {
  state.cumulativeStats.categoryStats[q.category] = { total: 0, correct: 0 };
}
state.cumulativeStats.categoryStats[q.category].total++;
if (isCorrect) {
  state.cumulativeStats.categoryStats[q.category].correct++;
}
```

---

## 🎯 功能截图说明

### 首页
- 5 个分类卡片，显示题目数量
- 4 个模式卡片：混合刷题、知识点、错题本、统计
- 云端同步区域（需配置 Supabase）

### 答题页面
- 题目分类、难度、题型标签
- 答题进度和得分显示
- 单选/多选/判断三种答题方式
- 即时反馈对错和正确答案

### 统计页面
- 总答题数、正确率、错题数
- 分类统计（按资格类别）
- 手动刷新按钮

### 知识点页面
- 一页一个知识点
- 上一个/下一个导航
- 业务类型和备注标签

### 错题本页面
- 错题列表，显示正确答案
- 练习错题 / 清空错题功能

---

## 📝 环境变量

| 变量名 | 说明 | 获取方式 |
|--------|------|----------|
| `PORT` | 服务器端口 | Railway 自动设置 |
| `SUPABASE_URL` | Supabase 项目 URL | Supabase → Settings → API |
| `SUPABASE_ANON_KEY` | Supabase 匿名密钥 | Supabase → Settings → API |

---

## 📄 许可证

本项目仅用于个人学习交流，题目版权归原作者所有。

---

## 👤 作者

**jiangzhenyu**

- GitHub: [chiangzhenyu](https://github.com/chiangzhenyu)
- Email: 321006767@qq.com

---

> 📅 最后更新：2026-08-18
