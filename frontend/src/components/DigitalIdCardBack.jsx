import React from 'react';
import { DEFAULT_COLLEGE, resolveCollegeDetails } from '../config/collegeConfig';

/**
 * Top Back Layered Red Wave Header SVG matching reference design
 */
const BackTopWaveSVG = () => {
  const reactId = React.useId ? React.useId().replace(/:/g, '') : Math.random().toString(36).substring(2, 7);
  const accentId = `backTopAccentGrad_${reactId}`;
  const mainId = `backTopMainGrad_${reactId}`;

  return (
    <svg
      viewBox="0 0 540 140"
      preserveAspectRatio="none"
      className="absolute top-0 left-0 w-full pointer-events-none"
      style={{ height: '13.5mm', zIndex: 1, printColorAdjust: 'exact', WebkitPrintColorAdjust: 'exact' }}
    >
      <defs>
        <linearGradient id={accentId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FCA5A5" />
          <stop offset="50%" stopColor="#F87171" />
          <stop offset="100%" stopColor="#DC2626" />
        </linearGradient>
        <linearGradient id={mainId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#D71920" />
          <stop offset="100%" stopColor="#991B1B" />
        </linearGradient>
      </defs>
      {/* Soft light red background wave accent */}
      <path
        d="M 0 0 L 540 0 L 540 120 C 360 40, 180 140, 0 105 Z"
        fill={`url(#${accentId})`}
        opacity="0.85"
        style={{ fill: `url(#${accentId}) #F87171` }}
      />
      {/* Main primary vibrant red wave */}
      <path
        d="M 0 0 L 540 0 L 540 95 C 380 30, 160 115, 0 88 Z"
        fill={`url(#${mainId})`}
        style={{ fill: `url(#${mainId}) #D71920` }}
      />
    </svg>
  );
};

/**
 * Bottom Back Layered Red Wave SVG matching reference design
 */
const BackBottomWaveSVG = () => {
  const reactId = React.useId ? React.useId().replace(/:/g, '') : Math.random().toString(36).substring(2, 7);
  const accentId = `backBottomAccentGrad_${reactId}`;
  const mainId = `backBottomMainGrad_${reactId}`;

  return (
    <svg
      viewBox="0 0 540 140"
      preserveAspectRatio="none"
      className="absolute bottom-0 left-0 w-full pointer-events-none"
      style={{ height: '12.5mm', zIndex: 2, printColorAdjust: 'exact', WebkitPrintColorAdjust: 'exact' }}
    >
      <defs>
        <linearGradient id={accentId} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#FCA5A5" />
          <stop offset="50%" stopColor="#F87171" />
          <stop offset="100%" stopColor="#EF4444" />
        </linearGradient>
        <linearGradient id={mainId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#EA2635" />
          <stop offset="50%" stopColor="#D71920" />
          <stop offset="100%" stopColor="#991B1B" />
        </linearGradient>
      </defs>
      {/* Light red accent ribbon above bottom wave */}
      <path
        d="M 0 55 C 160 125, 380 20, 540 60 L 540 140 L 0 140 Z"
        fill={`url(#${accentId})`}
        opacity="0.85"
        style={{ fill: `url(#${accentId}) #F87171` }}
      />
      {/* Main vibrant red bottom wave */}
      <path
        d="M 0 70 C 180 135, 360 40, 540 78 L 540 140 L 0 140 Z"
        fill={`url(#${mainId})`}
        style={{ fill: `url(#${mainId}) #D71920` }}
      />
    </svg>
  );
};

/**
 * Dynamic Website font size calculation based on string length
 */
const getWebsiteFontSize = (webStr) => {
  const len = String(webStr || '').trim().length;
  if (len <= 22) return '6.0pt';
  if (len <= 28) return '5.5pt';
  if (len <= 34) return '5.0pt';
  return '4.6pt';
};

/**
 * Format Date of Birth string strictly as DD-MM-YYYY
 */
const formatDobDdMmYyyy = (raw) => {
  if (!raw) return '15-08-2008';
  const str = String(raw).trim();

  // If already DD-MM-YYYY format (e.g. 15-08-2008)
  if (/^\d{2}-\d{2}-\d{4}$/.test(str)) {
    return str;
  }
  // If DD/MM/YYYY format -> replace slashes with hyphens
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(str)) {
    return str.replace(/\//g, '-');
  }

  let date = new Date(raw);
  if (isNaN(date.getTime())) {
    const parts = str.split(/[\/\-.]/);
    if (parts.length === 3) {
      if (parts[0].length === 4) {
        // YYYY-MM-DD
        date = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
      } else if (parts[2].length === 4) {
        // DD-MM-YYYY or MM-DD-YYYY
        date = new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]));
      }
    }
  }

  if (isNaN(date.getTime())) return str;

  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}-${month}-${year}`;
};

/**
 * Truncate text cleanly at a word/comma boundary within maxLen
 */
const truncateAtBoundary = (text, maxLen = 140) => {
  if (!text) return '';
  const cleaned = String(text).replace(/\s+/g, ' ').trim();
  if (cleaned.length <= maxLen) return cleaned;

  const target = Math.max(10, maxLen - 3);
  const slice = cleaned.slice(0, target);
  const lastComma = slice.lastIndexOf(',');
  const lastSpace = slice.lastIndexOf(' ');

  let cut = target;
  if (lastComma > target * 0.6) {
    cut = lastComma;
  } else if (lastSpace > target * 0.6) {
    cut = lastSpace;
  }

  const result = cleaned.slice(0, cut).trim().replace(/[,;.\s]+$/, '');
  return `${result}...`;
};

/**
 * Dynamically computes typography for student address so it scales
 * and fits gracefully inside the ID card space above the break line.
 */
const getAddressTypography = (len, lineCount) => {
  if (len <= 50 && lineCount <= 2) {
    return { fontSize: '7.0pt', lineHeight: '1.35' };
  }
  if (len <= 80 && lineCount <= 3) {
    return { fontSize: '6.6pt', lineHeight: '1.3' };
  }
  if (len <= 110 && lineCount <= 4) {
    return { fontSize: '6.1pt', lineHeight: '1.25' };
  }
  if (len <= 140) {
    return { fontSize: '5.6pt', lineHeight: '1.2' };
  }
  return { fontSize: '5.2pt', lineHeight: '1.15' };
};

/**
 * Format address into structured lines that dynamically fit the card space.
 * Intelligently packages comma parts and words across lines.
 */
export const formatDynamicAddressLines = (rawAddress, maxTotalChars = 140) => {
  if (!rawAddress) {
    return {
      lines: ['D.No. XX-XX,', 'Komaripalem,', 'Kakinada, Andhra Pradesh.'],
      fullText: 'D.No. XX-XX, Komaripalem, Kakinada, Andhra Pradesh.',
    };
  }

  const fullText = Array.isArray(rawAddress)
    ? rawAddress.filter(Boolean).join(', ')
    : String(rawAddress);

  const cleanText = fullText.replace(/\s+/g, ' ').trim();
  if (!cleanText) {
    return {
      lines: ['D.No. XX-XX,', 'Komaripalem,', 'Kakinada, Andhra Pradesh.'],
      fullText: '',
    };
  }

  const limitedText = truncateAtBoundary(cleanText, maxTotalChars);

  // Line length budget scales slightly with total text length
  const maxLineLen = limitedText.length > 90 ? 28 : (limitedText.length > 60 ? 25 : 22);
  const maxAllowedLines = 6;

  const commaParts = limitedText
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean);

  const lines = [];

  if (commaParts.length >= 2) {
    let current = '';
    for (let i = 0; i < commaParts.length; i++) {
      const part = commaParts[i];
      const isLastPart = i === commaParts.length - 1;
      const partWithComma =
        isLastPart || part.endsWith('.') || part.endsWith('...')
          ? part
          : `${part},`;

      if (!current) {
        current = partWithComma;
      } else if ((current + ' ' + partWithComma).length <= maxLineLen) {
        current = `${current} ${partWithComma}`;
      } else {
        lines.push(current);
        current = partWithComma;
        if (lines.length === maxAllowedLines - 1) {
          const remaining = commaParts.slice(i).join(', ');
          current = truncateAtBoundary(remaining, maxLineLen + 6);
          break;
        }
      }
    }
    if (current && lines.length < maxAllowedLines) {
      lines.push(current);
    }
  } else {
    const words = limitedText.split(' ').filter(Boolean);
    let current = '';
    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      if (!current) {
        current = word;
      } else if ((current + ' ' + word).length <= maxLineLen) {
        current = `${current} ${word}`;
      } else {
        lines.push(current);
        current = word;
        if (lines.length === maxAllowedLines - 1) {
          const remaining = words.slice(i).join(' ');
          current = truncateAtBoundary(remaining, maxLineLen + 6);
          break;
        }
      }
    }
    if (current && lines.length < maxAllowedLines) {
      lines.push(current);
    }
  }

  return {
    lines: lines.length > 0 ? lines.slice(0, maxAllowedLines) : [cleanText],
    fullText: cleanText,
  };
};

export const formatAddressLines = (raw, maxChars) => formatDynamicAddressLines(raw, maxChars).lines;

/**
 * Reusable Digital Student ID Card - Back Side
 * Standard CR80 Dimensions: 54mm × 85.6mm
 */
const DigitalIdCardBack = ({
  college,
  student,
  getStudentData,
  className = '',
  rotate180 = false,
}) => {
  const studObj = student || {};

  const fromStudentDataJson = (key, fallback = '') => {
    if (!studObj.student_data || typeof studObj.student_data !== 'object')
      return fallback;
    const sd = studObj.student_data;
    const val = sd[key];
    if (val !== undefined && val !== null && String(val).trim() !== '')
      return String(val);
    const foundKey = Object.keys(sd).find(
      (k) => k.toLowerCase() === String(key).toLowerCase()
    );
    if (foundKey && sd[foundKey] != null && String(sd[foundKey]).trim() !== '') {
      return String(sd[foundKey]);
    }
    return fallback;
  };

  const get = (key, fallback = '') => {
    if (!studObj) return fallback;
    const v = studObj[key];
    if (v !== undefined && v !== null && v !== '') return String(v);
    if (typeof getStudentData === 'function') {
      const fromHelper = getStudentData(key, fallback);
      if (fromHelper && fromHelper !== fallback) return fromHelper;
    }
    return fromStudentDataJson(key, fallback);
  };

  // Resolve College Object
  const collegeDetails = resolveCollegeDetails(college, studObj);
  const collegeName = collegeDetails.name;
  const collegeAddress = collegeDetails.address;
  const collegeContact = collegeDetails.contact;
  const website = collegeDetails.website;
  const websiteFontSize = getWebsiteFontSize(website);

  // Resolve Student Personal Details
  const rawDob =
    studObj.dateOfBirth ||
    studObj.dob ||
    get('date_of_birth') ||
    get('dob') ||
    '';

  const dateOfBirth = formatDobDdMmYyyy(rawDob);

  const parentGuardian =
    studObj.parentGuardian ||
    studObj.father_name ||
    studObj.parent_name ||
    get('father_name') ||
    get('parent_name') ||
    'Mr. XXXXX';

  const emergencyContact =
    studObj.emergencyContact ||
    studObj.parent_mobile1 ||
    studObj.student_mobile ||
    get('parent_mobile1') ||
    get('student_mobile') ||
    '9XXXXXXXXX';

  const rawAddress =
    studObj.address ||
    studObj.student_address ||
    get('student_address') ||
    get('Student Address') ||
    get('address') ||
    null;

  const { lines: addressLines, fullText: addressFullText } =
    formatDynamicAddressLines(rawAddress);

  const addressTypography = getAddressTypography(
    addressFullText.length,
    addressLines.length
  );

  return (
    <div
      className={`id-card-print-root id-card-back relative flex flex-col bg-white overflow-hidden text-gray-900 select-none transition-transform duration-300 ${
        rotate180 ? 'rotate-180 rotate-back-180' : ''
      } ${className}`}
      style={{
        width: '54mm',
        height: '85.6mm',
        boxSizing: 'border-box',
        position: 'relative',
        background: '#ffffff',
        border: '1px solid #e5e7eb',
        borderRadius: '12px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
        fontFamily: "'Plus Jakarta Sans', 'Inter', sans-serif",
        printColorAdjust: 'exact',
        WebkitPrintColorAdjust: 'exact',
      }}
    >
      {/* 1. TOP HEADER WAVE WITH DUAL ACCENT RIBBON */}
      <BackTopWaveSVG />

      {/* 2. DETAILS CONTENT — fills full height between waves */}
      <div
        className="absolute z-10 flex flex-col"
        style={{
          left: '50%',
          transform: 'translateX(-50%)',
          width: '45.6mm',
          top: '15.5mm',
          bottom: '13.5mm',         /* just above the bottom wave */
          fontSize: '7.0pt',
          lineHeight: '1.42',
          justifyContent: 'space-around',
        }}
      >
        {/* ── Upper block: personal details ── */}
        <div>
          {/* Date of Birth */}
          <div className="grid grid-cols-[23.5mm_1.8mm_1fr] items-center mb-[1.8mm]">
            <span className="font-extrabold text-[#000000] whitespace-nowrap text-[6.8pt]">Date of Birth</span>
            <span className="font-extrabold text-[#000000] text-center text-[6.8pt]">:</span>
            <span className="font-extrabold text-[#000000] text-[7.3pt]">{dateOfBirth}</span>
          </div>

          {/* Parent/Guardian */}
          <div className="grid grid-cols-[23.5mm_1.8mm_1fr] items-start mb-[1.8mm]">
            <span className="font-extrabold text-[#000000] whitespace-nowrap text-[6.8pt]">Parent/Guardian</span>
            <span className="font-extrabold text-[#000000] text-center text-[6.8pt]">:</span>
            <span
              className="font-extrabold text-[#000000] text-[7.3pt] leading-tight line-clamp-2"
              title={parentGuardian}
            >
              {parentGuardian}
            </span>
          </div>

          {/* Emergency Contact */}
          <div className="grid grid-cols-[23.5mm_1.8mm_1fr] items-center mb-[1.8mm]">
            <span className="font-extrabold text-[#000000] whitespace-nowrap text-[6.8pt]">Emergency Contact</span>
            <span className="font-extrabold text-[#000000] text-center text-[6.8pt]">:</span>
            <span className="font-extrabold text-[#000000] text-[7.3pt] font-mono">{emergencyContact}</span>
          </div>

          {/* Student Address — dynamically scaled to fit card space up to break line */}
          <div className="grid grid-cols-[23.5mm_1.8mm_1fr] items-start mb-[3.2mm]">
            <span className="font-extrabold text-[#000000] whitespace-nowrap text-[6.8pt]">Student Address</span>
            <span className="font-extrabold text-[#000000] text-center text-[6.8pt]">:</span>
            <div
              className="flex flex-col text-[#000000] font-extrabold"
              style={{
                fontSize: addressTypography.fontSize,
                lineHeight: addressTypography.lineHeight,
                maxHeight: '22mm',
                overflow: 'hidden',
                wordBreak: 'break-word',
              }}
              title={addressFullText || undefined}
            >
              {addressLines.map((line, idx) => (
                <span
                  key={idx}
                  className="block"
                  style={{
                    lineHeight: addressTypography.lineHeight,
                    wordBreak: 'break-word',
                  }}
                >
                  {line}
                </span>
              ))}
            </div>
          </div>

        </div>

        {/* ── Lower block: separator + return info ── */}
        <div>
          {/* Separator Line */}
          <div className="w-full h-[0.5px] bg-[#CBD5E1] mt-[1.5mm] mb-[2.2mm]" />

          {/* Return Information */}
          <div className="flex flex-col gap-[1mm]">
            <span className="text-[#64748B] font-semibold text-[5.8pt]">
              If found, please return to:
            </span>
            <h3 className="text-[#111827] font-extrabold text-[8.5pt] leading-tight m-0 line-clamp-2">
              {collegeName}
            </h3>
            <span className="text-[#334155] font-medium text-[6.0pt] leading-tight line-clamp-2">
              {collegeAddress}
            </span>
            {collegeContact ? (
              <span className="text-[#334155] font-medium text-[6.0pt]">
                College Contact: {collegeContact}
              </span>
            ) : null}
          </div>
        </div>
      </div>


      {/* 3. BOTTOM RED WAVE WITH ACCENT RIBBON */}
      <BackBottomWaveSVG />

      {/* 4. DYNAMIC WEBSITE IN FOOTER WAVE */}
      {website ? (
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: '2.2mm',
            zIndex: 10,
            textAlign: 'center',
            padding: '0 2mm',
          }}
        >
          <span
            style={{
              display: 'block',
              color: '#ffffff',
              fontWeight: 700,
              fontSize: websiteFontSize,
              lineHeight: '1',
              letterSpacing: '0.01em',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'clip',
            }}
          >
            {website}
          </span>
        </div>
      ) : null}
    </div>
  );
};

export default DigitalIdCardBack;
