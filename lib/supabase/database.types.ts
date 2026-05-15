export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      afastamento_tipos: {
        Row: {
          ativo: boolean
          codigo: string
          id: string
          ordem: number
          requer_aprovacao: boolean
          rotulo: string
        }
        Insert: {
          ativo?: boolean
          codigo: string
          id?: string
          ordem?: number
          requer_aprovacao: boolean
          rotulo: string
        }
        Update: {
          ativo?: boolean
          codigo?: string
          id?: string
          ordem?: number
          requer_aprovacao?: boolean
          rotulo?: string
        }
        Relationships: []
      }
      afastamentos: {
        Row: {
          acidente: boolean
          arquivo_url: string | null
          atualizado_em: string
          cid: string | null
          colaborador_cargo: string | null
          colaborador_codigo_soc: string | null
          colaborador_nome: string | null
          colaborador_setor: string | null
          cpf: string
          criado_em: string
          data_fim: string | null
          data_inicio: string
          decidido_em: string | null
          decidido_por: string | null
          duracao: number | null
          email_remetente: string
          emissor: Json | null
          empresa_id: string
          enviado_fluig_em: string | null
          hora_fim: string | null
          hora_inicio: string | null
          id: string
          inss: boolean
          internacao: boolean
          motivo_rejeicao: string | null
          serial_id: number | null
          situacao: string
          tipo_id: string
          token_edicao: string
          unidade_id: string
        }
        Insert: {
          acidente?: boolean
          arquivo_url?: string | null
          atualizado_em?: string
          cid?: string | null
          colaborador_cargo?: string | null
          colaborador_codigo_soc?: string | null
          colaborador_nome?: string | null
          colaborador_setor?: string | null
          cpf: string
          criado_em?: string
          data_fim?: string | null
          data_inicio: string
          decidido_em?: string | null
          decidido_por?: string | null
          duracao?: number | null
          email_remetente: string
          emissor?: Json | null
          empresa_id: string
          enviado_fluig_em?: string | null
          hora_fim?: string | null
          hora_inicio?: string | null
          id?: string
          inss?: boolean
          internacao?: boolean
          motivo_rejeicao?: string | null
          serial_id?: number | null
          situacao: string
          tipo_id: string
          token_edicao?: string
          unidade_id: string
        }
        Update: {
          acidente?: boolean
          arquivo_url?: string | null
          atualizado_em?: string
          cid?: string | null
          colaborador_cargo?: string | null
          colaborador_codigo_soc?: string | null
          colaborador_nome?: string | null
          colaborador_setor?: string | null
          cpf?: string
          criado_em?: string
          data_fim?: string | null
          data_inicio?: string
          decidido_em?: string | null
          decidido_por?: string | null
          duracao?: number | null
          email_remetente?: string
          emissor?: Json | null
          empresa_id?: string
          enviado_fluig_em?: string | null
          hora_fim?: string | null
          hora_inicio?: string | null
          id?: string
          inss?: boolean
          internacao?: boolean
          motivo_rejeicao?: string | null
          serial_id?: number | null
          situacao?: string
          tipo_id?: string
          token_edicao?: string
          unidade_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "afastamentos_decidido_por_fkey"
            columns: ["decidido_por"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "afastamentos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "afastamentos_tipo_id_fkey"
            columns: ["tipo_id"]
            isOneToOne: false
            referencedRelation: "afastamento_tipos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "afastamentos_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      colaboradores: {
        Row: {
          auth_id: string | null
          cpf: string
          criado_em: string
          email: string | null
        }
        Insert: {
          auth_id?: string | null
          cpf: string
          criado_em?: string
          email?: string | null
        }
        Update: {
          auth_id?: string | null
          cpf?: string
          criado_em?: string
          email?: string | null
        }
        Relationships: []
      }
      configuracoes: {
        Row: {
          atualizado_em: string | null
          atualizado_por: string | null
          email_folha: string
          id: number
          portal_banner: string
          portal_saudacao: string
          portal_vazio: string
        }
        Insert: {
          atualizado_em?: string | null
          atualizado_por?: string | null
          email_folha?: string
          id: number
          portal_banner?: string
          portal_saudacao?: string
          portal_vazio?: string
        }
        Update: {
          atualizado_em?: string | null
          atualizado_por?: string | null
          email_folha?: string
          id?: number
          portal_banner?: string
          portal_saudacao?: string
          portal_vazio?: string
        }
        Relationships: [
          {
            foreignKeyName: "configuracoes_atualizado_por_fkey"
            columns: ["atualizado_por"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      configuracoes_dashboard: {
        Row: {
          atualizado_em: string
          config: Json
          id: boolean
        }
        Insert: {
          atualizado_em?: string
          config?: Json
          id?: boolean
        }
        Update: {
          atualizado_em?: string
          config?: Json
          id?: boolean
        }
        Relationships: []
      }
      empresas: {
        Row: {
          ativo: boolean
          cnpj: string | null
          codigo_fluig: string | null
          codigo_soc: string | null
          id: string
          nome: string
          razao_social: string | null
        }
        Insert: {
          ativo?: boolean
          cnpj?: string | null
          codigo_fluig?: string | null
          codigo_soc?: string | null
          id?: string
          nome: string
          razao_social?: string | null
        }
        Update: {
          ativo?: boolean
          cnpj?: string | null
          codigo_fluig?: string | null
          codigo_soc?: string | null
          id?: string
          nome?: string
          razao_social?: string | null
        }
        Relationships: []
      }
      equipe_usuarios: {
        Row: {
          equipe_id: string
          usuario_id: string
        }
        Insert: {
          equipe_id: string
          usuario_id: string
        }
        Update: {
          equipe_id?: string
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "equipe_usuarios_equipe_id_fkey"
            columns: ["equipe_id"]
            isOneToOne: false
            referencedRelation: "equipes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipe_usuarios_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      equipes: {
        Row: {
          ativo: boolean
          codigo: string
          id: string
          nome: string
        }
        Insert: {
          ativo?: boolean
          codigo: string
          id?: string
          nome: string
        }
        Update: {
          ativo?: boolean
          codigo?: string
          id?: string
          nome?: string
        }
        Relationships: []
      }
      eventos: {
        Row: {
          autor_id: string | null
          dados: Json
          entidade_id: string
          evento: string
          id: string
          ocorrido_em: string
          tipo_entidade: string
        }
        Insert: {
          autor_id?: string | null
          dados?: Json
          entidade_id: string
          evento: string
          id?: string
          ocorrido_em?: string
          tipo_entidade: string
        }
        Update: {
          autor_id?: string | null
          dados?: Json
          entidade_id?: string
          evento?: string
          id?: string
          ocorrido_em?: string
          tipo_entidade?: string
        }
        Relationships: [
          {
            foreignKeyName: "eventos_autor_id_fkey"
            columns: ["autor_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      investigacao_categorias: {
        Row: {
          ativo: boolean
          atualizado_em: string
          codigo: string
          criado_em: string
          id: string
          ordem: number
          rotulo: string
        }
        Insert: {
          ativo?: boolean
          atualizado_em?: string
          codigo: string
          criado_em?: string
          id?: string
          ordem?: number
          rotulo: string
        }
        Update: {
          ativo?: boolean
          atualizado_em?: string
          codigo?: string
          criado_em?: string
          id?: string
          ordem?: number
          rotulo?: string
        }
        Relationships: []
      }
      investigacao_causas: {
        Row: {
          ativo: boolean
          atualizado_em: string
          categoria_id: string
          criado_em: string
          id: string
          ordem: number
          texto: string
        }
        Insert: {
          ativo?: boolean
          atualizado_em?: string
          categoria_id: string
          criado_em?: string
          id?: string
          ordem?: number
          texto: string
        }
        Update: {
          ativo?: boolean
          atualizado_em?: string
          categoria_id?: string
          criado_em?: string
          id?: string
          ordem?: number
          texto?: string
        }
        Relationships: [
          {
            foreignKeyName: "investigacao_causas_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "investigacao_categorias"
            referencedColumns: ["id"]
          },
        ]
      }
      investigacao_graus: {
        Row: {
          ativo: boolean
          atualizado_em: string
          codigo: string
          criado_em: string
          id: string
          ordem: number
          rotulo: string
        }
        Insert: {
          ativo?: boolean
          atualizado_em?: string
          codigo: string
          criado_em?: string
          id?: string
          ordem?: number
          rotulo: string
        }
        Update: {
          ativo?: boolean
          atualizado_em?: string
          codigo?: string
          criado_em?: string
          id?: string
          ordem?: number
          rotulo?: string
        }
        Relationships: []
      }
      investigacoes: {
        Row: {
          atualizado_em: string
          criado_em: string
          dados: Json
          id: string
          ocorrencia_id: string
          situacao: string
        }
        Insert: {
          atualizado_em?: string
          criado_em?: string
          dados?: Json
          id?: string
          ocorrencia_id: string
          situacao?: string
        }
        Update: {
          atualizado_em?: string
          criado_em?: string
          dados?: Json
          id?: string
          ocorrencia_id?: string
          situacao?: string
        }
        Relationships: [
          {
            foreignKeyName: "investigacoes_ocorrencia_id_fkey"
            columns: ["ocorrencia_id"]
            isOneToOne: true
            referencedRelation: "ocorrencias"
            referencedColumns: ["id"]
          },
        ]
      }
      ocorrencias: {
        Row: {
          arquivo_url: string | null
          atualizado_em: string
          criado_em: string
          data_ocorrencia: string
          descricao: string | null
          email_remetente: string
          empresa_id: string
          id: string
          situacao: string
          tipo: string
          unidade_id: string
        }
        Insert: {
          arquivo_url?: string | null
          atualizado_em?: string
          criado_em?: string
          data_ocorrencia: string
          descricao?: string | null
          email_remetente: string
          empresa_id: string
          id?: string
          situacao?: string
          tipo: string
          unidade_id: string
        }
        Update: {
          arquivo_url?: string | null
          atualizado_em?: string
          criado_em?: string
          data_ocorrencia?: string
          descricao?: string | null
          email_remetente?: string
          empresa_id?: string
          id?: string
          situacao?: string
          tipo?: string
          unidade_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ocorrencias_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ocorrencias_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      unidades: {
        Row: {
          ativo: boolean
          codigo: string
          id: string
          nome: string
        }
        Insert: {
          ativo?: boolean
          codigo: string
          id?: string
          nome: string
        }
        Update: {
          ativo?: boolean
          codigo?: string
          id?: string
          nome?: string
        }
        Relationships: []
      }
      portal_otp_codes: {
        Row: {
          id: string
          cpf: string
          email: string
          code: string
          expires_at: string
          used: boolean
          created_at: string
        }
        Insert: {
          id?: string
          cpf: string
          email: string
          code: string
          expires_at: string
          used?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          cpf?: string
          email?: string
          code?: string
          expires_at?: string
          used?: boolean
          created_at?: string
        }
        Relationships: []
      }
      usuarios: {
        Row: {
          administrador: boolean
          ativo: boolean
          criado_em: string
          criado_por: string | null
          email: string
          id: string
          nome: string
          sobrenome: string | null
        }
        Insert: {
          administrador?: boolean
          ativo?: boolean
          criado_em?: string
          criado_por?: string | null
          email: string
          id: string
          nome: string
          sobrenome?: string | null
        }
        Update: {
          administrador?: boolean
          ativo?: boolean
          criado_em?: string
          criado_por?: string | null
          email?: string
          id?: string
          nome?: string
          sobrenome?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "usuarios_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      colaborador_cpf: { Args: { uid: string }; Returns: string }
      is_admin: { Args: { uid: string }; Returns: boolean }
      is_in_equipe: {
        Args: { eq_codigo: string; uid: string }
        Returns: boolean
      }
    }
    Enums: {
      [_ in never]: never
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const

