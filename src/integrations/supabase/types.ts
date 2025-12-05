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
    PostgrestVersion: "13.0.4"
  }
  public: {
    Tables: {
      accounts_payable: {
        Row: {
          amount: number
          boleto_barcode: string | null
          card_brand: string | null
          card_last_digits: string | null
          card_operation: string | null
          card_operator: string | null
          cost_center_id: string
          created_at: string | null
          created_by: string | null
          description: string
          due_date: string
          id: string
          observations: string | null
          payment_type: Database["public"]["Enums"]["payment_type"]
          pix_key: string | null
          pix_receiver_name: string | null
          status: Database["public"]["Enums"]["account_status"] | null
          supplier_id: string
          transfer_account: string | null
          transfer_account_type: string | null
          transfer_agency: string | null
          transfer_bank: string | null
          transfer_holder_document: string | null
          transfer_holder_name: string | null
          updated_at: string | null
        }
        Insert: {
          amount: number
          boleto_barcode?: string | null
          card_brand?: string | null
          card_last_digits?: string | null
          card_operation?: string | null
          card_operator?: string | null
          cost_center_id: string
          created_at?: string | null
          created_by?: string | null
          description: string
          due_date: string
          id?: string
          observations?: string | null
          payment_type: Database["public"]["Enums"]["payment_type"]
          pix_key?: string | null
          pix_receiver_name?: string | null
          status?: Database["public"]["Enums"]["account_status"] | null
          supplier_id: string
          transfer_account?: string | null
          transfer_account_type?: string | null
          transfer_agency?: string | null
          transfer_bank?: string | null
          transfer_holder_document?: string | null
          transfer_holder_name?: string | null
          updated_at?: string | null
        }
        Update: {
          amount?: number
          boleto_barcode?: string | null
          card_brand?: string | null
          card_last_digits?: string | null
          card_operation?: string | null
          card_operator?: string | null
          cost_center_id?: string
          created_at?: string | null
          created_by?: string | null
          description?: string
          due_date?: string
          id?: string
          observations?: string | null
          payment_type?: Database["public"]["Enums"]["payment_type"]
          pix_key?: string | null
          pix_receiver_name?: string | null
          status?: Database["public"]["Enums"]["account_status"] | null
          supplier_id?: string
          transfer_account?: string | null
          transfer_account_type?: string | null
          transfer_agency?: string | null
          transfer_bank?: string | null
          transfer_holder_document?: string | null
          transfer_holder_name?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "accounts_payable_cost_center_id_fkey"
            columns: ["cost_center_id"]
            isOneToOne: false
            referencedRelation: "cost_centers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounts_payable_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounts_payable_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      accounts_receivable: {
        Row: {
          amount: number
          created_at: string | null
          created_by: string | null
          customer_id: string
          due_date: string
          id: string
          notes: string | null
          paid_amount: number | null
          paid_at: string | null
          paid_by: string | null
          sale_id: string
          status: string
          updated_at: string | null
        }
        Insert: {
          amount: number
          created_at?: string | null
          created_by?: string | null
          customer_id: string
          due_date: string
          id?: string
          notes?: string | null
          paid_amount?: number | null
          paid_at?: string | null
          paid_by?: string | null
          sale_id: string
          status?: string
          updated_at?: string | null
        }
        Update: {
          amount?: number
          created_at?: string | null
          created_by?: string | null
          customer_id?: string
          due_date?: string
          id?: string
          notes?: string | null
          paid_amount?: number | null
          paid_at?: string | null
          paid_by?: string | null
          sale_id?: string
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "accounts_receivable_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounts_receivable_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounts_receivable_paid_by_fkey"
            columns: ["paid_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounts_receivable_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      attachments: {
        Row: {
          account_id: string | null
          created_at: string | null
          description: string | null
          file_category: string | null
          file_path: string
          file_size: number | null
          filename: string
          id: string
          is_payment_proof: boolean | null
          mime_type: string | null
          payment_id: string | null
          updated_at: string | null
          uploaded_by: string | null
        }
        Insert: {
          account_id?: string | null
          created_at?: string | null
          description?: string | null
          file_category?: string | null
          file_path: string
          file_size?: number | null
          filename: string
          id?: string
          is_payment_proof?: boolean | null
          mime_type?: string | null
          payment_id?: string | null
          updated_at?: string | null
          uploaded_by?: string | null
        }
        Update: {
          account_id?: string | null
          created_at?: string | null
          description?: string | null
          file_category?: string | null
          file_path?: string
          file_size?: number | null
          filename?: string
          id?: string
          is_payment_proof?: boolean | null
          mime_type?: string | null
          payment_id?: string | null
          updated_at?: string | null
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "attachments_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts_payable"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attachments_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "view_contas_pagar"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attachments_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attachments_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string | null
          id: string
          new_values: Json | null
          old_values: Json | null
          record_id: string
          table_name: string
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string | null
          id?: string
          new_values?: Json | null
          old_values?: Json | null
          record_id: string
          table_name: string
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string | null
          id?: string
          new_values?: Json | null
          old_values?: Json | null
          record_id?: string
          table_name?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      brands: {
        Row: {
          active: boolean | null
          created_at: string | null
          created_by: string | null
          id: string
          name: string
          updated_at: string | null
        }
        Insert: {
          active?: boolean | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          name: string
          updated_at?: string | null
        }
        Update: {
          active?: boolean | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      cash_register_closings: {
        Row: {
          card_counted: number | null
          card_expected: number | null
          cash_counted: number | null
          cash_expected: number | null
          closed_at: string | null
          closed_by: string | null
          closing_date: string
          created_at: string | null
          credit_expected: number | null
          difference: number | null
          id: string
          notes: string | null
          opened_at: string | null
          opened_by: string | null
          other_expected: number | null
          pix_counted: number | null
          pix_expected: number | null
          status: string
          store_id: string
          updated_at: string | null
        }
        Insert: {
          card_counted?: number | null
          card_expected?: number | null
          cash_counted?: number | null
          cash_expected?: number | null
          closed_at?: string | null
          closed_by?: string | null
          closing_date: string
          created_at?: string | null
          credit_expected?: number | null
          difference?: number | null
          id?: string
          notes?: string | null
          opened_at?: string | null
          opened_by?: string | null
          other_expected?: number | null
          pix_counted?: number | null
          pix_expected?: number | null
          status?: string
          store_id: string
          updated_at?: string | null
        }
        Update: {
          card_counted?: number | null
          card_expected?: number | null
          cash_counted?: number | null
          cash_expected?: number | null
          closed_at?: string | null
          closed_by?: string | null
          closing_date?: string
          created_at?: string | null
          credit_expected?: number | null
          difference?: number | null
          id?: string
          notes?: string | null
          opened_at?: string | null
          opened_by?: string | null
          other_expected?: number | null
          pix_counted?: number | null
          pix_expected?: number | null
          status?: string
          store_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cash_register_closings_closed_by_fkey"
            columns: ["closed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_register_closings_opened_by_fkey"
            columns: ["opened_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_register_closings_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      cash_register_movements: {
        Row: {
          amount: number
          closing_id: string | null
          created_at: string
          created_by: string | null
          id: string
          movement_type: string
          reason: string
          store_id: string
        }
        Insert: {
          amount: number
          closing_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          movement_type: string
          reason: string
          store_id: string
        }
        Update: {
          amount?: number
          closing_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          movement_type?: string
          reason?: string
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cash_register_movements_closing_id_fkey"
            columns: ["closing_id"]
            isOneToOne: false
            referencedRelation: "cash_register_closings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_register_movements_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_register_movements_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          active: boolean | null
          created_at: string | null
          created_by: string | null
          description: string | null
          id: string
          name: string
          updated_at: string | null
        }
        Insert: {
          active?: boolean | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          name: string
          updated_at?: string | null
        }
        Update: {
          active?: boolean | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      cost_centers: {
        Row: {
          active: boolean | null
          code: string
          created_at: string | null
          created_by: string | null
          description: string | null
          id: string
          name: string
          updated_at: string | null
        }
        Insert: {
          active?: boolean | null
          code: string
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          name: string
          updated_at?: string | null
        }
        Update: {
          active?: boolean | null
          code?: string
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          name?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cost_centers_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_credit_history: {
        Row: {
          action_type: string
          created_at: string
          created_by: string | null
          customer_id: string
          id: string
          new_value: number | null
          notes: string | null
          old_value: number | null
          reference_id: string | null
          reference_type: string | null
        }
        Insert: {
          action_type: string
          created_at?: string
          created_by?: string | null
          customer_id: string
          id?: string
          new_value?: number | null
          notes?: string | null
          old_value?: number | null
          reference_id?: string | null
          reference_type?: string | null
        }
        Update: {
          action_type?: string
          created_at?: string
          created_by?: string | null
          customer_id?: string
          id?: string
          new_value?: number | null
          notes?: string | null
          old_value?: number | null
          reference_id?: string | null
          reference_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_credit_history_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_credit_history_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_credit_payments: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          customer_id: string
          id: string
          notes: string | null
          payment_method_id: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          created_by?: string | null
          customer_id: string
          id?: string
          notes?: string | null
          payment_method_id?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          customer_id?: string
          id?: string
          notes?: string | null
          payment_method_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_credit_payments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_credit_payments_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_credit_payments_payment_method_id_fkey"
            columns: ["payment_method_id"]
            isOneToOne: false
            referencedRelation: "payment_methods"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_delivery_addresses: {
        Row: {
          active: boolean | null
          address_city: string | null
          address_complement: string | null
          address_neighborhood: string | null
          address_number: string | null
          address_state: string | null
          address_street: string | null
          address_zip: string | null
          contact_name: string | null
          contact_phone: string | null
          created_at: string | null
          customer_id: string
          id: string
          is_default: boolean | null
          name: string
          updated_at: string | null
        }
        Insert: {
          active?: boolean | null
          address_city?: string | null
          address_complement?: string | null
          address_neighborhood?: string | null
          address_number?: string | null
          address_state?: string | null
          address_street?: string | null
          address_zip?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string | null
          customer_id: string
          id?: string
          is_default?: boolean | null
          name: string
          updated_at?: string | null
        }
        Update: {
          active?: boolean | null
          address_city?: string | null
          address_complement?: string | null
          address_neighborhood?: string | null
          address_number?: string | null
          address_state?: string | null
          address_street?: string | null
          address_zip?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string | null
          customer_id?: string
          id?: string
          is_default?: boolean | null
          name?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_delivery_addresses_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          active: boolean | null
          address_city: string | null
          address_complement: string | null
          address_neighborhood: string | null
          address_number: string | null
          address_state: string | null
          address_street: string | null
          address_zip: string | null
          created_at: string | null
          created_by: string | null
          credit_limit: number | null
          document: string | null
          document_type: string | null
          email: string | null
          id: string
          name: string
          observations: string | null
          phone: string | null
          phone_secondary: string | null
          responsible_user_id: string | null
          updated_at: string | null
        }
        Insert: {
          active?: boolean | null
          address_city?: string | null
          address_complement?: string | null
          address_neighborhood?: string | null
          address_number?: string | null
          address_state?: string | null
          address_street?: string | null
          address_zip?: string | null
          created_at?: string | null
          created_by?: string | null
          credit_limit?: number | null
          document?: string | null
          document_type?: string | null
          email?: string | null
          id?: string
          name: string
          observations?: string | null
          phone?: string | null
          phone_secondary?: string | null
          responsible_user_id?: string | null
          updated_at?: string | null
        }
        Update: {
          active?: boolean | null
          address_city?: string | null
          address_complement?: string | null
          address_neighborhood?: string | null
          address_number?: string | null
          address_state?: string | null
          address_street?: string | null
          address_zip?: string | null
          created_at?: string | null
          created_by?: string | null
          credit_limit?: number | null
          document?: string | null
          document_type?: string | null
          email?: string | null
          id?: string
          name?: string
          observations?: string | null
          phone?: string | null
          phone_secondary?: string | null
          responsible_user_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customers_responsible_user_id_fkey"
            columns: ["responsible_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_methods: {
        Row: {
          active: boolean | null
          allow_installments: boolean | null
          code: string
          created_at: string | null
          created_by: string | null
          id: string
          max_installments: number | null
          name: string
          updated_at: string | null
        }
        Insert: {
          active?: boolean | null
          allow_installments?: boolean | null
          code: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          max_installments?: number | null
          name: string
          updated_at?: string | null
        }
        Update: {
          active?: boolean | null
          allow_installments?: boolean | null
          code?: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          max_installments?: number | null
          name?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_methods_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          account_id: string | null
          amount_paid: number
          attachment_url: string | null
          created_at: string | null
          id: string
          notes: string | null
          paid_by: string | null
          payment_date: string
          payment_method: string | null
        }
        Insert: {
          account_id?: string | null
          amount_paid: number
          attachment_url?: string | null
          created_at?: string | null
          id?: string
          notes?: string | null
          paid_by?: string | null
          payment_date: string
          payment_method?: string | null
        }
        Update: {
          account_id?: string | null
          amount_paid?: number
          attachment_url?: string | null
          created_at?: string | null
          id?: string
          notes?: string | null
          paid_by?: string | null
          payment_date?: string
          payment_method?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts_payable"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "view_contas_pagar"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_paid_by_fkey"
            columns: ["paid_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      product_pricing: {
        Row: {
          cost_price: number
          created_at: string | null
          created_by: string | null
          id: string
          is_current: boolean | null
          markup: number | null
          product_id: string
          sale_price: number
          store_id: string
          valid_from: string | null
          valid_until: string | null
        }
        Insert: {
          cost_price?: number
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_current?: boolean | null
          markup?: number | null
          product_id: string
          sale_price?: number
          store_id: string
          valid_from?: string | null
          valid_until?: string | null
        }
        Update: {
          cost_price?: number
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_current?: boolean | null
          markup?: number | null
          product_id?: string
          sale_price?: number
          store_id?: string
          valid_from?: string | null
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_pricing_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_pricing_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      product_stock: {
        Row: {
          id: string
          max_quantity: number | null
          min_quantity: number | null
          product_id: string
          quantity: number
          store_id: string
          updated_at: string | null
        }
        Insert: {
          id?: string
          max_quantity?: number | null
          min_quantity?: number | null
          product_id: string
          quantity?: number
          store_id: string
          updated_at?: string | null
        }
        Update: {
          id?: string
          max_quantity?: number | null
          min_quantity?: number | null
          product_id?: string
          quantity?: number
          store_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_stock_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_stock_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          active: boolean | null
          brand_id: string | null
          category_id: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          ean: string | null
          id: string
          image_url: string | null
          internal_code: string
          name: string
          unit_id: string | null
          updated_at: string | null
        }
        Insert: {
          active?: boolean | null
          brand_id?: string | null
          category_id?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          ean?: string | null
          id?: string
          image_url?: string | null
          internal_code: string
          name: string
          unit_id?: string | null
          updated_at?: string | null
        }
        Update: {
          active?: boolean | null
          brand_id?: string | null
          category_id?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          ean?: string | null
          id?: string
          image_url?: string | null
          internal_code?: string
          name?: string
          unit_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "products_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string | null
          email: string
          full_name: string
          id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          email: string
          full_name: string
          id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string
          full_name?: string
          id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      sale_items: {
        Row: {
          created_at: string | null
          discount_amount: number | null
          discount_type: string | null
          discount_value: number | null
          id: string
          product_id: string
          quantity: number
          sale_id: string
          total: number
          unit_price: number
        }
        Insert: {
          created_at?: string | null
          discount_amount?: number | null
          discount_type?: string | null
          discount_value?: number | null
          id?: string
          product_id: string
          quantity: number
          sale_id: string
          total: number
          unit_price: number
        }
        Update: {
          created_at?: string | null
          discount_amount?: number | null
          discount_type?: string | null
          discount_value?: number | null
          id?: string
          product_id?: string
          quantity?: number
          sale_id?: string
          total?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "sale_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_items_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      sale_payments: {
        Row: {
          amount: number
          created_at: string | null
          id: string
          installments: number | null
          is_credit: boolean | null
          payment_method_id: string | null
          sale_id: string
        }
        Insert: {
          amount?: number
          created_at?: string | null
          id?: string
          installments?: number | null
          is_credit?: boolean | null
          payment_method_id?: string | null
          sale_id: string
        }
        Update: {
          amount?: number
          created_at?: string | null
          id?: string
          installments?: number | null
          is_credit?: boolean | null
          payment_method_id?: string | null
          sale_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sale_payments_payment_method_id_fkey"
            columns: ["payment_method_id"]
            isOneToOne: false
            referencedRelation: "payment_methods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_payments_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      sales: {
        Row: {
          amount_credit: number | null
          amount_paid: number | null
          cancellation_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          created_at: string | null
          created_by: string | null
          customer_id: string
          delivery_address_id: string | null
          delivery_date: string | null
          delivery_type: string | null
          discount_amount: number | null
          discount_type: string | null
          discount_value: number | null
          id: string
          installments: number | null
          notes: string | null
          payment_method_id: string | null
          payment_status: string
          sale_number: string
          status: string
          store_id: string
          subtotal: number
          total: number
          updated_at: string | null
        }
        Insert: {
          amount_credit?: number | null
          amount_paid?: number | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          created_at?: string | null
          created_by?: string | null
          customer_id: string
          delivery_address_id?: string | null
          delivery_date?: string | null
          delivery_type?: string | null
          discount_amount?: number | null
          discount_type?: string | null
          discount_value?: number | null
          id?: string
          installments?: number | null
          notes?: string | null
          payment_method_id?: string | null
          payment_status?: string
          sale_number: string
          status?: string
          store_id: string
          subtotal?: number
          total?: number
          updated_at?: string | null
        }
        Update: {
          amount_credit?: number | null
          amount_paid?: number | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          created_at?: string | null
          created_by?: string | null
          customer_id?: string
          delivery_address_id?: string | null
          delivery_date?: string | null
          delivery_type?: string | null
          discount_amount?: number | null
          discount_type?: string | null
          discount_value?: number | null
          id?: string
          installments?: number | null
          notes?: string | null
          payment_method_id?: string | null
          payment_status?: string
          sale_number?: string
          status?: string
          store_id?: string
          subtotal?: number
          total?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sales_cancelled_by_fkey"
            columns: ["cancelled_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_delivery_address_id_fkey"
            columns: ["delivery_address_id"]
            isOneToOne: false
            referencedRelation: "customer_delivery_addresses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_payment_method_id_fkey"
            columns: ["payment_method_id"]
            isOneToOne: false
            referencedRelation: "payment_methods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_movements: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          movement_type: string
          notes: string | null
          product_id: string
          quantity: number
          reference_id: string | null
          reference_type: string
          store_id: string
          unit_cost: number | null
          unit_price: number | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          movement_type: string
          notes?: string | null
          product_id: string
          quantity: number
          reference_id?: string | null
          reference_type: string
          store_id: string
          unit_cost?: number | null
          unit_price?: number | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          movement_type?: string
          notes?: string | null
          product_id?: string
          quantity?: number
          reference_id?: string | null
          reference_type?: string
          store_id?: string
          unit_cost?: number | null
          unit_price?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_movements_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_receipt_headers: {
        Row: {
          cancellation_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          created_at: string
          id: string
          invoice_number: string | null
          notes: string | null
          receipt_number: string
          received_at: string
          received_by: string | null
          status: string
          store_id: string
          supplier_id: string | null
        }
        Insert: {
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          created_at?: string
          id?: string
          invoice_number?: string | null
          notes?: string | null
          receipt_number: string
          received_at?: string
          received_by?: string | null
          status?: string
          store_id: string
          supplier_id?: string | null
        }
        Update: {
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          created_at?: string
          id?: string
          invoice_number?: string | null
          notes?: string | null
          receipt_number?: string
          received_at?: string
          received_by?: string | null
          status?: string
          store_id?: string
          supplier_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_receipt_headers_cancelled_by_fkey"
            columns: ["cancelled_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_receipt_headers_received_by_fkey"
            columns: ["received_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_receipt_headers_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_receipt_headers_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_receipts: {
        Row: {
          header_id: string | null
          id: string
          markup: number | null
          new_cost_price: number
          new_sale_price: number
          notes: string | null
          old_sale_price: number | null
          product_id: string
          quantity: number
          received_at: string | null
          received_by: string | null
          store_id: string
        }
        Insert: {
          header_id?: string | null
          id?: string
          markup?: number | null
          new_cost_price: number
          new_sale_price: number
          notes?: string | null
          old_sale_price?: number | null
          product_id: string
          quantity: number
          received_at?: string | null
          received_by?: string | null
          store_id: string
        }
        Update: {
          header_id?: string | null
          id?: string
          markup?: number | null
          new_cost_price?: number
          new_sale_price?: number
          notes?: string | null
          old_sale_price?: number | null
          product_id?: string
          quantity?: number
          received_at?: string | null
          received_by?: string | null
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_receipts_header_id_fkey"
            columns: ["header_id"]
            isOneToOne: false
            referencedRelation: "stock_receipt_headers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_receipts_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_receipts_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      stores: {
        Row: {
          active: boolean | null
          address: string | null
          cnpj: string | null
          code: string
          created_at: string | null
          created_by: string | null
          email: string | null
          id: string
          name: string
          pdv_auto_print: boolean | null
          pdv_max_discount_percent: number | null
          pdv_print_format: string | null
          phone: string | null
          updated_at: string | null
        }
        Insert: {
          active?: boolean | null
          address?: string | null
          cnpj?: string | null
          code: string
          created_at?: string | null
          created_by?: string | null
          email?: string | null
          id?: string
          name: string
          pdv_auto_print?: boolean | null
          pdv_max_discount_percent?: number | null
          pdv_print_format?: string | null
          phone?: string | null
          updated_at?: string | null
        }
        Update: {
          active?: boolean | null
          address?: string | null
          cnpj?: string | null
          code?: string
          created_at?: string | null
          created_by?: string | null
          email?: string | null
          id?: string
          name?: string
          pdv_auto_print?: boolean | null
          pdv_max_discount_percent?: number | null
          pdv_print_format?: string | null
          phone?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      suppliers: {
        Row: {
          active: boolean | null
          address_city: string | null
          address_complement: string | null
          address_neighborhood: string | null
          address_number: string | null
          address_state: string | null
          address_street: string | null
          address_zip: string | null
          bank_data: Json | null
          created_at: string | null
          created_by: string | null
          document: string | null
          email: string | null
          id: string
          name: string
          observations: string | null
          phone: string | null
          pix_keys: string[] | null
          updated_at: string | null
        }
        Insert: {
          active?: boolean | null
          address_city?: string | null
          address_complement?: string | null
          address_neighborhood?: string | null
          address_number?: string | null
          address_state?: string | null
          address_street?: string | null
          address_zip?: string | null
          bank_data?: Json | null
          created_at?: string | null
          created_by?: string | null
          document?: string | null
          email?: string | null
          id?: string
          name: string
          observations?: string | null
          phone?: string | null
          pix_keys?: string[] | null
          updated_at?: string | null
        }
        Update: {
          active?: boolean | null
          address_city?: string | null
          address_complement?: string | null
          address_neighborhood?: string | null
          address_number?: string | null
          address_state?: string | null
          address_street?: string | null
          address_zip?: string | null
          bank_data?: Json | null
          created_at?: string | null
          created_by?: string | null
          document?: string | null
          email?: string | null
          id?: string
          name?: string
          observations?: string | null
          phone?: string | null
          pix_keys?: string[] | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "suppliers_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      units: {
        Row: {
          abbreviation: string
          active: boolean | null
          created_at: string | null
          created_by: string | null
          id: string
          name: string
          updated_at: string | null
        }
        Insert: {
          abbreviation: string
          active?: boolean | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          name: string
          updated_at?: string | null
        }
        Update: {
          abbreviation?: string
          active?: boolean | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_stores: {
        Row: {
          created_at: string | null
          id: string
          store_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          store_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          store_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_stores_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      view_contas_pagar: {
        Row: {
          amount: number | null
          code_payment: string | null
          created_at: string | null
          description: string | null
          due_date: string | null
          id: string | null
          payment_type: Database["public"]["Enums"]["payment_type"] | null
          supplier_document: string | null
          supplier_name: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      cancel_sale: {
        Args: { p_reason: string; p_sale_id: string; p_user_id: string }
        Returns: boolean
      }
      cancel_stock_receipt: {
        Args: { p_header_id: string; p_reason: string; p_user_id: string }
        Returns: boolean
      }
      generate_receipt_number: { Args: { p_store_id: string }; Returns: string }
      generate_sale_number: { Args: { p_store_id: string }; Returns: string }
      get_account_attachments: {
        Args: { p_account_id: string }
        Returns: {
          created_at: string
          description: string
          file_category: string
          file_path: string
          file_size: number
          filename: string
          id: string
          is_payment_proof: boolean
          mime_type: string
          payment_date: string
          payment_id: string
          source: string
          updated_at: string
          uploaded_by: string
          uploader_name: string
        }[]
      }
      get_customer_available_credit: {
        Args: { p_customer_id: string }
        Returns: number
      }
      get_customer_used_credit: {
        Args: { p_customer_id: string }
        Returns: number
      }
      get_daily_sales_summary: {
        Args: { p_date: string; p_store_id: string }
        Returns: {
          credit_sales_count: number
          sales_count: number
          total_card: number
          total_cash: number
          total_credit: number
          total_other: number
          total_pix: number
          total_sales: number
        }[]
      }
      get_user_roles: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"][]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      set_timezone: { Args: never; Returns: undefined }
      update_stock_quantity: {
        Args: { p_product_id: string; p_quantity: number; p_store_id: string }
        Returns: undefined
      }
      user_has_any_store: { Args: { _user_id: string }; Returns: boolean }
      user_has_store_access: {
        Args: { _store_id: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      account_status: "em_aberto" | "pago" | "cancelado"
      app_role: "admin" | "pagador" | "operador" | "leitor"
      payment_type: "boleto" | "cartao" | "transferencia" | "pix"
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
      account_status: ["em_aberto", "pago", "cancelado"],
      app_role: ["admin", "pagador", "operador", "leitor"],
      payment_type: ["boleto", "cartao", "transferencia", "pix"],
    },
  },
} as const
