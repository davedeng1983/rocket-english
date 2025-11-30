# 🔍 系统化调试指南 - 找出问题根源

## 📋 第一步：检查浏览器控制台

### 步骤 1.1：打开开发者工具
1. 按 `F12` 或 `Cmd+Option+I` (Mac)
2. 点击 **Console**（控制台）标签

### 步骤 1.2：进行测试
1. 进行一次按部分测试（例如：单项选择）
2. 完成所有题目
3. **点击提交按钮**

### 步骤 1.3：查看控制台输出
**请截图或复制以下内容：**

#### 查找这些日志：
- `[ExamRunner] 提交成功，准备显示结果页面` - 应该显示提交信息
- `[ExamRunner] 渲染结果页面` - 应该显示结果页面的状态

#### 查找错误信息：
- 红色错误信息（Error）
- 黄色警告信息（Warning）
- 任何 React 错误

**请把这些信息告诉我！**

---

## 📋 第二步：检查网络请求

### 步骤 2.1：打开 Network 标签
1. 在开发者工具中，点击 **Network**（网络）标签
2. 确保选中 **XHR** 或 **Fetch** 过滤器

### 步骤 2.2：提交试卷
1. 重新进行一次测试
2. 点击提交

### 步骤 2.3：检查 API 请求
**找到这个请求：`/api/exam-attempts/create`**

**请告诉我：**
- 状态码是什么？（200？400？500？）
- 响应内容是什么？（点击请求，查看 Response）

**请截图或复制响应内容！**

---

## 📋 第三步：检查页面状态

### 步骤 3.1：检查 URL
提交后，URL 是否有变化？
- 是否跳转到了其他页面？
- 还是停留在当前页面？

### 步骤 3.2：检查页面内容
提交后，页面上显示什么？
- 是否还停留在考试页面？
- 是否跳转到了其他页面？
- 是否显示了加载状态？

### 步骤 3.3：检查 React 组件树
1. 在开发者工具中，点击 **Components** 标签（React DevTools）
2. 如果安装了 React DevTools，查看 `ExamRunner` 组件的状态
3. 检查 `viewState` 的值是什么

---

## 📋 第四步：手动检查代码执行

### 步骤 4.1：添加断点（可选）
如果你想深入调试，可以在代码中添加断点：

在浏览器控制台执行：
```javascript
// 这会帮助我们看到状态变化
window.__debugExamRunner = true
```

### 步骤 4.2：检查本地存储
在控制台执行：
```javascript
// 检查是否有错误信息被存储
console.log('Local Storage:', localStorage)
console.log('Session Storage:', sessionStorage)
```

---

## 📋 第五步：收集信息清单

请提供以下信息：

### ✅ 必须提供：
- [ ] 浏览器控制台的完整日志（截图或文本）
- [ ] `/api/exam-attempts/create` 的响应内容
- [ ] 提交后页面的截图
- [ ] 浏览器类型和版本（Chrome/Safari/Firefox，版本号）

### ✅ 可选但很有用：
- [ ] React DevTools 中 `ExamRunner` 组件的状态
- [ ] 网络请求的完整列表（Network 标签的截图）

---

## 📋 快速测试脚本

**复制以下代码到浏览器控制台执行：**

```javascript
// 快速诊断脚本
console.log('=== 开始诊断 ===')

// 检查页面元素
const examRunner = document.querySelector('[data-testid="exam-runner"]')
console.log('ExamRunner 元素:', examRunner)

// 检查 React 状态（如果可能）
if (window.__REACT_DEVTOOLS_GLOBAL_HOOK__) {
  console.log('React DevTools 可用')
} else {
  console.log('React DevTools 不可用，请安装浏览器扩展')
}

// 检查错误
window.addEventListener('error', (e) => {
  console.error('页面错误:', e)
})

console.log('=== 诊断完成 ===')
```

---

## 📋 我需要的具体信息

**请按照以下格式回复：**

```
### 浏览器信息
- 浏览器：Chrome 120.0
- 操作系统：macOS 14.0

### 控制台日志
[粘贴日志内容]

### 网络请求
- API: /api/exam-attempts/create
- 状态码：200
- 响应：[粘贴响应内容]

### 页面状态
- 提交后URL：[当前URL]
- 页面显示：[描述看到的页面内容]
- 是否跳转：[是/否]

### 截图
[如果有截图，描述内容]
```

---

## 📋 常见问题检查

### ❓ 是否看到提交按钮的加载状态？
- 如果按钮显示"提交中..."但没有后续反应，可能是网络问题

### ❓ 是否看到任何弹窗？
- 如果有错误弹窗，请记录错误信息

### ❓ 页面是否完全卡住？
- 如果页面卡住，可能是 JavaScript 错误

### ❓ 是否有网络错误？
- 检查 Network 标签是否有失败的请求（红色标记）

---

**请按照以上步骤收集信息，我会根据这些信息快速定位问题！**

