export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      organizations: {
        Row: {
          id: string
          name: string
          ghl_location_id: string | null
          ghl_pipeline_id: string | null
          default_currency: string
          timezone: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          ghl_location_id?: string | null
          ghl_pipeline_id?: string | null
          default_currency?: string
          timezone?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          name?: string
          ghl_location_id?: string | null
          ghl_pipeline_id?: string | null
          default_currency?: string
          timezone?: string
          updated_at?: string
        }
      }
      users: {
        Row: {
          id: string
          email: string
          full_name: string | null
          organization_id: string | null
          role: "owner" | "admin" | "member" | "viewer"
          avatar_url: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          email: string
          full_name?: string | null
          organization_id?: string | null
          role?: "owner" | "admin" | "member" | "viewer"
          avatar_url?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          email?: string
          full_name?: string | null
          organization_id?: string | null
          role?: "owner" | "admin" | "member" | "viewer"
          avatar_url?: string | null
          updated_at?: string
        }
      }
      customers: {
        Row: {
          id: string
          organization_id: string
          ghl_contact_id: string | null
          first_name: string
          last_name: string
          email: string | null
          phone: string | null
          company_name: string | null
          address_line1: string | null
          address_line2: string | null
          city: string | null
          state: string | null
          postal_code: string | null
          country: string | null
          created_at: string
          updated_at: string
          created_by: string | null
        }
        Insert: {
          id?: string
          organization_id: string
          ghl_contact_id?: string | null
          first_name: string
          last_name: string
          email?: string | null
          phone?: string | null
          company_name?: string | null
          address_line1?: string | null
          address_line2?: string | null
          city?: string | null
          state?: string | null
          postal_code?: string | null
          country?: string | null
          created_at?: string
          updated_at?: string
          created_by?: string | null
        }
        Update: {
          ghl_contact_id?: string | null
          first_name?: string
          last_name?: string
          email?: string | null
          phone?: string | null
          company_name?: string | null
          address_line1?: string | null
          address_line2?: string | null
          city?: string | null
          state?: string | null
          postal_code?: string | null
          country?: string | null
          updated_at?: string
        }
      }
      projects: {
        Row: {
          id: string
          organization_id: string
          customer_id: string
          ghl_opportunity_id: string | null
          name: string
          status: "lead" | "bid" | "active" | "completed" | "cancelled"
          address: string | null
          city: string | null
          state: string | null
          postal_code: string | null
          estimated_start_date: string | null
          estimated_end_date: string | null
          notes: string | null
          created_at: string
          updated_at: string
          created_by: string | null
          updated_by: string | null
        }
        Insert: {
          id?: string
          organization_id: string
          customer_id: string
          ghl_opportunity_id?: string | null
          name: string
          status?: "lead" | "bid" | "active" | "completed" | "cancelled"
          address?: string | null
          city?: string | null
          state?: string | null
          postal_code?: string | null
          estimated_start_date?: string | null
          estimated_end_date?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
          created_by?: string | null
          updated_by?: string | null
        }
        Update: {
          organization_id?: string
          customer_id?: string
          ghl_opportunity_id?: string | null
          name?: string
          status?: "lead" | "bid" | "active" | "completed" | "cancelled"
          address?: string | null
          city?: string | null
          state?: string | null
          postal_code?: string | null
          estimated_start_date?: string | null
          estimated_end_date?: string | null
          notes?: string | null
          updated_at?: string
          updated_by?: string | null
        }
      }
      rooms: {
        Row: {
          id: string
          project_id: string
          name: string
          room_type: string
          floor: number
          status: "pending" | "measured" | "estimated" | "complete"
          notes: string | null
          sort_order: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          project_id: string
          name: string
          room_type?: string
          floor?: number
          status?: "pending" | "measured" | "estimated" | "complete"
          notes?: string | null
          sort_order?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          name?: string
          room_type?: string
          floor?: number
          status?: "pending" | "measured" | "estimated" | "complete"
          notes?: string | null
          sort_order?: number
          updated_at?: string
        }
      }
      room_photos: {
        Row: {
          id: string
          room_id: string
          storage_path: string
          file_name: string
          file_type: string
          file_size: number
          width: number | null
          height: number | null
          is_primary: boolean
          created_at: string
        }
        Insert: {
          id?: string
          room_id: string
          storage_path: string
          file_name: string
          file_type?: string
          file_size?: number
          width?: number | null
          height?: number | null
          is_primary?: boolean
          created_at?: string
        }
        Update: {
          storage_path?: string
          file_name?: string
          file_type?: string
          file_size?: number
          width?: number | null
          height?: number | null
          is_primary?: boolean
        }
      }
      measurements: {
        Row: {
          id: string
          room_id: string
          category: "wall" | "ceiling" | "floor" | "trim" | "opening" | "misc"
          measurement_type: "square_foot" | "linear_foot" | "unit" | "each"
          label: string
          value: number
          unit: "sqft" | "lf" | "ea"
          source: "ai_extracted" | "manual" | "calculated"
          confidence_score: number | null
          notes: string | null
          wall_index: number | null
          length: number | null
          height: number | null
          width: number | null
          quantity: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          room_id: string
          category: "wall" | "ceiling" | "floor" | "trim" | "opening" | "misc"
          measurement_type: "square_foot" | "linear_foot" | "unit" | "each"
          label: string
          value: number
          unit: "sqft" | "lf" | "ea"
          source?: "ai_extracted" | "manual" | "calculated"
          confidence_score?: number | null
          notes?: string | null
          wall_index?: number | null
          length?: number | null
          height?: number | null
          width?: number | null
          quantity?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          category?: "wall" | "ceiling" | "floor" | "trim" | "opening" | "misc"
          measurement_type?: "square_foot" | "linear_foot" | "unit" | "each"
          label?: string
          value?: number
          unit?: "sqft" | "lf" | "ea"
          source?: "ai_extracted" | "manual" | "calculated"
          confidence_score?: number | null
          notes?: string | null
          updated_at?: string
        }
      }
      estimates: {
        Row: {
          id: string
          project_id: string
          version: number
          status: "draft" | "sent" | "approved" | "rejected" | "revised"
          subtotal: number
          tax_rate: number
          tax_amount: number
          markup_rate: number
          markup_amount: number
          total: number
          valid_until: string | null
          sent_at: string | null
          approved_at: string | null
          notes: string | null
          ghl_opportunity_id: string | null
          created_at: string
          updated_at: string
          created_by: string | null
          updated_by: string | null
        }
        Insert: {
          id?: string
          project_id: string
          version?: number
          status?: "draft" | "sent" | "approved" | "rejected" | "revised"
          subtotal?: number
          tax_rate?: number
          tax_amount?: number
          markup_rate?: number
          markup_amount?: number
          total?: number
          valid_until?: string | null
          sent_at?: string | null
          approved_at?: string | null
          notes?: string | null
          ghl_opportunity_id?: string | null
          created_at?: string
          updated_at?: string
          created_by?: string | null
          updated_by?: string | null
        }
        Update: {
          project_id?: string
          version?: number
          status?: "draft" | "sent" | "approved" | "rejected" | "revised"
          subtotal?: number
          tax_rate?: number
          tax_amount?: number
          markup_rate?: number
          markup_amount?: number
          total?: number
          valid_until?: string | null
          sent_at?: string | null
          approved_at?: string | null
          notes?: string | null
          ghl_opportunity_id?: string | null
          updated_at?: string
          updated_by?: string | null
        }
      }
      estimate_items: {
        Row: {
          id: string
          estimate_id: string
          room_id: string | null
          category: string
          description: string
          quantity: number
          unit: string
          unit_cost: number
          total_cost: number
          sort_order: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          estimate_id: string
          room_id?: string | null
          category?: string
          description: string
          quantity?: number
          unit?: string
          unit_cost?: number
          total_cost?: number
          sort_order?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          estimate_id?: string
          room_id?: string | null
          category?: string
          description?: string
          quantity?: number
          unit?: string
          unit_cost?: number
          total_cost?: number
          sort_order?: number
          updated_at?: string
        }
      }
      project_files: {
        Row: {
          id: string
          project_id: string
          room_id: string | null
          storage_path: string
          file_name: string
          file_type: string
          file_size: number
          mime_type: string
          source: string
          processing_status: "pending" | "uploaded" | "queued" | "processing" | "extracting" | "completed" | "failed"
          processing_error: string | null
          metadata: Json | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          project_id: string
          room_id?: string | null
          storage_path: string
          file_name: string
          file_type?: string
          file_size?: number
          mime_type?: string
          source?: string
          processing_status?: "pending" | "uploaded" | "queued" | "processing" | "extracting" | "completed" | "failed"
          processing_error?: string | null
          metadata?: Json | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          room_id?: string | null
          storage_path?: string
          file_name?: string
          file_type?: string
          file_size?: number
          mime_type?: string
          source?: string
          processing_status?: "pending" | "uploaded" | "queued" | "processing" | "extracting" | "completed" | "failed"
          processing_error?: string | null
          metadata?: Json | null
          updated_at?: string
        }
      }
      processing_jobs: {
        Row: {
          id: string
          project_file_id: string
          job_type: string
          status: "pending" | "queued" | "processing" | "completed" | "failed"
          started_at: string | null
          completed_at: string | null
          error_message: string | null
          retry_count: number
          input_data: Json
          output_data: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          project_file_id: string
          job_type: string
          status?: "pending" | "queued" | "processing" | "completed" | "failed"
          started_at?: string | null
          completed_at?: string | null
          error_message?: string | null
          retry_count?: number
          input_data?: Json
          output_data?: Json | null
          created_at?: string
        }
        Update: {
          status?: "pending" | "queued" | "processing" | "completed" | "failed"
          started_at?: string | null
          completed_at?: string | null
          error_message?: string | null
          retry_count?: number
          output_data?: Json | null
        }
      }
      ai_visualizer_runs: {
        Row: {
          id: string
          room_photo_id: string
          room_id: string
          status: "pending" | "processing" | "completed" | "failed"
          wall_color_applied: string | null
          trim_color_applied: string | null
          output_storage_path: string | null
          error_message: string | null
          model_used: string
          created_at: string
          completed_at: string | null
        }
        Insert: {
          id?: string
          room_photo_id: string
          room_id: string
          status?: "pending" | "processing" | "completed" | "failed"
          wall_color_applied?: string | null
          trim_color_applied?: string | null
          output_storage_path?: string | null
          error_message?: string | null
          model_used?: string
          created_at?: string
          completed_at?: string | null
        }
        Update: {
          status?: "pending" | "processing" | "completed" | "failed"
          wall_color_applied?: string | null
          trim_color_applied?: string | null
          output_storage_path?: string | null
          error_message?: string | null
          model_used?: string
          completed_at?: string | null
        }
      }
      ghl_sync_jobs: {
        Row: {
          id: string
          organization_id: string
          sync_type: string
          status: "pending" | "processing" | "completed" | "failed"
          ghl_response: Json | null
          error_message: string | null
          records_synced: number
          created_at: string
          completed_at: string | null
        }
        Insert: {
          id?: string
          organization_id: string
          sync_type: string
          status?: "pending" | "processing" | "completed" | "failed"
          ghl_response?: Json | null
          error_message?: string | null
          records_synced?: number
          created_at?: string
          completed_at?: string | null
        }
        Update: {
          status?: "pending" | "processing" | "completed" | "failed"
          ghl_response?: Json | null
          error_message?: string | null
          records_synced?: number
          completed_at?: string | null
        }
      }
      webhook_events: {
        Row: {
          id: string
          organization_id: string
          source: string
          event_type: string
          payload: Json
          processed: boolean
          processed_at: string | null
          error: string | null
          created_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          source: string
          event_type: string
          payload?: Json
          processed?: boolean
          processed_at?: string | null
          error?: string | null
          created_at?: string
        }
        Update: {
          processed?: boolean
          processed_at?: string | null
          error?: string | null
        }
      }
      ghl_integration_settings: {
        Row: {
          id: string
          organization_id: string
          is_active: boolean
          auth_type: string
          access_token: string | null
          refresh_token: string | null
          token_expires_at: string | null
          location_id: string
          pipeline_id: string | null
          default_stage_id: string | null
          field_mappings: Json
          auto_sync_contacts: boolean
          auto_sync_estimates: boolean
          webhook_secret: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          is_active?: boolean
          auth_type?: string
          access_token?: string | null
          refresh_token?: string | null
          token_expires_at?: string | null
          location_id?: string
          pipeline_id?: string | null
          default_stage_id?: string | null
          field_mappings?: Json
          auto_sync_contacts?: boolean
          auto_sync_estimates?: boolean
          webhook_secret?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          is_active?: boolean
          auth_type?: string
          access_token?: string | null
          refresh_token?: string | null
          token_expires_at?: string | null
          location_id?: string
          pipeline_id?: string | null
          default_stage_id?: string | null
          field_mappings?: Json
          auto_sync_contacts?: boolean
          auto_sync_estimates?: boolean
          webhook_secret?: string | null
          updated_at?: string
        }
      }
      audit_logs: {
        Row: {
          id: string
          organization_id: string
          user_id: string | null
          action: string
          entity_type: string
          entity_id: string | null
          metadata: Json | null
          ip_address: string | null
          created_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          user_id?: string | null
          action: string
          entity_type: string
          entity_id?: string | null
          metadata?: Json | null
          ip_address?: string | null
          created_at?: string
        }
        Update: {
          user_id?: string | null
          action?: string
          entity_type?: string
          entity_id?: string | null
          metadata?: Json | null
          ip_address?: string | null
        }
      }
      materials_orders: {
        Row: {
          id: string
          project_id: string
          estimate_id: string | null
          version: number
          status: "draft" | "ordered" | "partial" | "received" | "cancelled"
          notes: string | null
          supplier_name: string | null
          order_date: string | null
          expected_delivery: string | null
          subtotal: number
          tax_rate: number
          tax_amount: number
          total: number
          created_at: string
          updated_at: string
          created_by: string | null
          updated_by: string | null
        }
        Insert: {
          id?: string
          project_id: string
          estimate_id?: string | null
          version?: number
          status?: "draft" | "ordered" | "partial" | "received" | "cancelled"
          notes?: string | null
          supplier_name?: string | null
          order_date?: string | null
          expected_delivery?: string | null
          subtotal?: number
          tax_rate?: number
          tax_amount?: number
          total?: number
          created_at?: string
          updated_at?: string
          created_by?: string | null
          updated_by?: string | null
        }
        Update: {
          project_id?: string
          estimate_id?: string | null
          version?: number
          status?: "draft" | "ordered" | "partial" | "received" | "cancelled"
          notes?: string | null
          supplier_name?: string | null
          order_date?: string | null
          expected_delivery?: string | null
          subtotal?: number
          tax_rate?: number
          tax_amount?: number
          total?: number
          updated_at?: string
          updated_by?: string | null
        }
      }
      materials_order_items: {
        Row: {
          id: string
          materials_order_id: string
          category: string
          description: string
          supplier_part_number: string | null
          brand: string | null
          quantity: number
          unit: string
          unit_cost: number
          total_cost: number
          is_ordered: boolean
          ordered_quantity: number | null
          notes: string | null
          sort_order: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          materials_order_id: string
          category?: string
          description: string
          supplier_part_number?: string | null
          brand?: string | null
          quantity?: number
          unit?: string
          unit_cost?: number
          total_cost?: number
          is_ordered?: boolean
          ordered_quantity?: number | null
          notes?: string | null
          sort_order?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          materials_order_id?: string
          category?: string
          description?: string
          supplier_part_number?: string | null
          brand?: string | null
          quantity?: number
          unit?: string
          unit_cost?: number
          total_cost?: number
          is_ordered?: boolean
          ordered_quantity?: number | null
          notes?: string | null
          sort_order?: number
          updated_at?: string
        }
      }
    }
    Views: {}
    Functions: {}
    Enums: {}
  }
}

// Convenience types
export type Organization = Database["public"]["Tables"]["organizations"]["Row"]
export type User = Database["public"]["Tables"]["users"]["Row"]
export type Customer = Database["public"]["Tables"]["customers"]["Row"]
export type CustomerInsert = Database["public"]["Tables"]["customers"]["Insert"]
export type CustomerUpdate = Database["public"]["Tables"]["customers"]["Update"]
export type Project = Database["public"]["Tables"]["projects"]["Row"]
export type ProjectInsert = Database["public"]["Tables"]["projects"]["Insert"]
export type ProjectUpdate = Database["public"]["Tables"]["projects"]["Update"]
export type Room = Database["public"]["Tables"]["rooms"]["Row"]
export type RoomInsert = Database["public"]["Tables"]["rooms"]["Insert"]
export type RoomUpdate = Database["public"]["Tables"]["rooms"]["Update"]
export type Measurement = Database["public"]["Tables"]["measurements"]["Row"]
export type MeasurementInsert = Database["public"]["Tables"]["measurements"]["Insert"]
export type MeasurementUpdate = Database["public"]["Tables"]["measurements"]["Update"]
export type Estimate = Database["public"]["Tables"]["estimates"]["Row"] & { line_items?: EstimateItem[] }
export type EstimateInsert = Database["public"]["Tables"]["estimates"]["Insert"]
export type EstimateUpdate = Database["public"]["Tables"]["estimates"]["Update"]
export type EstimateItem = Database["public"]["Tables"]["estimate_items"]["Row"]
export type EstimateItemInsert = Database["public"]["Tables"]["estimate_items"]["Insert"]
export type EstimateItemUpdate = Database["public"]["Tables"]["estimate_items"]["Update"]
export type ProjectFile = Database["public"]["Tables"]["project_files"]["Row"]
export type ProcessingJob = Database["public"]["Tables"]["processing_jobs"]["Row"]
export type AIVisualizerRun = Database["public"]["Tables"]["ai_visualizer_runs"]["Row"]
export type GhLIntegrationSettings = Database["public"]["Tables"]["ghl_integration_settings"]["Row"]
export type AuditLog = Database["public"]["Tables"]["audit_logs"]["Row"]
export type MaterialsOrder = Database["public"]["Tables"]["materials_orders"]["Row"] & { items?: MaterialsOrderItem[] }
export type MaterialsOrderItem = Database["public"]["Tables"]["materials_order_items"]["Row"]
