import { describe, expect, it } from "vitest";

import { isSafeHttpUrl, resolvePdfUrl } from "./library";

describe("isSafeHttpUrl", () => {
  it("accepts public http(s) URLs", () => {
    expect(isSafeHttpUrl("https://arxiv.org/abs/1706.03762")).toBe(true);
    expect(isSafeHttpUrl("http://example.com/paper.pdf")).toBe(true);
  });

  it("rejects credentials, non-http schemes, and private hosts", () => {
    expect(isSafeHttpUrl("file:///etc/passwd")).toBe(false);
    expect(isSafeHttpUrl("data:text/plain,hello")).toBe(false);
    expect(isSafeHttpUrl("https://user:pass@example.com/x")).toBe(false);
    expect(isSafeHttpUrl("http://localhost:3000/x")).toBe(false);
    expect(isSafeHttpUrl("http://127.0.0.1/x")).toBe(false);
    expect(isSafeHttpUrl("http://192.168.1.2/x")).toBe(false);
    expect(isSafeHttpUrl("http://172.16.0.1/x")).toBe(false);
    expect(isSafeHttpUrl("http://169.254.169.254/latest")).toBe(false);
    expect(isSafeHttpUrl("http://printer.local/x")).toBe(false);
    expect(isSafeHttpUrl("http://[::1]/x")).toBe(false);
  });
});

describe("resolvePdfUrl", () => {
  it("maps arXiv abstract pages to PDFs", () => {
    expect(resolvePdfUrl("https://arxiv.org/abs/1706.03762v7")).toBe(
      "https://arxiv.org/pdf/1706.03762v7",
    );
  });

  it("maps OpenReview forum pages to PDFs", () => {
    expect(resolvePdfUrl("https://openreview.net/forum?id=abc123")).toBe(
      "https://openreview.net/pdf?id=abc123",
    );
  });

  it("leaves direct PDFs alone", () => {
    expect(resolvePdfUrl("https://example.com/a.pdf")).toBe(
      "https://example.com/a.pdf",
    );
  });
});
