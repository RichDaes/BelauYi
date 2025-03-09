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
    
    const [exactMatches] = await connection.query(
      "SELECT word, translation, type, definition, example FROM `cn-pw_dictionary` WHERE word = ?",
      [query]
    );

    console.log("🔍 数据库查询结果（精准匹配）:", exactMatches);

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

    console.log("🔍 数据库查询结果（近似匹配）:", bestMatches);

    res.json({
      exactMatches: exactMatches.length > 0 ? exactMatches : [],
      suggestions: bestMatches.length > 0 && minDistance <= 3 ? bestMatches : []
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
