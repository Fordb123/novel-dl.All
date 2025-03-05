// ==UserScript==
// @name         Novel Downloader Universal
// @namespace    https://github.com/Fordb123/novel-dl.All
// @version      2.0
// @description  Descarga novelas web de múltiples sitios compatibles
// @author       Fordb123
// @match        *://*/*
// @grant        GM_xmlhttpRequest
// @grant        GM_download
// @connect      *
// @require      https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js
// @license      MIT
// ==/UserScript==

const SITE_CONFIG = {
    'default': {
        contentSelector: '#novel_content, .chapter-content, .entry-content, .content, .text',
        titleSelector: '.toon-title, h1.chapter-title, #chapter-title, .title',
        episodeLinksSelector: '.item-subject, .chapter-list a, .episode-list li a',
        isCaptchaPage: (doc) => doc.querySelector('.g-recaptcha, #recaptcha'),
        processTitle: (element) => {
            const title = element.getAttribute('title') || element.textContent;
            return title.split('\n')[0].trim().replace(/Capítulo\s+\d+/i, '').trim();
        },
        processContent: (content) => content.replace(/Continuar leyendo/g, ''),
        paginationSelector: '.pagination, .nav-links, .page-nav'
    },
    'wuxiaworld': {
        contentSelector: '.chapter-content',
        titleSelector: '.chapter-title',
        processTitle: (element) => element.textContent.replace('Chapter', '').trim(),
        processContent: (content) => content.replace(/Advertisement/g, '')
    },
    'novelupdates': {
        contentSelector: '.chapter-content',
        titleSelector: '.chapter-title',
        episodeLinksSelector: '.chapter-list li a',
        processContent: (content) => content.replace(/Please read this chapter at www.novelupdates.com for faster releases/g, '')
    }
};

(function() {
    'use strict';

    async function fetchNovelContent(url) {
        const config = getSiteConfig(url);
        const response = await fetch(url);

        if (!response.ok) {
            console.error(`Error fetching ${url}. Status: ${response.status}`);
            return null;
        }

        const html = await response.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');

        if (config.isCaptchaPage(doc)) {
            console.warn('CAPTCHA detected:', url);
            return null;
        }

        const titleElement = doc.querySelector(config.titleSelector);
        let episodeTitle = 'Untitled Episode';
        if (titleElement) {
            episodeTitle = config.processTitle(titleElement);
        }

        const content = doc.querySelector(config.contentSelector);
        if (!content) {
            console.error(`Content not found with selector: ${config.contentSelector}`);
            return null;
        }

        let cleanedContent = cleanText(config.processContent(content.innerHTML));

        return {
            episodeTitle: sanitizeFilename(episodeTitle),
            content: cleanedContent
        };
    }

    function getSiteConfig(url) {
        const hostname = new URL(url).hostname;
        const siteKey = Object.keys(SITE_CONFIG).find(key => 
            key !== 'default' && hostname.includes(key)
        );
        return {...SITE_CONFIG.default, ...SITE_CONFIG[siteKey || 'default']};
    }

    function cleanText(text) {
        const replacements = [
            [/<div>/g, ''],
            [/<\/div>/g, ''],
            [/<p>/g, '\n'],
            [/<\/p>/g, '\n'],
            [/<br\s*\/?>/g, '\n'],
            [/<img[^>]*>/gi, '[Imagen]'],
            [/<aside[^>]*>.*?<\/aside>/gis, ''],
            [/<script[^>]*>.*?<\/script>/gis, ''],
            [/<style[^>]*>.*?<\/style>/gis, ''],
            [/<!--.*?-->/gs, ''],
            [/<[^>]*>/g, ''],
            [/\n{3,}/g, '\n\n'],
            [/^\s+|\s+$/g, '']
        ];

        return replacements.reduce((str, [regex, replacement]) => 
            str.replace(regex, replacement), unescapeHTML(text))
            .split('\n')
            .map(line => line.trim())
            .filter(line => line.length > 0)
            .join('\n\n');
    }

    function extractEpisodeLinks() {
        const config = getSiteConfig(window.location.href);
        const links = document.querySelectorAll(config.episodeLinksSelector);
        return Array.from(links).map(link => {
            const href = link.href || link.getAttribute('data-href');
            return new URL(href, window.location.href).href;
        }).filter(url => url && !url.includes('javascript'));
    }

    function extractTitle() {
        const config = getSiteConfig(window.location.href);
        const titleElement = document.querySelector(config.titleSelector) || 
                           document.querySelector('h1') ||
                           document.querySelector('title');
        return titleElement ? sanitizeFilename(titleElement.textContent.trim()) : 'Novel';
    }

    async function runCrawler() {
        if (!confirm('¿Iniciar descarga de la novela?\n\n¡Asegúrate de estar en la página correcta!')) return;

        const title = extractTitle();
        const episodeLinks = extractEpisodeLinks();

        if (episodeLinks.length === 0) {
            alert('No se encontraron episodios. ¿Estás en la página de listado de capítulos?');
            return;
        }

        const totalPages = await detectPagination();
        const allEpisodeLinks = await fetchAllPages(totalPages, episodeLinks);

        if (allEpisodeLinks.length === 0) {
            alert('No se pudieron obtener los enlaces de los episodios');
            return;
        }

        showRangeSelector(title, allEpisodeLinks);
    }

    async function detectPagination() {
        const config = getSiteConfig(window.location.href);
        const pagination = document.querySelector(config.paginationSelector);
        return pagination ? parseInt(pagination.lastElementChild.textContent) || 1 : 1;
    }

    async function fetchAllPages(totalPages, initialLinks) {
        const allLinks = [...initialLinks];
        
        for (let page = 2; page <= totalPages; page++) {
            const pageUrl = `${window.location.href.split('?')[0]}?page=${page}`;
            const doc = await fetchPage(pageUrl);
            if (doc) {
                const links = extractEpisodeLinks();
                allLinks.push(...links);
            }
            await delay(2000);
        }
        
        return allLinks.reverse();
    }

    // ... [Las funciones restantes de UI y descarga se mantienen igual que en tu código original]
    // [Asegúrate de incluir todas las funciones auxiliares: createModal, createProgressTracker, etc.]

    function init() {
        const button = document.createElement('button');
        button.textContent = '📖 Descargar Novela';
        button.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            z-index: 99999;
            padding: 12px 24px;
            background: #3a7bd5;
            color: white;
            border: none;
            border-radius: 8px;
            cursor: pointer;
            box-shadow: 0 4px 12px rgba(0,0,0,0.2);
            font-family: -apple-system, sans-serif;
        `;
        button.onclick = runCrawler;
        document.body.appendChild(button);
    }

    setTimeout(init, 3000);
})();
