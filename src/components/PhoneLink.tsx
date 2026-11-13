import { MessageCircle, Phone } from 'lucide-react'
import { useState } from 'react'
import { Button } from '#/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '#/components/ui/dialog'
import { useT } from '#/lib/i18n'
import { telNumber, whatsappNumber } from '#/lib/phone'

/** A phone number; tapping it asks: call, or WhatsApp. */
export function PhoneLink({ name, phone }: { name: string; phone: string }) {
  const t = useT()
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        type="button"
        className="underline-offset-4 hover:underline"
        onClick={(e) => {
          e.preventDefault() // inside a <summary>: don't toggle it
          setOpen(true)
        }}
      >
        {phone}
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{name}</DialogTitle>
            <DialogDescription>{phone}</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-2">
            <Button asChild size="lg">
              <a href={`tel:${telNumber(phone)}`}>
                <Phone aria-hidden /> {t.common.call}
              </a>
            </Button>
            <Button asChild size="lg" variant="outline">
              <a href={`https://wa.me/${whatsappNumber(phone)}`} target="_blank" rel="noreferrer">
                <MessageCircle aria-hidden /> {t.common.whatsapp}
              </a>
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
