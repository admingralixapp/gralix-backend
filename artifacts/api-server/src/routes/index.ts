import { Router, type IRouter } from "express";
import healthRouter from "./health";
import exercisesRouter from "./exercises";
import sessionsRouter from "./sessions";
import repsRouter from "./reps";
import progressRouter from "./progress";
import socialRouter from "./social";

const router: IRouter = Router();

router.use(healthRouter);
router.use(socialRouter);
router.use(exercisesRouter);
router.use(sessionsRouter);
router.use(repsRouter);
router.use(progressRouter);

export default router;
