import { Link, useRouterState } from "@tanstack/react-router";
import { LayoutDashboard, ArrowDownToLine, ArrowUpFromLine, History, Users, Wallet, Zap } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

const adminItems = [
  { title: "Dashboard", url: "/app", icon: LayoutDashboard },
  { title: "Depósitos", url: "/app/depositos", icon: ArrowDownToLine },
  { title: "Saques", url: "/app/saques", icon: ArrowUpFromLine },
  { title: "Histórico", url: "/app/historico", icon: History },
  { title: "Funcionários", url: "/app/funcionarios", icon: Users },
];

const employeeItems = [
  { title: "Meus recebimentos", url: "/app/meus-recebimentos", icon: Wallet },
  { title: "Histórico", url: "/app/historico", icon: History },
];

export function AppSidebar({ role }: { role: "admin" | "funcionario" }) {
  const currentPath = useRouterState({ select: (r) => r.location.pathname });
  const items = role === "admin" ? adminItems : employeeItems;
  const isActive = (path: string) => currentPath === path;

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex items-center gap-2 px-2 py-2">
          <div className="h-8 w-8 rounded-lg gradient-primary flex items-center justify-center flex-shrink-0">
            <Zap className="h-4 w-4 text-primary-foreground" />
          </div>
          <span className="font-display font-bold text-base group-data-[collapsible=icon]:hidden">EvoPay</span>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>{role === "admin" ? "Painel" : "Área pessoal"}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild isActive={isActive(item.url)} tooltip={item.title}>
                    <Link to={item.url}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
