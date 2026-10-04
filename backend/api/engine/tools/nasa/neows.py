from typing import Any
from api.engine.contracts import BaseTool, ToolResult, ToolExecutionContext, DiscoveryData, ResultType
from api.services.nasa.nasa_services import search_near_earth_objects
from api.services.credentials import get_provider_key

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
                result_type=self.result_type,
                data={"error": response["error"]},
                metadata={"success": False, "start_date": start_date, "end_date": end_date}
            )
            
        discoveries = []
        objects = response.get("objects", [])
        
        for obj in objects:
            discovery = DiscoveryData(
                source=self.name,
                external_id=obj.get("id"),
                title=f"Asteroid {obj.get('name')}",
                summary=f"Asteroid approach on {obj.get('date')}",
                date=obj.get("date"),
                source_url=obj.get("nasa_jpl_url", ""),
                facts={
                    "miss_distance_km": obj.get("miss_distance_km"),
                    "is_potentially_hazardous": obj.get("is_potentially_hazardous"),
                    "estimated_diameter_min_km": obj.get("estimated_diameter_km", {}).get("min"),
                    "estimated_diameter_max_km": obj.get("estimated_diameter_km", {}).get("max")
                }
            )
            discoveries.append(discovery)
            
        return ToolResult(
            tool_name=self.name,
            result_type=self.result_type,
            data=response,
            discoveries=discoveries,
            metadata={
                "success": True, 
                "count": response.get("count", 0),
                "start_date": start_date,
                "end_date": end_date
            }
        )
