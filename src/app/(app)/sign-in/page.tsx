import { AuthForm } from "@/components/AuthForm";
import { safeNext } from "@/lib/app/format";
export default async function SignIn({ searchParams }: { searchParams: Promise<{ next?: string; mode?: string }> }) {
  const sp = await searchParams;
  return <div className="gate"><h1>Welcome to GoalGrid</h1><p>Create a free account to use every tool: Pro, Premium and the community. No code and no payment.</p><AuthForm next={safeNext(sp.next)} signup={sp.mode === "signup"} /></div>;
}
