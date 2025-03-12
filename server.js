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

// 检测是否包含中文字符
function isChinese(text) {
  return /[\u4E00-\u9FFF]/.test(text);
}

// 动态设置 Levenshtein 阈值：短词更严格，长词可稍宽松
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

  console.log(`🔍 查询词汇: ${query}`);

  let connection;
  try {
    connection = await pool.getConnection();

    // 如果含中文字符 => 搜索 translation 列；否则 => 搜索 word 列
    const isCn = isChinese(query);
    const searchColumn = isCn ? "translation" : "word";

    // **1️⃣ 精确匹配** (只搜对应列)
    const [exactResults] = await connection.query(
      `SELECT word, translation, type, definition, example
         FROM \`cn-pw_dictionary\`
        WHERE \`${searchColumn}\` = ?`,  // 用反引号避免 - 表名出错
      [query]
    );

    console.log("🔍 精确匹配结果:", exactResults);

    if (exactResults.length > 0) {
      // 如果有精准匹配，就返回
      connection.release();
      return res.json({
        exactMatches: exactResults,
        suggestions: []
      });
    }

    // **2️⃣ Levenshtein 近似匹配** 
    //   读取整表，然后只对相关列做距离计算
    const [allRows] = await connection.query(
      "SELECT word, translation, type, definition, example FROM `cn-pw_dictionary`"
    );

    connection.release();

    // 动态阈值：根据输入长度来
    const threshold = getLevenshteinThreshold(query.length);
    let bestMatches = [];
    let minDistance = Infinity;

    allRows.forEach((row) => {
      const targetText = isCn ? row.translation : row.word;
      if (!targetText) return;  // 字段为空就跳过

      // 可选：先做长度过滤，若长度差大于 threshold，就不算距离
      if (Math.abs(targetText.length - query.length) > threshold) {
        return;
      }

      const distance = levenshtein.get(query, targetText);
      if (distance < minDistance) {
        minDistance = distance;
        bestMatches = [row];
      } else if (distance === minDistance) {
        bestMatches.push(row);
      }
    });

    console.log(`🔍 Levenshtein 最近距离: ${minDistance}, 词条数: ${bestMatches.length}`);

    if (minDistance <= threshold) {
      // 只返回前 5 个
      // 如果想多点可以改成 10 或直接不限制
      const limitedMatches = bestMatches.slice(0, 5);

      return res.json({
        exactMatches: [],
        suggestions: limitedMatches
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
