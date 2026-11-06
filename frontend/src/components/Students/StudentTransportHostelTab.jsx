import React, { useState, useEffect, useMemo } from 'react';
import { 
  Bus, 
  Home, 
  Loader2,
  RefreshCw
} from 'lucide-react';
import api from '../../config/api';
import transportService from '../../services/transportService';

const StudentTransportHostelTab = ({ student }) => {
  const [loading, setLoading] = useState(false);
  const [transportData, setTransportData] = useState(null);
  const [hostelData, setHostelData] = useState(null);

  // Helper to extract nested or JSON student properties across multiple keys
  const getStudentField = (keys) => {
    if (!student) return null;
    const keyArray = Array.isArray(keys) ? keys : [keys];
    
    for (const k of keyArray) {
      if (student[k] != null && student[k] !== '') return student[k];
    }
    
    let studentDataObj = student.student_data;
    if (typeof studentDataObj === 'string') {
      try {
        studentDataObj = JSON.parse(studentDataObj);
      } catch (e) {
        studentDataObj = null;
      }
    }
    
    if (studentDataObj && typeof studentDataObj === 'object') {
      for (const k of keyArray) {
        if (studentDataObj[k] != null && studentDataObj[k] !== '') return studentDataObj[k];
      }
    }
    
    return null;
  };

  const studentTransportRoute = getStudentField(['transport_route', 'bus_route', 'route_name', 'routeName', 'Route Name', 'Route']);
  const studentBusNo = getStudentField(['bus_number', 'bus_no', 'busNo', 'Bus Number', 'Bus No']);
  const studentBusStop = getStudentField(['bus_stop', 'pickup_point', 'stop_name', 'stage_name', 'Pickup Stop', 'Stop']);
  const studentTransportFare = Number(getStudentField(['transport_fare', 'bus_fee', 'transport_fee', 'bus_fare', 'Bus Fee', 'Transport Fee', 'fare']) || 0);

  const studentHostelName = getStudentField(['hostel_name', 'hostel_code', 'hostelCode', 'hostel', 'Hostel Name', 'Hostel Block']);
  const studentHostelCategory = getStudentField(['hostel_category', 'categoryName', 'category_name', 'Hostel Category']);
  const studentRoomNo = getStudentField(['room_number', 'room_no', 'roomNo', 'roomNumber', 'Room Number', 'Room No']);
  const studentHostelFee = Number(getStudentField(['hostel_fee', 'hostel_fare', 'Hostel Fee', 'fee']) || 0);

  const admissionNumber = getStudentField(['admission_number', 'admission_no', 'admissionNumber', 'application_number'])
    || student?.admission_number 
    || student?.admission_no;
    
  const pinNo = getStudentField(['pin_no', 'pinNo', 'pin_number', 'pin', 'ht_no', 'roll_no'])
    || student?.pin_no 
    || student?.pin;

  const fetchLiveData = async () => {
    const identifiers = [
      student?.qr_token,
      student?.admission_number,
      student?.admission_no,
      student?.pin_no,
      student?.pinNo,
      student?.pin,
      student?.ht_no,
      student?.roll_no,
      student?.application_number
    ].filter(Boolean);

    if (identifiers.length === 0) return;

    setLoading(true);
    try {
      const uniqueIds = Array.from(new Set(identifiers));
      
      const transPromises = uniqueIds.map(id => transportService.getMyTransportDetails(id).catch(() => null));
      const qrPromises = uniqueIds.map(id => api.get(`/qr/public/${encodeURIComponent(id)}`).catch(() => null));

      const [transResults, qrResults] = await Promise.all([
        Promise.all(transPromises),
        Promise.all(qrPromises)
      ]);

      // 1. Resolve Transport Data
      const validTrans = transResults.find(r => r?.data?.requests?.length > 0 || r?.data?.hasTransportAccess || r?.data?.hasActivePass)
        || transResults.find(r => r?.data);

      const qrWithTrans = qrResults.find(r => r?.data?.data?.transportInfo?.hasTransport || r?.data?.data?.transportInfo?.requests?.length > 0);
        
      if (validTrans?.data?.requests?.length > 0 || validTrans?.data?.hasTransportAccess) {
        setTransportData(validTrans.data);
      } else if (qrWithTrans?.data?.data?.transportInfo) {
        setTransportData(qrWithTrans.data.data.transportInfo);
      } else if (validTrans?.data) {
        setTransportData(validTrans.data);
      }

      // 2. Resolve Hostel Data
      const qrWithHostel = qrResults.find(r => r?.data?.data?.hostelInfo?.hasHostel || r?.data?.data?.hostelInfo?.requests?.length > 0)
        || qrResults.find(r => r?.data?.data?.hostelInfo);
        
      if (qrWithHostel?.data?.data?.hostelInfo) {
        setHostelData(qrWithHostel.data.data.hostelInfo);
      }
    } catch (err) {
      console.error('Error fetching live transport/hostel data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLiveData();
  }, [admissionNumber, pinNo]);

  // Determine overall live availability
  const hasLiveTransport = useMemo(() => {
    if (transportData?.hasTransportAccess === true || transportData?.hasActivePass === true || transportData?.hasTransport === true) return true;
    if (Array.isArray(transportData?.requests) && transportData.requests.length > 0) return true;
    const reqVal = getStudentField(['transport_required', 'bus_required', 'Transport Required']);
    if (reqVal === 1 || reqVal === true || reqVal === '1' || String(reqVal).toLowerCase() === 'yes') return true;
    if (studentTransportRoute || studentBusNo || studentTransportFare > 0) return true;
    return false;
  }, [transportData, student, studentTransportRoute, studentBusNo, studentTransportFare]);

  const hasLiveHostel = useMemo(() => {
    if (hostelData?.hasHostel === true || hostelData?.activeHostel != null) return true;
    if (Array.isArray(hostelData?.requests) && hostelData.requests.length > 0) return true;
    const reqVal = getStudentField(['hostel_required', 'Hostel Required']);
    if (reqVal === 1 || reqVal === true || reqVal === '1' || String(reqVal).toLowerCase() === 'yes') return true;
    if (studentHostelName || studentHostelCategory || studentRoomNo || studentHostelFee > 0) return true;
    return false;
  }, [hostelData, student, studentHostelName, studentHostelCategory, studentRoomNo, studentHostelFee]);

  // Overall student facility category tag
  const facilityCategoryBadge = useMemo(() => {
    if (hasLiveTransport && hasLiveHostel) {
      return { label: 'Both Transport & Hostel', color: 'bg-[var(--primary-light)] text-secondary border-[var(--primary-light)]' };
    }
    if (hasLiveTransport) {
      return { label: 'Transport Only (Bus)', color: 'bg-[var(--primary-light)] text-primary border-[var(--primary-light)]' };
    }
    if (hasLiveHostel) {
      return { label: 'Hostel Resident Only', color: 'bg-[var(--warning-light)] text-warning border-[var(--warning-light)]' };
    }
    return { label: 'Day Scholar (No Facility)', color: 'bg-background text-sub border-border' };
  }, [hasLiveTransport, hasLiveHostel]);

  const activePass = transportData?.activePass;
  const activeHostel = hostelData?.activeHostel;

  const totalYears = Math.max(4, Number(student?.total_years) || 4);
  const currentYear = Math.max(1, Number(student?.current_year) || 1);

  // Map live transport details for a specific program year
  const getLiveTransportForYear = (yr, baseAcademicStart) => {
    const academicYear = `${baseAcademicStart + yr - 1}-${baseAcademicStart + yr}`;
    const requests = transportData?.requests || [];
    const match = requests.find((r) => Number(r.year_of_study || r.yearOfStudy) === Number(yr))
      || (transportData?.requestsByYear && (transportData.requestsByYear[`Year ${yr}`]?.[0] || transportData.requestsByYear[`year ${yr}`]?.[0]));

    if (match) {
      const resolvedRouteId = match.route_id || match.routeId || (activePass?.route_id ? `${activePass.route_id}-Y${yr}` : `R${yr}`);
      const resolvedRouteName = match.route_name || match.routeName || match.routeDetails?.routeName 
        || (studentTransportRoute && studentTransportRoute !== 'Route Assigned' ? studentTransportRoute : null) 
        || (resolvedRouteId ? `Route ${resolvedRouteId}` : 'College Transport Route');

      const resolvedBusNo = match.busDetails?.busNumber || match.bus_number || match.busNumber || match.bus_id || match.busId 
        || (studentBusNo && studentBusNo !== 'Bus Assigned' ? studentBusNo : null) 
        || (resolvedRouteId ? `Bus ${resolvedRouteId}` : 'Bus 1');

      const resolvedStage = match.stage_name || match.stageName || match.stopName || match.pickup_point || match.stop_name || match.pickupStop 
        || (studentBusStop && studentBusStop !== 'Stop Assigned' && studentBusStop !== 'Pickup Stop' ? studentBusStop : null) 
        || 'Main Stage';

      return {
        hasRecord: true,
        academicYear: match.academic_year || match.academicYear || academicYear,
        routeId: resolvedRouteId,
        routeName: resolvedRouteName,
        busNumber: resolvedBusNo,
        pickupStop: resolvedStage,
        fareAmount: match.fare != null ? Number(match.fare) : (match.fare_amount != null ? Number(match.fare_amount) : studentTransportFare),
        status: match.isActivePass ? 'Active Pass' : (match.status || 'Registered')
      };
    }

    if (hasLiveTransport && yr === currentYear && activePass) {
      const resolvedRouteId = activePass.route_id || activePass.routeId || `R${yr}`;
      const resolvedRouteName = activePass.route_name || activePass.routeName || activePass.routeDetails?.routeName 
        || (studentTransportRoute && studentTransportRoute !== 'Route Assigned' ? studentTransportRoute : null) 
        || `Route ${resolvedRouteId}`;

      const resolvedBusNo = activePass.busDetails?.busNumber || activePass.bus_number || activePass.busNumber || activePass.bus_id || activePass.busId 
        || (studentBusNo && studentBusNo !== 'Bus Assigned' ? studentBusNo : null) 
        || `Bus ${resolvedRouteId}`;

      const resolvedStage = activePass.stage_name || activePass.stageName || activePass.stopName || activePass.pickup_point || activePass.stop_name 
        || (studentBusStop && studentBusStop !== 'Stop Assigned' && studentBusStop !== 'Pickup Stop' ? studentBusStop : null) 
        || 'Main Stage';

      return {
        hasRecord: true,
        academicYear,
        routeId: resolvedRouteId,
        routeName: resolvedRouteName,
        busNumber: resolvedBusNo,
        pickupStop: resolvedStage,
        fareAmount: activePass.fare != null ? Number(activePass.fare) : (activePass.fare_amount != null ? Number(activePass.fare_amount) : studentTransportFare),
        status: 'Active Pass'
      };
    }

    const hasYearSpecificRequests = Array.isArray(requests) && requests.length > 0;
    if (!hasYearSpecificRequests && hasLiveTransport) {
      return {
        hasRecord: true,
        academicYear,
        routeId: `R${yr}`,
        routeName: studentTransportRoute && studentTransportRoute !== 'Route Assigned' ? studentTransportRoute : `Route ${yr}`,
        busNumber: studentBusNo && studentBusNo !== 'Bus Assigned' ? studentBusNo : `Bus R${yr}`,
        pickupStop: studentBusStop && studentBusStop !== 'Stop Assigned' && studentBusStop !== 'Pickup Stop' ? studentBusStop : 'Main Stage',
        fareAmount: studentTransportFare,
        status: yr < currentYear ? 'Completed' : (yr === currentYear ? 'Active Pass' : 'Scheduled')
      };
    }

    return {
      hasRecord: false,
      academicYear,
      routeId: '—',
      routeName: 'Not Opted',
      busNumber: '—',
      pickupStop: '—',
      fareAmount: 0,
      status: 'Not Opted'
    };
  };

  // Map live hostel details for a specific program year
  const getLiveHostelForYear = (yr, baseAcademicStart) => {
    const academicYear = `${baseAcademicStart + yr - 1}-${baseAcademicStart + yr}`;
    const requests = hostelData?.requests || [];
    const match = requests.find((r) => Number(r.sdmsYearOfStudy || r.year_of_study) === Number(yr))
      || (hostelData?.requestsByYear && (hostelData.requestsByYear[`Year ${yr}`]?.[0] || hostelData.requestsByYear[`year ${yr}`]?.[0]));

    if (match) {
      return {
        hasRecord: true,
        academicYear: match.academicYear || match.academic_year || academicYear,
        hostelCategory: match.categoryName || match.hostelCategory || studentHostelCategory || 'Hostel Residency',
        hostelName: match.hostelCode || match.hostelName || studentHostelName || 'Hostel Block',
        roomNumber: match.roomNumber || match.roomNo || studentRoomNo || 'Room Allocated',
        feeAmount: match.fee != null ? Number(match.fee) : studentHostelFee,
        status: match.isActiveHostel ? 'Active Resident' : (match.status || 'Registered')
      };
    }

    if (hasLiveHostel && yr === currentYear && activeHostel) {
      return {
        hasRecord: true,
        academicYear,
        hostelCategory: activeHostel.categoryName || studentHostelCategory || 'Hostel Residency',
        hostelName: activeHostel.hostelCode || studentHostelName || 'Hostel Block',
        roomNumber: activeHostel.roomNumber || activeHostel.roomNo || studentRoomNo || 'Room Allocated',
        feeAmount: activeHostel.fee != null ? Number(activeHostel.fee) : studentHostelFee,
        status: 'Active Resident'
      };
    }

    const hasYearSpecificRequests = Array.isArray(requests) && requests.length > 0;
    if (!hasYearSpecificRequests && hasLiveHostel) {
      return {
        hasRecord: true,
        academicYear,
        hostelCategory: studentHostelCategory || 'Hostel Residency',
        hostelName: studentHostelName || 'College Hostel Block',
        roomNumber: studentRoomNo || 'Room Allocated',
        feeAmount: studentHostelFee,
        status: yr < currentYear ? 'Completed' : (yr === currentYear ? 'Active Resident' : 'Scheduled')
      };
    }

    return {
      hasRecord: false,
      academicYear,
      hostelCategory: '—',
      hostelName: 'Not Opted',
      roomNumber: '—',
      feeAmount: 0,
      status: 'Not Opted'
    };
  };

  // Year-wise live details breakdown array (Year 1 to Year 4)
  const yearlyBreakdown = useMemo(() => {
    const list = [];
    const baseAcademicStart = 2026 - (currentYear - 1);

    for (let yr = 1; yr <= totalYears; yr++) {
      const isCurrent = yr === currentYear;
      const trans = getLiveTransportForYear(yr, baseAcademicStart);
      const host = getLiveHostelForYear(yr, baseAcademicStart);

      list.push({
        yearNumber: yr,
        academicYear: trans.academicYear,
        isCurrent,
        transport: trans,
        hostel: host,
        totalFare: trans.fareAmount + host.feeAmount
      });
    }
    return list;
  }, [currentYear, totalYears, transportData, hostelData, hasLiveTransport, hasLiveHostel, student]);

  // Current year live transport & hostel fares for header summary
  const currentYearTransportFare = useMemo(() => {
    const curr = yearlyBreakdown.find((y) => y.isCurrent);
    return curr?.transport?.fareAmount || 0;
  }, [yearlyBreakdown]);

  const currentYearHostelFee = useMemo(() => {
    const curr = yearlyBreakdown.find((y) => y.isCurrent);
    return curr?.hostel?.feeAmount || 0;
  }, [yearlyBreakdown]);

  const formatCurrency = (val) => new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  }).format(val || 0);

  return (
    <div className="space-y-3 text-main font-sans">
      {/* Top Header Bar */}
      <div className="bg-surface rounded-xl border border-border p-3 shadow-2xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-[var(--primary-light)] text-primary rounded-lg border border-[var(--primary-light)] shrink-0">
            <Bus size={18} />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-xs font-extrabold text-main">Transport & Hostel Summary</h3>
              <span className={`px-2 py-0.5 rounded-full text-[9px] font-extrabold border ${facilityCategoryBadge.color}`}>
                {facilityCategoryBadge.label}
              </span>
              {loading && <Loader2 size={12} className="animate-spin text-primary" />}
            </div>
            <p className="text-[11px] text-muted-text mt-0.5">
              {student?.student_name || 'Student'} ({pinNo || admissionNumber || 'N/A'}) · Year {currentYear}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={fetchLiveData}
            disabled={loading}
            className="px-2 py-1 rounded-md text-[11px] font-semibold text-sub hover:bg-background border border-border transition-colors flex items-center gap-1"
            title="Refresh Live Data"
          >
            <RefreshCw size={11} className={loading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>
          
          {hasLiveTransport && (
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold border bg-[var(--primary-light)] text-primary border-[var(--primary-light)]">
              Transport: {currentYearTransportFare > 0 ? formatCurrency(currentYearTransportFare) : 'Opted'}
            </span>
          )}

          {hasLiveHostel && (
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold border bg-[var(--warning-light)] text-warning border-[var(--warning-light)]">
              Hostel: {currentYearHostelFee > 0 ? formatCurrency(currentYearHostelFee) : 'Opted'}
            </span>
          )}
        </div>
      </div>

      {/* Year 1, Year 2, Year 3, Year 4 Cards */}
      <div className="space-y-2.5">
        {yearlyBreakdown.map((item) => (
          <div 
            key={`year-${item.yearNumber}`}
            className={`bg-surface rounded-xl border shadow-2xs overflow-hidden transition-all ${
              item.isCurrent ? 'border-[var(--primary-light)] ring-1 ring-[var(--primary-light)]' : 'border-border'
            }`}
          >
            {/* Year Title Bar */}
            <div className={`px-3 py-2 flex items-center justify-between border-b text-[11px] ${
              item.isCurrent ? 'bg-[var(--primary-light)] border-[var(--primary-light)]' : 'bg-[var(--background)]/70 border-border'
            }`}>
              <div className="flex items-center gap-2">
                <span className={`px-2 py-0.5 rounded-md font-bold text-[10px] ${
                  item.isCurrent ? 'bg-primary text-white' : 'bg-background text-sub'
                }`}>
                  Year {item.yearNumber}
                </span>
                <span className="font-bold text-sub">Academic Year: {item.academicYear}</span>
                {item.isCurrent && (
                  <span className="text-[9px] font-extrabold text-primary bg-[var(--primary-light)] px-1.5 py-0.5 rounded-full">
                    Current Year
                  </span>
                )}
              </div>
              <span className="font-extrabold text-main">
                Total: {formatCurrency(item.totalFare)}
              </span>
            </div>

            {/* Dynamic Content Grid: Renders ONLY what the student has */}
            <div className={`p-2.5 grid gap-2 text-[11px] ${
              item.transport.hasRecord && item.hostel.hasRecord 
                ? 'grid-cols-1 md:grid-cols-2' 
                : 'grid-cols-1'
            }`}>
              
              {/* Transport Box (Shown ONLY if student has transport for this year) */}
              {item.transport.hasRecord && (
                <div className="p-2.5 rounded-lg border border-[var(--primary-light)] bg-[var(--primary-light)] space-y-1">
                  <div className="flex items-center justify-between border-b border-[var(--primary-light)] pb-1">
                    <span className="font-bold text-primary flex items-center gap-1">
                      <Bus size={13} /> Transport Details
                    </span>
                    <span className="font-extrabold text-primary">
                      {item.transport.fareAmount > 0 ? formatCurrency(item.transport.fareAmount) : 'Opted'}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-[10px] text-sub">
                    <div><span className="font-semibold text-muted-text">Academic Year:</span> {item.transport.academicYear}</div>
                    <div><span className="font-semibold text-muted-text">Route Name:</span> {item.transport.routeName} {item.transport.routeId && item.transport.routeId !== '—' ? `(${item.transport.routeId})` : ''}</div>
                    <div><span className="font-semibold text-muted-text">Bus No:</span> {item.transport.busNumber}</div>
                    <div><span className="font-semibold text-muted-text">Stage:</span> {item.transport.pickupStop}</div>
                  </div>
                </div>
              )}

              {/* Hostel Box (Shown ONLY if student has hostel for this year) */}
              {item.hostel.hasRecord && (
                <div className="p-2.5 rounded-lg border border-[var(--warning-light)] bg-[var(--warning-light)] space-y-1">
                  <div className="flex items-center justify-between border-b border-[var(--warning-light)] pb-1">
                    <span className="font-bold text-warning flex items-center gap-1">
                      <Home size={13} /> Hostel Details
                    </span>
                    <span className="font-extrabold text-warning">
                      {item.hostel.feeAmount > 0 ? formatCurrency(item.hostel.feeAmount) : 'Opted'}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-[10px] text-sub">
                    <div><span className="font-semibold text-muted-text">Academic Year:</span> {item.hostel.academicYear}</div>
                    <div><span className="font-semibold text-muted-text">Category:</span> {item.hostel.hostelCategory}</div>
                    <div><span className="font-semibold text-muted-text">Hostel:</span> {item.hostel.hostelName}</div>
                    <div><span className="font-semibold text-muted-text">Room:</span> {item.hostel.roomNumber}</div>
                  </div>
                </div>
              )}

              {/* Day Scholar / Neither Opted Note */}
              {!item.transport.hasRecord && !item.hostel.hasRecord && (
                <div className="py-2 text-center text-[10px] text-muted-text font-medium bg-[var(--background)]/60 rounded-lg border border-dashed border-border">
                  Day Scholar / No Transport or Hostel Opted for Year {item.yearNumber}
                </div>
              )}

            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default StudentTransportHostelTab;
