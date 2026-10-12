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
 * Clean up raw address text
 */
const cleanAddressString = (raw) => {
  if (!raw) return '';
  const text = Array.isArray(raw)
    ? raw.filter(Boolean).join(', ')
    : String(raw);

  return text
    .replace(/\s+/g, ' ')
    .replace(/\s*,\s*/g, ', ')
    .trim()
    .replace(/[,;.\s]+$/, '');
};

/**
 * Truncate text cleanly at a word/comma boundary within maxLen
 */
export const truncateAddress = (rawAddress, maxLen = 175) => {
  const cleaned = cleanAddressString(rawAddress);
  if (!cleaned) return 'D.No. XX-XX, Komaripalem, Kakinada, A.P.';
  if (cleaned.length <= maxLen) return cleaned;

  const target = Math.max(10, maxLen - 3);
  const slice = cleaned.slice(0, target);
  const lastComma = slice.lastIndexOf(',');
  const lastSpace = slice.lastIndexOf(' ');

  let cut = target;
  if (lastComma > target * 0.55) {
    cut = lastComma;
  } else if (lastSpace > target * 0.55) {
    cut = lastSpace;
  }

  const result = cleaned.slice(0, cut).trim().replace(/[,;.\s]+$/, '');
  return `${result}...`;
};

/**
 * Backwards compatible address helpers
 */
export const formatDynamicAddressLines = (rawAddress, maxTotalChars = 175) => {
  const fullText = cleanAddressString(rawAddress) || 'D.No. XX-XX, Komaripalem, Kakinada, A.P.';
  const truncatedText = truncateAddress(fullText, maxTotalChars);
  return {
    lines: [truncatedText],
    fullText,
    truncatedText,
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

  const addressFullText = cleanAddressString(rawAddress) || 'D.No. XX-XX, Komaripalem, Kakinada, A.P.';
  const displayAddress = truncateAddress(addressFullText, 175);
  const addressFontSize = addressFullText.length > 80 ? '5.7pt' : '6.0pt';
  const addressLineHeight = '1.22';

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

      {/* 2. DETAILS CONTENT — fills height between waves */}
      <div
        className="absolute z-10 flex flex-col justify-between"
        style={{
          left: '50%',
          transform: 'translateX(-50%)',
          width: '46.6mm',
          top: '15.0mm',
          bottom: '13.0mm',
          boxSizing: 'border-box',
        }}
      >
        {/* ── Upper block: personal details in a unified grid for perfect colon alignment ── */}
        <div
          className="w-full"
          style={{
            display: 'grid',
            gridTemplateColumns: '24.0mm 2.0mm 1fr',
            rowGap: '1.8mm',
            alignItems: 'start',
          }}
        >
          {/* Date of Birth */}
          <span className="font-extrabold text-[#000000] whitespace-nowrap text-[6.5pt] leading-[1.3]">
            Date of Birth
          </span>
          <span className="font-extrabold text-[#000000] text-center text-[6.5pt] leading-[1.3] select-none">
            :
          </span>
          <span className="font-extrabold text-[#000000] text-[7.0pt] leading-[1.3]">
            {dateOfBirth}
          </span>

          {/* Parent/Guardian */}
          <span className="font-extrabold text-[#000000] whitespace-nowrap text-[6.5pt] leading-[1.3]">
            Parent/Guardian
          </span>
          <span className="font-extrabold text-[#000000] text-center text-[6.5pt] leading-[1.3] select-none">
            :
          </span>
          <span
            className="font-extrabold text-[#000000] text-[7.0pt] leading-[1.3] line-clamp-2"
            title={parentGuardian}
          >
            {parentGuardian}
          </span>

          {/* Emergency Contact */}
          <span className="font-extrabold text-[#000000] whitespace-nowrap text-[6.5pt] leading-[1.3]">
            Emergency Contact
          </span>
          <span className="font-extrabold text-[#000000] text-center text-[6.5pt] leading-[1.3] select-none">
            :
          </span>
          <span className="font-extrabold text-[#000000] text-[7.0pt] leading-[1.3] font-mono tracking-tight">
            {emergencyContact}
          </span>

          {/* Student Address */}
          <span className="font-extrabold text-[#000000] whitespace-nowrap text-[6.5pt] leading-[1.3]">
            Student Address
          </span>
          <span className="font-extrabold text-[#000000] text-center text-[6.5pt] leading-[1.3] select-none">
            :
          </span>
          <div
            className="font-extrabold text-[#000000]"
            style={{
              fontSize: addressFontSize,
              lineHeight: addressLineHeight,
              display: '-webkit-box',
              WebkitLineClamp: 6,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              wordBreak: 'break-word',
              minWidth: 0,
            }}
            title={addressFullText || undefined}
          >
            {displayAddress}
          </div>
        </div>

        {/* ── Lower block: separator + return info (sticky to the bottom right above the red wave) ── */}
        <div className="w-full flex flex-col">
          {/* Separator Line */}
          <div className="w-full h-[0.5px] bg-[#CBD5E1] mb-[2.0mm]" />

          {/* Return Information */}
          <div className="flex flex-col gap-[0.8mm]">
            <span className="text-[#64748B] font-semibold text-[5.8pt] leading-tight">
              If found, please return to:
            </span>
            <h3 className="text-[#111827] font-extrabold text-[8.2pt] leading-tight m-0 line-clamp-2">
              {collegeName}
            </h3>
            <span className="text-[#334155] font-medium text-[5.8pt] leading-tight line-clamp-2">
              {collegeAddress}
            </span>
            {collegeContact ? (
              <span className="text-[#334155] font-semibold text-[5.8pt] leading-tight">
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
