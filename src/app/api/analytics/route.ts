import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getAnalytics } from "@/lib/analytics";
import type { AnalyticsData } from "@/lib/analytics";

function analyticsToCsv(data: AnalyticsData): string {
  const lines: string[] = [];

  // Summary
  lines.push("section,key,value");
  lines.push(`summary,total_eggs,${data.summary.total_eggs}`);
  lines.push(`summary,average_weight,${data.summary.average_weight ?? ""}`);
  lines.push(`summary,total_laying_chickens,${data.summary.total_laying_chickens}`);
  lines.push(`summary,active_laying_chickens,${data.summary.active_laying_chickens}`);

  // Production daily
  lines.push("");
  lines.push("section,date,count");
  for (const row of data.production_daily) {
    lines.push(`production_daily,${row.date},${row.count}`);
  }

  // Production weekly
  lines.push("");
  lines.push("section,date,count");
  for (const row of data.production_weekly) {
    lines.push(`production_weekly,${row.date},${row.count}`);
  }

  // Production monthly
  lines.push("");
  lines.push("section,date,count");
  for (const row of data.production_monthly) {
    lines.push(`production_monthly,${row.date},${row.count}`);
  }

  // Average weight per hen
  lines.push("");
  lines.push("section,chicken_id,chicken_name,avg_weight");
  for (const row of data.average_weight_per_hen) {
    lines.push(`avg_weight,${row.chicken_id},${row.chicken_name},${row.avg_weight ?? ""}`);
  }

  // Weight variance per hen
  lines.push("");
  lines.push("section,chicken_id,chicken_name,min_weight,max_weight,std_dev");
  for (const row of data.weight_variance_per_hen) {
    lines.push(`weight_variance,${row.chicken_id},${row.chicken_name},${row.min_weight ?? ""},${row.max_weight ?? ""},${row.std_dev ?? ""}`);
  }

  // Most productive
  lines.push("");
  lines.push("section,chicken_id,chicken_name,egg_count");
  for (const row of data.most_productive) {
    lines.push(`most_productive,${row.chicken_id},${row.chicken_name},${row.egg_count}`);
  }

  // Production consistency
  lines.push("");
  lines.push("section,chicken_id,chicken_name,egg_count,active_days,laying_rate");
  for (const row of data.production_consistency) {
    lines.push(`consistency,${row.chicken_id},${row.chicken_name},${row.egg_count},${row.active_days},${row.laying_rate}`);
  }

  // Dry periods
  lines.push("");
  lines.push("section,chicken_id,chicken_name,days_since_last_egg");
  for (const row of data.dry_periods_current) {
    lines.push(`dry_period_current,${row.chicken_id},${row.chicken_name},${row.days_since_last_egg ?? ""}`);
  }

  // Dry period alerts
  lines.push("");
  lines.push("section,chicken_id,chicken_name,days_since_last_egg");
  for (const row of data.dry_periods_alert) {
    lines.push(`dry_period_alert,${row.chicken_id},${row.chicken_name},${row.days_since_last_egg ?? ""}`);
  }

  // Seasonal trends
  lines.push("");
  lines.push("section,year,season,egg_count");
  for (const row of data.seasonal_trends) {
    lines.push(`seasonal,${row.year},${row.season},${row.egg_count}`);
  }

  // Attrition
  lines.push("");
  lines.push("section,reason,count");
  for (const row of data.attrition_by_reason) {
    lines.push(`attrition,${row.reason},${row.count}`);
  }
  lines.push(`attrition_rate,,${data.attrition_rate ?? ""}`);

  return lines.join("\n") + "\n";
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const dateFrom = searchParams.get("from") || undefined;
    const dateTo = searchParams.get("to") || undefined;
    const thresholdParam = searchParams.get("dry_threshold");
    const dryThresholdDays = thresholdParam ? parseInt(thresholdParam, 10) : 4;

    const data = await getAnalytics(dateFrom, dateTo, dryThresholdDays);

    const format = searchParams.get("format");
    if (format === "csv") {
      const csv = analyticsToCsv(data);
      const filename = `chickentrack-analytics-${dateFrom || "default"}-${dateTo || "default"}.csv`;
      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${filename}"`,
        },
      });
    }

    return NextResponse.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ message }, { status: 500 });
  }
}
