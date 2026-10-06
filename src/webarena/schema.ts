import { z } from "zod";

export const WebArenaTaskSchema = z
  .object({
    sites: z.array(z.string().min(1)).min(1),
    task_id: z.number().int().nonnegative(),
    intent_template_id: z.number().int().nonnegative(),
    start_urls: z.array(z.string().url()).min(1),
    intent: z.string().min(1),
  })
  .strict();

export type WebArenaTask = z.infer<typeof WebArenaTaskSchema>;

export const WebArenaAgentResponseSchema = z
  .object({
    task_type: z.enum(["RETRIEVE", "MUTATE", "NAVIGATE"]),
    status: z.enum([
      "SUCCESS",
      "ACTION_NOT_ALLOWED_ERROR",
      "PERMISSION_DENIED_ERROR",
      "NOT_FOUND_ERROR",
      "DATA_VALIDATION_ERROR",
      "UNKNOWN_ERROR",
    ]),
    retrieved_data: z.array(z.unknown()).nullable(),
    error_details: z.string().nullable(),
  })
  .strict();

export type WebArenaAgentResponse = z.infer<
  typeof WebArenaAgentResponseSchema
>;

export const WebArenaConfigSchema = z
  .object({
    environments: z.record(
      z.string(),
      z
        .object({
          urls: z.array(z.string().url()).min(1),
          active_url_idx: z.number().int().nonnegative().optional(),
          use_header_login: z.boolean().optional(),
          credentials: z
            .object({
              username: z.string(),
              password: z.string(),
            })
            .optional(),
        })
        .passthrough(),
    ),
  })
  .passthrough();

export type WebArenaConfig = z.infer<typeof WebArenaConfigSchema>;
