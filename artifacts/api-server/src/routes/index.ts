import { Router, type IRouter } from "express";
import healthRouter from "./health";
import invoiceAnalysisRouter from "./invoice-analysis";

const router: IRouter = Router();

router.use(healthRouter);
router.use(invoiceAnalysisRouter);

export default router;
