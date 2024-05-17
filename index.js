const { createServer } = require("http");
const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const morgan = require("morgan");
const { initializeApp } = require("firebase/app");
const admin = require("firebase-admin");
const S3 = require("aws-sdk/clients/s3");
const { PrismaClient } = require("@prisma/client");

const config = require("./config/environment");
const { firebaseConfig } = require("./config/firebase.config");
const ServiceAccount = require("./service-account.json");

const { socket, chatConnection, rootConnection } = require("./sockets");
const {
  socketAuthMiddleware,
} = require("./middleware/authentication.middleware");

require("aws-sdk/lib/maintenance_mode_message").suppress = true;

//route
const auth = require("./routes/auth");
const user = require("./routes/user");
const conversation = require("./routes/conversation");
const contact = require("./routes/contact");

admin.initializeApp({
  credential: admin.credential.cert(ServiceAccount),
});
initializeApp(firebaseConfig);

const s3 = new S3({
  accessKeyId: config.AWS_S3_ACCESS_KEY,
  secretAccessKey: config.AWS_S3_SECRET_KEY,
});

const prisma = new PrismaClient();

const app = express();

app.use(morgan("combined"));
app.use(cors());

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use((req, res, next) => {
  req.context = {
    prisma,
    io,
    s3,
  };
  next();
});

app.use("^/$", (req, res) => {
  return res.status(404).end();
});
app.use("/api/v1", auth);
app.use("/api/v1", user);
app.use("/api/v1", conversation);
app.use("/api/v1", contact);

const httpServer = app.listen(config.PORT, () => {
  console.log(`Server is running on http://${config.HOST}:${config.PORT}`);
});

const io = socket(httpServer);

io.use((socket, next) => {
  socket.request.context = {
    prisma,
  };

  next();
});

io.use(socketAuthMiddleware);

io.on("connection", rootConnection);
io.of("/chats").on("connection", chatConnection);
