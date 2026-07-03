# Included Quality Checks

The package was checked for:

- strict TypeScript compilation of every component against React type definitions;
- valid JavaScript syntax for the interactive static preview;
- valid relative file paths and resolvable CSS/TypeScript imports;
- unique HTML IDs and complete `aria-labelledby` / `aria-controls` references;
- balanced CSS blocks;
- no external image, font, icon, or runtime dependency;
- scoped compatibility selectors (`.r6-theme ...`);
- semantic buttons, tabs, progress bars, live regions, and dialog roles;
- reduced-motion and transparency fallbacks;
- responsive breakpoints at 980px, 720px, and 520px;
- ZIP integrity.

Recommended repository-side checks after copying:

```bash
cd frontend
npm run build
npm run lint
npm run test
```

The static preview is intentionally independent of the React build so the visual study can be reviewed immediately.
