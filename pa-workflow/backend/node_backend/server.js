const express = require("express");
const cors = require("cors");
const axios = require("axios");
const multer = require("multer");
const FormData = require("form-data");

const app = express();
const upload = multer();

app.use(cors());

// OCR Route
app.post("/api/ocr", upload.single("file"), async (req, res) => {
    try {
        console.log("Request received",res);  // DEBUG

        if (!req.file) {
            return res.status(400).json({
                success: false,
                error: "No file uploaded"
            });
        }

        const formData = new FormData();

        formData.append("file", req.file.buffer, {
            filename: req.file.originalname,
            contentType: req.file.mimetype
        });

        const response = await axios.post(
            "http://127.0.0.1:5000/ocr",
            formData,
            {
                headers: formData.getHeaders()
            }
        );

        console.log("Flask response received"); // DEBUG

        res.json(response.data);

    } catch (err) {
        console.error("ERROR:", err.message);
        res.status(500).json({
            success: false,
            error: err.message
        });
    }
});

app.listen(3000, () => {
    console.log("Node server running on http://localhost:3000");
});