import { Manrope } from "next/font/google";

import Sidebar from "@/app/_components/Sidebar";
import Topbar from "@/app/_components/Topbar";
import { createClient } from "@/lib/supabase/server";

const manrope = Manrope({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--pl-font",
  display: "swap",
});

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const md = (user?.user_metadata ?? {}) as Record<string, unknown>;
  const nome =
    (typeof md.display_name === "string" && md.display_name) ||
    (typeof md.full_name === "string" && md.full_name) ||
    "Você";
  const email = user?.email ?? "";

  return (
    <div className={`ax-shell ${manrope.variable}`}>
      <Sidebar user={{ nome, email }} />
      <div className="ax-main">
        <Topbar user={{ nome }} />
        <div className="ax-content">{children}</div>
      </div>
    </div>
  );
}
