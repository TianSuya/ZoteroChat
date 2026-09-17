import { describe, expect, it } from "vitest";

import { renderMarkdown } from "./render";

describe("renderMarkdown", () => {
  it("renders emphasis and lists", () => {
    const html = renderMarkdown("**bold** and a list:\n\n- one\n- two");
    expect(html).toContain("<strong>");
    expect(html).toContain("<li>");
    expect(html).not.toContain("**bold**");
  });

  it("does not interpret raw HTML", () => {
    const html = renderMarkdown("<script>alert(1)</script>");
    expect(html).not.toContain("<script>");
  });

  it("renders inline $math$ as MathML", () => {
    const html = renderMarkdown("The score is $x_i$.");
    expect(html).toContain("<math");
    expect(html).toContain("x");
  });

  it("renders block $$math$$ as MathML", () => {
    const html = renderMarkdown("$$\n\\frac{1}{2}\n$$");
    expect(html).toContain("<math");
    expect(html).toContain('display="block"');
  });

  it("renders \\( \\) and \\[ \\]", () => {
    expect(renderMarkdown("See \\(a+b\\).")).toContain("<math");
    expect(renderMarkdown("\\[\nE=mc^2\n\\]")).toContain("<math");
  });

  it("leaves currency-like $ alone", () => {
    const html = renderMarkdown("It costs 20$ now.");
    expect(html).not.toContain("<math");
    expect(html).toContain("20$");
  });

  it("does not parse $ inside fences", () => {
    const html = renderMarkdown("```\n$x$\n```");
    expect(html).toContain("<code");
    expect(html).not.toContain("<math");
  });

  it("strips TeX annotations that would break XHTML innerHTML", () => {
    const html = renderMarkdown("$$x < y$$\n\n$$a & b$$");
    expect(html).toContain("<math");
    expect(html).not.toContain("<annotation");
    expect(html).not.toMatch(/x < y/);
  });
});
