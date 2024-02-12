{
  // INSTRUCTIONS: Set this to the ID of the course you want to run the slide merger tool on.
  // Run the script on the same domain as the course you intend to run it on to prevent CORS issues.
  // Paste the script in the browser console and hit ENTER
  // The page will turn into a page consisting of every single page on the canvas course joined together.
  // Use your browser's print dialog to download it as a PDF
  const CANVAS_COURSE_ID = 1896894;

  function delay(callback, ms) {
    return new Promise((resolve, reject) => {
      setTimeout(async () => {
        resolve(await callback());
      }, ms);
    });
  }

  async function getJoinedCanvasPagesHTML(courseid) {
    const moduleItems = (
      await Promise.all(
        (
          await (
            await fetch(`/api/v1/courses/${courseid}/modules?per_page=1000`)
          ).json()
        ).map((mod) =>
          fetch(mod.items_url).then(async (items) => await items.json())
        )
      ).catch(() => [])
    ).flat();

    const pages = moduleItems.filter((item) => item.type === "Page");

    const htmlPages = await Promise.all(
      pages.map((item) =>
        delay(
          () => fetch(item.url).then(async (page) => page.json()),
          Math.random() * 5000
        )
      )
    ).catch(() => []);

    return htmlPages.map((f) => f.body).join("");
  }

  (async () => {
    const html = await getJoinedCanvasPagesHTML(CANVAS_COURSE_ID);

    document.body.innerHTML = html;
  })();
}
