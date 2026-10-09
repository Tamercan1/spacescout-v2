from typing import Any
from api.engine.contracts import BaseTool, ToolResult, ToolExecutionContext, DiscoveryData, ResultType
from api.services.nasa.nasa_services import search_near_earth_objects
from api.services.credentials import get_provider_key
def format_neows_facts(obj: dict[str, Any]) -> dict[str, Any]:
    """
    Formats facts with clean, human-readable Title Case keys and friendly values.
    """
    is_hazardous = obj.get("is_potentially_hazardous", False)
    miss_km_raw = obj.get("miss_distance_km")
    diam = obj.get("estimated_diameter_km") or {}

    miss_km = None
    try:
        miss_km = float(miss_km_raw) if miss_km_raw is not None else None
    except (ValueError, TypeError):
        pass

    dist_str = ""
    if miss_km is not None:
        ld = miss_km / 384400.0
        if miss_km >= 1_000_000:
            dist_str = f"{miss_km / 1_000_000.0:.2f} million km ({ld:.1f} LD)"
        else:
            dist_str = f"{miss_km:,.0f} km ({ld:.1f} LD)"
    else:
        dist_str = str(miss_km_raw or "Unknown")

    size_str = "Unknown"
    min_km = diam.get("min") if isinstance(diam, dict) else None
    max_km = diam.get("max") if isinstance(diam, dict) else None
    if min_km is not None and max_km is not None:
        try:
            min_m = float(min_km) * 1000
            max_m = float(max_km) * 1000
            if max_m >= 1000:
                size_str = f"{float(min_km):.2f} – {float(max_km):.2f} km"
            else:
                size_str = f"{min_m:.0f}m – {max_m:.0f}m"
        except (ValueError, TypeError):
            pass

    return {
        "Potentially Hazardous": "Yes" if is_hazardous else "No",
        "Closest Approach Distance": dist_str,
        "Estimated Diameter": size_str,
    }


class NeoWsTool(BaseTool):
    """
    NASA Near Earth Object Web Service (NeoWs) Tool.
    Searches for near-earth asteroids based on a date range.
    """
    
    @property
    def name(self) -> str:
        return "neows"
        
    @property
    def description(self) -> str:
        return "Search for Near Earth Objects (Asteroids) using NASA's NeoWs. Returns asteroids passing near Earth within a specified date range (max 7 days)."
        
    @property
    def parameters(self) -> list:
        return []
        
    @property
    def result_type(self) -> str:
        return ResultType.NEOWS.value
        
    def get_openai_schema(self) -> dict[str, Any]:
        return {
            "name": self.name,
            "description": self.description,
            "parameters": {
                "type": "object",
                "properties": {
                    "start_date": {
                        "type": "string",
                        "description": "The start date for the search in YYYY-MM-DD format."
                    },
                    "end_date": {
                        "type": "string",
                        "description": "The end date for the search in YYYY-MM-DD format. Must be within 7 days of start_date."
                    }
                },
                "required": ["start_date", "end_date"],
                "additionalProperties": False
            }
        }
        
    def validate_arguments(self, arguments: dict[str, Any]) -> dict[str, Any]:
        if "start_date" not in arguments:
            raise ValueError("The 'start_date' argument is required.")
        if "end_date" not in arguments:
            raise ValueError("The 'end_date' argument is required.")
            
        start_date = arguments["start_date"]
        end_date = arguments["end_date"]
        
        if not isinstance(start_date, str) or not isinstance(end_date, str):
            raise ValueError("Dates must be strings in YYYY-MM-DD format.")
            
        return arguments
        
    def execute(self, context: ToolExecutionContext, **kwargs) -> ToolResult:
        start_date = kwargs["start_date"]
        end_date = kwargs["end_date"]
        
        api_key = get_provider_key(context.user_id, "nasa") if context.user_id else None
        
        # NASA API call
        response = search_near_earth_objects(
            start_date=start_date, 
            end_date=end_date, 
            api_key=api_key
        )
        
        if "error" in response:
            return ToolResult(
                tool_name=self.name,
                result_type="error",
                data={"error": response["error"]},
                metadata={"success": False, "start_date": start_date, "end_date": end_date}
            )
            
        discoveries = []
        objects = response.get("objects", [])
        
        # Prioritize potentially hazardous objects, then closest distance, and limit to top 10
        objects.sort(key=lambda x: (
            not x.get('is_potentially_hazardous', False), 
            float(x.get('miss_distance_km', 'inf'))
        ))
        objects = objects[:10]
        
        for obj in objects:
            discovery = DiscoveryData(
                source=self.name,
                external_id=obj.get("id"),
                title=f"Asteroid {obj.get('name')}",
                summary=f"Asteroid approach on {obj.get('date')}",
                why_interesting="",
                date=obj.get("date"),
                source_url=obj.get("nasa_jpl_url", ""),
                facts=format_neows_facts(obj)
            )
            discoveries.append(discovery)
            
        return ToolResult(
            tool_name=self.name,
            result_type=self.result_type,
            data={
                "title": "Near Earth Objects",
                "summary": f"Found {response.get('count', 0)} asteroids approaching Earth.",
                "object_count": response.get("count", 0),
                "date_range": {"start": start_date, "end": end_date},
                "objects": response.get("objects", [])
            },
            discoveries=discoveries,
            metadata={
                "success": True, 
                "count": response.get("count", 0),
                "start_date": start_date,
                "end_date": end_date
            }
        )
