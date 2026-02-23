import { z } from "zod";

import { inboundPreferencesRequestSchema } from "../schemas/inbound/preferences";
import { inboundCreateUserRequestSchema } from "../schemas/inbound/user";
import type { PreferencesRequest } from "../schemas/remote/preferences";
import type { CreateUserRequest } from "../schemas/remote/user";

type RouteOperation = "getNotifications" | "updateNotifications" | "createUser";

type BaseRouteContract<
  TOp extends RouteOperation,
  TSchema extends z.ZodType | undefined,
  TRemoteBody = never,
> = {
  operation: TOp;
  method: "GET" | "POST";
  inboundPath: string;
  remotePath: string;
  requiredHeaders?: readonly string[];
  inboundSchema?: TSchema;
  toRemoteBody?: (
    inbound: z.output<Exclude<TSchema, undefined>>,
  ) => TRemoteBody;
};

export type GetNotificationsRouteContract = BaseRouteContract<
  "getNotifications",
  undefined
>;

export type UpdateNotificationsRouteContract = BaseRouteContract<
  "updateNotifications",
  typeof inboundPreferencesRequestSchema,
  PreferencesRequest
> & {
  inboundSchema: typeof inboundPreferencesRequestSchema;
  toRemoteBody: (
    inbound: z.output<typeof inboundPreferencesRequestSchema>,
  ) => PreferencesRequest;
};

export type CreateUserRouteContract = BaseRouteContract<
  "createUser",
  typeof inboundCreateUserRequestSchema,
  CreateUserRequest
> & {
  inboundSchema: typeof inboundCreateUserRequestSchema;
  toRemoteBody: (
    inbound: z.output<typeof inboundCreateUserRequestSchema>,
  ) => CreateUserRequest;
};

export type RouteContract =
  | GetNotificationsRouteContract
  | UpdateNotificationsRouteContract
  | CreateUserRouteContract;

export type ResolvedRequest =
  | {
      operation: "getNotifications";
      requestingServiceUserId: string;
    }
  | {
      operation: "updateNotifications";
      requestingServiceUserId: string;
      remoteBody: PreferencesRequest;
    }
  | {
      operation: "createUser";
      remoteBody: CreateUserRequest;
    };
