import { Router } from "express";
import { z } from "zod";
import { env } from "../config.js";
import { handleConversationClosed, handleConversationOpened, handleMessageCreated } from "../services/webhookService.js";

export const webhookRouter = Router();

const messagePayloadSchema = z.object({
  uuid: z.string().min(1),
  status: z.enum(["received", "sent"]),
  channel: z.string().min(1),
  createdAt: z.string().optional(),
  to: z.string().optional(),
  from: z.string().optional(),
  text: z.string().optional(),
  contact: z.object({
    conversationHref: z.string().optional(),
    href: z.string().optional(),
    uuid: z.string().optional(),
    source: z.string().optional(),
    name: z.string().optional(),
    phoneNumber: z.string().optional(),
    tags: z.array(z.string()).optional(),
    team: z.any().optional(),
    channel: z.any().optional(),
    customFields: z.any().optional(),
    closedAt: z.any().optional(),
    funnelId: z.any().optional(),
    avatarUrl: z.any().optional(),
    blockedAt: z.any().optional(),
    createdAt: z.string().optional(),
    assignedUser: z.string().optional(),
  }).passthrough(),
}).passthrough();

const conversationOpenedSchema = z.object({
  source: z.string().optional(),
  href: z.string().min(1),
  createdAt: z.string().optional(),
  contact: z.object({
    team: z.object({
      uuid: z.string().min(1),
      name: z.string().min(1),
    }),
    assignedUser: z.string().optional(),
  }).passthrough(),
}).passthrough();

const conversationClosedSchema = z.object({
  source: z.string().optional(),
  href: z.string().min(1),
  closedAt: z.string().optional(),
  contact: z.any().optional(),
}).passthrough();

const webhookSchema = z
  .object({
    event: z.string().optional(),
    data: z.any().optional(),
    payload: z.any().optional(),
  })
  .passthrough();

webhookRouter.post("/webhooks/callbell", async (req, res) => {
  console.log("Webhook received:", JSON.stringify(req.body, null, 2));
  
  const secret = env.WEBHOOK_SECRET?.trim();
  if (secret) {
    const headerSecret = req.header("x-webhook-secret");
    if (!headerSecret || headerSecret !== secret) {
      return res.status(401).json({ error: "unauthorized" });
    }
  }

  const parsed = webhookSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "invalid_payload", details: parsed.error.flatten() });
  }

  const rawBody = parsed.data;
  const event = parsed.data.event;
  const messageCandidate = parsed.data.payload ?? parsed.data.data ?? parsed.data;

  if (event && event !== "message_created" && event !== "conversation_opened" && event !== "conversation_closed") {
    return res.status(200).json({ status: "ignored", reason: "unsupported_event" });
  }

  try {
    if (event === "conversation_opened") {
      const openedParsed = conversationOpenedSchema.safeParse(messageCandidate);
      if (!openedParsed.success) {
        return res.status(400).json({ error: "invalid_conversation_opened", details: openedParsed.error.flatten() });
      }

      const result = await handleConversationOpened(openedParsed.data, rawBody);
      return res.status(200).json({ status: "ok", result });
    }

    if (event === "conversation_closed") {
      const closedParsed = conversationClosedSchema.safeParse(messageCandidate);
      if (!closedParsed.success) {
        return res.status(400).json({ error: "invalid_conversation_closed", details: closedParsed.error.flatten() });
      }

      const result = await handleConversationClosed(closedParsed.data, rawBody);
      return res.status(200).json({ status: "ok", result });
    }

    const messageParsed = messagePayloadSchema.safeParse(messageCandidate);
    if (!messageParsed.success) {
      return res.status(400).json({ error: "invalid_message", details: messageParsed.error.flatten() });
    }

    const result = await handleMessageCreated(messageParsed.data, rawBody);
    return res.status(200).json({ status: "ok", result });
  } catch (error) {
    return res.status(500).json({ error: "internal_error" });
  }
});
