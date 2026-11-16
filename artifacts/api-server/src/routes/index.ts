import { Router, type IRouter } from "express";
import healthRouter from "./health";
import invoiceAnalysisRouter from "./invoice-analysis";
import stripeTestRouter from "./stripe-test";

const router: IRouter = Router();

router.use(healthRouter);
router.use(invoiceAnalysisRouter);
router.use(stripeTestRouter);

export default router;
