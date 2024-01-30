const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const morgan = require("morgan");
const { initializeApp } = require("firebase/app");
const admin = require("firebase-admin");

const config = require("./config/environment");
const ServiceAccount = require("./service-account.json");
const { firebaseConfig } = require("./config/firebase.config");

//route
const auth = require("./routes/auth");
const user = require("./routes/user");

admin.initializeApp({
  credential: admin.credential.cert(ServiceAccount),
});
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
app.use("/api/v1", user);

app.listen(config.PORT, () => {
  console.log(`Server is running on http://${config.HOST}:${config.PORT}`);
});
