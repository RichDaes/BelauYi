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

    // **1️⃣ 精确匹配**
    const [exactResults] = await connection.query(
      "SELECT word, translation, type, definition, example FROM `cn-pw_dictionary` WHERE word = ? OR translation = ?",
      [query, query]
    );

    if (exactResults.length > 0) {
      connection.release();
      return res.json({ exactMatches: exactResults });
    }

    console.log("⚠️ 没有找到精确匹配，进行模糊搜索...");

    // **2️⃣ 高级模糊搜索**
    const [allWords] = await connection.query(
      "SELECT word, translation FROM `cn-pw_dictionary`"
    );

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

    connection.release();

    // If the closest match has a small distance, return it as a correction
    if (minDistance <= 2 && bestMatches.length === 1) {
      return res.json({
        message: `你是否想输入: ${bestMatches[0].word}？`,
        correctedWord: bestMatches[0].word,
        exactMatches: [],
        suggestions: bestMatches
      });
    }

    // Otherwise, return the closest matches as suggestions
    return res.json({
      exactMatches: [],
      suggestions: bestMatches
    });

  } catch (err) {
    console.error("❌ 数据库查询错误:", err.message);
    return res.status(500).json({ message: "数据库查询失败" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 服务器运行在端口 ${PORT}`);
});
