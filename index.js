const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const morgan = require("morgan");
const { initializeApp } = require("firebase/app");

const config = require("./config/environment");
const { firebaseConfig } = require("./config/firebase.config");

//route
const auth = require("./routes/auth");

initializeApp(firebaseConfig);

const app = express();

app.use(morgan("combined"));
app.use(cors());

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use("^/$", (req, res) => {
  return res.status(200).end();
});
app.use("/api/v1", auth);

app.listen(config.PORT, () => {
  console.log(`Server is running on http://${config.HOST}:${config.PORT}`);
});
