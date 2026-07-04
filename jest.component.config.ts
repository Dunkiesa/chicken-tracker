import type { Config } from "jest";

const config: Config = {
  preset: "ts-jest",
  testEnvironment: "jsdom",
  roots: ["<rootDir>/tests/components"],
  setupFiles: ["<rootDir>/tests/setup.ts"],
  setupFilesAfterEnv: [
    "<rootDir>/tests/components/setup.ts",
    "@testing-library/jest-dom",
  ],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
  },
  transform: {
    "^.+\\.[jt]sx?$": ["ts-jest", { tsconfig: "tsconfig.jest.json" }],
  },
  transformIgnorePatterns: [
    "node_modules/(?!@material/material-color-utilities)",
  ],
};

export default config;
