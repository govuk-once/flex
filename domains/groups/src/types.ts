export const GroupType = {
  NOTIFICATION: "NOTIFICATION",
} as const;

export type GroupType = (typeof GroupType)[keyof typeof GroupType];

export const GroupAction = {
  JOIN: "JOIN",
  LEAVE: "LEAVE",
} as const;

export type GroupAction = (typeof GroupAction)[keyof typeof GroupAction];
