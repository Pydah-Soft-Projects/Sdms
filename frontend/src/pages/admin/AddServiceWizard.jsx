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

  const contentInputRef = React.useRef(null);
  const [activeCursorPos, setActiveCursorPos] = useState({ start: 0, end: 0 });

  const applyLineAlignment = (alignment) => {
    const content = templateData.middle_content || "";
    const textarea = contentInputRef.current;
    const selStart = textarea ? textarea.selectionStart : activeCursorPos.start;
    const selEnd = textarea ? textarea.selectionEnd : activeCursorPos.end;

    const lines = content.split("\n");
    if (lines.length === 0) return;

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
      middle_content: newContent,
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
    // In wizard, just move to next step, don't save yet
    setTemplateData((prev) => ({
      ...prev,
      college_id: serviceData.college_id,
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
      (c) => c.id === serviceData.college_id,
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

    const headerImageUrl = selectedCollege?.header_image_url
      ? getImageUrl(selectedCollege.header_image_url)
      : null;
    const footerImageUrl = selectedCollege?.footer_image_url
      ? getImageUrl(selectedCollege.footer_image_url)
      : null;

    // Format variables for react-mentions (including principal_signature)
    const activeVariables = variables && variables.length > 0 ? variables : DEFAULT_SYSTEM_VARIABLES;
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

    // Mention style for autocomplete with whitespace preservation
    const getMentionStyle = (alignment = "center") => ({
      control: {
        backgroundColor: "#fff",
        fontSize: 14,
        fontFamily: "inherit",
        minHeight: 80,
        border: "1px solid #d1d5db",
        borderRadius: "0.5rem",
        padding: "0.5rem",
        textAlign: alignment,
        whiteSpace: "pre-wrap", // Preserve spaces and line breaks
      },
      highlighter: {
        overflow: "hidden",
        padding: "0.5rem",
        textAlign: alignment,
        whiteSpace: "pre-wrap", // Preserve spaces and line breaks
      },
      input: {
        margin: 0,
        padding: 0,
        border: 0,
        outline: 0,
        textAlign: alignment,
        whiteSpace: "pre-wrap", // Preserve spaces and line breaks
      },
      suggestions: {
        list: {
          backgroundColor: "white",
          border: "1px solid #e5e7eb",
          borderRadius: "0.5rem",
          boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
          maxHeight: 200,
          overflow: "auto",
          zIndex: 1000,
        },
        item: {
          padding: "8px 12px",
          borderBottom: "1px solid #f3f4f6",
          "&focused": {
            backgroundColor: "#eff6ff",
          },
        },
      },
    });

    // Process content to show input fields for ___ and replace @ variables with individual line alignment
    const processContentForPreview = (content, defaultAlignment = "left") => {
      if (!content) return "";

      const lines = content.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
      return (
        <div className="w-full">
          {lines.map((line, idx) => {
            let lineAlign = defaultAlignment;
            let text = line.replace(/[\t\r]/g, " ");

            const tagMatch = text.match(/^\s*\[(left|center|right|justify)\]([\s\S]*?)\[\/\1\]\s*$/i);
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
              const spec = VARIABLE_SPECS[cleanKey] || { fixedChars: 12, minWidth: 80 };
              if (cleanKey === "principal_signature") {
                return `<span class="inline-block border-b-2 border-slate-700 text-center font-semibold text-slate-800 mx-1 px-2" style="min-width: 140px;">[Principal Signature]</span>`;
              }
              return `<span class="inline-block border-b-2 border-blue-600 font-bold text-blue-900 mx-0.5 px-1 bg-blue-50/70 text-center underline underline-offset-4 decoration-blue-600 decoration-2" style="min-width: ${spec.minWidth}px;" title="Variable: @${cleanKey} (${spec.fixedChars} chars)">@${cleanKey}</span>`;
            };

            // 1. Handle react-mentions syntax: @[@display](id) or @[display](id)
            processed = processed.replace(/@\[@?([^\]]+)\]\(([^\)]+)\)/g, (match, display, id) => {
              return replaceVariableWithSpec(id || display, match);
            });

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
                const isMulti = match.includes("&nbsp;") || match.includes(" ") || match.length > 5;
                const width = isMulti ? Math.min(Math.max(inputSize * 8, 80), 130) : Math.min(Math.max(inputSize * 5, 45), 75);
                return `<span class="inline-block border-b border-gray-900 align-baseline mx-1" style="min-width:${width}px;height:1em;" title="Input Field">&nbsp;</span>`;
              }
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

    return (
      <div
        className="fixed top-0 left-0 right-0 bottom-0 flex flex-col bg-white overflow-hidden"
        style={{ marginLeft: "240px", zIndex: 50 }}
      >
        {/* Top Bar for Step 2 Context */}
        <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between flex-shrink-0">
          <div>
            <h2 className="text-lg font-bold text-gray-900">
              Step 2: Certificate Content
            </h2>
            <p className="text-xs text-gray-500">
              Type ___ (three underscores) to create input fields
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setCurrentStep(1)}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2 text-sm"
            >
              <ArrowLeft size={16} /> Back
            </button>
            <button
              onClick={handleStep2Submit}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2 text-sm"
            >
              Save & Preview <Check size={16} />
            </button>
          </div>
        </div>
        {/* Microsoft Word Style Top Ribbon Bar - Evenly Aligned on One Row */}
        <div className="bg-slate-100 border-b border-slate-300 px-3 py-2 flex items-center justify-evenly text-xs flex-shrink-0 shadow-2xs w-full overflow-hidden">
          {/* Section 1: Typography */}
          <div className="flex items-center gap-1.5 pr-3 border-r border-slate-300 flex-shrink-0">
            <span className="text-[10px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1">
              <Type size={12} className="text-blue-600" /> Typography
            </span>
            <div className="flex items-center gap-1">
              <div className="flex items-center gap-0.5 bg-white border border-slate-200 rounded px-1 py-0.5 shadow-2xs">
                <span className="text-[10px] text-slate-500">Size:</span>
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
                  className="w-7 text-center text-xs font-semibold text-slate-800 outline-none"
                />
                <span className="text-[9px] text-slate-400">px</span>
              </div>
              <div className="flex items-center gap-0.5 bg-white border border-slate-200 rounded px-1 py-0.5 shadow-2xs">
                <span className="text-[10px] text-slate-500">Line:</span>
                <input
                  type="number"
                  min="1"
                  max="3"
                  step="0.1"
                  value={templateData.line_spacing || 1.5}
                  onChange={(e) =>
                    setTemplateData({
                      ...templateData,
                      line_spacing: parseFloat(e.target.value) || 1.5,
                    })
                  }
                  className="w-7 text-center text-xs font-semibold text-slate-800 outline-none"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Entire Text & Word Line Alignment */}
          <div className="flex items-center gap-2 pr-3 border-r border-slate-300 flex-shrink-0">
            {/* Entire Text Alignment */}
            <div className="flex items-center gap-1">
              <span className="text-[10px] font-bold text-slate-700">Text:</span>
              <div className="flex items-center bg-white border border-slate-200 rounded p-0.5 shadow-2xs">
                <button
                  type="button"
                  onClick={() => setTemplateData({ ...templateData, middle_alignment: "left" })}
                  className={`p-1 rounded transition ${templateData.middle_alignment === "left" ? "bg-blue-600 text-white font-bold" : "text-slate-600 hover:bg-slate-100"}`}
                  title="Align Entire Text Left"
                >
                  <AlignLeft size={12} />
                </button>
                <button
                  type="button"
                  onClick={() => setTemplateData({ ...templateData, middle_alignment: "center" })}
                  className={`p-1 rounded transition ${templateData.middle_alignment === "center" ? "bg-blue-600 text-white font-bold" : "text-slate-600 hover:bg-slate-100"}`}
                  title="Align Entire Text Center"
                >
                  <AlignCenter size={12} />
                </button>
                <button
                  type="button"
                  onClick={() => setTemplateData({ ...templateData, middle_alignment: "right" })}
                  className={`p-1 rounded transition ${templateData.middle_alignment === "right" ? "bg-blue-600 text-white font-bold" : "text-slate-600 hover:bg-slate-100"}`}
                  title="Align Entire Text Right"
                >
                  <AlignRight size={12} />
                </button>
                <button
                  type="button"
                  onClick={() => setTemplateData({ ...templateData, middle_alignment: "justify" })}
                  className={`p-1 rounded transition ${templateData.middle_alignment === "justify" ? "bg-blue-600 text-white font-bold" : "text-slate-600 hover:bg-slate-100"}`}
                  title="Justify Entire Text"
                >
                  <AlignJustify size={12} />
                </button>
              </div>
            </div>

            {/* Word-Style Line Alignment */}
            <div className="flex items-center gap-1">
              <span className="text-[10px] font-bold text-slate-700 flex items-center gap-0.5">
                <span className="px-1 py-0.2 bg-blue-100 text-blue-800 rounded text-[9px] font-bold">Word</span>
                Line:
              </span>
              <div className="flex items-center bg-white border border-slate-200 rounded p-0.5 shadow-2xs">
                <button
                  type="button"
                  onClick={() => applyLineAlignment("left")}
                  className="p-1 rounded text-slate-700 hover:bg-blue-50 hover:text-blue-600 transition"
                  title="Align Cursor Line Left"
                >
                  <AlignLeft size={12} />
                </button>
                <button
                  type="button"
                  onClick={() => applyLineAlignment("center")}
                  className="p-1 rounded text-slate-700 hover:bg-blue-50 hover:text-blue-600 transition"
                  title="Align Cursor Line Center"
                >
                  <AlignCenter size={12} />
                </button>
                <button
                  type="button"
                  onClick={() => applyLineAlignment("right")}
                  className="p-1 rounded text-slate-700 hover:bg-blue-50 hover:text-blue-600 transition"
                  title="Align Cursor Line Right"
                >
                  <AlignRight size={12} />
                </button>
                <button
                  type="button"
                  onClick={() => applyLineAlignment("justify")}
                  className="p-1 rounded text-slate-700 hover:bg-blue-50 hover:text-blue-600 transition"
                  title="Justify Cursor Line"
                >
                  <AlignJustify size={12} />
                </button>
              </div>
            </div>
          </div>

          {/* Section 3: Content Vertical Spacing */}
          <div className="flex items-center gap-1.5 pr-3 border-r border-slate-300 flex-shrink-0">
            <span className="text-[10px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1">
              <Space size={12} className="text-blue-600" /> Spacing
            </span>
            <div className="flex items-center gap-0.5 bg-white border border-slate-200 rounded px-1 py-0.5 shadow-2xs">
              <span className="text-[10px] text-slate-500">Pad:</span>
              <input
                type="number"
                value={templateData.middle_section_padding || 20}
                onChange={(e) =>
                  setTemplateData({
                    ...templateData,
                    middle_section_padding: parseInt(e.target.value) || 20,
                  })
                }
                className="w-7 text-center text-xs font-semibold text-slate-800 outline-none"
              />
              <span className="text-[9px] text-slate-400">px</span>
            </div>
          </div>

          {/* Section 4: Page Margins */}
          <div className="flex items-center gap-1.5 pr-3 border-r border-slate-300 flex-shrink-0">
            <span className="text-[10px] font-bold text-slate-700 uppercase tracking-wider">
              Margins (px)
            </span>
            <div className="flex items-center gap-0.5 bg-white border border-slate-200 rounded px-1 py-0.5 shadow-2xs">
              <span className="text-[10px] text-slate-500 font-medium">L:</span>
              <input
                type="number"
                value={templateData.padding_left || 40}
                onChange={(e) =>
                  setTemplateData({
                    ...templateData,
                    padding_left: parseInt(e.target.value) || 40,
                  })
                }
                className="w-6 text-center text-xs font-semibold text-slate-800 outline-none"
              />
              <span className="text-[10px] text-slate-500 font-medium ml-0.5">R:</span>
              <input
                type="number"
                value={templateData.padding_right || 40}
                onChange={(e) =>
                  setTemplateData({
                    ...templateData,
                    padding_right: parseInt(e.target.value) || 40,
                  })
                }
                className="w-6 text-center text-xs font-semibold text-slate-800 outline-none"
              />
              <span className="text-[10px] text-slate-500 font-medium ml-0.5">T:</span>
              <input
                type="number"
                value={templateData.padding_top || 40}
                onChange={(e) =>
                  setTemplateData({
                    ...templateData,
                    padding_top: parseInt(e.target.value) || 40,
                  })
                }
                className="w-6 text-center text-xs font-semibold text-slate-800 outline-none"
              />
              <span className="text-[10px] text-slate-500 font-medium ml-0.5">B:</span>
              <input
                type="number"
                value={templateData.padding_bottom || 40}
                onChange={(e) =>
                  setTemplateData({
                    ...templateData,
                    padding_bottom: parseInt(e.target.value) || 40,
                  })
                }
                className="w-6 text-center text-xs font-semibold text-slate-800 outline-none"
              />
            </div>
          </div>

          {/* Section 5: Header & Footer Size */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <span className="text-[10px] font-bold text-slate-700 uppercase tracking-wider">
              Header/Footer (px)
            </span>
            <div className="flex items-center gap-0.5 bg-white border border-slate-200 rounded px-1 py-0.5 shadow-2xs">
              <span className="text-[10px] text-slate-500 font-medium">Hdr:</span>
              <input
                type="number"
                value={templateData.header_height || 80}
                onChange={(e) =>
                  setTemplateData({
                    ...templateData,
                    header_height: parseInt(e.target.value) || 80,
                  })
                }
                className="w-7 text-center text-xs font-semibold text-slate-800 outline-none"
              />
              <span className="text-[10px] text-slate-500 font-medium ml-0.5">Ftr:</span>
              <input
                type="number"
                value={templateData.footer_height || 60}
                onChange={(e) =>
                  setTemplateData({
                    ...templateData,
                    footer_height: parseInt(e.target.value) || 60,
                  })
                }
                className="w-7 text-center text-xs font-semibold text-slate-800 outline-none"
              />
            </div>
          </div>

          {/* Section 6: Input Size Validation */}
          <div className="flex items-center gap-1.5 pl-3 border-l border-slate-300 flex-shrink-0">
            <span className="text-[10px] font-bold text-slate-700 uppercase tracking-wider">
              Input Size:
            </span>
            <div className="flex items-center gap-0.5 bg-white border border-slate-200 rounded px-1 py-0.5 shadow-2xs">
              <input
                type="number"
                min="4"
                max="30"
                value={templateData.input_field_size || 10}
                onChange={(e) =>
                  setTemplateData({
                    ...templateData,
                    input_field_size: Math.min(Math.max(parseInt(e.target.value) || 10, 4), 30),
                  })
                }
                className="w-7 text-center text-xs font-semibold text-slate-800 outline-none"
              />
              <span className="text-[9px] text-slate-400">chars</span>
            </div>
          </div>
        </div>

        {/* Split View: Input Fields + Live Preview */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Side: Input Fields and Controls */}
          <div className="w-1/2 overflow-y-auto bg-gray-50 p-6 border-r wizard-sidebar-scroll">
            <div className="w-full space-y-4">
              {/* Single Certificate Content Box */}
              <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-gray-100">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                      <FileText size={16} />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-gray-900">
                        Certificate Content <span className="text-red-500">*</span>
                      </label>
                      <p className="text-[11px] text-gray-500">
                        Enter body text, student variables (@), blanks (___), and align text or lines
                      </p>
                    </div>
                  </div>
                </div>

                {/* MentionsInput Editor */}
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
                    ...getMentionStyle(templateData.middle_alignment || "center"),
                    control: {
                      ...getMentionStyle(templateData.middle_alignment || "center").control,
                      minHeight: 220,
                    },
                  }}
                  placeholder="Type certificate text here. Use @ for variables (e.g. @student_name), ___ for input fields."
                >
                  <Mention
                    trigger="@"
                    data={mentionData}
                    style={{ backgroundColor: "#dbeafe" }}
                  />
                </MentionsInput>

                <p className="text-[11px] text-slate-500">
                  Tip: Put cursor on any line and click a <strong>Line Alignment</strong> button to align that line individually (like in Microsoft Word).
                </p>
              </div>
              {/* Word-Style Clean Help Box */}
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200/80 rounded-xl p-3.5 flex items-start gap-3 shadow-2xs">
                <span className="text-lg">💡</span>
                <div className="text-[11px] text-slate-700 leading-relaxed">
                  <span className="font-bold text-slate-900 block mb-0.5">Microsoft Word-Style Toolbar Above:</span>
                  All certificate formatting controls (<span className="font-semibold text-blue-700">Typography, Alignments, Margins, Spacing, and Header/Footer</span>) are organized in the top ribbon bar above. Type <code className="bg-white px-1.5 py-0.5 rounded border border-blue-200 text-blue-900 font-bold">@</code> to autocomplete variables (including <code className="bg-white px-1.5 py-0.5 rounded border border-blue-200 text-blue-900 font-bold">@principal_signature</code>) and <code className="bg-white px-1.5 py-0.5 rounded border border-blue-200 text-blue-900 font-bold">___</code> for fillable blanks.
                </div>
              </div>
            </div>
          </div>

          {/* Right Side: Live Preview with Applied Styling */}
          <div className="w-1/2 bg-gray-200 p-6 overflow-y-auto">
            <div className="max-w-4xl mx-auto">
              <div className="bg-white rounded-lg shadow-2xl overflow-hidden">
                {/* Certificate Preview */}
                <div
                  className="relative"
                  style={{
                    minHeight: "800px",
                    paddingLeft: `${templateData.padding_left || 40}px`,
                    paddingRight: `${templateData.padding_right || 40}px`,
                    paddingTop: `${templateData.padding_top || 40}px`,
                    paddingBottom: `${templateData.padding_bottom || 40}px`,
                    fontSize: `${templateData.font_size || 12}px`,
                    lineHeight: templateData.line_spacing || 1.5,
                  }}
                >
                  {/* Header Image */}
                  {headerImageUrl && (
                    <div
                      className="mb-4"
                      style={{
                        height: `${templateData.header_height || 80}px`,
                      }}
                    >
                      <img
                        src={headerImageUrl}
                        alt="Header"
                        className="w-full h-full object-contain"
                      />
                    </div>
                  )}

                  {/* Certificate Content */}
                  {templateData.middle_content && (
                    <div
                      className="text-gray-800"
                      style={{
                        paddingTop: `${templateData.middle_section_padding || 20}px`,
                        paddingBottom: `${templateData.middle_section_padding || 20}px`,
                      }}
                    >
                      <div className="whitespace-pre-wrap">
                        {processContentForPreview(
                          templateData.middle_content,
                          templateData.middle_alignment || "left",
                        )}
                      </div>
                    </div>
                  )}

                  {/* Footer Image */}
                  {footerImageUrl && (
                    <div
                      className="mt-4"
                      style={{
                        height: `${templateData.footer_height || 60}px`,
                      }}
                    >
                      <img
                        src={footerImageUrl}
                        alt="Footer"
                        className="w-full h-full object-contain"
                      />
                    </div>
                  )}

                  {/* Placeholder when empty */}
                  {!templateData.middle_content && (
                    <div className="absolute inset-0 flex items-center justify-center text-gray-400">
                      <div className="text-center">
                        <FileText
                          size={48}
                          className="mx-auto mb-2 opacity-50"
                        />
                        <p className="text-sm">Start typing to see preview</p>
                        <p className="text-xs mt-2">Type @ to add variables</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
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
