import { Router, type IRouter } from "express";
import healthRouter from "./health";
import invoiceAnalysisRouter from "./invoice-analysis";
import stripeDemoRouter from "./stripe-demo";

const router: IRouter = Router();

router.use(healthRouter);
router.use(invoiceAnalysisRouter);
router.use(stripeDemoRouter);

export default router;
