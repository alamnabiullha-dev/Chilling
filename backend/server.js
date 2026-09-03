const http = require("http");
const { Server } = require("socket.io");

const app = require("./app");
const connectDB = require("./config/db");
const env = require("./config/env");
const registerSockets = require("./sockets");

async function start() {
  await connectDB();

  // Render handles HTTPS.
  // Locally, you can use http://localhost:5002.
  const server = http.createServer(app);

  const io = new Server(server, {
    cors: {
      origin: env.clientUrl,
      credentials: true,
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    },
  });

  app.set("io", io);

  registerSockets(io);

  server.listen(env.port, "0.0.0.0", () => {
    console.log(`Aurora API listening on port ${env.port}`);
  });
}

start().catch((error) => {
  console.error(error);
  process.exit(1);
});
