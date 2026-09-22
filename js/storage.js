/**
 * storage.js
 * ──────────
 * All localStorage read/write helpers for the Vehicle Service Tracker.
 * Every other script calls these functions — no other file touches
 * localStorage directly.
 *
 * ── Storage keys ──────────────────────────────────────────────────────────
 *   vehicles        →  Array of vehicle objects
 *   serviceRecords  →  Array of service records
 *
 * ── Vehicle schema ────────────────────────────────────────────────────────
 *   {
 *     id              string   unique identifier
 *     name            string   friendly display name  e.g. "My Camry"
 *     make            string   manufacturer           e.g. "Toyota"
 *     model           string   model name             e.g. "Camry"
 *     vehicleType     string   "Car" | "Truck" | "SUV" | "Motorcycle" |
 *                              "Van" | "Bus" | "Other"
 *     year            string   manufacturing year     e.g. "2019"
 *     registrationNo  string   registration / plate   e.g. "ABC-1234"
 *     odometer        number   current km reading
 *     purchaseDate    string   ISO date "YYYY-MM-DD"
 *     lastServiceDate string   ISO date "YYYY-MM-DD"  (optional)
 *     nextServiceDate string   ISO date "YYYY-MM-DD"  (optional)
 *     color           string
 *     notes           string
 *     createdAt       string   ISO timestamp
 *   }
 *
 * ── Service record schema ─────────────────────────────────────────────────
 *   {
 *     id               string   unique identifier
 *     vehicleId        string   reference to vehicle
 *     serviceDate      string   ISO date "YYYY-MM-DD"
 *     odometerReading  number   km at time of service
 *     serviceType      string   from SERVICE_TYPES
 *     description      string   service description
 *     partsReplaced    string   parts that were replaced
 *     serviceCenter    string   mechanic/service center name
 *     laborCost        number   labor cost
 *     partsCost        number   parts cost
 *     totalCost        number   laborCost + partsCost (calculated)
 *     nextServiceDate  string   ISO date "YYYY-MM-DD" (optional)
 *     nextServiceKM    number   next service odometer reading (optional)
 *     notes            string   additional notes
 *     createdAt        string   ISO timestamp
 *   }
 */

// ─── Keys ────────────────────────────────────────────────────────────────────
const KEYS = {
  VEHICLES: 'vehicles',
  SERVICES: 'serviceRecords',  // as requested
};

// ─── ID generator ────────────────────────────────────────────────────────────
function generateId() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

// ─── Generic read / write ────────────────────────────────────────────────────
function getList(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.error('storage.getList: failed to parse', key, e);
    return [];
  }
}

function setList(key, list) {
  localStorage.setItem(key, JSON.stringify(list));
}

// ─── VEHICLES ────────────────────────────────────────────────────────────────

/** Return all vehicles. */
function getVehicles() {
  return getList(KEYS.VEHICLES);
}

/**
 * Return a single vehicle by id, or null.
 * @param {string} id
 */
function getVehicleById(id) {
  return getVehicles().find(v => v.id === id) || null;
}

/**
 * Save a new vehicle. Assigns id + createdAt automatically.
 * @param {Object} data
 * @returns {Object} saved vehicle
 */
function addVehicle(data) {
  const vehicles = getVehicles();
  const vehicle  = buildVehicleObject(generateId(), data, new Date().toISOString());
  vehicles.push(vehicle);
  setList(KEYS.VEHICLES, vehicles);
  return vehicle;
}

/**
 * Update an existing vehicle. id and createdAt are preserved.
 * @param {string} id
 * @param {Object} updates
 * @returns {Object|null}
 */
function updateVehicle(id, updates) {
  const vehicles = getVehicles();
  const index    = vehicles.findIndex(v => v.id === id);
  if (index === -1) return null;

  // Merge, then re-normalise through the same builder so types stay consistent
  const merged = { ...vehicles[index], ...updates };
  vehicles[index] = buildVehicleObject(id, merged, vehicles[index].createdAt);
  setList(KEYS.VEHICLES, vehicles);
  return vehicles[index];
}

/**
 * Delete a vehicle AND all its service records.
 * @param {string} id
 * @returns {boolean}
 */
function deleteVehicle(id) {
  const vehicles = getVehicles();
  const filtered = vehicles.filter(v => v.id !== id);
  if (filtered.length === vehicles.length) return false;
  setList(KEYS.VEHICLES, filtered);
  // Cascade-delete service records
  const services = getServices().filter(s => s.vehicleId !== id);
  setList(KEYS.SERVICES, services);
  return true;
}

/**
 * Internal helper — normalises a raw data object into a clean vehicle record.
 * Keeps all field names and types consistent regardless of the caller.
 * @param {string} id
 * @param {Object} data
 * @param {string} createdAt  ISO timestamp
 * @returns {Object}
 */
function buildVehicleObject(id, data, createdAt) {
  return {
    id,
    name:            (data.name            || '').trim(),
    make:            (data.make            || '').trim(),
    model:           (data.model           || '').trim(),
    vehicleType:     (data.vehicleType     || 'Car').trim(),
    year:            (data.year            || '').toString().trim(),
    registrationNo:  (data.registrationNo  || data.licensePlate || '').trim(),
    odometer:        data.odometer  !== undefined && data.odometer !== ''
                       ? Number(data.odometer)  : null,
    purchaseDate:    (data.purchaseDate    || '').trim(),
    lastServiceDate: (data.lastServiceDate || '').trim(),
    nextServiceDate: (data.nextServiceDate || '').trim(),
    color:           (data.color           || '').trim(),
    notes:           (data.notes           || '').trim(),
    createdAt,
  };
}

// ─── SERVICE RECORDS ─────────────────────────────────────────────────────────

/** Return all service records. */
function getServices() {
  return getList(KEYS.SERVICES);
}

/**
 * Return service records for one vehicle, sorted newest-first.
 * @param {string} vehicleId
 */
function getServicesByVehicle(vehicleId) {
  return getServices()
    .filter(s => s.vehicleId === vehicleId)
    .sort((a, b) => new Date(b.serviceDate || b.date || 0) - new Date(a.serviceDate || a.date || 0));
}

/**
 * Get total service cost for a vehicle.
 * @param {string} vehicleId
 * @returns {number}
 */
function getTotalServiceCost(vehicleId) {
  return getServicesByVehicle(vehicleId)
    .reduce((sum, s) => sum + (s.totalCost || s.cost || 0), 0);
}

/**
 * Get latest service record for a vehicle.
 * @param {string} vehicleId
 * @returns {Object|null}
 */
function getLatestService(vehicleId) {
  const services = getServicesByVehicle(vehicleId);
  return services.length > 0 ? services[0] : null;
}

/**
 * Get next scheduled service for a vehicle (earliest nextServiceDate).
 * @param {string} vehicleId
 * @returns {Object|null}
 */
function getNextScheduledService(vehicleId) {
  const services = getServicesByVehicle(vehicleId)
    .filter(s => s.nextServiceDate)
    .sort((a, b) => new Date(a.nextServiceDate) - new Date(b.nextServiceDate));
  return services.length > 0 ? services[0] : null;
}

/** Return one service record by id, or null. */
function getServiceById(id) {
  return getServices().find(s => s.id === id) || null;
}

/**
 * Save a new service record.
 * @param {Object} data
 * @returns {Object}
 */
function addService(data) {
  const services = getServices();
  const record   = buildServiceObject(generateId(), data, new Date().toISOString());
  services.push(record);
  setList(KEYS.SERVICES, services);
  return record;
}

/**
 * Update an existing service record.
 * @param {string} id
 * @param {Object} updates
 * @returns {Object|null}
 */
function updateService(id, updates) {
  const services = getServices();
  const index    = services.findIndex(s => s.id === id);
  if (index === -1) return null;

  const merged = { ...services[index], ...updates };
  services[index] = buildServiceObject(id, merged, services[index].createdAt);
  setList(KEYS.SERVICES, services);
  return services[index];
}

/**
 * Internal helper — normalises service record data.
 * @param {string} id
 * @param {Object} data
 * @param {string} createdAt
 * @returns {Object}
 */
function buildServiceObject(id, data, createdAt) {
  const laborCost = data.laborCost !== undefined && data.laborCost !== '' 
    ? Number(data.laborCost) : 0;
  const partsCost = data.partsCost !== undefined && data.partsCost !== '' 
    ? Number(data.partsCost) : 0;
  const totalCost = laborCost + partsCost;

  return {
    id,
    vehicleId:       data.vehicleId || '',
    serviceDate:     (data.serviceDate || data.date || '').trim(),
    odometerReading: data.odometerReading !== undefined && data.odometerReading !== ''
                       ? Number(data.odometerReading) : (data.mileage ? Number(data.mileage) : null),
    serviceType:     (data.serviceType || data.type || '').trim(),
    description:     (data.description || '').trim(),
    partsReplaced:   (data.partsReplaced || '').trim(),
    serviceCenter:   (data.serviceCenter || data.shop || '').trim(),
    laborCost,
    partsCost,
    totalCost,
    nextServiceDate: (data.nextServiceDate || '').trim(),
    nextServiceKM:   data.nextServiceKM !== undefined && data.nextServiceKM !== ''
                       ? Number(data.nextServiceKM) : null,
    notes:           (data.notes || '').trim(),
    createdAt,
  };
}

/**
 * Delete a single service record.
 * @param {string} id
 * @returns {boolean}
 */
function deleteService(id) {
  const services = getServices();
  const filtered = services.filter(s => s.id !== id);
  if (filtered.length === services.length) return false;
  setList(KEYS.SERVICES, filtered);
  return true;
}

// ─── DASHBOARD SUMMARY ───────────────────────────────────────────────────────

/**
 * Returns summary data for the dashboard.
 * @returns {{ totalVehicles, totalServices, totalSpent, recentServices }}
 */
function getSummary() {
  const vehicles       = getVehicles();
  const services       = getServices();
  const totalSpent     = services.reduce((sum, s) => sum + (s.totalCost || s.cost || 0), 0);
  const recentServices = [...services]
    .sort((a, b) => new Date(b.serviceDate || b.date || 0) - new Date(a.serviceDate || a.date || 0))
    .slice(0, 5);

  return { totalVehicles: vehicles.length, totalServices: services.length, totalSpent, recentServices };
}

// ─── SERVICE TYPES ───────────────────────────────────────────────────────────

/** Canonical list of service types. */
const SERVICE_TYPES = [
  'Regular Service',
  'Oil Change',
  'Brake Service',
  'Tire Service',
  'Battery Replacement',
  'Engine Service',
  'AC Service',
  'Electrical Service',
  'Other'
];

// ─── VEHICLE TYPES ───────────────────────────────────────────────────────────

/** Canonical list of vehicle types used in forms and filters. */
const VEHICLE_TYPES = ['Car', 'Truck', 'SUV', 'Motorcycle', 'Van', 'Bus', 'Other'];

// ─── SEED DATA ───────────────────────────────────────────────────────────────

/**
 * Populate localStorage with sample data on first open.
 * Only runs when the vehicles array is empty.
 */
function seedSampleData() {
  if (getVehicles().length > 0) return;

  const v1 = addVehicle({
    name: 'Family Camry', make: 'Toyota', model: 'Camry',
    vehicleType: 'Car',  year: '2019',
    registrationNo: 'ABC-1234', odometer: 45200,
    purchaseDate: '2019-03-15', lastServiceDate: '2026-07-10',
    nextServiceDate: '2027-01-10', color: 'Silver', notes: 'Family car',
  });
  const v2 = addVehicle({
    name: 'Daily Civic', make: 'Honda', model: 'Civic',
    vehicleType: 'Car',  year: '2021',
    registrationNo: 'XYZ-5678', odometer: 22500,
    purchaseDate: '2021-06-01', lastServiceDate: '2026-08-01',
    nextServiceDate: '2027-02-01', color: 'Blue', notes: 'Daily commuter',
  });
  const v3 = addVehicle({
    name: 'Weekend Ranger', make: 'Ford', model: 'Ranger',
    vehicleType: 'Truck', year: '2020',
    registrationNo: 'DEF-9012', odometer: 61800,
    purchaseDate: '2020-09-20', lastServiceDate: '2026-06-05',
    nextServiceDate: '2026-12-05', color: 'White', notes: 'Weekend & work truck',
  });

  addService({ vehicleId: v1.id, serviceType: 'Oil Change',       serviceDate: '2026-07-10', odometerReading: 45200, laborCost: 40,  partsCost: 15, serviceCenter: 'QuickLube',     description: 'Regular oil change', nextServiceDate: '2027-01-10', nextServiceKM: 50000, notes: '5W-30 synthetic' });
  addService({ vehicleId: v1.id, serviceType: 'Tire Service',      serviceDate: '2026-05-22', odometerReading: 43800, laborCost: 25,  partsCost: 5,  serviceCenter: 'AutoZone',      description: 'Tire rotation and balance', notes: '' });
  addService({ vehicleId: v1.id, serviceType: 'Brake Service',     serviceDate: '2026-03-15', odometerReading: 42100, laborCost: 50,  partsCost: 30, serviceCenter: 'Midas',         description: 'Brake inspection and pad replacement', partsReplaced: 'Front brake pads', notes: 'Front pads replaced' });
  addService({ vehicleId: v2.id, serviceType: 'Oil Change',       serviceDate: '2026-08-01', odometerReading: 22500, laborCost: 45,  partsCost: 15, serviceCenter: 'Honda Service', description: 'Scheduled maintenance', nextServiceDate: '2027-02-01', nextServiceKM: 27500, notes: '' });
  addService({ vehicleId: v2.id, serviceType: 'Regular Service',  serviceDate: '2026-06-18', odometerReading: 21300, laborCost: 80,  partsCost: 25, serviceCenter: 'Honda Service', description: 'Air filter replacement and inspection', partsReplaced: 'Cabin filter, Engine air filter', notes: 'Cabin + engine filter' });
  addService({ vehicleId: v3.id, serviceType: 'Oil Change',       serviceDate: '2026-06-05', odometerReading: 61800, laborCost: 50,  partsCost: 20, serviceCenter: 'Ford Service',  description: 'Oil change and inspection', nextServiceDate: '2026-12-05', nextServiceKM: 66800, notes: '' });
  addService({ vehicleId: v3.id, serviceType: 'Engine Service',   serviceDate: '2025-12-10', odometerReading: 58300, laborCost: 150, partsCost: 70, serviceCenter: 'Ford Service', description: 'Transmission service and fluid flush', partsReplaced: 'Transmission fluid, Filter', notes: 'Full fluid flush' });
}
