import { useEffect, useState } from 'react'
import { Button } from '#/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '#/components/ui/dialog'
import { useT } from '#/lib/i18n'

type Ask = { text: string; action: string; resolve: (ok: boolean) => void }
let show: ((ask: Ask) => void) | undefined

/** window.confirm in our own dialog: resolves true when `action` (a red button) is picked. Needs <ConfirmHost /> mounted. */
export const confirmDialog = (text: string, action: string) =>
  new Promise<boolean>((resolve) => (show ? show({ text, action, resolve }) : resolve(false)))

/** Mounted once, in the root layout. */
export function ConfirmHost() {
  const t = useT()
  const [ask, setAsk] = useState<Ask>()
  const [open, setOpen] = useState(false)
  useEffect(() => {
    show = (a) => {
      setAsk(a)
      setOpen(true)
    }
    return () => (show = undefined)
  }, [])
  const close = (ok: boolean) => {
    ask?.resolve(ok)
    setOpen(false)
  }
  return (
    <Dialog open={open} onOpenChange={(o) => !o && close(false)}>
      <DialogContent showCloseButton={false} aria-describedby={undefined} className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-base leading-normal font-normal">{ask?.text}</DialogTitle>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => close(false)}>
            {t.common.cancel}
          </Button>
          <Button variant="destructive" onClick={() => close(true)}>
            {ask?.action}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
