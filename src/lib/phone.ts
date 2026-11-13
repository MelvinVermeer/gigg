/** For a tel: link: digits and a leading +. */
export const telNumber = (phone: string) => phone.replace(/\(0\)/g, '').replace(/[^\d+]/g, '')

/** For wa.me: international digits without +. A leading single 0 is taken as a Dutch number. */
export function whatsappNumber(phone: string) {
  const d = telNumber(phone)
  if (d.startsWith('+')) return d.slice(1).replace(/\+/g, '')
  if (d.startsWith('00')) return d.slice(2)
  if (d.startsWith('0')) return `31${d.slice(1)}`
  return d
}
