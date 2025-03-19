import { Subscriber, Publisher } from "zeromq";
import { logger } from "../utils/logger.js";
import { CollectorService } from "../metrics/collector.js";
import { AppConstants } from "../utils/constant.js";
import { isDevEnvironment } from "../config/config.js";

export enum MessageType {
  getMetrics = "getMetrics",
  getLoadAverages = "getLoadAverages",
  ping = "ping",
  replyPong = "replyPong",
  replyWithGeneralMetrics = "replyWithGeneralMetrics",
  replyWithLoadAvgs = "replyWithLoadAvgs",
}

export interface IZeromqMessage {
  type: MessageType | string;
  channelId: string;
  data: any;
  timestamp: string;
}

let subSocket: Subscriber | null = null;
let pubSocket: Publisher | null = null;

/**
 * Connect to the integration server's publisher socket
 */
export async function connectToIntegrationServer(
  channelId: string
): Promise<void> {
  try {
    if (subSocket) {
      logger.warn("ZeroMQ socket is already connected");
      return;
    }

    // fetch the host and port from the integration server
    const serverConfig = await getIntegrationServerHostAndPort();

    if (!serverConfig?.serverUrl || !serverConfig?.serverPort) {
      throw new Error("Failed to fetch integration server config");
    }

    const serverUrl = serverConfig?.serverUrl;
    const serverPort = serverConfig?.serverPort + 1;

    console.log("serverConfig", serverConfig);

    // Set up subscriber socket
    subSocket = new Subscriber();
    const subSocketAddress = `tcp://${serverUrl}:${serverPort}`;
    await subSocket.connect(subSocketAddress);
    await subSocket.subscribe(channelId);

    // Set up publisher socket for replies
    pubSocket = new Publisher();
    const pubPort = serverPort + 1; // Use next port for replies
    const pubSocketAddress = `tcp://${serverUrl}:${pubPort}`;
    await pubSocket.connect(pubSocketAddress);

    logger.info(`Connected to integration server at ${subSocketAddress}`);
    logger.info(`Reply socket connected to ${pubSocketAddress}`);
    logger.info(`Subscribed to channel ${channelId}`);

    // Start message handler
    handleMessages(channelId);
  } catch (error) {
    logger.error(
      `Failed to connect to integration server: ${(error as Error).message}`
    );
    throw error;
  }
}

/**
 * Send a reply back to the integration server
 */
async function sendReply(
  channelId: string,
  data: any,
  messageType: MessageType
): Promise<void> {
  if (!pubSocket) {
    throw new Error("Reply socket not connected");
  }

  try {
    const reply: IZeromqMessage = {
      type: messageType,
      channelId,
      data,
      timestamp: new Date().toISOString(),
    };

    await pubSocket.send([channelId, JSON.stringify(reply)]);
    logger.info(`Sent reply to channel ${channelId}: ${JSON.stringify(data)}`);
  } catch (error) {
    logger.error(`Failed to send reply: ${(error as Error).message}`);
  }
}

async function sendMetrics(channelId: string, messageType: MessageType) {
  const metrics = await CollectorService.getMetrics();
  logger.info(`Metrics: ${JSON.stringify(metrics)}`);
  await sendReply(channelId, { metrics }, messageType);
}

/**
 * Handle incoming messages from the integration server
 */
async function handleMessages(channelId: string): Promise<void> {
  if (!subSocket) {
    throw new Error("ZeroMQ socket not connected");
  }

  try {
    for await (const [topic, messageBuffer] of subSocket) {
      try {
        const message = JSON.parse(messageBuffer.toString()) as IZeromqMessage;
        logger.info(`Received message: ${JSON.stringify(message)}`);

        if (topic.toString() !== channelId) {
          continue;
        }

        // Process different types of requests
        const incomingMessageType = message.type;
        if (incomingMessageType === MessageType.getMetrics) {
          await sendMetrics(channelId, MessageType.replyWithGeneralMetrics);
        } else if (incomingMessageType == MessageType.getLoadAverages) {
          await sendMetrics(channelId, MessageType.replyWithLoadAvgs);
        } else if (incomingMessageType === MessageType.ping) {
          logger.info("Received ping from integration server");
          await sendReply(channelId, { status: "pong" }, MessageType.replyPong);
        } else {
          logger.warn(`Unknown message type: ${incomingMessageType}`);
        }
      } catch (error) {
        logger.error(`Error processing message: ${(error as Error).message}`);
      }
    }
  } catch (error) {
    logger.error(`Error in message handler: ${(error as Error).message}`);
    throw error;
  }
}

/**
 * Close the ZeroMQ socket connection
 */
export function closeSocket(): void {
  if (subSocket) {
    try {
      subSocket.close();
      subSocket = null;
      logger.info("Subscriber socket closed");
    } catch (error) {
      logger.error(
        `Error closing subscriber socket: ${(error as Error).message}`
      );
    }
  }

  if (pubSocket) {
    try {
      pubSocket.close();
      pubSocket = null;
      logger.info("Publisher socket closed");
    } catch (error) {
      logger.error(
        `Error closing publisher socket: ${(error as Error).message}`
      );
    }
  }
}

async function getIntegrationServerHostAndPort(): Promise<{
  serverUrl: string;
  serverPort: number;
} | null> {
  try {
    if (isDevEnvironment) {
      return {
        serverUrl: "0.0.0.0",
        serverPort: 3002,
      };
    }

    const response = await fetch(AppConstants.Package.GlobalConfigUrl);

    if (!response.ok) {
      console.error(`Failed to fetch global config: ${response.statusText}`);
      return {
        serverUrl: "13.61.63.138",
        serverPort: 3002,
      };
    }

    const config = await response.json();

    const serverUrl = config.serverUrl;
    const serverPort = config.serverPort;

    return { serverUrl, serverPort };
  } catch (error) {
    return null;
  }
}
