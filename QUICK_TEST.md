# 快速测试导入功能

## 📁 文件位置

测试文件已经创建在项目根目录：
```
/Users/haixinggongshe/rocketenglish-app/test-sample.txt
```

## 🚀 三种测试方法

### 方法 1：直接使用文本文件（最简单）

**不需要 Word！** 可以直接在导入页面测试文本解析功能。

1. 打开 `test-sample.txt` 文件（在项目根目录）
2. 复制全部内容
3. 创建一个新的文本文件，保存为 `test.txt`
4. 在导入页面，**暂时修改代码接受 .txt 文件**，或者：
   - 将内容粘贴到 Word 中
   - 保存为 `.docx` 格式

### 方法 2：使用在线 Word 编辑器

1. 访问 https://www.office.com/ 或 https://docs.google.com
2. 创建新文档
3. 复制 `test-sample.txt` 的内容
4. 粘贴到文档中
5. 下载为 `.docx` 格式

### 方法 3：使用命令行创建 Word 文件（Mac）

如果你在 Mac 上，可以使用以下命令：

```bash
# 安装 pandoc（如果还没有）
brew install pandoc

# 将文本转换为 Word
cd /Users/haixinggongshe/rocketenglish-app
pandoc test-sample.txt -o test-paper.docx
```

## 📋 测试内容（可直接复制）

如果找不到文件，可以直接复制以下内容到 Word 中：

```
2024年北京市中考英语真题

1. My friends and I like sports. ____ often play basketball together after school.
A. We
B. I
C. They
D. You

2. Chinese ____ by more people these days.
A. speaks
B. spoke
C. is spoken
D. was spoken

3. I ____ to the park yesterday.
A. go
B. went
C. will go
D. am going

4. We feel ____ to win the match because we are training hard.
A. lonely
B. sorry
C. confident
D. strange

5. I ____ visit my grandparents next week.
A. am
B. will
C. was
D. have

6. She ____ English for three years.
A. studies
B. studied
C. has studied
D. will study

7. The book ____ by many students.
A. reads
B. read
C. is read
D. was read

8. He is ____ in science.
A. interest
B. interesting
C. interested
D. interests

9. They ____ to the cinema last night.
A. go
B. goes
C. went
D. going

10. I will call you when I ____ there.
A. arrive
B. arrived
C. will arrive
D. am arriving
```

## 🔍 找不到文件？

### 在 Finder 中查找（Mac）

1. 打开 Finder
2. 按 `Cmd + Shift + G`（前往文件夹）
3. 输入：`/Users/haixinggongshe/rocketenglish-app`
4. 按回车
5. 找到 `test-sample.txt` 文件

### 在终端中查看

```bash
cd /Users/haixinggongshe/rocketenglish-app
cat test-sample.txt
```

### 在 VS Code 中打开

1. 打开 VS Code
2. 按 `Cmd + O`（打开文件）
3. 输入：`/Users/haixinggongshe/rocketenglish-app/test-sample.txt`
4. 按回车

## 💡 最简单的测试方法

**如果你只是想快速测试功能，可以：**

1. 打开任意文本编辑器（记事本、TextEdit 等）
2. 复制上面的测试内容
3. 粘贴进去
4. 保存为 `test.txt`
5. **然后修改导入 API 临时接受 .txt 文件**，或者：
   - 将 `.txt` 重命名为 `.docx`（虽然格式不对，但可以测试错误处理）

## 🎯 推荐流程

1. **最简单**：使用 Google Docs
   - 访问 https://docs.google.com
   - 新建文档
   - 粘贴测试内容
   - 下载为 `.docx`

2. **或者**：使用 Microsoft Word Online
   - 访问 https://www.office.com
   - 创建新文档
   - 粘贴测试内容
   - 下载为 `.docx`

3. **或者**：如果你有本地 Word
   - 打开 Word
   - 粘贴测试内容
   - 保存为 `.docx`

## ❓ 还是找不到？

告诉我你遇到的具体问题：
- 是在文件管理器中找不到？
- 还是在编辑器中无法打开？
- 还是其他问题？

我可以帮你找到文件或提供其他解决方案。

