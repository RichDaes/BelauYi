const express = require("express");
const mysql = require("mysql2/promise");
const cors = require("cors");
const levenshtein = require("fast-levenshtein");
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

// ✅ 修改 `/search`，提供完整的词条信息
app.get("/search", async (req, res) => {
  const query = req.query.word;
  if (!query) {
    return res.status(400).json({ message: "请输入要查询的词汇" });
  }

  console.log(`🔍 查询词汇: ${query}`);

  let connection;
  try {
    connection = await pool.getConnection();

    // **1️⃣ 查找数据库中是否有完全匹配的单词**
    const [exactMatches] = await connection.query(
      "SELECT word, translation, type, definition, example FROM `cn-pw_dictionary` WHERE word = ?",
      [query]
    );

    // **2️⃣ 获取所有单词进行近似匹配**
    const [allWords] = await connection.query("SELECT word, translation, type, definition, example FROM `cn-pw_dictionary`");

    let bestMatches = [];
    let minDistance = Infinity;

    allWords.forEach((row) => {
      const distance = levenshtein.get(query, row.word);
      if (distance < minDistance) {
        minDistance = distance;
        bestMatches = [row];
      } else if (distance === minDistance) {
        bestMatches.push(row);
      }
    });

    // **3️⃣ 返回所有匹配的结果，让前端选择**
    res.json({
      exactMatches,
      suggestions: bestMatches.length > 0 && minDistance <= 3 ? bestMatches : []
    });
  } catch (err) {
    console.error("❌ 数据库查询错误:", err.message);
    res.status(500).json({ message: "数据库查询失败" });
  } finally {
    if (connection) connection.release(); // 释放连接，防止连接池被占满
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 服务器运行在端口 ${PORT}`);
});
