const express = require("express");
const mysql = require("mysql2");
const cors = require("cors");

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static("public"));

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

app.get("/pazaryerleri", (req, res) => {
    db.query(
        "SELECT * FROM pazaryerleri ORDER BY ad",
        (err, results) => {
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
        }
    );
});

app.get("/urunler", (req, res) => {
    db.query(
        "SELECT * FROM urunler ORDER BY urun_adi",
        (err, results) => {
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
        }
    );
});

app.get("/satislar", (req, res) => {
    const sql = `
        SELECT 
            s.id,
            s.tarih,
            p.ad AS pazaryeri,
            u.urun_kodu,
            u.urun_adi,
            s.adet,
            s.satis_fiyati,
            s.kdv_orani,
            s.kargo_ucreti,
            s.net_kazanc
        FROM satislar s
        LEFT JOIN pazaryerleri p ON s.pazaryeri_id = p.id
        LEFT JOIN urunler u ON s.urun_id = u.id
        ORDER BY s.tarih DESC, s.id DESC
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

app.get("/stok", (req, res) => {
    const sql = `
        SELECT
            id,
            urun_kodu,
            urun_adi,
            stok,
            alis_fiyati,
            satis_fiyati,
            aktif
        FROM urunler
        ORDER BY urun_adi
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

app.get("/dashboard", (req, res) => {
    const sql = `
        SELECT
            p.ad AS pazaryeri,
            COUNT(s.id) AS siparis_sayisi,
            SUM(s.adet) AS toplam_adet,
            SUM(s.net_kazanc) AS toplam_kazanc
        FROM satislar s
        LEFT JOIN pazaryerleri p ON s.pazaryeri_id = p.id
        GROUP BY p.ad
        ORDER BY toplam_kazanc DESC
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
            message: "Ürün adı zorunlu"
        });
    }

    const sql = `
        INSERT INTO urunler
        (urun_kodu, urun_adi, alis_fiyati, satis_fiyati, stok)
        VALUES (?, ?, ?, ?, ?)
    `;

    db.query(sql, [
        urun_kodu || "",
        urun_adi,
        alis_fiyati || 0,
        satis_fiyati || 0,
        stok || 0
    ], (err, result) => {
        if (err) {
            return res.status(500).json({
                success: false,
                error: err
            });
        }

        res.json({
            success: true,
            message: "Ürün eklendi",
            id: result.insertId
        });
    });
});

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

    if (!tarih || !pazaryeri_id || !urun_id) {
        return res.status(400).json({
            success: false,
            message: "Tarih, pazaryeri ve ürün zorunlu"
        });
    }

    const sql = `
        INSERT INTO satislar
        (tarih, pazaryeri_id, urun_id, adet, satis_fiyati, kdv_orani, kargo_ucreti, net_kazanc)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;

    db.query(sql, [
        tarih,
        pazaryeri_id,
        urun_id,
        adet || 1,
        satis_fiyati || 0,
        kdv_orani || 0,
        kargo_ucreti || 0,
        net_kazanc || 0
    ], (err, result) => {
        if (err) {
            return res.status(500).json({
                success: false,
                error: err
            });
        }

        res.json({
            success: true,
            message: "Satış eklendi",
            id: result.insertId
        });
    });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log("API çalışıyor");
});