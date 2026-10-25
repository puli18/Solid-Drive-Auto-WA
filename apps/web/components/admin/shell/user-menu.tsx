import { Check, LogOut, Monitor, Moon, Sun, UserRound } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useRouter } from '@/lib/navigation';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAuth } from '@/lib/auth';
import { initials } from '../format';

export function UserMenu() {
  const { user, role, signOut, demo, switchDemoRole } = useAuth();
  const { theme, setTheme } = useTheme();
  const router = useRouter();
  const name = user?.displayName ?? user?.email ?? 'Account';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="rounded-full" aria-label="Account menu">
          <Avatar className="size-8">
            <AvatarFallback className="bg-foreground text-background text-xs font-semibold">{initials(name)}</AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="font-normal">
          <div className="truncate text-sm font-medium">{name}</div>
          <div className="text-muted-foreground truncate text-xs">
            {user?.email} · <span className="capitalize">{role}</span>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {demo && (
          <>
            <DropdownMenuLabel className="text-muted-foreground text-xs font-normal">Preview as</DropdownMenuLabel>
            {(['admin', 'staff'] as const).map((r) => (
              <DropdownMenuItem key={r} onSelect={() => switchDemoRole(r)}>
                <UserRound />
                <span className="capitalize">{r}</span>
                {role === r && <Check className="ml-auto" />}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
          </>
        )}
        <DropdownMenuLabel className="text-muted-foreground text-xs font-normal">Theme</DropdownMenuLabel>
        {(
          [
            ['light', 'Light', Sun],
            ['dark', 'Dark', Moon],
            ['system', 'System', Monitor],
          ] as const
        ).map(([value, label, Icon]) => (
          <DropdownMenuItem key={value} onSelect={() => setTheme(value)}>
            <Icon />
            {label}
            {theme === value && <Check className="ml-auto" />}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={async () => {
            await signOut();
            router.replace('/admin/login');
          }}
        >
          <LogOut />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
