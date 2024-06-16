const express = require("express");
const morgan = require("morgan");
const cors = require("cors");
const path = require("path");
const connectDB = require("./models/database");
const app = express();
require('dotenv').config({path: '.env'})
const port = process.env.PORT || 1337;
const routes = require("./routes/index");
const Minio = require('minio');
const BodyParser = require("body-parser");
const Multer = require("multer");

const corsOptions = {
    exposedHeaders: 'Authorization',
    };
    
var minioClient = new Minio.Client({
    endPoint: 'minio.tin12q.org',
    accessKey: process.env.MINIO_ACCESS_KEY,
    secretKey: process.env.MINIO_SECRET_KEY,
    api:"s3v4",
    path:"auto",
    port: 443,
    useSSL: true
});
connectDB();

app.use(morgan("combined"));
app.use(express.static(path.join(__dirname, "public")));
app.use(express.json());
app.use(BodyParser.json());
app.use(express.urlencoded({extended: true}));
app.use(cors(corsOptions));


routes(app);


minioClient.bucketExists("api-mobile", function(error) {
    if(error) {
        console.log(error)
    }
    var server = app.listen(port, function() {
        console.log("Listening on port %s...", server.address().port);
    });
});

// app.listen(port, () => {
//     console.log("Listening", port)
// })