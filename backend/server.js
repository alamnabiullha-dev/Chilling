
const http = require("http");
const { Server } = require("socket.io");

const app = require("./app");
const connectDB = require("./config/db");
const env = require("./config/env");
const registerSockets = require("./sockets");

async function start() {
  try {
    /*
    |--------------------------------------------------------------------------
    | Connect MongoDB
    |--------------------------------------------------------------------------
    */

    await connectDB();

    /*
    |--------------------------------------------------------------------------
    | HTTP Server
    |--------------------------------------------------------------------------
    |
    | Render automatically handles HTTPS.
    | Do NOT use local .pem certificates on Render.
    |
    */

    const server = http.createServer(app);

    /*
    |--------------------------------------------------------------------------
    | Socket.IO
    |--------------------------------------------------------------------------
    */

    const allowedSocketOrigins = [
      "http://localhost:5173",
      "https://localhost:5173",
      "http://10.15.141.0:5173",
      "https://10.15.141.0:5173",
      "https://chilling-1.onrender.com",
    ];

    if (
      env.clientUrl &&
      !allowedSocketOrigins.includes(env.clientUrl)
    ) {
      allowedSocketOrigins.push(env.clientUrl);
    }

    const io = new Server(server, {
      cors: {
        origin: allowedSocketOrigins,
        credentials: true,
        methods: [
          "GET",
          "POST",
          "PUT",
          "PATCH",
          "DELETE",
          "OPTIONS",
        ],
      },
    });

    /*
    |--------------------------------------------------------------------------
    | Attach Socket.IO to Express
    |--------------------------------------------------------------------------
    */

    app.set("io", io);

    /*
    |--------------------------------------------------------------------------
    | Register Socket Events
    |--------------------------------------------------------------------------
    */

    registerSockets(io);

    /*
    |--------------------------------------------------------------------------
    | Start Server
    |--------------------------------------------------------------------------
    */

    server.listen(
      env.port,
      "0.0.0.0",
      () => {
        console.log(
          `Aurora API listening on port ${env.port}`
        );

        console.log(
          `Environment: ${env.nodeEnv}`
        );

        console.log(
          `Client URL: ${env.clientUrl}`
        );
      }
    );

    /*
    |--------------------------------------------------------------------------
    | Graceful Shutdown
    |--------------------------------------------------------------------------
    */

    const shutdown = async (signal) => {
      console.log(
        `${signal} received. Shutting down server...`
      );

      server.close(() => {
        console.log("HTTP server closed.");
        process.exit(0);
      });
    };

    process.on("SIGTERM", () => shutdown("SIGTERM"));
    process.on("SIGINT", () => shutdown("SIGINT"));
  } catch (error) {
    console.error(
      "Server startup failed:",
      error
    );

    process.exit(1);
  }
}

start();


