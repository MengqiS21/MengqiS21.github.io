# Homepage Structure

- `index.html` : homepage
- `css/main.css` : shared styles for homepage and research detail pages
- `research/` : secondary pages for research interests
- `assets/` : static assets (images, icons, future media)

## Quick edit guide
1. Update bio/news/sections in `index.html`.
2. Update each research details page in `research/`.
3. Tweak colors/motion in `css/main.css`.

## Visitor window setup
1. Create a GoatCounter site for the homepage domain.
2. Update `js/site-config.js` with your real GoatCounter base URL, for example `https://mengqishi.goatcounter.com`.
3. In the GitHub repository settings, add these Actions secrets:
   `GOATCOUNTER_BASE_URL`
   `GOATCOUNTER_API_KEY`
4. Run the `Update Visitor Window` workflow once manually to generate the first real `assets/data/visitor-window.json` snapshot.
5. After the first sync, the homepage widget will start showing real total views, country counts, and highlighted regions.
