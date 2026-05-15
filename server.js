const express = require("express");
const mysql = require("mysql2");
const cors = require("cors");
const path = require("path");

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const db = mysql.createPool({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    ssl: {
        rejectUnauthorized: false
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
        LEFT JOIN pazaryerleri p ON s.pazaryeri_id = p.id
        GROUP BY p.ad
        ORDER BY toplam_kazanc DESC
    `;

    db.query(sql, (err, results) => {
        if (err) {
            return res.status(500).json({ success: false, error: err.message });
        }

        res.json({ success: true, data: results });
    });
});

app.get("/pazaryerleri", (req, res) => {
    db.query(
        "SELECT id, ad FROM pazaryerleri ORDER BY id DESC",
        (err, results) => {
            if (err) {
                return res.status(500).json({ success: false, error: err.message });
            }

            res.json({ success: true, data: results });
        }
    );
});

app.post("/pazaryeri-ekle", (req, res) => {
    const { ad } = req.body;

    if (!ad) {
        return res.status(400).json({
            success: false,
            message: "Pazaryeri adı boş olamaz"
        });
    }

    db.query(
        "INSERT INTO pazaryerleri (ad) VALUES (?)",
        [ad],
        (err, result) => {
            if (err) {
                return res.status(500).json({ success: false, error: err.message });
            }

            res.json({
                success: true,
                message: "Pazaryeri eklendi",
                insert_id: result.insertId
            });
        }
    );
});

app.put("/pazaryeri-guncelle/:id", (req, res) => {
    const { id } = req.params;
    const { ad } = req.body;

    if (!ad) {
        return res.status(400).json({
            success: false,
            message: "Pazaryeri adı boş olamaz"
        });
    }

    db.query(
        "UPDATE pazaryerleri SET ad = ? WHERE id = ?",
        [ad, id],
        (err) => {
            if (err) {
                return res.status(500).json({ success: false, error: err.message });
            }

            res.json({
                success: true,
                message: "Pazaryeri güncellendi"
            });
        }
    );
});

app.delete("/pazaryeri-sil/:id", (req, res) => {
    const { id } = req.params;

    db.query(
        "DELETE FROM pazaryerleri WHERE id = ?",
        [id],
        (err) => {
            if (err) {
                return res.status(500).json({ success: false, error: err.message });
            }

            res.json({
                success: true,
                message: "Pazaryeri silindi"
            });
        }
    );
});

app.get("/urunler", (req, res) => {
    db.query(
        "SELECT * FROM urunler ORDER BY id DESC",
        (err, results) => {
            if (err) {
                return res.status(500).json({ success: false, error: err.message });
            }

            res.json({ success: true, data: results });
        }
    );
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
            return res.status(500).json({ success: false, error: err.message });
        }

        res.json({
            success: true,
            message: "Ürün eklendi",
            insert_id: result.insertId
        });
    });
});

app.put("/urun-guncelle/:id", (req, res) => {
    const { id } = req.params;

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
        UPDATE urunler
        SET urun_kodu = ?,
            urun_adi = ?,
            alis_fiyati = ?,
            satis_fiyati = ?,
            stok = ?
        WHERE id = ?
    `;

    db.query(sql, [
        urun_kodu || "",
        urun_adi,
        alis_fiyati || 0,
        satis_fiyati || 0,
        stok || 0,
        id
    ], (err) => {
        if (err) {
            return res.status(500).json({ success: false, error: err.message });
        }

        res.json({
            success: true,
            message: "Ürün güncellendi"
        });
    });
});

app.delete("/urun-sil/:id", (req, res) => {
    const { id } = req.params;

    db.query(
        "DELETE FROM urunler WHERE id = ?",
        [id],
        (err) => {
            if (err) {
                return res.status(500).json({ success: false, error: err.message });
            }

            res.json({
                success: true,
                message: "Ürün silindi"
            });
        }
    );
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
        LEFT JOIN pazaryerleri p ON s.pazaryeri_id = p.id
        LEFT JOIN urunler u ON s.urun_id = u.id
        ORDER BY s.id DESC
    `;

    db.query(sql, (err, results) => {
        if (err) {
            return res.status(500).json({ success: false, error: err.message });
        }

        res.json({ success: true, data: results });
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

    if (!tarih || !pazaryeri_id || !urun_id || !adet || !satis_fiyati) {
        return res.status(400).json({
            success: false,
            message: "Tarih, pazaryeri, ürün, adet ve satış fiyatı zorunlu"
        });
    }

    let mysqlTarih = tarih;

    if (tarih.includes(".")) {
        const p = tarih.split(".");
        mysqlTarih = `${p[2]}-${p[1]}-${p[0]}`;
    }

    db.getConnection((err, connection) => {
        if (err) {
            return res.status(500).json({ success: false, error: err.message });
        }

        connection.beginTransaction((err) => {
            if (err) {
                connection.release();
                return res.status(500).json({ success: false, error: err.message });
            }

            connection.query(
                "SELECT alis_fiyati, stok FROM urunler WHERE id = ?",
                [urun_id],
                (err, urunRows) => {
                    if (err || urunRows.length === 0) {
                        return connection.rollback(() => {
                            connection.release();
                            res.status(404).json({
                                success: false,
                                message: "Ürün bulunamadı"
                            });
                        });
                    }

                    const satisAdet = Number(adet);
                    const alisFiyati = Number(urunRows[0].alis_fiyati);
                    const mevcutStok = Number(urunRows[0].stok);

                    if (mevcutStok < satisAdet) {
                        return connection.rollback(() => {
                            connection.release();
                            res.status(400).json({
                                success: false,
                                message: "Yetersiz stok"
                            });
                        });
                    }

                    const toplamSatis = Number(satis_fiyati) * satisAdet;
                    const toplamAlis = alisFiyati * satisAdet;
                    const kdvTutar = toplamSatis * (Number(kdv_orani || 0) / 100);
                    const kargo = Number(kargo_ucreti || 0);
                    const netKazanc = toplamSatis - toplamAlis - kdvTutar - kargo;

                    const sql = `
                        INSERT INTO satislar
                        (tarih, pazaryeri_id, urun_id, adet, satis_fiyati, kdv_orani, kargo_ucreti, net_kazanc)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    `;

                    connection.query(sql, [
                        mysqlTarih,
                        pazaryeri_id,
                        urun_id,
                        satisAdet,
                        satis_fiyati,
                        kdv_orani || 0,
                        kargo,
                        netKazanc
                    ], (err, result) => {
                        if (err) {
                            return connection.rollback(() => {
                                connection.release();
                                res.status(500).json({ success: false, error: err.message });
                            });
                        }

                        connection.query(
                            "UPDATE urunler SET stok = stok - ? WHERE id = ?",
                            [satisAdet, urun_id],
                            (err) => {
                                if (err) {
                                    return connection.rollback(() => {
                                        connection.release();
                                        res.status(500).json({ success: false, error: err.message });
                                    });
                                }

                                connection.commit((err) => {
                                    if (err) {
                                        return connection.rollback(() => {
                                            connection.release();
                                            res.status(500).json({ success: false, error: err.message });
                                        });
                                    }

                                    connection.release();

                                    res.json({
                                        success: true,
                                        message: "Satış eklendi",
                                        insert_id: result.insertId,
                                        net_kazanc: netKazanc
                                    });
                                });
                            }
                        );
                    });
                }
            );
        });
    });
});

app.put("/satis-guncelle/:id", (req, res) => {
    const { id } = req.params;

    const {
        tarih,
        pazaryeri_id,
        urun_id,
        adet,
        satis_fiyati,
        kdv_orani,
        kargo_ucreti
    } = req.body;

    let mysqlTarih = tarih;

    if (tarih.includes(".")) {
        const p = tarih.split(".");
        mysqlTarih = `${p[2]}-${p[1]}-${p[0]}`;
    }

    db.getConnection((err, connection) => {
        if (err) {
            return res.status(500).json({ success: false, error: err.message });
        }

        connection.beginTransaction((err) => {
            if (err) {
                connection.release();
                return res.status(500).json({ success: false, error: err.message });
            }

            connection.query(
                "SELECT urun_id, adet FROM satislar WHERE id = ?",
                [id],
                (err, eskiRows) => {
                    if (err || eskiRows.length === 0) {
                        return connection.rollback(() => {
                            connection.release();
                            res.status(404).json({
                                success: false,
                                message: "Satış bulunamadı"
                            });
                        });
                    }

                    const eskiUrunId = eskiRows[0].urun_id;
                    const eskiAdet = Number(eskiRows[0].adet);

                    connection.query(
                        "UPDATE urunler SET stok = stok + ? WHERE id = ?",
                        [eskiAdet, eskiUrunId],
                        (err) => {
                            if (err) {
                                return connection.rollback(() => {
                                    connection.release();
                                    res.status(500).json({ success: false, error: err.message });
                                });
                            }

                            connection.query(
                                "SELECT alis_fiyati, stok FROM urunler WHERE id = ?",
                                [urun_id],
                                (err, urunRows) => {
                                    if (err || urunRows.length === 0) {
                                        return connection.rollback(() => {
                                            connection.release();
                                            res.status(404).json({
                                                success: false,
                                                message: "Ürün bulunamadı"
                                            });
                                        });
                                    }

                                    const yeniAdet = Number(adet);
                                    const mevcutStok = Number(urunRows[0].stok);
                                    const alisFiyati = Number(urunRows[0].alis_fiyati);

                                    if (mevcutStok < yeniAdet) {
                                        return connection.rollback(() => {
                                            connection.release();
                                            res.status(400).json({
                                                success: false,
                                                message: "Yetersiz stok"
                                            });
                                        });
                                    }

                                    const toplamSatis = Number(satis_fiyati) * yeniAdet;
                                    const toplamAlis = alisFiyati * yeniAdet;
                                    const kdvTutar = toplamSatis * (Number(kdv_orani || 0) / 100);
                                    const kargo = Number(kargo_ucreti || 0);
                                    const netKazanc = toplamSatis - toplamAlis - kdvTutar - kargo;

                                    const sql = `
                                        UPDATE satislar
                                        SET tarih = ?,
                                            pazaryeri_id = ?,
                                            urun_id = ?,
                                            adet = ?,
                                            satis_fiyati = ?,
                                            kdv_orani = ?,
                                            kargo_ucreti = ?,
                                            net_kazanc = ?
                                        WHERE id = ?
                                    `;

                                    connection.query(sql, [
                                        mysqlTarih,
                                        pazaryeri_id,
                                        urun_id,
                                        yeniAdet,
                                        satis_fiyati,
                                        kdv_orani || 0,
                                        kargo,
                                        netKazanc,
                                        id
                                    ], (err) => {
                                        if (err) {
                                            return connection.rollback(() => {
                                                connection.release();
                                                res.status(500).json({ success: false, error: err.message });
                                            });
                                        }

                                        connection.query(
                                            "UPDATE urunler SET stok = stok - ? WHERE id = ?",
                                            [yeniAdet, urun_id],
                                            (err) => {
                                                if (err) {
                                                    return connection.rollback(() => {
                                                        connection.release();
                                                        res.status(500).json({ success: false, error: err.message });
                                                    });
                                                }

                                                connection.commit((err) => {
                                                    if (err) {
                                                        return connection.rollback(() => {
                                                            connection.release();
                                                            res.status(500).json({ success: false, error: err.message });
                                                        });
                                                    }

                                                    connection.release();

                                                    res.json({
                                                        success: true,
                                                        message: "Satış güncellendi",
                                                        net_kazanc: netKazanc
                                                    });
                                                });
                                            }
                                        );
                                    });
                                }
                            );
                        }
                    );
                }
            );
        });
    });
});

app.delete("/satis-sil/:id", (req, res) => {
    const { id } = req.params;

    db.getConnection((err, connection) => {
        if (err) {
            return res.status(500).json({ success: false, error: err.message });
        }

        connection.beginTransaction((err) => {
            if (err) {
                connection.release();
                return res.status(500).json({ success: false, error: err.message });
            }

            connection.query(
                "SELECT urun_id, adet FROM satislar WHERE id = ?",
                [id],
                (err, rows) => {
                    if (err || rows.length === 0) {
                        return connection.rollback(() => {
                            connection.release();
                            res.status(404).json({
                                success: false,
                                message: "Satış bulunamadı"
                            });
                        });
                    }

                    const urunId = rows[0].urun_id;
                    const adet = Number(rows[0].adet);

                    connection.query(
                        "DELETE FROM satislar WHERE id = ?",
                        [id],
                        (err) => {
                            if (err) {
                                return connection.rollback(() => {
                                    connection.release();
                                    res.status(500).json({ success: false, error: err.message });
                                });
                            }

                            connection.query(
                                "UPDATE urunler SET stok = stok + ? WHERE id = ?",
                                [adet, urunId],
                                (err) => {
                                    if (err) {
                                        return connection.rollback(() => {
                                            connection.release();
                                            res.status(500).json({ success: false, error: err.message });
                                        });
                                    }

                                    connection.commit((err) => {
                                        if (err) {
                                            return connection.rollback(() => {
                                                connection.release();
                                                res.status(500).json({ success: false, error: err.message });
                                            });
                                        }

                                        connection.release();

                                        res.json({
                                            success: true,
                                            message: "Satış silindi, stok geri eklendi"
                                        });
                                    });
                                }
                            );
                        }
                    );
                }
            );
        });
    });
});

app.get("/stok", (req, res) => {
    const sql = `
        SELECT
            id,
            urun_kodu,
            urun_adi,
            COALESCE(stok, 0) AS stok,
            COALESCE(alis_fiyati, 0) AS alis_fiyati,
            COALESCE(satis_fiyati, 0) AS satis_fiyati
        FROM urunler
        ORDER BY urun_adi ASC
    `;

    db.query(sql, (err, results) => {
        if (err) {
            return res.status(500).json({ success: false, error: err.message });
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