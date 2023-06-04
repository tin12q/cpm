const express = require("express");
const morgan = require("morgan");
const cors = require("cors");
const path = require("path");
const connectDB = require("./models/database");
const app = express();
require('dotenv').config({ path: '.env' })
const port = process.env.PORT || 1337;
const routes = require("./routes/index");

connectDB();
app.use(morgan("combined"));
app.use(express.static(path.join(__dirname, "public")));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());

routes(app);

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
