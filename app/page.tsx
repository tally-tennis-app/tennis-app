import { redirect } from "next/navigation";
import { getUser } from "@/src/lib/auth/dal";
import Welcome from "@/app/welcome/page";
export default async function Home() {
  if (await getUser()) redirect("/dashboard");
  return <Welcome />;
}
