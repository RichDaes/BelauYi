const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// 连接 MySQL 数据库
const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',  // 你的 MySQL 用户名
    password: '111111',  // 你的 MySQL 密码（如果没有密码，保持为空字符串）
    database: '字典' // 你的数据库名称，确保数据库已存在！
});

db.connect(err => {
    if (err) {
        console.error('❌ MySQL 连接失败:', err);
        return;
    }
    console.log('✅ MySQL 连接成功');
});

// 查询 API
app.get('/search', (req, res) => {
    const query = req.query.word;
    if (!query) {
        return res.status(400).json({ message: '请输入要查询的词汇' });
    }

    console.log(`🔍 查询请求: ${query}`);

    // **精确匹配查询**
    const sql = `SELECT * FROM \`中译帕字典\` WHERE word = ? OR translation = ?`;
    db.query(sql, [query, query], (err, results) => {
        if (err) {
            console.error('❌ 查询错误:', err);
            return res.status(500).json({ message: '数据库查询失败' });
        }

        // **如果有结果，直接返回**
        if (results.length > 0) {
            return res.json(results);
        } else {
            // **如果没有精确匹配，进行模糊搜索**
            const fuzzySql = `SELECT * FROM \`中译帕字典\` WHERE word LIKE ? OR translation LIKE ? LIMIT 5`;
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

// 启动服务器
app.listen(3000, () => {
    console.log('🚀 服务器运行在 http://localhost:3000');
});
