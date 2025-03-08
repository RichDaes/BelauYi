const express = require("express");
const mysql = require("mysql2/promise");
const cors = require("cors");
require("dotenv").config();

const app = express();
app.use(cors());
app.use(express.json());

// 使用环境变量存储数据库信息，避免泄露
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
    const [results] = await pool.query(
      "SELECT * FROM `cn-pw_dictionary` WHERE word = ? OR translation = ?",
      [query, query]
    );

    if (results.length > 0) {
      return res.json(results);
    } else {
      console.log("⚠️ 没有找到精确匹配，进行模糊搜索...");
      const [fuzzyResults] = await pool.query(
        "SELECT * FROM `cn-pw_dictionary` WHERE word LIKE ? OR translation LIKE ? LIMIT 5",
        [`%${query}%`, `%${query}%`]
      );

      if (fuzzyResults.length > 0) {
        return res.json({ suggestions: fuzzyResults });
      } else {
        return res.json({ message: "未找到翻译结果" });
      }
    }
  } catch (err) {
    console.error("❌ 数据库查询错误:", err.message);
    return res.status(500).json({ message: "数据库查询失败" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 服务器运行在端口 ${PORT}`);
});
