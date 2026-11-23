import { Link, useParams } from '@tanstack/react-router'
import { BookOpen, Check, LogOut, MessageSquare, Settings, Shield, Sparkles } from 'lucide-react'
import { Avatar, AvatarFallback } from '#/components/ui/avatar'
import { Button } from '#/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '#/components/ui/dropdown-menu'
import { authClient } from '#/lib/auth-client'
import { forgetDevice } from '#/lib/push'
import { useT } from '#/lib/i18n'

type Props = { name: string; bands: { slug: string; name: string }[]; isAdmin: boolean }

/** Avatar button + account menu. */
export function UserMenu({ name, bands, isAdmin }: Props) {
  // Settings live per band: the band you're in, otherwise your first band.
  const settingsBand = useParams({ strict: false }).band ?? bands[0]?.slug
  const t = useT()

  async function logOut() {
    await forgetDevice() // still signed in: the server removes it from this account
    await authClient.signOut()
    // The offline cache holds band data too (public/sw.js).
    for (const key of (await globalThis.caches?.keys()) ?? []) await caches.delete(key)
    // Full page load: drops all band data the browser still holds in memory.
    window.location.assign('/')
  }

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="rounded-full" aria-label={t.menu.accountFor(name)}>
          <Avatar className="size-9">
            <AvatarFallback className="bg-stage font-bold text-ink">{name[0].toUpperCase()}</AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent id="user-menu" align="end" className="w-60">
        <DropdownMenuLabel className="truncate font-normal text-muted-foreground">{name}</DropdownMenuLabel>
        {bands.length > 0 && (
          <>
            <DropdownMenuSeparator />
            {bands.map((b) => (
              <DropdownMenuItem key={b.slug} asChild>
                <Link to="/$band" params={{ band: b.slug }}>
                  <span className="flex-1">{b.name}</span>
                  {b.slug === settingsBand && <Check aria-hidden />}
                </Link>
              </DropdownMenuItem>
            ))}
          </>
        )}
        <DropdownMenuSeparator />
        {settingsBand && (
          <>
            <DropdownMenuItem asChild>
              <Link to="/$band/settings" params={{ band: settingsBand }}>
                <Settings aria-hidden /> {t.menu.settings}
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link to="/$band/welcome" params={{ band: settingsBand }}>
                <Sparkles aria-hidden /> {t.menu.welcome}
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link to="/$band/feedback" params={{ band: settingsBand }}>
                <MessageSquare aria-hidden /> {t.menu.feedback}
              </Link>
            </DropdownMenuItem>
          </>
        )}
        <DropdownMenuItem asChild>
          <Link to="/manual">
            <BookOpen aria-hidden /> {t.menu.manual}
          </Link>
        </DropdownMenuItem>
        {isAdmin && (
          <DropdownMenuItem asChild>
            <Link to="/admin">
              <Shield aria-hidden /> {t.menu.admin}
            </Link>
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={logOut}>
          <LogOut aria-hidden /> {t.menu.logOut}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
