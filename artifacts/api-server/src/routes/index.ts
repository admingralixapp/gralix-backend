import { Router, type IRouter } from "express";
import healthRouter from "./health";
import exercisesRouter from "./exercises";
import sessionsRouter from "./sessions";
import repsRouter from "./reps";
import progressRouter from "./progress";
import socialRouter from "./social";
import leaderboardRouter from "./leaderboard";
import feedRouter from "./feed";
import communityFeedRouter from "./community-feed";
import storageRouter from "./storage";
import ttsRouter from "./tts";
import mobilityRouter from "./mobility";

const router: IRouter = Router();

router.use(healthRouter);
router.use(socialRouter);
router.use(leaderboardRouter);
router.use(feedRouter);
router.use(communityFeedRouter);
router.use(storageRouter);
router.use(ttsRouter);
router.use(exercisesRouter);
router.use(sessionsRouter);
router.use(repsRouter);
router.use(progressRouter);
router.use(mobilityRouter);

export default router;
