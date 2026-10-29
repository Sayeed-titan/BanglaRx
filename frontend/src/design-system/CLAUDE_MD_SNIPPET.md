# Paste this into the project's CLAUDE.md (an agent cannot write that file)

## UI and design system (mandatory for every session)

The app has one design system: `frontend/src/design-system/`. Read its `README.md` before touching any screen.

- Build UI with the components exported from `frontend/src/design-system/index.ts`. Do not hand-style buttons, fields, badges, cards, dialogs.
- Colours, sizes, radii and fonts come only from `--rx-*` tokens in `tokens.css`. No hex or `rgba()` in screens. No new use of the old `--slate-*`, `--teal-*` palette names or the `btn-clinical` style classes.
- Text is never smaller than 13px, tap targets are never smaller than 44px, focus rings are never removed.
- Missing clinical values show `Not recorded`. AI-filled fields must stay editable. The prescription sheet (`.rx-paper`) stays light and keeps its A4 print styles.
- Before saying a UI change is done: run `npm run check:ds` in `frontend/`, and look at the screen in light and dark mode. `npm run build` runs the check automatically and fails if it breaks.
- To change the look of the whole app, edit `tokens.css` (and update the Foundations sheet on the design canvas, linked in the README). Do not patch colours in individual screens.
- Visual reference for planned screens: https://claude.ai/artifact/246uoQbyc5rEyYX7eZGjW2
