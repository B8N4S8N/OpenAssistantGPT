
import { getServerSession } from "next-auth/next"
import { date, z } from "zod"

import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"

import * as cheerio from 'cheerio';
import URL from 'url';

import { put } from '@vercel/blob';
import OpenAI from "openai";

const routeContextSchema = z.object({
    params: z.object({
        crawlerId: z.string(),
    }),
})

export const maxDuration = 180;


async function verifyCurrentUserHasAccessToCrawler(crawlerId: string) {
    const session = await getServerSession(authOptions)

    const count = await db.crawler.count({
        where: {
            userId: session?.user?.id,
            id: crawlerId,
        },
    })

    return count > 0
}


async function crawl(url: string, selector: string, maxPagesToCrawl: number, urlMatch: string) {

    async function fetchHtml(url: string) {
        try {
            const response = await fetch(url);
            return await response.text();
        } catch (error) {
            console.error('Failed to fetch URL:', url, error);
            return null;
        }
    }

    async function crawl(url: string, selector: string, urlMatch: string, visited = new Set(), pageCount = 0) {
        if (visited.has(url) || !url.includes(urlMatch) || pageCount >= maxPagesToCrawl) return [];

        console.log('Crawling URL:', url);

        visited.add(url);
        pageCount++;


        const html = await fetchHtml(url);
        if (!html) return [];

        const $ = cheerio.load(html);

        // Extracting links from the full HTML body
        const links = $('a').map((i, el) => $(el).attr('href')).get();
        const validLinks = links.map(link => {
            if (link && link.startsWith('/')) {
                // Construct absolute URL from relative URL
                const baseUrl = new URL.URL(url).origin;
                return baseUrl + link;
            }
            return link;
        }).filter(link => link && link.startsWith('http'));

        // Now apply the selector for specific content
        const title = $('title').text();
        //const selectedHtml = $(selector).text() || '';
        const selectedHtml = $(selector).html() || '';

        const result = [{ title, url, html: selectedHtml }];

        // Recursively crawl the extracted links
        for (const link of validLinks) {
            if (pageCount < maxPagesToCrawl) {
                const newResults = await crawl(link, selector, urlMatch, visited, pageCount);
                result.push(...newResults);
                pageCount += newResults.length; // Update pageCount based on new pages crawled
            }
        }

        return result;
    }

    return await crawl(url, selector, urlMatch);
}

export async function GET(
    req: Request,
    context: z.infer<typeof routeContextSchema>
) {
    try {
        const session = await getServerSession(authOptions)
        // Validate the route params.
        const { params } = routeContextSchema.parse(context)

        if (!(await verifyCurrentUserHasAccessToCrawler(params.crawlerId))) {
            return new Response(null, { status: 403 })
        }

        // Delete the crawler.
        const crawler = await db.crawler.findFirst({
            select: {
                id: true,
                maxPagesToCrawl: true,
                urlMatch: true,
                crawlUrl: true,
                selector: true,
                name: true,
            },
            where: {
                id: params.crawlerId,
            },
        })

        if (!crawler) {
            return new Response(null, { status: 404 })
        }

        const content = await crawl(crawler.crawlUrl, crawler.selector, crawler.maxPagesToCrawl, crawler.urlMatch)
        if (!content) {
            return new Response(null, { status: 500 })
        }

        const date = new Date()
        const fileName = crawler.name.toLowerCase().replace(/\s/g, "-") + '-' + date.toISOString() + ".json"

        const blob = await put(fileName, JSON.stringify(content), {
            access: "public"
        })

        const openAIConfig = await db.openAIConfig.findUnique({
            select: {
                globalAPIKey: true,
                id: true,
            },
            where: {
                userId: session?.user?.id
            }
        })

        const openai = new OpenAI({
            apiKey: openAIConfig?.globalAPIKey
        })

        const file = await openai.files.create(
            { file: await fetch(blob.url), purpose: 'assistants' }
        )

        await db.file.create({
            data: {
                name: fileName,
                blobUrl: blob.url,
                openAIFileId: file.id,
                userId: session?.user?.id,
                crawlerId: crawler.id,
            }
        })

        return new Response(null, { status: 204 })
    } catch (error) {
        if (error instanceof z.ZodError) {
            return new Response(JSON.stringify(error.issues), { status: 422 })
        }
        console.log(error)

        return new Response(null, { status: 500 })
    }
}