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

    // **1️⃣ 查询所有可能的翻译**
    const [exactResults] = await connection.query(
      "SELECT word, translation, type, definition, example FROM `cn-pw_dictionary` WHERE word = ? OR translation = ?",
      [query, query]
    );

    console.log("🔍 精确匹配结果:", exactResults);

    // **2️⃣ 近似匹配**
    const [fuzzyResults] = await connection.query(
      "SELECT word, translation FROM `cn-pw_dictionary` WHERE word LIKE ? OR translation LIKE ? LIMIT 1000",
      [`%${query}%`, `%${query}%`]
    );

    console.log("🔍 近似匹配结果:", fuzzyResults);

    // **3️⃣ 确保 API 返回格式正确**
    res.json({
      exactMatches: exactResults.length > 0 ? exactResults : [],
      suggestions: fuzzyResults.length > 0 ? fuzzyResults : []
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
