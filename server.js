const express = require("express");
const mysql = require("mysql2");
const cors = require("cors");

const app = express();

app.use(cors());
app.use(express.json());

const db = mysql.createConnection({
    host: "veraura-db-veraura.h.aivencloud.com",
    port: 28530,
    user: "avnadmin",
    password: process.env.DB_PASSWORD,
    database: "defaultdb",
    ssl: {
        rejectUnauthorized: false
    }
});

db.connect((err) => {
    if (err) {
        console.log("MYSQL BAĞLANTI HATASI");
        console.log(err);
    } else {
        console.log("MYSQL BAĞLANDI");
    }
});

app.get("/", (req, res) => {
    res.json({
        success: true,
        message: "VERAURA API AKTİF"
    });
});

app.get("/musteriler", (req, res) => {

    const sql = `
        SELECT 
            id,
            ad_soyad,
            bakiye
        FROM vw_musteri_bakiye
        ORDER BY ad_soyad
    `;

    db.query(sql, (err, results) => {

        if (err) {
            return res.status(500).json({
                success: false,
                error: err
            });
        }

        res.json({
            success: true,
            data: results
        });

    });

});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log("API çalışıyor");
});