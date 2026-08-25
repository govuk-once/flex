interface ClientMock {
  reset: () => unknown;
  restore: () => void;
}

const mocks = new Map<() => ClientMock, ClientMock>();

/**
 * Installs an AWS client mock the first time a fixture asks for it, then hands
 * the same one back for the rest of the file. Keyed on the factory, so each
 * client is mocked once.
 *
 * Mocks are installed on use rather than at import, so a suite that never
 * touches a given AWS client keeps the real one — and with it any HTTP stub
 * already standing in for that call.
 */
export function useClientMock<Mock extends ClientMock>(create: () => Mock) {
  const installed = mocks.get(create);

  if (installed) {
    return installed as Mock;
  }

  const mock = create();

  mocks.set(create, mock);

  return mock;
}

/** Drops every stub and recorded call, leaving the mocks installed. */
export function resetClientMocks() {
  for (const mock of mocks.values()) {
    mock.reset();
  }
}

/**
 * Puts the real `send` back on every mocked client. The next fixture to ask
 * for one installs it again.
 */
export function restoreClientMocks() {
  for (const mock of mocks.values()) {
    mock.restore();
  }

  mocks.clear();
}
