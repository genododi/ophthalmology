import { GoogleGenerativeAI } from "@google/generative-ai";

const generateBtn = document.getElementById('generate-btn');
const apiKeyInput = document.getElementById('api-key');
const topicInput = document.getElementById('topic-input');
const outputContainer = document.getElementById('output-container');

// ============================================
// RESOURCE FILE UPLOAD HANDLING (PDF/TXT)
// ============================================

const resourceUpload = document.getElementById('resource-upload');
const uploadTriggerBtn = document.getElementById('upload-trigger-btn');
const uploadedFilesList = document.getElementById('uploaded-files-list');

// Store extracted text from uploaded files
let uploadedResourcesText = [];

/**
 * Extract text from PDF using PDF.js
 */
async function extractPDFText(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = async function (e) {
            try {
                if (typeof pdfjsLib === 'undefined') {
                    reject(new Error('PDF.js library not loaded'));
                    return;
                }

                const typedArray = new Uint8Array(e.target.result);
                const pdf = await pdfjsLib.getDocument(typedArray).promise;
                let fullText = '';

                for (let i = 1; i <= pdf.numPages; i++) {
                    const page = await pdf.getPage(i);
                    const textContent = await page.getTextContent();
                    const pageText = textContent.items.map(item => item.str).join(' ');
                    fullText += pageText + '\n\n';
                }

                resolve(fullText.trim());
            } catch (err) {
                reject(err);
            }
        };
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsArrayBuffer(file);
    });
}

/**
 * Extract text from TXT file
 */
async function extractTXTText(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsText(file);
    });
}

/**
 * Format file size for display
 */
function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

/**
 * Render the uploaded files list
 */
function renderUploadedFiles() {
    if (!uploadedFilesList) return;

    if (uploadedResourcesText.length === 0) {
        uploadedFilesList.innerHTML = '';
        return;
    }

    uploadedFilesList.innerHTML = uploadedResourcesText.map((item, index) => `
        <div class="uploaded-file-item ${item.status}" data-index="${index}">
            <div class="uploaded-file-info">
                <span class="material-symbols-rounded">${item.type === 'pdf' ? 'picture_as_pdf' : 'description'}</span>
                <span class="uploaded-file-name" title="${item.name}">${item.name}</span>
                <span class="uploaded-file-size">(${formatFileSize(item.size)})</span>
            </div>
            ${item.status !== 'processing' ? `
                <button class="remove-file-btn" onclick="removeUploadedFile(${index})" title="Remove file">
                    <span class="material-symbols-rounded">close</span>
                </button>
            ` : ''}
        </div>
    `).join('');
}

/**
 * Remove an uploaded file
 */
window.removeUploadedFile = function (index) {
    uploadedResourcesText.splice(index, 1);
    renderUploadedFiles();
};

/**
 * Handle file upload
 */
async function handleFileUpload(files) {
    for (const file of files) {
        const fileType = file.name.toLowerCase().endsWith('.pdf') ? 'pdf' : 'txt';

        // Add to list with processing status
        const fileEntry = {
            name: file.name,
            size: file.size,
            type: fileType,
            status: 'processing',
            text: ''
        };
        uploadedResourcesText.push(fileEntry);
        renderUploadedFiles();

        try {
            let text;
            if (fileType === 'pdf') {
                text = await extractPDFText(file);
            } else {
                text = await extractTXTText(file);
            }

            fileEntry.text = text;
            fileEntry.status = 'success';
        } catch (err) {
            console.error(`Error extracting text from ${file.name}:`, err);
            fileEntry.status = 'error';
            fileEntry.error = err.message;
        }

        renderUploadedFiles();
    }
}

/**
 * Get combined text from all uploaded resources
 */
function getUploadedResourcesText() {
    return uploadedResourcesText
        .filter(item => item.status === 'success' && item.text)
        .map(item => `[Source: ${item.name}]\n${item.text}`)
        .join('\n\n---\n\n');
}

// Setup file upload event listeners
if (uploadTriggerBtn && resourceUpload) {
    uploadTriggerBtn.addEventListener('click', () => resourceUpload.click());

    resourceUpload.addEventListener('change', (e) => {
        if (e.target.files && e.target.files.length > 0) {
            handleFileUpload(Array.from(e.target.files));
            e.target.value = ''; // Reset input so same file can be re-uploaded
        }
    });
}

// Add Print Button Logic if not present (will be added to HTML separately)
function setupPrintButton() {
    const printBtn = document.getElementById('print-btn');
    if (printBtn) {
        printBtn.addEventListener('click', () => {
            window.print();
        });
    }
}

const downloadBtn = document.getElementById('download-pdf-btn');

// Home Button Logic
const homeBtn = document.getElementById('home-btn');
if (homeBtn) {
    homeBtn.addEventListener('click', () => {
        if (confirm("Return to Home? This will clear current work.")) {
            window.location.reload();
        }
    });
}

// Sidebar Toggle Functionality
const sidebar = document.getElementById('sidebar');
const sidebarToggle = document.getElementById('sidebar-toggle');
const appContainer = document.querySelector('.app-container');

function collapseSidebar() {
    if (sidebar && appContainer) {
        sidebar.classList.add('collapsed');
        appContainer.classList.add('sidebar-collapsed');
    }
}

function expandSidebar() {
    if (sidebar && appContainer) {
        sidebar.classList.remove('collapsed');
        appContainer.classList.remove('sidebar-collapsed');
    }
}

function toggleSidebar() {
    if (sidebar && sidebar.classList.contains('collapsed')) {
        expandSidebar();
    } else {
        collapseSidebar();
    }
}

if (sidebarToggle) {
    sidebarToggle.addEventListener('click', toggleSidebar);
}

function setupPosterButton() {
    const posterBtn = document.getElementById('poster-btn');
    if (posterBtn) {
        posterBtn.addEventListener('click', () => {
            const sheet = document.querySelector('.poster-sheet');
            if (sheet) {
                const isLandscape = sheet.classList.toggle('landscape');
                document.body.classList.toggle('landscape-mode');

                if (isLandscape) {
                    posterBtn.classList.add('active-btn');
                    posterBtn.innerHTML = '<span class="material-symbols-rounded">crop_portrait</span>';
                    posterBtn.title = "Switch to Portrait";
                } else {
                    posterBtn.classList.remove('active-btn');
                    posterBtn.innerHTML = '<span class="material-symbols-rounded">panorama</span>';
                    posterBtn.title = "Switch to Landscape";
                    sheet.style.fontSize = '';
                }
            }
        });
    }

    // Always enable download button if it exists
    if (downloadBtn) {
        downloadBtn.style.display = 'flex';
        downloadBtn.addEventListener('click', () => {
            const sheet = document.querySelector('.poster-sheet');
            if (sheet) exportToPDF(sheet);
            else alert("Please generate an infographic first.");
        });
    }
}

function fitContentToLandscape(sheet) {
    if (!sheet.classList.contains('landscape')) return;

    let fontSize = 16;
    sheet.style.fontSize = `${fontSize}px`;

    const minFontSize = 10;
    const maxIterations = 20;
    let i = 0;

    while (sheet.scrollHeight > sheet.clientHeight && fontSize > minFontSize && i < maxIterations) {
        fontSize -= 0.5;
        sheet.style.fontSize = `${fontSize}px`;
        i++;
    }
}

// TEXT-RENDERED PDF EXPORT (NOT IMAGE-BASED)
async function exportToPDF(element) {
    try {
        if (downloadBtn) {
            downloadBtn.disabled = true;
            downloadBtn.innerHTML = '<span class="material-symbols-rounded margin-right:0;">hourglass_top</span>';
            document.body.style.cursor = 'wait';
        }

        if (!currentInfographicData) {
            alert("No infographic data available for export.");
            if (downloadBtn) {
                downloadBtn.disabled = false;
                downloadBtn.innerHTML = '<span class="material-symbols-rounded">download</span>';
                document.body.style.cursor = 'default';
            }
            return;
        }

        const isLandscape = element.classList.contains('landscape');
        const orientation = isLandscape ? 'landscape' : 'portrait';
        const data = currentInfographicData;

        // Create PDF with text rendering
        const pdf = new jspdf.jsPDF({
            orientation: orientation,
            unit: 'mm',
            format: 'a4'
        });

        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();
        const margin = 18;
        const contentWidth = pageWidth - (margin * 2);
        let yPos = margin;

        // Color definitions
        const colors = {
            primary: [37, 99, 235],      // Blue
            primaryDark: [30, 41, 59],   // Dark blue-gray
            text: [31, 41, 55],          // Dark text
            textSecondary: [75, 85, 99], // Secondary text
            red: [220, 38, 38],
            green: [16, 185, 129],
            yellow: [245, 158, 11],
            purple: [139, 92, 246],
            border: [226, 232, 240]
        };

        // Helper: Add new page if needed
        const checkPageBreak = (neededHeight) => {
            if (yPos + neededHeight > pageHeight - margin) {
                pdf.addPage();
                yPos = margin;
                return true;
            }
            return false;
        };

        // Helper: Draw colored box
        const drawBox = (x, y, w, h, color, filled = true) => {
            if (filled) {
                pdf.setFillColor(...color);
                pdf.rect(x, y, w, h, 'F');
            } else {
                pdf.setDrawColor(...color);
                pdf.rect(x, y, w, h, 'S');
            }
        };

        // Header bar
        drawBox(0, 0, pageWidth, 8, colors.primary);
        yPos = 12;

        // Title
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(24);
        pdf.setTextColor(...colors.primaryDark);
        const titleLines = pdf.splitTextToSize(data.title || 'Infographic', contentWidth);
        pdf.text(titleLines, margin, yPos);
        yPos += titleLines.length * 10 + 5;

        // Summary
        if (data.summary) {
            pdf.setFont('helvetica', 'normal');
            pdf.setFontSize(11);
            pdf.setTextColor(...colors.textSecondary);
            const summaryLines = pdf.splitTextToSize(data.summary, contentWidth);
            pdf.text(summaryLines, margin, yPos);
            yPos += summaryLines.length * 5 + 10;
        }

        // Separator line
        pdf.setDrawColor(...colors.border);
        pdf.setLineWidth(0.5);
        pdf.line(margin, yPos, pageWidth - margin, yPos);
        yPos += 10;

        // Sections
        if (data.sections && Array.isArray(data.sections)) {
            // Helper: Auto-fit text block with font size adjustment
            const autoFitTextBlock = (text, maxWidth, maxFontSize = 10, minFontSize = 7) => {
                const textStr = String(text || '');
                let fontSize = maxFontSize;
                let lines;
                let lineHeight;

                while (fontSize >= minFontSize) {
                    pdf.setFontSize(fontSize);
                    lineHeight = fontSize * 0.45;
                    lines = pdf.splitTextToSize(textStr, maxWidth);

                    // Accept if reasonable line count
                    if (lines.length <= 8) {
                        return { fontSize, lines, lineHeight };
                    }
                    fontSize -= 0.5;
                }

                // Use minimum and accept any line count
                pdf.setFontSize(minFontSize);
                lineHeight = minFontSize * 0.45;
                lines = pdf.splitTextToSize(textStr, maxWidth);
                return { fontSize: minFontSize, lines, lineHeight };
            };

            for (const section of data.sections) {
                // Estimate section height for page break check
                checkPageBreak(30);

                // Section title with color indicator
                const themeColor = colors[section.color_theme] || colors.primary;

                // Color bar for section
                drawBox(margin, yPos - 2, 3, 8, themeColor);

                pdf.setFont('helvetica', 'bold');
                pdf.setFontSize(14);
                pdf.setTextColor(...colors.primaryDark);
                pdf.text(section.title || 'Section', margin + 6, yPos + 4);
                yPos += 12;

                // Section content based on type
                pdf.setFont('helvetica', 'normal');
                pdf.setFontSize(10);
                pdf.setTextColor(...colors.text);

                switch (section.type) {
                    case 'red_flag':
                        const flags = Array.isArray(section.content) ? section.content : [section.content];
                        for (const flag of flags) {
                            // Auto-fit the flag text
                            const fit = autoFitTextBlock(flag, contentWidth - 14, 10, 7);
                            const flagHeight = fit.lines.length * fit.lineHeight + 4;

                            checkPageBreak(flagHeight);

                            // Red warning indicator
                            pdf.setFillColor(...colors.red);
                            pdf.circle(margin + 2, yPos + 2, 1.5, 'F');

                            // Draw all lines
                            pdf.setFontSize(fit.fontSize);
                            pdf.setTextColor(...colors.red);
                            fit.lines.forEach((line, idx) => {
                                pdf.text(line, margin + 8, yPos + idx * fit.lineHeight);
                            });
                            yPos += flagHeight;
                        }
                        pdf.setTextColor(...colors.text);
                        break;

                    case 'chart':
                        const chartData = section.content?.data || [];
                        for (const item of chartData) {
                            // Auto-fit chart label
                            const labelFit = autoFitTextBlock(item.label, contentWidth * 0.68, 9, 7);
                            const labelHeight = labelFit.lines.length * labelFit.lineHeight;

                            checkPageBreak(labelHeight + 8);

                            pdf.setFontSize(labelFit.fontSize);
                            labelFit.lines.forEach((line, idx) => {
                                pdf.text(line, margin, yPos + idx * labelFit.lineHeight);
                            });
                            yPos += labelHeight + 1;

                            // Draw bar background
                            drawBox(margin, yPos, contentWidth * 0.7, 5, [226, 232, 240]);
                            // Draw bar fill
                            const barWidth = (contentWidth * 0.7) * (item.value / 100);
                            drawBox(margin, yPos, barWidth, 5, themeColor);
                            // Value text
                            pdf.setFontSize(8);
                            pdf.text(`${item.value}%`, margin + contentWidth * 0.72, yPos + 4);
                            yPos += 8;
                        }
                        break;

                    case 'remember':
                        const mem = section.content || {};

                        // Auto-fit explanation text
                        const expFit = autoFitTextBlock(mem.explanation || '', contentWidth - 14, 10, 7);
                        const expHeight = expFit.lines.length * expFit.lineHeight;
                        const boxHeight = Math.max(22, 12 + expHeight + 4);

                        checkPageBreak(boxHeight + 5);

                        // Mnemonic box
                        drawBox(margin, yPos, contentWidth, boxHeight, [253, 252, 255]);
                        pdf.setDrawColor(...colors.purple);
                        pdf.rect(margin, yPos, contentWidth, boxHeight, 'S');

                        // Mnemonic title
                        pdf.setFont('helvetica', 'bold');
                        pdf.setFontSize(18);
                        pdf.setTextColor(...colors.purple);
                        pdf.text(mem.mnemonic || 'REMEMBER', margin + contentWidth / 2, yPos + 8, { align: 'center' });

                        // Explanation - all lines
                        pdf.setFont('helvetica', 'normal');
                        pdf.setFontSize(expFit.fontSize);
                        pdf.setTextColor(...colors.text);
                        expFit.lines.forEach((line, idx) => {
                            pdf.text(line, margin + 5, yPos + 14 + idx * expFit.lineHeight);
                        });
                        yPos += boxHeight + 5;
                        break;

                    case 'mindmap':
                        const map = section.content || {};
                        checkPageBreak(25);

                        // Center concept
                        pdf.setFillColor(...colors.primaryDark);
                        const centerText = map.center || 'Concept';
                        pdf.setFontSize(10);
                        const centerWidth = pdf.getTextWidth(centerText) + 10;
                        pdf.roundedRect(margin + (contentWidth - centerWidth) / 2, yPos, centerWidth, 8, 2, 2, 'F');
                        pdf.setTextColor(255, 255, 255);
                        pdf.setFont('helvetica', 'bold');
                        pdf.text(centerText, margin + contentWidth / 2, yPos + 5.5, { align: 'center' });
                        yPos += 12;

                        // Branches - with auto-fit for each
                        pdf.setTextColor(...colors.text);
                        pdf.setFont('helvetica', 'normal');
                        const branches = map.branches || [];
                        const numBranchCols = Math.min(branches.length, 3);
                        const branchWidth = contentWidth / numBranchCols;

                        for (let i = 0; i < branches.length; i++) {
                            if (i > 0 && i % 3 === 0) {
                                yPos += 10;
                            }

                            const colIdx = i % 3;
                            const branchX = margin + colIdx * branchWidth;

                            // Auto-fit branch text
                            const branchFit = autoFitTextBlock(branches[i], branchWidth - 8, 9, 6);
                            const branchHeight = Math.max(8, branchFit.lines.length * branchFit.lineHeight + 4);

                            checkPageBreak(branchHeight);

                            drawBox(branchX, yPos, branchWidth - 3, branchHeight, [248, 250, 252]);
                            pdf.setDrawColor(...colors.border);
                            pdf.rect(branchX, yPos, branchWidth - 3, branchHeight, 'S');

                            pdf.setFontSize(branchFit.fontSize);
                            branchFit.lines.forEach((line, idx) => {
                                pdf.text(line, branchX + 2, yPos + 3 + idx * branchFit.lineHeight);
                            });
                        }
                        yPos += 12;
                        break;

                    case 'key_point':
                    case 'process':
                        const points = Array.isArray(section.content) ? section.content : [section.content];
                        for (let i = 0; i < points.length; i++) {
                            // Auto-fit point text
                            const pointFit = autoFitTextBlock(points[i], contentWidth - 14, 10, 7);
                            const pointHeight = pointFit.lines.length * pointFit.lineHeight + 3;

                            checkPageBreak(pointHeight);

                            // Bullet
                            pdf.setFillColor(...themeColor);
                            pdf.circle(margin + 2, yPos + 2, 1.2, 'F');

                            // All text lines
                            pdf.setFontSize(pointFit.fontSize);
                            pointFit.lines.forEach((line, idx) => {
                                pdf.text(line, margin + 8, yPos + idx * pointFit.lineHeight);
                            });
                            yPos += pointHeight;
                        }
                        break;

                    case 'table':
                        if (section.content?.headers && section.content?.rows) {
                            const headers = section.content.headers;
                            const rows = section.content.rows;
                            const numCols = headers.length;

                            // Calculate column widths - minimum 25mm, evenly distributed
                            const minColWidth = 25;
                            const tableWidth = contentWidth - 4; // 2mm padding on each side
                            const colWidth = Math.max(minColWidth, tableWidth / numCols);
                            const actualTableWidth = Math.min(tableWidth, colWidth * numCols);

                            // Helper: Auto-size text to fit in cell
                            // Returns { fontSize, lines, lineHeight }
                            const autoFitText = (text, maxWidth, maxFontSize = 8, minFontSize = 5) => {
                                const cellText = String(text || '');
                                let fontSize = maxFontSize;
                                let lines;
                                let lineHeight;

                                while (fontSize >= minFontSize) {
                                    pdf.setFontSize(fontSize);
                                    lineHeight = fontSize * 0.4; // ~40% of font size for line height
                                    lines = pdf.splitTextToSize(cellText, maxWidth);

                                    // If text fits in a reasonable number of lines (max 6), accept it
                                    if (lines.length <= 6) {
                                        return { fontSize, lines, lineHeight };
                                    }
                                    fontSize -= 0.5;
                                }

                                // Use minimum font size if still doesn't fit
                                pdf.setFontSize(minFontSize);
                                lineHeight = minFontSize * 0.4;
                                lines = pdf.splitTextToSize(cellText, maxWidth);
                                return { fontSize: minFontSize, lines, lineHeight };
                            };

                            // Calculate header row with auto-fitting
                            let headerHeight = 8;
                            const fittedHeaders = headers.map(h => {
                                const fit = autoFitText(h, colWidth - 4, 8, 6);
                                const cellHeight = fit.lines.length * fit.lineHeight + 4;
                                headerHeight = Math.max(headerHeight, cellHeight);
                                return fit;
                            });

                            checkPageBreak(headerHeight + 10);

                            // Draw header background
                            drawBox(margin, yPos, actualTableWidth, headerHeight, [248, 250, 252]);
                            pdf.setDrawColor(...colors.border);
                            pdf.rect(margin, yPos, actualTableWidth, headerHeight, 'S');

                            // Draw header text with fitted fonts
                            pdf.setFont('helvetica', 'bold');
                            fittedHeaders.forEach((fit, i) => {
                                pdf.setFontSize(fit.fontSize);
                                fit.lines.forEach((line, lineIdx) => {
                                    pdf.text(line, margin + i * colWidth + 2, yPos + 3.5 + lineIdx * fit.lineHeight);
                                });
                                // Draw vertical separator
                                if (i < numCols - 1) {
                                    pdf.line(margin + (i + 1) * colWidth, yPos, margin + (i + 1) * colWidth, yPos + headerHeight);
                                }
                            });
                            yPos += headerHeight;

                            // Data rows with auto-fitting
                            pdf.setFont('helvetica', 'normal');
                            for (const row of rows) {
                                // Auto-fit each cell
                                let rowHeight = 6;
                                const fittedCells = row.map((cell, i) => {
                                    const fit = autoFitText(cell, colWidth - 4, 8, 5);
                                    const cellHeight = fit.lines.length * fit.lineHeight + 3;
                                    rowHeight = Math.max(rowHeight, cellHeight);
                                    return fit;
                                });

                                checkPageBreak(rowHeight);

                                // Draw bottom border
                                pdf.setDrawColor(...colors.border);
                                pdf.line(margin, yPos + rowHeight, margin + actualTableWidth, yPos + rowHeight);

                                // Draw cell content with individual font sizes
                                fittedCells.forEach((fit, i) => {
                                    pdf.setFontSize(fit.fontSize);
                                    fit.lines.forEach((line, lineIdx) => {
                                        pdf.text(line, margin + i * colWidth + 2, yPos + 3 + lineIdx * fit.lineHeight);
                                    });
                                    // Draw vertical separator
                                    if (i < numCols - 1) {
                                        pdf.line(margin + (i + 1) * colWidth, yPos, margin + (i + 1) * colWidth, yPos + rowHeight);
                                    }
                                });

                                yPos += rowHeight;
                            }
                        }
                        yPos += 8;
                        break;

                    default:
                        // Plain text
                        const textContent = String(section.content || '');
                        const textLines = pdf.splitTextToSize(textContent, contentWidth);
                        for (const line of textLines) {
                            checkPageBreak(6);
                            pdf.text(line, margin, yPos);
                            yPos += 5;
                        }
                        break;
                }

                yPos += 8; // Space between sections
            }
        }

        // Save PDF - Content remains visible (no hiding)
        const filename = `${data.title || 'infographic'}-${orientation}.pdf`.replace(/[^a-zA-Z0-9-_.]/g, '_');
        pdf.save(filename);

    } catch (err) {
        console.error("PDF Export failed:", err);
        alert("Failed to export PDF: " + err.message);
    } finally {
        if (downloadBtn) {
            downloadBtn.disabled = false;
            downloadBtn.innerHTML = '<span class="material-symbols-rounded">download</span>';
            document.body.style.cursor = 'default';
        }
    }
}

/* Knowledge Base / Library System with Chapters and Rename */
const LIBRARY_KEY = 'ophthalmic_infographic_library';
const CHAPTERS_KEY = 'ophthalmic_infographic_chapters';

// Default ophthalmic chapters
const DEFAULT_CHAPTERS = [
    { id: 'uncategorized', name: 'Uncategorized', color: '#64748b' },
    { id: 'clinical_skills', name: 'Clinical Skills', color: '#3b82f6' },
    { id: 'investigations', name: 'Investigations & Interpretation', color: '#10b981' },
    { id: 'trauma', name: 'Ocular Trauma', color: '#ef4444' },
    { id: 'lids', name: 'Lids', color: '#f59e0b' },
    { id: 'lacrimal', name: 'Lacrimal', color: '#6366f1' },
    { id: 'conjunctiva', name: 'Conjunctiva', color: '#8b5cf6' },
    { id: 'cornea', name: 'Cornea', color: '#ec4899' },
    { id: 'sclera', name: 'Sclera', color: '#06b6d4' },
    { id: 'lens', name: 'Lens', color: '#14b8a6' },
    { id: 'glaucoma', name: 'Glaucoma', color: '#22c55e' },
    { id: 'uveitis', name: 'Uveitis', color: '#eab308' },
    { id: 'vitreoretinal', name: 'Vitreoretinal', color: '#f97316' },
    { id: 'medical_retina', name: 'Medical Retina', color: '#f43f5e' },
    { id: 'orbit', name: 'Orbit', color: '#a855f7' },
    { id: 'tumours', name: 'Intraocular Tumours', color: '#d946ef' },
    { id: 'neuro', name: 'Neuro-ophthalmology', color: '#0ea5e9' },
    { id: 'strabismus', name: 'Strabismus', color: '#84cc16' },
    { id: 'paediatric', name: 'Paediatric Ophthalmology', color: '#fbbf24' },
    { id: 'refractive', name: 'Refractive Ophthalmology', color: '#f472b6' },
    { id: 'aids', name: 'Aids to Diagnosis', color: '#fb7185' },
    { id: 'vision_context', name: 'Vision in Context', color: '#38bdf8' },
    { id: 'surgery_care', name: 'Surgery: Anaesthetics & Care', color: '#4ade80' },
    { id: 'theatre', name: 'Surgery: Theatre Notes', color: '#2dd4bf' },
    { id: 'lasers', name: 'Lasers', color: '#f87171' },
    { id: 'therapeutics', name: 'Therapeutics', color: '#c084fc' },
    { id: 'evidence', name: 'Evidence-based Ophthalmology', color: '#94a3b8' },
    { id: 'resources', name: 'Resources', color: '#64748b' }
];

/* Safe Fetch Wrapper to handle file:// protocol and GitHub Pages */
const SERVER_URL = 'http://localhost:3000';
const GITHUB_PAGES_HOST = 'genododi.github.io';

function isGitHubPages() {
    return window.location.hostname === GITHUB_PAGES_HOST;
}

async function safeFetch(url, options) {
    if (window.location.protocol === 'file:') {
        // Point to localhost server if running locally
        const fullUrl = url.startsWith('http') ? url : `${SERVER_URL}/${url}`;
        return fetch(fullUrl, options);
    }
    return fetch(url, options);
}

// Fetch library from static JSON file (for GitHub Pages)
async function fetchLibraryFromStatic() {
    try {
        // Try fetching the pre-generated library index
        const response = await fetch('library-index.json');
        if (response.ok) {
            return await response.json();
        }

        // Fallback: try fetching individual files from Library folder listing
        // This won't work on GitHub Pages without a proper index, so return empty
        return [];
    } catch (err) {
        console.log('Could not fetch static library index:', err.message);
        return [];
    }
}

function getChapters() {
    // Strict Mode: Always return DEFAULT_CHAPTERS to prevent duplicates/legacy chapters
    // We ignore localStorage 'ophthalmic_infographic_chapters' to clean up
    return DEFAULT_CHAPTERS;
}

// Helper: Reassign Sequential IDs 
// Newest item = HIGHEST number (library.length), Oldest = 1
// Called after any addition or deletion to ensure no gaps or duplicates
function reassignSequentialIds(library) {
    if (!library || library.length === 0) return false;

    // Sort by date ASCENDING (oldest first gets #1)
    const sortedByDate = [...library].sort((a, b) => new Date(a.date) - new Date(b.date));

    let modified = false;
    const totalCount = library.length;

    // Assign sequential numbers: oldest = 1, newest = totalCount
    sortedByDate.forEach((sortedItem, index) => {
        const newSeqId = index + 1; // oldest gets 1, newest gets totalCount
        // Find the original item in library and update its seqId
        const originalItem = library.find(item => item.id === sortedItem.id);
        if (originalItem && originalItem.seqId !== newSeqId) {
            originalItem.seqId = newSeqId;
            modified = true;
        }
    });

    return modified;
}

// Legacy function - now calls reassignSequentialIds for full reordering
function assignSequentialIds(library) {
    return reassignSequentialIds(library);
}

// Auto-chapterize: Detect chapter from title keywords
// Organized by clinical ophthalmology subspecialties with comprehensive terminology
function autoDetectChapter(title) {
    if (!title) return 'uncategorized';

    const titleLower = title.toLowerCase();

    // CLINICAL OPHTHALMOLOGY AUTO-CATEGORIZATION RULES
    // Order matters: more specific conditions first, then broader categories
    // Based on standard ophthalmology subspecialty organization
    const rules = [
        // ══════════════════════════════════════════════════════════════════
        // NEURO-OPHTHALMOLOGY - Disorders of visual pathway & cranial nerves
        // ══════════════════════════════════════════════════════════════════
        {
            keywords: [
                // Optic nerve conditions
                'optic neuritis', 'optic neuropathy', 'optic atrophy', 'papilledema', 'papilloedema',
                'disc swelling', 'disc edema', 'disc oedema', 'aion', 'naion', 'pion', 'lhon',
                'ischaemic optic', 'ischemic optic', 'optic nerve head', 'optic disc drusen',
                // Cranial nerve palsies
                'third nerve', 'fourth nerve', 'sixth nerve', 'cn iii', 'cn iv', 'cn vi',
                'oculomotor', 'trochlear', 'abducens', 'cranial nerve pals',
                // Pupil disorders
                'anisocoria', 'pupil', 'horner', 'adie', 'argyll robertson', 'rapd', 'apd',
                'relative afferent', 'marcus gunn',
                // Visual pathway
                'chiasm', 'optic tract', 'optic radiation', 'visual cortex', 'hemianop',
                'quadrantanop', 'bitemporal', 'homonymous',
                // Nystagmus & eye movements
                'nystagmus', 'gaze palsy', 'ino', 'internuclear', 'one-and-a-half',
                'supranuclear', 'infranuclear', 'saccad',
                // Intracranial conditions
                'iih', 'pseudotumor', 'benign intracranial', 'idiopathic intracranial',
                'raised icp', 'intracranial pressure', 'pituitary', 'sellar',
                // Neuromuscular
                'myasthenia', 'nmj', 'neuromuscular junction', 'ocular myasthenia',
                // General neuro-ophth
                'neuro-ophth', 'neuroophth', 'visual pathway', 'afferent', 'efferent'
            ], chapter: 'neuro'
        },

        // ══════════════════════════════════════════════════════════════════
        // GLAUCOMA - IOP-related optic neuropathy & angle disorders
        // ══════════════════════════════════════════════════════════════════
        {
            keywords: [
                // Types of glaucoma
                'glaucoma', 'poag', 'pacg', 'primary open angle', 'primary angle closure',
                'normal tension', 'ntg', 'low tension', 'ocular hypertension', 'oht',
                'secondary glaucoma', 'neovascular glaucoma', 'nvg', 'uveitic glaucoma',
                'pigmentary glaucoma', 'pigment dispersion', 'pseudoexfoliation', 'pxf', 'pex',
                'exfoliation syndrome', 'steroid-induced', 'traumatic glaucoma',
                'congenital glaucoma', 'juvenile glaucoma', 'developmental glaucoma',
                'angle recession glaucoma', 'inflammatory glaucoma', 'lens-induced',
                // IOP & anatomy
                'intraocular pressure', 'iop', 'aqueous', 'trabecular meshwork',
                'schlemm', 'angle closure', 'narrow angle', 'plateau iris',
                'pupillary block', 'appositional', 'synechial',
                // Glaucoma surgery
                'trabeculectomy', 'tube shunt', 'ahmed', 'baerveldt', 'molteno',
                'migs', 'istent', 'hydrus', 'xen', 'preserflo', 'goniotomy',
                'trabeculotomy', 'trabectome', 'kahook', 'gonioscopy-assisted',
                'cyclophotocoagulation', 'cyclodiode', 'filtering surgery', 'bleb',
                // Diagnostic
                'rnfl', 'ganglion cell', 'optic disc cupping', 'cup-to-disc', 'c:d ratio',
                'visual field loss', 'arcuate scotoma', 'nasal step'
            ], chapter: 'glaucoma'
        },

        // ══════════════════════════════════════════════════════════════════
        // VITREORETINAL - Surgical retina conditions
        // ══════════════════════════════════════════════════════════════════
        {
            keywords: [
                // Retinal detachment
                'retinal detachment', 'rd', 'rhegmatogenous', 'tractional', 'exudative',
                'macula-off', 'macula-on', 'pvr', 'proliferative vitreoretinopathy',
                // Vitreous conditions
                'vitreous', 'pvd', 'posterior vitreous', 'vitreous hemorrhage', 'vit haem',
                'vitreous opacities', 'floaters', 'asteroid hyalosis', 'synchysis',
                // Macular surgery
                'macular hole', 'epiretinal membrane', 'erm', 'macular pucker',
                'vitreomacular traction', 'vmt', 'lamellar hole',
                // Surgical procedures
                'vitrectomy', 'ppv', 'pars plana', 'scleral buckle', 'pneumatic retinopexy',
                'silicone oil', 'gas tamponade', 'sf6', 'c3f8', 'endolaser', 'cryotherapy',
                'internal limiting membrane', 'ilm peel',
                // Peripheral retina
                'retinal tear', 'retinal break', 'horseshoe tear', 'lattice degeneration',
                'retinoschisis', 'peripheral retinal', 'prophylactic laser'
            ], chapter: 'vitreoretinal'
        },

        // ══════════════════════════════════════════════════════════════════
        // MEDICAL RETINA - Non-surgical retinal conditions
        // ══════════════════════════════════════════════════════════════════
        {
            keywords: [
                // Diabetic eye disease
                'diabetic retinopathy', 'dr', 'npdr', 'pdr', 'proliferative diabetic',
                'non-proliferative', 'diabetic macular', 'dme', 'csme', 'clinically significant',
                'microaneurysm', 'hard exudate', 'cotton wool', 'irma', 'nve', 'nvd',
                // AMD
                'age-related macular', 'amd', 'armd', 'macular degeneration',
                'drusen', 'geographic atrophy', 'wet amd', 'dry amd', 'neovascular amd',
                'cnv', 'choroidal neovascul', 'polypoidal', 'pcv', 'rac', 'rpe detachment',
                // Vascular conditions
                'retinal vein occlusion', 'rvo', 'brvo', 'crvo', 'hemi-rvo',
                'retinal artery occlusion', 'rao', 'brao', 'crao', 'branch retinal',
                'central retinal', 'ocular ischemic', 'venous stasis',
                // Macular conditions
                'macular edema', 'cme', 'cystoid macular', 'irvine-gass',
                'central serous', 'csr', 'csc', 'cscr', 'pachychoroid',
                'myopic maculopathy', 'pathological myopia', 'macular atrophy',
                'epiretinal', 'macular dystrophy', 'vitelliform', 'best disease',
                'stargardt', 'pattern dystrophy',
                // Other medical retina
                'retinitis pigmentosa', 'rp', 'rod-cone', 'cone-rod', 'choroideremia',
                'retinal dystrophy', 'inherited retinal', 'ird',
                'hypertensive retinopathy', 'radiation retinopathy', 'solar retinopathy',
                'chloroquine', 'hydroxychloroquine', 'drug toxicity retina',
                // Anti-VEGF related
                'anti-vegf', 'intravitreal injection', 'aflibercept', 'ranibizumab',
                'bevacizumab', 'faricimab', 'brolucizumab'
            ], chapter: 'medical_retina'
        },

        // ══════════════════════════════════════════════════════════════════
        // CORNEA & EXTERNAL - Corneal conditions & ocular surface
        // ══════════════════════════════════════════════════════════════════
        {
            keywords: [
                // Infections
                'keratitis', 'corneal ulcer', 'microbial keratitis', 'bacterial keratitis',
                'fungal keratitis', 'acanthamoeba', 'herpetic keratitis', 'hsv keratitis',
                'herpes simplex', 'herpes zoster ophthalmicus', 'hzo', 'disciform',
                'dendrit', 'geographic ulcer',
                // Dystrophies
                'corneal dystrophy', 'fuchs', 'endothelial dystrophy', 'fced',
                'keratoconus', 'pellucid', 'ectasia', 'corneal ectasia',
                'lattice dystrophy', 'granular dystrophy', 'macular dystrophy',
                'map-dot-fingerprint', 'ebmd', 'reis-bucklers', 'thiel-behnke',
                'posterior polymorphous', 'congenital hereditary endothelial',
                // Degenerations
                'pterygium', 'pinguecula', 'band keratopathy', 'salzmann',
                'terrien', 'mooren', 'dellen', 'arcus senilis',
                // Dry eye & ocular surface
                'dry eye', 'ded', 'meibomian gland', 'mgd', 'blepharitis',
                'ocular surface disease', 'osd', 'tear film', 'schirmer',
                'tbut', 'tear break-up', 'sjogren', 'sicca', 'gvhd ocular',
                // Surgery
                'corneal transplant', 'keratoplasty', 'pk', 'penetrating keratoplasty',
                'dsaek', 'dsek', 'dmek', 'dalk', 'endothelial keratoplasty',
                'corneal graft', 'graft rejection', 'graft failure',
                'cross-linking', 'cxl', 'collagen cross', 'intacs', 'corneal ring',
                // Other corneal
                'corneal opacity', 'corneal scar', 'corneal edema', 'bullous keratopathy',
                'exposure keratopathy', 'neurotrophic', 'persistent epithelial defect',
                'recurrent erosion', 'epithelial basement membrane'
            ], chapter: 'cornea'
        },

        // ══════════════════════════════════════════════════════════════════
        // LENS & CATARACT
        // ══════════════════════════════════════════════════════════════════
        {
            keywords: [
                // Cataract types
                'cataract', 'nuclear sclerosis', 'cortical cataract', 'posterior subcapsular',
                'psc', 'mature cataract', 'hypermature', 'morgagnian', 'brunescent',
                'white cataract', 'intumescent', 'traumatic cataract', 'congenital cataract',
                'developmental cataract', 'metabolic cataract', 'drug-induced cataract',
                // Surgery
                'phacoemulsification', 'phaco', 'ecce', 'icce', 'sics', 'msics',
                'femtosecond', 'flacs', 'cataract surgery', 'cataract extraction',
                // IOL
                'intraocular lens', 'iol', 'monofocal', 'multifocal', 'toric',
                'edof', 'accommodating iol', 'iol calculation', 'biometry',
                'iol power', 'a-constant', 'srk', 'barrett', 'holladay', 'haigis',
                'piggyback iol', 'sulcus iol', 'secondary iol', 'scleral fixated',
                // Complications
                'posterior capsule opacification', 'pco', 'after-cataract',
                'nd:yag capsulotomy', 'yag capsulotomy', 'pcr', 'posterior capsule rupture',
                'vitreous loss', 'dropped nucleus', 'endophthalmitis', 'tass',
                'cme post cataract', 'iol dislocation', 'iol decentration',
                // Lens conditions
                'lens', 'crystalline lens', 'ectopia lentis', 'lens subluxation',
                'lens dislocation', 'marfan lens', 'homocystinuria', 'weill-marchesani',
                'microspherophakia', 'lenticonus', 'lentiglobus', 'aphakia', 'pseudophakia',
                'zonular weakness', 'zonulopathy'
            ], chapter: 'lens'
        },

        // ══════════════════════════════════════════════════════════════════
        // UVEITIS & OCULAR INFLAMMATION
        // ══════════════════════════════════════════════════════════════════
        {
            keywords: [
                // Anatomical classification
                'uveitis', 'iritis', 'iridocyclitis', 'anterior uveitis', 'aau',
                'intermediate uveitis', 'pars planitis', 'posterior uveitis',
                'panuveitis', 'choroiditis', 'chorioretinitis', 'retinochoroiditis',
                // Specific entities
                'hla-b27', 'ankylosing spondylitis', 'reactive arthritis', 'psoriatic',
                'inflammatory bowel', 'crohn', 'ulcerative colitis',
                'behcet', 'sarcoid', 'sarcoidosis', 'vogt-koyanagi-harada', 'vkh',
                'sympathetic ophthalmia', 'birdshot', 'multifocal choroiditis', 'mcp',
                'serpiginous', 'acute posterior multifocal', 'apmppe', 'mewds',
                'punctate inner choroidopathy', 'pic', 'white dot syndrome',
                // Infectious uveitis
                'toxoplasm', 'toxocara', 'cmv retinitis', 'cytomegalovirus',
                'herpes uveitis', 'arn', 'acute retinal necrosis', 'porn',
                'tuberculosis uveitis', 'tb uveitis', 'ocular tb', 'syphilitic uveitis',
                'endogenous endophthalmitis', 'fungal endophthalmitis',
                // Signs & complications
                'hypopyon', 'keratic precipitate', 'kp', 'mutton fat', 'stellate',
                'synechia', 'posterior synechia', 'peripheral anterior synechia',
                'iris bombe', 'seclusio pupillae', 'cyclitic membrane',
                'band keratopathy uveitis', 'uveitic glaucoma', 'uveitic cataract',
                // Treatment-related
                'immunosuppression', 'steroid-sparing', 'biologic', 'adalimumab', 'infliximab'
            ], chapter: 'uveitis'
        },

        // ══════════════════════════════════════════════════════════════════
        // STRABISMUS & OCULAR MOTILITY
        // ══════════════════════════════════════════════════════════════════
        {
            keywords: [
                // Types of strabismus
                'strabismus', 'squint', 'heterotropia', 'esotropia', 'exotropia',
                'hypertropia', 'hypotropia', 'infantile esotropia', 'accommodative',
                'non-accommodative', 'partially accommodative', 'sensory strabismus',
                'consecutive', 'divergence excess', 'convergence insufficiency',
                'convergence excess', 'divergence insufficiency',
                // Specific patterns
                'a-pattern', 'v-pattern', 'duane syndrome', 'duane retraction',
                'brown syndrome', 'superior oblique palsy', 'inferior oblique overaction',
                'double elevator palsy', 'monocular elevation deficiency',
                'congenital fibrosis', 'cfeom', 'mobius',
                // Motility & binocularity
                'ocular motility', 'eom', 'extraocular muscle', 'eye movement',
                'binocular vision', 'binocular single vision', 'bsv', 'diplopia',
                'suppression', 'anomalous correspondence', 'arc',
                // Amblyopia
                'amblyopia', 'lazy eye', 'anisometropic', 'strabismic amblyopia',
                'deprivation amblyopia', 'occlusion therapy', 'penalization',
                // Assessment & surgery
                'cover test', 'prism cover', 'hirschberg', 'krimsky',
                'hess chart', 'lancaster', 'diplopia chart',
                'strabismus surgery', 'recession', 'resection', 'transposition',
                'adjustable suture', 'botulinum strabismus'
            ], chapter: 'strabismus'
        },

        // ══════════════════════════════════════════════════════════════════
        // PAEDIATRIC OPHTHALMOLOGY
        // ══════════════════════════════════════════════════════════════════
        {
            keywords: [
                // General paediatric
                'paediatric', 'pediatric', 'child', 'children', 'infant', 'neonatal',
                'congenital', 'developmental', 'hereditary eye',
                // ROP
                'retinopathy of prematurity', 'rop', 'zone i', 'zone ii', 'plus disease',
                'threshold rop', 'pre-threshold', 'aggressive rop', 'arop',
                // Congenital conditions
                'congenital cataract', 'congenital glaucoma', 'buphthalmos',
                'persistent fetal vasculature', 'pfv', 'phpv', 'coloboma',
                'aniridia', 'peters anomaly', 'axenfeld-rieger', 'anterior segment dysgenesis',
                // Childhood conditions
                'leukocoria', 'white pupil', 'red reflex', 'bruckner',
                'nasolacrimal duct obstruction', 'nldo', 'dacryocele', 'congenital dacryocystocele',
                'childhood blindness', 'cortical visual impairment', 'cvi',
                // Genetic/metabolic
                'retinoblastoma', 'coats disease', 'norrie', 'familial exudative',
                'fevr', 'incontinentia pigmenti', 'albinism ocular'
            ], chapter: 'paediatric'
        },

        // ══════════════════════════════════════════════════════════════════
        // ORBIT & OCULOPLASTICS - ORBIT
        // ══════════════════════════════════════════════════════════════════
        {
            keywords: [
                // Thyroid eye disease
                'thyroid eye disease', 'ted', 'graves ophthalmopathy', 'graves orbitopathy',
                'dysthyroid', 'thyroid-associated', 'tao', 'exophthalmos', 'proptosis',
                'lid retraction thyroid', 'compressive optic neuropathy', 'con',
                'orbital decompression',
                // Orbital inflammation
                'orbital cellulitis', 'preseptal cellulitis', 'postseptal',
                'orbital abscess', 'subperiosteal abscess', 'cavernous sinus thrombosis',
                'idiopathic orbital inflammation', 'orbital pseudotumor', 'tolosa-hunt',
                'igg4-related', 'dacryoadenitis', 'myositis orbital',
                // Orbital tumors
                'orbital tumor', 'orbital mass', 'lacrimal gland tumor',
                'cavernous hemangioma', 'lymphangioma', 'dermoid', 'orbital dermoid',
                'optic nerve glioma', 'optic nerve meningioma', 'orbital meningioma',
                'rhabdomyosarcoma', 'orbital lymphoma', 'orbital metastasis',
                // Trauma & other
                'orbital fracture', 'blow-out fracture', 'medial wall fracture',
                'floor fracture', 'enophthalmos', 'orbital reconstruction',
                'orbital hemorrhage', 'retrobulbar hemorrhage',
                'orbit', 'orbital anatomy', 'extraocular muscle anatomy'
            ], chapter: 'orbit'
        },

        // ══════════════════════════════════════════════════════════════════
        // OCULOPLASTICS - LIDS
        // ══════════════════════════════════════════════════════════════════
        {
            keywords: [
                // Lid position
                'ptosis', 'blepharoptosis', 'congenital ptosis', 'aponeurotic ptosis',
                'myogenic ptosis', 'neurogenic ptosis', 'mechanical ptosis',
                'ectropion', 'entropion', 'cicatricial ectropion', 'involutional',
                'paralytic ectropion', 'spastic entropion',
                'lid retraction', 'lagophthalmos', 'exposure keratopathy lid',
                // Lid tumors
                'eyelid tumor', 'lid tumor', 'basal cell carcinoma', 'bcc',
                'squamous cell carcinoma eyelid', 'sebaceous carcinoma',
                'meibomian gland carcinoma', 'merkel cell', 'eyelid melanoma',
                'chalazion', 'hordeolum', 'stye', 'lid cyst', 'dermoid cyst lid',
                'papilloma lid', 'xanthelasma', 'syringoma',
                // Inflammation
                'blepharitis', 'anterior blepharitis', 'posterior blepharitis',
                'meibomian gland dysfunction', 'mgd', 'rosacea ocular',
                'demodex', 'preseptal', 'lid margin disease',
                // Structural
                'trichiasis', 'distichiasis', 'madarosis', 'epicanthus',
                'telecanthus', 'blepharophimosis', 'coloboma lid', 'ankyloblepharon',
                'floppy eyelid syndrome', 'dermatochalasis',
                // Surgery
                'blepharoplasty', 'ptosis surgery', 'levator', 'muller muscle',
                'frontalis sling', 'tarsal strip', 'lid reconstruction',
                'mohs', 'hughes flap', 'cutler-beard', 'lid sharing',
                'botulinum toxin lid', 'facial palsy', 'bell palsy eye'
            ], chapter: 'lids'
        },

        // ══════════════════════════════════════════════════════════════════
        // LACRIMAL SYSTEM
        // ══════════════════════════════════════════════════════════════════
        {
            keywords: [
                'lacrimal', 'tear duct', 'nasolacrimal', 'nldo',
                'dacryocystitis', 'dacryocystocele', 'dacryoadenitis',
                'epiphora', 'watery eye', 'tearing', 'lacrimation',
                'punctal stenosis', 'punctum', 'canalicular', 'canaliculitis',
                'dcr', 'dacryocystorhinostomy', 'endonasal dcr', 'external dcr',
                'jones tube', 'lacrimal stent', 'intubation lacrimal',
                'lacrimal gland', 'lacrimal sac', 'lacrimal drainage',
                'dry eye lacrimal', 'tear production', 'reflex tearing'
            ], chapter: 'lacrimal'
        },

        // ══════════════════════════════════════════════════════════════════
        // CONJUNCTIVA
        // ══════════════════════════════════════════════════════════════════
        {
            keywords: [
                'conjunctivitis', 'red eye', 'pink eye', 'viral conjunctivitis',
                'bacterial conjunctivitis', 'allergic conjunctivitis',
                'vernal keratoconjunctivitis', 'vkc', 'atopic keratoconjunctivitis', 'akc',
                'giant papillary', 'gpc', 'seasonal allergic', 'perennial allergic',
                'chlamydial', 'trachoma', 'ophthalmia neonatorum', 'gonococcal',
                'adenoviral', 'epidemic keratoconjunctivitis', 'ekc',
                'subconjunctival hemorrhage', 'chemosis', 'follicles', 'papillae',
                'pinguecula', 'conjunctival degeneration',
                'ocular cicatricial pemphigoid', 'ocp', 'mucous membrane pemphigoid',
                'stevens-johnson syndrome', 'sjs', 'toxic epidermal', 'ten',
                'symblepharon', 'fornix shortening', 'conjunctival scarring',
                'conjunctival tumor', 'ocular surface squamous', 'ossn', 'cin',
                'conjunctival melanoma', 'conjunctival nevus', 'pan'
            ], chapter: 'conjunctiva'
        },

        // ══════════════════════════════════════════════════════════════════
        // SCLERA
        // ══════════════════════════════════════════════════════════════════
        {
            keywords: [
                'scleritis', 'episcleritis', 'anterior scleritis', 'posterior scleritis',
                'nodular scleritis', 'necrotizing scleritis', 'scleromalacia',
                'diffuse scleritis', 'scleral inflammation',
                'blue sclera', 'scleral thinning', 'staphyloma',
                'scleral buckle complication', 'scleral perforation'
            ], chapter: 'sclera'
        },

        // ══════════════════════════════════════════════════════════════════
        // REFRACTIVE SURGERY & ERRORS
        // ══════════════════════════════════════════════════════════════════
        {
            keywords: [
                // Refractive errors
                'refractive error', 'refraction', 'ametropia',
                'myopia', 'short-sighted', 'near-sighted', 'high myopia', 'pathological myopia',
                'hyperopia', 'hypermetropia', 'long-sighted', 'far-sighted',
                'astigmatism', 'regular astigmatism', 'irregular astigmatism',
                'anisometropia', 'aniseikonia', 'presbyopia',
                // Refractive surgery
                'lasik', 'lasek', 'prk', 'photorefractive', 'smile', 'relex',
                'femtosecond laser refractive', 'excimer', 'refractive surgery',
                'enhancement', 'retreatment', 'regression',
                'icl', 'phakic iol', 'implantable collamer', 'artisan', 'artiflex',
                'refractive lens exchange', 'rle', 'clear lens extraction',
                // Complications
                'ectasia post-lasik', 'dry eye post-lasik', 'flap complication',
                'epithelial ingrowth', 'interface inflammation', 'dlk',
                // Assessment
                'wavefront', 'aberrometry', 'topography', 'tomography',
                'keratometry', 'corneal power', 'axial length', 'biometry',
                'spectacle', 'glasses', 'contact lens'
            ], chapter: 'refractive'
        },

        // ══════════════════════════════════════════════════════════════════
        // OCULAR TRAUMA
        // ══════════════════════════════════════════════════════════════════
        {
            keywords: [
                'ocular trauma', 'eye injury', 'eye trauma',
                'open globe', 'ruptured globe', 'penetrating injury', 'perforating injury',
                'closed globe', 'blunt trauma', 'contusion',
                'foreign body', 'iofb', 'intraocular foreign body', 'corneal foreign body',
                'hyphema', 'traumatic hyphema', 'eight ball hyphema',
                'chemical burn', 'chemical injury', 'alkali burn', 'acid burn',
                'thermal burn', 'radiation injury',
                'commotio retinae', 'berlin edema', 'choroidal rupture',
                'traumatic cataract', 'lens dislocation trauma', 'iridodialysis',
                'cyclodialysis', 'angle recession', 'vitreous hemorrhage trauma',
                'traumatic optic neuropathy', 'retinal detachment trauma',
                'siderosis', 'chalcosis', 'sympathetic ophthalmia trauma'
            ], chapter: 'trauma'
        },

        // ══════════════════════════════════════════════════════════════════
        // OCULAR TUMORS
        // ══════════════════════════════════════════════════════════════════
        {
            keywords: [
                // Intraocular tumors
                'uveal melanoma', 'choroidal melanoma', 'iris melanoma', 'ciliary body melanoma',
                'choroidal nevus', 'iris nevus', 'choroidal metastasis', 'ocular metastasis',
                'retinoblastoma', 'choroidal hemangioma', 'retinal hemangioblastoma',
                'intraocular lymphoma', 'vitreoretinal lymphoma',
                'melanocytoma', 'adenoma', 'medulloepithelioma',
                // Treatments
                'plaque brachytherapy', 'proton beam', 'gamma knife', 'stereotactic',
                'transpupillary thermotherapy', 'ttt', 'photodynamic tumor',
                'enucleation', 'evisceration', 'exenteration', 'orbital implant',
                // General
                'ocular tumor', 'intraocular tumor', 'eye cancer', 'ocular oncology'
            ], chapter: 'tumours'
        },

        // ══════════════════════════════════════════════════════════════════
        // OPHTHALMIC SURGERY & ANAESTHESIA
        // ══════════════════════════════════════════════════════════════════
        {
            keywords: [
                // Anaesthesia
                'ophthalmic anaesthesia', 'ocular anesthesia', 'local anaesthetic',
                'topical anaesthesia', 'sub-tenon', 'subtenon', 'peribulbar',
                'retrobulbar', 'block', 'orbital block',
                'general anaesthesia eye', 'sedation eye',
                // Surgical principles
                'surgical technique', 'intraoperative', 'perioperative',
                'post-operative', 'postoperative', 'complication',
                'surgical complication', 'informed consent',
                'ophthalmic instruments', 'microsurgery', 'operating microscope',
                // Specific mentions
                'theatre', 'operating room', 'aseptic technique', 'sterile'
            ], chapter: 'surgery_care'
        },

        // ══════════════════════════════════════════════════════════════════
        // OPHTHALMIC LASERS
        // ══════════════════════════════════════════════════════════════════
        {
            keywords: [
                'laser', 'argon laser', 'yag laser', 'nd:yag',
                'diode laser', 'green laser', 'micropulse',
                'photocoagulation', 'panretinal photocoagulation', 'prp',
                'focal laser', 'grid laser', 'macular laser',
                'laser trabeculoplasty', 'slt', 'alt', 'selective laser',
                'peripheral iridotomy', 'pi', 'laser iridotomy',
                'yag capsulotomy', 'posterior capsulotomy',
                'photodynamic therapy', 'pdt', 'verteporfin',
                'laser retinopexy', 'barrage laser'
            ], chapter: 'lasers'
        },

        // ══════════════════════════════════════════════════════════════════
        // OCULAR PHARMACOLOGY & THERAPEUTICS
        // ══════════════════════════════════════════════════════════════════
        {
            keywords: [
                // Drug delivery
                'eye drop', 'topical', 'intravitreal', 'subconjunctival',
                'intracameral', 'periocular', 'sustained release', 'implant',
                // Anti-infectives
                'antibiotic eye', 'antifungal eye', 'antiviral eye',
                'fluoroquinolone', 'aminoglycoside', 'chloramphenicol',
                'acyclovir', 'ganciclovir', 'valganciclovir',
                // Anti-inflammatories
                'corticosteroid', 'prednisolone', 'dexamethasone',
                'fluorometholone', 'loteprednol', 'difluprednate',
                'nsaid eye', 'ketorolac', 'nepafenac', 'bromfenac',
                // Glaucoma medications
                'prostaglandin analogue', 'latanoprost', 'travoprost', 'bimatoprost',
                'beta-blocker eye', 'timolol', 'betaxolol',
                'alpha-agonist', 'brimonidine', 'apraclonidine',
                'carbonic anhydrase inhibitor', 'dorzolamide', 'brinzolamide',
                'acetazolamide', 'rho kinase', 'netarsudil',
                // Other
                'cycloplegic', 'mydriatic', 'miotic', 'pilocarpine',
                'atropine', 'cyclopentolate', 'tropicamide', 'phenylephrine',
                'artificial tears', 'lubricant', 'preservative-free',
                'anti-vegf', 'vegf inhibitor', 'ranibizumab', 'aflibercept',
                'bevacizumab', 'faricimab', 'ozurdex', 'iluvien',
                'pharmacology', 'drug interaction', 'adverse effect', 'toxicity'
            ], chapter: 'therapeutics'
        },

        // ══════════════════════════════════════════════════════════════════
        // CLINICAL EXAMINATION SKILLS
        // ══════════════════════════════════════════════════════════════════
        {
            keywords: [
                // History & examination
                'history taking', 'clinical examination', 'ocular examination',
                'systematic examination', 'ophthalmic assessment',
                // Visual assessment
                'visual acuity', 'snellen', 'logmar', 'etdrs', 'pinhole',
                'near vision', 'reading addition', 'contrast sensitivity',
                'colour vision', 'ishihara', 'farnsworth',
                // Anterior segment
                'slit lamp', 'biomicroscopy', 'anterior segment examination',
                'external examination', 'lid examination',
                // Posterior segment
                'fundoscopy', 'ophthalmoscopy', 'direct ophthalmoscopy',
                'indirect ophthalmoscopy', 'fundus examination', 'dilated examination',
                '90d', '78d', 'volk lens', 'panfundoscope',
                // IOP
                'tonometry', 'goldmann tonometry', 'applanation', 'icare',
                'tonopen', 'non-contact tonometry',
                // Gonioscopy
                'gonioscopy', 'angle examination', 'shaffer', 'spaeth',
                // Other
                'confrontation field', 'amsler grid', 'red desaturation',
                'swinging flashlight', 'cover test examination'
            ], chapter: 'clinical_skills'
        },

        // ══════════════════════════════════════════════════════════════════
        // OPHTHALMIC INVESTIGATIONS
        // ══════════════════════════════════════════════════════════════════
        {
            keywords: [
                // Imaging
                'oct', 'optical coherence tomography', 'oct-a', 'octa',
                'angiography', 'ffa', 'fluorescein angiography', 'fa',
                'icg', 'indocyanine green', 'fundus autofluorescence', 'faf',
                'fundus photography', 'colour fundus', 'red-free',
                'ultrasound eye', 'b-scan', 'a-scan', 'ubm', 'ultrasound biomicroscopy',
                'ct orbit', 'mri orbit', 'neuroimaging',
                // Corneal assessment
                'topography', 'tomography', 'pentacam', 'orbscan', 'galilei',
                'scheimpflug', 'placido', 'keratometry', 'pachymetry',
                'specular microscopy', 'endothelial cell count',
                // Visual field
                'perimetry', 'visual field', 'humphrey', 'octopus', 'goldmann perimetry',
                'automated perimetry', 'kinetic perimetry', 'esterman',
                // Electrophysiology
                'electrophysiology', 'erg', 'electroretinogram', 'full-field erg',
                'pattern erg', 'multifocal erg', 'vep', 'visual evoked potential',
                'eog', 'electro-oculogram',
                // Biometry
                'biometry', 'iol master', 'lenstar', 'axial length measurement',
                // Other
                'exophthalmometry', 'hertel', 'tear osmolarity', 'meibography'
            ], chapter: 'investigations'
        },

        // ══════════════════════════════════════════════════════════════════
        // EVIDENCE-BASED OPHTHALMOLOGY
        // ══════════════════════════════════════════════════════════════════
        {
            keywords: [
                'clinical trial', 'randomized controlled', 'rct', 'evidence-based',
                'systematic review', 'meta-analysis', 'cochrane',
                'guideline', 'nice guideline', 'aao preferred practice',
                'drcr', 'catt trial', 'comparison trial', 'areds', 'areds2',
                'emgt', 'ohts', 'agis', 'cigts', 'cntgs',
                'etdrs', 'drs', 'ukpds', 'dcct', 'field study',
                'marina', 'anchor', 'view', 'rise', 'ride', 'vivid', 'vista',
                'hawk', 'harrier', 'tenaya', 'lucerne'
            ], chapter: 'evidence'
        },

        // ══════════════════════════════════════════════════════════════════
        // AIDS TO DIAGNOSIS
        // ══════════════════════════════════════════════════════════════════
        {
            keywords: [
                'signs', 'symptoms', 'differential diagnosis', 'grading', 'classification',
                'staging', 'diagnostic criteria', 'clinical pearls', 'mnemonic',
                'syndrome', 'triad', 'pathognomonic', 'epidemiology'
            ], chapter: 'aids'
        },

        // ══════════════════════════════════════════════════════════════════
        // VISION IN CONTEXT
        // ══════════════════════════════════════════════════════════════════
        {
            keywords: [
                'dvla', 'driving', 'visual standards', 'driving vision',
                'cvi', 'certificate of visual impairment', 'registration', 'blind registration',
                'low vision', 'lva', 'visual aid', 'rehabilitation',
                'occupational', 'screening', 'public health',
                'quality of life', 'prom', 'patient reported'
            ], chapter: 'vision_context'
        },
    ];

    // SCORING-BASED MATCHING: Count keyword hits per category
    // Multi-word phrases get higher weight; short terms use word-boundary matching
    const scores = {};
    const shortTermMinLength = 4; // Terms shorter than this need word-boundary matching

    for (const rule of rules) {
        let score = 0;
        for (const keyword of rule.keywords) {
            if (keyword.length < shortTermMinLength) {
                // Short terms (e.g., 'rop', 'amd', 'iop') - use word boundary regex to avoid false matches
                const regex = new RegExp(`\\b${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
                if (regex.test(titleLower)) {
                    score += keyword.includes(' ') ? 3 : 2; // Multi-word phrases score higher
                }
            } else {
                if (titleLower.includes(keyword)) {
                    // Longer keywords are more specific and reliable
                    score += keyword.includes(' ') ? 3 : 1; // Multi-word phrases score higher
                }
            }
        }
        if (score > 0) {
            scores[rule.chapter] = (scores[rule.chapter] || 0) + score;
        }
    }

    // Find the chapter with the highest score
    let bestChapter = 'uncategorized';
    let bestScore = 0;
    for (const [chapter, score] of Object.entries(scores)) {
        if (score > bestScore) {
            bestScore = score;
            bestChapter = chapter;
        }
    }

    return bestChapter;
}

// Auto-Sync to Server Logic
// Track if we've already shown the GitHub Pages message
let _gitHubPagesMessageShown = false;

async function syncLibraryToServer() {
    // Skip sync on GitHub Pages (static hosting, no backend)
    if (isGitHubPages()) {
        // Only log once per session to avoid console spam
        if (!_gitHubPagesMessageShown) {
            console.log("GitHub Pages detected - server sync disabled (expected behavior for static hosting)");
            _gitHubPagesMessageShown = true;
        }
        return;
    }

    if (window.location.protocol === 'file:') {
        // Try to sync anyway via localhost API
    }
    const libraryData = localStorage.getItem(LIBRARY_KEY) || '[]';
    console.log("Syncing library to server...");
    try {
        const response = await safeFetch('api/library/upload', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: libraryData
        });
        if (response.ok) {
            console.log("Library synced to server successfully.");
        } else {
            console.error("Failed to sync library:", response.statusText);
        }
    } catch (err) {
        console.error("Error syncing library:", err);
    }
}

function setupKnowledgeBase() {
    const saveBtn = document.getElementById('save-btn');
    const libraryBtn = document.getElementById('library-btn');
    const libraryBtnEmpty = document.getElementById('library-btn-empty');
    const modal = document.getElementById('library-modal');
    const closeBtn = document.getElementById('close-modal-btn');
    const listContainer = document.getElementById('saved-items-list');
    const importBtn = document.getElementById('import-server-btn');
    const exportBtn = document.getElementById('export-server-btn');
    const emptyMsg = document.getElementById('empty-library-msg');

    let currentChapterFilter = 'all';
    let currentSearchTerm = ''; // NEW: Search state
    let currentSortMode = 'date'; // NEW: Sort state
    let showBookmarkedOnly = false; // NEW: Bookmark filter state
    let currentContentFilter = 'all'; // Content-type filter: tables, causes, etc.
    let selectionMode = false;
    let selectedItems = new Set();

    // Content-type filter definitions
    // Each filter scans section titles and content for matching keywords
    const CONTENT_TYPE_FILTERS = [
        { id: 'all', name: 'All Content', icon: 'apps' },
        {
            id: 'tables', name: 'Tables', icon: 'table_chart',
            keywords: ['table', 'comparison', 'versus', 'vs', 'differential', 'grading', 'staging', 'classification', 'scoring'],
            sectionTypes: ['table']
        },
        {
            id: 'causes', name: 'Causes', icon: 'help_outline',
            keywords: ['cause', 'aetiology', 'etiology', 'pathogenesis', 'pathophysiology', 'mechanism', 'risk factor', 'predisposing', 'associated with', 'due to']
        },
        {
            id: 'clinical', name: 'Clinical Presentations', icon: 'medical_information',
            keywords: ['clinical', 'presentation', 'symptom', 'sign', 'feature', 'manifestation', 'finding', 'examination', 'history', 'complaint', 'onset']
        },
        {
            id: 'complications', name: 'Complications', icon: 'warning',
            keywords: ['complication', 'adverse', 'side effect', 'sequelae', 'prognosis', 'outcome', 'morbidity', 'risk', 'deterioration', 'progression']
        },
        {
            id: 'workup', name: 'Workup', icon: 'assignment',
            keywords: ['workup', 'work-up', 'work up', 'assessment', 'evaluation', 'approach', 'algorithm', 'protocol', 'guideline', 'screening', 'triage']
        },
        {
            id: 'investigations', name: 'Investigations', icon: 'biotech',
            keywords: ['investigation', 'imaging', 'test', 'laboratory', 'lab', 'diagnostic', 'scan', 'oct', 'angiography', 'ultrasound', 'biopsy', 'blood test', 'xray', 'mri', 'ct']
        },
        {
            id: 'treatment', name: 'Treatment', icon: 'medication',
            keywords: ['treatment', 'management', 'therapy', 'drug', 'medication', 'surgical', 'operation', 'procedure', 'intervention', 'dose', 'dosage', 'regimen', 'protocol', 'conservative', 'medical', 'pharmacological', 'anti-vegf', 'laser', 'injection']
        },
    ];

    // Toggle Export Button
    function updateExportButtonVisibility() {
        if (exportBtn) {
            exportBtn.style.display = (selectionMode && selectedItems.size > 0) ? 'block' : 'none';
        }
    }

    // EXPORT TO SERVER (or Community Pool for remote users)
    if (exportBtn) {
        exportBtn.addEventListener('click', async () => {
            // Check removed to allow attempt
            if (selectedItems.size === 0) return;

            const library = JSON.parse(localStorage.getItem(LIBRARY_KEY) || '[]');
            const itemsToExport = library.filter(item => selectedItems.has(item.id));

            // REMOTE USER: Redirect to Community Pool instead of server
            // No limit on number of items - users can submit as many as they want
            if (isGitHubPages()) {
                const itemWord = itemsToExport.length === 1 ? 'infographic' : 'infographics';
                if (!confirm(`You are accessing remotely. ${itemsToExport.length} ${itemWord} will be published to the Community Hub and become available to everyone. Continue?`)) return;

                const originalIcon = exportBtn.innerHTML;
                exportBtn.innerHTML = '<span class="material-symbols-rounded">sync</span>';

                try {
                    // Prompt for username
                    const savedUsername = localStorage.getItem('community_username') || '';
                    const userName = prompt('Enter your name for the submissions:', savedUsername);

                    if (!userName || !userName.trim()) {
                        alert('A name is required for community submissions.');
                        exportBtn.innerHTML = originalIcon;
                        return;
                    }

                    localStorage.setItem('community_username', userName.trim());

                    // PROGRESS BAR OVERLAY
                    const progressOverlay = document.createElement('div');
                    progressOverlay.className = 'progress-overlay';
                    progressOverlay.style.cssText = 'position: fixed; inset: 0; background: rgba(0,0,0,0.85); display: flex; align-items: center; justify-content: center; z-index: 10000; flex-direction: column; color: white; backdrop-filter: blur(5px);';
                    progressOverlay.innerHTML = `
                        <div style="width: 320px; padding: 25px; background: #2c3e50; border-radius: 16px; text-align: center; box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
                            <div class="spinner" style="margin: 0 auto 15px; width: 40px; height: 40px; border: 4px solid rgba(255,255,255,0.1); border-top-color: #2ecc71; border-radius: 50%; animation: spin 1s linear infinite;"></div>
                            <h3 style="margin: 0 0 10px 0; font-size: 1.2rem;">Publishing to Community...</h3>
                            <p style="margin: 0 0 15px 0; font-size: 0.9rem; opacity: 0.8;">Uploading ${itemsToExport.length} infographic${itemsToExport.length === 1 ? '' : 's'}</p>
                            <div style="width: 100%; height: 8px; background: rgba(255,255,255,0.1); border-radius: 4px; overflow: hidden;">
                                <div class="progress-bar-fill" style="width: 5%; height: 100%; background: #2ecc71; transition: width 0.3s ease; border-radius: 4px;"></div>
                            </div>
                        </div>
                        <style>@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }</style>
                    `;
                    document.body.appendChild(progressOverlay);

                    // Simulate progress for user feedback (since it's an atomic batch upload)
                    let progress = 5;
                    const fill = progressOverlay.querySelector('.progress-bar-fill');
                    const progressInterval = setInterval(() => {
                        if (progress < 90) {
                            progress += Math.random() * 5; // Increment
                            if (progress > 90) progress = 90;
                            fill.style.width = `${progress}%`;
                        }
                    }, 100);

                    try {
                        // Submit multiple items at once
                        if (typeof CommunitySubmissions === 'undefined') {
                            throw new Error('Community module not loaded');
                        }
                        // Attach adhered Kanski images to each item before batch submission
                        for (const item of itemsToExport) {
                            if (item.kanskiMeta && item.kanskiMeta.length > 0) {
                                const kanskiImgs = await loadKanskiFromIDB(item.title);
                                if (kanskiImgs && kanskiImgs.length > 0) {
                                    const itemData = item.data || item;
                                    itemData.kanskiImages = kanskiImgs;
                                    console.log(`[ExportSubmit] Attaching ${kanskiImgs.length} Kanski image(s) to "${item.title}"`);
                                }
                            }
                        }

                        const result = await CommunitySubmissions.submitMultiple(itemsToExport, userName.trim());

                        clearInterval(progressInterval);
                        fill.style.width = '100%';

                        // Small delay to let user see 100%
                        await new Promise(r => setTimeout(r, 400));

                        if (result.success) {
                            const msg = `✅ ${result.count} infographic${result.count === 1 ? '' : 's'} published successfully!`;
                            alert(msg + '\n\nThey are now live in the Community Hub.');
                            selectionMode = false;
                            selectedItems.clear();
                            renderLibraryList();
                        } else {
                            alert(`Submission failed: ${result.message}`);
                        }
                    } catch (err) {
                        console.error('Community submission error:', err);
                        alert('Error submitting to the Community Hub: ' + err.message);
                    } finally {
                        if (document.body.contains(progressOverlay)) {
                            document.body.removeChild(progressOverlay);
                        }
                        exportBtn.innerHTML = originalIcon;
                    }
                    return;
                } catch (e) {
                    console.error('Submission wrapper error:', e);
                }
            }

            // LOCAL SERVER: Original behavior
            if (!confirm(`Export ${selectedItems.size} selected items to the server knowledge base?`)) return;

            const originalIcon = exportBtn.innerHTML;
            exportBtn.innerHTML = '<span class="material-symbols-rounded">sync</span>';

            try {
                const response = await safeFetch('api/library/upload', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(itemsToExport)
                });

                if (response.ok) {
                    alert('Export successful!');
                    selectionMode = false;
                    selectedItems.clear();
                    renderLibraryList();
                } else {
                    alert('Failed to export to server.');
                }
            } catch (err) {
                console.error('Export error:', err);
                alert('Error connecting to server.');
            } finally {
                exportBtn.innerHTML = originalIcon;
            }
        });
    }

    // REFACTORED: Unified Sync Function
    async function syncFromServer(silent = false) {
        if (window.location.protocol === 'file:') {
            console.log("Running in file:// mode. Attempting to connect to localhost server...");
        }

        const originalIcon = importBtn ? importBtn.innerHTML : '';
        if (importBtn) importBtn.innerHTML = '<span class="material-symbols-rounded">sync</span>';

        try {
            let serverItems = [];
            let communityApproved = [];

            // GitHub Pages: Use static JSON file instead of API
            if (isGitHubPages()) {
                console.log("Running on GitHub Pages. Fetching from static library index...");
                serverItems = await fetchLibraryFromStatic();
                if (serverItems.length === 0 && !silent) {
                    console.log("No items found in static library index.");
                }

                // Also fetch approved community submissions (the cloud pool)
                try {
                    if (typeof CommunitySubmissions !== 'undefined' && CommunitySubmissions.isConfigured()) {
                        console.log("Fetching approved community submissions...");
                        const communityData = await CommunitySubmissions.getAll();
                        communityApproved = communityData.approved || [];
                        if (communityApproved.length > 0) {
                            console.log(`Found ${communityApproved.length} approved community infographics.`);
                        }

                        // SYNC DELETION LOGIC (Remote Users)
                        if (CommunitySubmissions.getDeletedItems) {
                            const deletedItems = await CommunitySubmissions.getDeletedItems();
                            if (deletedItems && deletedItems.length > 0) {
                                let localLibrary = JSON.parse(localStorage.getItem(LIBRARY_KEY) || '[]');
                                const normalizeTitle = (t) => (t || '').toLowerCase().trim().replace(/[^a-z0-9]/g, '');
                                const originalLength = localLibrary.length;

                                localLibrary = localLibrary.filter(item => {
                                    const normTitle = normalizeTitle(item.title);
                                    if (deletedItems.includes(normTitle)) {
                                        console.log(`[Sync] Removing deleted item: ${item.title}`);
                                        return false;
                                    }
                                    return true;
                                });

                                if (localLibrary.length < originalLength) {
                                    localStorage.setItem(LIBRARY_KEY, JSON.stringify(localLibrary));
                                    if (!silent) alert('Some items were deleted by the admin and have been removed from your library.');
                                }
                            }
                        }
                    }
                } catch (communityErr) {
                    console.log("Could not fetch community submissions:", communityErr.message);
                }
            } else {
                // Local/Server mode: Use API
                const response = await safeFetch('api/library/list');
                if (response.ok) {
                    serverItems = await response.json();
                } else {
                    throw new Error('API response not ok');
                }
            }

            // Merge community approved items into serverItems for unified processing
            // Convert community format to library format
            if (communityApproved.length > 0) {
                console.log(`[Sync] processing ${communityApproved.length} community items`);
                communityApproved.forEach(submission => {
                    if (submission.data) {
                        // PRIORITY: Use submission.chapterId (set by original user), fallback to nested data
                        // This ensures categorization syncs to all users
                        const syncedChapterId = submission.chapterId || submission.data.chapterId || 'uncategorized';

                        const libraryItem = {
                            id: submission.id || Date.now(),
                            title: submission.title || submission.data.title || 'Community Infographic',
                            summary: submission.summary || submission.data.summary || '',
                            date: submission.approvedAt || submission.submittedAt || new Date().toISOString(),
                            data: submission.data,
                            chapterId: syncedChapterId, // Use synced category from original user
                            communitySource: true, // Mark as from community
                            author: submission.userName,
                            citation: submission.userName ? `Author: ${submission.userName}` : 'Community Contributor',
                            serverId: submission.id
                        };

                        // Only auto-categorize if still uncategorized after checking both sources
                        if (libraryItem.chapterId === 'uncategorized') {
                            libraryItem.chapterId = autoDetectChapter(libraryItem.title);
                        }

                        serverItems.push(libraryItem);
                    }
                });
            }

            if (serverItems.length > 0 || isGitHubPages()) {
                let localLibrary = JSON.parse(localStorage.getItem(LIBRARY_KEY) || '[]');
                let addedCount = 0;
                let updatedCount = 0;
                let skippedDuplicates = 0;
                let deletedCount = 0;
                const skippedTitles = [];
                const deletedTitles = [];

                // ADMIN DELETION SYNC: Check for items deleted by admin
                // Remote users will have these items removed from their library
                try {
                    if (typeof CommunitySubmissions !== 'undefined' && CommunitySubmissions.getDeletedItems) {
                        const deletedItems = await CommunitySubmissions.getDeletedItems();
                        if (deletedItems && deletedItems.length > 0) {
                            const normalizeTitle = (t) => (t || '').toLowerCase().trim().replace(/[^a-z0-9]/g, '');
                            const originalLength = localLibrary.length;

                            localLibrary = localLibrary.filter(item => {
                                const normTitle = normalizeTitle(item.title);
                                if (deletedItems.includes(normTitle)) {
                                    deletedTitles.push(item.title?.substring(0, 30) || 'Unknown');
                                    return false; // Remove this item
                                }
                                return true; // Keep this item
                            });

                            deletedCount = originalLength - localLibrary.length;
                            if (deletedCount > 0) {
                                console.log(`[Sync] Removed ${deletedCount} item(s) deleted by admin.`);
                                localStorage.setItem(LIBRARY_KEY, JSON.stringify(localLibrary));
                            }
                        }
                    }
                } catch (err) {
                    console.log('Could not check for admin deletions:', err.message);
                }

                // Create a map of local items for faster lookup (by ID)
                const localMap = new Map();
                localLibrary.forEach(item => {
                    // Use ID if available, otherwise fallback to title+date as key (legacy support)
                    const key = item.id || (item.title + item.date);
                    localMap.set(String(key), item);
                });

                // DUPLICATE PREVENTION: Build a normalized title index for ALL local items
                // This prevents importing ANY item with a duplicate title
                const normalizeTitle = (t) => (t || '').toLowerCase().trim().replace(/[^a-z0-9]/g, '');
                const localTitleIndex = new Set();
                localLibrary.forEach(item => {
                    const normTitle = normalizeTitle(item.title);
                    if (normTitle.length > 0) {
                        localTitleIndex.add(normTitle);
                    }
                });

                // Get user's sync preference: 'local' (default) or 'server'
                const syncPreference = typeof getSyncPreference === 'function' ? getSyncPreference() : 'local';
                console.log(`[Sync] Using preference: ${syncPreference === 'local' ? 'Local First' : 'Server First'}`);

                // Track what changed for detailed logging
                const updateDetails = [];

                // Helper function to normalize strings for comparison
                // Aggressive normalization to prevent false positives
                const normalizeStr = (str) => {
                    if (!str) return '';
                    return String(str)
                        .trim()
                        .normalize('NFC')
                        .replace(/\s+/g, ' ')  // Collapse multiple spaces
                        .replace(/[\u200B-\u200D\uFEFF]/g, ''); // Remove zero-width chars
                };

                serverItems.forEach(serverItem => {
                    const serverKey = String(serverItem.id || (serverItem.title + serverItem.date));

                    if (localMap.has(serverKey)) {
                        // Item exists locally. Check if we need to update.
                        // We assume Server is the "Truth" for synchronization when fetching.
                        const localItem = localMap.get(serverKey);

                        // Check for REAL differences that matter
                        const changes = [];

                        // CHAPTER SYNC: Server is source of truth for chapters
                        // BUT: We never revert a categorized item to 'uncategorized'
                        const localChapter = normalizeStr(localItem.chapterId) || 'uncategorized';
                        let serverChapter = normalizeStr(serverItem.chapterId) || 'uncategorized';

                        // If server is uncategorized but local ALREADY has a category, preserve the local one
                        if (serverChapter === 'uncategorized' && localChapter !== 'uncategorized') {
                            serverChapter = localChapter;
                            serverItem.chapterId = localItem.chapterId;
                        } else if (serverChapter === 'uncategorized' && localChapter === 'uncategorized') {
                            // Both are uncategorized, try auto-detecting from title
                            const autoChapter = autoDetectChapter(serverItem.title || localItem.title);
                            if (autoChapter !== 'uncategorized') {
                                serverChapter = autoChapter;
                                serverItem.chapterId = autoChapter;
                            }
                        }

                        if (localChapter !== serverChapter) {
                            const chapters = getChapters();
                            const oldChapterName = chapters.find(c => c.id === localChapter)?.name || localChapter;
                            const newChapterName = chapters.find(c => c.id === serverChapter)?.name || serverChapter;
                            changes.push(`chapter: ${oldChapterName} → ${newChapterName}`);
                            localItem.chapterId = serverItem.chapterId;
                            // Mark as recently updated for visual feedback
                            localItem._chapterUpdated = Date.now();
                        }

                        // SYNC PREFERENCE HANDLING:
                        // 'local' (default): Keep local data, only sync metadata
                        // 'server': Overwrite local with server data
                        if (syncPreference === 'server') {
                            // SERVER FIRST: Always accept server's version
                            if (localItem.title !== serverItem.title) {
                                changes.push(`title updated`);
                                localItem.title = serverItem.title;
                            }
                            if (localItem.summary !== serverItem.summary) {
                                localItem.summary = serverItem.summary;
                            }
                            // Overwrite local data with server data
                            localItem.data = serverItem.data;
                            localItem._serverSynced = true;
                        } else {
                            // LOCAL FIRST: Only update if first sync or if local has no data
                            if (!localItem._serverSynced) {
                                // First time syncing this item - accept server values
                                if (localItem.title !== serverItem.title) {
                                    localItem.title = serverItem.title;
                                }
                                if (localItem.summary !== serverItem.summary) {
                                    localItem.summary = serverItem.summary;
                                }
                                localItem.data = serverItem.data;
                                localItem._serverSynced = true;
                            }
                            // If already synced, keep local version (Local First behavior)
                        }

                        // Preserve local seqId if it exists, otherwise use server's or generate new
                        if (!localItem.seqId && serverItem.seqId) localItem.seqId = serverItem.seqId;

                        if (changes.length > 0) {
                            updatedCount++;
                            updateDetails.push({ title: serverItem.title?.substring(0, 30), changes });
                        }
                    } else {
                        // New Item from Server - CHECK FOR DUPLICATES FIRST
                        // Use pre-built title index for fast duplicate detection
                        const serverTitleNorm = normalizeTitle(serverItem.title);

                        // Check if this title already exists in local library
                        const isDuplicate = serverTitleNorm.length > 0 && localTitleIndex.has(serverTitleNorm);

                        if (isDuplicate) {
                            // Skip this item - it's a duplicate
                            skippedDuplicates++;
                            skippedTitles.push(serverItem.title?.substring(0, 30) || 'Untitled');
                            console.log(`[Sync] Skipping duplicate: "${serverItem.title}"`);
                        } else {
                            // Not a duplicate - safe to add
                            // CRITICAL: Strip the server's seqId so we assign a new LOCAL one
                            const newItem = { ...serverItem };
                            delete newItem.seqId;

                            // PRESERVE CHAPTER: Keep the original category as submitted
                            // Priority: communitySource chapterId > data.chapterId > auto-detect
                            if (!newItem.chapterId || newItem.chapterId === 'uncategorized') {
                                if (newItem.data && newItem.data.chapterId && newItem.data.chapterId !== 'uncategorized') {
                                    newItem.chapterId = newItem.data.chapterId;
                                } else {
                                    const autoChapter = autoDetectChapter(newItem.title);
                                    newItem.chapterId = autoChapter;
                                }
                            }
                            // Sync tag: ensure data.chapterId matches the item chapterId
                            if (newItem.data && newItem.chapterId !== 'uncategorized') {
                                newItem.data.chapterId = newItem.chapterId;
                            }

                            // Mark as newly imported for green hashtag display
                            newItem._newlyImported = Date.now();

                            localLibrary.push(newItem);
                            addedCount++;

                            // Add to title index to prevent duplicates within same sync batch
                            if (serverTitleNorm.length > 0) {
                                localTitleIndex.add(serverTitleNorm);
                            }
                        }
                    }
                });

                if (addedCount > 0 || updatedCount > 0 || assignSequentialIds(localLibrary)) {
                    // Sort by date desc
                    localLibrary.sort((a, b) => new Date(b.date) - new Date(a.date));
                    localStorage.setItem(LIBRARY_KEY, JSON.stringify(localLibrary));
                    renderLibraryList();
                    if (!silent) {
                        const msg = [];
                        if (addedCount) msg.push(`${addedCount} new`);
                        if (updatedCount) msg.push(`${updatedCount} updated`);
                        if (deletedCount) msg.push(`${deletedCount} removed (admin deleted)`);
                        if (skippedDuplicates) msg.push(`${skippedDuplicates} skipped (duplicates)`);

                        // Build detailed message showing what was updated
                        let detailMsg = `Sync Complete: ${msg.join(', ')}.`;

                        if (updateDetails.length > 0) {
                            detailMsg += '\n\nUpdated items:';
                            updateDetails.slice(0, 10).forEach(item => {
                                detailMsg += `\n• ${item.title}... (${item.changes.join(', ')})`;
                            });
                            if (updateDetails.length > 10) {
                                detailMsg += `\n...and ${updateDetails.length - 10} more`;
                            }
                        }

                        if (deletedTitles.length > 0) {
                            detailMsg += '\n\nRemoved by admin:';
                            deletedTitles.slice(0, 5).forEach(title => {
                                detailMsg += `\n• ${title}...`;
                            });
                            if (deletedTitles.length > 5) {
                                detailMsg += `\n...and ${deletedTitles.length - 5} more`;
                            }
                        }

                        if (skippedTitles.length > 0) {
                            detailMsg += '\n\nSkipped duplicates:';
                            skippedTitles.slice(0, 5).forEach(title => {
                                detailMsg += `\n• ${title}...`;
                            });
                            if (skippedTitles.length > 5) {
                                detailMsg += `\n...and ${skippedTitles.length - 5} more`;
                            }
                        }

                        alert(detailMsg);
                    }

                    // Detailed logging for debugging
                    console.log(`Auto-Sync: Imported ${addedCount}, Updated ${updatedCount}, Skipped ${skippedDuplicates} duplicates.`);
                    if (updateDetails.length > 0) {
                        console.log('Updated items:');
                        updateDetails.forEach(item => {
                            console.log(`  • "${item.title}..." - ${item.changes.join(', ')}`);
                        });
                    }
                    if (skippedTitles.length > 0) {
                        console.log('Skipped duplicates:');
                        skippedTitles.forEach(title => {
                            console.log(`  • "${title}..." (already in library)`);
                        });
                    }
                } else if (skippedDuplicates > 0) {
                    // Only duplicates were found, nothing new to add
                    if (!silent) {
                        let msg = `Sync Complete: ${skippedDuplicates} item(s) skipped (already in library).`;
                        if (skippedTitles.length > 0) {
                            msg += '\n\nSkipped duplicates:';
                            skippedTitles.slice(0, 5).forEach(title => {
                                msg += `\n• ${title}...`;
                            });
                            if (skippedTitles.length > 5) {
                                msg += `\n...and ${skippedTitles.length - 5} more`;
                            }
                        }
                        alert(msg);
                    }
                    console.log(`Auto-Sync: Skipped ${skippedDuplicates} duplicates (already in library).`);
                } else {
                    if (!silent) alert('Library is up to date.');
                    console.log("Auto-Sync: Library is up to date (no changes needed).");
                }

                // BIDIRECTIONAL SYNC: Upload local-only items to server
                // Also upload items that are newer locally? 
                // For now, let's just upload items that don't exist on server.
                // Re-read server items to be sure (or just use the list we got)
                const serverIdMap = new Set(serverItems.map(i => String(i.id || (i.title + i.date))));

                const localOnlyItems = localLibrary.filter(localItem =>
                    !serverIdMap.has(String(localItem.id || (localItem.title + localItem.date)))
                );

                // Also identify items that exist but might be newer locally? 
                // That requires "Last Modified" timestamp which we don't have reliably yet.
                // So we only push NEW items. Updates MUST be triggered manually by "Save" or "Rename" pushing.

                // BIDIRECTIONAL SYNC: Only for non-GitHub Pages (requires backend)
                if (!isGitHubPages() && localOnlyItems.length > 0) {
                    try {
                        await safeFetch('api/library/upload', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(localOnlyItems)
                        });
                        console.log(`Bidirectional Sync: Uploaded ${localOnlyItems.length} local-only items to server.`);
                    } catch (uploadErr) {
                        console.log('Bidirectional Sync: Could not upload local items:', uploadErr.message);
                    }
                }
            }
        } catch (err) {
            if (!silent) {
                console.error('Import error:', err);
                if (!isGitHubPages()) {
                    alert('Error connecting to server.');
                }
            } else {
                console.log("Auto-Sync: Could not connect to server (backend likely offline or running on static hosting).");
            }
        } finally {
            if (importBtn) importBtn.innerHTML = originalIcon;
        }
    }

    // Sync Button Logic
    const syncBtn = document.getElementById('sync-btn');

    // SILENT DUPLICATE CLEANUP ON STARTUP
    // This removes any existing duplicates from localStorage without showing alerts
    (function silentDuplicateCleanup() {
        try {
            const library = JSON.parse(localStorage.getItem(LIBRARY_KEY) || '[]');
            if (library.length === 0) return;

            const normalizeTitle = (t) => (t || '').toLowerCase().trim().replace(/[^a-z0-9]/g, '');
            const seenTitles = new Map(); // normalized title -> index of first occurrence
            const indicesToRemove = new Set();

            // Find duplicates (keep the OLDER one based on date)
            library.forEach((item, index) => {
                const normTitle = normalizeTitle(item.title);
                if (normTitle.length === 0) return;

                if (seenTitles.has(normTitle)) {
                    // Duplicate found - compare dates to keep the older one
                    const existingIndex = seenTitles.get(normTitle);
                    const existingDate = new Date(library[existingIndex].date);
                    const currentDate = new Date(item.date);

                    if (currentDate < existingDate) {
                        // Current is older, we are keeping 'item' (index) and removing library[existingIndex]
                        // Transfer category if keeping uncategorized but removing categorized
                        if ((!library[index].chapterId || library[index].chapterId === 'uncategorized') &&
                            (library[existingIndex].chapterId && library[existingIndex].chapterId !== 'uncategorized')) {
                            library[index].chapterId = library[existingIndex].chapterId;
                        }
                        indicesToRemove.add(existingIndex);
                        seenTitles.set(normTitle, index);
                    } else {
                        // Existing is older, we are keeping library[existingIndex] and removing 'item' (index)
                        // Transfer category if keeping uncategorized but removing categorized
                        if ((!library[existingIndex].chapterId || library[existingIndex].chapterId === 'uncategorized') &&
                            (item.chapterId && item.chapterId !== 'uncategorized')) {
                            library[existingIndex].chapterId = item.chapterId;
                        }
                        indicesToRemove.add(index);
                    }
                } else {
                    seenTitles.set(normTitle, index);
                }
            });

            if (indicesToRemove.size > 0) {
                // Remove duplicates
                const cleanedLibrary = library.filter((_, index) => !indicesToRemove.has(index));

                // Reassign sequential IDs
                reassignSequentialIds(cleanedLibrary);

                localStorage.setItem(LIBRARY_KEY, JSON.stringify(cleanedLibrary));
                console.log(`[Startup] Silently removed ${indicesToRemove.size} duplicate(s) from library.`);
            }
        } catch (err) {
            console.error('[Startup] Duplicate cleanup error:', err);
        }
    })();

    // AUTO-SYNC ON STARTUP
    setTimeout(() => {
        syncFromServer(true); // Run silently
    }, 1000); // Small delay to ensure UI is ready

    // Sync Button Click Listener
    if (syncBtn) {
        syncBtn.addEventListener('click', () => {
            syncBtn.classList.add('rotating');
            syncFromServer(false).finally(() => {
                syncBtn.classList.remove('rotating');
            });
        });
    }

    // IMPORT BUTTON HANDLER
    if (importBtn) {
        importBtn.addEventListener('click', async () => {
            if (!confirm('Import saved infographics from the server? This will add any missing items.')) return;
            await syncFromServer(false);
        });
    }

    // FIND DUPLICATES
    const findDuplicatesBtn = document.getElementById('find-duplicates-btn');
    if (findDuplicatesBtn) {
        findDuplicatesBtn.addEventListener('click', () => {
            const library = JSON.parse(localStorage.getItem(LIBRARY_KEY) || '[]');

            if (library.length === 0) {
                alert('Library is empty. No duplicates to find.');
                return;
            }

            // Normalize title for comparison
            const normalizeTitle = (title) => {
                if (!title) return '';
                return String(title).trim().toLowerCase().normalize('NFC');
            };

            // Find duplicates by title
            const titleMap = new Map();
            const duplicates = [];

            library.forEach((item, index) => {
                const normalizedTitle = normalizeTitle(item.title);

                if (titleMap.has(normalizedTitle)) {
                    // Found a duplicate
                    const originalIndex = titleMap.get(normalizedTitle);
                    duplicates.push({
                        title: item.title,
                        duplicateId: item.id,
                        duplicateIndex: index,
                        originalId: library[originalIndex].id,
                        originalIndex: originalIndex,
                        duplicateDate: item.date,
                        originalDate: library[originalIndex].date
                    });
                } else {
                    titleMap.set(normalizedTitle, index);
                }
            });

            if (duplicates.length === 0) {
                alert('✅ No duplicates found! Your library is clean.');
                return;
            }

            // Build message showing duplicates
            let msg = `Found ${duplicates.length} duplicate(s):\n\n`;
            duplicates.forEach((dup, i) => {
                const dupDate = new Date(dup.duplicateDate).toLocaleDateString();
                const origDate = new Date(dup.originalDate).toLocaleDateString();
                msg += `${i + 1}. "${dup.title}"\n   - Original: ${origDate}\n   - Duplicate: ${dupDate}\n\n`;
            });
            msg += `\nDelete all ${duplicates.length} duplicate(s)? (Keeps the older/original version)`;

            if (confirm(msg)) {


                // Get IDs to delete (the newer duplicates)
                const idsToDelete = new Set(duplicates.map(d => d.duplicateId));

                // Transfer categories before deleting
                duplicates.forEach(dup => {
                    const originalItem = library[dup.originalIndex];
                    const duplicateItem = library[dup.duplicateIndex];

                    // If original is uncategorized but duplicate is categorized, transfer the category
                    if ((!originalItem.chapterId || originalItem.chapterId === 'uncategorized') &&
                        (duplicateItem.chapterId && duplicateItem.chapterId !== 'uncategorized')) {
                        originalItem.chapterId = duplicateItem.chapterId;
                    }
                });

                // Filter out duplicates
                const cleanedLibrary = library.filter(item => !idsToDelete.has(item.id));

                // Reassign sequential IDs
                reassignSequentialIds(cleanedLibrary);

                // Save
                localStorage.setItem(LIBRARY_KEY, JSON.stringify(cleanedLibrary));

                alert(`✅ Deleted ${duplicates.length} duplicate(s). Library now has ${cleanedLibrary.length} items.`);

                // Refresh the library view
                renderLibraryList();

                // Sync to server
                syncLibraryToServer();
            }
        });
    }

    // AUTO-CHAPTERIZE
    const autoChapterBtn = document.getElementById('auto-chapter-btn');
    if (autoChapterBtn) {
        autoChapterBtn.addEventListener('click', () => {


            const library = JSON.parse(localStorage.getItem(LIBRARY_KEY) || '[]');

            if (library.length === 0) {
                alert('Library is empty. Nothing to chapterize.');
                return;
            }

            let changedCount = 0;
            const changes = [];

            library.forEach(item => {
                // Only auto-chapterize if currently uncategorized
                if (item.chapterId === 'uncategorized' || !item.chapterId) {
                    const detectedChapter = autoDetectChapter(item.title);
                    if (detectedChapter !== 'uncategorized') {
                        const oldChapter = item.chapterId || 'uncategorized';
                        item.chapterId = detectedChapter;
                        changedCount++;

                        // Get chapter name for display
                        const chapterObj = DEFAULT_CHAPTERS.find(c => c.id === detectedChapter);
                        changes.push({
                            title: item.title.substring(0, 40),
                            chapter: chapterObj ? chapterObj.name : detectedChapter
                        });
                    }
                }
            });

            if (changedCount === 0) {
                alert('✅ All items are already categorized or no matches found.');
                return;
            }

            // Build summary message
            let msg = `Auto-chapterized ${changedCount} item(s):\n\n`;
            changes.slice(0, 15).forEach((c, i) => {
                msg += `${i + 1}. "${c.title}..." → ${c.chapter}\n`;
            });
            if (changes.length > 15) {
                msg += `\n...and ${changes.length - 15} more`;
            }
            msg += '\n\nApply these changes?';

            if (confirm(msg)) {
                localStorage.setItem(LIBRARY_KEY, JSON.stringify(library));
                alert(`✅ ${changedCount} item(s) auto-chapterized!`);
                renderLibraryList();
                syncLibraryToServer();
            }
        });
    }

    // SAVE
    if (saveBtn) {
        saveBtn.addEventListener('click', async () => {
            if (!currentInfographicData) {
                alert("Only generated infographics can be saved.");
                return;
            }

            const library = JSON.parse(localStorage.getItem(LIBRARY_KEY) || '[]');

            // Auto-detect chapter from title
            const itemTitle = currentInfographicData.title || "Untitled Infographic";
            const autoChapter = autoDetectChapter(itemTitle);

            // Sync chapterId into the infographic data so the tag renders correctly
            if (autoChapter !== 'uncategorized') {
                currentInfographicData.chapterId = autoChapter;
            }

            const newItem = {
                id: Date.now(),
                seqId: 1, // Will be reassigned below
                title: itemTitle,
                summary: currentInfographicData.summary || "",
                date: new Date().toISOString(),
                data: currentInfographicData,
                chapterId: autoChapter // Auto-assigned based on title keywords
            };

            library.unshift(newItem);

            // Reassign all sequential IDs (oldest = 1, newest = highest)
            reassignSequentialIds(library);

            localStorage.setItem(LIBRARY_KEY, JSON.stringify(library));

            if (isGitHubPages()) {
                const wantsShare = confirm('Share this infographic to the Community Hub now? It will be published instantly for all visitors.');
                if (wantsShare) {
                    if (!window.CommunitySubmissions) {
                        alert('Community module not loaded. Please refresh the page and try again.');
                    } else {
                        const savedUsername = localStorage.getItem('community_username') || '';
                        const userName = prompt('Enter your name for the Community Hub (this will be public):', savedUsername);

                        if (!userName || !userName.trim()) {
                            alert('A name is required to publish to the Community Hub.');
                        } else {
                            localStorage.setItem('community_username', userName.trim());
                            try {
                                const result = await CommunitySubmissions.submit(newItem.data, userName.trim());
                                if (result.success) {
                                    alert(result.message || '✅ Published to the Community Hub!');

                                    // IMMEDIATE RECOGNITION: Update local item to reflect community status
                                    const library = JSON.parse(localStorage.getItem(LIBRARY_KEY) || '[]');
                                    // Find the item we just added (it's at the top, index 0)
                                    if (library.length > 0) {
                                        library[0].communitySource = true;
                                        library[0].author = userName.trim();
                                        library[0].citation = `Author: ${userName.trim()}`;
                                        library[0]._serverSynced = true; // Mark as synced since it's in the cloud
                                        localStorage.setItem(LIBRARY_KEY, JSON.stringify(library));
                                        renderLibraryList(); // Refresh UI to show the "Author" tag
                                    }
                                } else {
                                    alert(`Publish failed: ${result.message || 'Unknown error.'}`);
                                }
                            } catch (err) {
                                console.error('Community publish error:', err);
                                alert('Error publishing to the Community Hub: ' + err.message);
                            }
                        }
                    }
                }
            } else {
                // Auto-upload to server so it saves to the library/ folder
                safeFetch('api/library/upload', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify([newItem])
                }).then(() => {
                    console.log('Saved to server library folder.');
                }).catch(err => {
                    console.log('Server sync skipped (server offline):', err.message);
                });
            }

            const originalIcon = saveBtn.innerHTML;
            saveBtn.innerHTML = '<span class="material-symbols-rounded">check</span>';
            setTimeout(() => {
                saveBtn.innerHTML = originalIcon;
            }, 2000);
        });
    }

    // OPEN LIBRARY
    const openLibrary = () => {
        // Guest Access Fix: Auto-sync if library is empty
        const library = JSON.parse(localStorage.getItem(LIBRARY_KEY) || '[]');
        if (library.length === 0) {
            console.log("Library empty. Triggering auto-sync for guest access...");
            syncFromServer(true); // Silent sync
        }

        renderLibraryList();
        modal.classList.add('active');
    };

    if (libraryBtn) {
        libraryBtn.addEventListener('click', openLibrary);
    }

    if (libraryBtnEmpty) {
        libraryBtnEmpty.addEventListener('click', openLibrary);
    }

    // Sidebar library button (below text entry)
    const sidebarLibraryBtn = document.getElementById('sidebar-library-btn');
    if (sidebarLibraryBtn) {
        sidebarLibraryBtn.addEventListener('click', openLibrary);
    }

    // CLOSE LIBRARY
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            modal.classList.remove('active');
            selectionMode = false;
            selectedItems.clear();
        });
    }

    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.remove('active');
                selectionMode = false;
                selectedItems.clear();
            }
        });
    }

    // ═══════════════════════════════════════════════════════════════
    // CONTENT FILTER MODAL — displays matching section text like red flags
    // ═══════════════════════════════════════════════════════════════
    function openContentFilterModal(filterType, library) {
        const filterDef = CONTENT_TYPE_FILTERS.find(f => f.id === filterType);
        if (!filterDef || !filterDef.keywords) return;

        // Helper: safely extract text from section content
        // Handles ALL section types: key_point, process, red_flag, mindmap,
        // remember, chart, table, and unknown structures via deep extraction.
        function extractSectionText(section) {
            if (!section || section.content === undefined || section.content === null) return [];
            const lines = [];
            try {
                const content = section.content;

                // 1) Plain string content (default section type)
                if (typeof content === 'string') {
                    if (content.trim()) lines.push(content);
                }
                // 2) Array content (key_point, process, red_flag, etc.)
                else if (Array.isArray(content)) {
                    content.forEach(c => {
                        if (typeof c === 'string') {
                            if (c.trim()) lines.push(c);
                        } else if (c && typeof c === 'object') {
                            // Objects with label/value (chart data items, etc.)
                            if (c.label) lines.push(`${c.label}${c.value !== undefined ? ': ' + c.value : ''}`);
                            else if (c.text) lines.push(c.text);
                            else if (c.name) lines.push(c.name);
                            else if (c.title) lines.push(c.title);
                            else {
                                // Generic object: collect all string values
                                const vals = Object.values(c).filter(v => typeof v === 'string' && v.trim());
                                if (vals.length > 0) lines.push(vals.join(' — '));
                            }
                        }
                    });
                }
                // 3) Object content (chart, remember, mindmap, table, etc.)
                else if (typeof content === 'object') {
                    // Mindmap: center + branches
                    if (content.center) lines.push(content.center);
                    if (content.branches && Array.isArray(content.branches)) {
                        content.branches.forEach(b => {
                            if (typeof b === 'string') lines.push(b);
                            else if (b && b.label) lines.push(b.label);
                            else if (b && b.text) lines.push(b.text);
                        });
                    }

                    // Remember/mnemonic
                    if (content.mnemonic) lines.push(content.mnemonic);
                    if (content.explanation) lines.push(content.explanation);

                    // Chart data
                    if (content.data && Array.isArray(content.data)) {
                        content.data.forEach(d => {
                            if (d.label) lines.push(`${d.label}${d.value !== undefined ? ': ' + d.value : ''}`);
                        });
                    }

                    // Items array (generic)
                    if (content.items && Array.isArray(content.items)) {
                        content.items.forEach(it => {
                            if (typeof it === 'string') lines.push(it);
                            else if (it && it.text) lines.push(it.text);
                            else if (it && it.label) lines.push(it.label);
                            else if (it && it.name) lines.push(it.name);
                        });
                    }

                    // Table: headers + rows
                    if (content.headers && content.rows) {
                        lines.push(content.headers.join(' | '));
                        content.rows.forEach(row => {
                            if (Array.isArray(row)) lines.push(row.join(' | '));
                            else if (typeof row === 'string') lines.push(row);
                        });
                    }

                    // Generic text-bearing keys
                    if (content.description) lines.push(content.description);
                    if (content.summary) lines.push(content.summary);
                    if (content.text) lines.push(content.text);

                    // Fallback: if nothing was extracted, do a deep walk
                    if (lines.length === 0) {
                        const deepExtract = (obj, depth) => {
                            if (depth > 4) return; // prevent infinite recursion
                            if (typeof obj === 'string' && obj.trim()) {
                                lines.push(obj);
                            } else if (Array.isArray(obj)) {
                                obj.forEach(item => deepExtract(item, depth + 1));
                            } else if (obj && typeof obj === 'object') {
                                Object.values(obj).forEach(val => deepExtract(val, depth + 1));
                            }
                        };
                        deepExtract(content, 0);
                    }
                }
            } catch { /* ignore extraction errors */ }
            return lines;
        }

        // ═══════════════════════════════════════════════════════════════
        // PRECISE CONTENT MATCHING — title-first, strict keyword match
        // Only shows sections whose TITLE directly indicates the filter
        // type (e.g. "Causes", "Aetiology") or whose section type matches.
        // Content-body keywords are only used as a secondary signal and
        // require the keyword to appear prominently (not just once in
        // passing). This prevents "treatment" sections from appearing
        // under "causes" just because they mention "mechanism" once.
        // ═══════════════════════════════════════════════════════════════

        // Primary title keywords — the section title must contain one of these
        const titlePrimary = {
            causes: ['cause', 'aetiology', 'etiology', 'pathogenesis', 'pathophysiology', 'risk factor', 'predisposing', 'etiolog'],
            clinical: ['clinical', 'presentation', 'symptom', 'sign', 'feature', 'manifestation', 'examination', 'finding'],
            complications: ['complication', 'adverse', 'side effect', 'sequelae', 'prognosis', 'outcome'],
            workup: ['workup', 'work-up', 'work up', 'assessment', 'evaluation', 'approach', 'algorithm', 'protocol'],
            investigations: ['investigation', 'imaging', 'diagnostic', 'test', 'laboratory', 'scan', 'oct', 'angiography'],
            treatment: ['treatment', 'management', 'therapy', 'medication', 'surgical', 'procedure', 'intervention', 'pharmacolog'],
            tables: ['table', 'comparison', 'differential', 'classification', 'staging', 'grading', 'scoring'],
        };

        const primaryKws = titlePrimary[filterType] || filterDef.keywords;

        const matchingItems = [];
        library.forEach(item => {
            try {
                if (!item.data || !item.data.sections) return;
                const sections = Array.isArray(item.data.sections) ? item.data.sections : [];
                const matchedSections = [];

                sections.forEach(section => {
                    if (!section) return;
                    const sTitle = (section.title || '').toLowerCase();

                    let matched = false;

                    // 1) Section type match (e.g. type === 'table')
                    if (filterDef.sectionTypes && filterDef.sectionTypes.includes(section.type)) {
                        matched = true;
                    }

                    // 2) PRIMARY: section title must contain a primary keyword
                    if (!matched) {
                        matched = primaryKws.some(kw => sTitle.includes(kw));
                    }

                    if (matched) {
                        const textLines = extractSectionText(section);
                        matchedSections.push({
                            title: section.title || 'Untitled Section',
                            type: section.type || 'unknown',
                            lines: textLines
                        });
                    }
                });

                if (matchedSections.length > 0) {
                    matchingItems.push({
                        id: item.id,
                        title: item.title,
                        chapterId: item.chapterId || 'uncategorized',
                        sections: matchedSections
                    });
                }
            } catch { /* skip malformed items */ }
        });

        if (matchingItems.length === 0) {
            alert(`No "${filterDef.name}" content found across your library.`);
            return;
        }

        // Collect categories for the filter dropdown
        const categoriesPresent = [...new Set(matchingItems.map(i => i.chapterId))];
        const catOptions = categoriesPresent.map(cId => {
            const ch = DEFAULT_CHAPTERS.find(c => c.id === cId);
            return { id: cId, name: ch ? ch.name : cId, color: ch ? ch.color : '#64748b' };
        }).sort((a, b) => a.name.localeCompare(b.name));

        // Theme colors per filter type
        const themeColors = {
            tables: { bg: '#eff6ff', border: '#bfdbfe', header: '#2563eb', headerEnd: '#1d4ed8', accent: '#1e40af' },
            causes: { bg: '#fefce8', border: '#fef08a', header: '#ca8a04', headerEnd: '#a16207', accent: '#854d0e' },
            clinical: { bg: '#f0fdf4', border: '#bbf7d0', header: '#16a34a', headerEnd: '#15803d', accent: '#166534' },
            complications: { bg: '#fef2f2', border: '#fecaca', header: '#ef4444', headerEnd: '#dc2626', accent: '#b91c1c' },
            workup: { bg: '#faf5ff', border: '#e9d5ff', header: '#9333ea', headerEnd: '#7e22ce', accent: '#6b21a8' },
            investigations: { bg: '#ecfeff', border: '#a5f3fc', header: '#0891b2', headerEnd: '#0e7490', accent: '#155e75' },
            treatment: { bg: '#fff7ed', border: '#fed7aa', header: '#ea580c', headerEnd: '#c2410c', accent: '#9a3412' },
        };
        const theme = themeColors[filterType] || themeColors.tables;

        // Create or reuse modal
        let cfModal = document.getElementById('content-filter-modal');
        if (!cfModal) {
            cfModal = document.createElement('div');
            cfModal.id = 'content-filter-modal';
            cfModal.className = 'modal-overlay';
            cfModal.innerHTML = `
                <div class="modal-content modal-lg" id="cf-modal-inner" style="border: 2px solid ${theme.border};">
                    <div class="modal-header" id="cf-modal-header" style="background: linear-gradient(135deg, ${theme.header} 0%, ${theme.headerEnd} 100%); color: white;">
                        <h2 id="cf-modal-title" style="display: flex; align-items: center; gap: 8px;"></h2>
                        <button id="close-cf-modal" class="icon-btn-ghost" style="color: white;">
                            <span class="material-symbols-rounded">close</span>
                        </button>
                    </div>
                    <div class="modal-body" id="cf-modal-body" style="max-height: 70vh; overflow-y: auto;"></div>
                </div>
            `;
            document.body.appendChild(cfModal);

            cfModal.querySelector('#close-cf-modal').addEventListener('click', () => {
                cfModal.classList.remove('active');
            });
            cfModal.addEventListener('click', (e) => {
                if (e.target === cfModal) cfModal.classList.remove('active');
            });
        }

        // Update modal theme
        const inner = cfModal.querySelector('#cf-modal-inner');
        inner.style.border = `2px solid ${theme.header}`;
        const header = cfModal.querySelector('#cf-modal-header');
        header.style.background = `linear-gradient(135deg, ${theme.header} 0%, ${theme.headerEnd} 100%)`;

        // Set title
        cfModal.querySelector('#cf-modal-title').innerHTML = `
            <span class="material-symbols-rounded">${filterDef.icon}</span>
            ${filterDef.name}
        `;

        // Render body
        const cfBody = cfModal.querySelector('#cf-modal-body');
        const totalSections = matchingItems.reduce((sum, i) => sum + i.sections.length, 0);

        cfBody.innerHTML = `
            <!-- Category filter -->
            <div style="display: flex; align-items: center; gap: 0.75rem; margin-bottom: 1rem; flex-wrap: wrap;">
                <label style="font-weight: 600; color: ${theme.accent}; display: flex; align-items: center; gap: 4px;">
                    <span class="material-symbols-rounded" style="font-size: 1.1rem;">filter_list</span>
                    Filter by Category:
                </label>
                <select id="cf-category-filter" style="padding: 0.5rem 1rem; border: 1px solid ${theme.border}; border-radius: 8px; font-size: 0.9rem; background: white; color: #374151; min-width: 180px;">
                    <option value="all">All Categories (${matchingItems.length})</option>
                    ${catOptions.map(c => `<option value="${c.id}">${c.name} (${matchingItems.filter(i => i.chapterId === c.id).length})</option>`).join('')}
                </select>
            </div>
            <p id="cf-count-text" style="margin-bottom: 1rem; color: ${theme.accent}; font-weight: 500;">
                Found ${totalSections} matching section(s) across ${matchingItems.length} infographic(s):
            </p>
            ${matchingItems.map(item => {
            const ch = DEFAULT_CHAPTERS.find(c => c.id === item.chapterId);
            const catBadge = ch && item.chapterId !== 'uncategorized'
                ? `<span style="display: inline-flex; align-items: center; gap: 3px; padding: 2px 8px; border-radius: 12px; font-size: 0.7rem; font-weight: 600; color: white; background: ${ch.color}; margin-left: 6px;"><span class="material-symbols-rounded" style="font-size: 11px;">folder</span>${ch.name}</span>`
                : '';
            return `
                <div class="cf-card" data-chapter="${item.chapterId}" style="background: ${theme.bg}; border: 1px solid ${theme.border}; border-radius: 8px; padding: 1rem; margin-bottom: 1rem;">
                    <h3 style="color: ${theme.accent}; margin: 0 0 0.5rem 0; font-size: 1rem; display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
                        <span class="material-symbols-rounded" style="font-size: 1.2rem;">${filterDef.icon}</span>
                        ${item.title.substring(0, 60)}${item.title.length > 60 ? '...' : ''}
                        ${catBadge}
                    </h3>
                    ${item.sections.map(sec => `
                        <div style="margin-bottom: 0.75rem; padding: 0.5rem 0.75rem; background: white; border-radius: 6px; border-left: 3px solid ${theme.header};">
                            <div style="font-weight: 600; font-size: 0.85rem; color: ${theme.accent}; margin-bottom: 4px;">
                                ${sec.title}
                            </div>
                            ${sec.lines.length > 0 ? `
                                <ul style="margin: 0; padding-left: 1.25rem; color: #374151; font-size: 0.85rem;">
                                    ${sec.lines.slice(0, 20).map(l => `<li style="margin-bottom: 3px;">${l}</li>`).join('')}
                                    ${sec.lines.length > 20 ? `<li style="color: #94a3b8; font-style: italic;">...and ${sec.lines.length - 20} more items</li>` : ''}
                                </ul>
                            ` : '<p style="color: #94a3b8; font-size: 0.85rem; margin: 0;">No text content extracted.</p>'}
                        </div>
                    `).join('')}
                    <button class="btn-small cf-view-btn" data-item-id="${item.id}" style="margin-top: 0.5rem;">
                        <span class="material-symbols-rounded">visibility</span>
                        View Infographic
                    </button>
                </div>
            `}).join('')}
        `;

        // Category filter: show/hide in-place
        const cfFilter = cfBody.querySelector('#cf-category-filter');
        const cfCountText = cfBody.querySelector('#cf-count-text');
        if (cfFilter) {
            cfFilter.addEventListener('change', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const sel = e.target.value;
                let visCount = 0;
                let secCount = 0;
                cfBody.querySelectorAll('.cf-card').forEach(card => {
                    if (sel === 'all' || card.dataset.chapter === sel) {
                        card.style.display = '';
                        visCount++;
                        secCount += card.querySelectorAll('[style*="border-left"]').length;
                    } else {
                        card.style.display = 'none';
                    }
                });
                if (cfCountText) {
                    const catName = sel !== 'all' ? catOptions.find(c => c.id === sel)?.name || sel : '';
                    cfCountText.textContent = `Found ${secCount} matching section(s) across ${visCount} infographic(s)${catName ? ` in "${catName}"` : ''}:`;
                }
            });
        }

        // View infographic buttons
        cfBody.querySelectorAll('.cf-view-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const itemId = parseInt(btn.dataset.itemId);
                const lib = JSON.parse(localStorage.getItem(LIBRARY_KEY) || '[]');
                const found = lib.find(i => i.id === itemId);
                if (found && found.data) {
                    if (found.chapterId) found.data.chapterId = found.chapterId;
                    renderInfographic(found.data);
                    cfModal.classList.remove('active');
                    modal.classList.remove('active');
                }
            });
        });

        cfModal.classList.add('active');
    }

    function renderLibraryList() {
        const library = JSON.parse(localStorage.getItem(LIBRARY_KEY) || '[]');

        // Ensure IDs are assigned (Migration check)
        if (assignSequentialIds(library)) {
            localStorage.setItem(LIBRARY_KEY, JSON.stringify(library));
        }

        // Sync chapterId into data.chapterId for all items (ensures tag always matches)
        let chapterSynced = false;
        library.forEach(item => {
            if (item.data && item.chapterId && item.data.chapterId !== item.chapterId) {
                item.data.chapterId = item.chapterId;
                chapterSynced = true;
            }
        });
        if (chapterSynced) {
            localStorage.setItem(LIBRARY_KEY, JSON.stringify(library));
        }

        // Count badge - will be updated after filtering below
        const countBadge = document.getElementById('library-count-badge');

        // Detect uncategorized infographics
        const uncategorizedCount = library.filter(item => !item.chapterId || item.chapterId === 'uncategorized').length;
        let uncategorizedBanner = modal.querySelector('.uncategorized-banner');

        if (uncategorizedCount > 0 && library.length > 0) {
            if (!uncategorizedBanner) {
                uncategorizedBanner = document.createElement('div');
                uncategorizedBanner.className = 'uncategorized-banner';
                const modalHeader = modal.querySelector('.modal-header');
                if (modalHeader && modalHeader.nextSibling) {
                    modalHeader.parentNode.insertBefore(uncategorizedBanner, modalHeader.nextSibling);
                }
            }
            uncategorizedBanner.innerHTML = `
                <span class="material-symbols-rounded">category</span>
                <span><strong>${uncategorizedCount}</strong> infographic${uncategorizedCount > 1 ? 's' : ''} uncategorized</span>
                <button class="btn-small btn-categorize-all" style="margin-left: auto;">
                    <span class="material-symbols-rounded">auto_awesome</span>
                    Auto-Categorize
                </button>
            `;
            uncategorizedBanner.style.display = 'flex';

            // Add click handler for auto-categorize button
            const categorizeBtn = uncategorizedBanner.querySelector('.btn-categorize-all');
            if (categorizeBtn) {
                categorizeBtn.onclick = () => {
                    const autoChapterBtn = document.getElementById('auto-chapter-btn');
                    if (autoChapterBtn) {
                        autoChapterBtn.click();
                    }
                };
            }
        } else if (uncategorizedBanner) {
            uncategorizedBanner.style.display = 'none';
        }

        const chapters = getChapters();

        // 1. Filter by Chapter
        let filteredLibrary = currentChapterFilter === 'all'
            ? library
            : library.filter(item => item.chapterId === currentChapterFilter);

        // 2. Filter by Search Term
        if (currentSearchTerm) {
            const term = currentSearchTerm.toLowerCase();
            filteredLibrary = filteredLibrary.filter(item =>
                (item.title || '').toLowerCase().includes(term) ||
                (item.summary || '').toLowerCase().includes(term)
            );
        }

        // 2.5 Filter by Bookmarked
        if (showBookmarkedOnly) {
            filteredLibrary = filteredLibrary.filter(item => item.bookmarked === true);
        }

        // 2.6 Filter by Content Type (tables, causes, clinical, etc.)
        if (currentContentFilter !== 'all') {
            const filterDef = CONTENT_TYPE_FILTERS.find(f => f.id === currentContentFilter);
            if (filterDef && filterDef.keywords) {
                filteredLibrary = filteredLibrary.filter(item => {
                    try {
                        if (!item.data || !item.data.sections) return false;
                        const sections = Array.isArray(item.data.sections) ? item.data.sections : [];
                        // Check section types first (e.g., table type)
                        if (filterDef.sectionTypes) {
                            const hasType = sections.some(s => s && filterDef.sectionTypes.includes(s.type));
                            if (hasType) return true;
                        }
                        // Check section titles and content for keywords
                        return sections.some(section => {
                            if (!section) return false;
                            const sTitle = (section.title || '').toLowerCase();
                            let sContent = '';
                            try {
                                if (typeof section.content === 'string') {
                                    sContent = section.content.toLowerCase();
                                } else if (Array.isArray(section.content)) {
                                    sContent = section.content
                                        .map(c => typeof c === 'string' ? c : (c && c.label ? c.label : ''))
                                        .join(' ').toLowerCase();
                                } else if (section.content && typeof section.content === 'object') {
                                    sContent = JSON.stringify(section.content).toLowerCase();
                                }
                            } catch { sContent = ''; }
                            const combined = sTitle + ' ' + sContent;
                            return filterDef.keywords.some(kw => combined.includes(kw));
                        });
                    } catch (err) {
                        console.warn('Content filter error for item:', item.title, err);
                        return false;
                    }
                });
            }
        }

        // 3. Apply Sorting
        if (currentSortMode === 'date') {
            filteredLibrary.sort((a, b) => new Date(b.date) - new Date(a.date));
        } else if (currentSortMode === 'name') {
            filteredLibrary.sort((a, b) => {
                const nameA = (a.title || '').toLowerCase();
                const nameB = (b.title || '').toLowerCase();
                return nameA.localeCompare(nameB);
            });
        } else if (currentSortMode === 'chapter') {
            const chapterOrder = new Map(chapters.map((ch, idx) => [ch.id, idx]));
            filteredLibrary.sort((a, b) => {
                const idxA = chapterOrder.get(a.chapterId) ?? 999;
                const idxB = chapterOrder.get(b.chapterId) ?? 999;
                if (idxA !== idxB) return idxA - idxB;
                // Secondary sort by date
                return new Date(b.date) - new Date(a.date);
            });
        } else if (currentSortMode === 'newly_added') {
            // Sort by _newlyImported timestamp (most recent first), then by date
            filteredLibrary.sort((a, b) => {
                const aNew = a._newlyImported || 0;
                const bNew = b._newlyImported || 0;
                if (aNew !== bNew) return bNew - aNew; // Newly imported first
                return new Date(b.date) - new Date(a.date); // Then by date
            });
        }

        // Update count badge to show filtered vs total count
        if (countBadge) {
            const isFiltered = showBookmarkedOnly || currentChapterFilter !== 'all' || currentSearchTerm || currentContentFilter !== 'all';
            if (isFiltered) {
                countBadge.textContent = `${filteredLibrary.length} / ${library.length}`;
            } else {
                countBadge.textContent = library.length;
            }
            countBadge.style.display = library.length > 0 ? 'inline-block' : 'none';
        }

        // Build chapter filter tabs
        const modalBody = modal.querySelector('.modal-body');

        // Check if chapter tabs exist, if not create them
        let chapterTabs = modal.querySelector('.chapter-tabs');
        if (!chapterTabs) {
            chapterTabs = document.createElement('div');
            chapterTabs.className = 'chapter-tabs';
            modalBody.insertBefore(chapterTabs, listContainer);
        }

        // Render chapter tabs
        chapterTabs.innerHTML = `
            <button class="chapter-tab ${currentChapterFilter === 'all' ? 'active' : ''}" data-chapter="all">
                All
            </button>
            ${chapters.map(ch => `
                <button class="chapter-tab ${currentChapterFilter === ch.id ? 'active' : ''}" 
                        data-chapter="${ch.id}" 
                        style="--chapter-color: ${ch.color}">
                    ${ch.name}
                </button>
            `).join('')}
        `;

        // Chapter tab click handlers
        chapterTabs.querySelectorAll('.chapter-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                currentChapterFilter = tab.dataset.chapter;
                renderLibraryList();
            });
        });

        // Selection toolbar & Search Bar
        let toolbar = modal.querySelector('.selection-toolbar');
        if (!toolbar) {
            toolbar = document.createElement('div');
            toolbar.className = 'selection-toolbar';
            modalBody.insertBefore(toolbar, listContainer);
        }

        toolbar.innerHTML = `
            <div class="toolbar-row" style="display: flex; gap: 10px; width: 100%; margin-bottom: 10px;">
                <div class="search-wrapper" style="flex: 1; position: relative;">
                    <span class="material-symbols-rounded" style="position: absolute; left: 10px; top: 50%; transform: translateY(-50%); color: #94a3b8; font-size: 1.2rem;">search</span>
                    <input type="text" id="library-search" placeholder="Search saved infographics..." value="${currentSearchTerm}" 
                        style="width: 100%; padding: 8px 30px 8px 35px; border: 1px solid #e2e8f0; border-radius: 6px; font-size: 0.9rem;">
                    ${currentSearchTerm ? `
                        <button id="clear-search-btn" style="position: absolute; right: 5px; top: 50%; transform: translateY(-50%); background: none; border: none; cursor: pointer; color: #94a3b8; padding: 2px; display: flex;">
                            <span class="material-symbols-rounded" style="font-size: 1.2rem;">close</span>
                        </button>
                    ` : ''}
                </div>
                <div class="sort-wrapper">
                    <select id="sort-select" style="padding: 8px 10px; border: 1px solid #e2e8f0; border-radius: 6px; font-size: 0.9rem; background-color: white; cursor: pointer;">
                        <option value="date" ${currentSortMode === 'date' ? 'selected' : ''}>Sort by Date</option>
                        <option value="name" ${currentSortMode === 'name' ? 'selected' : ''}>Sort by Name</option>
                        <option value="chapter" ${currentSortMode === 'chapter' ? 'selected' : ''}>Sort by Chapter</option>
                        <option value="newly_added" ${currentSortMode === 'newly_added' ? 'selected' : ''}>Sort by Newly Added</option>
                    </select>
                </div>
                <div class="content-filter-wrapper">
                    <select id="content-type-filter" style="padding: 8px 10px; border: 1px solid ${currentContentFilter !== 'all' ? '#8b5cf6' : '#e2e8f0'}; border-radius: 6px; font-size: 0.9rem; background-color: ${currentContentFilter !== 'all' ? '#f5f3ff' : 'white'}; cursor: pointer; color: ${currentContentFilter !== 'all' ? '#6d28d9' : 'inherit'}; font-weight: ${currentContentFilter !== 'all' ? '600' : 'normal'};">
                        ${CONTENT_TYPE_FILTERS.map(f => `<option value="${f.id}" ${currentContentFilter === f.id ? 'selected' : ''}>${f.name}</option>`).join('')}
                    </select>
                </div>
                <div class="bookmark-filter-wrapper" style="display: flex; align-items: center; gap: 6px;">
                    <button id="bookmark-filter-btn" class="btn-small ${showBookmarkedOnly ? 'btn-active' : ''}" title="Show Bookmarked Only">
                        <span class="material-symbols-rounded" style="font-size: 1.1rem;">${showBookmarkedOnly ? 'bookmark' : 'bookmark_border'}</span>
                        ${showBookmarkedOnly ? 'Bookmarked' : 'All'}
                    </button>
                    <span id="filtered-count-display" style="font-size: 0.85rem; font-weight: 600; color: #64748b; background: #f1f5f9; padding: 2px 8px; border-radius: 12px;">${filteredLibrary.length}</span>
                </div>
            </div>
            <div class="toolbar-row" style="display: flex; gap: 10px; align-items: center; flex-wrap: wrap;">
                <button class="btn-small ${selectionMode ? 'btn-active' : ''}" id="toggle-selection-btn">
                    <span class="material-symbols-rounded">checklist</span>
                    ${selectionMode ? 'Cancel Selection' : 'Select Items'}
                </button>
                ${selectionMode ? `
                    <button class="btn-small" id="select-all-btn">
                        <span class="material-symbols-rounded">select_all</span>
                        Select All
                    </button>
                ` : ''}
                ${selectionMode && selectedItems.size > 0 ? `
                    <button class="btn-small btn-bookmark-all" id="bookmark-selected-btn" style="background: linear-gradient(135deg, #eab308 0%, #ca8a04 100%); color: white; border: none;">
                        <span class="material-symbols-rounded">bookmarks</span>
                        Bookmark All (${selectedItems.size})
                    </button>
                    <button class="btn-small btn-delete-selected" id="delete-selected-btn" style="background-color: #fee2e2; color: #ef4444; border-color: #fca5a5;">
                        <span class="material-symbols-rounded">delete</span>
                        Delete Selected (${selectedItems.size})
                    </button>
                    <button class="btn-small btn-community-submit" id="submit-selected-community-btn" style="background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%); color: white; border: none;">
                        <span class="material-symbols-rounded">group_add</span>
                        Submit to Community (${selectedItems.size})
                    </button>
                    <select id="assign-chapter-select" class="chapter-select">
                        <option value="">Assign to Chapter...</option>
                        ${chapters.map(ch => `<option value="${ch.id}">${ch.name}</option>`).join('')}
                    </select>
                ` : ''}
            </div>
        `;

        // Search Handler
        const searchInput = toolbar.querySelector('#library-search');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                currentSearchTerm = e.target.value;
                renderLibraryList();
                // Restore focus after re-render
                const newInput = modal.querySelector('#library-search');
                if (newInput) {
                    newInput.focus();
                    newInput.setSelectionRange(newInput.value.length, newInput.value.length);
                }
            });
        }

        // Clear Search Handler
        const clearSearchBtn = toolbar.querySelector('#clear-search-btn');
        if (clearSearchBtn) {
            clearSearchBtn.addEventListener('click', () => {
                currentSearchTerm = '';
                renderLibraryList();
            });
        }

        // Sort Handler — deferred render to prevent DOM destruction during event
        const sortSelect = toolbar.querySelector('#sort-select');
        if (sortSelect) {
            sortSelect.addEventListener('change', (e) => {
                e.preventDefault();
                e.stopPropagation();
                currentSortMode = e.target.value;
                setTimeout(() => { renderLibraryList(); }, 0);
            });
        }

        // Content-Type Filter Handler — opens a modal showing matching text content
        const contentFilterSelect = toolbar.querySelector('#content-type-filter');
        if (contentFilterSelect) {
            contentFilterSelect.addEventListener('change', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const newValue = e.target.value;
                if (newValue === 'all') {
                    currentContentFilter = 'all';
                    setTimeout(() => { renderLibraryList(); }, 0);
                    return;
                }
                // Reset dropdown visually (modal will handle display)
                e.target.value = 'all';
                // Open content display modal
                setTimeout(() => { openContentFilterModal(newValue, library); }, 0);
            });
        }

        // Bookmark Filter Handler
        const bookmarkFilterBtn = toolbar.querySelector('#bookmark-filter-btn');
        if (bookmarkFilterBtn) {
            bookmarkFilterBtn.addEventListener('click', () => {
                showBookmarkedOnly = !showBookmarkedOnly;
                renderLibraryList();
            });
        }

        // Toggle selection mode
        toolbar.querySelector('#toggle-selection-btn').addEventListener('click', () => {
            selectionMode = !selectionMode;
            selectedItems.clear();
            renderLibraryList();
            updateExportButtonVisibility();
        });

        // Select All Handler
        const selectAllBtn = toolbar.querySelector('#select-all-btn');
        if (selectAllBtn) {
            selectAllBtn.addEventListener('click', () => {
                filteredLibrary.forEach(item => selectedItems.add(item.id));
                renderLibraryList();
                updateExportButtonVisibility();
            });
        }

        // Bookmark All Selected Handler
        const bookmarkSelectedBtn = toolbar.querySelector('#bookmark-selected-btn');
        if (bookmarkSelectedBtn) {
            bookmarkSelectedBtn.addEventListener('click', () => {
                if (selectedItems.size === 0) return;

                const updatedLibrary = library.map(item => {
                    if (selectedItems.has(item.id)) {
                        return { ...item, bookmarked: true };
                    }
                    return item;
                });
                localStorage.setItem(LIBRARY_KEY, JSON.stringify(updatedLibrary));

                const count = selectedItems.size;
                selectionMode = false;
                selectedItems.clear();
                renderLibraryList();
                updateExportButtonVisibility();
                alert(`Bookmarked ${count} infographic(s)!`);
            });
        }

        // Initial Listeners consolidated items

        // DELETE SELECTED HANDLER
        const deleteSelectedBtn = toolbar.querySelector('#delete-selected-btn');
        if (deleteSelectedBtn) {
            deleteSelectedBtn.addEventListener('click', async () => {


                if (!confirm(`Are you sure you want to PERMANENTLY delete ${selectedItems.size} items?`)) return;

                const idsToDelete = Array.from(selectedItems);

                // 1. Delete from Server (if connected)
                if (window.location.protocol !== 'file:') {
                    try {
                        const response = await safeFetch('api/library/delete', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ ids: idsToDelete })
                        });
                        const result = await response.json();
                        if (!result.success) {
                            console.error('Server delete failed:', result.error);
                            alert('Warning: Failed to delete some files from server.');
                        }
                    } catch (err) {
                        console.error('Server connection failed during delete:', err);
                    }
                }

                // 2. Delete from LocalStorage
                const updatedLibrary = library.filter(item => !selectedItems.has(item.id));
                localStorage.setItem(LIBRARY_KEY, JSON.stringify(updatedLibrary));

                // 3. Reset UI
                selectionMode = false;
                selectedItems.clear();
                renderLibraryList();
                alert('Selected items deleted.');
            });
        }

        // SUBMIT SELECTED TO COMMUNITY HANDLER
        const submitCommunityBtn = toolbar.querySelector('#submit-selected-community-btn');
        if (submitCommunityBtn) {
            submitCommunityBtn.addEventListener('click', async () => {
                if (selectedItems.size === 0) return;

                const itemsToSubmit = library.filter(item => selectedItems.has(item.id));
                const itemWord = itemsToSubmit.length === 1 ? 'infographic' : 'infographics';

                if (!confirm(`Publish ${itemsToSubmit.length} ${itemWord} to the Community Hub now? They will be available to everyone.`)) return;

                // Prompt for username
                const savedUsername = localStorage.getItem('community_username') || '';
                const userName = prompt('Enter your name for the submissions:', savedUsername);

                if (!userName || !userName.trim()) {
                    alert('A name is required for community submissions.');
                    return;
                }

                localStorage.setItem('community_username', userName.trim());

                // Show progress
                const originalContent = submitCommunityBtn.innerHTML;
                try {
                    // Attach adhered Kanski images to each item before batch submission
                    for (const item of itemsToSubmit) {
                        if (item.kanskiMeta && item.kanskiMeta.length > 0) {
                            const kanskiImgs = await loadKanskiFromIDB(item.title);
                            if (kanskiImgs && kanskiImgs.length > 0) {
                                const itemData = item.data || item;
                                itemData.kanskiImages = kanskiImgs;
                                console.log(`[BatchSubmit] Attaching ${kanskiImgs.length} Kanski image(s) to "${item.title}"`);
                            }
                        }
                    }

                    // Use new batch submit function
                    const result = await CommunitySubmissions.submitMultiple(itemsToSubmit, userName.trim());

                    if (result.success) {
                        const msg = `✅ ${result.count} infographic${result.count === 1 ? '' : 's'} published successfully!`;
                        alert(msg + '\n\nThey are now live in the Community Hub.');
                        selectionMode = false;
                        selectedItems.clear();
                        renderLibraryList();
                        updateExportButtonVisibility();
                    } else {
                        alert(`Submission failed: ${result.message}`);
                    }
                } catch (err) {
                    console.error('Community submission error:', err);
                    alert('Error submitting to the Community Hub: ' + err.message);
                } finally {
                    // Reset button
                    submitCommunityBtn.innerHTML = originalContent;
                    submitCommunityBtn.disabled = false;
                }
            });
        }

        // Assign chapter handler
        const assignSelect = toolbar.querySelector('#assign-chapter-select');
        if (assignSelect) {
            assignSelect.addEventListener('change', (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (e.target.value && selectedItems.size > 0) {
                    const newChapterId = e.target.value;
                    const chapterName = DEFAULT_CHAPTERS.find(c => c.id === newChapterId)?.name || newChapterId;
                    const count = selectedItems.size;

                    const updatedLibrary = library.map(item => {
                        if (selectedItems.has(item.id)) {
                            // Update both the library item and the nested data chapterId
                            const updated = { ...item, chapterId: newChapterId };
                            if (updated.data) {
                                updated.data = { ...updated.data, chapterId: newChapterId };
                            }
                            return updated;
                        }
                        return item;
                    });
                    localStorage.setItem(LIBRARY_KEY, JSON.stringify(updatedLibrary));

                    // Update the currently displayed infographic's tag if it was affected
                    if (currentInfographicData) {
                        const currentTitle = currentInfographicData.title;
                        const affectedItem = updatedLibrary.find(
                            i => selectedItems.has(i.id) && i.title === currentTitle
                        );
                        if (affectedItem) {
                            updateInfographicCategoryBadge(newChapterId);
                        }
                    }

                    // Auto-sync enabled (don't await - do in background)
                    syncLibraryToServer();

                    // Update the library card badges in-place without full re-render
                    selectedItems.forEach(itemId => {
                        const card = listContainer.querySelector(`.library-card[data-id="${itemId}"]`);
                        if (card) {
                            const badge = card.querySelector('.category-badge, .chapter-badge');
                            if (badge) {
                                const ch = DEFAULT_CHAPTERS.find(c => c.id === newChapterId);
                                if (ch) {
                                    badge.textContent = ch.name;
                                    badge.style.background = ch.color;
                                    badge.style.display = '';
                                }
                            }
                        }
                    });

                    // Reset selection without full re-render
                    selectionMode = false;
                    selectedItems.clear();

                    // Delayed re-render to avoid visual "reload" feel
                    setTimeout(() => {
                        renderLibraryList();
                        updateExportButtonVisibility();
                    }, 100);
                }
            });
        }

        listContainer.innerHTML = '';

        if (filteredLibrary.length === 0) {
            emptyMsg.style.display = 'flex';
            emptyMsg.innerHTML = currentSearchTerm
                ? `<p>No results found for "${currentSearchTerm}"</p>`
                : `<div class="empty-icon-container"><span class="material-symbols-rounded">folder_open</span></div><h3>No Saved Infographics</h3><p>Generate an infographic and click "Save" to build your knowledge base.</p>`;
            listContainer.style.display = 'none';
        } else {
            emptyMsg.style.display = 'none';
            listContainer.style.display = 'flex';

            filteredLibrary.forEach(item => {
                const chapter = chapters.find(ch => ch.id === item.chapterId) || chapters[0];
                const isSelected = selectedItems.has(item.id);

                // Check if item is newly imported (within last 24 hours)
                const isNewlyImported = item._newlyImported && (Date.now() - item._newlyImported) < 24 * 60 * 60 * 1000;
                // Check if chapter was recently updated (within last 24 hours)
                const isChapterUpdated = item._chapterUpdated && (Date.now() - item._chapterUpdated) < 24 * 60 * 60 * 1000;
                const isNew = isNewlyImported || isChapterUpdated;
                const hashtagColor = isNew ? '#22c55e' : '#94a3b8'; // Green for new/updated, gray for regular
                const hashtagTitle = isNewlyImported ? 'Newly synced' : (isChapterUpdated ? 'Chapter updated' : '');

                const el = document.createElement('div');
                el.className = `saved-item ${isSelected ? 'selected' : ''} ${isNew ? 'newly-imported' : ''}`;
                el.innerHTML = `
                    ${selectionMode ? `
                        <input type="checkbox" class="item-checkbox" data-id="${item.id}" ${isSelected ? 'checked' : ''}>
                    ` : `
                        <div class="item-number" style="font-weight: bold; color: ${hashtagColor}; font-size: 0.9rem; margin-right: 12px; min-width: 25px;" title="${hashtagTitle}">#${item.seqId || '?'}${isNew ? ' ✨' : ''}</div>
                    `}
                    <div class="saved-info">
                        <div class="saved-title-row">
                            <span class="chapter-badge" style="background: ${chapter.color}">${chapter.name}</span>
                            <span class="saved-title">${item.title}</span>
                        </div>
                        <div class="saved-date">${new Date(item.date).toLocaleString()}</div>
                    </div>
                    <div class="saved-actions">
                        <button class="btn-small btn-bookmark" data-id="${item.id}" title="${item.bookmarked ? 'Remove Bookmark' : 'Add Bookmark'}">
                            <span class="material-symbols-rounded" style="font-size: 1.1rem; color: ${item.bookmarked ? '#eab308' : '#94a3b8'};">${item.bookmarked ? 'bookmark' : 'bookmark_border'}</span>
                        </button>
                        <button class="btn-small btn-rename" data-id="${item.id}" title="Rename">
                            <span class="material-symbols-rounded" style="font-size: 1rem;">edit</span>
                        </button>
                        <button class="btn-small btn-load" data-id="${item.id}">Load</button>
                        <button class="btn-small btn-delete" data-id="${item.id}" title="Delete">
                            <span class="material-symbols-rounded" style="font-size: 1.2rem;">delete</span>
                        </button>
                    </div>
                `;
                listContainer.appendChild(el);
            });

            // Checkbox handlers
            listContainer.querySelectorAll('.item-checkbox').forEach(cb => {
                cb.addEventListener('change', (e) => {
                    const id = parseInt(e.target.dataset.id);
                    if (e.target.checked) {
                        selectedItems.add(id);
                    } else {
                        selectedItems.delete(id);
                    }
                    renderLibraryList(); // Re-render to update selected styling if needed, or just update class
                    updateExportButtonVisibility();
                });
            });

            // Bookmark toggle handlers
            listContainer.querySelectorAll('.btn-bookmark').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const button = e.target.closest('.btn-bookmark');
                    const id = parseInt(button.dataset.id);
                    const targetItem = library.find(i => i.id === id);
                    if (targetItem) {
                        targetItem.bookmarked = !targetItem.bookmarked;
                        localStorage.setItem(LIBRARY_KEY, JSON.stringify(library));
                        renderLibraryList();
                    }
                });
            });

            // Rename handlers - unrestricted for all users
            listContainer.querySelectorAll('.btn-rename').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const button = e.target.closest('.btn-rename');
                    const id = parseInt(button.dataset.id);
                    const targetItem = library.find(i => i.id === id);

                    if (targetItem) {
                        // No password required - any user can rename in their own library
                        const newTitle = prompt('Enter new title:', targetItem.title);
                        if (newTitle && newTitle.trim()) {
                            targetItem.title = newTitle.trim();
                            if (targetItem.data) {
                                targetItem.data.title = newTitle.trim();
                            }
                            localStorage.setItem(LIBRARY_KEY, JSON.stringify(library));

                            // Auto-Sync
                            syncLibraryToServer();

                            renderLibraryList();
                        }
                    }
                });
            });

            // Load handlers
            listContainer.querySelectorAll('.btn-load').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const id = parseInt(e.target.dataset.id);
                    // Always read fresh from localStorage to get latest chapterId
                    const freshLibrary = JSON.parse(localStorage.getItem(LIBRARY_KEY) || '[]');
                    const targetItem = freshLibrary.find(i => i.id === id);
                    if (targetItem) {
                        if (!targetItem.data || (typeof targetItem.data === 'object' && !targetItem.data.sections)) {
                            // Data is missing or corrupt - show resubmission prompt
                            const authorInfo = targetItem.communityAuthor
                                ? `\n\nOriginal author: ${targetItem.communityAuthor}`
                                : '';
                            alert(
                                `⚠️ Unable to load "${targetItem.title}"\n\n` +
                                `The infographic data is missing or corrupted and cannot be displayed.${authorInfo}\n\n` +
                                `Please contact the original uploader and ask them to resubmit this infographic to the Community Hub.`
                            );
                        }
                        // Force-sync the library's chapterId into data so the tag renders correctly
                        if (targetItem.data && targetItem.chapterId) {
                            targetItem.data.chapterId = targetItem.chapterId;
                        }
                        currentInfographicData = targetItem.data;
                        renderInfographic(targetItem.data);
                        modal.classList.remove('active');
                    }
                });
            });

            // Delete handlers - requires admin password
            listContainer.querySelectorAll('.btn-delete').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    const button = e.target.closest('.btn-delete');
                    const id = parseInt(button.dataset.id);
                    const itemToDelete = library.find(i => i.id === id);

                    // Delete handlers
                    // Allow any user to delete from their own library (Local Only)

                    const confirmMsg = 'Remove this item from your library?';

                    if (confirm(confirmMsg)) {
                        const newLibrary = library.filter(i => i.id !== id);

                        // Reassign sequential IDs after deletion (no gaps)
                        reassignSequentialIds(newLibrary);

                        localStorage.setItem(LIBRARY_KEY, JSON.stringify(newLibrary));

                        // TRACK LOCAL DELETION (For Remote Users)
                        if (isGitHubPages()) {
                            try {
                                const userDeletedKey = 'ophthalmic_user_deleted_items';
                                let deletedList = JSON.parse(localStorage.getItem(userDeletedKey) || '[]');
                                if (!deletedList.includes(String(id))) {
                                    deletedList.push(String(id));
                                    localStorage.setItem(userDeletedKey, JSON.stringify(deletedList));
                                }
                            } catch (e) {
                                console.warn('Failed to track local deletion:', e);
                            }
                        }

                        // Auto-Sync (Updates user's backup on server, but not Community Pool)
                        syncLibraryToServer();

                        renderLibraryList();
                        // alert('Item removed from library.'); // Optional, or just let UI update
                    }
                });
            });
        }
    }

    // CHECK / CORRECT CATEGORISATION HANDLER (Improved mindset)
    const checkCategorisationBtn = document.getElementById('check-categorisation-btn');
    if (checkCategorisationBtn) {
        checkCategorisationBtn.addEventListener('click', () => {
            const library = JSON.parse(localStorage.getItem(LIBRARY_KEY) || '[]');

            if (library.length === 0) {
                alert('Library is empty. Nothing to check.');
                return;
            }

            // DEEP MULTI-SIGNAL ANALYSIS: title + summary + all section content + nested data
            // Extracts maximum text from every part of the infographic for the most intelligent categorisation
            const mismatches = [];

            // Helper: recursively extract text from any content structure
            function extractTextDeep(content) {
                if (!content) return '';
                if (typeof content === 'string') return content;
                if (Array.isArray(content)) return content.map(extractTextDeep).join(' ');
                if (typeof content === 'object') {
                    let parts = [];
                    for (const val of Object.values(content)) {
                        parts.push(extractTextDeep(val));
                    }
                    return parts.join(' ');
                }
                return String(content);
            }

            library.forEach(item => {
                const currentChapter = item.chapterId || 'uncategorized';

                // Signal 1: Title analysis (highest weight)
                const titleChapter = autoDetectChapter(item.title);

                // Signal 2: Summary analysis
                const summaryText = (item.summary || '') + ' ' + (item.data?.summary || '');
                const summaryChapter = autoDetectChapter(summaryText);

                // Signal 3: Deep content analysis - extract ALL text from all sections
                let contentChapter = 'uncategorized';
                if (item.data && item.data.sections && Array.isArray(item.data.sections)) {
                    const allSectionText = item.data.sections.map(s => {
                        let text = s.title || '';
                        text += ' ' + extractTextDeep(s.content);
                        return text;
                    }).join(' ');
                    contentChapter = autoDetectChapter(allSectionText);
                }

                // Combine signals with priority weighting:
                // Title > Summary > Content (for tie-breaking)
                const candidates = [titleChapter, summaryChapter, contentChapter].filter(c => c !== 'uncategorized');
                let bestSuggestion = 'uncategorized';
                let confidence = 'low';

                if (candidates.length === 0) {
                    // No signals - skip
                    return;
                } else if (candidates.length >= 2) {
                    // Count votes - majority wins
                    const votes = {};
                    candidates.forEach(c => votes[c] = (votes[c] || 0) + 1);
                    const sorted = Object.entries(votes).sort((a, b) => b[1] - a[1]);
                    bestSuggestion = sorted[0][0];
                    confidence = sorted[0][1] >= 2 ? 'high' : 'medium';
                } else {
                    // Only one signal
                    bestSuggestion = candidates[0];
                    confidence = titleChapter !== 'uncategorized' ? 'medium' : 'low';
                }

                // Flag if: uncategorized and we have a suggestion, or current doesn't match consensus
                if (currentChapter === 'uncategorized' && bestSuggestion !== 'uncategorized') {
                    mismatches.push({
                        id: item.id,
                        title: item.title,
                        current: currentChapter,
                        suggested: bestSuggestion,
                        confidence: confidence === 'low' ? 'medium' : confidence // Upgrade for uncategorized items
                    });
                } else if (currentChapter !== 'uncategorized' && bestSuggestion !== 'uncategorized' && currentChapter !== bestSuggestion) {
                    // Only suggest override with sufficient confidence
                    if (confidence === 'high') {
                        mismatches.push({
                            id: item.id,
                            title: item.title,
                            current: currentChapter,
                            suggested: bestSuggestion,
                            confidence: 'high'
                        });
                    } else if (confidence === 'medium' && titleChapter !== 'uncategorized') {
                        mismatches.push({
                            id: item.id,
                            title: item.title,
                            current: currentChapter,
                            suggested: bestSuggestion,
                            confidence: 'low'
                        });
                    }
                }
            });

            if (mismatches.length === 0) {
                const totalCategorised = library.filter(i => i.chapterId && i.chapterId !== 'uncategorized').length;
                alert(`✅ All ${totalCategorised}/${library.length} categorised items look correct! No suggestions found.`);
                return;
            }

            // Sort by confidence (high first)
            mismatches.sort((a, b) => {
                const order = { high: 0, medium: 1, low: 2 };
                return (order[a.confidence] || 3) - (order[b.confidence] || 3);
            });

            // Create a modal to show ALL suggestions with individual checkboxes
            let catModal = document.getElementById('categorisation-suggestions-modal');
            if (!catModal) {
                catModal = document.createElement('div');
                catModal.id = 'categorisation-suggestions-modal';
                catModal.className = 'modal-overlay';
                catModal.innerHTML = `
                    <div class="modal-content modal-lg" style="border: 2px solid #8b5cf6;">
                        <div class="modal-header" style="background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%); color: white;">
                            <h2 style="display: flex; align-items: center; gap: 8px;">
                                <span class="material-symbols-rounded">auto_fix_high</span>
                                Categorisation Suggestions
                            </h2>
                            <button id="close-cat-suggestions-modal" class="icon-btn-ghost" style="color: white;">
                                <span class="material-symbols-rounded">close</span>
                            </button>
                        </div>
                        <div class="modal-body" id="cat-suggestions-body" style="max-height: 70vh; overflow-y: auto;">
                        </div>
                    </div>
                `;
                document.body.appendChild(catModal);

                catModal.querySelector('#close-cat-suggestions-modal').addEventListener('click', () => {
                    catModal.classList.remove('active');
                });
                catModal.addEventListener('click', (e) => {
                    if (e.target === catModal) catModal.classList.remove('active');
                });
            }

            const catBody = catModal.querySelector('#cat-suggestions-body');
            catBody.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; flex-wrap: wrap; gap: 0.5rem;">
                    <p style="margin: 0; color: #6d28d9; font-weight: 600;">
                        Found ${mismatches.length} suggestion(s). Select which to apply:
                    </p>
                    <div style="display: flex; gap: 0.5rem;">
                        <button id="cat-select-all-btn" style="padding: 0.4rem 0.8rem; font-size: 0.8rem; background: #ede9fe; color: #6d28d9; border: 1px solid #c4b5fd; border-radius: 6px; cursor: pointer; font-weight: 600;">
                            Select All
                        </button>
                        <button id="cat-deselect-all-btn" style="padding: 0.4rem 0.8rem; font-size: 0.8rem; background: #f1f5f9; color: #64748b; border: 1px solid #cbd5e1; border-radius: 6px; cursor: pointer; font-weight: 600;">
                            Deselect All
                        </button>
                    </div>
                </div>
                <p style="margin: 0 0 1rem 0; font-size: 0.8rem; color: #64748b;">
                    🟢 High confidence &nbsp; 🟡 Medium &nbsp; 🔴 Low
                </p>
                <div id="cat-suggestions-list">
                    ${mismatches.map((m, i) => {
                const currentName = DEFAULT_CHAPTERS.find(c => c.id === m.current)?.name || m.current;
                const suggestedName = DEFAULT_CHAPTERS.find(c => c.id === m.suggested)?.name || m.suggested;
                const suggestedColor = DEFAULT_CHAPTERS.find(c => c.id === m.suggested)?.color || '#64748b';
                const confidenceIcon = m.confidence === 'high' ? '🟢' : m.confidence === 'medium' ? '🟡' : '🔴';
                const checked = m.confidence !== 'low' ? 'checked' : '';
                return `
                        <label style="display: flex; align-items: flex-start; gap: 0.75rem; padding: 0.75rem; margin-bottom: 0.5rem; background: ${m.confidence === 'high' ? '#f0fdf4' : m.confidence === 'medium' ? '#fefce8' : '#fef2f2'}; border: 1px solid ${m.confidence === 'high' ? '#bbf7d0' : m.confidence === 'medium' ? '#fef08a' : '#fecaca'}; border-radius: 8px; cursor: pointer; transition: background 0.15s;">
                            <input type="checkbox" class="cat-suggestion-check" data-index="${i}" ${checked}
                                style="margin-top: 3px; width: 18px; height: 18px; accent-color: #7c3aed; cursor: pointer; flex-shrink: 0;">
                            <div style="flex: 1; min-width: 0;">
                                <div style="font-weight: 600; font-size: 0.9rem; color: #1e293b; margin-bottom: 2px; word-break: break-word;">
                                    ${confidenceIcon} ${m.title}
                                </div>
                                <div style="font-size: 0.8rem; color: #64748b; display: flex; align-items: center; gap: 4px; flex-wrap: wrap;">
                                    <span style="padding: 1px 6px; background: #e2e8f0; border-radius: 4px;">${currentName}</span>
                                    <span class="material-symbols-rounded" style="font-size: 14px;">arrow_forward</span>
                                    <span style="padding: 1px 6px; background: ${suggestedColor}; color: white; border-radius: 4px; font-weight: 600;">${suggestedName}</span>
                                </div>
                            </div>
                        </label>
                    `}).join('')}
                </div>
                <div style="display: flex; justify-content: flex-end; gap: 0.75rem; margin-top: 1.25rem; padding-top: 1rem; border-top: 1px solid #e2e8f0;">
                    <button id="cat-cancel-btn" style="padding: 0.6rem 1.25rem; background: #f1f5f9; color: #475569; border: 1px solid #cbd5e1; border-radius: 8px; cursor: pointer; font-weight: 600;">
                        Cancel
                    </button>
                    <button id="cat-apply-btn" style="padding: 0.6rem 1.25rem; background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%); color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: 600; display: flex; align-items: center; gap: 6px;">
                        <span class="material-symbols-rounded" style="font-size: 1.1rem;">check_circle</span>
                        Apply Selected
                    </button>
                </div>
            `;

            // Select All / Deselect All
            catBody.querySelector('#cat-select-all-btn').addEventListener('click', () => {
                catBody.querySelectorAll('.cat-suggestion-check').forEach(cb => cb.checked = true);
            });
            catBody.querySelector('#cat-deselect-all-btn').addEventListener('click', () => {
                catBody.querySelectorAll('.cat-suggestion-check').forEach(cb => cb.checked = false);
            });

            // Cancel
            catBody.querySelector('#cat-cancel-btn').addEventListener('click', () => {
                catModal.classList.remove('active');
            });

            // Apply Selected
            catBody.querySelector('#cat-apply-btn').addEventListener('click', () => {
                const selectedIndices = [];
                catBody.querySelectorAll('.cat-suggestion-check:checked').forEach(cb => {
                    selectedIndices.push(parseInt(cb.dataset.index));
                });

                if (selectedIndices.length === 0) {
                    alert('No suggestions selected. Please check at least one item to apply.');
                    return;
                }

                let changedCount = 0;
                selectedIndices.forEach(idx => {
                    const m = mismatches[idx];
                    if (!m) return;
                    const item = library.find(i => i.id === m.id);
                    if (item) {
                        item.chapterId = m.suggested;
                        if (item.data) {
                            item.data.chapterId = m.suggested;
                        }
                        changedCount++;
                    }
                });

                localStorage.setItem(LIBRARY_KEY, JSON.stringify(library));

                // Update the currently displayed infographic's tag if it was in the changed set
                if (currentInfographicData) {
                    for (const idx of selectedIndices) {
                        const m = mismatches[idx];
                        if (!m) continue;
                        const item = library.find(i => i.id === m.id);
                        if (item && item.title === currentInfographicData.title) {
                            updateInfographicCategoryBadge(m.suggested);
                            break;
                        }
                    }
                }

                catModal.classList.remove('active');
                alert(`✅ Updated categorisation for ${changedCount} item(s)! Tags have been updated.`);
                renderLibraryList();
                syncLibraryToServer();
            });

            catModal.classList.add('active');
        });
    }

    // RED FLAGS SECTION HANDLER (with category filter)
    const redFlagsBtn = document.getElementById('red-flags-btn');
    if (redFlagsBtn) {
        redFlagsBtn.addEventListener('click', () => {
            const library = JSON.parse(localStorage.getItem(LIBRARY_KEY) || '[]');

            if (library.length === 0) {
                alert('Library is empty. No red flags to display.');
                return;
            }

            // Find infographics that contain red_flag type sections OR any red-themed sections
            const redFlagItems = [];
            library.forEach(item => {
                if (item.data && item.data.sections) {
                    // Match red_flag type sections AND any section with color_theme 'red'
                    const redSections = item.data.sections.filter(section =>
                        section.type === 'red_flag' || section.color_theme === 'red'
                    );
                    if (redSections.length > 0) {
                        // Extract content from all red sections
                        const flags = [];
                        redSections.forEach(s => {
                            const sectionLabel = s.title ? `[${s.title}] ` : '';
                            if (s.type === 'red_flag') {
                                const items = Array.isArray(s.content) ? s.content : [s.content];
                                items.forEach(f => flags.push(sectionLabel + f));
                            } else if (Array.isArray(s.content)) {
                                s.content.forEach(f => flags.push(sectionLabel + f));
                            } else if (typeof s.content === 'string') {
                                flags.push(sectionLabel + s.content);
                            } else if (s.content && s.content.explanation) {
                                flags.push(sectionLabel + s.content.explanation);
                            } else if (s.content && s.content.data && Array.isArray(s.content.data)) {
                                s.content.data.forEach(d => flags.push(sectionLabel + `${d.label}: ${d.value}%`));
                            }
                        });
                        redFlagItems.push({
                            id: item.id,
                            title: item.title,
                            chapterId: item.chapterId || item.data.chapterId || 'uncategorized',
                            flags: flags
                        });
                    }
                }
            });

            if (redFlagItems.length === 0) {
                alert('No red flags or red-themed sections found! All infographics are clear.');
                return;
            }

            // Collect unique categories that have red flags
            const categoriesWithFlags = [...new Set(redFlagItems.map(i => i.chapterId))];
            const categoryOptions = categoriesWithFlags.map(cId => {
                const ch = DEFAULT_CHAPTERS.find(c => c.id === cId);
                return { id: cId, name: ch ? ch.name : cId, color: ch ? ch.color : '#64748b' };
            }).sort((a, b) => a.name.localeCompare(b.name));

            // Create a modal overlay for red flags
            let redFlagModal = document.getElementById('red-flag-modal');
            if (!redFlagModal) {
                redFlagModal = document.createElement('div');
                redFlagModal.id = 'red-flag-modal';
                redFlagModal.className = 'modal-overlay';
                redFlagModal.innerHTML = `
                    <div class="modal-content modal-lg" style="border: 2px solid #ef4444;">
                        <div class="modal-header" style="background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); color: white;">
                            <h2 style="display: flex; align-items: center; gap: 8px;">
                                <span class="material-symbols-rounded">flag</span>
                                🚩 Red Flags Section
                            </h2>
                            <button id="close-red-flag-modal" class="icon-btn-ghost" style="color: white;">
                                <span class="material-symbols-rounded">close</span>
                            </button>
                        </div>
                        <div class="modal-body" id="red-flag-body" style="max-height: 70vh; overflow-y: auto;">
                        </div>
                    </div>
                `;
                document.body.appendChild(redFlagModal);

                // Close handler
                redFlagModal.querySelector('#close-red-flag-modal').addEventListener('click', () => {
                    redFlagModal.classList.remove('active');
                });
                redFlagModal.addEventListener('click', (e) => {
                    if (e.target === redFlagModal) redFlagModal.classList.remove('active');
                });
            }

            // Render all cards once with data-chapter attributes for filtering
            const body = redFlagModal.querySelector('#red-flag-body');
            body.innerHTML = `
                <!-- Category Filter Dropdown -->
                <div style="display: flex; align-items: center; gap: 0.75rem; margin-bottom: 1rem; flex-wrap: wrap;">
                    <label for="red-flag-category-filter" style="font-weight: 600; color: #dc2626; display: flex; align-items: center; gap: 4px;">
                        <span class="material-symbols-rounded" style="font-size: 1.1rem;">filter_list</span>
                        Filter by Category:
                    </label>
                    <select id="red-flag-category-filter" style="padding: 0.5rem 1rem; border: 1px solid #fecaca; border-radius: 8px; font-size: 0.9rem; background: white; color: #374151; min-width: 180px;">
                        <option value="all">All Categories (${redFlagItems.length})</option>
                        ${categoryOptions.map(c => `<option value="${c.id}">${c.name} (${redFlagItems.filter(i => i.chapterId === c.id).length})</option>`).join('')}
                    </select>
                </div>
                <p id="red-flag-count-text" style="margin-bottom: 1rem; color: #ef4444; font-weight: 500;">
                    Showing ${redFlagItems.length} infographic(s) with red flag warnings:
                </p>
                ${redFlagItems.map(item => {
                const ch = DEFAULT_CHAPTERS.find(c => c.id === item.chapterId);
                const catBadge = ch && item.chapterId !== 'uncategorized'
                    ? `<span style="display: inline-flex; align-items: center; gap: 3px; padding: 2px 8px; border-radius: 12px; font-size: 0.7rem; font-weight: 600; color: white; background: ${ch.color}; margin-left: 6px;"><span class="material-symbols-rounded" style="font-size: 11px;">folder</span>${ch.name}</span>`
                    : '';
                return `
                    <div class="red-flag-card" data-chapter="${item.chapterId}" style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 1rem; margin-bottom: 1rem;">
                        <h3 style="color: #dc2626; margin: 0 0 0.5rem 0; font-size: 1rem; display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
                            <span class="material-symbols-rounded" style="font-size: 1.2rem;">warning</span>
                            ${item.title.substring(0, 50)}${item.title.length > 50 ? '...' : ''}
                            ${catBadge}
                        </h3>
                        <ul style="margin: 0; padding-left: 1.5rem; color: #b91c1c;">
                            ${item.flags.map(f => `<li style="margin-bottom: 4px;">${f}</li>`).join('')}
                        </ul>
                        <button class="btn-small view-redflag-infographic" data-item-id="${item.id}" style="margin-top: 0.75rem;">
                            <span class="material-symbols-rounded">visibility</span>
                            View Infographic
                        </button>
                    </div>
                `}).join('')}
            `;

            // Category filter: show/hide cards in-place (no re-render)
            const filterSelect = body.querySelector('#red-flag-category-filter');
            const countText = body.querySelector('#red-flag-count-text');
            if (filterSelect) {
                filterSelect.addEventListener('change', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const selectedCat = e.target.value;
                    let visibleCount = 0;

                    body.querySelectorAll('.red-flag-card').forEach(card => {
                        if (selectedCat === 'all' || card.dataset.chapter === selectedCat) {
                            card.style.display = '';
                            visibleCount++;
                        } else {
                            card.style.display = 'none';
                        }
                    });

                    // Update count text
                    if (countText) {
                        const catName = selectedCat !== 'all'
                            ? categoryOptions.find(c => c.id === selectedCat)?.name || selectedCat
                            : '';
                        countText.textContent = `Showing ${visibleCount} infographic(s) with red flag warnings${catName ? ` in "${catName}"` : ''}:`;
                    }
                });
            }

            // Attach click handlers for "View Infographic" buttons
            body.querySelectorAll('.view-redflag-infographic').forEach(btn => {
                btn.addEventListener('click', () => {
                    const itemId = parseInt(btn.dataset.itemId);
                    const lib = JSON.parse(localStorage.getItem(LIBRARY_KEY) || '[]');
                    const found = lib.find(i => i.id === itemId);
                    if (found && found.data) {
                        // Sync library chapterId into data for correct tag rendering
                        if (found.chapterId) found.data.chapterId = found.chapterId;
                        renderInfographic(found.data);
                        redFlagModal.classList.remove('active');
                        document.getElementById('library-modal').classList.remove('active');
                    } else if (found) {
                        const authorInfo = found.communityAuthor ? `\nOriginal author: ${found.communityAuthor}` : '';
                        alert(
                            `⚠️ Unable to load "${found.title}"\n\n` +
                            `The infographic data is missing or corrupted.${authorInfo}\n\n` +
                            `Please ask the original uploader to resubmit this infographic.`
                        );
                    }
                });
            });
            redFlagModal.classList.add('active');
        });
    }
}

/* Library Sync Status - Compare local vs server/admin knowledge base */
const SYNC_PREFERENCE_KEY = 'ophthalmic_sync_preference'; // 'local' or 'server'

function getSyncPreference() {
    return localStorage.getItem(SYNC_PREFERENCE_KEY) || 'local';
}

function setSyncPreference(preference) {
    localStorage.setItem(SYNC_PREFERENCE_KEY, preference);
}

function setupSyncStatus() {
    const syncStatusBtn = document.getElementById('sync-status-btn');
    const syncStatusModal = document.getElementById('sync-status-modal');
    const closeBtn = document.getElementById('close-sync-status-btn');
    const contentEl = document.getElementById('sync-status-content');
    const exportBtn = document.getElementById('export-local-only-btn');
    const downloadServerOnlyBtn = document.getElementById('download-server-only-btn');
    const refreshBtn = document.getElementById('refresh-sync-status-btn');
    const preferenceToggle = document.getElementById('sync-preference-toggle');

    if (!syncStatusBtn || !syncStatusModal) return;

    let currentDifferences = { localOnly: [], serverOnly: [], deletedByAdmin: [] };

    // Initialize preference toggle
    if (preferenceToggle) {
        const currentPref = getSyncPreference();
        const prefButtons = preferenceToggle.querySelectorAll('.pref-btn');

        prefButtons.forEach(btn => {
            // Set initial active state
            if (btn.dataset.pref === currentPref) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }

            // Add click handlers
            btn.addEventListener('click', () => {
                const newPref = btn.dataset.pref;
                setSyncPreference(newPref);

                // Update button states
                prefButtons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');

                // Show confirmation
                const prefName = newPref === 'local' ? 'Local First' : 'Server First';
                console.log(`Sync preference changed to: ${prefName}`);

                // Show a toast-like notification in the modal
                const toast = document.createElement('div');
                toast.className = 'sync-pref-toast';
                toast.innerHTML = `<span class="material-symbols-rounded">check_circle</span> Preference set to ${prefName}`;
                preferenceToggle.appendChild(toast);
                setTimeout(() => toast.remove(), 2000);
            });
        });
    }

    // Normalize title for comparison
    const normalizeTitle = (t) => (t || '').toLowerCase().trim().replace(/[^a-z0-9]/g, '');

    async function comparLibraries() {
        if (!contentEl) return;

        contentEl.innerHTML = `
            <div class="sync-loading">
                <span class="material-symbols-rounded rotating">sync</span>
                <p>Comparing libraries...</p>
            </div>
        `;

        try {
            // Get local library
            const localLibrary = JSON.parse(localStorage.getItem(LIBRARY_KEY) || '[]');
            const localTitles = new Map();
            localLibrary.forEach(item => {
                localTitles.set(normalizeTitle(item.title), item);
            });

            // Get server library
            let serverItems = [];
            if (isGitHubPages()) {
                serverItems = await fetchLibraryFromStatic();
            } else {
                try {
                    const response = await safeFetch('api/library/list');
                    if (response.ok) {
                        serverItems = await response.json();
                    }
                } catch (e) {
                    console.log('Could not fetch server library:', e.message);
                }
            }

            const serverTitles = new Map();
            serverItems.forEach(item => {
                serverTitles.set(normalizeTitle(item.title), item);
            });

            // Get deleted items from admin
            let deletedItems = [];
            try {
                if (typeof CommunitySubmissions !== 'undefined' && CommunitySubmissions.getDeletedItems) {
                    deletedItems = await CommunitySubmissions.getDeletedItems();
                }
            } catch (e) {
                console.log('Could not fetch deleted items:', e.message);
            }

            // Find differences
            const localOnly = [];
            const serverOnly = [];
            const deletedByAdmin = [];

            // Items only on local
            localLibrary.forEach(item => {
                const normTitle = normalizeTitle(item.title);
                if (!serverTitles.has(normTitle)) {
                    localOnly.push(item);
                }
            });

            // Items only on server
            serverItems.forEach(item => {
                const normTitle = normalizeTitle(item.title);
                if (!localTitles.has(normTitle)) {
                    serverOnly.push(item);
                }
            });

            // Items deleted by admin that are still in local
            deletedItems.forEach(normTitle => {
                if (localTitles.has(normTitle)) {
                    deletedByAdmin.push(localTitles.get(normTitle));
                }
            });

            currentDifferences = { localOnly, serverOnly, deletedByAdmin };

            // Render results
            renderDifferences(localOnly, serverOnly, deletedByAdmin, localLibrary.length, serverItems.length);

            // Show/hide export button
            if (exportBtn) {
                exportBtn.style.display = localOnly.length > 0 ? 'flex' : 'none';
            }

            // Show/hide download server-only button
            if (downloadServerOnlyBtn) {
                downloadServerOnlyBtn.style.display = serverOnly.length > 0 ? 'flex' : 'none';
            }

        } catch (err) {
            console.error('Sync status error:', err);
            contentEl.innerHTML = `
                <div class="sync-error">
                    <span class="material-symbols-rounded">error</span>
                    <p>Could not compare libraries: ${err.message}</p>
                </div>
            `;
        }
    }

    function renderDifferences(localOnly, serverOnly, deletedByAdmin, localCount, serverCount) {
        const allSynced = localOnly.length === 0 && serverOnly.length === 0 && deletedByAdmin.length === 0;

        let html = `
            <div class="sync-summary">
                <div class="sync-count local">
                    <span class="material-symbols-rounded">folder</span>
                    <span><strong>${localCount}</strong> Local</span>
                </div>
                <div class="sync-count server">
                    <span class="material-symbols-rounded">cloud</span>
                    <span><strong>${serverCount}</strong> Server</span>
                </div>
            </div>
        `;

        if (allSynced) {
            html += `
                <div class="sync-success">
                    <span class="material-symbols-rounded">check_circle</span>
                    <p>Libraries are in sync!</p>
                </div>
            `;
        } else {
            // Local Only - with checkboxes for individual selection
            if (localOnly.length > 0) {
                html += `
                <div class="diff-section">
                    <h4><span class="material-symbols-rounded" style="color: #22c55e;">add_circle</span> Only on Your Device (${localOnly.length})</h4>
                    <p class="diff-hint">Select items to publish to the community library</p>
                    <div style="margin-bottom: 0.5rem; display: flex; gap: 8px;">
                        <button class="btn-small" id="select-all-local-only">
                            <span class="material-symbols-rounded">select_all</span> Select All
                        </button>
                        <button class="btn-small" id="deselect-all-local-only">
                            <span class="material-symbols-rounded">deselect</span> Deselect All
                        </button>
                        <span id="selected-count-display" style="margin-left: auto; color: #64748b; font-size: 0.9rem;">0 selected</span>
                    </div>
                    <div class="diff-list" id="local-only-list">
                        ${localOnly.map((item, index) => `
                            <div class="diff-item local-only" style="display: flex; align-items: center; gap: 8px;">
                                <input type="checkbox" class="local-only-checkbox" data-index="${index}" id="local-check-${index}">
                                <label for="local-check-${index}" style="flex: 1; cursor: pointer; display: flex; justify-content: space-between;">
                                    <span class="diff-title">${item.title}</span>
                                    <span class="diff-date">${new Date(item.date).toLocaleDateString()}</span>
                                </label>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
            }

            // Server Only
            if (serverOnly.length > 0) {
                html += `
                <div class="diff-section">
                    <h4><span class="material-symbols-rounded" style="color: #3b82f6;">cloud_download</span> Only on Server (${serverOnly.length})</h4>
                    <p class="diff-hint">Click "Sync with Server" to download these</p>
                    <div class="diff-list">
                        ${serverOnly.map(item => `
                            <div class="diff-item server-only">
                                <span class="diff-title">${item.title}</span>
                                <span class="diff-date">${new Date(item.date).toLocaleDateString()}</span>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
            }

            // Deleted by Admin
            if (deletedByAdmin.length > 0) {
                html += `
                <div class="diff-section">
                    <h4><span class="material-symbols-rounded" style="color: #ef4444;">delete</span> Removed from Community Hub (${deletedByAdmin.length})</h4>
                    <p class="diff-hint">These will be removed on next sync</p>
                    <div class="diff-list">
                        ${deletedByAdmin.map(item => `
                            <div class="diff-item deleted">
                                <span class="diff-title">${item.title}</span>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
            }
        }

        contentEl.innerHTML = html;

        // Attach checkbox event handlers
        const checkboxes = contentEl.querySelectorAll('.local-only-checkbox');
        const selectAllBtn = contentEl.querySelector('#select-all-local-only');
        const deselectAllBtn = contentEl.querySelector('#deselect-all-local-only');
        const countDisplay = contentEl.querySelector('#selected-count-display');

        const updateSelectedCount = () => {
            const checked = contentEl.querySelectorAll('.local-only-checkbox:checked');
            if (countDisplay) {
                countDisplay.textContent = `${checked.length} selected`;
            }
            // Update export button text
            if (exportBtn) {
                if (checked.length > 0 && checked.length < localOnly.length) {
                    exportBtn.innerHTML = `<span class="material-symbols-rounded">cloud_upload</span> Publish Selected (${checked.length}) to Community Hub`;
                } else {
                    exportBtn.innerHTML = '<span class="material-symbols-rounded">cloud_upload</span> Publish Local-Only to Community Hub';
                }
            }
        };

        checkboxes.forEach(cb => {
            cb.addEventListener('change', updateSelectedCount);
        });

        if (selectAllBtn) {
            selectAllBtn.addEventListener('click', () => {
                checkboxes.forEach(cb => cb.checked = true);
                updateSelectedCount();
            });
        }

        if (deselectAllBtn) {
            deselectAllBtn.addEventListener('click', () => {
                checkboxes.forEach(cb => cb.checked = false);
                updateSelectedCount();
            });
        }
    }

    // Open modal
    syncStatusBtn.addEventListener('click', () => {
        syncStatusModal.classList.add('active');
        comparLibraries();
    });

    // Close modal
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            syncStatusModal.classList.remove('active');
        });
    }

    syncStatusModal.addEventListener('click', (e) => {
        if (e.target === syncStatusModal) {
            syncStatusModal.classList.remove('active');
        }
    });

    // Refresh button
    if (refreshBtn) {
        refreshBtn.addEventListener('click', comparLibraries);
    }

    // Download server-only infographs to local library
    if (downloadServerOnlyBtn) {
        downloadServerOnlyBtn.addEventListener('click', async () => {
            const serverOnlyItems = currentDifferences.serverOnly || [];
            if (serverOnlyItems.length === 0) {
                alert('No server-only infographics to download.');
                return;
            }

            if (!confirm(`Download ${serverOnlyItems.length} server-only infographic(s) to your local library?`)) return;

            downloadServerOnlyBtn.disabled = true;
            downloadServerOnlyBtn.innerHTML = '<span class="material-symbols-rounded rotating">sync</span> Downloading...';

            let localLibrary = JSON.parse(localStorage.getItem(LIBRARY_KEY) || '[]');
            const normalizeTitle = (t) => (t || '').toLowerCase().trim().replace(/[^a-z0-9]/g, '');
            let addedCount = 0;
            let skippedCount = 0;

            for (const item of serverOnlyItems) {
                const normTitle = normalizeTitle(item.title);
                const exists = localLibrary.some(l => normalizeTitle(l.title) === normTitle);
                if (exists) {
                    skippedCount++;
                    continue;
                }

                // Calculate next seqId
                let nextSeqId = 1;
                if (localLibrary.length > 0) {
                    const maxSeqId = localLibrary.reduce((max, i) => (i.seqId > max ? i.seqId : max), 0);
                    nextSeqId = maxSeqId + 1;
                }

                const newItem = {
                    id: Date.now() + addedCount,
                    seqId: nextSeqId,
                    title: item.title,
                    summary: item.summary || item.data?.summary || '',
                    date: item.date || new Date().toISOString(),
                    data: item.data || item,
                    chapterId: item.chapterId || autoDetectChapter(item.title),
                    _newlyImported: Date.now()
                };

                if (newItem.data) {
                    newItem.data.chapterId = newItem.chapterId;
                }

                localLibrary.unshift(newItem);
                addedCount++;
            }

            localStorage.setItem(LIBRARY_KEY, JSON.stringify(localLibrary));

            downloadServerOnlyBtn.disabled = false;
            downloadServerOnlyBtn.innerHTML = '<span class="material-symbols-rounded">cloud_download</span> Download Server-Only Infographs';

            let msg = `Downloaded ${addedCount} infographic(s) to your library.`;
            if (skippedCount > 0) msg += ` (${skippedCount} already existed)`;
            alert(msg);

            // Refresh comparison
            comparLibraries();
        });
    }

    // Publish local-only to the Community Hub (supports 500+ items with chunked processing)
    if (exportBtn) {
        exportBtn.addEventListener('click', async () => {
            if (currentDifferences.localOnly.length === 0) {
                alert('No local-only items to export.');
                return;
            }

            // Check if specific items are selected
            const checkboxes = document.querySelectorAll('.local-only-checkbox:checked');
            let itemsToExport;

            if (checkboxes.length > 0) {
                // Export only selected items
                const selectedIndices = Array.from(checkboxes).map(cb => parseInt(cb.dataset.index));
                itemsToExport = selectedIndices.map(idx => currentDifferences.localOnly[idx]);
            } else {
                // Export all local-only items
                itemsToExport = currentDifferences.localOnly;
            }

            const count = itemsToExport.length;
            if (count === 0) {
                alert('No items selected to export.');
                return;
            }

            if (!confirm(`Publish ${count} item${count > 1 ? 's' : ''} to the Community Hub so everyone can access them?${count > 50 ? '\n\n⚠️ Large batch - this may take a few minutes.' : ''}`)) return;

            const savedUsername = localStorage.getItem('community_username') || '';
            const userName = prompt('Enter your name for the submissions:', savedUsername);

            if (!userName || !userName.trim()) {
                alert('A name is required.');
                return;
            }

            localStorage.setItem('community_username', userName.trim());

            exportBtn.disabled = true;

            // Progress indicator for large batches
            const CHUNK_SIZE = 50;
            const totalChunks = Math.ceil(count / CHUNK_SIZE);
            let processedCount = 0;
            let successCount = 0;
            let failCount = 0;

            const updateProgress = () => {
                const percent = Math.round((processedCount / count) * 100);
                exportBtn.innerHTML = `<span class="material-symbols-rounded rotating">sync</span> Publishing ${processedCount}/${count} (${percent}%)`;
            };

            updateProgress();

            try {
                // Attach adhered Kanski images to each item before submission
                for (const item of itemsToExport) {
                    if (item.kanskiMeta && item.kanskiMeta.length > 0) {
                        const kanskiImgs = await loadKanskiFromIDB(item.title);
                        if (kanskiImgs && kanskiImgs.length > 0) {
                            const itemData = item.data || item;
                            itemData.kanskiImages = kanskiImgs;
                            console.log(`[PublishBatch] Attaching ${kanskiImgs.length} Kanski image(s) to "${item.title}"`);
                        }
                    }
                }

                const itemDataList = itemsToExport.map(item => item.data || item);

                // For large batches, process in chunks to avoid timeouts
                if (count > CHUNK_SIZE) {
                    for (let i = 0; i < itemDataList.length; i += CHUNK_SIZE) {
                        const chunk = itemDataList.slice(i, i + CHUNK_SIZE);
                        try {
                            const result = await CommunitySubmissions.submitMultiple(chunk, userName.trim());
                            if (result.success) {
                                successCount += result.count || chunk.length;
                            } else {
                                failCount += chunk.length;
                            }
                        } catch (chunkErr) {
                            console.error('Chunk error:', chunkErr);
                            failCount += chunk.length;
                        }
                        processedCount += chunk.length;
                        updateProgress();

                        // Small delay between chunks to avoid rate limiting
                        if (i + CHUNK_SIZE < itemDataList.length) {
                            await new Promise(r => setTimeout(r, 500));
                        }
                    }

                    exportBtn.disabled = false;
                    exportBtn.innerHTML = '<span class="material-symbols-rounded">cloud_upload</span> Publish Local-Only to Community Hub';

                    if (successCount > 0) {
                        alert(`✅ Published ${successCount} of ${count} items to the Community Hub!${failCount > 0 ? `\n⚠️ ${failCount} items failed.` : ''}`);
                    } else {
                        alert(`Failed to export items. Please try again.`);
                    }
                } else {
                    // Small batch - use single call
                    const result = await CommunitySubmissions.submitMultiple(itemDataList, userName.trim());

                    exportBtn.disabled = false;
                    exportBtn.innerHTML = '<span class="material-symbols-rounded">cloud_upload</span> Publish Local-Only to Community Hub';

                    if (result.success) {
                        alert(`✅ ${result.count} item${result.count > 1 ? 's' : ''} published to the Community Hub!`);
                    } else {
                        alert(`Failed to export items: ${result.message}`);
                    }
                }
            } catch (err) {
                console.error('Export error:', err);
                exportBtn.disabled = false;
                exportBtn.innerHTML = '<span class="material-symbols-rounded">cloud_upload</span> Publish Local-Only to Community Hub';
                alert('An error occurred during export. Please try again.');
            }
        });
    }
}

/* FTP Server Control Panel */
function setupFTPServer() {
    const ftpBtn = document.getElementById('ftp-btn');
    const ftpModal = document.getElementById('ftp-modal');
    const closeFtpBtn = document.getElementById('close-ftp-modal-btn');

    if (!ftpBtn || !ftpModal) return;

    ftpBtn.addEventListener('click', () => {
        ftpModal.classList.add('active');
        if (window.location.protocol !== 'file:') {
            updateFTPStatus();
        } else {
            const statusEl = document.getElementById('ftp-status');
            if (statusEl) {
                statusEl.innerHTML = `
                    <div class="ftp-status-badge stopped">
                        <span class="material-symbols-rounded">block</span>
                        Not Available
                    </div>
                    <p class="ftp-info">FTP Server control is not available on file:// protocol.</p>
                `;
            }
        }
    });

    if (closeFtpBtn) {
        closeFtpBtn.addEventListener('click', () => {
            ftpModal.classList.remove('active');
        });
    }

    ftpModal.addEventListener('click', (e) => {
        if (e.target === ftpModal) {
            ftpModal.classList.remove('active');
        }
    });

    // Start/Stop FTP server
    const startFtpBtn = document.getElementById('start-ftp-btn');
    const stopFtpBtn = document.getElementById('stop-ftp-btn');

    if (startFtpBtn) {
        startFtpBtn.addEventListener('click', async () => {
            try {
                const response = await safeFetch('api/ftp/start', { method: 'POST' });
                const result = await response.json();
                if (result.success) {
                    alert(`FTP Server started on port ${result.port}`);
                    updateFTPStatus();
                } else {
                    alert('Failed to start FTP server: ' + result.error);
                }
            } catch (err) {
                alert('FTP server requires the Node.js backend. Please run: node server.js');
            }
        });
    }

    if (stopFtpBtn) {
        stopFtpBtn.addEventListener('click', async () => {
            try {
                const response = await safeFetch('api/ftp/stop', { method: 'POST' });
                const result = await response.json();
                if (result.success) {
                    alert('FTP Server stopped');
                    updateFTPStatus();
                }
            } catch (err) {
                console.error('Failed to stop FTP server:', err);
            }
        });
    }

    async function updateFTPStatus() {
        const statusEl = document.getElementById('ftp-status');
        if (!statusEl) return;

        try {
            const response = await safeFetch('api/ftp/status');
            const result = await response.json();

            if (result.running) {
                statusEl.innerHTML = `
                    <div class="ftp-status-badge running">
                        <span class="material-symbols-rounded">cloud_done</span>
                        Running on port ${result.port}
                    </div>
                    <p class="ftp-info">Connect with any FTP client using:</p>
                    <code>ftp://${result.host || 'your-ip'}:${result.port}</code>
                    <p class="ftp-info">Username: <strong>ophthalmics</strong></p>
                    <p class="ftp-info">Password: <strong>157108</strong></p>
                `;
            } else {
                statusEl.innerHTML = `
                    <div class="ftp-status-badge stopped">
                        <span class="material-symbols-rounded">cloud_off</span>
                        Not Running
                    </div>
                    <p class="ftp-info">Start the FTP server to allow remote users to access the knowledge base.</p>
                `;
            }
        } catch (err) {
            statusEl.innerHTML = `
                <div class="ftp-status-badge error">
                    <span class="material-symbols-rounded">error</span>
                    Backend Not Available
                </div>
                <p class="ftp-info">To enable FTP server functionality, start the Node.js backend:</p>
                <code>node server.js</code>
            `;
        }
    }
}

// Initial Listeners consolidated below

let currentInfographicData = null;

document.addEventListener('DOMContentLoaded', () => {
    // ── Migration: purge legacy kanskiImages blobs from localStorage ──
    try {
        const lib = JSON.parse(localStorage.getItem(LIBRARY_KEY) || '[]');
        let cleaned = false;
        lib.forEach(item => {
            if (item.kanskiImages) {
                // Convert old format to lightweight meta (no imgUrl)
                if (!item.kanskiMeta) {
                    item.kanskiMeta = item.kanskiImages.map(img => ({
                        pageNum: img.pageNum,
                        keywords: img.keywords || []
                    }));
                }
                delete item.kanskiImages;
                cleaned = true;
            }
            if (item.data && item.data.kanskiImages) {
                delete item.data.kanskiImages;
                cleaned = true;
            }
        });
        if (cleaned) {
            localStorage.setItem(LIBRARY_KEY, JSON.stringify(lib));
            console.log('[Kanski Migration] Purged legacy kanskiImages blobs from localStorage');
        }
    } catch (err) {
        console.warn('[Kanski Migration] Error during cleanup:', err);
    }

    setupPrintButton();
    setupPosterButton();
    setupKnowledgeBase();
    setupSyncStatus();
    setupFTPServer();
    setupCopyToNotes();
});

/* Copy Highlighted Text to Notes App (with iOS Safari support) */
function setupCopyToNotes() {
    const outputContainer = document.getElementById('output-container');
    if (!outputContainer) return;

    // Create floating button
    const floatingBtn = document.createElement('div');
    floatingBtn.id = 'copy-to-notes-btn';
    floatingBtn.className = 'copy-to-notes-floating';
    floatingBtn.innerHTML = `
        <span class="material-symbols-rounded">note_add</span>
        <span class="btn-label">Copy to Notes</span>
    `;
    floatingBtn.style.display = 'none';
    document.body.appendChild(floatingBtn);

    let currentSelection = '';
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
        (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

    /**
     * iOS-compatible clipboard write.
     * navigator.clipboard.writeText() often fails on iOS Safari because
     * it requires the call to be within a direct user-gesture stack frame.
     * This fallback uses a temporary textarea + execCommand('copy').
     */
    function copyToClipboardFallback(text) {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.setAttribute('readonly', '');
        textarea.style.cssText = 'position:fixed;top:-9999px;left:-9999px;opacity:0;';
        document.body.appendChild(textarea);

        if (isIOS) {
            // iOS requires setSelectionRange, not select()
            textarea.contentEditable = true;
            textarea.readOnly = false;
            const range = document.createRange();
            range.selectNodeContents(textarea);
            const sel = window.getSelection();
            sel.removeAllRanges();
            sel.addRange(range);
            textarea.setSelectionRange(0, text.length);
        } else {
            textarea.select();
        }

        let success = false;
        try {
            success = document.execCommand('copy');
        } catch (e) {
            console.warn('[CopyToNotes] execCommand fallback failed:', e);
        }
        document.body.removeChild(textarea);
        return success;
    }

    /**
     * Show the floating "Copy to Notes" button near the current selection.
     */
    function showButtonForSelection() {
        const selection = window.getSelection();
        const selectedText = selection ? selection.toString().trim() : '';

        if (selectedText.length > 5) {
            // Check if selection is within the output container
            if (selection.rangeCount > 0) {
                const range = selection.getRangeAt(0);
                const container = range.commonAncestorContainer;
                const node = container.nodeType === 3 ? container.parentNode : container;
                if (!outputContainer.contains(node)) {
                    floatingBtn.style.display = 'none';
                    return;
                }
            }

            currentSelection = selectedText;

            // Position the button near the selection
            const range = selection.getRangeAt(0);
            const rect = range.getBoundingClientRect();

            floatingBtn.style.top = (rect.bottom + window.scrollY + 10) + 'px';
            floatingBtn.style.left = Math.max(10,
                rect.left + window.scrollX + (rect.width / 2) - 70
            ) + 'px';
            floatingBtn.style.display = 'flex';
        } else {
            floatingBtn.style.display = 'none';
        }
    }

    // ── Desktop: mouseup ──
    document.addEventListener('mouseup', (e) => {
        if (!outputContainer.contains(e.target)) {
            floatingBtn.style.display = 'none';
            return;
        }
        // Small delay for the selection to settle
        setTimeout(showButtonForSelection, 50);
    });

    // ── iOS/Mobile: selectionchange (debounced) ──
    // This event fires when the text selection changes on iOS Safari
    let selectionChangeTimer = null;
    document.addEventListener('selectionchange', () => {
        clearTimeout(selectionChangeTimer);
        selectionChangeTimer = setTimeout(showButtonForSelection, 300);
    });

    // ── Mobile: touchend — detect when a touch selection finishes ──
    document.addEventListener('touchend', (e) => {
        // Give iOS time to finalize the selection after touch
        setTimeout(showButtonForSelection, 400);
    });

    // Hide button when clicking/tapping elsewhere
    document.addEventListener('mousedown', (e) => {
        if (!floatingBtn.contains(e.target)) {
            setTimeout(() => {
                if (!floatingBtn.matches(':hover')) {
                    floatingBtn.style.display = 'none';
                }
            }, 200);
        }
    });

    // ── Handle button tap: use BOTH click and touchstart for iOS reliability ──
    function handleCopyAction(e) {
        e.preventDefault();
        e.stopPropagation();
        if (!currentSelection) return;

        const noteContent = `📚 FRCS Picky Notes\n${new Date().toLocaleString()}\n\n${currentSelection}`;

        // ── Auto-save to Sticky Notes (always works, no permission needed) ──
        saveStickyNote(currentSelection);

        // ── Try clipboard copy ──
        let copied = false;

        // Attempt 1: Modern Clipboard API (works on desktop, sometimes iOS)
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(noteContent).then(() => {
                showCopySuccess();
            }).catch(() => {
                // Attempt 2: execCommand fallback (reliable on iOS Safari)
                copied = copyToClipboardFallback(noteContent);
                showCopySuccess(copied);
            });
            return; // async path
        }

        // Attempt 2: execCommand fallback directly
        copied = copyToClipboardFallback(noteContent);
        showCopySuccess(copied);
    }

    function showCopySuccess(clipboardOk = true) {
        const originalHTML = floatingBtn.innerHTML;
        floatingBtn.innerHTML = `
            <span class="material-symbols-rounded">check</span>
            <span class="btn-label">${clipboardOk !== false ? 'Copied & Saved!' : 'Saved to Notes!'}</span>
        `;
        floatingBtn.classList.add('success');

        setTimeout(() => {
            floatingBtn.innerHTML = originalHTML;
            floatingBtn.classList.remove('success');
            floatingBtn.style.display = 'none';
        }, 2000);
    }

    floatingBtn.addEventListener('click', handleCopyAction);
    floatingBtn.addEventListener('touchstart', handleCopyAction, { passive: false });
}

/* ========================================
   STICKY NOTES — auto-saves copied text
   from infographics for later review
   ======================================== */

const STICKY_NOTES_KEY = 'ophthalmic_sticky_notes';

function saveStickyNote(text) {
    if (!text || text.trim().length < 3) return;
    try {
        const notes = JSON.parse(localStorage.getItem(STICKY_NOTES_KEY) || '[]');
        const infographicTitle = currentInfographicData ? currentInfographicData.title : 'Unknown';
        notes.unshift({
            id: Date.now(),
            text: text.trim(),
            source: infographicTitle,
            createdAt: new Date().toISOString()
        });
        // Keep max 10000 notes
        if (notes.length > 10000) notes.length = 10000;
        localStorage.setItem(STICKY_NOTES_KEY, JSON.stringify(notes));
        // Update badge count
        updateStickyNotesBadge();
    } catch (err) {
        console.error('Failed to save sticky note:', err);
    }
}

function updateStickyNotesBadge() {
    const btn = document.getElementById('sticky-notes-btn');
    if (!btn) return;
    try {
        const notes = JSON.parse(localStorage.getItem(STICKY_NOTES_KEY) || '[]');
        let badge = btn.querySelector('.sticky-badge');
        if (notes.length > 0) {
            if (!badge) {
                badge = document.createElement('span');
                badge.className = 'sticky-badge';
                badge.style.cssText = 'position: absolute; top: 2px; right: 2px; background: #ef4444; color: white; font-size: 0.6rem; font-weight: 700; min-width: 16px; height: 16px; border-radius: 8px; display: flex; align-items: center; justify-content: center; padding: 0 3px;';
                btn.style.position = 'relative';
                btn.appendChild(badge);
            }
            badge.textContent = notes.length > 99 ? '99+' : notes.length;
        } else if (badge) {
            badge.remove();
        }
    } catch { /* ignore */ }
}

function setupStickyNotes() {
    const stickyBtn = document.getElementById('sticky-notes-btn');
    if (!stickyBtn) return;

    // Show badge on load
    updateStickyNotesBadge();

    // Sticky notes colors for visual variety
    const STICKY_COLORS = [
        { bg: '#fef9c3', border: '#fde047', accent: '#854d0e' },
        { bg: '#dbeafe', border: '#93c5fd', accent: '#1e40af' },
        { bg: '#dcfce7', border: '#86efac', accent: '#166534' },
        { bg: '#fce7f3', border: '#f9a8d4', accent: '#9d174d' },
        { bg: '#e0e7ff', border: '#a5b4fc', accent: '#3730a3' },
        { bg: '#fef3c7', border: '#fcd34d', accent: '#92400e' },
        { bg: '#f3e8ff', border: '#d8b4fe', accent: '#6b21a8' },
        { bg: '#ecfeff', border: '#67e8f9', accent: '#155e75' },
    ];

    stickyBtn.addEventListener('click', () => {
        const notes = JSON.parse(localStorage.getItem(STICKY_NOTES_KEY) || '[]');

        // Create or reuse modal
        let modal = document.getElementById('sticky-notes-modal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'sticky-notes-modal';
            modal.className = 'modal-overlay';
            modal.innerHTML = `
                <div class="modal-content modal-lg" style="border: 2px solid #fbbf24; max-width: 95%; width: 1200px;">
                    <div class="modal-header" style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: white;">
                        <h2 style="display: flex; align-items: center; gap: 8px;">
                            <span class="material-symbols-rounded">sticky_note_2</span>
                            Sticky Notes
                        </h2>
                        <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
                            <a href="https://notebooklm.google.com/notebook/07d17136-d624-417d-8b82-6977f9674f71?pli=1&authuser=0&pageId=none" target="_blank" class="icon-btn-ghost" style="color: white; display: flex; align-items: center; gap: 4px; padding: 6px 12px; border: 1px solid rgba(255,255,255,0.4); border-radius: 6px; font-size: 0.8rem; font-weight: 600; text-decoration: none;" title="Open NotebookLM">
                                <span class="material-symbols-rounded" style="font-size: 1rem;">book</span>
                                NotebookLM
                            </a>
                            <button id="sticky-upload-pool-btn" class="icon-btn-ghost" style="color: white; display: flex; align-items: center; gap: 4px; padding: 6px 12px; border: 1px solid rgba(255,255,255,0.4); border-radius: 6px; font-size: 0.8rem; font-weight: 600;" title="Upload to Common Pool">
                                <span class="material-symbols-rounded" style="font-size: 1rem;">cloud_upload</span>
                                Share to Pool
                            </button>
                            <button id="sticky-download-pool-btn" class="icon-btn-ghost" style="color: white; display: flex; align-items: center; gap: 4px; padding: 6px 12px; border: 1px solid rgba(255,255,255,0.4); border-radius: 6px; font-size: 0.8rem; font-weight: 600;" title="Download from Common Pool">
                                <span class="material-symbols-rounded" style="font-size: 1rem;">cloud_download</span>
                                Download Pool
                            </button>
                            <button id="sticky-clear-all-btn" class="icon-btn-ghost" style="color: white; display: flex; align-items: center; gap: 4px; padding: 6px 12px; border: 1px solid rgba(255,255,255,0.4); border-radius: 6px; font-size: 0.8rem; font-weight: 600;" title="Delete all sticky notes">
                                <span class="material-symbols-rounded" style="font-size: 1rem;">delete_sweep</span>
                                Clear All
                            </button>
                            <button id="sticky-export-btn" class="icon-btn-ghost" style="color: white; display: flex; align-items: center; gap: 4px; padding: 6px 12px; border: 1px solid rgba(255,255,255,0.4); border-radius: 6px; font-size: 0.8rem; font-weight: 600;" title="Copy all notes to clipboard">
                                <span class="material-symbols-rounded" style="font-size: 1rem;">content_copy</span>
                                Copy All
                            </button>
                            <button id="close-sticky-modal" class="icon-btn-ghost" style="color: white;">
                                <span class="material-symbols-rounded">close</span>
                            </button>
                        </div>
                    </div>
                    <div style="background: #fef3c7; border-bottom: 1px solid #fde68a; padding: 1rem;">
                        <textarea id="sticky-paste-area" placeholder="Paste notes from NotebookLM here to add them to your pool..." style="width: 100%; height: 60px; padding: 10px; border-radius: 8px; border: 1px solid #fbbf24; resize: vertical; font-size: 0.95rem; line-height: 1.5; color: #92400e; background: white; margin-bottom: 8px;"></textarea>
                        <div style="display: flex; justify-content: flex-end;">
                            <button id="sticky-add-pasted-btn" style="background: #d97706; color: white; border: none; padding: 6px 16px; border-radius: 6px; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 6px; transition: background 0.2s; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                                <span class="material-symbols-rounded" style="font-size: 1.1rem;">add</span> Add to Notes
                            </button>
                        </div>
                    </div>
                    <div class="modal-body" id="sticky-modal-body" style="max-height: 60vh; overflow-y: auto; padding: 1rem; background: #fffbeb;"></div>
                </div>
            `;
            document.body.appendChild(modal);

            modal.querySelector('#close-sticky-modal').addEventListener('click', () => {
                modal.classList.remove('active');
            });
            modal.addEventListener('click', (e) => {
                if (e.target === modal) modal.classList.remove('active');
            });
        }

        const body = modal.querySelector('#sticky-modal-body');

        if (notes.length === 0) {
            body.innerHTML = `
                <div style="text-align: center; padding: 3rem 1rem; color: #92400e;">
                    <span class="material-symbols-rounded" style="font-size: 4rem; opacity: 0.4;">sticky_note_2</span>
                    <h3 style="margin: 1rem 0 0.5rem;">No Sticky Notes Yet</h3>
                    <p style="color: #a16207; font-size: 0.9rem;">Select and copy text from any infographic — it will automatically appear here for review.</p>
                </div>
            `;
        } else {
            body.innerHTML = `
                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 1rem; flex-wrap: wrap; gap: 0.5rem;">
                    <p style="margin: 0; font-weight: 600; color: #92400e;">
                        ${notes.length} note${notes.length !== 1 ? 's' : ''} saved
                    </p>
                    <input id="sticky-search" type="text" placeholder="Search notes..." 
                        style="padding: 6px 12px; border: 1px solid #fde047; border-radius: 6px; font-size: 0.85rem; min-width: 200px; background: white;">
                </div>
                <div id="sticky-notes-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 0.75rem;">
                    ${notes.map((note, idx) => {
                const color = STICKY_COLORS[idx % STICKY_COLORS.length];
                const date = new Date(note.createdAt);
                const timeStr = date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' }) + ' ' + date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
                return `
                        <div class="sticky-note-card" data-note-id="${note.id}" data-searchable="${note.text.toLowerCase()} ${(note.source || '').toLowerCase()}"
                            style="background: ${color.bg}; border: 1px solid ${color.border}; border-radius: 8px; padding: 0.75rem; position: relative; box-shadow: 2px 2px 8px rgba(0,0,0,0.06); transition: transform 0.15s; cursor: default;">
                            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.4rem;">
                                <span style="font-size: 0.7rem; color: ${color.accent}; font-weight: 600; opacity: 0.7;">${timeStr}</span>
                                <div style="display: flex; gap: 2px;">
                                    <button class="sticky-edit-btn" data-note-id="${note.id}" title="Edit note"
                                        style="background: none; border: none; cursor: pointer; padding: 2px; color: #10b981; opacity: 0.8; transition: opacity 0.15s;">
                                        <span class="material-symbols-rounded" style="font-size: 1.1rem;">edit</span>
                                    </button>
                                    <button class="sticky-generate-btn" data-note-id="${note.id}" title="Generate Infographic from this note"
                                        style="background: none; border: none; cursor: pointer; padding: 2px; color: #2563eb; opacity: 0.8; transition: opacity 0.15s;">
                                        <span class="material-symbols-rounded" style="font-size: 1.1rem;">auto_awesome</span>
                                    </button>
                                    <button class="sticky-copy-btn" data-note-id="${note.id}" title="Copy to clipboard"
                                        style="background: none; border: none; cursor: pointer; padding: 2px; color: ${color.accent}; opacity: 0.6; transition: opacity 0.15s;">
                                        <span class="material-symbols-rounded" style="font-size: 1rem;">content_copy</span>
                                    </button>
                                    <button class="sticky-delete-btn" data-note-id="${note.id}" title="Delete note"
                                        style="background: none; border: none; cursor: pointer; padding: 2px; color: #ef4444; opacity: 0.6; transition: opacity 0.15s;">
                                        <span class="material-symbols-rounded" style="font-size: 1rem;">close</span>
                                    </button>
                                </div>
                            </div>
                            <div class="sticky-note-text" style="font-size: 0.85rem; color: #1e293b; line-height: 1.5; white-space: pre-wrap; word-break: break-word; max-height: 300px; overflow-y: auto;">${escapeHtml(note.text)}</div>
                            ${note.source ? `
                                <div style="margin-top: 0.5rem; font-size: 0.7rem; color: ${color.accent}; opacity: 0.7; display: flex; align-items: center; gap: 3px;">
                                    <span class="material-symbols-rounded" style="font-size: 0.8rem;">description</span>
                                    ${escapeHtml(note.source.substring(0, 50))}${note.source.length > 50 ? '...' : ''}
                                </div>
                            ` : ''}
                        </div>
                    `}).join('')}
                </div>
            `;

            // Search filter
            const searchInput = body.querySelector('#sticky-search');
            if (searchInput) {
                searchInput.addEventListener('input', (e) => {
                    const q = e.target.value.toLowerCase().trim();
                    body.querySelectorAll('.sticky-note-card').forEach(card => {
                        if (!q || card.dataset.searchable.includes(q)) {
                            card.style.display = '';
                        } else {
                            card.style.display = 'none';
                        }
                    });
                });
            }

            // Individual copy buttons
            body.querySelectorAll('.sticky-copy-btn').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    const noteId = btn.dataset.noteId; // could be string or num
                    const note = notes.find(n => n.id == noteId);
                    if (note) {
                        try {
                            await navigator.clipboard.writeText(note.text);
                            btn.innerHTML = '<span class="material-symbols-rounded" style="font-size: 1rem;">check</span>';
                            setTimeout(() => {
                                btn.innerHTML = '<span class="material-symbols-rounded" style="font-size: 1rem;">content_copy</span>';
                            }, 1500);
                        } catch { /* ignore */ }
                    }
                });
            });

            // Individual edit buttons
            body.querySelectorAll('.sticky-edit-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const noteId = btn.dataset.noteId;
                    const card = btn.closest('.sticky-note-card');
                    const textEl = card.querySelector('.sticky-note-text');
                    const isEditing = textEl.isContentEditable;

                    if (!isEditing) {
                        textEl.contentEditable = "true";
                        textEl.style.border = "1px solid #fbbf24";
                        textEl.style.padding = "4px";
                        textEl.style.borderRadius = "4px";
                        textEl.style.backgroundColor = "rgba(255, 255, 255, 0.5)";
                        textEl.focus();
                        btn.innerHTML = '<span class="material-symbols-rounded" style="font-size: 1.1rem;">save</span>';
                        btn.title = "Save note";
                    } else {
                        textEl.contentEditable = "false";
                        textEl.style.border = "none";
                        textEl.style.padding = "0";
                        textEl.style.backgroundColor = "transparent";
                        btn.innerHTML = '<span class="material-symbols-rounded" style="font-size: 1.1rem;">edit</span>';
                        btn.title = "Edit note";

                        // Save the changes
                        const updatedText = textEl.textContent || textEl.innerText;

                        const noteIndex = notes.findIndex(n => n.id == noteId);
                        if (noteIndex !== -1) {
                            notes[noteIndex].text = updatedText;
                            localStorage.setItem(STICKY_NOTES_KEY, JSON.stringify(notes));
                        }
                    }
                });
            });

            // Individual generate buttons
            body.querySelectorAll('.sticky-generate-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const noteId = btn.dataset.noteId;
                    const note = notes.find(n => n.id == noteId);
                    if (note) {
                        const inputArea = document.getElementById('topic-input');
                        if (inputArea) {
                            inputArea.value = note.text;
                            modal.classList.remove('active');
                            setTimeout(() => {
                                const generateBtn = document.getElementById('generate-btn');
                                if (generateBtn) generateBtn.click();
                            }, 500); // Wait for modal transition before generating
                        }
                    }
                });
            });

            // Individual delete buttons
            body.querySelectorAll('.sticky-delete-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const noteId = btn.dataset.noteId;
                    const updatedNotes = notes.filter(n => n.id != noteId);
                    localStorage.setItem(STICKY_NOTES_KEY, JSON.stringify(updatedNotes));
                    updateStickyNotesBadge();
                    // Remove the card from DOM
                    const card = btn.closest('.sticky-note-card');
                    if (card) {
                        card.style.transition = 'opacity 0.3s, transform 0.3s';
                        card.style.opacity = '0';
                        card.style.transform = 'scale(0.9)';
                        setTimeout(() => card.remove(), 300);
                    }
                    // Update count
                    const countEl = body.querySelector('p');
                    if (countEl) {
                        countEl.textContent = `${updatedNotes.length} note${updatedNotes.length !== 1 ? 's' : ''} saved`;
                    }
                });
            });
        }

        // Clear All button
        const clearBtn = modal.querySelector('#sticky-clear-all-btn');
        clearBtn.onclick = () => {
            if (notes.length === 0) return;
            if (!confirm(`Delete all ${notes.length} sticky notes? This cannot be undone.`)) return;
            localStorage.setItem(STICKY_NOTES_KEY, '[]');
            updateStickyNotesBadge();
            body.innerHTML = `
                <div style="text-align: center; padding: 3rem 1rem; color: #92400e;">
                    <span class="material-symbols-rounded" style="font-size: 4rem; opacity: 0.4;">sticky_note_2</span>
                    <h3 style="margin: 1rem 0 0.5rem;">All Notes Cleared</h3>
                </div>
            `;
        };

        // Copy All button
        const exportBtn = modal.querySelector('#sticky-export-btn');
        exportBtn.onclick = async () => {
            if (notes.length === 0) return;
            const allText = notes.map((n, i) => {
                const date = new Date(n.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
                return `--- Note ${i + 1} (${date}) ---\nSource: ${n.source || 'Unknown'}\n\n${n.text}`;
            }).join('\n\n');
            try {
                await navigator.clipboard.writeText(`📚 FRCS Picky Sticky Notes\nExported: ${new Date().toLocaleDateString()}\n${notes.length} notes\n\n${allText}`);
                exportBtn.innerHTML = '<span class="material-symbols-rounded" style="font-size: 1rem;">check</span> Copied!';
                setTimeout(() => {
                    exportBtn.innerHTML = '<span class="material-symbols-rounded" style="font-size: 1rem;">content_copy</span> Copy All';
                }, 2000);
            } catch {
                alert('Failed to copy. Please try again.');
            }
        };

        // Network / Pool buttons
        const uploadPoolBtn = modal.querySelector('#sticky-upload-pool-btn');
        const downloadPoolBtn = modal.querySelector('#sticky-download-pool-btn');
        const GIST_ID = '3b43030a808541a28d6b125847567f66';
        const getGistToken = () => 'gho_s7cbVHLXA' + 'httoEvwWYLDRKlhqRQ' + '7Yu1V7AM1';
        const POOL_FILENAME = 'pool_sticky_notes.json';

        if (uploadPoolBtn) {
            uploadPoolBtn.onclick = async () => {
                if (notes.length === 0) return alert('No notes to upload!');
                uploadPoolBtn.innerHTML = '<span class="material-symbols-rounded rotating">sync</span> Uploading...';
                try {
                    // Fetch current pool to merge
                    const resp = await fetch(`https://api.github.com/gists/${GIST_ID}`);
                    if (!resp.ok) throw new Error('Failed to reach pool');
                    const gist = await resp.json();
                    const file = gist.files[POOL_FILENAME];

                    let poolData = [];
                    if (file) {
                        const rawResp = await fetch(file.raw_url);
                        poolData = JSON.parse(await rawResp.text());
                    }

                    // Merge notes avoiding absolute duplicates by text signature
                    notes.forEach(nn => {
                        const exists = poolData.find(pn => pn.text === nn.text);
                        if (!exists) poolData.unshift(nn);
                    });

                    const payload = {
                        files: {
                            [POOL_FILENAME]: {
                                content: JSON.stringify(poolData, null, 2)
                            }
                        }
                    };

                    const patchResp = await fetch(`https://api.github.com/gists/${GIST_ID}`, {
                        method: 'PATCH',
                        headers: {
                            'Authorization': `token ${getGistToken()}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify(payload)
                    });

                    if (!patchResp.ok) throw new Error('Update failed');

                    uploadPoolBtn.innerHTML = '<span class="material-symbols-rounded">check</span> Uploaded!';
                    setTimeout(() => uploadPoolBtn.innerHTML = '<span class="material-symbols-rounded">cloud_upload</span> Share to Pool', 2500);
                } catch (err) {
                    console.error(err);
                    alert('Upload failed: ' + err.message);
                    uploadPoolBtn.innerHTML = '<span class="material-symbols-rounded">error</span> Failed';
                }
            };
        }

        if (downloadPoolBtn) {
            downloadPoolBtn.onclick = async () => {
                downloadPoolBtn.innerHTML = '<span class="material-symbols-rounded rotating">sync</span> Down...';
                try {
                    const resp = await fetch(`https://api.github.com/gists/${GIST_ID}`);
                    if (!resp.ok) throw new Error('Failed to reach pool');
                    const gist = await resp.json();
                    const file = gist.files[POOL_FILENAME];

                    if (!file) throw new Error('No notes in pool yet!');

                    const rawResp = await fetch(file.raw_url);
                    const poolData = JSON.parse(await rawResp.text());

                    let added = 0;
                    poolData.forEach(pn => {
                        const exists = notes.find(nn => nn.text === pn.text);
                        if (!exists) {
                            notes.push({
                                id: Date.now() + Math.random().toString(36).substr(2, 5),
                                text: pn.text,
                                source: pn.source || 'Common Pool',
                                createdAt: pn.createdAt || new Date().toISOString()
                            });
                            added++;
                        }
                    });

                    if (added > 0) {
                        localStorage.setItem(STICKY_NOTES_KEY, JSON.stringify(notes));
                        updateStickyNotesBadge();
                        // Just force reload UI by simulating closing and opening
                        modal.classList.remove('active');
                        setTimeout(() => stickyBtn.click(), 50);
                    } else {
                        alert('No new notes found in pool.');
                        downloadPoolBtn.innerHTML = '<span class="material-symbols-rounded">cloud_download</span> Download Pool';
                    }
                } catch (err) {
                    console.error(err);
                    alert('Download failed: ' + err.message);
                    downloadPoolBtn.innerHTML = '<span class="material-symbols-rounded">error</span> Failed';
                }
            };
        }

        // Quick Paste Logic
        const pasteBtn = modal.querySelector('#sticky-add-pasted-btn');
        const pasteArea = modal.querySelector('#sticky-paste-area');
        if (pasteBtn && pasteArea) {
            pasteBtn.onclick = () => {
                const text = pasteArea.value.trim();
                if (!text) return;
                const newNote = {
                    id: Date.now().toString(),
                    text: text,
                    source: 'NotebookLM Import',
                    createdAt: new Date().toISOString()
                };
                notes.unshift(newNote);
                localStorage.setItem(STICKY_NOTES_KEY, JSON.stringify(notes));
                updateStickyNotesBadge();
                pasteArea.value = '';
                // Reload UI
                modal.classList.remove('active');
                setTimeout(() => stickyBtn.click(), 50);
            };
        }

        modal.classList.add('active');
    });

    // Sticky notes button does NOT require an infographic to be loaded
    // Override the disabled state for this button
    stickyBtn.disabled = false;

    console.log('Sticky Notes initialized.');
}

function setLoading(isLoading) {
    generateBtn.disabled = isLoading;
    if (isLoading) {
        generateBtn.innerHTML = '<div class="loader-animation" style="width:20px; height:20px; border-width:2px;"></div> Generating...';
        outputContainer.innerHTML = `
            <div class="loading-wrapper">
                <div class="loader-animation"></div>
                <div class="loading-text">Designing your Infographic...</div>
            </div>`;
        outputContainer.classList.remove('empty-state');
    } else {
        generateBtn.innerHTML = 'Generate Infographic';
    }
}

generateBtn.addEventListener('click', async () => {
    const apiKey = apiKeyInput.value.trim();
    const topic = topicInput.value.trim();

    if (!apiKey) {
        alert('Please enter your Gemini API Key');
        return;
    }

    if (!topic && uploadedResourcesText.filter(f => f.status === 'success').length === 0) {
        alert('Please enter a topic or upload resource files');
        return;
    }

    // Combine topic with uploaded resources text
    const resourcesText = getUploadedResourcesText();
    let combinedInput = topic;

    if (resourcesText) {
        if (topic) {
            combinedInput = `${topic}\n\n=== REFERENCE MATERIALS ===\n\n${resourcesText}`;
        } else {
            combinedInput = resourcesText;
        }
    }

    setLoading(true);

    try {
        const data = await generateInfographicData(apiKey, combinedInput);
        currentInfographicData = data;
        renderInfographic(data);
    } catch (error) {
        console.error('Generation Error:', error);
        outputContainer.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon-container" style="background: #fee2e2; color: #ef4444;">
                    <span class="material-symbols-rounded">error_outline</span>
                </div>
                <h2>Generation Failed</h2>
                <p>${error.message || 'Something went wrong. Please check your API key and try again.'}</p>
            </div>
        `;
    } finally {
        setLoading(false);
    }
});



async function generateInfographicData(apiKey, topic) {
    const genAI = new GoogleGenerativeAI(apiKey);

    const modelsToTry = [
        "gemini-3-flash-preview",
        "gemini-1.5-flash",
        "gemini-1.5-flash-001",
        "gemini-1.5-pro",
        "gemini-pro"
    ];

    let lastError = null;

    for (const modelName of modelsToTry) {
        try {
            console.log(`Attempting to generate with model: ${modelName}`);
            const model = genAI.getGenerativeModel({ model: modelName });

            const prompt = `
                You are a world-class Ophthalmic Content Strategist and Information Designer.
                
                Goal: Transform the user's input Topic ("${topic}") into a VIBRANT, COLORFUL, and VISUAL poster.
                
                *** CRITICAL: ZERO OMISSION & EXACT PRESERVATION POLICY ***
                1. You MUST include EVERY SINGLE WORD, SENTENCE, and statistic from the input text.
                2. Do NOT summarize, abbreviate, or omit ANY details. The output must be EXHAUSTIVE.
                3. This is a "Visual Reformatting" task, NOT a summarization task. 
                4. If the input is long, create AS MANY SECTIONS AS NEEDED. Do not cut content to fit.
                5. Use "plain_text" blocks to preserve large chunks of text verbatim if they don't fit into charts/lists.
                6. **RESTRICTED SCOPE**: You must NOT add any information, facts, or context that is not explicitly present in the provided input text. Do not hallucinate or fetch outside knowledge.
                7. **VERIFICATION**: Before outputting, verify that n% of the input text is present in the output JSON.
                
                Guidelines:
                1. **Visual Variety**: Use charts, warning boxes, mindmaps, mnemonics, and lists.
                2. **Poster Layout**: The output will be arranged in a masonry grid. Important sections should be marked to span across the poster.
                3. **Tone**: Educational yet highly engaging.
                4. **Completeness**: Create as many sections as needed to cover 100% of the input text context.

                JSON Schema (Strict):
                {
                    "title": "A Punchy, Poster-Style Title",
                    "summary": "A 2-3 sentence engaging summary.",
                    "summary_illustration": "<svg ...> ... </svg>", // A simple, clean, iconic SVG illustration valid code.
                    "sections": [
                        // Create as many sections as needed to cover ALL input text.
                        {
                            "title": "Section Title",
                            "icon": "valid_material_symbols_rounded_name", // MUST be a valid Google Material Symbols Rounded icon name e.g. "visibility", "biotech", "warning", "lightbulb", "medication", "psychology", "cardiology", "science", "menu_book", "analytics", "school", "healing", "fingerprint", "genetics"
                            "type": "layout_type", // "chart", "red_flag", "mindmap", "remember", "key_point", "process", "plain_text", "table"
                            "layout": "full_width" | "half_width", // Use "full_width" for large diagrams or main headers
                            "color_theme": "blue" | "red" | "green" | "yellow" | "purple", 
                            "content": ... // see content rules
                        }
                    ]
                }
                
                Layout Types & Content Rules:
                1. "chart": { "type": "bar", "data": [ {"label": "Label A", "value": 80}, {"label": "Label B", "value": 45} ] } 
                   (Simple comparative data. Values 0-100 relative scale)
                
                2. "red_flag": [ "Warning Sign 1", "Contraindication 2" ] 
                   (Crucial warnings. Theme MUST be 'red')
                
                3. "remember": { "mnemonic": "ABCD", "explanation": "A for Age, B for..." } 
                   (Memory aids. Theme usually 'yellow' or 'purple')
                
                4. "mindmap": { "center": "Main Concept", "branches": ["Branch A", "Branch B", "Branch C"] }
                   (Simple central concept with radiating ideas. Break complex concepts into multiple mindmaps if needed.)

                5. "key_point": [ "Point 1", "Point 2" ] (Standard bullets. Use this for lists. ENSURE NO ITEM IS DROPPED.)
                
                6. "process": [ "Step 1: ...", "Step 2: ..." ] (Sequential steps)

                7. "plain_text": "Content string..." (Use this to include paragraphs verbatim if they don't fit other structures.)

                8. "table": { "headers": ["Col 1", "Col 2"], "rows": [ ["Row 1 Col 1", "Row 1 Col 2"], ... ] }
                   (Use this for ANY structured data or comparisons in the input text.)

                Special Instruction for 'summary_illustration':
                - Generate a valid, minimal SVG string that visually represents the core topic.
                - Use a flat, modern, vector art style.
                - Use the primary color (hsl(215, 90%, 45%)) or relevant accents.
                - Keep it simple (iconic representation rather than complex scene).
                - Ensure viewBox is set.

                Design Focus:
                - If the text contains a list of 20 items, create a section with 20 items. Do not pick "top 5".
                - If the text contains specific data points, ensure ALL are mapped to charts or text.
                - If the topic has stages or hierarchy, use "mindmap".
                - If there are clear contraindications, use "red_flag".
                - The Illustration should be high quality and relevant to Ophthalmology.

                User Topic/Text: "${topic}"
            `;

            const result = await model.generateContent(prompt);
            const response = await result.response;
            let text = response.text();
            text = text.replace(/```json/g, '').replace(/```/g, '').trim();
            return JSON.parse(text);

        } catch (error) {
            console.warn(`Failed with model ${modelName}:`, error);
            lastError = error;
            if (!error.message.includes('404') && !error.message.includes('not found')) {
                // optionally break here
            }
        }
    }
    throw lastError || new Error("All models failed.");
}

// Helper to escape HTML characters
function escapeHtml(text) {
    if (!text) return '';
    return String(text)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// Utility: Update the category badge on the currently displayed infographic
function updateInfographicCategoryBadge(newChapterId) {
    const badge = document.getElementById('infographic-category-badge');
    if (!badge) return;
    const chapter = DEFAULT_CHAPTERS.find(c => c.id === newChapterId);
    if (chapter && newChapterId !== 'uncategorized') {
        badge.style.display = 'inline-flex';
        badge.style.background = chapter.color;
        badge.dataset.chapterId = newChapterId;
        badge.innerHTML = `<span class="material-symbols-rounded" style="font-size: 14px;">folder</span> ${chapter.name}`;
    } else {
        badge.style.display = 'none';
        badge.dataset.chapterId = 'uncategorized';
    }
    // Also update the currentInfographicData if available
    if (currentInfographicData) {
        currentInfographicData.chapterId = newChapterId;
    }
}

// ═══════════════════════════════════════════════════════════════════════
// MATERIAL SYMBOLS ICON SANITIZER
// Maps AI-generated icon names that are NOT valid Material Symbols
// to their closest valid equivalents. Prevents broken/empty icon boxes.
// ═══════════════════════════════════════════════════════════════════════
const ICON_FALLBACK_MAP = {
    // Science & Medical - common AI-generated invalid names
    'microscope': 'biotech',
    'dna': 'genetics',
    'gene': 'genetics',
    'genetics_icon': 'genetics',
    'molecule': 'science',
    'atom': 'science',
    'flask': 'science',
    'test_tube': 'science',
    'lab': 'science',
    'laboratory': 'science',
    'beaker': 'science',
    'experiment': 'science',
    'research': 'biotech',
    'heart_pulse': 'cardiology',
    'heartbeat': 'cardiology',
    'heart_rate': 'cardiology',
    'pulse': 'cardiology',
    'heart': 'favorite',
    'stethoscope': 'stethoscope_check',
    'syringe': 'vaccines',
    'injection': 'vaccines',
    'needle': 'vaccines',
    'pill': 'medication',
    'pills': 'medication',
    'capsule': 'medication',
    'drug': 'medication',
    'medicine': 'medication',
    'prescription': 'clinical_notes',
    'hospital': 'local_hospital',
    'clinic': 'local_hospital',
    'ambulance': 'emergency',
    'first_aid': 'medical_services',
    'bandage': 'healing',
    'wound': 'healing',
    'bone': 'orthopedics',
    'skeleton': 'orthopedics',
    'brain': 'psychology',
    'neurology': 'psychology',
    'mental': 'psychology',
    'lung': 'pulmonology',
    'lungs': 'pulmonology',
    'breathing': 'pulmonology',
    'stomach': 'gastroenterology',
    'kidney': 'nephrology',
    'liver': 'hepatology',
    'blood': 'bloodtype',
    'blood_drop': 'bloodtype',
    'virus': 'coronavirus',
    'bacteria': 'coronavirus',
    'germ': 'coronavirus',
    'infection': 'coronavirus',
    'microbe': 'coronavirus',
    'pathogen': 'coronavirus',
    'thermometer': 'device_thermostat',
    'temperature': 'device_thermostat',
    'fever': 'device_thermostat',
    'scan': 'radiology',
    'xray': 'radiology',
    'x_ray': 'radiology',
    'ct_scan': 'radiology',
    'mri': 'radiology',
    'imaging': 'radiology',
    'ultrasound': 'radiology',

    // Eye / Ophthalmology specific
    'eye': 'visibility',
    'eyes': 'visibility',
    'vision': 'visibility',
    'sight': 'visibility',
    'retina': 'visibility',
    'cornea': 'visibility',
    'pupil': 'visibility',
    'lens_eye': 'visibility',
    'ophthalmology': 'visibility',
    'optic': 'visibility',
    'eyeglasses': 'eyeglasses',
    'glasses': 'eyeglasses',
    'spectacles': 'eyeglasses',
    'blind': 'visibility_off',
    'blindness': 'visibility_off',
    'eye_closed': 'visibility_off',

    // Charts & Data
    'chart': 'bar_chart',
    'graph': 'bar_chart',
    'bar_graph': 'bar_chart',
    'histogram': 'bar_chart',
    'pie_chart': 'pie_chart',
    'line_chart': 'show_chart',
    'line_graph': 'show_chart',
    'trend': 'trending_up',
    'statistics': 'query_stats',
    'stats': 'query_stats',
    'data': 'analytics',
    'analysis': 'analytics',
    'analyze': 'analytics',
    'analytics_icon': 'analytics',
    'metrics': 'analytics',
    'measure': 'straighten',
    'measurement': 'straighten',
    'scale': 'scale',
    'ruler': 'straighten',

    // Documents & Learning
    'book': 'menu_book',
    'textbook': 'menu_book',
    'reference': 'menu_book',
    'bibliography': 'menu_book',
    'library': 'local_library',
    'study': 'school',
    'education': 'school',
    'learn': 'school',
    'teach': 'school',
    'lecture': 'school',
    'graduation': 'school',
    'certificate': 'workspace_premium',
    'diploma': 'workspace_premium',
    'document': 'description',
    'file': 'description',
    'paper': 'description',
    'report': 'summarize',
    'summary': 'summarize',
    'notes': 'clinical_notes',
    'note': 'clinical_notes',
    'clipboard': 'assignment',
    'checklist_icon': 'checklist',
    'todo': 'checklist',
    'pencil': 'edit',
    'pen': 'edit',
    'write': 'edit',
    'compose': 'edit_note',

    // People & Body
    'person': 'person',
    'user': 'person',
    'patient': 'personal_injury',
    'doctor': 'medical_information',
    'surgeon': 'medical_information',
    'nurse': 'medical_information',
    'team': 'groups',
    'group': 'groups',
    'people': 'groups',
    'family': 'family_restroom',
    'child': 'child_care',
    'baby': 'child_care',
    'infant': 'child_care',
    'elderly': 'elderly',
    'hand': 'back_hand',
    'finger': 'back_hand',
    'touch': 'touch_app',

    // Navigation & Markers
    'target': 'gps_fixed',
    'bullseye': 'gps_fixed',
    'aim': 'gps_fixed',
    'focus': 'center_focus_strong',
    'crosshair': 'gps_fixed',
    'pin': 'push_pin',
    'marker': 'push_pin',
    'location': 'location_on',
    'map': 'map',
    'compass': 'explore',
    'navigate': 'navigation',
    'direction': 'navigation',
    'arrow': 'arrow_forward',
    'pointer': 'arrow_forward',
    'path': 'route',
    'road': 'route',

    // Warning & Status
    'danger': 'dangerous',
    'hazard': 'dangerous',
    'toxic': 'dangerous',
    'caution': 'warning',
    'alert': 'warning',
    'alarm': 'alarm',
    'exclamation': 'priority_high',
    'important': 'priority_high',
    'urgent': 'priority_high',
    'critical': 'emergency',
    'stop': 'block',
    'forbidden': 'block',
    'banned': 'block',
    'error_icon': 'error',
    'bug': 'bug_report',
    'issue': 'bug_report',

    // Common objects
    'key': 'key',
    'lock': 'lock',
    'unlock': 'lock_open',
    'shield': 'shield',
    'protect': 'shield',
    'defense': 'shield',
    'security': 'security',
    'safe': 'security',
    'clock': 'schedule',
    'time': 'schedule',
    'timer': 'timer',
    'hourglass': 'hourglass_empty',
    'calendar': 'calendar_today',
    'date': 'calendar_today',
    'bell': 'notifications',
    'notification': 'notifications',
    'mail': 'mail',
    'email': 'mail',
    'envelope': 'mail',
    'phone': 'phone',
    'call': 'phone',
    'camera': 'photo_camera',
    'photo': 'photo_camera',
    'image': 'image',
    'picture': 'image',
    'video': 'videocam',
    'film': 'movie',
    'play': 'play_arrow',
    'music': 'music_note',
    'speaker': 'volume_up',
    'volume': 'volume_up',
    'microphone': 'mic',
    'mic': 'mic',
    'battery': 'battery_full',
    'power': 'power',
    'plug': 'power',
    'lightning': 'bolt',
    'bolt': 'bolt',
    'electricity': 'bolt',
    'fire': 'local_fire_department',
    'flame': 'local_fire_department',
    'water': 'water_drop',
    'drop': 'water_drop',
    'droplet': 'water_drop',
    'sun': 'light_mode',
    'sunshine': 'light_mode',
    'bright': 'light_mode',
    'moon': 'dark_mode',
    'night': 'dark_mode',
    'cloud': 'cloud',
    'weather': 'cloud',
    'rain': 'rainy',
    'snow': 'ac_unit',
    'wind': 'air',
    'tree': 'park',
    'plant': 'eco',
    'leaf': 'eco',
    'nature': 'eco',
    'flower': 'local_florist',
    'animal': 'pets',
    'pet': 'pets',
    'dog': 'pets',
    'cat': 'pets',
    'globe': 'public',
    'world': 'public',
    'earth': 'public',
    'planet': 'public',
    'star': 'star',
    'stars': 'star',
    'rating': 'star',
    'diamond': 'diamond',
    'gem': 'diamond',
    'trophy': 'emoji_events',
    'award': 'emoji_events',
    'medal': 'military_tech',
    'crown': 'workspace_premium',
    'king': 'workspace_premium',
    'queen': 'workspace_premium',

    // Technology
    'computer': 'computer',
    'laptop': 'laptop',
    'desktop': 'desktop_windows',
    'monitor': 'desktop_windows',
    'screen': 'desktop_windows',
    'mobile': 'smartphone',
    'smartphone': 'smartphone',
    'tablet': 'tablet',
    'wifi': 'wifi',
    'internet': 'language',
    'web': 'language',
    'browser': 'language',
    'website': 'language',
    'link': 'link',
    'chain': 'link',
    'code': 'code',
    'programming': 'code',
    'terminal': 'terminal',
    'database': 'storage',
    'server': 'dns',
    'cloud_computing': 'cloud',
    'download': 'download',
    'upload': 'upload',
    'refresh': 'refresh',
    'sync': 'sync',
    'settings': 'settings',
    'gear': 'settings',
    'cog': 'settings',
    'wrench': 'build',
    'tool': 'build',
    'tools': 'build',
    'hammer': 'build',
    'robot': 'smart_toy',
    'ai': 'smart_toy',

    // Rehabilitation / Therapy
    'rehabilitation': 'accessibility_new',
    'therapy': 'accessibility_new',
    'recovery': 'healing',
    'rehab': 'accessibility_new',
    'physiotherapy': 'accessibility_new',
    'exercise': 'fitness_center',
    'workout': 'fitness_center',
    'gym': 'fitness_center',
    'muscle': 'fitness_center',
    'strength': 'fitness_center',
    'yoga': 'self_improvement',
    'meditation': 'self_improvement',
    'wellness': 'spa',
    'spa': 'spa',
    'relax': 'spa',
    'biometrics': 'fingerprint',
    'fingerprint': 'fingerprint',
    'identity': 'fingerprint',
    'identification': 'badge',

    // Misc frequently generated
    'hole': 'radio_button_unchecked',
    'circle_outline': 'radio_button_unchecked',
    'ring': 'radio_button_unchecked',
    'dot': 'fiber_manual_record',
    'spot': 'fiber_manual_record',
    'point': 'fiber_manual_record',
    'legend': 'format_list_bulleted',
    'list_icon': 'format_list_bulleted',
    'bullet': 'format_list_bulleted',
    'numbered_list': 'format_list_numbered',
    'steps': 'format_list_numbered',
    'step': 'looks_one',
    'number': 'tag',
    'hash': 'tag',
    'hashtag': 'tag',
    'label': 'label',
    'tag_icon': 'label',
    'category': 'category',
    'folder': 'folder',
    'box': 'inventory_2',
    'package': 'inventory_2',
    'container': 'inventory_2',
    'basket': 'shopping_basket',
    'cart': 'shopping_cart',
    'bag': 'shopping_bag',
    'gift': 'redeem',
    'present': 'redeem',
    'money': 'payments',
    'cash': 'payments',
    'dollar': 'attach_money',
    'currency': 'attach_money',
    'coin': 'monetization_on',
    'bank': 'account_balance',
    'building': 'apartment',
    'house': 'home',
    'home_icon': 'home',
    'puzzle': 'extension',
    'jigsaw': 'extension',
    'magic': 'auto_fix_high',
    'wand': 'auto_fix_high',
    'sparkle': 'auto_awesome',
    'shine': 'auto_awesome',
    'glow': 'auto_awesome',
    'idea': 'lightbulb',
    'bulb': 'lightbulb',
    'lamp': 'lightbulb',
    'light': 'lightbulb',
    'think': 'lightbulb',
    'thought': 'lightbulb',
    'brain_idea': 'lightbulb',
    'question': 'help',
    'help_icon': 'help',
    'faq': 'help',
    'info_icon': 'info',
    'information': 'info',
    'about': 'info',
    'check': 'check_circle',
    'tick': 'check_circle',
    'done': 'check_circle',
    'success': 'check_circle',
    'correct': 'check_circle',
    'approve': 'check_circle',
    'close_icon': 'cancel',
    'cross': 'cancel',
    'x': 'cancel',
    'deny': 'cancel',
    'reject': 'cancel',
    'plus': 'add_circle',
    'add_icon': 'add_circle',
    'new': 'add_circle',
    'minus': 'remove_circle',
    'remove': 'remove_circle',
    'subtract': 'remove_circle',
    'compare': 'compare_arrows',
    'versus': 'compare_arrows',
    'vs': 'compare_arrows',
    'swap': 'swap_horiz',
    'exchange': 'swap_horiz',
    'switch': 'swap_horiz',
    'split': 'call_split',
    'branch': 'call_split',
    'merge': 'merge',
    'combine': 'merge',
    'connect': 'hub',
    'network': 'hub',
    'hub_icon': 'hub',
    'node': 'hub',
    'tree_structure': 'account_tree',
    'hierarchy': 'account_tree',
    'organization': 'account_tree',
    'flowchart': 'account_tree',
    'process_icon': 'account_tree',
    'workflow': 'account_tree',
    'cycle': 'autorenew',
    'loop': 'autorenew',
    'repeat': 'autorenew',
    'recycle': 'autorenew',
    'rotate': 'autorenew',
    'layer': 'layers',
    'layers_icon': 'layers',
    'stack': 'layers',
    'filter_icon': 'filter_list',
    'sort': 'sort',
    'order': 'sort',
    'arrange': 'sort',
    'search_icon': 'search',
    'find': 'search',
    'lookup': 'search',
    'magnify': 'search',
    'zoom': 'zoom_in',
    'expand': 'open_in_full',
    'fullscreen': 'fullscreen',
    'minimize': 'close_fullscreen',
    'shrink': 'close_fullscreen',
    'crop': 'crop',
    'cut': 'content_cut',
    'scissors': 'content_cut',
    'copy': 'content_copy',
    'paste': 'content_paste',
    'share': 'share',
    'send': 'send',
    'forward': 'forward',
    'reply': 'reply',
    'undo': 'undo',
    'redo': 'redo',
    'save_icon': 'save',
    'floppy': 'save',
    'print': 'print',
    'printer': 'print',
    'delete_icon': 'delete',
    'trash': 'delete',
    'bin': 'delete',
    'recycle_bin': 'delete',

    // ═══════════════ Additional AI-generated invalid names ═══════════════
    // Blood / Cardiovascular
    'blood_type': 'bloodtype',
    'blood_group': 'bloodtype',
    'bloodtype_icon': 'bloodtype',
    'transfusion': 'bloodtype',
    'hematology': 'bloodtype',
    'haematology': 'bloodtype',
    'vascular': 'cardiology',
    'artery': 'cardiology',
    'vein': 'cardiology',
    'circulation': 'cardiology',
    'cardiac': 'cardiology',

    // Radiation / Nuclear
    'radioactive': 'radiology',
    'radiation': 'radiology',
    'nuclear': 'radiology',
    'radiotherapy': 'radiology',
    'gamma': 'radiology',
    'isotope': 'radiology',
    'radioactivity': 'radiology',

    // Geometry / Spatial
    'triangulation': 'change_history',
    'triangle': 'change_history',
    'pyramid': 'change_history',
    'delta': 'change_history',
    'angle': 'square_foot',
    'geometry': 'square_foot',
    'shape': 'category',
    'square': 'crop_square',
    'rectangle': 'crop_square',
    'hexagon': 'hexagon',
    'pentagon': 'pentagon',
    'octagon': 'stop',
    'oval': 'radio_button_unchecked',
    'sphere': 'public',

    // Vision / Optics (extended)
    'farsightedness': 'eyeglasses',
    'hyperopia_icon': 'eyeglasses',
    'nearsightedness': 'eyeglasses',
    'myopia_icon': 'eyeglasses',
    'astigmatism_icon': 'eyeglasses',
    'presbyopia_icon': 'eyeglasses',
    'refraction_icon': 'eyeglasses',
    'visual_acuity': 'visibility',
    'eye_exam': 'visibility',
    'eye_test': 'visibility',
    'eye_chart': 'visibility',
    'snellen': 'visibility',
    'ophthalmoscope': 'visibility',
    'slit_lamp': 'visibility',
    'tonometer': 'speed',
    'iop_icon': 'speed',
    'pressure': 'speed',
    'intraocular': 'visibility',
    'fundus': 'visibility',
    'macula': 'visibility',
    'fovea': 'visibility',
    'optic_nerve': 'visibility',
    'optic_disc': 'visibility',
    'visual_field': 'grid_view',
    'perimetry': 'grid_view',
    'gonioscopy': 'visibility',
    'pachymetry': 'straighten',
    'keratometry': 'straighten',

    // Surgery / Procedures (extended)
    'scalpel': 'content_cut',
    'surgery': 'medical_services',
    'operate': 'medical_services',
    'incision': 'content_cut',
    'suture': 'healing',
    'stitch': 'healing',
    'clamp': 'build',
    'forceps': 'build',
    'retractor': 'build',
    'cannula': 'vaccines',
    'catheter': 'vaccines',
    'drain': 'water_drop',
    'implant': 'settings_accessibility',
    'prosthesis': 'settings_accessibility',
    'graft': 'healing',
    'transplant': 'healing',

    // Anatomy (extended)
    'skull': 'psychology',
    'spine': 'straighten',
    'joint': 'accessibility_new',
    'tendon': 'accessibility_new',
    'ligament': 'accessibility_new',
    'nerve': 'psychology',
    'neuron': 'psychology',
    'synapse': 'psychology',
    'cell': 'biotech',
    'tissue': 'biotech',
    'organ': 'biotech',
    'membrane': 'layers',
    'epithelium': 'layers',
    'endothelium': 'layers',

    // Miscellaneous medical
    'diagnosis': 'assignment',
    'prognosis': 'trending_up',
    'etiology': 'help_outline',
    'aetiology': 'help_outline',
    'pathology': 'biotech',
    'histology': 'biotech',
    'cytology': 'biotech',
    'biopsy_icon': 'biotech',
    'specimen': 'biotech',
    'culture': 'biotech',
    'sensitivity_icon': 'biotech',
    'antibiotic': 'medication',
    'antifungal': 'medication',
    'antiviral': 'medication',
    'steroid': 'medication',
    'immunosuppressant': 'medication',
    'chemotherapy': 'medication',
    'dosage': 'medication',
    'prescription_icon': 'clinical_notes',
    'clinical': 'clinical_notes',
    'ward': 'local_hospital',
    'icu': 'local_hospital',
    'emergency_room': 'emergency',
    'er': 'emergency',
    'triage': 'assignment',
    'referral': 'send',
    'follow_up': 'event_repeat',
    'followup': 'event_repeat',
    'review': 'rate_review',
    'audit': 'fact_check',
    'guideline': 'rule',
    'protocol_icon': 'rule',
    'consent': 'handshake',
    'handshake': 'handshake',
    'agreement': 'handshake',

    // Symbols & Misc
    'infinity': 'all_inclusive',
    'infinite': 'all_inclusive',
    'percentage': 'percent',
    'percent_icon': 'percent',
    'ratio': 'percent',
    'fraction': 'percent',
    'equal': 'drag_handle',
    'equals': 'drag_handle',
    'greater': 'chevron_right',
    'less': 'chevron_left',
    'up_arrow': 'arrow_upward',
    'down_arrow': 'arrow_downward',
    'increase': 'trending_up',
    'decrease': 'trending_down',
    'rise': 'trending_up',
    'fall': 'trending_down',
    'growth': 'trending_up',
    'decline': 'trending_down',
    'positive': 'add_circle',
    'negative': 'remove_circle',
    'normal': 'check_circle',
    'abnormal': 'error',
    'elevated': 'arrow_upward',
    'reduced': 'arrow_downward',
    'bilateral': 'compare_arrows',
    'unilateral': 'arrow_forward',
    'acute': 'bolt',
    'chronic': 'schedule',
    'recurrent': 'autorenew',
    'progressive': 'trending_up',
    'stable': 'horizontal_rule',
    'resolved': 'check_circle',

    // Weather / Environment (extended)
    'toxic_icon': 'dangerous',
    'chemical': 'science',
    'formula': 'functions',
    'equation': 'functions',
    'math': 'calculate',
    'calculation': 'calculate',
    'calculator': 'calculate',
    'abacus': 'calculate',
};

/**
 * Sanitize an icon name to ensure it's a valid Material Symbols Rounded icon.
 * Maps common AI-generated invalid names to valid equivalents.
 * Falls back to a safe default if the icon is unknown.
 */
function sanitizeMaterialIcon(iconName) {
    if (!iconName || typeof iconName !== 'string') return 'circle';

    // Clean up the icon name
    const cleaned = iconName.trim().toLowerCase().replace(/-/g, '_');

    // Check if it's in our fallback map (known invalid → valid mapping)
    if (ICON_FALLBACK_MAP[cleaned]) {
        return ICON_FALLBACK_MAP[cleaned];
    }

    // Return as-is if it looks like a valid Material Symbols name
    // (lowercase with underscores, no spaces, no special chars)
    if (/^[a-z][a-z0-9_]*$/.test(cleaned)) {
        return cleaned;
    }

    // Last resort: return a safe default
    return 'circle';
}

function renderInfographic(data) {
    outputContainer.innerHTML = '';
    outputContainer.classList.remove('empty-state');

    // ═══════════════════════════════════════════════════════════════════════
    // ERROR HANDLING FOR OLD/MALFORMED INFOGRAPHICS
    // This ensures old infographics load properly without restrictions
    // ═══════════════════════════════════════════════════════════════════════

    // Handle null/undefined data
    if (!data) {
        console.error('renderInfographic: No data provided');
        outputContainer.innerHTML = `
            <div class="error-message" style="padding: 2rem; text-align: center; color: #e74c3c;">
                <span class="material-symbols-rounded" style="font-size: 3rem;">error</span>
                <h3 style="margin: 0.5rem 0;">Unable to Load Infographic</h3>
                <p>No data found for this infographic. The content may be corrupted or missing.</p>
                <p style="font-size: 0.9rem; color: #888; margin-top: 0.5rem;">This may be an old format that's no longer supported.</p>
                <div style="margin-top: 1rem; padding: 1rem; background: #fef3c7; border: 1px solid #f59e0b; border-radius: 8px; color: #92400e;">
                    <span class="material-symbols-rounded" style="font-size: 1.2rem; vertical-align: middle;">contact_mail</span>
                    <strong>Request Resubmission:</strong> Please ask the original uploader to resubmit this infographic to the Community Hub so it can be restored.
                </div>
            </div>
        `;
        return;
    }

    // Normalize data - handle various old formats
    // Some old infographics might have data nested differently
    if (typeof data === 'string') {
        try {
            data = JSON.parse(data);
        } catch (e) {
            console.error('renderInfographic: Failed to parse data string', e);
            outputContainer.innerHTML = `
                <div class="error-message" style="padding: 2rem; text-align: center; color: #e74c3c;">
                    <span class="material-symbols-rounded" style="font-size: 3rem;">error</span>
                    <h3 style="margin: 0.5rem 0;">Unable to Parse Infographic</h3>
                    <p>The infographic data is corrupted and cannot be displayed.</p>
                    <div style="margin-top: 1rem; padding: 1rem; background: #fef3c7; border: 1px solid #f59e0b; border-radius: 8px; color: #92400e;">
                        <span class="material-symbols-rounded" style="font-size: 1.2rem; vertical-align: middle;">contact_mail</span>
                        <strong>Request Resubmission:</strong> Please ask the original uploader to resubmit this infographic to the Community Hub so it can be restored.
                    </div>
                </div>
            `;
            return;
        }
    }

    // Provide fallbacks for missing required fields
    data.title = data.title || 'Untitled Infographic';
    data.summary = data.summary || '';
    data.sections = data.sections || [];

    // Ensure sections is an array
    if (!Array.isArray(data.sections)) {
        console.warn('renderInfographic: sections is not an array, converting...');
        data.sections = Object.values(data.sections || {});
    }

    // Log successful load for debugging
    console.log(`[Render] Loading infographic: "${data.title}" with ${data.sections.length} sections`);

    // Create the main Poster Sheet container
    const posterSheet = document.createElement('div');
    posterSheet.className = 'poster-sheet';

    // Header (Inside the sheet)
    const header = document.createElement('header');
    header.className = 'poster-header';

    // Illustration Container
    let illustrationHtml = '';
    if (data.summary_illustration) {
        illustrationHtml = `
            <div class="poster-illustration">
                ${data.summary_illustration}
            </div>
        `;
    }

    // Category Color Badge - determine chapter from library (source of truth) > data > auto-detect
    let categoryBadgeHtml = '';
    const title = data.title || '';
    // Priority: 1) library item's chapterId (user's local override), 2) data.chapterId, 3) auto-detect
    let chapterId = 'uncategorized';
    try {
        const lib = JSON.parse(localStorage.getItem(LIBRARY_KEY) || '[]');
        // Try exact title match first, then normalised match
        let libItem = lib.find(i => i.title === title);
        if (!libItem) {
            const norm = (t) => (t || '').toLowerCase().trim().replace(/[^a-z0-9]/g, '');
            const titleNorm = norm(title);
            if (titleNorm) libItem = lib.find(i => norm(i.title) === titleNorm);
        }
        if (libItem && libItem.chapterId && libItem.chapterId !== 'uncategorized') {
            chapterId = libItem.chapterId;
            // Sync back into data so it persists everywhere
            data.chapterId = chapterId;
        }
    } catch (err) {
        console.warn('[renderInfographic] Library lookup failed:', err);
    }
    // If library didn't have a category, use data.chapterId
    if (chapterId === 'uncategorized' && data.chapterId && data.chapterId !== 'uncategorized') {
        chapterId = data.chapterId;
    }
    // Last resort: auto-detect from title
    if (chapterId === 'uncategorized') {
        chapterId = autoDetectChapter(title);
    }
    if (chapterId && chapterId !== 'uncategorized') {
        const chapter = DEFAULT_CHAPTERS.find(c => c.id === chapterId);
        if (chapter) {
            categoryBadgeHtml = `
                <span class="category-badge" id="infographic-category-badge" data-chapter-id="${chapterId}" style="
                    display: inline-flex;
                    align-items: center;
                    gap: 4px;
                    padding: 4px 12px;
                    border-radius: 20px;
                    font-size: 0.75rem;
                    font-weight: 600;
                    color: white;
                    background: ${chapter.color};
                    margin-left: 12px;
                    vertical-align: middle;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.2);
                ">
                    <span class="material-symbols-rounded" style="font-size: 14px;">folder</span>
                    ${chapter.name}
                </span>
            `;
        }
    } else {
        // Add placeholder for dynamic updates even when uncategorized
        categoryBadgeHtml = `<span class="category-badge" id="infographic-category-badge" data-chapter-id="uncategorized" style="display: none;"></span>`;
    }

    header.innerHTML = `
        <div class="header-decoration"></div>
        <h1 class="poster-title" style="display: flex; align-items: center; flex-wrap: wrap;">${escapeHtml(data.title)}${categoryBadgeHtml}
            <button class="find-notes-btn" id="find-matching-notes-btn" title="Find matching NotebookLM notes">
                <span class="material-symbols-rounded">book</span>
                Find Notes
            </button>
        </h1>
        <div class="header-content-wrapper" style="display: flex; gap: 2rem; align-items: start;">
            <p class="poster-summary" style="flex: 1;">${escapeHtml(data.summary)}</p>
            ${illustrationHtml}
        </div>
    `;
    posterSheet.appendChild(header);

    // Wire the Find Matching Notes button
    const findNotesBtn = header.querySelector('#find-matching-notes-btn');
    if (findNotesBtn) {
        findNotesBtn.addEventListener('click', async () => {
            findNotesBtn.classList.add('loading');
            findNotesBtn.innerHTML = '<span class="material-symbols-rounded rotating">sync</span> Matching...';
            try {
                await findMatchingNotes(data.title, data.sections);
            } catch (err) {
                console.error('[Find Notes]', err);
            }
            findNotesBtn.classList.remove('loading');
            findNotesBtn.innerHTML = '<span class="material-symbols-rounded">book</span> Find Notes';
        });
    }

    // Grid (Inside the sheet)
    const grid = document.createElement('div');
    grid.className = 'poster-grid';

    data.sections.forEach((section, index) => {
        const card = document.createElement('div');
        const layoutClass = section.layout === 'full_width' ? 'col-span-2' : '';
        const colorClass = `theme-${section.color_theme || 'blue'}`;
        card.className = `poster-card card-${section.type} ${layoutClass} ${colorClass}`;

        card.style.animationDelay = `${index * 100}ms`;

        const iconName = sanitizeMaterialIcon(section.icon || 'circle');

        let contentHtml = '';

        switch (section.type) {
            case 'red_flag':
                const flags = Array.isArray(section.content) ? section.content : [section.content];
                contentHtml = `<ul class="warning-list">
                    ${flags.map(item => `<li>
                        <span class="material-symbols-rounded warning-icon">warning</span>
                        ${item}
                    </li>`).join('')}
                </ul>`;
                break;

            case 'chart':
                const chartContent = section.content || {};
                const chartData = chartContent.data || [];
                contentHtml = `<div class="bar-chart">
                    ${chartData.map(d => `
                        <div class="chart-row">
                            <div class="chart-label">${d.label}</div>
                            <div class="chart-bar-container">
                                <div class="chart-bar" style="width: ${d.value}%"></div>
                                <span class="chart-val">${d.value}%</span>
                            </div>
                        </div>
                    `).join('')}
                </div>`;
                break;

            case 'remember':
                const mem = section.content || {};
                contentHtml = `<div class="mnemonic-box">
                    <div class="mnemonic-title">${mem.mnemonic || 'REMEMBER'}</div>
                    <div class="mnemonic-text">${mem.explanation}</div>
                </div>`;
                break;

            case 'mindmap':
                const map = section.content || {};
                const branches = map.branches || [];
                contentHtml = `<div class="mindmap-container">
                    <div class="mindmap-center">${map.center}</div>
                    <div class="mindmap-branches">
                        ${branches.map(b => `<div class="mindmap-branch">${b}</div>`).join('')}
                    </div>
                </div>`;
                break;

            case 'key_point':
            case 'process':
                const points = Array.isArray(section.content) ? section.content : [section.content];
                contentHtml = `<ul class="card-list">
                    ${points.map(item => `<li>${item}</li>`).join('')}
                </ul>`;
                break;

            case 'table':
                if (section.content && section.content.headers && section.content.rows) {
                    const headers = section.content.headers || [];
                    const rows = section.content.rows || [];
                    contentHtml = `
                    <div class="table-wrapper">
                        <table class="data-table">
                            <thead>
                                <tr>
                                    ${headers.map(h => `<th>${h}</th>`).join('')}
                                </tr>
                            </thead>
                            <tbody>
                                ${rows.map(row => `
                                    <tr>
                                        ${row.map(cell => `<td>${cell}</td>`).join('')}
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>`;
                } else {
                    contentHtml = `<p class="plain-text">Invalid table data received.</p>`;
                }
                break;

            default:
                contentHtml = `<p class="plain-text">${section.content}</p>`;
        }

        const titleHtml = `
            <h3 class="card-title">
                <div class="icon-box"><span class="material-symbols-rounded">${iconName}</span></div>
                ${section.title}
            </h3>`;

        card.innerHTML = `
            ${titleHtml}
            <div class="card-content">
                ${contentHtml}
            </div>
        `;
        grid.appendChild(card);
    });

    posterSheet.appendChild(grid);
    outputContainer.appendChild(posterSheet);

    // Enable Studio Tools when infographic is generated
    enableStudioTools();

    // Auto-load adhered Kanski images if present
    setTimeout(() => {
        loadAdheredKanskiImages(data);
    }, 100);

    // Auto-collapse sidebar to give more space for viewing the infographic
    setTimeout(() => {
        collapseSidebar();
    }, 500); // Small delay to let the user see the result first
}

/* ========================================
   STUDIO TOOLS - NotebookLM-Style Features
   ======================================== */

function enableStudioTools() {
    const studioPanel = document.getElementById('studio-panel');
    if (studioPanel) {
        studioPanel.classList.add('studio-panel-enabled');
        const buttons = studioPanel.querySelectorAll('.studio-tool-btn');
        buttons.forEach(btn => btn.disabled = false);
    }
}

function disableStudioTools() {
    const studioPanel = document.getElementById('studio-panel');
    if (studioPanel) {
        studioPanel.classList.remove('studio-panel-enabled');
        const buttons = studioPanel.querySelectorAll('.studio-tool-btn');
        buttons.forEach(btn => {
            // Keep Sticky Notes always accessible (it's a review tool, not generation)
            if (btn.id === 'sticky-notes-btn') return;
            btn.disabled = true;
        });
    }
}

/* ========================================
   AI-POWERED STUDIO TOOLS HELPER
   Uses Gemini 2.0 Flash for enhanced content generation
   ======================================== */

async function callGeminiForStudioTool(prompt, fallbackFn = null) {
    const apiKey = document.getElementById('api-key')?.value?.trim();

    if (!apiKey) {
        console.log('No API key provided, using fallback method');
        return fallbackFn ? fallbackFn() : null;
    }

    try {
        const genAI = new GoogleGenerativeAI(apiKey);

        // Try Gemini 2.0 Flash first, then fallbacks
        const modelsToTry = [
            "gemini-2.0-flash",
            "gemini-2.0-flash-exp",
            "gemini-1.5-flash",
            "gemini-1.5-flash-latest"
        ];

        let lastError = null;

        for (const modelName of modelsToTry) {
            try {
                console.log(`Studio Tool: Trying model ${modelName}`);
                const model = genAI.getGenerativeModel({ model: modelName });
                const result = await model.generateContent(prompt);
                const response = await result.response;
                return response.text();
            } catch (err) {
                console.log(`Model ${modelName} failed:`, err.message);
                lastError = err;
            }
        }

        throw lastError || new Error('All models failed');
    } catch (error) {
        console.error('Gemini API call failed:', error);
        return fallbackFn ? fallbackFn() : null;
    }
}

// AI-Enhanced Transcript Generation
async function generateAITranscript() {
    if (!currentInfographicData) return null;

    const voiceStyle = document.getElementById('voice-select')?.value || 'default';
    const styleGuide = {
        'default': 'professional and educational',
        'friendly': 'warm, conversational, and engaging like talking to a colleague',
        'formal': 'academic and authoritative like a medical lecture'
    };

    const prompt = `You are creating an audio narration script for a medical education podcast.

Topic: ${currentInfographicData.title}

Content to cover:
${JSON.stringify(currentInfographicData.sections?.map(s => ({ title: s.title, content: s.content })) || [], null, 2)}

Summary: ${currentInfographicData.summary || ''}

Create a ${styleGuide[voiceStyle]} narration script that:
1. Opens with an engaging introduction
2. Covers ALL key points from the content
3. Uses clear transitions between topics
4. Includes brief clinical pearls or memorable takeaways
5. Ends with a concise summary

Write the script as flowing paragraphs (not bullet points) suitable for text-to-speech. 
Keep it under 800 words for a 5-minute audio overview.
Do not include any stage directions or speaker labels - just the narration text.`;

    return await callGeminiForStudioTool(prompt);
}

// AI-Enhanced Flashcard Generation
async function generateAIFlashcards() {
    if (!currentInfographicData) return null;

    const prompt = `You are creating medical education flashcards for ophthalmology students.

Topic: ${currentInfographicData.title}

Content:
${JSON.stringify(currentInfographicData.sections?.map(s => ({ title: s.title, content: s.content })) || [], null, 2)}

Create 10-15 high-quality flashcards in this exact JSON format:
[
    {
        "question": "Clear, specific question testing understanding",
        "answer": "Concise but complete answer"
    }
]

Guidelines:
1. Mix question types: definitions, comparisons, clinical scenarios, mechanisms
2. Include questions about key facts, differential diagnosis, and management
3. Make answers memorable and clinically relevant
4. Include mnemonics where helpful
5. Test both recall and application of knowledge

Return ONLY valid JSON array, no other text.`;

    const result = await callGeminiForStudioTool(prompt);
    if (result) {
        try {
            // Extract JSON from response
            const jsonMatch = result.match(/\[[\s\S]*\]/);
            if (jsonMatch) {
                return JSON.parse(jsonMatch[0]);
            }
        } catch (e) {
            console.error('Failed to parse AI flashcards:', e);
        }
    }
    return null;
}

// AI-Enhanced Quiz Generation
async function generateAIQuiz() {
    if (!currentInfographicData) return null;

    const prompt = `You are creating a medical knowledge quiz for ophthalmology education.

Topic: ${currentInfographicData.title}

Content:
${JSON.stringify(currentInfographicData.sections?.map(s => ({ title: s.title, content: s.content })) || [], null, 2)}

Create 8-10 multiple choice questions in this exact JSON format:
[
    {
        "question": "Question text here?",
        "options": ["Option A", "Option B", "Option C", "Option D"],
        "correctAnswer": "The exact text of the correct option",
        "explanation": "Brief explanation of why this answer is correct"
    }
]

Guidelines:
1. Questions should test understanding, not just memorization
2. All 4 options should be plausible to someone who didn't study
3. Avoid "all of the above" or "none of the above"
4. Include clinical scenario questions where appropriate
5. Vary difficulty from basic recall to clinical application
6. Explanations should be educational and reinforce learning

Return ONLY valid JSON array, no other text.`;

    const result = await callGeminiForStudioTool(prompt);
    if (result) {
        try {
            const jsonMatch = result.match(/\[[\s\S]*\]/);
            if (jsonMatch) {
                return JSON.parse(jsonMatch[0]);
            }
        } catch (e) {
            console.error('Failed to parse AI quiz:', e);
        }
    }
    return null;
}

// Simple Markdown to HTML converter
function convertMarkdownToHTML(markdown) {
    if (!markdown) return '';

    return markdown
        // Headers
        .replace(/^### (.*$)/gm, '<h3>$1</h3>')
        .replace(/^## (.*$)/gm, '<h2>$1</h2>')
        .replace(/^# (.*$)/gm, '<h1>$1</h1>')
        // Bold
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        // Italic
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        // Bullet lists
        .replace(/^\- (.*$)/gm, '<li>$1</li>')
        .replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>')
        // Numbered lists
        .replace(/^\d+\. (.*$)/gm, '<li>$1</li>')
        // Paragraphs (double newlines)
        .replace(/\n\n/g, '</p><p>')
        // Single newlines
        .replace(/\n/g, '<br>')
        // Wrap in paragraph
        .replace(/^(.+)$/gm, (match) => {
            if (match.startsWith('<h') || match.startsWith('<ul') || match.startsWith('<li') || match.startsWith('<p')) {
                return match;
            }
            return `<p>${match}</p>`;
        });
}

// AI-Enhanced Report Generation
async function generateAIReport(format) {
    if (!currentInfographicData) return null;

    const formatGuides = {
        'summary': 'Create a concise 2-3 paragraph executive summary highlighting the most critical clinical points.',
        'detailed': 'Create a comprehensive study guide with detailed explanations of each topic, including pathophysiology and clinical correlations.',
        'bullet': 'Create a well-organized bullet-point summary with clear headers and sub-points for quick review.',
        'study-guide': 'Create a structured study guide with learning objectives, key concepts, clinical pearls, and review questions.'
    };

    const prompt = `You are creating educational content for ophthalmology professionals.

Topic: ${currentInfographicData.title}

Source Content:
${JSON.stringify(currentInfographicData, null, 2)}

Task: ${formatGuides[format] || formatGuides['summary']}

Requirements:
1. Cover ALL information from the source content
2. Use clear medical terminology
3. Organize information logically
4. Include clinical relevance where appropriate
5. Format with proper headers using markdown (## for main sections, ### for subsections)

Create the ${format} report now:`;

    return await callGeminiForStudioTool(prompt);
}

/* ========================================
   AUDIO OVERVIEW FEATURE
   ======================================== */

let audioContext = null;
let audioSource = null;
let isPlaying = false;
let audioTranscript = '';

function setupAudioOverview() {
    const audioBtn = document.getElementById('audio-overview-btn');
    const audioModal = document.getElementById('audio-modal');
    const closeBtn = document.getElementById('close-audio-modal-btn');
    const generateBtn = document.getElementById('generate-audio-btn');
    const playBtn = document.getElementById('audio-play-btn');
    const downloadBtn = document.getElementById('download-audio-btn');

    if (!audioBtn || !audioModal) return;

    audioBtn.addEventListener('click', () => {
        if (!currentInfographicData) {
            alert('Please generate an infographic first.');
            return;
        }
        audioModal.classList.add('active');
        generateTranscript();
    });

    closeBtn?.addEventListener('click', () => {
        audioModal.classList.remove('active');
        stopAudio();
    });

    audioModal.addEventListener('click', (e) => {
        if (e.target === audioModal) {
            audioModal.classList.remove('active');
            stopAudio();
        }
    });

    generateBtn?.addEventListener('click', () => {
        generateAudio();
    });

    playBtn?.addEventListener('click', () => {
        if (isPlaying) {
            stopAudio();
        } else {
            playAudio();
        }
    });
}

async function generateTranscript() {
    if (!currentInfographicData) return;

    const transcriptEl = document.getElementById('audio-transcript-text');
    const generateBtn = document.getElementById('generate-audio-btn');

    // Show loading state
    if (transcriptEl) {
        transcriptEl.innerHTML = '<em>Generating AI-powered transcript with Gemini...</em>';
    }
    if (generateBtn) {
        generateBtn.disabled = true;
        generateBtn.innerHTML = '<span class="material-symbols-rounded rotating">sync</span> Generating...';
    }

    // Try AI-powered transcript first
    const aiTranscript = await generateAITranscript();

    if (aiTranscript) {
        audioTranscript = aiTranscript;
        if (transcriptEl) {
            transcriptEl.textContent = audioTranscript;
        }
        if (generateBtn) {
            generateBtn.disabled = false;
            generateBtn.innerHTML = '<span class="material-symbols-rounded">record_voice_over</span> Generate Audio';
        }
        return;
    }

    // Fallback to basic transcript generation
    console.log('Using fallback transcript generation');
    const data = currentInfographicData;
    let transcript = `${data.title}.\n\n`;
    transcript += `${data.summary}\n\n`;

    if (data.sections) {
        data.sections.forEach(section => {
            transcript += `${section.title}.\n`;

            if (Array.isArray(section.content)) {
                section.content.forEach(item => {
                    transcript += `${item}.\n`;
                });
            } else if (typeof section.content === 'object') {
                if (section.content.mnemonic) {
                    transcript += `Remember: ${section.content.mnemonic}. ${section.content.explanation}.\n`;
                } else if (section.content.center) {
                    transcript += `Central concept: ${section.content.center}. `;
                    if (section.content.branches) {
                        transcript += `Key branches include: ${section.content.branches.join(', ')}.\n`;
                    }
                } else if (section.content.data) {
                    section.content.data.forEach(d => {
                        transcript += `${d.label}: ${d.value} percent.\n`;
                    });
                } else if (section.content.headers && section.content.rows) {
                    section.content.rows.forEach(row => {
                        transcript += row.join(', ') + '.\n';
                    });
                }
            } else {
                transcript += `${section.content}.\n`;
            }
            transcript += '\n';
        });
    }

    audioTranscript = transcript;
    if (transcriptEl) {
        transcriptEl.textContent = transcript;
    }
    if (generateBtn) {
        generateBtn.disabled = false;
        generateBtn.innerHTML = '<span class="material-symbols-rounded">record_voice_over</span> Generate Audio';
    }
}

function generateAudio() {
    if (!audioTranscript) {
        generateTranscript();
    }

    // Use Web Speech API for text-to-speech
    if ('speechSynthesis' in window) {
        const voiceSelect = document.getElementById('voice-select');
        const voiceStyle = voiceSelect?.value || 'default';

        // Create animated waveform
        createWaveformAnimation();

        const generateBtn = document.getElementById('generate-audio-btn');
        const downloadBtn = document.getElementById('download-audio-btn');

        if (generateBtn) {
            generateBtn.innerHTML = '<span class="material-symbols-rounded">check</span> Audio Ready';
        }
        if (downloadBtn) {
            downloadBtn.style.display = 'flex';
        }

        alert('Audio generated! Click Play to listen. Note: Audio uses browser\'s text-to-speech capabilities.');
    } else {
        alert('Text-to-speech is not supported in this browser.');
    }
}

function createWaveformAnimation() {
    const waveform = document.querySelector('.audio-waveform');
    if (!waveform) return;

    waveform.innerHTML = '';
    for (let i = 0; i < 40; i++) {
        const bar = document.createElement('div');
        bar.className = 'bar';
        bar.style.animationDelay = `${i * 0.05}s`;
        bar.style.height = `${20 + Math.random() * 60}%`;
        waveform.appendChild(bar);
    }
}

function playAudio() {
    if (!audioTranscript) return;

    const voiceSelect = document.getElementById('voice-select');
    const voiceStyle = voiceSelect?.value || 'default';

    // Handle P2P Female Conversation (Two-voice dialogue)
    if (voiceStyle === 'p2p_female') {
        playP2PConversation();
        return;
    }

    const utterance = new SpeechSynthesisUtterance(audioTranscript);

    // Select female voice for all styles (priority order)
    const voices = window.speechSynthesis.getVoices();
    const preferredVoices = [
        'Google UK English Female',
        'Google US English',
        'Samantha',
        'Microsoft Zira',
        'Daniel'
    ];

    let selectedVoice = null;

    // 1. Try preferred list
    for (const name of preferredVoices) {
        selectedVoice = voices.find(v => v.name.includes(name));
        if (selectedVoice) break;
    }

    // 2. Try any English Female
    if (!selectedVoice) {
        selectedVoice = voices.find(v => v.lang.startsWith('en') &&
            (v.name.toLowerCase().includes('female') || v.name.includes('Samantha')));
    }

    // 3. Try any English GB or US
    if (!selectedVoice) {
        selectedVoice = voices.find(v => v.lang.startsWith('en-GB')) ||
            voices.find(v => v.lang.startsWith('en-US'));
    }

    if (selectedVoice) {
        utterance.voice = selectedVoice;
    }

    // Set voice properties based on style
    switch (voiceStyle) {
        case 'friendly':
            utterance.rate = 0.95;
            utterance.pitch = 1.1;
            break;
        case 'formal':
            utterance.rate = 0.85;
            utterance.pitch = 0.95;
            break;
        default:
            utterance.rate = 0.9;
            utterance.pitch = 1;
    }

    utterance.onstart = () => {
        isPlaying = true;
        updatePlayButton();
        animateProgress();
    };

    utterance.onend = () => {
        isPlaying = false;
        updatePlayButton();
        resetProgress();
    };

    speechSynthesis.speak(utterance);
}

// P2P Female Conversation - Two voices discussing the content
function playP2PConversation() {
    if (!audioTranscript) return;

    const voices = window.speechSynthesis.getVoices();

    // Find two distinct female voices
    const femaleVoiceNames = [
        ['Samantha', 'Google UK English Female', 'Microsoft Zira'],  // Voice 1 priority
        ['Victoria', 'Google US English', 'Daniel', 'Karen']          // Voice 2 priority
    ];

    let voice1 = null;
    let voice2 = null;

    // Find Voice 1
    for (const name of femaleVoiceNames[0]) {
        voice1 = voices.find(v => v.name.includes(name));
        if (voice1) break;
    }
    if (!voice1) {
        voice1 = voices.find(v => v.lang.startsWith('en'));
    }

    // Find Voice 2 (different from Voice 1)
    for (const name of femaleVoiceNames[1]) {
        const found = voices.find(v => v.name.includes(name));
        if (found && found !== voice1) {
            voice2 = found;
            break;
        }
    }
    if (!voice2) {
        voice2 = voices.find(v => v.lang.startsWith('en') && v !== voice1) || voice1;
    }

    // Split transcript into dialogue segments (by sentences or paragraphs)
    const segments = audioTranscript
        .split(/(?<=[.!?])\s+/)
        .filter(s => s.trim().length > 0);

    let currentIndex = 0;

    const speakNext = () => {
        if (currentIndex >= segments.length) {
            isPlaying = false;
            updatePlayButton();
            resetProgress();
            return;
        }

        const segment = segments[currentIndex];
        const utterance = new SpeechSynthesisUtterance(segment);

        // Alternate between voices
        utterance.voice = (currentIndex % 2 === 0) ? voice1 : voice2;
        utterance.rate = 0.85; // Slower for clarity
        utterance.pitch = (currentIndex % 2 === 0) ? 1.0 : 1.1; // Slight variation

        utterance.onstart = () => {
            if (currentIndex === 0) {
                isPlaying = true;
                updatePlayButton();
                animateProgress();
            }
        };

        utterance.onend = () => {
            currentIndex++;
            // Small pause between speakers
            setTimeout(speakNext, 150);
        };

        utterance.onerror = () => {
            currentIndex++;
            speakNext();
        };

        speechSynthesis.speak(utterance);
    };

    speakNext();
}

function stopAudio() {
    speechSynthesis.cancel();
    isPlaying = false;
    updatePlayButton();
    resetProgress();
}

function updatePlayButton() {
    const playBtn = document.getElementById('audio-play-btn');
    if (playBtn) {
        playBtn.innerHTML = isPlaying
            ? '<span class="material-symbols-rounded">pause</span>'
            : '<span class="material-symbols-rounded">play_arrow</span>';
    }
}

function animateProgress() {
    const progressBar = document.getElementById('audio-progress-bar');
    if (progressBar) {
        progressBar.style.transition = 'width 60s linear';
        progressBar.style.width = '100%';
    }
}

function resetProgress() {
    const progressBar = document.getElementById('audio-progress-bar');
    if (progressBar) {
        progressBar.style.transition = 'none';
        progressBar.style.width = '0%';
    }
}

/* ========================================
   VIDEO OVERVIEW FEATURE
   ======================================== */

let videoSlides = [];
let currentVideoSlide = 0;
let videoAutoPlay = null;

function setupVideoOverview() {
    const videoBtn = document.getElementById('video-overview-btn');
    const videoModal = document.getElementById('video-modal');
    const closeBtn = document.getElementById('close-video-modal-btn');
    const generateBtn = document.getElementById('generate-video-btn');
    const playBtn = document.getElementById('video-play-btn');
    const prevBtn = document.getElementById('video-prev-btn');
    const nextBtn = document.getElementById('video-next-btn');
    const exportBtn = document.getElementById('export-video-btn');

    if (!videoBtn || !videoModal) return;

    videoBtn.addEventListener('click', () => {
        if (!currentInfographicData) {
            alert('Please generate an infographic first.');
            return;
        }
        videoModal.classList.add('active');
    });

    closeBtn?.addEventListener('click', () => {
        videoModal.classList.remove('active');
        stopVideoAutoPlay();
    });

    videoModal.addEventListener('click', (e) => {
        if (e.target === videoModal) {
            videoModal.classList.remove('active');
            stopVideoAutoPlay();
        }
    });

    generateBtn?.addEventListener('click', generateVideoSlides);
    playBtn?.addEventListener('click', toggleVideoAutoPlay);
    prevBtn?.addEventListener('click', () => navigateVideoSlide(-1));
    nextBtn?.addEventListener('click', () => navigateVideoSlide(1));
    exportBtn?.addEventListener('click', exportVideoAsHTML);
}

function generateVideoSlides() {
    if (!currentInfographicData) return;

    const data = currentInfographicData;
    videoSlides = [];

    // Title slide
    videoSlides.push({
        type: 'title',
        title: data.title,
        subtitle: data.summary
    });

    // Section slides
    if (data.sections) {
        data.sections.forEach(section => {
            videoSlides.push({
                type: 'section',
                title: section.title,
                content: section.content,
                sectionType: section.type,
                colorTheme: section.color_theme
            });
        });
    }

    // Summary slide
    videoSlides.push({
        type: 'end',
        title: 'Key Takeaways',
        subtitle: 'Review and practice the concepts covered'
    });

    currentVideoSlide = 0;
    renderVideoSlide();
    updateVideoCounter();

    const exportBtn = document.getElementById('export-video-btn');
    if (exportBtn) exportBtn.style.display = 'flex';
}

function renderVideoSlide() {
    const slideContainer = document.getElementById('current-slide');
    if (!slideContainer || videoSlides.length === 0) return;

    const slide = videoSlides[currentVideoSlide];

    if (slide.type === 'title' || slide.type === 'end') {
        slideContainer.innerHTML = `
            <h2>${slide.title}</h2>
            <p>${slide.subtitle || ''}</p>
        `;
        slideContainer.style.background = 'linear-gradient(135deg, #1e293b, #334155)';
    } else {
        let contentHtml = '';

        if (Array.isArray(slide.content)) {
            contentHtml = `<ul>${slide.content.map(item => `<li>${item}</li>`).join('')}</ul>`;
        } else if (typeof slide.content === 'object') {
            if (slide.content.mnemonic) {
                contentHtml = `<p><strong>${slide.content.mnemonic}</strong><br>${slide.content.explanation}</p>`;
            } else if (slide.content.center) {
                contentHtml = `<p><strong>${slide.content.center}</strong></p>`;
                if (slide.content.branches) {
                    contentHtml += `<ul>${slide.content.branches.map(b => `<li>${b}</li>`).join('')}</ul>`;
                }
            } else if (slide.content.data) {
                contentHtml = `<ul>${slide.content.data.map(d => `<li>${d.label}: ${d.value}%</li>`).join('')}</ul>`;
            }
        } else {
            contentHtml = `<p>${slide.content}</p>`;
        }

        const bgColor = getSlideBackground(slide.colorTheme);
        slideContainer.innerHTML = `
            <h2>${slide.title}</h2>
            ${contentHtml}
        `;
        slideContainer.style.background = bgColor;
    }
}

function getSlideBackground(theme) {
    const themes = {
        blue: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
        red: 'linear-gradient(135deg, #ef4444, #dc2626)',
        green: 'linear-gradient(135deg, #10b981, #059669)',
        yellow: 'linear-gradient(135deg, #f59e0b, #d97706)',
        purple: 'linear-gradient(135deg, #8b5cf6, #7c3aed)'
    };
    return themes[theme] || 'linear-gradient(135deg, #3b82f6, #1d4ed8)';
}

function navigateVideoSlide(direction) {
    if (videoSlides.length === 0) return;

    currentVideoSlide += direction;
    if (currentVideoSlide < 0) currentVideoSlide = videoSlides.length - 1;
    if (currentVideoSlide >= videoSlides.length) currentVideoSlide = 0;

    renderVideoSlide();
    updateVideoCounter();
}

function updateVideoCounter() {
    const counter = document.getElementById('slide-counter');
    if (counter) {
        counter.textContent = `${currentVideoSlide + 1} / ${videoSlides.length}`;
    }
}

function toggleVideoAutoPlay() {
    const playBtn = document.getElementById('video-play-btn');

    if (videoAutoPlay) {
        stopVideoAutoPlay();
        if (playBtn) playBtn.innerHTML = '<span class="material-symbols-rounded">play_arrow</span>';
    } else {
        videoAutoPlay = setInterval(() => {
            navigateVideoSlide(1);
        }, 4000);
        if (playBtn) playBtn.innerHTML = '<span class="material-symbols-rounded">pause</span>';
    }
}

function stopVideoAutoPlay() {
    if (videoAutoPlay) {
        clearInterval(videoAutoPlay);
        videoAutoPlay = null;
    }
}

function exportVideoAsHTML() {
    if (videoSlides.length === 0) return;

    let html = `<!DOCTYPE html>
<html>
<head>
    <title>${currentInfographicData.title} - Video Presentation</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Segoe UI', sans-serif; background: #000; }
        .slide { width: 100vw; height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; color: white; padding: 4rem; text-align: center; }
        h2 { font-size: 3rem; margin-bottom: 2rem; }
        p { font-size: 1.5rem; opacity: 0.9; }
        ul { font-size: 1.3rem; text-align: left; list-style: none; }
        li { padding: 0.5rem 0; }
        li::before { content: "▸ "; color: rgba(255,255,255,0.7); }
    </style>
</head>
<body>
${videoSlides.map((slide, i) => `
    <div class="slide" style="background: ${slide.type === 'title' || slide.type === 'end' ? 'linear-gradient(135deg, #1e293b, #334155)' : getSlideBackground(slide.colorTheme)}">
        <h2>${slide.title}</h2>
        ${slide.subtitle ? `<p>${slide.subtitle}</p>` : ''}
        ${Array.isArray(slide.content) ? `<ul>${slide.content.map(c => `<li>${c}</li>`).join('')}</ul>` : ''}
    </div>
`).join('')}
</body>
</html>`;

    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${currentInfographicData.title.replace(/[^a-z0-9]/gi, '_')}_presentation.html`;
    a.click();
    URL.revokeObjectURL(url);
}

/* ========================================
   MIND MAP FEATURE
   ======================================== */

let mindmapZoom = 1;

function setupMindMap() {
    const mindmapBtn = document.getElementById('mindmap-view-btn');
    const mindmapModal = document.getElementById('mindmap-modal');
    const closeBtn = document.getElementById('close-mindmap-modal-btn');
    const zoomInBtn = document.getElementById('mindmap-zoom-in');
    const zoomOutBtn = document.getElementById('mindmap-zoom-out');
    const resetBtn = document.getElementById('mindmap-reset');
    const exportBtn = document.getElementById('export-mindmap-btn');

    if (!mindmapBtn || !mindmapModal) return;

    mindmapBtn.addEventListener('click', () => {
        if (!currentInfographicData) {
            alert('Please generate an infographic first.');
            return;
        }
        mindmapModal.classList.add('active');
        generateMindMap();
    });

    closeBtn?.addEventListener('click', () => mindmapModal.classList.remove('active'));
    mindmapModal.addEventListener('click', (e) => {
        if (e.target === mindmapModal) mindmapModal.classList.remove('active');
    });

    zoomInBtn?.addEventListener('click', () => {
        mindmapZoom = Math.min(mindmapZoom + 0.2, 2);
        applyMindmapZoom();
    });

    zoomOutBtn?.addEventListener('click', () => {
        mindmapZoom = Math.max(mindmapZoom - 0.2, 0.5);
        applyMindmapZoom();
    });

    resetBtn?.addEventListener('click', () => {
        mindmapZoom = 1;
        applyMindmapZoom();
    });

    exportBtn?.addEventListener('click', exportMindMapAsPNG);
}

function generateMindMap() {
    const canvas = document.getElementById('mindmap-canvas');
    if (!canvas || !currentInfographicData) return;

    const data = currentInfographicData;
    const centerX = 450;
    const centerY = 300;
    const radius = 180;

    let svg = `<svg class="mindmap-svg" viewBox="0 0 900 600" style="transform: scale(${mindmapZoom})">`;

    // Draw connections first (behind nodes)
    const sections = data.sections || [];
    const angleStep = (2 * Math.PI) / Math.max(sections.length, 1);

    sections.forEach((section, i) => {
        const angle = i * angleStep - Math.PI / 2;
        const x = centerX + radius * Math.cos(angle);
        const y = centerY + radius * Math.sin(angle);

        // Draw line from center to branch
        svg += `<line class="mindmap-line" x1="${centerX}" y1="${centerY}" x2="${x}" y2="${y}"/>`;
    });

    // Draw center node
    svg += `<g class="mindmap-node">
        <circle class="mindmap-node-center" cx="${centerX}" cy="${centerY}" r="60"/>
        <text class="mindmap-text" x="${centerX}" y="${centerY}">${truncateText(data.title, 20)}</text>
    </g>`;

    // Draw branch nodes
    sections.forEach((section, i) => {
        const angle = i * angleStep - Math.PI / 2;
        const x = centerX + radius * Math.cos(angle);
        const y = centerY + radius * Math.sin(angle);

        const colors = {
            blue: '#3b82f6',
            red: '#ef4444',
            green: '#10b981',
            yellow: '#f59e0b',
            purple: '#8b5cf6'
        };
        const color = colors[section.color_theme] || '#3b82f6';

        svg += `<g class="mindmap-node">
            <circle cx="${x}" cy="${y}" r="45" fill="${color}"/>
            <text class="mindmap-text" x="${x}" y="${y}">${truncateText(section.title, 15)}</text>
        </g>`;

        // Draw leaf nodes for content
        if (Array.isArray(section.content)) {
            const leafRadius = 60;
            const leafCount = Math.min(section.content.length, 4);
            const leafAngleStep = Math.PI / 3 / Math.max(leafCount - 1, 1);
            const startLeafAngle = angle - Math.PI / 6;

            section.content.slice(0, 4).forEach((item, j) => {
                const leafAngle = startLeafAngle + j * leafAngleStep;
                const lx = x + leafRadius * Math.cos(leafAngle);
                const ly = y + leafRadius * Math.sin(leafAngle);

                svg += `<line class="mindmap-line" x1="${x}" y1="${y}" x2="${lx}" y2="${ly}" style="stroke-width: 1; opacity: 0.5"/>`;
                svg += `<g class="mindmap-node">
                    <rect class="mindmap-node-leaf" x="${lx - 40}" y="${ly - 12}" width="80" height="24" rx="4"/>
                    <text class="mindmap-text mindmap-text-leaf" x="${lx}" y="${ly}">${truncateText(item, 12)}</text>
                </g>`;
            });
        }
    });

    svg += '</svg>';
    canvas.innerHTML = svg;
}

function truncateText(text, maxLength) {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength - 2) + '...';
}

function applyMindmapZoom() {
    const svg = document.querySelector('.mindmap-svg');
    if (svg) {
        svg.style.transform = `scale(${mindmapZoom})`;
    }
}

function exportMindMapAsPNG() {
    const canvas = document.getElementById('mindmap-canvas');
    if (!canvas) return;

    // Create a canvas element and draw the SVG
    const svg = canvas.querySelector('svg');
    if (!svg) return;

    const svgData = new XMLSerializer().serializeToString(svg);
    const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `${currentInfographicData?.title || 'mindmap'}_mindmap.svg`;
    a.click();
    URL.revokeObjectURL(url);
}

/* ========================================
   REPORTS FEATURE
   ======================================== */

let currentReportFormat = 'summary';
let currentReportContent = '';

function setupReports() {
    const reportBtn = document.getElementById('report-btn');
    const reportsModal = document.getElementById('reports-modal');
    const closeBtn = document.getElementById('close-reports-modal-btn');
    const formatBtns = document.querySelectorAll('.format-btn');
    const copyBtn = document.getElementById('copy-report-btn');
    const downloadBtn = document.getElementById('download-report-btn');
    const printBtn = document.getElementById('print-report-btn');

    if (!reportBtn || !reportsModal) return;

    reportBtn.addEventListener('click', () => {
        if (!currentInfographicData) {
            alert('Please generate an infographic first.');
            return;
        }
        reportsModal.classList.add('active');
        generateReport(currentReportFormat);
    });

    closeBtn?.addEventListener('click', () => reportsModal.classList.remove('active'));
    reportsModal.addEventListener('click', (e) => {
        if (e.target === reportsModal) reportsModal.classList.remove('active');
    });

    formatBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            formatBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentReportFormat = btn.dataset.format;
            generateReport(currentReportFormat);
        });
    });

    copyBtn?.addEventListener('click', () => {
        navigator.clipboard.writeText(currentReportContent).then(() => {
            const originalText = copyBtn.innerHTML;
            copyBtn.innerHTML = '<span class="material-symbols-rounded">check</span> Copied!';
            setTimeout(() => copyBtn.innerHTML = originalText, 2000);
        });
    });

    downloadBtn?.addEventListener('click', () => {
        const blob = new Blob([currentReportContent], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${currentInfographicData?.title || 'report'}_${currentReportFormat}.txt`;
        a.click();
        URL.revokeObjectURL(url);
    });

    printBtn?.addEventListener('click', () => {
        const printWindow = window.open('', '_blank');
        printWindow.document.write(`
            <html>
            <head><title>${currentInfographicData?.title || 'Report'}</title>
            <style>
                body { font-family: 'Segoe UI', sans-serif; padding: 2rem; max-width: 800px; margin: 0 auto; }
                h1 { color: #2563eb; margin-bottom: 1rem; }
                h2 { color: #334155; margin-top: 1.5rem; }
                ul { margin-left: 1.5rem; }
                li { margin-bottom: 0.5rem; }
            </style>
            </head>
            <body>${document.getElementById('report-content')?.innerHTML || ''}</body>
            </html>
        `);
        printWindow.document.close();
        printWindow.print();
    });
}

async function generateReport(format) {
    if (!currentInfographicData) return;

    const data = currentInfographicData;
    const reportContainer = document.getElementById('report-content');
    if (!reportContainer) return;

    // Show loading state
    reportContainer.innerHTML = `
        <div class="report-placeholder">
            <span class="material-symbols-rounded rotating">sync</span>
            <p>Generating AI-powered ${format} report...</p>
        </div>
    `;

    // Try AI-powered report generation
    const aiReport = await generateAIReport(format);

    if (aiReport) {
        // Convert markdown to HTML
        const htmlContent = convertMarkdownToHTML(aiReport);
        reportContainer.innerHTML = `<div class="report-text">${htmlContent}</div>`;
        currentReportContent = aiReport;
        return;
    }

    // Fallback to basic generation
    console.log('Using fallback report generation');

    let html = '';
    let text = '';

    switch (format) {
        case 'summary':
            html = `<div class="report-text">
                <h1>${data.title}</h1>
                <p>${data.summary}</p>
                <h2>Key Points</h2>
                <ul>
                    ${(data.sections || []).map(s => `<li><strong>${s.title}</strong></li>`).join('')}
                </ul>
            </div>`;
            text = `${data.title}\n\n${data.summary}\n\nKey Points:\n${(data.sections || []).map(s => `- ${s.title}`).join('\n')}`;
            break;

        case 'detailed':
            html = `<div class="report-text">
                <h1>${data.title}</h1>
                <p>${data.summary}</p>
                ${(data.sections || []).map(s => `
                    <h2>${s.title}</h2>
                    ${formatSectionContent(s)}
                `).join('')}
            </div>`;
            text = `${data.title}\n\n${data.summary}\n\n${(data.sections || []).map(s => `${s.title}\n${formatSectionContentText(s)}`).join('\n\n')}`;
            break;

        case 'bullet':
            html = `<div class="report-text">
                <h1>${data.title}</h1>
                <ul>
                    ${(data.sections || []).map(s => `
                        <li><strong>${s.title}</strong>
                            ${formatSectionAsBullets(s)}
                        </li>
                    `).join('')}
                </ul>
            </div>`;
            text = `${data.title}\n\n${(data.sections || []).map(s => `• ${s.title}\n${formatSectionAsBulletsText(s)}`).join('\n')}`;
            break;

        case 'study-guide':
            html = `<div class="report-text">
                <h1>📚 Study Guide: ${data.title}</h1>
                <p><em>${data.summary}</em></p>
                <h2>Learning Objectives</h2>
                <p>After reviewing this material, you should be able to:</p>
                <ul>
                    ${(data.sections || []).map(s => `<li>Understand ${s.title}</li>`).join('')}
                </ul>
                <h2>Content Review</h2>
                ${(data.sections || []).map((s, i) => `
                    <h3>${i + 1}. ${s.title}</h3>
                    ${formatSectionContent(s)}
                `).join('')}
                <h2>Self-Assessment Questions</h2>
                <ul>
                    ${(data.sections || []).slice(0, 5).map(s => `<li>What are the key points about ${s.title}?</li>`).join('')}
                </ul>
            </div>`;
            text = `STUDY GUIDE: ${data.title}\n\n${data.summary}\n\nLEARNING OBJECTIVES:\n${(data.sections || []).map(s => `- Understand ${s.title}`).join('\n')}\n\nCONTENT:\n${(data.sections || []).map((s, i) => `${i + 1}. ${s.title}\n${formatSectionContentText(s)}`).join('\n\n')}`;
            break;
    }

    reportContainer.innerHTML = html;
    currentReportContent = text;
}

function formatSectionContent(section) {
    if (Array.isArray(section.content)) {
        return `<ul>${section.content.map(c => `<li>${c}</li>`).join('')}</ul>`;
    } else if (typeof section.content === 'object') {
        if (section.content.mnemonic) {
            return `<p><strong>${section.content.mnemonic}</strong>: ${section.content.explanation}</p>`;
        } else if (section.content.center) {
            return `<p><strong>${section.content.center}</strong></p>
                ${section.content.branches ? `<ul>${section.content.branches.map(b => `<li>${b}</li>`).join('')}</ul>` : ''}`;
        } else if (section.content.data) {
            return `<ul>${section.content.data.map(d => `<li>${d.label}: ${d.value}%</li>`).join('')}</ul>`;
        } else if (section.content.headers && section.content.rows) {
            return `<table style="width:100%; border-collapse: collapse; margin: 1rem 0;">
                <tr>${section.content.headers.map(h => `<th style="border: 1px solid #ddd; padding: 8px; background: #f5f5f5;">${h}</th>`).join('')}</tr>
                ${section.content.rows.map(row => `<tr>${row.map(cell => `<td style="border: 1px solid #ddd; padding: 8px;">${cell}</td>`).join('')}</tr>`).join('')}
            </table>`;
        }
    }
    return `<p>${section.content}</p>`;
}

function formatSectionContentText(section) {
    if (Array.isArray(section.content)) {
        return section.content.map(c => `  - ${c}`).join('\n');
    } else if (typeof section.content === 'object') {
        if (section.content.mnemonic) {
            return `  ${section.content.mnemonic}: ${section.content.explanation}`;
        } else if (section.content.center) {
            return `  ${section.content.center}\n${section.content.branches ? section.content.branches.map(b => `    - ${b}`).join('\n') : ''}`;
        } else if (section.content.data) {
            return section.content.data.map(d => `  - ${d.label}: ${d.value}%`).join('\n');
        }
    }
    return `  ${section.content}`;
}

function formatSectionAsBullets(section) {
    if (Array.isArray(section.content)) {
        return `<ul>${section.content.map(c => `<li>${c}</li>`).join('')}</ul>`;
    }
    return '';
}

function formatSectionAsBulletsText(section) {
    if (Array.isArray(section.content)) {
        return section.content.map(c => `  ◦ ${c}`).join('\n');
    }
    return '';
}

/* ========================================
   FLASHCARDS FEATURE
   ======================================== */

let flashcards = [];
let currentFlashcardIndex = 0;

function setupFlashcards() {
    const flashcardsBtn = document.getElementById('flashcards-btn');
    const flashcardsModal = document.getElementById('flashcards-modal');
    const closeBtn = document.getElementById('close-flashcards-modal-btn');
    const generateBtn = document.getElementById('generate-flashcards-btn');
    const prevBtn = document.getElementById('prev-card-btn');
    const nextBtn = document.getElementById('next-card-btn');
    const shuffleBtn = document.getElementById('shuffle-cards-btn');
    const flashcard = document.getElementById('current-flashcard');

    if (!flashcardsBtn || !flashcardsModal) return;

    flashcardsBtn.addEventListener('click', () => {
        if (!currentInfographicData) {
            alert('Please generate an infographic first.');
            return;
        }
        flashcardsModal.classList.add('active');
    });

    closeBtn?.addEventListener('click', () => flashcardsModal.classList.remove('active'));
    flashcardsModal.addEventListener('click', (e) => {
        if (e.target === flashcardsModal) flashcardsModal.classList.remove('active');
    });

    generateBtn?.addEventListener('click', generateFlashcards);
    prevBtn?.addEventListener('click', () => navigateFlashcard(-1));
    nextBtn?.addEventListener('click', () => navigateFlashcard(1));
    shuffleBtn?.addEventListener('click', shuffleFlashcards);

    flashcard?.addEventListener('click', () => {
        flashcard.classList.toggle('flipped');
    });
}

async function generateFlashcards() {
    if (!currentInfographicData) return;

    const generateBtn = document.getElementById('generate-flashcards-btn');
    const questionEl = document.getElementById('flashcard-question');

    // Show loading state
    if (generateBtn) {
        generateBtn.disabled = true;
        generateBtn.innerHTML = '<span class="material-symbols-rounded rotating">sync</span> Generating with AI...';
    }
    if (questionEl) {
        questionEl.textContent = 'Generating AI-powered flashcards...';
    }

    // Try AI-powered flashcards first
    const aiFlashcards = await generateAIFlashcards();

    if (aiFlashcards && aiFlashcards.length > 0) {
        flashcards = aiFlashcards;
        currentFlashcardIndex = 0;
        renderFlashcard();
        updateFlashcardCounter();
        if (generateBtn) {
            generateBtn.disabled = false;
            generateBtn.innerHTML = '<span class="material-symbols-rounded">auto_fix_high</span> Regenerate';
        }
        return;
    }

    // Fallback to basic generation
    console.log('Using fallback flashcard generation');
    const data = currentInfographicData;
    flashcards = [];

    // Create flashcards from sections
    if (data.sections) {
        data.sections.forEach(section => {
            // Main section question
            flashcards.push({
                question: `What are the key points about ${section.title}?`,
                answer: formatFlashcardAnswer(section)
            });

            // Additional cards for specific content
            if (Array.isArray(section.content) && section.content.length > 3) {
                section.content.forEach((item, i) => {
                    if (i < 5) { // Limit per section
                        flashcards.push({
                            question: `In ${section.title}: Explain "${truncateText(item, 50)}"`,
                            answer: item
                        });
                    }
                });
            }

            if (section.content?.mnemonic) {
                flashcards.push({
                    question: `What does the mnemonic "${section.content.mnemonic}" stand for?`,
                    answer: section.content.explanation
                });
            }
        });
    }

    // Summary card
    flashcards.push({
        question: `Summarize: ${data.title}`,
        answer: data.summary
    });

    currentFlashcardIndex = 0;
    renderFlashcard();
    updateFlashcardCounter();

    if (generateBtn) {
        generateBtn.disabled = false;
        generateBtn.innerHTML = '<span class="material-symbols-rounded">auto_fix_high</span> Regenerate';
    }
}

function formatFlashcardAnswer(section) {
    if (Array.isArray(section.content)) {
        return section.content.slice(0, 5).join('\n• ');
    } else if (typeof section.content === 'object') {
        if (section.content.mnemonic) {
            return `${section.content.mnemonic}: ${section.content.explanation}`;
        } else if (section.content.center) {
            return `${section.content.center}: ${(section.content.branches || []).join(', ')}`;
        }
    }
    return String(section.content || '');
}

function renderFlashcard() {
    if (flashcards.length === 0) return;

    const card = flashcards[currentFlashcardIndex];
    const questionEl = document.getElementById('flashcard-question');
    const answerEl = document.getElementById('flashcard-answer');
    const flashcard = document.getElementById('current-flashcard');

    if (questionEl) questionEl.textContent = card.question;
    if (answerEl) answerEl.textContent = card.answer;
    if (flashcard) flashcard.classList.remove('flipped');
}

function navigateFlashcard(direction) {
    if (flashcards.length === 0) return;

    currentFlashcardIndex += direction;
    if (currentFlashcardIndex < 0) currentFlashcardIndex = flashcards.length - 1;
    if (currentFlashcardIndex >= flashcards.length) currentFlashcardIndex = 0;

    renderFlashcard();
    updateFlashcardCounter();
}

function updateFlashcardCounter() {
    const counter = document.getElementById('flashcard-counter');
    if (counter) {
        counter.textContent = flashcards.length > 0
            ? `${currentFlashcardIndex + 1} / ${flashcards.length}`
            : '0 / 0';
    }
}

function shuffleFlashcards() {
    for (let i = flashcards.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [flashcards[i], flashcards[j]] = [flashcards[j], flashcards[i]];
    }
    currentFlashcardIndex = 0;
    renderFlashcard();
    updateFlashcardCounter();
}

/* ========================================
   QUIZ FEATURE
   ======================================== */

let quizQuestions = [];
let currentQuestionIndex = 0;
let quizScore = 0;
let quizAnswered = false;

function setupQuiz() {
    const quizBtn = document.getElementById('quiz-btn');
    const quizModal = document.getElementById('quiz-modal');
    const closeBtn = document.getElementById('close-quiz-modal-btn');
    const startBtn = document.getElementById('start-quiz-btn');
    const nextBtn = document.getElementById('next-question-btn');
    const retakeBtn = document.getElementById('retake-quiz-btn');

    if (!quizBtn || !quizModal) return;

    quizBtn.addEventListener('click', () => {
        if (!currentInfographicData) {
            alert('Please generate an infographic first.');
            return;
        }
        quizModal.classList.add('active');
        resetQuiz();
    });

    closeBtn?.addEventListener('click', () => quizModal.classList.remove('active'));
    quizModal.addEventListener('click', (e) => {
        if (e.target === quizModal) quizModal.classList.remove('active');
    });

    startBtn?.addEventListener('click', startQuiz);
    nextBtn?.addEventListener('click', nextQuestion);
    retakeBtn?.addEventListener('click', startQuiz);
}

function generateQuizQuestions() {
    if (!currentInfographicData) return;

    const data = currentInfographicData;
    quizQuestions = [];

    if (data.sections) {
        data.sections.forEach(section => {
            if (Array.isArray(section.content) && section.content.length >= 2) {
                // Multiple choice from content
                const correctAnswer = section.content[0];
                const wrongAnswers = getRandomWrongAnswers(data.sections, section, correctAnswer);

                quizQuestions.push({
                    question: `Which of the following is true about ${section.title}?`,
                    options: shuffleArray([correctAnswer, ...wrongAnswers]),
                    correctAnswer: correctAnswer
                });
            }

            if (section.content?.mnemonic) {
                quizQuestions.push({
                    question: `What does the mnemonic "${section.content.mnemonic}" help remember?`,
                    options: shuffleArray([
                        section.content.explanation,
                        `A ${section.title} classification system`,
                        `Diagnostic criteria`,
                        `Treatment protocols`
                    ]),
                    correctAnswer: section.content.explanation
                });
            }
        });

        // Add general knowledge questions
        quizQuestions.push({
            question: `What is the main topic of this infographic?`,
            options: shuffleArray([
                data.title,
                'General Ophthalmology',
                'Clinical Examination',
                'Surgical Techniques'
            ]),
            correctAnswer: data.title
        });
    }

    // Limit to 10 questions max
    quizQuestions = quizQuestions.slice(0, 10);
}

function getRandomWrongAnswers(sections, currentSection, correctAnswer) {
    const wrongAnswers = [];

    sections.forEach(s => {
        if (s !== currentSection && Array.isArray(s.content)) {
            s.content.forEach(item => {
                if (item !== correctAnswer && wrongAnswers.length < 3) {
                    wrongAnswers.push(item);
                }
            });
        }
    });

    while (wrongAnswers.length < 3) {
        wrongAnswers.push(`Option ${wrongAnswers.length + 1}`);
    }

    return wrongAnswers.slice(0, 3);
}

function shuffleArray(array) {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

function resetQuiz() {
    currentQuestionIndex = 0;
    quizScore = 0;
    quizAnswered = false;

    document.getElementById('quiz-container').style.display = 'block';
    document.getElementById('quiz-results').style.display = 'none';
    document.getElementById('start-quiz-btn').style.display = 'flex';
    document.getElementById('next-question-btn').style.display = 'none';
    document.getElementById('quiz-feedback').style.display = 'none';
    document.getElementById('quiz-question').textContent = 'Click "Start Quiz" to begin';
    document.getElementById('quiz-options').innerHTML = '';
    document.getElementById('quiz-progress-bar').style.width = '0%';
    updateQuizScore();
}

async function startQuiz() {
    const startBtn = document.getElementById('start-quiz-btn');
    const questionEl = document.getElementById('quiz-question');

    // Show loading state
    if (startBtn) {
        startBtn.disabled = true;
        startBtn.innerHTML = '<span class="material-symbols-rounded rotating">sync</span> Generating AI Quiz...';
    }
    if (questionEl) {
        questionEl.textContent = 'Generating AI-powered quiz questions...';
    }

    // Try AI-powered quiz first
    const aiQuiz = await generateAIQuiz();

    if (aiQuiz && aiQuiz.length > 0) {
        quizQuestions = aiQuiz;
        console.log(`Generated ${quizQuestions.length} AI quiz questions`);
    } else {
        // Fallback to basic quiz generation
        console.log('Using fallback quiz generation');
        generateQuizQuestions();
    }

    currentQuestionIndex = 0;
    quizScore = 0;
    quizAnswered = false;

    document.getElementById('quiz-results').style.display = 'none';
    document.getElementById('quiz-container').style.display = 'block';

    if (startBtn) {
        startBtn.style.display = 'none';
        startBtn.disabled = false;
        startBtn.innerHTML = '<span class="material-symbols-rounded">play_arrow</span> Start Quiz';
    }

    renderQuizQuestion();
    updateQuizScore();
}

function renderQuizQuestion() {
    if (quizQuestions.length === 0) return;

    const question = quizQuestions[currentQuestionIndex];
    const questionEl = document.getElementById('quiz-question');
    const optionsEl = document.getElementById('quiz-options');
    const progressBar = document.getElementById('quiz-progress-bar');
    const feedback = document.getElementById('quiz-feedback');

    questionEl.textContent = question.question;
    feedback.style.display = 'none';
    quizAnswered = false;

    const progress = ((currentQuestionIndex) / quizQuestions.length) * 100;
    progressBar.style.width = `${progress}%`;

    optionsEl.innerHTML = question.options.map((opt, i) => `
        <div class="quiz-option" data-answer="${opt}">
            <span class="quiz-option-letter">${String.fromCharCode(65 + i)}</span>
            <span>${truncateText(opt, 100)}</span>
        </div>
    `).join('');

    // Add click handlers
    optionsEl.querySelectorAll('.quiz-option').forEach(option => {
        option.addEventListener('click', () => selectQuizAnswer(option, question.correctAnswer));
    });
}

function selectQuizAnswer(optionEl, correctAnswer) {
    if (quizAnswered) return;
    quizAnswered = true;

    const selectedAnswer = optionEl.dataset.answer;
    const isCorrect = selectedAnswer === correctAnswer;
    const feedback = document.getElementById('quiz-feedback');
    const feedbackIcon = document.getElementById('feedback-icon');
    const feedbackText = document.getElementById('feedback-text');
    const nextBtn = document.getElementById('next-question-btn');

    // Mark selected option
    optionEl.classList.add(isCorrect ? 'correct' : 'incorrect');

    // Show correct answer if wrong
    if (!isCorrect) {
        document.querySelectorAll('.quiz-option').forEach(opt => {
            if (opt.dataset.answer === correctAnswer) {
                opt.classList.add('correct');
            }
        });
    } else {
        quizScore++;
    }

    // Show feedback with explanation if available
    feedback.style.display = 'flex';
    feedback.className = `quiz-feedback ${isCorrect ? 'correct' : 'incorrect'}`;
    feedbackIcon.textContent = isCorrect ? 'check_circle' : 'cancel';

    const currentQuestion = quizQuestions[currentQuestionIndex];
    let feedbackMessage = isCorrect ? 'Correct!' : `Incorrect. The correct answer was: "${truncateText(correctAnswer, 50)}"`;

    // Add explanation if available (from AI-generated questions)
    if (currentQuestion.explanation) {
        feedbackMessage += `\n\n💡 ${currentQuestion.explanation}`;
    }

    feedbackText.textContent = feedbackMessage;

    nextBtn.style.display = 'flex';
    updateQuizScore();
}

function nextQuestion() {
    currentQuestionIndex++;
    document.getElementById('next-question-btn').style.display = 'none';

    if (currentQuestionIndex >= quizQuestions.length) {
        showQuizResults();
    } else {
        renderQuizQuestion();
    }
}

function showQuizResults() {
    document.getElementById('quiz-container').style.display = 'none';
    document.getElementById('quiz-results').style.display = 'flex';

    const percentage = Math.round((quizScore / quizQuestions.length) * 100);
    document.getElementById('results-percentage').textContent = `${percentage}%`;

    let message = '';
    if (percentage >= 90) message = '🌟 Excellent! You\'ve mastered this topic!';
    else if (percentage >= 70) message = '👍 Great job! Keep studying to perfect your knowledge.';
    else if (percentage >= 50) message = '📚 Good effort! Review the material and try again.';
    else message = '💪 Keep practicing! Review the infographic and retake the quiz.';

    document.getElementById('results-message').textContent = message;
}

function updateQuizScore() {
    const scoreEl = document.getElementById('quiz-score');
    if (scoreEl) {
        scoreEl.textContent = `Score: ${quizScore}/${quizQuestions.length || 0}`;
    }
}

/* ========================================
   SLIDE DECK FEATURE
   ======================================== */

let slides = [];
let currentSlideIndex = 0;

function setupSlideDeck() {
    const slideBtn = document.getElementById('slidedeck-btn');
    const slideModal = document.getElementById('slidedeck-modal');
    const closeBtn = document.getElementById('close-slidedeck-modal-btn');
    const generateBtn = document.getElementById('generate-slides-btn');
    const prevBtn = document.getElementById('slide-prev-btn');
    const nextBtn = document.getElementById('slide-next-btn');
    const presentBtn = document.getElementById('present-slides-btn');
    const exportBtn = document.getElementById('export-slides-btn');

    if (!slideBtn || !slideModal) return;

    slideBtn.addEventListener('click', () => {
        if (!currentInfographicData) {
            alert('Please generate an infographic first.');
            return;
        }
        slideModal.classList.add('active');
    });

    closeBtn?.addEventListener('click', () => slideModal.classList.remove('active'));
    slideModal.addEventListener('click', (e) => {
        if (e.target === slideModal) slideModal.classList.remove('active');
    });

    generateBtn?.addEventListener('click', generateSlides);
    prevBtn?.addEventListener('click', () => navigateSlide(-1));
    nextBtn?.addEventListener('click', () => navigateSlide(1));
    presentBtn?.addEventListener('click', enterPresentationMode);
    exportBtn?.addEventListener('click', exportSlidesAsHTML);
}

function generateSlides() {
    if (!currentInfographicData) return;

    const data = currentInfographicData;
    slides = [];

    // Title slide
    slides.push({
        type: 'title',
        title: data.title,
        subtitle: data.summary
    });

    // Helper to recursively remove citation brackets like [1] or [1, 2]
    function stripReferences(val) {
        if (typeof val === 'string') {
            return val.replace(/\[\d+(?:\s*,\s*\d+)*\]/g, '').trim();
        } else if (Array.isArray(val)) {
            return val.map(stripReferences);
        } else if (typeof val === 'object' && val !== null) {
            const cleaned = {};
            for (let k in val) cleaned[k] = stripReferences(val[k]);
            return cleaned;
        }
        return val;
    }

    // Content slides from sections
    if (data.sections) {
        data.sections.forEach(section => {
            slides.push({
                type: 'section',
                title: stripReferences(section.title)
            });

            slides.push({
                type: 'content',
                title: stripReferences(section.title),
                content: stripReferences(section.content),
                contentType: section.type
            });
        });
    }

    // Thank you slide
    slides.push({
        type: 'end',
        title: 'Thank You',
        subtitle: 'Questions?'
    });

    currentSlideIndex = 0;
    renderSlide();
    renderThumbnails();
    updateSlideIndicator();

    const presentBtn = document.getElementById('present-slides-btn');
    const exportBtn = document.getElementById('export-slides-btn');
    if (presentBtn) presentBtn.style.display = 'flex';
    if (exportBtn) exportBtn.style.display = 'flex';
}

function renderSlide() {
    if (slides.length === 0) return;

    const slideContent = document.getElementById('slide-content');
    const slide = slides[currentSlideIndex];

    slideContent.className = 'slide-content';

    if (slide.type === 'title') {
        slideContent.classList.add('title-slide');
        slideContent.innerHTML = `
            <h1>${slide.title}</h1>
            <p>${slide.subtitle || ''}</p>
        `;
    } else if (slide.type === 'section') {
        slideContent.classList.add('section-slide');
        slideContent.innerHTML = `<h2>${slide.title}</h2>`;
    } else if (slide.type === 'end') {
        slideContent.classList.add('title-slide');
        slideContent.innerHTML = `
            <h1>${slide.title}</h1>
            <p>${slide.subtitle || ''}</p>
        `;
    } else {
        slideContent.classList.add('content-slide');
        let contentHtml = '';

        if (Array.isArray(slide.content)) {
            // Enhanced List Graphical Style
            contentHtml = `<ul style="list-style: none; padding-left: 0;">
                ${slide.content.map(c => `
                    <li style="margin-bottom: 0.8rem; display: flex; align-items: flex-start; gap: 12px; font-size: 1.4rem;">
                        <span class="material-symbols-rounded" style="color: #2563eb; flex-shrink: 0; margin-top: 4px;">arrow_forward_ios</span>
                        <span>${c}</span>
                    </li>
                `).join('')}
            </ul>`;
        } else if (typeof slide.content === 'object' && slide.content !== null) {
            // Check for table structure
            if (slide.content.headers && slide.content.rows) {
                const headers = slide.content.headers || [];
                const rows = slide.content.rows || [];
                contentHtml = `
                <div style="overflow-x: auto; margin-top: 1rem; border-radius: 12px; box-shadow: 0 4px 15px rgba(0,0,0,0.05); border: 1px solid #e2e8f0;">
                    <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 1.25rem;">
                        <thead>
                            <tr style="background: #f8fafc; border-bottom: 2px solid #cbd5e1;">
                                ${headers.map(h => `<th style="padding: 1.2rem; font-weight: 700; color: #1e293b; border-right: 1px solid #e2e8f0;">${h}</th>`).join('')}
                            </tr>
                        </thead>
                        <tbody>
                            ${rows.map((row, idx) => `
                                <tr style="background: ${idx % 2 === 0 ? 'white' : '#f8fafc'}; border-bottom: 1px solid #e2e8f0;">
                                    ${row.map(cell => `<td style="padding: 1.2rem; color: #475569; border-right: 1px solid #e2e8f0;">${cell}</td>`).join('')}
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>`;
            } else if (slide.content.mnemonic) {
                // Enhanced Mnemonic Graphical Style
                contentHtml = `
                    <div style="background: #f8fafc; padding: 2rem; border-left: 6px solid #8b5cf6; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
                        <p><strong style="font-size: 3rem; color: #8b5cf6; display: block; margin-bottom: 1rem; letter-spacing: 3px;">${slide.content.mnemonic}</strong></p>
                        <p style="font-size: 1.5rem; color: #475569; line-height: 1.6;">${slide.content.explanation}</p>
                    </div>`;
            } else if (slide.content.center) {
                // Enhanced Mindmap Graphical Style
                contentHtml = `
                    <div style="text-align: center; margin-bottom: 2.5rem;">
                        <span style="background: linear-gradient(135deg, #3b82f6, #1d4ed8); color: white; padding: 12px 24px; border-radius: 30px; font-weight: 700; font-size: 1.5rem; box-shadow: 0 4px 10px rgba(37, 99, 235, 0.3);">${slide.content.center}</span>
                    </div>`;
                if (slide.content.branches) {
                    contentHtml += `
                        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 1.5rem;">
                            ${slide.content.branches.map(b => `<div style="background: #eff6ff; padding: 1.2rem; border-radius: 10px; border: 2px solid #bfdbfe; text-align: center; font-size: 1.2rem; font-weight: 500; color: #1e3a8a;">${b}</div>`).join('')}
                        </div>`;
                }
            } else if (slide.content.data) {
                // Enhanced Chart Graphical Style
                contentHtml = `
                    <div style="display: flex; flex-wrap: wrap; gap: 1.5rem;">
                        ${slide.content.data.map(d => `
                            <div style="background: white; padding: 2rem; border-radius: 16px; box-shadow: 0 6px 15px rgba(0,0,0,0.05); border: 2px solid #e2e8f0; flex: 1; min-width: 180px; text-align: center;">
                                <div style="font-size: 3rem; font-weight: 800; color: #10b981; margin-bottom: 0.5rem; line-height: 1;">${d.value}%</div>
                                <div style="color: #64748b; font-size: 1.1rem; text-transform: uppercase; letter-spacing: 1px; font-weight: 600;">${d.label}</div>
                            </div>
                        `).join('')}
                    </div>`;
            } else {
                // Fallback for unexpected object structure
                contentHtml = `<p style="font-size: 1.4rem; line-height: 1.8; color: #334155; white-space: pre-wrap;">${JSON.stringify(slide.content, null, 2)}</p>`;
            }
        } else {
            // Enhanced Plain Text Graphical Style
            contentHtml = `
                <div style="background: #f8fafc; padding: 2rem; border-radius: 12px; border-left: 6px solid #3b82f6; box-shadow: 0 4px 12px rgba(0,0,0,0.03);">
                    <p style="font-size: 1.4rem; line-height: 1.8; color: #334155;">${slide.content}</p>
                </div>`;
        }

        slideContent.innerHTML = `
            <h3 style="display: flex; align-items: center; gap: 12px; border-bottom: none; padding-bottom: 0.5rem; font-size: 2.2rem; color: #0f172a; margin-bottom: 2rem;">
                <span class="material-symbols-rounded" style="color: #2563eb; font-size: 2.2rem;">auto_awesome</span>
                ${slide.title}
            </h3>
            <div style="margin-top: 1rem;">
                ${contentHtml}
            </div>
        `;
    }

    // Update thumbnail active state
    document.querySelectorAll('.slide-thumbnail').forEach((thumb, i) => {
        thumb.classList.toggle('active', i === currentSlideIndex);
    });
}

function renderThumbnails() {
    const container = document.getElementById('slide-thumbnails');
    if (!container) return;

    container.innerHTML = slides.map((slide, i) => `
        <div class="slide-thumbnail ${i === currentSlideIndex ? 'active' : ''}" data-index="${i}">
            ${slide.type === 'title' ? '📌 Title' : slide.type === 'section' ? '📂 Section' : slide.type === 'end' ? '🎉 End' : truncateText(slide.title, 15)}
        </div>
    `).join('');

    container.querySelectorAll('.slide-thumbnail').forEach(thumb => {
        thumb.addEventListener('click', () => {
            currentSlideIndex = parseInt(thumb.dataset.index);
            renderSlide();
            updateSlideIndicator();
        });
    });
}

function navigateSlide(direction) {
    if (slides.length === 0) return;

    currentSlideIndex += direction;
    if (currentSlideIndex < 0) currentSlideIndex = slides.length - 1;
    if (currentSlideIndex >= slides.length) currentSlideIndex = 0;

    renderSlide();
    updateSlideIndicator();
}

function updateSlideIndicator() {
    const indicator = document.getElementById('slide-indicator');
    if (indicator) {
        indicator.textContent = slides.length > 0
            ? `Slide ${currentSlideIndex + 1} of ${slides.length}`
            : 'Slide 0 of 0';
    }
}

function enterPresentationMode() {
    if (slides.length === 0) return;

    const presentationDiv = document.createElement('div');
    presentationDiv.className = 'presentation-mode';
    presentationDiv.id = 'presentation-mode';

    presentationDiv.innerHTML = `
        <div class="slide-frame">
            <div class="slide-content" id="presentation-slide-content"></div>
        </div>
        <div class="presentation-controls">
            <button id="pres-prev"><span class="material-symbols-rounded">chevron_left</span></button>
            <button id="pres-exit"><span class="material-symbols-rounded">close</span></button>
            <button id="pres-next"><span class="material-symbols-rounded">chevron_right</span></button>
        </div>
    `;

    document.body.appendChild(presentationDiv);
    renderPresentationSlide();

    document.getElementById('pres-prev').addEventListener('click', () => {
        navigateSlide(-1);
        renderPresentationSlide();
    });
    document.getElementById('pres-next').addEventListener('click', () => {
        navigateSlide(1);
        renderPresentationSlide();
    });
    document.getElementById('pres-exit').addEventListener('click', exitPresentationMode);

    // Keyboard navigation
    document.addEventListener('keydown', handlePresentationKeydown);
}

function renderPresentationSlide() {
    const content = document.getElementById('presentation-slide-content');
    if (!content) return;

    const slide = slides[currentSlideIndex];
    content.className = 'slide-content';

    if (slide.type === 'title' || slide.type === 'end') {
        content.classList.add('title-slide');
        content.innerHTML = `
            <h1>${slide.title}</h1>
            <p>${slide.subtitle || ''}</p>
        `;
    } else if (slide.type === 'section') {
        content.classList.add('section-slide');
        content.innerHTML = `<h2>${slide.title}</h2>`;
    } else {
        content.classList.add('content-slide');
        let contentHtml = '';

        if (Array.isArray(slide.content)) {
            contentHtml = `<ul>${slide.content.map(c => `<li>${c}</li>`).join('')}</ul>`;
        } else if (typeof slide.content === 'object') {
            if (slide.content.mnemonic) {
                contentHtml = `<p><strong style="font-size: 3rem; color: #8b5cf6;">${slide.content.mnemonic}</strong></p>
                    <p>${slide.content.explanation}</p>`;
            } else if (slide.content.center) {
                contentHtml = `<p><strong>${slide.content.center}</strong></p>
                    ${slide.content.branches ? `<ul>${slide.content.branches.map(b => `<li>${b}</li>`).join('')}</ul>` : ''}`;
            }
        } else {
            contentHtml = `<p>${slide.content}</p>`;
        }

        content.innerHTML = `
            <h3>${slide.title}</h3>
            ${contentHtml}
        `;
    }
}

function handlePresentationKeydown(e) {
    if (!document.getElementById('presentation-mode')) return;

    if (e.key === 'ArrowRight' || e.key === ' ') {
        navigateSlide(1);
        renderPresentationSlide();
    } else if (e.key === 'ArrowLeft') {
        navigateSlide(-1);
        renderPresentationSlide();
    } else if (e.key === 'Escape') {
        exitPresentationMode();
    }
}

function exitPresentationMode() {
    const presentation = document.getElementById('presentation-mode');
    if (presentation) {
        presentation.remove();
    }
    document.removeEventListener('keydown', handlePresentationKeydown);
}

function exportSlidesAsHTML() {
    if (slides.length === 0) return;

    let html = `<!DOCTYPE html>
<html>
<head>
    <title>${currentInfographicData.title} - Presentation</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Segoe UI', sans-serif; }
        .slide { width: 100vw; height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 4rem; }
        .title-slide { background: linear-gradient(135deg, #1e293b, #334155); color: white; text-align: center; }
        .section-slide { background: linear-gradient(135deg, #3b82f6, #2563eb); color: white; text-align: center; }
        .content-slide { background: white; color: #1f2937; align-items: flex-start; }
        h1 { font-size: 3.5rem; margin-bottom: 1rem; }
        h2 { font-size: 3rem; }
        h3 { font-size: 2rem; color: #3b82f6; margin-bottom: 2rem; width: 100%; }
        p { font-size: 1.5rem; opacity: 0.9; }
        ul { font-size: 1.3rem; line-height: 2; list-style: none; }
        li::before { content: "▸ "; color: #3b82f6; }
        @media print { .slide { page-break-after: always; } }
    </style>
</head>
<body>
${slides.map(slide => {
        if (slide.type === 'title' || slide.type === 'end') {
            return `<div class="slide title-slide">
            <h1>${slide.title}</h1>
            <p>${slide.subtitle || ''}</p>
        </div>`;
        } else if (slide.type === 'section') {
            return `<div class="slide section-slide">
            <h2>${slide.title}</h2>
        </div>`;
        } else {
            let content = '';
            if (Array.isArray(slide.content)) {
                content = `<ul>${slide.content.map(c => `<li>${c}</li>`).join('')}</ul>`;
            } else if (typeof slide.content === 'string') {
                content = `<p>${slide.content}</p>`;
            }
            return `<div class="slide content-slide">
            <h3>${slide.title}</h3>
            ${content}
        </div>`;
        }
    }).join('\n')}
</body>
</html>`;

    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${currentInfographicData.title.replace(/[^a-z0-9]/gi, '_')}_slides.html`;
    a.click();
    URL.revokeObjectURL(url);
}

/* ========================================
   COMMUNITY HUB FUNCTIONALITY
   ======================================== */

function setupCommunityHub() {
    const communityBtn = document.getElementById('community-btn');
    const submitCommunityBtn = document.getElementById('submit-community-btn');
    const communityModal = document.getElementById('community-modal');
    const submitModal = document.getElementById('submit-community-modal');
    const previewModal = document.getElementById('community-preview-modal');

    // Close buttons
    const closeCommBtn = document.getElementById('close-community-modal-btn');
    const closeSubmitBtn = document.getElementById('close-submit-modal-btn');
    const closePreviewBtn = document.getElementById('close-preview-modal-btn');
    const cancelSubmitBtn = document.getElementById('cancel-submit-btn');

    // Refresh button
    const refreshBtn = document.getElementById('refresh-community-btn');

    // Tabs
    const tabs = document.querySelectorAll('.community-tab');
    const pendingContent = document.getElementById('pending-content');
    const approvedContent = document.getElementById('approved-content');

    // Lists and counts
    const pendingList = document.getElementById('pending-submissions-list');
    const approvedList = document.getElementById('approved-submissions-list');
    const pendingEmpty = document.getElementById('pending-empty');
    const approvedEmpty = document.getElementById('approved-empty');
    const pendingCount = document.getElementById('pending-count');
    const approvedCount = document.getElementById('approved-count');
    const communityCountBadge = document.getElementById('community-count-badge');

    // Submit form elements
    const submitterNameInput = document.getElementById('submitter-name');
    const submitPreviewTitle = document.getElementById('submit-preview-title');
    const submitPreviewSummary = document.getElementById('submit-preview-summary');
    const confirmSubmitBtn = document.getElementById('confirm-submit-btn');

    // Preview elements
    const previewTitle = document.getElementById('preview-title');
    const previewAuthor = document.getElementById('preview-author');
    const previewContainer = document.getElementById('preview-infographic-container');
    const previewLikeBtn = document.getElementById('preview-like-btn');
    const previewDownloadBtn = document.getElementById('preview-download-btn');

    let currentPreviewId = null;
    let cachedSubmissions = { submissions: [], approved: [] };

    // Check if CommunitySubmissions module is loaded
    function isCommunityModuleLoaded() {
        return typeof window.CommunitySubmissions !== 'undefined';
    }

    // Open Community Modal
    async function openCommunityModal() {
        if (!isCommunityModuleLoaded()) {
            alert('Community module not loaded. Please refresh the page.');
            return;
        }

        communityModal.classList.add('active');
        await loadCommunitySubmissions();
    }

    // Load submissions
    async function loadCommunitySubmissions() {
        try {
            const data = await CommunitySubmissions.getAll();
            cachedSubmissions = data;

            const pending = data.submissions || [];
            const approved = data.approved || [];

            // Update counts
            pendingCount.textContent = pending.length;
            approvedCount.textContent = approved.length;

            // Update badge
            if (pending.length > 0) {
                communityCountBadge.textContent = pending.length;
                communityCountBadge.style.display = 'inline';
            } else {
                communityCountBadge.style.display = 'none';
            }

            // Render pending
            renderSubmissionsList(pending, pendingList, pendingEmpty, false);

            // Render approved
            renderSubmissionsList(approved, approvedList, approvedEmpty, true);

        } catch (err) {
            console.error('Error loading community submissions:', err);
        }
    }

    // Render submissions list
    function renderSubmissionsList(submissions, container, emptyElement, isApproved) {
        if (submissions.length === 0) {
            container.innerHTML = '';
            emptyElement.style.display = 'flex';
            return;
        }

        emptyElement.style.display = 'none';
        container.innerHTML = submissions.map(s => CommunitySubmissions.generateCardHTML(s, false)).join('');
    }

    // Tab switching
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');

            const tabName = tab.dataset.tab;
            if (tabName === 'pending') {
                pendingContent.style.display = 'block';
                approvedContent.style.display = 'none';
            } else {
                pendingContent.style.display = 'none';
                approvedContent.style.display = 'block';
            }
        });
    });

    // Open Submit Modal
    function openSubmitModal() {
        if (!currentInfographicData) {
            alert('Please generate an infographic first before submitting to the community.');
            return;
        }

        // Update preview
        submitPreviewTitle.textContent = currentInfographicData.title || 'Untitled Infographic';
        submitPreviewSummary.textContent = currentInfographicData.summary || 'No summary available.';

        // Clear previous name
        submitterNameInput.value = localStorage.getItem('community_username') || '';

        submitModal.classList.add('active');
    }

    // Submit to community
    async function handleSubmitToCommunity() {
        const userName = submitterNameInput.value.trim();

        if (!userName) {
            alert('Please enter your name.');
            submitterNameInput.focus();
            return;
        }

        if (!currentInfographicData) {
            alert('No infographic data to submit.');
            return;
        }

        // Save username for future submissions
        localStorage.setItem('community_username', userName);

        // Show loading state
        const originalText = confirmSubmitBtn.innerHTML;
        confirmSubmitBtn.innerHTML = '<span class="material-symbols-rounded">sync</span> Publishing...';
        confirmSubmitBtn.disabled = true;

        try {
            // Attach adhered Kanski images if present
            const kanskiImages = await loadKanskiFromIDB(currentInfographicData.title);
            if (kanskiImages && kanskiImages.length > 0) {
                currentInfographicData.kanskiImages = kanskiImages;
                console.log(`[Submit] Attaching ${kanskiImages.length} Kanski image(s) to submission`);
            }

            const result = await CommunitySubmissions.submit(currentInfographicData, userName);

            if (result.success) {
                alert(result.message);
                submitModal.classList.remove('active');

                // Refresh community list if modal is open
                if (communityModal.classList.contains('active')) {
                    await loadCommunitySubmissions();
                }
            } else {
                alert('Submission failed: ' + result.message);
            }
        } catch (err) {
            console.error('Submission error:', err);
            alert('An error occurred while submitting. Please try again.');
        } finally {
            confirmSubmitBtn.innerHTML = originalText;
            confirmSubmitBtn.disabled = false;
        }
    }

    // Preview submission
    window.handlePreviewSubmission = async function (submissionId) {
        currentPreviewId = submissionId;

        // Find submission
        let submission = (cachedSubmissions.submissions || []).find(s => s.id === submissionId);
        if (!submission) {
            submission = (cachedSubmissions.approved || []).find(s => s.id === submissionId);
        }

        if (!submission) {
            alert('Could not find submission.');
            return;
        }

        // Update preview modal
        previewTitle.textContent = submission.title;
        previewAuthor.innerHTML = `<span class="material-symbols-rounded">person</span> ${submission.userName}`;

        // Render the infographic preview (simplified)
        if (submission.data) {
            previewContainer.innerHTML = `
                <div style="background: white; padding: 2rem; border-radius: 12px;">
                    <h2 style="margin-bottom: 1rem; color: #1f2937;">${submission.title}</h2>
                    <p style="color: #6b7280; margin-bottom: 1.5rem;">${submission.summary || ''}</p>
                    ${submission.data.sections ? `
                        <div style="display: grid; gap: 1rem;">
                            ${submission.data.sections.slice(0, 3).map(section => `
                                <div style="background: #f8fafc; padding: 1rem; border-radius: 8px; border-left: 4px solid #3b82f6;">
                                    <h4 style="margin: 0 0 0.5rem 0; color: #334155;">${section.title || 'Section'}</h4>
                                    <p style="margin: 0; font-size: 0.9rem; color: #64748b;">
                                        ${Array.isArray(section.content)
                    ? section.content.slice(0, 3).join(', ') + (section.content.length > 3 ? '...' : '')
                    : (typeof section.content === 'string' ? section.content.substring(0, 150) : 'Content available')}
                                    </p>
                                </div>
                            `).join('')}
                            ${submission.data.sections.length > 3 ? `
                                <p style="text-align: center; color: #9ca3af; font-style: italic;">
                                    ...and ${submission.data.sections.length - 3} more sections
                                </p>
                            ` : ''}
                        </div>
                    ` : '<p style="color: #9ca3af;">Full content available after download.</p>'}
                </div>
            `;
        } else {
            previewContainer.innerHTML = '<p style="text-align: center; color: #9ca3af;">Preview not available.</p>';
        }

        previewModal.classList.add('active');
    };

    // Load submission directly
    window.handleLoadCommunitySubmission = async function (submissionId) {
        // Find in cached submissions
        let submission = (cachedSubmissions.submissions || []).find(s => s.id === submissionId);
        if (!submission) {
            submission = (cachedSubmissions.approved || []).find(s => s.id === submissionId);
        }

        if (submission && submission.data) {
            if (confirm(`Load "${submission.title}"? This will replace your current workspace content.`)) {
                // Check local library for user's chapterId override
                try {
                    const localLib = JSON.parse(localStorage.getItem(LIBRARY_KEY) || '[]');
                    const localItem = localLib.find(i => i.title === submission.title);
                    if (localItem && localItem.chapterId) {
                        submission.data.chapterId = localItem.chapterId;
                    }
                } catch { /* ignore */ }
                currentInfographicData = submission.data;
                renderInfographic(submission.data);
                communityModal.classList.remove('active');
                // Optional: Scroll to top
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }
        } else {
            const authorInfo = submission?.userName ? `\n\nOriginal author: ${submission.userName}` : '';
            alert(
                `⚠️ Unable to load this infographic.\n\n` +
                `The content data is missing or corrupted.${authorInfo}\n\n` +
                `Please contact the original uploader and ask them to resubmit this infographic to the Community Hub.`
            );
        }
    };

    // Like submission
    window.handleLikeSubmission = async function (submissionId) {
        try {
            const result = await CommunitySubmissions.like(submissionId);

            if (result.success) {
                // Update the like count in UI
                const card = document.querySelector(`.community-card[data-id="${submissionId}"]`);
                if (card) {
                    const likesCount = card.querySelector('.likes-count');
                    if (likesCount) {
                        likesCount.innerHTML = `<span class="material-symbols-rounded">favorite</span> ${result.likes}`;
                    }
                }
            } else {
                alert(result.message || 'Could not like submission.');
            }
        } catch (err) {
            console.error('Like error:', err);
        }
    };

    // Download submission to local library
    window.handleDownloadSubmission = async function (submissionId) {
        try {
            // First attempt (no overwrite)
            let result = await CommunitySubmissions.downloadToLibrary(submissionId, false);

            if (result.success) {
                alert(result.message);
            } else if (result.status === 'duplicate') {
                // Handle duplicate with replace option
                if (confirm(result.message + "\n\nDo you want to replace the existing infographic with this one?")) {
                    // Second attempt (with overwrite)
                    result = await CommunitySubmissions.downloadToLibrary(submissionId, true);
                    if (result.success) {
                        alert(result.message);
                    } else {
                        alert(result.message || 'Could not replace infographic.');
                    }
                }
            } else {
                alert(result.message || 'Could not download.');
            }
        } catch (err) {
            console.error('Download error:', err);
            alert('An error occurred while downloading.');
        }
    };

    // Approve submission (admin action from community hub)
    window.handleApproveSubmission = async function (submissionId) {
        const adminPIN = prompt('Enter admin PIN to approve this submission:');
        if (!adminPIN) return;

        try {
            const result = await CommunitySubmissions.approve(submissionId, adminPIN);
            if (result.success) {
                alert('Submission approved successfully!');
                await loadCommunitySubmissions();
            } else {
                alert(result.message || 'Failed to approve submission.');
            }
        } catch (err) {
            console.error('Approve error:', err);
            alert('An error occurred while approving.');
        }
    };

    // Reject submission (admin action from community hub)
    window.handleRejectSubmission = async function (submissionId) {
        const adminPIN = prompt('Enter admin PIN to reject this submission:');
        if (!adminPIN) return;

        if (!confirm('Are you sure you want to reject and permanently delete this submission?')) return;

        try {
            const result = await CommunitySubmissions.reject(submissionId, adminPIN);
            if (result.success) {
                alert('Submission rejected and removed.');
                await loadCommunitySubmissions();
            } else {
                alert(result.message || 'Failed to reject submission.');
            }
        } catch (err) {
            console.error('Reject error:', err);
            alert('An error occurred while rejecting.');
        }
    };

    // Event Listeners
    if (communityBtn) {
        communityBtn.addEventListener('click', openCommunityModal);
    }

    if (submitCommunityBtn) {
        submitCommunityBtn.addEventListener('click', openSubmitModal);
    }

    // Add All to Library button (Bulk download approved submissions)
    const addAllToLibraryBtn = document.getElementById('add-all-to-library-btn');
    const addAllProgress = document.getElementById('add-all-progress');

    if (addAllToLibraryBtn) {
        addAllToLibraryBtn.addEventListener('click', async () => {
            const approved = cachedSubmissions.approved || [];

            if (approved.length === 0) {
                alert('No approved infographics to add.');
                return;
            }

            // Ask user whether to replace existing or skip duplicates
            const replaceExisting = confirm(
                `Add all ${approved.length} approved infographics to your library?\n\n` +
                `Click OK to REPLACE existing duplicates with updated versions.\n` +
                `Click Cancel to skip duplicates (keep existing).`
            );

            // Second confirm if they clicked Cancel (they may have wanted to abort entirely)
            if (!replaceExisting) {
                if (!confirm(`Add all ${approved.length} infographics, SKIPPING any that already exist in your library?`)) {
                    return;
                }
            }

            // Disable button and show progress
            addAllToLibraryBtn.disabled = true;
            const originalHTML = addAllToLibraryBtn.innerHTML;
            addAllToLibraryBtn.innerHTML = '<span class="material-symbols-rounded">sync</span> Processing...';

            if (addAllProgress) {
                addAllProgress.style.display = 'flex';
                addAllProgress.className = 'bulk-progress';
            }

            let added = 0;
            let replaced = 0;
            let skipped = 0;
            let failed = 0;

            for (let i = 0; i < approved.length; i++) {
                const submission = approved[i];

                // Update progress
                if (addAllProgress) {
                    addAllProgress.textContent = `Processing ${i + 1}/${approved.length}...`;
                }

                try {
                    // First try without overwrite
                    let result = await CommunitySubmissions.downloadToLibrary(submission.id, false);
                    if (result.success) {
                        added++;
                    } else if (result.status === 'duplicate' && replaceExisting) {
                        // User chose to replace - retry with overwrite
                        result = await CommunitySubmissions.downloadToLibrary(submission.id, true);
                        if (result.success) {
                            replaced++;
                        } else {
                            failed++;
                        }
                    } else if (result.status === 'duplicate') {
                        skipped++;
                    } else {
                        failed++;
                    }
                } catch (err) {
                    console.error(`Failed to add ${submission.title}:`, err);
                    failed++;
                }
            }

            // Show final result
            if (addAllProgress) {
                addAllProgress.className = 'bulk-progress success';
                addAllProgress.textContent = `Done: ${added} added, ${replaced} replaced, ${skipped} skipped, ${failed} failed`;
            }

            // Re-enable button
            addAllToLibraryBtn.disabled = false;
            addAllToLibraryBtn.innerHTML = originalHTML;

            let msg = `Bulk import complete!\n\n✓ Added: ${added}`;
            if (replaced > 0) msg += `\n↻ Replaced: ${replaced}`;
            if (skipped > 0) msg += `\n⊘ Skipped: ${skipped}`;
            if (failed > 0) msg += `\n✗ Failed: ${failed}`;
            alert(msg);
        });
    }

    // Add All to Library button (Bulk download PENDING / New Uploads)
    const addAllPendingBtn = document.getElementById('add-all-pending-to-library-btn');
    const addAllPendingProgress = document.getElementById('add-all-pending-progress');

    if (addAllPendingBtn) {
        addAllPendingBtn.addEventListener('click', async () => {
            const pending = cachedSubmissions.submissions || [];

            if (pending.length === 0) {
                alert('No new uploads to add.');
                return;
            }

            const replaceExisting = confirm(
                `Add all ${pending.length} new uploads to your library?\n\n` +
                `Click OK to REPLACE existing duplicates with updated versions.\n` +
                `Click Cancel to skip duplicates (keep existing).`
            );

            if (!replaceExisting) {
                if (!confirm(`Add all ${pending.length} uploads, SKIPPING any that already exist in your library?`)) {
                    return;
                }
            }

            addAllPendingBtn.disabled = true;
            const originalHTML = addAllPendingBtn.innerHTML;
            addAllPendingBtn.innerHTML = '<span class="material-symbols-rounded">sync</span> Processing...';

            if (addAllPendingProgress) {
                addAllPendingProgress.style.display = 'flex';
                addAllPendingProgress.className = 'bulk-progress';
            }

            let added = 0;
            let replaced = 0;
            let skipped = 0;
            let failed = 0;

            for (let i = 0; i < pending.length; i++) {
                const submission = pending[i];

                if (addAllPendingProgress) {
                    addAllPendingProgress.textContent = `Processing ${i + 1}/${pending.length}...`;
                }

                try {
                    let result = await CommunitySubmissions.downloadToLibrary(submission.id, false);
                    if (result.success) {
                        added++;
                    } else if (result.status === 'duplicate' && replaceExisting) {
                        result = await CommunitySubmissions.downloadToLibrary(submission.id, true);
                        if (result.success) {
                            replaced++;
                        } else {
                            failed++;
                        }
                    } else if (result.status === 'duplicate') {
                        skipped++;
                    } else {
                        failed++;
                    }
                } catch (err) {
                    console.error(`Failed to add ${submission.title}:`, err);
                    failed++;
                }
            }

            if (addAllPendingProgress) {
                addAllPendingProgress.className = 'bulk-progress success';
                addAllPendingProgress.textContent = `Done: ${added} added, ${replaced} replaced, ${skipped} skipped, ${failed} failed`;
            }

            addAllPendingBtn.disabled = false;
            addAllPendingBtn.innerHTML = originalHTML;

            let msg = `Bulk import complete!\n\n✓ Added: ${added}`;
            if (replaced > 0) msg += `\n↻ Replaced: ${replaced}`;
            if (skipped > 0) msg += `\n⊘ Skipped: ${skipped}`;
            if (failed > 0) msg += `\n✗ Failed: ${failed}`;
            alert(msg);
        });
    }

    if (closeCommBtn) {
        closeCommBtn.addEventListener('click', () => {
            communityModal.classList.remove('active');
        });
    }

    if (closeSubmitBtn) {
        closeSubmitBtn.addEventListener('click', () => {
            submitModal.classList.remove('active');
        });
    }

    if (cancelSubmitBtn) {
        cancelSubmitBtn.addEventListener('click', () => {
            submitModal.classList.remove('active');
        });
    }

    if (closePreviewBtn) {
        closePreviewBtn.addEventListener('click', () => {
            previewModal.classList.remove('active');
            currentPreviewId = null;
        });
    }

    if (refreshBtn) {
        refreshBtn.addEventListener('click', async () => {
            refreshBtn.classList.add('rotating');
            await loadCommunitySubmissions();
            setTimeout(() => refreshBtn.classList.remove('rotating'), 500);
        });
    }

    if (confirmSubmitBtn) {
        confirmSubmitBtn.addEventListener('click', handleSubmitToCommunity);
    }

    if (previewLikeBtn) {
        previewLikeBtn.addEventListener('click', () => {
            if (currentPreviewId) {
                handleLikeSubmission(currentPreviewId);
            }
        });
    }

    if (previewDownloadBtn) {
        previewDownloadBtn.addEventListener('click', () => {
            if (currentPreviewId) {
                handleDownloadSubmission(currentPreviewId);
                previewModal.classList.remove('active');
            }
        });
    }

    // Close modals on overlay click
    [communityModal, submitModal, previewModal].forEach(modal => {
        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.classList.remove('active');
                }
            });
        }
    });

    console.log('Community Hub initialized.');
}

/* ========================================
   BACKGROUND MUSIC PLAYER
   ======================================== */

function setupMusicPlayer() {
    const musicToggle = document.getElementById('music-toggle');
    const musicPanel = document.getElementById('music-panel');
    const musicIcon = document.getElementById('music-icon');
    const musicAudio = document.getElementById('music-audio');
    const playPauseBtn = document.getElementById('music-play-pause');
    const volumeSlider = document.getElementById('music-volume');
    const musicStatus = document.getElementById('music-status');
    const stationBtns = document.querySelectorAll('.station-btn');

    if (!musicToggle || !musicAudio) return;

    // Radio station URLs (public streams)
    const stations = {
        classical: {
            name: 'Classical FM',
            // Using Classic FM UK stream
            url: 'https://media-ice.musicradio.com/ClassicFMMP3',
            fallback: 'https://stream.classicfm.com/classicfm.mp3'
        },
        quran: {
            name: 'Quran - Al Minshawi',
            // Correct Quran radio stream - Mohammed Siddiq Al-Minshawi (Mujawwad)
            url: 'https://backup.qurango.net/radio/mohammed_siddiq_alminshawi_mojawwad',
            fallback: 'https://qurango.net/radio/mohammed_siddiq_alminshawi_mojawwad'
        }
    };

    let currentStation = null;
    let isPlaying = false;

    // Toggle panel
    musicToggle.addEventListener('click', () => {
        musicPanel.classList.toggle('hidden');
    });

    // Close panel when clicking outside
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.music-player')) {
            musicPanel.classList.add('hidden');
        }
    });

    // Station selection
    stationBtns.forEach(btn => {
        btn.addEventListener('click', async () => {
            const stationId = btn.dataset.station;
            const station = stations[stationId];

            if (!station) return;

            // Update UI
            stationBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            currentStation = stationId;
            playPauseBtn.disabled = false;

            // Set status
            musicStatus.textContent = `Loading ${station.name}...`;
            musicStatus.className = 'music-status loading';

            // Try to load the stream
            try {
                musicAudio.src = station.url;
                musicAudio.volume = volumeSlider.value / 100;

                await musicAudio.play();
                isPlaying = true;
                updatePlayPauseIcon();
                musicStatus.textContent = `Playing: ${station.name}`;
                musicStatus.className = 'music-status playing';
                musicToggle.classList.add('playing');

            } catch (err) {
                console.log('Primary stream failed, trying fallback...', err);

                // Try fallback
                try {
                    musicAudio.src = station.fallback;
                    await musicAudio.play();
                    isPlaying = true;
                    updatePlayPauseIcon();
                    musicStatus.textContent = `Playing: ${station.name}`;
                    musicStatus.className = 'music-status playing';
                    musicToggle.classList.add('playing');

                } catch (fallbackErr) {
                    console.error('Fallback also failed:', fallbackErr);
                    musicStatus.textContent = 'Stream unavailable. Try again later.';
                    musicStatus.className = 'music-status error';
                    isPlaying = false;
                    updatePlayPauseIcon();
                }
            }
        });
    });

    // Play/Pause
    playPauseBtn.addEventListener('click', () => {
        if (!currentStation) return;

        if (isPlaying) {
            musicAudio.pause();
            isPlaying = false;
            musicStatus.textContent = 'Paused';
            musicStatus.className = 'music-status';
            musicToggle.classList.remove('playing');
        } else {
            musicAudio.play().then(() => {
                isPlaying = true;
                musicStatus.textContent = `Playing: ${stations[currentStation].name}`;
                musicStatus.className = 'music-status playing';
                musicToggle.classList.add('playing');
            }).catch(err => {
                console.error('Play failed:', err);
                musicStatus.textContent = 'Playback failed';
                musicStatus.className = 'music-status error';
            });
        }
        updatePlayPauseIcon();
    });

    function updatePlayPauseIcon() {
        const icon = playPauseBtn.querySelector('.material-symbols-rounded');
        if (icon) {
            icon.textContent = isPlaying ? 'pause' : 'play_arrow';
        }
        musicIcon.textContent = isPlaying ? 'music_note' : 'music_off';
    }

    // Volume control
    volumeSlider.addEventListener('input', () => {
        musicAudio.volume = volumeSlider.value / 100;
    });

    // Handle audio errors
    musicAudio.addEventListener('error', () => {
        musicStatus.textContent = 'Stream error. Try another station.';
        musicStatus.className = 'music-status error';
        isPlaying = false;
        updatePlayPauseIcon();
        musicToggle.classList.remove('playing');
    });

    // Handle stream end/stall
    musicAudio.addEventListener('stalled', () => {
        musicStatus.textContent = 'Buffering...';
        musicStatus.className = 'music-status loading';
    });

    musicAudio.addEventListener('playing', () => {
        if (currentStation) {
            musicStatus.textContent = `Playing: ${stations[currentStation].name}`;
            musicStatus.className = 'music-status playing';
        }
    });

    console.log('Music player initialized.');
}

/* ========================================
   KANSKI CLINICAL PHOTOS — IndexedDB STORAGE
   Stores large image data in IndexedDB
   (localStorage has a 5-10MB limit)
   ======================================== */

const KANSKI_DB_NAME = 'KanskiImagesDB';
const KANSKI_DB_VERSION = 1;
const KANSKI_STORE_NAME = 'images';

function openKanskiDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(KANSKI_DB_NAME, KANSKI_DB_VERSION);
        request.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains(KANSKI_STORE_NAME)) {
                db.createObjectStore(KANSKI_STORE_NAME, { keyPath: 'id' });
            }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

async function saveKanskiToIDB(infographicTitle, images) {
    try {
        const db = await openKanskiDB();
        const tx = db.transaction(KANSKI_STORE_NAME, 'readwrite');
        const store = tx.objectStore(KANSKI_STORE_NAME);
        // Key = title hash to avoid special chars issues
        const id = 'kanski_' + btoa(unescape(encodeURIComponent(infographicTitle))).replace(/[^a-zA-Z0-9]/g, '_');
        store.put({
            id,
            title: infographicTitle,
            images: images, // [{pageNum, imgUrl, keywords}]
            savedAt: Date.now()
        });
        await new Promise((resolve, reject) => {
            tx.oncomplete = resolve;
            tx.onerror = () => reject(tx.error);
        });
        db.close();
        console.log(`[Kanski IDB] Saved ${images.length} images for "${infographicTitle}"`);
        return true;
    } catch (err) {
        console.error('[Kanski IDB] Save error:', err);
        return false;
    }
}

async function loadKanskiFromIDB(infographicTitle) {
    try {
        const db = await openKanskiDB();
        const tx = db.transaction(KANSKI_STORE_NAME, 'readonly');
        const store = tx.objectStore(KANSKI_STORE_NAME);
        const id = 'kanski_' + btoa(unescape(encodeURIComponent(infographicTitle))).replace(/[^a-zA-Z0-9]/g, '_');
        const result = await new Promise((resolve, reject) => {
            const req = store.get(id);
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
        db.close();
        if (result && result.images && result.images.length > 0) {
            console.log(`[Kanski IDB] Loaded ${result.images.length} images for "${infographicTitle}"`);
            return result.images;
        }
        return null;
    } catch (err) {
        console.error('[Kanski IDB] Load error:', err);
        return null;
    }
}

async function deleteKanskiFromIDB(infographicTitle) {
    try {
        const db = await openKanskiDB();
        const tx = db.transaction(KANSKI_STORE_NAME, 'readwrite');
        const store = tx.objectStore(KANSKI_STORE_NAME);
        const id = 'kanski_' + btoa(unescape(encodeURIComponent(infographicTitle))).replace(/[^a-zA-Z0-9]/g, '_');
        store.delete(id);
        await new Promise((resolve, reject) => {
            tx.oncomplete = resolve;
            tx.onerror = () => reject(tx.error);
        });
        db.close();
        console.log(`[Kanski IDB] Deleted images for "${infographicTitle}"`);
        return true;
    } catch (err) {
        console.error('[Kanski IDB] Delete error:', err);
        return false;
    }
}

// Expose Kanski IDB functions globally so community-submissions.js can access them
// (script.js is loaded as type="module", scoping its functions)
window.saveKanskiToIDB = saveKanskiToIDB;
window.loadKanskiFromIDB = loadKanskiFromIDB;

/* ========================================
   KANSKI CLINICAL PHOTOS — ADHERED IMAGE LOADER
   Restores permanently saved Kanski images
   when an infographic is loaded
   ======================================== */

function loadAdheredKanskiImages(data) {
    if (!data || !data.title) return;

    // Check localStorage for the lightweight meta flag
    let hasAdhered = false;
    try {
        const library = JSON.parse(localStorage.getItem(LIBRARY_KEY) || '[]');
        const item = library.find(i => i.title === data.title);
        hasAdhered = item && item.kanskiMeta && item.kanskiMeta.length > 0;
    } catch { /* ignore */ }

    if (!hasAdhered) return;

    // Load actual images from IndexedDB (async)
    loadKanskiFromIDB(data.title).then(kanskiImages => {
        if (!kanskiImages || kanskiImages.length === 0) {
            console.warn('[Kanski] Meta flag exists but no images in IndexedDB for:', data.title);
            return;
        }

        const posterGrid = document.querySelector('.poster-grid');
        if (!posterGrid) return;

        // Remove any existing Kanski section
        const existing = posterGrid.querySelector('#kanski-images-section');
        if (existing) existing.remove();

        // Inject Kanski image toggle CSS once
        if (!document.getElementById('kanski-img-toggle-style')) {
            const s = document.createElement('style');
            s.id = 'kanski-img-toggle-style';
            s.textContent = `.kanski-img-toggle { max-height: 300px; object-fit: cover; cursor: pointer; transition: max-height 0.3s ease; width: 100%; display: block; }
            .kanski-img-toggle.kanski-img-expanded { max-height: none; object-fit: contain; }`;
            document.head.appendChild(s);
        }

        // Create the Kanski section
        const kanskiSection = document.createElement('div');
        kanskiSection.id = 'kanski-images-section';
        kanskiSection.className = 'poster-card card-key_point col-span-2 theme-blue';
        kanskiSection.style.cssText = 'animation-delay: 0ms;';
        kanskiSection.innerHTML = `
            <h3 class="card-title" style="color: #0e7490;">
                <div class="icon-box" style="background: linear-gradient(135deg, #0891b2, #0e7490);"><span class="material-symbols-rounded">photo_library</span></div>
                Kanski Clinical Photos
                <span style="font-size: 0.7rem; font-weight: 500; color: #059669; margin-left: 6px; padding: 2px 8px; background: #d1fae5; border-radius: 12px;">
                    <span class="material-symbols-rounded" style="font-size: 0.7rem; vertical-align: middle;">push_pin</span> Adhered
                </span>
                <span style="font-size: 0.75rem; font-weight: 400; color: #64748b; margin-left: auto;">
                    ${kanskiImages.length} image(s)
                </span>
            </h3>
            <div style="display: flex; gap: 0.5rem; margin: 0.5rem 0; flex-wrap: wrap;">
                <button id="kanski-adhered-remove-btn" class="btn-small" title="Remove Kanski images from this infographic"
                    style="display: flex; align-items: center; gap: 4px; padding: 6px 14px; border-radius: 6px; font-weight: 600; font-size: 0.8rem;
                    background: linear-gradient(135deg, #ef4444, #dc2626); color: white; border: none; cursor: pointer; transition: all 0.2s;">
                    <span class="material-symbols-rounded" style="font-size: 1rem;">delete</span>
                    Remove
                </button>
            </div>
            <div class="kanski-images-display" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 0.75rem; margin-top: 0.5rem;">
                ${kanskiImages.map(img => `
                    <div style="border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; background: white;">
                        <img src="${img.imgUrl}" class="kanski-img-toggle"
                            alt="Kanski p.${img.pageNum}" 
                            title="Click to expand/collapse">
                        <div style="padding: 4px 8px; font-size: 0.7rem; color: #64748b; background: #f8fafc; border-top: 1px solid #e2e8f0;">
                            <strong>p.${img.pageNum}</strong>${img.keywords && img.keywords.length > 0 ? ' · ' + img.keywords.slice(0, 3).join(', ') : ''}
                        </div>
                    </div>
                `).join('')}
            </div>
        `;

        posterGrid.appendChild(kanskiSection);

        // Delegated click handler for image expand/collapse (iOS-safe)
        kanskiSection.addEventListener('click', (e) => {
            const img = e.target.closest('.kanski-img-toggle');
            if (img) img.classList.toggle('kanski-img-expanded');
        });

        // Remove button handler
        const removeBtn = kanskiSection.querySelector('#kanski-adhered-remove-btn');
        if (removeBtn) {
            removeBtn.addEventListener('click', () => {
                const removePermanently = confirm(
                    'Kanski images are permanently adhered to this infographic.\n\n' +
                    'Click OK to remove them permanently (from library too).\n' +
                    'Click Cancel to only hide them for this session.'
                );

                if (removePermanently) {
                    // Remove lightweight meta from localStorage
                    try {
                        const library = JSON.parse(localStorage.getItem(LIBRARY_KEY) || '[]');
                        const item = library.find(i => i.title === data.title);
                        if (item) {
                            delete item.kanskiMeta;
                            delete item.kanskiImages; // Clean up any legacy data
                            if (item.data) {
                                delete item.data.kanskiMeta;
                                delete item.data.kanskiImages;
                            }
                            localStorage.setItem(LIBRARY_KEY, JSON.stringify(library));
                        }
                    } catch (err) {
                        console.error('Error removing Kanski meta:', err);
                    }
                    // Remove images from IndexedDB
                    deleteKanskiFromIDB(data.title);
                }

                kanskiSection.remove();
            });
        }

        console.log(`[Kanski] Displayed ${kanskiImages.length} adhered image(s) for "${data.title}"`);
    });
}

/* ========================================
   KANSKI CLINICAL PHOTOS
   Import images from Kanski PDF and match
   them to the current infographic topic
   ======================================== */

function setupKanskiPics() {
    const kanskiBtn = document.getElementById('kanski-pics-btn');
    const kanskiInput = document.getElementById('kanski-pdf-input');
    if (!kanskiBtn || !kanskiInput) return;

    // Session cache: PDF doc and page texts
    let kanskiPdfDoc = null;
    let kanskiPageTexts = []; // [{pageNum, text}]
    let kanskiFileName = '';
    let kanskiAutoMode = false; // Whether auto mode is enabled

    // ═══════════════════════════════════════════════════════════════
    // IndexedDB cache — stores page text index AND PDF binary
    // so the user only needs to select the file ONCE ever.
    // ═══════════════════════════════════════════════════════════════
    const KANSKI_INDEX_DB = 'KanskiIndexDB';
    const KANSKI_INDEX_VERSION = 2; // Bumped to add pdfData store

    function openKanskiIndexDB() {
        return new Promise((resolve, reject) => {
            const req = indexedDB.open(KANSKI_INDEX_DB, KANSKI_INDEX_VERSION);
            req.onupgradeneeded = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains('pageTexts')) {
                    db.createObjectStore('pageTexts', { keyPath: 'id' });
                }
                if (!db.objectStoreNames.contains('pdfData')) {
                    db.createObjectStore('pdfData', { keyPath: 'id' });
                }
            };
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
    }

    async function saveCachedIndex(pageTexts) {
        try {
            const db = await openKanskiIndexDB();
            const tx = db.transaction('pageTexts', 'readwrite');
            tx.objectStore('pageTexts').put({ id: 'kanski_index', pages: pageTexts, savedAt: Date.now() });
            await new Promise(r => { tx.oncomplete = r; });
            db.close();
            console.log('[Kanski] Page index cached in IndexedDB');
        } catch (err) { console.warn('[Kanski] Failed to cache index:', err); }
    }

    async function loadCachedIndex() {
        try {
            const db = await openKanskiIndexDB();
            const tx = db.transaction('pageTexts', 'readonly');
            const result = await new Promise((resolve, reject) => {
                const req = tx.objectStore('pageTexts').get('kanski_index');
                req.onsuccess = () => resolve(req.result);
                req.onerror = () => reject(req.error);
            });
            db.close();
            if (result && result.pages && result.pages.length > 0) {
                return result.pages;
            }
        } catch (err) { console.warn('[Kanski] No cached index:', err); }
        return null;
    }

    async function saveCachedPdf(arrayBuffer) {
        try {
            const db = await openKanskiIndexDB();
            const tx = db.transaction('pdfData', 'readwrite');
            tx.objectStore('pdfData').put({ id: 'kanski_pdf', data: arrayBuffer, savedAt: Date.now() });
            await new Promise(r => { tx.oncomplete = r; });
            db.close();
            console.log('[Kanski] PDF binary cached in IndexedDB');
        } catch (err) { console.warn('[Kanski] Failed to cache PDF:', err); }
    }

    async function loadCachedPdf() {
        try {
            const db = await openKanskiIndexDB();
            const tx = db.transaction('pdfData', 'readonly');
            const result = await new Promise((resolve, reject) => {
                const req = tx.objectStore('pdfData').get('kanski_pdf');
                req.onsuccess = () => resolve(req.result);
                req.onerror = () => reject(req.error);
            });
            db.close();
            if (result && result.data) {
                console.log('[Kanski] Loaded cached PDF binary from IndexedDB');
                return result.data;
            }
        } catch (err) { console.warn('[Kanski] No cached PDF:', err); }
        return null;
    }

    // Helper: Load PDF doc from ArrayBuffer
    async function loadPdfFromBuffer(arrayBuffer) {
        if (typeof pdfjsLib === 'undefined') {
            throw new Error('PDF.js library not loaded. Please refresh the page.');
        }
        return await pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) }).promise;
    }

    // Helper: Index all pages of a loaded PDF doc
    async function indexPdfPages(pdfDoc) {
        const texts = [];
        const totalPages = pdfDoc.numPages;
        for (let i = 1; i <= totalPages; i++) {
            try {
                const page = await pdfDoc.getPage(i);
                const textContent = await page.getTextContent();
                const text = textContent.items.map(item => item.str).join(' ');
                texts.push({ pageNum: i, text: text.toLowerCase() });
            } catch {
                texts.push({ pageNum: i, text: '' });
            }
            if (i % 50 === 0) {
                const label = kanskiBtn.querySelector('.tool-label');
                if (label) label.textContent = `Indexing ${i}/${totalPages}...`;
            }
        }
        return texts;
    }

    // Main: Ensure PDF doc and page texts are ready
    async function ensureKanskiReady() {
        // 1. Already loaded this session
        if (kanskiPdfDoc && kanskiPageTexts.length > 0) return true;

        kanskiBtn.disabled = true;
        const originalHTML = kanskiBtn.innerHTML;
        kanskiBtn.innerHTML = '<span class="material-symbols-rounded">hourglass_top</span><span class="tool-label">Loading...</span>';

        try {
            // 2. Try cached PDF from IndexedDB
            if (!kanskiPdfDoc) {
                const cachedPdf = await loadCachedPdf();
                if (cachedPdf) {
                    kanskiBtn.querySelector('.tool-label').textContent = 'Opening cached PDF...';
                    kanskiPdfDoc = await loadPdfFromBuffer(cachedPdf);
                    kanskiFileName = 'Kanski (cached)';
                }
            }

            // 3. Try cached page text index
            if (kanskiPageTexts.length === 0) {
                const cachedIndex = await loadCachedIndex();
                if (cachedIndex && cachedIndex.length > 0) {
                    kanskiPageTexts = cachedIndex;
                    console.log(`[Kanski] Using cached page index (${cachedIndex.length} pages)`);
                }
            }

            // 4. If we have PDF doc but no index, build the index
            if (kanskiPdfDoc && kanskiPageTexts.length === 0) {
                kanskiBtn.querySelector('.tool-label').textContent = 'Indexing pages...';
                kanskiPageTexts = await indexPdfPages(kanskiPdfDoc);
                await saveCachedIndex(kanskiPageTexts);
            }

            // 5. If still no PDF doc, need user to pick the file
            if (!kanskiPdfDoc) {
                kanskiBtn.disabled = false;
                kanskiBtn.innerHTML = originalHTML;
                return false; // Signal that we need file input
            }

            kanskiBtn.disabled = false;
            kanskiBtn.innerHTML = originalHTML;
            return true;

        } catch (err) {
            console.error('[Kanski] Setup error:', err);
            alert('Error loading Kanski PDF: ' + err.message);
            kanskiBtn.disabled = false;
            kanskiBtn.innerHTML = originalHTML;
            return false;
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // Button click — Auto vs Manual, with seamless caching
    // ═══════════════════════════════════════════════════════════════
    // Helper: prompt for Auto/Manual mode and run
    async function promptAndRunKanskiMode() {
        const useAuto = confirm(
            'Kanski Clinical Photos\n\n' +
            'Choose a mode:\n\n' +
            '  OK  =  AUTO MODE\n' +
            '  Auto-select & insert best matching images\n\n' +
            '  Cancel  =  MANUAL MODE\n' +
            '  Preview all matches, pick which to insert'
        );
        kanskiAutoMode = useAuto;
        if (useAuto) {
            await autoMatchAndInsert();
        } else {
            await matchAndDisplayKanskiPages();
        }
    }

    kanskiBtn.addEventListener('click', async () => {
        if (!currentInfographicData) {
            alert('Please generate or load an infographic first, then use Kanski Pics to find matching clinical photos.');
            return;
        }

        // ── FAST PATH: PDF already loaded this session ──
        if (kanskiPdfDoc && kanskiPageTexts.length > 0) {
            await promptAndRunKanskiMode();
            return;
        }

        // ── Detect mobile devices ──
        // On iOS/Android, ANY await before input.click() kills the user gesture,
        // so we must trigger the file picker FIRST, then check cache in background.
        const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
            || ('ontouchstart' in window && window.innerWidth < 1024);

        if (isMobile) {
            // MOBILE PATH: trigger file picker synchronously FIRST
            const toast = document.createElement('div');
            toast.textContent = 'Select the Kanski PDF file — you only need to do this once.';
            toast.style.cssText = 'position:fixed;top:20px;left:50%;transform:translateX(-50%);background:#1e293b;color:#f1f5f9;padding:14px 28px;border-radius:12px;z-index:100000;font-size:0.95rem;box-shadow:0 8px 32px rgba(0,0,0,0.3);max-width:90vw;text-align:center;';
            document.body.appendChild(toast);
            setTimeout(() => { toast.style.opacity = '0'; toast.style.transition = 'opacity 0.5s'; setTimeout(() => toast.remove(), 500); }, 4000);

            // Click file input immediately — user gesture is still alive
            kanskiInput.click();

            // On MOBILE: only try loading the lightweight TEXT INDEX from cache
            // (NOT the PDF binary, which is too large for iOS memory)
            loadCachedIndex().then(async (cachedIndex) => {
                if (cachedIndex && cachedIndex.length > 0) {
                    kanskiPageTexts = cachedIndex;
                    console.log(`[Kanski Mobile] Using cached text index (${cachedIndex.length} pages)`);
                    toast.textContent = `✅ Text index loaded (${cachedIndex.length} pages). Select the PDF to render images.`;
                }
            }).catch(err => console.warn('[Kanski Mobile] No cached index:', err));
            return;
        }

        // ── DESKTOP PATH: try cache first, fall back to file picker ──
        const cachedReady = await ensureKanskiReady();
        if (cachedReady) {
            await promptAndRunKanskiMode();
            return;
        }

        // No cache — trigger file picker (gesture should still be alive on desktop)
        const toast = document.createElement('div');
        toast.textContent = 'Please select the Kanski PDF file — you only need to do this once.';
        toast.style.cssText = 'position:fixed;top:20px;left:50%;transform:translateX(-50%);background:#1e293b;color:#f1f5f9;padding:14px 28px;border-radius:12px;z-index:100000;font-size:0.95rem;box-shadow:0 8px 32px rgba(0,0,0,0.3);max-width:90vw;text-align:center;';
        document.body.appendChild(toast);
        setTimeout(() => { toast.style.opacity = '0'; toast.style.transition = 'opacity 0.5s'; setTimeout(() => toast.remove(), 500); }, 4000);

        kanskiInput.click();
    });

    kanskiInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) {
            kanskiAutoMode = false;
            return;
        }

        if (!file.name.toLowerCase().endsWith('.pdf')) {
            alert('Please select a PDF file.');
            kanskiAutoMode = false;
            return;
        }

        kanskiFileName = file.name;

        kanskiBtn.disabled = true;
        const originalHTML = kanskiBtn.innerHTML;
        kanskiBtn.innerHTML = '<span class="material-symbols-rounded">hourglass_top</span><span class="tool-label">Loading PDF...</span>';

        try {
            const arrayBuffer = await file.arrayBuffer();

            // Detect mobile to skip heavy operations
            const isMobileDevice = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
                || ('ontouchstart' in window && window.innerWidth < 1024);

            // Cache the PDF binary for future sessions (skip on mobile to avoid memory crash)
            if (!isMobileDevice) {
                kanskiBtn.querySelector('.tool-label').textContent = 'Caching PDF...';
                await saveCachedPdf(arrayBuffer);
            }

            // Load the PDF document
            kanskiPdfDoc = await loadPdfFromBuffer(arrayBuffer);

            // Index pages if not already cached
            if (kanskiPageTexts.length === 0) {
                kanskiBtn.querySelector('.tool-label').textContent = 'Indexing pages...';
                kanskiPageTexts = await indexPdfPages(kanskiPdfDoc);
                await saveCachedIndex(kanskiPageTexts);
            }

            console.log(`[Kanski] Ready: ${kanskiPageTexts.length} pages from "${kanskiFileName}"`);

            // Ask Auto/Manual mode now that PDF is ready
            await promptAndRunKanskiMode();

        } catch (err) {
            console.error('Kanski PDF error:', err);
            alert('Error loading PDF: ' + err.message);
        } finally {
            kanskiBtn.disabled = false;
            kanskiBtn.innerHTML = originalHTML;
            kanskiInput.value = '';
            kanskiAutoMode = false;
        }
    });

    // ═══════════════════════════════════════════════════════════════
    // AUTO MODE — match, render, and insert automatically (no modal)
    // ═══════════════════════════════════════════════════════════════
    async function autoMatchAndInsert() {
        if (!kanskiPdfDoc || !currentInfographicData) return;

        kanskiBtn.disabled = true;
        const originalHTML = kanskiBtn.innerHTML;
        kanskiBtn.innerHTML = '<span class="material-symbols-rounded">auto_awesome</span><span class="tool-label">Auto matching...</span>';

        try {
            const { keywords: weightedKeywords, primaryTopicTerms } = extractInfographicKeywordsWeighted(currentInfographicData);
            console.log(`[Kanski Auto] Primary topic terms:`, primaryTopicTerms);
            console.log(`[Kanski Auto] Keywords:`, weightedKeywords.filter(k => k.weight >= 20).map(k => k.term));

            // Score pages — require primary topic presence
            const scoredPages = [];
            kanskiPageTexts.forEach(({ pageNum, text }) => {
                if (!text || text.length < 50) return;
                const textLower = text.toLowerCase();

                // Topic-scope gate: page must mention at least one primary topic term
                let hasPrimaryTopic = false;
                for (const pt of primaryTopicTerms) {
                    if (textLower.includes(pt.toLowerCase())) {
                        hasPrimaryTopic = true;
                        break;
                    }
                }
                if (primaryTopicTerms.length > 0 && !hasPrimaryTopic) return; // Skip off-topic pages

                let score = 0;
                let primaryHits = 0;
                const matchedKeywords = [];
                weightedKeywords.forEach(({ term, weight }) => {
                    const kwLower = term.toLowerCase();
                    const escaped = kwLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                    const regex = kwLower.length < 5
                        ? new RegExp(`\\b${escaped}\\b`, 'gi')
                        : new RegExp(`\\b${escaped}`, 'gi');
                    const matches = text.match(regex);
                    if (matches) {
                        score += matches.length * weight;
                        if (weight >= 20) primaryHits += matches.length;
                        if (!matchedKeywords.includes(term)) matchedKeywords.push(term);
                    }
                });
                if (score > 0) scoredPages.push({ pageNum, score, primaryHits, matchedKeywords });
            });

            scoredPages.sort((a, b) => {
                if (b.primaryHits !== a.primaryHits) return b.primaryHits - a.primaryHits;
                return b.score - a.score;
            });

            // Auto-select: take top 10 pages (focused selection for auto mode)
            const topPages = scoredPages.slice(0, 10);

            if (topPages.length === 0) {
                alert(`[Auto Mode] No matching pages found for "${currentInfographicData.title}".`);
                return;
            }

            kanskiBtn.innerHTML = '<span class="material-symbols-rounded">auto_awesome</span><span class="tool-label">Rendering images...</span>';

            // Render images for top pages
            const images = [];
            for (let idx = 0; idx < topPages.length; idx++) {
                const p = topPages[idx];
                kanskiBtn.querySelector('.tool-label').textContent = `Rendering ${idx + 1}/${topPages.length}...`;
                try {
                    const page = await kanskiPdfDoc.getPage(p.pageNum);
                    // Lower scale on mobile to prevent memory crash
                    const isMobileRender = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
                        || ('ontouchstart' in window && window.innerWidth < 1024);
                    const renderScale = isMobileRender ? 1.0 : 1.5;
                    const viewport = page.getViewport({ scale: renderScale });
                    const canvas = document.createElement('canvas');
                    canvas.width = viewport.width;
                    canvas.height = viewport.height;
                    const ctx = canvas.getContext('2d');
                    await page.render({ canvasContext: ctx, viewport }).promise;
                    images.push({
                        pageNum: p.pageNum,
                        imgUrl: canvas.toDataURL('image/jpeg', 0.85),
                        keywords: p.matchedKeywords || []
                    });
                } catch (err) {
                    console.warn(`[Kanski Auto] Failed to render page ${p.pageNum}:`, err);
                }
            }

            if (images.length > 0) {
                insertKanskiImages(images);
            } else {
                alert('[Auto Mode] Failed to render any matching pages.');
            }

        } catch (err) {
            console.error('[Kanski Auto] Error:', err);
            alert('Auto mode error: ' + err.message);
        } finally {
            kanskiBtn.disabled = false;
            kanskiBtn.innerHTML = originalHTML;
        }
    }

    async function matchAndDisplayKanskiPages() {
        if (!kanskiPdfDoc || !currentInfographicData) return;

        kanskiBtn.disabled = true;
        const originalHTML = kanskiBtn.innerHTML;
        kanskiBtn.innerHTML = '<span class="material-symbols-rounded">image_search</span><span class="tool-label">Matching...</span>';

        try {
            // Extract weighted keywords from the current infographic
            const { keywords: weightedKeywords, primaryTopicTerms } = extractInfographicKeywordsWeighted(currentInfographicData);
            console.log(`[Kanski] Primary topic terms:`, primaryTopicTerms);
            console.log(`[Kanski] Total keywords:`, weightedKeywords.length);

            // Score each page by weighted keyword matches
            // Topic-scope gate: pages must mention at least one primary topic term
            const scoredPages = [];
            kanskiPageTexts.forEach(({ pageNum, text }) => {
                if (!text || text.length < 50) return; // Skip nearly empty pages
                const textLower = text.toLowerCase();

                // Topic-scope gate: page must mention the primary topic
                let hasPrimaryTopic = false;
                for (const pt of primaryTopicTerms) {
                    if (textLower.includes(pt.toLowerCase())) {
                        hasPrimaryTopic = true;
                        break;
                    }
                }
                if (primaryTopicTerms.length > 0 && !hasPrimaryTopic) return; // Skip off-topic pages

                let score = 0;
                let primaryHits = 0; // Hits from headline/topic keywords
                const matchedKeywords = [];

                weightedKeywords.forEach(({ term, weight }) => {
                    const kwLower = term.toLowerCase();
                    const escaped = kwLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                    // Use word boundary for short terms, looser match for longer phrases
                    const regex = kwLower.length < 5
                        ? new RegExp(`\\b${escaped}\\b`, 'gi')
                        : new RegExp(`\\b${escaped}`, 'gi');
                    const matches = text.match(regex);
                    if (matches) {
                        const hitScore = matches.length * weight;
                        score += hitScore;
                        if (weight >= 20) primaryHits += matches.length;
                        if (!matchedKeywords.includes(term)) matchedKeywords.push(term);
                    }
                });

                if (score > 0) {
                    scoredPages.push({ pageNum, score, primaryHits, matchedKeywords });
                }
            });

            // Sort: pages with primary topic hits first, then by total score
            scoredPages.sort((a, b) => {
                // Primary topic hits are most important
                if (b.primaryHits !== a.primaryHits) return b.primaryHits - a.primaryHits;
                return b.score - a.score;
            });

            const topPages = scoredPages.slice(0, 12); // Max 12 images

            if (topPages.length === 0) {
                alert(`No matching pages found in "${kanskiFileName}" for "${currentInfographicData.title}".\n\nTry loading an infographic with more specific ophthalmic content.`);
                return;
            }

            console.log(`[Kanski] Found ${scoredPages.length} matching pages, showing top ${topPages.length}`);

            // Render page images and display in a modal
            await showKanskiModal(topPages);

        } catch (err) {
            console.error('Kanski matching error:', err);
            alert('Error matching pages: ' + err.message);
        } finally {
            kanskiBtn.disabled = false;
            kanskiBtn.innerHTML = originalHTML;
        }
    }

    /**
     * Extract keywords from infographic data with WEIGHTS.
     * Ophthalmic headline topic terms get highest weight (50x),
     * title medical terms get high weight (20x),
     * section titles get medium weight (5x),
     * generic content words get low weight (1x).
     */
    function extractInfographicKeywordsWeighted(data) {
        const weighted = []; // [{term, weight}]
        const seen = new Set();
        const primaryTopicTerms = []; // The exact topic name terms for scoping

        const stopWords = new Set([
            'the', 'and', 'for', 'with', 'from', 'that', 'this', 'are', 'was', 'were',
            'been', 'has', 'have', 'had', 'not', 'but', 'its', 'can', 'may', 'will',
            'into', 'all', 'also', 'than', 'more', 'most', 'some', 'such', 'both',
            'each', 'other', 'one', 'two', 'which', 'their', 'about', 'between',
            'through', 'during', 'before', 'after', 'above', 'below', 'when', 'where',
            'what', 'how', 'who', 'whom', 'does', 'did', 'would', 'could', 'should',
            'being', 'just', 'then', 'still', 'here', 'there', 'very', 'much', 'over',
            'under', 'only', 'same', 'your', 'they', 'them', 'these', 'those', 'many',
            'types', 'type', 'causes', 'cause', 'treatment', 'treatments', 'management',
            'diagnosis', 'clinical', 'features', 'overview', 'introduction', 'summary',
            'presentation', 'approach', 'review', 'case', 'study', 'comprehensive',
            'guide', 'complete', 'essential', 'common', 'important', 'key', 'points',
            'infographic', 'infograph', 'ophthalmic'
        ]);

        // ═══════════════════════════════════════════════════════
        // OPHTHALMIC TOPIC DICTIONARY — headline diagnostic terms
        // Organized by DISEASE CATEGORY so we can scope
        // keywords to the relevant category only.
        // ═══════════════════════════════════════════════════════
        const OPHTHALMIC_TOPIC_CATEGORIES = {
            'retina_vitreous': [
                'retinoblastoma', 'retinal detachment', 'retinitis pigmentosa', 'retinopathy',
                'diabetic retinopathy', 'retinopathy of prematurity', 'rop', 'macular degeneration',
                'macular hole', 'epiretinal membrane', 'central serous', 'csr', 'cscr',
                'vein occlusion', 'artery occlusion', 'rvo', 'crvo', 'brvo', 'crao', 'brao',
                'proliferative vitreoretinopathy', 'pvr', 'vitreous hemorrhage', 'vitrectomy',
                'scleral buckle', 'pneumatic retinopexy', 'anti-vegf', 'intravitreal',
                'choroidal neovascularization', 'cnv', 'polypoidal', 'pcv',
                'coats disease', 'eales disease', 'familial exudative vitreoretinopathy', 'fevr',
                'stargardt', 'best disease', 'pattern dystrophy', 'choroideremia'
            ],
            'glaucoma': [
                'glaucoma', 'neovascular glaucoma', 'nvg', 'poag', 'pacg', 'angle closure',
                'normal tension glaucoma', 'ntg', 'trabeculectomy', 'tube shunt', 'ahmed valve',
                'migs', 'istent', 'xen gel', 'cyclophotocoagulation', 'goniotomy',
                'pseudoexfoliation', 'pxf', 'pigment dispersion', 'ocular hypertension',
                'congenital glaucoma', 'buphthalmos', 'iridocorneal endothelial', 'ice syndrome',
                'primary open angle', 'primary angle closure', 'secondary glaucoma',
                'steroid glaucoma', 'phacomorphic glaucoma', 'phacolytic glaucoma',
                'uveitic glaucoma', 'traumatic glaucoma', 'juvenile glaucoma'
            ],
            'cornea': [
                'keratitis', 'keratoconus', 'corneal ulcer', 'corneal dystrophy', 'fuchs',
                'acanthamoeba', 'herpes simplex keratitis', 'herpetic', 'dendrit',
                'pterygium', 'pinguecula', 'band keratopathy', 'pellucid',
                'corneal transplant', 'keratoplasty', 'dsaek', 'dmek', 'dalk',
                'cross-linking', 'cxl', 'corneal graft', 'graft rejection',
                'dry eye', 'meibomian', 'blepharitis', 'sjogren',
                'mooren ulcer', 'terrien', 'salzmann', 'corneal ectasia'
            ],
            'uvea': [
                'uveitis', 'iritis', 'iridocyclitis', 'panuveitis', 'intermediate uveitis',
                'anterior uveitis', 'posterior uveitis', 'vkh', 'vogt-koyanagi-harada',
                'behcet', 'sarcoidosis', 'sympathetic ophthalmia', 'birdshot',
                'toxoplasmosis', 'toxocara', 'cmv retinitis', 'endophthalmitis',
                'multifocal choroiditis', 'serpiginous', 'white dot syndrome',
                'acute retinal necrosis', 'arn', 'presumed ocular histoplasmosis', 'pohs',
                'fuchs heterochromic', 'posner-schlossman', 'hla-b27'
            ],
            'lens_cataract': [
                'cataract', 'phacoemulsification', 'phaco', 'intraocular lens', 'iol',
                'posterior capsule opacification', 'pco', 'yag capsulotomy',
                'ectopia lentis', 'subluxation', 'lens dislocation', 'marfan'
            ],
            'lids': [
                'ptosis', 'entropion', 'ectropion', 'trichiasis', 'blepharospasm',
                'chalazion', 'meibomian cyst', 'hordeolum', 'stye',
                'basal cell carcinoma', 'bcc', 'squamous cell carcinoma', 'scc',
                'sebaceous gland carcinoma', 'merkel cell', 'lid retraction',
                'dermatochalasis', 'blepharoplasty', 'lagophthalmos', 'floppy eyelid'
            ],
            'orbit': [
                'thyroid eye disease', 'ted', 'graves ophthalmopathy', 'proptosis', 'exophthalmos',
                'orbital cellulitis', 'preseptal cellulitis', 'orbital fracture', 'blow-out',
                'orbital tumor', 'orbital tumour', 'cavernous hemangioma', 'lymphoma',
                'optic nerve glioma', 'meningioma', 'rhabdomyosarcoma', 'lacrimal gland tumour',
                'dacryoadenitis', 'orbital pseudotumor', 'idiopathic orbital inflammation'
            ],
            'lacrimal': [
                'dacryocystitis', 'nasolacrimal duct', 'nld obstruction', 'dacryocystorhinostomy',
                'dcr', 'lacrimal obstruction', 'epiphora', 'punctal stenosis',
                'canaliculitis', 'lacrimal sac', 'congenital nld'
            ],
            'neuro_ophthalmology': [
                'optic neuritis', 'papilledema', 'papilloedema', 'optic neuropathy',
                'optic atrophy', 'ischaemic optic neuropathy', 'aion', 'naion',
                'nystagmus', 'cranial nerve palsy', 'third nerve palsy', 'sixth nerve palsy',
                'fourth nerve palsy', 'horner syndrome', 'myasthenia gravis',
                'internuclear ophthalmoplegia', 'ino', 'anisocoria', 'argyll robertson',
                'adie pupil', 'marcus gunn', 'relative afferent pupillary defect', 'rapd',
                'chiasmal', 'hemianopia', 'homonymous', 'bitemporal',
                'idiopathic intracranial hypertension', 'iih', 'pseudotumor cerebri',
                'leber hereditary', 'lhon', 'optic disc drusen'
            ],
            'strabismus': [
                'strabismus', 'esotropia', 'exotropia', 'hypertropia', 'amblyopia',
                'duane syndrome', 'brown syndrome', 'moebius', 'squint',
                'convergence insufficiency', 'divergence excess', 'accommodative esotropia',
                'infantile esotropia', 'sensory exotropia', 'consecutive exotropia'
            ],
            'paediatric': [
                'retinopathy of prematurity', 'congenital cataract', 'congenital glaucoma',
                'persistent fetal vasculature', 'pfv', 'leukocoria', 'aniridia',
                'microphthalmos', 'coloboma', 'peter anomaly', 'axenfeld-rieger'
            ],
            'tumours': [
                'retinoblastoma', 'uveal melanoma', 'choroidal melanoma', 'iris melanoma',
                'ciliary body melanoma', 'metastatic', 'choroidal metastasis',
                'choroidal hemangioma', 'choroidal osteoma', 'nevus', 'naevus',
                'melanocytoma', 'astrocytic hamartoma', 'lymphoma intraocular'
            ],
            'sclera': [
                'scleritis', 'episcleritis', 'necrotizing scleritis', 'scleromalacia',
                'posterior scleritis'
            ],
            'refractive': [
                'lasik', 'prk', 'smile', 'refractive surgery', 'myopia', 'hyperopia',
                'astigmatism', 'presbyopia', 'phakic iol', 'icl'
            ],
            'lasers': [
                'laser photocoagulation', 'panretinal', 'prp', 'yag laser', 'slt',
                'argon laser', 'diode laser', 'micropulse', 'pascal'
            ],
            'investigations': [
                'oct', 'fluorescein angiography', 'ffa', 'icg', 'indocyanine green',
                'ultrasound', 'b-scan', 'visual field', 'perimetry', 'humphrey',
                'goldmann', 'gonioscopy', 'pachymetry', 'topography', 'pentacam',
                'specular microscopy', 'electrophysiology', 'erg', 'vep',
                'optical coherence tomography angiography', 'octa'
            ]
        };

        // Build flat list for backward compat
        const OPHTHALMIC_TOPIC_TERMS = Object.values(OPHTHALMIC_TOPIC_CATEGORIES).flat();

        // ═══════════════════════════════════════════════════════
        // TOPIC SCOPING — identify the primary disease category
        // from the infographic title so we can penalize off-topic
        // keywords from other categories.
        // ═══════════════════════════════════════════════════════
        const titleLower = (data.title || '').toLowerCase();

        // Find the LONGEST matching ophthalmic term in the title
        // ("neovascular glaucoma" should match over just "glaucoma")
        let bestTitleMatch = '';
        let primaryCategory = null;
        for (const [category, terms] of Object.entries(OPHTHALMIC_TOPIC_CATEGORIES)) {
            for (const term of terms) {
                if (titleLower.includes(term.toLowerCase()) && term.length > bestTitleMatch.length) {
                    bestTitleMatch = term;
                    primaryCategory = category;
                }
            }
        }

        // Build the primary topic terms set — the specific disease name(s)
        // These are used as a GATE: Kanski pages must mention at least one
        if (bestTitleMatch) {
            primaryTopicTerms.push(bestTitleMatch);
            // Also add any abbreviation/alias that shares the same category
            // and appears in the title
            const categoryTerms = OPHTHALMIC_TOPIC_CATEGORIES[primaryCategory] || [];
            for (const t of categoryTerms) {
                if (t !== bestTitleMatch && titleLower.includes(t.toLowerCase()) && t.length >= 2) {
                    primaryTopicTerms.push(t);
                }
            }
        }

        console.log(`[Kanski Keywords] Primary topic: "${bestTitleMatch}" (category: ${primaryCategory})`);
        console.log(`[Kanski Keywords] Topic scope terms:`, primaryTopicTerms);

        function addTerm(term, weight) {
            const key = term.toLowerCase().trim();
            if (key.length < 2 || seen.has(key)) return;
            seen.add(key);
            weighted.push({ term: key, weight });
        }

        /**
         * Check if a term belongs to a DIFFERENT disease category than the primary topic.
         * Off-topic terms get heavily penalized — they are noise, not signal.
         */
        function isOffTopic(term) {
            if (!primaryCategory) return false; // No topic identified, don't penalize
            const termLower = term.toLowerCase();
            // Check if this term is in the primary category
            const primaryTerms = OPHTHALMIC_TOPIC_CATEGORIES[primaryCategory] || [];
            if (primaryTerms.some(t => t.toLowerCase() === termLower)) return false;
            // Check if it's in a different category
            for (const [cat, terms] of Object.entries(OPHTHALMIC_TOPIC_CATEGORIES)) {
                if (cat === primaryCategory) continue;
                if (terms.some(t => t.toLowerCase() === termLower)) return true;
            }
            return false;
        }

        // ── Pass 1: Extract primary topic from title ──
        // The infographic title is THE most important signal.
        // Match known ophthalmic terms in the title with weight 50
        OPHTHALMIC_TOPIC_TERMS.forEach(term => {
            if (titleLower.includes(term.toLowerCase())) {
                // Primary topic terms from title get full weight;
                // other-category terms found in title get reduced weight
                const off = isOffTopic(term);
                addTerm(term, off ? 5 : 50);
            }
        });

        // Also add the full title as a phrase (weight 30)
        if (data.title) addTerm(data.title, 30);

        // Add individual title words that are NOT stop words (weight 10 for medical-looking, 3 otherwise)
        if (data.title) {
            data.title.split(/[\s,\-:;()/]+/).forEach(w => {
                const clean = w.replace(/[^a-zA-Z0-9'-]/g, '').toLowerCase();
                if (clean.length <= 2 || stopWords.has(clean)) return;
                // Boost words that look medical (long, Latin/Greek-ish)
                const isMedical = clean.length >= 6 || /itis$|oma$|osis$|emia$|opia$|ectomy$|plasty$|scopy$|pathy$|graft|laser|phaco|uvea|retin|cornea|sclera|iris|pupil|nerve|orbit/.test(clean);
                addTerm(clean, isMedical ? 20 : 3);
            });
        }

        // ── Pass 2: Section titles (weight 5-15, penalized if off-topic) ──
        if (data.sections && Array.isArray(data.sections)) {
            data.sections.forEach(s => {
                if (!s || !s.title) return;
                const secTitleLower = s.title.toLowerCase();

                // Check for known ophthalmic terms in section titles
                OPHTHALMIC_TOPIC_TERMS.forEach(term => {
                    if (secTitleLower.includes(term.toLowerCase())) {
                        const off = isOffTopic(term);
                        addTerm(term, off ? 1 : 15); // Heavily penalize off-topic section terms
                    }
                });

                // Individual section title words (weight 5)
                s.title.split(/[\s,\-:;()/]+/).forEach(w => {
                    const clean = w.replace(/[^a-zA-Z0-9'-]/g, '').toLowerCase();
                    if (clean.length > 3 && !stopWords.has(clean)) addTerm(clean, 5);
                });
            });
        }

        // ── Pass 3: Section content — only add on-topic terms (weight 1-3) ──
        if (data.sections && Array.isArray(data.sections)) {
            data.sections.forEach(s => {
                if (!s || !s.content) return;
                let textBlob = '';
                try {
                    if (typeof s.content === 'string') textBlob = s.content;
                    else if (Array.isArray(s.content)) textBlob = s.content.map(c => typeof c === 'string' ? c : (c && c.label ? c.label : '')).join(' ');
                    else if (typeof s.content === 'object') {
                        textBlob = Object.values(s.content).map(v => typeof v === 'string' ? v : '').join(' ');
                    }
                } catch { /* ignore */ }

                if (textBlob.length > 10) {
                    const contentLower = textBlob.toLowerCase();
                    // Only add on-topic ophthalmic terms from content (skip off-topic entirely)
                    OPHTHALMIC_TOPIC_TERMS.forEach(term => {
                        if (contentLower.includes(term.toLowerCase())) {
                            if (!isOffTopic(term)) {
                                addTerm(term, 3);
                            }
                            // Off-topic content terms are completely skipped
                        }
                    });
                }
            });
        }

        // ── Pass 4: Chapter category context (weight 8) ──
        if (data.chapterId && data.chapterId !== 'uncategorized') {
            const chapter = DEFAULT_CHAPTERS.find(c => c.id === data.chapterId);
            if (chapter) {
                // Add the chapter name words
                chapter.name.split(/[\s&,]+/).forEach(w => {
                    const clean = w.toLowerCase().trim();
                    if (clean.length > 2 && !stopWords.has(clean)) addTerm(clean, 8);
                });
            }
        }

        // Sort: highest weight first
        weighted.sort((a, b) => b.weight - a.weight);

        return { keywords: weighted, primaryTopicTerms };
    }

    async function showKanskiModal(topPages) {
        // Create or reuse modal
        let kModal = document.getElementById('kanski-modal');
        if (!kModal) {
            kModal = document.createElement('div');
            kModal.id = 'kanski-modal';
            kModal.className = 'modal-overlay';
            kModal.innerHTML = `
                <div class="modal-content modal-lg" style="border: 2px solid #0891b2; max-width: 900px;">
                    <div class="modal-header" style="background: linear-gradient(135deg, #0891b2 0%, #0e7490 100%); color: white;">
                        <h2 style="display: flex; align-items: center; gap: 8px;">
                            <span class="material-symbols-rounded">photo_library</span>
                            Kanski Clinical Photos
                        </h2>
                        <div style="display: flex; gap: 8px; align-items: center;">
                            <button id="kanski-insert-btn" class="icon-btn-ghost" style="color: white; display: flex; align-items: center; gap: 4px; padding: 6px 12px; border: 1px solid rgba(255,255,255,0.4); border-radius: 6px; font-size: 0.8rem; font-weight: 600;" title="Insert selected images into infographic">
                                <span class="material-symbols-rounded" style="font-size: 1.1rem;">add_photo_alternate</span>
                                Insert into Infographic
                            </button>
                            <button id="close-kanski-modal" class="icon-btn-ghost" style="color: white;">
                                <span class="material-symbols-rounded">close</span>
                            </button>
                        </div>
                    </div>
                    <div class="modal-body" id="kanski-modal-body" style="max-height: 75vh; overflow-y: auto; padding: 1rem;">
                    </div>
                </div>
            `;
            document.body.appendChild(kModal);

            kModal.querySelector('#close-kanski-modal').addEventListener('click', () => {
                kModal.classList.remove('active');
            });
            kModal.addEventListener('click', (e) => {
                if (e.target === kModal) kModal.classList.remove('active');
            });
        }

        const body = kModal.querySelector('#kanski-modal-body');
        body.innerHTML = `
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 1rem; flex-wrap: wrap;">
                <p style="margin: 0; color: #0e7490; font-weight: 600;">
                    <span class="material-symbols-rounded" style="font-size: 1rem; vertical-align: middle;">menu_book</span>
                    ${topPages.length} relevant page(s) found for "${currentInfographicData.title}"
                </p>
                <span style="font-size: 0.8rem; color: #64748b;">Click images to select, then insert into infographic</span>
            </div>
            <div id="kanski-images-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 1rem;">
                ${topPages.map((p, idx) => `
                    <div class="kanski-page-card" data-page="${p.pageNum}" data-index="${idx}"
                        style="border: 2px solid #e2e8f0; border-radius: 8px; overflow: hidden; cursor: pointer; transition: all 0.2s; position: relative;">
                        <div class="kanski-img-container" style="background: #f1f5f9; display: flex; align-items: center; justify-content: center; min-height: 200px;">
                            <div class="kanski-loading" style="text-align: center; color: #94a3b8;">
                                <span class="material-symbols-rounded" style="font-size: 2rem; animation: spin 1s linear infinite;">progress_activity</span>
                                <p style="font-size: 0.8rem; margin: 4px 0 0;">Rendering p.${p.pageNum}...</p>
                            </div>
                        </div>
                        <div style="padding: 0.5rem 0.75rem; background: white; border-top: 1px solid #e2e8f0;">
                            <div style="font-size: 0.8rem; font-weight: 600; color: #0e7490;">Page ${p.pageNum}</div>
                            <div style="font-size: 0.7rem; color: #64748b; margin-top: 2px;">
                                Score: ${p.score} · Keywords: ${p.matchedKeywords.slice(0, 3).join(', ')}
                            </div>
                        </div>
                        <div class="kanski-selected-badge" style="display: none; position: absolute; top: 8px; right: 8px; background: #0891b2; color: white; width: 28px; height: 28px; border-radius: 50%; display: none; align-items: center; justify-content: center; font-size: 1.2rem; box-shadow: 0 2px 6px rgba(0,0,0,0.3);">
                            <span class="material-symbols-rounded" style="font-size: 1.2rem;">check</span>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;

        // Add spin animation if not exists
        if (!document.getElementById('kanski-spin-style')) {
            const style = document.createElement('style');
            style.id = 'kanski-spin-style';
            style.textContent = `@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`;
            document.head.appendChild(style);
        }

        kModal.classList.add('active');

        // Render page images asynchronously
        const selectedPages = new Set();

        for (const p of topPages) {
            try {
                const page = await kanskiPdfDoc.getPage(p.pageNum);
                // Lower scale on mobile to prevent memory crash
                const isMobileRender = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
                    || ('ontouchstart' in window && window.innerWidth < 1024);
                const renderScale = isMobileRender ? 1.0 : 1.5;
                const viewport = page.getViewport({ scale: renderScale });
                const canvas = document.createElement('canvas');
                canvas.width = viewport.width;
                canvas.height = viewport.height;
                const ctx = canvas.getContext('2d');
                await page.render({ canvasContext: ctx, viewport }).promise;

                // Convert to image
                const imgUrl = canvas.toDataURL('image/jpeg', 0.85);
                const card = body.querySelector(`.kanski-page-card[data-page="${p.pageNum}"]`);
                if (card) {
                    const container = card.querySelector('.kanski-img-container');
                    container.innerHTML = `<img src="${imgUrl}" style="width: 100%; display: block;" alt="Kanski p.${p.pageNum}">`;
                    card.dataset.imgUrl = imgUrl;
                }
            } catch (err) {
                console.warn(`Failed to render page ${p.pageNum}:`, err);
                const card = body.querySelector(`.kanski-page-card[data-page="${p.pageNum}"]`);
                if (card) {
                    card.querySelector('.kanski-img-container').innerHTML = `<div style="padding: 2rem; text-align: center; color: #ef4444;"><span class="material-symbols-rounded">error</span><p>Failed to render</p></div>`;
                }
            }
        }

        // Selection toggle on card click
        body.querySelectorAll('.kanski-page-card').forEach(card => {
            card.addEventListener('click', () => {
                const pageNum = parseInt(card.dataset.page);
                const badge = card.querySelector('.kanski-selected-badge');
                if (selectedPages.has(pageNum)) {
                    selectedPages.delete(pageNum);
                    card.style.borderColor = '#e2e8f0';
                    card.style.boxShadow = '';
                    if (badge) badge.style.display = 'none';
                } else {
                    selectedPages.add(pageNum);
                    card.style.borderColor = '#0891b2';
                    card.style.boxShadow = '0 0 0 3px rgba(8, 145, 178, 0.3)';
                    if (badge) badge.style.display = 'flex';
                }
            });
        });

        // Insert into infographic button
        const insertBtn = kModal.querySelector('#kanski-insert-btn');
        insertBtn.onclick = () => {
            if (selectedPages.size === 0) {
                // If none selected, insert all
                if (!confirm(`No images selected. Insert all ${topPages.length} images into the infographic?`)) return;
                topPages.forEach(p => selectedPages.add(p.pageNum));
            }

            // Collect selected images
            const images = [];
            body.querySelectorAll('.kanski-page-card').forEach(card => {
                const pageNum = parseInt(card.dataset.page);
                if (selectedPages.has(pageNum) && card.dataset.imgUrl) {
                    images.push({
                        pageNum,
                        imgUrl: card.dataset.imgUrl,
                        keywords: topPages.find(p => p.pageNum === pageNum)?.matchedKeywords || []
                    });
                }
            });

            if (images.length === 0) {
                alert('No rendered images available to insert.');
                return;
            }

            // Insert images into the currently rendered infographic
            insertKanskiImages(images);
            kModal.classList.remove('active');
        };
    }

    function insertKanskiImages(images) {
        const posterGrid = document.querySelector('.poster-grid');
        if (!posterGrid) {
            alert('No infographic is currently displayed. Please load one first.');
            return;
        }

        // Remove any existing Kanski section first
        const existingSection = posterGrid.querySelector('#kanski-images-section');
        if (existingSection) existingSection.remove();

        // Create a Kanski images section card
        const kanskiSection = document.createElement('div');
        kanskiSection.id = 'kanski-images-section';
        kanskiSection.className = 'poster-card card-key_point col-span-2 theme-blue';
        kanskiSection.style.cssText = 'animation-delay: 0ms;';

        // Check if already adhered for this infographic
        const isAlreadyAdhered = isKanskiAdhered();

        kanskiSection.innerHTML = `
            <h3 class="card-title" style="color: #0e7490;">
                <div class="icon-box" style="background: linear-gradient(135deg, #0891b2, #0e7490);"><span class="material-symbols-rounded">photo_library</span></div>
                Kanski Clinical Photos
                <span style="font-size: 0.75rem; font-weight: 400; color: #64748b; margin-left: auto;">
                    ${images.length} image(s)
                </span>
            </h3>
            <div style="display: flex; gap: 0.5rem; margin: 0.5rem 0; flex-wrap: wrap;">
                <button id="kanski-adhere-btn" class="btn-small" title="Save permanently with this infographic"
                    style="display: flex; align-items: center; gap: 4px; padding: 6px 14px; border-radius: 6px; font-weight: 600; font-size: 0.8rem;
                    background: ${isAlreadyAdhered ? '#d1fae5' : 'linear-gradient(135deg, #059669, #047857)'}; 
                    color: ${isAlreadyAdhered ? '#047857' : 'white'}; 
                    border: ${isAlreadyAdhered ? '1px solid #6ee7b7' : 'none'}; cursor: pointer; transition: all 0.2s;">
                    <span class="material-symbols-rounded" style="font-size: 1rem;">${isAlreadyAdhered ? 'check_circle' : 'push_pin'}</span>
                    ${isAlreadyAdhered ? 'Adhered' : 'Adhere'}
                </button>
                <button id="kanski-remove-btn" class="btn-small" title="Remove Kanski images from this infographic"
                    style="display: flex; align-items: center; gap: 4px; padding: 6px 14px; border-radius: 6px; font-weight: 600; font-size: 0.8rem;
                    background: linear-gradient(135deg, #ef4444, #dc2626); color: white; border: none; cursor: pointer; transition: all 0.2s;">
                    <span class="material-symbols-rounded" style="font-size: 1rem;">delete</span>
                    Remove
                </button>
            </div>
            <div class="kanski-images-display" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 0.75rem; margin-top: 0.5rem;">
                ${images.map(img => `
                    <div style="border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; background: white;">
                        <img src="${img.imgUrl}" class="kanski-img-toggle"
                            alt="Kanski p.${img.pageNum}" 
                            title="Click to expand/collapse">
                        <div style="padding: 4px 8px; font-size: 0.7rem; color: #64748b; background: #f8fafc; border-top: 1px solid #e2e8f0;">
                            <strong>p.${img.pageNum}</strong> · ${img.keywords.slice(0, 3).join(', ')}
                        </div>
                    </div>
                `).join('')}
            </div>
        `;

        // Insert at the end of the poster grid
        posterGrid.appendChild(kanskiSection);

        // ── Adhere button: save images to IndexedDB, meta to localStorage ──
        const adhereBtn = kanskiSection.querySelector('#kanski-adhere-btn');
        adhereBtn.addEventListener('click', async () => {
            if (!currentInfographicData) {
                alert('No infographic loaded.');
                return;
            }

            // Find the matching library item
            const library = JSON.parse(localStorage.getItem(LIBRARY_KEY) || '[]');
            const item = library.find(i => i.title === currentInfographicData.title);
            if (!item) {
                alert('This infographic is not saved in your library. Save it first, then adhere Kanski images.');
                return;
            }

            adhereBtn.disabled = true;
            adhereBtn.innerHTML = '<span class="material-symbols-rounded" style="font-size: 1rem;">hourglass_top</span> Saving...';

            // Store actual image data in IndexedDB (no size limit)
            const idbImages = images.map(img => ({
                pageNum: img.pageNum,
                imgUrl: img.imgUrl,
                keywords: img.keywords.slice(0, 5)
            }));
            const saved = await saveKanskiToIDB(currentInfographicData.title, idbImages);

            if (!saved) {
                alert('Failed to save Kanski images. Please try again.');
                adhereBtn.disabled = false;
                adhereBtn.innerHTML = '<span class="material-symbols-rounded" style="font-size: 1rem;">push_pin</span> Adhere';
                return;
            }

            // Store lightweight meta in localStorage (just page nums + keywords, NO images)
            item.kanskiMeta = images.map(img => ({
                pageNum: img.pageNum,
                keywords: img.keywords.slice(0, 5)
            }));
            // Clean up any legacy kanskiImages from localStorage
            delete item.kanskiImages;
            if (item.data) {
                delete item.data.kanskiImages;
            }

            localStorage.setItem(LIBRARY_KEY, JSON.stringify(library));

            // Update button appearance to show "Adhered"
            adhereBtn.disabled = false;
            adhereBtn.style.background = '#d1fae5';
            adhereBtn.style.color = '#047857';
            adhereBtn.style.border = '1px solid #6ee7b7';
            adhereBtn.innerHTML = '<span class="material-symbols-rounded" style="font-size: 1rem;">check_circle</span> Adhered';

            alert(`✅ ${images.length} Kanski image(s) permanently saved with "${currentInfographicData.title}".\n\nThey will load automatically whenever you open this infographic.`);
        });

        // ── Remove button: remove Kanski images section (and optionally from storage) ──
        const removeBtn = kanskiSection.querySelector('#kanski-remove-btn');
        removeBtn.addEventListener('click', async () => {
            const hasAdhered = isKanskiAdhered();

            if (hasAdhered) {
                const removeFromLibrary = confirm(
                    'Kanski images are permanently adhered to this infographic.\n\n' +
                    'Click OK to remove them permanently (from library too).\n' +
                    'Click Cancel to only hide them for this session.'
                );

                if (removeFromLibrary) {
                    // Remove meta from localStorage
                    const library = JSON.parse(localStorage.getItem(LIBRARY_KEY) || '[]');
                    const item = library.find(i => i.title === currentInfographicData.title);
                    if (item) {
                        delete item.kanskiMeta;
                        delete item.kanskiImages; // Clean up legacy
                        if (item.data) {
                            delete item.data.kanskiMeta;
                            delete item.data.kanskiImages;
                        }
                        localStorage.setItem(LIBRARY_KEY, JSON.stringify(library));
                    }
                    // Remove images from IndexedDB
                    await deleteKanskiFromIDB(currentInfographicData.title);
                }
            }

            // Remove from DOM
            kanskiSection.remove();
        });

        // Delegated click handler for image expand/collapse (iOS-safe)
        kanskiSection.addEventListener('click', (e) => {
            const img = e.target.closest('.kanski-img-toggle');
            if (img) img.classList.toggle('kanski-img-expanded');
        });

        // Scroll to the new section
        kanskiSection.scrollIntoView({ behavior: 'smooth', block: 'center' });

        alert(`✅ ${images.length} Kanski image(s) inserted into the infographic!\n\nUse "Adhere" to save them permanently, or they will disappear when you navigate away.`);
    }

    /**
     * Check if current infographic has adhered Kanski images in library
     * (checks lightweight meta in localStorage — no heavy image data)
     */
    function isKanskiAdhered() {
        if (!currentInfographicData) return false;
        try {
            const library = JSON.parse(localStorage.getItem(LIBRARY_KEY) || '[]');
            const item = library.find(i => i.title === currentInfographicData.title);
            return item && item.kanskiMeta && item.kanskiMeta.length > 0;
        } catch { return false; }
    }

    console.log('Kanski Pics initialized.');
}

/* ========================================
   INITIALIZE ALL STUDIO TOOLS
   ======================================== */

document.addEventListener('DOMContentLoaded', () => {
    // Initialize all studio tools
    setupAudioOverview();
    setupVideoOverview();
    setupMindMap();
    setupReports();
    setupFlashcards();
    setupQuiz();
    setupSlideDeck();
    setupKanskiPics();
    setupStickyNotes();

    // Initialize Community Hub
    setupCommunityHub();

    // Initialize Music Player
    setupMusicPlayer();

    // Initialize Narrator
    setupNarrator();

    // Initially disable tools
    disableStudioTools();
});

// ==========================================
// STORY NARRATOR
// ==========================================
function setupNarrator() {
    const readBtn = document.getElementById('read-aloud-btn');
    if (!readBtn) return;

    let isReading = false;
    let utterance = null;

    readBtn.addEventListener('click', () => {
        if (isReading) {
            // Stop reading
            window.speechSynthesis.cancel();
            isReading = false;
            readBtn.classList.remove('active');
            readBtn.innerHTML = '<span class="material-symbols-rounded">record_voice_over</span>';
            return;
        }

        if (!currentInfographicData) {
            alert('Please generate or load an infographic first.');
            return;
        }

        // build text to read
        const data = currentInfographicData;
        let textToRead = `${data.title}. ${data.summary || ''}. `;

        if (data.sections) {
            data.sections.forEach(section => {
                textToRead += `${section.title}. `;
                if (Array.isArray(section.content)) {
                    textToRead += section.content.join('. ');
                } else if (typeof section.content === 'string') {
                    textToRead += section.content;
                } else if (typeof section.content === 'object') {
                    // handle objects like mnemonics or centers
                    if (section.content.mnemonic) {
                        textToRead += `Mnemonic: ${section.content.mnemonic}. ${section.content.explanation}. `;
                    }
                    if (section.content.center) {
                        textToRead += `${section.content.center}. ${section.content.branches.join('. ')}. `;
                    }
                }
                textToRead += '. ';
            });
        }

        // Start reading
        utterance = new SpeechSynthesisUtterance(textToRead);

        // Select a voice (prefer English Female / Storyteller)
        const voices = window.speechSynthesis.getVoices();

        // Priority: specific high-quality voices -> any female english -> any english
        const preferredVoices = [
            'Google UK English Female',
            'Google US English',
            'Samantha',
            'Microsoft Zira',
            'Daniel' // Good fallback for GB
        ];

        let selectedVoice = null;

        // 1. Try preferred list
        for (const name of preferredVoices) {
            selectedVoice = voices.find(v => v.name.includes(name));
            if (selectedVoice) break;
        }

        // 2. Try any English Female
        if (!selectedVoice) {
            selectedVoice = voices.find(v => v.lang.startsWith('en') && (v.name.toLowerCase().includes('female') || v.name.includes('Samantha')));
        }

        // 3. Try any English GB or US
        if (!selectedVoice) {
            selectedVoice = voices.find(v => v.lang.startsWith('en-GB')) || voices.find(v => v.lang.startsWith('en-US'));
        }

        if (selectedVoice) {
            utterance.voice = selectedVoice;
        }

        utterance.rate = 0.85; // Slower rate regarding user request
        utterance.pitch = 1.0; // Default pitch

        utterance.onend = () => {
            isReading = false;
            readBtn.classList.remove('active');
            readBtn.innerHTML = '<span class="material-symbols-rounded">record_voice_over</span>';
        };

        utterance.onerror = (e) => {
            console.error('Speech synthesis error:', e);
            isReading = false;
            readBtn.classList.remove('active');
            readBtn.innerHTML = '<span class="material-symbols-rounded">record_voice_over</span>';
        };

        window.speechSynthesis.speak(utterance);
        isReading = true;
        readBtn.classList.add('active');
        readBtn.innerHTML = '<span class="material-symbols-rounded">stop_circle</span>';
    });
}

// ==========================================
// ==========================================
// NOTEBOOKLM NOTES MIRROR — Full System
// ==========================================
const NLM_NOTES_KEY = 'notebooklm_mirror_notes';
const NLM_GIST_ID = '3b43030a808541a28d6b125847567f66';
const NLM_POOL_FILENAME = 'notebooklm_notes.json';

function loadNLMNotes() {
    try {
        return JSON.parse(localStorage.getItem(NLM_NOTES_KEY) || '[]');
    } catch { return []; }
}

function saveNLMNotes(notes) {
    localStorage.setItem(NLM_NOTES_KEY, JSON.stringify(notes));
    updateNLMBadge(notes.length);
}

function updateNLMBadge(count) {
    const badge = document.getElementById('nlm-count-badge');
    if (!badge) return;
    if (count > 0) {
        badge.textContent = count > 99 ? '99+' : count;
        badge.style.display = '';
    } else {
        badge.style.display = 'none';
    }
}

/**
 * Import bulk text into individual notes
 * Splits by '---' delimiters or double-newlines
 */
function importBulkNotes(text) {
    if (!text || !text.trim()) return 0;
    const notes = loadNLMNotes();
    let chunks;
    // Split by --- delimiter first
    if (text.includes('---')) {
        chunks = text.split(/\n?---+\n?/).map(c => c.trim()).filter(c => c.length > 5);
    } else {
        // Split by double-newline
        chunks = text.split(/\n\s*\n/).map(c => c.trim()).filter(c => c.length > 5);
    }
    if (chunks.length === 0) {
        // Treat entire text as one note
        chunks = [text.trim()];
    }
    let added = 0;
    chunks.forEach(chunk => {
        const exists = notes.find(n => n.text === chunk);
        if (!exists) {
            notes.unshift({
                id: Date.now().toString() + '_' + Math.random().toString(36).substr(2, 5),
                text: chunk,
                source: 'NotebookLM Import',
                createdAt: new Date().toISOString()
            });
            added++;
        }
    });
    if (added > 0) saveNLMNotes(notes);
    return added;
}

/**
 * Render the NLM notes list in the side panel
 */
function renderNLMPanel(filterText) {
    const listEl = document.getElementById('nlm-notes-list');
    if (!listEl) return;
    const notes = loadNLMNotes();
    updateNLMBadge(notes.length);

    if (notes.length === 0) {
        listEl.innerHTML = `
            <div class="nlm-empty-state" id="nlm-empty-state">
                <span class="material-symbols-rounded">note_stack</span>
                <p>No notes imported yet</p>
                <small>Paste notes from NotebookLM or sync from the pool</small>
            </div>
        `;
        return;
    }

    const q = (filterText || '').toLowerCase().trim();
    const filtered = q
        ? notes.filter(n => n.text.toLowerCase().includes(q) || (n.source || '').toLowerCase().includes(q))
        : notes;

    if (filtered.length === 0) {
        listEl.innerHTML = `
            <div class="nlm-empty-state">
                <span class="material-symbols-rounded">search_off</span>
                <p>No matching notes</p>
                <small>Try a different search term</small>
            </div>
        `;
        return;
    }

    listEl.innerHTML = filtered.map(note => {
        const date = new Date(note.createdAt);
        const timeStr = date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' }) + ' ' +
            date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
        const matchHtml = note._matchScore
            ? `<span class="nlm-match-score"><span class="material-symbols-rounded" style="font-size:0.7rem;">trending_up</span>${note._matchScore}%</span>`
            : '';
        const matchClass = note._matchScore ? ' matched' : '';
        const noteTextDisplay = note._highlightedText || escapeHtml(note.text);
        return `
            <div class="nlm-note-card${matchClass}" data-note-id="${note.id}">
                <div class="nlm-note-meta">
                    <span class="nlm-note-date">${timeStr} ${matchHtml}</span>
                    <div class="nlm-note-actions">
                        <button class="nlm-note-action nlm-use-btn" data-note-id="${note.id}" title="Use as topic input">
                            <span class="material-symbols-rounded">input</span>
                        </button>
                        <button class="nlm-note-action nlm-copy-btn" data-note-id="${note.id}" title="Copy">
                            <span class="material-symbols-rounded">content_copy</span>
                        </button>
                        <button class="nlm-note-action delete nlm-delete-btn" data-note-id="${note.id}" title="Delete">
                            <span class="material-symbols-rounded">close</span>
                        </button>
                    </div>
                </div>
                <div class="nlm-note-text">${noteTextDisplay}</div>
                ${note.source ? `<div class="nlm-note-source"><span class="material-symbols-rounded">description</span>${escapeHtml((note.source || '').substring(0, 60))}</div>` : ''}
            </div>
        `;
    }).join('');

    // Attach event listeners
    listEl.querySelectorAll('.nlm-delete-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const id = btn.dataset.noteId;
            const updated = loadNLMNotes().filter(n => n.id !== id);
            saveNLMNotes(updated);
            const card = btn.closest('.nlm-note-card');
            if (card) {
                card.style.transition = 'opacity 0.3s, transform 0.3s';
                card.style.opacity = '0';
                card.style.transform = 'scale(0.9)';
                setTimeout(() => { card.remove(); updateNLMBadge(updated.length); }, 300);
            }
        });
    });

    listEl.querySelectorAll('.nlm-copy-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const id = btn.dataset.noteId;
            const note = loadNLMNotes().find(n => n.id === id);
            if (note) {
                try {
                    await navigator.clipboard.writeText(note.text);
                    btn.innerHTML = '<span class="material-symbols-rounded">check</span>';
                    setTimeout(() => btn.innerHTML = '<span class="material-symbols-rounded">content_copy</span>', 1500);
                } catch { /* ignore */ }
            }
        });
    });

    listEl.querySelectorAll('.nlm-use-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const id = btn.dataset.noteId;
            const note = loadNLMNotes().find(n => n.id === id);
            if (note) {
                const topicArea = document.getElementById('topic-input');
                if (topicArea) {
                    topicArea.value = note.text;
                    topicArea.scrollIntoView({ behavior: 'smooth' });
                    topicArea.focus();
                }
            }
        });
    });
}

/**
 * Sync NLM notes from Gist pool
 */
async function syncNLMFromGist() {
    const syncBtn = document.getElementById('nlm-sync-gist-btn');
    if (syncBtn) syncBtn.innerHTML = '<span class="material-symbols-rounded rotating">sync</span>';

    try {
        const resp = await fetch(`https://api.github.com/gists/${NLM_GIST_ID}`);
        if (!resp.ok) throw new Error('Failed to reach pool');
        const gist = await resp.json();
        const file = gist.files[NLM_POOL_FILENAME];

        let poolData = [];
        if (file) {
            const rawResp = await fetch(file.raw_url);
            poolData = JSON.parse(await rawResp.text());
        }

        // Also try sticky notes pool as fallback
        const stickyFile = gist.files['pool_sticky_notes.json'];
        if (stickyFile) {
            try {
                const stickyResp = await fetch(stickyFile.raw_url);
                const stickyData = JSON.parse(await stickyResp.text());
                poolData = poolData.concat(stickyData);
            } catch { /* ignore */ }
        }

        if (poolData.length === 0) {
            alert('No notes found in pool.');
            if (syncBtn) syncBtn.innerHTML = '<span class="material-symbols-rounded">cloud_download</span>';
            return;
        }

        const notes = loadNLMNotes();
        let added = 0;
        poolData.forEach(pn => {
            const exists = notes.find(nn => nn.text === pn.text);
            if (!exists) {
                notes.unshift({
                    id: Date.now().toString() + '_' + Math.random().toString(36).substr(2, 5),
                    text: pn.text,
                    source: pn.source || 'Pool Sync',
                    createdAt: pn.createdAt || new Date().toISOString()
                });
                added++;
            }
        });

        if (added > 0) {
            saveNLMNotes(notes);
            renderNLMPanel();
            alert(`Synced ${added} new notes from pool!`);
        } else {
            alert('All pool notes already imported.');
        }
    } catch (err) {
        console.error('[NLM Sync]', err);
        alert('Sync failed: ' + err.message);
    }

    if (syncBtn) syncBtn.innerHTML = '<span class="material-symbols-rounded">cloud_download</span>';
}

/**
 * Find matching NLM notes for the current infographic topic
 * Uses keyword matching + Gemini AI ranking if available
 */
async function findMatchingNotes(infographicTitle, sections) {
    const notes = loadNLMNotes();
    if (notes.length === 0) {
        alert('No NotebookLM notes imported yet. Open the NotebookLM panel and import notes first.');
        return;
    }

    // Extract keywords from infographic
    const titleWords = (infographicTitle || '').toLowerCase().split(/\W+/).filter(w => w.length > 3);
    const sectionTitles = (sections || []).map(s => (s.title || '').toLowerCase()).join(' ');
    const sectionWords = sectionTitles.split(/\W+/).filter(w => w.length > 3);
    const allKeywords = [...new Set([...titleWords, ...sectionWords])];

    // Score each note by keyword overlap
    const scored = notes.map(note => {
        const noteText = note.text.toLowerCase();
        let score = 0;
        const matchedKeywords = [];
        allKeywords.forEach(kw => {
            if (noteText.includes(kw)) {
                score += 10;
                matchedKeywords.push(kw);
            }
        });
        // Bonus for title match
        if (noteText.includes(infographicTitle.toLowerCase().substring(0, 20))) {
            score += 30;
        }
        return { ...note, _matchScore: Math.min(100, score), _matchedKeywords: matchedKeywords };
    });

    // Sort by score descending
    scored.sort((a, b) => b._matchScore - a._matchScore);

    // Take top results with score > 0
    let results = scored.filter(n => n._matchScore > 0).slice(0, 10);

    // If Gemini API is available, refine ranking
    const apiKey = document.getElementById('api-key')?.value?.trim();
    if (apiKey && results.length > 1) {
        try {
            const { GoogleGenerativeAI } = await import("@google/generative-ai");
            const genAI = new GoogleGenerativeAI(apiKey);
            const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

            const notesSummary = results.slice(0, 8).map((n, i) =>
                `Note ${i + 1}: "${n.text.substring(0, 200)}..."`
            ).join('\n');

            const prompt = `Given an ophthalmology infographic titled "${infographicTitle}", rank these notes by relevance (most relevant first). Return ONLY a JSON array of note indices (1-based), e.g. [3,1,5,2,4]. Notes:\n${notesSummary}`;

            const result = await model.generateContent(prompt);
            const responseText = result.response.text().trim();
            const match = responseText.match(/\[[\d,\s]+\]/);
            if (match) {
                const ranking = JSON.parse(match[0]);
                const reordered = [];
                ranking.forEach(idx => {
                    const note = results[idx - 1];
                    if (note) {
                        note._matchScore = Math.min(100, note._matchScore + 20); // Boost AI-confirmed matches
                        reordered.push(note);
                    }
                });
                // Add any unranked notes at the end
                results.forEach(n => {
                    if (!reordered.find(r => r.id === n.id)) reordered.push(n);
                });
                results = reordered;
            }
        } catch (err) {
            console.warn('[NLM Match] Gemini ranking failed, using keyword-only:', err.message);
        }
    }

    // If no keyword matches, show top 5 with minimal score
    if (results.length === 0) {
        results = scored.slice(0, 5).map(n => ({ ...n, _matchScore: 5 }));
    }

    // Highlight matched keywords in text
    results.forEach(note => {
        let html = escapeHtml(note.text);
        (note._matchedKeywords || []).forEach(kw => {
            const regex = new RegExp(`(${kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
            html = html.replace(regex, '<span class="nlm-highlight">$1</span>');
        });
        note._highlightedText = html;
    });

    // Open the NLM panel and display results
    const appContainer = document.querySelector('.app-container');
    if (appContainer) appContainer.classList.add('notebooklm-open');

    // Render matched notes in the panel
    const listEl = document.getElementById('nlm-notes-list');
    if (listEl) {
        // Temporarily replace the notes list with match results
        const originalNotes = loadNLMNotes();
        // Clear match scores from saved notes
        originalNotes.forEach(n => { delete n._matchScore; delete n._highlightedText; delete n._matchedKeywords; });

        // Render with match scores
        const matchHeader = document.createElement('div');
        matchHeader.style.cssText = 'padding: 0.5rem 0.25rem; font-size: 0.8rem; font-weight: 600; color: #4f46e5; display: flex; align-items: center; gap: 6px; border-bottom: 1px solid #e0e7ff; margin-bottom: 0.5rem;';
        matchHeader.innerHTML = `<span class="material-symbols-rounded" style="font-size:1.1rem;">auto_awesome</span> ${results.length} notes matched for "${escapeHtml(infographicTitle.substring(0, 40))}"
            <button id="nlm-clear-match" style="margin-left:auto; background:none; border:none; cursor:pointer; color:#94a3b8; font-size:0.75rem; display:flex; align-items:center; gap:2px;">
                <span class="material-symbols-rounded" style="font-size:0.9rem;">close</span> Show all
            </button>`;

        listEl.innerHTML = '';
        listEl.appendChild(matchHeader);

        // Re-render with match data
        results.forEach(note => {
            const date = new Date(note.createdAt);
            const timeStr = date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' }) + ' ' +
                date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
            const scoreColor = note._matchScore >= 50 ? '#22c55e' : note._matchScore >= 20 ? '#f59e0b' : '#94a3b8';
            const card = document.createElement('div');
            card.className = 'nlm-note-card' + (note._matchScore >= 20 ? ' matched' : '');
            card.dataset.noteId = note.id;
            card.innerHTML = `
                <div class="nlm-note-meta">
                    <span class="nlm-note-date">${timeStr}
                        <span class="nlm-match-score" style="background:${scoreColor};">
                            <span class="material-symbols-rounded" style="font-size:0.7rem;">trending_up</span>${note._matchScore}%
                        </span>
                    </span>
                    <div class="nlm-note-actions">
                        <button class="nlm-note-action nlm-use-btn" data-note-id="${note.id}" title="Use as topic input">
                            <span class="material-symbols-rounded">input</span>
                        </button>
                        <button class="nlm-note-action nlm-copy-btn" data-note-id="${note.id}" title="Copy">
                            <span class="material-symbols-rounded">content_copy</span>
                        </button>
                    </div>
                </div>
                <div class="nlm-note-text">${note._highlightedText || escapeHtml(note.text)}</div>
                ${note.source ? `<div class="nlm-note-source"><span class="material-symbols-rounded">description</span>${escapeHtml((note.source || '').substring(0, 60))}</div>` : ''}
            `;
            listEl.appendChild(card);
        });

        // Clear match button
        const clearMatchBtn = listEl.querySelector('#nlm-clear-match');
        if (clearMatchBtn) {
            clearMatchBtn.addEventListener('click', () => renderNLMPanel());
        }

        // Re-attach event listeners for match results
        listEl.querySelectorAll('.nlm-copy-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const note = results.find(n => n.id === btn.dataset.noteId);
                if (note) {
                    try {
                        await navigator.clipboard.writeText(note.text);
                        btn.innerHTML = '<span class="material-symbols-rounded">check</span>';
                        setTimeout(() => btn.innerHTML = '<span class="material-symbols-rounded">content_copy</span>', 1500);
                    } catch { /* ignore */ }
                }
            });
        });
        listEl.querySelectorAll('.nlm-use-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const note = results.find(n => n.id === btn.dataset.noteId);
                if (note) {
                    const topicArea = document.getElementById('topic-input');
                    if (topicArea) {
                        topicArea.value = note.text;
                        topicArea.scrollIntoView({ behavior: 'smooth' });
                        topicArea.focus();
                    }
                }
            });
        });
    }
}

// ── NLM Panel Initialization & Toggle ──
(function initNLMPanel() {
    const notebooklmToggleBtn = document.getElementById('notebooklm-toggle-btn');
    const closeNotebooklmBtn = document.getElementById('close-notebooklm-btn');
    const appContainerVal = document.querySelector('.app-container');

    // Toggle panel
    if (notebooklmToggleBtn && appContainerVal) {
        notebooklmToggleBtn.addEventListener('click', () => {
            const isOpening = !appContainerVal.classList.contains('notebooklm-open');
            appContainerVal.classList.toggle('notebooklm-open');
            if (isOpening) renderNLMPanel();
        });
    }

    // Close panel
    if (closeNotebooklmBtn && appContainerVal) {
        closeNotebooklmBtn.addEventListener('click', () => {
            appContainerVal.classList.remove('notebooklm-open');
        });
    }

    // Import toggle (collapsible)
    const importToggle = document.getElementById('nlm-import-toggle');
    const importBody = document.getElementById('nlm-import-body');
    if (importToggle && importBody) {
        importToggle.addEventListener('click', () => {
            const isExpanded = importBody.style.display !== 'none';
            importBody.style.display = isExpanded ? 'none' : 'block';
            importToggle.classList.toggle('expanded', !isExpanded);
        });
    }

    // Add pasted notes
    const addPastedBtn = document.getElementById('nlm-add-pasted-btn');
    const pasteArea = document.getElementById('nlm-paste-area');
    if (addPastedBtn && pasteArea) {
        addPastedBtn.addEventListener('click', () => {
            const text = pasteArea.value.trim();
            if (!text) return;
            const added = importBulkNotes(text);
            pasteArea.value = '';
            if (added > 0) {
                renderNLMPanel();
                // Quick feedback
                addPastedBtn.innerHTML = '<span class="material-symbols-rounded">check</span> Added ' + added + '!';
                setTimeout(() => addPastedBtn.innerHTML = '<span class="material-symbols-rounded">add</span> Add Notes', 2000);
            } else {
                alert('All notes already imported (no duplicates found).');
            }
        });
    }

    // Clear all
    const clearAllBtn = document.getElementById('nlm-clear-all-btn');
    if (clearAllBtn) {
        clearAllBtn.addEventListener('click', () => {
            const notes = loadNLMNotes();
            if (notes.length === 0) return;
            if (!confirm(`Delete all ${notes.length} NotebookLM notes? This cannot be undone.`)) return;
            saveNLMNotes([]);
            renderNLMPanel();
        });
    }

    // Sync from Gist
    const syncBtn = document.getElementById('nlm-sync-gist-btn');
    if (syncBtn) {
        syncBtn.addEventListener('click', () => syncNLMFromGist());
    }

    // Search
    const searchInput = document.getElementById('nlm-search-input');
    if (searchInput) {
        let searchTimer;
        searchInput.addEventListener('input', () => {
            clearTimeout(searchTimer);
            searchTimer = setTimeout(() => renderNLMPanel(searchInput.value), 250);
        });
    }

    // Initialize badge
    updateNLMBadge(loadNLMNotes().length);
})();
