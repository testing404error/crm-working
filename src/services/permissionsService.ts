// Service to handle role-based permissions
export interface UserPermissions {
  canViewAllLeads: boolean;
  canEditAllLeads: boolean;
  canDeleteAllLeads: boolean;
  canViewAllOpportunities: boolean;
  canEditAllOpportunities: boolean;
  canDeleteAllOpportunities: boolean;
  canViewReports: boolean;
  canManageUsers: boolean;
  canManageSettings: boolean;
}

export const permissionsService = {
  // Define permissions based on user role
  getPermissions(userRole: string): UserPermissions {
    switch (userRole) {
      case 'admin':
        return {
          canViewAllLeads: true,
          canEditAllLeads: true,
          canDeleteAllLeads: true,
          canViewAllOpportunities: true,
          canEditAllOpportunities: true,
          canDeleteAllOpportunities: true,
          canViewReports: true,
          canManageUsers: true,
          canManageSettings: true,
        };
      
      case 'manager':
        return {
          canViewAllLeads: true,
          canEditAllLeads: true,
          canDeleteAllLeads: true,
          canViewAllOpportunities: true,
          canEditAllOpportunities: true,
          canDeleteAllOpportunities: true,
          canViewReports: true,
          canManageUsers: false,
          canManageSettings: false,
        };
      
      case 'sales':
      case 'marketing':
        return {
          canViewAllLeads: false, // Regular users can only see their own leads
          canEditAllLeads: false, // Regular users can only edit their own leads
          canDeleteAllLeads: false, // Regular users can't delete leads
          canViewAllOpportunities: false, // Regular users can only see their own opportunities
          canEditAllOpportunities: false, // Regular users can only edit their own opportunities
          canDeleteAllOpportunities: false, // Regular users can't delete opportunities
          canViewReports: true,
          canManageUsers: false,
          canManageSettings: false,
        };
      
      default:
        return {
          canViewAllLeads: false,
          canEditAllLeads: false,
          canDeleteAllLeads: false,
          canViewAllOpportunities: false,
          canEditAllOpportunities: false,
          canDeleteAllOpportunities: false,
          canViewReports: false,
          canManageUsers: false,
          canManageSettings: false,
        };
    }
  },

  // Check if user has specific permission
  hasPermission(userRole: string, permission: keyof UserPermissions): boolean {
    const permissions = this.getPermissions(userRole);
    return permissions[permission];
  },

  // Helper to check if user can access leads functionality
  canAccessLeads(userRole: string): boolean {
    return this.hasPermission(userRole, 'canViewAllLeads');
  },

  // Helper to check if user can access opportunities functionality
  canAccessOpportunities(userRole: string): boolean {
    return this.hasPermission(userRole, 'canViewAllOpportunities');
  }
};
