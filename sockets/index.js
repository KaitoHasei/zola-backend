const { Server } = require("socket.io");

let io;

const socket = (server) => {
  io = new Server(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST", "PUT", "DELETE"],
      allowedHeaders: [
        "Content-Type",
        "Authorization",
        "X-Requested-With",
        "Accept",
        "Origin",
      ],
    },
  });

  // server.listen(8081);

  return io;
};

const rootConnection = (socket) => {
  console.log(`client connected: ${socket.id}`);

  const { session } = socket.request.context;

  socket.join(session.id);

  socket.on("disconnect", () => {
    console.log("client disconnected");
  });
};

const chatConnection = (socket) => {
  const { conversationId } = socket.handshake.query || "";

  console.log("client chat connected: ", socket.id);

  if (conversationId) socket.join(conversationId);

  socket.on("disconnect", () => console.log("client chat disconnected"));
};
module.exports = {
  socket,
  rootConnection,
  chatConnection,
};
