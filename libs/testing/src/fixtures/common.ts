export const createTimestamp = (value = "2026-06-04T12:00:00.000Z") => value;
export const timestamp = createTimestamp();

export const createUuid = (value = "3dd9d530-bc2a-4abe-b677-abf06b7323da") =>
  value;
export const uuid = createUuid();

export const createToken = (value = uuid) => value;
export const token = createToken();
