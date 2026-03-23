import { UserId } from "@flex/utils";

export const createUserId = (id = "test-user-id") => id as UserId;

export const userId = createUserId();
