import { Mail, MessageCircle, Phone } from 'lucide-react'
import { useState } from 'react'
import { Link } from '@tanstack/react-router'
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

type Contact = { id: string; name: string; phone: string | null; email: string | null; organisation?: string | null }

/** A contact's name; tapping it opens their details with Call / WhatsApp / Mail. Without phone or email it links to their page. */
export function ContactLink({ band, contact: c }: { band: string; contact: Contact }) {
  const t = useT()
  const [open, setOpen] = useState(false)
  const page = { to: '/$band/contacts/$contact', params: { band, contact: c.id } } as const
  if (!c.phone && !c.email)
    return (
      <Link {...page} className="flex min-h-11 items-center font-medium underline-offset-4 hover:underline">
        {c.name}
      </Link>
    )
  return (
    <>
      <button type="button" className="flex min-h-11 items-center text-left font-medium underline-offset-4 hover:underline" onClick={() => setOpen(true)}>
        {c.name}
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{c.name}</DialogTitle>
            {c.organisation && <DialogDescription>{c.organisation}</DialogDescription>}
          </DialogHeader>
          <div className="space-y-1 text-sm break-all">
            {c.phone && <p>{c.phone}</p>}
            {c.email && <p>{c.email}</p>}
          </div>
          <div className="grid grid-cols-2 gap-2">
            {c.phone && (
              <>
                <Button asChild size="lg">
                  <a href={`tel:${telNumber(c.phone)}`}>
                    <Phone aria-hidden /> {t.common.call}
                  </a>
                </Button>
                <Button asChild size="lg" variant="outline">
                  <a href={`https://wa.me/${whatsappNumber(c.phone)}`} target="_blank" rel="noreferrer">
                    <MessageCircle aria-hidden /> {t.common.whatsapp}
                  </a>
                </Button>
              </>
            )}
            {c.email && (
              <Button asChild size="lg" variant="outline" className={c.phone ? 'col-span-2' : undefined}>
                <a href={`mailto:${c.email}`}>
                  <Mail aria-hidden /> {t.common.mail}
                </a>
              </Button>
            )}
          </div>
          <Link {...page} className="text-center text-sm text-muted-foreground underline-offset-4 hover:underline">
            {t.records.viewContact}
          </Link>
        </DialogContent>
      </Dialog>
    </>
  )
}
