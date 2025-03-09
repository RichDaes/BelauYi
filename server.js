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

// 翻译接口
app.get("/translate", async (req, res) => {
  const query = req.query.word;
  if (!query) {
    return res.status(400).json({ message: "请输入要查询的词汇" });
  }

  console.log(`🔍 翻译查询: ${query}`);

  try {
    const [result] = await pool.query("SELECT translation FROM `cn-pw_dictionary` WHERE word = ?", [query]);

    if (result.length > 0) {
      return res.json({ translation: result[0].translation });
    }

    return res.json({ message: "未找到翻译结果" });
  } catch (err) {
    console.error("❌ 数据库查询错误:", err.message);
    return res.status(500).json({ message: "数据库查询失败" });
  }
});

// 近似匹配搜索接口
app.get("/search", async (req, res) => {
  const query = req.query.word;
  if (!query) {
    return res.status(400).json({ message: "请输入要查询的词汇" });
  }

  console.log(`🔍 查询词汇: ${query}`);

  try {
    const [allWords] = await pool.query("SELECT word, translation FROM `cn-pw_dictionary`");
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

    if (bestMatches.length > 0 && minDistance <= 2) {
      return res.json({ suggestions: bestMatches });
    }

    return res.json({ message: "未找到翻译结果" });
  } catch (err) {
    console.error("❌ 数据库查询错误:", err.message);
    return res.status(500).json({ message: "数据库查询失败" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 服务器运行在端口 ${PORT}`);
});
