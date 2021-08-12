import { PDFDocument } from "pdf-lib";

async function read(file: File): Promise<Uint8Array> {
  let r = new FileReader();
  r.readAsArrayBuffer(file);
  return new Promise((res, rej) => {
    r.addEventListener("load", (e) => {
      res(e.target.result as Uint8Array);
    });
    r.addEventListener("error", (e) => {
      rej(e);
    });
  });
}
async function mergePDF(
  base: PDFDocument,
  pdf: PDFDocument
): Promise<PDFDocument> {
  return base.copyPages(pdf, pdf.getPageIndices()).then((pages) => {
    pages.forEach((page) => {
      base.addPage(page);
    });
    return base;
  });
}
export enum Status {
  read,
  parsed,
  merged,
}
export function statusToString(status: Status) {
  switch (status) {
    case Status.read:
      return "读取";
    case Status.parsed:
      return "解析";
    case Status.merged:
      return "插入";
  }
}
type callback = (status: Status, index: number) => void;
type failCB = (status: Status, index: number, e: any) => void;

export async function merge(files: File[], cb: callback, fcb: failCB) {
  let p = files.map(async (file, i) => {
    let bytes: Uint8Array;
    try {
      bytes = await read(file);
    } catch (err) {
      fcb(Status.read, i, err);
      return Promise.reject();
    }
    cb(Status.read, i);
    let pdf: PDFDocument;
    try {
      pdf = await PDFDocument.load(bytes);
    } catch (err) {
      fcb(Status.parsed, i, err);
      return Promise.reject();
    }
    cb(Status.parsed, i);
    return pdf;
  });
  let base: PDFDocument;
  let pdfs: PDFDocument[];
  try {
    [base, ...pdfs] = await Promise.all([PDFDocument.create(), ...p]);
  } catch (err) {
    return Promise.reject();
  }
  return pdfs.reduce(async (prev, pdf, index) => {
    let result = await prev;
    cb(Status.merged, index);
    return mergePDF(result, pdf);
  }, Promise.resolve(base));
}
export async function mergeAndSave(files: File[], cb: callback, fcb: failCB) {
  let pdf = await merge(files, cb, fcb);
  if (!pdf) {
    return Promise.reject();
  }
  let bytes = await pdf.save();
  save(bytes);
}
export async function mergeAndOpen(files: File[], cb: callback, fcb: failCB) {
  let pdf = await merge(files, cb, fcb);
  if (!pdf) {
    return Promise.reject();
  }
  let bytes = await pdf.save();
  open(bytes);
}
export function toBlob(bytes: Uint8Array) {
  return new Blob([bytes], { type: "application/pdf" });
}
function open(bytes: Uint8Array) {
  let blob = toBlob(bytes);
  let url = window.URL.createObjectURL(blob);
  window.open(url);
  window.URL.revokeObjectURL(url);
}
function save(bytes: Uint8Array) {
  let blob = toBlob(bytes);
  const a = document.createElement("a");
  let url = window.URL.createObjectURL(blob);
  a.href = url;
  a.download = "merged.pdf";
  a.click();
  window.URL.revokeObjectURL(url);
}
