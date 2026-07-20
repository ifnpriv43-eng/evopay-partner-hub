import { createFileRoute, Outlet, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { SidebarProvider, SidebarTrigger, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";
import { logout } from "@/lib/auth.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/app")({
  component: AppLayout,
});

function AppLayout() {
  const { user } = Route.useRouteContext();
  const router = useRouter();
  const logoutFn = useServerFn(logout);

  async function handleLogout() {
    await logoutFn();
    toast.success("Sessão encerrada");
    await router.invalidate();
    router.navigate({ to: "/login" });
  }

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        <AppSidebar role={user.role} />
        <SidebarInset className="flex-1 flex flex-col">
          <header className="h-14 flex items-center justify-between border-b border-border px-4 sticky top-0 bg-background/80 backdrop-blur z-10">
            <div className="flex items-center gap-2">
              <SidebarTrigger />
              <div className="text-sm text-muted-foreground">
                <span className="text-foreground font-medium">{user.name}</span>
                <span className="mx-2">·</span>
                <span className="capitalize">{user.role}</span>
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={handleLogout}>
              <LogOut className="h-4 w-4 mr-2" /> Sair
            </Button>
          </header>
          <main className="flex-1 p-4 md:p-8">
            <Outlet />
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
