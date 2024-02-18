// This version of the script runs in node.js and attempts to perform the functionality of all the other scripts.

const readline = require("node:readline");
const fs = require("node:fs/promises");
const { exit } = require("node:process");

async function main() {
  const fetch = (await import("node-fetch")).default;
  const pdflib = await import("pdf-lib");

  const canvasInfo = (
    await fs.readFile("canvas.txt").catch(() => {
      console.error(
        "To run this script, create a file called 'canvas.txt' in the same directory as this file."
      );
      console.error("The file should be three lines long.");
      console.error(
        "1. On the first line, put the domain name for your institution's canvas site, including the 'http://' or 'https://'"
      );
      console.error("2. On the second line, put your Canvas API key");
      console.error(
        "3. On the third line, put the course ID of the course from which you wish to scrape data. This should be a number."
      );
      console.error("Make sure that there is no extraneous whitespace.");
      exit();
    })
  ).toString();

  const [site, apikey, courseid] = canvasInfo.split(/\r\n|\n/g);

  const canvasfetch = (url, opts) => {
    return fetch((url.match(/^https?:\/\//g) ? "" : site) + url, {
      headers: {
        Authorization: `Bearer ${apikey}`,
        ...opts?.headers,
      },
      ...opts,
    });
  };

  async function findPDFsInCanvasModules(courseid) {
    const moduleItems = (
      await Promise.all(
        (
          await (
            await canvasfetch(
              `/api/v1/courses/${courseid}/modules?per_page=1000`
            )
          ).json()
        ).map((mod) =>
          canvasfetch(mod.items_url).then(async (items) => await items.json())
        )
      ).catch(() => [])
    ).flat();

    const pdfItems = moduleItems.filter(
      (item) => item.type === "File" && item.title.endsWith(".pdf")
    );

    const files = await Promise.all(
      pdfItems.map((item) =>
        canvasfetch(item.url).then(async (pdf) => pdf.json())
      )
    ).catch(() => []);

    return files.map((f) => f.url);
  }

  async function getSubfoldersInFolder(id) {
    return await canvasfetch(
      `/api/v1/folders/${id}/folders?per_page=1000`
    ).then((e) => e.json());
  }
  async function getFilesInFolder(id) {
    return await canvasfetch(`/api/v1/folders/${id}/files?per_page=1000`).then(
      (e) => e.json()
    );
  }

  function getPDFLinksFromFiles(files) {
    if (!Array.isArray(files)) return [];
    return files.filter((f) => f.mime_class === "pdf").map((f) => f.url);
  }

  async function recursivelyFindPDFsInCanvasFiles(folder) {
    const r = async (folder) => {
      const { id } = folder;
      const [subfolders, files] = await Promise.all([
        getSubfoldersInFolder(id),
        getFilesInFolder(id),
      ]).catch(() => [[], []]);

      if (!Array.isArray(subfolders)) return [];

      return [
        ...getPDFLinksFromFiles(files),
        ...(await Promise.all(subfolders.map(r))),
      ].flat(2);
    };

    return await r(folder);
  }

  async function loadPDFRawDataFromArrayOfLinks(links) {
    let numLoaded = 0;

    console.log(links);

    const data = await Promise.all(
      links.map(async (l) => ({
        file: await canvasfetch(l)
          .then((res) => res.arrayBuffer())
          .then(
            (e) => (console.log(`Loaded ${numLoaded++}/${links.length}`), e)
          ),
        name: l,
      }))
    );

    return data;
  }

  const folderList = await (
    await canvasfetch(`/api/v1/courses/${courseid}/folders?per_page=1000`)
  ).json();

  const rootFolder = folderList.find((e) => e.name === "course files");

  const linksNonunique = [
    ...getPDFLinksFromFiles(await recursivelyFindPDFsInCanvasFiles(rootFolder)),
    ...(await findPDFsInCanvasModules(courseid)),
  ];

  const links = [...new Set(linksNonunique)];

  const pdfRawData = await loadPDFRawDataFromArrayOfLinks(links);

  let numParsed = 0;

  const loadedIndividualPDFs = await Promise.all(
    pdfRawData.map(
      async (d) => (
        console.log(`Parsing ${numParsed++}/${pdfRawData.length}`),
        {
          pdf: await pdflib.PDFDocument.load(d.file),
          name: d.name,
        }
      )
    )
  );

  const joinedPDF = await pdflib.PDFDocument.create();

  let numJoined = 0;

  for (const { pdf, name } of loadedIndividualPDFs) {
    console.log(`Joining ${numJoined++}/${pdfRawData.length}`);
    const otherPages = await joinedPDF.copyPages(
      pdf,
      new Array(pdf.getPageCount()).fill(0).map((e, i) => i)
    );
    for (const page of otherPages) {
      joinedPDF.addPage(page);
    }
  }

  fs.writeFile("combined.pdf", await joinedPDF.save());
  console.log("Done!");
}

main();
