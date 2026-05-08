import z from "zod";

import { commonRequestSchema } from "../common";
import {
  MultiShareCodeResponseSchema,
  postShareCodeCancelRequestSchema,
  ShareCodeSchema,
  SingleShareCodeResponseSchema,
} from "../domain/shareCode";

export type SingleShareCodeResponse = z.infer<
  typeof SingleShareCodeResponseSchema
>;
export type MultiShareCodeResponse = z.infer<
  typeof MultiShareCodeResponseSchema
>;
export type ShareCode = z.infer<typeof ShareCodeSchema>;

export type ShareCodeRequestSchema = z.infer<typeof commonRequestSchema>;

export type PostShareCodeCancelRequestSchema = z.infer<
  typeof postShareCodeCancelRequestSchema
>;
