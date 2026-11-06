import React, { useState, useEffect } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "react-hot-toast";
import { Mention, MentionsInput } from "react-mentions";
import {
  Save,
  Eye,
  ArrowLeft,
  Image as ImageIcon,
  X,
  Plus,
  AlignLeft,
  AlignCenter,
  AlignRight,
} from "lucide-react";
import { certificateTemplateService } from "../../services/certificateTemplateService";
import { serviceService } from "../../services/serviceService";
import api from "../../config/api";

const CertificateDesigner = ({
  initialData,
  onUpdate,
  isWizard = false,
  serviceName = "",
  collegeName = "",
  mode = "full", // 'full', 'content', 'styling'
}) => {
  const { serviceId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // State
  const [loading, setLoading] = useState(!isWizard);
  const [colleges, setColleges] = useState([]);
  const [service, setService] = useState(null);
  const [variables, setVariables] = useState([]);

  // Form state
  const [formData, setFormData] = useState({
    service_id: serviceId,
    college_id: null,
    top_content: "",
    middle_content: "",
    bottom_content: "",
    top_alignment: "center",
    middle_alignment: "center",
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
    font_size: 12,
    line_spacing: 2,
    top_spacing: 15,
    middle_spacing: 15,
    bottom_spacing: 15,
    blank_variables: [],
    page_size: "A4",
    page_orientation: "portrait",
    ...initialData,
  });

  const [headerPreview, setHeaderPreview] = useState(null);
  const [footerPreview, setFooterPreview] = useState(null);

  // Preview Modal State
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewHtml, setPreviewHtml] = useState(null);

  // Blank variable modal
  const [showBlankModal, setShowBlankModal] = useState(false);
  const [newBlankVar, setNewBlankVar] = useState({
    name: "",
    label: "",
    type: "text",
  });

  const [loadedCollegeId, setLoadedCollegeId] = useState(null);

  useEffect(() => {
    if (!isWizard) {
      fetchData();
    } else {
      // In wizard mode, load generic data
      loadWizardData();
    }
  }, [serviceId, isWizard]);

  // Separate effect to handle initialData updates in wizard mode
  useEffect(() => {
    if (isWizard && initialData) {
      setFormData((prev) => {
        // Only update if there's actual data in initialData
        const hasData =
          initialData.middle_content ||
          initialData.top_content ||
          initialData.bottom_content;
        if (hasData) {
          return { ...prev, ...initialData };
        }
        return prev;
      });

      // Load college images if college_id is provided and we haven't loaded it yet
      if (
        initialData.college_id &&
        initialData.college_id !== loadedCollegeId
      ) {
        handleCollegeSelect(initialData.college_id);
        setLoadedCollegeId(initialData.college_id);
      }
    }
  }, [isWizard, initialData?.middle_content, initialData?.college_id]); // Only re-run when actual content changes

  const loadWizardData = async () => {
    try {
      // Fetch colleges for dropdown
      const collegesRes = await api.get("/colleges");
      setColleges(collegesRes.data.data || []);

      // Fetch available variables
      const varsRes = await certificateTemplateService.getVariables();
      setVariables(varsRes.data.systemVariables || []);
    } catch (error) {
      console.error(error);
    }
  };

  const fetchData = async () => {
    try {
      setLoading(true);

      // Fetch service details
      const services = await serviceService.getAllServices();
      const currentService = services.data.find((s) => s.id == serviceId);
      setService(currentService);

      // Fetch colleges
      const collegesRes = await api.get("/colleges");
      setColleges(collegesRes.data.data || []);

      // Fetch available variables
      const varsRes = await certificateTemplateService.getVariables();
      setVariables(varsRes.data.systemVariables || []);

      // Try to fetch existing template
      const templatesRes = await certificateTemplateService.getTemplates({
        service_id: serviceId,
      });
      if (templatesRes.data && templatesRes.data.length > 0) {
        const existingTemplate = templatesRes.data[0];
        setFormData({
          service_id: serviceId,
          college_id: existingTemplate.college_id,
          top_content: existingTemplate.top_content || "",
          middle_content: existingTemplate.middle_content || "",
          bottom_content: existingTemplate.bottom_content || "",
          padding_left: existingTemplate.padding_left || 40,
          padding_right: existingTemplate.padding_right || 40,
          padding_top: existingTemplate.padding_top || 40,
          padding_bottom: existingTemplate.padding_bottom || 40,
          top_spacing: existingTemplate.top_spacing || 15,
          middle_spacing: existingTemplate.middle_spacing || 15,
          bottom_spacing: existingTemplate.bottom_spacing || 15,
          blank_variables: existingTemplate.blank_variables || [],
          page_size: existingTemplate.page_size || "A4",
          page_orientation: existingTemplate.page_orientation || "portrait",
        });

        if (existingTemplate.header_image_url) {
          const url = existingTemplate.header_image_url;
          setHeaderPreview(
            url.startsWith("http")
              ? url
              : `${baseURL}${url.startsWith("/") ? "" : "/"}${url}`,
          );
        }
        if (existingTemplate.footer_image_url) {
          const url = existingTemplate.footer_image_url;
          setFooterPreview(
            url.startsWith("http")
              ? url
              : `${baseURL}${url.startsWith("/") ? "" : "/"}${url}`,
          );
        }
      }
    } catch (error) {
      console.error(error);
      toast.error("Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  // Update parent when formData changes (in wizard mode)
  useEffect(() => {
    if (isWizard && onUpdate) {
      onUpdate(formData);
    }
  }, [formData, isWizard]);

  const handleCollegeSelect = async (collegeId) => {
    setFormData((prev) => ({ ...prev, college_id: collegeId || null }));
    setLoadedCollegeId(collegeId); // Track the loaded college

    if (collegeId) {
      try {
        // Fetch college details to get header/footer images
        const response = await api.get(`/colleges/${collegeId}`);
        const college = response.data.data;

        // The URLs from backend are relative paths, prepend baseURL
        const baseURL = (
          api.defaults.baseURL || "http://localhost:5000/api"
        ).replace(/\/api$/, "");

        // Set header preview if exists
        if (college.header_image_url) {
          const url = college.header_image_url;
          setHeaderPreview(
            url.startsWith("http")
              ? url
              : `${baseURL}${url.startsWith("/") ? "" : "/"}${url}`,
          );
        } else {
          setHeaderPreview(null);
        }

        // Set footer preview if exists
        if (college.footer_image_url) {
          const url = college.footer_image_url;
          setFooterPreview(
            url.startsWith("http")
              ? url
              : `${baseURL}${url.startsWith("/") ? "" : "/"}${url}`,
          );
        } else {
          setFooterPreview(null);
        }
      } catch (error) {
        console.error("Error fetching college details:", error);
        toast.error("Failed to load college images");
      }
    } else {
      setHeaderPreview(null);
      setFooterPreview(null);
    }
  };

  // Format variables for react-mentions
  const mentionData = [
    ...variables.map((v) => ({ id: v.name, display: `@${v.name}` })),
    ...formData.blank_variables.map((v) => ({
      id: `blank_${v.name}`,
      display: `@blank_${v.name}`,
    })),
  ];

  const handleAddBlankVariable = () => {
    if (!newBlankVar.name || !newBlankVar.label) {
      toast.error("Name and label are required");
      return;
    }

    setFormData({
      ...formData,
      blank_variables: [...formData.blank_variables, { ...newBlankVar }],
    });

    setNewBlankVar({ name: "", label: "", type: "text" });
    setShowBlankModal(false);
    toast.success("Blank variable added");
  };

  const handleRemoveBlankVariable = (index) => {
    const newVars = formData.blank_variables.filter((_, i) => i !== index);
    setFormData({ ...formData, blank_variables: newVars });
  };

  const handlePreview = async () => {
    if (!formData.middle_content) {
      toast.error("Middle section content is required to preview");
      return;
    }

    setShowPreviewModal(true);
    setPreviewLoading(true);

    try {
      // Generate a temporary preview
      const dataToPreview = {
        template_type: "dynamic",
        service_name: serviceName || service?.name || "Preview Service",
        template_config: {
          ...formData,
          // If URLs are relative, make absolute for preview if needed,
          // but the backend usually handles resolving.
        },
      };

      // If we have local state for images (e.g. from college select), we might need to pass URLs.
      // The template_config usually expects fields that match the DB schema.

      const blob = await serviceService.previewTemplate(dataToPreview);
      const url = URL.createObjectURL(blob);
      setPreviewHtml(url);
    } catch (error) {
      console.error(error);
      toast.error("Failed to generate preview");
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleSave = async () => {
    if (!formData.middle_content) {
      toast.error("Middle section content is required");
      return;
    }

    // In wizard mode, "Save" just triggers the preview popup as requested
    if (isWizard) {
      handlePreview();
      return;
    }

    try {
      const toastId = toast.loading("Saving template...");

      // Create or update template (no image uploads here)
      const templatesRes = await certificateTemplateService.getTemplates({
        service_id: serviceId,
      });
      const existingTemplate =
        templatesRes.data && templatesRes.data.length > 0
          ? templatesRes.data[0]
          : null;

      if (existingTemplate) {
        await certificateTemplateService.updateTemplate(
          existingTemplate.id,
          formData,
        );
      } else {
        await certificateTemplateService.createTemplate(formData);
      }

      toast.dismiss(toastId);
      toast.success("Template saved successfully");

      handlePreview();
    } catch (error) {
      console.error(error);
      toast.error("Failed to save template");
    }
  };

  // Base mention style - alignment will be applied dynamically
  const getMentionStyle = (alignment = "center") => ({
    control: {
      backgroundColor: "var(--surface)",
      fontSize: 14,
      fontFamily: "inherit",
      minHeight: 100,
      border: "1px solid var(--border)",
      borderRadius: "0.5rem",
      padding: "0.75rem",
      textAlign: alignment,
    },
    highlighter: {
      overflow: "hidden",
      padding: "0.75rem",
      textAlign: alignment,
    },
    input: {
      margin: 0,
      padding: 0,
      border: 0,
      outline: 0,
      textAlign: alignment,
    },
    suggestions: {
      list: {
        backgroundColor: "white",
        border: "1px solid var(--border)",
        borderRadius: "0.5rem",
        boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
        maxHeight: 200,
        overflow: "auto",
        zIndex: 1000,
      },
      item: {
        padding: "8px 12px",
        borderBottom: "1px solid var(--background)",
        "&focused": {
          backgroundColor: "var(--primary-light)",
        },
      },
    },
  });

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-sub">Loading designer...</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`${isWizard ? "space-y-4" : "space-y-6 p-6 max-w-7xl mx-auto"} animate-fade-in`}
    >
      {/* Header - Only show if not embedded/wizard */}
      {!isWizard && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate("/services/config")}
              className="p-2 hover:bg-background rounded-lg transition"
            >
              <ArrowLeft size={20} />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-main">
                Certificate Designer
              </h1>
              <p className="text-muted-text">{service?.name}</p>
            </div>
          </div>
        </div>
      )}

      {/* Actions Bar - Only show when not in wizard mode */}
      {!isWizard && (
        <div className="bg-surface p-4 rounded-xl shadow-sm border border-border flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="px-3 py-1 bg-[var(--primary-light)] text-primary rounded-full text-xs font-bold uppercase tracking-wider">
              Type: Dynamic Certificate
            </div>
            {formData.college_id ? (
              <div className="flex items-center gap-2 text-sm text-sub">
                <ImageIcon size={16} />
                {colleges.find((c) => c.id === formData.college_id)?.name}
              </div>
            ) : (
              <div className="text-sm text-muted-text italic">
                Global Template
              </div>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handlePreview}
              className="px-4 py-2 border border-border-strong text-sub rounded-lg hover:bg-background flex items-center gap-2 text-sm font-medium"
            >
              <Eye size={16} /> Preview
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover flex items-center gap-2 text-sm font-medium"
            >
              <Save size={16} /> Save Template
            </button>
          </div>
        </div>
      )}

      <div className={isWizard ? "" : "grid grid-cols-1 lg:grid-cols-4 gap-8"}>
        {/* Left Panel - Settings (Styling Mode) */}
        {(mode === "full" || mode === "styling") && (
          <div className={isWizard ? "space-y-4" : "lg:col-span-1 space-y-6"}>
            {/* College Selection */}
            {mode === "full" && (
              <div className="bg-surface p-4 rounded-xl shadow-sm border border-border">
                <h3 className="text-sm font-bold text-main mb-3 uppercase tracking-wider">
                  College Selection
                </h3>
                <select
                  className="w-full px-3 py-1.5 border rounded-lg focus:ring-2 focus:ring-primary outline-none text-sm"
                  value={formData.college_id || ""}
                  onChange={(e) => handleCollegeSelect(e.target.value)}
                >
                  <option value="">Global Template (All Colleges)</option>
                  {colleges.map((college) => (
                    <option key={college.id} value={college.id}>
                      {college.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Collateral Previews (Images) */}
            <div
              className={`bg-surface rounded-xl shadow-sm border border-border ${isWizard ? "p-3" : "p-4"}`}
            >
              <h3
                className={`font-bold text-main mb-3 uppercase tracking-wider ${isWizard ? "text-xs" : "text-sm"}`}
              >
                College Header Letterhead
              </h3>
              <div className="w-full">
                {headerPreview ? (
                  <div className="relative group">
                    <img
                      src={headerPreview}
                      alt="Header"
                      className="w-full h-16 object-contain rounded border"
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition rounded flex items-center justify-center text-[10px] text-white font-medium">
                      Header
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center w-full h-16 border-2 border-dashed border-border rounded-lg bg-background">
                    <ImageIcon className="text-muted-text" size={16} />
                  </div>
                )}
              </div>
              <p
                className={`text-muted-text italic text-center ${isWizard ? "text-[9px] mt-1.5" : "text-[10px] mt-2"}`}
              >
                Managed in College Configuration
              </p>
            </div>

            <div className="bg-surface p-4 rounded-xl shadow-sm border border-border">
              <h3 className="text-sm font-bold text-main mb-4 uppercase tracking-wider">
                Vertical Layout (px)
              </h3>
              <div
                className={`grid grid-cols-2 ${isWizard ? "gap-2" : "gap-3"}`}
              >
                <div>
                  <label
                    className={`block font-semibold text-muted-text mb-1 uppercase ${isWizard ? "text-[10px]" : "text-[11px]"}`}
                  >
                    Header
                  </label>
                  <input
                    type="number"
                    className={`w-full border rounded-lg focus:ring-2 focus:ring-primary outline-none ${isWizard ? "px-2 py-1 text-xs" : "px-3 py-1.5 text-sm"}`}
                    value={formData.header_height || 80}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        header_height: parseInt(e.target.value) || 0,
                      })
                    }
                  />
                </div>
                <div>
                  <label
                    className={`block font-semibold text-muted-text mb-1 uppercase ${isWizard ? "text-[10px]" : "text-[11px]"}`}
                  >
                    Top Spacing
                  </label>
                  <input
                    type="number"
                    className={`w-full border rounded-lg focus:ring-2 focus:ring-primary outline-none ${isWizard ? "px-2 py-1 text-xs" : "px-3 py-1.5 text-sm"}`}
                    value={formData.top_spacing || 15}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        top_spacing: parseInt(e.target.value) || 0,
                      })
                    }
                  />
                </div>
                <div>
                  <label
                    className={`block font-semibold text-muted-text mb-1 uppercase ${isWizard ? "text-[10px]" : "text-[11px]"}`}
                  >
                    Mid Spacing
                  </label>
                  <input
                    type="number"
                    className={`w-full border rounded-lg focus:ring-2 focus:ring-primary outline-none ${isWizard ? "px-2 py-1 text-xs" : "px-3 py-1.5 text-sm"}`}
                    value={formData.middle_spacing || 15}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        middle_spacing: parseInt(e.target.value) || 0,
                      })
                    }
                  />
                </div>
                <div className="col-span-2">
                  <label
                    className={`block font-semibold text-muted-text mb-1 uppercase ${isWizard ? "text-[10px]" : "text-[11px]"}`}
                  >
                    Bottom Spacing
                  </label>
                  <input
                    type="number"
                    className={`w-full border rounded-lg focus:ring-2 focus:ring-primary outline-none ${isWizard ? "px-2 py-1 text-xs" : "px-3 py-1.5 text-sm"}`}
                    value={formData.bottom_spacing || 15}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        bottom_spacing: parseInt(e.target.value) || 0,
                      })
                    }
                  />
                </div>
              </div>
            </div>

            {/* Typography Settings */}
            <div
              className={`bg-surface rounded-xl shadow-sm border border-border ${isWizard ? "p-3" : "p-6"}`}
            >
              <h3
                className={`font-bold text-main ${isWizard ? "text-xs mb-3" : "text-lg mb-4"}`}
              >
                Typography
              </h3>
              <div className={isWizard ? "space-y-3" : "space-y-4"}>
                <div>
                  <label
                    className={`block font-medium text-sub mb-1 ${isWizard ? "text-[10px]" : "text-sm"}`}
                  >
                    Font Size (px)
                  </label>
                  <input
                    type="number"
                    className={`w-full border rounded-lg focus:ring-2 focus:ring-primary outline-none ${isWizard ? "px-2 py-1 text-xs" : "px-3 py-2"}`}
                    value={formData.font_size || 12}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        font_size: parseInt(e.target.value) || 0,
                      })
                    }
                  />
                </div>
                <div>
                  <label
                    className={`block font-medium text-sub mb-1 ${isWizard ? "text-[10px]" : "text-sm"}`}
                  >
                    Line Spacing
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    className={`w-full border rounded-lg focus:ring-2 focus:ring-primary outline-none ${isWizard ? "px-2 py-1 text-xs" : "px-3 py-2"}`}
                    value={formData.line_spacing || 2}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        line_spacing: parseFloat(e.target.value) || 0,
                      })
                    }
                  />
                </div>
              </div>
            </div>

            {/* Padding Controls */}
            <div
              className={`bg-surface rounded-xl shadow-sm border border-border ${isWizard ? "p-3" : "p-6"}`}
            >
              <h3
                className={`font-bold text-main ${isWizard ? "text-xs mb-3" : "text-lg mb-4"}`}
              >
                Content Padding (px)
              </h3>
              <div
                className={`grid grid-cols-2 ${isWizard ? "gap-2" : "gap-4"}`}
              >
                <div>
                  <label
                    className={`block font-medium text-sub mb-1 ${isWizard ? "text-[10px]" : "text-sm"}`}
                  >
                    Left
                  </label>
                  <input
                    type="number"
                    className={`w-full border rounded-lg focus:ring-2 focus:ring-primary outline-none ${isWizard ? "px-2 py-1 text-xs" : "px-3 py-2"}`}
                    value={formData.padding_left}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        padding_left: parseInt(e.target.value) || 0,
                      })
                    }
                  />
                </div>
                <div>
                  <label
                    className={`block font-medium text-sub mb-1 ${isWizard ? "text-[10px]" : "text-sm"}`}
                  >
                    Right
                  </label>
                  <input
                    type="number"
                    className={`w-full border rounded-lg focus:ring-2 focus:ring-primary outline-none ${isWizard ? "px-2 py-1 text-xs" : "px-3 py-2"}`}
                    value={formData.padding_right}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        padding_right: parseInt(e.target.value) || 0,
                      })
                    }
                  />
                </div>
                <div>
                  <label
                    className={`block font-medium text-sub mb-1 ${isWizard ? "text-[10px]" : "text-sm"}`}
                  >
                    Top
                  </label>
                  <input
                    type="number"
                    className={`w-full border rounded-lg focus:ring-2 focus:ring-primary outline-none ${isWizard ? "px-2 py-1 text-xs" : "px-3 py-2"}`}
                    value={formData.padding_top}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        padding_top: parseInt(e.target.value) || 0,
                      })
                    }
                  />
                </div>
                <div>
                  <label
                    className={`block font-medium text-sub mb-1 ${isWizard ? "text-[10px]" : "text-sm"}`}
                  >
                    Bottom
                  </label>
                  <input
                    type="number"
                    className={`w-full border rounded-lg focus:ring-2 focus:ring-primary outline-none ${isWizard ? "px-2 py-1 text-xs" : "px-3 py-2"}`}
                    value={formData.padding_bottom}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        padding_bottom: parseInt(e.target.value) || 0,
                      })
                    }
                  />
                </div>
              </div>
            </div>

            {/* Section-Specific Padding Controls */}
            <div
              className={`bg-surface rounded-xl shadow-sm border border-border ${isWizard ? "p-3" : "p-6"}`}
            >
              <h3
                className={`font-bold text-main ${isWizard ? "text-xs mb-3" : "text-lg mb-4"}`}
              >
                Section Padding (px)
              </h3>
              <div className={isWizard ? "space-y-3" : "space-y-4"}>
                <div>
                  <label
                    className={`block font-medium text-sub mb-1 ${isWizard ? "text-[10px]" : "text-sm"}`}
                  >
                    Top Section Padding
                  </label>
                  <input
                    type="number"
                    className={`w-full border rounded-lg focus:ring-2 focus:ring-primary outline-none ${isWizard ? "px-2 py-1 text-xs" : "px-3 py-2"}`}
                    value={formData.top_section_padding || 10}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        top_section_padding: parseInt(e.target.value) || 0,
                      })
                    }
                  />
                </div>
                <div>
                  <label
                    className={`block font-medium text-sub mb-1 ${isWizard ? "text-[10px]" : "text-sm"}`}
                  >
                    Middle Section Padding
                  </label>
                  <input
                    type="number"
                    className={`w-full border rounded-lg focus:ring-2 focus:ring-primary outline-none ${isWizard ? "px-2 py-1 text-xs" : "px-3 py-2"}`}
                    value={formData.middle_section_padding || 20}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        middle_section_padding: parseInt(e.target.value) || 0,
                      })
                    }
                  />
                </div>
                <div>
                  <label
                    className={`block font-medium text-sub mb-1 ${isWizard ? "text-[10px]" : "text-sm"}`}
                  >
                    Bottom Section Padding
                  </label>
                  <input
                    type="number"
                    className={`w-full border rounded-lg focus:ring-2 focus:ring-primary outline-none ${isWizard ? "px-2 py-1 text-xs" : "px-3 py-2"}`}
                    value={formData.bottom_section_padding || 10}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        bottom_section_padding: parseInt(e.target.value) || 0,
                      })
                    }
                  />
                </div>
              </div>
            </div>

            {/* Page Settings */}
            <div
              className={`bg-surface rounded-xl shadow-sm border border-border ${isWizard ? "p-3" : "p-6"}`}
            >
              <h3
                className={`font-bold text-main ${isWizard ? "text-xs mb-3" : "text-lg mb-4"}`}
              >
                Page Settings
              </h3>
              <div className={isWizard ? "space-y-3" : "space-y-4"}>
                <div>
                  <label
                    className={`block font-medium text-sub mb-1 ${isWizard ? "text-[10px]" : "text-sm"}`}
                  >
                    Size
                  </label>
                  <select
                    className={`w-full border rounded-lg focus:ring-2 focus:ring-primary outline-none ${isWizard ? "px-2 py-1 text-xs" : "px-3 py-2"}`}
                    value={formData.page_size}
                    onChange={(e) =>
                      setFormData({ ...formData, page_size: e.target.value })
                    }
                  >
                    <option value="A4">A4</option>
                    <option value="A5">A5</option>
                    <option value="Letter">Letter</option>
                  </select>
                </div>
                <div>
                  <label
                    className={`block font-medium text-sub mb-1 ${isWizard ? "text-[10px]" : "text-sm"}`}
                  >
                    Orientation
                  </label>
                  <select
                    className={`w-full border rounded-lg focus:ring-2 focus:ring-primary outline-none ${isWizard ? "px-2 py-1 text-xs" : "px-3 py-2"}`}
                    value={formData.page_orientation}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        page_orientation: e.target.value,
                      })
                    }
                  >
                    <option value="portrait">Portrait</option>
                    <option value="landscape">Landscape</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Main Designer Area (Content Mode) */}
        {(mode === "full" || mode === "content") && (
          <div
            className={
              mode === "full"
                ? "lg:col-span-3 space-y-8"
                : "lg:col-span-4 space-y-8"
            }
          >
            {/* Top Section */}
            <div className="bg-surface p-6 rounded-xl shadow-sm border border-border">
              <h3 className="text-lg font-bold text-main mb-2">
                Top Section (Optional)
              </h3>
              <p className="text-sm text-muted-text mb-4">
                Header or title content. Type @ to insert variables.
              </p>

              {/* Alignment Controls */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-sub mb-2">
                  Text Alignment
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setFormData({ ...formData, top_alignment: "left" })
                    }
                    className={`px-4 py-2 rounded-lg border text-sm font-medium transition flex items-center gap-2 ${
                      formData.top_alignment === "left"
                        ? "bg-primary text-white border-primary"
                        : "bg-surface text-sub border-border-strong hover:bg-background"
                    }`}
                  >
                    <AlignLeft size={16} />
                    Left
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setFormData({ ...formData, top_alignment: "center" })
                    }
                    className={`px-4 py-2 rounded-lg border text-sm font-medium transition flex items-center gap-2 ${
                      formData.top_alignment === "center"
                        ? "bg-primary text-white border-primary"
                        : "bg-surface text-sub border-border-strong hover:bg-background"
                    }`}
                  >
                    <AlignCenter size={16} />
                    Center
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setFormData({ ...formData, top_alignment: "right" })
                    }
                    className={`px-4 py-2 rounded-lg border text-sm font-medium transition flex items-center gap-2 ${
                      formData.top_alignment === "right"
                        ? "bg-primary text-white border-primary"
                        : "bg-surface text-sub border-border-strong hover:bg-background"
                    }`}
                  >
                    <AlignRight size={16} />
                    Right
                  </button>
                </div>
              </div>

              <MentionsInput
                value={formData.top_content}
                onChange={(e) =>
                  setFormData({ ...formData, top_content: e.target.value })
                }
                style={getMentionStyle(formData.top_alignment || "center")}
                placeholder="Type @ to see available variables..."
              >
                <Mention
                  trigger="@"
                  data={mentionData}
                  style={{ backgroundColor: "var(--primary-light)" }}
                />
              </MentionsInput>
            </div>

            {/* Middle Section */}
            <div className="bg-surface p-6 rounded-xl shadow-sm border border-border">
              <h3 className="text-lg font-bold text-main mb-2">
                Middle Section (Required) *
              </h3>
              <p className="text-sm text-muted-text mb-4">
                Main certificate body. Type @ to insert variables.
              </p>

              {/* Alignment Controls */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-sub mb-2">
                  Text Alignment
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setFormData({ ...formData, middle_alignment: "left" })
                    }
                    className={`px-4 py-2 rounded-lg border text-sm font-medium transition flex items-center gap-2 ${
                      formData.middle_alignment === "left"
                        ? "bg-primary text-white border-primary"
                        : "bg-surface text-sub border-border-strong hover:bg-background"
                    }`}
                  >
                    <AlignLeft size={16} />
                    Left
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setFormData({ ...formData, middle_alignment: "center" })
                    }
                    className={`px-4 py-2 rounded-lg border text-sm font-medium transition flex items-center gap-2 ${
                      formData.middle_alignment === "center"
                        ? "bg-primary text-white border-primary"
                        : "bg-surface text-sub border-border-strong hover:bg-background"
                    }`}
                  >
                    <AlignCenter size={16} />
                    Center
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setFormData({ ...formData, middle_alignment: "right" })
                    }
                    className={`px-4 py-2 rounded-lg border text-sm font-medium transition flex items-center gap-2 ${
                      formData.middle_alignment === "right"
                        ? "bg-primary text-white border-primary"
                        : "bg-surface text-sub border-border-strong hover:bg-background"
                    }`}
                  >
                    <AlignRight size={16} />
                    Right
                  </button>
                </div>
              </div>

              <MentionsInput
                value={formData.middle_content}
                onChange={(e) =>
                  setFormData({ ...formData, middle_content: e.target.value })
                }
                style={{
                  ...getMentionStyle(formData.middle_alignment || "center"),
                  control: {
                    ...getMentionStyle(formData.middle_alignment || "center")
                      .control,
                    minHeight: 200,
                  },
                }}
                placeholder="Type @ to see available variables..."
              >
                <Mention
                  trigger="@"
                  data={mentionData}
                  style={{ backgroundColor: "var(--primary-light)" }}
                />
              </MentionsInput>
            </div>

            {/* Bottom Section */}
            <div className="bg-surface p-6 rounded-xl shadow-sm border border-border">
              <h3 className="text-lg font-bold text-main mb-2">
                Bottom Section (Optional)
              </h3>
              <p className="text-sm text-muted-text mb-4">
                Footer or signature content. Type @ to insert variables.
              </p>

              {/* Alignment Controls */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-sub mb-2">
                  Text Alignment
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setFormData({ ...formData, bottom_alignment: "left" })
                    }
                    className={`px-4 py-2 rounded-lg border text-sm font-medium transition flex items-center gap-2 ${
                      formData.bottom_alignment === "left"
                        ? "bg-primary text-white border-primary"
                        : "bg-surface text-sub border-border-strong hover:bg-background"
                    }`}
                  >
                    <AlignLeft size={16} />
                    Left
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setFormData({ ...formData, bottom_alignment: "center" })
                    }
                    className={`px-4 py-2 rounded-lg border text-sm font-medium transition flex items-center gap-2 ${
                      formData.bottom_alignment === "center"
                        ? "bg-primary text-white border-primary"
                        : "bg-surface text-sub border-border-strong hover:bg-background"
                    }`}
                  >
                    <AlignCenter size={16} />
                    Center
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setFormData({ ...formData, bottom_alignment: "right" })
                    }
                    className={`px-4 py-2 rounded-lg border text-sm font-medium transition flex items-center gap-2 ${
                      formData.bottom_alignment === "right"
                        ? "bg-primary text-white border-primary"
                        : "bg-surface text-sub border-border-strong hover:bg-background"
                    }`}
                  >
                    <AlignRight size={16} />
                    Right
                  </button>
                </div>
              </div>

              <MentionsInput
                value={formData.bottom_content}
                onChange={(e) =>
                  setFormData({ ...formData, bottom_content: e.target.value })
                }
                style={getMentionStyle(formData.bottom_alignment || "center")}
                placeholder="Type @ to see available variables..."
              >
                <Mention
                  trigger="@"
                  data={mentionData}
                  style={{ backgroundColor: "var(--primary-light)" }}
                />
              </MentionsInput>
            </div>

            {/* Blank Variables */}
            <div className="bg-surface p-6 rounded-xl shadow-sm border border-border">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-bold text-main">
                    Admin-Fillable Fields (@blank)
                  </h3>
                  <p className="text-sm text-muted-text">
                    Fields that admin will fill when issuing certificate
                  </p>
                </div>
                <button
                  onClick={() => setShowBlankModal(true)}
                  className="px-3 py-1.5 bg-primary text-white rounded-lg hover:bg-primary-hover text-sm font-medium flex items-center gap-1"
                >
                  <Plus size={16} /> Add Field
                </button>
              </div>

              {formData.blank_variables.length > 0 ? (
                <div className="space-y-2">
                  {formData.blank_variables.map((blankVar, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-3 bg-background rounded-lg"
                    >
                      <div>
                        <span className="font-mono text-sm text-primary">
                          @blank_{blankVar.name}
                        </span>
                        <span className="text-muted-text text-sm ml-2">
                          - {blankVar.label}
                        </span>
                        <span className="text-muted-text text-xs ml-2">
                          ({blankVar.type})
                        </span>
                      </div>
                      <button
                        onClick={() => handleRemoveBlankVariable(index)}
                        className="text-danger hover:text-danger"
                      >
                        <X size={18} />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-text text-sm text-center py-4">
                  No blank fields defined
                </p>
              )}
            </div>

            {/* Variable Reference */}
            <div className="bg-[var(--primary-light)] p-6 rounded-xl border border-[var(--primary-light)]">
              <h3 className="text-sm font-bold text-primary mb-3">
                Available Variables
              </h3>
              <div className="flex flex-wrap gap-2">
                {variables.slice(0, 20).map((v) => (
                  <code
                    key={v.name}
                    className="text-xs bg-surface px-2 py-1 rounded border border-[var(--primary-light)] text-primary"
                  >
                    @{v.name}
                  </code>
                ))}
                {variables.length > 20 && (
                  <span className="text-xs text-primary self-center">
                    +{variables.length - 20} more...
                  </span>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Blank Variable Modal */}
      {showBlankModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-surface rounded-2xl w-full max-w-md p-6 shadow-xl">
            <h2 className="text-xl font-bold mb-4">Add Admin-Fillable Field</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-sub mb-1">
                  Field Name
                </label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary outline-none"
                  placeholder="e.g., conduct"
                  value={newBlankVar.name}
                  onChange={(e) =>
                    setNewBlankVar({
                      ...newBlankVar,
                      name: e.target.value
                        .toLowerCase()
                        .replace(/[^a-z0-9_]/g, ""),
                    })
                  }
                />
                <p className="text-xs text-muted-text mt-1">
                  Will be used as @blank_{newBlankVar.name || "fieldname"}
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-sub mb-1">
                  Label
                </label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary outline-none"
                  placeholder="e.g., Conduct"
                  value={newBlankVar.label}
                  onChange={(e) =>
                    setNewBlankVar({ ...newBlankVar, label: e.target.value })
                  }
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-sub mb-1">
                  Type
                </label>
                <select
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary outline-none"
                  value={newBlankVar.type}
                  onChange={(e) =>
                    setNewBlankVar({ ...newBlankVar, type: e.target.value })
                  }
                >
                  <option value="text">Text</option>
                  <option value="date">Date</option>
                  <option value="number">Number</option>
                </select>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowBlankModal(false)}
                className="flex-1 px-4 py-2 border border-border-strong rounded-lg hover:bg-background"
              >
                Cancel
              </button>
              <button
                onClick={handleAddBlankVariable}
                className="flex-1 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover"
              >
                Add Field
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {showPreviewModal && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-surface rounded-2xl w-full max-w-4xl h-[85vh] shadow-2xl flex flex-col">
            <div className="flex justify-between items-center p-4 border-b">
              <h2 className="text-lg font-bold">Certificate Preview</h2>
              <button
                onClick={() => {
                  setShowPreviewModal(false);
                  if (previewHtml) URL.revokeObjectURL(previewHtml);
                }}
                className="text-muted-text hover:text-sub p-1 hover:bg-background rounded-full"
              >
                <X size={24} />
              </button>
            </div>
            <div className="flex-1 bg-background p-4 rounded-b-2xl overflow-hidden">
              {previewLoading ? (
                <div className="flex h-full items-center justify-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : (
                <iframe
                  src={previewHtml}
                  className="w-full h-full rounded bg-surface shadow-sm border border-border"
                  title="Certificate Preview"
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CertificateDesigner;
