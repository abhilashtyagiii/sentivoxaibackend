import fs from "fs";
import path from "path";
// We'll dynamically import pdf-parse inside parsePDF to avoid ESM/CJS interop issues
import mammoth from "mammoth";

export interface ParsedDocument {
  text: string;
  metadata?: {
    pageCount?: number;
    fileSize?: number;
  };
}

export async function parseDocument(filePath: string): Promise<ParsedDocument> {
  const ext = path.extname(filePath).toLowerCase();
  
  if (ext === '.pdf') {
    return parsePDF(filePath);
  } else if (ext === '.docx' || ext === '.doc') {
    return parseWord(filePath);
  } else {
    throw new Error(`Unsupported file type: ${ext}. Only PDF and Word documents are supported.`);
  }
}

async function parsePDF(filePath: string): Promise<ParsedDocument> {
  try {
    const dataBuffer = fs.readFileSync(filePath);
    // Dynamically import pdf-parse to avoid build-time interop issues
    const pdfModule: any = await import('pdf-parse');

    // Case A: pdf-parse v2 exports a PDFParse class
    if (pdfModule && typeof pdfModule.PDFParse === 'function') {
      const PDFParseClass = pdfModule.PDFParse;
      const parser = new PDFParseClass({ data: dataBuffer });
      try {
        const textResult = await parser.getText();
        const info = await parser.getInfo();
        try { await parser.destroy(); } catch (e) { /* ignore */ }

        return {
          text: textResult?.text ?? String(textResult) ?? "",
          metadata: {
            pageCount: info?.total ?? info?.numPages ?? 0,
            fileSize: fs.statSync(filePath).size,
          }
        };
      } catch (err) {
        try { await parser.destroy(); } catch (e) { /* ignore */ }
        throw err;
      }
    }

    // Case B: older or alternate shapes where the module is callable/default/has parse
    let pdfParseFn: ((buf: Buffer) => Promise<any>) | undefined;
    if (typeof pdfModule === "function") {
      pdfParseFn = pdfModule;
    } else if (pdfModule && typeof pdfModule.default === "function") {
      pdfParseFn = pdfModule.default;
    } else if (pdfModule && typeof pdfModule.parse === "function") {
      pdfParseFn = pdfModule.parse;
    }

    if (!pdfParseFn) {
      console.error('pdf-parse module shape:', Object.keys(pdfModule || {}));
      throw new Error('pdf-parse is not callable in this environment');
    }

    const data: any = await pdfParseFn(dataBuffer as Buffer);

    return {
      text: data?.text || "",
      metadata: {
        pageCount: data?.numpages ?? data?.numPages ?? 0,
        fileSize: fs.statSync(filePath).size,
      }
    };
  } catch (error) {
    console.error("Error parsing PDF:", error);
    throw new Error("Failed to parse PDF document: " + (error instanceof Error ? error.message : 'Unknown error'));
  }
}

async function parseWord(filePath: string): Promise<ParsedDocument> {
  try {
    const result = await mammoth.extractRawText({ path: filePath });
    
    return {
      text: result.value,
      metadata: {
        fileSize: fs.statSync(filePath).size,
      }
    };
  } catch (error) {
    console.error("Error parsing Word document:", error);
    throw new Error("Failed to parse Word document: " + (error instanceof Error ? error.message : 'Unknown error'));
  }
}

export function validateResumeFile(file: Express.Multer.File): boolean {
  const allowedExts = ['.pdf', '.docx', '.doc'];
  const ext = path.extname(file.originalname).toLowerCase();
  const maxSize = 10 * 1024 * 1024;
  return allowedExts.includes(ext) && file.size <= maxSize;
}
