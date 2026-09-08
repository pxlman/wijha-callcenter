export function mockUser(overrides?: Record<string, unknown>) {
  return {
    id: 1,
    email: 'test@example.com',
    phoneNumber: '',
    passwordHash: '$2b$10$mockhash',
    name: 'Test User',
    role: 'user',
    otp: null,
    otpExpiry: null,
    jwtToken: null,
    profileImage: null,
    profileMime: null,
    ...overrides,
  };
}

export function mockClient(overrides?: Partial<{
  id: bigint;
  name: string | null;
  type: string;
  nextDialAt: Date | null;
  agentId: number | null;
  numbers: { number: string; clientId: bigint }[];
  clientInfo: { key: string; clientId: bigint; value: string }[];
}>) {
  return {
    id: 1n,
    name: 'John Doe',
    type: 'OWNER',
    nextDialAt: null,
    agentId: null,
    numbers: [] as { number: string; clientId: bigint }[],
    clientInfo: [] as { key: string; clientId: bigint; value: string }[],
    ...overrides,
  };
}

export function mockNumber(overrides?: Partial<{
  number: string;
  clientId: bigint;
}>) {
  return {
    number: '555-0100',
    clientId: 1n,
    ...overrides,
  };
}

export function mockClientInfo(overrides?: Partial<{
  key: string;
  clientId: bigint;
  value: string;
}>) {
  return {
    key: 'email',
    clientId: 1n,
    value: 'john@example.com',
    ...overrides,
  };
}

export function mockCallRecord(overrides?: Partial<{
  id: bigint;
  clientId: bigint | null;
  agentId: number | null;
  status: string | null;
  time: Date;
  duration: number | null;
  agentNotes: string | null;
}> & { client?: Record<string, unknown> }) {
  return {
    id: 1n,
    clientId: 1n,
    agentId: 1,
    status: 'completed',
    time: new Date('2024-06-01T12:00:00Z'),
    duration: 60,
    agentNotes: null,
    ...overrides,
  };
}

export function mockProject(overrides?: Partial<{
  id: number;
  name: string;
  description: string | null;
}>) {
  return {
    id: 1,
    name: 'Default Project',
    description: 'Main project',
    ...overrides,
  };
}

export function mockUserSession(overrides?: Partial<{
  agentId: number;
  firstBeat: Date;
  lastBeat: Date;
  duration: number;
}>) {
  return {
    agentId: 1,
    firstBeat: new Date('2024-06-01T09:00:00Z'),
    lastBeat: new Date('2024-06-01T09:30:00Z'),
    duration: 1800,
    ...overrides,
  };
}
