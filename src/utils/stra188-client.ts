// Stra188 API Client
// This file wraps your existing data fetching script

import * as dotenv from 'dotenv';
import axios, { AxiosResponse } from 'axios';

dotenv.config();

const BASE_URL = 'https://stra188.com/';
const API_URL = 'https://core.stra188.com/api/v1';

interface LoginResponse {
    ok: number;
    d?: {
        sessionId: string;
    };
    message?: string;
}

interface GameUrlResponse {
    ok: number;
    d?: {
        url: string;
    };
    message?: string;
}

interface DesktopMenuResponse {
    Next: number;
    Data: Array<{
        Key: string;
        Mode: string;
        MarketId: string;
        SportType: number;
        BetTypeGroup: string;
        Count: number;
        Streaming: boolean;
    }>;
}

interface IndexResponse {
    Data: {
        rt: string;
        at: string;
    };
}

/**
 * Login and get session ID from stra188.com
 */
export async function login(): Promise<string> {
    if (!process.env.SITE_USERNAME || !process.env.SITE_PASSWORD || !process.env.SITE_CAPTCHA_CODE) {
        throw new Error('Missing required environment variables: SITE_USERNAME, SITE_PASSWORD, SITE_CAPTCHA_CODE');
    }

    const response: AxiosResponse<LoginResponse> = await axios.post(
        `${API_URL}/auth/login`,
        {
            username: process.env.SITE_USERNAME,
            password: process.env.SITE_PASSWORD,
            captcha: process.env.SITE_CAPTCHA_CODE,
        },
        {
            headers: { 'Content-Type': 'application/json' },
            timeout: 30000,
        }
    );

    if (response.data.ok !== 1 || !response.data.d?.sessionId) {
        throw new Error(`Login failed: ${response.data.message || 'Unknown error'}`);
    }

    return response.data.d.sessionId;
}

/**
 * Get game URL using sessionId as Bearer token
 */
export async function getGameUrl(sessionId: string): Promise<string> {
    const response: AxiosResponse<GameUrlResponse> = await axios.get(
        `${API_URL}/game/games/568-sports/saba-sport?language=vn&platform=web`,
        {
            headers: { 'Authorization': `Bearer ${sessionId}` },
            timeout: 30000,
        }
    );

    if (response.data.ok !== 1 || !response.data.d?.url) {
        throw new Error(`Failed to get game URL: ${response.data.message || 'Unknown error'}`);
    }

    return response.data.d.url;
}

/**
 * Extract token from game URL
 */
export function extractInsideUrlFromGameUrl(gameUrl: string): string | null {
    try {
        const url = new URL(gameUrl);
        return url.searchParams.get('urlInside');
    } catch {
        return null;
    }
}

/**
 * Resolve redirect location URL based on current URL
 * - If location starts with "http" -> use as-is (absolute URL)
 * - If location starts with "//" -> protocol-relative URL, add "https:"
 * - If location starts with "/" -> same domain, append path to current origin
 */
function resolveRedirectUrl(location: string, currentUrl: string): string {
    if (location.startsWith('http')) {
        // Absolute URL - use as-is
        return location;
    } else if (location.startsWith('//')) {
        // Protocol-relative URL - add https:
        return `https:${location}`;
    } else if (location.startsWith('/')) {
        // Relative to root - keep current domain, append path
        const currentUrlObj = new URL(currentUrl);
        return `${currentUrlObj.origin}${location}`;
    } else {
        // Relative path - resolve against current URL
        return new URL(location, currentUrl).toString();
    }
}

/**
 * Shorten URL for logging - show domain and last part of path
 */
function shortenUrl(url: string): string {
    try {
        const urlObj = new URL(url);
        const pathParts = urlObj.pathname.split('/').filter(Boolean);
        const lastPart = pathParts.length > 0 ? pathParts[pathParts.length - 1] : '';
        return `${urlObj.hostname}/.../${lastPart}${urlObj.search.slice(0, 30)}${urlObj.search.length > 30 ? '...' : ''}`;
    } catch {
        return url.slice(0, 60) + (url.length > 60 ? '...' : '');
    }
}

/**
 * Call chain: urlInside → 2 welcome (302) → 1 redirect (302) → 2 depositProcessLogin (302) → 2 afterLogin (302) → newIndexUrl (200).
 * All steps except the last return 302; newIndexUrl returns 200 and ends the chain.
 */
export type RedirectChainEntryType =
    | 'urlInside'
    | 'welcome'
    | 'redirect'
    | 'depositProcessLogin'
    | 'afterLogin'
    | 'newIndexUrl';

export interface RedirectChainEntry {
    type: RedirectChainEntryType;
    url: string;
    statusCode: number;
}

/** Structured access to each URL in the chain. */
export interface RedirectChainUrls {
    urlInside: string;
    welcome: [string, string];
    redirect: string;
    depositProcessLogin: [string, string];
    afterLogin: [string, string];
    newIndexUrl: string;
}

export interface FollowRedirectsResult {
    chain: RedirectChainEntry[];
    urls: RedirectChainUrls;
    finalUrl: string;
}

function delay(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms));
}

/** Chain type by position: 0,1 welcome; 2 redirect; 3,4 depositProcessLogin; 5,6 afterLogin; 7 newIndexUrl. */
function chainTypeFor(redirectIndex: number): RedirectChainEntryType {
    if (redirectIndex <= 1) return 'welcome';
    if (redirectIndex === 2) return 'redirect';
    if (redirectIndex <= 4) return 'depositProcessLogin';
    if (redirectIndex <= 6) return 'afterLogin';
    return 'newIndexUrl';
}

function buildUrls(chain: RedirectChainEntry[], finalUrl: string): RedirectChainUrls {
    const by = (t: RedirectChainEntryType) => chain.filter((e) => e.type === t).map((e) => e.url);
    const w = by('welcome');
    const d = by('depositProcessLogin');
    const a = by('afterLogin');
    const urlInside = chain.find((e) => e.type === 'urlInside')?.url ?? '';
    const redirect = by('redirect')[0] ?? '';
    const newIndexUrl = by('newIndexUrl')[0] ?? finalUrl;
    return {
        urlInside,
        welcome: [w[0] ?? '', w[1] ?? ''],
        redirect,
        depositProcessLogin: [d[0] ?? '', d[1] ?? ''],
        afterLogin: [a[0] ?? '', a[1] ?? ''],
        newIndexUrl,
    };
}

const REDIRECT_TIMEOUT_MS = Math.max(30000, parseInt(process.env.STRA188_REDIRECT_TIMEOUT_MS ?? '60000', 10));
const REDIRECT_RETRIES = Math.max(1, parseInt(process.env.STRA188_REDIRECT_RETRIES ?? '3', 10));

/**
 * Follow redirects until we get a 200 response (newIndexUrl).
 * Chain: urlInside → 2 welcome → 1 redirect → 2 depositProcessLogin → 2 afterLogin → newIndexUrl (200).
 * Returns chain, structured urls, and finalUrl.
 */
export async function followRedirectsToFinalUrl(startUrl: string): Promise<FollowRedirectsResult> {
    const chain: RedirectChainEntry[] = [];
    let currentUrl = startUrl;
    let redirectCount = 0;
    const maxRedirects = 12;
    const delayMs = 500;
    let cookies: string[] = [];

    chain.push({ type: 'urlInside', url: startUrl, statusCode: 0 });
    console.log(`[stra188-client] Starting redirect chain from: ${shortenUrl(currentUrl)} (timeout ${REDIRECT_TIMEOUT_MS / 1000}s, ${REDIRECT_RETRIES} retries)`);

    while (redirectCount < maxRedirects) {
        console.log(`[stra188-client] Requesting: ${shortenUrl(currentUrl)}`);
        await delay(delayMs);

        for (let attempt = 1; attempt <= REDIRECT_RETRIES; attempt++) {
            try {
                const response = await axios.get(currentUrl, {
                    maxRedirects: 0,
                    validateStatus: () => true,
                    timeout: REDIRECT_TIMEOUT_MS,
                    headers: {
                        'User-Agent': 'Stra188-Client/1',
                        'Accept': 'text/html, */*',
                        ...(cookies.length > 0 ? { 'Cookie': cookies.join('; ') } : {}),
                    },
                });

                const setCookies = response.headers['set-cookie'];
                if (setCookies) {
                    const newCookies = Array.isArray(setCookies) ? setCookies : [setCookies];
                    for (const cookie of newCookies) {
                        const cookiePart = cookie.split(';')[0];
                        cookies.push(cookiePart);
                    }
                }

                if (response.status >= 200 && response.status < 300) {
                    console.log(`[stra188-client] Final URL (${response.status}): ${shortenUrl(currentUrl)} [newIndexUrl]`);
                    const urls = buildUrls(chain, currentUrl);
                    return { chain, urls, finalUrl: currentUrl };
                }

                if (response.status >= 300 && response.status < 400) {
                    const location = response.headers.location;
                    if (!location) {
                        console.log(`[stra188-client] No Location in 3xx, treating as final: ${shortenUrl(currentUrl)}`);
                        const urls = buildUrls(chain, currentUrl);
                        return { chain, urls, finalUrl: currentUrl };
                    }

                    const nextUrl = resolveRedirectUrl(location, currentUrl);
                    const typ = chainTypeFor(redirectCount);
                    chain.push({ type: typ, url: nextUrl, statusCode: response.status });
                    console.log(`[stra188-client] #${redirectCount + 1}: ${response.status} | ${typ} -> ${shortenUrl(nextUrl)}`);
                    currentUrl = nextUrl;
                    redirectCount++;
                    break; // success, exit retry loop
                }

                throw new Error(`Unexpected status ${response.status} at ${shortenUrl(currentUrl)}`);
            } catch (error: any) {
                if (error.message?.includes('Unexpected status')) throw error;
                const isRetryable = error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT' || error.code === 'ECONNRESET' || error.message?.includes('timeout');
                if (isRetryable && attempt < REDIRECT_RETRIES) {
                    console.log(`[stra188-client] ${error.message}; retry ${attempt}/${REDIRECT_RETRIES} in 2s...`);
                    await delay(2000);
                } else {
                    throw new Error(`Failed to follow redirect at ${shortenUrl(currentUrl)}: ${error.message}`);
                }
            }
        }
    }

    throw new Error(`Too many redirects (max ${maxRedirects}), last URL: ${shortenUrl(currentUrl)}`);
}

/**
 * Get first deposit process login URL
 */
export async function getFirstDepositProcessLoginUrl(token: string): Promise<string> {
    const response: AxiosResponse<GameUrlResponse> = await axios.get(
        `${API_URL}/game/games/iframe/saba-sport`,
        {
            headers: { Authorization: `Bearer ${token}` },
            timeout: 30000,
        }
    );

    if (response.data.ok !== 1 || !response.data.d?.url) {
        throw new Error(`Failed to get iframe URL: ${response.data.message || 'Unknown error'}`);
    }

    return response.data.d.url;
}

/**
 * Get second deposit login URL from redirect Location header
 */
export async function getSecondDepositProcessLoginLocation(url: string): Promise<string> {
    const response = await axios.get(url, {
        maxRedirects: 0,
        validateStatus: (status) => status >= 300 && status < 400,
        timeout: 30000,
    });

    return response.headers.location || (response as any).response?.headers?.location;
}

/**
 * Get after-login redirect URL
 */
export async function getAfterLoginUrl(secondDepositProcessLoginLocation: string, firstDepositProcessLoginUrl: string): Promise<string> {
    const origin = new URL(firstDepositProcessLoginUrl).origin;
    const fullUrl = secondDepositProcessLoginLocation.startsWith('http')
        ? secondDepositProcessLoginLocation
        : `${origin}${secondDepositProcessLoginLocation}`;

    const response = await axios.get(fullUrl, {
        maxRedirects: 0,
        validateStatus: (status) => status >= 300 && status < 400,
        timeout: 30000,
    });

    return response.headers.location || (response as any).response?.headers?.location;
}

/**
 * Extract first session token from newIndexUrl path.
 * URL format: https://domain.com/(S(token))/NewIndex?...
 * Token is the second path segment (first after domain).
 */
export function getFirstSessionToken(newIndexUrl: string): string {
    try {
        const urlObj = new URL(newIndexUrl);
        const pathname = urlObj.pathname;
        const segments = pathname.split('/').filter(Boolean);

        if (!segments.length) {
            throw new Error('Session token not found in URL path');
        }

        // Token is the first path segment: /(S(...))/
        const token = segments[0];
        
        if (!token || !token.startsWith('(')) {
            throw new Error(`Invalid session token format in URL: ${token}`);
        }

        return token;
    } catch (error: any) {
        throw new Error(`Failed to extract session token from URL: ${error.message}`);
    }
}

/**
 * Get GUID from AppConfig endpoint
 */
export async function getGUID(firstSessionToken: string, afterLoginUrl: string): Promise<string> {
    const origin = new URL(afterLoginUrl).origin;
    const url = `${origin}/${firstSessionToken}/NewIndex/GetAppConfig`;

    const response = await axios.get(url, {
        timeout: 30000,
        headers: {
            'User-Agent': 'Stra188-Client/1',
            'Accept': 'application/json, */*',
        },
    });

    const data = response.data as any;
    if (!data?.GUID) {
        throw new Error('GUID not found in GetAppConfig response');
    }

    return data.GUID;
}

/**
 * Get EntryIndex URL
 */
export async function getFirstEntryIndexUrl(afterLoginUrl: string, firstSessionToken: string, lang: string, webskintype: string, GUID: string): Promise<string> {
    const origin = new URL(afterLoginUrl).origin;
    const timestamp = Date.now();
    const gid = `${GUID}${timestamp}`;
    const OpenSportsUrl = `${origin}/${firstSessionToken}/EntryIndex/OpenSports?lang=${encodeURIComponent(lang)}&webskintype=${encodeURIComponent(webskintype)}&gid=${encodeURIComponent(gid)}`;

    const response = await axios.get(OpenSportsUrl, {
        maxRedirects: 0,
        validateStatus: (status) => status >= 300 && status < 400,
        timeout: 30000,
    });

    return response.headers.location || (response as any).response?.headers?.location;
}

/**
 * Get second EntryIndex URL from redirect
 */
export async function getSecondEntryIndexUrl(entryIndexUrl: string): Promise<string> {
    const origin = new URL(entryIndexUrl).origin;
    const response = await axios.get(entryIndexUrl, {
        maxRedirects: 0,
        validateStatus: (status) => status >= 300 && status < 400,
        timeout: 30000,
    });

    const location = response.headers.location || (response as any).response?.headers?.location;
    return location.startsWith('http') ? location : `${origin}${location}`;
}

/**
 * Get Sports URL from secondEntryIndexUrl
 */
export async function getSportsUrl(secondEntryIndexUrl: string): Promise<string> {
    const response = await axios.get(secondEntryIndexUrl, {
        maxRedirects: 0,
        validateStatus: (status) => status >= 300 && status < 400,
        timeout: 30000,
    });

    const location = response.headers.location || (response as any).response?.headers?.location;
    const origin = new URL(secondEntryIndexUrl).origin;

    return location.startsWith('http') ? location : `${origin}${location}`;
}

/**
 * Extract parameters (rt, at, id, websocketUrl) from MS2 object inside sportsUrl HTML
 * Fetches the sportsUrl page and extracts MS2.rt, MS2.at, MS2.id, and MS2.url from the HTML
 */
export async function extractParametersFromSportsUrl(sportsUrl: string): Promise<{
    rt: string;
    at: string;
    id: string;
    socketUrl: string;
    apiBackendOrigin: string;
}> {
    const response = await axios.get(sportsUrl, {
        timeout: 30000,
        responseType: 'text',
    });
    const html = response.data as string;
    const rtMatch = html.match(/MS2\.rt\s*=\s*"([^"]+)"/);
    const atMatch = html.match(/MS2\.at\s*=\s*"([^"]+)"/);
    let idMatch = html.match(/"ID":\s*"?(\d+)"?/);
    const socketUrlMatch = html.match(/MS2\.url\s*=\s*\{[^}]*\bp\s*:\s*"([^"]+)"/);
    const apiBackendMatch = html.match(/"ApiBackendUrl"\s*:\s*"([^"]+)"/);
    if (!idMatch) idMatch = html.match(/ID["\s]*[:=]\s*"?(\d+)"?/i);
    if (!idMatch) idMatch = html.match(/MS2\.id\s*=\s*"?(\d+)"?/i);
    if (!rtMatch || !atMatch) throw new Error('Failed to extract MS2.rt or MS2.at from HTML');
    if (!idMatch) throw new Error('Failed to extract ID from HTML');
    if (!socketUrlMatch) throw new Error('Failed to extract socketUrl (MS2.url.p) from HTML');
    if (!apiBackendMatch) throw new Error('Failed to extract ApiBackendUrl from HTML');
    let apiBackendOrigin: string;
    try {
        apiBackendOrigin = new URL(apiBackendMatch[1]).origin;
    } catch {
        throw new Error('Invalid ApiBackendUrl in HTML');
    }
    return {
        rt: rtMatch[1],
        at: atMatch[1],
        id: idMatch[1],
        socketUrl: socketUrlMatch[1],
        apiBackendOrigin,
    };
}

/**
 * Call LoginCheckin/Index to refresh rt and at
 */
export async function callIndex(sportsUrl: string, rt: string, at: string): Promise<{ rt: string; at: string }> {
    const sportsUrlObj = new URL(sportsUrl);
    const pathParts = sportsUrlObj.pathname.split('/').filter(Boolean);
    const sessionToken = pathParts[0];
    const indexUrl = `${sportsUrlObj.origin}/${sessionToken}/LoginCheckin/Index`;

    try {
        const response: AxiosResponse<IndexResponse> = await axios.post(
            indexUrl,
            { rt, at },
            {
                timeout: 30000,
                headers: { 'Content-Type': 'application/json' },
            }
        );

        // Check for 401 Unauthorized
        if (response.status === 401) {
            const error = new Error('401 Unauthorized: Authentication token expired');
            (error as any).response = response;
            throw error;
        }

        // Check response status
        if (response.status < 200 || response.status >= 300) {
            throw new Error(`Index API returned status ${response.status}`);
        }

        const data = response.data?.Data;
        if (!data || !data.rt || !data.at) {
            throw new Error('Invalid response: rt or at not found in Data');
        }

        return { rt: data.rt, at: data.at };
    } catch (error: any) {
        // Re-throw with status code if available
        if (error.response?.status === 401) {
            const authError = new Error('401 Unauthorized: Authentication token expired');
            (authError as any).response = error.response;
            throw authError;
        }
        throw error;
    }
}

/**
 * Call desktop menu API (sportsUrl origin).
 */
export async function callDesktopMenu(sportsUrl: string, at: string): Promise<DesktopMenuResponse> {
    const origin = new URL(sportsUrl).origin;
    const desktopMenuUrl = `${origin}/api/menu/desktopMenu`;

    try {
        const response: AxiosResponse<DesktopMenuResponse | { Data: DesktopMenuResponse }> = await axios.post(
            desktopMenuUrl,
            9,
            {
                timeout: 30000,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `bearer ${at}`,
                },
            }
        );

        // Check for 401 Unauthorized
        if (response.status === 401) {
            const error = new Error('401 Unauthorized: Authentication token expired');
            (error as any).response = response;
            throw error;
        }

        // Check response status
        if (response.status < 200 || response.status >= 300) {
            throw new Error(`Desktop menu API returned status ${response.status}`);
        }

        // Handle both response structures:
        // 1. Direct DesktopMenuResponse: { Next: number, Data: Array }
        // 2. Wrapped: { Data: { Next: number, Data: Array } }
        if (!response.data) {
            throw new Error('Invalid response: No data in desktop menu response');
        }

        // Check if response.data is already DesktopMenuResponse (has Next and Data)
        if ('Next' in response.data && 'Data' in response.data) {
            return response.data as DesktopMenuResponse;
        }

        // Otherwise, check if it's wrapped in a Data property
        if ('Data' in response.data && typeof (response.data as any).Data === 'object') {
            const wrappedData = (response.data as any).Data;
            if ('Next' in wrappedData && 'Data' in wrappedData) {
                return wrappedData as DesktopMenuResponse;
            }
        }

        throw new Error('Invalid response: DesktopMenuResponse structure not found');
    } catch (error: any) {
        // Re-throw with status code if available
        if (error.response?.status === 401) {
            const authError = new Error('401 Unauthorized: Authentication token expired');
            (authError as any).response = error.response;
            throw authError;
        }
        throw error;
    }
}

/**
 * Get MoneyLine Mapping Odds List
 * TODO: Implement this based on your API endpoint
 */
export async function getMoneyLineMappingOddsList(at: string): Promise<any> {
    // You'll need to implement this based on the actual API endpoint
    // Example structure:
    // const response = await axios.get(
    //     `${API_URL}/odds/moneyline-mapping`,
    //     {
    //         headers: { 'Authorization': `bearer ${at}` },
    //         timeout: 30000,
    //     }
    // );
    // return response.data;
    
    throw new Error('getMoneyLineMappingOddsList not yet implemented');
}

export function getWebSocketGid(): string {
    return Array.from({ length: 4 }, () =>
        Math.floor((1 + Math.random()) * 65536).toString(16).substring(1)
    ).join('');
}