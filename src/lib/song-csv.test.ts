import { expect, it } from 'vitest'
import { en } from './i18n.en'
import { columnProblems, convert, duplicateTarget, exampleRow, guessTargets, mergeSong, parseCsv, rowValues, songsCsv, toTable, withNoteLines } from './song-csv'

it('parseCsv: detects the delimiter, strips the BOM, keeps quoted multi-line cells, drops blank rows', () => {
  expect(parseCsv('﻿a;b\r\n"x;1";"two\nlines"\r\n\r\n')).toEqual([['a', 'b'], ['x;1', 'two\nlines']])
  expect(parseCsv('a,b\n1,"say ""hi"""')).toEqual([['a', 'b'], ['1', 'say "hi"']])
  expect(parseCsv('a\tb, c\n1\t2')).toEqual([['a', 'b, c'], ['1', '2']])
})

it('guessTargets: EN/NL names and synonyms, custom fields by name, the rest to notes', () => {
  const custom = [{ id: 'f1', name: 'Lead vocal' }]
  expect(guessTargets(['Song', 'Duur', 'Toonsoort', 'tempo', 'LEAD-VOCAL', 'Remarks', 'Who knows', '#', ''], custom)).toEqual([
    'field:title', 'field:durationSec', 'field:key', 'field:bpm', 'custom:f1', 'field:notes', 'notes', 'skip', 'skip',
  ])
  expect(guessTargets(['Title', 'Name'], [])).toEqual(['field:title', 'notes'])
})

it('exampleRow: the row with the most cells filled', () => {
  expect(exampleRow([['a', ''], ['b', 'c'], ['d', '']])).toEqual(['b', 'c'])
})

it('convert: durations, BPM, tags; undefined when not understood', () => {
  expect(['3:45', '1:02:30', '225', '3.45'].map((v) => convert('field:durationSec', v))).toEqual([225, 3750, 225, undefined])
  expect(['120', '120 bpm', '96BPM', 'fast', '9'].map((v) => convert('field:bpm', v))).toEqual([120, 120, 96, undefined, undefined])
  expect(convert('field:tags', 'Ballad, cover|BALLAD')).toEqual(['ballad', 'cover'])
  expect(convert('custom:f1', 'two\nlines')).toBeUndefined()
  expect(columnProblems([['fast'], ['120'], ['slow']], 0, 'field:bpm')).toEqual({ count: 2, example: 'fast' })
})

it('rowValues: values, "add to notes" cells, problems, new custom fields by id', () => {
  const { values, noteLines, problems } = rowValues(['Title', 'BPM', 'Notes', 'Singer', 'Capo'], ['field:title', 'field:bpm', 'field:notes', 'notes', 'new-custom'], ['One', 'fast', 'slow intro', 'Anna', '2'], { 4: 'c1' })
  expect(values).toEqual({ title: 'One', notes: 'slow intro', custom: { c1: '2' } })
  expect(noteLines).toEqual([{ column: 'Singer', value: 'Anna' }])
  expect(problems).toEqual([{ column: 'BPM', value: 'fast' }])
  expect(duplicateTarget(['field:title', 'notes', 'notes', 'field:key', 'field:key'])).toBe('field:key')
  expect(duplicateTarget(['field:title', 'notes', 'notes', 'skip', 'skip'])).toBeUndefined()
})

it('withNoteLines: appends "Header: value" lines once; nothing when over the limit', () => {
  const singer = [{ column: 'Singer', value: 'Anna' }]
  expect(withNoteLines('capo 2', singer)).toEqual({ notes: 'capo 2\nSinger: Anna', dropped: [] })
  expect(withNoteLines('capo 2\nSinger: Anna', singer).notes).toBe('capo 2\nSinger: Anna')
  expect(withNoteLines(null, [])).toEqual({ notes: null, dropped: [] })
  expect(withNoteLines('x'.repeat(9_995), singer)).toEqual({ notes: 'x'.repeat(9_995), dropped: singer })
})

it('mergeSong: fill takes empty fields, overwrite every cell, notes lines appended in both; null when nothing changes', () => {
  const old = { title: 'One', durationSec: null, key: 'G', bpm: 90, tuning: null, tags: [], notes: 'capo 2', lyrics: null, custom: { c1: 'Anna' } }
  const row = rowValues(['Title', 'Key', 'BPM', 'Lead', 'Singer'], ['field:title', 'field:key', 'field:bpm', 'custom:c1', 'notes'], ['One', 'D', '90', 'Bob', 'Kim'])
  expect(mergeSong(old, row, 'fill').set).toEqual({ notes: 'capo 2\nSinger: Kim' })
  expect(mergeSong(old, row, 'overwrite').set).toEqual({ key: 'D', custom: { c1: 'Bob' }, notes: 'capo 2\nSinger: Kim' })
  const unchanged = rowValues(['Title', 'Key'], ['field:title', 'field:key'], ['One', 'G'])
  expect(mergeSong(old, unchanged, 'overwrite').set).toBeNull()
})

it('songsCsv → parseCsv → guessTargets round trip', () => {
  const custom = [{ id: 'f1', name: 'Lead' }]
  const song = { title: 'One; two', durationSec: 225, key: 'Am', bpm: 120, tuning: null, tags: ['ballad', 'cover'], notes: 'a\nb', lyrics: null, custom: { f1: 'Anna' } }
  const [header, row] = parseCsv(songsCsv([song], custom, en))
  const targets = guessTargets(header, custom)
  expect(targets).toEqual(['field:title', 'field:durationSec', 'field:key', 'field:bpm', 'field:tuning', 'field:tags', 'field:notes', 'field:lyrics', 'custom:f1'])
  expect(rowValues(header, targets, row).values).toEqual({ title: 'One; two', durationSec: 225, key: 'Am', bpm: 120, tags: ['ballad', 'cover'], notes: 'a\nb', custom: { f1: 'Anna' } })
})

it('toTable: a plain list of titles has no header row; a single column headed "Song" does', () => {
  expect(toTable(parseCsv('Hello, Goodbye\nCloser\n\nSlow One'), [], 'Title')).toEqual({ headers: ['Title'], rows: [['Hello, Goodbye'], ['Closer'], ['Slow One']] })
  expect(toTable(parseCsv('Song\nCloser'), [], 'Title')).toEqual({ headers: ['Song'], rows: [['Closer']] })
  expect(toTable(parseCsv('Title;Key\nCloser;G'), [], 'Title')).toEqual({ headers: ['Title', 'Key'], rows: [['Closer', 'G']] })
})
