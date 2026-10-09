import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  creditFor,
  decodeGoogleUrl,
  googleImagesUrl,
  isUsablePictureUrl,
  mergeHits,
  normalizeHits,
  type ImageHit,
} from "./picture-hits.ts";

describe("picture-hits", () => {
  it("builds a safe-search Google Images URL from the query", () => {
    const url = googleImagesUrl("  red apple ");
    const parsed = new URL(url);
    assert.equal(parsed.hostname, "www.google.com");
    assert.equal(parsed.searchParams.get("q"), "red apple");
    assert.equal(parsed.searchParams.get("tbm"), "isch");
    assert.equal(parsed.searchParams.get("udm"), "2");
    assert.equal(parsed.searchParams.get("safe"), "active");
    assert.equal(parsed.searchParams.get("tbs"), "isz:m,itp:photo");
  });

  it("keeps gstatic thumbs and https originals, drops logos and data URIs", () => {
    assert.equal(
      isUsablePictureUrl("https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTest"),
      true,
    );
    assert.equal(isUsablePictureUrl("https://images.unsplash.com/photo-1"), true);
    assert.equal(isUsablePictureUrl("https://cdn.example.com/cat.jpg"), true);
    assert.equal(isUsablePictureUrl("http://insecure.example/cat.jpg"), false);
    assert.equal(isUsablePictureUrl("https://www.google.com/images/branding/googlelogo.png"), false);
    assert.equal(isUsablePictureUrl("data:image/png;base64,abc"), false);
  });

  it("decodes Google JSON escapes in image URLs", () => {
    assert.equal(
      decodeGoogleUrl("https://example.com/a\\u003d1\\u0026b=2"),
      "https://example.com/a=1&b=2",
    );
  });

  it("normalizes, dedups, skips tiny tiles, and caps the batch", () => {
    const tbn = "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcCat";
    const original = "https://images.example.com/cat.jpg";
    const hits = normalizeHits(
      [
        { url: original, thumb: tbn, title: "Cat", width: 400 },
        { url: original, thumb: tbn, title: "Cat again" },
        { url: "https://encrypted-tbn0.gstatic.com/images?q=tbn:tiny", width: 16 },
        { url: "https://www.google.com/images/branding/googlelogo.png" },
        { url: "https://cdn.example.com/dog.png", title: "Dog" },
      ],
      new Set(),
      24,
    );
    assert.equal(hits.length, 2);
    assert.equal(hits[0]?.url, original);
    assert.equal(hits[0]?.thumbnail, tbn);
    assert.equal(hits[1]?.url, "https://cdn.example.com/dog.png");
  });

  it("merges load-more hits without repeating ids", () => {
    const first: ImageHit[] = [
      {
        id: "https://cdn.example.com/a.jpg",
        url: "https://cdn.example.com/a.jpg",
        thumbnail: "https://cdn.example.com/a.jpg",
        title: "A",
      },
    ];
    const extra: ImageHit[] = [
      first[0]!,
      {
        id: "https://cdn.example.com/b.jpg",
        url: "https://cdn.example.com/b.jpg",
        thumbnail: "https://cdn.example.com/b.jpg",
        title: "B",
      },
    ];
    const merged = mergeHits(first, extra);
    assert.equal(merged.length, 2);
    assert.equal(merged[1]?.title, "B");
  });

  it("stores a host-based credit with the original URL", () => {
    const credit = creditFor(
      {
        id: "https://images.unsplash.com/photo-1",
        url: "https://images.unsplash.com/photo-1",
        thumbnail: "https://encrypted-tbn0.gstatic.com/images?q=tbn:x",
        title: "Apple",
      },
      "apple",
    );
    assert.equal(credit.title, "apple");
    assert.equal(credit.creator, "images.unsplash.com");
    assert.equal(credit.sourceUrl, "https://images.unsplash.com/photo-1");
  });
});
