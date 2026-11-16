import express, { type Express, type ErrorRequestHandler } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import cookieParser from "cookie-parser";
import stripeWebhookRouter from "./routes/stripe-webhook";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors());
app.use(stripeWebhookRouter);
app.use(cookieParser());
app.use(express.json({ limit: "64kb" }));
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

// Parser errors can contain the raw request body: never forward/log the error object.
const parserError: ErrorRequestHandler = (error, _req, res, next) => {
  if (error?.type === "entity.too.large" || error?.type === "entity.parse.failed") {
    res.status(error.type === "entity.too.large" ? 413 : 400).json({
      error: "نص الطلب غير صالح أو أكبر من الحد المسموح.",
    });
    return;
  }
  next(error);
};
app.use(parserError);

export default app;
