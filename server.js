const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

const db = mysql.createConnection({
    host: "sql12.freesqldatabase.com",
    user: "sql12766065",
    password: "DwMuHYlhHR",
    database: "sql12766065",
    port: 3306
});

// ✅ 连接数据库
db.connect(err => {
    if (err) {
        console.error('❌ MySQL 连接失败:', err);
        return;
    }
    console.log('✅ 成功连接到 MySQL 远程数据库');
});

// ✅ 测试 API 是否正常运行
app.get('/', (req, res) => {
    res.send('🚀 API is running!');
});

// ✅ 词典查询 API
app.get('/search', (req, res) => {
    const query = req.query.word;
    if (!query) {
        return res.status(400).json({ message: '请输入要查询的词汇' });
    }

    console.log(`🔍 正在查询: ${query}`);

    const sql = `SELECT * FROM \`中译帕字典\` WHERE word = ? OR translation = ?`;

    db.query(sql, [query, query], (err, results) => {
        if (err) {
            console.error('❌ 数据库查询错误:', err);
            return res.status(500).json({ message: '数据库查询失败' });
        }

        if (results.length > 0) {
            return res.json(results);
        } else {
            const fuzzySql = `SELECT * FROM dictionary WHERE word LIKE ? OR translation LIKE ? LIMIT 5`;
            db.query(fuzzySql, [`%${query}%`, `%${query}%`], (err, fuzzyResults) => {
                if (err) {
                    console.error('❌ 模糊搜索错误:', err);
                    return res.status(500).json({ message: '数据库模糊搜索失败' });
                }

                if (fuzzyResults.length > 0) {
                    return res.json({ suggestions: fuzzyResults });
                } else {
                    return res.json({ message: '未找到翻译结果' });
                }
            });
        }
    });
});

// ✅ 监听端口
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 服务器运行在端口 ${PORT}`);
});