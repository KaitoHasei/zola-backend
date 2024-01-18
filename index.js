const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const morgan = require("morgan");

const config = require("./config/environment");

const app = express();

app.use(morgan("combined"));
app.use(cors());

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use("^/$", (req, res) => {
  return res.status(200).end();
});

app.listen(config.PORT, () => {
  console.log(`Server is running on http://${config.HOST}:${config.PORT}`);
});
