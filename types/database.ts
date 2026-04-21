export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          username: string;
          user_type: "creator" | "aspiring" | "audience";
          name: string | null;
          real_name: string | null;
          bio: string | null;
          field: string | null;
          sns_links: Json;
          avatar_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          username: string;
          user_type?: "creator" | "aspiring" | "audience";
          name?: string | null;
          real_name?: string | null;
          bio?: string | null;
          field?: string | null;
          sns_links?: Json;
          avatar_url?: string | null;
        };
        Update: {
          user_type?: "creator" | "aspiring" | "audience";
          name?: string | null;
          real_name?: string | null;
          bio?: string | null;
          field?: string | null;
          sns_links?: Json;
          avatar_url?: string | null;
        };
        Relationships: [];
      };
      artworks: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          year: number | null;
          medium: string | null;
          width_cm: number | null;
          height_cm: number | null;
          edition: string | null;
          description: string | null;
          image_url: string;
          image_top_url: string | null;
          image_bottom_url: string | null;
          image_left_url: string | null;
          image_right_url: string | null;
          tags: string[];
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          title: string;
          year?: number | null;
          medium?: string | null;
          width_cm?: number | null;
          height_cm?: number | null;
          edition?: string | null;
          description?: string | null;
          image_url: string;
          image_top_url?: string | null;
          image_bottom_url?: string | null;
          image_left_url?: string | null;
          image_right_url?: string | null;
          tags?: string[];
        };
        Update: {
          title?: string;
          year?: number | null;
          medium?: string | null;
          width_cm?: number | null;
          height_cm?: number | null;
          edition?: string | null;
          description?: string | null;
          image_url?: string;
          image_top_url?: string | null;
          image_bottom_url?: string | null;
          image_left_url?: string | null;
          image_right_url?: string | null;
          tags?: string[];
        };
        Relationships: [
          {
            foreignKeyName: "artworks_user_id_fkey";
            columns: ["user_id"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      follows: {
        Row: {
          follower_id: string;
          following_id: string;
          created_at: string;
        };
        Insert: {
          follower_id: string;
          following_id: string;
        };
        Update: {
          follower_id?: string;
          following_id?: string;
        };
        Relationships: [];
      };
      exhibitions: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          description: string | null;
          foreword: string | null;
          room_type: "small" | "medium" | "large" | "wide";
          wall_color_north: string;
          wall_color_south: string;
          wall_color_east: string;
          wall_color_west: string;
          floor_color: string;
          ceiling_color: string;
          poster_image_url: string | null;
          is_published: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          title: string;
          description?: string | null;
          foreword?: string | null;
          room_type?: "small" | "medium" | "large" | "wide";
          wall_color_north?: string;
          wall_color_south?: string;
          wall_color_east?: string;
          wall_color_west?: string;
          floor_color?: string;
          ceiling_color?: string;
          poster_image_url?: string | null;
          is_published?: boolean;
        };
        Update: {
          title?: string;
          description?: string | null;
          foreword?: string | null;
          room_type?: "small" | "medium" | "large" | "wide";
          wall_color_north?: string;
          wall_color_south?: string;
          wall_color_east?: string;
          wall_color_west?: string;
          floor_color?: string;
          ceiling_color?: string;
          poster_image_url?: string | null;
          is_published?: boolean;
        };
        Relationships: [
          {
            foreignKeyName: "exhibitions_user_id_fkey";
            columns: ["user_id"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      exhibition_artworks: {
        Row: {
          id: string;
          exhibition_id: string;
          artwork_id: string;
          wall: "north" | "south" | "east" | "west";
          position_x: number;
          position_y: number;
          width_cm: number;
          height_cm: number;
          created_at: string;
        };
        Insert: {
          exhibition_id: string;
          artwork_id: string;
          wall: "north" | "south" | "east" | "west";
          position_x?: number;
          position_y?: number;
          width_cm?: number;
          height_cm?: number;
        };
        Update: {
          wall?: "north" | "south" | "east" | "west";
          position_x?: number;
          position_y?: number;
          width_cm?: number;
          height_cm?: number;
        };
        Relationships: [
          {
            foreignKeyName: "exhibition_artworks_exhibition_id_fkey";
            columns: ["exhibition_id"];
            referencedRelation: "exhibitions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "exhibition_artworks_artwork_id_fkey";
            columns: ["artwork_id"];
            referencedRelation: "artworks";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};
