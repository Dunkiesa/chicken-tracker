jest.mock("next-auth/react", () => ({
  useSession: jest.fn(),
  signIn: jest.fn(),
  signOut: jest.fn(),
}));

const mockReplace = jest.fn();
const mockPush = jest.fn();
let mockSearchParams = new URLSearchParams();

jest.mock("next/navigation", () => ({
  useRouter: jest.fn(() => ({
    push: mockPush,
    replace: mockReplace,
  })),
  useSearchParams: jest.fn(() => mockSearchParams),
  useParams: jest.fn(() => ({})),
  usePathname: jest.fn(() => "/dashboard"),
}));

jest.mock("@mui/x-charts", () => {
  const React = require("react");
  const MockChart = React.forwardRef((props: any, _ref: any) =>
    React.createElement("div", { "data-testid": "mock-chart", "data-dataset": JSON.stringify(props.dataset) })
  );
  MockChart.displayName = "MockChart";
  return {
    BarChart: MockChart,
    PieChart: MockChart,
    ResponsiveChartContainer: MockChart,
    BarPlot: () => null,
    LinePlot: () => null,
    MarkPlot: () => null,
    ChartsXAxis: () => null,
    ChartsYAxis: () => null,
    ChartsTooltip: () => null,
    ChartsGrid: () => null,
  };
});

import { useSession } from "next-auth/react";
import { screen, waitFor } from "@testing-library/react";
import { renderWithProviders } from "./test-utils";
import DashboardPage from "@/app/dashboard/page";
import { oneMonthAgoStr, todayStr } from "@/lib/dateUtils";

const mockAnalyticsData = {
  summary: {
    total_eggs: 42,
    average_weight: 55.5,
    total_laying_chickens: 5,
    active_laying_chickens: 4,
    withdrawn_eggs: 0,
  },
  production_daily: [],
  production_weekly: [],
  production_monthly: [],
  average_weight_per_hen: [],
  weight_variance_per_hen: [],
  most_productive: [],
  production_consistency: [],
  dry_periods_current: [],
  dry_periods_longest: [],
  dry_threshold_days: 4,
  seasonal_trends: [],
  attrition_by_reason: [],
  attrition_rate: null,
};

describe("DashboardPage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSearchParams = new URLSearchParams();
    (useSession as jest.Mock).mockReturnValue({
      data: { user: { email: "user@test.com", role: "Viewer" } },
      status: "authenticated",
    });
    global.fetch = jest.fn((url: string) => {
      if (typeof url === "string" && url.startsWith("/api/analytics")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockAnalyticsData),
        });
      }
      return new Promise(() => {});
    }) as jest.Mock;
  });

  it("defaults date range to the last month", async () => {
    renderWithProviders(<DashboardPage />);

    const expectedFrom = oneMonthAgoStr();
    const expectedTo = todayStr();

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining(`from=${expectedFrom}&to=${expectedTo}`)
      );
    });

    expect(mockReplace).toHaveBeenCalledWith(
      `/dashboard?from=${expectedFrom}&to=${expectedTo}`,
      { scroll: false }
    );
  });

  it("respects date range query params when provided", async () => {
    mockSearchParams = new URLSearchParams("from=2026-01-01&to=2026-02-01");

    renderWithProviders(<DashboardPage />);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("from=2026-01-01&to=2026-02-01")
      );
    });
  });

  it("renders seasonal trends table with data", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          ...mockAnalyticsData,
          seasonal_trends: [
            { year: 2026, season: "Winter", egg_count: 142 },
            { year: 2026, season: "Autumn", egg_count: 35 },
            { year: 2025, season: "Spring", egg_count: 50 },
          ],
        }),
    });

    renderWithProviders(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText("Seasonal Trends")).toBeInTheDocument();
    });

    // BarChart is rendered as a mock — verify it received the correct dataset
    const charts = screen.getAllByTestId("mock-chart");
    const seasonalChart = charts.find((el) => {
      const dataset = el.getAttribute("data-dataset");
      return dataset && dataset.includes("Winter");
    });
    expect(seasonalChart).toBeDefined();
    const dataset = JSON.parse(seasonalChart!.getAttribute("data-dataset")!);
    expect(dataset).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ year: "2026", Winter: 142, Autumn: 35 }),
        expect.objectContaining({ year: "2025", Spring: 50 }),
      ])
    );
  });
});
