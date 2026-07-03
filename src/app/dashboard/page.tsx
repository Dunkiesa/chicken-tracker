"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function DashboardRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/");
  }, [router]);

  return (
    <main style={{ padding: "2rem", textAlign: "center", color: "#999" }}>
      Redirecting to dashboard…
    </main>
  );
}
