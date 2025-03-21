import express from "express";
import {
  healthCheck,
  integrationConfig,
  tick,
  webhook,
} from "../controllers/telexController.js";

const router = express.Router();

// webhook endpoint for incoming message from telex
router.post("/webhook", webhook);

// tick endpoint for interval message from telex
router.post("/tick", tick);

// health check endpoint
router.get("/health", healthCheck);

// integration config endpoint
router.get("/integration-config", integrationConfig);

export default router;
