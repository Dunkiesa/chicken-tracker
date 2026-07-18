import { jest } from "@jest/globals";

// Mock next-auth/react
jest.mock("next-auth/react", () => ({
  useSession: jest.fn(),
  signIn: jest.fn(),
  signOut: jest.fn(),
}));

// Mock next/navigation
jest.mock("next/navigation", () => ({
  useRouter: jest.fn(() => ({
    push: jest.fn(),
    replace: jest.fn(),
  })),
  useParams: jest.fn(() => ({})),
  usePathname: jest.fn(() => "/"),
}));

// Mock window.matchMedia for jsdom
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: jest.fn().mockImplementation((query: unknown) => ({
    matches: false,
    media: query as string,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

class MockEventSource {
  static instances: MockEventSource[] = [];
  url: string;
  onopen: ((ev: Event) => void) | null = null;
  onmessage: ((ev: MessageEvent) => void) | null = null;
  onerror: ((ev: Event) => void) | null = null;
  readyState: number = 0;
  close = jest.fn();
  addEventListener = jest.fn();
  removeEventListener = jest.fn();
  dispatchEvent = jest.fn();

  constructor(url: string | URL) {
    this.url = url.toString();
    MockEventSource.instances.push(this);
  }
}

Object.defineProperty(window, "EventSource", {
  writable: true,
  value: MockEventSource,
});
