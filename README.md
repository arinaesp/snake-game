# Snake Game

A classic Snake build with a few deliberate twists: speed ramps up with every apple, and the snake's color shifts through three hue tiers as it grows — calm blue-grey, into soft purple, into warm mauve — each darkening before handing off to the next.

**[Play it live](#)** — [replace with your GitHub Pages link after deploying](https://arinaesp.github.io/snake-game/)

## Features

- **Progressive speed** — the game tick shortens by a fixed amount each time the snake eats, capped at a minimum so it stays playable.
- **Tiered color shift** — the snake's color darkens within a hue family every few apples, then jumps to a brighter color in the next hue family and repeats. Built with HSL interpolation rather than fixed hex steps, so the transitions are smooth.
- **Classic wall rules** — hitting the edge ends the game (no wrap-around), matching the original Snake rather than later remakes.
- **Play / Restart flow** — a Play button starts the game from a static first frame, and a Restart button (plus the Space key) brings it back after a game over.

## Tech

- Vanilla HTML5 Canvas, CSS, and JavaScript — no frameworks, no build step.
- Web Audio API for a couple of small synthesized sound effects (eat / game over).

## Run locally

No build step needed — just open `index.html` in a browser, or serve the folder with any static server:

```bash
npx serve .
```

## Project structure

```
snake-game/
├── index.html
├── style.css
├── script.js
└── README.md
```

## Notes

- Controls are keyboard-only (arrow keys) for now — works on desktop, not yet adapted for mobile/touch movement.
- Color tiers, speed increment, and timing constants are all defined near the top of `script.js` if you want to tune the feel.

## Credit

Built independently, with Claude Code assisting on implementation details (color logic, canvas rendering, UI polish) based on my direction and iteration.
