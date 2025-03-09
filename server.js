const express = require("express");
const mysql = require("mysql2/promise");
const cors = require("cors");
require("dotenv").config();

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
    // **1️⃣ 精确匹配**
    const [exactResults] = await pool.query(
      "SELECT word, translation, type, definition, example FROM `cn-pw_dictionary` WHERE word = ? OR translation = ?",
      [query, query]
    );

    if (exactResults.length > 0) {
      return res.json({ exactMatches: exactResults });
    }

    console.log("⚠️ 没有找到精确匹配，进行模糊搜索...");

    // **2️⃣ 高级模糊搜索**
    const [fuzzyResults] = await pool.query(
      `SELECT word, translation, type, definition, example FROM \`cn-pw_dictionary\` 
       WHERE word LIKE ? OR translation LIKE ? 
       ORDER BY CHAR_LENGTH(word) ASC 
       LIMIT 5`,
      [`%${query}%`, `%${query}%`]
    );

    if (fuzzyResults.length > 0) {
      return res.json({ suggestions: fuzzyResults });
    }

    console.log("❌ 没有找到相关结果，提供推荐词...");
    
    // **3️⃣ 推荐相似的单词**
    const [recommendedResults] = await pool.query(
      `SELECT word, translation FROM \`cn-pw_dictionary\` 
       WHERE word REGEXP ? OR translation REGEXP ? 
       ORDER BY CHAR_LENGTH(word) ASC 
       LIMIT 5`,
      [`${query[0]}`, `${query[1000]}`] // 仅匹配第一个字符（可调整）
    );

    if (recommendedResults.length > 0) {
      return res.json({ message: "未找到翻译结果", recommendations: recommendedResults });
    }

    return res.json({ message: "未找到翻译结果，也没有推荐词" });

  } catch (err) {
    console.error("❌ 数据库查询错误:", err.message);
    return res.status(500).json({ message: "数据库查询失败" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 服务器运行在端口 ${PORT}`);
});
