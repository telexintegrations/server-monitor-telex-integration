import express from "express";
import { tick, webhook } from "../controllers/telex.js";

const router = express.Router();

// webhook endpoint for incoming message from telex
router.post("/webhook", webhook);

// tick endpoint for interval message from telex
router.post("/tick", tick);

export default router;
