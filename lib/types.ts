export type Service = {
  id: string;            // maps from _id
  name: string;          // Name of the service
  slug: string;          // URL slug, usually used for routing
  description: string;   // Detailed description of the service
  ctaText: string;       // Call-to-action text, e.g., "Book Now"
  image: string | null;  // Full URL of the image, null if no image
  status: string;        // Status of the service (e.g., 'published', 'draft')
  active: boolean;       // Whether the service is active or not
  viewType: string;      // Type of view (e.g., 'card', 'list')
  
  // New properties
  appointmentMedium: "online" | "offline"; // Appointment method: online or offline
  bookingFlow: string;    // A stringified JSON containing the booking flow steps
  reorderFlow: string;    // A stringified JSON containing the reorder flow steps
  formsAssignment: string; // A stringified JSON containing form assignments for the service
  createdAt: string;      // Date the service was created
  updatedAt: string;   
     // Date the service was last updated
};
