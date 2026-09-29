import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  MapPin, 
  Layers, 
  Building2, 
  CheckCircle2, 
  AlertCircle, 
  Upload, 
  Check, 
  Info, 
  List, 
  Map as MapIcon, 
  ShieldCheck, 
  Clock,
  Sparkles,
  ExternalLink
} from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { getCoverageOverview, completeExternalStep } from '../api/approvals';
import TaskerAssistantDrawer from '../components/TaskerAssistantDrawer';
import { useLanguage } from '../context/LanguageContext';

// Custom Map Marker Icons using SVGs
const createCustomIcon = (color, label) => {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="36" height="36">
      <path fill="${color}" stroke="#ffffff" stroke-width="1.5" d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
      <circle cx="12" cy="9" r="3.5" fill="#ffffff"/>
    </svg>
  `;
  return L.divIcon({
    className: 'custom-leaflet-marker',
    html: `<div style="display:flex; flex-direction:column; align-items:center;">
             ${svg}
             <span style="background:#1F2A44; color:#E8DCC8; font-size:10px; font-weight:bold; padding:1px 6px; border-radius:4px; margin-top:-6px; white-space:nowrap; border:1px solid #C6A75E;">
               ${label}
             </span>
           </div>`,
    iconSize: [36, 48],
    iconAnchor: [18, 42],
  });
};

const CoverageMapPage = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [coverageData, setCoverageData] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);
  const [activeTab, setActiveTab] = useState('MAP'); // 'MAP' or 'LIST'
  const [filter, setFilter] = useState('ALL');
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [assistantQuery, setAssistantQuery] = useState('');
  
  // External step completion modal
  const [completingStep, setCompletingStep] = useState(null);
  const [stepNotes, setStepNotes] = useState('');
  const [submittingStep, setSubmittingStep] = useState(false);

  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersRef = useRef([]);

  useEffect(() => {
    fetchCoverage();
  }, []);

  const fetchCoverage = async () => {
    try {
      setLoading(true);
      const data = await getCoverageOverview();
      setCoverageData(data);
      if (data?.items?.length > 0) {
        setSelectedItem(data.items[0]);
      }
    } catch (err) {
      console.error('Failed to load coverage:', err);
    } finally {
      setLoading(false);
    }
  };

  // Initialize and update Leaflet Map
  useEffect(() => {
    if (activeTab !== 'MAP' || loading || !coverageData) return;

    const bLoc = coverageData.business_location;
    const centerLat = bLoc?.latitude || 11.6643;
    const centerLng = bLoc?.longitude || 78.1460;

    if (!mapInstanceRef.current && mapContainerRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: [centerLat, centerLng],
        zoom: 13,
        zoomControl: true,
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 18,
      }).addTo(map);

      mapInstanceRef.current = map;
    }

    // Update markers
    if (mapInstanceRef.current) {
      // Clear old markers
      markersRef.current.forEach(m => m.remove());
      markersRef.current = [];

      const map = mapInstanceRef.current;

      // 1. Business Location Marker
      const businessMarker = L.marker([centerLat, centerLng], {
        icon: createCustomIcon('#1F2A44', 'Business: ' + (bLoc?.company_name?.split(' ')[0] || 'Unit'))
      }).addTo(map);

      businessMarker.bindPopup(`
        <div style="font-family:sans-serif; padding:4px;">
          <b style="color:#1F2A44; font-size:13px;">${bLoc?.company_name}</b><br/>
          <span style="color:#64748B; font-size:11px;">${bLoc?.address || 'Industrial Premises'}</span><br/>
          <span style="color:#10B981; font-weight:bold; font-size:11px;">Registered Manufacturing Hub</span>
        </div>
      `);
      markersRef.current.push(businessMarker);

      // 2. Authority Markers
      const filtered = coverageData.items.filter(item => {
        if (filter === 'ALL') return true;
        return item.coverage_type === filter;
      });

      filtered.forEach(item => {
        if (item.has_coordinates && item.latitude && item.longitude) {
          const color = item.coverage_type === 'ONLINE' ? '#10B981' : (item.coverage_type === 'HYBRID' ? '#F59E0B' : '#F43F5E');
          const marker = L.marker([item.latitude, item.longitude], {
            icon: createCustomIcon(color, item.approval_id)
          }).addTo(map);

          marker.bindPopup(`
            <div style="font-family:sans-serif; padding:4px; max-width:220px;">
              <b style="color:#1F2A44; font-size:12px;">${item.approval_name}</b><br/>
              <span style="color:#64748B; font-size:11px;">${item.authority}</span><br/>
              <span style="color:${color}; font-weight:bold; font-size:11px;">${item.coverage_label}</span><br/>
              <span style="color:#94A3B8; font-size:10px;">${item.authority_location}</span>
            </div>
          `);

          marker.on('click', () => {
            setSelectedItem(item);
          });

          markersRef.current.push(marker);
        }
      });
    }

    return () => {
      // Map cleanup on unmount
    };
  }, [activeTab, loading, coverageData, filter]);

  const handleStepCompleteSubmit = async () => {
    if (!completingStep) return;
    try {
      setSubmittingStep(true);
      await completeExternalStep(completingStep.id, { notes: stepNotes });
      setCompletingStep(null);
      setStepNotes('');
      await fetchCoverage();
    } catch (err) {
      alert('Failed to complete external step: ' + err.message);
    } finally {
      setSubmittingStep(false);
    }
  };

  const filteredItems = coverageData?.items?.filter(item => {
    if (filter === 'ALL') return true;
    return item.coverage_type === filter;
  }) || [];

  return (
    <div className="min-h-screen bg-[#FAF6F0] py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-[#E8DCC8] shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#1F2A44] text-[#E8DCC8] text-xs font-semibold uppercase tracking-wider mb-3">
              <Layers className="w-3.5 h-3.5" />
              {t("cov_badge")}
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-[#1F2A44]">
              {t("cov_title")}
            </h1>
            <p className="text-sm text-slate-600 mt-1 max-w-2xl">
              {t("cov_subtitle")}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="bg-slate-100 p-1 rounded-xl flex items-center border border-slate-200">
              <button
                onClick={() => setActiveTab('MAP')}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'MAP' ? 'bg-[#1F2A44] text-[#E8DCC8] shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <MapIcon className="w-3.5 h-3.5" />
                {t("cov_tab_map")}
              </button>
              <button
                onClick={() => setActiveTab('LIST')}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'LIST' ? 'bg-[#1F2A44] text-[#E8DCC8] shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <List className="w-3.5 h-3.5" />
                {t("cov_tab_list")}
              </button>
            </div>

            <button
              onClick={() => {
                setAssistantQuery('Which approvals in my plan require external actions or physical inspections?');
                setAssistantOpen(true);
              }}
              className="p-2.5 rounded-xl bg-[#FAF6F0] hover:bg-[#E8DCC8]/60 text-[#1F2A44] border border-[#E8DCC8] transition-all cursor-pointer"
              title="Ask Assistant about coverage"
            >
              <Sparkles className="w-4 h-4 text-[#C6A75E]" />
            </button>
          </div>
        </div>

        {/* Legend & Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div 
            onClick={() => setFilter(filter === 'ONLINE' ? 'ALL' : 'ONLINE')}
            className={`p-4 rounded-2xl border cursor-pointer transition-all ${
              filter === 'ONLINE' ? 'ring-2 ring-emerald-500 bg-emerald-50 border-emerald-300' : 'bg-white border-slate-200 hover:border-emerald-300'
            }`}
          >
            <div className="flex items-center gap-2 mb-1">
              <span className="w-3 h-3 rounded-full bg-emerald-500"></span>
              <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                {t("cov_stat_digital")}
              </span>
            </div>
            <div className="text-xl font-extrabold text-slate-900">
              {t("cov_workflows_count", { count: coverageData?.summary?.online_count || 0 })}
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">{t("cov_digital_sub")}</p>
          </div>

          <div 
            onClick={() => setFilter(filter === 'HYBRID' ? 'ALL' : 'HYBRID')}
            className={`p-4 rounded-2xl border cursor-pointer transition-all ${
              filter === 'HYBRID' ? 'ring-2 ring-amber-500 bg-amber-50 border-amber-300' : 'bg-white border-slate-200 hover:border-amber-300'
            }`}
          >
            <div className="flex items-center gap-2 mb-1">
              <span className="w-3 h-3 rounded-full bg-amber-500"></span>
              <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                {t("cov_stat_hybrid")}
              </span>
            </div>
            <div className="text-xl font-extrabold text-slate-900">
              {t("cov_workflows_count", { count: coverageData?.summary?.hybrid_count || 0 })}
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">{t("cov_hybrid_sub")}</p>
          </div>

          <div 
            onClick={() => setFilter(filter === 'EXTERNAL' ? 'ALL' : 'EXTERNAL')}
            className={`p-4 rounded-2xl border cursor-pointer transition-all ${
              filter === 'EXTERNAL' ? 'ring-2 ring-rose-500 bg-rose-50 border-rose-300' : 'bg-white border-slate-200 hover:border-rose-300'
            }`}
          >
            <div className="flex items-center gap-2 mb-1">
              <span className="w-3 h-3 rounded-full bg-rose-500"></span>
              <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                {t("cov_stat_external")}
              </span>
            </div>
            <div className="text-xl font-extrabold text-slate-900">
              {t("cov_workflows_count", { count: coverageData?.summary?.external_count || 0 })}
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">{t("cov_external_sub")}</p>
          </div>

          <div 
            onClick={() => setFilter('ALL')}
            className={`p-4 rounded-2xl border cursor-pointer transition-all ${
              filter === 'ALL' ? 'ring-2 ring-[#1F2A44] bg-slate-50 border-slate-400' : 'bg-white border-slate-200 hover:border-slate-300'
            }`}
          >
            <div className="flex items-center gap-2 mb-1">
              <Building2 className="w-3.5 h-3.5 text-[#1F2A44]" />
              <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                {t("plan_filter_all")}
              </span>
            </div>
            <div className="text-xl font-extrabold text-slate-900">
              {t("cov_workflows_count", { count: coverageData?.summary?.total_workflows || 0 })}
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">{t("btn_select_all")}</p>
          </div>
        </div>

        {/* Main Workspace Area (Map + Side Panel or List View) */}
        {activeTab === 'MAP' ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Map Container */}
            <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-[560px]">
              <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 text-slate-700 font-medium">
                  <MapPin className="w-4 h-4 text-emerald-600" />
                  <span>Anchor Location: <b>{coverageData?.business_location?.district}, {coverageData?.business_location?.state}</b></span>
                </div>
                <span className="text-[11px] text-slate-500">
                  OpenStreetMap Verified Tiles
                </span>
              </div>
              <div ref={mapContainerRef} className="flex-1 w-full z-10" />
            </div>

            {/* Side Detail Panel */}
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 flex flex-col justify-between h-[560px] overflow-y-auto">
              {selectedItem ? (
                <div className="space-y-5">
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className="px-2.5 py-0.5 rounded-full bg-[#1F2A44] text-[#E8DCC8] text-xs font-bold">
                        {selectedItem.approval_id}
                      </span>
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                        selectedItem.coverage_type === 'ONLINE' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                        (selectedItem.coverage_type === 'HYBRID' ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-rose-50 text-rose-700 border-rose-200')
                      }`}>
                        {selectedItem.coverage_label}
                      </span>
                    </div>
                    <h3 className="text-lg font-bold text-slate-900 leading-snug">
                      {selectedItem.approval_name}
                    </h3>
                    <p className="text-xs text-slate-500 font-medium mt-0.5">
                      {selectedItem.department}
                    </p>
                  </div>

                  {/* Warning for external / hybrid */}
                  {selectedItem.coverage_type !== 'ONLINE' && (
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                      <span>
                        <b>Notice:</b> Some steps for this clearance are outside TASKER's direct digital submission.
                      </span>
                    </div>
                  )}

                  {/* TASKER Capabilities */}
                  <div>
                    <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                      What TASKER Handles Digitally
                    </h4>
                    <div className="space-y-1.5">
                      {selectedItem.tasker_capabilities.map((cap, i) => (
                        <div key={i} className="flex items-start gap-2 text-xs text-slate-700">
                          <Check className="w-3.5 h-3.5 text-emerald-600 mt-0.5 flex-shrink-0" />
                          <span>{cap}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* External Steps Checklist */}
                  {selectedItem.external_steps && selectedItem.external_steps.length > 0 && (
                    <div>
                      <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                        External / Physical Requirements
                      </h4>
                      <div className="space-y-1.5">
                        {selectedItem.external_steps.map((step, i) => (
                          <div key={i} className="flex items-start gap-2 text-xs text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                            <Clock className="w-3.5 h-3.5 text-amber-500 mt-0.5 flex-shrink-0" />
                            <span>{step}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Active External Steps Tracking */}
                  {selectedItem.external_steps_tracking && selectedItem.external_steps_tracking.length > 0 && (
                    <div>
                      <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                        External Step Tracker
                      </h4>
                      <div className="space-y-2">
                        {selectedItem.external_steps_tracking.map((s) => (
                          <div key={s.id} className="p-3 bg-[#FAF6F0] rounded-xl border border-[#E8DCC8] text-xs">
                            <div className="flex items-center justify-between mb-1">
                              <span className="font-bold text-slate-900">{s.step_name}</span>
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                s.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                              }`}>
                                {s.status}
                              </span>
                            </div>
                            <p className="text-slate-600 text-[11px] mb-2">{s.description}</p>
                            {s.status !== 'COMPLETED' && (
                              <button
                                onClick={() => setCompletingStep(s)}
                                className="w-full py-1.5 bg-[#1F2A44] hover:bg-[#151D30] text-[#E8DCC8] rounded-lg font-bold text-xs transition-colors"
                              >
                                Mark External Step Complete
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Regional Authority Info */}
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">
                      Competent Authority Office
                    </span>
                    <p className="font-semibold text-slate-900">{selectedItem.authority}</p>
                    <p className="text-slate-500 text-[11px] mt-0.5">{selectedItem.authority_location}</p>
                  </div>
                </div>
              ) : (
                <div className="py-20 text-center text-slate-400">
                  Select a workflow to inspect coverage capabilities
                </div>
              )}
            </div>
          </div>
        ) : (
          /* Accessible Non-Map Fallback List */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredItems.map(item => (
              <div key={item.id} className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4 shadow-sm">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="px-2.5 py-0.5 rounded-full bg-[#1F2A44] text-[#E8DCC8] text-xs font-bold font-mono">
                      {item.approval_id}
                    </span>
                    <h3 className="font-bold text-slate-900 text-base mt-1.5">{item.approval_name}</h3>
                    <p className="text-xs text-slate-500 font-medium">{item.department}</p>
                  </div>
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                    item.coverage_type === 'ONLINE' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                    (item.coverage_type === 'HYBRID' ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-rose-50 text-rose-700 border-rose-200')
                  }`}>
                    {item.coverage_label}
                  </span>
                </div>

                <div className="text-xs text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <span className="font-bold text-slate-800 block mb-1">Coverage Scope:</span>
                  {item.description}
                </div>

                <div className="text-xs space-y-2">
                  <span className="font-bold uppercase tracking-wider text-[10px] text-slate-400 block">
                    Regional Authority
                  </span>
                  <div className="text-slate-800 font-semibold">{item.authority}</div>
                  <div className="text-slate-500">{item.authority_location}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Step Completion Confirmation Modal */}
        {completingStep && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
            <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md p-6 space-y-4 animate-scaleUp">
              <h3 className="text-base font-bold text-slate-900">
                Confirm External Step Completion
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                You are marking <b>"{completingStep.step_name}"</b> as completed. TASKER does not automatically assume statutory validity until verified by formal authority documentation.
              </p>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Completion Notes / Reference Acknowledgement (Optional)
                </label>
                <textarea
                  value={stepNotes}
                  onChange={(e) => setStepNotes(e.target.value)}
                  placeholder="e.g. Officer completed inspection on site; inspection slip received."
                  className="w-full text-xs p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#1F2A44] outline-none"
                  rows={3}
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  onClick={() => setCompletingStep(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  onClick={handleStepCompleteSubmit}
                  disabled={submittingStep}
                  className="px-4 py-2 bg-[#1F2A44] hover:bg-[#151D30] text-[#E8DCC8] rounded-xl text-xs font-bold transition-all shadow-sm"
                >
                  {submittingStep ? 'Confirming...' : 'Mark as Complete'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Assistant Drawer */}
        <TaskerAssistantDrawer
          isOpen={assistantOpen}
          onClose={() => setAssistantOpen(false)}
          initialQuery={assistantQuery}
        />
      </div>
    </div>
  );
};

export default CoverageMapPage;
