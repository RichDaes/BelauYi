// server.js (优化后)
const express = require("express");
const mysql = require("mysql2/promise");
const cors = require("cors");
const levenshtein = require("fast-levenshtein");
require("dotenv").config();

const app = express();
app.use(cors());
app.use(express.json());

// 使用 .env 配置数据库
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  port: process.env.DB_PORT,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

app.get("/", (req, res) => {
  res.send("🚀 API is running and connected to MySQL!");
});

// 优化 /search API 仅返回形态相近的词
app.get("/search", async (req, res) => {
  const query = req.query.word;
  if (!query) {
    return res.status(400).json({ message: "请输入要查询的词汇" });
  }

  let connection;
  try {
    connection = await pool.getConnection();
    
    // 1️⃣ 精准匹配
    const [exactMatches] = await connection.query(
      "SELECT word, translation, type, definition, example FROM `cn-pw_dictionary` WHERE word = ? COLLATE utf8mb4_general_ci",
      [query]
    );
    
    if (exactMatches.length > 0) {
      return res.json({ exactMatches, suggestions: [] });
    }

    // 2️⃣ 近似匹配优化（仅返回形态相近的词）
    const [allWords] = await connection.query("SELECT word, translation, type, definition, example FROM `cn-pw_dictionary`");

    const similarMatches = allWords.filter(row => levenshtein.get(query, row.word) <= 2);
    
    res.json({
      exactMatches: [],
      suggestions: similarMatches
    });
  } catch (err) {
    console.error("❌ 数据库查询错误:", err.message);
    res.status(500).json({ message: "数据库查询失败" });
  } finally {
    if (connection) connection.release();
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 服务器运行在端口 ${PORT}`);
});
