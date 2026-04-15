/**
 * Response Serializers - Safe data transformation for API responses
 * Ensures sensitive information is never exposed to clients
 */

import { User } from "../modules/users/entities/User";
import { Shipment } from "../modules/shipments/entities/Shipment";

/**
 * Sanitize user object for API responses
 * Removes: password, refreshToken, refreshTokenExpiresAt
 */
export function serializeUser(user: User | any): any {
  if (!user) return null;
  
  const {
    // Exclude sensitive fields
    password,
    refreshToken,
    refreshTokenExpiresAt,
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
 * Serialize shipment including assignedOfficer
 */
export function serializeShipment(shipment: Shipment | any): any {
  if (!shipment) return null;

  const serialized = {
    ...shipment,
  };

  // Sanitize assignedOfficer if it exists
  if (serialized.assignedOfficer) {
    serialized.assignedOfficer = serializeUser(serialized.assignedOfficer);
  }

  // Sanitize collaborators if they exist
  if (serialized.collaborators && Array.isArray(serialized.collaborators)) {
    serialized.collaborators = serialized.collaborators.map(serializeUser);
  }

  return serialized;
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
    data: serializeShipments(data),
    ...(meta && { meta }),
  };
}
