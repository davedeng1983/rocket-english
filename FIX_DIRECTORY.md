# 目录问题修复指南

## 问题说明

你遇到了 `ENOENT: no such file or directory, uv_cwd` 错误，这是因为：

1. **项目目录已重命名**：从 `englishstudy_APP` 重命名为 `rocketenglish-app`
2. **终端还在旧目录**：你的终端可能还在 `englishstudy_APP` 目录下
3. **旧目录可能已删除**：导致无法获取当前工作目录

## 解决方案

### 方法 1：切换到正确的目录（推荐）

```bash
# 切换到正确的项目目录
cd /Users/haixinggongshe/rocketenglish-app

# 验证目录
pwd
# 应该显示：/Users/haixinggongshe/rocketenglish-app

# 然后运行命令
npm run dev
```

### 方法 2：如果旧目录还存在

```bash
# 检查旧目录是否存在
ls -la /Users/haixinggongshe/englishstudy_APP

# 如果存在，可以删除它
rm -rf /Users/haixinggongshe/englishstudy_APP

# 然后切换到新目录
cd /Users/haixinggongshe/rocketenglish-app
```

### 方法 3：重新打开终端

1. 关闭当前终端窗口
2. 打开新的终端窗口
3. 运行：
   ```bash
   cd /Users/haixinggongshe/rocketenglish-app
   npm run dev
   ```

## 验证项目目录

运行以下命令确认你在正确的目录：

```bash
cd /Users/haixinggongshe/rocketenglish-app
pwd
ls package.json
```

应该看到：
- `pwd` 输出：`/Users/haixinggongshe/rocketenglish-app`
- `package.json` 文件存在

## 快速修复命令

直接复制粘贴以下命令：

```bash
cd /Users/haixinggongshe/rocketenglish-app && npm run dev
```

## 如果还是有问题

1. **检查目录是否存在**：
   ```bash
   ls -la /Users/haixinggongshe/ | grep rocket
   ```

2. **检查项目文件**：
   ```bash
   ls -la /Users/haixinggongshe/rocketenglish-app/package.json
   ```

3. **如果目录不存在**，可能需要重新克隆或创建项目

## 项目目录结构

正确的项目目录应该是：
```
/Users/haixinggongshe/rocketenglish-app/
├── package.json
├── app/
├── lib/
├── supabase/
└── ...
```

**不是**：
```
/Users/haixinggongshe/englishstudy_APP/  ❌ (旧目录)
```

