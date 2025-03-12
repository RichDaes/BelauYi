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

// 简单函数：检测是否包含中文字符
function isChinese(text) {
  return /[\u4E00-\u9FFF]/.test(text);
}

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

    // 根据输入判断要搜索哪个字段：中文搜 translation，其他搜 word
    const isCn = isChinese(query);
    // 注意: searchColumn 只能是 "translation" 或 "word"
    // 如果你想更严格，可以写个 if else，而不是直接这样子
    const searchColumn = isCn ? "translation" : "word";

    // **1️⃣ 精确匹配** (只搜对应列)
    // 关键：使用反引号包裹表名和列名
    const [exactResults] = await connection.query(
      `SELECT word, translation, type, definition, example
       FROM \`cn-pw_dictionary\`
       WHERE \`${searchColumn}\` = ?`,
      [query]
    );

    console.log("🔍 精确匹配结果:", exactResults);

    // 如果有精准匹配，先返回
    if (exactResults.length > 0) {
      connection.release();
      return res.json({
        exactMatches: exactResults,
        suggestions: []
      });
    }

    // **2️⃣ Levenshtein 近似匹配**（只对相应的列做距离计算）
    //   - 读取全部行后，基于 word 或 translation 做 Levenshtein
    const [allRows] = await connection.query(
      "SELECT word, translation, type, definition, example FROM `cn-pw_dictionary`"
    );

    connection.release();

    let bestMatches = [];
    let minDistance = Infinity;

    allRows.forEach((row) => {
      // 如果是中文，就对 row.translation 做距离；否则对 row.word 做距离
      const targetText = isCn ? row.translation : row.word;
      if (!targetText) return; // 如果目标字段为空，则跳过

      const distance = levenshtein.get(query, targetText);
      if (distance < minDistance) {
        minDistance = distance;
        bestMatches = [row];
      } else if (distance === minDistance) {
        bestMatches.push(row);
      }
    });

    console.log(`🔍 Levenshtein 最近距离: ${minDistance}, 单词数量: ${bestMatches.length}`);

    // 设定阈值：距离 ≤ 3 视为有效
    if (minDistance <= 3) {
      return res.json({
        exactMatches: [],
        suggestions: bestMatches
      });
    } else {
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
