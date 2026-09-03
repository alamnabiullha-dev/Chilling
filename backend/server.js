const https = require("https");
const fs = require("fs");
const { Server } = require("socket.io");

const app = require("./app");
const connectDB = require("./config/db");
const env = require("./config/env");
const registerSockets = require("./sockets");

async function start() {
  await connectDB();

  const httpsOptions = {
    key: fs.readFileSync("./10.15.141.0+2-key.pem"),
    cert: fs.readFileSync("./10.15.141.0+2.pem"),
  };

  const server = https.createServer(httpsOptions, app);

  const io = new Server(server, {
    cors: {
      origin: "https://localhost:5173",
      credentials: true,
    },
  });

  app.set("io", io);

  registerSockets(io);

  server.listen(env.port, "0.0.0.0", () => {
    console.log(`Aurora API listening on https://localhost:${env.port}`);
  });
}

start().catch((error) => {
  console.error(error);
  process.exit(1);
});