const { createServer } = require("http");
const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const morgan = require("morgan");
const { initializeApp } = require("firebase/app");
const admin = require("firebase-admin");
const { PrismaClient } = require("@prisma/client");

const config = require("./config/environment");
const ServiceAccount = require("./service-account.json");
const { firebaseConfig } = require("./config/firebase.config");

const { socket, chatConnection, rootConnection } = require("./sockets");
const {
  socketAuthMiddleware,
} = require("./middleware/authentication.middleware");

//route
const auth = require("./routes/auth");
const user = require("./routes/user");
const conversation = require("./routes/conversation");

const prisma = new PrismaClient();

admin.initializeApp({
  credential: admin.credential.cert(ServiceAccount),
});
initializeApp(firebaseConfig);

const app = express();
const httpServer = createServer(app);

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

app.use(morgan("combined"));
app.use(cors());

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use((req, res, next) => {
  req.context = {
    prisma,
    io,
  };
  next();
});

app.use("^/$", (req, res) => {
  return res.status(200).end();
});
app.use("/api/v1", auth);
app.use("/api/v1", user);
app.use("/api/v1", conversation);

app.listen(config.PORT, () => {
  console.log(`Server is running on http://${config.HOST}:${config.PORT}`);
});
