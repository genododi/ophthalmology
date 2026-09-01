#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(scriptDir, '..');
const pulsePath = path.join(rootDir, 'feeds', 'ophthalmic-pulse.json');

function escapeXml(value) {
    return String(value || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

function truncate(value, length = 150) {
    const text = String(value || '').replace(/\s+/g, ' ').trim();
    return text.length <= length ? text : `${text.slice(0, length - 1).trimEnd()}…`;
}

function citationFor(article) {
    const citation = [article.authors, article.title, article.journal, article.publicationDate]
        .filter(Boolean)
        .map(value => String(value).trim().replace(/[.;]+$/, ''))
        .join('. ');
    return { citation: truncate(citation, 360), url: article.url };
}

function classifyTheme(article) {
    const text = `${article.title || ''} ${article.journal || ''}`.toLowerCase();
    if (/retina|retinal|macula|vitre|choroid|diabetic eye|amd|uveitis/.test(text)) return 'Retina & uveitis';
    if (/cornea|kerat|cataract|lens|refractive|lasik|smile/.test(text)) return 'Anterior segment';
    if (/glaucoma|intraocular pressure|optic nerve/.test(text)) return 'Glaucoma & optic nerve';
    if (/pediatric|paediatric|strabismus|amblyopia|myopia/.test(text)) return 'Paediatric & strabismus';
    if (/artificial intelligence|machine learning|deep learning|device|imaging|oct/.test(text)) return 'Imaging & innovation';
    return 'General ophthalmology';
}

function chartData(articles) {
    const counts = new Map();
    articles.forEach(article => {
        const theme = classifyTheme(article);
        counts.set(theme, (counts.get(theme) || 0) + 1);
    });
    const total = Math.max(1, articles.length);
    return [...counts.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([label, count]) => ({ label, value: Math.max(8, Math.round((count / total) * 100)) }));
}

function illustration(dateLabel, paperCount) {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 280" role="img" aria-label="Daily ophthalmology evidence radar"><defs><linearGradient id="dailyBg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#071a2e"/><stop offset="1" stop-color="#075985"/></linearGradient><radialGradient id="dailyGlow"><stop offset="0" stop-color="#67e8f9" stop-opacity=".75"/><stop offset="1" stop-color="#67e8f9" stop-opacity="0"/></radialGradient></defs><rect width="800" height="280" rx="24" fill="url(#dailyBg)"/><circle cx="650" cy="40" r="190" fill="url(#dailyGlow)"/><g transform="translate(112 140)" fill="none" stroke="#a5f3fc"><ellipse rx="72" ry="48" stroke-width="7"/><circle r="24" fill="#34d399" stroke="#d1fae5" stroke-width="6"/><path d="M-72 0h-30M72 0h30M0-48v-25M0 48v25" stroke-width="4" stroke-linecap="round"/></g><text x="220" y="105" fill="#ecfeff" font-family="system-ui,sans-serif" font-size="31" font-weight="800">OPHTHALMOLOGY EVIDENCE RADAR</text><text x="220" y="148" fill="#bae6fd" font-family="system-ui,sans-serif" font-size="18">${escapeXml(dateLabel)} · ${paperCount} newly indexed signals</text><text x="220" y="190" fill="#6ee7b7" font-family="system-ui,sans-serif" font-size="15" font-weight="700">SCAN → APPRAISE → APPLY</text></svg>`;
}

function validateItem(item) {
    if (!item || !item.id || !item.title || !item.data) throw new Error('Daily item is missing required fields.');
    if (!Array.isArray(item.data.sections) || item.data.sections.length < 3) throw new Error('Daily item must contain at least three sections.');
    item.data.sections.forEach((section, index) => {
        if (!section.title || section.content == null) throw new Error(`Section ${index + 1} is incomplete.`);
        if (!Array.isArray(section.references) || !section.references.length) throw new Error(`Section ${index + 1} has no evidence reference.`);
        section.references.forEach(reference => {
            if (!reference.citation || !/^https?:\/\//.test(reference.url || '')) throw new Error(`Section ${index + 1} has an invalid reference.`);
        });
    });
}

async function writeAtomic(targetPath, value) {
    await fs.mkdir(path.dirname(targetPath), { recursive: true });
    const tempPath = `${targetPath}.tmp`;
    await fs.writeFile(tempPath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
    await fs.rename(tempPath, targetPath);
}

async function writeLibraryItem(item) {
    const safeId = String(item.id || '').replace(/[^a-zA-Z0-9_-]/g, '_');
    const safeTitle = String(item.title || 'untitled').replace(/[^a-zA-Z0-9]/g, '_').slice(0, 50);
    const libraryDir = path.join(rootDir, 'library');
    const filename = `${safeId}_${safeTitle}.json`;
    const prefix = `${safeId}_`;
    await fs.mkdir(libraryDir, { recursive: true });
    const files = await fs.readdir(libraryDir);
    await Promise.all(files
        .filter(file => file.endsWith('.json') && file.startsWith(prefix) && file !== filename)
        .map(file => fs.unlink(path.join(libraryDir, file))));
    await writeAtomic(path.join(libraryDir, filename), item);
}

async function main() {
    const feed = JSON.parse(await fs.readFile(pulsePath, 'utf8'));
    const articles = (Array.isArray(feed.research) ? feed.research : []).filter(article => article.title && /^https?:\/\//.test(article.url || '')).slice(0, 8);
    if (articles.length < 3) throw new Error('Daily infographic generation stopped: fewer than three validated research records are available.');

    const now = new Date();
    const day = now.toISOString().slice(0, 10);
    const dayCompact = day.replace(/-/g, '');
    const dateLabel = now.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
    const sharedReferences = articles.slice(0, 3).map(citationFor);
    const paperSections = articles.slice(0, 4).map((article, index) => ({
        title: `${index + 1}. ${truncate(article.title, 118)}`,
        icon: index === 0 ? 'new_releases' : 'biotech',
        type: 'plain_text',
        layout: 'half_width',
        color_theme: ['blue', 'green', 'purple', 'yellow'][index],
        content: [article.evidenceType, article.journal, article.publicationDate, article.isOpenAccess ? 'Open-access record available' : 'Check institutional full-text entitlement'].filter(Boolean).join(' · '),
        references: [citationFor(article)]
    }));

    const sections = [
        {
            title: 'Today’s evidence map',
            icon: 'radar',
            type: 'key_point',
            layout: 'full_width',
            color_theme: 'blue',
            content: articles.slice(0, 6).map(article => `${classifyTheme(article)} — ${truncate(article.title, 132)}`),
            references: sharedReferences
        },
        {
            title: 'Research themes in today’s feed',
            icon: 'analytics',
            type: 'chart',
            layout: 'full_width',
            color_theme: 'green',
            content: { type: 'bar', data: chartData(articles) },
            references: sharedReferences
        },
        ...paperSections,
        {
            title: 'Before changing clinical practice',
            icon: 'fact_check',
            type: 'process',
            layout: 'full_width',
            color_theme: 'red',
            content: [
                'Confirm the study design, population, comparator and prespecified outcomes.',
                'Separate statistical significance from clinically meaningful effect size.',
                'Check follow-up duration, adverse-event reporting and applicability to your patient.',
                'Use guidelines and local governance before adopting a new intervention.'
            ],
            references: [
                { citation: 'Centre for Evidence-Based Medicine. Critical Appraisal Tools.', url: 'https://www.cebm.ox.ac.uk/resources/ebm-tools/critical-appraisal-tools' },
                ...sharedReferences.slice(0, 1)
            ]
        }
    ];

    const data = {
        title: `Ophthalmology Evidence Radar — ${dateLabel}`,
        summary: `A daily, automatically validated map of ${articles.length} newly indexed ophthalmology research signals. Open every cited source and critically appraise it before applying findings to patient care.`,
        summary_illustration: illustration(dateLabel, articles.length),
        sections,
        chapterId: 'evidence',
        generatedBy: 'daily-evidence-workflow',
        generatedAt: now.toISOString(),
        generationPrompt: 'Automatically assemble a citation-first daily infographic from newly indexed ophthalmology records in Europe PMC. Do not infer treatment recommendations from titles alone.'
    };
    const item = {
        id: `daily_${dayCompact}`,
        title: data.title,
        summary: data.summary,
        date: now.toISOString(),
        chapterId: 'evidence',
        daily: true,
        data
    };
    validateItem(item);

    await writeAtomic(path.join(rootDir, 'daily', 'latest.json'), item);
    await writeAtomic(path.join(rootDir, 'daily', 'archive', `${day}.json`), item);
    await writeLibraryItem(item);
    console.log(`Daily infographic generated and validated: ${item.title}`);
}

main().catch(error => {
    console.error(error.message || error);
    process.exitCode = 1;
});
