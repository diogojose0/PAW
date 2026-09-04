require("dotenv").config();

var createError = require("http-errors");
var express = require("express");
var path = require("path");
var cookieParser = require("cookie-parser");
var logger = require("morgan");
var mongoose = require("mongoose");
var session = require("express-session");
var cors = require("cors");
var swaggerUi = require("swagger-ui-express");
var swaggerDocument = require("./docs/swagger.json");
const { MongoStore } = require("connect-mongo");

const ensureAdmin = require("./services/ensureAdmin");
const { ensureDefaultCategories } = require("./services/categoryService");

const indexRouter = require("./routes/index");
const authRouter = require("./routes/auth");
const adminRouter = require("./routes/admin");
const supermarketRouter = require("./routes/supermarket");
const courierRouter = require("./routes/courier");
const { attachUserIfExists } = require("./middlewares/auth.middleware");
const apiRouter = require('./routes/api');

mongoose
  .connect(process.env.MONGODB_URI)
  .then(async () => {
    console.log("DB Connected");
    await ensureAdmin();
    await ensureDefaultCategories();
  })
  .catch((err) => console.error(err));

var app = express();

app.set("views", path.join(__dirname, "views"));
app.set("view engine", "ejs");

app.use(logger("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:4200",
    credentials: true
  })
);
app.use(express.static(path.join(__dirname, "public")));

app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
      mongoUrl: process.env.MONGODB_URI,
    }),
    cookie: {
      maxAge: 1000 * 60 * 60 * 2,
    },
  }),
);

app.use(function (req, res, next) {
  res.locals.currentUser = null;
  res.locals.flash = req.session?.flash || null;

  if (req.session?.flash) {
    delete req.session.flash;
  }
  next();
});

app.use(attachUserIfExists);

app.use("/", indexRouter);
app.use("/auth", authRouter);
app.use("/admin", adminRouter);
app.use("/supermarket", supermarketRouter);
app.use("/courier", courierRouter);
app.use('/api', apiRouter);

app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument));

app.get("/api-docs.json", function (req, res) {
  return res.json(swaggerDocument);
});

app.use("/api", function (req, res) {
  return res.status(404).json({
    message: "API endpoint not found.",
  });
});

app.use(function (req, res, next) {
  next(createError(404));
});

app.use(function (err, req, res, next) {
  if (req.originalUrl.startsWith("/api")) {
    return res.status(err.status || 500).json({
      message: err.message || "Internal server error.",
    });
  }

  res.locals.message = err.message;
  res.locals.error = req.app.get("env") === "development" ? err : {};

  res.status(err.status || 500);
  res.render("error");
});

module.exports = app;