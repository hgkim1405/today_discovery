import { z } from "zod";

export type { components, paths } from "./openapi.js";

export const activityTypeSchema = z.enum([
  "FESTIVAL",
  "PERFORMANCE",
  "EXHIBITION",
  "CLASS",
  "SPORTS",
  "FACILITY",
  "OTHER",
]);
export const priceKindSchema = z.enum(["FREE", "PAID", "MIXED", "UNKNOWN"]);
export const bookingStatusSchema = z.enum([
  "OPEN",
  "CLOSED",
  "WAITLIST",
  "NOT_REQUIRED",
  "UNKNOWN",
]);
export const idSchema = z.string().regex(/^[0-9A-HJKMNP-TV-Z]{26}$/);
export const isoDateSchema = z.iso.date();

export const activitySearchQuerySchema = z
  .object({
    region: z.string().max(12).optional(),
    from: isoDateSchema.optional(),
    to: isoDateSchema.optional(),
    activityType: activityTypeSchema.optional(),
    freeOnly: z
      .enum(["true", "false"])
      .transform((value) => value === "true")
      .optional()
      .default(false),
    maxConfirmedPriceKrw: z.coerce.number().int().min(0).optional(),
    query: z.string().max(100).optional(),
    cursor: z.string().max(300).optional(),
    limit: z.coerce.number().int().min(1).max(50).default(20),
  })
  .superRefine((query, context) => {
    if (query.from && query.to && query.from > query.to) {
      context.addIssue({
        code: "custom",
        message: "`from` must be on or before `to`",
        path: ["from"],
      });
    }
  });

export type ActivitySearchQuery = z.infer<typeof activitySearchQuerySchema>;
