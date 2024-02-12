{
  // Instructions:
  // Put links to pages to scrape in the PAGES_WITH_PDF_LINKS_IN_THEM array below.
  //    These should be links to web pages containing links to PDFs (NOT links to PDFs themselves)
  // To run the script, paste it into the browser console and hit ENTER.
  window.PAGES_WITH_PDF_LINKS_IN_THEM = [];

  async function getPDFLinks(url) {
    const txt = await fetch(url).then((r) => r.text());

    const pdfNames = [...txt.match(/href=".+?\.pdf"/g)].map(
      (e) => url + e.slice(6, -1)
    );

    return pdfNames;
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
    const pdfLinks = (
      await Promise.all(
        PAGES_WITH_PDF_LINKS_IN_THEM.map(
          async (link) => await getPDFLinks(link)
        )
      )
    ).flat(1);

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
    link.download = "combined-slides.pdf";
    link.innerHTML = "Click to download";
    link.click();
  })();
}
