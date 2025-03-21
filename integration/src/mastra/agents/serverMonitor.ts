import { Agent } from "@mastra/core";
import { createGoogleGenerativeAI } from "@ai-sdk/google";

const google = createGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
});
const model = google("gemini-1.5-pro");

export const serverMonitorAgent = new Agent({
  name: "Server Monitor Agent",
  instructions: `
  You are a server monitor agent that monitors the health of a server.
  You are given a list of servers and you need to check if they are running.
  If they are not running, you need to start them.
  If they are running, you need to check if they are healthy.
  If they are not healthy, you need to restart them.
  If they are healthy, you need to return a message saying that the server is healthy.
  `,
  model: model,
});
