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
  Plus,
  Trash2,
  X,
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
  const [undoStack, setUndoStack] = useState([]);
  const [redoStack, setRedoStack] = useState([]);

  const contentInputRef = React.useRef(null);
  const headerInputRef = React.useRef(null);
  const [activeCursorPos, setActiveCursorPos] = useState({ start: 0, end: 0 });
  const [activeHeaderCursorPos, setActiveHeaderCursorPos] = useState({ start: 0, end: 0 });

  const getTargetField = () => (editingSection === "header" ? "top_content" : "middle_content");
  const getTargetRef = () => (editingSection === "header" ? headerInputRef.current : contentInputRef.current);
  const getTargetCursor = () => (editingSection === "header" ? activeHeaderCursorPos : activeCursorPos);

  const insertTextAtCursor = (textToInsert) => {
    const targetField = getTargetField();
    const textarea = getTargetRef();
    const content = templateData[targetField] || "";
    const cursor = getTargetCursor();
    const start = textarea ? textarea.selectionStart : cursor.start;
    const end = textarea ? textarea.selectionEnd : cursor.end;

    setUndoStack((prev) => [...prev.slice(-20), content]);
    setRedoStack([]);

    const newContent = content.substring(0, start) + textToInsert + content.substring(end);
    setTemplateData((prev) => ({
      ...prev,
      [targetField]: newContent,
    }));

    setTimeout(() => {
      if (textarea) {
        textarea.focus();
        const nextPos = start + textToInsert.length;
        textarea.setSelectionRange(nextPos, nextPos);
        if (editingSection === "header") {
          setActiveHeaderCursorPos({ start: nextPos, end: nextPos });
        } else {
          setActiveCursorPos({ start: nextPos, end: nextPos });
        }
      }
    }, 50);
  };

  const handleUndo = () => {
    if (undoStack.length === 0) return;
    const targetField = getTargetField();
    const prevContent = undoStack[undoStack.length - 1];
    setRedoStack((prev) => [...prev, templateData[targetField] || ""]);
    setUndoStack((prev) => prev.slice(0, -1));
    setTemplateData((prev) => ({ ...prev, [targetField]: prevContent }));
  };

  const handleRedo = () => {
    if (redoStack.length === 0) return;
    const targetField = getTargetField();
    const nextContent = redoStack[redoStack.length - 1];
    setUndoStack((prev) => [...prev, templateData[targetField] || ""]);
    setRedoStack((prev) => prev.slice(0, -1));
    setTemplateData((prev) => ({ ...prev, [targetField]: nextContent }));
  };

  const applyLineAlignment = (alignment) => {
    const targetField = getTargetField();
    const content = templateData[targetField] || "";
    const textarea = getTargetRef();
    const cursor = getTargetCursor();
    const selStart = textarea ? textarea.selectionStart : cursor.start;
    const selEnd = textarea ? textarea.selectionEnd : cursor.end;

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
      [targetField]: newContent,
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
    footer_height: 60,
    font_size: 12,
    line_spacing: 2,
    top_spacing: 15,
    middle_spacing: 15,
    bottom_spacing: 15,
    blank_variables: [],
    page_size: "A4",
    page_orientation: "portrait",
    input_field_size: 10,
  });

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
          footer_height: template.footer_height || 60,
          font_size: template.font_size || 12,
          line_spacing: template.line_spacing || 2,
          input_field_size: template.input_field_size || 10,
          blank_variables: template.blank_variables || [],
          page_size: template.page_size || "A4",
          page_orientation: template.page_orientation || "portrait",
          college_id: templateCollegeId,
        });
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
      const blob = await serviceService.previewTemplate({
        template_type: "dynamic",
        service_name: serviceData.name,
        college_id: selectedCollegeId,
        template_config: {
          ...templateData,
          college_id: selectedCollegeId,
        },
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

      // 1. Create/Update Service (without college_id - that's stored in template)
      const servicePayload = {
        name: serviceData.name,
        description: serviceData.description,
        price: serviceData.price,
        is_active: serviceData.is_active,
        template_type: "dynamic",
        template_config: templateData,
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
        ...templateData,
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
                    ? "bg-blue-600 border-blue-600 text-white"
                    : "bg-white border-gray-300 text-gray-400"
                }`}
              >
                {currentStep > step.num ? <Check size={20} /> : index + 1}
              </div>
              <span className="text-xs mt-1 text-gray-600">{step.label}</span>
            </div>
            {index < steps.length - 1 && (
              <div
                className={`w-16 h-1 transition mb-6 ${
                  currentStep > step.num ? "bg-blue-600" : "bg-gray-300"
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
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading service details...</p>
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold text-gray-900 flex items-center justify-center gap-2">
            <FileText size={28} className="text-blue-600" />
            Service Details
          </h2>
          <p className="text-gray-500 mt-2">
            Enter basic information about the service
          </p>
        </div>

        <div className="bg-white p-6 sm:p-8 rounded-2xl shadow-sm border border-gray-200 space-y-5 w-full">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Service Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={serviceData.name}
                onChange={(e) => {
                  // Restriction: only letters and spaces allowed
                  const lettersOnly = e.target.value.replace(/[^a-zA-Z\s]/g, "");
                  setServiceData({ ...serviceData, name: lettersOnly });
                }}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                placeholder="e.g., Transfer Certificate (Letters only)"
              />
              <p className="text-[11px] text-gray-500 mt-1">
                Letters only restriction: only alphabetic characters and spaces are allowed.
              </p>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Select College <span className="text-red-500">*</span>
              </label>
              <select
                value={serviceData.college_id || ""}
                onChange={(e) =>
                  setServiceData({ ...serviceData, college_id: e.target.value })
                }
                className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition bg-white"
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
              <p className="text-xs text-gray-500 mt-1.5">
                The certificate will use this college's header and footer images
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 items-center">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Price (₹) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                value={serviceData.price}
                onChange={(e) =>
                  setServiceData({ ...serviceData, price: e.target.value })
                }
                className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                placeholder="e.g., 100"
              />
            </div>

            <div className="pt-2 sm:pt-6">
              <label className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-100 transition">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={serviceData.is_active}
                  onChange={(e) =>
                    setServiceData({ ...serviceData, is_active: e.target.checked })
                  }
                  className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500 cursor-pointer"
                />
                <div>
                  <span className="text-sm font-semibold text-gray-800 block">
                    Active Service
                  </span>
                  <span className="text-xs text-gray-500">
                    Immediately available to students in the portal
                  </span>
                </div>
              </label>
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Description
            </label>
            <textarea
              value={serviceData.description}
              onChange={(e) =>
                setServiceData({ ...serviceData, description: e.target.value })
              }
              className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
              rows="3"
              placeholder="Brief description of the service"
            />
          </div>
        </div>

        <div className="flex justify-between">
          <button
            onClick={() => navigate("/services/config")}
            className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2"
          >
            <ArrowLeft size={18} /> Cancel
          </button>
          <button
            onClick={handleStep1Submit}
            disabled={loading}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 disabled:opacity-50"
          >
            Next: Certificate Content <ArrowRight size={18} />
          </button>
        </div>
      </div>
    );
  };

const renderStep2 = () => {
    // Get college header/footer images
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

    const footerImageUrl = selectedCollege?.footer_image_url
      ? getImageUrl(selectedCollege.footer_image_url)
      : null;

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

    // Mention style for autocomplete with whitespace preservation
    const getMentionStyle = (alignment = "center") => ({
      control: {
        backgroundColor: "transparent",
        fontSize: `${templateData.font_size || 12}px`,
        fontFamily: templateData.font_family || "Calibri, 'Segoe UI', Arial, sans-serif",
        lineHeight: templateData.line_spacing || 1.6,
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
      },
      input: {
        margin: 0,
        padding: 0,
        border: 0,
        outline: 0,
        textAlign: alignment,
        whiteSpace: "pre-wrap",
        fontFamily: templateData.font_family || "Calibri, 'Segoe UI', Arial, sans-serif",
        fontSize: `${templateData.font_size || 12}px`,
        lineHeight: templateData.line_spacing || 1.6,
      },
      suggestions: {
        list: {
          backgroundColor: "#ffffff",
          border: "1px solid #c7d2fe",
          borderRadius: "0.5rem",
          boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.2), 0 8px 10px -6px rgba(0, 0, 0, 0.1)",
          maxHeight: 260,
          overflow: "auto",
          zIndex: 9999,
          padding: "4px 0",
        },
        item: {
          padding: "7px 12px",
          borderBottom: "1px solid #f1f5f9",
          fontSize: "12px",
          color: "#1e3a8a",
          "&focused": {
            backgroundColor: "#dbeafe",
            fontWeight: 600,
          },
        },
      },
    });

    // Render dynamic college header with typography and styling
    const renderHeaderLines = (content) => {
      const headerText =
        content && content.trim()
          ? content
          : selectedCollege?.metadata?.header_content ||
            `[center][b][size:16]${(selectedCollege?.name || "PYDAH COLLEGE").toUpperCase()}[/size][/b][/center]\n[center][size:10](Approved by AICTE, Affiliated to Andhra University, Accredited by NAAC 'A+' Grade)[/size][/center]\n----------------------------------------`;

      const lines = headerText
        .replace(/\r\n/g, "\n")
        .replace(/\r/g, "\n")
        .split("\n");

      return (
        <div
          className="w-full flex flex-col justify-center"
          style={{ minHeight: `${templateData.header_height || 80}px` }}
        >
          {lines.map((line, idx) => {
            let text = line.trim();
            if (!text) return <div key={idx} className="h-1" />;

            // Divider rule (--- or ===)
            if (/^[-=_*]{3,}$/.test(text)) {
              return (
                <div
                  key={idx}
                  className="my-1 border-b-2 border-blue-950 w-full"
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

            let isBold = false;
            const boldMatch = text.match(/\[(b|bold)\]([\s\S]*?)\[\/\1\]/i);
            if (boldMatch) {
              isBold = true;
              text = boldMatch[2];
            }

            let size = 11;
            const sizeMatch = text.match(
              /\[size:(\d+(?:\.\d+)?)\]([\s\S]*?)\[\/size\]/i,
            );
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
                  color: isBold ? "#0f2942" : "#334155",
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

    // Process content to show input fields for ___ and replace @ variables with individual line alignment
    const processContentForPreview = (content, defaultAlignment = "left") => {
      if (!content) return "";

      const lines = content
        .replace(/\r\n/g, "\n")
        .replace(/\r/g, "\n")
        .split("\n");
      return (
        <div className="w-full">
          {lines.map((line, idx) => {
            let lineAlign = defaultAlignment;
            let text = line.replace(/[\t\r]/g, " ");

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

            // Normalize runs of 4 or more spaces into an input blank
            text = text.replace(/ {4,}/g, " ___ ");

            let processed = text
              .replace(/&/g, "&amp;")
              .replace(/</g, "&lt;")
              .replace(/>/g, "&gt;");

            // Represent all @ variables with specific fixed length for each field
            const replaceVariableWithSpec = (varKey, rawMatch) => {
              const cleanKey = varKey.replace(/^@/, "").trim();
              const spec = VARIABLE_SPECS[cleanKey] || {
                fixedChars: 12,
                minWidth: 80,
              };
              if (cleanKey === "principal_signature") {
                return `<span class="inline-block border-b-2 border-slate-700 text-center font-semibold text-slate-800 mx-1 px-2" style="min-width: 140px;">[Principal Signature]</span>`;
              }
              return `<span class="inline-block border-b-2 border-blue-600 font-bold text-blue-900 mx-0.5 px-1 bg-blue-50/70 text-center underline underline-offset-4 decoration-blue-600 decoration-2" style="min-width: ${spec.minWidth}px;" title="Variable: @${cleanKey} (${spec.fixedChars} chars)">@${cleanKey}</span>`;
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
                return `<span class="inline-block border-b border-gray-900 align-baseline mx-1" style="min-width:${width}px;height:1em;" title="Input Field">&nbsp;</span>`;
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
        className="fixed top-0 right-0 bottom-0 left-0 lg:left-64 flex flex-col bg-[#eef1f5] overflow-hidden z-50 select-none font-sans"
        onClick={() => {
          if (showVariableDropdown) setShowVariableDropdown(false);
        }}
      >
        {/* ============================================================== */}
        {/* 1. MICROSOFT WORD APP TITLE BAR                                */}
        {/* ============================================================== */}
        <div className="bg-[#185abd] text-white px-3 py-1.5 flex items-center justify-between shadow-md flex-shrink-0">
          {/* Left: Word Icon, File Name & Quick Access */}
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 bg-white rounded flex items-center justify-center shadow-xs">
              <span className="text-[#185abd] font-black text-sm tracking-tighter">W</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-xs tracking-wide text-white">
                {serviceData.name ? `${serviceData.name} - Certificate` : "Document1"}
              </span>
              <span className="text-blue-200 text-[11px]">- Microsoft Word</span>
              <span className="ml-1 px-1.5 py-0.5 bg-blue-700/60 rounded text-[10px] text-blue-100 flex items-center gap-1 font-medium">
                <CheckCircle size={10} className="text-emerald-300" /> AutoSaved
              </span>
            </div>

            {/* Quick Access Toolbar */}
            <div className="flex items-center gap-0.5 ml-2 border-l border-blue-400/40 pl-2">
              <button
                type="button"
                onClick={handleUndo}
                title="Undo (Ctrl+Z)"
                className="p-1 hover:bg-blue-600/60 rounded text-blue-100 hover:text-white transition"
              >
                <RotateCcw size={13} />
              </button>
              <button
                type="button"
                onClick={handleRedo}
                title="Redo (Ctrl+Y)"
                className="p-1 hover:bg-blue-600/60 rounded text-blue-100 hover:text-white transition"
              >
                <RotateCw size={13} />
              </button>
            </div>
          </div>

          {/* Center: View Mode Switcher Pills */}
          <div className="flex items-center bg-blue-800/60 p-0.5 rounded-lg border border-blue-400/30 text-xs">
            <button
              type="button"
              onClick={() => setViewMode("word-canvas")}
              className={`px-3 py-1 rounded-md text-xs font-semibold flex items-center gap-1.5 transition ${
                viewMode === "word-canvas"
                  ? "bg-white text-[#185abd] shadow-xs"
                  : "text-blue-100 hover:text-white hover:bg-blue-700/50"
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
                  ? "bg-white text-[#185abd] shadow-xs"
                  : "text-blue-100 hover:text-white hover:bg-blue-700/50"
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
                  ? "bg-white text-[#185abd] shadow-xs"
                  : "text-blue-100 hover:text-white hover:bg-blue-700/50"
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
              className="px-3 py-1 bg-blue-700/70 hover:bg-blue-700 text-white rounded-md text-xs font-medium flex items-center gap-1.5 transition border border-blue-400/40"
            >
              <ArrowLeft size={13} /> Back
            </button>
            <button
              type="button"
              onClick={handleStep2Submit}
              className="px-3.5 py-1 bg-emerald-500 hover:bg-emerald-600 text-white rounded-md text-xs font-bold flex items-center gap-1.5 transition shadow-xs"
            >
              Save & Preview <Check size={14} />
            </button>
          </div>
        </div>

        {/* ============================================================== */}
        {/* 2. MICROSOFT WORD RIBBON MENU TABS                             */}
        {/* ============================================================== */}
        <div className="bg-[#f3f2f1] border-b border-[#d2d0ce] px-3 flex items-center justify-between text-xs flex-shrink-0 select-none">
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
                    ? "bg-white text-[#185abd] font-bold border-t-[#185abd] border-x border-x-[#d2d0ce] -mb-px shadow-2xs"
                    : "border-t-transparent text-slate-700 hover:bg-[#edebe9] hover:text-slate-900"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Target Section Switcher: Certificate Body vs College Header */}
          <div className="flex items-center bg-slate-200/80 p-0.5 rounded-lg border border-slate-300">
            <button
              type="button"
              onClick={() => setEditingSection("body")}
              className={`px-2.5 py-1 rounded text-xs font-bold flex items-center gap-1.5 transition ${
                editingSection === "body"
                  ? "bg-white text-blue-700 shadow-xs"
                  : "text-slate-700 hover:text-slate-900"
              }`}
            >
              <FileText size={12} /> Certificate Body
            </button>
            <button
              type="button"
              onClick={() => setEditingSection("header")}
              className={`px-2.5 py-1 rounded text-xs font-bold flex items-center gap-1.5 transition ${
                editingSection === "header"
                  ? "bg-blue-600 text-white shadow-xs"
                  : "text-slate-700 hover:text-slate-900"
              }`}
            >
              <Building2 size={12} /> Dynamic College Header
            </button>
          </div>
        </div>

        {/* ============================================================== */}
        {/* 3. MICROSOFT WORD RIBBON TOOLBAR                               */}
        {/* ============================================================== */}
        <div className="bg-white border-b border-[#d2d0ce] px-3 py-1.5 flex items-center text-xs flex-shrink-0 shadow-2xs overflow-x-auto min-h-[66px]">
          {/* TAB 1: HOME */}
          {activeRibbonTab === "home" && (
            <div className="flex items-center gap-3 divide-x divide-slate-200">
              {/* Group A: Font & Typography */}
              <div className="flex flex-col gap-1 pr-3">
                <div className="flex items-center gap-1.5">
                  {/* Font Family */}
                  <select
                    value={templateData.font_family || "Calibri"}
                    onChange={(e) =>
                      setTemplateData({
                        ...templateData,
                        font_family: e.target.value,
                      })
                    }
                    className="h-6 px-1.5 text-xs bg-slate-50 border border-slate-300 rounded font-medium text-slate-800 outline-none hover:border-blue-400 focus:border-blue-500 cursor-pointer"
                  >
                    <option value="Calibri">Calibri</option>
                    <option value="Arial">Arial</option>
                    <option value="'Times New Roman', serif">Times New Roman</option>
                    <option value="Georgia, serif">Georgia</option>
                    <option value="'Courier New', monospace">Courier New</option>
                  </select>

                  {/* Font Size */}
                  <div className="flex items-center border border-slate-300 rounded bg-slate-50 h-6 px-1">
                    <span className="text-[10px] text-slate-500 mr-1">Size:</span>
                    <input
                      type="number"
                      min="8"
                      max="24"
                      value={templateData.font_size || 12}
                      onChange={(e) =>
                        setTemplateData({
                          ...templateData,
                          font_size: parseInt(e.target.value) || 12,
                        })
                      }
                      className="w-6 text-center text-xs font-bold text-slate-800 bg-transparent outline-none"
                    />
                    <span className="text-[9px] text-slate-400">px</span>
                  </div>

                  {/* Font Size +/- buttons */}
                  <button
                    type="button"
                    onClick={() =>
                      setTemplateData((prev) => ({
                        ...prev,
                        font_size: Math.min((prev.font_size || 12) + 1, 24),
                      }))
                    }
                    className="w-6 h-6 flex items-center justify-center bg-slate-50 hover:bg-slate-200 border border-slate-300 rounded text-slate-700 font-bold text-xs"
                    title="Grow Font"
                  >
                    A⁺
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setTemplateData((prev) => ({
                        ...prev,
                        font_size: Math.max((prev.font_size || 12) - 1, 8),
                      }))
                    }
                    className="w-6 h-6 flex items-center justify-center bg-slate-50 hover:bg-slate-200 border border-slate-300 rounded text-slate-700 font-bold text-[10px]"
                    title="Shrink Font"
                  >
                    A⁻
                  </button>
                </div>

                <div className="text-[9px] text-slate-400 font-medium tracking-wide uppercase">
                  Font & Typography
                </div>
              </div>

              {/* Group B: Paragraph & Alignment */}
              <div className="flex flex-col gap-1 pl-3 pr-3">
                <div className="flex items-center gap-2">
                  {/* Default Alignment */}
                  <div className="flex items-center bg-slate-100 border border-slate-300 rounded p-0.5">
                    <button
                      type="button"
                      onClick={() =>
                        setTemplateData({
                          ...templateData,
                          middle_alignment: "left",
                        })
                      }
                      className={`p-1 rounded transition ${
                        templateData.middle_alignment === "left"
                          ? "bg-blue-600 text-white"
                          : "text-slate-700 hover:bg-white"
                      }`}
                      title="Align Left (All Text)"
                    >
                      <AlignLeft size={13} />
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setTemplateData({
                          ...templateData,
                          middle_alignment: "center",
                        })
                      }
                      className={`p-1 rounded transition ${
                        templateData.middle_alignment === "center"
                          ? "bg-blue-600 text-white"
                          : "text-slate-700 hover:bg-white"
                      }`}
                      title="Align Center (All Text)"
                    >
                      <AlignCenter size={13} />
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setTemplateData({
                          ...templateData,
                          middle_alignment: "right",
                        })
                      }
                      className={`p-1 rounded transition ${
                        templateData.middle_alignment === "right"
                          ? "bg-blue-600 text-white"
                          : "text-slate-700 hover:bg-white"
                      }`}
                      title="Align Right (All Text)"
                    >
                      <AlignRight size={13} />
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setTemplateData({
                          ...templateData,
                          middle_alignment: "justify",
                        })
                      }
                      className={`p-1 rounded transition ${
                        templateData.middle_alignment === "justify"
                          ? "bg-blue-600 text-white"
                          : "text-slate-700 hover:bg-white"
                      }`}
                      title="Justify (All Text)"
                    >
                      <AlignJustify size={13} />
                    </button>
                  </div>

                  {/* Word-Style Individual Line Alignment */}
                  <div className="flex items-center bg-blue-50/60 border border-blue-200 rounded p-0.5">
                    <span className="text-[9px] font-bold text-blue-800 px-1">
                      Line:
                    </span>
                    <button
                      type="button"
                      onClick={() => applyLineAlignment("left")}
                      className="p-1 rounded text-slate-700 hover:bg-white hover:text-blue-600 transition"
                      title="Format Current Line Left"
                    >
                      <AlignLeft size={13} />
                    </button>
                    <button
                      type="button"
                      onClick={() => applyLineAlignment("center")}
                      className="p-1 rounded text-slate-700 hover:bg-white hover:text-blue-600 transition"
                      title="Format Current Line Center"
                    >
                      <AlignCenter size={13} />
                    </button>
                    <button
                      type="button"
                      onClick={() => applyLineAlignment("right")}
                      className="p-1 rounded text-slate-700 hover:bg-white hover:text-blue-600 transition"
                      title="Format Current Line Right"
                    >
                      <AlignRight size={13} />
                    </button>
                    <button
                      type="button"
                      onClick={() => applyLineAlignment("justify")}
                      className="p-1 rounded text-slate-700 hover:bg-white hover:text-blue-600 transition"
                      title="Format Current Line Justify"
                    >
                      <AlignJustify size={13} />
                    </button>
                  </div>

                  {/* Line Spacing */}
                  <div className="flex items-center border border-slate-300 rounded bg-slate-50 h-6 px-1.5">
                    <span className="text-[10px] text-slate-500 mr-1">Spacing:</span>
                    <select
                      value={templateData.line_spacing || 1.5}
                      onChange={(e) =>
                        setTemplateData({
                          ...templateData,
                          line_spacing: parseFloat(e.target.value) || 1.5,
                        })
                      }
                      className="text-xs font-semibold text-slate-800 bg-transparent outline-none cursor-pointer"
                    >
                      <option value="1.0">1.0</option>
                      <option value="1.15">1.15</option>
                      <option value="1.5">1.5</option>
                      <option value="2.0">2.0</option>
                    </select>
                  </div>
                </div>

                <div className="text-[9px] text-slate-400 font-medium tracking-wide uppercase">
                  Paragraph & Line Alignment
                </div>
              </div>

              {/* Group C: Insert Quick Tools / Header Tools */}
              <div className="flex flex-col gap-1 pl-3 pr-3 relative">
                {editingSection === "header" ? (
                  /* Tools specifically for College Header */
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() =>
                        insertTextAtCursor(
                          `\n[center][b][size:16]${(selectedCollege?.name || "COLLEGE NAME").toUpperCase()}[/size][/b][/center]`
                        )
                      }
                      className="h-6 px-2 bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-900 rounded font-semibold text-[11px]"
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
                      className="h-6 px-2 bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-900 rounded font-semibold text-[11px]"
                    >
                      + Affiliation
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        insertTextAtCursor("\n----------------------------------------\n")
                      }
                      className="h-6 px-2 bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-800 rounded font-bold text-[11px]"
                    >
                      + Divider Rule (---)
                    </button>
                    <div className="flex items-center border border-slate-300 rounded bg-slate-50 h-6 px-1.5 ml-1">
                      <span className="text-[10px] text-slate-500 mr-1">Header H:</span>
                      <input
                        type="number"
                        min="50"
                        max="150"
                        value={templateData.header_height || 80}
                        onChange={(e) =>
                          setTemplateData({
                            ...templateData,
                            header_height: parseInt(e.target.value) || 80,
                          })
                        }
                        className="w-7 text-center text-xs font-bold outline-none"
                      />
                      <span className="text-[9px] text-slate-400">px</span>
                    </div>
                  </div>
                ) : (
                  /* Standard Tools for Certificate Body */
                  <div className="flex items-center gap-2">
                    {/* Insert Variable Dropdown Trigger */}
                    <div className="relative">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowVariableDropdown(!showVariableDropdown);
                        }}
                        className="h-6 px-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded font-semibold text-xs flex items-center gap-1 shadow-xs transition"
                      >
                        <span>➕ Insert Variable</span>
                        <ChevronDown size={12} />
                      </button>

                      {/* Rich Variable Dropdown Menu */}
                      {showVariableDropdown && (
                        <div
                          className="absolute left-0 top-8 w-72 bg-white rounded-lg shadow-xl border border-blue-200 z-[9999] p-2 space-y-2"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="relative">
                            <input
                              type="text"
                              value={variableSearchQuery}
                              onChange={(e) =>
                                setVariableSearchQuery(e.target.value)
                              }
                              placeholder="Search student variables..."
                              className="w-full px-2.5 py-1 text-xs border border-slate-300 rounded outline-none focus:border-blue-500"
                              autoFocus
                            />
                          </div>

                          <div className="max-h-56 overflow-y-auto space-y-2 text-xs">
                            {studentVars.length > 0 && (
                              <div>
                                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                                  🎓 Student Identity
                                </div>
                                <div className="grid grid-cols-2 gap-1">
                                  {studentVars.map((v) => (
                                    <button
                                      key={v.name}
                                      type="button"
                                      onClick={() => {
                                        insertTextAtCursor(`@${v.name} `);
                                        setShowVariableDropdown(false);
                                      }}
                                      className="text-left px-2 py-1 rounded bg-blue-50 hover:bg-blue-100 text-blue-900 font-medium truncate"
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
                                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                                  📚 Academic Details
                                </div>
                                <div className="grid grid-cols-2 gap-1">
                                  {academicVars.map((v) => (
                                    <button
                                      key={v.name}
                                      type="button"
                                      onClick={() => {
                                        insertTextAtCursor(`@${v.name} `);
                                        setShowVariableDropdown(false);
                                      }}
                                      className="text-left px-2 py-1 rounded bg-emerald-50 hover:bg-emerald-100 text-emerald-900 font-medium truncate"
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
                                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                                  👤 Personal Info
                                </div>
                                <div className="grid grid-cols-2 gap-1">
                                  {personalVars.map((v) => (
                                    <button
                                      key={v.name}
                                      type="button"
                                      onClick={() => {
                                        insertTextAtCursor(`@${v.name} `);
                                        setShowVariableDropdown(false);
                                      }}
                                      className="text-left px-2 py-1 rounded bg-amber-50 hover:bg-amber-100 text-amber-900 font-medium truncate"
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
                                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                                  🏛️ Institutional / Signatures
                                </div>
                                <div className="grid grid-cols-1 gap-1">
                                  {institutionalVars.map((v) => (
                                    <button
                                      key={v.name}
                                      type="button"
                                      onClick={() => {
                                        insertTextAtCursor(`@${v.name} `);
                                        setShowVariableDropdown(false);
                                      }}
                                      className="text-left px-2 py-1 rounded bg-purple-50 hover:bg-purple-100 text-purple-900 font-medium truncate"
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

                    {/* Insert Blank Field button */}
                    <button
                      type="button"
                      onClick={() => insertTextAtCursor(" ___ ")}
                      className="h-6 px-2.5 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded font-semibold text-xs text-slate-800 flex items-center gap-1 transition"
                      title="Insert fillable underline blank (___)"
                    >
                      <span>Insert Blank (___)</span>
                    </button>

                    {/* Blank Width setting */}
                    <div className="flex items-center border border-slate-300 rounded bg-slate-50 h-6 px-1.5">
                      <span className="text-[10px] text-slate-500 mr-1">Blank Size:</span>
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
                        className="w-6 text-center text-xs font-bold text-slate-800 bg-transparent outline-none"
                      />
                      <span className="text-[9px] text-slate-400">ch</span>
                    </div>
                  </div>
                )}

                <div className="text-[9px] text-slate-400 font-medium tracking-wide uppercase">
                  {editingSection === "header"
                    ? "Dynamic Header Tools (Vector Letterhead)"
                    : "Variables & Fillable Blanks"}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: INSERT */}
          {activeRibbonTab === "insert" && (
            <div className="flex items-center gap-3 divide-x divide-slate-200">
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
                    { label: "Current Date", var: "@current_date" },
                  ].map((chip) => (
                    <button
                      key={chip.var}
                      type="button"
                      onClick={() => insertTextAtCursor(`${chip.var} `)}
                      className="px-2 py-0.5 bg-blue-50 hover:bg-blue-100 text-blue-800 rounded border border-blue-200 text-[11px] font-semibold transition"
                    >
                      +{chip.label}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => insertTextAtCursor(" ___ ")}
                    className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded border border-slate-300 text-[11px] font-bold"
                  >
                    + Blank Line (___)
                  </button>
                </div>
                <div className="text-[9px] text-slate-400 font-medium tracking-wide uppercase">
                  Quick Variable Chips (Click to Insert at Cursor)
                </div>
              </div>

              {/* College Letterhead Information */}
              <div className="flex flex-col gap-1 pl-3">
                <div className="flex items-center gap-3 text-xs">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-slate-500 font-semibold">Header Design:</span>
                    <span className="text-[10px] text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200 font-bold">
                      Dynamic Vector Letterhead
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEditingSection("header")}
                    className="text-[10px] font-bold text-blue-600 underline hover:text-blue-800"
                  >
                    Edit College Header
                  </button>
                </div>
                <div className="text-[9px] text-slate-400 font-medium tracking-wide uppercase">
                  College Institutional Letterhead (Photo-Free)
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: LAYOUT */}
          {activeRibbonTab === "layout" && (
            <div className="flex items-center gap-3 divide-x divide-slate-200">
              {/* Margins */}
              <div className="flex flex-col gap-1 pr-3">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-bold text-slate-600">Margins:</span>
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
                    className="px-2 py-0.5 bg-slate-50 hover:bg-slate-200 border border-slate-300 rounded text-[11px] font-medium"
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
                    className="px-2 py-0.5 bg-slate-50 hover:bg-slate-200 border border-slate-300 rounded text-[11px] font-medium"
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
                    className="px-2 py-0.5 bg-slate-50 hover:bg-slate-200 border border-slate-300 rounded text-[11px] font-medium"
                  >
                    Wide (60px)
                  </button>

                  <div className="flex items-center gap-1 ml-2 bg-slate-50 border border-slate-300 rounded px-1.5 py-0.5">
                    <span className="text-[10px] text-slate-500">L:</span>
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
                    <span className="text-[10px] text-slate-500">R:</span>
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
                    <span className="text-[10px] text-slate-500">T:</span>
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
                    <span className="text-[10px] text-slate-500">B:</span>
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
                <div className="text-[9px] text-slate-400 font-medium tracking-wide uppercase">
                  Page Margins (Left, Right, Top, Bottom in px)
                </div>
              </div>

              {/* Header and Footer heights */}
              <div className="flex flex-col gap-1 pl-3">
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1 border border-slate-300 rounded bg-slate-50 px-1.5 py-0.5">
                    <span className="text-[10px] text-slate-600 font-semibold">Header H:</span>
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
                    <span className="text-[9px] text-slate-400">px</span>
                  </div>

                  <div className="flex items-center gap-1 border border-slate-300 rounded bg-slate-50 px-1.5 py-0.5">
                    <span className="text-[10px] text-slate-600 font-semibold">Footer H:</span>
                    <input
                      type="number"
                      value={templateData.footer_height || 60}
                      onChange={(e) =>
                        setTemplateData({
                          ...templateData,
                          footer_height: parseInt(e.target.value) || 60,
                        })
                      }
                      className="w-7 text-center text-xs font-bold outline-none"
                    />
                    <span className="text-[9px] text-slate-400">px</span>
                  </div>

                  <div className="flex items-center gap-1 border border-slate-300 rounded bg-slate-50 px-1.5 py-0.5">
                    <span className="text-[10px] text-slate-600 font-semibold">Size:</span>
                    <span className="text-xs font-bold text-slate-800">A4 Portrait</span>
                  </div>
                </div>
                <div className="text-[9px] text-slate-400 font-medium tracking-wide uppercase">
                  Header & Footer Height Configuration
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: VIEW */}
          {activeRibbonTab === "view" && (
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5 bg-slate-100 border border-slate-300 rounded p-1">
                <button
                  type="button"
                  onClick={() => setViewMode("word-canvas")}
                  className={`px-3 py-1 rounded text-xs font-semibold flex items-center gap-1.5 ${
                    viewMode === "word-canvas"
                      ? "bg-blue-600 text-white shadow-xs"
                      : "text-slate-700 hover:bg-white"
                  }`}
                >
                  <FileText size={13} /> Word Canvas
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("split")}
                  className={`px-3 py-1 rounded text-xs font-semibold flex items-center gap-1.5 ${
                    viewMode === "split"
                      ? "bg-blue-600 text-white shadow-xs"
                      : "text-slate-700 hover:bg-white"
                  }`}
                >
                  <Columns size={13} /> Split View
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("preview")}
                  className={`px-3 py-1 rounded text-xs font-semibold flex items-center gap-1.5 ${
                    viewMode === "preview"
                      ? "bg-blue-600 text-white shadow-xs"
                      : "text-slate-700 hover:bg-white"
                  }`}
                >
                  <Eye size={13} /> Print Preview
                </button>
              </div>

              {/* Show Ruler Toggle */}
              <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-700">
                <input
                  type="checkbox"
                  checked={showRuler}
                  onChange={(e) => setShowRuler(e.target.checked)}
                  className="rounded text-blue-600"
                />
                Show Word Ruler
              </label>

              {/* Zoom Buttons */}
              <div className="flex items-center gap-1 border border-slate-300 rounded bg-slate-50 px-2 py-1">
                <span className="text-[10px] text-slate-500 font-semibold">Zoom:</span>
                {[75, 90, 100, 110, 125].map((z) => (
                  <button
                    key={z}
                    type="button"
                    onClick={() => setZoomLevel(z)}
                    className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                      zoomLevel === z
                        ? "bg-blue-600 text-white"
                        : "text-slate-700 hover:bg-slate-200"
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
          <div className="bg-[#f0eee9] border-b border-[#d8d5d0] h-5 flex items-center justify-center overflow-hidden flex-shrink-0 select-none">
            <div className="w-[794px] max-w-full flex items-center justify-between px-2 text-[9px] text-slate-500 font-mono relative">
              {/* Shaded Left Margin indicator */}
              <div
                className="absolute left-0 top-0 bottom-0 bg-[#e0deda] border-r border-slate-400"
                style={{ width: `${Math.min(templateData.padding_left || 40, 120)}px` }}
              />
              {/* Shaded Right Margin indicator */}
              <div
                className="absolute right-0 top-0 bottom-0 bg-[#e0deda] border-l border-slate-400"
                style={{ width: `${Math.min(templateData.padding_right || 40, 120)}px` }}
              />

              {/* Ruler ticks & numbers */}
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16].map(
                (num) => (
                  <div key={num} className="flex flex-col items-center z-10">
                    <span className="text-[8px] text-slate-600 font-bold">{num}</span>
                    <span className="w-px h-1.5 bg-slate-400"></span>
                  </div>
                ),
              )}
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* 5. WORKSPACE: MICROSOFT WORD CANVAS (A4 PAPER SHEET)           */}
        {/* ============================================================== */}
        <div className="flex-1 overflow-auto bg-[#eaedf1] p-6 flex justify-center items-start">
          {/* ------------------------------------------------------------ */}
          {/* MODE A: WORD CANVAS (DIRECT WYSIWYG EDITING ON PAPER)         */}
          {/* ------------------------------------------------------------ */}
          {viewMode === "word-canvas" && (
            <div className="flex flex-col items-center gap-3">
              {/* Quick Floating Variable Insertion Pill Bar */}
              <div className="bg-white/90 backdrop-blur-md border border-slate-300 rounded-full px-4 py-1.5 shadow-sm flex items-center gap-2 text-xs flex-wrap justify-center max-w-3xl">
                <span className="text-[11px] font-bold text-slate-600 flex items-center gap-1">
                  <Sparkles size={12} className="text-amber-500" /> Insert:
                </span>
                <button
                  type="button"
                  onClick={() => insertTextAtCursor("@student_name ")}
                  className="px-2 py-0.5 bg-blue-50 hover:bg-blue-100 text-blue-800 rounded-full border border-blue-200 text-[10px] font-bold transition"
                >
                  + @student_name
                </button>
                <button
                  type="button"
                  onClick={() => insertTextAtCursor("@father_name ")}
                  className="px-2 py-0.5 bg-blue-50 hover:bg-blue-100 text-blue-800 rounded-full border border-blue-200 text-[10px] font-bold transition"
                >
                  + @father_name
                </button>
                <button
                  type="button"
                  onClick={() => insertTextAtCursor("@admission_number ")}
                  className="px-2 py-0.5 bg-blue-50 hover:bg-blue-100 text-blue-800 rounded-full border border-blue-200 text-[10px] font-bold transition"
                >
                  + @admission_number
                </button>
                <button
                  type="button"
                  onClick={() => insertTextAtCursor("@course ")}
                  className="px-2 py-0.5 bg-blue-50 hover:bg-blue-100 text-blue-800 rounded-full border border-blue-200 text-[10px] font-bold transition"
                >
                  + @course
                </button>
                <button
                  type="button"
                  onClick={() => insertTextAtCursor("@branch ")}
                  className="px-2 py-0.5 bg-blue-50 hover:bg-blue-100 text-blue-800 rounded-full border border-blue-200 text-[10px] font-bold transition"
                >
                  + @branch
                </button>
                <button
                  type="button"
                  onClick={() => insertTextAtCursor("@principal_signature ")}
                  className="px-2 py-0.5 bg-purple-50 hover:bg-purple-100 text-purple-800 rounded-full border border-purple-200 text-[10px] font-bold transition"
                >
                  + @principal_signature
                </button>
                <button
                  type="button"
                  onClick={() => insertTextAtCursor(" ___ ")}
                  className="px-2 py-0.5 bg-amber-50 hover:bg-amber-100 text-amber-900 rounded-full border border-amber-200 text-[10px] font-bold transition"
                >
                  + Blank Line (___)
                </button>
              </div>

              {/* The Realistic Word A4 Paper Sheet */}
              <div
                className="bg-white border border-slate-300 transition-all flex flex-col relative"
                style={{
                  width: `${(794 * zoomLevel) / 100}px`,
                  minHeight: `${(1080 * zoomLevel) / 100}px`,
                  boxShadow:
                    "0 12px 36px -4px rgba(0, 0, 0, 0.18), 0 4px 12px -2px rgba(0, 0, 0, 0.08)",
                  paddingLeft: `${templateData.padding_left || 40}px`,
                  paddingRight: `${templateData.padding_right || 40}px`,
                  paddingTop: `${templateData.padding_top || 40}px`,
                  paddingBottom: `${templateData.padding_bottom || 40}px`,
                  fontFamily:
                    templateData.font_family ||
                    "Calibri, 'Segoe UI', Arial, sans-serif",
                }}
              >
                {/* Dynamic College Header Section */}
                <div
                  className={`w-full flex-shrink-0 flex flex-col justify-center mb-3 relative transition-all ${
                    editingSection === "header"
                      ? "p-3 bg-blue-50/40 border-2 border-dashed border-blue-500 rounded-lg shadow-sm"
                      : "pb-2 border-b border-slate-200 cursor-pointer hover:bg-slate-50/80 rounded group"
                  }`}
                  style={{ minHeight: `${templateData.header_height || 80}px` }}
                  onClick={() => {
                    if (editingSection !== "header") setEditingSection("header");
                  }}
                >
                  {editingSection === "header" ? (
                    <div className="w-full space-y-2" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-between pb-1 border-b border-blue-200">
                        <span className="text-[11px] font-bold text-blue-900 flex items-center gap-1.5">
                          <Building2 size={13} className="text-blue-600" /> Dynamic College Header (Direct Word Edit)
                        </span>
                        <button
                          type="button"
                          onClick={() => setEditingSection("body")}
                          className="px-2 py-0.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-[10px] font-bold transition flex items-center gap-1"
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
                        className="w-full p-2 font-mono text-xs border border-blue-300 rounded-md focus:ring-1 focus:ring-blue-500 outline-none bg-white leading-relaxed"
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
                          className="px-2 py-0.5 bg-blue-100 hover:bg-blue-200 text-blue-800 rounded font-semibold"
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
                          className="px-2 py-0.5 bg-blue-100 hover:bg-blue-200 text-blue-800 rounded font-semibold"
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
                          className="px-2 py-0.5 bg-blue-100 hover:bg-blue-200 text-blue-800 rounded font-semibold"
                        >
                          + Address & Contact
                        </button>
                        <button
                          type="button"
                          onClick={() => insertTextAtCursor("\n----------------------------------------\n")}
                          className="px-2 py-0.5 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded font-bold"
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
                          className="px-2 py-0.5 bg-amber-100 hover:bg-amber-200 text-amber-900 rounded font-semibold ml-auto"
                        >
                          Reset to College Default
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="relative group w-full">
                      {renderHeaderLines(templateData.top_content)}
                      <div className="absolute top-0 right-0 opacity-0 group-hover:opacity-100 transition bg-blue-600 text-white text-[10px] font-bold px-2 py-0.5 rounded shadow-sm flex items-center gap-1">
                        <span>Click to Edit Header</span>
                        <span>✏️</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Direct Word Paper Editor (The Editable Document Body) */}
                <div
                  className={`flex-1 flex flex-col relative transition-all ${
                    editingSection === "body" ? "ring-1 ring-blue-100 rounded-md p-1" : ""
                  }`}
                  style={{
                    paddingTop: `${templateData.middle_section_padding || 20}px`,
                    paddingBottom: `${templateData.middle_section_padding || 20}px`,
                  }}
                  onClick={() => {
                    if (editingSection !== "body") setEditingSection("body");
                  }}
                >
                  <MentionsInput
                    inputRef={contentInputRef}
                    value={templateData.middle_content}
                    onChange={(e) =>
                      setTemplateData({
                        ...templateData,
                        middle_content: e.target.value,
                      })
                    }
                    onSelect={(e) => {
                      setActiveCursorPos({
                        start: e.target.selectionStart,
                        end: e.target.selectionEnd,
                      });
                    }}
                    onClick={(e) => {
                      setActiveCursorPos({
                        start: e.target.selectionStart,
                        end: e.target.selectionEnd,
                      });
                    }}
                    onKeyUp={(e) => {
                      setActiveCursorPos({
                        start: e.target.selectionStart,
                        end: e.target.selectionEnd,
                      });
                    }}
                    style={{
                      ...getMentionStyle(templateData.middle_alignment || "left"),
                      control: {
                        ...getMentionStyle(templateData.middle_alignment || "left")
                          .control,
                        minHeight: 520,
                      },
                    }}
                    placeholder={`Type certificate text here directly on this Word page.\n\nTips:\n• Type @ to autocomplete student variables (e.g. @student_name, @father_name, @admission_number, @principal_signature)\n• Type ___ (three underscores) to create fillable blanks\n• Click any Line Alignment button in the toolbar to align that specific line`}
                  >
                    <Mention
                      trigger="@"
                      data={mentionData}
                      style={{
                        backgroundColor: "#dbeafe",
                        borderRadius: "3px",
                        padding: "1px 4px",
                        color: "#1e40af",
                        fontWeight: "600",
                      }}
                    />
                  </MentionsInput>
                </div>

                {/* College Letterhead Footer */}
                <div
                  className="w-full flex-shrink-0 flex items-center justify-center border-t border-dashed border-slate-200 pt-2 mt-3 relative group"
                  style={{ height: `${templateData.footer_height || 60}px` }}
                >
                  {footerImageUrl ? (
                    <img
                      src={footerImageUrl}
                      alt="College Footer Letterhead"
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <div className="w-full h-full rounded border-2 border-dashed border-slate-200 bg-slate-50/50 flex flex-col items-center justify-center p-2 text-center">
                      <div className="text-[11px] text-slate-600 font-semibold">
                        Institutional Letterhead Footer • Authorized Signatures & Seal
                      </div>
                      <div className="text-[9px] text-slate-400 mt-0.5">
                        Footer Height: {templateData.footer_height || 60}px
                      </div>
                    </div>
                  )}
                  <span className="absolute bottom-1 right-1 text-[9px] text-slate-400 bg-white/80 px-1 rounded opacity-0 group-hover:opacity-100 transition">
                    Footer: {templateData.footer_height || 60}px
                  </span>
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
                <div className="text-xs font-bold text-slate-700 mb-2 flex items-center gap-1.5 self-start">
                  <FileText size={14} className="text-[#185abd]" />
                  <span>Word Document Editor (Type & Edit)</span>
                </div>
                <div
                  className="w-full bg-white border border-slate-300 rounded shadow-lg p-6 flex flex-col"
                  style={{
                    minHeight: "750px",
                    paddingLeft: `${templateData.padding_left || 40}px`,
                    paddingRight: `${templateData.padding_right || 40}px`,
                    paddingTop: `${templateData.padding_top || 40}px`,
                    paddingBottom: `${templateData.padding_bottom || 40}px`,
                  }}
                >
                  {/* Dynamic Header */}
                  <div className="w-full pb-2 mb-3 border-b border-dashed border-slate-200">
                    {renderHeaderLines(templateData.top_content)}
                  </div>

                  {/* Mentions Input */}
                  <div className="flex-1">
                    <MentionsInput
                      inputRef={contentInputRef}
                      value={templateData.middle_content}
                      onChange={(e) =>
                        setTemplateData({
                          ...templateData,
                          middle_content: e.target.value,
                        })
                      }
                      onSelect={(e) => {
                        setActiveCursorPos({
                          start: e.target.selectionStart,
                          end: e.target.selectionEnd,
                        });
                      }}
                      onClick={(e) => {
                        setActiveCursorPos({
                          start: e.target.selectionStart,
                          end: e.target.selectionEnd,
                        });
                      }}
                      onKeyUp={(e) => {
                        setActiveCursorPos({
                          start: e.target.selectionStart,
                          end: e.target.selectionEnd,
                        });
                      }}
                      style={{
                        ...getMentionStyle(templateData.middle_alignment || "left"),
                        control: {
                          ...getMentionStyle(templateData.middle_alignment || "left")
                            .control,
                          minHeight: 460,
                        },
                      }}
                      placeholder="Type certificate text here. Use @ for variables, ___ for blanks."
                    >
                      <Mention
                        trigger="@"
                        data={mentionData}
                        style={{ backgroundColor: "#dbeafe" }}
                      />
                    </MentionsInput>
                  </div>

                  {/* Footer */}
                  <div
                    className="w-full flex-shrink-0 flex items-center justify-center border-t border-dashed border-slate-200 pt-2 mt-3"
                    style={{ height: `${templateData.footer_height || 60}px` }}
                  >
                    {footerImageUrl ? (
                      <img
                        src={footerImageUrl}
                        alt="Footer"
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <div className="text-xs text-slate-400 font-semibold text-center">
                        [Footer Area: {templateData.footer_height || 60}px]
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Right Column: Live Rendered Certificate Sheet */}
              <div className="w-1/2 flex flex-col items-center">
                <div className="text-xs font-bold text-slate-700 mb-2 flex items-center gap-1.5 self-start">
                  <Eye size={14} className="text-emerald-600" />
                  <span>Real-Time Certificate Output (Variables Replaced)</span>
                </div>
                <div
                  className="w-full bg-white border border-slate-300 rounded shadow-lg overflow-hidden flex flex-col"
                  style={{
                    minHeight: "750px",
                    paddingLeft: `${templateData.padding_left || 40}px`,
                    paddingRight: `${templateData.padding_right || 40}px`,
                    paddingTop: `${templateData.padding_top || 40}px`,
                    paddingBottom: `${templateData.padding_bottom || 40}px`,
                    fontSize: `${templateData.font_size || 12}px`,
                    lineHeight: templateData.line_spacing || 1.6,
                    fontFamily:
                      templateData.font_family ||
                      "Calibri, 'Segoe UI', Arial, sans-serif",
                  }}
                >
                  {/* Dynamic Header */}
                  <div className="w-full mb-3">
                    {renderHeaderLines(templateData.top_content)}
                  </div>

                  {/* Formatted Certificate Content */}
                  <div
                    className="flex-1 text-slate-800"
                    style={{
                      paddingTop: `${templateData.middle_section_padding || 20}px`,
                      paddingBottom: `${templateData.middle_section_padding || 20}px`,
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
                      <div className="h-64 flex flex-col items-center justify-center text-slate-400">
                        <FileText size={40} className="mb-2 opacity-40" />
                        <p className="text-sm font-semibold">Start typing in the editor on the left</p>
                        <p className="text-xs mt-1">Variables and fillable lines will render here live</p>
                      </div>
                    )}
                  </div>

                  {/* Footer */}
                  {footerImageUrl ? (
                    <div
                      className="mt-4"
                      style={{ height: `${templateData.footer_height || 60}px` }}
                    >
                      <img
                        src={footerImageUrl}
                        alt="Footer"
                        className="w-full h-full object-contain"
                      />
                    </div>
                  ) : (
                    <div
                      className="mt-4 rounded border-2 border-dashed border-slate-200 bg-slate-50/50 flex flex-col items-center justify-center p-2 text-center"
                      style={{ height: `${templateData.footer_height || 60}px` }}
                    >
                      <div className="text-xs text-slate-600 font-semibold">
                        Authorized Signatures & Official Seal
                      </div>
                    </div>
                  )}
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
                className="bg-white border border-slate-300 shadow-2xl flex flex-col"
                style={{
                  width: `${(794 * zoomLevel) / 100}px`,
                  minHeight: `${(1080 * zoomLevel) / 100}px`,
                  paddingLeft: `${templateData.padding_left || 40}px`,
                  paddingRight: `${templateData.padding_right || 40}px`,
                  paddingTop: `${templateData.padding_top || 40}px`,
                  paddingBottom: `${templateData.padding_bottom || 40}px`,
                  fontSize: `${templateData.font_size || 12}px`,
                  lineHeight: templateData.line_spacing || 1.6,
                  fontFamily:
                    templateData.font_family ||
                    "Calibri, 'Segoe UI', Arial, sans-serif",
                }}
              >
                {/* Dynamic Header */}
                <div className="w-full mb-3">
                  {renderHeaderLines(templateData.top_content)}
                </div>

                {/* Content */}
                <div
                  className="flex-1 text-slate-800"
                  style={{
                    paddingTop: `${templateData.middle_section_padding || 20}px`,
                    paddingBottom: `${templateData.middle_section_padding || 20}px`,
                  }}
                >
                  {processContentForPreview(
                    templateData.middle_content,
                    templateData.middle_alignment || "left",
                  )}
                </div>

                {/* Footer */}
                {footerImageUrl && (
                  <div
                    className="mt-4"
                    style={{ height: `${templateData.footer_height || 60}px` }}
                  >
                    <img
                      src={footerImageUrl}
                      alt="Footer"
                      className="w-full h-full object-contain"
                    />
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ============================================================== */}
        {/* 6. MICROSOFT WORD STATUS BAR (BOTTOM)                          */}
        {/* ============================================================== */}
        <div className="bg-[#185abd] text-white px-4 py-1 flex items-center justify-between text-[11px] flex-shrink-0 select-none shadow-md">
          {/* Left Stats */}
          <div className="flex items-center gap-3">
            <span className="font-semibold">Page 1 of 1</span>
            <span className="text-blue-300">|</span>
            <span>{wordCount} words</span>
            <span className="text-blue-300">|</span>
            <span>{charCount} characters</span>
            <span className="text-blue-300">|</span>
            <span className="truncate max-w-xs text-blue-100">
              College: {selectedCollege?.name || "None"}
            </span>
          </div>

          {/* Center Brand */}
          <div className="hidden md:flex items-center gap-1.5 text-blue-200 text-[10px]">
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
                className={`p-0.5 rounded ${viewMode === "word-canvas" ? "bg-white/20 text-white" : "text-blue-200 hover:text-white"}`}
                title="Word Canvas"
              >
                <FileText size={12} />
              </button>
              <button
                type="button"
                onClick={() => setViewMode("split")}
                className={`p-0.5 rounded ${viewMode === "split" ? "bg-white/20 text-white" : "text-blue-200 hover:text-white"}`}
                title="Split View"
              >
                <Columns size={12} />
              </button>
              <button
                type="button"
                onClick={() => setViewMode("preview")}
                className={`p-0.5 rounded ${viewMode === "preview" ? "bg-white/20 text-white" : "text-blue-200 hover:text-white"}`}
                title="Print Preview"
              >
                <Eye size={12} />
              </button>
            </div>

            <div className="flex items-center gap-1.5 border-l border-blue-400/40 pl-3">
              <button
                type="button"
                onClick={() => setZoomLevel((z) => Math.max(z - 10, 60))}
                className="hover:bg-blue-700/60 p-0.5 rounded text-white"
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
                className="w-16 h-1 bg-blue-700 rounded-lg appearance-none cursor-pointer accent-white"
              />
              <button
                type="button"
                onClick={() => setZoomLevel((z) => Math.min(z + 10, 140))}
                className="hover:bg-blue-700/60 p-0.5 rounded text-white"
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
        <h2 className="text-4xl font-bold text-gray-900 flex items-center justify-center gap-4 mb-3">
          <Eye size={40} className="text-green-600" />
          Final Review
        </h2>
        <p className="text-gray-600 text-lg">
          Review your certificate configuration before publishing
        </p>
        <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-blue-50 border border-blue-200 rounded-full text-sm text-blue-700 font-medium">
          <Check size={16} />
          All settings configured successfully
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-gradient-to-br from-white to-blue-50 p-6 rounded-2xl shadow-lg border-2 border-blue-100">
            <h3 className="text-xl font-bold mb-4 border-b-2 border-blue-200 pb-3 text-blue-900">
              📋 Service Details
            </h3>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-gray-400 uppercase">
                  Service Name
                </label>
                <p className="font-semibold text-gray-900">
                  {serviceData.name}
                </p>
              </div>
              <div>
                <label className="text-xs font-bold text-gray-400 uppercase">
                  College
                </label>
                <p className="font-semibold text-gray-900 border-l-2 border-blue-500 pl-2">
                  {colleges.find((c) => c.id == serviceData.college_id)?.name}
                </p>
              </div>
              <div>
                <label className="text-xs font-bold text-gray-400 uppercase">
                  Price
                </label>
                <p className="text-xl font-bold text-blue-600">
                  ₹{serviceData.price}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-white to-green-50 p-6 rounded-2xl shadow-lg border-2 border-green-100">
            <h3 className="text-xl font-bold mb-4 border-b-2 border-green-200 pb-3 text-green-900">
              ⚙️ Layout Settings
            </h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <label className="text-gray-400 block">Font Size</label>
                <span className="font-medium">{templateData.font_size}px</span>
              </div>
              <div>
                <label className="text-gray-400 block">Spacing</label>
                <span className="font-medium">{templateData.line_spacing}</span>
              </div>
              <div>
                <label className="text-gray-400 block">Orientation</label>
                <span className="font-medium capitalize">
                  {templateData.page_orientation}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white p-4 rounded-2xl shadow-2xl border-2 border-gray-300 aspect-[1/1.414] overflow-hidden flex flex-col">
            <div className="px-4 py-3 border-b-2 border-gray-200 bg-gradient-to-r from-blue-50 to-purple-50 flex justify-between items-center rounded-t-xl">
              <span className="text-base font-bold text-gray-800 flex items-center gap-2">
                <Eye size={20} />
                Certificate Preview
              </span>
              <button
                onClick={generatePreview}
                className="px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-xs font-bold uppercase transition-all hover:shadow-md flex items-center gap-1"
              >
                <ArrowRight size={14} />
                Refresh
              </button>
            </div>
            <div className="flex-1 bg-gray-200 rounded-b-xl overflow-hidden">
              {finalPreviewJson ? (
                <iframe
                  src={finalPreviewJson}
                  className="w-full h-full bg-white"
                  title="Final Step Preview"
                />
              ) : (
                <div className="flex h-full items-center justify-center text-gray-500 flex-col gap-3">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-blue-600"></div>
                  <p className="font-semibold">Generating Preview...</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-between items-center bg-gradient-to-r from-blue-50 to-green-50 p-6 rounded-2xl border-2 border-blue-200 shadow-lg mt-8">
        <button
          onClick={() => setCurrentStep(2)}
          className="px-6 py-3 border-2 border-gray-300 rounded-xl hover:bg-white hover:shadow-md flex items-center gap-2 font-semibold transition-all"
        >
          <ArrowLeft size={20} /> Back to Edit
        </button>
        <button
          onClick={handleFinalSubmit}
          disabled={loading}
          className="px-12 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 flex items-center gap-3 text-lg font-bold shadow-lg shadow-blue-200 disabled:opacity-50 transition-all hover:scale-[1.02]"
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
            className="p-2 hover:bg-gray-100 rounded-lg transition"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {isEditing ? "Edit Service" : "Add New Service"}
            </h1>
            <p className="text-gray-500">Step {currentStep} of 3</p>
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
