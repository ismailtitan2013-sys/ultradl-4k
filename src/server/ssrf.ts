import dns from 'node:dns/promises';
import http from 'node:http';
import https from 'node:https';
import fs from 'node:fs';
import path from 'node:path';
import { URL } from 'node:url';

export interface DownloadResult {
  filePath: string;
  bytesReceived: number;
  contentType: string;
  finalUrl: string;
}

/**
 * Checks if an IP is within private, loopback, link-local, or cloud metadata ranges.
 */
export function isPrivateOrReservedIp(ip: string): boolean {
  // IPv4 checks
  if (ip === 'localhost' || ip === '0.0.0.0' || ip === '255.255.255.255') return true;

  const ipv4Parts = ip.split('.').map(Number);
  if (ipv4Parts.length === 4 && ipv4Parts.every((p) => !isNaN(p) && p >= 0 && p <= 255)) {
    const [b0, b1, b2, b3] = ipv4Parts;
    // 127.0.0.0/8 (Loopback)
    if (b0 === 127) return true;
    // 10.0.0.0/8 (Private RFC 1918)
    if (b0 === 10) return true;
    // 172.16.0.0/12 (Private RFC 1918)
    if (b0 === 172 && b1 >= 16 && b1 <= 31) return true;
    // 192.168.0.0/16 (Private RFC 1918)
    if (b0 === 192 && b1 === 168) return true;
    // 169.254.0.0/16 (Link-local & AWS/GCP/Azure Metadata: 169.254.169.254)
    if (b0 === 169 && b1 === 254) return true;
    // 0.0.0.0/8
    if (b0 === 0) return true;
    // 100.64.0.0/10 (Carrier-grade NAT)
    if (b0 === 100 && b1 >= 64 && b1 <= 127) return true;
    // Multicast 224.0.0.0/4
    if (b0 >= 224) return true;
    return false;
  }

  // IPv6 checks
  const lower = ip.toLowerCase();
  if (lower === '::1' || lower === '::' || lower === '0:0:0:0:0:0:0:1') return true;
  // fe80::/10 link local
  if (lower.startsWith('fe80:') || lower.startsWith('fe8') || lower.startsWith('fe9') || lower.startsWith('fea') || lower.startsWith('feb')) {
    return true;
  }
  // fc00::/7 unique local
  if (lower.startsWith('fc') || lower.startsWith('fd')) {
    return true;
  }

  return false;
}

/**
 * Validates a URL against SSRF by checking protocol and resolving DNS.
 */
export async function validateUrlAgainstSSRF(rawUrl: string): Promise<{ valid: boolean; reason?: string; resolvedIp?: string; urlObj: URL }> {
  let urlObj: URL;
  try {
    urlObj = new URL(rawUrl);
  } catch {
    return { valid: false, reason: 'Некорректный формат URL', urlObj: null as unknown as URL };
  }

  if (urlObj.protocol !== 'http:' && urlObj.protocol !== 'https:') {
    return { valid: false, reason: 'Разрешены только протоколы HTTP и HTTPS', urlObj };
  }

  const hostname = urlObj.hostname;
  if (!hostname) {
    return { valid: false, reason: 'Отсутствует имя хоста', urlObj };
  }

  // Block obvious dangerous hostnames
  if (
    hostname.toLowerCase() === 'localhost' ||
    hostname.toLowerCase().endsWith('.localhost') ||
    hostname === '127.0.0.1' ||
    hostname === '::1' ||
    hostname === 'metadata.google.internal' ||
    hostname === 'metadata'
  ) {
    return { valid: false, reason: 'Доступ к локальным адресам и метаданным заблокирован (SSRF Guard)', urlObj };
  }

  // Resolve hostname via DNS
  try {
    const lookupResult = await dns.lookup(hostname, { all: true });
    if (!lookupResult || lookupResult.length === 0) {
      return { valid: false, reason: `Не удалось разрешить DNS для хоста: ${hostname}`, urlObj };
    }

    for (const record of lookupResult) {
      if (isPrivateOrReservedIp(record.address)) {
        return {
          valid: false,
          reason: `Хост ${hostname} разрешается в приватный или зарезервированный IP адрес (${record.address}) — доступ запрещен (SSRF Guard)`,
          resolvedIp: record.address,
          urlObj,
        };
      }
    }

    return { valid: true, resolvedIp: lookupResult[0].address, urlObj };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return { valid: false, reason: `Ошибка DNS разрешения (${errorMsg})`, urlObj };
  }
}

/**
 * Downloads a video file safely with SSRF protection on every redirect and hard size limits.
 */
export async function safeDownloadFile(
  rawUrl: string,
  destinationPath: string,
  maxSizeBytes: number = 500 * 1024 * 1024, // 500MB
  timeoutMs: number = 60000,
  maxRedirects: number = 5
): Promise<DownloadResult> {
  let currentUrl = rawUrl;
  let redirectsRemaining = maxRedirects;

  while (redirectsRemaining >= 0) {
    const ssrfCheck = await validateUrlAgainstSSRF(currentUrl);
    if (!ssrfCheck.valid) {
      throw new Error(`SSRF Блокировка: ${ssrfCheck.reason}`);
    }

    const res = await performSingleDownloadHop(currentUrl, destinationPath, maxSizeBytes, timeoutMs);
    if (res.redirectUrl) {
      currentUrl = res.redirectUrl;
      redirectsRemaining--;
      if (redirectsRemaining < 0) {
        throw new Error('Превышено максимальное количество перенаправлений (редиректов)');
      }
      continue;
    }

    return {
      filePath: destinationPath,
      bytesReceived: res.bytesReceived,
      contentType: res.contentType,
      finalUrl: currentUrl,
    };
  }

  throw new Error('Не удалось завершить загрузку файла');
}

function performSingleDownloadHop(
  targetUrl: string,
  destinationPath: string,
  maxSizeBytes: number,
  timeoutMs: number
): Promise<{ redirectUrl?: string; bytesReceived: number; contentType: string }> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(targetUrl);
    const client = parsed.protocol === 'https:' ? https : http;

    const req = client.request(
      targetUrl,
      {
        method: 'GET',
        headers: {
          'User-Agent': 'UltraDL-4K-VideoEngine/2.0 (Security-Checked Downloader)',
          Accept: '*/*',
        },
        timeout: timeoutMs,
      },
      (res) => {
        // Handle redirect
        if (
          res.statusCode &&
          [301, 302, 303, 307, 308].includes(res.statusCode) &&
          res.headers.location
        ) {
          req.destroy();
          try {
            const redirectUrl = new URL(res.headers.location, targetUrl).toString();
            resolve({ redirectUrl, bytesReceived: 0, contentType: '' });
          } catch (e: unknown) {
            reject(new Error(`Некорректный URL перенаправления: ${res.headers.location}`));
          }
          return;
        }

        if (!res.statusCode || res.statusCode < 200 || res.statusCode >= 300) {
          req.destroy();
          reject(new Error(`Сервер источника вернул статус HTTP ${res.statusCode} ${res.statusMessage || ''}`));
          return;
        }

        const contentLengthHeader = res.headers['content-length'];
        if (contentLengthHeader) {
          const expectedLength = parseInt(contentLengthHeader, 10);
          if (expectedLength > maxSizeBytes) {
            req.destroy();
            reject(
              new Error(
                `Размер файла (${(expectedLength / 1024 / 1024).toFixed(1)} МБ) превышает допустимый лимит (${(
                  maxSizeBytes /
                  1024 /
                  1024
                ).toFixed(0)} МБ)`
              )
            );
            return;
          }
        }

        let bytesReceived = 0;
        const fileStream = fs.createWriteStream(destinationPath);

        res.on('data', (chunk: Buffer) => {
          bytesReceived += chunk.length;
          if (bytesReceived > maxSizeBytes) {
            req.destroy();
            fileStream.destroy();
            try {
              if (fs.existsSync(destinationPath)) fs.unlinkSync(destinationPath);
            } catch {}
            reject(
              new Error(
                `Превышен максимальный лимит размера файла (${(maxSizeBytes / 1024 / 1024).toFixed(0)} МБ)`
              )
            );
          }
        });

        res.pipe(fileStream);

        fileStream.on('finish', () => {
          fileStream.close(() => {
            resolve({
              bytesReceived,
              contentType: res.headers['content-type'] || 'video/mp4',
            });
          });
        });

        fileStream.on('error', (err) => {
          req.destroy();
          try {
            if (fs.existsSync(destinationPath)) fs.unlinkSync(destinationPath);
          } catch {}
          reject(new Error(`Ошибка записи на диск: ${err.message}`));
        });
      }
    );

    req.on('timeout', () => {
      req.destroy();
      try {
        if (fs.existsSync(destinationPath)) fs.unlinkSync(destinationPath);
      } catch {}
      reject(new Error(`Превышено время ожидания ответа сервера (${timeoutMs / 1000} сек)`));
    });

    req.on('error', (err) => {
      try {
        if (fs.existsSync(destinationPath)) fs.unlinkSync(destinationPath);
      } catch {}
      reject(new Error(`Сетевая ошибка: ${err.message}`));
    });

    req.end();
  });
}
