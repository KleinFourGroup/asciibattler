import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { isProseSchema, prose, prosePatterns, proseSites } from './prose';

/** The events grammar in miniature: an id-keyed array → a record → an id-keyed array. */
const Choice = z.object({
  id: z.string().min(1).optional(),
  label: prose(),
  outcomes: z.array(z.object({ next: z.union([z.string(), z.object({ kind: z.literal('return-to-map') })]) })),
});
const Page = z.object({ text: prose(), art: z.string().optional(), choices: z.array(Choice).min(1) });
const Event = z
  .object({
    id: z.string().min(1),
    name: prose(),
    description: prose().optional(),
    entry: z.string(),
    pages: z.record(z.string().min(1), Page),
  })
  .superRefine(() => undefined);
const Events = z.array(Event);

describe('prose() marker', () => {
  it('marks the schema, survives .optional() unwrapping, and stays a non-empty string', () => {
    expect(isProseSchema(prose())).toBe(true);
    expect(isProseSchema(z.string())).toBe(false);
    expect(() => prose().parse('')).toThrow();
    expect(prose().parse('x')).toBe('x');
  });
});

describe('prosePatterns', () => {
  it('derives the field paths from the schema — the declaration is the manifest', () => {
    expect(prosePatterns(Events).map((p) => p.join('.'))).toEqual([
      '[].name',
      '[].description',
      '[].pages.*.text',
      '[].pages.*.choices.[].label',
    ]);
  });

  it('walks a discriminated union, a pipe/transform and a lazy', () => {
    const Terminal = z.discriminatedUnion('kind', [
      z.object({ kind: z.literal('a'), title: prose() }),
      z.object({ kind: z.literal('b') }),
    ]);
    const Lazy: z.ZodType = z.lazy(() => z.object({ leaf: prose() }));
    const S = z.object({ t: Terminal, p: prose().transform((s) => s.trim()), l: Lazy });
    expect(prosePatterns(S).map((p) => p.join('.'))).toEqual(['t.title', 'p', 'l.leaf']);
  });

  it('terminates on a recursive grammar (the event condition `not` combinator shape) and keeps sibling re-use', () => {
    type Cond = { kind: 'flag'; why?: string | undefined } | { kind: 'not'; condition: Cond };
    const Cond: z.ZodType<Cond> = z.lazy(() =>
      z.union([
        z.object({ kind: z.literal('flag'), why: prose().optional() }),
        z.object({ kind: z.literal('not'), condition: Cond }),
      ]),
    );
    const S = z.object({ eligibility: z.array(Cond), choice: z.object({ condition: Cond.optional() }) });
    expect(prosePatterns(S).map((p) => p.join('.'))).toEqual(['eligibility.[].why', 'choice.condition.why']);
  });

  it('treats z.custom as an opaque leaf, walks tuples and intersections', () => {
    const S = z.object({
      archetype: z.custom<string>((v) => typeof v === 'string'),
      pair: z.tuple([z.string(), prose()]),
      both: z.intersection(z.object({ a: prose() }), z.object({ b: z.number() })),
    });
    expect(prosePatterns(S).map((p) => p.join('.'))).toEqual(['pair.1', 'both.a']);
  });

  it('throws on a zod shape it does not know rather than skipping it', () => {
    const S = z.object({ m: z.map(z.string(), prose()) });
    expect(() => prosePatterns(S)).toThrow(/unknown zod def type 'map' at 'm'/);
  });
});

describe('proseSites', () => {
  const data = Events.parse([
    {
      id: 'shrine',
      name: 'The Shrine',
      entry: 'start',
      pages: {
        start: {
          text: 'A shrine.',
          choices: [
            { id: 'scoop', label: 'Scoop the bowl', outcomes: [{ next: 'guardians' }] },
            { label: 'Leave', outcomes: [{ next: { kind: 'return-to-map' } }] },
          ],
        },
        guardians: { text: 'Guardians!', choices: [{ id: 'run', label: 'Run', outcomes: [{ next: { kind: 'return-to-map' } }] }] },
      },
    },
  ]);

  it('addresses every site by family · id · path, keying arrays by id and falling back to the index', () => {
    const sites = proseSites('events', Events, data);
    expect(sites.map((s) => [s.address, s.value])).toEqual([
      ['events.shrine.name', 'The Shrine'],
      ['events.shrine.pages.start.text', 'A shrine.'],
      ['events.shrine.pages.guardians.text', 'Guardians!'],
      ['events.shrine.pages.start.choices.scoop.label', 'Scoop the bowl'],
      ['events.shrine.pages.start.choices.1.label', 'Leave'],
      ['events.shrine.pages.guardians.choices.run.label', 'Run'],
    ]);
  });

  it('skips an absent optional prose field (no `description` authored)', () => {
    expect(proseSites('events', Events, data).some((s) => s.address.endsWith('.description'))).toBe(false);
  });

  it('set() writes through to the parsed catalog', () => {
    const copy = Events.parse(data);
    const site = proseSites('events', Events, copy).find((s) => s.address === 'events.shrine.pages.start.text')!;
    site.set('Ein Schrein.');
    expect(copy[0]!.pages.start!.text).toBe('Ein Schrein.');
  });

  it('throws on an address collision (two elements sharing an id in one array)', () => {
    const dup = Events.parse(data);
    (dup[0]!.pages.start!.choices as { id?: string }[])[1]!.id = 'scoop';
    expect(() => proseSites('events', Events, dup)).toThrow(/collision 'events.shrine.pages.start.choices.scoop.label'/);
  });

  it('throws on an id containing the address separator', () => {
    const bad = Events.parse(data);
    (bad[0] as { id: string }).id = 'a.b';
    expect(() => proseSites('events', Events, bad)).toThrow(/segment 'a.b'/);
  });

  it('throws when a prose site holds a non-string', () => {
    const bad = Events.parse(data) as unknown as { name: unknown }[];
    bad[0]!.name = 7;
    expect(() => proseSites('events', Events, bad)).toThrow(/holds a number/);
  });
});
