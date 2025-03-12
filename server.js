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

// 判断是否包含中文
function isChinese(text) {
  return /[\u4E00-\u9FFF]/.test(text);
}

// 你希望整体更严格，所以这里改小一点：
// 短词阈值=1；中等词=2；较长=3
function getLevenshteinThreshold(len) {
  if (len <= 2) return 1; 
  if (len <= 5) return 2;
  return 3;
}

app.get("/", (req, res) => {
  res.send("🚀 API is running and connected to MySQL!");
});

app.get("/search", async (req, res) => {
  const query = req.query.word;
  if (!query) {
    return res.status(400).json({ message: "请输入要查询的词汇" });
  }

  console.log("🔍 查询词汇:", query);

  let connection;
  try {
    connection = await pool.getConnection();

    // 中文 => 搜 translation 列；否则 => 搜 word 列
    const isCn = isChinese(query);
    const searchColumn = isCn ? "translation" : "word";

    // **1️⃣ 精确匹配**
    const [exactResults] = await connection.query(
      `SELECT word, translation, type, definition, example
         FROM \`cn-pw_dictionary\`
        WHERE \`${searchColumn}\` = ?`,
      [query]
    );

    console.log("🔍 精确匹配结果:", exactResults);

    if (exactResults.length > 0) {
      connection.release();
      return res.json({
        exactMatches: exactResults,
        suggestions: []
      });
    }

    // **2️⃣ 读取整表，准备做 Levenshtein**
    const [allRows] = await connection.query(
      "SELECT word, translation, type, definition, example FROM `cn-pw_dictionary`"
    );

    connection.release();

    const threshold = getLevenshteinThreshold(query.length);
    let allMatches = [];

    allRows.forEach((row) => {
      const target = isCn ? row.translation : row.word;
      if (!target) return;

      // 可选：如果想更严，限制长度差 <= (threshold + 1)
      if (Math.abs(target.length - query.length) > threshold + 1) {
        return; 
      }

      const distance = levenshtein.get(query, target);
      // 保存 {row, distance} 以便后续排序
      allMatches.push({ row, distance });
    });

    // 按 distance 升序排序
    allMatches.sort((a, b) => a.distance - b.distance);

    // 取距离最小值
    const minDistance = allMatches.length > 0 ? allMatches[0].distance : Infinity;

    console.log(`🔍 最小距离: ${minDistance}; 匹配总数: ${allMatches.length}`);

    // 如果最小距离超过阈值，就返回空
    if (minDistance > threshold) {
      return res.json({ exactMatches: [], suggestions: [] });
    }

    // 否则筛选所有 distance == minDistance 的
    let bestMatches = allMatches.filter(m => m.distance === minDistance);

    // 再只返回前 5，避免一次返回太多
    bestMatches = bestMatches.slice(0, 100);

    return res.json({
      exactMatches: [],
      suggestions: bestMatches.map(m => m.row)
    });

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
