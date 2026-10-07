import {
  BuildingIcon,
  ChevronsUpDownIcon,
  ImageIcon,
  LandmarkIcon,
  LayoutTemplateIcon,
  LogOutIcon,
  NewspaperIcon,
  UserCogIcon,
  UsersIcon,
  type LucideIcon,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { NavLink, useLocation, useNavigate } from 'react-router';
import { useAuth } from '@/auth/AuthProvider';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from '@/components/ui/sidebar';
import { notify } from '@/lib/notify';
import { useSession } from '@/lib/session';
import { visibleSections, type SectionKey } from '@/navigation';

const ICONS: Record<SectionKey, LucideIcon> = {
  articles: NewspaperIcon,
  persons: UsersIcon,
  organizations: BuildingIcon,
  bills: LandmarkIcon,
  media: ImageIcon,
  homepage: LayoutTemplateIcon,
  users: UserCogIcon,
};

function initials(name: string): string {
  return Array.from(name.replace(/^.\./, '').trim())[0]?.toUpperCase() ?? '?';
}

export function AppSidebar() {
  const { t } = useTranslation();
  const { user } = useSession();
  const { logout } = useAuth();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  if (!user) return null;

  async function onLogout() {
    await logout();
    notify.info(t('auth.loggedOut'));
    navigate('/login', { replace: true });
  }

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="px-2 py-1.5 text-sm font-semibold group-data-[collapsible=icon]:hidden">{t('app.title')}</div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>{t('nav.label')}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {visibleSections(user.role).map((section) => {
                const Icon = ICONS[section.key];
                const label = t(`nav.${section.key}`);
                return (
                  <SidebarMenuItem key={section.key}>
                    <SidebarMenuButton asChild isActive={pathname.startsWith(section.path)} tooltip={label}>
                      <NavLink to={section.path}>
                        <Icon aria-hidden />
                        <span>{label}</span>
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton size="lg">
                  <Avatar className="size-8 rounded-lg">
                    <AvatarFallback className="rounded-lg">{initials(user.displayName)}</AvatarFallback>
                  </Avatar>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-medium">{user.displayName}</span>
                    <span className="truncate text-xs text-muted-foreground">{t(`roles.${user.role}`)}</span>
                  </div>
                  <ChevronsUpDownIcon className="ml-auto size-4" aria-hidden />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="top" align="start" className="min-w-56">
                <DropdownMenuLabel className="font-normal">
                  <div className="text-sm font-medium">{user.displayName}</div>
                  <div className="text-xs text-muted-foreground">{user.email}</div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => void onLogout()}>
                  <LogOutIcon aria-hidden />
                  {t('auth.logout')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
