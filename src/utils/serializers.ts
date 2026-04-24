/**
 * Response Serializers - Safe data transformation for API responses
 * Ensures sensitive information is never exposed to clients
 */

import { User } from "../modules/users/entities/User";
import { Shipment } from "../modules/shipments/entities/Shipment";

/**
 * Sanitize user object for API responses
 * Removes: password, refreshToken, refreshTokenExpiresAt, outstandingBalance
 */
export function serializeUser(user: User | any): any {
  if (!user) return null;
  
  const {
    // Exclude sensitive fields
    password,
    refreshToken,
    refreshTokenExpiresAt,
    outstandingBalance,
    // Keep everything else
    ...safe
  } = user;

  return safe;
}

/**
 * Sanitize array of users
 */
export function serializeUsers(users: (User | any)[]): any[] {
  if (!Array.isArray(users)) return [];
  return users.map(serializeUser);
}

/**
 * Serialize any entity by sanitizing its common User relations.
 * This is a catch-all for entities like Shipment, Department, Payment, etc.
 */
export function serializeEntity(entity: any): any {
  if (!entity) return null;
  
  const serialized = { ...entity };
  
  // Common User relation fields across the system
  const userFields = [
    'createdBy', 
    'supervisor', 
    'assignedOfficer', 
    'updatedBy', 
    'user', 
    'changedBy',
    'performedBy',
    'processedBy',
    'uploadedBy'
  ];
  
  userFields.forEach(field => {
    if (serialized[field]) {
      // If it's an array of users (rare for these fields but possible)
      if (Array.isArray(serialized[field])) {
        serialized[field] = serialized[field].map(serializeUser);
      } else {
        serialized[field] = serializeUser(serialized[field]);
      }
    }
  });
  
  // Handle special array relations
  if (serialized.collaborators && Array.isArray(serialized.collaborators)) {
    serialized.collaborators = serialized.collaborators.map(serializeUser);
  }

  if (serialized.staff && Array.isArray(serialized.staff)) {
    serialized.staff = serialized.staff.map(serializeUser);
  }
  
  return serialized;
}

/**
 * Serialize shipment including relations
 */
export function serializeShipment(shipment: Shipment | any): any {
  return serializeEntity(shipment);
}

/**
 * Serialize array of shipments
 */
export function serializeShipments(shipments: (Shipment | any)[]): any[] {
  if (!Array.isArray(shipments)) return [];
  return shipments.map(serializeShipment);
}

/**
 * Serialize paginated response
 */
export function serializePaginatedResponse(data: any[], meta?: any): {
  status: string;
  data: any[];
  meta?: any;
} {
  return {
    status: "success",
    data: data.map(serializeEntity),
    ...(meta && { meta }),
  };
}
