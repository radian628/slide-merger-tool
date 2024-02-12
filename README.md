# Slide Merger Tool

Merge your class's slides together into one big mega-PDF for easy studying and searching.

## How to Use

These scripts follow the same general pattern:

1. Set the variable(s) at the top to ensure you're scraping the right pages for PDF links.
2. Go to the domain of the site from which you're scraping PDF links from (gotta avoid cross-origin/CORS errors).
3. Paste the script into the browser console, and hit ENTER.
4. Wait for your merged PDF to generate.

## Which script do I use?

- If you're trying to merge PDFs from a page where PDF links are directly embedded into it, use `smt-raw.js`.
- If you're trying to merge PDFs from files hosted on Canvas, use `smt-canvas.js`.
- If you're trying to merge _web pages_ hosted on Canvas, use `smt-canvas-pages.js`.
