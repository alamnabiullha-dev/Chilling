/*require("./config/env");
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const compression = require("compression");
const cookieParser = require("cookie-parser");
const mongoSanitize = require("express-mongo-sanitize");
const morgan = require("morgan");
const routes = require("./routes");
const env = require("./config/env");
const { apiLimiter } = require("./middleware/rateLimiters");
const { notFound, errorHandler } = require("./middleware/error");

const app = express();

app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(
  cors({
    origin: env.clientUrl,
    credentials: true
  })
);
app.use(compression());
app.use(cookieParser());
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(mongoSanitize());
app.use(apiLimiter);
app.use(morgan(env.nodeEnv === "production" ? "combined" : "dev"));

app.use((req, _res, next) => {
  req.io = app.get("io");
  next();
});

app.get("/health", (_req, res) => res.json({ ok: true, service: "aurora-chat" }));
app.use("/api", routes);
app.use(notFound);
app.use(errorHandler);

module.exports = app; */
require("./config/env");

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const compression = require("compression");
const cookieParser = require("cookie-parser");
const mongoSanitize = require("express-mongo-sanitize");
const morgan = require("morgan");
const path = require("path");

const routes = require("./routes");
const env = require("./config/env");
const { apiLimiter } = require("./middleware/rateLimiters");
const { notFound, errorHandler } = require("./middleware/error");

const app = express();

/*
|--------------------------------------------------------------------------
| Allowed Frontend Origins
|--------------------------------------------------------------------------
*/

const allowedOrigins = [
  "http://localhost:5173",
  "https://localhost:5173",

  "http://10.15.141.0:5173",
  "https://10.15.141.0:5173",
];

/*
|--------------------------------------------------------------------------
| Security
|--------------------------------------------------------------------------
*/

app.use(
  helmet({
    crossOriginResourcePolicy: {
      policy: "cross-origin",
    },

    crossOriginOpenerPolicy: {
      policy: "same-origin-allow-popups",
    },
  })
);

/*
|--------------------------------------------------------------------------
| CORS
|--------------------------------------------------------------------------
*/

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests without Origin.
      // Useful for Postman, curl, server-to-server, etc.
      if (!origin) {
        return callback(null, true);
      }

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      console.error(
        "Blocked CORS origin:",
        origin
      );

      return callback(
        new Error(
          `Not allowed by CORS: ${origin}`
        )
      );
    },

    credentials: true,

    methods: [
      "GET",
      "POST",
      "PUT",
      "PATCH",
      "DELETE",
      "OPTIONS",
    ],

    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-Requested-With",
    ],

    optionsSuccessStatus: 204,
  })
);

/*
|--------------------------------------------------------------------------
| Basic Middleware
|--------------------------------------------------------------------------
*/

app.use(compression());

app.use(cookieParser());

app.use(
  express.json({
    limit: "1mb",
  })
);

app.use(
  express.urlencoded({
    extended: true,
    limit: "1mb",
  })
);

app.use(mongoSanitize());

app.use(apiLimiter);

/*
|--------------------------------------------------------------------------
| Logger
|--------------------------------------------------------------------------
*/

app.use(
  morgan(
    env.nodeEnv === "production"
      ? "combined"
      : "dev"
  )
);

/*
|--------------------------------------------------------------------------
| Socket.IO Access
|--------------------------------------------------------------------------
*/

app.use((req, _res, next) => {
  req.io = app.get("io");
  next();
});

/*
|--------------------------------------------------------------------------
| Health Check
|--------------------------------------------------------------------------
*/

app.get("/health", (_req, res) => {
  res.status(200).json({
    ok: true,
    service: "aurora-chat",
  });
});

/*
|--------------------------------------------------------------------------
| Uploaded Media
|--------------------------------------------------------------------------
|
| Physical file:
|
| backend/
|   uploads/
|     media/
|       1786889111277-Zl2hhWpJjX.jpg
|
| Public URL:
|
| https://localhost:5002/api/upload/media/
| 1786889111277-Zl2hhWpJjX.jpg
|
|--------------------------------------------------------------------------
*/

const mediaDirectory = path.resolve(
  __dirname,
  "uploads",
  "media"
);

console.log(
  "Media directory:",
  mediaDirectory
);

app.use(
  "/api/upload/media",
  express.static(mediaDirectory, {
    fallthrough: false,

    setHeaders: (res) => {
      res.setHeader(
        "Access-Control-Allow-Origin",
        "*"
      );

      res.setHeader(
        "Cross-Origin-Resource-Policy",
        "cross-origin"
      );

      res.setHeader(
        "Cache-Control",
        "public, max-age=31536000, immutable"
      );
    },
  })
);

/*
|--------------------------------------------------------------------------
| API Routes
|--------------------------------------------------------------------------
*/

app.use("/api", routes);

/*
|--------------------------------------------------------------------------
| 404 Handler
|--------------------------------------------------------------------------
*/

app.use(notFound);

/*
|--------------------------------------------------------------------------
| Error Handler
|--------------------------------------------------------------------------
*/

app.use(errorHandler);

/*
|--------------------------------------------------------------------------
| Export
|--------------------------------------------------------------------------
*/

module.exports = app;