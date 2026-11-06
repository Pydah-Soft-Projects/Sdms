import React, { useEffect, useState, useMemo } from 'react';
import transportService from '../../services/transportService';
import useAuthStore from '../../store/authStore';
import { toast } from 'react-hot-toast';
import { SkeletonBox } from '../../components/SkeletonLoader';
import {
    RiBusFill,
    RiMapPin2Fill,
    RiRouteFill,
    RiCrosshair2Line,
    RiBuilding2Fill,
    RiCloseLine,
    RiFocus3Line,
    RiSunLine,
    RiMoonLine
} from 'react-icons/ri';
import { MapContainer, TileLayer, Marker, Popup, Polyline, Circle, LayersControl, Tooltip, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Leaflet custom marker and tooltip CSS (Clean Light Portal Theme)
const customMapStyles = `
  .clean-leaflet-marker {
    background: transparent !important;
    border: none !important;
  }
  .stage-tooltip {
    background: var(--surface) !important;
    color: var(--text-primary) !important;
    font-size: 12px !important;
    font-weight: 700 !important;
    border: 1px solid var(--border-strong) !important;
    border-radius: 8px !important;
    padding: 6px 12px !important;
    box-shadow: 0 4px 14px rgba(0,0,0,0.12) !important;
  }
  .stage-tooltip:before {
    border-top-color: var(--surface) !important;
  }
`;

// Helper component for map programmatic view adjustments
function MapViewController({ targetCoords, zoom, bounds }) {
    const map = useMap();
    useEffect(() => {
        if (bounds && bounds.length > 1) {
            map.fitBounds(bounds, { padding: [30, 30], maxZoom: 16 });
        } else if (targetCoords && targetCoords[0] && targetCoords[1]) {
            map.setView(targetCoords, zoom || 15, { animate: true });
        }
    }, [targetCoords, zoom, bounds, map]);
    return null;
}

// Scheduled Commencement & Terminus Timing Constants
const MORNING_ORIGIN_START_TIME = '07:00 AM';
const MORNING_CAMPUS_END_TIME = '08:15 AM';
const EVENING_CAMPUS_START_TIME = '04:30 PM';
const EVENING_ORIGIN_END_TIME = '05:45 PM';

// Helper to calculate compass direction label from degrees
const getCompassDirection = (deg) => {
    if (deg == null || isNaN(deg) || deg < 0) return '';
    const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    const index = Math.round(((deg % 360) + 360) % 360 / 45) % 8;
    return directions[index];
};

// Helper to add minutes to a standard time string like "07:00 AM" or "04:30 PM"
const addMinutesToTimeStr = (baseTimeStr, minutesToAdd) => {
    try {
        const parts = baseTimeStr.split(' ');
        const [hStr, mStr] = parts[0].split(':');
        let h = parseInt(hStr, 10);
        const m = parseInt(mStr, 10);
        const isPM = parts[1] === 'PM';
        if (isPM && h < 12) h += 12;
        if (!isPM && h === 12) h = 0;

        const totalMinutes = h * 60 + m + Math.round(minutesToAdd);
        let resH = Math.floor(totalMinutes / 60) % 24;
        const resM = totalMinutes % 60;
        const resAmpm = resH >= 12 ? 'PM' : 'AM';
        const formattedH = resH % 12 || 12;
        const formattedM = resM < 10 ? `0${resM}` : resM;
        return `${formattedH}:${formattedM} ${resAmpm}`;
    } catch (e) {
        return baseTimeStr;
    }
};

const Transport = () => {
    const { user } = useAuthStore();
    const [transportData, setTransportData] = useState(null);
    const [liveBusData, setLiveBusData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [mapFocus, setMapFocus] = useState('fit'); // 'fit', 'bus', 'stop', 'campus', 'custom'
    const [customFocusCoords, setCustomFocusCoords] = useState(null);
    const [lastPingTime, setLastPingTime] = useState('Just now');
    const [roadGeometry, setRoadGeometry] = useState(null);
    const [routeDuration, setRouteDuration] = useState(null);
    const [routeDistanceKm, setRouteDistanceKm] = useState(null);
    const [showFullRouteModal, setShowFullRouteModal] = useState(false);

    // Initial fetch of transport details
    useEffect(() => {
        fetchTransportDetails();
    }, [user?.admission_number]);

    const fetchTransportDetails = async () => {
        try {
            setLoading(true);
            const res = await transportService.getMyTransportDetails(user?.admission_number);
            if (res.data && res.data.success) {
                setTransportData(res.data);
                if (res.data.liveLocation) {
                    setLiveBusData(res.data.liveLocation);
                }
            } else {
                setTransportData(null);
            }
        } catch (error) {
            console.error('Failed to load student transport details:', error);
            toast.error('Unable to fetch transport details');
        } finally {
            setLoading(false);
        }
    };

    const activePass = transportData?.activePass;
    const hasActivePass = transportData?.hasActivePass && activePass;
    const busIdentifier = activePass?.busId || activePass?.routeId;

    // Polling Live GPS Location every 3 seconds
    useEffect(() => {
        if (!hasActivePass || !busIdentifier) return;

        const pollGps = async () => {
            try {
                const res = await transportService.getLiveBusLocation(busIdentifier);
                if (res.data?.success && res.data?.data) {
                    setLiveBusData(res.data.data);
                    setLastPingTime('Just now');
                }
            } catch (err) {
                // Keep last known telemetry
            }
        };

        pollGps();
        const interval = setInterval(() => {
            pollGps();
        }, 3000);

        return () => clearInterval(interval);
    }, [hasActivePass, busIdentifier]);

    // Live ping timer counter
    useEffect(() => {
        const timer = setInterval(() => {
            setLastPingTime(prev => {
                if (prev === 'Just now') return '3s ago';
                const match = prev.match(/(\d+)s/);
                if (match) {
                    const secs = parseInt(match[1], 10) + 3;
                    return `${secs}s ago`;
                }
                return 'Just now';
            });
        }, 3000);
        return () => clearInterval(timer);
    }, []);

    // Live Speed & Ignition Status
    const liveSpeed = liveBusData?.location?.speed != null ? Number(liveBusData.location.speed) : 0;
    const isMoving = liveBusData?.location?.status === 'Moving' || liveSpeed > 0;
    const ignitionActive = Boolean(liveBusData?.location?.ignition);
    const busHeading = liveBusData?.location?.heading || 0;

    // Extract all stages along the route including origin, stops, and campus destination
    const allRouteStages = useMemo(() => {
        if (!activePass?.routeDetails?.stages || !Array.isArray(activePass.routeDetails.stages)) {
            return [];
        }
        return activePass.routeDetails.stages.filter(s => s.latitude && s.longitude);
    }, [activePass]);

    // Find student's stage object dynamically
    const studentStage = useMemo(() => {
        if (activePass?.stopDetails && activePass.stopDetails.latitude && activePass.stopDetails.longitude) {
            return activePass.stopDetails;
        }
        if (activePass?.stopName && allRouteStages.length > 0) {
            const target = activePass.stopName.trim().toLowerCase();
            const found = allRouteStages.find(s => s.stageName && s.stageName.trim().toLowerCase() === target);
            if (found) return found;
        }
        return activePass?.stopDetails || null;
    }, [activePass, allRouteStages]);

    // Find student's stage index
    const studentStageIndex = useMemo(() => {
        if (!activePass?.stopName || !allRouteStages.length) return null;
        const target = activePass.stopName.trim().toLowerCase();
        const idx = allRouteStages.findIndex(s => s.stageName && s.stageName.trim().toLowerCase() === target);
        return idx !== -1 ? idx + 1 : null;
    }, [activePass, allRouteStages]);

    // Resolve Student Boarding Stop Coordinates dynamically
    const stopCoords = useMemo(() => {
        if (studentStage?.latitude && studentStage?.longitude) {
            return [Number(studentStage.latitude), Number(studentStage.longitude)];
        }
        if (allRouteStages.length > 0 && allRouteStages[0]?.latitude && allRouteStages[0]?.longitude) {
            return [Number(allRouteStages[0].latitude), Number(allRouteStages[0].longitude)];
        }
        return null;
    }, [studentStage, allRouteStages]);

    // Resolve Real-Time Live Bus Coordinates from GPS API
    const busCoords = useMemo(() => {
        if (liveBusData?.location?.latitude && liveBusData?.location?.longitude) {
            return [Number(liveBusData.location.latitude), Number(liveBusData.location.longitude)];
        }
        return stopCoords;
    }, [liveBusData, stopCoords]);

    // Resolve College Campus Final Destination Coordinates dynamically
    const campusCoords = useMemo(() => {
        if (activePass?.routeDetails?.destination?.latitude && activePass?.routeDetails?.destination?.longitude) {
            return [Number(activePass.routeDetails.destination.latitude), Number(activePass.routeDetails.destination.longitude)];
        }
        const campusStage = allRouteStages.find(s => s.isCampusDestination || (s.stageName && s.stageName.toUpperCase().includes('PYDAH')));
        if (campusStage?.latitude && campusStage?.longitude) {
            return [Number(campusStage.latitude), Number(campusStage.longitude)];
        }
        if (allRouteStages.length > 0) {
            const last = allRouteStages[allRouteStages.length - 1];
            if (last?.latitude && last?.longitude) {
                return [Number(last.latitude), Number(last.longitude)];
            }
        }
        return null;
    }, [activePass, allRouteStages]);

    // Resolve Origin Start Coordinates dynamically
    const originCoords = useMemo(() => {
        if (allRouteStages.length > 0 && allRouteStages[0]?.latitude && allRouteStages[0]?.longitude) {
            return [Number(allRouteStages[0].latitude), Number(allRouteStages[0].longitude)];
        }
        return null;
    }, [allRouteStages]);

    const campusRadius = activePass?.routeDetails?.destination?.radius || 200;

    // Stage Coordinates for OSRM Road Routing
    const stagePolyline = useMemo(() => {
        return allRouteStages.map(s => [Number(s.latitude), Number(s.longitude)]);
    }, [allRouteStages]);

    // Fetch High-Precision OSRM Road Geometry
    useEffect(() => {
        if (stagePolyline.length > 1) {
            const coordsStr = stagePolyline.map(c => `${c[1]},${c[0]}`).join(';');
            const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${coordsStr}?overview=full&geometries=geojson`;

            fetch(osrmUrl)
                .then(r => r.json())
                .then(data => {
                    if (data.code === 'Ok' && data.routes && data.routes[0]) {
                        const route = data.routes[0];
                        const roadCoords = route.geometry.coordinates.map(c => [c[1], c[0]]);
                        setRoadGeometry(roadCoords);

                        if (route.duration) {
                            const totalMins = Math.round(route.duration / 60);
                            const hrs = Math.floor(totalMins / 60);
                            const mins = totalMins % 60;
                            setRouteDuration(hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`);
                        }
                        if (route.distance) {
                            setRouteDistanceKm((route.distance / 1000).toFixed(1));
                        }
                    }
                })
                .catch(() => {
                    // Graceful fallback to stagePolyline
                });
        }
    }, [stagePolyline]);

    const activePolyline = roadGeometry && roadGeometry.length > 0 ? roadGeometry : stagePolyline;

    // Bounds covering bus, stops, and route
    const allBounds = useMemo(() => {
        if (activePolyline.length > 1) return activePolyline;
        const valid = [busCoords, stopCoords, campusCoords].filter(Boolean);
        return valid.length > 1 ? valid : null;
    }, [activePolyline, busCoords, stopCoords, campusCoords]);

    // Distance from live bus to student's boarding stop (Haversine in KM)
    const distanceBusToStop = useMemo(() => {
        if (!busCoords || !stopCoords) return null;
        const [lat1, lon1] = busCoords;
        const [lat2, lon2] = stopCoords;
        const R = 6371;
        const dLat = (lat2 - lat1) * (Math.PI / 180);
        const dLon = (lon2 - lon1) * (Math.PI / 180);
        const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return (R * c).toFixed(1);
    }, [busCoords, stopCoords]);

    // Live ETA & Expected Arrival Time to Student's Stop
    const etaToStop = useMemo(() => {
        if (!distanceBusToStop) return null;
        const dist = parseFloat(distanceBusToStop);
        if (isNaN(dist)) return null;

        const effectiveSpeed = liveSpeed >= 15 ? liveSpeed : 35;
        const minutes = Math.max(1, Math.round((dist / effectiveSpeed) * 60));

        const arrivalDate = new Date(Date.now() + minutes * 60000);
        const hours = arrivalDate.getHours();
        const mins = arrivalDate.getMinutes();
        const ampm = hours >= 12 ? 'PM' : 'AM';
        const formattedHours = hours % 12 || 12;
        const formattedMins = mins < 10 ? `0${mins}` : mins;
        const etaClock = `${formattedHours}:${formattedMins} ${ampm}`;

        return {
            minutes,
            formattedTime: minutes >= 60 ? `${Math.floor(minutes / 60)}h ${minutes % 60}m` : `${minutes} min`,
            etaClock
        };
    }, [distanceBusToStop, liveSpeed]);

    // Dynamic Stage Timing Engine for BOTH SIDES
    const getStageMetrics = (stage) => {
        const totalDistance = routeDistanceKm
            ? parseFloat(routeDistanceKm)
            : (Number(activePass?.routeDetails?.totalDistance) ||
               (allRouteStages.length > 0 && allRouteStages[allRouteStages.length - 1]?.distanceFromStart ? Number(allRouteStages[allRouteStages.length - 1].distanceFromStart) : 0) ||
               (stage.distanceFromStart ? Number(stage.distanceFromStart) * 1.5 : 30));
        const distFromStart = Number(stage.distanceFromStart) || 0;
        const distToCampus = stage.distanceToDestination != null
            ? Number(stage.distanceToDestination)
            : Math.max(0, totalDistance - distFromStart);

        const morningTravelMins = Math.round((distFromStart / 35) * 60);
        const morningScheduledTime = addMinutesToTimeStr(MORNING_ORIGIN_START_TIME, morningTravelMins);
        const morningTravelTimeStr = morningTravelMins >= 60
            ? `${Math.floor(morningTravelMins / 60)}h ${morningTravelMins % 60}m`
            : `${morningTravelMins}m`;

        const eveningTravelMins = Math.round((distToCampus / 35) * 60);
        const eveningScheduledTime = addMinutesToTimeStr(EVENING_CAMPUS_START_TIME, eveningTravelMins);
        const eveningTravelTimeStr = eveningTravelMins >= 60
            ? `${Math.floor(eveningTravelMins / 60)}h ${eveningTravelMins % 60}m`
            : `${eveningTravelMins}m`;

        return {
            morningScheduledTime,
            morningTravelTimeStr,
            eveningScheduledTime,
            eveningTravelTimeStr,
            distFromStart: distFromStart.toFixed(1),
            distToCampus: distToCampus.toFixed(1)
        };
    };

    // Calculate Student's Own Scheduled Timings for Both Sides dynamically
    const studentStopMetrics = useMemo(() => {
        if (!studentStage) {
            return {
                morningTime: '--',
                morningMins: '',
                eveningTime: '--',
                eveningMins: ''
            };
        }
        const metrics = getStageMetrics(studentStage);
        return {
            morningTime: metrics.morningScheduledTime,
            morningMins: metrics.morningTravelTimeStr,
            eveningTime: metrics.eveningScheduledTime,
            eveningMins: metrics.eveningTravelTimeStr
        };
    }, [studentStage, routeDistanceKm, allRouteStages]);

    // Leaflet Custom Icons (Clean Light Portal Theme)
    // 1. Live GPS Bus Marker (High Visibility Movement Radar)
    const busIcon = useMemo(() => {
        const speed = liveSpeed;
        const heading = busHeading;
        const busNum = activePass?.busId || liveBusData?.busNumber || activePass?.busDetails?.busNumber || 'Assigned Bus';

        return L.divIcon({
            className: 'clean-leaflet-marker',
            html: `
                <div style="position:relative;width:56px;height:56px;display:flex;align-items:center;justify-content:center;">
                    <!-- Concentric Radar Pulse Waves when in Movement -->
                    ${isMoving ? `
                    <div style="position:absolute;inset:-8px;border-radius:50%;background:var(--success);opacity:0.35;animation:ping 1.3s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
                    <div style="position:absolute;inset:-3px;border-radius:50%;background:var(--primary);opacity:0.25;animation:ping 2s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
                    ` : `
                    <div style="position:absolute;inset:-4px;border-radius:50%;background:var(--primary);opacity:0.2;animation:pulse 2s infinite;"></div>
                    `}

                    <!-- Main Bus Round Icon -->
                    <div style="position:relative;width:40px;height:40px;border-radius:50%;background:${isMoving ? 'var(--success)' : 'var(--primary)'};color:var(--surface);display:flex;align-items:center;justify-content:center;box-shadow:0 4px 14px rgba(0,0,0,0.25);border:2.5px solid var(--surface);">
                        <svg width="20" height="20" fill="currentColor" viewBox="0 0 24 24"><path d="M4 16c0 .88.39 1.67 1 2.22V20c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h8v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1.78c.61-.55 1-1.34 1-2.22V6c0-3.5-3.58-4-8-4s-8 .5-8 4v10zm3.5 1c-.83 0-1.5-.67-1.5-1.5S6.67 14 7.5 14s1.5.67 1.5 1.5S8.33 17 7.5 17zm9 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm1.5-6H6V6h12v5z"/></svg>

                        <!-- Heading Compass Direction Pointer -->
                        ${heading > 0 ? `
                        <div style="position:absolute;top:-6px;right:-6px;width:18px;height:18px;border-radius:50%;background:var(--info);border:1.5px solid var(--surface);display:flex;align-items:center;justify-content:center;transform:rotate(${heading}deg);box-shadow:0 2px 5px rgba(0,0,0,0.2);">
                            <svg width="10" height="10" fill="var(--surface)" viewBox="0 0 24 24"><path d="M12 2L4.5 20.29l.71.71L12 18l6.79 3 .71-.71z"/></svg>
                        </div>` : ''}
                    </div>
                </div>
            `,
            iconSize: [56, 56],
            iconAnchor: [28, 28],
            popupAnchor: [0, -30]
        });
    }, [liveBusData, activePass, isMoving, liveSpeed, busHeading]);

    // 2. Student Boarding Stop Beacon (Emerald with Circular Point & Timings)
    const stopIcon = useMemo(() => {
        const stopName = activePass?.stopName || studentStage?.stageName || 'Boarding Stop';

        return L.divIcon({
            className: 'clean-leaflet-marker',
            html: `
                <div style="position:relative;width:46px;height:46px;display:flex;align-items:center;justify-content:center;">
                    <div style="position:absolute;inset:-6px;border-radius:50%;background:var(--success);opacity:0.35;animation:pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;"></div>
                    <div style="position:relative;width:36px;height:36px;border-radius:50%;background:var(--success);color:var(--surface);display:flex;align-items:center;justify-content:center;box-shadow:0 4px 14px rgba(0,0,0,0.25);border:2.5px solid var(--surface);">
                        <svg width="19" height="19" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>
                    </div>
                </div>
            `,
            iconSize: [46, 46],
            iconAnchor: [23, 23],
            popupAnchor: [0, -25]
        });
    }, [activePass, studentStage, studentStopMetrics]);

    // 3. Final Destination: College Campus Icon
    const campusIcon = useMemo(() => {
        const campusName = activePass?.routeDetails?.destination?.name || 'Campus Gate';

        return L.divIcon({
            className: 'clean-leaflet-marker',
            html: `
                <div style="position:relative;width:46px;height:46px;display:flex;align-items:center;justify-content:center;">
                    <div style="position:relative;width:36px;height:36px;border-radius:50%;background:var(--secondary);color:var(--surface);display:flex;align-items:center;justify-content:center;box-shadow:0 4px 14px rgba(0,0,0,0.25);border:2.5px solid var(--surface);">
                        <svg width="20" height="20" fill="currentColor" viewBox="0 0 24 24"><path d="M12 3L1 9l11 6 9-4.91V17h2V9M5 13.18v4L12 21l7-3.82v-4L12 17l-7-3.82z"/></svg>
                    </div>
                </div>
            `,
            iconSize: [46, 46],
            iconAnchor: [23, 23],
            popupAnchor: [0, -25]
        });
    }, [activePass]);

    // 4. Origin Start Stop Icon
    const originIcon = useMemo(() => {
        const originName = activePass?.routeDetails?.startPoint || allRouteStages[0]?.stageName || 'Route Origin';

        return L.divIcon({
            className: 'clean-leaflet-marker',
            html: `
                <div style="position:relative;width:38px;height:38px;display:flex;align-items:center;justify-content:center;">
                    <div style="position:relative;width:30px;height:30px;border-radius:50%;background:var(--info);color:var(--surface);display:flex;align-items:center;justify-content:center;box-shadow:0 3px 10px rgba(0,0,0,0.22);border:2px solid var(--surface);">
                        <svg width="15" height="15" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>
                    </div>
                </div>
            `,
            iconSize: [38, 38],
            iconAnchor: [19, 19],
            popupAnchor: [0, -20]
        });
    }, [activePass, allRouteStages]);

    // 5. Clean Circular Milestone Pin (Tiny pristine circular nodes, uncluttered on mobile)
    const createStagePointIcon = (stageNumber, metrics, showTimeBadge) => {
        return L.divIcon({
            className: 'clean-leaflet-marker',
            html: `
                <div style="display:flex;flex-direction:column;align-items:center;cursor:pointer;">
                    <div style="width:16px;height:16px;border-radius:50%;background:var(--primary);color:var(--surface);font-size:8.5px;font-weight:900;display:flex;align-items:center;justify-content:center;box-shadow:0 1px 4px rgba(0,0,0,0.3);border:1.5px solid var(--surface);">
                        ${stageNumber}
                    </div>
                </div>
            `,
            iconSize: [16, 16],
            iconAnchor: [8, 8],
            popupAnchor: [0, -10]
        });
    };

    const handleLocateStage = (coords) => {
        setCustomFocusCoords(coords);
        setMapFocus('custom');
        setShowFullRouteModal(false);
    };

    if (loading) {
        return (
            <div className="max-w-7xl mx-auto space-y-4 animate-pulse p-3 sm:p-4">
                <div className="bg-surface rounded-2xl p-4 border border-border space-y-3">
                    <div className="flex justify-between items-center">
                        <SkeletonBox height="h-6" width="w-36" />
                        <SkeletonBox height="h-5" width="w-20" className="rounded-full" />
                    </div>
                    <SkeletonBox height="h-4" width="w-56" />
                </div>
                <div className="bg-surface rounded-2xl p-4 border border-border space-y-3 min-h-[350px]">
                    <SkeletonBox height="h-full" className="w-full min-h-[320px] rounded-xl" />
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-7xl mx-auto flex flex-col h-[calc(100vh-100px)] lg:h-[calc(100vh-60px)] space-y-2.5 animate-fade-in pb-0">
            <style>{customMapStyles}</style>

            {hasActivePass ? (
                <>
                    {/* TOP UNIFIED TRANSIT PASS CARD */}
                    <div className="bg-surface rounded-2xl p-3 sm:p-4 shadow-sm border border-border space-y-2.5">
                        {/* Header Row: Active Pass & Live GPS Signal */}
                        <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                                <h1 className="text-lg font-bold text-main">Transport Pass</h1>
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[var(--success-light)] text-success border border-[var(--success-light)]">
                                    <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse"></span>
                                    Active
                                </span>
                            </div>
                            <div className="flex items-center gap-1.5 text-[11px] text-muted-text font-medium">
                                <span className="w-2 h-2 rounded-full bg-success animate-ping"></span>
                                <span className="text-success font-semibold">Live GPS</span>
                                <span>•</span>
                                <span className="font-mono">{lastPingTime}</span>
                            </div>
                        </div>

                        {/* Route Corridor Ribbon */}
                        <div className="flex items-center justify-between gap-2 p-2 rounded-xl bg-background border border-border text-xs">
                            <div className="flex items-center gap-2 min-w-0 flex-1">
                                {activePass.routeId && (
                                    <span className="px-2 py-0.5 rounded bg-primary text-white font-black text-[11px] shrink-0">
                                        {activePass.routeId}
                                    </span>
                                )}
                                <span className="font-bold text-main truncate text-xs sm:text-sm" title={activePass.routeName || activePass.routeDetails?.routeName}>
                                    {activePass.routeName || activePass.routeDetails?.routeName || (activePass.routeId ? `Route ${activePass.routeId}` : 'Assigned Route')}
                                </span>
                            </div>
                            <button
                                onClick={() => setShowFullRouteModal(true)}
                                className="px-2.5 py-1 bg-surface hover:bg-[var(--primary-light)] text-primary font-bold text-[11px] rounded-lg border border-[var(--primary-light)] shadow-sm shrink-0 transition-all flex items-center gap-1 active:scale-95"
                            >
                                <RiRouteFill size={13} />
                                <span>{allRouteStages.length} Stops</span>
                            </button>
                        </div>

                        {/* LIVE BUS MOVEMENT & REAL-TIME DYNAMIC TIMINGS BAR (CLEAN LIGHT PORTAL THEME) */}
                        <div className={`p-3 rounded-xl border transition-all ${
                            isMoving
                                ? 'bg-gradient-to-r from-[var(--success-light)] via-[var(--primary-light)] to-[var(--success-light)] border-[var(--success-light)] shadow-xs'
                                : 'bg-[var(--background)]/90 border-border text-main'
                        }`}>
                            <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2.5 min-w-0">
                                    <div className={`w-10 h-10 rounded-full flex flex-col items-center justify-center shrink-0 shadow-sm border-2 ${
                                        isMoving
                                            ? 'border-success bg-[var(--success-light)] text-success'
                                            : 'border-border-strong bg-background text-muted-text'
                                    }`}>
                                        <span className="font-black text-sm leading-none">{isMoving ? liveSpeed : '0'}</span>
                                        <span className="text-[7px] font-black uppercase mt-0.5">km/h</span>
                                    </div>
                                    <div className="min-w-0 flex flex-col justify-center">
                                        <div className="flex items-center gap-2 mb-0.5">
                                            <span className={`flex items-center gap-1.5 text-[11px] font-black uppercase tracking-widest ${
                                                isMoving ? 'text-success' : 'text-warning'
                                            }`}>
                                                {isMoving ? (
                                                    <>
                                                        <span className="w-1.5 h-1.5 rounded-full bg-success animate-ping"></span>
                                                        IN MOTION
                                                    </>
                                                ) : (
                                                    <>
                                                        <span className="w-1.5 h-1.5 rounded-full bg-warning"></span>
                                                        STATIONARY
                                                    </>
                                                )}
                                            </span>
                                        </div>
                                        <div className="text-[11px] sm:text-xs font-semibold text-sub truncate">
                                            {isMoving
                                                ? `Heading to ${activePass.stopName || studentStage?.stageName || 'stop'}`
                                                : `Parked • Engine ${ignitionActive ? 'ON' : 'OFF'}`
                                            }
                                        </div>
                                    </div>
                                </div>

                                {/* Dynamic Real-Time Timings Countdown */}
                                <div className="text-right shrink-0">
                                    {etaToStop ? (
                                        <>
                                            <div className={`font-mono font-black text-sm sm:text-base leading-none ${isMoving ? 'text-success' : 'text-muted-text'}`}>
                                                ETA: {isMoving ? `~${etaToStop.etaClock}` : '--'}
                                            </div>
                                            <div className="text-[10px] font-semibold text-muted-text mt-0.5">
                                                {isMoving ? `${etaToStop.formattedTime} (${distanceBusToStop || '--'} km)` : '--'}
                                            </div>
                                        </>
                                    ) : (
                                        <span className="text-xs text-muted-text font-medium">Calculating...</span>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* 2 Clean Structured Stat Cards (Boarding Stop & Live Bus) */}
                        <div className="grid grid-cols-2 gap-2 text-xs">
                            {/* Boarding Stop Card */}
                            <div className="p-2.5 rounded-xl bg-[var(--success-light)] border border-[var(--success-light)] flex flex-col justify-between">
                                <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-success">
                                    <span>Boarding Stop</span>
                                    <RiMapPin2Fill size={14} className="text-success" />
                                </div>
                                <div className="font-black text-success text-sm sm:text-base truncate mt-0.5">
                                    {activePass.stopName || studentStage?.stageName || 'Assigned Stop'}
                                </div>
                                <div className="text-[10px] font-medium text-success mt-1 flex items-center gap-1 truncate">
                                    <span>{studentStageIndex ? `Stage #${studentStageIndex}` : 'Your Stop'}</span>
                                    {distanceBusToStop && (
                                        <>
                                            <span>•</span>
                                            <span className="font-bold">~{distanceBusToStop} km away</span>
                                        </>
                                    )}
                                </div>
                            </div>

                            {/* Assigned Bus Card */}
                            <div className="p-2.5 rounded-xl bg-[var(--primary-light)] border border-[var(--primary-light)] flex flex-col justify-between">
                                <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-primary">
                                    <span>Assigned Bus</span>
                                    <RiBusFill size={14} className="text-primary" />
                                </div>
                                <div className="font-black text-primary text-sm sm:text-base truncate mt-0.5">
                                    {activePass.busId || liveBusData?.busNumber || activePass?.busDetails?.busNumber || 'Assigned Bus'}
                                </div>
                                <div className="text-[10px] font-medium text-primary mt-1 flex items-center gap-1 truncate">
                                    <span className={`px-1.5 py-0.2 rounded font-bold uppercase text-[9px] ${
                                        isMoving
                                            ? 'bg-[var(--success-light)] text-success font-black'
                                            : 'bg-[var(--warning-light)] text-warning font-semibold'
                                    }`}>
                                        {isMoving ? `Moving (${liveSpeed}k)` : (liveBusData?.location?.status || 'Stopped')}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* ADVANCED GOOGLE MAPS HYBRID LIVE TRACKING & NAVIGATION VIEW */}
                    <div className="bg-surface rounded-2xl overflow-hidden shadow-sm border border-border relative flex-1 flex flex-col min-h-0">
                        {/* MAP QUICK ACTION BUTTONS (CLEAN BOTTOM-CENTER PILL BAR, ZERO OVERLAP) */}
                        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-[1000] flex items-center gap-1 bg-[var(--surface)]/95 backdrop-blur-md px-2 py-1 rounded-2xl shadow-xl border border-border">
                            <button
                                onClick={() => setMapFocus('bus')}
                                className="px-2.5 py-1 bg-[var(--primary-light)] hover:bg-[var(--primary-light)] text-primary text-xs font-bold rounded-xl flex items-center gap-1 transition-all active:scale-95"
                                title="Center on Live Bus"
                            >
                                <RiBusFill size={13} />
                                <span>Bus</span>
                            </button>
                            <button
                                onClick={() => setMapFocus('stop')}
                                className="px-2.5 py-1 bg-[var(--success-light)] hover:bg-[var(--success-light)] text-success text-xs font-bold rounded-xl flex items-center gap-1 transition-all active:scale-95"
                                title="Center on My Boarding Stop"
                            >
                                <RiMapPin2Fill size={13} />
                                <span>Stop</span>
                            </button>
                            <button
                                onClick={() => setMapFocus('campus')}
                                className="px-2.5 py-1 bg-[var(--primary-light)] hover:bg-[var(--primary-light)] text-secondary text-xs font-bold rounded-xl flex items-center gap-1 transition-all active:scale-95"
                                title="Center on Final Destination (Campus)"
                            >
                                <RiBuilding2Fill size={13} />
                                <span>Campus</span>
                            </button>
                            <button
                                onClick={() => setMapFocus('fit')}
                                className="px-2.5 py-1 bg-background hover:bg-background text-sub text-xs font-bold rounded-xl flex items-center gap-1 transition-all active:scale-95"
                                title="Fit Entire Route"
                            >
                                <RiCrosshair2Line size={13} />
                                <span>Fit</span>
                            </button>
                        </div>

                        {/* MAP CONTAINER (Full Height, completely uncluttered) */}
                        <div className="flex-1 w-full relative min-h-[250px]">
                            <MapContainer
                                center={stopCoords}
                                zoom={13}
                                scrollWheelZoom={true}
                                preferCanvas={true}
                                className="absolute inset-0 z-0"
                            >
                                <LayersControl position="bottomleft">
                                    <LayersControl.BaseLayer checked name="Satellite Hybrid">
                                        <TileLayer
                                            url="https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}"
                                            maxZoom={20}
                                            subdomains={['mt0', 'mt1', 'mt2', 'mt3']}
                                            attribution="&copy; Google Maps Hybrid"
                                        />
                                    </LayersControl.BaseLayer>
                                    <LayersControl.BaseLayer name="Street View">
                                        <TileLayer
                                            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                                            maxZoom={19}
                                            attribution="&copy; OpenStreetMap"
                                        />
                                    </LayersControl.BaseLayer>
                                    <LayersControl.BaseLayer name="Carto Clean">
                                        <TileLayer
                                            url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
                                            maxZoom={20}
                                            attribution="&copy; CARTO"
                                        />
                                    </LayersControl.BaseLayer>
                                </LayersControl>

                                <MapViewController
                                    targetCoords={
                                        mapFocus === 'bus'
                                            ? busCoords
                                            : mapFocus === 'stop'
                                            ? stopCoords
                                            : mapFocus === 'campus'
                                            ? campusCoords
                                            : mapFocus === 'custom'
                                            ? customFocusCoords
                                            : null
                                    }
                                    zoom={mapFocus === 'bus' ? 16 : 14}
                                    bounds={mapFocus === 'fit' ? allBounds : null}
                                />

                                {/* High-Precision Road Corridor Route Line */}
                                {activePolyline.length > 1 && (
                                    <>
                                        <Polyline
                                            positions={activePolyline}
                                            pathOptions={{ color: 'var(--info)', weight: 6.5, opacity: 0.45 }}
                                            smoothFactor={2}
                                            interactive={false}
                                        />
                                        <Polyline
                                            positions={activePolyline}
                                            pathOptions={{ color: 'var(--primary)', weight: 3.5, opacity: 0.95 }}
                                            smoothFactor={2}
                                            interactive={false}
                                        />
                                    </>
                                )}

                                {/* Campus Final Destination 200m Arrival Radius Circle */}
                                {campusCoords && (
                                    <Circle
                                        center={campusCoords}
                                        radius={campusRadius}
                                        interactive={false}
                                        pathOptions={{
                                            color: 'var(--secondary)',
                                            fillColor: 'var(--primary)',
                                            fillOpacity: 0.22,
                                            weight: 2,
                                            dashArray: '4, 4'
                                        }}
                                    />
                                )}

                                {/* 1. Route Origin Marker */}
                                {originCoords && (
                                    <Marker position={originCoords} icon={originIcon}>
                                        <Popup>
                                            <div className="p-1.5 space-y-1 text-xs">
                                                <div className="font-bold text-primary">
                                                    🚩 Route Origin: {allRouteStages[0]?.stageName || activePass?.routeDetails?.startPoint || 'Route Origin'}
                                                </div>
                                                <p className="text-sub">
                                                    <strong>Morning Start:</strong> {MORNING_ORIGIN_START_TIME}
                                                </p>
                                                {allRouteStages.length > 0 && (
                                                    <p className="text-sub">
                                                        <strong>Evening Terminus:</strong> ~{getStageMetrics(allRouteStages[0]).eveningScheduledTime}
                                                    </p>
                                                )}
                                                <p className="text-muted-text">Commencement point • 0 KM</p>
                                            </div>
                                        </Popup>
                                    </Marker>
                                )}

                                {/* 2. Student's Designated Boarding Stop Marker */}
                                {stopCoords && (
                                    <Marker position={stopCoords} icon={stopIcon}>
                                        <Popup>
                                            <div className="p-2 space-y-1 text-xs min-w-[210px]">
                                                <div className="font-bold text-success flex items-center gap-1 border-b border-border pb-1">
                                                    <RiMapPin2Fill size={15} />
                                                    <span>Your Boarding Stop: {activePass.stopName || studentStage?.stageName}</span>
                                                </div>
                                                <div className="bg-[var(--success-light)] p-2 rounded-xl border border-[var(--success-light)] space-y-1 text-success">
                                                    <p className="font-bold flex items-center justify-between">
                                                        <span>🌅 Morning Pickup:</span>
                                                        <span className="font-mono text-success">~{studentStopMetrics.morningTime}</span>
                                                    </p>
                                                    <p className="font-bold flex items-center justify-between">
                                                        <span>🌇 Evening Drop:</span>
                                                        <span className="font-mono text-success">~{studentStopMetrics.eveningTime}</span>
                                                    </p>
                                                </div>
                                                {etaToStop && (
                                                    <p className="text-primary font-bold pt-0.5">
                                                        Live GPS ETA: ~{etaToStop?.etaClock} ({etaToStop?.formattedTime})
                                                    </p>
                                                )}
                                                <p className="text-muted-text text-[11px]">
                                                    Distance: {studentStage?.distanceFromStart != null ? `${studentStage.distanceFromStart} KM from start` : 'Assigned Route Stop'}
                                                    {studentStage?.distanceToDestination != null ? ` • ${studentStage.distanceToDestination} KM to campus` : ''}
                                                </p>
                                            </div>
                                        </Popup>
                                    </Marker>
                                )}

                                {/* 3. Final Destination: Campus Gate Marker */}
                                {campusCoords && (
                                    <Marker position={campusCoords} icon={campusIcon}>
                                        <Popup>
                                            <div className="p-2 space-y-1 text-xs min-w-[210px]">
                                                <div className="font-bold text-secondary flex items-center gap-1 border-b border-border pb-1">
                                                    <RiBuilding2Fill size={15} />
                                                    <span>🏁 Final Destination: {activePass?.routeDetails?.destination?.name || 'Campus Gate'}</span>
                                                </div>
                                                <div className="bg-[var(--primary-light)] p-2 rounded-xl border border-[var(--primary-light)] space-y-1 text-secondary">
                                                    <p className="font-bold flex items-center justify-between">
                                                        <span>🌅 Morning Arrival:</span>
                                                        <span className="font-mono text-secondary">~{MORNING_CAMPUS_END_TIME}</span>
                                                    </p>
                                                    <p className="font-bold flex items-center justify-between">
                                                        <span>🌇 Evening Dispersal:</span>
                                                        <span className="font-mono text-secondary">{EVENING_CAMPUS_START_TIME}</span>
                                                    </p>
                                                </div>
                                                <p className="text-muted-text text-[11px]">
                                                    Total Route: {routeDistanceKm || activePass?.routeDetails?.totalDistance || '--'} KM • Geofence: {campusRadius}m radius
                                                </p>
                                            </div>
                                        </Popup>
                                    </Marker>
                                )}

                                {/* 4. ALL INTERMEDIATE STOPS (Tiny nodes to show the path) */}
                                {allRouteStages.map((stage, idx) => {
                                    const isStudentStop = activePass?.stopName && stage.stageName?.trim().toLowerCase() === activePass.stopName.trim().toLowerCase();
                                    const isOrigin = idx === 0;
                                    const isCampus = stage.isCampusDestination || (idx === allRouteStages.length - 1 && stage.stageName?.toUpperCase().includes('PYDAH'));

                                    if (isStudentStop || isOrigin || isCampus) return null;

                                    const metrics = getStageMetrics(stage);

                                    return (
                                        <Marker
                                            key={`stage_point_${idx}`}
                                            position={[Number(stage.latitude), Number(stage.longitude)]}
                                            icon={createStagePointIcon(idx + 1, metrics, false)}
                                        >
                                            <Popup>
                                                <div className="p-1.5 text-xs space-y-1.5 min-w-[190px]">
                                                    <div className="font-bold text-primary text-sm border-b border-border pb-0.5">
                                                        Stage #{idx + 1}: {stage.stageName}
                                                    </div>
                                                    <div className="bg-background p-1.5 rounded-lg border border-border space-y-0.5 text-main">
                                                        <div className="flex items-center justify-between font-bold text-success">
                                                            <span>🌅 Morning Pickup:</span>
                                                            <span className="font-mono">~{metrics.morningScheduledTime}</span>
                                                        </div>
                                                        <div className="flex items-center justify-between font-bold text-primary">
                                                            <span>🌇 Evening Drop:</span>
                                                            <span className="font-mono">~{metrics.eveningScheduledTime}</span>
                                                        </div>
                                                    </div>
                                                    <div className="text-muted-text text-[10px] flex items-center justify-between pt-0.5">
                                                        <span>From Start: {metrics.distFromStart} KM</span>
                                                        <span>To Campus: {metrics.distToCampus} KM</span>
                                                    </div>
                                                </div>
                                            </Popup>
                                        </Marker>
                                    );
                                })}

                                {/* 5. Live GPS Bus Marker with Enhanced Movement Radar */}
                                {busCoords && (
                                    <Marker position={busCoords} icon={busIcon}>
                                        <Popup>
                                            <div className="p-1.5 space-y-1.5 text-xs min-w-[200px]">
                                                <div className="flex items-center justify-between text-primary font-bold border-b border-border pb-1">
                                                    <div className="flex items-center gap-1.5">
                                                        <RiBusFill size={16} />
                                                        <span>Live GPS Telemetry</span>
                                                    </div>
                                                    <span className={`px-1.5 py-0.2 rounded font-bold uppercase text-[9px] ${
                                                        isMoving ? 'bg-[var(--success-light)] text-success font-black' : 'bg-[var(--warning-light)] text-warning'
                                                    }`}>
                                                        {isMoving ? 'In Motion' : 'Stopped'}
                                                    </span>
                                                </div>
                                                <p className="font-black text-main text-base">
                                                    {activePass.busId || liveBusData?.busNumber || activePass?.busDetails?.busNumber || 'Assigned Bus'}
                                                </p>
                                                
                                                <div className="grid grid-cols-2 gap-1.5 bg-background p-2 rounded-xl text-main">
                                                    <div>
                                                        <span className="text-muted-text text-[9px] uppercase font-bold block">Live Speed</span>
                                                        <span className="font-mono font-black text-sm text-primary">{liveSpeed} km/h</span>
                                                    </div>
                                                    <div>
                                                        <span className="text-muted-text text-[9px] uppercase font-bold block">Ignition</span>
                                                        <span className={`font-bold text-xs ${ignitionActive ? 'text-success' : 'text-muted-text'}`}>
                                                            {ignitionActive ? 'Engine ON' : 'Engine OFF'}
                                                        </span>
                                                    </div>
                                                </div>

                                                {etaToStop && (
                                                    <div className="text-success font-bold text-xs pt-0.5">
                                                        ETA to your stop: ~{etaToStop?.etaClock} ({etaToStop?.formattedTime})
                                                    </div>
                                                )}

                                                <div className="text-muted-text text-[10px] pt-1 border-t border-border flex items-center justify-between">
                                                    <span>Telemetry: {lastPingTime}</span>
                                                    {busHeading > 0 && <span>Heading: {busHeading}°</span>}
                                                </div>
                                            </div>
                                        </Popup>
                                    </Marker>
                                )}
                            </MapContainer>
                        </div>
                    </div>

                    {/* MODAL: FULL BUS ROUTE & STAGES TIMELINE (WITH BOTH SIDES TIMINGS) */}
                    {showFullRouteModal && (
                        <div className="fixed inset-0 z-[2000] bg-black/50 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 animate-fade-in">
                            <div className="bg-surface rounded-2xl max-w-xl w-full max-h-[85vh] flex flex-col shadow-2xl border border-border overflow-hidden">
                                {/* Modal Header */}
                                <div className="p-4 sm:px-5 bg-background border-b border-border flex items-center justify-between">
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <span className="px-2 py-0.5 rounded bg-primary text-white text-xs font-bold">
                                                {activePass.routeId}
                                            </span>
                                            <h3 className="font-bold text-main text-base">Route Schedule (Both Directions)</h3>
                                        </div>
                                        <p className="text-xs text-muted-text mt-0.5">
                                            Morning Start: <strong>{MORNING_ORIGIN_START_TIME}</strong> • Evening Dispersal: <strong>{EVENING_CAMPUS_START_TIME}</strong>
                                        </p>
                                    </div>
                                    <button
                                        onClick={() => setShowFullRouteModal(false)}
                                        className="p-1.5 rounded-lg hover:bg-background text-muted-text transition-all"
                                    >
                                        <RiCloseLine size={20} />
                                    </button>
                                </div>

                                {/* Stages List with Both Sides Timings */}
                                <div className="overflow-y-auto p-3 sm:p-4 space-y-2 divide-y divide-border">
                                    {allRouteStages.map((stage, idx) => {
                                        const isStudentStop = activePass?.stopName && stage.stageName?.trim().toLowerCase() === activePass.stopName.trim().toLowerCase();
                                        const isOrigin = idx === 0;
                                        const isCampus = stage.isCampusDestination || (idx === allRouteStages.length - 1 && stage.stageName?.toUpperCase().includes('PYDAH'));
                                        const coords = [Number(stage.latitude), Number(stage.longitude)];
                                        const metrics = getStageMetrics(stage);

                                        return (
                                            <div
                                                key={`modal_stage_${idx}`}
                                                className={`pt-2.5 first:pt-0 flex items-center justify-between gap-3 text-xs ${
                                                    isStudentStop ? 'bg-[var(--success-light)] -mx-2 px-2.5 py-2.5 rounded-xl border border-[var(--success-light)]' : ''
                                                } ${
                                                    isCampus ? 'bg-[var(--primary-light)] -mx-2 px-2.5 py-2.5 rounded-xl border border-[var(--primary-light)]' : ''
                                                }`}
                                            >
                                                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                                    <div className={`w-5 h-5 rounded-full flex items-center justify-center font-bold text-[10px] shrink-0 ${
                                                        isStudentStop
                                                            ? 'bg-success text-white'
                                                            : isCampus
                                                            ? 'bg-secondary text-white'
                                                            : isOrigin
                                                            ? 'bg-primary text-white'
                                                            : 'bg-background text-sub'
                                                    }`}>
                                                        {isCampus ? '🏁' : isOrigin ? '🚩' : idx + 1}
                                                    </div>

                                                    <div className="min-w-0 flex-1">
                                                        <div className="flex items-center gap-1.5 flex-wrap">
                                                            <span className={`font-bold text-sm ${
                                                                isStudentStop ? 'text-success font-black' : isCampus ? 'text-secondary font-black' : 'text-main'
                                                            }`}>
                                                                {stage.stageName}
                                                            </span>
                                                            {isStudentStop && (
                                                                <span className="px-1.5 py-0.2 rounded bg-success text-white text-[9px] font-bold">
                                                                    Your Stop
                                                                </span>
                                                            )}
                                                            {isCampus && (
                                                                <span className="px-1.5 py-0.2 rounded bg-secondary text-white text-[9px] font-bold">
                                                                    Final Destination
                                                                </span>
                                                            )}
                                                        </div>

                                                        {/* Both Sides Timings Row */}
                                                        <div className="grid grid-cols-2 gap-1.5 mt-1 text-xs">
                                                            <div className="bg-[var(--primary-light)] px-2 py-1 rounded text-primary font-medium">
                                                                🌅 Pickup: <strong>~{metrics.morningScheduledTime}</strong>
                                                            </div>
                                                            <div className="bg-[var(--primary-light)] px-2 py-1 rounded text-primary font-medium">
                                                                🌇 Drop: <strong>~{metrics.eveningScheduledTime}</strong>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>

                                                <button
                                                    onClick={() => handleLocateStage(coords)}
                                                    className="px-2 py-1 bg-surface hover:bg-background text-sub font-bold text-[10px] rounded-lg border border-border shadow-sm shrink-0 flex items-center gap-1 transition-all"
                                                >
                                                    <RiFocus3Line size={12} className="text-primary" />
                                                    <span>Locate</span>
                                                </button>
                                            </div>
                                        );
                                    })}
                                </div>

                                {/* Modal Footer */}
                                <div className="p-3 bg-background border-t border-border flex items-center justify-between">
                                    <span className="text-[11px] text-muted-text">Tap Locate to center on any stop</span>
                                    <button
                                        onClick={() => setShowFullRouteModal(false)}
                                        className="px-3 py-1 bg-sidebar hover:bg-sidebar text-white rounded-lg text-xs font-bold transition-all shadow-sm"
                                    >
                                        Close
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </>
            ) : (
                /* Empty / Inactive Fallback */
                <div className="bg-surface rounded-3xl p-10 sm:p-14 text-center shadow-sm border border-border max-w-xl mx-auto space-y-4">
                    <div className="w-16 h-16 rounded-2xl bg-background text-muted-text flex items-center justify-center mx-auto">
                        <RiBusFill size={32} />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-main">No Active Transport Pass</h2>
                        <p className="text-sm text-muted-text mt-1 leading-relaxed">
                            No active transport pass found for admission number{' '}
                            <span className="font-semibold text-main">{user?.admission_number || '–'}</span>.
                        </p>
                    </div>
                    <div className="p-4 rounded-2xl bg-[var(--warning-light)] border border-[var(--warning-light)] text-warning text-xs text-left">
                        <p className="font-bold">Need Transport Facility?</p>
                        <p className="mt-0.5 text-warning">
                            If you recently availed college bus transport, please contact the transport department to activate your pass.
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Transport;
