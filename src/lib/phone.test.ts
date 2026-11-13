import { describe, expect, it } from 'vitest'
import { telNumber, whatsappNumber } from './phone'

describe('phone numbers', () => {
  it('makes tel: numbers', () => {
    expect(telNumber('+31 6 1111 2222')).toBe('+31611112222')
    expect(telNumber('06-1111 2222')).toBe('0611112222')
  })

  it('makes international WhatsApp numbers, Dutch by default', () => {
    expect(whatsappNumber('+31 6 1111 2222')).toBe('31611112222')
    expect(whatsappNumber('+31 (0)6 1111 2222')).toBe('31611112222')
    expect(whatsappNumber('0032 470 12 34 56')).toBe('32470123456')
    expect(whatsappNumber('06-1111 2222')).toBe('31611112222')
  })
})
