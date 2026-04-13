import { NextRequest, NextResponse } from "next/server";
import { authErrorResponse, requireApproved } from "@/lib/auth";

export const runtime = "nodejs";

type NaverItem = {
  title: string;
  author: string;
  publisher: string;
  isbn: string;
  image: string;
  link: string;
};

function stripTags(s: string) {
  return s.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").trim();
}

export async function GET(req: NextRequest) {
  try {
    await requireApproved();
    const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
    if (q.length < 2) {
      return NextResponse.json({ items: [] });
    }

    const id = process.env.NAVER_CLIENT_ID;
    const secret = process.env.NAVER_CLIENT_SECRET;
    if (!id || !secret) {
      return NextResponse.json(
        { error: "Naver credentials not set" },
        { status: 500 },
      );
    }

    const url = new URL("https://openapi.naver.com/v1/search/book.json");
    url.searchParams.set("query", q);
    url.searchParams.set("display", "10");

    const res = await fetch(url.toString(), {
      headers: {
        "X-Naver-Client-Id": id,
        "X-Naver-Client-Secret": secret,
      },
      cache: "no-store",
    });
    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json(
        { error: `Naver API error: ${res.status} ${text.slice(0, 120)}` },
        { status: 502 },
      );
    }
    const data = (await res.json()) as { items?: NaverItem[] };
    const items = (data.items ?? []).map((it) => ({
      title: stripTags(it.title),
      author: stripTags(it.author).replace(/\^/g, ", "),
      publisher: stripTags(it.publisher),
      isbn: it.isbn.split(" ").pop() ?? it.isbn,
      cover: it.image,
      link: it.link,
    }));

    return NextResponse.json({ items });
  } catch (err) {
    return authErrorResponse(err);
  }
}
