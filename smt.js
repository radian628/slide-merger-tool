{
  // INSTRUCTIONS: Set this to the ID of the course you want to run the slide merger tool on.
  // Run the script on the same domain as the course you intend to run it on.
  const CANVAS_COURSE_ID = 1942632;

  async function findPDFsInCanvasModules(courseid) {
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

    const pdfItems = moduleItems.filter(
      (item) => item.type === "File" && item.title.endsWith(".pdf")
    );

    const files = await Promise.all(
      pdfItems.map((item) => fetch(item.url).then(async (pdf) => pdf.json()))
    ).catch(() => []);

    return files.map((f) => f.url);
  }

  async function recursivelyFindPDFsInCanvasFiles(courseid) {
    const r = async (folder) => {
      try {
        const id = folder.id;
        const [subfolders, files] = await Promise.all(
          await Promise.all([
            fetch(`/api/v1/folders/${id}/folders?per_page=1000`),
            fetch(`/api/v1/folders/${id}/files?per_page=1000`),
          ]).then((arr) => arr.map((e) => e.json()))
        );

        console.log("subfolder and files", folder, subfolders, files);

        return (await Promise.all(subfolders.map((sf) => r(sf))))
          .concat(files.filter((f) => f.mime_class === "pdf"))
          .flat();
      } catch (err) {
        return [];
      }
    };

    const rootFolder = (
      await (
        await fetch(`/api/v1/courses/${courseid}/folders?per_page=1000`)
      ).json()
    ).find((e) => e.name === "course files");

    console.log(rootFolder);

    return await r(rootFolder);
  }

  async function findAllPDFLinksInCanvasCourse(courseid) {
    const rawLinkArray = (
      await recursivelyFindPDFsInCanvasFiles(CANVAS_COURSE_ID)
    ).map((file) => file.url);
    rawLinkArray.push(...(await findPDFsInCanvasModules(courseid)));

    return await Array.from(new Set(rawLinkArray));
  }

  (async () => {
    // load pdf library
    const script = document.createElement("script");
    script.setAttribute(
      "src",
      "https://unpkg.com/pdf-lib@1.17.1/dist/pdf-lib.min.js"
    );
    document.head.appendChild(script);

    // check for pdf library to load
    await new Promise((resolve, reject) => {
      const f = () => {
        if (window.PDFLib) {
          resolve();
          return;
        }
        setTimeout(f, 0);
      };
      f();
    });

    const pdflib = PDFLib;

    // scrape all pdf links
    const pdfLinks = await findAllPDFLinksInCanvasCourse(CANVAS_COURSE_ID);

    // fetch pdf data
    const pdfs = await Promise.all(
      pdfLinks.map(
        async (l) => (
          console.log(`Loading ${l}...`),
          {
            file: await fetch(l).then((res) => res.arrayBuffer()),
            name: l,
          }
        )
      )
    );

    // join em all together
    const joinedPDF = await pdflib.PDFDocument.create();
    for (const { file, name } of pdfs) {
      console.log(`Adding ${name}...`);
      const otherPDF = await pdflib.PDFDocument.load(file);
      const otherPages = await joinedPDF.copyPages(
        otherPDF,
        new Array(otherPDF.getPageCount()).fill(0).map((e, i) => i)
      );
      for (const page of otherPages) {
        joinedPDF.addPage(page);
      }
    }
    const joinedBytes = await joinedPDF.save();

    // download em all
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([joinedBytes]));
    link.download =
      (await (await fetch(`/api/v1/courses/${CANVAS_COURSE_ID}`)).json()).name +
      ".pdf";
    link.innerHTML = "Click to download";
    link.click();
  })();
}
