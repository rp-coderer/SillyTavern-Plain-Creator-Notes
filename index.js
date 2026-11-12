/**
 * Plain Creator Notes
 *
 * SillyTavern prints a character's creator notes in the character list
 * (`#rm_print_characters_block .character_select .ch_description`) as literal
 * text: `getCharacterBlock()` in script.js does `.text(item.data?.creator_notes)`.
 * That is deliberately safe (no card-supplied HTML is executed), but it also
 * means cards whose creator notes are HTML show tags such as
 * `<p style="text-align: center;">` in the list.
 *
 * This extension rewrites only the *rendered text* of that one element after
 * every reprint of the list. It never writes to the character data, so the
 * card, the prompt, and the editable creator notes are untouched.
 *
 * How the tags are removed
 * ------------------------
 * The raw string is parsed with an inert `<template>` (no scripts run, no
 * resources load), then walked to collect text nodes. Element text is skipped
 * for CSS/JS-bearing tags (`<style>`, `<script>`, ...) so stylesheet bodies do
 * not leak in as text, and block-level tags emit a newline so `<p>a</p><p>b</p>`
 * does not collapse into `ab`.
 *
 * Why not a regex: `<[^>]*>` breaks on `>` inside an attribute value, leaves
 * `<style>` bodies and HTML entities (`&amp;`, `&nbsp;`) behind. Parsing is
 * slower per call, but this runs once per list render over at most a few dozen
 * visible entries, so the cost is invisible.
 */

const CONTAINER_ID = 'rm_print_characters_block';
const ENTITY_SELECTOR = '.character_select';
const DESCRIPTION_SELECTOR = '.ch_description';
const PROCESSED_FLAG = 'plainNotes';

/** Elements whose text must never be surfaced (stylesheets, scripts, metadata). */
const SKIP_TAGS = new Set([
    'STYLE',
    'SCRIPT',
    'NOSCRIPT',
    'TEMPLATE',
    'IFRAME',
    'OBJECT',
    'EMBED',
    'SVG',
    'MATH',
    'HEAD',
    'TITLE',
    'META',
    'LINK',
    'BASE',
]);

/** Elements that should terminate a line of text. */
const BLOCK_TAGS = new Set([
    'P',
    'DIV',
    'BR',
    'LI',
    'UL',
    'OL',
    'DL',
    'DT',
    'DD',
    'H1',
    'H2',
    'H3',
    'H4',
    'H5',
    'H6',
    'TR',
    'TD',
    'TH',
    'TABLE',
    'THEAD',
    'TBODY',
    'BLOCKQUOTE',
    'PRE',
    'HR',
    'SECTION',
    'ARTICLE',
    'ASIDE',
    'HEADER',
    'FOOTER',
    'FIGURE',
    'FIGCAPTION',
    'DETAILS',
    'SUMMARY',
    'CENTER',
    'ADDRESS',
    'FIELDSET',
    'FORM',
    'NAV',
    'MAIN',
]);

/** Reused inert fragment. Template contents never execute or load resources. */
const template = document.createElement('template');

/**
 * Walks a parsed fragment and collects its visible text.
 * @param {Node} node
 * @param {string[]} chunks
 */
function collectText(node, chunks) {
    if (node.nodeType === Node.TEXT_NODE) {
        chunks.push(node.nodeValue ?? '');
        return;
    }

    if (node.nodeType === Node.DOCUMENT_FRAGMENT_NODE) {
        for (const child of node.childNodes) {
            collectText(child, chunks);
        }
        return;
    }

    // Comments, processing instructions, and anything else non-element.
    if (node.nodeType !== Node.ELEMENT_NODE) {
        return;
    }

    const element = /** @type {Element} */ (node);
    const tag = element.tagName.toUpperCase();

    if (SKIP_TAGS.has(tag)) {
        return;
    }

    for (const child of element.childNodes) {
        collectText(child, chunks);
    }

    if (BLOCK_TAGS.has(tag)) {
        chunks.push('\n');
    }
}

/**
 * Converts a creator-notes string containing HTML into display text.
 * @param {string} markup
 * @returns {string}
 */
function toPlainText(markup) {
    template.innerHTML = markup;

    /** @type {string[]} */
    const chunks = [];
    collectText(template.content, chunks);

    return chunks.join('')
        .replace(/\r\n?/g, '\n')
        .replace(/\u00A0/g, ' ')
        .replace(/\n[ \t]+/g, '\n')
        .replace(/[ \t]+\n/g, '\n')
        .replace(/\n{2,}/g, '\n')
        .trim();
}

/**
 * Replaces the rendered text of one character-list description.
 * @param {HTMLElement} element
 */
function processDescription(element) {
    if (element.dataset[PROCESSED_FLAG] === '1') {
        return;
    }

    const raw = element.textContent ?? '';
    if (raw.includes('<') || raw.includes('&')) {
        const plain = toPlainText(raw);
        if (plain !== raw) {
            element.textContent = plain;
        }
    }

    element.dataset[PROCESSED_FLAG] = '1';
}

/** Applies the conversion to every character-list entry currently on screen. */
function processList() {
    const container = document.getElementById(CONTAINER_ID);
    if (!container) {
        return;
    }

    const elements = container.querySelectorAll(`${ENTITY_SELECTOR} ${DESCRIPTION_SELECTOR}`);
    for (const element of elements) {
        processDescription(/** @type {HTMLElement} */ (element));
    }
}

/** @type {number} */
let pendingFrame = 0;

/** Coalesces bursts of child-list mutations into one pass per frame. */
function scheduleProcessList() {
    if (pendingFrame) {
        return;
    }

    pendingFrame = requestAnimationFrame(() => {
        pendingFrame = 0;
        processList();
    });
}

function init() {
    const container = document.getElementById(CONTAINER_ID);
    if (!container) {
        // Should not happen (the block is static markup), but retry rather than
        // silently doing nothing if the DOM order ever changes.
        setTimeout(init, 500);
        return;
    }

    // `printCharacters()` empties the block and appends a block per entry, so
    // observing direct children covers pagination, sorting, search, tag
    // filters, and reprints after editing a card. Our own writes happen inside
    // `.ch_description`, which is a grandchild, so they do not re-trigger this.
    const observer = new MutationObserver(scheduleProcessList);
    observer.observe(container, { childList: true });

    // The list may already be populated if this extension loaded late.
    processList();
}

jQuery(init);
