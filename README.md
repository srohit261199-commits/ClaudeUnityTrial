# Rohit Sharma 3D

Portfolio of Rohit Sharma, 3D visualization artist in Dubai. A static site: a Three.js wall of screens on the home page, where each screen opens a project, plus project pages, a motion reel, RohitOS and an about page.

## Pages

| File | Page |
| --- | --- |
| `index.html` | Home: the wall of screens and the project index |
| `work-*.html` | Seven project pages (Trapani, MoonShot, Casa Copenhagen, Skeidar, Events, Middle East, Props) |
| `motion.html` | Motion reels |
| `os.html` | RohitOS, a desktop with projects, resume, reels and contact |
| `about.html` | About and resume |

Shared code and media live in `assets/`: `site.css`, `site.js` (page behaviour), `scene.js` (the 3D wall), `data.js` (project and image data), `os.js` (RohitOS), `img/` (renders) and `reel/` (videos and posters).

GSAP, Lenis and Three.js load from jsDelivr, and the fonts load from Google Fonts, so there is no build step.

## Run locally

The 3D wall uses ES modules, which browsers will not load from `file://`. Serve the folder instead:

```sh
python3 -m http.server 8000
```

Then open http://localhost:8000.

## Deploy

`.github/workflows/pages.yml` publishes the repository root to GitHub Pages on every push to the default branch. To turn it on once, go to **Settings → Pages → Build and deployment → Source** and choose **GitHub Actions**.
