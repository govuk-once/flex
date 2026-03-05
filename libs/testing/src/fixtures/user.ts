import { UserId } from "@flex/utils";

export const createUserId = (id: string = "test-user-id") => id as UserId;

export const userId = createUserId();
