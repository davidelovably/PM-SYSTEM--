export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      audit_log: {
        Row: {
          action_type: string
          created_at: string
          details: Json | null
          id: string
          performed_by: string
          performed_by_role: Database["public"]["Enums"]["app_role"]
          target_user_email: string | null
          target_user_id: string | null
        }
        Insert: {
          action_type: string
          created_at?: string
          details?: Json | null
          id?: string
          performed_by: string
          performed_by_role: Database["public"]["Enums"]["app_role"]
          target_user_email?: string | null
          target_user_id?: string | null
        }
        Update: {
          action_type?: string
          created_at?: string
          details?: Json | null
          id?: string
          performed_by?: string
          performed_by_role?: Database["public"]["Enums"]["app_role"]
          target_user_email?: string | null
          target_user_id?: string | null
        }
        Relationships: []
      }
      checklist_items: {
        Row: {
          checklist_id: string
          completed_at: string | null
          completed_by: string | null
          content: string
          created_at: string
          id: string
          is_completed: boolean
          position: number
        }
        Insert: {
          checklist_id: string
          completed_at?: string | null
          completed_by?: string | null
          content: string
          created_at?: string
          id?: string
          is_completed?: boolean
          position?: number
        }
        Update: {
          checklist_id?: string
          completed_at?: string | null
          completed_by?: string | null
          content?: string
          created_at?: string
          id?: string
          is_completed?: boolean
          position?: number
        }
        Relationships: [
          {
            foreignKeyName: "checklist_items_checklist_id_fkey"
            columns: ["checklist_id"]
            isOneToOne: false
            referencedRelation: "checklists"
            referencedColumns: ["id"]
          },
        ]
      }
      checklists: {
        Row: {
          created_at: string
          created_by: string
          id: string
          milestone_id: string | null
          project_id: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          milestone_id?: string | null
          project_id: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          milestone_id?: string | null
          project_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "checklists_milestone_id_fkey"
            columns: ["milestone_id"]
            isOneToOne: false
            referencedRelation: "milestones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklists_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      comments: {
        Row: {
          content: string
          created_at: string
          id: string
          sentiment_label: string | null
          task_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          sentiment_label?: string | null
          task_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          sentiment_label?: string | null
          task_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses: {
        Row: {
          amount: number
          category: string
          created_at: string
          created_by: string
          description: string | null
          expense_date: string
          id: string
          project_id: string
        }
        Insert: {
          amount: number
          category: string
          created_at?: string
          created_by: string
          description?: string | null
          expense_date: string
          id?: string
          project_id: string
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string
          created_by?: string
          description?: string | null
          expense_date?: string
          id?: string
          project_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "expenses_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      impact_areas: {
        Row: {
          created_at: string
          description: string | null
          id: string
          investment_budget: number | null
          investment_period: string | null
          name: string
          project_id: string
          updated_at: string
          visibility_scope: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          investment_budget?: number | null
          investment_period?: string | null
          name: string
          project_id: string
          updated_at?: string
          visibility_scope?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          investment_budget?: number | null
          investment_period?: string | null
          name?: string
          project_id?: string
          updated_at?: string
          visibility_scope?: string
        }
        Relationships: [
          {
            foreignKeyName: "impact_areas_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      impact_metrics: {
        Row: {
          area_id: string
          baseline_value: number | null
          created_at: string
          frequency: string | null
          id: string
          name: string
          target_value: number | null
          unit: Database["public"]["Enums"]["metric_unit"]
          updated_at: string
        }
        Insert: {
          area_id: string
          baseline_value?: number | null
          created_at?: string
          frequency?: string | null
          id?: string
          name: string
          target_value?: number | null
          unit?: Database["public"]["Enums"]["metric_unit"]
          updated_at?: string
        }
        Update: {
          area_id?: string
          baseline_value?: number | null
          created_at?: string
          frequency?: string | null
          id?: string
          name?: string
          target_value?: number | null
          unit?: Database["public"]["Enums"]["metric_unit"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "impact_metrics_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "impact_areas"
            referencedColumns: ["id"]
          },
        ]
      }
      inbox_messages: {
        Row: {
          attachment_file_id: string | null
          content: string
          created_at: string
          id: string
          is_read: boolean
          message_type: Database["public"]["Enums"]["inbox_message_type"]
          recipient_id: string
          related_entity_id: string | null
          related_entity_type: string | null
          sender_id: string | null
          subject: string
        }
        Insert: {
          attachment_file_id?: string | null
          content: string
          created_at?: string
          id?: string
          is_read?: boolean
          message_type?: Database["public"]["Enums"]["inbox_message_type"]
          recipient_id: string
          related_entity_id?: string | null
          related_entity_type?: string | null
          sender_id?: string | null
          subject: string
        }
        Update: {
          attachment_file_id?: string | null
          content?: string
          created_at?: string
          id?: string
          is_read?: boolean
          message_type?: Database["public"]["Enums"]["inbox_message_type"]
          recipient_id?: string
          related_entity_id?: string | null
          related_entity_type?: string | null
          sender_id?: string | null
          subject?: string
        }
        Relationships: [
          {
            foreignKeyName: "inbox_messages_attachment_file_id_fkey"
            columns: ["attachment_file_id"]
            isOneToOne: false
            referencedRelation: "project_files"
            referencedColumns: ["id"]
          },
        ]
      }
      metric_entries: {
        Row: {
          created_at: string
          date: string
          id: string
          is_published: boolean
          metric_id: string
          updated_at: string
          value: number
        }
        Insert: {
          created_at?: string
          date: string
          id?: string
          is_published?: boolean
          metric_id: string
          updated_at?: string
          value: number
        }
        Update: {
          created_at?: string
          date?: string
          id?: string
          is_published?: boolean
          metric_id?: string
          updated_at?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "metric_entries_metric_id_fkey"
            columns: ["metric_id"]
            isOneToOne: false
            referencedRelation: "impact_metrics"
            referencedColumns: ["id"]
          },
        ]
      }
      milestones: {
        Row: {
          created_at: string
          description: string | null
          due_date: string
          id: string
          owner_id: string
          project_id: string
          state: Database["public"]["Enums"]["milestone_state"]
          strategic_priority: Database["public"]["Enums"]["milestone_priority"]
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          due_date: string
          id?: string
          owner_id: string
          project_id: string
          state?: Database["public"]["Enums"]["milestone_state"]
          strategic_priority?: Database["public"]["Enums"]["milestone_priority"]
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          due_date?: string
          id?: string
          owner_id?: string
          project_id?: string
          state?: Database["public"]["Enums"]["milestone_state"]
          strategic_priority?: Database["public"]["Enums"]["milestone_priority"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "milestones_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          link: string | null
          message: string
          previous_task_status:
            | Database["public"]["Enums"]["task_status"]
            | null
          read: boolean
          sender_id: string | null
          status: string | null
          task_id: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          link?: string | null
          message: string
          previous_task_status?:
            | Database["public"]["Enums"]["task_status"]
            | null
          read?: boolean
          sender_id?: string | null
          status?: string | null
          task_id?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          link?: string | null
          message?: string
          previous_task_status?:
            | Database["public"]["Enums"]["task_status"]
            | null
          read?: boolean
          sender_id?: string | null
          status?: string | null
          task_id?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string
          full_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email: string
          full_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      project_files: {
        Row: {
          file_name: string
          file_size: number | null
          file_type: string | null
          id: string
          is_private: boolean
          notes: string | null
          project_id: string
          storage_path: string
          transferred_from_task_id: string | null
          uploaded_at: string
          uploaded_by: string
        }
        Insert: {
          file_name: string
          file_size?: number | null
          file_type?: string | null
          id?: string
          is_private?: boolean
          notes?: string | null
          project_id: string
          storage_path: string
          transferred_from_task_id?: string | null
          uploaded_at?: string
          uploaded_by: string
        }
        Update: {
          file_name?: string
          file_size?: number | null
          file_type?: string | null
          id?: string
          is_private?: boolean
          notes?: string | null
          project_id?: string
          storage_path?: string
          transferred_from_task_id?: string | null
          uploaded_at?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_files_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_files_transferred_from_task_id_fkey"
            columns: ["transferred_from_task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      project_members: {
        Row: {
          created_at: string
          id: string
          project_id: string
          role_in_project: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          project_id: string
          role_in_project: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          project_id?: string
          role_in_project?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_members_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      project_reports: {
        Row: {
          content_summary: string
          created_at: string
          created_by: string
          id: string
          key_metrics_snapshot: Json | null
          project_id: string
          report_period: Database["public"]["Enums"]["report_period"]
          status: Database["public"]["Enums"]["report_status"]
          updated_at: string
        }
        Insert: {
          content_summary: string
          created_at?: string
          created_by: string
          id?: string
          key_metrics_snapshot?: Json | null
          project_id: string
          report_period?: Database["public"]["Enums"]["report_period"]
          status?: Database["public"]["Enums"]["report_status"]
          updated_at?: string
        }
        Update: {
          content_summary?: string
          created_at?: string
          created_by?: string
          id?: string
          key_metrics_snapshot?: Json | null
          project_id?: string
          report_period?: Database["public"]["Enums"]["report_period"]
          status?: Database["public"]["Enums"]["report_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_reports_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_reports_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_requirements: {
        Row: {
          ai_tasks_json: Json | null
          created_at: string
          id: string
          input_script_raw: string
          project_id: string
          status: Database["public"]["Enums"]["requirement_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          ai_tasks_json?: Json | null
          created_at?: string
          id?: string
          input_script_raw: string
          project_id: string
          status?: Database["public"]["Enums"]["requirement_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          ai_tasks_json?: Json | null
          created_at?: string
          id?: string
          input_script_raw?: string
          project_id?: string
          status?: Database["public"]["Enums"]["requirement_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_requirements_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_stakeholders: {
        Row: {
          created_at: string
          email: string | null
          id: string
          name: string
          project_id: string
          raci_accountable: boolean | null
          raci_consulted: boolean | null
          raci_informed: boolean | null
          raci_responsible: boolean | null
          role: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          name: string
          project_id: string
          raci_accountable?: boolean | null
          raci_consulted?: boolean | null
          raci_informed?: boolean | null
          raci_responsible?: boolean | null
          role?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          project_id?: string
          raci_accountable?: boolean | null
          raci_consulted?: boolean | null
          raci_informed?: boolean | null
          raci_responsible?: boolean | null
          role?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_stakeholders_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          budget: number | null
          created_at: string
          description: string | null
          end_date: string | null
          id: string
          owner_id: string
          priority: Database["public"]["Enums"]["project_priority"]
          start_date: string | null
          status: Database["public"]["Enums"]["project_status"]
          title: string
          updated_at: string
        }
        Insert: {
          budget?: number | null
          created_at?: string
          description?: string | null
          end_date?: string | null
          id?: string
          owner_id: string
          priority?: Database["public"]["Enums"]["project_priority"]
          start_date?: string | null
          status?: Database["public"]["Enums"]["project_status"]
          title: string
          updated_at?: string
        }
        Update: {
          budget?: number | null
          created_at?: string
          description?: string | null
          end_date?: string | null
          id?: string
          owner_id?: string
          priority?: Database["public"]["Enums"]["project_priority"]
          start_date?: string | null
          status?: Database["public"]["Enums"]["project_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      risks: {
        Row: {
          created_at: string
          description: string | null
          id: string
          impact: Database["public"]["Enums"]["risk_impact"]
          mitigation_plan: string | null
          owner_id: string | null
          probability: Database["public"]["Enums"]["risk_probability"]
          project_id: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          impact: Database["public"]["Enums"]["risk_impact"]
          mitigation_plan?: string | null
          owner_id?: string | null
          probability: Database["public"]["Enums"]["risk_probability"]
          project_id: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          impact?: Database["public"]["Enums"]["risk_impact"]
          mitigation_plan?: string | null
          owner_id?: string | null
          probability?: Database["public"]["Enums"]["risk_probability"]
          project_id?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "risks_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "risks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      task_assignments: {
        Row: {
          created_at: string
          id: string
          task_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          task_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          task_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_assignments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_assignments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      task_attachments: {
        Row: {
          created_at: string
          file_name: string
          file_size: number | null
          file_url: string
          id: string
          task_id: string
          transferred_at: string | null
          transferred_to_docs: boolean | null
          uploaded_by: string
        }
        Insert: {
          created_at?: string
          file_name: string
          file_size?: number | null
          file_url: string
          id?: string
          task_id: string
          transferred_at?: string | null
          transferred_to_docs?: boolean | null
          uploaded_by: string
        }
        Update: {
          created_at?: string
          file_name?: string
          file_size?: number | null
          file_url?: string
          id?: string
          task_id?: string
          transferred_at?: string | null
          transferred_to_docs?: boolean | null
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_attachments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_attachments_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      task_checklists: {
        Row: {
          completed: boolean
          created_at: string
          id: string
          position: number
          task_id: string
          title: string
        }
        Insert: {
          completed?: boolean
          created_at?: string
          id?: string
          position?: number
          task_id: string
          title: string
        }
        Update: {
          completed?: boolean
          created_at?: string
          id?: string
          position?: number
          task_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_checklists_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_dependencies: {
        Row: {
          created_at: string
          depends_on_task_id: string
          id: string
          task_id: string
        }
        Insert: {
          created_at?: string
          depends_on_task_id: string
          id?: string
          task_id: string
        }
        Update: {
          created_at?: string
          depends_on_task_id?: string
          id?: string
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_dependencies_depends_on_task_id_fkey"
            columns: ["depends_on_task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_dependencies_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_labels: {
        Row: {
          color: string
          created_at: string
          id: string
          label: string
          task_id: string
        }
        Insert: {
          color?: string
          created_at?: string
          id?: string
          label: string
          task_id: string
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          label?: string
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_labels_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          actual_hours: number | null
          assigned_to_user_id: string | null
          created_at: string
          created_by: string
          description: string | null
          due_date: string | null
          estimated_hours: number | null
          id: string
          milestone_id: string | null
          position: number
          priority: Database["public"]["Enums"]["task_priority"]
          project_id: string
          status: Database["public"]["Enums"]["task_status"]
          title: string
          updated_at: string
        }
        Insert: {
          actual_hours?: number | null
          assigned_to_user_id?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          due_date?: string | null
          estimated_hours?: number | null
          id?: string
          milestone_id?: string | null
          position?: number
          priority?: Database["public"]["Enums"]["task_priority"]
          project_id: string
          status?: Database["public"]["Enums"]["task_status"]
          title: string
          updated_at?: string
        }
        Update: {
          actual_hours?: number | null
          assigned_to_user_id?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          due_date?: string | null
          estimated_hours?: number | null
          id?: string
          milestone_id?: string | null
          position?: number
          priority?: Database["public"]["Enums"]["task_priority"]
          project_id?: string
          status?: Database["public"]["Enums"]["task_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_milestone_id_fkey"
            columns: ["milestone_id"]
            isOneToOne: false
            referencedRelation: "milestones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_project_manager: {
        Args: { _project_id: string; _user_id: string }
        Returns: boolean
      }
      is_project_member: {
        Args: { _project_id: string; _user_id: string }
        Returns: boolean
      }
      is_task_assignee: {
        Args: { _task_id: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role:
        | "admin"
        | "project_manager"
        | "collaborator"
        | "super_admin"
        | "client"
      inbox_message_type: "notification" | "direct_message" | "file_share"
      metric_unit: "number" | "currency" | "percentage"
      milestone_priority: "low" | "medium" | "high"
      milestone_state: "planned" | "in_progress" | "completed" | "at_risk"
      project_priority: "low" | "medium" | "high" | "critical"
      project_status:
        | "planning"
        | "active"
        | "on_hold"
        | "completed"
        | "cancelled"
      report_period: "Weekly" | "Monthly" | "OnDemand"
      report_status: "Draft" | "Finalized"
      requirement_status: "Pending" | "Generated" | "Tasks_Created"
      risk_impact: "very_low" | "low" | "medium" | "high" | "very_high"
      risk_probability: "very_low" | "low" | "medium" | "high" | "very_high"
      task_priority: "must_have" | "should_have" | "could_have" | "wont_have"
      task_status: "to_do" | "doing" | "review" | "done" | "waiting_for_review"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: [
        "admin",
        "project_manager",
        "collaborator",
        "super_admin",
        "client",
      ],
      inbox_message_type: ["notification", "direct_message", "file_share"],
      metric_unit: ["number", "currency", "percentage"],
      milestone_priority: ["low", "medium", "high"],
      milestone_state: ["planned", "in_progress", "completed", "at_risk"],
      project_priority: ["low", "medium", "high", "critical"],
      project_status: [
        "planning",
        "active",
        "on_hold",
        "completed",
        "cancelled",
      ],
      report_period: ["Weekly", "Monthly", "OnDemand"],
      report_status: ["Draft", "Finalized"],
      requirement_status: ["Pending", "Generated", "Tasks_Created"],
      risk_impact: ["very_low", "low", "medium", "high", "very_high"],
      risk_probability: ["very_low", "low", "medium", "high", "very_high"],
      task_priority: ["must_have", "should_have", "could_have", "wont_have"],
      task_status: ["to_do", "doing", "review", "done", "waiting_for_review"],
    },
  },
} as const
