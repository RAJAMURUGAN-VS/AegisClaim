const express  = require('express');
const multer   = require('multer');
const axios    = require('axios');
const FormData = require('form-data');
const router   = express.Router();


// Use memory storage — no disk writes in Node
const upload = multer({ storage: multer.memoryStorage() });


router.post('/ocr', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }


        // Build multipart form to send to Flask
        const form = new FormData();
        form.append('file', req.file.buffer, {
            filename:    req.file.originalname,
            contentType: req.file.mimetype,
        });


        // Call Flask OCR API
        const ocrResponse = await axios.post(
            'http://127.0.0.1:5000/ocr',
            form,
            { headers: form.getHeaders() }
        );


        const ocrResult = ocrResponse.data;


        // TODO: Save ocrResult to MongoDB or PostgreSQL here
        // await YourModel.create({ filename: ocrResult.filename, text: ocrResult.full_text });


        return res.status(200).json({
            message:   'OCR successful',
            extracted: ocrResult
        });


    } catch (error) {
        console.error('OCR error:', error.message);
        return res.status(500).json({ error: 'OCR processing failed' });
    }
});


module.exports = router;
