-- Store a bounded plaintext index for searchable PDF and DOCX document content.
ALTER TABLE "files" ADD COLUMN "extractedText" TEXT;
