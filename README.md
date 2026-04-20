# Pierdolę to...

A small no-build D3.js microsite about the Polish vulgar verb family around `pierdolić`.

The tree focuses on derivational relationships inside this one family, while the side panel carries denser lexical information: aspect, reflexivity, register, multiple glosses, example sentences, notes, and basic conjugation metadata.

## Run locally

This project uses `fetch()` to load JSON, so run it from a local server instead of opening `index.html` directly.

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000`.

Notes:

- No build step is required.
- D3 is loaded from a CDN at runtime.

## Project structure

- `index.html` - page layout and app shell
- `styles.css` - responsive layout and visual styling
- `main.js` - data normalization, tree rendering, tooltip, and details panel logic
- `data/verb-data.json` - the lexical dataset for the `pierdolić` family

## Data model

The input JSON is a tree rooted in `pierdolić`. Each node describes a derived lexical form inside that family.

```json
{
  "id": "example-id",
  "lemma": "example lemma",
  "root": "root morpheme",
  "prefix": "do-",
  "aspect": "perfective",
  "reflexive": false,
  "register": "vulgar",
  "glosses": ["meaning 1", "meaning 2"],
  "examples": [
    {
      "polish": "Polish example",
      "literalEnglish": "Literal gloss",
      "naturalEnglish": "Natural translation"
    }
  ],
  "notes": "Freeform usage note",
  "conjugation": {
    "nonPast1sg": "form",
    "nonPast3sg": "form"
  },
  "partnerId": "aspectual-or-related-form-id",
  "derivation": "prefixation + perfectivization",
  "children": []
}
```

## Extending this dataset

To add more forms from the `pierdolić` family:

1. Start from `data/verb-data.json`.
2. Keep one lexical node per lemma or lexicalized reflexive form.
3. Use `children` to represent derivational relationships, not just prefix lists.
4. Add multiple glosses when one form has context-dependent readings.
5. Add example sentences wherever you want richer details in the side panel.
6. Add `conjugation`, `partnerId`, or `derivation` only when useful; the renderer treats them as optional.

Recommended practices:

- Keep `id` values stable and unique.
- Prefer short, readable glosses in `glosses`; the tooltip uses the first one as a short summary.
- Use `notes` for pragmatics, usage restrictions, or idiomatic caveats.
- If you add a new register label or aspect value, update the visual encoding maps in `main.js`.

## Contributing examples

Examples are plain objects inside each node's `examples` array. Keep all three fields when possible:

- `polish`
- `literalEnglish`
- `naturalEnglish`

This gives the UI enough material to show the original phrasing, a close gloss, and a fluent translation side by side.

## Interaction model

- Click a node to select it and populate the details panel.
- Clicking a branch node also collapses or expands its children.
- Hover a node to see a short tooltip with the lemma and primary gloss.
- Use the buttons above the tree to expand everything or collapse back to the top derivational layer.
