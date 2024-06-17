const express = require('express');
const router = express.Router();
const File = '../models/file.model';
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const Minio = require('minio');

var minioClient = new Minio.Client({
    endPoint: 'minio.tin12q.org',
    accessKey: process.env.MINIO_ACCESS_KEY,
    secretKey: process.env.MINIO_SECRET_KEY,
    api:"s3v4",
    path:"auto",
    port: 443,
    useSSL: true
});

const uploadFile = (req, res) => {
    const upload = multer({ storage: multer.memoryStorage() }).single('file');
    upload(req, res, (err) => {
        if (err) {
            console.log(err);
            return res.status(400).json({ error: err.message });
        }

        const { buffer } = req.file;
        const filename = req.body.filename;

        minioClient.putObject('api-mobile', filename, buffer, (error, etag) => {
            if (error) {
                console.log(error);
                return res.status(500).json({ error: error.message });
            }
            res.json({ message: 'File uploaded successfully', etag });
        });
    });
};

const getFileByName = (req, res) => {
    const bucketName = 'api-mobile';
    const fileName = req.params.name; 

    minioClient.getObject(bucketName, fileName, (error, stream) => {
        if (error) {
            console.log(error);
            return res.status(500).json({ error: error.message });
        }
        stream.pipe(res);
        
    });
}
module.exports = {uploadFile, getFileByName};