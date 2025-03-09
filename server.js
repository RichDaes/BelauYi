const express = require("express");
const mysql = require("mysql2/promise");
const cors = require("cors");
const levenshtein = require("fast-levenshtein"); // Add Levenshtein for typo detection

const app = express();
app.use(cors());
app.use(express.json());

const pool = mysql.createPool({
  host: "database-1.cfa2gw8uums4.us-east-2.rds.amazonaws.com",
  user: "admin",
  password: "tonghuikeyi",
  database: "dictionary",
  port: 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

app.get("/", (req, res) => {
  res.send("🚀 API is running and connected to MySQL!");
});

app.get("/search", async (req, res) => {
  const query = req.query.word;
  if (!query) {
    return res.status(400).json({ message: "请输入要查询的词汇" });
  }

  console.log(`🔍 查询词汇: ${query}`);

  try {
    const connection = await pool.getConnection();

    // **1️⃣ 查询所有可能的翻译**
    const [exactResults] = await connection.query(
      "SELECT word, translation, type, definition, example FROM `cn-pw_dictionary` WHERE word = ? OR translation = ?",
      [query, query]
    );

    if (exactResults.length > 0) {
      connection.release();
      return res.json({ exactMatches: exactResults });
    }

    console.log("⚠️ 没有找到精确匹配，进行模糊搜索...");

    // **2️⃣ 近似匹配**
    const [fuzzyResults] = await connection.query(
      "SELECT word, translation FROM `cn-pw_dictionary` WHERE word LIKE ? OR translation LIKE ? LIMIT 5",
      [`%${query}%`, `%${query}%`]
    );

    connection.release();

    return res.json({
      exactMatches: exactResults,
      suggestions: fuzzyResults
    });

  } catch (err) {
    console.error("❌ 数据库查询错误:", err.message);
    return res.status(500).json({ message: "数据库查询失败" });
  }
});
✅ 返回所有翻译，不仅仅是第一条匹配结果！

🔹 2. 修改前端
✅ 让前端支持「多个翻译」
html
复制
<script>
const API_BASE = "https://belauyi.onrender.com"; // Your backend URL

document.getElementById("dictForm").addEventListener("submit", async function (event) {
    event.preventDefault();
    const inputWord = document.getElementById("input-word").value.trim();
    const resultDiv = document.getElementById("result");

    if (!inputWord) {
        resultDiv.innerHTML = "<p style='color: red;'>请输入要翻译的词汇！</p>";
        return;
    }

    resultDiv.innerHTML = "<p>查询中...</p>";
    try {
        const response = await fetch(`${API_BASE}/search?word=${encodeURIComponent(inputWord)}`);
        if (!response.ok) throw new Error("查询失败");

        const data = await response.json();
        console.log("🔍 API 返回数据:", data); // 记录 API 返回的内容

        let output = "";

        // **1️⃣ 精确匹配**
        if (Array.isArray(data.exactMatches) && data.exactMatches.length > 0) {
            output += `<p><b>精准匹配：</b></p><ul>`;
            data.exactMatches.forEach(item => {
                output += `
                    <li>
                        <b>${item.word}</b> → ${item.translation || "暂无翻译"}
                        <br><small><b>词性：</b> ${item.type || "无"} | <b>释义：</b> ${item.definition || "暂无释义"}</small>
                        ${item.example ? `<br><small><b>示例：</b>${item.example}</small>` : ""}
                    </li><hr>
                `;
            });
            output += `</ul>`;
        }

        // **2️⃣ 近似匹配**
        if (Array.isArray(data.suggestions) && data.suggestions.length > 0) {
            output += `<p><b>相似匹配：</b></p><ul>`;
            output += data.suggestions.map(item => `
                <li>
                    <span onclick="document.getElementById('input-word').value='${item.word}'; document.querySelector('form').dispatchEvent(new Event('submit'));">
                        ${item.word} (${item.translation || "暂无翻译"})
                    </span>
                </li>
            `).join("");
            output += "</ul>";
        }

        if (!output) output = "<p>未找到翻译结果</p>";
        resultDiv.innerHTML = output;

    } catch (error) {
        resultDiv.innerHTML = `<p style='color: red;'>查询失败: ${error.message}</p>`;
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 服务器运行在端口 ${PORT}`);
});
