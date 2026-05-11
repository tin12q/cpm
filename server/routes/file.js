const express = require("express");
const router = express.Router();
const {uploadFile, getFileByName } = require("../controller/FileController"); 

// Define routes
router.post("/upload", uploadFile); // Route for file upload
router.get('/download/:name', getFileByName);

module.exports = router;