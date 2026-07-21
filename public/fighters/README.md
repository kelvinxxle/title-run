# Fighter photos — drop-in guide

Each real roster fighter renders from a photo at `public/fighters/{id}.jpg`,
where `{id}` is the fighter's roster id (see `src/domain/combat/roster.ts`).
No code change is needed to swap or add a photo — the app resolves the file by
id at runtime.

## Conventions

- **Filename:** `{roster-id}.jpg` (e.g. `conor-mcgregor.jpg`). Must be a real
  JPEG (not a PNG renamed to `.jpg`).
- **Orientation / size:** portrait framing works best. Aim for ~1000px on the
  long edge. **Hard cap: 600 KB** — enforced by `src/assets/fighter-images.test.ts`.
  A quick optimize on macOS:
  ```sh
  sips -Z 1000 -s formatOptions 82 in.jpg --out public/fighters/{id}.jpg
  # if the source is a PNG, convert first:
  sips -s format jpeg -s formatOptions 80 in.png --out public/fighters/{id}.jpg
  ```
- **Fallback:** if a photo is missing or fails to load, the fighter renders the
  procedural `FighterAvatar` bust automatically. Fictional fighters
  (`journeyman-doe`, `rudy-kane`) and the player's custom fighter always use the
  fallback.

## Hero framing

The draft reveal shows a dramatic full-bleed hero crop (tall box, `object-cover`).
The default framing is `50% 20%` (centered, biased toward the upper face), which
flatters most portrait leads. To nudge a specific fighter, add one line to
`HERO_FRAMING` in `src/components/heroFraming.ts`:

```ts
export const HERO_FRAMING: Record<string, string> = {
  'ronaldo-souza': '50% 12%', // landscape source — pull crop up to the face
};
```

Values are standard CSS `object-position` (`horizontal% vertical%`).

## Credits

`CREDITS.md` lists the source (Wikimedia Commons, freely licensed) for every
shipped photo. Keep it in sync when you change a source image.
