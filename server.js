const express = require("express");
const mysql = require("mysql2/promise");
const cors = require("cors");
const levenshtein = require("fast-levenshtein");

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

  let connection;
  try {
    connection = await pool.getConnection();

    // **1️⃣ 精确匹配**
    const [exactResults] = await connection.query(
      "SELECT word, translation, type, definition, example FROM `cn-pw_dictionary` WHERE word = ? OR translation = ?",
      [query, query]
    );

    console.log("🔍 精确匹配结果:", exactResults);

    // 如果有精准匹配，先返回
    // （如果你想让同时显示近似匹配，可以不在这里直接 return）
    if (exactResults.length > 0) {
      connection.release();
      return res.json({
        exactMatches: exactResults,
        suggestions: []
      });
    }

    // **2️⃣ Levenshtein 计算所有单词**
    const [allWords] = await connection.query(
      "SELECT word, translation, type, definition, example FROM `cn-pw_dictionary`"
    );

    let bestMatches = [];
    let minDistance = Infinity;

    allWords.forEach((row) => {
      const distance = levenshtein.get(query, row.word);
      // 记录离 query 最近的单词
      if (distance < minDistance) {
        minDistance = distance;
        bestMatches = [row];
      } else if (distance === minDistance) {
        bestMatches.push(row);
      }
    });

    connection.release();

    console.log(`🔍 Levenshtein 最近距离: ${minDistance}, 单词数: ${bestMatches.length}`);

    // 设置一个合理的阈值，比如距离 ≤ 3 视为有效近似匹配
    if (minDistance <= 3) {
      return res.json({
        exactMatches: [],
        suggestions: bestMatches
      });
    } else {
      // 没有在阈值内的单词
      return res.json({
        exactMatches: [],
        suggestions: []
      });
    }

  } catch (err) {
    console.error("❌ 数据库查询错误:", err.message);
    return res.status(500).json({ message: "数据库查询失败" });
  } finally {
    if (connection) connection.release();
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 服务器运行在端口 ${PORT}`);
});
