
export interface DiscoveryMedia {
    id: number;
    media_type: string;
    url: string;
    thumbnail_url: string;
    caption: string;
    is_primary: boolean;
    order: number;
}

export interface Discovery {
    id: number;
    source: string;
    external_id: string | null;
    source_url: string;
    type: string;
    title: string;
    date: string | null;
    summary: string;
    why_interesting: string;
    facts: unknown[];
    tags: string[];
    details: Record<string, unknown>;
    sort_order: number;
    media: DiscoveryMedia[];
    first_discovered_at: string;
    updated_at: string;
}

export interface SpacePlan {
    id: number;
    prompt: string;
    title: string;
    summary: string;
    status: string;
    is_archived: boolean;
    discoveries: Discovery[];
    created_at: string;
    updated_at: string;
}

export interface SpacePlanRequest {
    prompt: string
}


// ============================================================
// INTERACTION TYPES
// ============================================================

export type InteractionType = "find_more" | "enrich" | "compare" | "related" | "other";
export type InteractionStatus = "pending" | "processing" | "completed" | "failed";

export interface Interaction {
    id: string;
    space_plan: number;
    user_prompt: string;
    interaction_type: InteractionType;
    status: InteractionStatus;
    response: InteractionResponse;
    error_code: string;
    target_discoveries: number[];
    added_discoveries: number[];
    created_at: string;
    completed_at: string | null;
}

export interface InteractionCreateRequest {
    user_prompt: string;
    interaction_type: InteractionType;
    target_discoveries?: number[];
}


// ============================================================
// INTERACTION RESPONSE TYPES
// ============================================================

export interface ResultSection {
    heading: string;
    content: string;
}

export interface AnalysisResult {
    result_type: "analysis";
    title: string;
    sections: ResultSection[];
}

export interface DiscoveryResult {
    result_type: "discovery";
    discoveries: Discovery[];
}

// Add future result types here and extend this union
export type InteractionResponse = AnalysisResult | DiscoveryResult | Record<string, unknown>;