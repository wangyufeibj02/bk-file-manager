# 🤖 AI自然语言搜索方案

## 📋 一、方案概述

### 1.1 目标
将传统的文件名搜索升级为智能自然语言搜索，让用户可以用日常语言描述需求，系统自动理解并返回相关文件。

### 1.2 核心能力
- ✅ **自然语言理解**：理解用户意图，转换为结构化查询
- ✅ **语义搜索**：基于AI标签和文件内容进行语义匹配
- ✅ **智能推荐**：根据查询推荐相关文件
- ✅ **多模态搜索**：支持文本、图片、颜色等多种搜索方式

---

## 🎯 二、功能设计

### 2.1 支持的查询类型

#### 类型1：属性查询
- **文件类型**："找所有图片"、"显示视频文件"、"PDF文档"
- **文件大小**："大于100MB的文件"、"小于10MB的图片"
- **时间范围**："最近一周上传的"、"上个月的文件"、"2024年的视频"
- **评分**："评分4星以上的"、"高评分的图片"

#### 类型2：内容语义查询
- **图片内容**："红色的图片"、"风景照片"、"人像照片"、"产品图"
- **视频内容**："访谈视频"、"教程视频"、"演示视频"
- **文档内容**："合同文档"、"设计稿"、"报告文件"

#### 类型3：组合查询
- "最近上传的红色图片，大于5MB"
- "评分高的视频文件，最近一个月"
- "PDF文档，包含'合同'关键词"

#### 类型4：智能推荐
- "类似这张图片的文件"
- "和这个视频相关的文件"
- "推荐一些风景照片"

---

## 🏗️ 三、技术架构

### 3.1 系统架构图

```
用户输入自然语言
    ↓
[自然语言理解层]
  - 意图识别
  - 实体提取
  - 查询转换
    ↓
[查询构建层]
  - 结构化查询条件
  - 语义匹配条件
  - 排序规则
    ↓
[搜索执行层]
  - 数据库查询
  - AI标签匹配
  - 向量相似度搜索
    ↓
[结果优化层]
  - 相关性排序
  - 结果去重
  - 智能推荐
    ↓
返回搜索结果
```

### 3.2 技术栈选择

#### 方案A：轻量级方案（推荐用于快速实现）
- **自然语言理解**：本地规则引擎 + 关键词匹配
- **语义搜索**：基于现有AI标签系统
- **优点**：无需外部API，响应快，成本低
- **缺点**：理解能力有限

#### 方案B：AI增强方案（推荐用于完整功能）
- **自然语言理解**：OpenAI GPT / 本地LLM（如Ollama）
- **语义搜索**：向量数据库（如Chroma、Qdrant）+ 嵌入模型
- **优点**：理解能力强，支持复杂查询
- **缺点**：需要API密钥或本地模型，成本较高

#### 方案C：混合方案（推荐用于生产环境）
- **简单查询**：使用规则引擎（方案A）
- **复杂查询**：使用AI模型（方案B）
- **优点**：平衡成本和效果
- **缺点**：需要维护两套系统

---

## 💻 四、实现方案

### 4.1 前端UI设计

#### 搜索框增强
```typescript
// 搜索框支持自然语言输入
<SearchInput
  placeholder="试试说：'找一张红色的图片' 或 '最近上传的视频'"
  onSearch={handleNaturalLanguageSearch}
  showSuggestions={true}  // 显示搜索建议
  aiMode={true}  // AI搜索模式
/>
```

#### 搜索建议
- 输入时显示常见查询建议
- 显示历史搜索记录
- 显示AI理解的结果预览

#### 搜索结果展示
- 显示AI理解后的查询条件（可编辑）
- 高亮匹配的标签和内容
- 显示相关性评分

---

### 4.2 后端API设计

#### 新增搜索端点
```javascript
POST /api/files/search/natural
{
  "query": "找一张红色的图片",
  "options": {
    "useAI": true,
    "limit": 50,
    "threshold": 0.7  // 相关性阈值
  }
}

Response:
{
  "results": [...],
  "interpretation": {
    "originalQuery": "找一张红色的图片",
    "understoodAs": {
      "type": "image",
      "color": "red",
      "tags": ["红色系"]
    },
    "confidence": 0.95
  },
  "suggestions": ["红色的风景图", "红色产品图"]
}
```

---

### 4.3 自然语言理解实现

#### 规则引擎（方案A）
```javascript
// 自然语言理解规则
const NLU_RULES = {
  // 文件类型识别
  fileType: {
    pattern: /(图片|照片|图像|image|photo|picture)/i,
    extract: (text) => 'image'
  },
  // 颜色识别
  color: {
    pattern: /(红色|蓝色|绿色|黄色|red|blue|green|yellow)/i,
    extract: (text) => extractColor(text)
  },
  // 时间识别
  timeRange: {
    pattern: /(最近|最近一周|最近一个月|上个月|去年|2024年)/i,
    extract: (text) => parseTimeRange(text)
  },
  // 文件大小识别
  fileSize: {
    pattern: /(大于|小于|超过|不超过)\s*(\d+)\s*(MB|GB|KB)/i,
    extract: (text) => parseFileSize(text)
  }
};
```

#### AI模型理解（方案B）
```javascript
// 使用OpenAI或本地LLM
async function understandQuery(query) {
  const prompt = `将以下自然语言查询转换为JSON格式的结构化查询条件：
  
用户查询："${query}"
  
请提取以下信息：
- fileType: 文件类型（image/video/document等）
- color: 颜色（如果有）
- timeRange: 时间范围（如果有）
- fileSize: 文件大小范围（如果有）
- tags: 相关标签（如果有）
- keywords: 关键词（如果有）

返回JSON格式，只包含提取到的字段。`;

  const response = await aiModel.generate(prompt);
  return JSON.parse(response);
}
```

---

### 4.4 语义搜索实现

#### 基于AI标签的语义搜索
```javascript
// 利用现有的AI标签系统
async function semanticSearch(query, fileType) {
  // 1. 理解查询意图
  const intent = await understandQuery(query);
  
  // 2. 匹配相关标签
  const relatedTags = await findRelatedTags(intent.keywords);
  
  // 3. 搜索匹配的文件
  const files = await db.query(`
    SELECT DISTINCT f.* 
    FROM files f
    LEFT JOIN file_tags ft ON f.id = ft.file_id
    LEFT JOIN tags t ON ft.tag_id = t.id
    WHERE 
      f.type = ?
      AND (
        t.name IN (${relatedTags.map(() => '?').join(',')})
        OR f.name LIKE ?
      )
    ORDER BY 
      CASE WHEN t.name IN (...) THEN 1 ELSE 2 END,
      f.created_at DESC
  `, [fileType, ...relatedTags, `%${intent.keywords}%`]);
  
  return files;
}
```

#### 向量相似度搜索（高级功能）
```javascript
// 使用向量数据库进行语义搜索
async function vectorSearch(query, limit = 20) {
  // 1. 将查询转换为向量
  const queryVector = await embedText(query);
  
  // 2. 在向量数据库中搜索相似文件
  const results = await vectorDB.search({
    vector: queryVector,
    limit: limit,
    threshold: 0.7
  });
  
  return results;
}
```

---

## 🚀 五、实施计划

### Phase 1：基础功能（1-2周）
- [ ] 实现规则引擎的自然语言理解
- [ ] 集成现有AI标签系统
- [ ] 前端搜索框UI优化
- [ ] 基础语义搜索功能

### Phase 2：AI增强（2-3周）
- [ ] 集成OpenAI API或本地LLM
- [ ] 实现AI查询理解
- [ ] 搜索结果相关性排序
- [ ] 搜索建议功能

### Phase 3：高级功能（3-4周）
- [ ] 向量数据库集成
- [ ] 多模态搜索（图片搜索图片）
- [ ] 智能推荐功能
- [ ] 搜索历史和学习

---

## 📊 六、示例场景

### 场景1：简单查询
**用户输入**："找红色的图片"

**系统理解**：
```json
{
  "type": "image",
  "color": "red",
  "tags": ["红色系"]
}
```

**执行搜索**：查找类型为图片，标签包含"红色系"的文件

---

### 场景2：复杂查询
**用户输入**："最近上传的大于10MB的视频文件"

**系统理解**：
```json
{
  "type": "video",
  "timeRange": {
    "start": "2026-01-14",
    "end": "2026-01-21"
  },
  "fileSize": {
    "min": 10485760  // 10MB in bytes
  }
}
```

**执行搜索**：查找最近一周上传的，大小超过10MB的视频文件

---

### 场景3：语义查询
**用户输入**："找一些风景照片"

**系统理解**：
```json
{
  "type": "image",
  "tags": ["风景", "自然", "户外", "山", "海"],
  "semantic": true
}
```

**执行搜索**：
1. 查找标签包含"风景"、"自然"等的文件
2. 使用向量相似度搜索相关图片
3. 合并结果并按相关性排序

---

## 🎨 七、UI/UX设计

### 7.1 搜索框设计
```
┌─────────────────────────────────────────────┐
│ 🔍 试试说："找一张红色的图片"              │
│                                             │
│ 💡 建议：                                    │
│   • 最近上传的视频                          │
│   • 大于100MB的PDF                          │
│   • 评分高的图片                            │
└─────────────────────────────────────────────┘
```

### 7.2 搜索结果展示
```
┌─────────────────────────────────────────────┐
│ 我理解您要找：红色的图片                    │
│ [图片] [红色] [清除]                       │
│                                             │
│ 找到 23 个结果                             │
│ ┌─────┐ ┌─────┐ ┌─────┐                  │
│ │图片1│ │图片2│ │图片3│                  │
│ └─────┘ └─────┘ └─────┘                  │
└─────────────────────────────────────────────┘
```

---

## ⚙️ 八、配置选项

### 8.1 环境变量
```env
# AI搜索配置
AI_SEARCH_ENABLED=true
AI_SEARCH_PROVIDER=openai|local|ollama
OPENAI_API_KEY=your_key_here
OLLAMA_BASE_URL=http://localhost:11434

# 向量数据库配置（可选）
VECTOR_DB_ENABLED=false
VECTOR_DB_TYPE=chroma|qdrant
VECTOR_DB_URL=http://localhost:8000
```

### 8.2 功能开关
- 用户可在设置中开启/关闭AI搜索
- 管理员可配置AI搜索的默认行为
- 支持降级到传统搜索模式

---

## 📈 九、性能优化

### 9.1 缓存策略
- 缓存常见查询结果（5分钟）
- 缓存AI理解结果（1小时）
- 缓存标签关联关系

### 9.2 异步处理
- AI理解异步执行，不阻塞搜索
- 复杂查询后台处理，实时返回部分结果

### 9.3 索引优化
- 为AI标签建立索引
- 为文件元数据建立复合索引
- 向量数据库索引优化

---

## 🔒 十、安全考虑

### 10.1 输入验证
- 限制查询长度（最大500字符）
- 过滤恶意输入
- 防止SQL注入

### 10.2 API安全
- API密钥加密存储
- 请求频率限制
- 错误信息不泄露敏感信息

---

## 📝 十一、后续优化方向

1. **多语言支持**：支持英文、中文等多种语言查询
2. **语音搜索**：支持语音输入自然语言查询
3. **图片搜索**：上传图片搜索相似图片
4. **个性化搜索**：基于用户历史优化搜索结果
5. **搜索学习**：系统学习用户习惯，提升准确性

---

## 🎯 十二、推荐实施方案

### 快速启动方案（推荐）
1. **第一阶段**：实现规则引擎 + AI标签语义搜索（1-2周）
   - 快速上线基础功能
   - 验证用户需求
   - 收集使用反馈

2. **第二阶段**：根据反馈决定是否引入AI模型（2-3周）
   - 如果用户反馈好，引入OpenAI或本地LLM
   - 如果规则引擎足够，继续优化规则

3. **第三阶段**：高级功能（可选）
   - 向量数据库
   - 多模态搜索
   - 智能推荐

---

**方案制定时间**：2026年1月21日  
**方案状态**：待实施
