import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import {
  Upload,
  Save,
  ArrowLeft,
  Building2,
  Type,
  Sparkles,
  Sliders,
  CheckCircle,
  Eye,
  AlignCenter,
  AlignLeft,
  AlignRight,
  FileText,
  Check,
  X,
  RotateCcw,
} from 'lucide-react';
import api from '../../config/api';

const CollegeConfiguration = () => {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [colleges, setColleges] = useState([]);
  const [selectedCollege, setSelectedCollege] = useState(null);

  // Dynamic Header States
  const [headerContent, setHeaderContent] = useState('');
  const [headerHeight, setHeaderHeight] = useState(85);
  const [fontFamily, setFontFamily] = useState('Calibri');
  const [activePreset, setActivePreset] = useState('standard');

  // Principal Signature
  const [signatureImage, setSignatureImage] = useState(null);
  const [signaturePreview, setSignaturePreview] = useState(null);
  const [removeSignature, setRemoveSignature] = useState(false);

  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchColleges();
  }, []);

  const fetchColleges = async () => {
    try {
      setLoading(true);
      const response = await api.get('/colleges');
      setColleges(response.data.data || []);
    } catch (error) {
      console.error(error);
      toast.error('Failed to load colleges');
    } finally {
      setLoading(false);
    }
  };

  const generateDefaultHeader = (college, preset = 'standard') => {
    const colName = (college?.name || 'PYDAH COLLEGE OF ENGINEERING').toUpperCase();
    const addr = college?.address || 'Kakinada - 533001, Andhra Pradesh, India';
    const phone = college?.contact || '+91 884 237 9999';
    const web = college?.website || 'www.pydah.edu.in';

    switch (preset) {
      case 'autonomous':
        return `[center][b][size:17]${colName}[/size][/b][/center]
[center][size:10]AN AUTONOMOUS INSTITUTION • ESTD. 1993[/size][/center]
[center][size:9](Approved by AICTE, Affiliated to Andhra University, Accredited by NAAC 'A+' Grade)[/size][/center]
[center][size:8.5]${addr} | Phone: ${phone} | Web: ${web}[/size][/center]
----------------------------------------`;

      case 'formal':
        return `[center][b][size:16]${colName}[/size][/b][/center]
[center][size:10]DEPARTMENT OF ACADEMIC AFFAIRS & CERTIFICATION[/size][/center]
[center][size:9]Accredited by National Board of Accreditation (NBA) & NAAC[/size][/center]
[center][size:8.5]Administrative Office: ${addr} | Email: principal@pydah.edu.in[/size][/center]
----------------------------------------`;

      case 'minimal':
        return `[center][b][size:18]${colName}[/size][/b][/center]
[center][size:9.5]${addr} • ${web}[/size][/center]
----------------------------------------`;

      case 'standard':
      default:
        return `[center][b][size:16]${colName}[/size][/b][/center]
[center][size:10](Approved by AICTE, Affiliated to Andhra University, Accredited by NAAC 'A+' Grade)[/size][/center]
[center][size:9]${addr} | Phone: ${phone} | Website: ${web}[/size][/center]
----------------------------------------`;
    }
  };

  const handleCollegeSelect = (collegeId) => {
    const college = colleges.find((c) => String(c.id) === String(collegeId));
    setSelectedCollege(college);

    if (!college) {
      setHeaderContent('');
      return;
    }

    // Load existing metadata dynamic header if present
    const meta = college.metadata || {};
    const existingHeader = meta.header_content;
    const existingConfig = meta.header_config || {};

    if (existingHeader && existingHeader.trim()) {
      setHeaderContent(existingHeader);
      setHeaderHeight(existingConfig.header_height || 85);
      setFontFamily(existingConfig.font_family || 'Calibri');
      setActivePreset(existingConfig.preset || 'custom');
    } else {
      const defHeader = generateDefaultHeader(college, 'standard');
      setHeaderContent(defHeader);
      setHeaderHeight(85);
      setFontFamily('Calibri');
      setActivePreset('standard');
    }

    // Signature
    const baseURL = (api.defaults.baseURL || 'http://localhost:5000/api').replace('/api', '');
    if (college.principal_signature_url) {
      setSignaturePreview(`${baseURL}${college.principal_signature_url}`);
    } else {
      setSignaturePreview(null);
    }
    setSignatureImage(null);
    setRemoveSignature(false);
  };

  const applyPreset = (presetKey) => {
    if (!selectedCollege) return;
    setActivePreset(presetKey);
    const newContent = generateDefaultHeader(selectedCollege, presetKey);
    setHeaderContent(newContent);
  };

  const insertTagAtCursor = (prefix, suffix = '') => {
    setHeaderContent((prev) => `${prev}\n${prefix}${suffix}`);
  };

  const handleSignatureUpload = (file) => {
    if (!file) return;
    setSignatureImage(file);
    setSignaturePreview(URL.createObjectURL(file));
    setRemoveSignature(false);
  };

  const handleSave = async () => {
    if (!selectedCollege) {
      toast.error('Please select a college');
      return;
    }

    try {
      setSaving(true);
      const toastId = toast.loading('Saving college header configuration...');

      // 1. Prepare updated metadata with dynamic header content
      const existingMeta = selectedCollege.metadata || {};
      const updatedMetadata = {
        ...existingMeta,
        header_content: headerContent,
        header_config: {
          header_height: headerHeight,
          font_family: fontFamily,
          preset: activePreset,
          updated_at: new Date().toISOString(),
        },
      };

      // 2. Save college metadata
      await api.put(`/colleges/${selectedCollege.id}`, {
        metadata: updatedMetadata,
      });

      // 3. Upload or remove signature if changed
      if (signatureImage) {
        const formData = new FormData();
        formData.append('signature', signatureImage);
        await api.post(`/colleges/${selectedCollege.id}/upload-principal-signature`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      } else if (removeSignature) {
        await api.delete(`/colleges/${selectedCollege.id}/principal-signature`);
      }

      toast.dismiss(toastId);
      toast.success('Dynamic college header saved successfully!');

      // Refresh colleges
      await fetchColleges();
    } catch (error) {
      console.error(error);
      toast.error('Failed to save configuration');
    } finally {
      setSaving(false);
    }
  };

  // Helper to render live preview of the header
  const renderHeaderPreview = () => {
    if (!headerContent) return null;

    const lines = headerContent.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
    return (
      <div
        className="w-full flex flex-col justify-center px-4"
        style={{
          fontFamily: fontFamily || 'Calibri, sans-serif',
          minHeight: `${headerHeight}px`,
        }}
      >
        {lines.map((line, idx) => {
          let text = line.trim();
          if (!text) return <div key={idx} className="h-2" />;

          // Divider rule
          if (/^[-=_*]{3,}$/.test(text)) {
            return (
              <div key={idx} className="my-1.5 border-b-2 border-blue-900 w-full" />
            );
          }

          let align = 'center';
          const alignMatch = text.match(/^\s*\[(left|center|right|justify)\]([\s\S]*?)\[\/\1\]\s*$/i);
          if (alignMatch) {
            align = alignMatch[1].toLowerCase();
            text = alignMatch[2];
          }

          let isBold = false;
          const boldMatch = text.match(/\[(b|bold)\]([\s\S]*?)\[\/\1\]/i);
          if (boldMatch) {
            isBold = true;
            text = boldMatch[2];
          }

          let size = 11;
          const sizeMatch = text.match(/\[size:(\d+(?:\.\d+)?)\]([\s\S]*?)\[\/size\]/i);
          if (sizeMatch) {
            size = parseFloat(sizeMatch[1]);
            text = sizeMatch[2];
          }

          return (
            <div
              key={idx}
              style={{
                textAlign: align,
                fontSize: `${size}px`,
                fontWeight: isBold ? 700 : 400,
                color: isBold ? '#0f2942' : '#334155',
                lineHeight: 1.35,
              }}
            >
              {text}
            </div>
          );
        })}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading colleges...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6 animate-fade-in font-sans">
      {/* Header Bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/services/config')}
            className="p-2 hover:bg-gray-100 rounded-lg transition"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Building2 size={26} className="text-[#185abd]" />
              College Configuration
            </h1>
            <p className="text-gray-500 text-sm">
              Dynamically design official letterhead headers for certificates (No photo uploads required)
            </p>
          </div>
        </div>
      </div>

      {/* College Selection */}
      <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-200">
        <label className="block text-sm font-bold text-gray-800 mb-2">
          Select College <span className="text-red-500">*</span>
        </label>
        <select
          className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-base bg-white"
          value={selectedCollege?.id || ''}
          onChange={(e) => handleCollegeSelect(e.target.value)}
        >
          <option value="">-- Choose a college to design header --</option>
          {colleges.map((college) => (
            <option key={college.id} value={college.id}>
              {college.name}
            </option>
          ))}
        </select>
      </div>

      {selectedCollege && (
        <div className="space-y-6">
          {/* Dynamic College Header Designer Card */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
            {/* Card Header with Word Branding */}
            <div className="bg-[#185abd] text-white px-5 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-6 h-6 bg-white rounded flex items-center justify-center shadow-xs">
                  <span className="text-[#185abd] font-black text-sm">W</span>
                </div>
                <div>
                  <h2 className="text-sm font-bold tracking-wide">
                    Dynamic College Header Designer
                  </h2>
                  <p className="text-[11px] text-blue-100">
                    Microsoft Word Replica • Pure vector typography & formatting
                  </p>
                </div>
              </div>
              <span className="px-2.5 py-0.5 bg-blue-700/60 rounded-full text-xs text-blue-100 font-medium">
                Photo Upload Free
              </span>
            </div>

            <div className="p-6 space-y-5">
              {/* Presets Row */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Sparkles size={14} className="text-amber-500" /> Header Style Presets
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {[
                    { id: 'standard', label: '🎓 University Standard', desc: 'AICTE & NAAC Accredited' },
                    { id: 'autonomous', label: '🏛️ Autonomous Institute', desc: 'UGC & Autonomous tag' },
                    { id: 'formal', label: '📜 Classical Formal', desc: 'Exams & Certifications' },
                    { id: 'minimal', label: '⚡ Clean Minimalist', desc: 'Simple & Elegant' },
                  ].map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => applyPreset(preset.id)}
                      className={`p-2.5 rounded-xl border text-left transition ${
                        activePreset === preset.id
                          ? 'border-blue-600 bg-blue-50/80 text-blue-900 shadow-xs'
                          : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-800'
                      }`}
                    >
                      <div className="text-xs font-bold">{preset.label}</div>
                      <div className="text-[10px] text-slate-500 mt-0.5">{preset.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Toolbar Controls */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex flex-wrap items-center gap-3 text-xs">
                {/* Font Family */}
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-bold text-slate-600">Font:</span>
                  <select
                    value={fontFamily}
                    onChange={(e) => setFontFamily(e.target.value)}
                    className="h-7 px-2 border border-slate-300 rounded bg-white text-xs font-semibold outline-none cursor-pointer"
                  >
                    <option value="Calibri">Calibri</option>
                    <option value="Arial">Arial</option>
                    <option value="'Times New Roman', serif">Times New Roman</option>
                    <option value="Georgia, serif">Georgia</option>
                  </select>
                </div>

                {/* Header Height */}
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-bold text-slate-600">Height:</span>
                  <div className="flex items-center border border-slate-300 rounded bg-white h-7 px-2">
                    <input
                      type="number"
                      min="50"
                      max="150"
                      value={headerHeight}
                      onChange={(e) => setHeaderHeight(parseInt(e.target.value) || 85)}
                      className="w-8 text-center text-xs font-bold outline-none"
                    />
                    <span className="text-[10px] text-slate-400">px</span>
                  </div>
                </div>

                {/* Quick Insert Tags */}
                <div className="flex items-center gap-1.5 ml-auto flex-wrap">
                  <button
                    type="button"
                    onClick={() => insertTagAtCursor('[center][b][size:16]COLLEGE NAME[/size][/b][/center]')}
                    className="px-2 py-1 bg-white border border-slate-300 rounded hover:bg-slate-100 text-[11px] font-semibold text-slate-700"
                  >
                    + Main Title
                  </button>
                  <button
                    type="button"
                    onClick={() => insertTagAtCursor("[center][size:10](Affiliated to University, NAAC 'A+' Grade)[/size][/center]")}
                    className="px-2 py-1 bg-white border border-slate-300 rounded hover:bg-slate-100 text-[11px] font-semibold text-slate-700"
                  >
                    + Affiliation
                  </button>
                  <button
                    type="button"
                    onClick={() => insertTagAtCursor('----------------------------------------')}
                    className="px-2 py-1 bg-white border border-slate-300 rounded hover:bg-slate-100 text-[11px] font-bold text-blue-700"
                  >
                    + Divider Line (---)
                  </button>
                </div>
              </div>

              {/* Dynamic Header Editor Textarea */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <label className="block text-xs font-bold text-slate-800 uppercase tracking-wide">
                    Header Lines & Formatting Code
                  </label>
                  <span className="text-[11px] text-slate-500">
                    Supports <code className="bg-slate-100 px-1 rounded">[b]...[/b]</code>, <code className="bg-slate-100 px-1 rounded">[size:16]...[/size]</code>, <code className="bg-slate-100 px-1 rounded">[center]...[/center]</code>, and <code className="bg-slate-100 px-1 rounded">---</code>
                  </span>
                </div>
                <textarea
                  rows={5}
                  value={headerContent}
                  onChange={(e) => setHeaderContent(e.target.value)}
                  className="w-full p-3 font-mono text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none leading-relaxed bg-white"
                  placeholder="Type header text here with formatting tags..."
                />
              </div>

              {/* Live A4 Paper Header Preview */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
                    <Eye size={14} className="text-emerald-600" /> Live Certificate Header Preview
                  </span>
                  <span className="text-[11px] text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                    ✓ Rendered Live
                  </span>
                </div>

                {/* Simulated A4 Paper Header Top */}
                <div className="bg-[#eaedf1] p-4 rounded-xl border border-slate-300 flex justify-center">
                  <div
                    className="bg-white border border-slate-300 shadow-md w-full max-w-2xl py-3 rounded-xs transition-all"
                    style={{ minHeight: `${headerHeight}px` }}
                  >
                    {renderHeaderPreview()}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Principal Signature Card */}
          <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-gray-900">Principal Signature</h3>
                <p className="text-xs text-gray-500">
                  Upload official signature image for certificates
                </p>
              </div>
            </div>

            {signaturePreview ? (
              <div className="relative flex items-center justify-center p-4 bg-gray-50 rounded-xl border border-slate-200">
                <img
                  src={signaturePreview}
                  alt="Principal Signature"
                  className="max-h-24 max-w-xs object-contain"
                />
                <button
                  type="button"
                  onClick={() => {
                    setSignatureImage(null);
                    setSignaturePreview(null);
                    setRemoveSignature(true);
                  }}
                  className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-full hover:bg-red-600 shadow-md"
                  title="Remove signature"
                >
                  <X size={16} />
                </button>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center w-full h-28 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer hover:border-blue-500 transition bg-gray-50">
                <Upload className="text-gray-400 mb-1.5" size={26} />
                <span className="text-xs text-gray-600 font-medium">
                  Click to upload principal signature image
                </span>
                <span className="text-[10px] text-gray-400 mt-0.5">
                  PNG, JPG, WEBP with transparent or white background
                </span>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && handleSignatureUpload(e.target.files[0])}
                />
              </label>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex justify-between items-center bg-white p-4 rounded-2xl border border-gray-200 shadow-sm">
            <button
              type="button"
              onClick={() => navigate('/services/config')}
              className="px-5 py-2.5 border border-gray-300 rounded-xl hover:bg-gray-50 font-medium text-sm text-gray-700"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="px-6 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 flex items-center gap-2 font-bold text-sm shadow-md shadow-blue-200 disabled:opacity-50"
            >
              <Save size={16} />
              {saving ? 'Saving...' : 'Save Configuration'}
            </button>
          </div>
        </div>
      )}

      {!selectedCollege && (
        <div className="bg-white p-12 rounded-2xl border-2 border-dashed border-gray-300 text-center shadow-xs">
          <Building2 size={48} className="text-blue-500 mx-auto mb-3 opacity-60" />
          <h3 className="text-lg font-bold text-gray-800">Select a College to Configure</h3>
          <p className="text-gray-500 text-sm mt-1">
            Choose a college from the dropdown above to design its dynamic certificate letterhead header.
          </p>
        </div>
      )}
    </div>
  );
};

export default CollegeConfiguration;
