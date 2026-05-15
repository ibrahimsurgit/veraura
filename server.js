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
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
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
    res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.get("/api", (req, res) => {

    res.json({
        success: true,
        message: "VERAURA API AKTİF"
    });

});

app.get("/dashboard", (req, res) => {

    const sql = `
        SELECT
            COALESCE(p.ad, 'TANIMSIZ') AS pazaryeri,
            COUNT(s.id) AS siparis_sayisi,
            COALESCE(SUM(s.adet), 0) AS toplam_adet,
            COALESCE(SUM(s.net_kazanc), 0) AS toplam_kazanc
        FROM satislar s
        LEFT JOIN pazaryerleri p
            ON s.pazaryeri_id = p.id
        GROUP BY p.ad
        ORDER BY toplam_kazanc DESC
    `;

    db.query(sql, (err, results) => {

        if (err) {

            console.log(err);

            return res.status(500).json({
                success: false,
                error: err.message
            });

        }

        res.json({
            success: true,
            data: results
        });

    });

});

app.get("/pazaryerleri", (req, res) => {

    const sql = `
        SELECT id, ad
        FROM pazaryerleri
        ORDER BY id DESC
    `;

    db.query(sql, (err, results) => {

        if (err) {

            console.log(err);

            return res.status(500).json({
                success: false,
                error: err.message
            });

        }

        res.json({
            success: true,
            data: results
        });

    });

});

app.post("/pazaryeri-ekle", (req, res) => {

    const { ad } = req.body;

    if (!ad) {

        return res.status(400).json({
            success: false,
            message: "Pazaryeri adı boş olamaz"
        });

    }

    const sql = `
        INSERT INTO pazaryerleri (ad)
        VALUES (?)
    `;

    db.query(sql, [ad], (err, result) => {

        if (err) {

            console.log(err);

            return res.status(500).json({
                success: false,
                error: err.message
            });

        }

        res.json({
            success: true,
            message: "Pazaryeri eklendi",
            insert_id: result.insertId
        });

    });

});

app.get("/urunler", (req, res) => {

    const sql = `
        SELECT *
        FROM urunler
        ORDER BY id DESC
    `;

    db.query(sql, (err, results) => {

        if (err) {

            console.log(err);

            return res.status(500).json({
                success: false,
                error: err.message
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
            message: "Ürün adı boş olamaz"
        });

    }

    const sql = `
        INSERT INTO urunler
        (
            urun_kodu,
            urun_adi,
            alis_fiyati,
            satis_fiyati,
            stok
        )
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

            console.log(err);

            return res.status(500).json({
                success: false,
                error: err.message
            });

        }

        res.json({
            success: true,
            message: "Ürün eklendi",
            insert_id: result.insertId
        });

    });

});

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

            console.log(err);

            return res.status(500).json({
                success: false,
                error: err.message
            });

        }

        res.json({
            success: true,
            data: results
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
        kargo_ucreti
    } = req.body;

    if (
        !tarih ||
        !pazaryeri_id ||
        !urun_id ||
        !adet ||
        !satis_fiyati
    ) {

        return res.status(400).json({
            success: false,
            message: "Eksik alan var"
        });

    }

    let mysqlTarih = tarih;

    if (tarih.includes(".")) {

        const parca = tarih.split(".");
        mysqlTarih = `${parca[2]}-${parca[1]}-${parca[0]}`;

    }

    db.beginTransaction((err) => {

        if (err) {

            return res.status(500).json({
                success: false,
                error: err.message
            });

        }

        db.query(
            "SELECT alis_fiyati, stok FROM urunler WHERE id = ?",
            [urun_id],
            (err, urunResult) => {

                if (err || urunResult.length === 0) {

                    return db.rollback(() => {

                        res.status(500).json({
                            success: false,
                            message: "Ürün bulunamadı",
                            error: err ? err.message : "Ürün yok"
                        });

                    });

                }

                const alisFiyati = Number(urunResult[0].alis_fiyati);
                const mevcutStok = Number(urunResult[0].stok);
                const satisAdet = Number(adet);

                if (mevcutStok < satisAdet) {

                    return db.rollback(() => {

                        res.status(400).json({
                            success: false,
                            message: "Yetersiz stok"
                        });

                    });

                }

                const toplamSatis =
                    Number(satis_fiyati) * satisAdet;

                const toplamAlis =
                    alisFiyati * satisAdet;

                const kdvTutar =
                    toplamSatis *
                    (Number(kdv_orani || 0) / 100);

                const kargo =
                    Number(kargo_ucreti || 0);

                const hesaplananNetKazanc =
                    toplamSatis -
                    toplamAlis -
                    kdvTutar -
                    kargo;

                const sql = `
                    INSERT INTO satislar
                    (
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

                db.query(sql, [
                    mysqlTarih,
                    pazaryeri_id,
                    urun_id,
                    satisAdet,
                    satis_fiyati,
                    kdv_orani || 0,
                    kargo,
                    hesaplananNetKazanc
                ], (err, result) => {

                    if (err) {

                        return db.rollback(() => {

                            res.status(500).json({
                                success: false,
                                error: err.message
                            });

                        });

                    }

                    db.query(
                        "UPDATE urunler SET stok = stok - ? WHERE id = ?",
                        [satisAdet, urun_id],
                        (err) => {

                            if (err) {

                                return db.rollback(() => {

                                    res.status(500).json({
                                        success: false,
                                        error: err.message
                                    });

                                });

                            }

                            db.commit((err) => {

                                if (err) {

                                    return db.rollback(() => {

                                        res.status(500).json({
                                            success: false,
                                            error: err.message
                                        });

                                    });

                                }

                                res.json({
                                    success: true,
                                    message: "Satış eklendi",
                                    insert_id: result.insertId,
                                    net_kazanc: hesaplananNetKazanc
                                });

                            });

                        }
                    );

                });

            }
        );

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
        ORDER BY urun_adi ASC
    `;

    db.query(sql, (err, results) => {

        if (err) {

            console.log(err);

            return res.status(500).json({
                success: false,
                error: err.message
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

    console.log("VERAURA API ÇALIŞIYOR");
    console.log("PORT:", PORT);

});