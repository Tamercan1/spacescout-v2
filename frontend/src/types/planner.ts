
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
    facts: Record<string, unknown>;
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
    content: {
        title: string;
        summary: string;
        sections: ResultSection[];
    };
    discoveries: number[];
    metadata?: Record<string, unknown>;
}

export interface ApodResult {
    result_type: "apod";
    content: {
        title: string;
        date: string;
        explanation: string;
        media_url: string | null;
        media_type: string | null;
        permalink?: string | null;
    };
    discoveries: number[];
    metadata?: Record<string, unknown>;
}

export interface NeowsResult {
    result_type: "neows";
    content: {
        title: string;
        summary: string;
        object_count: number;
        date_range: { start: string; end: string };
    };
    discoveries: number[];
    metadata?: Record<string, unknown>;
}

export interface DonkiResult {
    result_type: "donki";
    content: {
        title: string;
        summary: string;
        event_count: number;
        date_range: { start: string; end: string };
    };
    discoveries: number[];
    metadata?: Record<string, unknown>;
}

export interface NasaImageItem {
    nasa_id?: string;
    title: string;
    description?: string;
    date_created?: string;
    center?: string;
    media_type?: string;
    image_url?: string;
}

export interface NasaImagesResult {
    result_type: "nasa_images";
    content: {
        title: string;
        summary: string;
        query: string;
        item_count: number;
        items: NasaImageItem[];
    };
    discoveries: number[];
    metadata?: Record<string, unknown>;
}

export interface EpicImageItem {
    identifier?: string;
    caption?: string;
    image_name?: string;
    date: string;
    image_url?: string;
    centroid_coordinates?: {
        lat?: number;
        lon?: number;
    } | null;
}

export interface EpicResult {
    result_type: "epic";
    content: {
        title: string;
        summary: string;
        date: string;
        image_count: number;
        images: EpicImageItem[];
    };
    discoveries: number[];
    metadata?: Record<string, unknown>;
}

export interface GenericResult {
    result_type: string;
    content: Record<string, unknown>;
    discoveries: number[];
    metadata?: Record<string, unknown>;
}

// Add future result types here and extend this union
export type InteractionResponse = 
    | AnalysisResult 
    | ApodResult 
    | NeowsResult 
    | DonkiResult 
    | NasaImagesResult
    | EpicResult
    | GenericResult;
