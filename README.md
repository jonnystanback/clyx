# clyx

Static one-page presentation site — full-viewport landing splash with an
animated logo, then a scrolling series of slide images. No build step; open
`index.html` or serve the folder.

    python3 -m http.server 8000

## Structure

| Path | What it is |
|---|---|
| `index.html` | Page. Slides are `<figure class="slide">` blocks inside `<section class="slides">`. |
| `styles.css` | All styling. Hero background at `.landing__bg`, footer gradient at `.site-footer`. |
| `script.js` | Password gate, hero logo draw-in animation, contents panel, slide reveal. |
| `assets/title.svg` | Hero logo. Fetched by `script.js` and animated as a stroke draw-in. |
| `assets/title.png` | Hero background image. |
| `assets/slides/` | Slide images and videos. |

## Still to replace

Everything below is a placeholder carried over from the previous project and
must be swapped before this goes anywhere public:

- [ ] `assets/title.svg` — hero logo. After swapping, update `.hero-logo { aspect-ratio }` in `styles.css` to match the new viewBox.
- [ ] `assets/title.png` — hero background.
- [ ] `assets/favicon.jpg` — browser tab icon.
- [ ] `assets/share.jpg` — social preview card (1200x675 is the standard size).
- [ ] `assets/footerlogo.png` — footer wordmark.
- [ ] `PASS_HASH` in `script.js` — currently the previous project's password. Regenerate with:
      `echo -n 'yourpassword' | shasum -a 256`
- [ ] "tagline goes here." in the `index.html` meta description.
- [ ] Footer gradient colours at `.site-footer` in `styles.css`.

## Adding slides

Drop images in `assets/slides/`, then add one `<figure>` per slide in
`index.html`. The contents panel generates itself from each slide's `id` and
`.slide__title`, so there is no separate menu to maintain. `width`/`height`
must match the real pixel dimensions or the page will jump while loading.

Export slides around 2400px wide; recompress at JPEG quality ~82 to keep the
page light.

Video slides use the same class:

```html
<video class="slide__img" src="assets/slides/clip.mp4"
       width="1920" height="1080"
       autoplay muted loop playsinline preload="metadata"></video>
```

## Cache busting

`index.html` links `styles.css?v=N` and `script.js?v=N`. Bump `N` whenever
either file changes so browsers and CDNs fetch the new version.
