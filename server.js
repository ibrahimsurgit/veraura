const express = require("express");
const mysql = require("mysql2");
const cors = require("cors");
const path = require("path");

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const db = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT
});

db.connect((err) => {

    if (err) {
        console.log("MYSQL BAĞLANTI HATASI");
        console.log(err);
    } else {
        console.log("MYSQL BAĞLANDI");
    }

});


// ========================================
// ROOT
// ========================================

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"));
});


// ========================================
// LOGIN
// ========================================

app.post("/login", (req, res) => {

    const {
        username,
        password
    } = req.body;

    if (
        username === "isurgit" &&
        password === "9876"
    ) {

        return res.json({
            success: true,
            message: "Giriş başarılı"
        });

    }

    res.status(401).json({
        success: false,
        message: "Kullanıcı adı veya şifre hatalı"
    });

});


// ========================================
// DASHBOARD
// ========================================

app.get("/dashboard", (req, res) => {

    const sql = `
        SELECT
            p.ad AS pazaryeri,
            COUNT(s.id) AS siparis,
            SUM(s.adet) AS adet,
            FORMAT(SUM(s.net_kazanc), 2, 'tr_TR') AS toplam_kazanc
        FROM satislar s
        LEFT JOIN pazaryerleri p
            ON s.pazaryeri_id = p.id
        GROUP BY p.ad
        ORDER BY SUM(s.net_kazanc) DESC
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


// ========================================
// TÜM ÜRÜNLER
// ========================================

app.get("/urunler", (req, res) => {

    const sql = `
        SELECT *
        FROM urunler
        ORDER BY id DESC
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


// ========================================
// ÜRÜN EKLE
// ========================================

app.post("/urun-ekle", (req, res) => {

    const {
        urun_kodu,
        urun_adi,
        alis_fiyati,
        satis_fiyati,
        stok
    } = req.body;

    if (!urun_adi) {

        return res.status(400).json({
            success: false,
            message: "Ürün adı boş olamaz"
        });

    }

    const sql = `
        INSERT INTO urunler (
            urun_kodu,
            urun_adi,
            alis_fiyati,
            satis_fiyati,
            stok
        )
        VALUES (?, ?, ?, ?, ?)
    `;

    db.query(
        sql,
        [
            urun_kodu,
            urun_adi,
            alis_fiyati,
            satis_fiyati,
            stok
        ],
        (err, result) => {

            if (err) {

                return res.status(500).json({
                    success: false,
                    error: err
                });

            }

            res.json({
                success: true,
                message: "Ürün başarıyla eklendi",
                insert_id: result.insertId
            });

        }
    );

});


// ========================================
// PAZARYERLERİ
// ========================================

app.get("/pazaryerleri", (req, res) => {

    const sql = `
        SELECT *
        FROM pazaryerleri
        ORDER BY ad ASC
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


// ========================================
// PAZARYERİ EKLE
// ========================================

app.post("/pazaryeri-ekle", (req, res) => {

    const {
        ad
    } = req.body;

    if (!ad) {

        return res.status(400).json({
            success: false,
            message: "Pazaryeri adı boş olamaz"
        });

    }

    const sql = `
        INSERT INTO pazaryerleri (
            ad
        )
        VALUES (?)
    `;

    db.query(sql, [ad], (err, result) => {

        if (err) {

            return res.status(500).json({
                success: false,
                error: err
            });

        }

        res.json({
            success: true,
            message: "Pazaryeri başarıyla eklendi",
            insert_id: result.insertId
        });

    });

});


// ========================================
// SATIŞLAR
// ========================================

app.get("/satislar", (req, res) => {

    const sql = `
        SELECT
            s.id,
            DATE_FORMAT(s.tarih, '%d.%m.%Y') AS tarih,
            p.ad AS pazaryeri,
            u.urun_kodu,
            u.urun_adi,
            s.adet,
            s.satis_fiyati,
            s.kdv_orani,
            s.kargo_ucreti,
            s.net_kazanc
        FROM satislar s
        LEFT JOIN pazaryerleri p
            ON s.pazaryeri_id = p.id
        LEFT JOIN urunler u
            ON s.urun_id = u.id
        ORDER BY s.id DESC
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


// ========================================
// SATIŞ EKLE
// ========================================

app.post("/satis-ekle", (req, res) => {

    const {
        tarih,
        pazaryeri_id,
        urun_id,
        adet,
        satis_fiyati,
        kdv_orani,
        kargo_ucreti,
        net_kazanc
    } = req.body;

    if (
        !tarih ||
        !pazaryeri_id ||
        !urun_id
    ) {

        return res.status(400).json({
            success: false,
            message: "Eksik alan mevcut"
        });

    }

    // gg.aa.yyyy -> yyyy-aa-gg
    const parca = tarih.split(".");

    const mysqlTarih =
        parca[2] + "-" +
        parca[1] + "-" +
        parca[0];

    const sql = `
        INSERT INTO satislar (
            tarih,
            pazaryeri_id,
            urun_id,
            adet,
            satis_fiyati,
            kdv_orani,
            kargo_ucreti,
            net_kazanc
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;

    db.query(
        sql,
        [
            mysqlTarih,
            pazaryeri_id,
            urun_id,
            adet,
            satis_fiyati,
            kdv_orani,
            kargo_ucreti,
            net_kazanc
        ],
        (err, result) => {

            if (err) {

                return res.status(500).json({
                    success: false,
                    error: err
                });

            }

            res.json({
                success: true,
                message: "Satış başarıyla eklendi",
                insert_id: result.insertId
            });

        }
    );

});


// ========================================
// STOK HAREKETLERİ
// ========================================

app.get("/stok", (req, res) => {

    const sql = `
        SELECT
            u.id,
            u.urun_kodu,
            u.urun_adi,
            u.stok,
            u.alis_fiyati,
            u.satis_fiyati
        FROM urunler u
        ORDER BY u.urun_adi ASC
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


// ========================================
// API STATUS
// ========================================

app.get("/api", (req, res) => {

    res.json({
        success: true,
        message: "VERAURA API AKTİF"
    });

});


// ========================================
// PORT
// ========================================

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {

    console.log("=================================");
    console.log("VERAURA API ÇALIŞIYOR");
    console.log("PORT : " + PORT);
    console.log("=================================");

});