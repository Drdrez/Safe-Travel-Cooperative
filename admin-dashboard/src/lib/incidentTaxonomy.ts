/** Aligned with public.incident_reports.category constraint (migration 011). */

export type IncidentCategory =
  | 'collision_multi_vehicle'
  | 'collision_fixed_object'
  | 'single_vehicle_runoff'
  | 'vehicle_mechanical_motion'
  | 'vehicle_breakdown_stranded'
  | 'passenger_injury'
  | 'passenger_medical'
  | 'driver_injury_medical'
  | 'security_threat_violence'
  | 'harassment_discrimination'
  | 'theft_loss_property'
  | 'property_damage_coop_vehicle'
  | 'property_damage_third_party'
  | 'service_accessibility'
  | 'customer_dispute_conduct'
  | 'operational_dispatch_error'
  | 'booking_conflict'
  | 'delay_schedule_failure'
  | 'route_road_hazard'
  | 'weather_environmental'
  | 'near_miss_hazard'
  | 'fuel_energy'
  | 'maintenance_premises'
  | 'it_system_data'
  | 'regulatory_inspection'
  | 'billing_payment_dispute'
  | 'cooperative_governance'
  | 'wildlife_environmental'
  | 'other';

export const INCIDENT_CATEGORY_GROUPS: Array<{
  group: string;
  items: Array<{ value: IncidentCategory; label: string }>;
}> = [
  {
    group: 'Road & vehicle',
    items: [
      { value: 'collision_multi_vehicle', label: 'Collision with another vehicle' },
      { value: 'collision_fixed_object', label: 'Collision with fixed object / infrastructure' },
      { value: 'single_vehicle_runoff', label: 'Single-vehicle: run-off, rollover, loss of control' },
      { value: 'vehicle_mechanical_motion', label: 'Mechanical / electrical failure while moving' },
      { value: 'vehicle_breakdown_stranded', label: 'Breakdown / stranded vehicle' },
      { value: 'fuel_energy', label: 'Fuel or energy incident' },
      { value: 'maintenance_premises', label: 'Maintenance yard, garage, or premises' },
    ],
  },
  {
    group: 'People & medical',
    items: [
      { value: 'passenger_injury', label: 'Passenger injury' },
      { value: 'passenger_medical', label: 'Passenger medical emergency (non-injury)' },
      { value: 'driver_injury_medical', label: 'Driver injury or medical emergency' },
    ],
  },
  {
    group: 'Security & conduct',
    items: [
      { value: 'security_threat_violence', label: 'Security threat, violence, robbery' },
      { value: 'harassment_discrimination', label: 'Harassment or discrimination' },
      { value: 'customer_dispute_conduct', label: 'Customer dispute or conduct' },
    ],
  },
  {
    group: 'Property & theft',
    items: [
      { value: 'theft_loss_property', label: 'Theft or loss of property' },
      { value: 'property_damage_coop_vehicle', label: 'Damage to cooperative vehicle (non-collision)' },
      { value: 'property_damage_third_party', label: 'Damage to third-party property' },
    ],
  },
  {
    group: 'Service & operations',
    items: [
      { value: 'service_accessibility', label: 'Service failure / accessibility' },
      { value: 'operational_dispatch_error', label: 'Dispatch or scheduling error' },
      { value: 'booking_conflict', label: 'Double booking or assignment conflict' },
      { value: 'delay_schedule_failure', label: 'Delay, long wait, or schedule failure' },
      { value: 'billing_payment_dispute', label: 'Billing or payment dispute related to a trip' },
    ],
  },
  {
    group: 'Route & environment',
    items: [
      { value: 'route_road_hazard', label: 'Road closure, construction, or hazard' },
      { value: 'weather_environmental', label: 'Weather or environmental event' },
      { value: 'wildlife_environmental', label: 'Animal strike or environmental damage' },
      { value: 'near_miss_hazard', label: 'Near miss or hazard observation' },
    ],
  },
  {
    group: 'Systems & compliance',
    items: [
      { value: 'it_system_data', label: 'IT, app, booking, or data issue' },
      { value: 'regulatory_inspection', label: 'Regulatory, audit, or inspection matter' },
      { value: 'cooperative_governance', label: 'Cooperative policy or governance matter' },
      { value: 'other', label: 'Other (specify in detail)' },
    ],
  },
];

const FLAT = INCIDENT_CATEGORY_GROUPS.flatMap(g => g.items);

export function labelForIncidentCategory(value: string): string {
  return FLAT.find(i => i.value === value)?.label ?? value;
}

export const SEVERITY_OPTIONS = ['Info', 'Minor', 'Moderate', 'Major', 'Critical'] as const;

export const STATUS_OPTIONS = [
  'Draft',
  'Submitted',
  'Under Review',
  'Resolved',
  'Closed',
  'Escalated',
] as const;

export const TRIP_PHASE_OPTIONS = [
  'Not Applicable',
  'Pre-Trip',
  'En Route',
  'Pickup',
  'Drop-off',
  'Post-Trip',
] as const;
