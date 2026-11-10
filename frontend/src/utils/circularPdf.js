import { jsPDF } from 'jspdf';

export const parseCircularNumbers = (value) => {
    if (!value) return {};
    if (typeof value === 'object') return value;
    try {
        const parsed = JSON.parse(value);
        return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch {
        return {};
    }
};

export const getCircularNumberForCollege = (value, college) => {
    const numbers = parseCircularNumbers(value);
    if (!college) return '';
    const key = Object.keys(numbers).find(name => name.trim().toLowerCase() === String(college).trim().toLowerCase());
    return key ? numbers[key] : '';
};

export const downloadCircularPdf = (announcement, college) => {
    const circularNumber = getCircularNumberForCollege(announcement.circular_numbers, college);
    if (!circularNumber) throw new Error('Circular number is not available for your college.');

    const pdf = new jsPDF();
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 20;
    const textWidth = pageWidth - margin * 2;
    let y = 24;

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(11);
    pdf.text(circularNumber, margin, y);
    pdf.text(new Date(announcement.created_at || Date.now()).toLocaleDateString(), pageWidth - margin, y, { align: 'right' });

    y += 16;
    pdf.setFontSize(16);
    const titleLines = pdf.splitTextToSize(announcement.title || 'Circular', textWidth);
    pdf.text(titleLines, pageWidth / 2, y, { align: 'center' });
    y += titleLines.length * 8 + 8;

    pdf.setDrawColor(180);
    pdf.line(margin, y, pageWidth - margin, y);
    y += 10;

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(11);
    const contentLines = pdf.splitTextToSize(announcement.content || '', textWidth);
    contentLines.forEach(line => {
        if (y > pageHeight - margin) {
            pdf.addPage();
            y = margin;
        }
        pdf.text(line, margin, y);
        y += 6;
    });

    y = Math.max(y + 14, pageHeight - 55);
    if (y > pageHeight - margin) {
        pdf.addPage();
        y = margin;
    }
    pdf.setFont('helvetica', 'bold');
    pdf.text(announcement.circular_signatory || '', pageWidth - margin, y, { align: 'right' });
    if (announcement.circular_designation) {
        pdf.setFont('helvetica', 'normal');
        pdf.text(announcement.circular_designation, pageWidth - margin, y + 6, { align: 'right' });
    }

    const filename = `${circularNumber.replace(/[^a-z0-9-_]+/gi, '_')}.pdf`;
    pdf.save(filename);
};
