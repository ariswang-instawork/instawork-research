import { Router, type IRouter } from "express";
import healthRouter from "./health";
import researchRouter from "./research";
import adminRouter from "./admin";

const router: IRouter = Router();

router.use(healthRouter);
router.use(researchRouter);
router.use(adminRouter);

export default router;
