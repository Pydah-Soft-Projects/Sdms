import React, { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "react-hot-toast";
import { Mention, MentionsInput } from "react-mentions";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  FileText,
  Eye,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  Type,
  Space,
  RotateCcw,
  RotateCw,
  Search,
  Columns,
  Maximize2,
  ZoomIn,
  ZoomOut,
  ChevronDown,
  Copy,
  Scissors,
  Layout,
  Sliders,
  CheckCircle,
  HelpCircle,
  Sparkles,
  Printer,
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Subscript,
  Superscript,
  List,
  ListOrdered,
  Indent,
  Outdent,
  Palette,
  Highlighter,
  Eraser,
  Clipboard,
  Minus,
  Plus,
  Trash2,
  X,
  Building2,
  Image,
  Table,
} from "lucide-react";
import { serviceService } from "../../services/serviceService";
import { certificateTemplateService } from "../../services/certificateTemplateService";
import CertificateDesigner from "./CertificateDesigner";
import api from "../../config/api";

// Default System Variables with specific fixed display lengths
const DEFAULT_SYSTEM_VARIABLES = [
  { name: "student_name", label: "Student Name", fixedChars: 24, minWidth: 150, example: "JOHN DOE" },
  { name: "name", label: "Name", fixedChars: 24, minWidth: 150, example: "JOHN DOE" },
  { name: "father_name", label: "Father Name", fixedChars: 22, minWidth: 140, example: "ROBERT DOE" },
  { name: "mother_name", label: "Mother Name", fixedChars: 22, minWidth: 140, example: "MARY DOE" },
  { name: "guardian_name", label: "Guardian Name", fixedChars: 22, minWidth: 140, example: "GUARDIAN NAME" },
  { name: "dob", label: "Date of Birth", fixedChars: 10, minWidth: 75, example: "01/01/2000" },
  { name: "date_of_birth", label: "Date of Birth", fixedChars: 10, minWidth: 75, example: "01/01/2000" },
  { name: "admission_number", label: "Admission Number", fixedChars: 12, minWidth: 90, example: "2024001" },
  { name: "pin_no", label: "PIN Number", fixedChars: 12, minWidth: 90, example: "21A91A0501" },
  { name: "ht_no", label: "HT Number", fixedChars: 12, minWidth: 90, example: "21A91A0501" },
  { name: "course", label: "Course", fixedChars: 10, minWidth: 70, example: "B.Tech" },
  { name: "branch", label: "Branch", fixedChars: 22, minWidth: 140, example: "Computer Science" },
  { name: "current_year", label: "Current Year", fixedChars: 4, minWidth: 40, example: "IV" },
  { name: "year", label: "Year", fixedChars: 4, minWidth: 40, example: "IV" },
  { name: "current_semester", label: "Current Semester", fixedChars: 4, minWidth: 40, example: "I" },
  { name: "semester", label: "Semester", fixedChars: 4, minWidth: 40, example: "I" },
  { name: "academic_year", label: "Academic Year", fixedChars: 11, minWidth: 85, example: "2024-2025" },
  { name: "admission_date", label: "Admission Date", fixedChars: 10, minWidth: 75, example: "01/08/2021" },
  { name: "principal_signature", label: "Principal Signature", fixedChars: 20, minWidth: 140, example: "Principal Signature" },
  { name: "date", label: "Current Date", fixedChars: 10, minWidth: 75, example: new Date().toLocaleDateString() },
  { name: "current_date", label: "Current Date", fixedChars: 10, minWidth: 75, example: new Date().toLocaleDateString() },
  { name: "college_name", label: "College Name", fixedChars: 30, minWidth: 180, example: "Pydah College of Engineering" },
  { name: "gender", label: "Gender", fixedChars: 6, minWidth: 50, example: "Male" },
  { name: "caste", label: "Caste", fixedChars: 6, minWidth: 50, example: "OC" },
  { name: "religion", label: "Religion", fixedChars: 8, minWidth: 60, example: "Hindu" },
  { name: "student_mobile", label: "Student Mobile", fixedChars: 10, minWidth: 80, example: "9876543210" },
  { name: "phone_number", label: "Phone Number", fixedChars: 10, minWidth: 80, example: "9876543210" },
];

const VARIABLE_SPECS = DEFAULT_SYSTEM_VARIABLES.reduce((acc, v) => {
  acc[v.name] = v;
  return acc;
}, {});

const AddServiceWizard = () => {
  const navigate = useNavigate();
  const { id: editServiceId } = useParams(); // For edit mode
  const [currentStep, setCurrentStep] = useState(1);
  const [colleges, setColleges] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [dataLoaded, setDataLoaded] = useState(false);

  // Microsoft Word Replica States
  const [activeRibbonTab, setActiveRibbonTab] = useState("home"); // home, insert, layout, view
  const [viewMode, setViewMode] = useState("word-canvas"); // word-canvas, split, preview
  const [editingSection, setEditingSection] = useState("body"); // 'body' or 'header'
  const [showRuler, setShowRuler] = useState(true);
  const [zoomLevel, setZoomLevel] = useState(100);
  const [showVariableDropdown, setShowVariableDropdown] = useState(false);
  const [variableSearchQuery, setVariableSearchQuery] = useState("");
  const [showFontColorDropdown, setShowFontColorDropdown] = useState(false);
  const [showHighlightDropdown, setShowHighlightDropdown] = useState(false);
  const [showCaseDropdown, setShowCaseDropdown] = useState(false);
  const [showTableDropdown, setShowTableDropdown] = useState(false);
  const [tableRows, setTableRows] = useState(3);
  const [tableCols, setTableCols] = useState(3);
  const [hoverRows, setHoverRows] = useState(3);
  const [hoverCols, setHoverCols] = useState(3);
  const [undoStack, setUndoStack] = useState([]);
  const [redoStack, setRedoStack] = useState([]);

  const contentInputRef = React.useRef(null);
  const contentEditableRef = React.useRef(null);
  const headerInputRef = React.useRef(null);
  const [activeCursorPos, setActiveCursorPos] = useState({ start: 0, end: 0 });
  const [activeHeaderCursorPos, setActiveHeaderCursorPos] = useState({ start: 0, end: 0 });
  const lastValidSelectionRef = React.useRef({ start: 0, end: 0, field: "middle_content", section: "body" });
  const [currentAlign, setCurrentAlign] = useState("left");
  const savedRangeRef = React.useRef(null);
  const [activeFontFamily, setActiveFontFamily] = useState("Calibri");
  const [activeFontSize, setActiveFontSize] = useState(12);
  const [activeBold, setActiveBold] = useState(false);
  const [activeItalic, setActiveItalic] = useState(false);
  const [activeUnderline, setActiveUnderline] = useState(false);
  const [activeStrike, setActiveStrike] = useState(false);
  const [isInsideTable, setIsInsideTable] = useState(false);

  const saveCurrentRange = () => {
    try {
      const sel = window.getSelection();
      if (
        sel &&
        sel.rangeCount > 0 &&
        contentEditableRef.current &&
        contentEditableRef.current.contains(sel.anchorNode)
      ) {
        savedRangeRef.current = sel.getRangeAt(0).cloneRange();
      }
      updateActiveCommandStates();
    } catch (e) {
      // Ignore
    }
  };

  const normalizeFamily = (f) => {
    if (!f) return "Calibri";
    const clean = f.replace(/['"]/g, "").toLowerCase();
    if (clean.includes("times")) return "'Times New Roman', serif";
    if (clean.includes("georgia")) return "Georgia, serif";
    if (clean.includes("courier")) return "'Courier New', monospace";
    if (clean.includes("tahoma")) return "Tahoma, sans-serif";
    if (clean.includes("verdana")) return "Verdana, sans-serif";
    if (clean.includes("arial")) return "Arial";
    return "Calibri";
  };

  const updateActiveCommandStates = () => {
    try {
      if (document.queryCommandState("justifyCenter")) {
        setCurrentAlign("center");
      } else if (document.queryCommandState("justifyRight")) {
        setCurrentAlign("right");
      } else if (document.queryCommandState("justifyFull")) {
        setCurrentAlign("justify");
      } else {
        setCurrentAlign("left");
      }

      // Check if cursor is inside a table
      const sel = window.getSelection();
      let foundTable = null;
      if (sel && sel.anchorNode && contentEditableRef.current?.contains(sel.anchorNode)) {
        let node = sel.anchorNode;
        while (node && node !== contentEditableRef.current) {
          if (node.tagName === "TABLE" || node.classList?.contains("word-canvas-table")) {
            foundTable = node;
            break;
          }
          node = node.parentNode;
        }
      }
      setIsInsideTable(!!foundTable);

      // Query active font and formatting states from selection (without mutating document defaults)
      if (sel && sel.anchorNode && contentEditableRef.current?.contains(sel.anchorNode)) {
        let node = sel.anchorNode;
        if (node.nodeType === 3) node = node.parentNode;
        if (node && node !== contentEditableRef.current) {
          const comp = window.getComputedStyle(node);
          const rawFamily = comp.fontFamily || "";
          const normFamily = normalizeFamily(rawFamily);
          const rawSize = parseInt(comp.fontSize) || 12;
          const isB = comp.fontWeight === "bold" || parseInt(comp.fontWeight) >= 600 || document.queryCommandState("bold");
          const isI = comp.fontStyle === "italic" || document.queryCommandState("italic");
          const isU = comp.textDecorationLine?.includes("underline") || document.queryCommandState("underline");
          const isS = comp.textDecorationLine?.includes("line-through") || document.queryCommandState("strikeThrough");

          setActiveFontFamily(normFamily);
          setActiveFontSize(rawSize);
          setActiveBold(isB);
          setActiveItalic(isI);
          setActiveUnderline(isU);
          setActiveStrike(isS);
        }
      }
    } catch (e) {
      // Ignore
    }
  };

  const headerImageInputRef = React.useRef(null);

  // Smart active target detector:
  // If editingSection === 'header', targets top_content (the header).
  // Otherwise, ALWAYS targets middle_content (the body), ensuring the header is NEVER touched!
  const getActiveTarget = () => {
    // 1. Check if user is explicitly editing the header
    if (editingSection === "header") {
      const ta = headerInputRef.current;
      let start = activeHeaderCursorPos.start;
      let end = activeHeaderCursorPos.end;

      if (ta && typeof ta.selectionStart === "number" && ta.selectionStart !== ta.selectionEnd) {
        start = ta.selectionStart;
        end = ta.selectionEnd;
      } else if (
        lastValidSelectionRef.current.section === "header" &&
        lastValidSelectionRef.current.start !== lastValidSelectionRef.current.end
      ) {
        start = lastValidSelectionRef.current.start;
        end = lastValidSelectionRef.current.end;
      }

      return {
        field: "top_content",
        textarea: ta,
        start,
        end,
        section: "header",
      };
    }

    // 2. Otherwise user is editing the certificate BODY (middle_content)
    const ta = contentInputRef.current;
    let start = activeCursorPos.start;
    let end = activeCursorPos.end;

    if (ta && typeof ta.selectionStart === "number" && ta.selectionStart !== ta.selectionEnd) {
      start = ta.selectionStart;
      end = ta.selectionEnd;
    } else if (
      lastValidSelectionRef.current.section === "body" &&
      lastValidSelectionRef.current.start !== lastValidSelectionRef.current.end
    ) {
      start = lastValidSelectionRef.current.start;
      end = lastValidSelectionRef.current.end;
    }

    return {
      field: "middle_content",
      textarea: ta,
      start,
      end,
      section: "body",
    };
  };

  const getTargetField = () => getActiveTarget().field;
  const getTargetRef = () => getActiveTarget().textarea;
  const getTargetCursor = () => (getActiveTarget().section === "header" ? activeHeaderCursorPos : activeCursorPos);

  // Sync cursor & selection directly from textarea DOM elements
  useEffect(() => {
    const textarea = contentInputRef.current;
    if (!textarea) return;

    const handleBodySelect = () => {
      setEditingSection("body");
      const s = textarea.selectionStart;
      const e = textarea.selectionEnd;
      setActiveCursorPos({ start: s, end: e });
      if (typeof s === "number" && typeof e === "number" && s !== e) {
        lastValidSelectionRef.current = { start: s, end: e, field: "middle_content", section: "body" };
      }
    };

    textarea.addEventListener("select", handleBodySelect);
    textarea.addEventListener("mouseup", handleBodySelect);
    textarea.addEventListener("keyup", handleBodySelect);
    textarea.addEventListener("focus", handleBodySelect);
    textarea.addEventListener("click", handleBodySelect);

    return () => {
      textarea.removeEventListener("select", handleBodySelect);
      textarea.removeEventListener("mouseup", handleBodySelect);
      textarea.removeEventListener("keyup", handleBodySelect);
      textarea.removeEventListener("focus", handleBodySelect);
      textarea.removeEventListener("click", handleBodySelect);
    };
  });

  useEffect(() => {
    const textarea = headerInputRef.current;
    if (!textarea) return;

    const handleHeaderSelect = () => {
      setEditingSection("header");
      const s = textarea.selectionStart;
      const e = textarea.selectionEnd;
      setActiveHeaderCursorPos({ start: s, end: e });
      if (typeof s === "number" && typeof e === "number" && s !== e) {
        lastValidSelectionRef.current = { start: s, end: e, field: "top_content", section: "header" };
      }
    };

    textarea.addEventListener("select", handleHeaderSelect);
    textarea.addEventListener("mouseup", handleHeaderSelect);
    textarea.addEventListener("keyup", handleHeaderSelect);
    textarea.addEventListener("focus", handleHeaderSelect);
    textarea.addEventListener("click", handleHeaderSelect);

    return () => {
      textarea.removeEventListener("select", handleHeaderSelect);
      textarea.removeEventListener("mouseup", handleHeaderSelect);
      textarea.removeEventListener("keyup", handleHeaderSelect);
      textarea.removeEventListener("focus", handleHeaderSelect);
      textarea.removeEventListener("click", handleHeaderSelect);
    };
  });

  // Header image handlers
  const handleHeaderImageUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please upload a valid image (PNG, JPG, SVG, WEBP)");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      setTemplateData((prev) => ({
        ...prev,
        header_image_url: event.target.result,
        header_image_position: prev.header_image_position || "left",
        header_image_height: prev.header_image_height || 65,
      }));
      toast.success("Header image added");
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const handleUseCollegeLogo = () => {
    const selectedCollege = colleges.find(
      (c) => String(c.id) === String(serviceData.college_id),
    );
    const baseURL = (
      api.defaults?.baseURL || "http://localhost:5000/api"
    ).replace(/\/api$/, "");
    const rawLogo = selectedCollege?.logo || selectedCollege?.header_image_url || "/logo.png";
    const resolvedUrl = rawLogo.startsWith("http")
      ? rawLogo
      : `${baseURL}${rawLogo.startsWith("/") ? "" : "/"}${rawLogo}`;

    setTemplateData((prev) => ({
      ...prev,
      header_image_url: resolvedUrl,
      header_image_position: prev.header_image_position || "left",
      header_image_height: prev.header_image_height || 65,
    }));
    toast.success("College logo set as header image");
  };

  const handleRemoveHeaderImage = () => {
    setTemplateData((prev) => ({
      ...prev,
      header_image_url: "",
    }));
    toast.success("Header image removed");
  };

  const insertTextAtCursor = (textToInsert) => {
    if (editingSection === "header") {
      const ta = headerInputRef.current;
      if (!ta) return;
      const start = ta.selectionStart || 0;
      const end = ta.selectionEnd || 0;
      const current = templateData.top_content || "";
      const updated = current.substring(0, start) + textToInsert + current.substring(end);
      setTemplateData((prev) => ({ ...prev, top_content: updated }));
      setTimeout(() => {
        ta.focus();
        ta.setSelectionRange(start + textToInsert.length, start + textToInsert.length);
      }, 0);
      return;
    }

    const ed = contentEditableRef.current;
    if (ed) {
      ed.focus();
      if (textToInsert.includes("\n")) {
        const html = textToInsert
          .split("\n")
          .map((l) => (l ? `<div>${l.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</div>` : "<div><br></div>"))
          .join("");
        document.execCommand("insertHTML", false, html);
      } else {
        document.execCommand("insertText", false, textToInsert);
      }
      const bbcode = htmlToBbcode(ed.innerHTML);
      setTemplateData((prev) => ({ ...prev, middle_content: bbcode }));
    }
  };

  const insertTable = (rows = 3, cols = 3) => {
    const validRows = Math.max(1, Math.min(parseInt(rows, 10) || 3, 20));
    const validCols = Math.max(1, Math.min(parseInt(cols, 10) || 3, 10));

    let headerCells = "";
    for (let c = 1; c <= validCols; c++) {
      headerCells += `<th style="border: 1px solid var(--text-muted); padding: 6px 10px; background-color: var(--background); font-weight: bold; text-align: left;">Header ${c}</th>`;
    }

    let bodyRows = "";
    for (let r = 1; r < validRows; r++) {
      let cells = "";
      for (let c = 1; c <= validCols; c++) {
        cells += `<td style="border: 1px solid var(--border-strong); padding: 6px 10px; text-align: left;">Data</td>`;
      }
      bodyRows += `<tr>${cells}</tr>`;
    }

    const tableHtml = `<div><br></div><table class="word-canvas-table" style="width: 100%; border-collapse: collapse; margin: 12px 0; border: 1px solid var(--text-muted);"><thead><tr>${headerCells}</tr></thead><tbody>${bodyRows}</tbody></table><div><br></div>`;

    const ed = contentEditableRef.current;
    if (ed) {
      ed.focus();
      if (savedRangeRef.current) {
        try {
          const sel = window.getSelection();
          sel?.removeAllRanges();
          sel?.addRange(savedRangeRef.current);
        } catch (e) {
          // Ignore
        }
      }
      document.execCommand("insertHTML", false, tableHtml);
      const bbcode = htmlToBbcode(ed.innerHTML);
      setTemplateData((prev) => ({ ...prev, middle_content: bbcode }));
      setShowTableDropdown(false);
      toast.success(`${validRows} × ${validCols} Table inserted`);
    }
  };

  const deleteTable = (targetTable = null) => {
    const ed = contentEditableRef.current;
    if (!ed) return;
    ed.focus();

    let table = targetTable;
    if (!table) {
      const sel = window.getSelection();
      if (sel && sel.anchorNode && ed.contains(sel.anchorNode)) {
        let node = sel.anchorNode;
        while (node && node !== ed) {
          if (node.tagName === "TABLE" || node.classList?.contains("word-canvas-table")) {
            table = node;
            break;
          }
          node = node.parentNode;
        }
      }
    }

    if (!table) {
      table = ed.querySelector("table.word-canvas-table, table");
    }

    if (table) {
      const parent = table.parentNode;
      table.remove();
      if (
        parent &&
        parent !== ed &&
        parent.tagName === "DIV" &&
        !parent.innerText.trim() &&
        !parent.querySelector("*")
      ) {
        parent.remove();
      }
      const bbcode = htmlToBbcode(ed.innerHTML);
      setTemplateData((prev) => ({ ...prev, middle_content: bbcode }));
      setIsInsideTable(false);
      toast.success("Table deleted successfully");
    } else {
      toast.info("No table found to delete");
    }
  };

  // Unicode Subscript and Superscript Maps for Microsoft Word text behavior
  const SUB_MAP = {
    "0": "₀", "1": "₁", "2": "₂", "3": "₃", "4": "₄", "5": "₅", "6": "₆", "7": "₇", "8": "₈", "9": "₉",
    "+": "₊", "-": "₋", "=": "₌", "(": "₍", ")": "₎",
    "a": "ₐ", "e": "ₑ", "h": "ₕ", "i": "ᵢ", "j": "ⱼ", "k": "ₖ", "l": "ₗ", "m": "ₘ", "n": "ₙ", "o": "ₒ", "p": "ₚ", "r": "ᵣ", "s": "ₛ", "t": "ₜ", "u": "ᵤ", "v": "ᵥ", "x": "ₓ"
  };
  const REV_SUB_MAP = Object.fromEntries(Object.entries(SUB_MAP).map(([k, v]) => [v, k]));

  const SUP_MAP = {
    "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴", "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹",
    "+": "⁺", "-": "⁻", "=": "⁼", "(": "⁽", ")": "⁾",
    "a": "ᵃ", "b": "ᵇ", "c": "ᶜ", "d": "ᵈ", "e": "ᵉ", "f": "ᶠ", "g": "ᵍ", "h": "ʰ", "i": "ⁱ", "j": "ʲ", "k": "ᵏ", "l": "ˡ", "m": "ᵐ", "n": "ⁿ", "o": "ᵒ", "p": "ᵖ", "r": "ʳ", "s": "ˢ", "t": "ᵗ", "u": "ᵘ", "v": "ᵛ", "w": "ʷ", "x": "ˣ", "y": "ʸ", "z": "ᶻ"
  };
  const REV_SUP_MAP = Object.fromEntries(Object.entries(SUP_MAP).map(([k, v]) => [v, k]));

  const toSubscript = (str) => {
    const isAllSub = [...str].every((c) => REV_SUB_MAP[c]);
    if (isAllSub) {
      return [...str].map((c) => REV_SUB_MAP[c] || c).join("");
    }
    return [...str].map((c) => SUB_MAP[c.toLowerCase()] || c).join("");
  };

  const toSuperscript = (str) => {
    const isAllSup = [...str].every((c) => REV_SUP_MAP[c]);
    if (isAllSup) {
      return [...str].map((c) => REV_SUP_MAP[c] || c).join("");
    }
    return [...str].map((c) => SUP_MAP[c.toLowerCase()] || c).join("");
  };

  const applySubscript = () => {
    const { field, textarea, start, end } = getActiveTarget();
    const content = templateData[field] || "";
    setUndoStack((prev) => [...prev.slice(-20), content]);
    setRedoStack([]);

    if (start !== end) {
      const selected = content.substring(start, end);
      const converted = toSubscript(selected);
      const newContent = content.substring(0, start) + converted + content.substring(end);
      setTemplateData((prev) => ({ ...prev, [field]: newContent }));
      setTimeout(() => {
        if (textarea) {
          textarea.focus();
          textarea.setSelectionRange(start, start + converted.length);
        }
      }, 50);
    } else {
      const newContent = content.substring(0, start) + "₂" + content.substring(end);
      setTemplateData((prev) => ({ ...prev, [field]: newContent }));
      setTimeout(() => {
        if (textarea) {
          textarea.focus();
          textarea.setSelectionRange(start + 1, start + 1);
        }
      }, 50);
    }
  };

  const applySuperscript = () => {
    const { field, textarea, start, end } = getActiveTarget();
    const content = templateData[field] || "";
    setUndoStack((prev) => [...prev.slice(-20), content]);
    setRedoStack([]);

    if (start !== end) {
      const selected = content.substring(start, end);
      const converted = toSuperscript(selected);
      const newContent = content.substring(0, start) + converted + content.substring(end);
      setTemplateData((prev) => ({ ...prev, [field]: newContent }));
      setTimeout(() => {
        if (textarea) {
          textarea.focus();
          textarea.setSelectionRange(start, start + converted.length);
        }
      }, 50);
    } else {
      const newContent = content.substring(0, start) + "²" + content.substring(end);
      setTemplateData((prev) => ({ ...prev, [field]: newContent }));
      setTimeout(() => {
        if (textarea) {
          textarea.focus();
          textarea.setSelectionRange(start + 1, start + 1);
        }
      }, 50);
    }
  };

  const bbcodeToHtml = (str) => {
    if (!str) return "";
    let html = str;

    // Convert BBCode alignments first
    html = html
      .replace(/\[center\]([\s\S]*?)\[\/center\]/gi, '<div style="text-align: center;">$1</div>')
      .replace(/\[right\]([\s\S]*?)\[\/right\]/gi, '<div style="text-align: right;">$1</div>')
      .replace(/\[justify\]([\s\S]*?)\[\/justify\]/gi, '<div style="text-align: justify; text-justify: inter-word;">$1</div>')
      .replace(/\[left\]([\s\S]*?)\[\/left\]/gi, '<div style="text-align: left;">$1</div>');

    // Handle lists
    html = html
      .replace(/\[list=1\]([\s\S]*?)\[\/list\]/gi, (m, inner) => {
        const rawItems = inner.split(/\[\*\]/);
        if (rawItems.length > 0 && !rawItems[0].trim()) rawItems.shift();
        const items = (rawItems.length > 0 ? rawItems : [""])
          .map((x) => `<li>${x.trim() || "<br>"}</li>`)
          .join("");
        return `<ol style="list-style-type: decimal; margin-left: 28px; padding-left: 4px;">${items}</ol>`;
      })
      .replace(/\[list\]([\s\S]*?)\[\/list\]/gi, (m, inner) => {
        const rawItems = inner.split(/\[\*\]/);
        if (rawItems.length > 0 && !rawItems[0].trim()) rawItems.shift();
        const items = (rawItems.length > 0 ? rawItems : [""])
          .map((x) => `<li>${x.trim() || "<br>"}</li>`)
          .join("");
        return `<ul style="list-style-type: disc; margin-left: 28px; padding-left: 4px;">${items}</ul>`;
      })
      .replace(/\[bullet-list\]([\s\S]*?)\[\/bullet-list\]/gi, (m, inner) => {
        const items = inner.replace(/\[list-item\]([\s\S]*?)\[\/list-item\]/gi, "<li>$1</li>");
        return `<ul style="list-style-type: disc; margin-left: 28px; padding-left: 4px;">${items}</ul>`;
      })
      .replace(/\[numbered-list\]([\s\S]*?)\[\/numbered-list\]/gi, (m, inner) => {
        const items = inner.replace(/\[list-item\]([\s\S]*?)\[\/list-item\]/gi, "<li>$1</li>");
        return `<ol style="list-style-type: decimal; margin-left: 28px; padding-left: 4px;">${items}</ol>`;
      });

    // Formatting tags
    html = html
      .replace(/\[font:([^\]]+)\]([\s\S]*?)\[\/font\]/gi, '<span style="font-family: $1;">$2</span>')
      .replace(/\[(?:b|bold)\]([\s\S]*?)\[\/(?:b|bold)\]/gi, "<strong>$1</strong>")
      .replace(/\[(?:i|italic)\]([\s\S]*?)\[\/(?:i|italic)\]/gi, "<em>$1</em>")
      .replace(/\[(?:u|underline)\]([\s\S]*?)\[\/(?:u|underline)\]/gi, '<span style="text-decoration: underline;">$1</span>')
      .replace(/\[(?:s|strike)\]([\s\S]*?)\[\/(?:s|strike)\]/gi, "<del>$1</del>")
      .replace(/\[sub\]([\s\S]*?)\[\/sub\]/gi, "<sub>$1</sub>")
      .replace(/\[sup\]([\s\S]*?)\[\/sup\]/gi, "<sup>$1</sup>")
      .replace(/\[size:(\d+(?:\.\d+)?)\]([\s\S]*?)\[\/size\]/gi, '<span style="font-size: $1px;">$2</span>')
      .replace(/\[color:([^\]]+)\]([\s\S]*?)\[\/color\]/gi, '<span style="color: $1;">$2</span>')
      .replace(/\[highlight:([^\]]+)\]([\s\S]*?)\[\/highlight\]/gi, '<span style="background-color: $1;">$2</span>');

    // Tables
    html = html
      .replace(/\[th\]([\s\S]*?)\[\/th\]/gi, (m, inner) => `<th style="border: 1px solid var(--text-muted); padding: 6px 10px; background-color: var(--background); font-weight: bold; text-align: left;">${inner}</th>`)
      .replace(/\[td\]([\s\S]*?)\[\/td\]/gi, (m, inner) => `<td style="border: 1px solid var(--border-strong); padding: 6px 10px; text-align: left;">${inner}</td>`)
      .replace(/\[tr\]([\s\S]*?)\[\/tr\]/gi, (m, inner) => `<tr>${inner}</tr>`)
      .replace(/\[table\]([\s\S]*?)\[\/table\]/gi, (m, inner) => {
        return `<table class="word-canvas-table" style="width: 100%; border-collapse: collapse; margin: 12px 0; border: 1px solid var(--text-muted);">${inner.trim()}</table>`;
      });

    html = html.replace(/<div style="text-align:[^"]*">\s*<\/div>/gi, "<div><br></div>");

    const lines = html.split("\n");
    return lines
      .map((l) => {
        const trimmed = l.trim();
        if (trimmed === "") return "<div><br></div>";
        if (/^<(?:div|p|ul|ol|li|table|tr|th|td)/i.test(trimmed)) return trimmed;
        return `<div>${l}</div>`;
      })
      .join("");
  };

  const htmlToBbcode = (html) => {
    if (!html) return "";
    let out = html
      .replace(/<o:p[\s\S]*?<\/o:p>/gi, "")
      .replace(/<!--[\s\S]*?-->/gi, "")
      .replace(/<\/?(?:meta|link|style)[^>]*>/gi, "");

    // Tables
    out = out.replace(/<\/?(?:thead|tbody|tfoot)[^>]*>/gi, "");
    out = out.replace(/<table[^>]*>([\s\S]*?)<\/table>/gi, (m, tableContent) => {
      const rows = [];
      const trMatches = tableContent.match(/<tr[^>]*>([\s\S]*?)<\/tr>/gi) || [];
      for (const tr of trMatches) {
        const cells = [];
        const cellMatches = tr.match(/<(?:th|td)[^>]*>([\s\S]*?)<\/(?:th|td)>/gi) || [];
        for (const cell of cellMatches) {
          const isHeader = /^<th/i.test(cell);
          const inner = cell.replace(/^<(?:th|td)[^>]*>([\s\S]*?)<\/(?:th|td)>$/i, "$1").trim();
          cells.push(isHeader ? `[th]${inner}[/th]` : `[td]${inner}[/td]`);
        }
        rows.push(`[tr]${cells.join("")}[/tr]`);
      }
      return `\n[table]\n${rows.join("\n")}\n[/table]\n`;
    });

    // Lists
    out = out
      .replace(/<ul[^>]*>([\s\S]*?)<\/ul>/gi, (m, inner) => {
        const items = inner.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (match, itemText) => {
          const cleanText = itemText.replace(/<br\s*\/?>/gi, "").trim();
          return `\n[*] ${cleanText || " "}`;
        });
        return `\n[list]${items}\n[/list]\n`;
      })
      .replace(/<ol[^>]*>([\s\S]*?)<\/ol>/gi, (m, inner) => {
        const items = inner.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (match, itemText) => {
          const cleanText = itemText.replace(/<br\s*\/?>/gi, "").trim();
          return `\n[*] ${cleanText || " "}`;
        });
        return `\n[list=1]${items}\n[/list]\n`;
      });

    // Paragraph / Div / Center Alignments
    out = out
      .replace(/<center[^>]*>([\s\S]*?)<\/center>/gi, "\n[center]$1[/center]")
      .replace(/<(?:div|p)[^>]*?(?:style=['"][^'"]*text-align:\s*center[^'"]*['"]|align=['"]?center['"]?)[^>]*>([\s\S]*?)<\/(?:div|p)>/gi, "\n[center]$1[/center]")
      .replace(/<(?:div|p)[^>]*?(?:style=['"][^'"]*text-align:\s*right[^'"]*['"]|align=['"]?right['"]?)[^>]*>([\s\S]*?)<\/(?:div|p)>/gi, "\n[right]$1[/right]")
      .replace(/<(?:div|p)[^>]*?(?:style=['"][^'"]*text-align:\s*justify[^'"]*['"]|align=['"]?justify['"]?)[^>]*>([\s\S]*?)<\/(?:div|p)>/gi, "\n[justify]$1[/justify]")
      .replace(/<(?:div|p)[^>]*?(?:style=['"][^'"]*text-align:\s*left[^'"]*['"]|align=['"]?left['"]?)[^>]*>([\s\S]*?)<\/(?:div|p)>/gi, "\n[left]$1[/left]");

    // Formatting tags
    out = out
      .replace(/<span[^>]*style=['"][^'"]*font-size:\s*(\d+(?:\.\d+)?)(?:pt|px);?[^'"]*['"][^>]*>([\s\S]*?)<\/span>/gi, (m, size, inner) => `[size:${Math.round(parseFloat(size))}]${inner}[/size]`)
      .replace(/<span[^>]*style=['"][^'"]*font-family:\s*([^;"]+);?[^'"]*['"][^>]*>([\s\S]*?)<\/span>/gi, "[font:$1]$2[/font]")
      .replace(/<font[^>]*face=['"]?([^'">]+)['"]?[^>]*>([\s\S]*?)<\/font>/gi, "[font:$1]$2[/font]")
      .replace(/<(?:strong|b)>([\s\S]*?)<\/(?:strong|b)>/gi, "[b]$1[/b]")
      .replace(/<(?:em|i)>([\s\S]*?)<\/(?:em|i)>/gi, "[i]$1[/i]")
      .replace(/<span[^>]*style=['"][^'"]*text-decoration:\s*underline;?[^'"]*['"][^>]*>([\s\S]*?)<\/span>/gi, "[u]$1[/u]")
      .replace(/<u>([\s\S]*?)<\/u>/gi, "[u]$1[/u]")
      .replace(/<(?:del|s|strike)>([\s\S]*?)<\/(?:del|s|strike)>/gi, "[s]$1[/s]")
      .replace(/<sub>([\s\S]*?)<\/sub>/gi, "[sub]$1[/sub]")
      .replace(/<sup>([\s\S]*?)<\/sup>/gi, "[sup]$1[/sup]")
      .replace(/<span[^>]*style=['"][^'"]*color:\s*([^;"]+);?[^'"]*['"][^>]*>([\s\S]*?)<\/span>/gi, "[color:$1]$2[/color]")
      .replace(/<font color="([^"]+)">([\s\S]*?)<\/font>/gi, "[color:$1]$2[/color]")
      .replace(/<span[^>]*style=['"][^'"]*background-color:\s*([^;"]+);?[^'"]*['"][^>]*>([\s\S]*?)<\/span>/gi, "[highlight:$1]$2[/highlight]")
      .replace(/<div>\s*<br\s*\/?>\s*<\/div>/gi, "\n")
      .replace(/<p>\s*<br\s*\/?>\s*<\/p>/gi, "\n")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<div>([\s\S]*?)<\/div>/gi, "\n$1")
      .replace(/<p>([\s\S]*?)<\/p>/gi, "\n$1")
      .replace(/<\/?[a-z0-9_-]+[^>]*>/gi, "")
      .replace(/&amp;/gi, "&")
      .replace(/&lt;/gi, "<")
      .replace(/&gt;/gi, ">")
      .replace(/&quot;/gi, '"')
      .replace(/&#39;/gi, "'")
      .replace(/\[(left|center|right|justify|b|bold|i|italic|u|underline|s|strike|sub|sup)\]\s*\[\/\1\]/gi, "");

    return out.replace(/\r/g, "").replace(/\n{6,}/g, "\n\n\n\n\n");
  };

  const processPastedContent = (html, text) => {
    let resultHtml = "";

    if (html && html.trim()) {
      let fragment = html;
      const fragmentMatch = html.match(/<!--StartFragment-->([\s\S]*?)<!--EndFragment-->/i);
      if (fragmentMatch) {
        fragment = fragmentMatch[1];
      } else {
        fragment = fragment.replace(/^[\s\S]*?<body[^>]*>/i, "").replace(/<\/body>[\s\S]*$/i, "");
      }

      // Strip raw BBCode alignment tags if accidentally copied
      fragment = fragment.replace(/\[\/?(?:center|right|justify|left)\]/gi, "");

      // Strip office XML, scripts, styles, meta, comments
      fragment = fragment
        .replace(/<o:p[\s\S]*?<\/o:p>/gi, "")
        .replace(/<style[\s\S]*?<\/style>/gi, "")
        .replace(/<script[\s\S]*?<\/script>/gi, "")
        .replace(/<\/?(?:html|body|head|meta|link|xml|w:[^>]+)[^>]*>/gi, "")
        .replace(/<!--[\s\S]*?-->/gi, "");

      // Strip mso specific properties safely without eating quotes or tags
      fragment = fragment.replace(/mso-[^:;'"<>]+:[^;'"<>]+;?/gi, "");
      fragment = fragment.replace(/\s*(?:class|lang)=['"][^'"]*['"]/gi, "");

      // Clean Word margins, excessive line heights, and text-justify safely without corrupting tags
      fragment = fragment.replace(/(?:margin(?:-[a-z]+)?|line-height|text-justify)\s*:\s*[^;'"<>]+;?/gi, "");

      // Convert Word paragraphs to divs with preserved alignment
      fragment = fragment.replace(/<p([^>]*)>([\s\S]*?)<\/p>/gi, (match, attrs, inner) => {
        const stripped = inner.replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").trim();
        if (!stripped) {
          return "<div><br></div>";
        }
        let align = "";
        if (/center/i.test(attrs)) align = "text-align: center;";
        else if (/right/i.test(attrs)) align = "text-align: right;";
        else if (/justify/i.test(attrs)) align = "text-align: justify; text-justify: inter-word;";
        else if (/left/i.test(attrs)) align = "text-align: left;";

        const styleAttr = align ? ` style="${align}"` : "";
        return `<div${styleAttr}>${inner.replace(/[\r\n]+/g, " ")}</div>`;
      });

      // Clean empty breaks
      fragment = fragment.replace(/<br\s*\/?>/gi, "<br>");

      resultHtml = fragment.trim();
    }

    // Fallback to plain text if no HTML or if HTML stripped to empty
    if (!resultHtml && text) {
      const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
      resultHtml = lines
        .map((line) => {
          if (!line.trim()) return "<div><br></div>";
          const leading = line.match(/^ +/);
          let formatted = line
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;");
          if (leading) {
            const count = leading[0].length;
            formatted = "&nbsp;".repeat(count) + formatted.substring(count);
          }
          return `<div>${formatted}</div>`;
        })
        .join("");
    }

    return resultHtml;
  };

  // Extract active styles and strip all raw BBCode tags
  const extractAndStripTags = (text) => {
    if (!text) return { text: "", updates: {} };
    const updates = {};
    if (/\[(?:b|bold)\]/i.test(text)) updates.font_bold = true;
    if (/\[(?:i|italic)\]/i.test(text)) updates.font_italic = true;
    if (/\[(?:u|underline)\]/i.test(text)) updates.font_underline = true;
    if (/\[(?:s|strike)\]/i.test(text)) updates.font_strikethrough = true;

    const sizeMatches = [...text.matchAll(/\[size:(\d+(?:\.\d+)?)\]/gi)];
    if (sizeMatches.length > 0) {
      updates.font_size = parseInt(sizeMatches[sizeMatches.length - 1][1]);
    }
    const colorMatches = [...text.matchAll(/\[color:([^\]]+)\]/gi)];
    if (colorMatches.length > 0) {
      updates.font_color = colorMatches[colorMatches.length - 1][1];
    }
    const hlMatches = [...text.matchAll(/\[highlight:([^\]]+)\]/gi)];
    if (hlMatches.length > 0) {
      updates.font_highlight = hlMatches[hlMatches.length - 1][1];
    }
    const fontMatches = [...text.matchAll(/\[font:([^\]]+)\]/gi)];
    if (fontMatches.length > 0) {
      updates.font_family = fontMatches[fontMatches.length - 1][1];
    }

    const clean = text.replace(
      /\[\/?(?:b|bold|i|italic|u|underline|s|strike|sub|sup|font(?::[^\]]+)?|size(?::[^\]]+)?|color(?::[^\]]+)?|highlight(?::[^\]]+)?)\]/gi,
      "",
    );

    return { text: clean, updates };
  };

  const cleanAllTagsFromText = (text) => {
    if (!text) return "";
    return text.replace(
      /\[\/?(?:b|bold|i|italic|u|underline|s|strike|sub|sup|font(?::[^\]]+)?|size(?::[^\]]+)?|color(?::[^\]]+)?|highlight(?::[^\]]+)?)\]/gi,
      "",
    );
  };

  // Normalizes template content before sending to PDF generation and backend storage
  const prepareConfigForBackend = (config) => {
    if (!config) return config;

    const sanitizeContent = (text) => {
      if (!text) return "";
      let out = text;

      // 1. Lists to bullets and numbered items
      out = out.replace(/\[list=1\]([\s\S]*?)\[\/list\]/gi, (m, inner) => {
        const items = inner.split(/\[\*\]/).map((x) => x.trim()).filter(Boolean);
        return items.map((item, idx) => `${idx + 1}. ${item}`).join("\n");
      });
      out = out.replace(/\[list\]([\s\S]*?)\[\/list\]/gi, (m, inner) => {
        const items = inner.split(/\[\*\]/).map((x) => x.trim()).filter(Boolean);
        return items.map((item) => `• ${item}`).join("\n");
      });
      out = out.replace(/^\s*\[\*\]\s*/gim, "• ");
      out = out.replace(/\[\/?(?:list|list=1|bullet-list|numbered-list)\]/gi, "");

      // 2. Multi-line alignment tags: ensure each line has its own tag
      out = out.replace(/\[(left|center|right|justify)\]([\s\S]*?)\[\/\1\]/gi, (m, tag, inner) => {
        const lines = inner.split("\n");
        return lines
          .map((l) => {
            if (!l.trim()) return "";
            return `[${tag}]${l}[/${tag}]`;
          })
          .join("\n");
      });

      // 3. Round float font sizes to integers
      out = out.replace(/\[size:(\d+(?:\.\d+)?)\]/gi, (m, s) => `[size:${Math.round(parseFloat(s))}]`);

      // 4. Strip unsupported tags that PDFKit cannot render
      out = out.replace(/\[font:[^\]]+\]([\s\S]*?)\[\/font\]/gi, "$1");
      out = out.replace(/\[\/?font(?::[^\]]+)?\]/gi, "");
      out = out.replace(/\[highlight:[^\]]+\]([\s\S]*?)\[\/highlight\]/gi, "$1");
      out = out.replace(/\[\/?highlight(?::[^\]]+)?\]/gi, "");
      out = out.replace(/\[(?:i|italic)\]([\s\S]*?)\[\/(?:i|italic)\]/gi, "$1");
      out = out.replace(/\[(?:u|underline)\]([\s\S]*?)\[\/(?:u|underline)\]/gi, "$1");
      out = out.replace(/\[(?:s|strike)\]([\s\S]*?)\[\/(?:s|strike)\]/gi, "$1");
      out = out.replace(/\[(?:sub|sup)\]([\s\S]*?)\[\/(?:sub|sup)\]/gi, "$1");
      out = out.replace(/\[\/?(?:i|italic|u|underline|s|strike|sub|sup)\]/gi, "");

      // 4.5 Unescape HTML entities so PDFKit and previews receive clean text instead of raw &nbsp; or &amp;
      out = out
        .replace(/&nbsp;/gi, " ")
        .replace(/&amp;/gi, "&")
        .replace(/&lt;/gi, "<")
        .replace(/&gt;/gi, ">")
        .replace(/&quot;/gi, '"')
        .replace(/&#39;/gi, "'");

      // 5. Clean up each line: prevent PDFKit line truncation from inline [b], [size], [color]
      const lines = out.split("\n");
      const cleanedLines = lines.map((line) => {
        let l = line.trim();
        if (!l) return "";

        // Preserve table structure tags exactly
        if (/^\[\/?(?:table|tr)\]/i.test(l)) {
          return l;
        }

        // Extract alignment
        let alignTag = "";
        const alignMatch = l.match(/^\[(left|center|right|justify)\]([\s\S]*?)\[\/\1\]$/i);
        if (alignMatch) {
          alignTag = alignMatch[1].toLowerCase();
          l = alignMatch[2]; // preserve indentation and non-breaking spaces
        }

        // Check if bold, size, color wrap the entire line
        let isBold = false;
        let sizeVal = null;
        let colorVal = null;

        // Unpack wrapping tags iteratively
        let changed = true;
        while (changed) {
          changed = false;
          const bMatch = l.match(/^\[(?:b|bold)\]([\s\S]*?)\[\/(?:b|bold)\]$/i);
          if (bMatch) {
            isBold = true;
            l = bMatch[1];
            changed = true;
            continue;
          }
          const sMatch = l.match(/^\[size:(\d+)\]([\s\S]*?)\[\/size\]$/i);
          if (sMatch) {
            sizeVal = sMatch[1];
            l = sMatch[2];
            changed = true;
            continue;
          }
          const cMatch = l.match(/^\[color:([^\]]+)\]([\s\S]*?)\[\/color\]$/i);
          if (cMatch) {
            colorVal = cMatch[1];
            l = cMatch[2];
            changed = true;
            continue;
          }
        }

        // Any remaining inline tags inside the line should be unwrapped to plain text
        // so backend PDFKit doesn't truncate the entire line to just that word!
        l = l.replace(/\[(?:b|bold)\]([\s\S]*?)\[\/(?:b|bold)\]/gi, "$1");
        l = l.replace(/\[size:\d+\]([\s\S]*?)\[\/size\]/gi, "$1");
        l = l.replace(/\[color:[^\]]+\]([\s\S]*?)\[\/color\]/gi, "$1");
        l = l.replace(/\[\/?(?:b|bold|size(?::\d+)?|color(?::[^\]]+)?)\]/gi, "");

        // If the line had wrapping tags, re-wrap them in canonical backend order:
        // [b][size:N][color:C]...[/color][/size][/b]
        if (colorVal && colorVal !== "black" && colorVal !== "#000000") {
          l = `[color:${colorVal}]${l}[/color]`;
        }
        if (sizeVal) {
          l = `[size:${sizeVal}]${l}[/size]`;
        }
        if (isBold) {
          l = `[b]${l}[/b]`;
        }

        if (!l || l.trim() === "") return "";

        if (alignTag) {
          return `[${alignTag}]${l}[/${alignTag}]`;
        }
        return l;
      });

      // Collapse excessive blank lines while preserving intentional line breaks
      return cleanedLines.join("\n").replace(/\n{6,}/g, "\n\n\n\n\n");
    };

    const selectedCollege = colleges.find(
      (c) => String(c.id) === String(config.college_id || serviceData.college_id),
    );
    const hasHeaderImage = !!(
      selectedCollege?.header_image_url ||
      selectedCollege?.header_image ||
      config.header_image_url
    );

    return {
      ...config,
      top_content: hasHeaderImage ? "" : sanitizeContent(config.top_content),
      middle_content: sanitizeContent(config.middle_content),
      bottom_content: sanitizeContent(config.bottom_content),
      footer_height: 0,
      footer_image_url: null,
    };
  };


  // Formatting handler: executes direct WYSIWYG commands without displaying code tags
  const applyFormatToSelection = (formatType, value = null) => {
    if (editingSection === "header") {
      const { field, textarea, start, end } = getActiveTarget();
      const content = templateData[field] || "";
      const hasSelection = start !== end;
      if (hasSelection) {
        const selText = content.substring(start, end);
        let rep = selText;
        if (formatType === "bold") rep = `[b]${selText}[/b]`;
        else if (formatType === "italic") rep = `[i]${selText}[/i]`;
        else if (formatType === "underline") rep = `[u]${selText}[/u]`;
        else if (formatType === "size") rep = `[size:${value}]${selText}[/size]`;
        else if (formatType === "font") rep = `[font:${value}]${selText}[/font]`;
        else if (formatType === "color") rep = `[color:${value}]${selText}[/color]`;
        const updated = content.substring(0, start) + rep + content.substring(end);
        setTemplateData((prev) => ({ ...prev, [field]: updated }));
      }
      return;
    }

    // Word Canvas direct WYSIWYG editing
    const ed = contentEditableRef.current;
    if (!ed) return;
    ed.focus();

    const sel = window.getSelection();
    const hasSelection = sel && !sel.isCollapsed && sel.rangeCount > 0 && ed.contains(sel.anchorNode);

    if (!hasSelection) {
      if (formatType === "bold") {
        setTemplateData((prev) => ({ ...prev, font_bold: !prev.font_bold }));
        setActiveBold((prev) => !prev);
      } else if (formatType === "italic") {
        setTemplateData((prev) => ({ ...prev, font_italic: !prev.font_italic }));
        setActiveItalic((prev) => !prev);
      } else if (formatType === "underline") {
        setTemplateData((prev) => ({ ...prev, font_underline: !prev.font_underline }));
        setActiveUnderline((prev) => !prev);
      } else if (formatType === "strike") {
        setTemplateData((prev) => ({ ...prev, font_strikethrough: !prev.font_strikethrough }));
        setActiveStrike((prev) => !prev);
      } else if (formatType === "size") {
        setTemplateData((prev) => ({ ...prev, font_size: value }));
        setActiveFontSize(value);
      } else if (formatType === "size_step") {
        const curSize = activeFontSize || templateData.font_size || 12;
        const newSize = Math.min(Math.max(curSize + value, 8), 36);
        setTemplateData((prev) => ({
          ...prev,
          font_size: newSize,
        }));
        setActiveFontSize(newSize);
      } else if (formatType === "font") {
        setTemplateData((prev) => ({ ...prev, font_family: value }));
        setActiveFontFamily(normalizeFamily(value));
      } else if (formatType === "color") {
        setTemplateData((prev) => ({ ...prev, font_color: value }));
      } else if (formatType === "highlight") {
        setTemplateData((prev) => ({ ...prev, font_highlight: value }));
      }
      return;
    }

    // Native WYSIWYG formatting without code tags - applies ONLY to the selected text
    if (formatType === "bold") {
      document.execCommand("bold", false, null);
      setActiveBold(document.queryCommandState("bold"));
    } else if (formatType === "italic") {
      document.execCommand("italic", false, null);
      setActiveItalic(document.queryCommandState("italic"));
    } else if (formatType === "underline") {
      document.execCommand("underline", false, null);
      setActiveUnderline(document.queryCommandState("underline"));
    } else if (formatType === "strike") {
      document.execCommand("strikeThrough", false, null);
      setActiveStrike(document.queryCommandState("strikeThrough"));
    } else if (formatType === "sub") {
      document.execCommand("subscript", false, null);
    } else if (formatType === "sup") {
      document.execCommand("superscript", false, null);
    } else if (formatType === "font") {
      document.execCommand("fontName", false, value);
      setActiveFontFamily(normalizeFamily(value));
    } else if (formatType === "color") {
      document.execCommand("foreColor", false, value);
    } else if (formatType === "highlight") {
      document.execCommand("hiliteColor", false, value === "transparent" ? "inherit" : value);
    } else if (formatType === "size") {
      const range = sel.getRangeAt(0);
      const span = document.createElement("span");
      span.style.fontSize = `${value}px`;
      span.appendChild(range.extractContents());
      range.insertNode(span);
      sel.removeAllRanges();
      const newRange = document.createRange();
      newRange.selectNodeContents(span);
      sel.addRange(newRange);
      setActiveFontSize(value);
    } else if (formatType === "size_step") {
      const range = sel.getRangeAt(0);
      const span = document.createElement("span");
      const curSize = activeFontSize || templateData.font_size || 12;
      const newSize = Math.min(Math.max(curSize + value, 8), 36);
      span.style.fontSize = `${newSize}px`;
      span.appendChild(range.extractContents());
      range.insertNode(span);
      sel.removeAllRanges();
      const newRange = document.createRange();
      newRange.selectNodeContents(span);
      sel.addRange(newRange);
      setActiveFontSize(newSize);
    }

    saveCurrentRange();
    const bbcode = htmlToBbcode(ed.innerHTML);
    setTemplateData((prev) => ({ ...prev, middle_content: bbcode }));
  };

  const applyTextWrapTag = (openTag, closeTag, placeholder = "") => {
    const { field, textarea, start, end, section } = getActiveTarget();
    const content = templateData[field] || "";

    setUndoStack((prev) => [...prev.slice(-20), content]);
    setRedoStack([]);

    const hasSelection = start !== end;
    const selectedText = hasSelection ? content.substring(start, end) : placeholder;
    let replacement;

    if (
      hasSelection &&
      selectedText.startsWith(openTag) &&
      selectedText.endsWith(closeTag) &&
      selectedText.length >= openTag.length + closeTag.length
    ) {
      replacement = selectedText.slice(openTag.length, selectedText.length - closeTag.length);
    } else {
      replacement = `${openTag}${selectedText}${closeTag}`;
    }

    const newContent = content.substring(0, start) + replacement + content.substring(end);

    setTemplateData((prev) => ({
      ...prev,
      [field]: newContent,
    }));

    setTimeout(() => {
      if (textarea) {
        textarea.focus();
        if (hasSelection) {
          textarea.setSelectionRange(start, start + replacement.length);
          if (section === "header") {
            setActiveHeaderCursorPos({ start, end: start + replacement.length });
          } else {
            setActiveCursorPos({ start, end: start + replacement.length });
          }
        } else {
          const innerStart = start + openTag.length;
          const innerEnd = innerStart + placeholder.length;
          textarea.setSelectionRange(innerStart, innerEnd);
          if (section === "header") {
            setActiveHeaderCursorPos({ start: innerStart, end: innerEnd });
          } else {
            setActiveCursorPos({ start: innerStart, end: innerEnd });
          }
        }
      }
    }, 50);
  };

  const applyListFormat = (type) => {
    if (editingSection === "header") return;
    const ed = contentEditableRef.current;
    if (ed) {
      ed.focus();
      const sel = window.getSelection();
      if (savedRangeRef.current) {
        try {
          sel?.removeAllRanges();
          sel?.addRange(savedRangeRef.current);
        } catch (e) {
          // Ignore
        }
      } else if (!sel || !sel.rangeCount || !ed.contains(sel.anchorNode)) {
        const range = document.createRange();
        range.selectNodeContents(ed);
        range.collapse(false);
        sel?.removeAllRanges();
        sel?.addRange(range);
      }
      const cmd = type === "bullet" ? "insertUnorderedList" : "insertOrderedList";
      try {
        document.execCommand(cmd, false, null);
      } catch (e) {
        // Ignore
      }
      saveCurrentRange();
      const bbcode = htmlToBbcode(ed.innerHTML);
      setTemplateData((prev) => ({ ...prev, middle_content: bbcode }));
    }
  };

  const handleListKeyDown = (e, fieldName = "middle_content") => {
    const textarea = e.target;
    const content = templateData[fieldName] || "";
    const selStart = textarea.selectionStart;
    const selEnd = textarea.selectionEnd;

    // Handle Backspace when immediately after list prefix (e.g. "• " or "1. ")
    if (e.key === "Backspace" && selStart === selEnd) {
      const lastNewlineIdx = content.lastIndexOf("\n", selStart - 1);
      const lineStart = lastNewlineIdx === -1 ? 0 : lastNewlineIdx + 1;
      const textBeforeCursor = content.slice(lineStart, selStart);

      if (
        /^(\s*)([•*]|-)\s*$/.test(textBeforeCursor) ||
        /^(\s*)\d+[.)]\s*$/.test(textBeforeCursor)
      ) {
        e.preventDefault();
        setUndoStack((prev) => [...prev.slice(-20), content]);
        setRedoStack([]);
        const newContent = content.slice(0, lineStart) + content.slice(selStart);
        setTemplateData((prev) => ({ ...prev, [fieldName]: newContent }));
        setTimeout(() => {
          if (textarea) {
            textarea.focus();
            textarea.setSelectionRange(lineStart, lineStart);
          }
        }, 0);
        return true;
      }
    }

    // Handle Enter key for continuing lists
    if (e.key === "Enter" && !e.shiftKey && !e.ctrlKey && !e.altKey && !e.metaKey) {
      // Don't intercept if @ autocomplete popup is open
      const isSuggestionsOpen = !!document.querySelector(
        '[role="listbox"], .mentions__suggestions'
      );
      if (isSuggestionsOpen) return false;

      const lastNewlineIdx = content.lastIndexOf("\n", selStart - 1);
      const lineStart = lastNewlineIdx === -1 ? 0 : lastNewlineIdx + 1;
      const currentLine = content.slice(lineStart, selStart);

      // 1. Bullet list check (•, *, -)
      const bulletMatch = currentLine.match(/^(\s*)([•*]|-)\s*(.*)$/);
      if (bulletMatch) {
        e.preventDefault();
        setUndoStack((prev) => [...prev.slice(-20), content]);
        setRedoStack([]);
        const indent = bulletMatch[1];
        const textAfterBullet = bulletMatch[3];

        // Empty bullet line -> exit list (remove bullet from line)
        if (textAfterBullet.trim() === "") {
          const newContent = content.slice(0, lineStart) + indent + content.slice(selStart);
          setTemplateData((prev) => ({ ...prev, [fieldName]: newContent }));
          const newPos = lineStart + indent.length;
          setTimeout(() => {
            if (textarea) {
              textarea.focus();
              textarea.setSelectionRange(newPos, newPos);
            }
          }, 0);
          return true;
        }

        // Continue bullet on next line
        const nextPrefix = `\n${indent}• `;
        const newContent = content.slice(0, selStart) + nextPrefix + content.slice(selEnd);
        setTemplateData((prev) => ({ ...prev, [fieldName]: newContent }));
        const newPos = selStart + nextPrefix.length;
        setTimeout(() => {
          if (textarea) {
            textarea.focus();
            textarea.setSelectionRange(newPos, newPos);
          }
        }, 0);
        return true;
      }

      // 2. Numbered list check (1., 2., 1), etc.)
      const numberMatch = currentLine.match(/^(\s*)(\d+)([.)])\s*(.*)$/);
      if (numberMatch) {
        e.preventDefault();
        setUndoStack((prev) => [...prev.slice(-20), content]);
        setRedoStack([]);
        const indent = numberMatch[1];
        const currentNum = parseInt(numberMatch[2], 10);
        const delimiter = numberMatch[3];
        const textAfterNumber = numberMatch[4];

        // Empty number line -> exit list (remove number from line)
        if (textAfterNumber.trim() === "") {
          const newContent = content.slice(0, lineStart) + indent + content.slice(selStart);
          setTemplateData((prev) => ({ ...prev, [fieldName]: newContent }));
          const newPos = lineStart + indent.length;
          setTimeout(() => {
            if (textarea) {
              textarea.focus();
              textarea.setSelectionRange(newPos, newPos);
            }
          }, 0);
          return true;
        }

        // Continue numbered list with incremented counter
        const nextNum = currentNum + 1;
        const nextPrefix = `\n${indent}${nextNum}${delimiter} `;
        const newContent = content.slice(0, selStart) + nextPrefix + content.slice(selEnd);
        setTemplateData((prev) => ({ ...prev, [fieldName]: newContent }));
        const newPos = selStart + nextPrefix.length;
        setTimeout(() => {
          if (textarea) {
            textarea.focus();
            textarea.setSelectionRange(newPos, newPos);
          }
        }, 0);
        return true;
      }
    }

    return false;
  };

  const applyIndent = (direction) => {
    if (editingSection === "header") return;
    const ed = contentEditableRef.current;
    if (ed) {
      ed.focus();
      document.execCommand(direction === "increase" ? "indent" : "outdent", false, null);
      const bbcode = htmlToBbcode(ed.innerHTML);
      setTemplateData((prev) => ({ ...prev, middle_content: bbcode }));
      return;
    }

    const { field, textarea, start: selStart, end: selEnd } = getActiveTarget();
    const content = templateData[field] || "";

    const lines = content.split("\n");
    if (lines.length === 0) return;

    setUndoStack((prev) => [...prev.slice(-20), content]);
    setRedoStack([]);

    const textBeforeStart = content.slice(0, selStart);
    const startLineIdx = textBeforeStart.split("\n").length - 1;
    const textBeforeEnd = content.slice(0, selEnd);
    const endLineIdx = textBeforeEnd.split("\n").length - 1;

    const newLines = lines.map((line, idx) => {
      if (idx >= startLineIdx && idx <= endLineIdx) {
        if (direction === "increase") {
          return "    " + line;
        } else {
          return line.replace(/^( {1,4}|\t)/, "");
        }
      }
      return line;
    });

    const newContent = newLines.join("\n");
    setTemplateData((prev) => ({
      ...prev,
      [field]: newContent,
    }));
  };

  const toggleCase = (caseType) => {
    if (editingSection === "header") return;
    const ed = contentEditableRef.current;
    if (!ed) return;
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !ed.contains(sel.anchorNode)) {
      toast("Select text first to change case", { icon: "ℹ️" });
      return;
    }
    const selectedText = sel.toString();
    if (!selectedText) return;

    let converted = selectedText;
    if (caseType === "upper") {
      converted = selectedText.toUpperCase();
    } else if (caseType === "lower") {
      converted = selectedText.toLowerCase();
    } else if (caseType === "title") {
      converted = selectedText.replace(/\b\w/g, (c) => c.toUpperCase());
    } else if (caseType === "sentence") {
      converted = selectedText.charAt(0).toUpperCase() + selectedText.slice(1).toLowerCase();
    }

    document.execCommand("insertText", false, converted);
    const bbcode = htmlToBbcode(ed.innerHTML);
    setTemplateData((prev) => ({ ...prev, middle_content: bbcode }));
    setShowCaseDropdown(false);
  };

  const clearFormatting = () => {
    if (editingSection === "header") {
      setTemplateData((prev) => ({
        ...prev,
        top_content: cleanAllTagsFromText(prev.top_content),
      }));
      return;
    }
    const ed = contentEditableRef.current;
    if (ed) {
      ed.focus();
      const sel = window.getSelection();
      if (sel && !sel.isCollapsed && ed.contains(sel.anchorNode)) {
        document.execCommand("removeFormat", false, null);
        const bbcode = htmlToBbcode(ed.innerHTML);
        setTemplateData((prev) => ({ ...prev, middle_content: bbcode }));
        setActiveFontFamily("Calibri");
        setActiveFontSize(12);
        setActiveBold(false);
        setActiveItalic(false);
        setActiveUnderline(false);
        setActiveStrike(false);
        toast.success("Selection formatting removed");
      } else {
        setTemplateData((prev) => ({
          ...prev,
          font_family: "Calibri",
          font_size: 12,
          font_bold: false,
          font_italic: false,
          font_underline: false,
          font_strikethrough: false,
          font_color: "var(--text-primary)",
          font_highlight: "transparent",
        }));
        setActiveFontFamily("Calibri");
        setActiveFontSize(12);
        setActiveBold(false);
        setActiveItalic(false);
        setActiveUnderline(false);
        setActiveStrike(false);
        toast.success("Document defaults reset");
      }
    }
  };

  const handleCut = async () => {
    const { field, textarea, start, end } = getActiveTarget();
    const content = templateData[field] || "";

    if (start === end) {
      toast("Select text to cut", { icon: "ℹ️" });
      return;
    }
    const selectedText = content.substring(start, end);
    try {
      await navigator.clipboard.writeText(selectedText);
      setUndoStack((prev) => [...prev.slice(-20), content]);
      setRedoStack([]);
      const newContent = content.substring(0, start) + content.substring(end);
      setTemplateData((prev) => ({ ...prev, [field]: newContent }));
      toast.success("Cut to clipboard");
    } catch {
      toast.error("Clipboard access denied");
    }
  };

  const handleCopy = async () => {
    const { field, textarea, start, end } = getActiveTarget();
    const content = templateData[field] || "";

    if (start === end) {
      toast("Select text to copy", { icon: "ℹ️" });
      return;
    }
    const selectedText = content.substring(start, end);
    try {
      await navigator.clipboard.writeText(selectedText);
      toast.success("Copied to clipboard");
    } catch {
      toast.error("Clipboard access denied");
    }
  };

  const handlePaste = async () => {
    try {
      let html = "";
      let text = "";
      if (navigator.clipboard?.read) {
        try {
          const items = await navigator.clipboard.read();
          for (const item of items) {
            if (item.types.includes("text/html")) {
              const blob = await item.getType("text/html");
              html = await blob.text();
            }
            if (item.types.includes("text/plain")) {
              const blob = await item.getType("text/plain");
              text = await blob.text();
            }
          }
        } catch {
          text = await navigator.clipboard.readText();
        }
      } else {
        text = await navigator.clipboard.readText();
      }

      if (editingSection === "header") {
        const cleanText = (text || html.replace(/<[^>]+>/g, " ")).trim();
        if (cleanText) insertTextAtCursor(cleanText);
        toast.success("Pasted");
        return;
      }

      const cleanHtml = processPastedContent(html, text);
      const ed = contentEditableRef.current;
      if (ed && cleanHtml) {
        ed.focus();
        document.execCommand("insertHTML", false, cleanHtml);
        const bbcode = htmlToBbcode(ed.innerHTML);
        setTemplateData((prev) => ({ ...prev, middle_content: bbcode }));
        toast.success("Pasted");
      }
    } catch {
      toast.error("Clipboard access denied");
    }
  };

  const handleUndo = () => {
    if (undoStack.length === 0) return;
    const { field } = getActiveTarget();
    const prevContent = undoStack[undoStack.length - 1];
    setRedoStack((prev) => [...prev, templateData[field] || ""]);
    setUndoStack((prev) => prev.slice(0, -1));
    setTemplateData((prev) => ({ ...prev, [field]: prevContent }));
  };

  const handleRedo = () => {
    if (redoStack.length === 0) return;
    const { field } = getActiveTarget();
    const nextContent = redoStack[redoStack.length - 1];
    setUndoStack((prev) => [...prev, templateData[field] || ""]);
    setRedoStack((prev) => prev.slice(0, -1));
    setTemplateData((prev) => ({ ...prev, [field]: nextContent }));
  };

  const applyLineAlignment = (alignment) => {
    if (editingSection === "header") {
      setTemplateData((prev) => ({ ...prev, top_alignment: alignment }));
      return;
    }

    const ed = contentEditableRef.current;
    if (ed) {
      ed.focus();
      if (savedRangeRef.current) {
        try {
          const sel = window.getSelection();
          sel.removeAllRanges();
          sel.addRange(savedRangeRef.current);
        } catch (e) {
          // Ignore
        }
      }
      let cmd = "justifyLeft";
      if (alignment === "center") cmd = "justifyCenter";
      else if (alignment === "right") cmd = "justifyRight";
      else if (alignment === "justify") cmd = "justifyFull";

      try {
        document.execCommand(cmd, false, null);
      } catch (e) {
        // Ignore
      }

      // Also directly apply textAlign style to current block node for instant visual alignment
      try {
        const sel = window.getSelection();
        if (sel && sel.anchorNode) {
          let node = sel.anchorNode;
          if (node.nodeType === 3) node = node.parentNode;
          while (node && node !== ed && !/^(DIV|P|H[1-6]|LI|TD|TH)$/i.test(node.tagName)) {
            node = node.parentNode;
          }
          if (node && node !== ed) {
            node.style.textAlign = alignment;
          }
        }
      } catch (e) {
        // Ignore
      }

      setCurrentAlign(alignment);
      saveCurrentRange();
      const bbcode = htmlToBbcode(ed.innerHTML);
      setTemplateData((prev) => ({
        ...prev,
        middle_content: bbcode,
      }));
      return;
    }

    const { field, textarea, start: selStart, end: selEnd } = getActiveTarget();
    const content = templateData[field] || "";

    const lines = content.split("\n");
    if (lines.length === 0) return;

    setUndoStack((prev) => [...prev.slice(-20), content]);
    setRedoStack([]);

    const textBeforeStart = content.slice(0, selStart);
    const startLineIdx = textBeforeStart.split("\n").length - 1;
    const textBeforeEnd = content.slice(0, selEnd);
    const endLineIdx = textBeforeEnd.split("\n").length - 1;

    const newLines = lines.map((line, idx) => {
      if (idx >= startLineIdx && idx <= endLineIdx) {
        let cleanText = line.replace(/^\s*\[(left|center|right|justify)\]([\s\S]*?)\[\/\1\]\s*$/i, "$2");
        cleanText = cleanText.replace(/\t+/g, " ").trim();
        const currentTagMatch = line.match(/^\s*\[(left|center|right|justify)\]/i);
        if (currentTagMatch && currentTagMatch[1].toLowerCase() === alignment) {
          return cleanText;
        }
        return `[${alignment}]${cleanText}[/${alignment}]`;
      }
      return line;
    });

    const newContent = newLines.join("\n");
    setTemplateData((prev) => ({
      ...prev,
      [field]: newContent,
    }));
  };
  // Consolidated State
  const [serviceData, setServiceData] = useState({
    name: "",
    description: "",
    price: "",
    college_id: "",
    is_active: true,
  });

  const [templateData, setTemplateData] = useState({
    top_content: "",
    middle_content: "",
    bottom_content: "",
    top_alignment: "center",
    middle_alignment: "left",
    bottom_alignment: "center",
    padding_left: 40,
    padding_right: 40,
    padding_top: 40,
    padding_bottom: 40,
    top_section_padding: 10,
    middle_section_padding: 20,
    bottom_section_padding: 10,
    header_height: 80,
    footer_height: 0,
    header_image_url: "",
    header_image_position: "left",
    header_image_height: 65,
    font_family: "Calibri",
    font_size: 12,
    font_bold: false,
    font_italic: false,
    font_underline: false,
    font_strikethrough: false,
    font_color: "var(--text-primary)",
    font_highlight: "transparent",
    line_spacing: 1.6,
    top_spacing: 15,
    middle_spacing: 15,
    bottom_spacing: 15,
    blank_variables: [],
    page_size: "A4",
    page_orientation: "portrait",
    input_field_size: 10,
  });

  // Keep contentEditable in sync with templateData.middle_content
  useEffect(() => {
    if (contentEditableRef.current) {
      if (
        document.activeElement === contentEditableRef.current ||
        contentEditableRef.current.contains(document.activeElement)
      ) {
        return;
      }
      const currentBbcode = htmlToBbcode(contentEditableRef.current.innerHTML);
      const incoming = templateData.middle_content || "";
      if (currentBbcode !== incoming) {
        contentEditableRef.current.innerHTML = bbcodeToHtml(incoming);
      }
    }
  }, [templateData.middle_content]);

  // Automatically strip any raw formatting tags or reset formatting to constant default when cleared
  useEffect(() => {
    if (!templateData.middle_content || templateData.middle_content.trim() === "") {
      if (
        templateData.font_bold ||
        templateData.font_italic ||
        templateData.font_underline ||
        templateData.font_strikethrough ||
        templateData.font_size !== 12 ||
        templateData.font_family !== "Calibri" ||
        templateData.font_color !== "var(--text-primary)" ||
        (templateData.font_highlight && templateData.font_highlight !== "transparent")
      ) {
        setTemplateData((prev) => ({
          ...prev,
          font_family: "Calibri",
          font_size: 12,
          font_bold: false,
          font_italic: false,
          font_underline: false,
          font_strikethrough: false,
          font_color: "var(--text-primary)",
          font_highlight: "transparent",
        }));
      }
    }
  }, [templateData.middle_content]);

  // Global listener to close floating ribbon dropdowns on click outside or escape key
  useEffect(() => {
    const handleGlobalClick = () => {
      setShowVariableDropdown(false);
      setShowFontColorDropdown(false);
      setShowHighlightDropdown(false);
      setShowCaseDropdown(false);
      setShowTableDropdown(false);
    };
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        handleGlobalClick();
      }
    };
    window.addEventListener("click", handleGlobalClick);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("click", handleGlobalClick);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  // Preview state for final review
  const [finalPreviewJson, setFinalPreviewJson] = useState(null);

  // Available variables for autocomplete
  const [variables, setVariables] = useState(DEFAULT_SYSTEM_VARIABLES);

  // Fetch variables on mount
  useEffect(() => {
    const fetchVariables = async () => {
      try {
        const response = await certificateTemplateService.getVariables();
        const list = response.data?.data?.systemVariables || response.data?.systemVariables || [];
        if (list.length > 0) setVariables(list);
      } catch (error) {
        console.error("Error fetching variables:", error);
      }
    };
    fetchVariables();
  }, []);

  useEffect(() => {
    const initializeData = async () => {
      await fetchColleges();
      if (editServiceId) {
        setIsEditing(true);
        await fetchServiceDetails(editServiceId);
      }
      setDataLoaded(true);
    };
    initializeData();
  }, [editServiceId]);

  useEffect(() => {
    if (currentStep === 3) {
      generatePreview();
    }
  }, [currentStep]);

  const fetchColleges = async () => {
    try {
      const response = await api.get("/colleges");
      const collegeData = response.data.data || [];
      setColleges(collegeData);
      return collegeData;
    } catch (error) {
      console.error(error);
      toast.error("Failed to load colleges");
      return [];
    }
  };

  const fetchServiceDetails = async (id) => {
    try {
      setLoading(true);

      // Fetch all services and find the one we need (backend doesn't have GET /services/:id)
      const servicesResponse = await serviceService.getAllServices();
      const service = servicesResponse.data.find((s) => s.id == id);

      if (!service) {
        toast.error("Service not found");
        navigate("/services/config");
        return;
      }

      setServiceData({
        name: service.name,
        description: service.description || "",
        price: service.price,
        college_id: "", // Will be set from template
        is_active: !!service.is_active,
      });

      // Fetch template to get college_id
      const templatesRes = await certificateTemplateService.getTemplates({
        service_id: id,
      });

      if (templatesRes.data && templatesRes.data.length > 0) {
        const template = templatesRes.data[0];
        const templateCollegeId = template.college_id
          ? String(template.college_id)
          : "";

        // Update serviceData with college_id from template
        setServiceData((prev) => ({
          ...prev,
          college_id: templateCollegeId,
        }));

        setTemplateData({
          top_content: template.top_content || "",
          middle_content: template.middle_content || "",
          bottom_content: template.bottom_content || "",
          top_alignment: template.top_alignment || "center",
          middle_alignment: template.middle_alignment || "left",
          bottom_alignment: template.bottom_alignment || "center",
          padding_left: template.padding_left || 40,
          padding_right: template.padding_right || 40,
          padding_top: template.padding_top || 40,
          padding_bottom: template.padding_bottom || 40,
          header_height: template.header_height || 80,
          footer_height: template.footer_height || 0,
          header_image_url: template.header_image_url || "",
          header_image_position: template.header_image_position || "left",
          header_image_height: template.header_image_height || 65,
          font_family: template.font_family || "Calibri",
          font_size: template.font_size || 12,
          font_bold: !!template.font_bold,
          font_italic: !!template.font_italic,
          font_underline: !!template.font_underline,
          font_strikethrough: !!template.font_strikethrough,
          font_color: template.font_color || "var(--text-primary)",
          font_highlight: template.font_highlight || "transparent",
          line_spacing: template.line_spacing || 1.6,
          input_field_size: template.input_field_size || 10,
          blank_variables: template.blank_variables || [],
          page_size: template.page_size || "A4",
          page_orientation: template.page_orientation || "portrait",
          college_id: templateCollegeId,
        });
        setActiveFontFamily(normalizeFamily(template.font_family || "Calibri"));
        setActiveFontSize(template.font_size || 12);
        setActiveBold(!!template.font_bold);
        setActiveItalic(!!template.font_italic);
        setActiveUnderline(!!template.font_underline);
        setActiveStrike(!!template.font_strikethrough);
      }
    } catch (error) {
      console.error("Error fetching details:", error);
      toast.error("Failed to load service details");
    } finally {
      setLoading(false);
    }
  };

  const handleStep1Submit = () => {
    if (!serviceData.name || !serviceData.price || !serviceData.college_id) {
      toast.error("Please fill all required fields");
      return;
    }
    const selectedCollege = colleges.find(c => String(c.id) === String(serviceData.college_id));
    const collegeMeta = selectedCollege?.metadata || {};
    const defaultDynamicHeader =
      collegeMeta.header_content ||
      `[center][b][size:16]${(selectedCollege?.name || "PYDAH COLLEGE").toUpperCase()}[/size][/b][/center]\n[center][size:10](Approved by AICTE, Affiliated to Andhra University, Accredited by NAAC 'A+' Grade)[/size][/center]\n[center][size:9]${selectedCollege?.address || 'Kakinada - 533001, Andhra Pradesh'} | Phone: ${selectedCollege?.contact || '+91 884 237 9999'} | Website: ${selectedCollege?.website || 'www.pydah.edu.in'}[/size][/center]\n----------------------------------------`;

    // In wizard, just move to next step, don't save yet
    setTemplateData((prev) => ({
      ...prev,
      college_id: serviceData.college_id,
      top_content: prev.top_content && prev.top_content.trim() ? prev.top_content : defaultDynamicHeader,
    }));
    setCurrentStep(2);
  };

  const handleStep2Submit = () => {
    // Validation for Step 2
    if (!templateData.middle_content) {
      toast.error("Middle section content is required");
      return;
    }
    // Skip to step 3 (final review) directly
    setCurrentStep(3);
    generatePreview();
  };

  const generatePreview = async () => {
    // Logic to prepare preview URL for final review
    try {
      const selectedCollegeId = serviceData.college_id || templateData.college_id;
      const cleanConfig = prepareConfigForBackend({
        ...templateData,
        college_id: selectedCollegeId,
      });
      const blob = await serviceService.previewTemplate({
        template_type: "dynamic",
        service_name: serviceData.name,
        college_id: selectedCollegeId,
        template_config: cleanConfig,
      });
      const url = URL.createObjectURL(blob);
      setFinalPreviewJson(url);
    } catch (e) {
      console.error("Preview generation error:", e);
      toast.error("Failed to generate preview: " + (e.response?.data?.message || e.message));
    }
  };

  const handleFinalSubmit = async () => {
    try {
      setLoading(true);
      const toastId = toast.loading(
        isEditing ? "Updating service..." : "Creating service...",
      );

      let serviceId = editServiceId;

      const cleanConfig = prepareConfigForBackend(templateData);

      // 1. Create/Update Service (without college_id - that's stored in template)
      const servicePayload = {
        name: serviceData.name,
        description: serviceData.description,
        price: serviceData.price,
        is_active: serviceData.is_active,
        template_type: "dynamic",
        template_config: cleanConfig,
      };

      if (isEditing) {
        await serviceService.updateService(serviceId, servicePayload);
      } else {
        const serviceResponse =
          await serviceService.createService(servicePayload);
        serviceId =
          serviceResponse.serviceId ||
          serviceResponse.data?.id ||
          serviceResponse.id;
      }

      if (!serviceId) throw new Error("Failed to get Service ID");

      // 2. Create/Update Template (college_id is stored here)
      const templatesRes = await certificateTemplateService.getTemplates({
        service_id: serviceId,
      });
      const existingTemplate =
        templatesRes.data && templatesRes.data.length > 0
          ? templatesRes.data[0]
          : null;

      const finalTemplateData = {
        ...cleanConfig,
        service_id: serviceId,
        college_id: serviceData.college_id, // Store college_id in template table
      };

      if (existingTemplate) {
        await certificateTemplateService.updateTemplate(
          existingTemplate.id,
          finalTemplateData,
        );
      } else {
        await certificateTemplateService.createTemplate(finalTemplateData);
      }

      toast.dismiss(toastId);
      toast.success(
        `Service ${isEditing ? "updated" : "created"} successfully!`,
      );
      navigate("/services/config");
    } catch (error) {
      console.error(error);
      toast.error(error.response?.data?.message || "Failed to save service");
    } finally {
      setLoading(false);
    }
  };

  const renderStepIndicator = () => {
    const steps = [
      { num: 1, label: "Service Info" },
      { num: 2, label: "Certificate Content" },
      { num: 3, label: "Review & Save" },
    ];

    return (
      <div className="flex items-center justify-center mb-8">
        {steps.map((step, index) => (
          <React.Fragment key={step.num}>
            <div className="flex flex-col items-center">
              <div
                className={`flex items-center justify-center w-10 h-10 rounded-full border-2 transition ${
                  currentStep >= step.num
                    ? "bg-primary border-primary text-white"
                    : "bg-surface border-border-strong text-muted-text"
                }`}
              >
                {currentStep > step.num ? <Check size={20} /> : index + 1}
              </div>
              <span className="text-xs mt-1 text-sub">{step.label}</span>
            </div>
            {index < steps.length - 1 && (
              <div
                className={`w-16 h-1 transition mb-6 ${
                  currentStep > step.num ? "bg-primary" : "bg-background"
                }`}
              />
            )}
          </React.Fragment>
        ))}
      </div>
    );
  };

  const renderStep1 = () => {
    if (isEditing && !dataLoaded) {
      return (
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-sub">Loading service details...</p>
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold text-main flex items-center justify-center gap-2">
            <FileText size={28} className="text-primary" />
            Service Details
          </h2>
          <p className="text-muted-text mt-2">
            Enter basic information about the service
          </p>
        </div>

        <div className="bg-surface p-6 sm:p-8 rounded-2xl shadow-sm border border-border space-y-5 w-full">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-sm font-semibold text-sub mb-2">
                Service Name <span className="text-danger">*</span>
              </label>
              <input
                type="text"
                value={serviceData.name}
                onChange={(e) => {
                  // Restriction: only letters and spaces allowed
                  const lettersOnly = e.target.value.replace(/[^a-zA-Z\s]/g, "");
                  setServiceData({ ...serviceData, name: lettersOnly });
                }}
                className="w-full px-4 py-2.5 border border-border-strong rounded-xl focus:ring-2 focus:ring-primary focus:border-primary outline-none transition"
                placeholder="e.g., Transfer Certificate (Letters only)"
              />
              <p className="text-[11px] text-muted-text mt-1">
                Letters only restriction: only alphabetic characters and spaces are allowed.
              </p>
            </div>

            <div>
              <label className="block text-sm font-semibold text-sub mb-2">
                Select College <span className="text-danger">*</span>
              </label>
              <select
                value={serviceData.college_id || ""}
                onChange={(e) =>
                  setServiceData({ ...serviceData, college_id: e.target.value })
                }
                className="w-full px-4 py-2.5 border border-border-strong rounded-xl focus:ring-2 focus:ring-primary focus:border-primary outline-none transition bg-surface"
              >
                <option value="">-- Choose a college --</option>
                {colleges.map((college) => {
                  const optionValue = String(college.id);
                  return (
                    <option key={college.id} value={optionValue}>
                      {college.name}
                    </option>
                  );
                })}
              </select>
              <p className="text-xs text-muted-text mt-1.5">
                The certificate will use this college's dynamic header letterhead
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 items-center">
            <div>
              <label className="block text-sm font-semibold text-sub mb-2">
                Price (₹) <span className="text-danger">*</span>
              </label>
              <input
                type="number"
                value={serviceData.price}
                onChange={(e) =>
                  setServiceData({ ...serviceData, price: e.target.value })
                }
                className="w-full px-4 py-2.5 border border-border-strong rounded-xl focus:ring-2 focus:ring-primary focus:border-primary outline-none transition"
                placeholder="e.g., 100"
              />
            </div>

            <div className="pt-2 sm:pt-6">
              <label className="flex items-center gap-3 p-3 bg-background border border-border rounded-xl cursor-pointer hover:bg-background transition">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={serviceData.is_active}
                  onChange={(e) =>
                    setServiceData({ ...serviceData, is_active: e.target.checked })
                  }
                  className="w-5 h-5 text-primary rounded focus:ring-primary cursor-pointer"
                />
                <div>
                  <span className="text-sm font-semibold text-main block">
                    Active Service
                  </span>
                  <span className="text-xs text-muted-text">
                    Immediately available to students in the portal
                  </span>
                </div>
              </label>
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-sub mb-2">
              Description
            </label>
            <textarea
              value={serviceData.description}
              onChange={(e) =>
                setServiceData({ ...serviceData, description: e.target.value })
              }
              className="w-full px-4 py-2.5 border border-border-strong rounded-xl focus:ring-2 focus:ring-primary focus:border-primary outline-none transition"
              rows="3"
              placeholder="Brief description of the service"
            />
          </div>
        </div>

        <div className="flex justify-between">
          <button
            onClick={() => navigate("/services/config")}
            className="px-6 py-2 border border-border-strong rounded-lg hover:bg-background flex items-center gap-2"
          >
            <ArrowLeft size={18} /> Cancel
          </button>
          <button
            onClick={handleStep1Submit}
            disabled={loading}
            className="px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover flex items-center gap-2 disabled:opacity-50"
          >
            Next: Certificate Content <ArrowRight size={18} />
          </button>
        </div>
      </div>
    );
  };

const renderStep2 = () => {
    // College header information
    const selectedCollege = colleges.find(
      (c) => String(c.id) === String(serviceData.college_id),
    );
    const baseURL = (
      api.defaults?.baseURL || "http://localhost:5000/api"
    ).replace(/\/api$/, "");

    const getImageUrl = (url) => {
      if (!url) return null;
      return url.startsWith("http")
        ? url
        : `${baseURL}${url.startsWith("/") ? "" : "/"}${url}`;
    };

    const footerImageUrl = null;

    // Format variables for react-mentions (including principal_signature)
    const activeVariables =
      variables && variables.length > 0 ? variables : DEFAULT_SYSTEM_VARIABLES;
    const mentionData = [
      ...activeVariables.map((v) => ({
        id: v.name,
        display: `@${v.name}`,
      })),
      {
        id: "principal_signature",
        display: "@principal_signature",
      },
    ].filter((v, i, self) => self.findIndex((t) => t.id === v.id) === i);

    // Calculate document statistics
    const rawContent = templateData.middle_content || "";
    const wordCount = rawContent.trim()
      ? rawContent.trim().split(/\s+/).length
      : 0;
    const charCount = rawContent.length;

    // Sheet size definitions and calculations
    const SHEET_CONFIGS = {
      A4: { label: "A4", width: 794, height: 1123, mm: "210 × 297 mm" },
      A5: { label: "A5", width: 559, height: 794, mm: "148 × 210 mm" },
      A3: { label: "A3", width: 1123, height: 1587, mm: "297 × 420 mm" },
      Letter: { label: "Letter", width: 816, height: 1056, mm: "8.5 × 11 in" },
      Legal: { label: "Legal", width: 816, height: 1344, mm: "8.5 × 14 in" },
    };

    const activeSheetKey =
      (templateData.page_size || "A4").toUpperCase() === "A5"
        ? "A5"
        : (templateData.page_size || "A4").toUpperCase() === "A3"
          ? "A3"
          : (templateData.page_size || "A4").toLowerCase() === "letter"
            ? "Letter"
            : (templateData.page_size || "A4").toLowerCase() === "legal"
              ? "Legal"
              : "A4";

    const activeSheet = SHEET_CONFIGS[activeSheetKey] || SHEET_CONFIGS.A4;
    const isLandscape =
      (templateData.page_orientation || "portrait").toLowerCase() === "landscape";
    const canvasSheetWidth = isLandscape ? activeSheet.height : activeSheet.width;
    const canvasSheetHeight = isLandscape ? activeSheet.width : activeSheet.height;

    // Mention style for autocomplete with whitespace preservation
    const getMentionStyle = (alignment = "center") => {
      const isContentEmpty = !templateData.middle_content || templateData.middle_content.trim() === "";
      const activeFontFamily = isContentEmpty
        ? "Calibri, 'Segoe UI', Arial, sans-serif"
        : templateData.font_family || "Calibri, 'Segoe UI', Arial, sans-serif";
      const activeFontSize = isContentEmpty ? "12px" : `${templateData.font_size || 12}px`;
      const activeLineHeight = isContentEmpty ? 1.6 : templateData.line_spacing || 1.6;
      const activeFontWeight = isContentEmpty ? "normal" : templateData.font_bold ? "bold" : "normal";
      const activeFontStyle = isContentEmpty ? "normal" : templateData.font_italic ? "italic" : "normal";
      const activeTextDecoration = isContentEmpty
        ? "none"
        : [
            templateData.font_underline ? "underline" : "",
            templateData.font_strikethrough ? "line-through" : "",
          ]
            .filter(Boolean)
            .join(" ") || "none";
      const activeColor = isContentEmpty ? "var(--text-primary)" : templateData.font_color || "var(--text-primary)";
      const activeBgColor = isContentEmpty
        ? "transparent"
        : templateData.font_highlight && templateData.font_highlight !== "transparent"
          ? templateData.font_highlight
          : "transparent";

      return {
        control: {
          backgroundColor: activeBgColor,
          fontSize: activeFontSize,
          fontFamily: activeFontFamily,
          lineHeight: activeLineHeight,
          fontWeight: activeFontWeight,
          fontStyle: activeFontStyle,
          textDecoration: activeTextDecoration,
          color: activeColor,
          minHeight: 420,
          border: "none",
          padding: 0,
          textAlign: alignment,
          whiteSpace: "pre-wrap",
        },
        highlighter: {
          overflow: "hidden",
          padding: 0,
          textAlign: alignment,
          whiteSpace: "pre-wrap",
          fontSize: activeFontSize,
          fontFamily: activeFontFamily,
          lineHeight: activeLineHeight,
          fontWeight: activeFontWeight,
          fontStyle: activeFontStyle,
          textDecoration: activeTextDecoration,
          color: activeColor,
        },
        input: {
          margin: 0,
          padding: 0,
          border: 0,
          outline: 0,
          textAlign: alignment,
          whiteSpace: "pre-wrap",
          fontFamily: activeFontFamily,
          fontSize: activeFontSize,
          lineHeight: activeLineHeight,
          fontWeight: activeFontWeight,
          fontStyle: activeFontStyle,
          textDecoration: activeTextDecoration,
          color: activeColor,
        },
        suggestions: {
          list: {
            backgroundColor: "var(--surface)",
            border: "1px solid var(--primary-light)",
            borderRadius: "0.5rem",
            boxShadow:
              "0 10px 25px -5px rgba(0, 0, 0, 0.2), 0 8px 10px -6px rgba(0, 0, 0, 0.1)",
            maxHeight: 260,
            overflow: "auto",
            zIndex: 9999,
            padding: "4px 0",
          },
          item: {
            padding: "7px 12px",
            borderBottom: "1px solid var(--background)",
            fontSize: "12px",
            color: "var(--primary)",
            "&focused": {
              backgroundColor: "var(--primary-light)",
              fontWeight: 600,
            },
          },
        },
      };
    };

    // Render dynamic college header with typography, styling, and header image/logo
    const renderHeaderLines = (content) => {
      // If college has an official graphical header image, render it directly to avoid duplicate text headers
      if (selectedCollege?.header_image_url) {
        const fullHeaderUrl = getImageUrl(selectedCollege.header_image_url);
        return (
          <div className="w-full flex justify-center pb-1">
            <img
              src={fullHeaderUrl}
              alt={selectedCollege?.name || "College Header"}
              className="w-full object-contain"
              style={{ maxHeight: `${templateData.header_height || 90}px` }}
              onError={(e) => {
                e.currentTarget.style.display = "none";
              }}
            />
          </div>
        );
      }
      const headerText =
        content && content.trim()
          ? content
          : selectedCollege?.metadata?.header_content ||
            `[center][b][size:16]${(selectedCollege?.name || "PYDAH COLLEGE").toUpperCase()}[/size][/b][/center]\n[center][size:10](Approved by AICTE, Affiliated to Andhra University, Accredited by NAAC 'A+' Grade)[/size][/center]\n----------------------------------------`;

      const lines = headerText
        .replace(/\r\n/g, "\n")
        .replace(/\r/g, "\n")
        .split("\n");

      const headerImgUrl = templateData.header_image_url || null;
      const imgPos = templateData.header_image_position || "left";
      const imgHeight = templateData.header_image_height || 65;

      const textBlock = (
        <div
          className="flex-1 flex flex-col justify-center"
          style={{
            fontFamily: "Calibri, 'Segoe UI', Arial, sans-serif",
            fontSize: "12px",
            fontWeight: "normal",
            fontStyle: "normal",
            textDecoration: "none",
            color: "var(--text-primary)",
          }}
        >
          {lines.map((line, idx) => {
            let text = line.trim();
            if (!text) return <div key={idx} className="h-1" />;

            // Divider rule (--- or ===)
            if (/^[-=_*]{3,}$/.test(text)) {
              return (
                <div
                  key={idx}
                  className="my-1 border-b-2 border-primary w-full"
                />
              );
            }

            let align = "center";
            const alignMatch = text.match(
              /^\s*\[(left|center|right|justify)\]([\s\S]*?)\[\/\1\]\s*$/i,
            );
            if (alignMatch) {
              align = alignMatch[1].toLowerCase();
              text = alignMatch[2];
            }

            let html = text
              .replace(/&/g, "&amp;")
              .replace(/</g, "&lt;")
              .replace(/>/g, "&gt;");

            // Format tags
            html = html
              .replace(/\[(?:b|bold)\]([\s\S]*?)\[\/(?:b|bold)\]/gi, "<strong>$1</strong>")
              .replace(/\[(?:i|italic)\]([\s\S]*?)\[\/(?:i|italic)\]/gi, "<em>$1</em>")
              .replace(/\[(?:u|underline)\]([\s\S]*?)\[\/(?:u|underline)\]/gi, "<span style=\"text-decoration: underline;\">$1</span>")
              .replace(/\[(?:s|strike)\]([\s\S]*?)\[\/(?:s|strike)\]/gi, "<del>$1</del>")
              .replace(/\[sub\]([\s\S]*?)\[\/sub\]/gi, "<sub>$1</sub>")
              .replace(/\[sup\]([\s\S]*?)\[\/sup\]/gi, "<sup>$1</sup>")
              .replace(/\[size:(\d+(?:\.\d+)?)\]([\s\S]*?)\[\/size\]/gi, "<span style=\"font-size: $1px;\">$2</span>")
              .replace(/\[color:([^\]]+)\]([\s\S]*?)\[\/color\]/gi, "<span style=\"color: $1;\">$2</span>")
              .replace(/\[highlight:([^\]]+)\]([\s\S]*?)\[\/highlight\]/gi, "<span style=\"background-color: $1; padding: 0 2px; border-radius: 2px;\">$2</span>");

            return (
              <div
                key={idx}
                style={{
                  textAlign: align,
                  lineHeight: 1.35,
                }}
                dangerouslySetInnerHTML={{ __html: html }}
              />
            );
          })}
        </div>
      );

      const imageElement = headerImgUrl ? (
        <div className="flex-shrink-0 flex items-center justify-center p-1">
          <img
            src={headerImgUrl}
            alt="Header Logo"
            style={{
              maxHeight: `${imgHeight}px`,
              maxWidth: "180px",
              objectFit: "contain",
            }}
            className="drop-shadow-xs"
            onError={(e) => {
              e.currentTarget.style.display = "none";
            }}
          />
        </div>
      ) : null;

      if (!headerImgUrl) {
        return (
          <div
            className="w-full flex flex-col justify-center"
            style={{ minHeight: `${templateData.header_height || 80}px` }}
          >
            {textBlock}
          </div>
        );
      }

      if (imgPos === "center") {
        return (
          <div
            className="w-full flex flex-col items-center justify-center"
            style={{ minHeight: `${templateData.header_height || 80}px` }}
          >
            {imageElement}
            <div className="w-full mt-1">{textBlock}</div>
          </div>
        );
      }

      if (imgPos === "right") {
        return (
          <div
            className="w-full flex items-center justify-between gap-4"
            style={{ minHeight: `${templateData.header_height || 80}px` }}
          >
            <div className="flex-1">{textBlock}</div>
            {imageElement}
          </div>
        );
      }

      // Default: 'left'
      return (
        <div
          className="w-full flex items-center justify-between gap-4"
          style={{ minHeight: `${templateData.header_height || 80}px` }}
        >
          {imageElement}
          <div className="flex-1">{textBlock}</div>
        </div>
      );
    };

        // Process content to show input fields for ___ and replace @ variables with individual line alignment
    const processContentForPreview = (content, defaultAlignment = "left") => {
      if (!content) return "";

      let formattedContent = content
        .replace(/\[th\]([\s\S]*?)\[\/th\]/gi, (m, inner) => `<th style="border: 1px solid var(--text-muted); padding: 6px 10px; background-color: var(--background); font-weight: bold; text-align: left;">${inner}</th>`)
        .replace(/\[td\]([\s\S]*?)\[\/td\]/gi, (m, inner) => `<td style="border: 1px solid var(--border-strong); padding: 6px 10px; text-align: left;">${inner}</td>`)
        .replace(/\[tr\]([\s\S]*?)\[\/tr\]/gi, (m, inner) => `<tr>${inner}</tr>`)
        .replace(/\[table\]([\s\S]*?)\[\/table\]/gi, (m, inner) => {
          return `<table class="word-canvas-table" style="width: 100%; border-collapse: collapse; margin: 12px 0; border: 1px solid var(--text-muted);">${inner.trim()}</table>`;
        });

      const rawLines = formattedContent
        .replace(/\r\n/g, "\n")
        .replace(/\r/g, "\n")
        .split("\n");

      let inNumbered = false;
      let numCounter = 1;

      return (
        <div className="w-full">
          {rawLines.map((line, idx) => {
            const trimmed = line.trim();
            if (/^\[list=1\]$/i.test(trimmed)) {
              inNumbered = true;
              numCounter = 1;
              return null;
            }
            if (/^\[list\]$/i.test(trimmed)) {
              inNumbered = false;
              return null;
            }
            if (/^\[\/list\]$/i.test(trimmed)) {
              inNumbered = false;
              return null;
            }

            let lineAlign = defaultAlignment;
            let text = line.replace(/[\t\r]/g, " ");

            if (/^\[\*\]/i.test(trimmed)) {
              if (inNumbered) {
                text = text.replace(/^\s*\[\*\]\s*/i, `${numCounter}. `);
                numCounter++;
              } else {
                text = text.replace(/^\s*\[\*\]\s*/i, "• ");
              }
            }

            // Horizontal divider rule
            if (/^[-=_*]{3,}$/.test(text.trim())) {
              return (
                <div
                  key={idx}
                  className="my-2 border-b-2 border-border-strong w-full"
                />
              );
            }

            const tagMatch = text.match(
              /^\s*\[(left|center|right|justify)\]([\s\S]*?)\[\/\1\]\s*$/i,
            );
            if (tagMatch) {
              lineAlign = tagMatch[1].toLowerCase();
              text = tagMatch[2];
            }

            if (lineAlign === "right" || lineAlign === "center") {
              text = text.trim();
            }

            let processed = text
              .replace(/&/g, "&amp;")
              .replace(/</g, "&lt;")
              .replace(/>/g, "&gt;");

            // Preserve leading spaces as non-breaking spaces for preview indentation
            const leadingSpaces = processed.match(/^ +/);
            if (leadingSpaces) {
              const count = leadingSpaces[0].length;
              processed = "&nbsp;".repeat(count) + processed.slice(count);
            }

            // Format tags: font, bold, italic, underline, strikethrough, subscript, superscript, size, color, highlight
            processed = processed
              .replace(/\[font:([^\]]+)\]([\s\S]*?)\[\/font\]/gi, "<span style=\"font-family: $1;\">$2</span>")
              .replace(/\[(?:b|bold)\]([\s\S]*?)\[\/(?:b|bold)\]/gi, "<strong>$1</strong>")
              .replace(/\[(?:i|italic)\]([\s\S]*?)\[\/(?:i|italic)\]/gi, "<em>$1</em>")
              .replace(/\[(?:u|underline)\]([\s\S]*?)\[\/(?:u|underline)\]/gi, "<span style=\"text-decoration: underline;\">$1</span>")
              .replace(/\[(?:s|strike)\]([\s\S]*?)\[\/(?:s|strike)\]/gi, "<del>$1</del>")
              .replace(/\[sub\]([\s\S]*?)\[\/sub\]/gi, "<sub>$1</sub>")
              .replace(/\[sup\]([\s\S]*?)\[\/sup\]/gi, "<sup>$1</sup>")
              .replace(/\[size:(\d+(?:\.\d+)?)\]([\s\S]*?)\[\/size\]/gi, "<span style=\"font-size: $1px;\">$2</span>")
              .replace(/\[color:([^\]]+)\]([\s\S]*?)\[\/color\]/gi, "<span style=\"color: $1;\">$2</span>")
              .replace(/\[highlight:([^\]]+)\]([\s\S]*?)\[\/highlight\]/gi, "<span style=\"background-color: $1; padding: 0 2px; border-radius: 2px;\">$2</span>");

            // Represent all @ variables with specific fixed length for each field
            const replaceVariableWithSpec = (varKey, rawMatch) => {
              const cleanKey = varKey.replace(/^@/, "").trim();
              const spec = VARIABLE_SPECS[cleanKey] || {
                fixedChars: 12,
                minWidth: 80,
              };
              if (cleanKey === "principal_signature") {
                return `<span class="inline-block border-b-2 border-border-strong text-center font-semibold text-main mx-1 px-2" style="min-width: 140px;">[Principal Signature]</span>`;
              }
              return `<span class="inline-block border-b-2 border-primary font-bold text-primary mx-0.5 px-1 bg-[var(--primary-light)] text-center underline underline-offset-4 decoration-primary decoration-2" style="min-width: ${spec.minWidth}px;" title="Variable: @${cleanKey} (${spec.fixedChars} chars)">@${cleanKey}</span>`;
            };

            // 1. Handle react-mentions syntax: @[@display](id) or @[display](id)
            processed = processed.replace(
              /@[\[@]?(?:@)?([^\]]+)\]\(([^\)]+)\)/g,
              (match, display, id) => {
                return replaceVariableWithSpec(id || display, match);
              },
            );

            // 2. Handle handlebars syntax: {{varName}}
            processed = processed.replace(/{{([^}]+)}}/g, (match, varName) => {
              return replaceVariableWithSpec(varName, match);
            });

            // 3. Handle standard @varName syntax
            processed = processed.replace(/@(\w+)/g, (match, varName) => {
              return replaceVariableWithSpec(varName, match);
            });

            const inputSize = templateData.input_field_size || 10;
            // Clean, fitting underline
            processed = processed.replace(
              /(?:___(?:\[(\d+)\])?(?:&nbsp;|\s)*)+|_{3,}/g,
              (match) => {
                const isMulti =
                  match.includes("&nbsp;") ||
                  match.includes(" ") ||
                  match.length > 5;
                const width = isMulti
                  ? Math.min(Math.max(inputSize * 8, 80), 130)
                  : Math.min(Math.max(inputSize * 5, 45), 75);
                return `<span class="inline-block border-b border-border-strong align-baseline mx-1" style="min-width:${width}px;height:1em;" title="Input Field">&nbsp;</span>`;
              },
            );
            processed = processed.replace(
              /(?:___(?:\[(\d+)\])?(?:&nbsp;|\s)*)+|_{3,}/g,
              (match) => {
                const isMulti =
                  match.includes("&nbsp;") ||
                  match.includes(" ") ||
                  match.length > 5;
                const width = isMulti
                  ? Math.min(Math.max(inputSize * 8, 80), 130)
                  : Math.min(Math.max(inputSize * 5, 45), 75);
                return `<span class="inline-block border-b border-border-strong align-baseline mx-1" style="min-width:${width}px;height:1em;" title="Input Field">&nbsp;</span>`;
              },
            );

            return (
              <div
                key={idx}
                style={{
                  textAlign: lineAlign,
                  minHeight: "1.3em",
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                }}
                dangerouslySetInnerHTML={{ __html: processed || "&nbsp;" }}
              />
            );
          })}
        </div>
      );
    };

    // Filter variables for the "Insert Variable" dropdown
    const filteredVariables = activeVariables.filter((v) => {
      const q = variableSearchQuery.toLowerCase();
      return (
        v.name.toLowerCase().includes(q) ||
        (v.label && v.label.toLowerCase().includes(q))
      );
    });

    const studentVars = filteredVariables.filter((v) =>
      ["student_name", "name", "admission_number", "pin_no", "ht_no"].includes(v.name),
    );
    const academicVars = filteredVariables.filter((v) =>
      [
        "course",
        "branch",
        "academic_year",
        "current_year",
        "year",
        "current_semester",
        "semester",
        "admission_date",
      ].includes(v.name),
    );
    const personalVars = filteredVariables.filter((v) =>
      [
        "father_name",
        "mother_name",
        "guardian_name",
        "dob",
        "date_of_birth",
        "gender",
        "caste",
        "religion",
        "student_mobile",
        "phone_number",
      ].includes(v.name),
    );
    const institutionalVars = filteredVariables.filter((v) =>
      [
        "college_name",
        "current_date",
        "date",
        "principal_signature",
      ].includes(v.name),
    );

    return (
      <div
        className="fixed top-0 right-0 bottom-0 left-0 lg:left-64 flex flex-col bg-[var(--primary-light)] overflow-hidden z-50 select-none font-sans"
        onClick={() => {
          if (showVariableDropdown) setShowVariableDropdown(false);
          if (showFontColorDropdown) setShowFontColorDropdown(false);
          if (showHighlightDropdown) setShowHighlightDropdown(false);
          if (showCaseDropdown) setShowCaseDropdown(false);
        }}
      >
        {/* ============================================================== */}
        {/* 1. MICROSOFT WORD APP TITLE BAR                                */}
        {/* ============================================================== */}
        <div className="bg-[var(--primary)] text-white px-3 py-1.5 flex items-center justify-between shadow-md flex-shrink-0">
          {/* Left: Word Icon, File Name & Quick Access */}
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 bg-surface rounded flex items-center justify-center shadow-xs">
              <span className="text-[var(--primary)] font-black text-sm tracking-tighter">W</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-xs tracking-wide text-white">
                {serviceData.name ? `${serviceData.name} - Certificate` : "Document1"}
              </span>
              <span className="text-primary text-[11px]">- Microsoft Word</span>
              <span className="ml-1 px-1.5 py-0.5 bg-[var(--primary-light)] rounded text-[10px] text-primary flex items-center gap-1 font-medium">
                <CheckCircle size={10} className="text-success" /> AutoSaved
              </span>
            </div>

            {/* Quick Access Toolbar */}
            <div className="flex items-center gap-0.5 ml-2 border-l border-primary pl-2">
              <button
                type="button"
                onClick={handleUndo}
                title="Undo (Ctrl+Z)"
                className="p-1 hover:bg-[var(--primary-light)] rounded text-primary hover:text-white transition"
              >
                <RotateCcw size={13} />
              </button>
              <button
                type="button"
                onClick={handleRedo}
                title="Redo (Ctrl+Y)"
                className="p-1 hover:bg-[var(--primary-light)] rounded text-primary hover:text-white transition"
              >
                <RotateCw size={13} />
              </button>
            </div>
          </div>

          {/* Center: View Mode Switcher Pills */}
          <div className="flex items-center bg-[var(--primary-light)] p-0.5 rounded-lg border border-primary text-xs">
            <button
              type="button"
              onClick={() => setViewMode("word-canvas")}
              className={`px-3 py-1 rounded-md text-xs font-semibold flex items-center gap-1.5 transition ${
                viewMode === "word-canvas"
                  ? "bg-surface text-[var(--primary)] shadow-xs"
                  : "text-primary hover:text-white hover:bg-[var(--primary-light)]"
              }`}
              title="Full Microsoft Word Document Canvas (WYSIWYG on Paper)"
            >
              <FileText size={13} /> Word Canvas
            </button>
            <button
              type="button"
              onClick={() => setViewMode("split")}
              className={`px-3 py-1 rounded-md text-xs font-semibold flex items-center gap-1.5 transition ${
                viewMode === "split"
                  ? "bg-surface text-[var(--primary)] shadow-xs"
                  : "text-primary hover:text-white hover:bg-[var(--primary-light)]"
              }`}
              title="Side-by-Side: Word Editor on Left, Live Result on Right"
            >
              <Columns size={13} /> Split View
            </button>
            <button
              type="button"
              onClick={() => setViewMode("preview")}
              className={`px-3 py-1 rounded-md text-xs font-semibold flex items-center gap-1.5 transition ${
                viewMode === "preview"
                  ? "bg-surface text-[var(--primary)] shadow-xs"
                  : "text-primary hover:text-white hover:bg-[var(--primary-light)]"
              }`}
              title="Full Print Layout Preview"
            >
              <Eye size={13} /> Print Preview
            </button>
          </div>

          {/* Right: Step Navigation Actions */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setCurrentStep(1)}
              className="px-3 py-1 bg-[var(--primary-light)] hover:bg-primary-hover text-white rounded-md text-xs font-medium flex items-center gap-1.5 transition border border-primary"
            >
              <ArrowLeft size={13} /> Back
            </button>
            <button
              type="button"
              onClick={handleStep2Submit}
              className="px-3.5 py-1 bg-success hover:bg-success text-white rounded-md text-xs font-bold flex items-center gap-1.5 transition shadow-xs"
            >
              Save & Preview <Check size={14} />
            </button>
          </div>
        </div>

        {/* ============================================================== */}
        {/* 2. MICROSOFT WORD RIBBON MENU TABS                             */}
        {/* ============================================================== */}
        <div className="bg-[var(--background)] border-b border-[var(--border)] px-3 flex items-center justify-between text-xs flex-shrink-0 select-none">
          <div className="flex items-center gap-0.5">
            {[
              { id: "home", label: "Home" },
              { id: "insert", label: "Insert" },
              { id: "layout", label: "Layout" },
              { id: "view", label: "View" },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveRibbonTab(tab.id)}
                className={`px-4 py-1.5 font-medium transition text-xs border-t-2 ${
                  activeRibbonTab === tab.id
                    ? "bg-surface text-[var(--primary)] font-bold border-t-[var(--primary)] border-x border-x-[var(--border)] -mb-px shadow-2xs"
                    : "border-t-transparent text-sub hover:bg-[var(--warning-light)] hover:text-main"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Target Section Switcher: Certificate Body vs College Header */}
          <div className="flex items-center bg-[var(--background)]/80 p-0.5 rounded-lg border border-border-strong">
            <button
              type="button"
              onClick={() => setEditingSection("body")}
              className={`px-2.5 py-1 rounded text-xs font-bold flex items-center gap-1.5 transition ${
                editingSection === "body"
                  ? "bg-surface text-primary shadow-xs"
                  : "text-sub hover:text-main"
              }`}
            >
              <FileText size={12} /> Certificate Body
            </button>
            <button
              type="button"
              onClick={() => setEditingSection("header")}
              className={`px-2.5 py-1 rounded text-xs font-bold flex items-center gap-1.5 transition ${
                editingSection === "header"
                  ? "bg-primary text-white shadow-xs"
                  : "text-sub hover:text-main"
              }`}
            >
              <Building2 size={12} /> Dynamic College Header
            </button>
          </div>
        </div>

        {/* ============================================================== */}
        {/* 3. MICROSOFT WORD RIBBON TOOLBAR                               */}
        {/* ============================================================== */}
        <div className="bg-surface border-b border-[var(--border)] px-3 py-1.5 flex items-stretch text-xs flex-shrink-0 shadow-2xs min-h-[76px] w-full relative z-30">
          {/* TAB 1: HOME */}
          {activeRibbonTab === "home" && (
            <div className="flex items-stretch gap-2.5 w-full relative">
              {/* Group 1: Clipboard */}
              <div className="flex flex-col justify-between pr-2.5 border-r border-border flex-shrink-0">
                <div className="flex items-center gap-1.5 h-12">
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={handlePaste}
                    className="flex flex-col items-center justify-center px-2 py-1 h-full rounded hover:bg-background text-sub hover:text-primary transition group"
                    title="Paste from clipboard (Ctrl+V)"
                  >
                    <Clipboard size={18} className="text-[var(--primary)] group-hover:scale-110 transition" />
                    <span className="text-[10px] font-semibold mt-0.5">Paste</span>
                  </button>
                  <div className="flex flex-col gap-1 justify-center">
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={handleCut}
                      className="flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium text-sub hover:bg-background hover:text-primary transition"
                      title="Cut selected text (Ctrl+X)"
                    >
                      <Scissors size={12} className="text-muted-text" />
                      <span>Cut</span>
                    </button>
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={handleCopy}
                      className="flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium text-sub hover:bg-background hover:text-primary transition"
                      title="Copy selected text (Ctrl+C)"
                    >
                      <Copy size={12} className="text-muted-text" />
                      <span>Copy</span>
                    </button>
                  </div>
                </div>
                <div className="text-[9px] text-muted-text font-semibold tracking-wider text-center uppercase select-none mt-0.5">
                  Clipboard
                </div>
              </div>

              {/* Group 2: Font & Typography */}
              <div className="flex flex-col justify-between px-2.5 border-r border-border flex-shrink-0">
                <div className="flex flex-col gap-1">
                  {/* Row 1: Font Family, Font Size, Grow/Shrink, Change Case, Clear Formatting */}
                  <div className="flex items-center gap-1">
                    <select
                      value={normalizeFamily(activeFontFamily || templateData.font_family)}
                      onChange={(e) => {
                        const newFamily = e.target.value;
                        applyFormatToSelection("font", newFamily);
                      }}
                      className="h-6 px-1.5 text-xs bg-background border border-border-strong rounded font-medium text-main outline-none hover:border-primary focus:border-primary cursor-pointer w-28 truncate"
                      title="Font Family"
                    >
                      <option value="Calibri">Calibri</option>
                      <option value="Arial">Arial</option>
                      <option value="'Times New Roman', serif">Times New Roman</option>
                      <option value="Georgia, serif">Georgia</option>
                      <option value="'Courier New', monospace">Courier New</option>
                      <option value="Tahoma, sans-serif">Tahoma</option>
                      <option value="Verdana, sans-serif">Verdana</option>
                    </select>

                    <div className="flex items-center border border-border-strong rounded bg-background h-6 px-1.5 focus-within:border-primary" title="Font Size">
                      <input
                        type="number"
                        min="8"
                        max="36"
                        value={activeFontSize || templateData.font_size || 12}
                        onChange={(e) => {
                          const newSize = parseInt(e.target.value) || 12;
                          applyFormatToSelection("size", newSize);
                        }}
                        className="w-7 text-center text-xs font-bold text-main bg-transparent outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      />
                      <span className="text-[10px] text-muted-text font-medium select-none ml-0.5">px</span>
                    </div>

                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        const { start, end } = getActiveTarget();
                        if (start !== end) {
                          applyFormatToSelection("size_step", 1);
                        } else {
                          const newSize = Math.min((activeFontSize || templateData.font_size || 12) + 1, 36);
                          setTemplateData((prev) => ({
                            ...prev,
                            font_size: newSize,
                          }));
                          setActiveFontSize(newSize);
                        }
                      }}
                      className="w-6 h-6 flex items-center justify-center bg-background hover:bg-background border border-border-strong rounded text-sub font-bold text-xs"
                      title="Increase Font Size (A+)"
                    >
                      A⁺
                    </button>

                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        const { start, end } = getActiveTarget();
                        if (start !== end) {
                          applyFormatToSelection("size_step", -1);
                        } else {
                          const newSize = Math.max((activeFontSize || templateData.font_size || 12) - 1, 8);
                          setTemplateData((prev) => ({
                            ...prev,
                            font_size: newSize,
                          }));
                          setActiveFontSize(newSize);
                        }
                      }}
                      className="w-6 h-6 flex items-center justify-center bg-background hover:bg-background border border-border-strong rounded text-sub font-bold text-[10px]"
                      title="Decrease Font Size (A-)"
                    >
                      A⁻
                    </button>

                    <div className="relative">
                      <button
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowCaseDropdown(!showCaseDropdown);
                          setShowFontColorDropdown(false);
                          setShowHighlightDropdown(false);
                        }}
                        className="h-6 px-1.5 flex items-center gap-0.5 bg-background hover:bg-background border border-border-strong rounded text-sub font-bold text-xs"
                        title="Change Case (UPPERCASE, lowercase, Capitalize)"
                      >
                        <span>Aa</span>
                        <ChevronDown size={10} className="text-muted-text" />
                      </button>
                      {showCaseDropdown && (
                        <div
                          className="absolute left-0 top-7 w-44 bg-surface border border-border-strong rounded-md shadow-2xl py-1 z-[9999] text-xs"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => toggleCase("sentence")}
                            className="w-full text-left px-3 py-1.5 hover:bg-[var(--primary-light)] text-sub transition"
                          >
                            Sentence case
                          </button>
                          <button
                            type="button"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => toggleCase("lower")}
                            className="w-full text-left px-3 py-1.5 hover:bg-[var(--primary-light)] text-sub transition"
                          >
                            lowercase
                          </button>
                          <button
                            type="button"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => toggleCase("upper")}
                            className="w-full text-left px-3 py-1.5 hover:bg-[var(--primary-light)] text-sub font-bold transition"
                          >
                            UPPERCASE
                          </button>
                          <button
                            type="button"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => toggleCase("title")}
                            className="w-full text-left px-3 py-1.5 hover:bg-[var(--primary-light)] text-sub transition"
                          >
                            Capitalize Each Word
                          </button>
                        </div>
                      )}
                    </div>

                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={clearFormatting}
                      className="w-6 h-6 flex items-center justify-center bg-background hover:bg-[var(--danger-light)] hover:border-[var(--danger-light)] hover:text-danger border border-border-strong rounded text-sub"
                      title="Clear All Formatting"
                    >
                      <Eraser size={13} />
                    </button>
                  </div>

                  {/* Row 2: Bold, Italic, Underline, Strikethrough, Subscript, Superscript, Highlight, Font Color */}
                  <div className="flex items-center gap-0.5">
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => applyFormatToSelection("bold")}
                      className={`w-6 h-6 flex items-center justify-center rounded text-xs transition ${
                        (activeBold ?? templateData.font_bold)
                          ? "bg-[var(--primary-light)] text-primary font-extrabold ring-1 ring-primary"
                          : "hover:bg-background text-main font-bold"
                      }`}
                      title="Bold (Ctrl+B)"
                    >
                      <Bold size={13} />
                    </button>

                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => applyFormatToSelection("italic")}
                      className={`w-6 h-6 flex items-center justify-center rounded text-xs transition ${
                        (activeItalic ?? templateData.font_italic)
                          ? "bg-[var(--primary-light)] text-primary ring-1 ring-primary italic"
                          : "hover:bg-background text-main italic"
                      }`}
                      title="Italic (Ctrl+I)"
                    >
                      <Italic size={13} />
                    </button>

                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => applyFormatToSelection("underline")}
                      className={`w-6 h-6 flex items-center justify-center rounded text-xs transition ${
                        (activeUnderline ?? templateData.font_underline)
                          ? "bg-[var(--primary-light)] text-primary ring-1 ring-primary underline"
                          : "hover:bg-background text-main underline"
                      }`}
                      title="Underline (Ctrl+U)"
                    >
                      <Underline size={13} />
                    </button>

                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => applyFormatToSelection("strike")}
                      className={`w-6 h-6 flex items-center justify-center rounded text-xs transition ${
                        (activeStrike ?? templateData.font_strikethrough)
                          ? "bg-[var(--primary-light)] text-primary ring-1 ring-primary"
                          : "hover:bg-background text-main"
                      }`}
                      title="Strikethrough"
                    >
                      <Strikethrough size={13} />
                    </button>

                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => applyFormatToSelection("sub")}
                      className="w-6 h-6 flex items-center justify-center rounded hover:bg-background text-main text-xs transition"
                      title="Subscript (X₂)"
                    >
                      <Subscript size={13} />
                    </button>

                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => applyFormatToSelection("sup")}
                      className="w-6 h-6 flex items-center justify-center rounded hover:bg-background text-main text-xs transition"
                      title="Superscript (X²)"
                    >
                      <Superscript size={13} />
                    </button>

                    <div className="h-4 w-px bg-background mx-0.5" />

                    {/* Text Highlight Color Dropdown */}
                    <div className="relative">
                      <button
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowHighlightDropdown(!showHighlightDropdown);
                          setShowFontColorDropdown(false);
                          setShowCaseDropdown(false);
                        }}
                        className={`h-6 px-1 flex items-center gap-0.5 rounded text-main text-xs transition ${
                          templateData.font_highlight && templateData.font_highlight !== "transparent"
                            ? "bg-[var(--warning-light)] ring-1 ring-warning"
                            : "hover:bg-background"
                        }`}
                        title="Text Highlight Color"
                      >
                        <Highlighter size={13} className="text-warning" />
                        <div
                          className="w-2.5 h-1 rounded-xs -mt-1"
                          style={{
                            backgroundColor:
                              templateData.font_highlight && templateData.font_highlight !== "transparent"
                                ? templateData.font_highlight
                                : "var(--warning)",
                          }}
                        />
                        <ChevronDown size={9} className="text-muted-text" />
                      </button>

                      {showHighlightDropdown && (
                        <div
                          className="absolute left-0 top-7 w-44 bg-surface border border-border-strong rounded-md shadow-xl p-2 z-[9999]"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="text-[10px] font-bold text-muted-text mb-1.5 uppercase">Highlight Color</div>
                          <div className="grid grid-cols-4 gap-1.5 mb-2">
                            {[
                              { name: "Yellow", color: "var(--warning)" },
                              { name: "Green", color: "var(--success-light)" },
                              { name: "Cyan", color: "var(--info)" },
                              { name: "Pink", color: "var(--primary-light)" },
                              { name: "Orange", color: "var(--warning-light)" },
                              { name: "Gray", color: "var(--border)" },
                              { name: "Lavender", color: "var(--primary-light)" },
                              { name: "Blue", color: "var(--primary-light)" },
                            ].map((swatch) => (
                              <button
                                key={swatch.color}
                                type="button"
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => {
                                  applyFormatToSelection("highlight", swatch.color);
                                  setShowHighlightDropdown(false);
                                }}
                                className="w-8 h-6 rounded border border-border-strong hover:scale-105 transition"
                                style={{ backgroundColor: swatch.color }}
                                title={swatch.name}
                              />
                            ))}
                          </div>
                          <button
                            type="button"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => {
                              applyFormatToSelection("highlight", "transparent");
                              setShowHighlightDropdown(false);
                            }}
                            className="w-full text-center py-1 text-[11px] text-sub hover:bg-background rounded border border-border"
                          >
                            No Color
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Font Color Dropdown */}
                    <div className="relative">
                      <button
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowFontColorDropdown(!showFontColorDropdown);
                          setShowHighlightDropdown(false);
                          setShowCaseDropdown(false);
                        }}
                        className="h-6 px-1 flex items-center gap-0.5 rounded hover:bg-background text-main text-xs transition"
                        title="Font Color"
                      >
                        <Palette size={13} className="text-danger" />
                        <div
                          className="w-2.5 h-1 rounded-xs -mt-1"
                          style={{
                            backgroundColor: templateData.font_color || "var(--danger)",
                          }}
                        />
                        <ChevronDown size={9} className="text-muted-text" />
                      </button>

                      {showFontColorDropdown && (
                        <div
                          className="absolute left-0 top-7 w-44 bg-surface border border-border-strong rounded-md shadow-xl p-2 z-[9999]"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="text-[10px] font-bold text-muted-text mb-1.5 uppercase">Theme Colors</div>
                          <div className="grid grid-cols-5 gap-1.5 mb-2">
                            {[
                              { name: "Black", color: "#000000" },
                              { name: "Dark Slate", color: "var(--text-primary)" },
                              { name: "Red", color: "var(--danger)" },
                              { name: "Dark Red", color: "var(--danger)" },
                              { name: "Orange", color: "var(--warning)" },
                              { name: "Amber", color: "var(--warning)" },
                              { name: "Green", color: "var(--success)" },
                              { name: "Emerald", color: "var(--success)" },
                              { name: "Blue", color: "var(--primary)" },
                              { name: "Navy", color: "var(--primary)" },
                              { name: "Purple", color: "var(--secondary)" },
                              { name: "Indigo", color: "var(--primary)" },
                              { name: "Gray", color: "var(--text-secondary)" },
                              { name: "Brown", color: "var(--warning)" },
                              { name: "Teal", color: "var(--info)" },
                            ].map((swatch) => (
                              <button
                                key={swatch.color}
                                type="button"
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => {
                                  applyFormatToSelection("color", swatch.color);
                                  setShowFontColorDropdown(false);
                                }}
                                className="w-6 h-6 rounded-full border border-border-strong hover:scale-110 transition shadow-2xs"
                                style={{ backgroundColor: swatch.color }}
                                title={swatch.name}
                              />
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="text-[9px] text-muted-text font-semibold tracking-wider text-center uppercase select-none mt-0.5">
                  Font & Typography
                </div>
              </div>

              {/* Group 3: Paragraph & Alignment */}
              <div className="flex flex-col justify-between px-2.5 border-r border-border flex-shrink-0">
                <div className="flex flex-col gap-1">
                  {/* Row 1: Bullets, Numbering, Decrease Indent, Increase Indent, Line Spacing, Divider */}
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => applyListFormat("bullet")}
                      className="w-6 h-6 flex items-center justify-center rounded hover:bg-background text-sub transition"
                      title="Bullets (•)"
                    >
                      <List size={13} />
                    </button>

                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => applyListFormat("number")}
                      className="w-6 h-6 flex items-center justify-center rounded hover:bg-background text-sub transition"
                      title="Numbering (1. 2. 3.)"
                    >
                      <ListOrdered size={13} />
                    </button>

                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => applyIndent("decrease")}
                      className="w-6 h-6 flex items-center justify-center rounded hover:bg-background text-sub transition"
                      title="Decrease Indent"
                    >
                      <Outdent size={13} />
                    </button>

                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => applyIndent("increase")}
                      className="w-6 h-6 flex items-center justify-center rounded hover:bg-background text-sub transition"
                      title="Increase Indent"
                    >
                      <Indent size={13} />
                    </button>

                    <div className="h-4 w-px bg-background mx-0.5" />

                    <div className="flex items-center border border-border-strong rounded bg-background h-6 px-1" title="Line Spacing">
                      <span className="text-[9px] text-muted-text mr-0.5">↕</span>
                      <select
                        value={templateData.line_spacing || 1.5}
                        onChange={(e) =>
                          setTemplateData({
                            ...templateData,
                            line_spacing: parseFloat(e.target.value) || 1.5,
                          })
                        }
                        className="text-xs font-semibold text-main bg-transparent outline-none cursor-pointer"
                      >
                        <option value="1.0">1.0</option>
                        <option value="1.15">1.15</option>
                        <option value="1.5">1.5</option>
                        <option value="2.0">2.0</option>
                        <option value="2.5">2.5</option>
                      </select>
                    </div>

                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => insertTextAtCursor("\n----------------------------------------\n")}
                      className="h-6 px-1.5 flex items-center gap-1 bg-background hover:bg-background border border-border-strong rounded text-sub text-xs"
                      title="Insert Horizontal Divider Line"
                    >
                      <Minus size={13} />
                      <span className="text-[10px] font-medium">Divider</span>
                    </button>

                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => insertTable(3, 3)}
                      className="h-6 px-1.5 flex items-center gap-1 bg-[var(--primary-light)] hover:bg-[var(--primary-light)] border border-[var(--primary-light)] rounded text-primary text-xs transition"
                      title="Insert Table (3 × 3)"
                    >
                      <Table size={13} className="text-primary" />
                      <span className="text-[10px] font-semibold">Table</span>
                    </button>

                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => deleteTable()}
                      className={`h-6 px-1.5 flex items-center gap-1 rounded text-xs transition ${
                        isInsideTable
                          ? "bg-[var(--danger-light)] hover:bg-[var(--danger-light)] border border-danger text-danger font-bold shadow-xs"
                          : "bg-[var(--danger-light)] hover:bg-[var(--danger-light)] border border-[var(--danger-light)] text-danger"
                      }`}
                      title="Delete Table (Remove table from canvas)"
                    >
                      <Trash2 size={13} className="text-danger" />
                      <span className="text-[10px] font-semibold">Delete Table</span>
                    </button>
                  </div>

                  {/* Row 2: Document Alignment + Line Alignment */}
                  <div className="flex items-center gap-1.5">
                    <div className="flex items-center bg-background border border-border-strong rounded p-0.5" title="Document Alignment (All Text)">
                      <button
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() =>
                          setTemplateData((prev) => ({
                            ...prev,
                            middle_alignment: "left",
                          }))
                        }
                        className={`p-1 rounded transition ${
                          templateData.middle_alignment === "left"
                            ? "bg-primary text-white shadow-2xs"
                            : "text-sub hover:bg-surface"
                        }`}
                        title="Align Left (All Text)"
                      >
                        <AlignLeft size={12} />
                      </button>
                      <button
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() =>
                          setTemplateData((prev) => ({
                            ...prev,
                            middle_alignment: "center",
                          }))
                        }
                        className={`p-1 rounded transition ${
                          templateData.middle_alignment === "center"
                            ? "bg-primary text-white shadow-2xs"
                            : "text-sub hover:bg-surface"
                        }`}
                        title="Center (All Text)"
                      >
                        <AlignCenter size={12} />
                      </button>
                      <button
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() =>
                          setTemplateData((prev) => ({
                            ...prev,
                            middle_alignment: "right",
                          }))
                        }
                        className={`p-1 rounded transition ${
                          templateData.middle_alignment === "right"
                            ? "bg-primary text-white shadow-2xs"
                            : "text-sub hover:bg-surface"
                        }`}
                        title="Align Right (All Text)"
                      >
                        <AlignRight size={12} />
                      </button>
                      <button
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() =>
                          setTemplateData((prev) => ({
                            ...prev,
                            middle_alignment: "justify",
                          }))
                        }
                        className={`p-1 rounded transition ${
                          templateData.middle_alignment === "justify"
                            ? "bg-primary text-white shadow-2xs"
                            : "text-sub hover:bg-surface"
                        }`}
                        title="Justify (All Text)"
                      >
                        <AlignJustify size={12} />
                      </button>
                    </div>

                    <div className="flex items-center bg-[var(--primary-light)] border border-[var(--primary-light)] rounded p-0.5" title="Align Specific Selected Line">
                      <span className="text-[9px] font-bold text-primary px-1 select-none">Line:</span>
                      <button
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => applyLineAlignment("left")}
                        className={`p-1 rounded transition ${
                          currentAlign === "left"
                            ? "bg-primary text-white shadow-2xs"
                            : "text-sub hover:bg-surface hover:text-primary"
                        }`}
                        title="Format Current Line Left"
                      >
                        <AlignLeft size={12} />
                      </button>
                      <button
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => applyLineAlignment("center")}
                        className={`p-1 rounded transition ${
                          currentAlign === "center"
                            ? "bg-primary text-white shadow-2xs"
                            : "text-sub hover:bg-surface hover:text-primary"
                        }`}
                        title="Format Current Line Center"
                      >
                        <AlignCenter size={12} />
                      </button>
                      <button
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => applyLineAlignment("right")}
                        className={`p-1 rounded transition ${
                          currentAlign === "right"
                            ? "bg-primary text-white shadow-2xs"
                            : "text-sub hover:bg-surface hover:text-primary"
                        }`}
                        title="Format Current Line Right"
                      >
                        <AlignRight size={12} />
                      </button>
                      <button
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => applyLineAlignment("justify")}
                        className={`p-1 rounded transition ${
                          currentAlign === "justify"
                            ? "bg-primary text-white shadow-2xs"
                            : "text-sub hover:bg-surface hover:text-primary"
                        }`}
                        title="Format Current Line Justify"
                      >
                        <AlignJustify size={12} />
                      </button>
                    </div>
                  </div>
                </div>

                <div className="text-[9px] text-muted-text font-semibold tracking-wider text-center uppercase select-none mt-0.5">
                  Paragraph & Alignment
                </div>
              </div>

              {/* Group: Sheet Size & Page Setup */}
              <div className="flex flex-col justify-between px-2.5 border-r border-border flex-shrink-0">
                <div className="flex flex-col gap-1">
                  {/* Row 1: Sheet Size dropdown */}
                  <div className="flex items-center gap-1.5 h-[26px]">
                    <span className="text-[10px] font-bold text-sub">Sheet:</span>
                    <select
                      value={activeSheetKey}
                      onChange={(e) => {
                        const newSize = e.target.value;
                        setTemplateData((prev) => ({
                          ...prev,
                          page_size: newSize,
                        }));
                        toast.success(`Sheet size changed to ${newSize}`);
                      }}
                      className="px-2 py-0.5 text-xs font-bold bg-surface border border-border-strong rounded shadow-2xs hover:border-primary focus:ring-1 focus:ring-primary outline-none text-main cursor-pointer"
                    >
                      <option value="A4">A4 (210 × 297 mm)</option>
                      <option value="A5">A5 (148 × 210 mm)</option>
                      <option value="A3">A3 (297 × 420 mm)</option>
                      <option value="Letter">Letter (8.5 × 11 in)</option>
                      <option value="Legal">Legal (8.5 × 14 in)</option>
                    </select>
                  </div>

                  {/* Row 2: Quick buttons for A4, A5, and Orientation */}
                  <div className="flex items-center gap-1 h-[26px]">
                    {["A4", "A5", "Letter"].map((sz) => (
                      <button
                        key={sz}
                        type="button"
                        onClick={() => {
                          setTemplateData((prev) => ({ ...prev, page_size: sz }));
                          toast.success(`Sheet size: ${sz}`);
                        }}
                        className={`px-1.5 py-0.5 rounded text-[10px] font-bold transition ${
                          activeSheetKey === sz
                            ? "bg-primary text-white shadow-2xs"
                            : "bg-background text-sub hover:bg-background"
                        }`}
                        title={`Switch to ${sz}`}
                      >
                        {sz}
                      </button>
                    ))}
                    <div className="h-3 w-px bg-background mx-0.5" />
                    <button
                      type="button"
                      onClick={() =>
                        setTemplateData((prev) => ({
                          ...prev,
                          page_orientation: isLandscape ? "portrait" : "landscape",
                        }))
                      }
                      className={`px-1.5 py-0.5 rounded text-[10px] font-bold transition ${
                        isLandscape
                          ? "bg-primary text-white"
                          : "bg-background text-sub hover:bg-background"
                      }`}
                      title={isLandscape ? "Landscape Orientation" : "Portrait Orientation"}
                    >
                      {isLandscape ? "Land" : "Port"}
                    </button>
                  </div>
                </div>

                <div className="text-[9px] text-muted-text font-semibold tracking-wider text-center uppercase select-none mt-0.5">
                  Page Setup
                </div>
              </div>

              {/* Group 4: Variables & Fillable Blanks (or Dynamic Header Tools) */}
              <div className="flex flex-col justify-between pl-2.5 flex-1 min-w-0">
                {editingSection === "header" ? (
                  <div className="flex flex-col justify-between h-full">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <button
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() =>
                          insertTextAtCursor(
                            `\n[center][b][size:16]${(selectedCollege?.name || "COLLEGE NAME").toUpperCase()}[/size][/b][/center]`
                          )
                        }
                        className="h-6 px-2 bg-[var(--primary-light)] hover:bg-[var(--primary-light)] border border-[var(--primary-light)] text-primary rounded font-semibold text-[11px] whitespace-nowrap"
                      >
                        + College Title
                      </button>
                      <button
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() =>
                          insertTextAtCursor(
                            "\n[center][size:10](Approved by AICTE, Affiliated to Andhra University, NAAC 'A+' Grade)[/size][/center]"
                          )
                        }
                        className="h-6 px-2 bg-[var(--primary-light)] hover:bg-[var(--primary-light)] border border-[var(--primary-light)] text-primary rounded font-semibold text-[11px] whitespace-nowrap"
                      >
                        + Affiliation
                      </button>
                      <button
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() =>
                          insertTextAtCursor(
                            `\n[center][size:9]${selectedCollege?.address || "Kakinada - 533001"} | Phone: ${selectedCollege?.contact || "+91 884 237 9999"}[/size][/center]`
                          )
                        }
                        className="h-6 px-2 bg-[var(--primary-light)] hover:bg-[var(--primary-light)] border border-[var(--primary-light)] text-primary rounded font-semibold text-[11px] whitespace-nowrap"
                      >
                        + Address
                      </button>
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <button
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => headerImageInputRef.current?.click()}
                        className="h-6 px-2 bg-primary hover:bg-primary-hover text-white rounded font-bold text-[11px] flex items-center gap-1 shadow-2xs whitespace-nowrap"
                        title="Upload or Change College Header Logo"
                      >
                        <Image size={12} /> {templateData.header_image_url ? "Change Logo" : "+ Header Logo"}
                      </button>
                      <button
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => insertTextAtCursor("\n----------------------------------------\n")}
                        className="h-6 px-2 bg-background hover:bg-background border border-border-strong text-main rounded font-bold text-[11px] whitespace-nowrap"
                      >
                        + Divider Line
                      </button>
                      <div className="flex items-center border border-border-strong rounded bg-background h-6 px-1.5">
                        <span className="text-[10px] text-muted-text mr-1 whitespace-nowrap">Height:</span>
                        <input
                          type="number"
                          min="50"
                          max="180"
                          value={templateData.header_height || 80}
                          onChange={(e) =>
                            setTemplateData({
                              ...templateData,
                              header_height: parseInt(e.target.value) || 80,
                            })
                          }
                          className="w-7 text-center text-xs font-bold outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                        <span className="text-[9px] text-muted-text select-none">px</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col justify-between h-full">
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="relative">
                        <button
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowVariableDropdown(!showVariableDropdown);
                            setShowFontColorDropdown(false);
                            setShowHighlightDropdown(false);
                            setShowCaseDropdown(false);
                          }}
                          className="h-6 px-2.5 bg-primary hover:bg-primary-hover text-white rounded font-semibold text-xs flex items-center gap-1 shadow-xs transition whitespace-nowrap"
                        >
                          <span>➕ Insert Variable</span>
                          <ChevronDown size={11} />
                        </button>

                        {showVariableDropdown && (
                          <div
                            className="absolute left-0 top-8 w-72 bg-surface rounded-lg shadow-xl border border-[var(--primary-light)] z-[9999] p-2 space-y-2"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className="relative">
                              <input
                                type="text"
                                value={variableSearchQuery}
                                onChange={(e) => setVariableSearchQuery(e.target.value)}
                                placeholder="Search student variables..."
                                className="w-full px-2.5 py-1 text-xs border border-border-strong rounded outline-none focus:border-primary"
                                autoFocus
                              />
                            </div>

                            <div className="max-h-56 overflow-y-auto space-y-2 text-xs">
                              {studentVars.length > 0 && (
                                <div>
                                  <div className="text-[10px] font-bold text-muted-text uppercase tracking-wider mb-1">
                                    🎓 Student Identity
                                  </div>
                                  <div className="grid grid-cols-2 gap-1">
                                    {studentVars.map((v) => (
                                      <button
                                        key={v.name}
                                        type="button"
                                        onMouseDown={(e) => e.preventDefault()}
                                        onClick={() => {
                                          insertTextAtCursor(`@${v.name} `);
                                          setShowVariableDropdown(false);
                                        }}
                                        className="text-left px-2 py-1 rounded bg-[var(--primary-light)] hover:bg-[var(--primary-light)] text-primary font-medium truncate"
                                        title={v.label}
                                      >
                                        @{v.name}
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {academicVars.length > 0 && (
                                <div>
                                  <div className="text-[10px] font-bold text-muted-text uppercase tracking-wider mb-1">
                                    📚 Academic Details
                                  </div>
                                  <div className="grid grid-cols-2 gap-1">
                                    {academicVars.map((v) => (
                                      <button
                                        key={v.name}
                                        type="button"
                                        onMouseDown={(e) => e.preventDefault()}
                                        onClick={() => {
                                          insertTextAtCursor(`@${v.name} `);
                                          setShowVariableDropdown(false);
                                        }}
                                        className="text-left px-2 py-1 rounded bg-[var(--success-light)] hover:bg-[var(--success-light)] text-success font-medium truncate"
                                        title={v.label}
                                      >
                                        @{v.name}
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {personalVars.length > 0 && (
                                <div>
                                  <div className="text-[10px] font-bold text-muted-text uppercase tracking-wider mb-1">
                                    👤 Personal Info
                                  </div>
                                  <div className="grid grid-cols-2 gap-1">
                                    {personalVars.map((v) => (
                                      <button
                                        key={v.name}
                                        type="button"
                                        onMouseDown={(e) => e.preventDefault()}
                                        onClick={() => {
                                          insertTextAtCursor(`@${v.name} `);
                                          setShowVariableDropdown(false);
                                        }}
                                        className="text-left px-2 py-1 rounded bg-[var(--warning-light)] hover:bg-[var(--warning-light)] text-warning font-medium truncate"
                                        title={v.label}
                                      >
                                        @{v.name}
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {institutionalVars.length > 0 && (
                                <div>
                                  <div className="text-[10px] font-bold text-muted-text uppercase tracking-wider mb-1">
                                    🏛️ Institutional / Signatures
                                  </div>
                                  <div className="grid grid-cols-1 gap-1">
                                    {institutionalVars.map((v) => (
                                      <button
                                        key={v.name}
                                        type="button"
                                        onMouseDown={(e) => e.preventDefault()}
                                        onClick={() => {
                                          insertTextAtCursor(`@${v.name} `);
                                          setShowVariableDropdown(false);
                                        }}
                                        className="text-left px-2 py-1 rounded bg-[var(--primary-light)] hover:bg-[var(--primary-light)] text-secondary font-medium truncate"
                                        title={v.label}
                                      >
                                        @{v.name} ({v.label})
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>

                      <button
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => insertTextAtCursor(" ___ ")}
                        className="h-6 px-2.5 bg-background hover:bg-background border border-border-strong rounded font-semibold text-xs text-main flex items-center gap-1 transition whitespace-nowrap"
                        title="Insert fillable underline blank (___)"
                      >
                        <span>Insert Blank (___)</span>
                      </button>

                      <div className="flex items-center border border-border-strong rounded bg-background h-6 px-1.5" title="Blank Field Size">
                        <span className="text-[10px] text-muted-text mr-1 whitespace-nowrap">Blank Size:</span>
                        <input
                          type="number"
                          min="4"
                          max="30"
                          value={templateData.input_field_size || 10}
                          onChange={(e) =>
                            setTemplateData({
                              ...templateData,
                              input_field_size: Math.min(
                                Math.max(parseInt(e.target.value) || 10, 4),
                                30,
                              ),
                            })
                          }
                          className="w-7 text-center text-xs font-bold text-main bg-transparent outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                        <span className="text-[9px] text-muted-text select-none">ch</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 flex-wrap">
                      {[
                        { label: "Name", var: "@student_name" },
                        { label: "PIN", var: "@pin_no" },
                        { label: "Adm No", var: "@admission_number" },
                        { label: "Course", var: "@course" },
                        { label: "Branch", var: "@branch" },
                        { label: "Year", var: "@academic_year" },
                        { label: "Father", var: "@father_name" },
                        { label: "Date", var: "@current_date" },
                        { label: "Sig", var: "@principal_signature" },
                      ].map((chip) => (
                        <button
                          key={chip.var}
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => {
                            insertTextAtCursor(`${chip.var} `);
                          }}
                          className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-[var(--primary-light)] hover:bg-[var(--primary-light)] text-primary border border-[var(--primary-light)] transition whitespace-nowrap"
                          title={`Insert ${chip.var}`}
                        >
                          +{chip.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="text-[9px] text-muted-text font-semibold tracking-wider uppercase select-none mt-0.5">
                  {editingSection === "header"
                    ? "Dynamic Header Tools"
                    : "Variables & Fillable Blanks"}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: INSERT */}
          {activeRibbonTab === "insert" && (
            <div className="flex items-center gap-3 divide-x divide-border w-full">
              {/* Tables Group: MS Word Grid & Custom Dimensions */}
              <div className="flex flex-col gap-1 pr-3 flex-shrink-0">
                <div className="relative">
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowTableDropdown(!showTableDropdown);
                      setShowVariableDropdown(false);
                      setShowFontColorDropdown(false);
                      setShowHighlightDropdown(false);
                      setShowCaseDropdown(false);
                    }}
                    className="flex flex-col items-center justify-center px-3 py-1 rounded hover:bg-[var(--primary-light)] text-sub hover:text-primary transition border border-border bg-surface shadow-2xs"
                    title="Insert Table (Rows × Columns)"
                  >
                    <div className="flex items-center gap-1.5 text-primary font-bold">
                      <Table size={15} />
                      <span className="text-xs">Table</span>
                      <ChevronDown size={11} />
                    </div>
                    <span className="text-[9px] text-muted-text mt-0.5">MS Word Grid</span>
                  </button>

                  {showTableDropdown && (
                    <div
                      className="absolute left-0 top-12 w-64 bg-surface rounded-lg shadow-xl border border-border-strong z-[9999] p-3 space-y-3"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-center justify-between border-b pb-1.5">
                        <span className="text-xs font-bold text-main flex items-center gap-1.5">
                          <Table size={14} className="text-primary" /> Insert Table
                        </span>
                        <span className="text-[11px] font-semibold text-primary bg-[var(--primary-light)] px-2 py-0.5 rounded border border-[var(--primary-light)]">
                          {hoverRows} × {hoverCols} Table
                        </span>
                      </div>

                      {/* Interactive MS Word Table Grid */}
                      <div className="flex flex-col gap-1 items-center bg-background p-2 rounded border border-border">
                        {[1, 2, 3, 4, 5, 6].map((r) => (
                          <div key={r} className="flex gap-1">
                            {[1, 2, 3, 4, 5, 6].map((c) => {
                              const isSelected = r <= hoverRows && c <= hoverCols;
                              return (
                                <div
                                  key={c}
                                  onMouseEnter={() => {
                                    setHoverRows(r);
                                    setHoverCols(c);
                                  }}
                                  onClick={() => insertTable(r, c)}
                                  className={`w-6 h-6 border rounded-xs cursor-pointer transition-all ${
                                    isSelected
                                      ? "bg-primary border-primary shadow-2xs scale-105"
                                      : "bg-surface border-border-strong hover:border-border-strong"
                                  }`}
                                />
                              );
                            })}
                          </div>
                        ))}
                      </div>

                      {/* Quick Presets */}
                      <div>
                        <div className="text-[10px] font-bold text-muted-text uppercase tracking-wider mb-1">
                          Quick Presets
                        </div>
                        <div className="grid grid-cols-4 gap-1">
                          {[
                            { r: 2, c: 2 },
                            { r: 3, c: 3 },
                            { r: 4, c: 2 },
                            { r: 5, c: 3 },
                          ].map((p) => (
                            <button
                              key={`${p.r}x${p.c}`}
                              type="button"
                              onClick={() => insertTable(p.r, p.c)}
                              className="px-1.5 py-1 text-[11px] font-semibold bg-background hover:bg-[var(--primary-light)] hover:text-primary hover:border-[var(--primary-light)] border border-border rounded text-sub text-center transition"
                            >
                              {p.r} × {p.c}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Custom Table Dimension Inputs */}
                      <div className="border-t pt-2 space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-sub font-medium">Columns:</span>
                          <input
                            type="number"
                            min="1"
                            max="10"
                            value={tableCols}
                            onChange={(e) => setTableCols(parseInt(e.target.value) || 1)}
                            className="w-14 px-1.5 py-0.5 border border-border-strong rounded text-center text-xs font-semibold outline-none focus:border-primary"
                          />
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-sub font-medium">Rows:</span>
                          <input
                            type="number"
                            min="1"
                            max="20"
                            value={tableRows}
                            onChange={(e) => setTableRows(parseInt(e.target.value) || 1)}
                            className="w-14 px-1.5 py-0.5 border border-border-strong rounded text-center text-xs font-semibold outline-none focus:border-primary"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => insertTable(tableRows, tableCols)}
                          className="w-full py-1.5 bg-primary hover:bg-primary-hover text-white font-bold rounded text-xs shadow-xs transition"
                        >
                          Insert Custom Table
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            deleteTable();
                            setShowTableDropdown(false);
                          }}
                          className="w-full py-1.5 bg-[var(--danger-light)] hover:bg-[var(--danger-light)] border border-[var(--danger-light)] text-danger font-bold rounded text-xs shadow-xs transition flex items-center justify-center gap-1.5"
                          title="Delete Table"
                        >
                          <Trash2 size={13} className="text-danger" />
                          Delete Table
                        </button>
                      </div>
                    </div>
                  )}
                </div>
                <div className="text-[9px] text-muted-text font-semibold tracking-wider text-center uppercase select-none mt-0.5">
                  Tables
                </div>
              </div>

              <div className="flex flex-col gap-1 pr-3">
                <div className="flex items-center gap-1 flex-wrap max-w-xl">
                  {[
                    { label: "Student Name", var: "@student_name" },
                    { label: "PIN No", var: "@pin_no" },
                    { label: "Admission No", var: "@admission_number" },
                    { label: "Course", var: "@course" },
                    { label: "Branch", var: "@branch" },
                    { label: "Academic Year", var: "@academic_year" },
                    { label: "Father Name", var: "@father_name" },
                    { label: "Date of Birth", var: "@dob" },
                    { label: "Principal Sig", var: "@principal_signature" },
                    { label: "Upload Header Logo", isLogo: true },
                    { label: "Current Date", var: "@current_date" },
                  ].map((chip) => (
                    <button
                      key={chip.var}
                      type="button"
                      onClick={() => insertTextAtCursor(`${chip.var} `)}
                      className="px-2 py-0.5 bg-[var(--primary-light)] hover:bg-[var(--primary-light)] text-primary rounded border border-[var(--primary-light)] text-[11px] font-semibold transition"
                    >
                      +{chip.label}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => insertTextAtCursor(" ___ ")}
                    className="px-2 py-0.5 bg-background hover:bg-background text-main rounded border border-border-strong text-[11px] font-bold"
                  >
                    + Blank Line (___)
                  </button>
                </div>
                <div className="text-[9px] text-muted-text font-medium tracking-wide uppercase">
                  Quick Variable Chips (Click to Insert at Cursor)
                </div>
              </div>

              {/* College Letterhead Information */}
              <div className="flex flex-col gap-1 pl-3">
                <div className="flex items-center gap-3 text-xs">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-muted-text font-semibold">Header Design:</span>
                    <span className="text-[10px] text-primary bg-[var(--primary-light)] px-2 py-0.5 rounded border border-[var(--primary-light)] font-bold">
                      Dynamic Vector Letterhead
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEditingSection("header")}
                    className="text-[10px] font-bold text-primary underline hover:text-primary"
                  >
                    Edit College Header
                  </button>
                </div>
                <div className="text-[9px] text-muted-text font-medium tracking-wide uppercase">
                  College Institutional Letterhead (Photo-Free)
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: LAYOUT */}
          {activeRibbonTab === "layout" && (
            <div className="flex items-center gap-3 divide-x divide-border w-full">
              {/* Margins */}
              <div className="flex flex-col gap-1 pr-3">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-bold text-sub">Margins:</span>
                  <button
                    type="button"
                    onClick={() =>
                      setTemplateData({
                        ...templateData,
                        padding_left: 40,
                        padding_right: 40,
                        padding_top: 40,
                        padding_bottom: 40,
                      })
                    }
                    className="px-2 py-0.5 bg-background hover:bg-background border border-border-strong rounded text-[11px] font-medium"
                  >
                    Normal (40px)
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setTemplateData({
                        ...templateData,
                        padding_left: 20,
                        padding_right: 20,
                        padding_top: 20,
                        padding_bottom: 20,
                      })
                    }
                    className="px-2 py-0.5 bg-background hover:bg-background border border-border-strong rounded text-[11px] font-medium"
                  >
                    Narrow (20px)
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setTemplateData({
                        ...templateData,
                        padding_left: 60,
                        padding_right: 60,
                        padding_top: 60,
                        padding_bottom: 60,
                      })
                    }
                    className="px-2 py-0.5 bg-background hover:bg-background border border-border-strong rounded text-[11px] font-medium"
                  >
                    Wide (60px)
                  </button>

                  <div className="flex items-center gap-1 ml-2 bg-background border border-border-strong rounded px-1.5 py-0.5">
                    <span className="text-[10px] text-muted-text">L:</span>
                    <input
                      type="number"
                      value={templateData.padding_left || 40}
                      onChange={(e) =>
                        setTemplateData({
                          ...templateData,
                          padding_left: parseInt(e.target.value) || 40,
                        })
                      }
                      className="w-5 text-center text-xs font-bold outline-none"
                    />
                    <span className="text-[10px] text-muted-text">R:</span>
                    <input
                      type="number"
                      value={templateData.padding_right || 40}
                      onChange={(e) =>
                        setTemplateData({
                          ...templateData,
                          padding_right: parseInt(e.target.value) || 40,
                        })
                      }
                      className="w-5 text-center text-xs font-bold outline-none"
                    />
                    <span className="text-[10px] text-muted-text">T:</span>
                    <input
                      type="number"
                      value={templateData.padding_top || 40}
                      onChange={(e) =>
                        setTemplateData({
                          ...templateData,
                          padding_top: parseInt(e.target.value) || 40,
                        })
                      }
                      className="w-5 text-center text-xs font-bold outline-none"
                    />
                    <span className="text-[10px] text-muted-text">B:</span>
                    <input
                      type="number"
                      value={templateData.padding_bottom || 40}
                      onChange={(e) =>
                        setTemplateData({
                          ...templateData,
                          padding_bottom: parseInt(e.target.value) || 40,
                        })
                      }
                      className="w-5 text-center text-xs font-bold outline-none"
                    />
                  </div>
                </div>
                <div className="text-[9px] text-muted-text font-medium tracking-wide uppercase">
                  Page Margins (Left, Right, Top, Bottom in px)
                </div>
              </div>

              {/* Header height */}
              <div className="flex flex-col gap-1 pl-3">
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1 border border-border-strong rounded bg-background px-1.5 py-0.5">
                    <span className="text-[10px] text-sub font-semibold">Header H:</span>
                    <input
                      type="number"
                      value={templateData.header_height || 80}
                      onChange={(e) =>
                        setTemplateData({
                          ...templateData,
                          header_height: parseInt(e.target.value) || 80,
                        })
                      }
                      className="w-7 text-center text-xs font-bold outline-none"
                    />
                    <span className="text-[9px] text-muted-text">px</span>
                  </div>

                  <div className="flex items-center gap-1.5 border border-border-strong rounded bg-background px-2 py-0.5">
                    <span className="text-[10px] text-sub font-bold">Sheet:</span>
                    <select
                      value={activeSheetKey}
                      onChange={(e) => {
                        const newSize = e.target.value;
                        setTemplateData((prev) => ({
                          ...prev,
                          page_size: newSize,
                        }));
                        toast.success(`Sheet size: ${newSize}`);
                      }}
                      className="px-2 py-0.5 text-xs font-bold bg-surface border border-border-strong rounded hover:border-primary focus:ring-1 focus:ring-primary outline-none text-main cursor-pointer"
                    >
                      <option value="A4">A4 (210 × 297 mm)</option>
                      <option value="A5">A5 (148 × 210 mm)</option>
                      <option value="A3">A3 (297 × 420 mm)</option>
                      <option value="Letter">Letter (8.5 × 11 in)</option>
                      <option value="Legal">Legal (8.5 × 14 in)</option>
                    </select>

                    <div className="h-4 w-px bg-background mx-0.5" />

                    <button
                      type="button"
                      onClick={() =>
                        setTemplateData((prev) => ({
                          ...prev,
                          page_orientation: "portrait",
                        }))
                      }
                      className={`px-2 py-0.5 rounded text-[10px] font-bold transition ${
                        !isLandscape
                          ? "bg-primary text-white"
                          : "bg-surface border border-border-strong text-sub hover:bg-background"
                      }`}
                    >
                      Portrait
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setTemplateData((prev) => ({
                          ...prev,
                          page_orientation: "landscape",
                        }))
                      }
                      className={`px-2 py-0.5 rounded text-[10px] font-bold transition ${
                        isLandscape
                          ? "bg-primary text-white"
                          : "bg-surface border border-border-strong text-sub hover:bg-background"
                      }`}
                    >
                      Landscape
                    </button>
                  </div>
                </div>
                <div className="text-[9px] text-muted-text font-medium tracking-wide uppercase">
                  Header Height & Sheet Configuration
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: VIEW */}
          {activeRibbonTab === "view" && (
            <div className="flex items-center gap-4 w-full">
              <div className="flex items-center gap-1.5 bg-background border border-border-strong rounded p-1">
                <button
                  type="button"
                  onClick={() => setViewMode("word-canvas")}
                  className={`px-3 py-1 rounded text-xs font-semibold flex items-center gap-1.5 ${
                    viewMode === "word-canvas"
                      ? "bg-primary text-white shadow-xs"
                      : "text-sub hover:bg-surface"
                  }`}
                >
                  <FileText size={13} /> Word Canvas
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("split")}
                  className={`px-3 py-1 rounded text-xs font-semibold flex items-center gap-1.5 ${
                    viewMode === "split"
                      ? "bg-primary text-white shadow-xs"
                      : "text-sub hover:bg-surface"
                  }`}
                >
                  <Columns size={13} /> Split View
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("preview")}
                  className={`px-3 py-1 rounded text-xs font-semibold flex items-center gap-1.5 ${
                    viewMode === "preview"
                      ? "bg-primary text-white shadow-xs"
                      : "text-sub hover:bg-surface"
                  }`}
                >
                  <Eye size={13} /> Print Preview
                </button>
              </div>

              {/* Show Ruler Toggle */}
              <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-sub">
                <input
                  type="checkbox"
                  checked={showRuler}
                  onChange={(e) => setShowRuler(e.target.checked)}
                  className="rounded text-primary"
                />
                Show Word Ruler
              </label>

              {/* Zoom Buttons */}
              <div className="flex items-center gap-1 border border-border-strong rounded bg-background px-2 py-1">
                <span className="text-[10px] text-muted-text font-semibold">Zoom:</span>
                {[75, 90, 100, 110, 125].map((z) => (
                  <button
                    key={z}
                    type="button"
                    onClick={() => setZoomLevel(z)}
                    className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                      zoomLevel === z
                        ? "bg-primary text-white"
                        : "text-sub hover:bg-background"
                    }`}
                  >
                    {z}%
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ============================================================== */}
        {/* 4. MICROSOFT WORD HORIZONTAL RULER                             */}
        {/* ============================================================== */}
        {showRuler && (
          <div className="bg-[var(--warning-light)] border-b border-[var(--border)] h-5 flex items-center justify-center overflow-hidden flex-shrink-0 select-none">
            <div style={{ width: `${(canvasSheetWidth * zoomLevel) / 100}px` }} className="max-w-full flex items-center justify-between px-2 text-[9px] text-muted-text font-mono relative">
              {/* Shaded Left Margin indicator */}
              <div
                className="absolute left-0 top-0 bottom-0 bg-[var(--border)] border-r border-border-strong"
                style={{ width: `${Math.min(templateData.padding_left || 40, 120)}px` }}
              />
              {/* Shaded Right Margin indicator */}
              <div
                className="absolute right-0 top-0 bottom-0 bg-[var(--border)] border-l border-border-strong"
                style={{ width: `${Math.min(templateData.padding_right || 40, 120)}px` }}
              />

              {/* Ruler ticks & numbers */}
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16].map(
                (num) => (
                  <div key={num} className="flex flex-col items-center z-10">
                    <span className="text-[8px] text-sub font-bold">{num}</span>
                    <span className="w-px h-1.5 bg-background"></span>
                  </div>
                ),
              )}
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* 5. WORKSPACE: MICROSOFT WORD CANVAS (A4 PAPER SHEET)           */}
        {/* ============================================================== */}
        <div className="flex-1 overflow-auto bg-[var(--primary-light)] p-6 flex justify-center items-start">
          {/* ------------------------------------------------------------ */}
          {/* MODE A: WORD CANVAS (DIRECT WYSIWYG EDITING ON PAPER)         */}
          {/* ------------------------------------------------------------ */}
          {viewMode === "word-canvas" && (
            <div className="flex flex-col items-center gap-3">
              {/* Quick Floating Variable Insertion Pill Bar */}
              <div className="bg-[var(--surface)]/90 backdrop-blur-md border border-border-strong rounded-full px-4 py-1.5 shadow-sm flex items-center gap-2 text-xs flex-wrap justify-center max-w-3xl">
                <span className="text-[11px] font-bold text-sub flex items-center gap-1">
                  <Sparkles size={12} className="text-warning" /> Insert:
                </span>
                <button
                  type="button"
                  onClick={() => insertTextAtCursor("@student_name ")}
                  className="px-2 py-0.5 bg-[var(--primary-light)] hover:bg-[var(--primary-light)] text-primary rounded-full border border-[var(--primary-light)] text-[10px] font-bold transition"
                >
                  + @student_name
                </button>
                <button
                  type="button"
                  onClick={() => insertTextAtCursor("@father_name ")}
                  className="px-2 py-0.5 bg-[var(--primary-light)] hover:bg-[var(--primary-light)] text-primary rounded-full border border-[var(--primary-light)] text-[10px] font-bold transition"
                >
                  + @father_name
                </button>
                <button
                  type="button"
                  onClick={() => insertTextAtCursor("@admission_number ")}
                  className="px-2 py-0.5 bg-[var(--primary-light)] hover:bg-[var(--primary-light)] text-primary rounded-full border border-[var(--primary-light)] text-[10px] font-bold transition"
                >
                  + @admission_number
                </button>
                <button
                  type="button"
                  onClick={() => insertTextAtCursor("@course ")}
                  className="px-2 py-0.5 bg-[var(--primary-light)] hover:bg-[var(--primary-light)] text-primary rounded-full border border-[var(--primary-light)] text-[10px] font-bold transition"
                >
                  + @course
                </button>
                <button
                  type="button"
                  onClick={() => insertTextAtCursor("@branch ")}
                  className="px-2 py-0.5 bg-[var(--primary-light)] hover:bg-[var(--primary-light)] text-primary rounded-full border border-[var(--primary-light)] text-[10px] font-bold transition"
                >
                  + @branch
                </button>
                <button
                  type="button"
                  onClick={() => insertTextAtCursor("@principal_signature ")}
                  className="px-2 py-0.5 bg-[var(--primary-light)] hover:bg-[var(--primary-light)] text-secondary rounded-full border border-[var(--primary-light)] text-[10px] font-bold transition"
                >
                  + @principal_signature
                </button>
                <button
                  type="button"
                  onClick={() => insertTextAtCursor(" ___ ")}
                  className="px-2 py-0.5 bg-[var(--warning-light)] hover:bg-[var(--warning-light)] text-warning rounded-full border border-[var(--warning-light)] text-[10px] font-bold transition"
                >
                  + Blank Line (___)
                </button>
              </div>

              {/* The Realistic Word Paper Sheet */}
              <div
                className="bg-surface border border-border-strong transition-all flex flex-col relative"
                style={{
                  width: `${(canvasSheetWidth * zoomLevel) / 100}px`,
                  minHeight: `${(canvasSheetHeight * zoomLevel) / 100}px`,
                  boxShadow:
                    "0 12px 36px -4px rgba(0, 0, 0, 0.18), 0 4px 12px -2px rgba(0, 0, 0, 0.08)",
                  paddingLeft: `${templateData.padding_left || 40}px`,
                  paddingRight: `${templateData.padding_right || 40}px`,
                  paddingTop: `${templateData.padding_top || 40}px`,
                  paddingBottom: `${templateData.padding_bottom || 40}px`,
                }}
              >
                {/* Dynamic College Header Section */}
                <div
                  className={`w-full flex-shrink-0 flex flex-col justify-center mb-3 relative transition-all ${
                    editingSection === "header"
                      ? "p-3 bg-[var(--primary-light)] border-2 border-dashed border-primary rounded-lg shadow-sm"
                      : "pb-2 border-b border-border cursor-pointer hover:bg-[var(--background)]/80 rounded group"
                  }`}
                  style={{
                    minHeight: `${templateData.header_height || 80}px`,
                    fontFamily: "Calibri, 'Segoe UI', Arial, sans-serif",
                    fontSize: "12px",
                    fontWeight: "normal",
                    fontStyle: "normal",
                    textDecoration: "none",
                    color: "var(--text-primary)",
                  }}
                  onClick={() => {
                    if (editingSection !== "header") setEditingSection("header");
                  }}
                >
                  {editingSection === "header" ? (
                    <div className="w-full space-y-2" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-between pb-1 border-b border-[var(--primary-light)]">
                        <span className="text-[11px] font-bold text-primary flex items-center gap-1.5">
                          <Building2 size={13} className="text-primary" /> Dynamic College Header (Direct Word Edit)
                        </span>
                        <button
                          type="button"
                          onClick={() => setEditingSection("body")}
                          className="px-2 py-0.5 bg-primary hover:bg-primary-hover text-white rounded text-[10px] font-bold transition flex items-center gap-1"
                        >
                          <Check size={11} /> Done Editing Header
                        </button>
                      </div>

                      <textarea
                        ref={headerInputRef}
                        rows={4}
                        value={templateData.top_content || ""}
                        onChange={(e) =>
                          setTemplateData({
                            ...templateData,
                            top_content: e.target.value,
                          })
                        }
                        onSelect={(e) => {
                          setActiveHeaderCursorPos({
                            start: e.target.selectionStart,
                            end: e.target.selectionEnd,
                          });
                        }}
                        onClick={(e) => {
                          setActiveHeaderCursorPos({
                            start: e.target.selectionStart,
                            end: e.target.selectionEnd,
                          });
                        }}
                        onKeyUp={(e) => {
                          setActiveHeaderCursorPos({
                            start: e.target.selectionStart,
                            end: e.target.selectionEnd,
                          });
                        }}
                        className="w-full p-2 font-mono text-xs border border-[var(--primary-light)] rounded-md focus:ring-1 focus:ring-primary outline-none bg-surface leading-relaxed"
                        placeholder="Type college header lines with formatting tags: [b]...[/b], [size:16]...[/size], [center]...[/center], --- for divider"
                      />

                      {/* Quick Helper Chips for Header */}
                      <div className="flex items-center gap-1.5 flex-wrap text-[10px]">
                        <button
                          type="button"
                          onClick={() =>
                            insertTextAtCursor(
                              `\n[center][b][size:16]${(selectedCollege?.name || "COLLEGE NAME").toUpperCase()}[/size][/b][/center]`
                            )
                          }
                          className="px-2 py-0.5 bg-[var(--primary-light)] hover:bg-[var(--primary-light)] text-primary rounded font-semibold"
                        >
                          + College Title
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            insertTextAtCursor(
                              "\n[center][size:10](Approved by AICTE, Affiliated to Andhra University, NAAC 'A+' Grade)[/size][/center]"
                            )
                          }
                          className="px-2 py-0.5 bg-[var(--primary-light)] hover:bg-[var(--primary-light)] text-primary rounded font-semibold"
                        >
                          + Affiliation / NAAC
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            insertTextAtCursor(
                              `\n[center][size:9]${selectedCollege?.address || "Kakinada - 533001, Andhra Pradesh"} | Phone: ${selectedCollege?.contact || "+91 884 237 9999"}[/size][/center]`
                            )
                          }
                          className="px-2 py-0.5 bg-[var(--primary-light)] hover:bg-[var(--primary-light)] text-primary rounded font-semibold"
                        >
                          + Address & Contact
                        </button>
                        <button
                          type="button"
                          onClick={() => insertTextAtCursor("\n----------------------------------------\n")}
                          className="px-2 py-0.5 bg-background hover:bg-background text-main rounded font-bold"
                        >
                          + Divider Line (---)
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const def =
                              selectedCollege?.metadata?.header_content ||
                              `[center][b][size:16]${(selectedCollege?.name || "").toUpperCase()}[/size][/b][/center]\n[center][size:10](Approved by AICTE, Affiliated to Andhra University, Accredited by NAAC 'A+' Grade)[/size][/center]\n[center][size:9]${selectedCollege?.address || "Kakinada - 533001, Andhra Pradesh"} | Phone: ${selectedCollege?.contact || "+91 884 237 9999"} | Website: ${selectedCollege?.website || "www.pydah.edu.in"}[/size][/center]\n----------------------------------------`;
                            setTemplateData({ ...templateData, top_content: def });
                          }}
                          className="px-2 py-0.5 bg-[var(--warning-light)] hover:bg-[var(--warning-light)] text-warning rounded font-semibold ml-auto"
                        >
                          Reset to College Default
                        </button>
                      </div>

                      {/* Header Image Bar */}
                      <div className="flex items-center gap-2 pt-2 border-t border-[var(--primary-light)] flex-wrap text-xs">
                        <span className="text-[11px] font-bold text-primary flex items-center gap-1">
                          <Image size={13} className="text-primary" /> Header Image / Logo:
                        </span>

                        <input
                          type="file"
                          ref={headerImageInputRef}
                          onChange={handleHeaderImageUpload}
                          accept="image/*"
                          className="hidden"
                        />

                        <button
                          type="button"
                          onClick={() => headerImageInputRef.current?.click()}
                          className="px-2.5 py-1 bg-primary hover:bg-primary-hover text-white rounded text-[11px] font-bold flex items-center gap-1 shadow-2xs"
                        >
                          {templateData.header_image_url ? "Change Image" : "📷 Upload Image"}
                        </button>

                        <button
                          type="button"
                          onClick={handleUseCollegeLogo}
                          className="px-2.5 py-1 bg-background hover:bg-background border border-border-strong text-main rounded text-[11px] font-semibold"
                        >
                          Use College Logo
                        </button>

                        {templateData.header_image_url && (
                          <div className="flex items-center gap-2 ml-auto">
                            <div className="flex items-center gap-1 bg-surface border border-border-strong rounded px-1.5 py-0.5 text-[11px]">
                              <span className="text-muted-text font-medium">Position:</span>
                              {["left", "center", "right"].map((pos) => (
                                <button
                                  key={pos}
                                  type="button"
                                  onClick={() =>
                                    setTemplateData({
                                      ...templateData,
                                      header_image_position: pos,
                                    })
                                  }
                                  className={`px-1.5 py-0.5 rounded capitalize text-[10px] font-bold ${
                                    (templateData.header_image_position || "left") === pos
                                      ? "bg-primary text-white"
                                      : "text-sub hover:bg-background"
                                  }`}
                                >
                                  {pos}
                                </button>
                              ))}
                            </div>

                            <div className="flex items-center gap-1 bg-surface border border-border-strong rounded px-1.5 py-0.5 text-[11px]">
                              <span className="text-muted-text font-medium">Height:</span>
                              <input
                                type="number"
                                min="30"
                                max="150"
                                value={templateData.header_image_height || 65}
                                onChange={(e) =>
                                  setTemplateData({
                                    ...templateData,
                                    header_image_height: parseInt(e.target.value) || 65,
                                  })
                                }
                                className="w-8 text-center font-bold outline-none"
                              />
                              <span className="text-muted-text">px</span>
                            </div>

                            <button
                              type="button"
                              onClick={handleRemoveHeaderImage}
                              className="px-2 py-1 bg-[var(--danger-light)] hover:bg-[var(--danger-light)] text-danger border border-[var(--danger-light)] rounded text-[10px] font-bold flex items-center gap-0.5"
                              title="Remove header image"
                            >
                              <Trash2 size={11} /> Remove Image
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="relative group w-full">
                      {renderHeaderLines(templateData.top_content)}
                      <div className="absolute top-0 right-0 opacity-0 group-hover:opacity-100 transition bg-primary text-white text-[10px] font-bold px-2 py-0.5 rounded shadow-sm flex items-center gap-1">
                        <span>Click to Edit Header</span>
                        <span>✏️</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Direct Word Paper Editor (The Editable Document Body - Pure WYSIWYG) */}
                <div
                  className={`flex-1 flex flex-col relative transition-all ${
                    editingSection === "body" ? "ring-1 ring-[var(--primary-light)] rounded-md p-1" : ""
                  }`}
                  style={{
                    paddingTop: `${templateData.middle_section_padding || 20}px`,
                    paddingBottom: `${templateData.middle_section_padding || 20}px`,
                  }}
                  onClick={() => {
                    if (editingSection !== "body") setEditingSection("body");
                  }}
                >
                  <div className="relative w-full min-h-[520px]">
                    {isInsideTable && (
                      <div className="absolute -top-7 right-2 z-20 flex items-center gap-2 bg-surface border border-[var(--danger-light)] shadow-md px-2.5 py-1 rounded-full text-xs text-danger font-semibold">
                        <Table size={13} className="text-primary" />
                        <span>Table Selected</span>
                        <button
                          type="button"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteTable();
                          }}
                          className="px-2 py-0.5 bg-danger hover:bg-danger text-white rounded text-[11px] font-bold flex items-center gap-1 transition shadow-2xs cursor-pointer"
                          title="Delete this table"
                        >
                          <Trash2 size={11} />
                          Delete Table
                        </button>
                      </div>
                    )}
                    {(!templateData.middle_content || templateData.middle_content.trim() === "") && (
                      <div className="absolute inset-0 pointer-events-none text-muted-text select-none p-1 leading-relaxed">
                        <p className="font-semibold text-muted-text mb-2">Type certificate text here directly on this Word page.</p>
                        <p className="text-xs text-muted-text font-medium">Tips:</p>
                        <ul className="text-xs text-muted-text list-disc list-inside mt-1 space-y-1">
                          <li>Type @ to autocomplete student variables (e.g. @student_name, @father_name, @admission_number, @principal_signature)</li>
                          <li>Type ___ (three underscores) to create fillable blanks</li>
                          <li>Click any Line Alignment button in the toolbar to align that specific line</li>
                        </ul>
                      </div>
                    )}
                    <style>{`
                      .word-editor-canvas ul, .word-preview-container ul {
                        list-style-type: disc !important;
                        margin-left: 28px !important;
                        padding-left: 4px !important;
                      }
                      .word-editor-canvas ol, .word-preview-container ol {
                        list-style-type: decimal !important;
                        margin-left: 28px !important;
                        padding-left: 4px !important;
                      }
                      .word-editor-canvas li, .word-preview-container li {
                        display: list-item !important;
                        margin-bottom: 2px !important;
                      }
                    `}</style>
                    <div
                      ref={contentEditableRef}
                      contentEditable
                      suppressContentEditableWarning
                      onFocus={() => {
                        if (editingSection !== "body") setEditingSection("body");
                        saveCurrentRange();
                      }}
                      onSelect={() => {
                        saveCurrentRange();
                      }}
                      onKeyUp={() => {
                        saveCurrentRange();
                      }}
                      onMouseUp={() => {
                        saveCurrentRange();
                      }}
                      onInput={(e) => {
                        const html = e.currentTarget.innerHTML;
                        const text = e.currentTarget.innerText;
                        if (!text || text.trim() === "") {
                          setTemplateData((prev) => ({
                            ...prev,
                            middle_content: "",
                            font_family: "Calibri",
                            font_size: 12,
                            font_bold: false,
                            font_italic: false,
                            font_underline: false,
                            font_strikethrough: false,
                            font_color: "var(--text-primary)",
                            font_highlight: "transparent",
                          }));
                        } else {
                          const bbcode = htmlToBbcode(html);
                          setTemplateData((prev) => ({
                            ...prev,
                            middle_content: bbcode,
                          }));
                        }
                      }}
                      onPaste={(e) => {
                        e.preventDefault();
                        const html = e.clipboardData.getData("text/html");
                        const text = e.clipboardData.getData("text/plain");
                        const cleanHtml = processPastedContent(html, text);
                        if (cleanHtml) {
                          document.execCommand("insertHTML", false, cleanHtml);
                          const bbcode = htmlToBbcode(e.currentTarget.innerHTML);
                          setTemplateData((prev) => ({ ...prev, middle_content: bbcode }));
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.ctrlKey || e.metaKey) {
                          if (e.key === "b" || e.key === "B") {
                            e.preventDefault();
                            applyFormatToSelection("bold");
                          } else if (e.key === "i" || e.key === "I") {
                            e.preventDefault();
                            applyFormatToSelection("italic");
                          } else if (e.key === "u" || e.key === "U") {
                            e.preventDefault();
                            applyFormatToSelection("underline");
                          } else if (e.key === "l" || e.key === "L") {
                            e.preventDefault();
                            applyLineAlignment("left");
                          } else if (e.key === "e" || e.key === "E") {
                            e.preventDefault();
                            applyLineAlignment("center");
                          } else if (e.key === "r" || e.key === "R") {
                            e.preventDefault();
                            applyLineAlignment("right");
                          } else if (e.key === "j" || e.key === "J") {
                            e.preventDefault();
                            applyLineAlignment("justify");
                          }
                        }

                        // Tab indent / outdent like Word
                        if (e.key === "Tab") {
                          e.preventDefault();
                          if (e.shiftKey) {
                            document.execCommand("outdent", false, null);
                          } else {
                            document.execCommand("indent", false, null);
                          }
                          const bbcode = htmlToBbcode(e.currentTarget.innerHTML);
                          setTemplateData((prev) => ({ ...prev, middle_content: bbcode }));
                        }

                        // Word auto-list
                        if (e.key === " " || e.key === "Spacebar") {
                          const sel = window.getSelection();
                          if (sel && sel.isCollapsed && sel.anchorNode) {
                            const nodeText = sel.anchorNode.textContent || "";
                            const offset = sel.anchorOffset;
                            const textBefore = nodeText.substring(0, offset);
                            if (/^(?:1[.)]|[-*•])$/.test(textBefore.trim())) {
                              e.preventDefault();
                              const isNum = /^(?:1[.)])/.test(textBefore.trim());
                              sel.anchorNode.textContent = nodeText.substring(offset);
                              document.execCommand(isNum ? "insertOrderedList" : "insertUnorderedList", false, null);
                              const bbcode = htmlToBbcode(e.currentTarget.innerHTML);
                              setTemplateData((prev) => ({ ...prev, middle_content: bbcode }));
                            }
                          }
                        }
                      }}
                      className="w-full min-h-[520px] outline-none text-main leading-relaxed font-sans word-editor-canvas"
                      style={{
                        fontFamily: templateData.font_family || "Calibri, 'Segoe UI', Arial, sans-serif",
                        fontSize: `${templateData.font_size || 12}px`,
                        lineHeight: templateData.line_spacing || 1.6,
                        color: templateData.font_color || "var(--text-primary)",
                        whiteSpace: "pre-wrap",
                        wordBreak: "break-word",
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ------------------------------------------------------------ */}
          {/* MODE B: SPLIT VIEW (WORD CANVAS ON LEFT + LIVE OUTPUT RIGHT)  */}
          {/* ------------------------------------------------------------ */}
          {viewMode === "split" && (
            <div className="w-full max-w-7xl flex gap-6 items-start">
              {/* Left Column: Word Document Editor Sheet */}
              <div className="w-1/2 flex flex-col items-center">
                <div className="text-xs font-bold text-sub mb-2 flex items-center gap-1.5 self-start">
                  <FileText size={14} className="text-[var(--primary)]" />
                  <span>Word Document Editor (Type & Edit)</span>
                </div>
                <div
                  className="w-full bg-surface border border-border-strong rounded shadow-lg p-6 flex flex-col"
                  style={{
                    minHeight: "750px",
                    paddingLeft: `${templateData.padding_left || 40}px`,
                    paddingRight: `${templateData.padding_right || 40}px`,
                    paddingTop: `${templateData.padding_top || 40}px`,
                    paddingBottom: `${templateData.padding_bottom || 40}px`,
                  }}
                >
                  {/* Dynamic Header */}
                  <div className="w-full pb-2 mb-3 border-b border-dashed border-border">
                    {renderHeaderLines(templateData.top_content)}
                  </div>

                  {/* Mentions Input */}
                  <div className="flex-1">
                    <MentionsInput
                      inputRef={contentInputRef}
                      value={templateData.middle_content}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (!val || val.trim() === "") {
                          setTemplateData((prev) => ({
                            ...prev,
                            middle_content: "",
                            font_family: "Calibri",
                            font_size: 12,
                            font_bold: false,
                            font_italic: false,
                            font_underline: false,
                            font_strikethrough: false,
                            font_color: "var(--text-primary)",
                            font_highlight: "transparent",
                          }));
                        } else {
                          setTemplateData((prev) => ({
                            ...prev,
                            middle_content: val,
                          }));
                        }
                      }}
                      onKeyDown={(e) => {
                        const handled = handleListKeyDown(e, "middle_content");
                        if (handled) return;

                        if (e.key === "Backspace" || e.key === "Delete") {
                          const content = templateData.middle_content || "";
                          const start = e.target.selectionStart;
                          const end = e.target.selectionEnd;
                          if (
                            content.length <= 1 ||
                            (start === 0 && end >= content.length) ||
                            content.trim() === ""
                          ) {
                            setTemplateData((prev) => ({
                              ...prev,
                              middle_content: "",
                              font_family: "Calibri",
                              font_size: 12,
                              font_bold: false,
                              font_italic: false,
                              font_underline: false,
                              font_strikethrough: false,
                              font_color: "var(--text-primary)",
                              font_highlight: "transparent",
                            }));
                          }
                        }
                        if (e.ctrlKey || e.metaKey) {
                          if (e.key === "b" || e.key === "B") {
                            e.preventDefault();
                            applyFormatToSelection("bold");
                          } else if (e.key === "i" || e.key === "I") {
                            e.preventDefault();
                            applyFormatToSelection("italic");
                          } else if (e.key === "u" || e.key === "U") {
                            e.preventDefault();
                            applyFormatToSelection("underline");
                          }
                        }
                      }}
                      onSelect={(e) => {
                        const s = e.target.selectionStart;
                        const end = e.target.selectionEnd;
                        setActiveCursorPos({ start: s, end });
                        if (typeof s === "number" && typeof end === "number" && s !== end) {
                          lastValidSelectionRef.current = { start: s, end, field: "middle_content", section: "body" };
                        }
                      }}
                      onClick={(e) => {
                        const s = e.target.selectionStart;
                        const end = e.target.selectionEnd;
                        setActiveCursorPos({ start: s, end });
                        if (typeof s === "number" && typeof end === "number" && s !== end) {
                          lastValidSelectionRef.current = { start: s, end, field: "middle_content", section: "body" };
                        }
                      }}
                      onKeyUp={(e) => {
                        const s = e.target.selectionStart;
                        const end = e.target.selectionEnd;
                        setActiveCursorPos({ start: s, end });
                        if (typeof s === "number" && typeof end === "number" && s !== end) {
                          lastValidSelectionRef.current = { start: s, end, field: "middle_content", section: "body" };
                        }
                      }}
                      style={{
                        ...getMentionStyle(templateData.middle_alignment || "left"),
                        control: {
                          ...getMentionStyle(templateData.middle_alignment || "left")
                            .control,
                          minHeight: 460,
                        },
                      }}
                      placeholder={`Type certificate text here directly on this Word page.\n\nTips:\n• Type @ to autocomplete student variables (e.g. @student_name, @father_name, @admission_number, @principal_signature)\n• Type ___ (three underscores) to create fillable blanks\n• Click any Line Alignment button in the toolbar to align that specific line`}
                    >
                      <Mention
                        trigger="@"
                        data={mentionData}
                        style={{ backgroundColor: "var(--primary-light)" }}
                      />
                    </MentionsInput>
                  </div>
                </div>
              </div>

              {/* Right Column: Live Rendered Certificate Sheet */}
              <div className="w-1/2 flex flex-col items-center">
                <div className="text-xs font-bold text-sub mb-2 flex items-center gap-1.5 self-start">
                  <Eye size={14} className="text-success" />
                  <span>Real-Time Certificate Output (Variables Replaced)</span>
                </div>
                <div
                  className="w-full bg-surface border border-border-strong rounded shadow-lg overflow-hidden flex flex-col"
                  style={{
                    minHeight: "750px",
                    paddingLeft: `${templateData.padding_left || 40}px`,
                    paddingRight: `${templateData.padding_right || 40}px`,
                    paddingTop: `${templateData.padding_top || 40}px`,
                    paddingBottom: `${templateData.padding_bottom || 40}px`,
                  }}
                >
                  {/* Dynamic Header */}
                  <div className="w-full mb-3">
                    {renderHeaderLines(templateData.top_content)}
                  </div>

                  {/* Formatted Certificate Content */}
                  <div
                    className="flex-1 text-main"
                    style={{
                      paddingTop: `${templateData.middle_section_padding || 20}px`,
                      paddingBottom: `${templateData.middle_section_padding || 20}px`,
                      fontSize: `${templateData.font_size || 12}px`,
                      lineHeight: templateData.line_spacing || 1.6,
                      fontFamily:
                        templateData.font_family ||
                        "Calibri, 'Segoe UI', Arial, sans-serif",
                      fontWeight: templateData.font_bold ? "bold" : "normal",
                      fontStyle: templateData.font_italic ? "italic" : "normal",
                      textDecoration: [
                        templateData.font_underline ? "underline" : "",
                        templateData.font_strikethrough ? "line-through" : "",
                      ]
                        .filter(Boolean)
                        .join(" ") || "none",
                      color: templateData.font_color || "var(--text-primary)",
                    }}
                  >
                    {templateData.middle_content ? (
                      <div className="whitespace-pre-wrap">
                        {processContentForPreview(
                          templateData.middle_content,
                          templateData.middle_alignment || "left",
                        )}
                      </div>
                    ) : (
                      <div className="h-64 flex flex-col items-center justify-center text-muted-text">
                        <FileText size={40} className="mb-2 opacity-40" />
                        <p className="text-sm font-semibold">Start typing in the editor on the left</p>
                        <p className="text-xs mt-1">Variables and fillable lines will render here live</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ------------------------------------------------------------ */}
          {/* MODE C: FULL PRINT PREVIEW                                   */}
          {/* ------------------------------------------------------------ */}
          {viewMode === "preview" && (
            <div className="flex flex-col items-center gap-3">
              <div
                className="bg-surface border border-border-strong shadow-2xl flex flex-col"
                style={{
                  width: `${(canvasSheetWidth * zoomLevel) / 100}px`,
                  minHeight: `${(canvasSheetHeight * zoomLevel) / 100}px`,
                  paddingLeft: `${templateData.padding_left || 40}px`,
                  paddingRight: `${templateData.padding_right || 40}px`,
                  paddingTop: `${templateData.padding_top || 40}px`,
                  paddingBottom: `${templateData.padding_bottom || 40}px`,
                }}
              >
                {/* Dynamic Header */}
                <div className="w-full mb-3">
                  {renderHeaderLines(templateData.top_content)}
                </div>

                {/* Content */}
                <div
                  className="flex-1 text-main"
                  style={{
                    paddingTop: `${templateData.middle_section_padding || 20}px`,
                    paddingBottom: `${templateData.middle_section_padding || 20}px`,
                    fontSize: `${templateData.font_size || 12}px`,
                    lineHeight: templateData.line_spacing || 1.6,
                    fontFamily:
                      templateData.font_family ||
                      "Calibri, 'Segoe UI', Arial, sans-serif",
                    fontWeight: templateData.font_bold ? "bold" : "normal",
                    fontStyle: templateData.font_italic ? "italic" : "normal",
                    textDecoration: [
                      templateData.font_underline ? "underline" : "",
                      templateData.font_strikethrough ? "line-through" : "",
                    ]
                      .filter(Boolean)
                      .join(" ") || "none",
                    color: templateData.font_color || "var(--text-primary)",
                  }}
                >
                  {processContentForPreview(
                    templateData.middle_content,
                    templateData.middle_alignment || "left",
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ============================================================== */}
        {/* 6. MICROSOFT WORD STATUS BAR (BOTTOM)                          */}
        {/* ============================================================== */}
        <div className="bg-[var(--primary)] text-white px-4 py-1 flex items-center justify-between text-[11px] flex-shrink-0 select-none shadow-md">
          {/* Left Stats */}
          <div className="flex items-center gap-3">
            <span className="font-semibold">Page 1 of 1</span>
            <span className="text-primary">|</span>
            <span className="bg-[var(--primary-light)] px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide">
              {activeSheet.label} • {isLandscape ? "Landscape" : "Portrait"} ({activeSheet.mm})
            </span>
            <span className="text-primary">|</span>
            <span>{wordCount} words</span>
            <span className="text-primary">|</span>
            <span>{charCount} characters</span>
            <span className="text-primary">|</span>
            <span className="truncate max-w-xs text-primary">
              College: {selectedCollege?.name || "None"}
            </span>
          </div>

          {/* Center Brand */}
          <div className="hidden md:flex items-center gap-1.5 text-primary text-[10px]">
            <span>Microsoft Word Replica</span>
            <span>•</span>
            <span>Dynamic College Header & Body Engine</span>
          </div>

          {/* Right: View Modes & Zoom Controls */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setViewMode("word-canvas")}
                className={`p-0.5 rounded ${viewMode === "word-canvas" ? "bg-[var(--surface)]/20 text-white" : "text-primary hover:text-white"}`}
                title="Word Canvas"
              >
                <FileText size={12} />
              </button>
              <button
                type="button"
                onClick={() => setViewMode("split")}
                className={`p-0.5 rounded ${viewMode === "split" ? "bg-[var(--surface)]/20 text-white" : "text-primary hover:text-white"}`}
                title="Split View"
              >
                <Columns size={12} />
              </button>
              <button
                type="button"
                onClick={() => setViewMode("preview")}
                className={`p-0.5 rounded ${viewMode === "preview" ? "bg-[var(--surface)]/20 text-white" : "text-primary hover:text-white"}`}
                title="Print Preview"
              >
                <Eye size={12} />
              </button>
            </div>

            <div className="flex items-center gap-1.5 border-l border-primary pl-3">
              <button
                type="button"
                onClick={() => setZoomLevel((z) => Math.max(z - 10, 60))}
                className="hover:bg-[var(--primary-light)] p-0.5 rounded text-white"
                title="Zoom Out"
              >
                <ZoomOut size={12} />
              </button>
              <input
                type="range"
                min="60"
                max="140"
                step="5"
                value={zoomLevel}
                onChange={(e) => setZoomLevel(parseInt(e.target.value))}
                className="w-16 h-1 bg-primary rounded-lg appearance-none cursor-pointer accent-surface"
              />
              <button
                type="button"
                onClick={() => setZoomLevel((z) => Math.min(z + 10, 140))}
                className="hover:bg-[var(--primary-light)] p-0.5 rounded text-white"
                title="Zoom In"
              >
                <ZoomIn size={12} />
              </button>
              <span className="font-mono text-[10px] w-8 text-right font-semibold">
                {zoomLevel}%
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  };

    const renderStep3 = () => (
    <div className="space-y-8 max-w-6xl mx-auto py-6">
      <div className="text-center mb-8">
        <h2 className="text-4xl font-bold text-main flex items-center justify-center gap-4 mb-3">
          <Eye size={40} className="text-success" />
          Final Review
        </h2>
        <p className="text-sub text-lg">
          Review your certificate configuration before publishing
        </p>
        <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-[var(--primary-light)] border border-[var(--primary-light)] rounded-full text-sm text-primary font-medium">
          <Check size={16} />
          All settings configured successfully
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-gradient-to-br from-surface to-[var(--primary-light)] p-6 rounded-2xl shadow-lg border-2 border-[var(--primary-light)]">
            <h3 className="text-xl font-bold mb-4 border-b-2 border-[var(--primary-light)] pb-3 text-primary">
              📋 Service Details
            </h3>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-muted-text uppercase">
                  Service Name
                </label>
                <p className="font-semibold text-main">
                  {serviceData.name}
                </p>
              </div>
              <div>
                <label className="text-xs font-bold text-muted-text uppercase">
                  College
                </label>
                <p className="font-semibold text-main border-l-2 border-primary pl-2">
                  {colleges.find((c) => c.id == serviceData.college_id)?.name}
                </p>
              </div>
              <div>
                <label className="text-xs font-bold text-muted-text uppercase">
                  Price
                </label>
                <p className="text-xl font-bold text-primary">
                  ₹{serviceData.price}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-surface to-[var(--success-light)] p-6 rounded-2xl shadow-lg border-2 border-[var(--success-light)]">
            <h3 className="text-xl font-bold mb-4 border-b-2 border-[var(--success-light)] pb-3 text-success">
              ⚙️ Layout Settings
            </h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <label className="text-muted-text block">Font Size</label>
                <span className="font-medium">{templateData.font_size}px</span>
              </div>
              <div>
                <label className="text-muted-text block">Spacing</label>
                <span className="font-medium">{templateData.line_spacing}</span>
              </div>
              <div>
                <label className="text-muted-text block">Orientation</label>
                <span className="font-medium capitalize">
                  {templateData.page_orientation}
                </span>
              </div>
              <div>
                <label className="text-muted-text block">Sheet Size</label>
                <span className="font-medium uppercase">
                  {templateData.page_size || "A4"}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-2 space-y-4">
          <div className="bg-surface p-4 rounded-2xl shadow-2xl border-2 border-border-strong aspect-[1/1.414] overflow-hidden flex flex-col">
            <div className="px-4 py-3 border-b-2 border-border bg-gradient-to-r from-[var(--primary-light)] to-[var(--primary-light)] flex justify-between items-center rounded-t-xl">
              <span className="text-base font-bold text-main flex items-center gap-2">
                <Eye size={20} />
                Certificate Preview
              </span>
              <button
                onClick={generatePreview}
                className="px-3 py-1.5 bg-primary text-white rounded-lg hover:bg-primary-hover text-xs font-bold uppercase transition-all hover:shadow-md flex items-center gap-1"
              >
                <ArrowRight size={14} />
                Refresh
              </button>
            </div>
            <div className="flex-1 bg-background rounded-b-xl overflow-hidden">
              {finalPreviewJson ? (
                <iframe
                  src={finalPreviewJson}
                  className="w-full h-full bg-surface"
                  title="Final Step Preview"
                />
              ) : (
                <div className="flex h-full items-center justify-center text-muted-text flex-col gap-3">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-primary"></div>
                  <p className="font-semibold">Generating Preview...</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-between items-center bg-gradient-to-r from-[var(--primary-light)] to-[var(--success-light)] p-6 rounded-2xl border-2 border-[var(--primary-light)] shadow-lg mt-8">
        <button
          onClick={() => setCurrentStep(2)}
          className="px-6 py-3 border-2 border-border-strong rounded-xl hover:bg-surface hover:shadow-md flex items-center gap-2 font-semibold transition-all"
        >
          <ArrowLeft size={20} /> Back to Edit
        </button>
        <button
          onClick={handleFinalSubmit}
          disabled={loading}
          className="px-12 py-3 bg-primary text-white rounded-xl hover:bg-primary-hover flex items-center gap-3 text-lg font-bold shadow-lg shadow-primary disabled:opacity-50 transition-all hover:scale-[1.02]"
        >
          <Check size={24} /> Confirm & Publish Service
        </button>
      </div>
    </div>
  );

  return (
    <div
      className={
        currentStep === 2
          ? ""
          : "p-6 sm:p-8 w-full max-w-full space-y-6 animate-fade-in"
      }
    >
      {/* Header - Hide on Step 2 */}
      {currentStep !== 2 && (
        <div className="flex items-center gap-4 mb-6">
          <button
            onClick={() => navigate("/services/config")}
            className="p-2 hover:bg-background rounded-lg transition"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-main">
              {isEditing ? "Edit Service" : "Add New Service"}
            </h1>
            <p className="text-muted-text">Step {currentStep} of 3</p>
          </div>
        </div>
      )}

      {/* Step Indicator - Hide on Step 2 */}
      {currentStep !== 2 && renderStepIndicator()}

      {/* Step Content */}
      {currentStep === 1 && renderStep1()}
      {currentStep === 2 && renderStep2()}
      {currentStep === 3 && renderStep3()}
    </div>
  );
};

export default AddServiceWizard;
