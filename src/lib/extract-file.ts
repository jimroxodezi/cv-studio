import "server-only";
import mammoth from "mammoth";
import { extractText } from "unpdf";

const MAX_BYTES = 8 * 1024 * 1024;

export async function extractTextFromUpload(file: File): Promise<string> {
  if (file.size > MAX_BYTES) throw new Error("That file is larger than 8 MB.");
  const buffer = Buffer.from(await file.arrayBuffer());
  const name = file.name.toLowerCase();

  if (name.endsWith(".pdf") || file.type === "application/pdf") {
    const { text } = await extractText(new Uint8Array(buffer), { mergePages: true });
    return String(text).trim();
  }

  if (name.endsWith(".docx") || file.type.includes("wordprocessingml")) {
    const result = await mammoth.extractRawText({ buffer });
    return result.value.trim();
  }

  if (
    name.endsWith(".txt") ||
    name.endsWith(".md") ||
    name.endsWith(".markdown") ||
    file.type.startsWith("text/")
  ) {
    return buffer.toString("utf8").trim();
  }

  throw new Error("Upload a PDF, DOCX, Markdown, or text file. You can also paste the dump.");
}
